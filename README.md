# TraceWorks

TraceWorks is a Netlify-hosted investigative PWA. The authoritative runtime lives in:

- `public/` for the customer and operator web app
- `netlify/functions/` for the production API and fulfillment pipeline
- `tests/` for the maintained test suite

Everything outside those paths should be treated as support tooling or removable legacy unless this README says otherwise.

## Truthfulness Rules

- No simulated customer reports are shipped in the live app.
- No mock checkout, mock order, or preview-only API path is part of the production flow.
- The OSINT helper returns only cited hits that actually came back from providers in the current run.
- Zero provider hits stays zero hits. The code does not inject fallback directories or placeholder corroboration.
- Structured public-record evidence comes only from configured connectors or the built-in Texas-first source pack.
- Paid checkout is launch-gated: if Stripe, delivery, storage, secure tracking, or source coverage is not truly ready, the app refuses new paid orders instead of pretending.

## Production Path

- Static site: `public/`
- Functions: `netlify/functions/`
- Deploy config: `netlify.toml`
- Storage:
  - File mode for local/dev: `TRACEWORKS_STORAGE_DRIVER=file`
  - REST KV for production: `TRACEWORKS_STORAGE_DRIVER=kv` plus `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`
- Scheduled queue worker: `netlify/functions/process-queue-cron.js`

## OSINT and Records

There are two different data layers:

- `netlify/functions/_lib/public-records.js`
  - Structured county/entity/probate connectors used by the live fulfillment workflows
- `netlify/functions/_lib/osint.js`
  - Open-web helper that aggregates cited leads from providers like DuckDuckGo, Wikipedia, Reddit, OpenCorporates, and optional Robin

The live paid workflows are driven by `netlify/functions/_lib/tier-handlers.js`, `netlify/functions/_lib/source-modules.js`, and `netlify/functions/_lib/public-records.js`.

## Local Work

- Install dependencies: `npm install`
- Syntax check: `node scripts/check-syntax.mjs`
- Launch audit: `node scripts/launch-audit.mjs`
- Tests: `node --test --test-isolation=none --test-concurrency=1`
- Local dev: `npx netlify dev`

## Repo Cleanup Policy

If a file duplicates `public/` or `netlify/functions/`, ships retired sample content, or contains mock/simulated production behavior, it should be removed instead of kept around “just in case.”
