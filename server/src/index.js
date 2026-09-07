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
  console.log(`Betfolio API running on http://localhost:${config.port}`);
});
