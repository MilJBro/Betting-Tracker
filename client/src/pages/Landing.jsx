import AuthPanel from '../components/AuthPanel.jsx';

const FEATURES = [
  {
    icon: '📝',
    title: 'Log every bet',
    body: "Record the stake, odds, bookmaker and result. Profit, ROI and win rate are worked out for you — no spreadsheets.",
  },
  {
    icon: '🎨',
    title: "A dashboard that's yours",
    body: 'Pick your colour, dark or light, currency and odds format, and choose exactly which stats and sections you see.',
  },
  {
    icon: '📈',
    title: 'Real analytics',
    body: 'Monthly profit and loss, ROI by odds range and by bookmaker, win and loss streaks, and day-of-week performance.',
  },
  {
    icon: '🔗',
    title: 'Share your form',
    body: "Publish a clean, read-only page of how you're doing — and control exactly what it reveals. Stakes stay private by default.",
  },
];

const STEPS = [
  { n: 1, title: 'Create your free account', body: 'Sign up in seconds. Your data is private to you.' },
  { n: 2, title: 'Log your bets', body: 'Add each bet as you place it, or settle it later.' },
  { n: 3, title: 'See how you’re doing', body: 'Profit, ROI, trends and insights build up automatically.' },
];

function scrollToStart(e) {
  e.preventDefault();
  document.getElementById('get-started')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

export default function Landing() {
  return (
    <div className="landing">
      {/* Top bar */}
      <header className="landing-nav">
        <div className="brand"><span className="brand-dot">₿</span> Betting Tracker</div>
        <a href="#get-started" className="btn-ghost btn-sm" onClick={scrollToStart}>Log in</a>
      </header>

      {/* Hero */}
      <section className="hero">
        <div className="hero-copy">
          <div className="pill">Your betting, tracked properly</div>
          <h1>Track your bets,<br />your way.</h1>
          <p className="lead">
            A fully customizable betting tracker. Log every bet, watch your profit, ROI and
            win rate build up on a dashboard you control — then share how you’re getting on.
          </p>
          <ul className="hero-points">
            <li>✓ Profit, ROI &amp; win rate, worked out for you</li>
            <li>✓ A dashboard you can colour and shape</li>
            <li>✓ Deep analytics and a shareable form page</li>
          </ul>
          <div className="hero-cta">
            <a href="#get-started" className="btn-primary" onClick={scrollToStart}>Create free account</a>
            <a href="#learn-more" className="btn-ghost">See how it works</a>
          </div>
          <p className="muted" style={{ fontSize: 12, marginTop: 14 }}>Free to use · 18+ · Please gamble responsibly.</p>
        </div>

        <div className="hero-auth" id="get-started">
          <AuthPanel initialMode="register" />
        </div>
      </section>

      {/* What it is */}
      <section className="section" id="learn-more">
        <div className="section-head">
          <h2>Everything you need to run your betting like a pro</h2>
          <p className="muted">Betting Tracker is a personal record of your bets and how they perform — built to be flexible, private, and genuinely useful.</p>
        </div>
        <div className="feature-grid">
          {FEATURES.map((f) => (
            <div className="feature" key={f.title}>
              <div className="feature-ic">{f.icon}</div>
              <h3>{f.title}</h3>
              <p>{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="section">
        <div className="section-head"><h2>How it works</h2></div>
        <div className="steps">
          {STEPS.map((s) => (
            <div className="step" key={s.n}>
              <div className="step-n">{s.n}</div>
              <h3>{s.title}</h3>
              <p className="muted">{s.body}</p>
            </div>
          ))}
        </div>
        <div style={{ textAlign: 'center', marginTop: 26 }}>
          <a href="#get-started" className="btn-primary" onClick={scrollToStart}>Get started — it’s free</a>
        </div>
      </section>

      {/* Footer */}
      <footer className="landing-foot">
        <div className="brand" style={{ fontSize: 16 }}><span className="brand-dot">₿</span> Betting Tracker</div>
        <p className="muted" style={{ maxWidth: 520, margin: '10px auto 0', fontSize: 13 }}>
          A personal betting tracker for keeping honest records of your bets. It is not a
          bookmaker and does not take bets or payments. You must be 18 or over to gamble.
          If gambling is affecting you, help is available at <a href="https://www.begambleaware.org" target="_blank" rel="noreferrer">BeGambleAware.org</a>.
        </p>
        <p className="muted" style={{ fontSize: 12, marginTop: 14 }}>© {new Date().getFullYear()} Betting Tracker</p>
      </footer>
    </div>
  );
}
