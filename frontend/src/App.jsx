import { Link, Route, Routes } from 'react-router-dom';
import Home from './components/Home';
import Signup from './components/Signup';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import Transactions from './components/Transactions';
import SecurityCheck from './components/SecurityCheck';
import { useLanguage } from './i18n';

function App() {
  const { isHindi, t, toggleLanguage } = useLanguage();

  return (
    <div className="app-shell" lang={isHindi ? 'hi' : 'en'}>
      <header className="app-header">
        <h1>
          <span className="shield-logo" aria-hidden="true">🛡️</span>
          {t('appName')}
        </h1>

        <nav>
          <Link to="/">{t('home')}</Link>
          <Link to="/signup">{t('signup')}</Link>
          <Link to="/login">{t('login')}</Link>
          <Link to="/dashboard">{t('dashboard')}</Link>
          <Link to="/transactions">{t('transactions')}</Link>
          <Link to="/security-check">{t('securityCheck')}</Link>
          <button
            type="button"
            className="language-toggle"
            onClick={toggleLanguage}
            aria-label={t('languageLabel')}
          >
            {isHindi ? t('switchToEnglish') : t('switchToHindi')}
          </button>
        </nav>
      </header>

      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/login" element={<Login />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/transactions" element={<Transactions />} />
          <Route path="/security-check" element={<SecurityCheck />} />
        </Routes>
      </main>

      <footer className="footer-card">
        (c) {new Date().getFullYear()} Gig-A-Byte. {t('rightsReserved')}
      </footer>
    </div>
  );
}

export default App;
