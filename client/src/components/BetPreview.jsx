import { createPortal } from 'react-dom';
import { formatStake, formatOdds, formatDate } from '../format.js';

// Read-only look at a bet — opened by tapping a bet in the list — so the full
// selection (and each leg of an acca / bet builder) is visible without opening
// the edit form. Portalled to <body> so it scrolls reliably on iOS.
export default function BetPreview({ bet, currency, staking, oddsFormat = 'decimal', profit, onEdit, onDelete, onClose }) {
  if (!bet) return null;
  const legs = Array.isArray(bet.legs) ? bet.legs : [];
  const isMulti = bet.bet_type === 'Accumulator' || bet.bet_type === 'Bet builder';
  const showLegs = isMulti && legs.length > 0;

  const Row = ({ label, value }) =>
    value === '' || value == null ? null : (
      <div className="row spread" style={{ alignItems: 'flex-start', gap: 12 }}>
        <span className="muted">{label}</span>
        <strong style={{ textAlign: 'right', maxWidth: '65%' }}>{value}</strong>
      </div>
    );

  return createPortal(
    <div className="modal-overlay" onMouseDown={onClose}>
      <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="row spread" style={{ marginBottom: 14 }}>
          <h2 style={{ margin: 0, fontSize: 20 }}>Bet details</h2>
          <button className="btn-ghost btn-sm" type="button" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className="field">
          <label>{showLegs ? 'Selections' : 'Selection'}</label>
          {showLegs ? (
            <div className="stack" style={{ gap: 6 }}>
              {legs.map((l, i) => (
                <div key={i} className="row spread" style={{ gap: 10, borderBottom: i < legs.length - 1 ? '1px solid var(--border)' : 'none', paddingBottom: i < legs.length - 1 ? 6 : 0 }}>
                  <span style={{ fontWeight: 600 }}>{l.selection}</span>
                  {bet.bet_type === 'Accumulator' && Number(l.odds) > 0 && (
                    <span className="muted" style={{ whiteSpace: 'nowrap' }}>{formatOdds(l.odds, oddsFormat)}</span>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div style={{ fontWeight: 600 }}>{bet.selection || bet.event || '—'}</div>
          )}
        </div>

        <div className="stack" style={{ gap: 9 }}>
          <Row label="Sport" value={bet.sport} />
          <Row label="Event" value={bet.event} />
          <Row label="Bet type" value={bet.bet_type} />
          <Row label="Date" value={formatDate(bet.placed_at)} />
          <Row label="Stake" value={formatStake(bet.stake, currency, staking)} />
          <Row label="Odds" value={Number(bet.odds) > 0 ? formatOdds(bet.odds, oddsFormat) : null} />
          <Row label="Winnings boost" value={Number(bet.boost) > 0 ? `+${Math.round(Number(bet.boost) * 100)}%` : null} />
          <Row label="Status" value={bet.status ? bet.status[0].toUpperCase() + bet.status.slice(1) : null} />
          <Row label="Return" value={bet.payout != null && bet.payout !== '' ? formatStake(bet.payout, currency, staking) : null} />
          <Row label="Profit" value={profit == null ? null : formatStake(profit, currency, staking, { signed: true })} />
          <Row label="Bookmaker" value={bet.bookmaker} />
          <Row label="Tipster" value={bet.tipster} />
        </div>

        {Array.isArray(bet.tags) && bet.tags.length > 0 && (
          <div style={{ marginTop: 12 }}>
            {bet.tags.map((t) => <span key={t} className="chip">{t}</span>)}
          </div>
        )}

        <div className="row spread" style={{ marginTop: 16, gap: 8 }}>
          {onDelete
            ? <button type="button" className="btn-danger btn-sm" onClick={onDelete}>Delete</button>
            : <span />}
          <div className="row" style={{ gap: 8 }}>
            <button type="button" className="btn-ghost" onClick={onClose}>Close</button>
            <button type="button" className="btn-primary" onClick={onEdit}>Edit</button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
