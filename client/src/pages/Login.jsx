import AuthPanel from '../components/AuthPanel.jsx';

// The home page is a login / sign-up gate: visitors must create an account
// (with a password) or log in before they can reach the tracker.
export default function Login() {
  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="brand" style={{ justifyContent: 'center', fontSize: 22, marginBottom: 6 }}>
          <span className="brand-dot">₿</span> Betfolio
        </div>
        <p className="muted" style={{ textAlign: 'center', margin: '0 0 22px' }}>
          Track your bets, your way. Log in or create a free account to get started.
        </p>

        <AuthPanel initialMode="login" />

        <p className="muted" style={{ textAlign: 'center', fontSize: 12, marginTop: 18 }}>
          Free to use · 18+ · Please gamble responsibly ·{' '}
          <a href="https://www.begambleaware.org/" target="_blank" rel="noopener noreferrer" style={{ color: 'inherit' }}>BeGambleAware</a>
        </p>
      </div>
    </div>
  );
}
