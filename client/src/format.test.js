import test from 'node:test';
import assert from 'node:assert/strict';
import { amountParts } from './format.js';

const at = (mode, unitSize) => ({ mode, unitSize });

test('Money mode shows money only', () => {
  assert.deepEqual(amountParts(25, 'GBP', at('currency', 10)), { main: '£25.00', sub: null });
});

test('Units mode leads with units and keeps money as the small figure', () => {
  assert.deepEqual(amountParts(25, 'GBP', at('units', 10), { signed: true }), { main: '+2.5u', sub: '+£25.00' });
});

test('Both mode leads with money and adds units', () => {
  assert.deepEqual(amountParts(25, 'GBP', at('both', 25)), { main: '£25.00', sub: '1u' });
});

test('changing the unit size re-expresses the same amount', () => {
  assert.equal(amountParts(50, 'GBP', at('units', 10)).main, '5u');
  assert.equal(amountParts(50, 'GBP', at('units', 25)).main, '2u');
});

test('no unit size falls back to money, and missing amounts show a dash', () => {
  assert.deepEqual(amountParts(25, 'GBP', at('units', 0)), { main: '£25.00', sub: null });
  assert.equal(amountParts(null, 'GBP', at('units', 10)).main, '—');
});

test('bets use the unit size from the day they were placed', async () => {
  const { unitSizeAt, toUnitBets } = await import('./format.js');
  const staking = { mode: 'units', unitSize: 20, unitHistory: [{ from: '', size: 10 }, { from: '2026-10-01', size: 20 }] };
  assert.equal(unitSizeAt(staking, '2026-09-15'), 10);
  assert.equal(unitSizeAt(staking, '2026-10-05'), 20);
  assert.equal(amountParts(10, 'GBP', staking, { at: '2026-09-15' }).main, '1u');
  assert.equal(amountParts(10, 'GBP', staking, { at: '2026-10-05' }).main, '0.5u');
  assert.equal(amountParts(40, 'GBP', staking, { units: 3, signed: true }).main, '+3u');
  const rows = toUnitBets([{ stake: 10, payout: 30, placed_at: '2026-09-15' }, { stake: 20, payout: null, placed_at: '2026-10-05' }], staking);
  assert.deepEqual(rows.map((r) => [r.stake, r.payout]), [[1, 3], [1, null]]);
});
