import { Router } from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { requireAuth } from '../lib/auth.js';
import { config } from '../lib/config.js';
import { canScan, recordScan, entitlements } from '../lib/plan.js';

const router = Router();
router.use(requireAuth);

const ALLOWED_MEDIA = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

// The model is asked to return exactly this shape. Money is the source of
// truth; odds are normalised to decimal so they slot straight into the app.
const SYSTEM_PROMPT = `You extract structured data from a screenshot of a betting slip or bet
confirmation from any bookmaker. Return ONLY a single JSON object (no prose, no
markdown code fences) with exactly these keys.

This works for EVERY sport (football, horse racing, greyhounds, tennis, basketball, cricket,
golf, boxing, MMA/UFC, rugby, darts, snooker, American football, baseball, ice hockey,
motorsport, esports and more). An "event" means whatever that sport calls one fixture: a
match, a game, a race, a fight, a round, a tournament or a stage.

THE KEY RULE — decide the bet type by counting the distinct matches/events involved,
NOT by the words printed on the slip:
  · SINGLE: one selection.
  · BET BUILDER (same game multi): two or more selections ALL within ONE match/event,
    sharing ONE combined price. Other names: Same Game Multi (SGM), Same Game Parlay (SGP),
    BetBuilder, #YourOdds, Build-a-bet. Typical examples: a footballer to score + over 2.5
    goals; an NBA player over 25.5 points + the same team to win; a tennis player to win +
    over 21.5 games in the same match.
  · ACCUMULATOR (acca): selections or parts from TWO OR MORE DIFFERENT matches/events,
    each part priced separately; the total odds are the parts' prices multiplied. Other
    names: Parlay (US), Multi (Australia), Double, Treble, Fourfold, Fivefold and so on.
    Selections from DIFFERENT races, fights, games or tournaments are an accumulator even
    when they are the same sport or the same meeting (a horse racing double/treble across
    different races is an accumulator, and so is a legs-across-sports slip).
Bookmakers print "Bet Builder" on each builder they sell, even when several builders and
singles from different matches sit together on one slip. That is still an ACCUMULATOR,
because it spans different matches. Example: "BET BUILDER 6.50" (Belgium v Türkiye) +
"BET BUILDER 2.70" (Croatia v England) + a single at 2.60 (North Macedonia v Scotland) is
ONE accumulator of three parts priced 6.50, 2.70 and 2.60 — not a bet builder.
Only call it a bet builder when every selection belongs to the same single match.

- selection (string): the main pick. For a multiple/bet builder, join each leg with " / ".
- event (string): the match or event. Head-to-head (football, tennis, basketball, boxing,
  MMA, rugby, cricket, baseball, ice hockey...): write "Home v Away" with a lowercase "v",
  also for US-style "Away @ Home" (so "Lakers @ Celtics" becomes "Celtics v Lakers").
  Horse/greyhound racing: "Course HH:MM", e.g. "Ascot 15:30". Golf, motorsport and other
  field sports: the tournament or race, e.g. "The Masters", "Monaco Grand Prix". "" if not shown.
- sport (string): use EXACTLY one of these names when the sport matches, translating
  whatever the slip says (Soccer -> Football; NBA/NCAAB -> Basketball; NFL/NCAAF ->
  American Football; MLB -> Baseball; NHL -> Ice Hockey; UFC -> MMA / UFC; F1/NASCAR ->
  Motorsport; Racing/Horses -> Horse Racing; Dogs -> Greyhounds):
  Football, Horse Racing, Greyhounds, Tennis, Basketball, Cricket, Golf, Boxing, MMA / UFC,
  Rugby, Darts, Snooker, American Football, Baseball, Ice Hockey, Motorsport, Esports.
  For any other sport write its common English name. "" if unknown.
- bet_type (string): the KIND of bet, by the key rule above. Use exactly one of: "Single",
  "Bet builder" (selections within ONE match — also called Same Game Multi, BetBuilder,
  #YourOdds), "Accumulator" (parts across DIFFERENT matches — includes Double, Treble,
  Fourfold etc., and an accumulator whose parts are themselves bet builders).
  "" only if you genuinely cannot tell.
- parts (array): the PRICED parts of the slip, top to bottom. This is how the slip is
  structured and what the total odds are made from. One object per part:
  { "type": "single" | "builder", "odds": number, "event": string, "sport": string, "selections": [string] }
  "event" is the match/race/fight that part is on, written as described above. "sport" is
  that part's sport (same names as above) — parts of one slip can be DIFFERENT sports.
  · A "single" part is ONE selection with its own odds shown beside it.
  · A "builder" part is a Bet Builder / Same Game Multi: two or more selections in ONE
    match that share ONE combined price, shown on the "Bet Builder" header line (e.g.
    "BET BUILDER 6.50"). Put every selection of that builder in "selections" and that
    header price in "odds" — the individual selections have no price of their own.
  · A slip can MIX these. For example an accumulator can be made of two bet builders
    (each with its own price) plus a single selection: that is THREE parts, and the
    total odds are the three prices multiplied together. Never drop a part's price.
  · A plain single bet is one part with one selection. A plain bet builder is one part
    with several selections. An ordinary accumulator is one "single" part per leg.
  · "odds" for each part in DECIMAL. Convert fractional (5/2 -> 3.5), American (+150 -> 2.5,
    -110 -> 1.909) and "Evens"/"EVS" (-> 2.0). Use 0 for an "SP" (starting price) bet, or if
    the price isn't visible.
- legs (array): optional, only if you did NOT fill in parts: one object per selection:
  { "selection": string, "odds": number }. Put each leg's odds in DECIMAL if the slip shows
  them, otherwise 0. A bet builder usually shows only the combined price, so its legs will
  have odds 0 — that's fine. Use an empty array [] for a Single.
- each_way (boolean): true only if the slip shows an each-way bet ("E/W", "Each Way") on a
  single selection (horse/greyhound racing, golf, etc.). false otherwise.
- ew_fraction (string): the each-way place fraction as shown, e.g. "1/4" or "1/5". "" if not each-way.
- ew_places (number): how many places are paid, e.g. 3 or 4. 0 if not each-way or not shown.
- bookmaker (string): the bookmaker's name if identifiable (e.g. "Bet365", "Sky Bet", "Paddy Power"). "" if unknown.
- stake (number): the TOTAL stake as a plain number in the account currency (e.g. 10.00).
  For an each-way bet that is the total outlay for both parts (£5 E/W = 10.00). 0 if not shown.
- odds (number): the TOTAL odds in DECIMAL format. Convert fractional (e.g. 6/4 -> 2.5) and American (e.g. +150 -> 2.5, -200 -> 1.5). For a multi-part slip this is the parts' prices multiplied together (and should agree with "to return" ÷ stake). 0 if not shown.
- payout (number or null): the potential returns / "to return" amount as a number, or null if not shown.
- boost_percent (number): if the slip shows a WINNINGS boost / profit boost / bet-builder
  boost added to the returns (e.g. "25% Boost", "Boost +50%", "Profit Boost applied"), the
  percentage as a plain number (e.g. 25 or 50). 0 if there is no such boost. Do NOT use this
  for an enhanced/boosted PRICE that is already baked into the odds.
- placed_at (string or null): the bet date as YYYY-MM-DD if clearly shown, else null.
- status (string): one of "pending","won","lost","void","cashout". Use "pending" for an open/unsettled slip unless it clearly shows the outcome. A "Cash Out £x" BUTTON is an offer, not a result, and green ticks, progress bars, live scores and "SUB ON PLAY ON" labels only describe a match in play — the bet is still "pending".
- currency (string or null): "GBP","USD","EUR","AUD","CAD" if identifiable from a symbol or code, else null.
- confidence (number): 0..1, your overall confidence in the extraction.

Rules: output valid JSON and nothing else. Use "" for unknown text fields and 0
for unknown numbers, except payout, placed_at and currency which use null. Never
invent values you cannot actually see in the image.`;

// The sport names the app's slip layouts and stats are built around. The model
// is asked for these, but slips say NBA, Soccer, UFC and so on, so map the
// common aliases here rather than trusting it. Unknown sports are kept as given.
const SPORT_ALIASES = [
  [/^(football|soccer|association football)$/i, 'Football'],
  [/horse|^racing$|^horses$/i, 'Horse Racing'],
  [/greyhound|^dogs?$/i, 'Greyhounds'],
  [/tennis/i, 'Tennis'],
  [/basketball|^nba$|^wnba$|^ncaab$|euroleague/i, 'Basketball'],
  [/cricket/i, 'Cricket'],
  [/golf/i, 'Golf'],
  [/boxing/i, 'Boxing'],
  [/mma|ufc|mixed martial/i, 'MMA / UFC'],
  [/rugby/i, 'Rugby'],
  [/darts/i, 'Darts'],
  [/snooker|pool/i, 'Snooker'],
  [/american football|^nfl$|^ncaaf$|gridiron/i, 'American Football'],
  [/baseball|^mlb$/i, 'Baseball'],
  [/ice hockey|^nhl$|^hockey$/i, 'Ice Hockey'],
  [/motorsport|motor racing|formula|^f1$|nascar|indycar|motogp|rally/i, 'Motorsport'],
  [/esport|e-sport|counter-strike|^cs2?$|dota|league of legends|valorant/i, 'Esports'],
];
export function canonicalSport(raw) {
  const s = String(raw || '').trim();
  if (!s) return '';
  const hit = SPORT_ALIASES.find(([re]) => re.test(s));
  return hit ? hit[1] : s;
}

// Head-to-head events are stored as "Home v Away". US slips print "Away @ Home",
// which is the same fixture the other way round, and some say "vs".
export function normalizeEvent(raw) {
  const e = String(raw || '').trim();
  if (!e) return '';
  const at = e.split(/\s+@\s+/);
  if (at.length === 2 && at[0] && at[1]) return `${at[1].trim()} v ${at[0].trim()}`;
  return e.replace(/\s+(?:vs\.?|versus)\s+/i, ' v ');
}

function coerceNumber(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

// `output_config.effort` is only supported on the larger models (Opus/Sonnet 5,
// Fable, etc.). Haiku 4.5 and Sonnet 4.5 reject it with a 400, so we omit it
// there — otherwise the whole scan fails and the user just sees "add manually".
// Extraction from a bet slip is a simple task, so dropping effort costs nothing.
function supportsEffort(model) {
  return !/haiku|sonnet-4-5|sonnet-3/i.test(model || '');
}
function modelOptions() {
  return supportsEffort(config.anthropic.model)
    ? { output_config: { effort: 'low' } }
    : {};
}

// Map the model's raw JSON into the app's bet shape. Unknown fields stay blank
// so the user just fills the gaps rather than fighting wrong guesses. Exported
// for testing.
// Turn the slip's priced parts into the app's bet shape. An accumulator leg that
// is itself a bet builder keeps ONE price for its group of selections, so the
// combined odds (and the return) come out right. Returns null if there are no
// usable parts, so the caller falls back to the older single/legs reading.
function fromParts(parsed, stake, payout, boostPct) {
  if (!Array.isArray(parsed.parts)) return null;
  const parts = parsed.parts
    .map((p) => ({
      odds: coerceNumber(p?.odds),
      event: normalizeEvent(p?.event),
      sport: canonicalSport(p?.sport),
      selections: (Array.isArray(p?.selections) ? p.selections : [p?.selection])
        .map((x) => String(x || '').trim())
        .filter(Boolean),
    }))
    .filter((p) => p.selections.length);
  if (!parts.length) return null;

  if (parts.length === 1) {
    const [p] = parts;
    if (p.selections.length === 1) {
      return { bet_type: 'Single', selection: p.selections[0], odds: p.odds, legs: [], event: p.event, sport: p.sport };
    }
    return {
      bet_type: 'Bet builder',
      event: p.event,
      sport: p.sport,
      selection: p.selections.join(' / '),
      odds: p.odds,
      legs: p.selections.map((s) => ({ selection: s, odds: 0 })),
    };
  }

  // Several parts: an accumulator. Each part is one leg priced as a whole.
  const legs = parts.map((p) => ({ selection: p.selections.join(' + '), odds: p.odds > 1 ? p.odds : 0 }));
  const unpriced = legs.filter((l) => !(l.odds > 1));
  // The slip's "to return" ÷ stake is the total odds. Use it to recover ONE
  // missing price (but not when a winnings boost has inflated the return).
  const implied = stake > 0 && payout > 0 && !(boostPct > 0) ? payout / stake : 0;
  if (unpriced.length === 1 && implied > 1) {
    const known = legs.filter((l) => l.odds > 1).reduce((acc, l) => acc * l.odds, 1);
    const missing = implied / known;
    if (missing > 1) unpriced[0].odds = Number(missing.toFixed(2));
  }
  const priced = legs.filter((l) => l.odds > 1);
  const total = priced.length ? priced.reduce((acc, l) => acc * l.odds, 1) : 0;
  // One sport if every part agrees; otherwise it's a mixed-sport accumulator.
  const sports = [...new Set(parts.map((p) => p.sport).filter(Boolean))];
  return {
    bet_type: 'Accumulator',
    event: '',
    sport: sports.length > 1 ? 'Multi-sport' : sports[0] || '',
    selection: legs.map((l) => l.selection).join(' / '),
    odds: Number(total.toFixed(3)),
    legs,
  };
}

export function normalizeBet(parsed) {
  const statuses = ['pending', 'won', 'lost', 'void', 'cashout'];
  const legs = Array.isArray(parsed.legs)
    ? parsed.legs
        .map((l) => ({ selection: String(l?.selection || '').trim(), odds: coerceNumber(l?.odds) }))
        .filter((l) => l.selection)
    : [];
  // Winnings boost is stored as a fraction of the profit (0.25 = +25%).
  const boostPct = coerceNumber(parsed.boost_percent);
  const stake = coerceNumber(parsed.stake);
  const payout = parsed.payout == null ? '' : coerceNumber(parsed.payout);
  const built = fromParts(parsed, stake, payout === '' ? 0 : payout, boostPct);
  // Without parts, fall back on the model's label — but a bet builder is ONE price
  // for selections in one match, so selections that each carry their own price
  // are separate matches multiplied together: an accumulator.
  let betType = built ? built.bet_type : String(parsed.bet_type || '').trim();
  // Each-way only applies to a single selection; keep the terms the slip shows.
  const isSingle = betType === 'Single' || (!betType && legs.length < 2);
  const eachWay = isSingle && (parsed.each_way === true || parsed.each_way === 'true');
  const ewFraction = eachWay ? String(parsed.ew_fraction || '').trim().replace(/\s+/g, '') : '';
  const ewPlaces = eachWay ? Math.max(0, Math.round(coerceNumber(parsed.ew_places))) : 0;
  if (!built && /builder/i.test(betType) && legs.filter((l) => l.odds > 1).length >= 2) betType = 'Accumulator';
  return {
    selection: built ? built.selection : String(parsed.selection || '').trim(),
    // An accumulator spans several matches, so it has no single event.
    event: built
      ? (built.event || (built.bet_type === 'Accumulator' ? '' : normalizeEvent(parsed.event)))
      : normalizeEvent(parsed.event),
    sport: (built && built.sport) || canonicalSport(parsed.sport),
    bet_type: betType,
    bookmaker: String(parsed.bookmaker || '').trim(),
    stake,
    odds: built && built.odds > 0 ? built.odds : coerceNumber(parsed.odds),
    payout,
    placed_at:
      typeof parsed.placed_at === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(parsed.placed_at)
        ? parsed.placed_at
        : new Date().toISOString().slice(0, 10),
    status: statuses.includes(parsed.status) ? parsed.status : 'pending',
    boost: boostPct > 0 ? Math.min(3, boostPct / 100) : 0,
    legs: built ? built.legs : legs,
    ...(eachWay ? { each_way: true, ew_fraction: ewFraction || '1/5', ew_places: ewPlaces || '' } : {}),
  };
}

export function extractJson(text) {
  if (!text) return null;
  // Strip any accidental code fences, then take the outermost {...}.
  const cleaned = text.replace(/```json\s*|\s*```/g, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    return null;
  }
}

// POST /api/bets/scan  { image: <base64>, mediaType: 'image/jpeg' }
router.post('/', async (req, res) => {
  if (!config.anthropic.apiKey) {
    return res.status(503).json({
      error:
        'Bet scanning isn’t enabled on this server. Set ANTHROPIC_API_KEY to turn it on.',
    });
  }

  // Free plans get a limited number of scans per month; Pro is unlimited.
  // Check before spending a paid vision call.
  if (!canScan(req.userId)) {
    const e = entitlements(req.userId);
    return res.status(402).json({
      error: `You've used all ${e.scans.limit} free scans this month. Head to Plans to go unlimited with Pro.`,
      upgrade: true,
      scans: e.scans,
    });
  }

  // Accept either one image ({ image, mediaType }) or several
  // ({ images: [{ data, mediaType }] }) — a long slip is often captured in parts.
  const body = req.body || {};
  let rawImages = [];
  if (Array.isArray(body.images)) rawImages = body.images;
  else if (typeof body.image === 'string') rawImages = [{ data: body.image, mediaType: body.mediaType }];

  const images = rawImages
    .filter((x) => x && typeof x.data === 'string')
    .slice(0, 4) // cap the number of screenshots per scan
    .map((x) => ({ data: x.data, media: ALLOWED_MEDIA.includes(x.mediaType) ? x.mediaType : 'image/jpeg' }));

  if (!images.length) {
    return res.status(400).json({ error: 'No image provided.' });
  }
  // base64 payload guard across all images (~16MB base64 ≈ 12MB of images).
  const totalBytes = images.reduce((sum, x) => sum + x.data.length, 0);
  if (totalBytes > 16_000_000) {
    return res.status(413).json({ error: 'Those images are too large — try fewer or smaller screenshots.' });
  }

  try {
    // Bound the upstream call so a slow/overloaded model returns a clean error
    // instead of leaving the request hanging until the platform drops it (which
    // the browser surfaces as an opaque "Load failed"). Allow a little longer
    // when several images have to be read together.
    const client = new Anthropic({
      apiKey: config.anthropic.apiKey,
      timeout: images.length > 1 ? 45000 : 30000,
      maxRetries: 0,
    });
    const imageBlocks = images.map((im) => ({
      type: 'image',
      source: { type: 'base64', media_type: im.media, data: im.data },
    }));
    const instruction = images.length > 1
      ? `These ${images.length} images are screenshots of the SAME bet slip, captured in parts because it was too long to fit one screen (roughly top to bottom, possibly overlapping). Combine them into ONE bet: merge every selection/leg across all the images, in order, and do NOT duplicate a leg that appears in more than one image. Return a single JSON object as instructed.`
      : 'Extract the bet from this slip.';
    const message = await client.messages.create({
      model: config.anthropic.model,
      max_tokens: 3000,
      ...modelOptions(),
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: [...imageBlocks, { type: 'text', text: instruction }],
        },
      ],
    });

    if (message.stop_reason === 'refusal') {
      return res.status(422).json({ error: 'Couldn’t read that image. Try a clearer screenshot.' });
    }

    const text = message.content
      .filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join('\n');
    const parsed = extractJson(text);
    if (!parsed) {
      return res.status(422).json({ error: 'Couldn’t read a bet from that image. Try a clearer screenshot.' });
    }

    const bet = normalizeBet(parsed);

    const confidence =
      typeof parsed.confidence === 'number' ? Math.max(0, Math.min(1, parsed.confidence)) : null;

    // Count this scan against the monthly quota (only on success).
    recordScan(req.userId);

    res.json({ bet, confidence, currency: parsed.currency || null, scans: entitlements(req.userId).scans });
  } catch (err) {
    console.error('[scan] extraction failed:', err?.status || '', err?.message || err);
    let msg = 'Bet scanning is temporarily unavailable — please try again in a moment.';
    if (err?.status === 401 || err?.status === 403) {
      msg = 'Bet scanning is misconfigured on the server (invalid API key).';
    } else if (err?.status === 429) {
      msg = 'Bet scanning is busy right now — wait a few seconds and try again.';
    } else if (err?.status === 400 && /credit|balance|billing/i.test(err?.message || '')) {
      msg = 'Bet scanning is unavailable (the AI account is out of credit).';
    }
    res.status(502).json({ error: msg });
  }
});

export default router;
