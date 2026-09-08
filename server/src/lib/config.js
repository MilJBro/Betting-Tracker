import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { randomBytes } from 'node:crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = join(__dirname, '..', '..', 'data');
mkdirSync(dataDir, { recursive: true });

const isProd = process.env.NODE_ENV === 'production';

// --- JWT secret -------------------------------------------------------------
// Never ship a hardcoded default. In production a real secret is required.
// In development we generate one once and persist it so tokens survive
// restarts without anyone having to configure anything.
function resolveJwtSecret() {
  if (process.env.JWT_SECRET && process.env.JWT_SECRET.length >= 16) {
    return process.env.JWT_SECRET;
  }
  if (isProd) {
    throw new Error(
      'JWT_SECRET must be set to a strong random value in production. ' +
        'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'hex\'))"'
    );
  }
  const secretFile = join(dataDir, '.jwt-secret');
  if (existsSync(secretFile)) return readFileSync(secretFile, 'utf8').trim();
  const generated = randomBytes(48).toString('hex');
  writeFileSync(secretFile, generated, { mode: 0o600 });
  console.warn(
    '[config] No JWT_SECRET set — generated a persistent dev secret at data/.jwt-secret'
  );
  return generated;
}

export const config = {
  isProd,
  port: Number(process.env.PORT) || 4000,
  jwtSecret: resolveJwtSecret(),
  jwtTtl: process.env.JWT_TTL || '30d',
  // Public URL of the app, used to build password-reset links in emails.
  appUrl: (process.env.APP_URL || `http://localhost:${Number(process.env.PORT) || 4000}`).replace(/\/$/, ''),
  // Optional CORS allowlist (comma-separated). Empty = same-origin only in prod.
  corsOrigins: (process.env.CORS_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  smtp: {
    host: process.env.SMTP_HOST || '',
    port: Number(process.env.SMTP_PORT) || 587,
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.MAIL_FROM || 'Betbooks <no-reply@betbooks.app>',
  },
  // Bet-slip scanning (vision extraction). Optional — the feature is only
  // enabled when an Anthropic API key is configured.
  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY || '',
    model: process.env.ANTHROPIC_MODEL || 'claude-opus-5',
  },
  // Stripe billing for Pro subscriptions. Billing is only enabled when a
  // secret key and a subscription price are configured; otherwise the app runs
  // fine with the free tier and the upgrade CTA is hidden.
  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY || '',
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
    priceId: process.env.STRIPE_PRICE_ID || '',
    // Human-readable price for the upgrade button, e.g. "£3.99 / month".
    priceLabel: process.env.STRIPE_PRICE_LABEL || '',
  },
  dataDir,
};

// True only when Stripe is fully configured (key + a price to subscribe to).
config.billingEnabled = !!(config.stripe.secretKey && config.stripe.priceId);
