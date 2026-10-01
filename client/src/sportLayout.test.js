// Run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sportLayout } from './sportLayout.js';

const versus = [
  'Football', 'Soccer', 'Tennis', 'Table Tennis', 'Badminton', 'Squash', 'Basketball', 'Netball',
  'Volleyball', 'Beach Volleyball', 'Handball', 'Cricket', 'Rugby', 'Rugby League', 'Rugby Union',
  'Aussie Rules', 'AFL', 'Gaelic Football', 'Hurling', 'American Football', 'NFL', 'Baseball', 'MLB',
  'Ice Hockey', 'NHL', 'Boxing', 'MMA / UFC', 'UFC', 'WWE', 'Esports', 'CS2', 'League of Legends',
  'Pool', 'Bowls', 'Chess', 'Politics', 'TV / Specials', 'Eurovision', 'Water Polo', 'Other', '',
];
const racing = [
  'Horse Racing', 'horse racing', 'Horses', 'Racing', 'Greyhounds', 'Greyhound Racing', 'Dogs',
  'Dog Racing', 'Harness Racing', 'Trotting', 'Pigeon Racing', 'Camel Racing',
];
const field = [
  'Golf', 'Motorsport', 'Motor Racing', 'Formula 1', 'F1', 'Formula One', 'Formula E', 'MotoGP',
  'Moto GP', 'NASCAR', 'IndyCar', 'Rally', 'WRC', 'Speedway', 'Cycling', 'Tour de France',
  'Athletics', 'Olympics', 'Swimming', 'Marathon', 'Triathlon', 'Poker', 'Sailing', 'Skiing',
  'Surfing', 'Rowing', 'Darts', 'Snooker',
];

test('head-to-head sports use the versus layout', () => {
  for (const s of versus) assert.equal(sportLayout(s), 'versus', s);
});
test('racing sports use the racing layout', () => {
  for (const s of racing) assert.equal(sportLayout(s), 'racing', s);
});
test('single-event sports use the field layout', () => {
  for (const s of field) assert.equal(sportLayout(s), 'field', s);
});
test('matching ignores case and surrounding spaces', () => {
  assert.equal(sportLayout('  HORSE RACING '), 'racing');
  assert.equal(sportLayout(' motogp'), 'field');
});
test('motor racing is a field sport, not horse-style racing', () => {
  assert.equal(sportLayout('Motor Racing'), 'field');
  assert.equal(sportLayout('Drag Racing'), 'field');
});
test('missing sport defaults to versus', () => {
  assert.equal(sportLayout(undefined), 'versus');
  assert.equal(sportLayout(null), 'versus');
});
