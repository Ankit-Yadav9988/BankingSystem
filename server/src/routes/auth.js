const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Bank = require('../models/Bank');
const Account = require('../models/Account');
const Transaction = require('../models/Transaction');
const bcrypt = require('bcrypt');
const { Types } = require('mongoose');
require('dotenv').config();

// Customer signup
router.post('/signup', async (req, res) => {
  const { name, email, phone, password } = req.body;
  try {
    const emailExists = await User.findOne({ email });
    if (emailExists) return res.status(400).json({ msg: 'Email already exists' });

    const phoneExists = await User.findOne({ phone });
    if (phoneExists) return res.status(400).json({ msg: 'Phone already exists' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({ name, email, phone, password: hashedPassword, role: 'customer' });
    await user.save();

    res.json({ msg: 'Signup successful', userId: user._id });
  } catch (err) {
    console.error('Signup Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Manager and Customer login
router.post('/login', async (req, res) => {
  const { email, name, password, bankName } = req.body;
  try {
    let user;
    if (email) {
      user = await User.findOne({ email });
      if (!user) return res.status(400).json({ msg: 'User not found' });
      if (user.role !== 'customer') return res.status(400).json({ msg: 'Use manager login for this account' });
    } else if (name && bankName) {
      user = await User.findOne({ name: { $regex: new RegExp(`^${name}$`, 'i') }, role: 'manager' });
      if (!user) return res.status(400).json({ msg: 'Manager not found' });
      const bank = await Bank.findOne({ name: { $regex: new RegExp(`^${bankName}$`, 'i') }, manager: user._id });
      if (!bank) return res.status(403).json({ msg: 'You are not the manager of this bank' });
    } else {
      return res.status(400).json({ msg: 'Invalid login details: Provide email for customer or name and bankName for manager' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ msg: 'Invalid password' });

    res.json({ msg: 'Login successful', userId: user._id, role: user.role });
  } catch (err) {
    console.error('Login Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Open a bank account
router.post('/open-account', async (req, res) => {
  const { userId, bankId, accountHolderName } = req.body;
  try {
    if (!Types.ObjectId.isValid(userId) || !Types.ObjectId.isValid(bankId)) {
      return res.status(400).json({ msg: 'Invalid userId or bankId' });
    }

    const user = await User.findById(userId);
    if (!user || user.role !== 'customer') return res.status(400).json({ msg: 'Invalid user' });

    const bank = await Bank.findById(bankId);
    if (!bank) return res.status(400).json({ msg: 'Bank not found' });

    const account = new Account({ userId, bankId, accountHolderName });
    await account.save();

    res.json({ msg: 'Account opening request submitted', accountId: account._id, accountNumber: account.accountNumber });
  } catch (err) {
    console.error('Open Account Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Customer dashboard data
router.get('/customer-dashboard/:userId', async (req, res) => {
  try {
    if (!Types.ObjectId.isValid(req.params.userId)) {
      return res.status(400).json({ msg: 'Invalid userId' });
    }

    const accounts = await Account.find({ userId: req.params.userId })
      .populate('bankId', 'name')
      .select('accountHolderName accountNumber balance status bankId');
    console.log('Accounts fetched:', JSON.stringify(accounts, null, 2)); // Detailed debug log
    res.json({ accounts });
  } catch (err) {
    console.error('Dashboard Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Submit a transaction
router.post('/transaction', async (req, res) => {
  const { accountId, type, amount } = req.body;
  try {
    if (!Types.ObjectId.isValid(accountId)) {
      return res.status(400).json({ msg: 'Invalid accountId' });
    }
    if (!['deposit', 'withdrawal'].includes(type)) {
      return res.status(400).json({ msg: 'Invalid transaction type' });
    }
    if (!amount || amount <= 0) {
      return res.status(400).json({ msg: 'Amount must be a positive number' });
    }

    const account = await Account.findById(accountId);
    if (!account || account.status !== 'approved') {
      return res.status(400).json({ msg: 'Account not found or not approved' });
    }

    const transaction = new Transaction({ accountId, type, amount });
    await transaction.save();

    res.json({ msg: 'Transaction submitted for approval', transactionId: transaction._id });
  } catch (err) {
    console.error('Transaction Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Transfer money between accounts
router.post('/transfer', async (req, res) => {
  const { fromAccountId, toAccountNumber, amount } = req.body;
  try {
    if (!Types.ObjectId.isValid(fromAccountId)) {
      return res.status(400).json({ msg: 'Invalid source accountId' });
    }
    if (!toAccountNumber || !/^\d{12}$/.test(toAccountNumber)) {
      return res.status(400).json({ msg: 'Destination account number must be 12 digits' });
    }
    if (!amount || amount <= 0) {
      return res.status(400).json({ msg: 'Amount must be a positive number' });
    }

    const fromAccount = await Account.findById(fromAccountId);
    if (!fromAccount || fromAccount.status !== 'approved') {
      return res.status(400).json({ msg: 'Source account not found or not approved' });
    }
    if (!fromAccount.balance) fromAccount.balance = 0;
    if (fromAccount.balance < amount) {
      return res.status(400).json({ msg: 'Insufficient funds' });
    }

    const toAccount = await Account.findOne({ accountNumber: toAccountNumber, status: 'approved' });
    if (!toAccount) {
      return res.status(400).json({ msg: 'Destination account not found or not approved' });
    }

    const withdrawal = new Transaction({ accountId: fromAccountId, type: 'withdrawal', amount });
    await withdrawal.save();

    const deposit = new Transaction({ accountId: toAccount._id, type: 'deposit', amount });
    await deposit.save();

    res.json({ msg: 'Transfer submitted for approval', withdrawalId: withdrawal._id, depositId: deposit._id });
  } catch (err) {
    console.error('Transfer Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Admin - Approve/Reject account
router.post('/admin/approve-account', async (req, res) => {
  const { accountId, status, managerId } = req.body;
  try {
    if (!Types.ObjectId.isValid(accountId) || !Types.ObjectId.isValid(managerId)) {
      return res.status(400).json({ msg: 'Invalid accountId or managerId' });
    }

    const manager = await User.findById(managerId);
    if (!manager || manager.role !== 'manager') return res.status(403).json({ msg: 'Unauthorized' });

    const account = await Account.findById(accountId).populate('bankId');
    if (!account) return res.status(404).json({ msg: 'Account not found' });
    if (account.bankId.manager.toString() !== managerId) {
      return res.status(403).json({ msg: 'Not authorized for this bank' });
    }

    account.status = status;
    await account.save();

    res.json({ msg: `Account ${status}` });
  } catch (err) {
    console.error('Approve Account Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Admin - Approve/Reject transaction
router.post('/admin/approve-transaction', async (req, res) => {
  const { transactionId, status, managerId } = req.body;
  try {
    if (!Types.ObjectId.isValid(transactionId) || !Types.ObjectId.isValid(managerId)) {
      return res.status(400).json({ msg: 'Invalid transactionId or managerId' });
    }

    const manager = await User.findById(managerId);
    if (!manager || manager.role !== 'manager') return res.status(403).json({ msg: 'Unauthorized' });

    const transaction = await Transaction.findById(transactionId).populate({
      path: 'accountId',
      populate: { path: 'bankId' },
    });
    if (!transaction) return res.status(404).json({ msg: 'Transaction not found' });
    if (transaction.accountId.bankId.manager.toString() !== managerId) {
      return res.status(403).json({ msg: 'Not authorized for this bank' });
    }

    transaction.status = status;
    if (status === 'approved') {
      const account = await Account.findById(transaction.accountId._id);
      if (!account.balance) account.balance = 0;
      if (transaction.type === 'deposit') {
        account.balance += transaction.amount;
      } else if (transaction.type === 'withdrawal') {
        if (account.balance < transaction.amount) {
          return res.status(400).json({ msg: 'Insufficient funds' });
        }
        account.balance -= transaction.amount;
      }
      await account.save();
    }
    await transaction.save();

    res.json({ msg: `Transaction ${status}` });
  } catch (err) {
    console.error('Approve Transaction Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Admin dashboard - Get pending accounts, transactions, all accounts, and all transactions
router.get('/admin-dashboard/:managerId', async (req, res) => {
  try {
    if (!Types.ObjectId.isValid(req.params.managerId)) {
      return res.status(400).json({ msg: 'Invalid managerId' });
    }

    const manager = await User.findById(req.params.managerId);
    if (!manager || manager.role !== 'manager') return res.status(403).json({ msg: 'Unauthorized' });

    const bank = await Bank.findOne({ manager: manager._id });
    if (!bank) return res.status(404).json({ msg: 'Bank not found' });

    // Fetch pending accounts
    const pendingAccounts = await Account.find({ bankId: bank._id, status: 'pending' })
      .populate('userId', 'name email')
      .lean();

    // Fetch pending transactions
    const pendingTransactions = await Transaction.find({ status: 'pending' })
      .populate({
        path: 'accountId',
        match: { bankId: bank._id },
        populate: { path: 'userId', select: 'name' },
      })
      .lean()
      .then(transactions => transactions.filter(t => t.accountId));

    // Fetch all accounts for the manager's bank
    const allAccounts = await Account.find({ bankId: bank._id })
      .populate('userId', 'name email')
      .lean();

    // Fetch all transactions for the manager's bank
    const allTransactions = await Transaction.find()
      .populate({
        path: 'accountId',
        match: { bankId: bank._id },
        populate: { path: 'userId', select: 'name' },
      })
      .lean()
      .then(transactions => transactions.filter(t => t.accountId));

    res.json({ pendingAccounts, pendingTransactions, allAccounts, allTransactions });
  } catch (err) {
    console.error('Admin Dashboard Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Fetch all banks
router.get('/banks', async (req, res) => {
  try {
    const banks = await Bank.find().select('name _id');
    res.json(banks);
  } catch (err) {
    console.error('Banks Fetch Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Fetch customer transactions
router.get('/customer-transactions/:userId', async (req, res) => {
  try {
    if (!Types.ObjectId.isValid(req.params.userId)) {
      return res.status(400).json({ msg: 'Invalid userId' });
    }
    const accounts = await Account.find({ userId: req.params.userId }).select('_id');
    const accountIds = accounts.map(account => account._id);

    const transactions = await Transaction.find({
      status: 'approved',
      accountId: { $in: accountIds },
    })
      .populate({
        path: 'accountId',
        populate: { path: 'bankId', select: 'name' },
      })
      .lean();

    res.json({ transactions });
  } catch (err) {
    console.error('Transaction History Error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;