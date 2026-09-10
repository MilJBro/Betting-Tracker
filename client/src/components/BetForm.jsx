import { useMemo, useState } from 'react';
import { currencySymbol, money } from '../format.js';

const STATUS_OPTIONS = ['pending', 'won', 'lost', 'void', 'cashout'];
// Common unit stakes offered as a quick-pick when the user stakes in units.
const UNIT_STEPS = [0.1, 0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.5, 3, 5, 10];

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
  legs: [],
});

// Combined decimal odds for an accumulator = product of the legs' odds.
function combinedOdds(legs) {
  const valid = legs.filter((l) => Number(l.odds) > 0);
  if (!valid.length) return 0;
  return valid.reduce((p, l) => p * Number(l.odds), 1);
}

// An event is stored as "Home v Away". Split it back into the two sides for
// editing; join non-empty sides with " v " when saving.
function splitEvent(ev) {
  const parts = (ev || '').split(/\s+v(?:s\.?|ersus)?\s+/i);
  return { home: (parts[0] || '').trim(), away: (parts.length > 1 ? parts.slice(1).join(' v ') : '').trim() };
}

export default function BetForm({ initial, isEdit, fields, staking, currency, defaults, bookmakers = [], teams = [], defaultDate, onSave, onClose }) {
  const unitSize = Number(staking?.unitSize) || 0;
  const usesUnits = (staking?.mode === 'units' || staking?.mode === 'both') && unitSize > 0;
  const toUnits = (money) =>
    money === '' || money == null ? money : String(Math.round((money / unitSize) * 100) / 100);

  const [form, setForm] = useState(() => {
    const base = blank();
    // Pre-fill a brand-new bet (not an edit or a scan) with the user's defaults.
    if (!initial) {
      if (defaultDate) base.placed_at = defaultDate; // keep the last date when adding several
      if (defaults?.stake !== '' && defaults?.stake != null) base.stake = String(defaults.stake);
      if (defaults?.bookmaker) base.bookmaker = defaults.bookmaker;
    }
    const f = { ...base, ...(initial || {}) };
    if (usesUnits && initial) {
      f.stake = initial.stake ? toUnits(initial.stake) : '';
      f.payout = initial.payout != null && initial.payout !== '' ? toUnits(initial.payout) : f.payout;
    }
    return f;
  });

  // Single vs accumulator. Legs carry their own selection + odds.
  const initialLegs = Array.isArray(initial?.legs) ? initial.legs : [];
  const [kind, setKind] = useState(
    initialLegs.length >= 2 || initial?.bet_type === 'Accumulator' ? 'acca' : 'single'
  );
  const [legs, setLegs] = useState(() =>
    initialLegs.length
      ? initialLegs.map((l) => ({ selection: l.selection || '', odds: l.odds != null ? String(l.odds) : '' }))
      : [{ selection: '', odds: '' }, { selection: '', odds: '' }]
  );

  // Event is entered as two teams: "Home v Away".
  const [home, setHome] = useState(() => splitEvent(form.event).home);
  const [away, setAway] = useState(() => splitEvent(form.event).away);
  const composeEvent = () => [home.trim(), away.trim()].filter(Boolean).join(' v ');

  // The little note under the stake box, converting between units and money.
  const stakeHint = () => {
    const n = Number(form.stake);
    if (form.stake !== '' && n > 0) {
      return usesUnits
        ? `${n}u = ${money(n * unitSize, currency)}`
        : `${money(n, currency)} = ${Math.round((n / unitSize) * 100) / 100}u`;
    }
    return `1u = ${money(unitSize, currency)}`;
  };

  const [tagInput, setTagInput] = useState('');
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const show = (k) => fields[k] !== false;
  const unitLabel = usesUnits ? ' (units)' : '';

  const accaOdds = useMemo(() => combinedOdds(legs), [legs]);

  const setLeg = (i, k, v) => setLegs((ls) => ls.map((l, j) => (j === i ? { ...l, [k]: v } : l)));
  const addLeg = () => setLegs((ls) => [...ls, { selection: '', odds: '' }]);
  const removeLeg = (i) => setLegs((ls) => (ls.length > 1 ? ls.filter((_, j) => j !== i) : ls));

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { ...form };
      if (usesUnits) {
        payload.stake = form.stake === '' ? '' : Number(form.stake) * unitSize;
        payload.payout =
          form.payout === '' || form.payout == null ? form.payout : Number(form.payout) * unitSize;
      }
      if (kind === 'acca') {
        const cleaned = legs
          .map((l) => ({ selection: l.selection.trim(), odds: Number(l.odds) || 0 }))
          .filter((l) => l.selection || l.odds > 0);
        payload.legs = cleaned;
        payload.bet_type = 'Accumulator';
        payload.odds = combinedOdds(cleaned) || '';
        payload.event = '';
        payload.selection = ''; // server builds a summary from the legs
      } else {
        payload.legs = [];
        payload.bet_type = 'Single';
        payload.event = composeEvent();
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
                <input value={form.sport} onChange={(e) => set('sport', e.target.value)} aria-label="Sport or category" />
              </div>
            )}
          </div>

          {/* Bet kind: single or accumulator */}
          <div className="field">
            <label>Bet type</label>
            <div className="seg-group">
              <button type="button" className={kind === 'single' ? 'seg on' : 'seg'} onClick={() => setKind('single')}>Single</button>
              <button type="button" className={kind === 'acca' ? 'seg on' : 'seg'} onClick={() => setKind('acca')}>Accumulator</button>
            </div>
          </div>

          {kind === 'single' ? (
            <>
              {show('event') && (
                <div className="field">
                  <label>Event</label>
                  <div className="team-vs">
                    <input list="team-options" value={home} onChange={(e) => setHome(e.target.value)} aria-label="Home team" autoComplete="off" />
                    <span className="vs">v</span>
                    <input list="team-options" value={away} onChange={(e) => setAway(e.target.value)} aria-label="Away team" autoComplete="off" />
                  </div>
                  <datalist id="team-options">
                    {teams.map((t) => <option key={t} value={t} />)}
                  </datalist>
                </div>
              )}
              {show('selection') && (
                <div className="field">
                  <label>Selection</label>
                  <input value={form.selection} onChange={(e) => set('selection', e.target.value)} aria-label="Selection" />
                </div>
              )}
              {show('odds') && (
                <div className="field">
                  <label>Odds (decimal)</label>
                  <input type="number" step="0.01" min="0" value={form.odds} onChange={(e) => set('odds', e.target.value)} aria-label="Odds (decimal)" />
                </div>
              )}
            </>
          ) : (
            <div className="field">
              <label>Selections</label>
              <div className="legs">
                {legs.map((l, i) => (
                  <div className="leg-row" key={i}>
                    <input
                      value={l.selection}
                      onChange={(e) => setLeg(i, 'selection', e.target.value)}
                      aria-label={`Selection ${i + 1}`}
                    />
                    <input
                      type="number" step="0.01" min="0" className="leg-odds"
                      value={l.odds}
                      onChange={(e) => setLeg(i, 'odds', e.target.value)}
                      aria-label={`Odds for selection ${i + 1}`}
                    />
                    <button
                      type="button" className="btn-ghost btn-sm leg-x"
                      onClick={() => removeLeg(i)} disabled={legs.length <= 1} title="Remove"
                    >✕</button>
                  </div>
                ))}
              </div>
              <div className="row spread" style={{ marginTop: 10 }}>
                <button type="button" className="btn-ghost btn-sm" onClick={addLeg}>+ Add selection</button>
                <div className="muted" style={{ fontSize: 13 }}>
                  Total odds <strong style={{ color: 'var(--text)', fontSize: 15 }}>{accaOdds ? accaOdds.toFixed(2) : '—'}</strong>
                </div>
              </div>
            </div>
          )}

          {show('bookmaker') && (
            <div className="field">
              <label>Bookmaker</label>
              <input
                list="bookmaker-options"
                value={form.bookmaker}
                onChange={(e) => set('bookmaker', e.target.value)}
                aria-label="Bookmaker"
              />
              <datalist id="bookmaker-options">
                {bookmakers.map((b) => <option key={b} value={b} />)}
              </datalist>
            </div>
          )}

          {show('tipster') && (
            <div className="field">
              <label>Tipster</label>
              <input value={form.tipster} onChange={(e) => set('tipster', e.target.value)} aria-label="Tipster" />
            </div>
          )}

          <div className="grid-2">
            {show('stake') && (
              <div className="field">
                <label>Stake{unitLabel}</label>
                {unitSize > 0 ? (
                  <>
                    <div className="row" style={{ gap: 8 }}>
                      <input type="number" step="0.01" min="0" value={form.stake} onChange={(e) => set('stake', e.target.value)} aria-label={usesUnits ? 'Stake in units' : 'Stake'} style={{ flex: 1 }} />
                      <select
                        aria-label="Quick unit stake"
                        value=""
                        onChange={(e) => {
                          if (!e.target.value) return;
                          const u = Number(e.target.value);
                          // In units mode the box holds units; in currency mode fill the money value.
                          set('stake', usesUnits ? String(u) : String(Math.round(u * unitSize * 100) / 100));
                        }}
                        style={{ flex: 'none', width: 96 }}
                      >
                        <option value="">Units</option>
                        {UNIT_STEPS.map((u) => <option key={u} value={u}>{u}u</option>)}
                      </select>
                    </div>
                    <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>{stakeHint()}</div>
                  </>
                ) : (
                  <input type="number" step="0.01" min="0" value={form.stake} onChange={(e) => set('stake', e.target.value)} aria-label="Stake" />
                )}
              </div>
            )}
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
          </div>

          {show('payout') && (
            <div className="field">
              <label>Payout / Return{unitLabel} {form.status === 'won' ? '' : '(optional)'}</label>
              <input type="number" step="0.01" min="0" value={form.payout ?? ''} onChange={(e) => set('payout', e.target.value)} aria-label="Payout or return" />
            </div>
          )}

          {show('tags') && (
            <div className="field">
              <label>Tags</label>
              <div className="row" style={{ marginBottom: 8 }}>
                <input
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }}
                  aria-label="Add a tag"
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
              <textarea rows={2} value={form.notes} onChange={(e) => set('notes', e.target.value)} aria-label="Notes" />
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
