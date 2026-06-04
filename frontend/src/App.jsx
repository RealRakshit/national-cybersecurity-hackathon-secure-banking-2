import { Link, Route, Routes } from 'react-router-dom';
import Home from './components/Home';
import Signup from './components/Signup';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import Transactions from './components/Transactions';
import SecurityCheck from './components/SecurityCheck';

function App() {
  return (
    <div className="app-shell">
      <header className="app-header">
       <h1>
  <span className="shield-logo">🛡️</span>
  Shield Banking
</h1>
        <nav>
          <Link to="/">Home</Link>
          <Link to="/signup">Sign Up</Link>
          <Link to="/login">Login</Link>
          <Link to="/dashboard">Dashboard</Link>
          <Link to="/transactions">Transactions</Link>
          <Link to="/security-check">Security Check</Link>
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
  © {new Date().getFullYear()} Gig-A-Byte. All Rights Reserved.
</footer>

    </div>
  );
}

export default App;
