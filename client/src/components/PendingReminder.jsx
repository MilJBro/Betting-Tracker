import { useState } from 'react';

// A gentle nudge to settle bets that are still open from before today — the
// ones most likely to need a result. Dismissible for the day (per count), so
// it reappears if more fall due but doesn't nag once you've seen it.
const KEY = 'bt_pending_nudge';

export default function PendingReminder({ bets, onReview, reviewLabel = 'Review' }) {
  // A tick to force a re-render after dismissing; the dismissed signature is
  // read from localStorage at render (bets load in after mount, so the count —
  // and thus the signature — isn't known until then).
  const [, setTick] = useState(0);
  const today = new Date().toISOString().slice(0, 10);
  const overdue = (bets || []).filter((b) => b.status === 'pending' && (b.placed_at || '') < today);
  const sig = `${today}:${overdue.length}`;
  let stored = null;
  try { stored = localStorage.getItem(KEY); } catch {}
  if (!overdue.length || stored === sig) return null;

  const n = overdue.length;
  function dismiss() {
    try { localStorage.setItem(KEY, sig); } catch {}
    setTick((t) => t + 1);
  }

  return (
    <div className="nudge">
      <div className="nudge-body">
        <strong>{n} bet{n !== 1 ? 's' : ''} still open from before today.</strong>{' '}
        <span className="muted">Settle {n !== 1 ? 'them' : 'it'} to keep your profit and stats up to date.</span>
      </div>
      <div className="row" style={{ gap: 8, flexWrap: 'nowrap' }}>
        <button className="btn-primary btn-sm" onClick={onReview}>{reviewLabel}</button>
        <button className="btn-ghost btn-sm" onClick={dismiss} aria-label="Dismiss reminder">✕</button>
      </div>
    </div>
  );
}
