import test from 'node:test';
import assert from 'node:assert/strict';
import { ewReturns, settlePayout } from './settle.js';

test('each-way returns: £10 each-way at 5.0 (4/1) with 1/4 place terms', () => {
  // £10 win + £10 place = £20 outlay. Win part 10 x 5 = 50. Place part 10 x (1 + 4 x 1/4) = 20.
  assert.deepEqual(ewReturns(10, 5, '1/4'), { win: 70, place: 20, lose: 0, outlay: 20 });
});

test('each-way returns: long odds and different place terms', () => {
  // £5 e/w at 11.0 (10/1), 1/5 terms: win part 55, place part 5 x (1 + 10/5) = 15
  assert.deepEqual(ewReturns(5, 11, '1/5'), { win: 70, place: 15, lose: 0, outlay: 10 });
  // 1/3 terms: place part 5 x (1 + 10/3) = 21.67
  assert.equal(ewReturns(5, 11, '1/3').place, 21.67);
  // a missing fraction falls back to 1/5
  assert.equal(ewReturns(5, 11, '').place, 15);
});

test('each-way: a winnings boost lifts the profit only, never the stake', () => {
  // £10 e/w at 5.0, 1/4: win returns 70 on a 20 outlay (50 profit); +50% boost -> 20 + 75 = 95
  assert.equal(ewReturns(10, 5, '1/4', 0.5).win, 95);
  // placed at exactly break-even has no profit to boost
  assert.equal(ewReturns(10, 5, '1/4', 0.5).place, 20);
  // a place that returns less than the outlay is not boosted either
  assert.equal(ewReturns(10, 1.5, '1/5', 0.5).place, 11);
});

test('the form\'s numbers match the quick-settle buttons', () => {
  const bet = { stake: 20, odds: 5, each_way: 1, ew_fraction: '1/4', boost: 0.25 }; // £10 per part, stored doubled
  const r = ewReturns(10, 5, '1/4', 0.25);
  assert.equal(settlePayout(bet, 'won'), r.win);
  assert.equal(settlePayout(bet, 'placed'), r.place);
  assert.equal(settlePayout(bet, 'lost'), 0);
});

test('a place that pays less than the total outlay is a loss, not break-even', () => {
  // £10 e/w at 3.0, 1/5 terms: place part pays 10 x (1 + 2/5) = 14 on a 20 outlay
  const bet = { stake: 20, odds: 3, each_way: 1, ew_fraction: '1/5', boost: 0 };
  assert.equal(settlePayout(bet, 'placed'), 14);
  assert.equal(ewReturns(10, 3, '1/5').place, 14);
  // and a boost does not turn it into a profit
  assert.equal(settlePayout({ ...bet, boost: 0.5 }, 'placed'), 14);
});
