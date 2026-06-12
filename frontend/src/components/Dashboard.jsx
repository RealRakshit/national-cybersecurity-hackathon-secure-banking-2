import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { logout } from '../api/auth';
import { getBankingDashboard } from '../api/banking';
import useIdleSession from '../auth/useIdleSession';
import { useLanguage } from '../i18n';

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

const Dashboard = () => {
  const { t, td } = useLanguage();
  const navigate = useNavigate();
  const [dashboard, setDashboard] = useState(null);
  const [message, setMessage] = useState('Loading account...');
  useIdleSession();

  useEffect(() => {
  const loadDashboard = async () => {
    try {
      const { data } = await getBankingDashboard();
      setDashboard(data);
      setMessage('');
    } catch {
      navigate('/login', { replace: true });
    }
  };

  loadDashboard();

  const interval = setInterval(loadDashboard, 2000);

  return () => clearInterval(interval);
}, [navigate]);

  const handleLogout = async () => {
    try {
      await logout();
    } finally {
      navigate('/login', { replace: true });
    }
  };

  return (
    <section className="bank-view">
      <div className="balance-panel">
        <div>
          <p className="eyebrow">{t('availableBalance')}</p>
          <h2>{formatMoney(dashboard?.user.balanceCents)}</h2>
          <p>{dashboard ? `${t('accountHolder')}: ${dashboard.user.username}` : td(message)}</p>
        </div>
        <div className="button-row dashboard-actions">
          <Link className="link-button" to="/transactions">{t('transactions')}</Link>
          <button type="button" className="quiet-button" onClick={handleLogout}>{t('logout')}</button>
        </div>
      </div>

      <div className="ledger-panel">
        <h3>{t('latestActivity')}</h3>
        <div className="transaction-list">
          {dashboard?.transactions?.length ? dashboard.transactions.slice(0, 5).map((transaction) => (
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
          )) : <p className="muted-copy">{t('noTransactions')}</p>}
        </div>
      </div>
    </section>
  );
};

export default Dashboard;
