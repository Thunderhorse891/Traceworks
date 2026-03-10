# TraceWorks premium rebuild brief

This brief is repo-aware and generated from a live scan at `ops/traceworks-audit/20260310-233251`.
Do not fake completion. Do not claim a redesign is done until the real files are patched and tested.

## Required output order
1. AUDIT SUMMARY
2. MAIN PROBLEMS FOUND
3. FILES CHANGED
4. EXACT UX / DESIGN IMPROVEMENTS MADE
5. EXACT WORDING / TRUST IMPROVEMENTS MADE
6. MOBILE IMPROVEMENTS MADE
7. PRODUCTION HARDENING IMPROVEMENTS MADE
8. PAID FLOW SAFETY CHECK
9. TESTS / CHECKS RUN
10. COMMIT HASH
11. PUSH RESULT
12. REMAINING BLOCKERS
13. NEXT HIGHEST-ROI RECOMMENDATIONS

## Actual repo findings to anchor the work
### Frontend entry points
- None found

### Styling system
- scripts/traceworks_bootstrap.sh

### Package rendering path
- .netlify/functions-serve/admin-metrics/___netlify-bootstrap.mjs
- .netlify/functions-serve/admin-metrics/___netlify-telemetry.mjs
- .netlify/functions-serve/contact-sales/___netlify-bootstrap.mjs
- .netlify/functions-serve/contact-sales/___netlify-telemetry.mjs
- .netlify/functions-serve/create-checkout/___netlify-bootstrap.mjs
- .netlify/functions-serve/create-checkout/___netlify-telemetry.mjs
- .netlify/functions-serve/create-checkout/netlify/functions/create-checkout.mjs
- .netlify/functions-serve/get-order/___netlify-bootstrap.mjs
- .netlify/functions-serve/get-order/___netlify-telemetry.mjs
- .netlify/functions-serve/get-order/netlify/functions/get-order.mjs
- .netlify/functions-serve/health/___netlify-bootstrap.mjs
- .netlify/functions-serve/health/___netlify-telemetry.mjs
- .netlify/functions-serve/process-queue-scheduled/___netlify-bootstrap.mjs
- .netlify/functions-serve/process-queue-scheduled/___netlify-telemetry.mjs
- .netlify/functions-serve/process-queue-scheduled/netlify/functions/process-queue-scheduled.mjs
- .netlify/functions-serve/process-queue/___netlify-bootstrap.mjs
- .netlify/functions-serve/process-queue/___netlify-telemetry.mjs
- .netlify/functions-serve/process-queue/netlify/functions/process-queue.mjs
- .netlify/functions-serve/report-preview/___netlify-bootstrap.mjs
- .netlify/functions-serve/report-preview/___netlify-telemetry.mjs
- .netlify/functions-serve/report-preview/netlify/functions/report-preview.mjs
- .netlify/functions-serve/stripe-webhook/___netlify-bootstrap.mjs
- .netlify/functions-serve/stripe-webhook/___netlify-telemetry.mjs
- .netlify/functions-serve/stripe-webhook/netlify/functions/stripe-webhook.mjs
- .netlify/functions-serve/track-event/___netlify-bootstrap.mjs
- .netlify/functions-serve/track-event/___netlify-telemetry.mjs
- .netlify/functions-serve/track-event/netlify/functions/track-event.mjs
- README.md
- netlify/functions/_lib/fulfillment.js
- netlify/functions/_lib/osint.js
- netlify/functions/_lib/packages.js
- netlify/functions/_lib/public-records.js
- netlify/functions/_lib/report.js
- netlify/functions/_lib/validation.js
- netlify/functions/create-checkout.js
- netlify/functions/get-order.js
- netlify/functions/report-preview.js
- netlify/functions/stripe-webhook.js
- netlify/functions/track-event.js
- package-lock.json

### Intake flow path
- .netlify/functions-serve/admin-metrics/___netlify-bootstrap.mjs
- .netlify/functions-serve/admin-metrics/___netlify-telemetry.mjs
- .netlify/functions-serve/contact-sales/___netlify-bootstrap.mjs
- .netlify/functions-serve/contact-sales/___netlify-telemetry.mjs
- .netlify/functions-serve/create-checkout/___netlify-bootstrap.mjs
- .netlify/functions-serve/create-checkout/___netlify-telemetry.mjs
- .netlify/functions-serve/create-checkout/netlify/functions/create-checkout.mjs
- .netlify/functions-serve/get-order/___netlify-bootstrap.mjs
- .netlify/functions-serve/get-order/___netlify-telemetry.mjs
- .netlify/functions-serve/health/___netlify-bootstrap.mjs
- .netlify/functions-serve/health/___netlify-telemetry.mjs
- .netlify/functions-serve/process-queue-scheduled/___netlify-bootstrap.mjs
- .netlify/functions-serve/process-queue-scheduled/___netlify-telemetry.mjs
- .netlify/functions-serve/process-queue/___netlify-bootstrap.mjs
- .netlify/functions-serve/process-queue/___netlify-telemetry.mjs
- .netlify/functions-serve/report-preview/___netlify-bootstrap.mjs
- .netlify/functions-serve/report-preview/___netlify-telemetry.mjs
- .netlify/functions-serve/stripe-webhook/___netlify-bootstrap.mjs
- .netlify/functions-serve/stripe-webhook/___netlify-telemetry.mjs
- .netlify/functions-serve/track-event/___netlify-bootstrap.mjs
- .netlify/functions-serve/track-event/___netlify-telemetry.mjs
- README.md
- netlify/functions/_lib/validation.js
- public/index.html
- scripts/traceworks_bootstrap.sh
- tw_engine.py

### Checkout flow path
- .netlify/functions-serve/create-checkout/___netlify-entry-point.mjs
- .netlify/functions-serve/create-checkout/netlify/functions/create-checkout.mjs
- .netlify/functions-serve/health/netlify/functions/health.mjs
- .netlify/functions-serve/stripe-webhook/___netlify-entry-point.mjs
- .netlify/functions-serve/stripe-webhook/netlify/functions/stripe-webhook.mjs
- README.md
- netlify.toml
- netlify/functions/_lib/validation.js
- netlify/functions/create-checkout.js
- netlify/functions/health.js
- netlify/functions/stripe-webhook.js
- ops/traceworks-audit/20260310-233251/api_candidates.txt
- ops/traceworks-audit/20260310-233251/env_names.txt
- ops/traceworks-audit/20260310-233251/env_references.txt
- ops/traceworks-audit/20260310-233251/webhook_candidates.txt
- package-lock.json
- package.json
- public/app.js
- public/cancel.html
- public/index.html
- public/launch-readiness.html
- public/packages.js
- scripts/traceworks_bootstrap.sh
- tests/frontend.test.js
- tests/hardening.test.js
- tests/report.test.js

### Success / cancel pages
- .netlify/functions-serve/admin-metrics/___netlify-bootstrap.mjs
- .netlify/functions-serve/admin-metrics/___netlify-telemetry.mjs
- .netlify/functions-serve/contact-sales/___netlify-bootstrap.mjs
- .netlify/functions-serve/contact-sales/___netlify-telemetry.mjs
- .netlify/functions-serve/create-checkout/___netlify-bootstrap.mjs
- .netlify/functions-serve/create-checkout/___netlify-telemetry.mjs
- .netlify/functions-serve/create-checkout/netlify/functions/create-checkout.mjs
- .netlify/functions-serve/get-order/___netlify-bootstrap.mjs
- .netlify/functions-serve/get-order/___netlify-telemetry.mjs
- .netlify/functions-serve/health/___netlify-bootstrap.mjs
- .netlify/functions-serve/health/___netlify-telemetry.mjs
- .netlify/functions-serve/process-queue-scheduled/___netlify-bootstrap.mjs
- .netlify/functions-serve/process-queue-scheduled/___netlify-telemetry.mjs
- .netlify/functions-serve/process-queue/___netlify-bootstrap.mjs
- .netlify/functions-serve/process-queue/___netlify-telemetry.mjs
- .netlify/functions-serve/report-preview/___netlify-bootstrap.mjs
- .netlify/functions-serve/report-preview/___netlify-telemetry.mjs
- .netlify/functions-serve/stripe-webhook/___netlify-bootstrap.mjs
- .netlify/functions-serve/stripe-webhook/___netlify-telemetry.mjs
- .netlify/functions-serve/track-event/___netlify-bootstrap.mjs
- .netlify/functions-serve/track-event/___netlify-telemetry.mjs
- README.md
- netlify/functions/create-checkout.js
- public/cancel.html
- public/launch-readiness.html
- public/success.html
- scripts/traceworks_bootstrap.sh
- tw_engine.py

### Admin pages
- .netlify/functions-serve/admin-metrics/___netlify-bootstrap.mjs
- .netlify/functions-serve/admin-metrics/___netlify-entry-point.mjs
- .netlify/functions-serve/admin-metrics/___netlify-telemetry.mjs
- .netlify/functions-serve/admin-metrics/netlify/functions/admin-metrics.mjs
- .netlify/functions-serve/contact-sales/___netlify-bootstrap.mjs
- .netlify/functions-serve/contact-sales/___netlify-telemetry.mjs
- .netlify/functions-serve/create-checkout/___netlify-bootstrap.mjs
- .netlify/functions-serve/create-checkout/___netlify-telemetry.mjs
- .netlify/functions-serve/create-checkout/netlify/functions/create-checkout.mjs
- .netlify/functions-serve/get-order/___netlify-bootstrap.mjs
- .netlify/functions-serve/get-order/___netlify-telemetry.mjs
- .netlify/functions-serve/get-order/netlify/functions/get-order.mjs
- .netlify/functions-serve/health/___netlify-bootstrap.mjs
- .netlify/functions-serve/health/___netlify-telemetry.mjs
- .netlify/functions-serve/health/netlify/functions/health.mjs
- .netlify/functions-serve/process-queue-scheduled/___netlify-bootstrap.mjs
- .netlify/functions-serve/process-queue-scheduled/___netlify-entry-point.mjs
- .netlify/functions-serve/process-queue-scheduled/___netlify-telemetry.mjs
- .netlify/functions-serve/process-queue-scheduled/netlify/functions/process-queue-scheduled.mjs
- .netlify/functions-serve/process-queue/___netlify-bootstrap.mjs
- .netlify/functions-serve/process-queue/___netlify-entry-point.mjs
- .netlify/functions-serve/process-queue/___netlify-telemetry.mjs
- .netlify/functions-serve/process-queue/netlify/functions/process-queue.mjs
- .netlify/functions-serve/report-preview/___netlify-bootstrap.mjs
- .netlify/functions-serve/report-preview/___netlify-telemetry.mjs
- .netlify/functions-serve/stripe-webhook/___netlify-bootstrap.mjs
- .netlify/functions-serve/stripe-webhook/___netlify-telemetry.mjs
- .netlify/functions-serve/stripe-webhook/netlify/functions/stripe-webhook.mjs
- .netlify/functions-serve/track-event/___netlify-bootstrap.mjs
- .netlify/functions-serve/track-event/___netlify-telemetry.mjs
- .netlify/functions-serve/track-event/netlify/functions/track-event.mjs
- README.md
- netlify.toml
- netlify/functions/_lib/process-one-job.js
- netlify/functions/_lib/store.js
- netlify/functions/admin-metrics.js
- netlify/functions/get-order.js
- netlify/functions/process-queue-scheduled.js
- netlify/functions/process-queue.js
- netlify/functions/stripe-webhook.js

### PWA/installability
- scripts/traceworks_bootstrap.sh

## Non-negotiable constraints
- Do not break Stripe checkout, webhook flow, queue processing, report generation, admin UI, or tests.
- Do not replace real logic with mock or demo logic.
- Do not overpromise what the reports can do.
- Do not add fake trust signals, fake client logos, fake testimonials, fake badges, lorem ipsum, TODOs, or half-finished sections.
- Do not only restyle the current layout. Re-architect the page experience where it is safe and backed by the repo.
- If product capability is narrower than current marketing language, narrow the marketing language.
- If backend delivery is async, the UX must say that clearly.
- Every major implementation area must include a proof block.

## Mandatory design direction
- Premium legal-tech
- Dark executive interface
- Deep navy / midnight / graphite
- Restrained gold accent
- Cleaner hierarchy
- Sharper mobile UX
- Real trust language only
- Better package differentiation
- Better intake structure
- Better scope clarity
- Better footer completeness
- Better success/cancel clarity
- Better installability and runtime hardening if the repo supports it

## Current risk signals from scan
- Placeholder/demo markers exist and should be removed from any production-facing path.
- Potential legal/trust overclaim language detected. Audit required before scaling paid traffic.
- No obvious frontend entry file detected by heuristic scan.
- Placeholder or demo wording detected in repo.
- No global stylesheet found in common locations. Visual consistency may be fragmented.
- Packages/pricing content appears spread across many files. High risk of repeated or inconsistent copy.
- Potential overclaim or legally risky wording detected.
- Placeholder/demo wording detected.
- Package language likely duplicated across multiple files and needs normalization.

