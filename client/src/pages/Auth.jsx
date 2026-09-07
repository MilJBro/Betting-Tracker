import { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';

export default function Auth() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ email: '', username: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  async function submit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      if (mode === 'login') await login(form.email, form.password);
      else await register(form.email, form.username, form.password);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="brand" style={{ justifyContent: 'center', fontSize: 22, marginBottom: 6 }}>
          <span className="brand-dot">₿</span> Betting Tracker
        </div>
        <p className="muted" style={{ textAlign: 'center', margin: '0 0 22px' }}>
          Track your bets, your way.
        </p>

        <div className="card">
          <div className="tabs">
            <div className={`tab ${mode === 'login' ? 'active' : ''}`} onClick={() => { setMode('login'); setError(''); }}>Log in</div>
            <div className={`tab ${mode === 'register' ? 'active' : ''}`} onClick={() => { setMode('register'); setError(''); }}>Sign up</div>
          </div>

          {error && <div className="error-banner">{error}</div>}

          <form onSubmit={submit}>
            <div className="field">
              <label>Email</label>
              <input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} placeholder="you@example.com" required />
            </div>
            {mode === 'register' && (
              <div className="field">
                <label>Username</label>
                <input value={form.username} onChange={(e) => set('username', e.target.value)} placeholder="How your profile appears" required />
              </div>
            )}
            <div className="field">
              <label>Password</label>
              <input type="password" value={form.password} onChange={(e) => set('password', e.target.value)} placeholder={mode === 'register' ? 'At least 6 characters' : '••••••••'} required />
            </div>
            <button type="submit" className="btn-primary" style={{ width: '100%', marginTop: 6 }} disabled={busy}>
              {busy ? 'Please wait…' : mode === 'login' ? 'Log in' : 'Create account'}
            </button>
          </form>
        </div>
        <p className="muted" style={{ textAlign: 'center', fontSize: 12, marginTop: 18 }}>
          Your bets are private until you choose to share them.
        </p>
      </div>
    </div>
  );
}
