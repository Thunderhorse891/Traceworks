# Traceworks (Preview-First Netlify App)

TraceWorks™ is a legal-focused OSINT order flow with paid checkout and automated dossier delivery.

## What this build now includes

- Four legal service packages aligned to your pricing cards:
  - Skip Trace & Locate ($75)
  - Comprehensive Locate + Assets ($150)
  - Property & Title Research ($200)
  - Heir & Beneficiary Locate ($100)
- Stripe checkout session creation
- Webhook processing that triggers OSINT collection + report generation
- Professional HTML dossier email + text fallback sent to customer and owner
- Source citation table and confidence level in every report
- No blank/null sections (fallback text is always inserted)


## Service policy

- No refunds once investigative work has started.
- One same-scope redo can be requested (see `/refund-policy.html`) if quality issues are identified in good faith.

## Architecture

- `public/` dark, legal-style site and order form
- `netlify/functions/create-checkout.js` Stripe checkout creator
- `netlify/functions/stripe-webhook.js` payment success → queue job
- `netlify/functions/process-queue.js` protected worker endpoint for one-job processing
- `netlify/functions/process-queue-scheduled.js` cron worker that drains queued jobs automatically
- `netlify/functions/report-preview.js` live report preview endpoint
- `netlify/functions/_lib/osint.js` OSINT source gathering layer
- `netlify/functions/_lib/report.js` sophisticated dossier generation and rendering
- `netlify/functions/_lib/email.js` SMTP email dispatch
- `netlify/functions/contact-sales.js` enterprise lead intake routed to business mailbox

## Local preview

```bash
npm install
cp .env.example .env
npx netlify-cli dev
```

Then open:

- Website: `http://localhost:8888/`
- Live dossier preview (dynamic): `http://localhost:8888/preview/report?packageId=comprehensive`
- All 4 tier dossier previews: `http://localhost:8888/report-tiers.html`
- Launch readiness checklist: `http://localhost:8888/launch-readiness.html`
- Tier files:
  - `http://localhost:8888/reports/report-locate.html`
  - `http://localhost:8888/reports/report-comprehensive.html`
  - `http://localhost:8888/reports/report-title.html`
  - `http://localhost:8888/reports/report-heir.html`

## Stripe webhook testing

```bash
stripe listen --forward-to localhost:8888/api/stripe-webhook
```

Paste the returned webhook secret into `.env` as `STRIPE_WEBHOOK_SECRET`.

## Required env vars

See `.env.example`. Optional: `QUEUE_MAX_PER_RUN` (default 5) controls scheduled worker batch size.
Set `QUEUE_CRON_SECRET` to protect scheduled worker invocations.
Set `STATUS_TOKEN_SECRET` to enable signed status links on success pages (recommended).
Owner notifications default to `traceworks.tx@outlook.com` (override with `OWNER_EMAIL` if needed).

## Important

This is preview-first. Do not publish production until you approve final design/content and test mode checkout flow.


## Missing items that are now added

- **Input validation hardening**: checkout now validates email, required fields, and package selection server-side.
- **Legal/terms consent gates**: order form now requires lawful-use acknowledgement and terms consent before payment.
- **Case reference tracking**: every order now gets a unique `caseRef` persisted in Stripe metadata and included in report/email subject lines.
- **Webhook duplicate protection**: retries with the same Stripe event id are ignored in-process to reduce duplicate report emails.
- **Four tier dossier previews**: dedicated preview index and tier-specific dossier pages are included for client review.


## OSINT engine upgrade (top-tier architecture)

- Multi-provider collection pipeline (`duckduckgo`, `wikipedia`, `reddit`) across an expanded query plan.
- Package-aware query expansion (`locate`, `comprehensive`, `title`, `heir`) to target relevant signals.
- Source deduplication + ranking by confidence and domain diversity.
- Coverage telemetry in the dossier (providers with hits, domain count, source count, query plan).
- Deterministic fallbacks to authoritative public-record indexes when provider coverage is limited.

> Important: no investigative system can guarantee "all" information exists or is publicly accessible. This build maximizes collection breadth and always returns a complete, non-blank, actionable dossier.


## Superior upgrades added in this iteration

- Executive-quality dossier sections now include: **Evidence Matrix**, **Red Flags & Gaps**, and **Next 48 Hours Actions**.
- Homepage now includes trust/conversion blocks that explain why Traceworks output is stronger than basic lookup reports.
- Reports now surface clearer operational value for legal teams by turning research into explicit immediate action steps.


## Critical go-live gaps implemented in this pass

- Persistent order store abstraction for case lifecycle (`checkout_created` → `processing` → `completed`/`failed`).
- Persistent webhook idempotency keys to reduce duplicate fulfillment emails.
- Email delivery retries in webhook processing.
- Customer status endpoint (`/api/get-order`) and upgraded success page with live status lookup.
- Terms and Privacy pages linked from checkout consent.
- Lightweight analytics event capture endpoint (`/api/track-event`) and frontend event tracking hooks.


## Next 5 production-readiness fixes implemented

- Security JSON response helper with hardened default headers.
- API rate limiting for checkout, tracking, and order-status polling.
- Stricter payload validation (URL normalization/validation, field length checks).
- Enhanced health endpoint includes env checks and lightweight service metrics.
- Protected admin metrics endpoint (`/api/admin-metrics`) using `Bearer ADMIN_API_KEY`.


## Next 10 reliability/security upgrades implemented

1. Request ID propagation (`x-request-id`) on JSON API responses.
2. Atomic store writes (temp file + rename) to reduce corruption risk.
3. Dead-letter capture for failed webhook fulfillment attempts.
4. Fulfillment-attempt counters tracked per case.
5. Webhook method enforcement (`POST` only).
6. Explicit Stripe signature header validation in webhook handler.
7. Rate limiting added to webhook and admin metrics endpoints.
8. Input sanitization/length limits for analytics tracking payloads.
9. Admin metrics endpoint now enforces method + auth + rate limits.
10. Health endpoint now returns startup timestamp/version fields for ops diagnostics.


## Phase 2 reliability upgrades

- Exponential retry backoff for fulfillment jobs with `nextAttemptAt` scheduling in the queue store.
- Retry-state visibility in customer status (`retrying` + `retryAt`) to improve transparency after transient failures.
- Dead-letter recording now occurs only after terminal failure (max attempts reached).


## Phase 3 security upgrades

- Checkout now issues signed status tokens for success-page polling links (reduces dependency on email query auth in URL).
- `get-order` now validates signed status tokens and keeps legacy email fallback for backward compatibility.


## Phase 4 operator onboarding upgrades

- Added a launch-readiness page that explicitly lists remaining client-provided go-live dependencies.
- Added a live health/env-missing check block to surface missing required environment variables in one place.


## Phase 5 monetization upgrades

- Added enterprise/agency lead intake form on homepage for higher-ticket monthly volume deals.
- Added `/api/contact-sales` endpoint that validates lead payloads and emails business-owner lead alerts for rapid sales follow-up.


## Phase 7 security hardening upgrades

- Added stricter security headers for JSON/HTML responses (`content-security-policy`, `permissions-policy`).
- Hardened Stripe webhook processing with payload-size limits, signature tolerance, and explicit ignore behavior for non-checkout events.
- Locked status-token signing to dedicated `STATUS_TOKEN_SECRET` only (no fallback to other secrets).
- Hardened enterprise lead endpoint with payload-size guard, stronger email validation, and honeypot field handling.
- Added optional cron secret guard for scheduled queue worker (`QUEUE_CRON_SECRET`).
