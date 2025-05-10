const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  accountId: { type: mongoose.Schema.Types.ObjectId, ref: 'Account', required: true },
  type: { type: String, enum: ['deposit', 'withdrawal'], required: true },
  amount: { type: Number, required: true },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  transferId: { type: mongoose.Schema.Types.ObjectId, ref: 'Transaction', default: null }
}, { timestamps: true }); // Explicitly enable timestamps

module.exports = mongoose.model('Transaction', transactionSchema);