const express = require('express');
const mongoose = require('mongoose');
const Transaction = require('../models/Transaction');
const User = require('../models/User');
const {
  createShapeChallenge,
  getRequestIp,
  requireSession,
  verifyShapeChallenge,
} = require('../security');

const router = express.Router();
const USERNAME_PATTERN = /^[A-Za-z0-9_]{3,24}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const REVIEW_LIMIT_CENTS = 10000 * 100;
const MAX_TRANSFER_CENTS = 100000 * 100;

router.use(requireSession);

const parseAmountCents = (amount) => {
  const raw = String(amount ?? '').trim();
  if (!/^[0-9]{1,6}(\.[0-9]{1,2})?$/.test(raw)) return null;
  const [whole, decimals = ''] = raw.split('.');
  const cents = (Number(whole) * 100) + Number(decimals.padEnd(2, '0'));
  return Number.isSafeInteger(cents) && cents > 0 && cents <= MAX_TRANSFER_CENTS ? cents : null;
};

const cleanEmail = (email) => String(email || '').trim().toLowerCase();
const cleanNote = (note) => String(note || '').trim().replace(/\s+/g, ' ').slice(0, 120);
const recentHourlyFlow = async (senderId) => {
  const [summary] = await Transaction.aggregate([
    {
      $match: {
        sender: senderId,
        status: { $in: ['posted', 'queued', 'approved', 'posting'] },
        createdAt: { $gte: new Date(Date.now() - (60 * 60 * 1000)) },
      },
    },
    { $group: { _id: null, total: { $sum: '$amountCents' } } },
  ]);
  return summary?.total || 0;
};

const getHistory = async (userId) => Transaction.find({
  $or: [{ sender: userId }, { recipient: userId }],
})
  .sort({ createdAt: -1 })
  .limit(20)
  .populate('sender', 'username')
  .populate('recipient', 'username');

const toTransactionPayload = (transaction) => ({
  id: transaction._id,
  amountCents: transaction.amountCents,
  status: transaction.status,
  queueReasons: transaction.queueReasons,
  note: transaction.note,
  sender: transaction.sender.username,
  recipient: transaction.recipient.username,
  createdAt: transaction.createdAt,
  approvedAt: transaction.approvedAt,
  flaggedAt: transaction.flaggedAt,
  flaggedReason: transaction.flaggedReason,
});

const postTransfer = async ({
  amountCents,
  ipAddress,
  note,
  recipientId,
  senderId,
}) => {
  const mongoSession = await mongoose.startSession();
  try {
    let transaction;
    await mongoSession.withTransaction(async () => {
      const debit = await User.findOneAndUpdate(
        { _id: senderId, balanceCents: { $gte: amountCents } },
        { $inc: { balanceCents: -amountCents } },
        { new: true, session: mongoSession },
      );
      if (!debit) throw new Error('INSUFFICIENT_FUNDS');

      const credit = await User.updateOne(
        { _id: recipientId },
        { $inc: { balanceCents: amountCents } },
        { session: mongoSession },
      );
      if (!credit.matchedCount) throw new Error('RECIPIENT_NOT_FOUND');

      [transaction] = await Transaction.create([{
        sender: senderId,
        recipient: recipientId,
        amountCents,
        note,
        status: 'posted',
        ipAddress,
      }], { session: mongoSession });
    });
    return transaction;
  } finally {
    await mongoSession.endSession();
  }
};

router.get('/dashboard', async (req, res) => {
  try {
    const freshUser = await User.findById(req.user._id)
      .select('username balanceCents');

    if (!freshUser) {
      return res.status(404).json({
        message: 'User not found.',
      });
    }

    const history = await getHistory(req.user._id);

    return res.json({
      user: {
        username: freshUser.username,
        balanceCents: freshUser.balanceCents,
      },
      hourlyReviewLimitCents: REVIEW_LIMIT_CENTS,
      transactions: history.map(toTransactionPayload),
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    return res.status(500).json({
      message: 'Unable to load dashboard.',
    });
  }
});

router.get('/security-check', (req, res) => res.json({
  session: {
    securityHold: Boolean(req.sessionRecord.securityFlaggedAt),
    securityFlaggedAt: req.sessionRecord.securityFlaggedAt,
    securityFlagReason: req.sessionRecord.securityFlagReason,
    ipBound: true,
    userAgentBound: true,
  },
}));

router.post('/security-check/flag-session', async (req, res) => {
  req.sessionRecord.securityFlaggedAt = req.sessionRecord.securityFlaggedAt || new Date();
  req.sessionRecord.securityFlagReason = 'remote_access_suspected';
  await req.sessionRecord.save();
  return res.json({
    message: 'Security hold enabled for this session.',
    session: {
      securityHold: true,
      securityFlaggedAt: req.sessionRecord.securityFlaggedAt,
      securityFlagReason: req.sessionRecord.securityFlagReason,
    },
  });
});

router.post('/shape-challenge', async (req, res) => {
  try {
    return res.json(await createShapeChallenge(req.user));
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Unable to create transfer challenge.' });
  }
});

router.post('/transactions', async (req, res) => {
  const recipientUsername = String(req.body.recipientUsername || '').trim();
  const recipientEmail = cleanEmail(req.body.recipientEmail);
  const amountCents = parseAmountCents(req.body.amount);
  if (!USERNAME_PATTERN.test(recipientUsername)) {
    return res.status(400).json({ message: 'Enter a valid recipient username.' });
  }
  if (!EMAIL_PATTERN.test(recipientEmail)) {
    return res.status(400).json({ message: 'Enter a valid recipient email address.' });
  }
  if (!amountCents) {
    return res.status(400).json({ message: 'Transfer amount must be between 0.01 and 100000.00.' });
  }
  if (recipientUsername === req.user.username) {
    return res.status(400).json({ message: 'You cannot transfer money to yourself.' });
  }

  const recipient = await User.findOne({ username: recipientUsername, email: recipientEmail }).select('_id username');
  if (!recipient) return res.status(404).json({ message: 'Recipient not found.' });

  const note = cleanNote(req.body.note);
  if (req.sessionRecord.securityFlaggedAt) {
    const transaction = await Transaction.create({
      sender: req.user._id,
      recipient: recipient._id,
      amountCents,
      note,
      status: 'flagged',
      ipAddress: getRequestIp(req),
      flaggedAt: new Date(),
      flaggedReason: req.sessionRecord.securityFlagReason || 'session_security_hold',
    });
    return res.status(202).json({
      message: 'Payment flagged by the session security hold. Balances were not changed.',
      transactionId: transaction._id,
      status: transaction.status,
    });
  }

  const previousHourCents = await recentHourlyFlow(req.user._id);
  const projectedHourCents = previousHourCents + amountCents;
  const needsReview = amountCents > REVIEW_LIMIT_CENTS || projectedHourCents > REVIEW_LIMIT_CENTS;
  if (needsReview && !await verifyShapeChallenge(req.user, req.body.shapeChallengeId, req.body.shapeTrace)) {
    return res.status(428).json({
      code: 'SHAPE_CHALLENGE_REQUIRED',
      message: 'Draw the transfer challenge before a high-value or high-flow payment.',
    });
  }

  const queueReasons = [];
  if (amountCents > REVIEW_LIMIT_CENTS) queueReasons.push('single_transfer_over_10000');
  if (projectedHourCents > REVIEW_LIMIT_CENTS) queueReasons.push('hourly_outflow_over_10000');
  if (queueReasons.length) {
    const transaction = await Transaction.create({
      sender: req.user._id,
      recipient: recipient._id,
      amountCents,
      note,
      status: 'queued',
      queueReasons,
      ipAddress: getRequestIp(req),
    });
    return res.status(202).json({
      message: 'Payment entered the review queue and did not change balances yet.',
      transactionId: transaction._id,
      status: transaction.status,
      queueReasons,
    });
  }

  try {
    const transaction = await postTransfer({
      amountCents,
      ipAddress: getRequestIp(req),
      note,
      recipientId: recipient._id,
      senderId: req.user._id,
    });
    return res.status(201).json({
      message: 'Transfer posted.',
      transactionId: transaction._id,
      status: transaction.status,
    });
  } catch (error) {
    if (error.message === 'INSUFFICIENT_FUNDS') {
      return res.status(409).json({ message: 'Insufficient funds.' });
    }
    console.error(error);
    return res.status(500).json({ message: 'Transfer could not be completed.' });
  }
});

module.exports = router;
