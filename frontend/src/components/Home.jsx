import { Link } from 'react-router-dom';

const Home = () => (
  <>
    <section className="hero-card">
      <p className="hero-tag">WELCOME TO SHIELD BANKING</p>

      <h1>
        Safe digital banking with face authentication and smart transaction
        protection.
      </h1>

      <p className="hero-text">
        Access your account, send payments, and monitor your session security
        in one clean dashboard.
      </p>

      <div className="hero-actions">
        <Link to="/signup" className="hero-button">
          Create account
        </Link>

        <Link to="/login" className="hero-button secondary">
          Secure login
        </Link>
      </div>
    </section>

    <section className="info-card">
      <h2>How it works</h2>

      <p>
        Enroll your face profile and password, then log in securely to manage
        transfers and balances. Your session is reviewed continuously to detect
        suspicious activity.
      </p>
    </section>
  </>
);

export default Home;