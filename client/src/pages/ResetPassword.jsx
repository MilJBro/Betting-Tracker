import { useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../api.js';
import BrandMark from '../components/BrandMark.jsx';

export default function ResetPassword() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get('token') || '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError('');
    if (password !== confirm) return setError('Passwords do not match');
    setBusy(true);
    try {
      await api.post('/auth/reset-password', { token, newPassword: password });
      setDone(true);
      setTimeout(() => navigate('/'), 1800);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="brand" style={{ justifyContent: 'center', fontSize: 22, marginBottom: 18 }}>
          <BrandMark /> Betbooks
        </div>
        <div className="card">
          <h2 style={{ margin: '0 0 14px', fontSize: 19 }}>Choose a new password</h2>
          {!token && <div className="error-banner">This reset link is missing its token. Request a new one from the login screen.</div>}
          {done ? (
            <div className="success-banner">Password updated — taking you to log in…</div>
          ) : (
            <>
              {error && <div className="error-banner">{error}</div>}
              <form onSubmit={submit}>
                <div className="field">
                  <label>New password</label>
                  <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" required />
                </div>
                <div className="field">
                  <label>Confirm password</label>
                  <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Re-enter it" required />
                </div>
                <button type="submit" className="btn-primary" style={{ width: '100%' }} disabled={busy || !token}>
                  {busy ? 'Updating…' : 'Update password'}
                </button>
              </form>
            </>
          )}
          <p style={{ textAlign: 'center', margin: '14px 0 0', fontSize: 13 }}>
            <Link to="/">← Back to log in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
