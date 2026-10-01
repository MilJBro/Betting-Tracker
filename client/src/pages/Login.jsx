import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import AuthPanel from '../components/AuthPanel.jsx';
import Logo from '../components/Logo.jsx';
import PlanCards from '../components/PlanCards.jsx';
import { api } from '../api.js';
import { REVIEWS } from '../reviews.js';

const FEATURES = [
  {
    title: 'Track every bet',
    body: 'Log your bets in seconds and keep everything in one place.',
    icon: <><circle cx="12" cy="12" r="7.5" /><circle cx="12" cy="12" r="3" /><path d="M12 1.5v3M12 19.5v3M1.5 12h3M19.5 12h3" /></>,
  },
  {
    title: 'See your real performance',
    body: 'Understand your ROI, win rate and profit at a glance.',
    icon: <><path d="M4 20h16" /><path d="M7 20v-4M12 20v-8M17 20v-5" /><path d="M14.4 6.6L17 4l2.6 2.6" /><path d="M17 4v6" /></>,
  },
  {
    title: 'Build your record',
    body: 'Stay consistent, spot trends and improve over time.',
    icon: <><rect x="3.5" y="5" width="17" height="15.5" rx="2.5" /><path d="M3.5 9.5h17M8 3v3.5M16 3v3.5" /></>,
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

// Swipeable row of review cards (one and a bit visible, so the next peeks in),
// with dots underneath. Real reviews only — see reviews.js.
function ReviewCarousel({ reviews }) {
  const scroller = useRef(null);
  const [active, setActive] = useState(0);

  const onScroll = () => {
    const el = scroller.current;
    if (!el) return;
    let best = 0, bestDist = Infinity;
    for (let i = 0; i < el.children.length; i++) {
      const d = Math.abs(el.children[i].offsetLeft - el.scrollLeft - 20);
      if (d < bestDist) { best = i; bestDist = d; }
    }
    setActive(best);
  };
  const goTo = (i) => {
    const el = scroller.current;
    const child = el?.children[i];
    if (child) el.scrollTo({ left: child.offsetLeft - 20, behavior: 'smooth' });
  };

  return (
    <>
      <div className="lp-review-row" ref={scroller} onScroll={onScroll}>
        {reviews.map((r) => (
          <figure className="lp-review" key={r.name + r.quote.slice(0, 24)}>
            {r.rating >= 1 && (
              <div className="lp-stars" role="img" aria-label={`${r.rating} out of 5 stars`}>
                {'★'.repeat(Math.min(5, Math.round(r.rating)))}
              </div>
            )}
            <blockquote>“{r.quote}”</blockquote>
            <figcaption>
              <span className="lp-review-name">{r.name}</span>
              {r.detail && <span className="lp-review-detail"> · {r.detail}</span>}
            </figcaption>
          </figure>
        ))}
      </div>
      {reviews.length > 1 && (
        <div className="lp-review-dots" role="tablist" aria-label="Reviews">
          {reviews.map((r, i) => (
            <button
              key={r.name + i}
              type="button"
              className={active === i ? 'on' : ''}
              onClick={() => goTo(i)}
              aria-label={`Review ${i + 1} of ${reviews.length}`}
              aria-selected={active === i}
            />
          ))}
        </div>
      )}
    </>
  );
}

// The home page: a marketing landing that introduces Betbooks, then invites
// the visitor to create an account or log in.
export default function Login() {
  const [mode, setMode] = useState('login');
  const [pricing, setPricing] = useState(null);
  const [billingInterval, setBillingInterval] = useState('monthly');

  useEffect(() => { api.get('/pricing').then(setPricing).catch(() => {}); }, []);

  // Reveal sections as they scroll into view (skipped for reduced-motion users
  // via CSS — the hidden state only applies under prefers-reduced-motion: no-preference).
  useEffect(() => {
    const els = document.querySelectorAll('.reveal');
    if (!els.length || !('IntersectionObserver' in window)) return;
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
      }
    }, { threshold: 0.1, rootMargin: '0px 0px -6% 0px' });
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  function goAuth(m) {
    setMode(m);
    document.getElementById('get-started')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return (
    <div className="landing-wrap">
      <div className="landing">
        <div className="lp-topbar">
          <Logo />
          <button className="btn-ghost btn-sm lp-top-login" onClick={() => goAuth('login')}>Log in</button>
        </div>

        <div className="lp-hero reveal">
          <div className="lp-eyebrow">Betting Tracker</div>
          <h1>The betting tracker<br /><span className="lp-h-accent">for serious punters.</span></h1>
          <p className="sub">
            Log bets in seconds and see your profit, ROI and win rate across every sport,
            bookmaker and tipster. Your full betting record, in one place.
          </p>
          <div className="lp-cta">
            <button className="btn-primary" onClick={() => goAuth('register')}>
              Create free account <span aria-hidden="true">→</span>
            </button>
            <button className="btn-outline" onClick={() => goAuth('login')}>Log in</button>
          </div>
          <div className="lp-trust">No ads · No gambling promotions · Free to use</div>
        </div>

        <div className="lp-featrow">
          {FEATURES.map((f, i) => (
            <div key={f.title} className="lp-feat3 reveal" style={{ transitionDelay: `${i * 0.08}s` }}>
              <div className="lp-feat3-ic"><FeatureIcon>{f.icon}</FeatureIcon></div>
              <h3>{f.title}</h3>
              <p>{f.body}</p>
            </div>
          ))}
        </div>

        <div className="reveal">
          <div className="section-title lp-h">How it works</div>
          <div className="lp-steps">
            {STEPS.map((s, i) => (
              <div key={i} className="lp-step"><div className="lp-n">{i + 1}</div><div className="lp-t">{s}</div></div>
            ))}
          </div>
        </div>

        {/* Reviews — real user quotes only (see reviews.js). Hidden while empty. */}
        {REVIEWS.length > 0 && (
          <div className="lp-reviews reveal">
            <div className="section-title lp-h">What people say</div>
            <ReviewCarousel reviews={REVIEWS} />
          </div>
        )}

        <div className="lp-pricing reveal">
          <div className="lp-pricing-eyebrow">Pricing</div>
          <h2 className="lp-pricing-h">Start free. <span className="lp-h-accent">Go Pro</span> when you want more.</h2>
          <p className="lp-pricing-sub">
            Free forever for the essentials{pricing?.trialDays > 0 ? ` — or try Pro free for ${pricing.trialDays} days` : ''}.
            Upgrade any time for full stats, unlimited scans and more.
          </p>
          <PlanCards
            priceLabel={pricing?.priceLabel || ''}
            priceLabelAnnual={pricing?.priceLabelAnnual || ''}
            annualSave={pricing?.annualSave || ''}
            interval={billingInterval}
            onInterval={setBillingInterval}
            freeButton={<button className="btn-ghost plan-cta" onClick={() => goAuth('register')}>Start free</button>}
            proButton={<button className="btn-primary plan-cta" onClick={() => goAuth('register')}>
              {pricing?.trialDays > 0 ? `Start free — try Pro for ${pricing.trialDays} days` : 'Create free account'}
            </button>}
            proFine={<p className="muted plan-fine">Create a free account first — upgrade to Pro anytime from the app.</p>}
          />
        </div>

        <div className="section-title lp-h" id="get-started">Get started</div>
        <AuthPanel mode={mode} onMode={setMode} />

        <p className="muted" style={{ textAlign: 'center', fontSize: 12, marginTop: 18 }}>
          Free to use · Please gamble responsibly ·{' '}
          <a href="https://www.begambleaware.org/" target="_blank" rel="noopener noreferrer" style={{ color: 'inherit' }}>BeGambleAware</a>
        </p>
        <p className="muted" style={{ textAlign: 'center', fontSize: 12, marginTop: 6 }}>
          <Link to="/blog" style={{ color: 'inherit' }}>Guides</Link> ·{' '}
          <Link to="/terms" style={{ color: 'inherit' }}>Terms</Link> ·{' '}
          <Link to="/privacy" style={{ color: 'inherit' }}>Privacy</Link>
        </p>
      </div>
    </div>
  );
}
