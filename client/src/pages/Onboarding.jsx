import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { currencySymbol } from '../format.js';
import Logo from '../components/Logo.jsx';
import Icon from '../components/Icon.jsx';
import { useSettings } from '../context/SettingsContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';

// A short, friendly first-run flow: a warm welcome, a few questions that
// actually tailor the app, a couple of quick preferences, one setup step for
// bankroll, then a nudge to add the very first bet — the real "aha" moment.
const SPORTS = ['Football', 'Horse Racing', 'Tennis', 'Basketball', 'Cricket', 'Golf', 'Esports', 'Other'];

// Only questions we do something with: how you bet (turns on the tipster
// field), what you bet on (seeds sport suggestions), and your goal (sets the
// tone). The old, unused frequency/experience questions were dropped.
const QUESTIONS = [
  {
    key: 'trackingStyle',
    title: 'How do you bet?',
    subtitle: 'Pick any that apply.',
    options: [
      { value: 'own', label: 'I track my own bets' },
      { value: 'tipster', label: 'I follow tipsters' },
    ],
  },
  {
    key: 'sports',
    title: 'What do you bet on?',
    subtitle: 'Pick any that apply — we’ll suggest these first.',
    options: SPORTS.map((s) => ({ value: s, label: s })),
  },
  {
    key: 'goal',
    title: 'What do you want from Betbooks?',
    subtitle: 'Pick any that apply.',
    options: [
      { value: 'profit', label: 'Make a long-term profit' },
      { value: 'discipline', label: 'Stay disciplined with my staking' },
      { value: 'analyse', label: 'Understand my performance' },
      { value: 'fun', label: 'Just track it for fun' },
    ],
  },
];

// The ordered screens. welcome + done bookend the "work" steps (the questions,
// quick prefs and bankroll setup), which are the ones the progress bar counts.
const PHASES = [
  { type: 'welcome' },
  ...QUESTIONS.map((q) => ({ type: 'question', q })),
  { type: 'prefs' },
  { type: 'setup' },
  { type: 'done' },
];
const WORK = ['question', 'prefs', 'setup'];
const totalWork = PHASES.filter((p) => WORK.includes(p.type)).length;
const prefsIndex = PHASES.findIndex((p) => p.type === 'prefs');

const WELCOME_POINTS = [
  { icon: 'camera', title: 'Log a bet in seconds', body: 'Type it in, or snap a photo of the slip and we read it for you.' },
  { icon: 'trend', title: 'See your real numbers', body: 'Profit, ROI and win rate worked out automatically — no spreadsheets.' },
  { icon: 'sliders', title: 'Built around how you bet', body: 'Your sports, your stats, your dashboard.' },
];

export default function Onboarding() {
  const { settings, save } = useSettings();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [i, setI] = useState(0);
  const [answers, setAnswers] = useState({ trackingStyle: [], sports: [], goal: [] });
  const [prefs, setPrefs] = useState({
    currency: settings?.currency || 'GBP',
    oddsFormat: settings?.oddsFormat || 'decimal',
    bankroll: settings?.bankroll?.starting || '',
    unitSize: settings?.staking && settings.staking.mode !== 'currency' ? (settings.staking.unitSize ?? '') : '',
    trackerName: '',
  });
  const [saving, setSaving] = useState(false);

  const phase = PHASES[i];
  const firstName = (user?.username || '').trim().split(/\s+/)[0];

  function toggleMulti(key, value) {
    setAnswers((a) => {
      const cur = a[key] || [];
      return { ...a, [key]: cur.includes(value) ? cur.filter((x) => x !== value) : [...cur, value] };
    });
  }

  // Save everything at the very end, then land on the dashboard — optionally
  // opening the Add-bet slip so the first thing they do is log a bet.
  async function complete(addFirstBet) {
    setSaving(true);
    const a = answers;
    const followsTipster = (a.trackingStyle || []).includes('tipster');
    const unit = Number(prefs.unitSize);
    const usesUnits = prefs.unitSize !== '' && unit > 0;
    const next = {
      ...settings,
      currency: prefs.currency,
      oddsFormat: prefs.oddsFormat,
      bankroll: { ...settings.bankroll, starting: Number(prefs.bankroll) || 0 },
      staking: usesUnits ? { ...settings.staking, mode: 'both', unitSize: unit } : settings.staking,
      fields: { ...settings.fields, tipster: followsTipster || settings.fields.tipster },
      profile: {
        ...settings.profile,
        onboarded: true,
        trackingStyle: a.trackingStyle,
        sports: a.sports,
        goal: a.goal,
      },
    };
    try {
      // Seed the first tracker (name + bankroll) BEFORE flipping onboarded —
      // that flip mounts the tracker bar, which then loads the renamed tracker.
      const bk = Number(prefs.bankroll) || 0;
      const trackerName = prefs.trackerName.trim();
      if (bk > 0 || trackerName) {
        const d = await api.get('/trackers').catch(() => null);
        const first = d?.trackers?.[0];
        if (first) {
          const body = {};
          if (bk > 0) body.bankroll_start = bk;
          if (trackerName) body.name = trackerName;
          await api.put(`/trackers/${first.id}`, body).catch(() => {});
        }
      }
      await save(next);
      navigate('/' + (addFirstBet ? '?firstbet=1' : ''), { replace: true });
    } finally {
      setSaving(false);
    }
  }

  // Which "work" step number we're on (for the progress bar); 0 on welcome/done.
  const workNo = WORK.includes(phase.type)
    ? PHASES.slice(0, i + 1).filter((p) => WORK.includes(p.type)).length
    : 0;

  return (
    <div className="auth-wrap">
      <div className="onboard">
        <div className="brand" style={{ justifyContent: 'center', marginBottom: 18 }}>
          <Logo />
        </div>

        {workNo > 0 && (
          <div className="onboard-progress">
            {Array.from({ length: totalWork }).map((_, k) => (
              <span key={k} className={`dot ${k < workNo ? 'on' : ''}`} />
            ))}
          </div>
        )}

        {/* ---- Welcome ---- */}
        {phase.type === 'welcome' && (
          <div className="card onb-welcome">
            <h2>Welcome{firstName ? `, ${firstName}` : ''}.</h2>
            <p className="muted onb-lead">Let’s set Betbooks up around how you bet. Takes about a minute.</p>
            <div className="onb-vps">
              {WELCOME_POINTS.map((p) => (
                <div key={p.title} className="onb-vp">
                  <span className="onb-vp-ic"><Icon name={p.icon} size={18} /></span>
                  <div><strong>{p.title}</strong><span className="muted">{p.body}</span></div>
                </div>
              ))}
            </div>
            <button className="btn-primary" style={{ width: '100%' }} onClick={() => setI(1)}>Get started</button>
          </div>
        )}

        {/* ---- Questions ---- */}
        {phase.type === 'question' && (
          <div className="card">
            <div className="onb-step">Step {workNo} of {totalWork}</div>
            <h2 style={{ margin: '6px 0 4px', fontSize: 22 }}>{phase.q.title}</h2>
            <p className="muted" style={{ margin: '0 0 16px', fontSize: 14 }}>{phase.q.subtitle}</p>
            <div className="chip-grid">
              {phase.q.options.map((o) => {
                const on = (answers[phase.q.key] || []).includes(o.value);
                return (
                  <button key={o.value} className={`chip-btn ${on ? 'sel' : ''}`} onClick={() => toggleMulti(phase.q.key, o.value)}>
                    {o.label}
                  </button>
                );
              })}
            </div>
            <div className="row spread" style={{ marginTop: 20 }}>
              <button className="btn-ghost btn-sm" onClick={() => setI(i - 1)}>← Back</button>
              <button className="btn-primary" onClick={() => setI(i + 1)}>Continue</button>
            </div>
            <button className="onb-skip" onClick={() => setI(prefsIndex)}>Skip these questions</button>
          </div>
        )}

        {/* ---- Quick preferences ---- */}
        {phase.type === 'prefs' && (
          <div className="card">
            <div className="onb-step">Step {workNo} of {totalWork}</div>
            <h2 style={{ margin: '6px 0 4px', fontSize: 22 }}>Quick preferences</h2>
            <p className="muted" style={{ margin: '0 0 16px', fontSize: 14 }}>You can change these any time in settings.</p>
            <div className="grid-2 onb-prefs">
              <div className="field">
                <label htmlFor="onb-currency">Currency</label>
                <select id="onb-currency" value={prefs.currency} onChange={(e) => setPrefs({ ...prefs, currency: e.target.value })}>
                  {['GBP', 'USD', 'EUR', 'AUD', 'CAD'].map((c) => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div className="field">
                <label htmlFor="onb-odds">Odds format</label>
                <select id="onb-odds" value={prefs.oddsFormat} onChange={(e) => setPrefs({ ...prefs, oddsFormat: e.target.value })}>
                  <option value="decimal">Decimal (2.50)</option>
                  <option value="fractional">Fractional (6/4)</option>
                  <option value="american">American (+150)</option>
                </select>
              </div>
            </div>
            <div className="row spread" style={{ marginTop: 20 }}>
              <button className="btn-ghost btn-sm" onClick={() => setI(i - 1)}>← Back</button>
              <button className="btn-primary" onClick={() => setI(i + 1)}>Continue</button>
            </div>
          </div>
        )}

        {/* ---- One last thing: bankroll setup ---- */}
        {phase.type === 'setup' && (
          <div className="card">
            <div className="onb-step">Step {workNo} of {totalWork}</div>
            <h2 style={{ margin: '6px 0 4px', fontSize: 22 }}>One last thing — set up your tracker</h2>
            <p className="muted" style={{ margin: '0 0 16px', fontSize: 14 }}>
              Your bankroll powers your growth and staking stats. You can skip and add it later.
            </p>
            <div className="grid-2 onb-prefs">
              <div className="field" style={{ gridColumn: '1 / -1' }}>
                <label htmlFor="onb-tracker-name">Tracker name <span className="muted" style={{ fontWeight: 400 }}>(optional)</span></label>
                <input id="onb-tracker-name" value={prefs.trackerName} placeholder="e.g. My bets, Football tips" maxLength={60} onChange={(e) => setPrefs({ ...prefs, trackerName: e.target.value })} />
              </div>
              <div className="field">
                <label htmlFor="onb-bankroll">Starting bankroll <span className="muted" style={{ fontWeight: 400 }}>(optional)</span></label>
                <div className="row" style={{ gap: 8, alignItems: 'center' }}>
                  <span className="muted" style={{ fontWeight: 700 }}>{currencySymbol(prefs.currency)}</span>
                  <input id="onb-bankroll" type="number" min="0" step="0.01" value={prefs.bankroll} placeholder="e.g. 500" onChange={(e) => setPrefs({ ...prefs, bankroll: e.target.value })} />
                </div>
              </div>
              <div className="field">
                <label htmlFor="onb-unit">Unit size <span className="muted" style={{ fontWeight: 400 }}>(optional)</span></label>
                <div className="row" style={{ gap: 8, alignItems: 'center' }}>
                  <span className="muted" style={{ fontWeight: 700 }}>{currencySymbol(prefs.currency)}</span>
                  <input id="onb-unit" type="number" min="0.01" step="0.01" value={prefs.unitSize} placeholder="e.g. 10" onChange={(e) => setPrefs({ ...prefs, unitSize: e.target.value })} />
                </div>
              </div>
              <div className="muted" style={{ gridColumn: '1 / -1', fontSize: 11.5, marginTop: -4 }}>
                Unit size is what 1 unit is worth — leave blank if you don’t stake in units.
              </div>
            </div>
            <div className="row spread" style={{ marginTop: 20 }}>
              <button className="btn-ghost btn-sm" onClick={() => setI(i - 1)}>← Back</button>
              <button className="btn-primary" onClick={() => setI(i + 1)}>Continue</button>
            </div>
          </div>
        )}

        {/* ---- Done: nudge the first bet ---- */}
        {phase.type === 'done' && (
          <div className="card onb-done">
            <div className="onb-done-ic"><Icon name="check" size={30} /></div>
            <h2>You’re all set{firstName ? `, ${firstName}` : ''}!</h2>
            <p className="muted onb-lead">
              Add your first bet to see your numbers come to life. Snap a photo of a slip or add one by hand — it only takes a moment.
            </p>
            <button className="btn-primary" style={{ width: '100%' }} onClick={() => complete(true)} disabled={saving}>
              {saving ? 'Setting up…' : 'Add my first bet'}
            </button>
            <button className="btn-ghost" style={{ width: '100%', marginTop: 10 }} onClick={() => complete(false)} disabled={saving}>
              I’ll explore first
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
