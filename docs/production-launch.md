# TraceWorks Production Launch

This checklist is for the real Netlify deployment path only.

## Required Now

Set these in Netlify site environment variables before taking paid traffic:

- `URL`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USER` or `SMTP_USERNAME`
- `SMTP_PASS` or `SMTP_PASSWORD`
- `EMAIL_FROM` or `FROM_ADDRESS`
- `OWNER_EMAIL`
- `TRACEWORKS_STORAGE_DRIVER=kv`
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`
- `ADMIN_API_KEY`
- `STATUS_TOKEN_SECRET`
- `QUEUE_CRON_SECRET`
- `APPRAISAL_API_URL`
- `TAX_COLLECTOR_API_URL`
- `PARCEL_GIS_API_URL`
- `COUNTY_CLERK_API_URL`
- `GRANTOR_GRANTEE_API_URL`
- `MORTGAGE_INDEX_API_URL`
- `OBITUARY_API_URL`
- `PROBATE_API_URL`
- `PEOPLE_ASSOC_LICENSED=true`
- `PEOPLE_ASSOC_API_URL`

## Premium OSINT Providers

These are optional for launch, but recommended if you want richer paid-package web intelligence:

- `FIRECRAWL_API_KEY`
- `FIRECRAWL_API_URL` defaults to `https://api.firecrawl.dev/v2`
- `FIRECRAWL_OSINT_RESULT_LIMIT`
- `FIRECRAWL_OSINT_SCRAPE_RESULTS=true`
- `APIFY_API_TOKEN`
- `APIFY_OSINT_ACTOR_ID` defaults to `apify~google-search-scraper`
- `APIFY_OSINT_RESULT_LIMIT`
- `APIFY_OSINT_TIMEOUT_SECONDS`
- `APIFY_OSINT_INPUT_TEMPLATE` only if you are using a custom actor contract

TraceWorks treats these as enrichment providers, not legal-record sources. They can add cited web leads and scraped context, but they do not replace the county/probate/title source modules above.

## Source Endpoint Contracts

These source endpoints are expected to return JSON and accept query parameters as follows:

- `APPRAISAL_API_URL`: `county`, `state`, `q`
- `TAX_COLLECTOR_API_URL`: `county`, `state`, `parcelId`
- `PARCEL_GIS_API_URL`: `county`, `state`, `q`
- `COUNTY_CLERK_API_URL`: `county`, `state`, `q`, `queryType`
- `GRANTOR_GRANTEE_API_URL`: `county`, `state`, `ownerName`, `parcelId`
- `MORTGAGE_INDEX_API_URL`: `county`, `state`, `parcelId`
- `OBITUARY_API_URL`: `name`, `county`, `state`, `deathYear`
- `PROBATE_API_URL`: `county`, `state`, `name`, `deathYear`
- `PEOPLE_ASSOC_API_URL`: `name`, `address`, `related`

Non-empty responses should contain the keys the workflow expects, such as:

- appraisal: `ownerName`, `parcelId`, `legalDescription`, `assessedValue`
- tax: `parcelId`, `taxYear`, `amountDue`, `status`
- GIS: `parcelId`, `address`, `latitude`, `longitude`
- clerk / grantor-grantee: `instruments[]`
- mortgage: `instrumentNumber`, `recordingDate`, `lender`, `borrower`
- obituary: `decedentName`, `publishedAt`, `city`, `sourceUrl`
- probate: `caseNumber`, `filingDate`, `status`, `court`
- people association: `candidates[]`

## Launch Sequence

1. Rotate any exposed secrets before production use.
2. Populate Netlify environment variables.
3. Deploy the site.
4. Run `npm run launch:audit`.
5. Run `npm run live:smoke -- --url https://your-site.example --admin-key YOUR_ADMIN_API_KEY`.
6. Run one real paid end-to-end order on the deployed domain.
7. Verify email delivery, status links, queue progression, artifact access, and Netlify logs.
