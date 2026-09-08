import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { existsSync } from 'node:fs';

import { config } from './lib/config.js';
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
const scanLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many scans — please wait a few minutes and try again.' },
});
app.use('/api/bets/scan', scanLimiter, express.json({ limit: '12mb' }), scanRoutes);

// CSV import can carry thousands of rows; give it a bigger limit before the
// global 1mb parser (which then no-ops since the body is already parsed).
app.use('/api/bets/import', express.json({ limit: '6mb' }));

// Stripe webhook needs the raw request body for signature verification, so it
// is mounted before the global JSON parser.
app.post('/api/billing/webhook', express.raw({ type: 'application/json' }), stripeWebhook);

app.use(express.json({ limit: '1mb' }));

// Rate limit authentication endpoints to blunt brute-force and abuse.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 40,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts — please wait a few minutes and try again.' },
});

app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/bets', betRoutes);
app.use('/api/trackers', trackerRoutes);
app.use('/api/plan', planRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/share', shareRoutes);

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
