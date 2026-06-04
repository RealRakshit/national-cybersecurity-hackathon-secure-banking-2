import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { flagSecuritySession, getSecurityCheck } from '../api/banking';
import useIdleSession from '../auth/useIdleSession';

const SecurityCheck = () => {
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
          <p className="eyebrow">Security Check</p>
          <h2>{check?.securityHold ? 'Hold active' : 'Session verified'}</h2>
        </div>
        <Link className="link-button" to="/transactions">Transactions</Link>
      </div>

      <div className="security-grid">
        <div className="ledger-panel">
          <h3>Current session</h3>
          <div className="check-list">
            <div className="check-row">
              <span>IP binding</span>
              <strong>{check?.ipBound ? 'Verified' : 'Checking'}</strong>
            </div>
            <div className="check-row">
              <span>Browser binding</span>
              <strong>{check?.userAgentBound ? 'Verified' : 'Checking'}</strong>
            </div>
            <div className="check-row">
              <span>Payment mode</span>
              <strong>{check?.securityHold ? 'Flagged only' : 'Normal'}</strong>
            </div>
          </div>
          <p className="status-copy">{message}</p>
        </div>

        <div className="transfer-panel">
          <h3>Remote access risk</h3>
          <p className="muted-copy">
            Browser checks cannot inspect desktop tools such as AnyDesk or UltraViewer.
          </p>
          <button type="button" onClick={flagSession} disabled={loading || check?.securityHold}>
            {loading ? 'Enabling hold...' : 'Flag this session'}
          </button>
        </div>
      </div>
    </section>
  );
};

export default SecurityCheck;
