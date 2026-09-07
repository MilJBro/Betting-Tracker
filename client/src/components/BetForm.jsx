import { useState } from 'react';
import { currencySymbol } from '../format.js';

const STATUS_OPTIONS = ['pending', 'won', 'lost', 'void', 'cashout'];

const blank = () => ({
  placed_at: new Date().toISOString().slice(0, 10),
  sport: '',
  event: '',
  selection: '',
  bet_type: '',
  bookmaker: '',
  tipster: '',
  stake: '',
  odds: '',
  status: 'pending',
  payout: '',
  notes: '',
  tags: [],
});

export default function BetForm({ initial, isEdit, fields, staking, currency, defaults, onSave, onClose }) {
  const unitSize = Number(staking?.unitSize) || 0;
  const usesUnits = (staking?.mode === 'units' || staking?.mode === 'both') && unitSize > 0;
  const toUnits = (money) =>
    money === '' || money == null ? money : String(Math.round((money / unitSize) * 100) / 100);

  const [form, setForm] = useState(() => {
    const base = blank();
    // Pre-fill a brand-new bet (not an edit or a scan) with the user's defaults.
    if (!initial) {
      if (defaults?.stake !== '' && defaults?.stake != null) base.stake = String(defaults.stake);
      if (defaults?.bookmaker) base.bookmaker = defaults.bookmaker;
    }
    const f = { ...base, ...(initial || {}) };
    // Money is stored; show the stake/payout in units when the user bets in units.
    if (usesUnits && initial) {
      f.stake = initial.stake ? toUnits(initial.stake) : '';
      f.payout = initial.payout != null && initial.payout !== '' ? toUnits(initial.payout) : f.payout;
    }
    return f;
  });
  const [tagInput, setTagInput] = useState('');
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const show = (k) => fields[k] !== false;
  const unitLabel = usesUnits ? ' (units)' : '';

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      // Convert unit inputs back to money before saving.
      const payload = { ...form };
      if (usesUnits) {
        payload.stake = form.stake === '' ? '' : Number(form.stake) * unitSize;
        payload.payout =
          form.payout === '' || form.payout == null ? form.payout : Number(form.payout) * unitSize;
      }
      await onSave(payload);
      onClose();
    } finally {
      setSaving(false);
    }
  }

  function addTag() {
    const t = tagInput.trim();
    if (t && !form.tags.includes(t)) set('tags', [...form.tags, t]);
    setTagInput('');
  }

  return (
    <div className="modal-overlay" onMouseDown={onClose}>
      <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="row spread" style={{ marginBottom: 18 }}>
          <h2 style={{ margin: 0, fontSize: 20 }}>{isEdit ? 'Edit bet' : 'Add a bet'}</h2>
          <button className="btn-ghost btn-sm" type="button" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={submit}>
          <div className="grid-2">
            <div className="field">
              <label>Date</label>
              <input type="date" value={form.placed_at} onChange={(e) => set('placed_at', e.target.value)} />
            </div>
            {show('sport') && (
              <div className="field">
                <label>Sport / Category</label>
                <input value={form.sport} onChange={(e) => set('sport', e.target.value)} placeholder="Football" />
              </div>
            )}
          </div>

          {show('event') && (
            <div className="field">
              <label>Event</label>
              <input value={form.event} onChange={(e) => set('event', e.target.value)} placeholder="Arsenal vs Chelsea" />
            </div>
          )}
          {show('selection') && (
            <div className="field">
              <label>Selection</label>
              <input value={form.selection} onChange={(e) => set('selection', e.target.value)} placeholder="Arsenal to win" />
            </div>
          )}

          <div className="grid-2">
            {show('betType') && (
              <div className="field">
                <label>Bet type</label>
                <input value={form.bet_type} onChange={(e) => set('bet_type', e.target.value)} placeholder="Single, Accumulator…" />
              </div>
            )}
            {show('bookmaker') && (
              <div className="field">
                <label>Bookmaker</label>
                <input value={form.bookmaker} onChange={(e) => set('bookmaker', e.target.value)} placeholder="Bet365" />
              </div>
            )}
          </div>

          {show('tipster') && (
            <div className="field">
              <label>Tipster</label>
              <input value={form.tipster} onChange={(e) => set('tipster', e.target.value)} placeholder="Who tipped this bet?" />
            </div>
          )}

          <div className="grid-2">
            {show('stake') && (
              <div className="field">
                <label>Stake{unitLabel}</label>
                <input type="number" step="0.01" min="0" value={form.stake} onChange={(e) => set('stake', e.target.value)} placeholder={usesUnits ? '2' : '10.00'} />
                {usesUnits && <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>1u = {currencySymbol(currency)}{unitSize}</div>}
              </div>
            )}
            {show('odds') && (
              <div className="field">
                <label>Odds (decimal)</label>
                <input type="number" step="0.01" min="0" value={form.odds} onChange={(e) => set('odds', e.target.value)} placeholder="2.50" />
              </div>
            )}
          </div>

          <div className="grid-2">
            {show('status') && (
              <div className="field">
                <label>Status</label>
                <select value={form.status} onChange={(e) => set('status', e.target.value)}>
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>{s[0].toUpperCase() + s.slice(1)}</option>
                  ))}
                </select>
              </div>
            )}
            {show('payout') && (
              <div className="field">
                <label>Payout / Return{unitLabel} {form.status === 'won' ? '' : '(optional)'}</label>
                <input type="number" step="0.01" min="0" value={form.payout ?? ''} onChange={(e) => set('payout', e.target.value)} placeholder="Auto for wins" />
              </div>
            )}
          </div>

          {show('tags') && (
            <div className="field">
              <label>Tags</label>
              <div className="row" style={{ marginBottom: 8 }}>
                <input
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }}
                  placeholder="value, in-play…"
                />
                <button type="button" className="btn-ghost btn-sm" onClick={addTag}>Add</button>
              </div>
              <div>
                {form.tags.map((t) => (
                  <span key={t} className="chip" style={{ cursor: 'pointer' }} onClick={() => set('tags', form.tags.filter((x) => x !== t))}>
                    {t} ✕
                  </span>
                ))}
              </div>
            </div>
          )}

          {show('notes') && (
            <div className="field">
              <label>Notes</label>
              <textarea rows={2} value={form.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Any reasoning or reminders…" />
            </div>
          )}

          <div className="row" style={{ justifyContent: 'flex-end', marginTop: 8 }}>
            <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Add bet'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
