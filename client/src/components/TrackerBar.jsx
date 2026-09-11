import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTracker } from '../context/TrackerContext.jsx';
import { useSettings } from '../context/SettingsContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { currencySymbol } from '../format.js';
import Icon from './Icon.jsx';

export default function TrackerBar() {
  const { trackers, active, activeId, pro, switchTo, create, update, remove } = useTracker();
  const { settings } = useSettings();
  const toast = useToast();
  const navigate = useNavigate();
  const [manage, setManage] = useState(false);
  const [name, setName] = useState('');
  const [bankroll, setBankroll] = useState('');
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState(false);

  if (!active) return null;
  const sym = currencySymbol(settings?.currency || 'GBP');

  function openManage() {
    setName(active.name);
    setBankroll(String(active.bankroll_start || 0));
    setNewName('');
    setManage(true);
  }

  async function saveActive() {
    setBusy(true);
    try {
      await update(active.id, { name: name.trim() || active.name, bankroll_start: Number(bankroll) || 0 });
      toast('Tracker updated', 'success');
      setManage(false);
    } catch (e) { toast(e.message, 'error'); } finally { setBusy(false); }
  }

  async function createTracker() {
    setBusy(true);
    try {
      await create(newName.trim() || 'New tracker');
      toast('Tracker created', 'success');
      setManage(false);
    } catch (e) {
      if (e.status === 402 || e.data?.upgrade) {
        setManage(false);
        toast('Multiple trackers is a Pro feature', 'info');
        navigate('/account');
      } else { toast(e.message, 'error'); }
    } finally { setBusy(false); }
  }

  async function removeActive() {
    if (!confirm(`Delete "${active.name}" and all its bets? This cannot be undone.`)) return;
    setBusy(true);
    try {
      await remove(active.id);
      toast('Tracker deleted');
      setManage(false);
    } catch (e) { toast(e.message, 'error'); } finally { setBusy(false); }
  }

  return (
    <>
      <div className="tracker-bar">
        <div className="tracker-switch">
          <span className="tsw-ic"><Icon name="layers" size={18} /></span>
          <div className="tsw-body">
            <span className="tsw-label">Tracker{trackers.length > 1 ? ` · ${trackers.length}` : ''}</span>
            <span className="tsw-name">{active.name}</span>
          </div>
          <span className="tsw-chev"><Icon name="chevron" size={18} /></span>
          <select value={activeId} onChange={(e) => switchTo(e.target.value)} className="tsw-native" aria-label="Switch tracker">
            {trackers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
        <button className="btn-ghost btn-sm tsw-manage" onClick={openManage}>Manage</button>
      </div>

      {manage && (
        <div className="modal-overlay" onMouseDown={() => !busy && setManage(false)}>
          <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="row spread" style={{ marginBottom: 18 }}>
              <h2 style={{ margin: 0, fontSize: 20 }}>Manage trackers</h2>
              <button className="btn-ghost btn-sm" type="button" onClick={() => setManage(false)}>✕</button>
            </div>

            <h3 className="section-title">This tracker</h3>
            <div className="field"><label>Name</label><input value={name} onChange={(e) => setName(e.target.value)} /></div>
            <div className="field">
              <label>Starting bankroll</label>
              <div className="row" style={{ gap: 8 }}>
                <span className="muted" style={{ fontWeight: 700 }}>{sym}</span>
                <input type="number" min="0" step="0.01" value={bankroll} onChange={(e) => setBankroll(e.target.value)} />
              </div>
            </div>
            <div className="row" style={{ gap: 8 }}>
              <button className="btn-primary" onClick={saveActive} disabled={busy}>Save</button>
              <button className="btn-danger btn-sm" onClick={removeActive} disabled={busy || trackers.length <= 1} title={trackers.length <= 1 ? 'You need at least one tracker' : ''}>Delete</button>
            </div>

            <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
              <h3 className="section-title">New tracker {!pro && <span className="badge" style={{ textTransform: 'none' }}>Pro</span>}</h3>
              <p className="muted" style={{ marginTop: 0, fontSize: 13 }}>Keep separate trackers — one per tipster, say — so their bets never mix.</p>
              <div className="row" style={{ gap: 8 }}>
                <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. Tipster A" style={{ flex: 1 }} />
                <button className="btn-ghost" onClick={createTracker} disabled={busy}>+ Create</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
