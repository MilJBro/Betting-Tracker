import { createContext, useContext, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useSettings } from './SettingsContext.jsx';
import { useTracker } from './TrackerContext.jsx';
import { useToast } from './ToastContext.jsx';
import BetForm from '../components/BetForm.jsx';
import Spinner from '../components/Spinner.jsx';
import { usePlan } from '../usePlan.js';
import { scanBetSlip } from '../scan.js';
import { getCached, invalidateData } from '../dataCache.js';

// A starter list so common sports (incl. horse racing) are always offered on
// the Add-bet form, even on a fresh account. Kept in sync with Bets.jsx.
const COMMON_SPORTS = [
  'Football', 'Horse Racing', 'Greyhounds', 'Tennis', 'Basketball', 'Cricket',
  'Golf', 'Boxing', 'MMA / UFC', 'Rugby', 'Darts', 'Snooker',
  'American Football', 'Baseball', 'Ice Hockey', 'Motorsport', 'Esports',
];

const AddBetContext = createContext(null);
export const useAddBet = () => useContext(AddBetContext);

// Renders the Add-bet slip as an app-level overlay so it opens over whichever
// tab you're on — no navigating to My bets and back. On save it invalidates the
// cached data so the tab you're on refreshes to include the new bet.
export function AddBetProvider({ children }) {
  const { settings, update: updateSettings } = useSettings();
  const { activeId } = useTracker();
  const toast = useToast();
  const navigate = useNavigate();
  const { ent } = usePlan();
  const aiEnabled = ent?.ai?.enabled !== false; // show unless the server says it's off

  const [open, setOpen] = useState(false);
  const [bets, setBets] = useState([]);
  const [scanning, setScanning] = useState(false);
  const [initialBet, setInitialBet] = useState(null);
  const [formKey, setFormKey] = useState(0); // bump to remount the form with a new pre-fill
  const lastDateRef = useRef('');
  const scanInputRef = useRef(null);

  const openAddBet = () => {
    setInitialBet(null);
    // Seed autocomplete from cache instantly, then refresh from the server.
    setBets(getCached('bets:' + activeId)?.bets || []);
    if (activeId) api.get(`/bets?tracker=${activeId}`).then((d) => setBets(d.bets)).catch(() => {});
    setOpen(true);
  };
  const close = () => { setOpen(false); setInitialBet(null); };

  // A scanned bet was read: re-mount the slip pre-filled with the extracted
  // fields for the user to confirm. We keep the detected bet type (single /
  // bet builder / accumulator) accurate and build the legs so a bet builder
  // doesn't get flattened into a single.
  const applyParsed = (bet) => {
    const clean = { ...bet };
    // The tipster's stake/unit is their own and may differ from the user's, so
    // leave the stake (and the return derived from it) blank for the user to
    // fill — the Return recalculates from their stake, boost included.
    clean.stake = '';
    clean.payout = '';
    // Normalise the various names for a multiple to the app's "Accumulator".
    if (['Double', 'Treble', 'Fourfold', 'Fivefold', 'Multiple', 'Acca'].includes(clean.bet_type)) {
      clean.bet_type = 'Accumulator';
    }
    const isMulti = clean.bet_type === 'Accumulator' || clean.bet_type === 'Bet builder';

    // Prefer the model's per-leg breakdown; otherwise recover legs from the
    // joined selection ("A / B / C") the scanner produces for multiples.
    let legs = Array.isArray(clean.legs)
      ? clean.legs
          .map((l) => ({ selection: (l.selection || '').trim(), odds: Number(l.odds) || 0 }))
          .filter((l) => l.selection)
      : [];
    if (isMulti && legs.length < 2 && typeof clean.selection === 'string' && clean.selection.includes(' / ')) {
      legs = clean.selection
        .split(' / ')
        .map((s) => ({ selection: s.trim(), odds: 0 }))
        .filter((l) => l.selection);
    }

    if (isMulti && legs.length >= 2) {
      // An accumulator is priced from its per-leg odds. If the slip only showed
      // the combined price, park it on the first leg so the product still
      // equals the shown odds and nothing is lost when saved.
      if (
        clean.bet_type === 'Accumulator' &&
        Number(clean.odds) > 1 &&
        !legs.some((l) => l.odds > 1)
      ) {
        legs = legs.map((l, i) => (i === 0 ? { ...l, odds: Number(clean.odds) } : l));
      }
      clean.legs = legs;
    } else {
      // Not enough to build a multiple — fall back to a single so the odds and
      // selection stay put rather than opening an empty multi-leg form.
      delete clean.legs;
      if (isMulti) clean.bet_type = '';
    }

    setInitialBet(clean);
    setFormKey((k) => k + 1);
  };

  // Scan a bet-slip screenshot/photo into a pre-filled slip.
  const triggerScan = () => scanInputRef.current?.click();
  async function onScanFile(e) {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow picking the same file again later
    if (!file) return;
    setScanning(true);
    try {
      const res = await scanBetSlip(file);
      applyParsed(res.bet);
      toast('Scan A Bet', 'success');
    } catch (err) {
      if (err?.data?.upgrade || err?.status === 402) {
        close(); navigate('/account');
        toast(err.message || 'You’ve used all your free reads this month.', 'error');
      } else if (!err?.status || /load failed|failed to fetch|network/i.test(err?.message || '')) {
        // No HTTP response at all — a connection/timeout issue (often the server
        // waking up). A second try usually goes through.
        toast('Couldn’t reach the server — check your connection and try again.', 'error');
      } else {
        toast(err?.message || 'Couldn’t read that bet — try a clearer screenshot.', 'error');
      }
    } finally {
      setScanning(false);
    }
  }

  async function save(form) {
    try {
      await api.post('/bets', { ...form, tracker_id: activeId });
    } catch (e) {
      toast(e.message, 'error');
      throw e; // keep the form open so the user can retry
    }
    toast('Bet added', 'success');
    if (form.placed_at) lastDateRef.current = form.placed_at; // next new bet keeps this date
    invalidateData(); // refresh whatever tab is on screen
  }

  const bookmakers = useMemo(
    () => [...new Set(bets.map((b) => b.bookmaker).filter(Boolean))].sort(),
    [bets]
  );
  // Sports you've used, seeded with the common list + your onboarding picks.
  const sportSuggestions = useMemo(() => {
    const picked = Array.isArray(settings?.profile?.sports) ? settings.profile.sports : [];
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
    return out;
  }, [settings, bets]);

  return (
    <AddBetContext.Provider value={{ openAddBet }}>
      {children}
      {open && settings && (
        <BetForm
          key={formKey}
          initial={initialBet}
          isEdit={false}
          onScan={aiEnabled ? triggerScan : undefined}
          fields={settings.fields || {}}
          staking={settings.staking}
          currency={settings.currency}
          oddsFormat={settings.oddsFormat || 'decimal'}
          defaults={settings.defaults}
          bookmakers={bookmakers}
          sports={sportSuggestions}
          bets={bets}
          defaultDate={lastDateRef.current}
          onSetUnitSize={(v) => updateSettings({ staking: { ...settings.staking, unitSize: v } })}
          onToggleField={(k, v) => updateSettings({ fields: { ...settings.fields, [k]: v } })}
          onSave={save}
          onClose={close}
        />
      )}
      {/* Hidden picker for "Scan a photo" — no `capture` so iOS offers Photo
          Library (for saved tipster screenshots) as well as the camera. */}
      <input ref={scanInputRef} type="file" accept="image/*" onChange={onScanFile} hidden />
      {scanning && createPortal(
        <div className="modal-overlay" style={{ alignItems: 'center' }}>
          <div className="scan-loading"><Spinner /><span>Reading your bet slip…</span></div>
        </div>,
        document.body
      )}
    </AddBetContext.Provider>
  );
}
