import { useEffect, useMemo, useState } from 'react';
import { currencySymbol, money, formatOdds, parseOdds } from '../format.js';

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
// Legs hold odds in the user's chosen format, so parse each to decimal first.
function combinedOdds(legs, fmt = 'decimal') {
  const valid = legs.filter((l) => parseOdds(l.odds, fmt) > 0);
  if (!valid.length) return 0;
  return valid.reduce((p, l) => p * parseOdds(l.odds, fmt), 1);
}

// An event is stored as "Home v Away". Split it back into the two sides for
// editing; join non-empty sides with " v " when saving.
function splitEvent(ev) {
  const parts = (ev || '').split(/\s+v(?:s\.?|ersus)?\s+/i);
  return { home: (parts[0] || '').trim(), away: (parts.length > 1 ? parts.slice(1).join(' v ') : '').trim() };
}

// The bet slip adapts to the sport:
//  · 'versus'  head-to-head (football, tennis, boxing…) — "Home v Away".
//  · 'racing'  horse / greyhound racing — a course + time and the runner.
//  · 'field'   other field sports (golf, motorsport, cycling…) — one event.
const RACING_HINTS = ['horse', 'greyhound', 'harness'];
const FIELD_HINTS = ['golf', 'cycl', 'athletic', 'motor', 'nascar', 'formula', 'rally', 'darts', 'snooker'];
function sportLayout(sport) {
  const s = (sport || '').trim().toLowerCase();
  if (!s) return 'versus';
  if (RACING_HINTS.some((k) => s.includes(k))) return 'racing';
  if (s === 'f1' || FIELD_HINTS.some((k) => s.includes(k))) return 'field';
  return 'versus';
}

// A racing event is stored as "Course HH:MM" (e.g. "Ascot 15:30"). Split it
// back into its parts for editing; the time is any HH:MM / H.MM token.
function splitRace(ev) {
  const s = (ev || '').trim();
  const m = s.match(/\b(\d{1,2})[:.](\d{2})\b/);
  if (m) {
    const time = `${m[1].padStart(2, '0')}:${m[2]}`;
    const course = (s.slice(0, m.index) + s.slice(m.index + m[0].length)).replace(/\s+/g, ' ').trim();
    return { course, time };
  }
  return { course: s, time: '' };
}

export default function BetForm({ initial, isEdit, fields, staking, currency, oddsFormat = 'decimal', defaults, bookmakers = [], sports = [], teams = [], defaultDate, onSetUnitSize, onSave, onClose }) {
  const unitSize = Number(staking?.unitSize) || 0;
  const [editUnit, setEditUnit] = useState(false);
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
    // Show a saved bet's odds back in the user's chosen format for editing.
    if (initial) f.odds = Number(initial.odds) > 0 ? formatOdds(initial.odds, oddsFormat) : '';
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
      ? initialLegs.map((l) => ({ selection: l.selection || '', odds: Number(l.odds) > 0 ? formatOdds(l.odds, oddsFormat) : '' }))
      : [{ selection: '', odds: '' }, { selection: '', odds: '' }]
  );

  // Event is entered as two teams: "Home v Away".
  const [home, setHome] = useState(() => splitEvent(form.event).home);
  const [away, setAway] = useState(() => splitEvent(form.event).away);
  const composeEvent = () => [home.trim(), away.trim()].filter(Boolean).join(' v ');
  // Racing events split into a course and a time ("Ascot 15:30").
  const [course, setCourse] = useState(() => splitRace(form.event).course);
  const [raceTime, setRaceTime] = useState(() => splitRace(form.event).time);
  const composeRace = () => [course.trim(), raceTime.trim()].filter(Boolean).join(' ');
  // The slip layout follows the chosen sport.
  const layout = sportLayout(form.sport);
  const versus = layout === 'versus';

  // Sport is a dropdown; "Other…" reveals a free-text box for anything not
  // in the list. Match the saved sport to a list option case-insensitively.
  const sportOption = sports.find((s) => s.toLowerCase() === (form.sport || '').trim().toLowerCase()) || '';
  const [otherSport, setOtherSport] = useState(() => !!(form.sport || '').trim() && !sportOption);

  // Which preset unit the current stake matches, so the quick-pick shows the
  // chosen unit instead of snapping back to the placeholder. '' when custom.
  const stakeUnits = () => {
    if (form.stake === '' || form.stake == null || unitSize <= 0) return '';
    const u = usesUnits ? Number(form.stake) : Number(form.stake) / unitSize;
    const match = UNIT_STEPS.find((s) => Math.abs(s - u) < 1e-6);
    return match != null ? String(match) : '';
  };

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
  // Once the user edits the payout themselves, stop auto-filling it.
  const [payoutTouched, setPayoutTouched] = useState(
    () => !!(initial && initial.payout != null && initial.payout !== '')
  );
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const show = (k) => fields[k] !== false;
  const unitLabel = usesUnits ? ' (units)' : '';

  const accaOdds = useMemo(() => combinedOdds(legs, oddsFormat), [legs, oddsFormat]);

  // Auto-fill the payout (potential return = stake × odds) as the user types,
  // until they edit the payout box themselves. Stake and payout share the same
  // unit (money or units), so the odds is a plain multiplier for both.
  useEffect(() => {
    if (payoutTouched) return;
    const d = kind === 'acca' ? accaOdds : parseOdds(form.odds, oddsFormat);
    const st = Number(form.stake);
    const next = d > 0 && st > 0 ? String(Math.round(st * d * 100) / 100) : '';
    setForm((f) => (f.payout === next ? f : { ...f, payout: next }));
  }, [form.stake, form.odds, kind, accaOdds, oddsFormat, payoutTouched]);

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
          .map((l) => ({ selection: l.selection.trim(), odds: parseOdds(l.odds, oddsFormat) }))
          .filter((l) => l.selection || l.odds > 0);
        const validOdds = cleaned.filter((l) => l.odds > 0);
        payload.legs = cleaned;
        payload.bet_type = 'Accumulator';
        payload.odds = validOdds.length ? validOdds.reduce((p, l) => p * l.odds, 1) : '';
        payload.event = '';
        payload.selection = ''; // server builds a summary from the legs
      } else {
        payload.legs = [];
        payload.bet_type = 'Single';
        payload.odds = parseOdds(form.odds, oddsFormat);
        payload.event =
          layout === 'racing' ? composeRace()
          : versus ? composeEvent()
          : (form.event || '').trim();
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
                <select
                  value={otherSport ? '__other__' : sportOption}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === '__other__') { setOtherSport(true); set('sport', ''); }
                    else { setOtherSport(false); set('sport', v); }
                  }}
                  aria-label="Sport or category"
                >
                  <option value="">Select a sport…</option>
                  {sports.map((s) => <option key={s} value={s}>{s}</option>)}
                  <option value="__other__">Other…</option>
                </select>
                {otherSport && (
                  <input
                    style={{ marginTop: 8 }}
                    value={form.sport}
                    onChange={(e) => set('sport', e.target.value)}
                    aria-label="Custom sport"
                    placeholder="Type a sport"
                    autoComplete="off"
                  />
                )}
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
                layout === 'racing' ? (
                  <div className="grid-2">
                    <div className="field">
                      <label>Course / track</label>
                      <input value={course} onChange={(e) => setCourse(e.target.value)} aria-label="Course or track" placeholder="e.g. Ascot" autoComplete="off" />
                    </div>
                    <div className="field">
                      <label>Time <span className="muted" style={{ fontWeight: 400 }}>(optional)</span></label>
                      <input type="time" value={raceTime} onChange={(e) => setRaceTime(e.target.value)} aria-label="Race time" />
                    </div>
                  </div>
                ) : versus ? (
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
                ) : (
                  <div className="field">
                    <label>Event / tournament <span className="muted" style={{ fontWeight: 400 }}>(optional)</span></label>
                    <input value={form.event} onChange={(e) => set('event', e.target.value)} aria-label="Event or race" autoComplete="off" />
                  </div>
                )
              )}
              {show('selection') && (
                <div className="field">
                  <label>{layout === 'racing' ? 'Horse / runner' : versus ? 'Selection' : 'Your selection'}</label>
                  <input value={form.selection} onChange={(e) => set('selection', e.target.value)} aria-label="Selection" placeholder={layout === 'racing' ? 'e.g. Constitution Hill' : undefined} />
                </div>
              )}
              {show('odds') && (
                <div className="field">
                  <label>Odds</label>
                  <input
                    type={oddsFormat === 'decimal' ? 'number' : 'text'}
                    {...(oddsFormat === 'decimal' ? { step: '0.01', min: '0' } : {})}
                    inputMode={oddsFormat === 'decimal' ? 'decimal' : 'text'}
                    value={form.odds}
                    onChange={(e) => set('odds', e.target.value)}
                    aria-label="Odds"
                    autoComplete="off"
                  />
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
                      type={oddsFormat === 'decimal' ? 'number' : 'text'}
                      {...(oddsFormat === 'decimal' ? { step: '0.01', min: '0' } : {})}
                      inputMode={oddsFormat === 'decimal' ? 'decimal' : 'text'}
                      className="leg-odds"
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
                  Total odds <strong style={{ color: 'var(--text)', fontSize: 15 }}>{accaOdds ? formatOdds(accaOdds, oddsFormat) : '—'}</strong>
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
                        value={stakeUnits()}
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
                    <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>
                      {stakeHint()}
                      {onSetUnitSize && (
                        <>
                          {' · '}
                          <button type="button" className="linklike" onClick={() => setEditUnit((v) => !v)}>
                            {editUnit ? 'Done' : 'Change unit size'}
                          </button>
                        </>
                      )}
                    </div>
                    {onSetUnitSize && editUnit && (
                      <div className="row" style={{ gap: 8, marginTop: 8, alignItems: 'center' }}>
                        <span className="muted" style={{ fontSize: 13 }}>1 unit =</span>
                        <span className="muted" style={{ fontWeight: 700 }}>{currencySymbol(currency)}</span>
                        <input
                          type="number" min="0.01" step="0.01" defaultValue={unitSize || ''}
                          aria-label="Set unit size"
                          onChange={(e) => {
                            const v = Number(e.target.value) || 0;
                            // Keep the selected preset unit and rescale the money,
                            // so "1u" stays 1u and the stake follows the new size.
                            const cur = stakeUnits();
                            if (cur !== '' && !usesUnits) set('stake', String(Math.round(Number(cur) * v * 100) / 100));
                            onSetUnitSize(v);
                          }}
                          style={{ width: 110 }}
                          autoFocus
                        />
                      </div>
                    )}
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
              <label>Payout / Return{unitLabel}</label>
              <input
                type="number" step="0.01" min="0" value={form.payout ?? ''}
                onChange={(e) => { set('payout', e.target.value); setPayoutTouched(e.target.value !== ''); }}
                aria-label="Payout or return"
              />
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
