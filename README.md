# rtltasks.com

Static landing pages and a serverless backend for selling the five-task SoC
Design + Verification RLVR Diagnostic Sample.

**Migration in progress:** hosting is moving from Cloudflare Workers to
Vercel (git-push auto-deploy, no more manual `wrangler deploy`). The
Cloudflare Worker (`worker/`, `wrangler*.jsonc`, D1) remains the live
production system until the Vercel deployment (`api/`, `lib/`, `vercel.json`)
has been verified end-to-end and DNS has been cut over — see "Vercel
production setup" below. Do not delete the Cloudflare code/config until then.

## Architecture (Vercel, target)

- `public/` is a plain, framework-free static site, served directly by Vercel.
- `/api/*` is one Vercel serverless function per route (`api/*.js`), each a
  thin wrapper around shared logic in `lib/`.
- Stripe hosted Checkout charges the fixed server-side one-time price of $1,000.
- The checkout return (`/api/checkout-success`) verifies the exact SKU, Price,
  artifact hash, payment, refund, and dispute state directly against Stripe
  before showing the confirmation page — there is no order database on this
  deployment. Stripe's own Dashboard is the fulfillment record.
- Checkout rate limiting (`lib/ratelimit.js`) is a plain in-process,
  dependency-free counter — no external database or SaaS account. It only
  limits per function instance, so it's best-effort rather than a hard
  global cap; Stripe's own idempotency keys still prevent duplicate charges
  regardless.
- **Fulfillment is manual**: the purchased release (name/version/filename,
  pinned via `SAMPLE_ASSET_PATH` etc. and recorded in the Stripe session's
  metadata) is emailed to the customer by hand after payment is confirmed.
  This deployment does not store, serve, or gate a download of the archive
  itself — see `templates/purchase-success.html` for the confirmation
  copy shown to the customer. `/api/stripe-webhook` only verifies Stripe's
  signature and acknowledges receipt; it does not persist anything.

## Architecture (Cloudflare, current production)

- Cloudflare Workers Static Assets serves `public/`.
- `/api/*` runs through `worker/index.js`.
- Cloudflare D1 stores the same fulfillment/download audit state.
- The immutable ZIP archive is deployed as a protected Workers Static Asset from an
  ignored local build directory. Direct requests to its reserved path always
  run through the Worker and return 404; only the authenticated download route
  can fetch it through the internal Assets binding.

The authoritative private purchase record is composite: Stripe retains the
seller account/receipt identity, purchaser individual and optional business
names, billing address, payment state, immutable package fields, and both exact
document acceptances; D1 retains the matching order/artifact row and the first
and latest delivery timestamps. A download is returned only after the D1 audit
write succeeds. The archive checksum sidecar completes the byte binding.

Checkout is fail-closed. The button stays disabled unless `STORE_LIVE=true`,
all secrets and free-tier bindings are present, and the artifact configuration
is valid. `STRIPE_MODE` must also match the actual secret key mode, so the
production Worker cannot accidentally accept Stripe test payments.

The public staging deployment uses `wrangler.staging.jsonc`. It intentionally
omits Stripe and D1 bindings and cannot accept payment:

```sh
npm run deploy:staging
```

## Local checks

```sh
npm install
npm test
npm run dev            # vercel dev, reads .env (copy from .env.example)
npm run dev:cloudflare # wrangler dev, reads .dev.vars (copy from .dev.vars.example)
```

Copy `.env.example`/`.dev.vars.example` to the ignored `.env`/`.dev.vars`
only for local Stripe test credentials. Do not put live keys in repository
files.

## Prepare the customer package

The authoritative v1.0.2 customer ZIP is built and verified in the SoC DV pilot
workspace. The historical `npm run package:sample` tar builder is retained for
audit history but fails closed and must not be used for fulfillment.

Before a production deployment, generate an ignored Workers asset bundle from
the exact pinned release ZIP:

```sh
npm run prepare:production-assets -- \
  /absolute/path/to/soc-dv-gpt-5.3-codex-spark-customer-package-v1.0.2.zip
```

The preparation script verifies artifact version 1.0.2, the pinned 164,691-byte
size, and SHA-256 `24eceb7389d767099370afadbdebe8bb74a6744241f4e3957635d53ce6dbb904`,
copies the public site, and places the ZIP under the guarded `__private` prefix.
The archive and generated `.worker-assets/` directory are ignored by Git.

## Cloudflare production setup

1. Apply `migrations/` to `rtldatasets-orders`.
2. Prepare the protected production asset bundle from the immutable v1.0.2 ZIP.
3. Create Stripe test and live Products/Prices for exactly USD $1,000 and add
   webhook endpoints for `/api/stripe-webhook`.
4. Store test secrets only on the sandbox Worker and live secrets only on the
   production Worker. Always provide the explicit config file:

   ```sh
   npx wrangler secret put STRIPE_SECRET_KEY --config wrangler.sandbox.jsonc
   npx wrangler secret put STRIPE_WEBHOOK_SECRET --config wrangler.sandbox.jsonc
   npx wrangler secret put STRIPE_SAMPLE_PRICE_ID --config wrangler.sandbox.jsonc
   npx wrangler secret put ENTITLEMENT_SIGNING_SECRET --config wrangler.sandbox.jsonc

   npx wrangler secret put STRIPE_SECRET_KEY --config wrangler.jsonc
   npx wrangler secret put STRIPE_WEBHOOK_SECRET --config wrangler.jsonc
   npx wrangler secret put STRIPE_SAMPLE_PRICE_ID --config wrangler.jsonc
   npx wrangler secret put ENTITLEMENT_SIGNING_SECRET --config wrangler.jsonc
   ```
5. Pin `SAMPLE_ASSET_PATH`, `SAMPLE_ARCHIVE_SHA256`, and
   `SAMPLE_ARCHIVE_BYTES` only in `wrangler.jsonc`; verify the two accepted
   document versions and hashes in both Checkout Session and PaymentIntent
   metadata. The public sandbox is deliberately `STORE_LIVE=false`, uses only
   public assets, and must never receive the paid ZIP. Exercise checkout with a
   non-customer fixture in a separately access-controlled test environment.
6. Attach `www.rtltasks.com` as the new Worker Custom Domain (keep
   `www.rtldatasets.com` during migration). Configure a Free Single Redirect
   from `http*://rtltasks.com/*` to
   `https://www.rtltasks.com/${2}` using status 308 and preserving the query
   string. The apex DNS record is a proxied `A` placeholder at `192.0.2.0`.
7. After the custom domain, redirect, live Price, live webhook, and restricted
   live key are verified, set `STORE_LIVE=true` and disable `workers.dev`.

This architecture stays on Workers Free and D1 Free. Static asset storage and
static asset requests have no additional charge; authenticated API and download
requests use the Workers Free quota. It intentionally does not require R2 or
Workers Paid Email Sending. Delivery is immediate in the checkout browser, and
the site automatically retries or restores interrupted delivery for seven days
when that browser retains its essential checkout data.

Production and sandbox Stripe keys, Prices, and webhook secrets must remain
separate.

## Vercel production setup

1. `vercel login`, then link this repo to a Vercel project (`vercel link`) and
   connect it to the `we-z/rtltasks.com` GitHub repository for auto-deploy on push.
2. Set the environment variables on the Vercel project (see `.env.example`):
   `STORE_LIVE=true`, `SITE_URL=https://www.rtltasks.com`, `STRIPE_MODE`,
   `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_SAMPLE_PRICE_ID`,
   `STRIPE_AUTOMATIC_TAX`, `ENTITLEMENT_SIGNING_SECRET`, `SAMPLE_ASSET_PATH`,
   `SAMPLE_ARCHIVE_SHA256`, `SAMPLE_ARCHIVE_BYTES` (must match
   `lib/product.js` exactly). No database or third-party rate-limiting
   service is used, so there's nothing else to provision.
3. In Stripe, add a webhook endpoint for `https://www.rtltasks.com/api/stripe-webhook`
   (events: `checkout.session.completed`, `checkout.session.async_payment_succeeded`)
   and set its signing secret as `STRIPE_WEBHOOK_SECRET` above.
4. Test the full flow against the Vercel preview URL in Stripe test mode
   (checkout → `/purchase-complete` → `/purchase-success`, plus
   `stripe listen --forward-to <preview>/api/stripe-webhook`) before touching DNS.
5. DNS cutover (domains stay on Cloudflare DNS — no nameserver change): in
   the Vercel project, add `www.rtltasks.com` as a domain and follow its
   instructions. In the Cloudflare DNS dashboard, change the `www` record
   from the Worker Custom Domain to the CNAME Vercel gives you, and the apex
   `rtltasks.com` record similarly, both with the Cloudflare proxy set to
   "DNS only" (grey cloud) rather than proxied. Repeat for
   `rtldatasets.com`/`puul.ai` if migrating those too.
6. Set up the manual fulfillment process on your end (e.g., a Stripe
   Dashboard notification or saved search for new $1,000 payments) so a
   human emails the customer the release ZIP after each purchase.
7. Leave the Cloudflare Worker and D1 database running (do not delete) until
   Vercel has served production traffic cleanly for a few days, then
   decommission them.
