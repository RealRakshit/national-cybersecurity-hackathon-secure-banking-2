const mongoose = require('mongoose');
const Transaction = require('./models/Transaction');
const User = require('./models/User');

const SETTLEMENT_INTERVAL_MS = Number(process.env.SETTLEMENT_INTERVAL_MS || 5000);
let settlementTimer;
let settlementRunning = false;

const validAmountCents = (amountCents) => Number.isSafeInteger(amountCents) && amountCents > 0;

const settleApprovedTransaction = async (transactionId) => {
  const mongoSession = await mongoose.startSession();
  try {
    let postedTransaction;
    await mongoSession.withTransaction(async () => {
      const transaction = await Transaction.findOne(
        { _id: transactionId, status: 'approved' },
        null,
        { session: mongoSession },
      ).select('sender recipient amountCents approvedAt');
      if (!transaction) return;
      if (!validAmountCents(transaction.amountCents)) throw new Error('INVALID_AMOUNT_CENTS');

      const claimed = await Transaction.updateOne(
        { _id: transaction._id, status: 'approved' },
        {
          $set: {
            status: 'posting',
            settlementError: null,
          },
        },
        { session: mongoSession },
      );
      if (!claimed.modifiedCount) return;

      const debit = await User.findOneAndUpdate(
        { _id: transaction.sender, balanceCents: { $gte: transaction.amountCents } },
        { $inc: { balanceCents: -transaction.amountCents } },
        { new: true, session: mongoSession },
      );
      if (!debit) throw new Error('INSUFFICIENT_FUNDS');

      const credit = await User.updateOne(
        { _id: transaction.recipient },
        { $inc: { balanceCents: transaction.amountCents } },
        { session: mongoSession },
      );
      if (!credit.matchedCount) throw new Error('RECIPIENT_NOT_FOUND');

      postedTransaction = await Transaction.findOneAndUpdate(
        { _id: transaction._id, status: 'posting' },
        {
          $set: {
            status: 'posted',
            approvedAt: transaction.approvedAt || new Date(),
          },
        },
        { new: true, session: mongoSession },
      );
    });
    return postedTransaction;
  } finally {
    await mongoSession.endSession();
  }
};

const recordSettlementError = async (transactionId, error) => {
  let errorCode = 'Approval settlement failed. Check backend logs.';
  if (error.message === 'INSUFFICIENT_FUNDS') {
    errorCode = 'Approval waiting: sender has insufficient funds.';
  }
  if (error.message === 'INVALID_AMOUNT_CENTS') {
    errorCode = 'Approval waiting: amountCents must be a positive integer.';
  }
  await Transaction.updateOne(
    { _id: transactionId, status: 'approved' },
    { $set: { settlementError: errorCode } },
  );
};

const settleApprovedTransactions = async () => {
  if (settlementRunning || mongoose.connection.readyState !== 1) return;
  settlementRunning = true;
  try {
    const approved = await Transaction.find({
      status: 'approved',
      settlementError: null,
      sender: { $exists: true },
      recipient: { $exists: true },
      amountCents: { $exists: true },
    })
      .sort({ updatedAt: 1 })
      .limit(25)
      .select('_id');

    for (const transaction of approved) {
      try {
        await settleApprovedTransaction(transaction._id);
      } catch (error) {
        console.error('Approved payment settlement error:', transaction._id, error);
        await recordSettlementError(transaction._id, error);
      }
    }
  } finally {
    settlementRunning = false;
  }
};

const startSettlementWorker = () => {
  if (settlementTimer) return settlementTimer;
  settlementTimer = setInterval(settleApprovedTransactions, SETTLEMENT_INTERVAL_MS);
  settlementTimer.unref();
  settleApprovedTransactions();
  return settlementTimer;
};

module.exports = {
  settleApprovedTransaction,
  settleApprovedTransactions,
  startSettlementWorker,
};
