const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  amountCents: { type: Number, required: true, min: 1 },
  note: { type: String, default: '', maxlength: 120 },
  status: {
    type: String,
    enum: ['posted', 'queued', 'approved', 'posting', 'flagged', 'rejected'],
    required: true,
    index: true,
  },
  queueReasons: { type: [String], default: [] },
  ipAddress: { type: String, required: true },
  flaggedAt: { type: Date, default: null },
  flaggedReason: { type: String, default: null, maxlength: 120 },
  approvedAt: { type: Date, default: null },
  settlementError: { type: String, default: null, maxlength: 180 },
}, { timestamps: true });

module.exports = mongoose.model('Transaction', transactionSchema);
