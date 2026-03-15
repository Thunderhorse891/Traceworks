import test from 'node:test';
import assert from 'node:assert/strict';
import { buildReport, reportToHtml } from '../netlify/functions/_lib/report.js';
import { buildDynamicReportFromWorkflow, dynamicReportToText } from '../netlify/functions/_lib/dynamic-report-builder.js';
import { CONFIDENCE, SOURCE_STATUS } from '../netlify/functions/_lib/workflow-results.js';
import { normalizeCheckoutPayload, validateCheckoutPayload } from '../netlify/functions/_lib/validation.js';

const PACKAGE_IDS = ['standard', 'ownership_encumbrance', 'probate_heirship', 'asset_network', 'comprehensive'];

test('all 4 tiers generate non-blank sections and premium structures', () => {
  for (const id of PACKAGE_IDS) {
    const report = buildReport({ packageId: id, caseRef: 'TW-TEST-1', intel: { sources: [], providerNote: '' } });
    assert.ok(report.dossierName.length > 0);
    assert.ok(report.caseRef.startsWith('TW-'));
    assert.ok(report.sections.length >= 4);
    assert.ok(Array.isArray(report.evidenceMatrix));
    assert.ok(report.redFlags.length >= 1);
    assert.ok(report.nextActions48h.length >= 4);
    for (const section of report.sections) {
      assert.ok(section.title.trim().length > 0);
      for (const finding of section.findings) {
        assert.ok(finding.trim().length > 0);
        assert.notEqual(finding.toLowerCase(), 'null');
      }
    }
  }
});

test('html rendering includes evidence matrix and action sections', () => {
  const html = reportToHtml(buildReport({ packageId: 'ownership_encumbrance', caseRef: 'TW-TEST-2' }));
  assert.ok(html.includes('Ownership &amp; Encumbrance') || html.includes('Intelligence Report'));
  assert.ok(html.includes('Source Citations'));
  assert.ok(html.includes('Evidence Matrix'));
  assert.ok(html.includes('Next 48 Hours Actions'));
  assert.equal(html.includes('null'), false);
});

test('checkout payload validation enforces legal and terms consent', () => {
  const payload = normalizeCheckoutPayload({
    packageId: 'standard',
    customerName: 'Law Firm',
    customerEmail: 'invalid-email',
    companyName: '',
    legalConsent: false,
    tosConsent: false
  });

  const errors = validateCheckoutPayload(payload);
  assert.ok(errors.length >= 3);
});

test('report includes no-refund redo policy language in disclaimer', () => {
  const report = buildReport({ packageId: 'standard', caseRef: 'TW-TEST-3' });
  assert.ok(report.disclaimer.includes('not legal advice') || report.disclaimer.includes('not legal advice'));
  assert.ok(report.disclaimer.includes('licensed professionals'));
});

test('report does not inject fabricated fallback citations when direct hits are missing', () => {
  const report = buildReport({
    packageId: 'standard',
    caseRef: 'TW-TEST-4',
    intel: { sources: [] }
  });

  const lines = report.sections.flatMap((section) => section.findings);
  assert.equal(report.sources.length, 0);
  assert.equal(report.evidenceMatrix.length, 0);
  assert.ok(lines.some((line) => line.includes('did not return a cited source hit')));
});

test('dynamic report counts skipped sources separately from errors', () => {
  const report = buildDynamicReportFromWorkflow(
    {
      tier: 'comprehensive',
      orderId: 'TW-TEST-5',
      overallStatus: 'partial',
      inputs: { ownerName: 'Jane Owner' },
      sources: [
        {
          sourceId: 'county_property',
          sourceLabel: 'County Property',
          sourceUrl: 'https://example.com/property',
          queryUsed: '{"owner":"Jane Owner"}',
          queriedAt: new Date().toISOString(),
          status: SOURCE_STATUS.SKIPPED,
          confidence: CONFIDENCE.NOT_VERIFIED,
          errorDetail: 'No address supplied.',
          data: []
        },
        {
          sourceId: 'county_recorder',
          sourceLabel: 'County Recorder',
          sourceUrl: 'https://example.com/recorder',
          queryUsed: '{"owner":"Jane Owner"}',
          queriedAt: new Date().toISOString(),
          status: SOURCE_STATUS.ERROR,
          confidence: CONFIDENCE.NOT_VERIFIED,
          errorDetail: 'Unexpected upstream error.',
          data: []
        }
      ]
    },
    {
      customerName: 'TraceWorks QA',
      customerEmail: 'qa@example.com',
      purchased_tier: 'comprehensive'
    }
  );

  assert.equal(report.sourceSummary.skipped, 1);
  assert.equal(report.sourceSummary.errors, 1);

  const text = dynamicReportToText(report);
  assert.ok(text.includes('- Skipped: 1'));
  assert.ok(text.includes('- Errors: 1'));
});
