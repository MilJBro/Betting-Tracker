import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import { api } from '../api.js';
import { usePlan } from '../usePlan.js';
import { useTracker } from '../context/TrackerContext.jsx';
import { useSettings } from '../context/SettingsContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import BetForm from '../components/BetForm.jsx';
import SettleControls from '../components/SettleControls.jsx';
import { settlePayout } from '../settle.js';
import Spinner from '../components/Spinner.jsx';
import Icon from '../components/Icon.jsx';
import { formatStake, formatOdds, formatDate } from '../format.js';
import { betsToCsv, csvToBets, downloadCsv } from '../csv.js';

// Common betting sports offered in the Add-bet form's sport field so there's
// always a useful starter list. Kept in sync with the onboarding sport picks.
const COMMON_SPORTS = [
  'Football', 'Horse Racing', 'Greyhounds', 'Tennis', 'Basketball', 'Cricket',
  'Golf', 'Boxing', 'MMA / UFC', 'Rugby', 'Darts', 'Snooker',
  'American Football', 'Baseball', 'Ice Hockey', 'Motorsport', 'Esports',
];

function profitOf(b) {
  if (b.status === 'won') return (b.payout ?? b.stake * b.odds) - b.stake;
  if (b.status === 'lost') return -b.stake;
  if (b.status === 'placed') return (b.payout ?? 0) - b.stake; // each-way place part
  if (b.status === 'void' || b.status === 'cashout') return (b.payout ?? b.stake) - b.stake;
  return null;
}

const SETTLED = ['won', 'lost', 'void', 'cashout', 'placed'];
const SORTS = [
  { key: 'date', label: 'Date' },
  { key: 'stake', label: 'Stake' },
  { key: 'odds', label: 'Odds' },
  { key: 'profit', label: 'Profit' },
];

export default function Bets() {
  const { settings, update: updateSettings } = useSettings();
  const { activeId, active } = useTracker();
  const { ent } = usePlan();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  // Where to return when the Add-bet form is closed (set when opened from
  // another tab's "+"), so closing takes you back where you were.
  const returnToRef = useRef(null);
  const [bets, setBets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(null);
  const [prefill, setPrefill] = useState(null);
  const [template, setTemplate] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [importing, setImporting] = useState(false);
  const [dataMenu, setDataMenu] = useState(false);
  const [lastDate, setLastDate] = useState(''); // reuse the previous bet's date when adding several
  const csvRef = useRef(null);

  // Filtering / search / sort state
  const [status, setStatus] = useState('all');
  const [search, setSearch] = useState('');
  const [sport, setSport] = useState('');
  const [bookie, setBookie] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [sortBy, setSortBy] = useState('date');
  const [sortDir, setSortDir] = useState('desc');
  const [showFilters, setShowFilters] = useState(false);

  const load = () =>
    api
      .get('/bets' + (activeId ? `?tracker=${activeId}` : ''))
      .then((d) => { setBets(d.bets); setError(''); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  useEffect(() => { if (activeId) load(); }, [activeId]);

  // The mobile "+" button links here with ?new=1 to open the form directly.
  useEffect(() => {
    if (params.get('new')) {
      setEditing(null);
      setShowForm(true);
      returnToRef.current = location.state?.returnTo || null;
      params.delete('new');
      setParams(params, { replace: true });
    }
  }, [params, setParams]);

  const fields = settings?.fields || {};
  const oddsFormat = settings?.oddsFormat || 'decimal';
  const currency = settings?.currency || 'GBP';
  const staking = settings?.staking;
  const col = (k) => fields[k] !== false;

  // Distinct sport / bookmaker options for the dropdowns.
  const sportOptions = useMemo(
    () => [...new Set(bets.map((b) => b.sport).filter(Boolean))].sort(),
    [bets]
  );
  const bookieOptions = useMemo(
    () => [...new Set(bets.map((b) => b.bookmaker).filter(Boolean))].sort(),
    [bets]
  );
  // Sport suggestions for the Add-bet form: sports you've actually used,
  // seeded with your onboarding picks, de-duped (case-insensitive) and
  // sorted — so you only see sports you bet on.
  const sportSuggestions = useMemo(() => {
    const picked = Array.isArray(settings?.profile?.sports) ? settings.profile.sports : [];
    // A starter list so common sports (incl. horse racing) are always offered,
    // even on a fresh account. Your own additions get merged in and persist.
    const seed = [...COMMON_SPORTS, ...picked];
    const seen = new Set();
    const out = [];
    [...seed, ...bets.map((b) => b.sport)].forEach((s) => {
      const v = (s || '').trim();
      if (!v) return;
      const k = v.toLowerCase();
      if (seen.has(k)) return;
      seen.add(k);
      out.push(v);
    });
    return out.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
  }, [bets, settings]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = bets.filter((b) => {
      if (status !== 'all' && b.status !== status) return false;
      if (sport && b.sport !== sport) return false;
      if (bookie && b.bookmaker !== bookie) return false;
      if (from && b.placed_at < from) return false;
      if (to && b.placed_at > to) return false;
      if (q) {
        const hay = [b.selection, b.event, b.sport, b.bookmaker, b.tipster, b.bet_type,
          b.notes, ...(b.tags || [])].join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    const dir = sortDir === 'asc' ? 1 : -1;
    const val = (b) => {
      if (sortBy === 'stake') return b.stake;
      if (sortBy === 'odds') return b.odds;
      if (sortBy === 'profit') { const p = profitOf(b); return p == null ? -Infinity : p; }
      return b.placed_at; // date
    };
    return [...list].sort((a, a2) => {
      const va = val(a), vb = val(a2);
      if (va < vb) return -1 * dir;
      if (va > vb) return 1 * dir;
      return 0;
    });
  }, [bets, status, search, sport, bookie, from, to, sortBy, sortDir]);

  // Live totals for whatever is currently filtered.
  const summary = useMemo(() => {
    const settled = filtered.filter((b) => SETTLED.includes(b.status));
    const staked = filtered.reduce((s, b) => s + b.stake, 0);
    const settledStake = settled.reduce((s, b) => s + b.stake, 0);
    const profit = settled.reduce((s, b) => s + (profitOf(b) || 0), 0);
    const roi = settledStake > 0 ? (profit / settledStake) * 100 : 0;
    return {
      count: filtered.length,
      staked,
      profit,
      roi: Math.round(roi * 10) / 10,
    };
  }, [filtered]);

  const activeFilters = !!(sport || bookie || from || to || search.trim());
  function clearFilters() {
    setSearch(''); setSport(''); setBookie(''); setFrom(''); setTo('');
  }

  // Bulk-settle selection (pending bets only, within the current filtered view).
  const [selected, setSelected] = useState(() => new Set());
  const pendingInView = filtered.filter((b) => b.status === 'pending');
  const allSelected = pendingInView.length > 0 && pendingInView.every((b) => selected.has(b.id));
  const selectedCount = pendingInView.filter((b) => selected.has(b.id)).length;
  function toggleOne(id) {
    setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }
  function toggleAll() {
    setSelected((s) => {
      const n = new Set(s);
      const on = pendingInView.length > 0 && pendingInView.every((b) => s.has(b.id));
      pendingInView.forEach((b) => (on ? n.delete(b.id) : n.add(b.id)));
      return n;
    });
  }
  async function bulkSettle(status) {
    const targets = bets.filter((b) => selected.has(b.id) && b.status === 'pending');
    if (!targets.length) return;
    try {
      await Promise.all(targets.map((b) => api.put(`/bets/${b.id}`, { ...b, status, payout: settlePayout(b, status) })));
      await load();
      setSelected(new Set());
      toast(`Marked ${targets.length} bet${targets.length !== 1 ? 's' : ''} ${status}`, 'success');
    } catch (e) { toast(e.message, 'error'); }
  }

  async function save(form) {
    const editingNow = editing;
    try {
      if (editingNow) await api.put(`/bets/${editingNow.id}`, form);
      else await api.post('/bets', { ...form, tracker_id: activeId });
    } catch (e) {
      toast(e.message, 'error');
      throw e; // keep the form open so the user can retry
    }
    // The bet is saved. Everything below is best-effort — a failure here must
    // not throw back into the form and make a successful save look broken.
    toast(editingNow ? 'Bet updated' : 'Bet added', 'success');
    if (form.placed_at) setLastDate(form.placed_at); // next new bet defaults to this date
    try { await load(); } catch (e) { /* list will refresh on next load */ }
    // Autocomplete for teams / runners / selections is derived per-sport from
    // your saved bets (see BetForm), so there's nothing extra to remember here.
  }

  async function remove(id) {
    if (!confirm('Delete this bet?')) return;
    try {
      await api.del(`/bets/${id}`);
      await load();
      toast('Bet deleted');
    } catch (e) {
      toast(e.message, 'error');
    }
  }

  // Quick-settle a pending bet without opening the form. The payout is worked
  // out client-side (settlePayout) so each-way returns are correct.
  async function settle(bet, status) {
    try {
      await api.put(`/bets/${bet.id}`, { ...bet, status, payout: settlePayout(bet, status) });
      await load();
      const label = { won: 'won', lost: 'lost', placed: 'placed', void: 'void' }[status] || status;
      toast(`Marked ${label}`);
    } catch (e) {
      toast(e.message, 'error');
    }
  }

  function openNew() { setEditing(null); setPrefill(null); setTemplate(null); setShowForm(true); }
  function openEdit(b) { setEditing(b); setPrefill(null); setTemplate(null); setShowForm(true); }
  function openTemplate(t) { setEditing(null); setPrefill(null); setTemplate(t); setShowForm(true); }

  // Saved quick-add templates live in account settings.
  const templates = Array.isArray(settings?.templates) ? settings.templates : [];
  function saveTemplate(data) {
    const id = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : String(Date.now());
    updateSettings({ templates: [...templates, { id, ...data }] });
    toast(`Template "${data.name}" saved`, 'success');
  }
  function deleteTemplate(id) {
    updateSettings({ templates: templates.filter((t) => t.id !== id) });
  }

  const isPro = !!ent?.pro;
  const slug = (s) => (s || 'bets').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'bets';

  // Export the active tracker's bets to a CSV download (Pro).
  function exportCsv() {
    setDataMenu(false);
    if (!isPro) { toast('Exporting to CSV is a Pro feature', 'info'); navigate('/account'); return; }
    if (!bets.length) { toast('No bets to export yet'); return; }
    const date = new Date().toISOString().slice(0, 10);
    downloadCsv(`${slug(active?.name)}-${date}.csv`, betsToCsv(bets));
    toast(`Exported ${bets.length} bet${bets.length !== 1 ? 's' : ''}`, 'success');
  }

  // Import bets from a CSV file into the active tracker (Pro).
  async function onImportFile(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setImporting(true);
    try {
      const text = await file.text();
      const { bets: parsed, skipped } = csvToBets(text);
      if (!parsed.length) {
        toast('No bets found in that file — check it has a header row with Stake / Selection columns', 'error');
        return;
      }
      const d = await api.post('/bets/import', { bets: parsed, tracker_id: activeId });
      await load();
      const extra = skipped ? ` (${skipped} row${skipped !== 1 ? 's' : ''} skipped)` : '';
      toast(`Imported ${d.imported} bet${d.imported !== 1 ? 's' : ''}${extra}`, 'success');
    } catch (err) {
      if (err.status === 402 || err.data?.upgrade) {
        toast('Importing from CSV is a Pro feature', 'info');
        navigate('/account');
      } else {
        toast(err.message || 'Import failed', 'error');
      }
    } finally {
      setImporting(false);
    }
  }

  function toggleSort(key) {
    if (sortBy === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortBy(key); setSortDir(key === 'date' ? 'desc' : 'desc'); }
  }
  const sortArrow = (key) => (sortBy === key ? (sortDir === 'asc' ? ' ▲' : ' ▼') : '');

  return (
    <div className="main">
      <div className="page-head">
        <div>
          <h1>My bets</h1>
          <p>{bets.length} bet{bets.length !== 1 ? 's' : ''} logged.</p>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <div className="data-menu">
            <button className="btn-ghost" onClick={() => setDataMenu((v) => !v)} disabled={importing} aria-haspopup="true" aria-expanded={dataMenu}>
              {importing ? 'Importing…' : 'Data'} <span aria-hidden="true">▾</span>
            </button>
            {dataMenu && (
              <>
                <div className="data-menu-backdrop" onClick={() => setDataMenu(false)} />
                <div className="data-menu-pop" role="menu">
                  <button role="menuitem" onClick={exportCsv}>
                    Export CSV{!isPro && <span className="pro-pill">Pro</span>}
                  </button>
                  <button role="menuitem" onClick={() => { setDataMenu(false); csvRef.current?.click(); }}>
                    Import CSV{!isPro && <span className="pro-pill">Pro</span>}
                  </button>
                </div>
              </>
            )}
          </div>
          <button className="btn-primary" onClick={openNew}>+ Add bet</button>
        </div>
      </div>

      <input ref={csvRef} type="file" accept=".csv,text/csv" onChange={onImportFile} style={{ display: 'none' }} />

      {templates.length > 0 && (
        <div className="tpl-row" style={{ marginBottom: 14 }}>
          <span className="muted" style={{ fontSize: 12.5, fontWeight: 700 }}>Quick add:</span>
          {templates.map((t) => (
            <span key={t.id} className="tpl-chip">
              <button type="button" className="tpl-chip-main" onClick={() => openTemplate(t)} title="Add a bet from this template">{t.name}</button>
              <button type="button" className="tpl-chip-x" onClick={() => deleteTemplate(t.id)} aria-label={`Delete template ${t.name}`} title="Delete template">✕</button>
            </span>
          ))}
        </div>
      )}

      {error && <div className="error-banner">{error} <button className="btn-ghost btn-sm" onClick={() => { setLoading(true); load(); }} style={{ marginLeft: 8 }}>Retry</button></div>}

      {loading ? (
        <div className="card"><Spinner label="Loading your bets…" /></div>
      ) : bets.length === 0 ? (
        <div className="card empty">
          <div className="em"><Icon name="target" size={40} /></div>
          <h3>No bets here yet</h3>
          <p>Add your first bet to start tracking your profit and win rate.</p>
          <div className="row" style={{ marginTop: 10, justifyContent: 'center', gap: 8 }}>
            <button className="btn-primary" onClick={openNew}>+ Add bet</button>
          </div>
        </div>
      ) : (
      <>
      {/* Status chips + search + filter toggle */}
      <div className="stack" style={{ marginBottom: 14 }}>
        <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
          {['all', 'pending', 'won', 'placed', 'lost', 'void', 'cashout'].map((f) => (
            <button
              key={f}
              className={status === f ? 'btn-accent btn-sm' : 'btn-ghost btn-sm'}
              onClick={() => setStatus(f)}
            >
              {f[0].toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
        <div className="row" style={{ gap: 8 }}>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search selection, event, bookie, notes…"
          />
          <button
            className={showFilters || activeFilters ? 'btn-accent btn-sm' : 'btn-ghost btn-sm'}
            onClick={() => setShowFilters((v) => !v)}
            style={{ flex: 'none', whiteSpace: 'nowrap' }}
          >
            Filters{activeFilters ? ' •' : ''}
          </button>
        </div>

        {showFilters && (
          <div className="card" style={{ padding: 14 }}>
            <div className="grid-2">
              <div className="field" style={{ margin: 0 }}>
                <label>Sport / category</label>
                <select value={sport} onChange={(e) => setSport(e.target.value)}>
                  <option value="">All sports</option>
                  {sportOptions.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="field" style={{ margin: 0 }}>
                <label>Bookmaker</label>
                <select value={bookie} onChange={(e) => setBookie(e.target.value)}>
                  <option value="">All bookmakers</option>
                  {bookieOptions.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="field" style={{ margin: 0 }}>
                <label>From date</label>
                <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
              </div>
              <div className="field" style={{ margin: 0 }}>
                <label>To date</label>
                <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
              </div>
              <div className="field" style={{ margin: 0 }}>
                <label>Sort by</label>
                <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                  {SORTS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
                </select>
              </div>
              <div className="field" style={{ margin: 0 }}>
                <label>Order</label>
                <select value={sortDir} onChange={(e) => setSortDir(e.target.value)}>
                  <option value="desc">High → low / Newest</option>
                  <option value="asc">Low → high / Oldest</option>
                </select>
              </div>
            </div>
            {activeFilters && (
              <button className="btn-ghost btn-sm" onClick={clearFilters} style={{ marginTop: 12 }}>Clear filters</button>
            )}
          </div>
        )}
      </div>

      {/* Live summary of the current slice */}
      <div className="stat-grid" style={{ marginBottom: 16 }}>
        <div className="stat"><div className="label">Showing</div><div className="value">{summary.count}</div><div className="sub">of {bets.length} bets</div></div>
        <div className="stat"><div className="label">Staked</div><div className="value">{formatStake(summary.staked, currency, staking)}</div></div>
        <div className="stat"><div className="label">Net Profit</div><div className={`value ${summary.profit > 0 ? 'pos' : summary.profit < 0 ? 'neg' : ''}`}>{formatStake(summary.profit, currency, staking, { signed: true })}</div></div>
        <div className="stat"><div className="label">ROI</div><div className={`value ${summary.roi > 0 ? 'pos' : summary.roi < 0 ? 'neg' : ''}`}>{summary.roi}%</div></div>
      </div>

      {selectedCount > 0 && (
        <div className="bulk-bar">
          <span className="bulk-count">{selectedCount} selected</span>
          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
            <button className="btn-ghost btn-sm settle-win" onClick={() => bulkSettle('won')}>Mark won</button>
            <button className="btn-ghost btn-sm settle-loss" onClick={() => bulkSettle('lost')}>Mark lost</button>
            <button className="btn-ghost btn-sm" onClick={() => bulkSettle('void')}>Void</button>
            <button className="btn-ghost btn-sm" onClick={() => setSelected(new Set())}>Clear</button>
          </div>
        </div>
      )}

      <div className="card">
        {filtered.length === 0 ? (
          <div className="empty">
            <div className="em"><Icon name="search" size={40} /></div>
            <h3>No bets match</h3>
            <p>Try a different search or clear your filters.</p>
            {activeFilters && <button className="btn-ghost btn-sm" onClick={clearFilters} style={{ marginTop: 8 }}>Clear filters</button>}
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th style={{ width: 28 }}>
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleAll}
                      disabled={pendingInView.length === 0}
                      aria-label="Select all pending bets"
                    />
                  </th>
                  <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('date')}>Date{sortArrow('date')}</th>
                  {col('sport') && <th>Sport</th>}
                  {col('selection') && <th>Selection</th>}
                  {col('bookmaker') && <th>Bookie</th>}
                  {col('tipster') && <th>Tipster</th>}
                  {col('stake') && <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('stake')}>Stake{sortArrow('stake')}</th>}
                  {col('odds') && <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('odds')}>Odds{sortArrow('odds')}</th>}
                  {col('status') && <th>Status</th>}
                  <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('profit')}>Profit{sortArrow('profit')}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((b) => {
                  const p = profitOf(b);
                  return (
                    <tr key={b.id} className={selected.has(b.id) ? 'row-selected' : ''}>
                      <td>
                        {b.status === 'pending' ? (
                          <input
                            type="checkbox"
                            checked={selected.has(b.id)}
                            onChange={() => toggleOne(b.id)}
                            aria-label={`Select bet ${b.selection || b.event || ''}`}
                          />
                        ) : null}
                      </td>
                      <td>{formatDate(b.placed_at)}</td>
                      {col('sport') && <td>{b.sport || '—'}</td>}
                      {col('selection') && (
                        <td>
                          <div style={{ fontWeight: 600 }}>{b.selection || b.event || '—'}</div>
                          {b.event && b.selection && <div className="muted" style={{ fontSize: 12 }}>{b.event}</div>}
                        </td>
                      )}
                      {col('bookmaker') && <td>{b.bookmaker || '—'}</td>}
                      {col('tipster') && <td>{b.tipster || '—'}</td>}
                      {col('stake') && <td>{formatStake(b.stake, currency, staking)}</td>}
                      {col('odds') && <td>{formatOdds(b.odds, oddsFormat)}</td>}
                      {col('status') && <td><span className={`badge ${b.status}`}>{b.status}</span></td>}
                      <td className={p > 0 ? 'pos' : p < 0 ? 'neg' : 'muted'}>
                        {p == null ? "—" : formatStake(p, currency, staking, { signed: true })}
                      </td>
                      <td>
                        <div className="row" style={{ flexWrap: 'nowrap' }}>
                          {b.status === 'pending' && (
                            <SettleControls bet={b} onSettle={(status) => settle(b, status)} />
                          )}
                          <button className="btn-ghost btn-sm" onClick={() => openEdit(b)}>Edit</button>
                          <button className="btn-danger btn-sm" onClick={() => remove(b.id)}>✕</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      </>
      )}

      {showForm && (
        <BetForm
          initial={editing || prefill}
          isEdit={!!editing}
          fields={fields}
          staking={staking}
          currency={currency}
          oddsFormat={oddsFormat}
          defaults={settings?.defaults}
          bookmakers={bookieOptions}
          sports={sportSuggestions}
          bets={bets}
          template={template}
          onSaveTemplate={saveTemplate}
          defaultDate={lastDate}
          onSetUnitSize={(v) => updateSettings({ staking: { ...settings.staking, unitSize: v } })}
          onSave={save}
          onClose={() => {
            setShowForm(false);
            setPrefill(null);
            setTemplate(null);
            const back = returnToRef.current;
            returnToRef.current = null;
            if (back && back !== '/bets') navigate(back);
          }}
        />
      )}
    </div>
  );
}
