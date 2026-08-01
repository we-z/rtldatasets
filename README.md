# rtldatasets.com

Static landing pages and a Cloudflare Worker for selling the five-task SoC
Design + Verification RLVR Diagnostic Sample.

## Architecture

- Cloudflare Workers Static Assets serves `public/`.
- `/api/*` runs through `worker/index.js`.
- Stripe hosted Checkout charges the fixed server-side one-time price of $1,000.
- Stripe webhooks and the checkout return both verify the exact SKU, Price,
  artifact hash, payment, refund, and dispute state.
- Cloudflare D1 stores idempotent fulfillment and download audit state.
- The verified Stripe return grants immediate, browser-bound download access;
  webhook-backed D1 state can restore an interrupted return in the same browser.
- The immutable archive is deployed as a protected Workers Static Asset from an
  ignored local build directory. Direct requests to its reserved path always
  run through the Worker and return 404; only the authenticated download route
  can fetch it through the internal Assets binding.

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
npm run db:migrate:local
npm run dev
```

Copy `.dev.vars.example` to the ignored `.dev.vars` only for local Stripe test
credentials. Do not put live keys in repository files.

## Package the sample

The release builder copies the source into a temporary staging directory, adds
buyer/license notices, validates JSON and secret patterns, regenerates the file
manifest, builds the archive twice, extracts and verifies it, and writes an
archive checksum plus metadata sidecar. Output must be outside this repository.

```sh
npm run package:sample -- \
  /absolute/path/to/soc-dv-gpt-5.3-codex-spark-shakedown-v1 \
  /absolute/path/to/release-output
```

Before a production deployment, generate an ignored Workers asset bundle from
the verified release archive:

```sh
npm run prepare:production-assets -- \
  /absolute/path/to/release-output/soc-dv-rlvr-diagnostic-sample-5-task-v1.0.0.tar.gz
```

The preparation script verifies the pinned byte size and SHA-256, copies the
public site, and places the archive under the guarded `__private` prefix. The
archive and generated `.worker-assets/` directory are ignored by Git.

## Cloudflare production setup

1. Apply `migrations/` to `rtldatasets-orders`.
2. Prepare the protected production asset bundle from the immutable release.
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
   `SAMPLE_ARCHIVE_BYTES` in `wrangler.jsonc`, run the sandbox purchase flow,
   and verify the production Worker with `STORE_LIVE=false`.
6. Attach only `www.rtldatasets.com` as the Worker Custom Domain. Configure a
   Free Single Redirect from `http*://rtldatasets.com/*` to
   `https://www.rtldatasets.com/${2}` using status 308 and preserving the query
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
