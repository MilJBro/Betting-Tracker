import { useState } from 'react';
import AuthPanel from '../components/AuthPanel.jsx';
import BrandMark from '../components/BrandMark.jsx';

const FEATURES = [
  {
    title: 'Make it yours',
    body: 'Show the stats you care about, hide the rest, reorder your dashboard and pick a theme.',
    icon: <><path d="M4 8h16M4 16h16" /><circle cx="9" cy="8" r="2.3" /><circle cx="15" cy="16" r="2.3" /></>,
  },
  {
    title: 'Keep bets separate',
    tag: 'Pro',
    body: 'Run more than one tracker — one per tipster or strategy — so results never mix.',
    icon: <path d="M12 3l9 5-9 5-9-5 9-5zM3 13l9 5 9-5" />,
  },
  {
    title: 'Share your form',
    body: 'Publish a clean, read-only page of your ROI and results — show how you’re getting on.',
    icon: <><circle cx="6" cy="12" r="2.4" /><circle cx="18" cy="6" r="2.4" /><circle cx="18" cy="18" r="2.4" /><path d="M8 11l8-4M8 13l8 4" /></>,
  },
  {
    title: 'See your true form',
    body: 'Profit over time, ROI and win rate — broken down by sport, bookie and tipster.',
    icon: <path d="M4 19V5M4 19h16M8 16v-5M12 16V8M16 16v-6" />,
  },
];

const STEPS = [
  'Add a bet in seconds — sport, selection, stake and odds.',
  "Mark it won or lost with one tap when the result's in.",
  'Watch your profit, ROI and form take shape automatically.',
];

function FeatureIcon({ children }) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  );
}

// The home page: a marketing landing that introduces Betbooks, then invites
// the visitor to create an account or log in.
export default function Login() {
  const [mode, setMode] = useState('login');

  function goAuth(m) {
    setMode(m);
    document.getElementById('get-started')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return (
    <div className="landing-wrap">
      <div className="landing">
        <div className="lp-hero">
          <div className="brand" style={{ justifyContent: 'center', fontSize: 22 }}>
            <BrandMark /> Betbooks
          </div>
          <h1>Track your bets.<br />See your real edge.</h1>
          <p className="sub">
            The betting tracker you shape around how you actually bet — log bets in seconds and
            watch your true profit, ROI and form build up. Free to start.
          </p>
          <div className="lp-cta">
            <button className="btn-primary" onClick={() => goAuth('register')}>Create free account</button>
            <button className="btn-outline" onClick={() => goAuth('login')}>Log in</button>
          </div>
          <div className="lp-trust">Free to use · 18+ · Please gamble responsibly</div>
        </div>

        <div className="section-title lp-h">Why Betbooks</div>
        <div className="lp-features">
          {FEATURES.map((f) => (
            <div key={f.title} className="card lp-feat">
              <div className="lp-chip"><FeatureIcon>{f.icon}</FeatureIcon></div>
              <h3>{f.title}{f.tag && <span className="lp-tag">{f.tag}</span>}</h3>
              <p>{f.body}</p>
            </div>
          ))}
        </div>

        <div className="section-title lp-h">How it works</div>
        <div className="lp-steps">
          {STEPS.map((s, i) => (
            <div key={i} className="lp-step"><div className="lp-n">{i + 1}</div><div className="lp-t">{s}</div></div>
          ))}
        </div>

        <div className="section-title lp-h" id="get-started">Get started</div>
        <AuthPanel mode={mode} onMode={setMode} />

        <p className="muted" style={{ textAlign: 'center', fontSize: 12, marginTop: 18 }}>
          Free to use · 18+ · Please gamble responsibly ·{' '}
          <a href="https://www.begambleaware.org/" target="_blank" rel="noopener noreferrer" style={{ color: 'inherit' }}>BeGambleAware</a>
        </p>
      </div>
    </div>
  );
}
