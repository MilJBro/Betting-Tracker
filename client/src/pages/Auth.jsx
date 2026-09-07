import { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../api.js';

export default function Auth() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState('login'); // login | register | forgot
  const [form, setForm] = useState({ email: '', username: '', password: '' });
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [devLink, setDevLink] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  function switchMode(m) {
    setMode(m);
    setError('');
    setNotice('');
    setDevLink('');
  }

  async function submit(e) {
    e.preventDefault();
    setError('');
    setNotice('');
    setDevLink('');
    setBusy(true);
    try {
      if (mode === 'login') await login(form.email, form.password);
      else if (mode === 'register') await register(form.email, form.username, form.password);
      else {
        const d = await api.post('/auth/forgot-password', { email: form.email });
        setNotice(d.message || 'If that email is registered, a reset link is on its way.');
        if (d.devResetUrl) setDevLink(d.devResetUrl);
      }
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
          {mode !== 'forgot' && (
            <div className="tabs">
              <div className={`tab ${mode === 'login' ? 'active' : ''}`} onClick={() => switchMode('login')}>Log in</div>
              <div className={`tab ${mode === 'register' ? 'active' : ''}`} onClick={() => switchMode('register')}>Sign up</div>
            </div>
          )}

          {mode === 'forgot' && <h2 style={{ margin: '0 0 14px', fontSize: 19 }}>Reset your password</h2>}

          {error && <div className="error-banner">{error}</div>}
          {notice && <div className="success-banner">{notice}</div>}
          {devLink && (
            <div className="success-banner" style={{ wordBreak: 'break-all' }}>
              Dev mode (no email configured): <a href={devLink}>open your reset link</a>
            </div>
          )}

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
            {mode !== 'forgot' && (
              <div className="field">
                <label>Password</label>
                <input type="password" value={form.password} onChange={(e) => set('password', e.target.value)} placeholder={mode === 'register' ? 'At least 8 characters' : '••••••••'} required />
              </div>
            )}
            <button type="submit" className="btn-primary" style={{ width: '100%', marginTop: 6 }} disabled={busy}>
              {busy ? 'Please wait…' : mode === 'login' ? 'Log in' : mode === 'register' ? 'Create account' : 'Send reset link'}
            </button>
          </form>

          {mode === 'login' && (
            <p style={{ textAlign: 'center', margin: '14px 0 0', fontSize: 13 }}>
              <a onClick={() => switchMode('forgot')} style={{ cursor: 'pointer' }}>Forgot your password?</a>
            </p>
          )}
          {mode === 'forgot' && (
            <p style={{ textAlign: 'center', margin: '14px 0 0', fontSize: 13 }}>
              <a onClick={() => switchMode('login')} style={{ cursor: 'pointer' }}>← Back to log in</a>
            </p>
          )}
        </div>
        <p className="muted" style={{ textAlign: 'center', fontSize: 12, marginTop: 18 }}>
          Your bets are private until you choose to share them.
        </p>
      </div>
    </div>
  );
}
