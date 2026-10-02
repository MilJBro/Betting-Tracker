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

test('the type follows the matches involved, not the bookmaker\'s "Bet Builder" label or the model\'s guess', () => {
  const threeMatches = [
    { type: 'builder', odds: 6.5, event: 'Belgium v Türkiye', selections: ['A', 'B'] },
    { type: 'builder', odds: 2.7, event: 'Croatia v England', selections: ['C', 'D'] },
    { type: 'single', odds: 2.6, event: 'North Macedonia v Scotland', selections: ['E'] },
  ];
  // model wrongly says "Bet builder" because every part is headed "Bet Builder"
  const acca = normalizeBet({ ...base, bet_type: 'Bet builder', event: 'Belgium v Türkiye', parts: threeMatches });
  assert.equal(acca.bet_type, 'Accumulator');
  assert.equal(acca.event, '', 'no single event for a multi-match bet');
  assert.equal(acca.odds, 45.63);

  // model wrongly says "Accumulator" for several selections in ONE match
  const builder = normalizeBet({
    ...base, bet_type: 'Accumulator', payout: 65,
    parts: [{ type: 'builder', odds: 6.5, event: 'Arsenal v Chelsea', selections: ['Saka to score', 'Over 2.5 goals', 'Havertz 1+ shot'] }],
  });
  assert.equal(builder.bet_type, 'Bet builder');
  assert.equal(builder.event, 'Arsenal v Chelsea');
  assert.equal(builder.odds, 6.5);
  assert.equal(builder.legs.length, 3);
  assert.ok(builder.legs.every((l) => l.odds === 0), 'builder selections share one price');

  // one selection is a single whatever the model called it
  const single = normalizeBet({ ...base, bet_type: 'Accumulator', parts: [{ type: 'single', odds: 2, event: 'A v B', selections: ['A to win'] }] });
  assert.equal(single.bet_type, 'Single');
  assert.equal(single.event, 'A v B');
});

test('without parts, "builder" selections that each have their own price are an accumulator', () => {
  const b = normalizeBet({ ...base, bet_type: 'Bet builder', odds: 6, legs: [{ selection: 'A', odds: 2 }, { selection: 'B', odds: 3 }] });
  assert.equal(b.bet_type, 'Accumulator');
  const real = normalizeBet({ ...base, bet_type: 'Bet builder', odds: 6.5, legs: [{ selection: 'A', odds: 0 }, { selection: 'B', odds: 0 }] });
  assert.equal(real.bet_type, 'Bet builder');
});

// ---- other sports ----------------------------------------------------------
import { canonicalSport, normalizeEvent } from '../src/routes/scan.js';

test('slip sport names map onto the names the app knows, for every sport', () => {
  const cases = {
    Soccer: 'Football', football: 'Football', NBA: 'Basketball', NCAAB: 'Basketball', NFL: 'American Football',
    'American football': 'American Football', MLB: 'Baseball', NHL: 'Ice Hockey', UFC: 'MMA / UFC', MMA: 'MMA / UFC',
    'Formula 1': 'Motorsport', F1: 'Motorsport', NASCAR: 'Motorsport', 'Horse racing': 'Horse Racing', Racing: 'Horse Racing',
    Dogs: 'Greyhounds', Greyhounds: 'Greyhounds', Tennis: 'Tennis', 'Rugby Union': 'Rugby', 'Rugby League': 'Rugby',
    Cricket: 'Cricket', Golf: 'Golf', Darts: 'Darts', Snooker: 'Snooker', Boxing: 'Boxing', 'CS2': 'Esports', Valorant: 'Esports',
    Handball: 'Handball', '': '',
  };
  for (const [raw, want] of Object.entries(cases)) assert.equal(canonicalSport(raw), want, raw);
});

test('events are written Home v Away whatever the sport or slip style', () => {
  assert.equal(normalizeEvent('Lakers @ Celtics'), 'Celtics v Lakers', 'US style away @ home');
  assert.equal(normalizeEvent('Djokovic vs. Alcaraz'), 'Djokovic v Alcaraz');
  assert.equal(normalizeEvent('Fury versus Usyk'), 'Fury v Usyk');
  assert.equal(normalizeEvent('Arsenal v Chelsea'), 'Arsenal v Chelsea');
  assert.equal(normalizeEvent('Ascot 15:30'), 'Ascot 15:30');
  assert.equal(normalizeEvent('The Masters'), 'The Masters');
});

test('an accumulator across different sports is a Multi-sport accumulator', () => {
  const b = normalizeBet({
    stake: 10, payout: 0, status: 'pending', bookmaker: 'Paddy Power',
    parts: [
      { type: 'single', odds: 1.8, sport: 'Soccer', event: 'Arsenal v Chelsea', selections: ['Arsenal to win'] },
      { type: 'single', odds: 2.1, sport: 'Tennis', event: 'Djokovic vs Alcaraz', selections: ['Djokovic to win'] },
      { type: 'single', odds: 3.5, sport: 'Horse Racing', event: 'Ascot 15:30', selections: ['Frankel'] },
      { type: 'single', odds: 1.909, sport: 'NBA', event: 'Lakers @ Celtics', selections: ['Celtics -4.5'] },
    ],
  });
  assert.equal(b.bet_type, 'Accumulator');
  assert.equal(b.sport, 'Multi-sport');
  assert.equal(b.legs.length, 4);
  assert.equal(b.odds, Number((1.8 * 2.1 * 3.5 * 1.909).toFixed(3)));
});

test('an accumulator within one sport keeps that sport, in any sport', () => {
  for (const [sport, want] of [['Soccer', 'Football'], ['NBA', 'Basketball'], ['Horse racing', 'Horse Racing'], ['Cricket', 'Cricket'], ['MLB', 'Baseball']]) {
    const b = normalizeBet({ stake: 5, parts: [2, 3].map((o, i) => ({ type: 'single', odds: o, sport, event: `E${i}`, selections: [`S${i}`] })) });
    assert.equal(b.bet_type, 'Accumulator'); assert.equal(b.sport, want); assert.equal(b.odds, 6);
  }
});

test('a US same game parlay is a bet builder; a parlay across games is an accumulator', () => {
  const sgp = normalizeBet({
    stake: 10, sport: 'NBA',
    parts: [{ type: 'builder', odds: 4.5, sport: 'NBA', event: 'Lakers @ Celtics', selections: ['Tatum over 27.5 points', 'Celtics moneyline'] }],
  });
  assert.equal(sgp.bet_type, 'Bet builder'); assert.equal(sgp.sport, 'Basketball'); assert.equal(sgp.event, 'Celtics v Lakers'); assert.equal(sgp.odds, 4.5);
  const parlay = normalizeBet({
    stake: 10,
    parts: [
      { type: 'single', odds: 1.909, sport: 'NFL', event: 'Chiefs @ Bills', selections: ['Bills -2.5'] },
      { type: 'single', odds: 2.4, sport: 'NFL', event: 'Cowboys @ Eagles', selections: ['Eagles ML'] },
    ],
  });
  assert.equal(parlay.bet_type, 'Accumulator'); assert.equal(parlay.sport, 'American Football');
});

test('racing: a double across different races is an accumulator; an each-way single keeps its terms', () => {
  const dbl = normalizeBet({
    stake: 10, sport: 'Horse Racing',
    parts: [
      { type: 'single', odds: 3, sport: 'Horse Racing', event: 'Ascot 14:00', selections: ['Horse A'] },
      { type: 'single', odds: 4, sport: 'Horse Racing', event: 'Ascot 14:35', selections: ['Horse B'] },
    ],
  });
  assert.equal(dbl.bet_type, 'Accumulator'); assert.equal(dbl.odds, 12); assert.equal(dbl.sport, 'Horse Racing');
  const ew = normalizeBet({
    stake: 10, sport: 'Horse racing', each_way: true, ew_fraction: '1/4', ew_places: 3,
    parts: [{ type: 'single', odds: 6, sport: 'Horse Racing', event: 'Cheltenham 15:30', selections: ['Constitution Hill'] }],
  });
  assert.equal(ew.bet_type, 'Single'); assert.equal(ew.event, 'Cheltenham 15:30');
  assert.equal(ew.each_way, true); assert.equal(ew.ew_fraction, '1/4'); assert.equal(ew.ew_places, 3);
  // golf each-way outright
  const golf = normalizeBet({ stake: 4, each_way: true, ew_fraction: '1/5', ew_places: 5,
    parts: [{ type: 'single', odds: 21, sport: 'Golf', event: 'The Masters', selections: ['Rory McIlroy'] }] });
  assert.equal(golf.sport, 'Golf'); assert.equal(golf.each_way, true); assert.equal(golf.ew_places, 5);
});

test('each-way is ignored on accumulators and bet builders, and when not each-way', () => {
  const acca = normalizeBet({ each_way: true, ew_fraction: '1/4', parts: [3, 4].map((o, i) => ({ type: 'single', odds: o, event: `E${i}`, selections: [`S${i}`] })) });
  assert.equal('each_way' in acca, false);
  const plain = normalizeBet({ stake: 5, parts: [{ type: 'single', odds: 2, selections: ['X'] }] });
  assert.equal('each_way' in plain, false);
});

test('individual-sport slips work too: tennis, boxing, MMA, darts, snooker, esports', () => {
  for (const [sport, event, sel] of [['Tennis', 'Sinner v Medvedev', 'Sinner'], ['Boxing', 'Fury v Usyk', 'Usyk'], ['UFC', 'Makhachev v Tsarukyan', 'Makhachev by KO'], ['Darts', 'Littler v Humphries', 'Littler 6-3'], ['Snooker', "O'Sullivan v Trump", 'Trump'], ['CS2', 'Navi v FaZe', 'Navi']]) {
    const b = normalizeBet({ stake: 10, parts: [{ type: 'single', odds: 2.2, sport, event, selections: [sel] }] });
    assert.equal(b.bet_type, 'Single'); assert.equal(b.event, event); assert.equal(b.selection, sel);
  }
});
