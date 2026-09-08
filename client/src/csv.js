// Small, dependency-free CSV helpers for exporting and importing bets.

const EXPORT_COLUMNS = [
  ['placed_at', 'Date'],
  ['sport', 'Sport'],
  ['event', 'Event'],
  ['selection', 'Selection'],
  ['bet_type', 'Bet type'],
  ['bookmaker', 'Bookmaker'],
  ['tipster', 'Tipster'],
  ['stake', 'Stake'],
  ['odds', 'Odds'],
  ['status', 'Status'],
  ['payout', 'Payout'],
  ['notes', 'Notes'],
  ['tags', 'Tags'],
];

// Quote a field only when it needs it (comma, quote, or newline).
function csvCell(value) {
  const s = value == null ? '' : String(value);
  return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

export function betsToCsv(bets) {
  const header = EXPORT_COLUMNS.map(([, label]) => label).join(',');
  const lines = bets.map((b) =>
    EXPORT_COLUMNS.map(([key]) => {
      if (key === 'tags') return csvCell((b.tags || []).join('; '));
      return csvCell(b[key]);
    }).join(',')
  );
  return [header, ...lines].join('\r\n');
}

// RFC-4180-ish parser: handles quoted fields, escaped quotes and newlines
// inside quotes. Returns an array of string arrays (rows of cells).
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let inQuotes = false;
  const src = text.replace(/^﻿/, ''); // strip BOM
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (inQuotes) {
      if (c === '"') {
        if (src[i + 1] === '"') { cell += '"'; i++; }
        else inQuotes = false;
      } else cell += c;
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(cell); cell = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++;
      row.push(cell); cell = '';
      rows.push(row); row = [];
    } else cell += c;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  // Drop trailing fully-empty rows.
  return rows.filter((r) => r.some((v) => v.trim() !== ''));
}

// Header aliases → canonical bet field. Lets people bring CSVs from other
// trackers without renaming columns first.
const HEADER_MAP = {
  date: 'placed_at', 'placed at': 'placed_at', placed_at: 'placed_at', day: 'placed_at',
  sport: 'sport', category: 'sport', league: 'sport',
  event: 'event', match: 'event', game: 'event', fixture: 'event',
  selection: 'selection', pick: 'selection', bet: 'selection', tip: 'selection',
  'bet type': 'bet_type', bet_type: 'bet_type', type: 'bet_type', market: 'bet_type',
  bookmaker: 'bookmaker', bookie: 'bookmaker', book: 'bookmaker', sportsbook: 'bookmaker',
  tipster: 'tipster', tipper: 'tipster', source: 'tipster',
  stake: 'stake', wager: 'stake', risk: 'stake', amount: 'stake',
  odds: 'odds', price: 'odds', decimal: 'odds', 'decimal odds': 'odds',
  status: 'status', result: 'status', outcome: 'status',
  payout: 'payout', return: 'payout', returns: 'payout', 'return amount': 'payout',
  notes: 'notes', note: 'notes', comment: 'notes', comments: 'notes',
  tags: 'tags', tag: 'tags', labels: 'tags',
};

const STATUS_MAP = {
  won: 'won', win: 'won', w: 'won', winner: 'won',
  lost: 'lost', loss: 'lost', lose: 'lost', l: 'lost', loser: 'lost',
  pending: 'pending', open: 'pending', unsettled: 'pending', p: 'pending', '': 'pending',
  void: 'void', voided: 'void', push: 'void', cancelled: 'void', canceled: 'void', refund: 'void',
  cashout: 'cashout', 'cash out': 'cashout', 'cashed out': 'cashout',
};

// Turn assorted date strings into YYYY-MM-DD; leave good ISO dates alone.
function normaliseDate(v) {
  const s = (v || '').trim();
  if (!s) return '';
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  // DD/MM/YYYY or MM/DD/YYYY — assume day-first (UK bettors), fall back safely.
  const m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/);
  if (m) {
    let [, a, b, y] = m;
    if (y.length === 2) y = '20' + y;
    const day = a.padStart(2, '0');
    const mon = b.padStart(2, '0');
    return `${y}-${mon}-${day}`;
  }
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? s : d.toISOString().slice(0, 10);
}

function num(v) {
  if (v == null) return '';
  const n = Number(String(v).replace(/[^0-9.\-]/g, ''));
  return Number.isFinite(n) ? n : '';
}

// Parse a bets CSV into ready-to-POST bet objects. Returns { bets, skipped,
// headers } — skipped counts rows with neither a selection/event nor a stake.
export function csvToBets(text) {
  const rows = parseCsv(text);
  if (rows.length < 2) return { bets: [], skipped: 0, headers: [] };
  const headers = rows[0].map((h) => h.trim().toLowerCase());
  const idx = {};
  headers.forEach((h, i) => { const key = HEADER_MAP[h]; if (key && !(key in idx)) idx[key] = i; });

  const get = (cells, key) => (idx[key] != null ? (cells[idx[key]] || '').trim() : '');
  const bets = [];
  let skipped = 0;
  for (let r = 1; r < rows.length; r++) {
    const cells = rows[r];
    const selection = get(cells, 'selection');
    const event = get(cells, 'event');
    const stakeRaw = get(cells, 'stake');
    // Need at least something identifying and a stake to be a real bet.
    if (!selection && !event && !stakeRaw) { skipped++; continue; }
    const statusRaw = get(cells, 'status').toLowerCase();
    const tagsRaw = get(cells, 'tags');
    bets.push({
      placed_at: normaliseDate(get(cells, 'placed_at')),
      sport: get(cells, 'sport'),
      event,
      selection,
      bet_type: get(cells, 'bet_type'),
      bookmaker: get(cells, 'bookmaker'),
      tipster: get(cells, 'tipster'),
      stake: num(stakeRaw),
      odds: num(get(cells, 'odds')),
      status: STATUS_MAP[statusRaw] || 'pending',
      payout: idx.payout != null && get(cells, 'payout') !== '' ? num(get(cells, 'payout')) : '',
      notes: get(cells, 'notes'),
      tags: tagsRaw ? tagsRaw.split(/[;|]/).map((t) => t.trim()).filter(Boolean) : [],
    });
  }
  return { bets, skipped, headers };
}

// Trigger a client-side file download of a CSV string.
export function downloadCsv(filename, csv) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
