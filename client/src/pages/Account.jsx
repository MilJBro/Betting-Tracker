import { useEffect, useState } from 'react';
import { api, setToken, getToken } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { formatDate } from '../format.js';

export default function Account() {
  const { user, logout } = useAuth();
  const [info, setInfo] = useState(null);

  // Change password
  const [pw, setPw] = useState({ current: '', next: '', confirm: '' });
  const [pwMsg, setPwMsg] = useState(null); // {type, text}
  const [pwBusy, setPwBusy] = useState(false);

  // Delete account
  const [confirming, setConfirming] = useState(false);
  const [delPw, setDelPw] = useState('');
  const [delErr, setDelErr] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get('/auth/me').then((d) => setInfo(d.user)).catch(() => {});
  }, []);

  async function changePassword(e) {
    e.preventDefault();
    setPwMsg(null);
    if (pw.next !== pw.confirm) return setPwMsg({ type: 'err', text: 'New passwords do not match' });
    setPwBusy(true);
    try {
      const d = await api.post('/auth/change-password', {
        currentPassword: pw.current,
        newPassword: pw.next,
      });
      setToken(d.token); // adopt the freshly rotated token
      setPw({ current: '', next: '', confirm: '' });
      setPwMsg({ type: 'ok', text: 'Password updated. Other devices have been signed out.' });
    } catch (err) {
      setPwMsg({ type: 'err', text: err.message });
    } finally {
      setPwBusy(false);
    }
  }

  async function logoutEverywhere() {
    if (!confirm('Sign out of every device, including this one?')) return;
    try {
      await api.post('/auth/logout-all');
    } catch {}
    logout();
  }

  async function exportData() {
    const res = await fetch('/api/auth/export', {
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    if (!res.ok) return alert('Export failed. Please try again.');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'betting-tracker-export.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function deleteAccount(e) {
    e.preventDefault();
    setDelErr('');
    setBusy(true);
    try {
      await api.del('/auth/account', { password: delPw });
      logout();
    } catch (err) {
      setDelErr(err.message);
      setBusy(false);
    }
  }

  return (
    <div className="main">
      <div className="page-head">
        <div>
          <h1>Account</h1>
          <p>Manage your login and your data.</p>
        </div>
        <button className="btn-ghost" onClick={logout}>↪ Log out</button>
      </div>

      <div className="card" style={{ marginBottom: 18 }}>
        <h3 className="section-title">Profile</h3>
        <div className="stack" style={{ gap: 8 }}>
          <div className="row spread"><span className="muted">Username</span><strong>{info?.username || user?.username}</strong></div>
          <div className="row spread"><span className="muted">Email</span><strong>{info?.email || user?.email}</strong></div>
          {info?.created_at && (
            <div className="row spread"><span className="muted">Member since</span><strong>{formatDate(info.created_at)}</strong></div>
          )}
        </div>
      </div>

      <div className="card" style={{ marginBottom: 18 }}>
        <h3 className="section-title">Change password</h3>
        {pwMsg && <div className={pwMsg.type === 'ok' ? 'success-banner' : 'error-banner'}>{pwMsg.text}</div>}
        <form onSubmit={changePassword}>
          <div className="field">
            <label>Current password</label>
            <input type="password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} required />
          </div>
          <div className="grid-2">
            <div className="field">
              <label>New password</label>
              <input type="password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} placeholder="At least 8 characters" required />
            </div>
            <div className="field">
              <label>Confirm new password</label>
              <input type="password" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} required />
            </div>
          </div>
          <button type="submit" className="btn-primary" disabled={pwBusy}>{pwBusy ? 'Updating…' : 'Update password'}</button>
        </form>
      </div>

      <div className="card" style={{ marginBottom: 18 }}>
        <h3 className="section-title">Sessions & data</h3>
        <div className="stack">
          <div className="row spread" style={{ flexWrap: 'wrap', gap: 10 }}>
            <div>
              <div style={{ fontWeight: 600 }}>Export my data</div>
              <div className="muted" style={{ fontSize: 13 }}>Download all your bets and settings as JSON.</div>
            </div>
            <button className="btn-ghost" onClick={exportData}>Export</button>
          </div>
          <div className="row spread" style={{ flexWrap: 'wrap', gap: 10, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
            <div>
              <div style={{ fontWeight: 600 }}>Log out everywhere</div>
              <div className="muted" style={{ fontSize: 13 }}>Sign out of all devices, including this one.</div>
            </div>
            <button className="btn-ghost" onClick={logoutEverywhere}>Log out all</button>
          </div>
        </div>
      </div>

      <div className="card" style={{ borderColor: 'var(--loss)' }}>
        <h3 className="section-title" style={{ color: 'var(--loss)' }}>Danger zone</h3>
        {!confirming ? (
          <div className="row spread" style={{ flexWrap: 'wrap', gap: 10 }}>
            <div>
              <div style={{ fontWeight: 600 }}>Delete account</div>
              <div className="muted" style={{ fontSize: 13 }}>Permanently removes your account and all bets. This cannot be undone.</div>
            </div>
            <button className="btn-danger" onClick={() => setConfirming(true)}>Delete account</button>
          </div>
        ) : (
          <form onSubmit={deleteAccount}>
            <p style={{ marginTop: 0 }}>Enter your password to confirm permanent deletion.</p>
            {delErr && <div className="error-banner">{delErr}</div>}
            <div className="field">
              <input type="password" value={delPw} onChange={(e) => setDelPw(e.target.value)} placeholder="Your password" required />
            </div>
            <div className="row">
              <button type="button" className="btn-ghost" onClick={() => { setConfirming(false); setDelPw(''); setDelErr(''); }}>Cancel</button>
              <button type="submit" className="btn-danger" disabled={busy}>{busy ? 'Deleting…' : 'Permanently delete'}</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
