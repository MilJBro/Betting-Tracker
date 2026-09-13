import { createContext, useContext, useMemo, useRef, useState } from 'react';
import { api } from '../api.js';
import { useSettings } from './SettingsContext.jsx';
import { useTracker } from './TrackerContext.jsx';
import { useToast } from './ToastContext.jsx';
import BetForm from '../components/BetForm.jsx';
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

  const [open, setOpen] = useState(false);
  const [template, setTemplate] = useState(null);
  const [bets, setBets] = useState([]);
  const lastDateRef = useRef('');

  const openAddBet = (opts = {}) => {
    setTemplate(opts.template || null);
    // Seed autocomplete from cache instantly, then refresh from the server.
    setBets(getCached('bets:' + activeId)?.bets || []);
    if (activeId) api.get(`/bets?tracker=${activeId}`).then((d) => setBets(d.bets)).catch(() => {});
    setOpen(true);
  };
  const close = () => { setOpen(false); setTemplate(null); };

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

  const templates = Array.isArray(settings?.templates) ? settings.templates : [];
  const saveTemplate = (data) => {
    const id = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : String(Date.now());
    updateSettings({ templates: [...templates, { id, ...data }] });
    toast(`Template "${data.name}" saved`, 'success');
  };

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
          initial={null}
          isEdit={false}
          fields={settings.fields || {}}
          staking={settings.staking}
          currency={settings.currency}
          oddsFormat={settings.oddsFormat || 'decimal'}
          defaults={settings.defaults}
          bookmakers={bookmakers}
          sports={sportSuggestions}
          bets={bets}
          template={template}
          onSaveTemplate={saveTemplate}
          defaultDate={lastDateRef.current}
          onSetUnitSize={(v) => updateSettings({ staking: { ...settings.staking, unitSize: v } })}
          onToggleField={(k, v) => updateSettings({ fields: { ...settings.fields, [k]: v } })}
          onSave={save}
          onClose={close}
        />
      )}
    </AddBetContext.Provider>
  );
}
