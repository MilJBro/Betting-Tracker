import { useEffect, useRef, useState } from 'react';
import { settleOptions } from '../settle.js';

// Quick-settle buttons for a pending bet: Won / Lost inline, plus a small "⋯"
// menu for the rest (Placed for each-way, Void). onSettle(status) does the work.
export default function SettleControls({ bet, onSettle }) {
  const { base, more } = settleOptions(bet);
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function onDoc(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const pick = (status) => { setOpen(false); onSettle(status); };

  return (
    <div className="row settle-row" style={{ flexWrap: 'nowrap', gap: 6 }} ref={ref}>
      {base.map((o) => (
        <button key={o.status} className={`btn-ghost btn-sm ${o.cls}`} onClick={() => pick(o.status)} title={`Mark ${o.label.toLowerCase()}`}>
          {o.label}
        </button>
      ))}
      <div className="settle-more" style={{ position: 'relative' }}>
        <button type="button" className="btn-ghost btn-sm" aria-label="More outcomes" title="More outcomes" onClick={() => setOpen((v) => !v)}>⋯</button>
        {open && (
          <div className="menu-pop" role="menu">
            {more.map((o) => (
              <button key={o.status} type="button" className="menu-item" role="menuitem" onClick={() => pick(o.status)}>
                {o.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
