import test from 'node:test';
import assert from 'node:assert/strict';
import { unitSizeAt, resolveStaking, withUnits } from '../src/lib/units.js';
import { computeStats, computeAnalytics } from '../src/lib/stats.js';

const opts = { hasBets: true, today: '2026-10-01' };

test('changing the size applies from today and past bets keep their size', () => {
  const s = resolveStaking({ mode: 'units', unitSize: 10 }, { mode: 'units', unitSize: 20 }, opts);
  assert.equal(s.unitSize, 20);
  assert.deepEqual(s.unitHistory, [{ from: '', size: 10 }, { from: '2026-10-01', size: 20 }]);
  assert.equal(unitSizeAt(s, '2026-09-30'), 10);
  assert.equal(unitSizeAt(s, '2026-10-01'), 20);
  assert.equal(unitSizeAt(s, '2026-10-01T18:00:00Z'), 20);
});

test('several changes build a history; same-day edits replace, not stack', () => {
  let s = resolveStaking({ unitSize: 10 }, { unitSize: 20 }, { hasBets: true, today: '2026-08-01' });
  s = resolveStaking(s, { ...s, unitSize: 25 }, { hasBets: true, today: '2026-10-01' });
  s = resolveStaking(s, { ...s, unitSize: 30 }, { hasBets: true, today: '2026-10-01' });
  assert.deepEqual(s.unitHistory.map((e) => e.size), [10, 20, 30]);
  assert.equal(unitSizeAt(s, '2026-09-01'), 20);
  // changing back to the previous size the same day leaves no pointless entry
  s = resolveStaking(s, { ...s, unitSize: 20 }, { hasBets: true, today: '2026-10-01' });
  assert.deepEqual(s.unitHistory.map((e) => e.size), [10, 20]);
});

test('unitScope all rewrites history; no bets means nothing to preserve', () => {
  const two = resolveStaking({ unitSize: 10 }, { unitSize: 20 }, opts);
  const all = resolveStaking(two, { ...two, unitScope: 'all' }, opts);
  assert.deepEqual(all.unitHistory, [{ from: '', size: 20 }]);
  assert.equal('unitScope' in all, false);
  const fresh = resolveStaking({ unitSize: 10 }, { unitSize: 5 }, { hasBets: false, today: '2026-10-01' });
  assert.deepEqual(fresh.unitHistory, [{ from: '', size: 5 }]);
});

test('the client cannot overwrite the history directly', () => {
  const s = resolveStaking({ unitSize: 10 }, { unitSize: 10, unitHistory: [{ from: '2020-01-01', size: 999 }] }, opts);
  assert.deepEqual(s.unitHistory, [{ from: '', size: 10 }]);
});

test('unit totals are summed bet by bet using each bet\'s own size', () => {
  const staking = resolveStaking({ unitSize: 10 }, { unitSize: 20 }, opts);
  const bets = [
    { id: 1, status: 'won', stake: 10, odds: 3, payout: 30, placed_at: '2026-09-01' }, // +£20 = +2u at £10
    { id: 2, status: 'won', stake: 20, odds: 3, payout: 60, placed_at: '2026-10-02' }, // +£40 = +2u at £20
    { id: 3, status: 'lost', stake: 20, odds: 2, placed_at: '2026-10-03' },            // -£20 = -1u
  ];
  const st = computeStats(withUnits(bets, staking));
  assert.equal(st.netProfit, 40);
  assert.equal(st.netProfitU, 3); // not 40/20 = 2
  assert.equal(st.totalStakedU, 3);
  assert.equal(st.biggestWinU, 2);
  const an = computeAnalytics(withUnits(bets, staking));
  assert.equal(an.overall.profitU, 3);
  assert.equal(an.biggestLossU, -1);
});

test('a zero or blank unit size is never saved, and a saved zero heals', async () => {
  const { mergeSettings } = await import('../src/lib/defaults.js');
  const prev = { mode: 'both', unitSize: 10, unitHistory: [{ from: '', size: 10 }] };
  for (const bad of [0, '', null, -5, 'abc']) {
    const s = resolveStaking(prev, { ...prev, unitSize: bad }, opts);
    assert.equal(s.unitSize, 10, `unitSize ${JSON.stringify(bad)} keeps the old size`);
    assert.deepEqual(s.unitHistory, [{ from: '', size: 10 }]);
  }
  // Accounts already stored with 0 recover on read.
  assert.equal(mergeSettings({ staking: { mode: 'both', unitSize: 0, unitHistory: [{ from: '', size: 10 }, { from: '2026-09-01', size: 25 }] } }).staking.unitSize, 25);
  assert.equal(mergeSettings({ staking: { mode: 'both', unitSize: 0 } }).staking.unitSize, 10);
});

test('deleting an account cancels every live Stripe subscription, and surfaces failures', async () => {
  const { cancelAllSubscriptions } = await import('../src/lib/stripe.js');
  const cancelled = [];
  const subs = [{ id: 'sub_a', status: 'active' }, { id: 'sub_b', status: 'canceled' }, { id: 'sub_c', status: 'trialing' }, { id: 'sub_d', status: 'past_due' }];
  const client = {
    subscriptions: {
      list: () => (async function* () { yield* subs; })(),
      cancel: async (id) => { cancelled.push(id); },
    },
  };
  assert.equal(await cancelAllSubscriptions('cus_1', client), 3);
  assert.deepEqual(cancelled, ['sub_a', 'sub_c', 'sub_d']);
  assert.equal(await cancelAllSubscriptions(null, client), 0, 'no customer, nothing to cancel');
  assert.equal(await cancelAllSubscriptions('cus_1', null), 0, 'billing not configured');
  const failing = { subscriptions: { list: () => (async function* () { yield { id: 'sub_x', status: 'active' }; })(), cancel: async () => { throw new Error('stripe down'); } } };
  await assert.rejects(() => cancelAllSubscriptions('cus_1', failing), /stripe down/);
});

test('subscription dates: trial end, cancel at period end, newer item-level period end', async () => {
  const { describeSubscription } = await import('../src/lib/stripe.js');
  assert.deepEqual(describeSubscription({ status: 'trialing', trial_end: 1800000000, current_period_end: 1800000000 }), { endsAt: 1800000000, cancelling: false });
  assert.deepEqual(describeSubscription({ status: 'trialing', trial_end: 1800000000, cancel_at_period_end: true, cancel_at: 1800000000 }), { endsAt: 1800000000, cancelling: true });
  assert.deepEqual(describeSubscription({ status: 'active', cancel_at_period_end: true, items: { data: [{ current_period_end: 1810000000 }] } }), { endsAt: 1810000000, cancelling: true });
  assert.deepEqual(describeSubscription({ status: 'active', current_period_end: 1820000000 }), { endsAt: 1820000000, cancelling: false });
  assert.deepEqual(describeSubscription(null), { endsAt: null, cancelling: false });
});
