import { isIP } from 'node:net';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';

// The real address of whoever is calling. On Render the app sits behind
// Cloudflare and Render's own proxy, so Express's req.ip (one trusted hop)
// ends up being a rotating proxy address, not the visitor. That made every
// rate limit effectively per-proxy-request: a login brute-forcer was never
// slowed down. Cloudflare sets CF-Connecting-IP to the visitor's address (and
// overwrites any value a client sends), so prefer it when it's a valid IP and
// fall back to req.ip for local development and direct connections.
export function clientIp(req) {
  for (const header of ['cf-connecting-ip', 'true-client-ip']) {
    const value = req.headers?.[header];
    const ip = typeof value === 'string' ? value.trim() : '';
    if (ip && isIP(ip)) return ip;
  }
  return req.ip || 'unknown';
}

// Rate-limit key for a request. IPv6 addresses are grouped by /56 so one
// household can't dodge a limit by rotating through its own address range.
export const keyByClient = (req) => ipKeyGenerator(clientIp(req));

// A limiter keyed on the real visitor address. By default every request counts;
// pass skipSuccessfulRequests to count only failures (status 400 and above), so
// people who sign in correctly are never locked out by others on their network.
export function makeLimiter({ max, message, windowMs = 15 * 60 * 1000, skipSuccessfulRequests = false }) {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: keyByClient,
    skipSuccessfulRequests,
    message: { error: message },
  });
}
