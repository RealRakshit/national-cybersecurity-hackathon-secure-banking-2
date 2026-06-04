const mongoose = require('mongoose');

const challengeSchema = new mongoose.Schema({
  type: { type: String, enum: ['captcha', 'shape'], required: true, index: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  prompt: { type: String, required: true },
  answerHash: { type: String, default: null },
  answerSalt: { type: String, default: null },
  shape: { type: String, enum: ['circle', 'zigzag', null], default: null },
  usedAt: { type: Date, default: null },
  expiresAt: { type: Date, required: true, index: { expires: 0 } },
}, { timestamps: true });

module.exports = mongoose.model('Challenge', challengeSchema);
