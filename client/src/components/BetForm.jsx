import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { currencySymbol, money, formatOdds, parseOdds } from '../format.js';
import Icon from './Icon.jsx';

const STATUS_OPTIONS = ['pending', 'won', 'lost', 'void', 'cashout'];
// Each-way place-terms fractions (the place part pays at this fraction of odds).
const EW_FRACTIONS = ['1/5', '1/4', '1/3', '1/2', '1/6'];
const fractionValue = (frac) => {
  const [a, b] = String(frac || '1/5').split('/').map(Number);
  return b > 0 ? a / b : 0.2;
};
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
  each_way: false,
  ew_fraction: '1/5',
  ew_places: '',
  boost: 0, // winnings boost fraction (e.g. 0.25 = +25% on the profit)
});

// Winnings-boost options offered near the Return field (e.g. bet365's 25% / 50%
// bet builder boost). Stored as a fraction of the profit to add.
const BOOSTS = [
  { v: 0, label: 'None' },
  { v: 0.25, label: '+25%' },
  { v: 0.3, label: '+30%' },
  { v: 0.5, label: '+50%' },
];

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

// Fields the user can show/hide from the slip's own "Edit fields" panel. Stake
// and Status stay on (a bet needs them); Date and Sport are always shown too.
const EDITABLE_FIELDS = [
  { key: 'event', label: 'Event' },
  { key: 'selection', label: 'Selection' },
  { key: 'odds', label: 'Odds' },
  { key: 'bookmaker', label: 'Bookmaker' },
  { key: 'tipster', label: 'Tipster' },
  { key: 'payout', label: 'Return' },
  { key: 'tags', label: 'Tags' },
];

export default function BetForm({ initial, isEdit, onScan, fields, staking, currency, oddsFormat = 'decimal', defaults, bookmakers = [], sports = [], bets = [], defaultDate, onSetUnitSize, onToggleField, onSave, onClose }) {
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
    if (initial) {
      // Show a saved bet's odds back in the user's chosen format for editing.
      f.odds = Number(initial.odds) > 0 ? formatOdds(initial.odds, oddsFormat) : '';
      f.each_way = !!initial.each_way;
      f.ew_fraction = initial.ew_fraction || '1/5';
      f.ew_places = initial.ew_places != null && initial.ew_places !== '' ? String(initial.ew_places) : '';
      f.boost = Number(initial.boost) || 0;
      // The stake box shows the per-part stake; each-way stores the doubled total.
      const totalMoney = Number(initial.stake) || 0;
      const perPartMoney = f.each_way ? totalMoney / 2 : totalMoney;
      if (usesUnits) {
        f.stake = initial.stake ? toUnits(perPartMoney) : '';
        f.payout = initial.payout != null && initial.payout !== '' ? toUnits(initial.payout) : f.payout;
      } else {
        f.stake = initial.stake ? String(Math.round(perPartMoney * 100) / 100) : '';
      }
    }
    return f;
  });

  // Single / accumulator / bet builder. Legs carry the selections; an acca also
  // keeps per-leg odds, a builder is priced as one combined figure.
  const initialLegs = Array.isArray(initial?.legs) ? initial.legs : [];
  const [kind, setKind] = useState(
    initial?.bet_type === 'Bet builder' ? 'builder'
    : initialLegs.length >= 2 || initial?.bet_type === 'Accumulator' ? 'acca'
    : 'single'
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
  // Each-way (Win + Place) applies to racing and other field sports (e.g. golf).
  const ewEligible = layout === 'racing' || layout === 'field';
  const eachWay = !!form.each_way && ewEligible;
  const statusOptions = eachWay
    ? ['pending', 'won', 'placed', 'lost', 'void', 'cashout']
    : STATUS_OPTIONS;

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

  // The note under the payout box, showing the return in both money and units.
  const payoutHint = () => {
    const n = Number(form.payout);
    if (form.payout === '' || form.payout == null || !(n > 0) || unitSize <= 0) return '';
    return usesUnits
      ? `${n}u = ${money(n * unitSize, currency)}`
      : `${money(n, currency)} = ${Math.round((n / unitSize) * 100) / 100}u`;
  };

  // The note under the each-way controls: total outlay (both parts) and terms.
  const ewHint = () => {
    const p = Number(form.stake);
    if (!(p > 0)) return 'Stakes a Win part and a Place part — total outlay is 2× your stake.';
    const perPartMoney = usesUnits ? p * unitSize : p;
    return `Total outlay ${money(perPartMoney * 2, currency)} — ${money(perPartMoney, currency)} win + ${money(perPartMoney, currency)} place. Place pays at ${form.ew_fraction} of the odds.`;
  };

  const [tagInput, setTagInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [fieldsEditing, setFieldsEditing] = useState(false);

  // Once the user edits the payout themselves, stop auto-filling it.
  const [payoutTouched, setPayoutTouched] = useState(
    () => !!(initial && initial.payout != null && initial.payout !== '')
  );
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const show = (k) => fields[k] !== false;
  const unitLabel = usesUnits ? ' (units)' : '';

  const accaOdds = useMemo(() => combinedOdds(legs, oddsFormat), [legs, oddsFormat]);

  // Auto-fill the payout (return) as the user types, until they edit the payout
  // box themselves. Stake and payout share the same unit (money or units), so
  // odds is a plain multiplier. For an each-way bet the stake box holds the
  // per-part stake and the return depends on the outcome:
  //   won    → Win part (stake × odds) + Place part (stake × place odds)
  //   placed → Place part only            void/pending → the full-win figure
  useEffect(() => {
    if (payoutTouched) return;
    const d = kind === 'acca' ? accaOdds : parseOdds(form.odds, oddsFormat);
    const p = Number(form.stake); // per-part stake (or plain stake when not each-way)
    let next = '';
    if (d > 0 && p > 0) {
      if (eachWay && kind === 'single') {
        const placeMult = 1 + (d - 1) * fractionValue(form.ew_fraction);
        const winReturn = p * d;
        const placeReturn = p * placeMult;
        const ret =
          form.status === 'placed' ? placeReturn
          : form.status === 'lost' ? 0
          : winReturn + placeReturn; // won, and the potential return otherwise
        next = String(Math.round(ret * 100) / 100);
      } else {
        // A winnings boost adds to the profit part only (stake back unchanged).
        const boost = Number(form.boost) || 0;
        const ret = p + (p * d - p) * (1 + boost);
        next = String(Math.round(ret * 100) / 100);
      }
    }
    setForm((f) => (f.payout === next ? f : { ...f, payout: next }));
  }, [form.stake, form.odds, form.status, form.ew_fraction, form.boost, eachWay, kind, accaOdds, oddsFormat, payoutTouched]);

  const setLeg = (i, k, v) => setLegs((ls) => ls.map((l, j) => (j === i ? { ...l, [k]: v } : l)));
  const addLeg = () => setLegs((ls) => [...ls, { selection: '', odds: '' }]);
  const removeLeg = (i) => setLegs((ls) => (ls.length > 1 ? ls.filter((_, j) => j !== i) : ls));

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { ...form };
      // Each-way stakes a Win and a Place part, so the total outlay is 2× the
      // per-part stake shown in the box. Payout already covers both parts.
      const isEW = eachWay && kind === 'single';
      const scale = usesUnits ? unitSize : 1;
      if (form.stake !== '' && form.stake != null) {
        payload.stake = Number(form.stake) * (isEW ? 2 : 1) * scale;
      }
      if (form.payout !== '' && form.payout != null) {
        payload.payout = Number(form.payout) * scale;
      }
      payload.each_way = isEW;
      payload.ew_fraction = isEW ? form.ew_fraction : null;
      payload.ew_places = isEW && form.ew_places !== '' ? Number(form.ew_places) : null;
      payload.boost = Number(form.boost) || 0; // winnings boost applied to the return
      const eventFor = () =>
        layout === 'racing' ? composeRace()
        : versus ? composeEvent()
        : (form.event || '').trim();
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
      } else if (kind === 'builder') {
        // Multiple selections on one game, priced as a single combined figure.
        const cleaned = legs
          .map((l) => ({ selection: l.selection.trim(), odds: 0 }))
          .filter((l) => l.selection);
        payload.legs = cleaned;
        payload.bet_type = 'Bet builder';
        payload.odds = parseOdds(form.odds, oddsFormat);
        payload.event = eventFor();
        payload.selection = ''; // server builds a summary from the selections
      } else {
        payload.legs = [];
        payload.bet_type = 'Single';
        payload.odds = parseOdds(form.odds, oddsFormat);
        payload.event = eventFor();
      }
      await onSave(payload);
      onClose();
    } finally {
      setSaving(false);
    }
  }

  // Keep the sheet fitted to the VISIBLE viewport (above the on-screen
  // keyboard). iOS shrinks the visual viewport when the keyboard opens but not
  // the layout viewport, so a vh-sized fixed sheet would hide its bottom (the
  // Add button) behind the keyboard with no way to scroll to it. Sizing the
  // overlay to visualViewport.height makes the sheet's own scroll reveal it.
  const overlayRef = useRef(null);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const apply = () => {
      const el = overlayRef.current;
      if (!el) return;
      el.style.height = `${vv.height}px`;
      el.style.top = `${vv.offsetTop}px`;
    };
    apply();
    vv.addEventListener('resize', apply);
    vv.addEventListener('scroll', apply);
    return () => {
      vv.removeEventListener('resize', apply);
      vv.removeEventListener('scroll', apply);
    };
  }, []);

  // Bring the field you tap into view within the sheet once the keyboard is up.
  const onFieldFocus = (e) => {
    const t = e.target;
    if (!t.matches || !t.matches('input, select, textarea')) return;
    setTimeout(() => t.scrollIntoView({ block: 'center', behavior: 'smooth' }), 120);
  };

  function addTag() {
    const t = tagInput.trim();
    if (t && !form.tags.includes(t)) set('tags', [...form.tags, t]);
    setTagInput('');
  }

  // Wipe the slip back to a fresh blank bet (keeping the user's defaults), for
  // when you've filled it out but need to start over.
  function clearForm() {
    const base = blank();
    if (defaultDate) base.placed_at = defaultDate;
    if (defaults?.stake !== '' && defaults?.stake != null) base.stake = String(defaults.stake);
    if (defaults?.bookmaker) base.bookmaker = defaults.bookmaker;
    setForm(base);
    setLegs([{ selection: '', odds: '' }, { selection: '', odds: '' }]);
    setKind('single');
    setHome(''); setAway(''); setCourse(''); setRaceTime('');
    setOtherSport(false);
    setTagInput('');
    setPayoutTouched(false);
  }

  return createPortal(
    <div className="modal-overlay" ref={overlayRef} onMouseDown={onClose}>
      <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="row spread" style={{ marginBottom: 12 }}>
          <h2 style={{ margin: 0, fontSize: 20 }}>{isEdit ? 'Edit bet' : 'Add a bet'}</h2>
          <div className="row" style={{ gap: 6 }}>
            {onToggleField && (
              <button
                className={fieldsEditing ? 'btn-accent btn-sm' : 'btn-ghost btn-sm'}
                type="button"
                onClick={() => setFieldsEditing((v) => !v)}
              >
                {fieldsEditing ? 'Done' : 'Edit fields'}
              </button>
            )}
            <button className="btn-ghost btn-sm" type="button" onClick={onClose} aria-label="Close">✕</button>
          </div>
        </div>

        {!isEdit && onScan && (
          <div className="auto-add">
            <div className="auto-add-btns">
              <button type="button" className="auto-add-btn" onClick={onScan}>
                <Icon name="camera" size={15} />
                <span>Scan a bet</span>
              </button>
            </div>
          </div>
        )}

        {fieldsEditing && onToggleField && (
          <div className="field-editor">
            <div className="muted" style={{ fontSize: 12.5, marginBottom: 8 }}>
              Tap to choose what shows when adding a bet — saved for next time.
            </div>
            <div className="ftog-row">
              {EDITABLE_FIELDS.map(({ key, label }) => {
                const on = fields[key] !== false;
                return (
                  <button
                    key={key}
                    type="button"
                    className={on ? 'ftog on' : 'ftog'}
                    aria-pressed={on}
                    onClick={() => onToggleField(key, !on)}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <form onSubmit={submit} className="betform" onFocusCapture={onFieldFocus}>
          <div className="grid-2 betgrid">
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

          {/* Bet kind: single, accumulator or bet builder */}
          <div className="field">
            <label>Bet type</label>
            <div className="seg-group">
              <button type="button" className={kind === 'single' ? 'seg on' : 'seg'} onClick={() => setKind('single')}>Single</button>
              <button type="button" className={kind === 'acca' ? 'seg on' : 'seg'} onClick={() => setKind('acca')}>Accumulator</button>
              <button type="button" className={kind === 'builder' ? 'seg on' : 'seg'} onClick={() => setKind('builder')}>Bet builder</button>
            </div>
          </div>

          {/* Event — a single and a bet builder are both on one game */}
          {kind !== 'acca' && show('event') && (
            layout === 'racing' ? (
              <div className="grid-2 betgrid">
                <div className="field">
                  <label>Course / track</label>
                  <input value={course} onChange={(e) => setCourse(e.target.value)} aria-label="Course or track" autoComplete="off" />
                </div>
                <div className="field">
                  <label>Time <span className="muted" style={{ fontWeight: 400 }}>(optional)</span></label>
                  <input type="time" value={raceTime} onChange={(e) => setRaceTime(e.target.value)} aria-label="Race time" />
                </div>
              </div>
            ) : versus ? (
              <div className="field">
                <label>{kind === 'builder' ? 'Game' : 'Event'}</label>
                <div className="team-vs">
                  <input value={home} onChange={(e) => setHome(e.target.value)} aria-label="Home team" autoComplete="off" />
                  <span className="vs">v</span>
                  <input value={away} onChange={(e) => setAway(e.target.value)} aria-label="Away team" autoComplete="off" />
                </div>
              </div>
            ) : (
              <div className="field">
                <label>{kind === 'builder' ? 'Game / event' : 'Event / tournament'} <span className="muted" style={{ fontWeight: 400 }}>(optional)</span></label>
                <input value={form.event} onChange={(e) => set('event', e.target.value)} aria-label="Event or race" autoComplete="off" />
              </div>
            )
          )}

          {kind === 'single' && (
            <>
              <div className="grid-2 sel-odds">
                {show('selection') && (
                  <div className="field">
                    <label>{layout === 'racing' ? 'Horse / runner' : versus ? 'Selection' : 'Your selection'}</label>
                    <input value={form.selection} onChange={(e) => set('selection', e.target.value)} aria-label="Selection" autoComplete="off" />
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
              </div>
              {ewEligible && (
                <div className="field">
                  <label className="row" style={{ gap: 8, alignItems: 'center', cursor: 'pointer', marginBottom: 0 }}>
                    <input
                      type="checkbox"
                      checked={form.each_way}
                      onChange={(e) => set('each_way', e.target.checked)}
                      aria-label="Each-way"
                      style={{ width: 'auto', margin: 0 }}
                    />
                    <span>Each-way <span className="muted" style={{ fontWeight: 400 }}>(Win + Place)</span></span>
                  </label>
                  {eachWay && (
                    <>
                      <div className="grid-2" style={{ marginTop: 10 }}>
                        <div className="field" style={{ margin: 0 }}>
                          <label>Place terms</label>
                          <select value={form.ew_fraction} onChange={(e) => set('ew_fraction', e.target.value)} aria-label="Place terms fraction">
                            {EW_FRACTIONS.map((fr) => <option key={fr} value={fr}>{fr} odds</option>)}
                          </select>
                        </div>
                        <div className="field" style={{ margin: 0 }}>
                          <label>Places <span className="muted" style={{ fontWeight: 400 }}>(optional)</span></label>
                          <input type="number" min="1" step="1" value={form.ew_places} onChange={(e) => set('ew_places', e.target.value)} aria-label="Number of places" placeholder="e.g. 4" />
                        </div>
                      </div>
                      <div className="muted" style={{ fontSize: 11, marginTop: 6 }}>{ewHint()}</div>
                    </>
                  )}
                </div>
              )}
            </>
          )}

          {kind === 'builder' && (
            <>
              <div className="field">
                <label>Selections <span className="muted" style={{ fontWeight: 400 }}>(same game)</span></label>
                <div className="legs">
                  {legs.map((l, i) => (
                    <div className="leg-row builder-leg" key={i}>
                      <input
                        className="leg-sel"
                        value={l.selection}
                        onChange={(e) => setLeg(i, 'selection', e.target.value)}
                        aria-label={`Selection ${i + 1}`}
                        autoComplete="off"
                      />
                      <button
                        type="button" className="btn-ghost btn-sm leg-x"
                        onClick={() => removeLeg(i)} disabled={legs.length <= 1} title="Remove"
                      >✕</button>
                    </div>
                  ))}
                </div>
                <div className="row spread" style={{ marginTop: 6, alignItems: 'center', gap: 10 }}>
                  <button type="button" className="btn-ghost btn-sm" onClick={addLeg}>+ Add selection</button>
                  {show('odds') && (
                    <div className="row" style={{ gap: 8, alignItems: 'center' }}>
                      <span className="muted" style={{ fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap' }}>Combined odds</span>
                      <input
                        type={oddsFormat === 'decimal' ? 'number' : 'text'}
                        {...(oddsFormat === 'decimal' ? { step: '0.01', min: '0' } : {})}
                        inputMode={oddsFormat === 'decimal' ? 'decimal' : 'text'}
                        value={form.odds}
                        onChange={(e) => set('odds', e.target.value)}
                        aria-label="Combined odds"
                        autoComplete="off"
                        style={{ width: 84 }}
                      />
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {kind === 'acca' && (
            <div className="field">
              <label>Selections</label>
              <div className="legs">
                {legs.map((l, i) => (
                  <div className="leg-row" key={i}>
                    <input
                      className="leg-sel"
                      value={l.selection}
                      onChange={(e) => setLeg(i, 'selection', e.target.value)}
                      aria-label={`Selection ${i + 1}`}
                      autoComplete="off"
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
                value={form.bookmaker}
                onChange={(e) => set('bookmaker', e.target.value)}
                aria-label="Bookmaker"
                autoComplete="off"
              />
            </div>
          )}

          {show('tipster') && (
            <div className="field">
              <label>Tipster</label>
              <input value={form.tipster} onChange={(e) => set('tipster', e.target.value)} aria-label="Tipster" />
            </div>
          )}

          {show('stake') && (
              <div className="field">
                <label>Stake{unitLabel}{eachWay ? <span className="muted" style={{ fontWeight: 400 }}> · per part</span> : ''}</label>
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
            <div className="grid-2 betgrid">
              {show('status') && (
                <div className="field">
                  <label>Status</label>
                  <select value={form.status} onChange={(e) => set('status', e.target.value)} aria-label="Status">
                    {statusOptions.map((s) => (
                      <option key={s} value={s}>{s[0].toUpperCase() + s.slice(1)}</option>
                    ))}
                  </select>
                </div>
              )}
              {show('payout') && (
                <div className="field">
                  <label>Return{unitLabel}</label>
                  {usesUnits ? (
                    <input
                      type="number" step="0.01" min="0" value={form.payout ?? ''}
                      onChange={(e) => { set('payout', e.target.value); setPayoutTouched(e.target.value !== ''); }}
                      aria-label="Payout or return"
                    />
                  ) : (
                    <div className="row" style={{ gap: 8, alignItems: 'center' }}>
                      <span className="muted" style={{ fontWeight: 700 }}>{currencySymbol(currency)}</span>
                      <input
                        type="number" step="0.01" min="0" value={form.payout ?? ''}
                        onChange={(e) => { set('payout', e.target.value); setPayoutTouched(e.target.value !== ''); }}
                        aria-label="Payout or return"
                        style={{ flex: 1 }}
                      />
                    </div>
                  )}
                  {payoutHint() && (
                    <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>{payoutHint()}</div>
                  )}
                </div>
              )}
            </div>

          {show('payout') && (
            <div className="field">
              <label>Winnings boost</label>
              <div className="seg-group">
                {BOOSTS.map((b) => (
                  <button
                    key={b.v}
                    type="button"
                    className={(Number(form.boost) || 0) === b.v ? 'seg on' : 'seg'}
                    onClick={() => { set('boost', b.v); setPayoutTouched(false); }}
                  >
                    {b.label}
                  </button>
                ))}
              </div>
              {(Number(form.boost) || 0) > 0 && (
                <div className="muted" style={{ fontSize: 11, marginTop: 6 }}>
                  +{Math.round((Number(form.boost) || 0) * 100)}% added to your winnings — the Return above includes it.
                </div>
              )}
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

          <div className="row spread" style={{ marginTop: 8 }}>
            {!isEdit ? (
              <button type="button" className="btn-ghost" onClick={clearForm}>Clear</button>
            ) : <span />}
            <div className="row" style={{ gap: 8 }}>
              <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
              <button type="submit" className="btn-primary" disabled={saving}>
                {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Add bet'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
