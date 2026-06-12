import { Link } from 'react-router-dom';
import { useLanguage } from '../i18n';

const Home = () => {
  const { t } = useLanguage();

  return (
    <>
      <section className="hero-card">
        <p className="hero-tag">{t('heroTag')}</p>

        <h1>{t('heroTitle')}</h1>

        <p className="hero-text">{t('heroText')}</p>

        <div className="hero-actions">
          <Link to="/signup" className="hero-button">
            {t('createAccount')}
          </Link>

          <Link to="/login" className="hero-button secondary">
            {t('secureLogin')}
          </Link>
        </div>
      </section>

      <section className="info-card">
        <h2>{t('howItWorks')}</h2>

        <p>{t('howItWorksText')}</p>
      </section>
    </>
  );
};

export default Home;
