import { settleOptions } from '../settle.js';

// Quick-settle buttons for a pending bet: Won / Lost, plus Placed (each-way
// only) and Void. All sit inline — no menu to open. onSettle(status) does the work.
export default function SettleControls({ bet, onSettle }) {
  const { base, more } = settleOptions(bet);
  return (
    <div className="row settle-row" style={{ flexWrap: 'wrap', gap: 6 }}>
      {[...base, ...more].map((o) => (
        <button key={o.status} className={`btn-ghost btn-sm ${o.cls}`} onClick={() => onSettle(o.status)} title={`Mark ${o.label.toLowerCase()}`}>
          {o.label}
        </button>
      ))}
    </div>
  );
}
