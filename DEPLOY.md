# Launching Betbooks

This guide takes Betbooks from the repo to a live site on **Render**, with
**Stripe** billing for Pro. Follow the steps in order. Anything in `CAPS` is a
value you paste into Render's dashboard.

The app is a single web service: the Node server builds and serves the React
client and keeps its data in a SQLite file on a persistent disk.

---

## 0. Before you start — accounts to create

You'll need (all have free/cheap tiers):

1. **GitHub** — the repo is already here.
2. **Render** — https://render.com (hosting). The `starter` plan is required
   because we use a persistent disk.
3. **A domain** — your Betbooks domain.
4. **Stripe** — https://stripe.com (payments).
5. **An email provider with SMTP** — e.g. Resend, Mailgun, Postmark, or SendGrid
   (for password-reset emails).

---

## 1. Merge to `main`

Deploy from `main`, not the feature branch. Once the work is reviewed, merge the
`claude/customizable-betting-tracker-*` branch into `main`.

## 2. Create the Render service

1. Render → **New → Blueprint**, connect the GitHub repo. Render reads
   `render.yaml` and proposes the **betbooks** web service with a 1 GB disk.
2. Apply it. The first build runs `npm install && npm run build`, then
   `npm start`. `JWT_SECRET` is generated for you; `DB_PATH` points at the disk.
3. Leave the `sync:false` secrets blank for now — the first deploy will boot
   with billing/email disabled, which is fine.
4. When it's live you'll get a `https://betbooks-xxxx.onrender.com` URL. Open it
   — you should see the landing page.

## 3. Point your domain at it

1. Render → your service → **Settings → Custom Domains** → add `betbooks.<tld>`
   (and `www` if you want).
2. Add the DNS records Render shows you at your domain registrar. HTTPS is
   automatic once DNS propagates.
3. Set the **`APP_URL`** env var to your final URL (e.g. `https://betbooks.<tld>`)
   and redeploy. This is used for password-reset links and Stripe redirects, so
   it must be the real public URL.

## 4. Stripe — turn on Pro billing

Do this in Stripe **test mode** first, then repeat the key/webhook steps in live
mode when you're ready to take real money.

1. **Product & price:** Stripe → Products → add a product "Betbooks Pro" with a
   **recurring** price (e.g. £3.99 / month). Copy the **Price ID** (`price_...`).
2. Set env vars in Render:
   - `STRIPE_SECRET_KEY` = your secret key (`sk_test_...`, later `sk_live_...`)
   - `STRIPE_PRICE_ID` = the `price_...` from step 1
   - `STRIPE_PRICE_LABEL` = what to show on the button, e.g. `£3.99 / month`
3. **Webhook:** Stripe → Developers → Webhooks → add endpoint
   `https://<APP_URL>/api/billing/webhook`. Subscribe to these events:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   Copy the **Signing secret** (`whsec_...`) into `STRIPE_WEBHOOK_SECRET`.
4. Redeploy. On the Account page, "Upgrade to Pro" now opens Stripe Checkout;
   after paying, the webhook flips the account to Pro. Pro users get a
   "Manage billing" button (Stripe's customer portal) to cancel or update cards.
5. **Test** with card `4242 4242 4242 4242`, any future expiry/CVC. Confirm the
   account shows Pro afterwards, then cancel from the portal and confirm it
   returns to Free.

> Billing only activates when `STRIPE_SECRET_KEY` **and** `STRIPE_PRICE_ID` are
> set. Without them the app runs free-only and the checkout button is inert.

## 5. Email (password resets)

Set these from your SMTP provider, then redeploy:

- `SMTP_HOST`, `SMTP_PORT` (usually 587), `SMTP_USER`, `SMTP_PASS`
- `MAIL_FROM` = `Betbooks <no-reply@betbooks.<tld>>` (use a domain you've
  verified with the provider)

Until these are set, "forgot password" still works in the sense that it won't
error, but no email is sent.

## 6. Go live checklist

- [ ] `APP_URL` is your real domain (https).
- [ ] Stripe in **live** mode: `sk_live_...`, live `price_...`, live webhook +
      `whsec_...`.
- [ ] SMTP configured and a test reset email received.
- [ ] Signed up a real account, logged a bet, settled it, saw stats.
- [ ] Subscribed with a real card, confirmed Pro, opened the billing portal.
- [ ] A Terms and a Privacy page linked from the footer (see below).

## Data & backups

The database is `DB_PATH` on the Render disk. Take periodic backups: Render →
service → **Shell**, then `cp /var/data/betbooks.db /var/data/backup-$(date +%F).db`,
or download it. For higher durability later, move to Postgres.

## Environment variables — quick reference

| Var | Required | What it is |
|-----|----------|------------|
| `NODE_ENV` | yes | `production` |
| `JWT_SECRET` | yes | Strong random string (Render generates it) |
| `DB_PATH` | yes | `/var/data/betbooks.db` (on the disk) |
| `APP_URL` | yes | Public https URL of the app |
| `STRIPE_SECRET_KEY` | for Pro | `sk_live_...` |
| `STRIPE_PRICE_ID` | for Pro | `price_...` (recurring) |
| `STRIPE_WEBHOOK_SECRET` | for Pro | `whsec_...` |
| `STRIPE_PRICE_LABEL` | optional | Button text, e.g. `£3.99 / month` |
| `SMTP_HOST/PORT/USER/PASS` | for email | From your email provider |
| `MAIL_FROM` | for email | Verified from-address |
| `ANTHROPIC_API_KEY` | later | Only when bet-slip scanning is re-enabled |

## Still to do before / soon after launch

- **Terms of Service** and **Privacy Policy** pages (betting tracker, not a
  bookmaker; you already show 18+, responsible-gambling links, and offer data
  export + account deletion).
- Turn the mobile-preview artifact's public sharing back on if you want to keep
  sharing the demo.
