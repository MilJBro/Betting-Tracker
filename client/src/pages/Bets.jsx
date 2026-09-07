import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api.js';
import { useSettings } from '../context/SettingsContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import BetForm from '../components/BetForm.jsx';
import Spinner from '../components/Spinner.jsx';
import { money, formatOdds, formatDate } from '../format.js';

function profitOf(b) {
  if (b.status === 'won') return (b.payout ?? b.stake * b.odds) - b.stake;
  if (b.status === 'lost') return -b.stake;
  if (b.status === 'void' || b.status === 'cashout') return (b.payout ?? b.stake) - b.stake;
  return null;
}

const SETTLED = ['won', 'lost', 'void', 'cashout'];
const SORTS = [
  { key: 'date', label: 'Date' },
  { key: 'stake', label: 'Stake' },
  { key: 'odds', label: 'Odds' },
  { key: 'profit', label: 'Profit' },
];

export default function Bets() {
  const { settings } = useSettings();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const [bets, setBets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(null);
  const [showForm, setShowForm] = useState(false);

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
      .get('/bets')
      .then((d) => { setBets(d.bets); setError(''); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  // The mobile "+" button links here with ?new=1 to open the form directly.
  useEffect(() => {
    if (params.get('new')) {
      setEditing(null);
      setShowForm(true);
      params.delete('new');
      setParams(params, { replace: true });
    }
  }, [params, setParams]);

  const fields = settings?.fields || {};
  const oddsFormat = settings?.oddsFormat || 'decimal';
  const currency = settings?.currency || 'GBP';
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

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = bets.filter((b) => {
      if (status !== 'all' && b.status !== status) return false;
      if (sport && b.sport !== sport) return false;
      if (bookie && b.bookmaker !== bookie) return false;
      if (from && b.placed_at < from) return false;
      if (to && b.placed_at > to) return false;
      if (q) {
        const hay = [b.selection, b.event, b.sport, b.bookmaker, b.bet_type, b.notes,
          ...(b.tags || [])].join(' ').toLowerCase();
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

  async function save(form) {
    const editingNow = editing;
    try {
      if (editingNow) await api.put(`/bets/${editingNow.id}`, form);
      else await api.post('/bets', form);
    } catch (e) {
      toast(e.message, 'error');
      throw e; // keep the form open so the user can retry
    }
    await load();
    toast(editingNow ? 'Bet updated' : 'Bet added', 'success');
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

  function openNew() { setEditing(null); setShowForm(true); }
  function openEdit(b) { setEditing(b); setShowForm(true); }

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
        <button className="btn-primary" onClick={openNew}>+ Add bet</button>
      </div>

      {error && <div className="error-banner">{error} <button className="btn-ghost btn-sm" onClick={() => { setLoading(true); load(); }} style={{ marginLeft: 8 }}>Retry</button></div>}

      {loading ? (
        <div className="card"><Spinner label="Loading your bets…" /></div>
      ) : bets.length === 0 ? (
        <div className="card empty">
          <div className="em">🎯</div>
          <h3>No bets here yet</h3>
          <p>Add your first bet to start tracking your performance.</p>
          <button className="btn-primary" onClick={openNew} style={{ marginTop: 10 }}>+ Add bet</button>
        </div>
      ) : (
      <>
      {/* Status chips + search + filter toggle */}
      <div className="stack" style={{ marginBottom: 14 }}>
        <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
          {['all', 'pending', 'won', 'lost', 'void', 'cashout'].map((f) => (
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
            ⚙ Filters{activeFilters ? ' •' : ''}
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
        <div className="stat"><div className="label">Staked</div><div className="value">{money(summary.staked, currency)}</div></div>
        <div className="stat"><div className="label">Net Profit</div><div className={`value ${summary.profit > 0 ? 'pos' : summary.profit < 0 ? 'neg' : ''}`}>{money(summary.profit, currency, { signed: true })}</div></div>
        <div className="stat"><div className="label">ROI</div><div className={`value ${summary.roi > 0 ? 'pos' : summary.roi < 0 ? 'neg' : ''}`}>{summary.roi}%</div></div>
      </div>

      <div className="card">
        {filtered.length === 0 ? (
          <div className="empty">
            <div className="em">🔍</div>
            <h3>No bets match</h3>
            <p>Try a different search or clear your filters.</p>
            {activeFilters && <button className="btn-ghost btn-sm" onClick={clearFilters} style={{ marginTop: 8 }}>Clear filters</button>}
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('date')}>Date{sortArrow('date')}</th>
                  {col('sport') && <th>Sport</th>}
                  {col('selection') && <th>Selection</th>}
                  {col('bookmaker') && <th>Bookie</th>}
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
                    <tr key={b.id}>
                      <td>{formatDate(b.placed_at)}</td>
                      {col('sport') && <td>{b.sport || '—'}</td>}
                      {col('selection') && (
                        <td>
                          <div style={{ fontWeight: 600 }}>{b.selection || b.event || '—'}</div>
                          {b.event && b.selection && <div className="muted" style={{ fontSize: 12 }}>{b.event}</div>}
                        </td>
                      )}
                      {col('bookmaker') && <td>{b.bookmaker || '—'}</td>}
                      {col('stake') && <td>{money(b.stake, currency)}</td>}
                      {col('odds') && <td>{formatOdds(b.odds, oddsFormat)}</td>}
                      {col('status') && <td><span className={`badge ${b.status}`}>{b.status}</span></td>}
                      <td className={p > 0 ? 'pos' : p < 0 ? 'neg' : 'muted'}>
                        {p == null ? '—' : money(p, currency, { signed: true })}
                      </td>
                      <td>
                        <div className="row">
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
          initial={editing}
          fields={fields}
          onSave={save}
          onClose={() => setShowForm(false)}
        />
      )}
    </div>
  );
}
