import { useState } from 'react';
import { Link } from 'react-router-dom';
import AuthPanel from '../components/AuthPanel.jsx';
import BrandMark from '../components/BrandMark.jsx';

const FEATURES = [
  {
    title: 'Tailored to you',
    body: 'Show the stats you care about, hide the rest, and reorder your dashboard to suit you.',
    icon: <><path d="M4 8h16M4 16h16" /><circle cx="9" cy="8" r="2.3" /><circle cx="15" cy="16" r="2.3" /></>,
  },
  {
    title: 'Multiple trackers',
    body: 'Keep a separate tracker for each tipster or strategy, so their results never mix.',
    icon: <path d="M12 3l9 5-9 5-9-5 9-5zM3 13l9 5 9-5" />,
  },
  {
    title: 'Share your record',
    body: 'Publish a clean, read-only page of your results — show people how you’re getting on.',
    icon: <><circle cx="6" cy="12" r="2.4" /><circle cx="18" cy="6" r="2.4" /><circle cx="18" cy="18" r="2.4" /><path d="M8 11l8-4M8 13l8 4" /></>,
  },
  {
    title: 'See your real numbers',
    body: 'Profit over time, ROI and win rate — broken down by sport, bookie and tipster.',
    icon: <path d="M4 19V5M4 19h16M8 16v-5M12 16V8M16 16v-6" />,
  },
];

const STEPS = [
  'Add a bet in seconds — sport, selection, stake and odds.',
  "Mark it won or lost with one tap when the result's in.",
  'Watch your profit and win rate build up automatically.',
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
          <h1>Know if you’re<br />really winning.</h1>
          <p className="sub">
            The betting tracker you shape around how you actually bet. Log a bet in seconds
            and see exactly where you stand — no spreadsheets, no guesswork. Free to start.
          </p>
          <div className="lp-cta">
            <button className="btn-primary" onClick={() => goAuth('register')}>Create free account</button>
            <button className="btn-outline" onClick={() => goAuth('login')}>Log in</button>
          </div>
          <div className="lp-trust">Free to use · Please gamble responsibly</div>
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
          Free to use · Please gamble responsibly ·{' '}
          <a href="https://www.begambleaware.org/" target="_blank" rel="noopener noreferrer" style={{ color: 'inherit' }}>BeGambleAware</a>
        </p>
        <p className="muted" style={{ textAlign: 'center', fontSize: 12, marginTop: 6 }}>
          <Link to="/terms" style={{ color: 'inherit' }}>Terms</Link> ·{' '}
          <Link to="/privacy" style={{ color: 'inherit' }}>Privacy</Link>
        </p>
      </div>
    </div>
  );
}
