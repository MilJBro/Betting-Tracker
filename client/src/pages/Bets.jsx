import { useEffect, useMemo, useState } from 'react';
import { api } from '../api.js';
import { useSettings } from '../context/SettingsContext.jsx';
import BetForm from '../components/BetForm.jsx';
import { money, formatOdds, formatDate } from '../format.js';

function profitOf(b) {
  if (b.status === 'won') return (b.payout ?? b.stake * b.odds) - b.stake;
  if (b.status === 'lost') return -b.stake;
  if (b.status === 'void' || b.status === 'cashout') return (b.payout ?? b.stake) - b.stake;
  return null;
}

export default function Bets() {
  const { settings } = useSettings();
  const [bets, setBets] = useState([]);
  const [editing, setEditing] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState('all');

  const load = () => api.get('/bets').then((d) => setBets(d.bets));
  useEffect(() => { load(); }, []);

  const fields = settings?.fields || {};
  const oddsFormat = settings?.oddsFormat || 'decimal';
  const currency = settings?.currency || 'GBP';

  const visible = useMemo(
    () => (filter === 'all' ? bets : bets.filter((b) => b.status === filter)),
    [bets, filter]
  );

  async function save(form) {
    if (editing) await api.put(`/bets/${editing.id}`, form);
    else await api.post('/bets', form);
    await load();
  }

  async function remove(id) {
    if (!confirm('Delete this bet?')) return;
    await api.del(`/bets/${id}`);
    await load();
  }

  function openNew() { setEditing(null); setShowForm(true); }
  function openEdit(b) { setEditing(b); setShowForm(true); }

  const col = (k) => fields[k] !== false;

  return (
    <div className="main">
      <div className="page-head">
        <div>
          <h1>My bets</h1>
          <p>{bets.length} bet{bets.length !== 1 ? 's' : ''} logged.</p>
        </div>
        <button className="btn-primary" onClick={openNew}>+ Add bet</button>
      </div>

      <div className="row" style={{ marginBottom: 16, flexWrap: 'wrap' }}>
        {['all', 'pending', 'won', 'lost', 'void', 'cashout'].map((f) => (
          <button
            key={f}
            className={filter === f ? 'btn-accent btn-sm' : 'btn-ghost btn-sm'}
            onClick={() => setFilter(f)}
          >
            {f[0].toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      <div className="card">
        {visible.length === 0 ? (
          <div className="empty">
            <div style={{ fontSize: 40 }}>🎯</div>
            <h3>No bets here yet</h3>
            <p>Add your first bet to start tracking your performance.</p>
            <button className="btn-primary" onClick={openNew} style={{ marginTop: 10 }}>+ Add bet</button>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  {col('sport') && <th>Sport</th>}
                  {col('selection') && <th>Selection</th>}
                  {col('bookmaker') && <th>Bookie</th>}
                  {col('stake') && <th>Stake</th>}
                  {col('odds') && <th>Odds</th>}
                  {col('status') && <th>Status</th>}
                  <th>Profit</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {visible.map((b) => {
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
