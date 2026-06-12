import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  createShapeChallenge,
  getBankingDashboard,
  sendTransaction,
} from '../api/banking';
import useIdleSession from '../auth/useIdleSession';
import { useLanguage } from '../i18n';
import ShapePad from './ShapePad';

const formatMoney = (cents) => new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
}).format((cents || 0) / 100);

const formatDateTime = (date) =>
  new Date(date).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });

const Transactions = () => {
  const { t, td } = useLanguage();
  const navigate = useNavigate();
  const [dashboard, setDashboard] = useState(null);
  const [recipientUsername, setRecipientUsername] = useState('');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [shapeChallenge, setShapeChallenge] = useState(null);
  const [shapeTrace, setShapeTrace] = useState([]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  useIdleSession();

  const loadDashboard = () => getBankingDashboard()
    .then(({ data }) => setDashboard(data))
    .catch(() => navigate('/login', { replace: true }));

  useEffect(() => {
    loadDashboard();
  }, []);

  const requestShape = async () => {
    const { data } = await createShapeChallenge();
    setShapeChallenge(data);
    setShapeTrace([]);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    try {
      const { data } = await sendTransaction({
        recipientUsername,
        recipientEmail,
        amount,
        note,
        shapeChallengeId: shapeChallenge?.challengeId,
        shapeTrace,
      });
      setMessage(data.message);
      setRecipientUsername('');
      setRecipientEmail('');
      setAmount('');
      setNote('');
      setShapeChallenge(null);
      setShapeTrace([]);
      await loadDashboard();
    } catch (error) {
      if (error.response?.status === 428) {
        await requestShape();
      }
      setMessage(error.response?.data?.message || 'Transfer failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="bank-view">
      <div className="toolbar-line">
        <div>
          <p className="eyebrow">{t('transactions')}</p>
          <h2>{formatMoney(dashboard?.user.balanceCents)}</h2>
        </div>
        <Link className="link-button" to="/dashboard">{t('dashboard')}</Link>
      </div>

      <div className="transactions-grid">
        <form className="transfer-panel" onSubmit={handleSubmit}>
          <h3>{t('sendPayment')}</h3>
          <label>
            {t('recipientUsername')}
            <input
              pattern="[A-Za-z0-9_]{3,24}"
              value={recipientUsername}
              onChange={(event) => setRecipientUsername(event.target.value)}
              required
            />
          </label>
          <label>
            {t('recipientEmail')}
            <input
              type="email"
              value={recipientEmail}
              onChange={(event) => setRecipientEmail(event.target.value)}
              required
            />
          </label>
          <label>
            {t('amount')}
            <input
              inputMode="decimal"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              placeholder="0.00"
              required
            />
          </label>
          <label>
            {t('note')}
            <input maxLength="120" value={note} onChange={(event) => setNote(event.target.value)} />
          </label>

          {shapeChallenge ? <ShapePad challenge={shapeChallenge} onTrace={setShapeTrace} /> : null}

          <button type="submit" disabled={loading || (shapeChallenge && !shapeTrace.length)}>
            {loading ? t('processing') : t('sendPayment')}
          </button>
          {message ? <p className="status-copy">{td(message)}</p> : null}
        </form>

        <div className="ledger-panel">
          <h3>{t('paymentHistory')}</h3>
          <p className="muted-copy">
            {t('reviewNotice', { amount: formatMoney(dashboard?.hourlyReviewLimitCents) })}
          </p>
          <div className="transaction-list">
            {dashboard?.transactions?.length ? dashboard.transactions.map((transaction) => (
              <article className="transaction-row" key={transaction.id}>
                <div>
  <strong>{transaction.sender} {t('to')} {transaction.recipient}</strong>

  <small className="transaction-time">
    {formatDateTime(transaction.createdAt)}
  </small>

  <p>{transaction.note || t('transfer')}</p>
</div>
                <div className="amount-cell">
                  <strong>{formatMoney(transaction.amountCents)}</strong>
                  <span className={`status-pill ${transaction.status}`}>{t(transaction.status)}</span>
                </div>
              </article>
            )) : <p className="muted-copy">{t('noTransfers')}</p>}
          </div>
        </div>
      </div>
    </section>
  );
};

export default Transactions;
