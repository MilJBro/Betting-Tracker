import { Router } from 'express';
import { requireAuth } from '../lib/auth.js';
import { config } from '../lib/config.js';
import { entitlements, setPlan } from '../lib/plan.js';

const router = Router();
router.use(requireAuth);

// Current plan + entitlements (usage, features). Safe to poll; drives the
// client's lock badges and scan meter.
router.get('/', (req, res) => {
  res.json(entitlements(req.userId));
});

// Dev-only plan switch so the free/Pro boundary is testable before Stripe is
// wired up. Disabled in production, where a real payment webhook sets the plan.
router.post('/dev-set', (req, res) => {
  if (config.isProd) {
    return res.status(403).json({ error: 'Not available in production.' });
  }
  const plan = (req.body || {}).plan;
  try {
    setPlan(req.userId, plan === 'pro' ? 'pro' : 'free');
  } catch (e) {
    return res.status(400).json({ error: e.message });
  }
  res.json(entitlements(req.userId));
});

export default router;
