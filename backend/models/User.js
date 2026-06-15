const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true, trim: true },
  email: { type: String, required: true, unique: true, trim: true, lowercase: true },
  password: { type: String, required: true },
  faceDescriptors: {
  type: [[Number]],
  required: true,
  validate: {
    validator: (value) => (
      Array.isArray(value)
      && value.length >= 3
      && value.every(
        (descriptor) => Array.isArray(descriptor)
          && descriptor.length === 128,
      )
    ),
    message: 'At least 3 valid face descriptors are required.',
  },
},
  balanceCents: { type: Number, default: 0, min: 0 },
  loginIps: {
    type: [{
      ipAddress: { type: String, required: true },
      seenAt: { type: Date, default: Date.now },
    }],
    default: [],
  },
  typingProfiles: {
    type: [{
      wpm: { type: Number, required: true },
      keyHoldTimeMs: { type: Number, required: true },
      keyDelayMs: { type: Number, required: true },
      backspaceCount: { type: Number, required: true },
      capturedAt: { type: Date, default: Date.now },
    }],
    default: [],
  },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('User', userSchema);
