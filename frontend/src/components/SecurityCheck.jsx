import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { flagSecuritySession, getSecurityCheck } from '../api/banking';
import useIdleSession from '../auth/useIdleSession';
import { useLanguage } from '../i18n';

const SecurityCheck = () => {
  const { t, td } = useLanguage();
  const navigate = useNavigate();
  const [check, setCheck] = useState(null);
  const [message, setMessage] = useState('Running session checks...');
  const [loading, setLoading] = useState(false);
  useIdleSession();

  const loadCheck = () => getSecurityCheck()
    .then(({ data }) => {
      setCheck(data.session);
      setMessage(data.session.securityHold
        ? 'This session is on security hold.'
        : 'Session binding checks passed.');
    })
    .catch(() => navigate('/login', { replace: true }));

  useEffect(() => {
    loadCheck();
  }, []);

  const flagSession = async () => {
    setLoading(true);
    try {
      const { data } = await flagSecuritySession();
      setCheck(data.session);
      setMessage(data.message);
    } catch (error) {
      setMessage(error.response?.data?.message || 'Security hold could not be enabled.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="bank-view">
      <div className="toolbar-line">
        <div>
          <p className="eyebrow">{t('securityCheck')}</p>
          <h2>{check?.securityHold ? t('holdActive') : t('sessionVerified')}</h2>
        </div>
        <Link className="link-button" to="/transactions">{t('transactions')}</Link>
      </div>

      <div className="security-grid">
        <div className="ledger-panel">
          <h3>{t('currentSession')}</h3>
          <div className="check-list">
            <div className="check-row">
              <span>{t('ipBinding')}</span>
              <strong>{check?.ipBound ? t('verified') : t('checking')}</strong>
            </div>
            <div className="check-row">
              <span>{t('browserBinding')}</span>
              <strong>{check?.userAgentBound ? t('verified') : t('checking')}</strong>
            </div>
            <div className="check-row">
              <span>{t('paymentMode')}</span>
              <strong>{check?.securityHold ? t('flaggedOnly') : t('normal')}</strong>
            </div>
          </div>
          <p className="status-copy">{td(message)}</p>
        </div>

        <div className="transfer-panel">
          <h3>{t('remoteRisk')}</h3>
          <p className="muted-copy">
            {t('remoteRiskText')}
          </p>
          <button type="button" onClick={flagSession} disabled={loading || check?.securityHold}>
            {loading ? t('enablingHold') : t('flagSession')}
          </button>
        </div>
      </div>
    </section>
  );
};

export default SecurityCheck;
