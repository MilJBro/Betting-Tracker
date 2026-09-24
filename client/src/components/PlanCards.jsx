import { useRef, useState } from 'react';
import Icon from './Icon.jsx';

// Free is deliberately generous (the habit-forming core); Pro unlocks scale +
// deeper insight. Keep in sync with the server's PRO_FEATURES in
// server/src/lib/plan.js. Shared by the in-app Plans page and the landing page.
export const FREE_FEATURES = [
  'Unlimited bet logging',
  'Dashboard stats — profit, ROI & win rate',
  'Profit chart & bet history',
  '5 AI bet scans every month',
  'Themes & a dashboard you build',
  '1 tracker',
];
export const PRO_FEATURES = [
  'Full stats & analytics',
  'Breakdowns by sport, bookmaker & tipster',
  'Unlimited AI bet scans',
  'Multiple trackers',
  'CSV import & export',
  'Custom share page — no badge',
];

// Presentational Free vs Pro comparison. The parent supplies the CTA buttons
// (`freeButton` / `proButton`) so it works both in-app (upgrade) and on the
// landing page (sign up). `priceLabel` shows the Pro price when known.
export default function PlanCards({ priceLabel = '', freeButton, proButton, proFine }) {
  // On phones the two cards become a swipeable carousel (one per screen) so the
  // whole comparison fits without scrolling. On desktop it stays a 2-col grid
  // and the dots are hidden via CSS.
  const scroller = useRef(null);
  const [active, setActive] = useState(0);

  const onScroll = () => {
    const el = scroller.current;
    if (!el) return;
    const centre = el.scrollLeft + el.clientWidth / 2;
    let idx = 0;
    for (let i = 0; i < el.children.length; i++) {
      const c = el.children[i];
      if (centre >= c.offsetLeft && centre < c.offsetLeft + c.offsetWidth) { idx = i; break; }
    }
    setActive(idx);
  };
  const goTo = (i) => {
    const el = scroller.current;
    const child = el?.children[i];
    if (child) el.scrollTo({ left: child.offsetLeft, behavior: 'smooth' });
  };

  return (
    <>
    <div className="plans" ref={scroller} onScroll={onScroll}>
      <div className="plan">
        <div className="plan-head">
          <span className="plan-name">Free</span>
          <div className="plan-price"><span className="pp-amt">£0</span><span className="pp-per">forever</span></div>
        </div>
        <p className="plan-tag muted">Everything you need to track your bets.</p>
        <ul className="plan-list">
          {FREE_FEATURES.map((f) => <li key={f}><span className="pl-check"><Icon name="check" size={13} /></span>{f}</li>)}
        </ul>
        {freeButton}
      </div>

      <div className="plan pro">
        <div className="plan-badge">Most popular</div>
        <div className="plan-head">
          <span className="plan-name">Pro</span>
          <div className="plan-price">
            {priceLabel
              ? <><span className="pp-amt">{priceLabel.split(' ')[0]}</span><span className="pp-per">{priceLabel.replace(/^\S+\s*/, '') || 'per month'}</span></>
              : <span className="pp-amt" style={{ fontSize: 26 }}>Coming soon</span>}
          </div>
        </div>
        <p className="plan-tag" style={{ color: 'var(--primary)' }}>Everything in Free, plus:</p>
        <ul className="plan-list">
          {PRO_FEATURES.map((f) => <li key={f}><span className="pl-check on"><Icon name="check" size={13} /></span>{f}</li>)}
        </ul>
        {proButton}
        {proFine}
      </div>
    </div>
    <div className="plans-dots" role="tablist" aria-label="Plans">
      {['Free', 'Pro'].map((label, i) => (
        <button
          key={label}
          type="button"
          className={active === i ? 'on' : ''}
          onClick={() => goTo(i)}
          aria-label={label}
          aria-selected={active === i}
        />
      ))}
    </div>
    </>
  );
}
