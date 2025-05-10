const mongoose = require('mongoose');

const accountSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  bankId: { type: mongoose.Schema.Types.ObjectId, ref: 'Bank', required: true },
  accountHolderName: { type: String, required: true },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  balance: { type: Number, default: 0 },
  accountNumber: { 
    type: String, 
    unique: true,
    default: function() {
      return Math.floor(100000000000 + Math.random() * 900000000000).toString(); // 12-digit number
    }
  }
});

module.exports = mongoose.model('Account', accountSchema);