/**
 * GET /api/report-preview?packageId=standard
 * Renders a live HTML report preview using the dynamic report builder.
 * Uses sample/mock WorkflowResults — never runs real OSINT.
 * No auth required (public-facing preview for sales/demo).
 */

import { makeWorkflowResults, makeSourceResult } from './_lib/schema.js';
import { reportToHtml } from './_lib/report.js';
import { hitRateLimit } from './_lib/rate-limit.js';

const VALID_PACKAGES = ['standard', 'ownership_encumbrance', 'probate_heirship', 'asset_network', 'comprehensive'];

function makeSampleWorkflowResults(packageId) {
  const sources = [];

  // Property record (all tiers)
  sources.push(makeSourceResult({
    sourceId: 'harris_cad',
    sourceLabel: 'Harris County Appraisal District',
    sourceUrl: 'https://hcad.org/property-search/real-property/',
    queryUsed: '123 Main Street Houston TX',
    status: 'found',
    data: {
      properties: [{
        parcelId: '0650840000001',
        ownerName: 'SAMPLE OWNER LLC',
        situsAddress: '123 MAIN ST, HOUSTON TX 77002',
        legalDesc: 'LT 1 BLK 5 DOWNTOWN ADDITION',
        assessedValue: '$485,000',
        taxYear: '2024',
        propertyClass: 'Commercial Real Property',
      }],
      totalReturned: 1,
    },
    confidence: 'likely',
  }));

  if (['ownership_encumbrance', 'asset_network', 'comprehensive'].includes(packageId)) {
    sources.push(makeSourceResult({
      sourceId: 'harris_deed_index',
      sourceLabel: 'Harris County Clerk Deed Index',
      sourceUrl: 'https://www.harriscountyclerk.org/',
      queryUsed: 'SAMPLE OWNER LLC',
      status: 'unavailable',
      errorDetail: 'SOURCE_REQUIRES_MANUAL_REVIEW — County deed index requires browser session. Search manually at the Harris County Clerk portal.',
      data: null,
      confidence: 'manual_review',
    }));

    sources.push(makeSourceResult({
      sourceId: 'tx_sos',
      sourceLabel: 'TX Secretary of State Entity Search',
      sourceUrl: 'https://mycpa.cpa.state.tx.us/coa/',
      queryUsed: 'SAMPLE OWNER LLC',
      status: 'found',
      data: {
        entities: [{ entityName: 'SAMPLE OWNER LLC', status: 'Active', entityType: 'Domestic Limited Liability Company' }],
        totalReturned: 1,
      },
      confidence: 'likely',
    }));
  }

  if (['probate_heirship', 'comprehensive'].includes(packageId)) {
    sources.push(makeSourceResult({
      sourceId: 'tx_courts_online',
      sourceLabel: 'TX Courts Online (Probate/Civil)',
      sourceUrl: 'https://publicaccess.courts.state.tx.us/',
      queryUsed: 'John Sample | Harris County',
      status: 'unavailable',
      errorDetail: 'SOURCE_REQUIRES_MANUAL_REVIEW — TX Courts Online requires browser session. Search by party name at the TX Courts Online portal.',
      data: null,
      confidence: 'manual_review',
    }));

    sources.push(makeSourceResult({
      sourceId: 'truepeoplesearch',
      sourceLabel: 'TruePeopleSearch',
      sourceUrl: 'https://www.truepeoplesearch.com/',
      queryUsed: 'John Sample TX',
      status: 'found',
      data: {
        people: [{
          name: 'John A. Sample',
          addresses: ['123 Main St, Houston TX 77002', '456 Oak Ave, Katy TX 77449'],
          phones: ['(713) 555-0100'],
          relatives: ['Jane Sample', 'Robert Sample'],
        }],
        totalReturned: 1,
      },
      confidence: 'possible',
    }));
  }

  // DuckDuckGo supplemental (all tiers)
  sources.push(makeSourceResult({
    sourceId: 'duckduckgo',
    sourceLabel: 'DuckDuckGo Public Web Search',
    sourceUrl: 'https://api.duckduckgo.com/',
    queryUsed: 'SAMPLE OWNER LLC Harris County TX public record',
    status: 'found',
    data: {
      results: [
        { title: 'Harris County Appraisal District — Property Search Results', url: 'https://hcad.org/' },
        { title: 'TX Secretary of State — Entity Filing Records', url: 'https://mycpa.cpa.state.tx.us/coa/' },
      ],
    },
    confidence: 'possible',
  }));

  return makeWorkflowResults({
    orderId: 'PREVIEW-SAMPLE',
    tier: packageId,
    inputs: {
      caseRef: 'PREVIEW-SAMPLE',
      companyName: 'SAMPLE OWNER LLC / John Sample',
      county: 'Harris',
      state: 'TX',
      website: '',
      goals: 'Demonstrate report format and source coverage for this investigation tier.',
    },
    sources,
    startedAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
  });
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    res.status(405).end('Method Not Allowed');
    return;
  }

  const ip = req.headers['x-forwarded-for'] || req.headers['client-ip'] || 'unknown';
  const rl = hitRateLimit({ key: `preview:${ip}`, windowMs: 60_000, max: 20 });
  if (rl.limited) {
    res.status(429).json({ error: 'Too many requests.' });
    return;
  }

  const packageId = (req.query?.packageId || 'standard').toLowerCase();
  if (!VALID_PACKAGES.includes(packageId)) {
    res.status(400).json({ error: `Invalid packageId. Valid values: ${VALID_PACKAGES.join(', ')}` });
    return;
  }

  const workflowResults = makeSampleWorkflowResults(packageId);
  const html = reportToHtml(workflowResults);

  // Wrap in a full document with preview banner
  const previewBanner = `
    <div style="background:#c9a84c;color:#09090f;padding:10px 20px;font-family:monospace;font-size:13px;text-align:center;position:sticky;top:0;z-index:9999;font-weight:700;letter-spacing:.05em;">
      SAMPLE PREVIEW — This report was generated from simulated data. Real investigations use live public-record sources.
      &nbsp;&nbsp;|&nbsp;&nbsp;
      <a href="/#order" style="color:#09090f;text-decoration:underline;">Purchase a Real Report</a>
    </div>`;

  const fullHtml = `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Report Preview — ${packageId} — TraceWorks™</title>
  <link rel="stylesheet" href="/styles.css" />
  <style>
    body { background: #09090f; }
    .report-wrap { max-width: 900px; margin: 0 auto; padding: 40px 24px 80px; }
  </style>
</head>
<body>
  ${previewBanner}
  <div class="report-wrap">${html}</div>
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=300');
  res.status(200).send(fullHtml);
}
