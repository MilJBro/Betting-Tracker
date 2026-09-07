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
markdown code fences) with exactly these keys:

- selection (string): the main pick. For an accumulator/multiple, join each leg with " / ".
- event (string): the match or event, e.g. "Arsenal v Chelsea". "" if not shown.
- sport (string): sport or category, e.g. "Football", "Horse Racing", "Tennis". "" if unknown.
- bet_type (string): e.g. "Single", "Double", "Treble", "Accumulator", "Match Result", "Over/Under". "" if unknown.
- bookmaker (string): the bookmaker's name if identifiable (e.g. "Bet365", "Sky Bet", "Paddy Power"). "" if unknown.
- stake (number): the stake as a plain number in the account currency (e.g. 10.00). 0 if not shown.
- odds (number): the TOTAL odds in DECIMAL format. Convert fractional (e.g. 6/4 -> 2.5) and American (e.g. +150 -> 2.5, -200 -> 1.5). For an accumulator use the combined odds. 0 if not shown.
- payout (number or null): the potential returns / "to return" amount as a number, or null if not shown.
- placed_at (string or null): the bet date as YYYY-MM-DD if clearly shown, else null.
- status (string): one of "pending","won","lost","void","cashout". Use "pending" for an open/unsettled slip unless it clearly shows the outcome.
- currency (string or null): "GBP","USD","EUR","AUD","CAD" if identifiable from a symbol or code, else null.
- confidence (number): 0..1, your overall confidence in the extraction.
- notes (string): anything useful that didn't fit (each-way, boosted/enhanced odds, bet ID), else "".

Rules: output valid JSON and nothing else. Use "" for unknown text fields and 0
for unknown numbers, except payout, placed_at and currency which use null. Never
invent values you cannot actually see in the image.`;

function coerceNumber(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

// Map the model's raw JSON into the app's bet shape. Unknown fields stay blank
// so the user just fills the gaps rather than fighting wrong guesses. Exported
// for testing.
export function normalizeBet(parsed) {
  const statuses = ['pending', 'won', 'lost', 'void', 'cashout'];
  return {
    selection: String(parsed.selection || '').trim(),
    event: String(parsed.event || '').trim(),
    sport: String(parsed.sport || '').trim(),
    bet_type: String(parsed.bet_type || '').trim(),
    bookmaker: String(parsed.bookmaker || '').trim(),
    stake: coerceNumber(parsed.stake),
    odds: coerceNumber(parsed.odds),
    payout: parsed.payout == null ? '' : coerceNumber(parsed.payout),
    placed_at:
      typeof parsed.placed_at === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(parsed.placed_at)
        ? parsed.placed_at
        : new Date().toISOString().slice(0, 10),
    status: statuses.includes(parsed.status) ? parsed.status : 'pending',
    notes: String(parsed.notes || '').trim(),
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
      error: `You've used all ${e.scans.limit} free scans this month. Upgrade to Pro for unlimited scanning.`,
      upgrade: true,
      scans: e.scans,
    });
  }

  const { image, mediaType } = req.body || {};
  const media = ALLOWED_MEDIA.includes(mediaType) ? mediaType : 'image/jpeg';
  if (!image || typeof image !== 'string') {
    return res.status(400).json({ error: 'No image provided.' });
  }
  // base64 payload guard (~8MB of base64 ≈ 6MB image).
  if (image.length > 8_000_000) {
    return res.status(413).json({ error: 'Image is too large — try a smaller screenshot.' });
  }

  try {
    const client = new Anthropic({ apiKey: config.anthropic.apiKey });
    const message = await client.messages.create({
      model: config.anthropic.model,
      max_tokens: 2000,
      output_config: { effort: 'low' },
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: media, data: image } },
            { type: 'text', text: 'Extract the bet from this slip.' },
          ],
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
    console.error('[scan] extraction failed:', err?.message || err);
    const status = err?.status === 401 ? 502 : 502;
    res.status(status).json({ error: 'Bet scanning is temporarily unavailable. Please add the bet manually.' });
  }
});

export default router;
