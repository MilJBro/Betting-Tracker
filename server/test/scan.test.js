// How a scanned slip becomes a bet. The model's reading is mocked; this covers
// the turning-it-into-odds-and-legs part that went wrong on mixed slips.
import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeBet } from '../src/routes/scan.js';

const base = { sport: 'Football', bookmaker: 'Bet365', stake: 10, payout: 456.3, status: 'pending' };

test('accumulator of two bet builders and a single multiplies the parts (the reported bug)', () => {
  const b = normalizeBet({
    ...base, bet_type: 'Accumulator', odds: 2.6,
    parts: [
      { type: 'builder', odds: 6.5, selections: ['Dodi Lukebakio to Score or Assist', 'Nathan Ngoy: 2+ Fouls Committed'] },
      { type: 'builder', odds: 2.7, selections: ['Anthony Gordon to Score or Assist', 'Ivan Perisic: 1+ Fouls Committed'] },
      { type: 'single', odds: 2.6, selections: ['John McGinn'] },
    ],
  });
  assert.equal(b.bet_type, 'Accumulator');
  assert.equal(b.legs.length, 3, 'one leg per priced part, not one per selection');
  assert.deepEqual(b.legs.map((l) => l.odds), [6.5, 2.7, 2.6]);
  assert.equal(b.legs[0].selection, 'Dodi Lukebakio to Score or Assist + Nathan Ngoy: 2+ Fouls Committed');
  assert.equal(b.odds, 45.63, 'combined odds are worked out, not the last price');
  assert.equal(Math.round(b.stake * b.odds * 100) / 100, 456.3, 'a £10 stake returns £456.30, matching the slip');
  assert.equal(b.event, '');
  assert.equal(b.status, 'pending');
});

test('one missing part price is recovered from the slip\'s return', () => {
  const b = normalizeBet({
    ...base, bet_type: 'Accumulator',
    parts: [
      { type: 'builder', odds: 6.5, selections: ['A', 'B'] },
      { type: 'builder', odds: 0, selections: ['C', 'D'] },
      { type: 'single', odds: 2.6, selections: ['E'] },
    ],
  });
  assert.deepEqual(b.legs.map((l) => l.odds), [6.5, 2.7, 2.6]);
  assert.equal(b.odds, 45.63);
});

test('a winnings boost means the return can\'t be used to back-solve a price', () => {
  const b = normalizeBet({
    ...base, boost_percent: 25, payout: 600,
    parts: [{ type: 'single', odds: 2, selections: ['A'] }, { type: 'single', odds: 0, selections: ['B'] }],
  });
  assert.deepEqual(b.legs.map((l) => l.odds), [2, 0]);
  assert.equal(b.boost, 0.25);
});

test('a plain bet builder stays a bet builder with one combined price', () => {
  const b = normalizeBet({
    ...base, payout: 65, event: 'Arsenal v Chelsea',
    parts: [{ type: 'builder', odds: 6.5, selections: ['Saka to score', 'Over 2.5 goals'] }],
  });
  assert.equal(b.bet_type, 'Bet builder');
  assert.equal(b.odds, 6.5);
  assert.equal(b.event, 'Arsenal v Chelsea');
  assert.deepEqual(b.legs.map((l) => l.odds), [0, 0]);
});

test('a single bet and an ordinary accumulator of singles still work', () => {
  const single = normalizeBet({ ...base, event: 'Arsenal v Chelsea', parts: [{ type: 'single', odds: 2.5, selections: ['Arsenal to win'] }] });
  assert.equal(single.bet_type, 'Single'); assert.equal(single.odds, 2.5); assert.deepEqual(single.legs, []);
  const acca = normalizeBet({ ...base, parts: [2, 3, 1.5].map((o, i) => ({ type: 'single', odds: o, selections: ['L' + i] })) });
  assert.equal(acca.bet_type, 'Accumulator'); assert.equal(acca.odds, 9); assert.equal(acca.legs.length, 3);
});

test('old-style output without parts is read as before', () => {
  const b = normalizeBet({ ...base, bet_type: 'Accumulator', odds: 6, legs: [{ selection: 'A', odds: 2 }, { selection: 'B', odds: 3 }] });
  assert.equal(b.bet_type, 'Accumulator'); assert.equal(b.odds, 6); assert.equal(b.legs.length, 2);
  const junk = normalizeBet({ ...base, parts: 'nonsense', odds: 2, selection: 'X' });
  assert.equal(junk.odds, 2); assert.equal(junk.selection, 'X');
});
