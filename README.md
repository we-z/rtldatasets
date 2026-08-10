# rtltasks.com

A plain, framework-free static marketing site. There is no backend, no
checkout, no database, and no third-party service beyond hosting itself.

## Architecture

- `public/` is the entire site — hand-authored HTML/CSS/JS, no build step.
- Contact happens via `mailto:`/`sms:` links on the landing page; there is
  no form submission or server-side code anywhere.
- Deployed two ways during the Cloudflare → Vercel migration:
  - **Vercel** (`vercel.json`): serves `public/` directly, plus a
    redirect from the bare `rtltasks.com` apex to `www.rtltasks.com` and a
    baseline set of security headers (CSP, HSTS, etc.).
  - **Cloudflare Workers** (`worker/`, `wrangler*.jsonc`): the still-live
    production host. `worker/index.js` does the same canonical-domain
    redirect (also covering the legacy `rtldatasets.com`/`puul.ai`
    hostnames) and then serves `public/` via Workers Static Assets — it is
    now a ~15-line passthrough with no API routes.

## Local checks

```sh
npm install
npm test
npm run dev            # vercel dev — serves public/ statically
npm run dev:cloudflare # wrangler dev — same, via the Cloudflare Worker
```

## Deploying

```sh
npx vercel --prod              # Vercel
npm run deploy:cloudflare      # Cloudflare (the current live production host)
npm run deploy:staging         # Cloudflare staging preview
```
