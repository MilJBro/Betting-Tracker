import { useState } from 'react';
import { api } from '../api.js';
import BrandMark from '../components/BrandMark.jsx';
import { useSettings } from '../context/SettingsContext.jsx';

// One-time questionnaire shown right after sign-up to learn what kind of
// bettor someone is, then tailor Betbooks to them.
const SPORTS = ['Football', 'Horse Racing', 'Tennis', 'Basketball', 'Cricket', 'Golf', 'Esports', 'Other'];

const STEPS = [
  {
    key: 'trackingStyle',
    title: 'How do you bet?',
    subtitle: "This helps us set Betbooks up around the way you bet.",
    type: 'single',
    options: [
      { value: 'own', label: 'I track my own bets', desc: 'Your own picks and research.' },
      { value: 'tipster', label: 'I follow tipsters', desc: "You bet on other people's tips." },
      { value: 'both', label: 'A bit of both', desc: 'Your own bets and tipster tips.' },
    ],
  },
  {
    key: 'sports',
    title: 'What do you mostly bet on?',
    subtitle: 'Pick any that apply.',
    type: 'multi',
    options: SPORTS.map((s) => ({ value: s, label: s })),
  },
  {
    key: 'frequency',
    title: 'How often do you bet?',
    type: 'single',
    options: [
      { value: 'daily', label: 'Most days' },
      { value: 'weekly', label: 'A few times a week' },
      { value: 'occasional', label: 'Now and then' },
    ],
  },
  {
    key: 'goal',
    title: "What's your main goal?",
    type: 'single',
    options: [
      { value: 'profit', label: 'Make a long-term profit' },
      { value: 'discipline', label: 'Stay disciplined with my staking' },
      { value: 'analyse', label: 'Understand my performance' },
      { value: 'fun', label: 'Just track it for fun' },
    ],
  },
  {
    key: 'experience',
    title: 'How would you describe yourself?',
    type: 'single',
    options: [
      { value: 'new', label: 'New to betting' },
      { value: 'casual', label: 'Casual bettor' },
      { value: 'experienced', label: 'Experienced' },
      { value: 'serious', label: 'Serious / semi-pro' },
    ],
  },
  { key: 'prefs', title: 'Last thing — a couple of preferences', type: 'prefs' },
];

export default function Onboarding() {
  const { settings, save } = useSettings();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState({
    trackingStyle: '', sports: [], frequency: '', goal: '', experience: '',
  });
  const [prefs, setPrefs] = useState({
    currency: settings?.currency || 'GBP',
    oddsFormat: settings?.oddsFormat || 'decimal',
    bankroll: settings?.bankroll?.starting || '',
  });
  const [saving, setSaving] = useState(false);

  const s = STEPS[step];
  const isLast = step === STEPS.length - 1;

  function pickSingle(key, value) {
    setAnswers((a) => ({ ...a, [key]: value }));
    setTimeout(() => setStep((n) => Math.min(n + 1, STEPS.length - 1)), 120);
  }
  function toggleMulti(key, value) {
    setAnswers((a) => {
      const cur = a[key] || [];
      return { ...a, [key]: cur.includes(value) ? cur.filter((x) => x !== value) : [...cur, value] };
    });
  }

  async function finish(skip = false) {
    setSaving(true);
    const a = answers;
    const followsTipster = a.trackingStyle === 'tipster' || a.trackingStyle === 'both';
    const next = {
      ...settings,
      currency: skip ? settings.currency : prefs.currency,
      oddsFormat: skip ? settings.oddsFormat : prefs.oddsFormat,
      bankroll: { ...settings.bankroll, starting: skip ? (settings.bankroll?.starting || 0) : (Number(prefs.bankroll) || 0) },
      // Turn the tipster field on automatically for people who follow tipsters.
      fields: { ...settings.fields, tipster: followsTipster || settings.fields.tipster },
      profile: {
        ...settings.profile,
        onboarded: true,
        trackingStyle: a.trackingStyle,
        sports: a.sports,
        frequency: a.frequency,
        goal: a.goal,
        experience: a.experience,
      },
    };
    try {
      await save(next);
      // Bankroll is per-tracker — seed the account's first (default) tracker.
      const bk = skip ? 0 : (Number(prefs.bankroll) || 0);
      if (bk > 0) {
        const d = await api.get('/trackers').catch(() => null);
        const first = d?.trackers?.[0];
        if (first) await api.put(`/trackers/${first.id}`, { bankroll_start: bk }).catch(() => {});
      }
    } finally {
      setSaving(false);
    }
  }

  const canContinue =
    s.type === 'multi' ? (answers[s.key] || []).length > 0 : true;

  return (
    <div className="auth-wrap">
      <div className="onboard">
        <div className="brand" style={{ justifyContent: 'center', marginBottom: 18 }}>
          <BrandMark /> Betbooks
        </div>

        <div className="onboard-progress">
          {STEPS.map((_, i) => (
            <span key={i} className={`dot ${i <= step ? 'on' : ''}`} />
          ))}
        </div>

        <div className="card">
          <div className="muted" style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Step {step + 1} of {STEPS.length}
          </div>
          <h2 style={{ margin: '6px 0 4px', fontSize: 22 }}>{s.title}</h2>
          {s.subtitle && <p className="muted" style={{ margin: '0 0 16px', fontSize: 14 }}>{s.subtitle}</p>}
          {!s.subtitle && <div style={{ height: 10 }} />}

          {s.type === 'single' && (
            <div className="stack" style={{ gap: 10 }}>
              {s.options.map((o) => (
                <button
                  key={o.value}
                  className={`opt-btn ${answers[s.key] === o.value ? 'sel' : ''}`}
                  onClick={() => pickSingle(s.key, o.value)}
                >
                  <span className="opt-label">{o.label}</span>
                  {o.desc && <span className="opt-desc">{o.desc}</span>}
                </button>
              ))}
            </div>
          )}

          {s.type === 'multi' && (
            <div className="chip-grid">
              {s.options.map((o) => {
                const on = (answers[s.key] || []).includes(o.value);
                return (
                  <button key={o.value} className={`chip-btn ${on ? 'sel' : ''}`} onClick={() => toggleMulti(s.key, o.value)}>
                    {o.label}
                  </button>
                );
              })}
            </div>
          )}

          {s.type === 'prefs' && (
            <div className="grid-2">
              <div className="field">
                <label>Currency</label>
                <select value={prefs.currency} onChange={(e) => setPrefs({ ...prefs, currency: e.target.value })}>
                  {['GBP', 'USD', 'EUR', 'AUD', 'CAD'].map((c) => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div className="field">
                <label>Odds format</label>
                <select value={prefs.oddsFormat} onChange={(e) => setPrefs({ ...prefs, oddsFormat: e.target.value })}>
                  <option value="decimal">Decimal (2.50)</option>
                  <option value="fractional">Fractional (6/4)</option>
                  <option value="american">American (+150)</option>
                </select>
              </div>
              <div className="field">
                <label>Starting bankroll <span className="muted" style={{ fontWeight: 400 }}>(optional)</span></label>
                <input type="number" min="0" step="0.01" value={prefs.bankroll} placeholder="e.g. 500" onChange={(e) => setPrefs({ ...prefs, bankroll: e.target.value })} />
              </div>
            </div>
          )}

          <div className="row spread" style={{ marginTop: 20 }}>
            <button className="btn-ghost btn-sm" onClick={() => (step === 0 ? finish(true) : setStep(step - 1))} disabled={saving}>
              {step === 0 ? 'Skip' : '← Back'}
            </button>
            {isLast ? (
              <button className="btn-primary" onClick={() => finish(false)} disabled={saving}>
                {saving ? 'Setting up…' : 'Finish'}
              </button>
            ) : s.type !== 'single' ? (
              <button className="btn-primary" onClick={() => setStep(step + 1)} disabled={!canContinue}>Continue</button>
            ) : (
              <span style={{ fontSize: 12 }} className="muted">Tap an option to continue</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
