import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { makeLimiter } from './lib/limits.js';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { existsSync } from 'node:fs';

import { config } from './lib/config.js';
import { FREE_SCAN_LIMIT } from './lib/plan.js';
import './lib/db.js';
import authRoutes from './routes/auth.js';
import betRoutes from './routes/bets.js';
import scanRoutes from './routes/scan.js';
import planRoutes from './routes/plan.js';
import billingRoutes from './routes/billing.js';
import { stripeWebhook } from './routes/stripeWebhook.js';
import trackerRoutes from './routes/trackers.js';
import settingsRoutes from './routes/settings.js';
import shareRoutes from './routes/share.js';
import trackRoutes from './routes/track.js';
import adminRoutes from './routes/admin.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();

app.set('trust proxy', 1); // correct client IPs behind a reverse proxy

// Security headers. CSP is disabled here because the SPA is served as a
// static bundle; tighten it at your reverse proxy/CDN if desired.
app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));

// CORS: locked to an allowlist when provided, otherwise permissive in dev
// (the API and app are same-origin in production anyway).
app.use(
  cors(
    config.corsOrigins.length
      ? { origin: config.corsOrigins, credentials: true }
      : { origin: config.isProd ? false : true }
  )
);

// Bet-slip scanning takes an uploaded image, so it needs a larger body limit
// and its own rate limit (each call hits a paid vision model). Mounted before
// the global 1mb JSON parser so image payloads aren't rejected there.
const scanLimiter = makeLimiter({
  max: 30,
  message: 'Too many scans — please wait a few minutes and try again.',
});
app.use('/api/bets/scan', scanLimiter, express.json({ limit: '12mb' }), scanRoutes);

// CSV import can carry thousands of rows; give it a bigger limit before the
// global 1mb parser (which then no-ops since the body is already parsed).
app.use('/api/bets/import', express.json({ limit: '6mb' }));

// Stripe webhook needs the raw request body for signature verification, so it
// is mounted before the global JSON parser.
app.post('/api/billing/webhook', express.raw({ type: 'application/json' }), stripeWebhook);

app.use(express.json({ limit: '1mb' }));

// Rate limits on the auth endpoints, per real visitor address (see lib/limits.js).
//  · Password checks (login, change password, delete account) count only FAILED
//    attempts, so signing in correctly is never blocked: 20 wrong tries per 15 min.
//  · Sign-up and the password-reset endpoints count every request (they can be
//    abused even when they succeed, e.g. spam sign-ups or reset-email floods).
//  · Everything else here (notably GET /me, which every app launch calls) gets a
//    generous cap that only stops runaway loops.
const passwordLimiter = makeLimiter({
  max: 20,
  skipSuccessfulRequests: true,
  message: 'Too many attempts — please wait a few minutes and try again.',
});
const signupResetLimiter = makeLimiter({
  max: 20,
  message: 'Too many attempts — please wait a few minutes and try again.',
});
const sessionLimiter = makeLimiter({
  max: 300,
  message: 'Too many requests — please wait a few minutes and try again.',
});
const authGate = express.Router();
authGate.post(['/login', '/change-password'], passwordLimiter);
authGate.delete('/account', passwordLimiter);
authGate.post(['/register', '/forgot-password', '/reset-password'], signupResetLimiter);
authGate.use(sessionLimiter);

app.get('/api/health', (_req, res) => res.json({ ok: true }));

// Public pricing info so the logged-out landing page can show real plan prices.
app.get('/api/pricing', (_req, res) => res.json({
  billingEnabled: config.billingEnabled,
  priceLabel: config.stripe.priceLabel || '',
  priceLabelAnnual: config.stripe.priceLabelAnnual || '',
  annualSave: config.stripe.annualSave || '',
  // Whether the yearly plan can actually be checked out (a Stripe annual price
  // ID is configured). The label above shows regardless; this confirms wiring.
  annualEnabled: !!config.stripe.priceIdAnnual,
  trialDays: config.stripe.trialDays || 0,
  freeScanLimit: FREE_SCAN_LIMIT,
}));
app.use('/api/auth', authGate, authRoutes);
app.use('/api/bets', betRoutes);
app.use('/api/trackers', trackerRoutes);
app.use('/api/plan', planRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/share', shareRoutes);

// Usage tracking beacon — high-frequency (a heartbeat per open tab), so give it
// a generous but bounded rate limit to blunt abuse.
const trackLimiter = makeLimiter({ max: 400, message: 'Too many requests.' });
app.use('/api/track', trackLimiter, trackRoutes);
app.use('/api/admin', adminRoutes);

// Serve the built client (production) with SPA fallback.
const clientDist = join(__dirname, '..', '..', 'client', 'dist');
if (existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) return next();
    res.sendFile(join(clientDist, 'index.html'));
  });
}

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Something went wrong' });
});

app.listen(config.port, () => {
  console.log(`Betbooks API running on http://localhost:${config.port}`);
});
