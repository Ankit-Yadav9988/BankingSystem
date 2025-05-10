const mongoose = require('mongoose');

const bankSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  manager: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // Manager of this bank
});

module.exports = mongoose.model('Bank', bankSchema);