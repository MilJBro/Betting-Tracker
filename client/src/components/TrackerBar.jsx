import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useTracker } from '../context/TrackerContext.jsx';
import { useSettings } from '../context/SettingsContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { currencySymbol } from '../format.js';
import Icon from './Icon.jsx';
import Logo from './Logo.jsx';
import SideMenu from './SideMenu.jsx';

export default function TrackerBar() {
  const { trackers, active, activeId, pro, switchTo, create, update, remove } = useTracker();
  const { settings } = useSettings();
  const toast = useToast();
  const navigate = useNavigate();
  const [manage, setManage] = useState(false); // desktop modal
  const [drawer, setDrawer] = useState(false); // mobile drawer
  const [view, setView] = useState('list');    // drawer view: 'list' | 'edit' | 'new'
  const [name, setName] = useState('');
  const [bankroll, setBankroll] = useState('');
  const [newName, setNewName] = useState('');
  const [newBankroll, setNewBankroll] = useState('');
  const [busy, setBusy] = useState(false);
  const [delTarget, setDelTarget] = useState(null); // tracker pending delete confirmation

  const menuBtn = useRef(null);
  const drawerRef = useRef(null);
  const wasOpen = useRef(false);
  const touch = useRef(null);

  // Esc closes the menu; focus moves into it on open and back to the menu
  // button on close, so keyboard and screen-reader users aren't left stranded.
  useEffect(() => {
    if (!drawer) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setDrawer(false); };
    window.addEventListener('keydown', onKey);
    drawerRef.current?.focus({ preventScroll: true }); // into the panel, with no ring on any one button
    return () => window.removeEventListener('keydown', onKey);
  }, [drawer, view]);
  useEffect(() => {
    if (wasOpen.current && !drawer) menuBtn.current?.focus({ preventScroll: true });
    wasOpen.current = drawer;
  }, [drawer]);

  if (!active) return null;
  const sym = currencySymbol(settings?.currency || 'GBP');

  const prepEdit = () => { setName(active.name); setBankroll(String(active.bankroll_start || 0)); };
  const prepNew = () => { setNewName(''); setNewBankroll(''); };

  // Opens the desktop modal (which shows both edit + create).
  function openManage() { prepEdit(); prepNew(); setManage(true); }
  // Close whichever surface is open and return the drawer to its list view.
  function finish() { setManage(false); setView('list'); }

  function openDrawer() { setView('list'); setDrawer(true); }

  async function saveActive() {
    setBusy(true);
    try {
      await update(active.id, { name: name.trim() || active.name, bankroll_start: Number(bankroll) || 0 });
      toast('Tracker updated', 'success');
      finish();
    } catch (e) { toast(e.message, 'error'); } finally { setBusy(false); }
  }

  // Multiple trackers is a Pro feature — send free accounts to Plans instead.
  function goPlansForTracker() {
    finish();
    setDrawer(false);
    toast('Multiple trackers is a Pro feature', 'info');
    navigate('/pricing');
  }

  async function createTracker() {
    if (!pro) { goPlansForTracker(); return; }
    setBusy(true);
    try {
      await create(newName.trim() || 'New tracker', Number(newBankroll) || 0);
      toast('Tracker created', 'success');
      finish();
    } catch (e) {
      if (e.status === 402 || e.data?.upgrade) {
        goPlansForTracker();
      } else { toast(e.message, 'error'); }
    } finally { setBusy(false); }
  }

  // Native confirm() is unreliable in an installed PWA (iOS may suppress it),
  // so we use an in-app confirmation dialog instead. Deletes whichever tracker
  // was tapped (from the list) or the active one (from Manage).
  async function removeTracker() {
    if (!delTarget) return;
    setBusy(true);
    try {
      await remove(delTarget.id);
      toast('Tracker deleted');
      setDelTarget(null);
      finish();
      setDrawer(false);
    } catch (e) { toast(e.message, 'error'); setDelTarget(null); } finally { setBusy(false); }
  }

  // Shared form bodies — used in the mobile drawer views and the desktop modal.
  const editBody = (
    <>
      <div className="field"><label>Name</label><input value={name} onChange={(e) => setName(e.target.value)} /></div>
      <div className="field">
        <label>Starting bankroll</label>
        <div className="input-prefix">
          <span className="input-prefix-sym">{sym}</span>
          <input type="number" min="0" step="0.01" value={bankroll} onChange={(e) => setBankroll(e.target.value)} />
        </div>
      </div>
      <div className="row" style={{ gap: 8, marginTop: 4 }}>
        <button className="btn-primary" onClick={saveActive} disabled={busy}>Save changes</button>
        <button
          className="btn-danger btn-sm"
          onClick={() => setDelTarget(active)}
          disabled={busy || trackers.length <= 1}
          title={trackers.length <= 1 ? 'You need at least one tracker' : ''}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
        >
          <Icon name="trash" size={15} /> Delete
        </button>
      </div>
      {trackers.length <= 1 && (
        <p className="muted" style={{ fontSize: 12, margin: '8px 0 0' }}>
          You always keep at least one tracker — create another before deleting this one.
        </p>
      )}
    </>
  );

  const newBody = (
    <>
      <p className="muted" style={{ marginTop: 0, fontSize: 13 }}>
        Keep separate trackers — one per tipster, say — so their bets never mix.{' '}
        {!pro && <span className="badge" style={{ textTransform: 'none' }}>Pro</span>}
      </p>
      <div className="field">
        <label>Tracker name</label>
        <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. Tipster A" maxLength={60} />
      </div>
      <div className="field">
        <label>Starting bankroll <span className="muted" style={{ fontWeight: 400 }}>(optional)</span></label>
        <div className="input-prefix">
          <span className="input-prefix-sym">{sym}</span>
          <input type="number" min="0" step="0.01" value={newBankroll} placeholder="e.g. 500" onChange={(e) => setNewBankroll(e.target.value)} />
        </div>
      </div>
      <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>Currency, odds format and unit size are shared across all your trackers.</p>
      <div className="row" style={{ marginTop: 10 }}>
        <button className="btn-primary" onClick={createTracker} disabled={busy}>Create tracker</button>
      </div>
    </>
  );

  return (
    <>
      <div className="tracker-bar">
        {/* Mobile: hamburger opens the tracker drawer; the logo is centred. */}
        <button ref={menuBtn} className="tb-menu" onClick={openDrawer} aria-label="Open menu" aria-haspopup="true" aria-expanded={drawer}>
          <span className="tb-menu-lines"><span /><span /><span /></span>
        </button>
        <Logo />
        <span className="tb-spacer" aria-hidden="true" />

        {/* Desktop: the inline tracker switcher + Manage (the sidebar holds the logo). */}
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

      {drawer && (
        <div className="drawer-overlay" onMouseDown={() => setDrawer(false)}>
          <aside
            ref={drawerRef}
            className="drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Menu"
            tabIndex={-1}
            onMouseDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => { const t = e.touches[0]; touch.current = { x: t.clientX, y: t.clientY }; }}
            onTouchEnd={(e) => {
              const t0 = touch.current; touch.current = null;
              if (!t0) return;
              const t = e.changedTouches[0];
              const dx = t.clientX - t0.x, dy = t.clientY - t0.y;
              // A deliberate leftward swipe (mostly horizontal) pushes the menu away.
              if (dx < -70 && Math.abs(dx) > Math.abs(dy) * 2) setDrawer(false);
            }}
          >
            {view === 'list' ? (
              <SideMenu
                onClose={() => setDrawer(false)}
                onNewTracker={() => { if (!pro) { goPlansForTracker(); return; } prepNew(); setView('new'); }}
                onManageTracker={() => { prepEdit(); setView('edit'); }}
              />
            ) : (
              <>
                <div className="drawer-head">
                  <button className="drawer-back" type="button" onClick={() => setView('list')} aria-label="Back to menu">
                    <span className="drawer-back-chev" aria-hidden="true">‹</span> Back
                  </button>
                  <button className="sm-close" type="button" onClick={() => setDrawer(false)} aria-label="Close menu">✕</button>
                </div>
                <h2 className="drawer-title">{view === 'new' ? 'New tracker' : 'Manage tracker'}</h2>
                <div className="drawer-form">{view === 'edit' ? editBody : newBody}</div>
              </>
            )}
          </aside>
        </div>
      )}

      {delTarget && createPortal(
        <div className="modal-overlay" style={{ zIndex: 90, alignItems: 'center' }} onMouseDown={() => !busy && setDelTarget(null)}>
          <div className="modal tracker-confirm" onMouseDown={(e) => e.stopPropagation()}>
            <div className="tc-ic"><Icon name="trash" size={24} /></div>
            <h2 style={{ margin: '0 0 6px', fontSize: 20 }}>Delete “{delTarget.name}”?</h2>
            <p className="muted" style={{ margin: 0, fontSize: 14, lineHeight: 1.5 }}>
              This permanently deletes this tracker and every bet in it. You can’t get it back.
            </p>
            <div className="row" style={{ gap: 10, marginTop: 20 }}>
              <button className="btn-ghost" style={{ flex: 1 }} onClick={() => setDelTarget(null)} disabled={busy}>Cancel</button>
              <button className="btn-danger" style={{ flex: 1 }} onClick={removeTracker} disabled={busy}>
                {busy ? 'Deleting…' : 'Delete tracker'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {manage && (
        <div className="modal-overlay" onMouseDown={() => !busy && setManage(false)}>
          <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="row spread" style={{ marginBottom: 18 }}>
              <h2 style={{ margin: 0, fontSize: 20 }}>Manage trackers</h2>
              <button className="btn-ghost btn-sm" type="button" onClick={() => setManage(false)}>✕</button>
            </div>
            <h3 className="section-title">This tracker</h3>
            {editBody}
            <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
              <h3 className="section-title">New tracker</h3>
              {newBody}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
