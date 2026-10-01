// Unit-size history. Bets are stored in money; a "unit" is whatever the user
// says it's worth. When they change that, past bets should keep the unit size
// they were placed under, so we keep a dated history:
//   staking.unitHistory = [{ from: '' | 'YYYY-MM-DD', size }, ...]  (oldest first)
// The first entry covers everything before the next one starts. `staking.unitSize`
// is always the current (latest) size.
import { db } from './db.js';
import { mergeSettings } from './defaults.js';

const DAY = /^\d{4}-\d{2}-\d{2}$/;

function cleanHistory(h) {
  if (!Array.isArray(h)) return [];
  return h
    .map((e) => ({ from: DAY.test(e?.from) ? e.from : '', size: Number(e?.size) }))
    .filter((e) => Number.isFinite(e.size) && e.size > 0)
    .sort((a, b) => (a.from < b.from ? -1 : a.from > b.from ? 1 : 0));
}

// The unit size in force on a given day ('YYYY-MM-DD' or a longer timestamp).
export function unitSizeAt(staking, when) {
  const hist = cleanHistory(staking?.unitHistory);
  const current = Number(staking?.unitSize) || 0;
  if (!hist.length) return current;
  const day = String(when || '').slice(0, 10);
  let size = hist[0].size;
  for (const e of hist) if (e.from && day >= e.from) size = e.size;
  return size;
}

// Work out the stored staking settings after the user saves `incoming`.
// The client never gets to write the history directly: it is derived here from
// the change in unitSize, so a stale client can't clobber it.
//  · size changed         -> new size applies from today; past bets keep theirs
//  · incoming.unitScope = 'all' -> one size for every bet, past and future
//  · user has no bets yet -> nothing to preserve, so just replace it
export function resolveStaking(previous, incoming, { hasBets, today }) {
  const { unitScope, unitFrom, unitHistory: _ignored, ...rest } = incoming || {};
  const staking = { ...(previous || {}), ...rest };
  const prevSize = Number(previous?.unitSize);
  const hist = cleanHistory(previous?.unitHistory);

  // A blank or zero size (e.g. a box cleared mid-edit) is never saved: it would
  // switch every unit control off. Keep the size we had.
  let size = Number(staking.unitSize);
  if (!(size > 0)) {
    size = prevSize > 0 ? prevSize : hist.length ? hist[hist.length - 1].size : 10;
    staking.unitSize = size;
  }

  const start = DAY.test(unitFrom) ? unitFrom : today;
  const base = hist.length ? hist : (prevSize > 0 ? [{ from: '', size: prevSize }] : []);

  if (unitScope === 'all' || !hasBets || !base.length) {
    staking.unitHistory = [{ from: '', size }];
    return staking;
  }
  if (size === base[base.length - 1].size) { staking.unitHistory = base; return staking; }

  const next = base.slice();
  const last = next[next.length - 1];
  if (last.from === start) last.size = size; // changed again the same day
  else next.push({ from: start, size });
  // Collapse a change that landed back on the previous size.
  if (next.length > 1 && next[next.length - 2].size === next[next.length - 1].size) next.pop();
  staking.unitHistory = next;
  return staking;
}

export function loadStaking(userId) {
  const row = db.prepare('SELECT data FROM settings WHERE user_id = ?').get(userId);
  return mergeSettings(row ? JSON.parse(row.data) : null).staking;
}

// Tag each bet with the unit size it was placed under (`_u`, 0 = none set), so
// the stats code can report units that add up bet by bet.
export function withUnits(bets, staking) {
  return bets.map((b) => ({ ...b, _u: unitSizeAt(staking, b.placed_at) }));
}
