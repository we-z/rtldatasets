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
- Cloudflare Email Service sends the purchaser a private redemption link.
- The immutable archive is streamed from a private Cloudflare R2 binding. It is
  never stored under `public/` or committed to this public repository.

Checkout is fail-closed. The button stays disabled unless `STORE_LIVE=true`,
all secrets and bindings are present, and the artifact configuration is valid.

The public staging deployment uses `wrangler.staging.jsonc`. It intentionally
omits Stripe, D1, R2, and email bindings and cannot accept payment:

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

After R2 is enabled and the private `rtldatasets-products` bucket exists:

```sh
npm run upload:sample -- \
  /absolute/path/to/release-output/soc-dv-rlvr-diagnostic-sample-5-task-v1.0.0.tar.gz
```

The upload script refuses to replace an existing content-addressed object and
downloads the uploaded object again for SHA-256 verification.

## Cloudflare production setup

1. Apply `migrations/` to `rtldatasets-orders`.
2. Enable R2, create the private `rtldatasets-products` bucket, and upload the
   immutable release.
3. Onboard `rtldatasets.com` with Cloudflare Email Sending and use
   `delivery@rtldatasets.com` as the sender.
4. Create Stripe test and live Products/Prices for exactly USD $1,000 and add
   webhook endpoints for `/api/stripe-webhook`.
5. Store `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`,
   `STRIPE_SAMPLE_PRICE_ID`, and `ENTITLEMENT_SIGNING_SECRET` with
   `wrangler secret put`.
6. Pin `SAMPLE_R2_KEY`, `SAMPLE_ARCHIVE_SHA256`, and `SAMPLE_ARCHIVE_BYTES` in
   `wrangler.jsonc`, deploy to `workers.dev`, and run the sandbox purchase flow.
7. Only after validation, attach `www.rtldatasets.com` as a Worker Custom Domain,
   configure the apex redirect, and change `STORE_LIVE` to `true`.

Production and sandbox Stripe keys, Prices, and webhook secrets must remain
separate.
