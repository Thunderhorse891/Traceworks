import test from 'node:test';
import assert from 'node:assert/strict';
import { buildReport, reportToHtml } from './netlify/functions/_lib/report.js';
import { normalizeCheckoutPayload, validateCheckoutPayload } from './netlify/functions/_lib/validation.js';

const PACKAGE_IDS = ['locate', 'comprehensive', 'title', 'heir'];

test('all 4 tiers generate non-blank sections and premium structures', () => {
  for (const id of PACKAGE_IDS) {
    const report = buildReport({ packageId: id, caseRef: 'TW-TEST-1', intel: { sources: [], providerNote: '' } });
    assert.ok(report.dossierName.length > 0);
    assert.ok(report.caseRef.startsWith('TW-'));
    assert.ok(report.sections.length >= 4);
    assert.ok(report.evidenceMatrix.length >= 1);
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
  const html = reportToHtml(buildReport({ packageId: 'title', caseRef: 'TW-TEST-2' }));
  assert.ok(html.includes('Ownership Trail'));
  assert.ok(html.includes('Source Citations'));
  assert.ok(html.includes('Evidence Matrix'));
  assert.ok(html.includes('Next 48 Hours Actions'));
  assert.equal(html.includes('null'), false);
});

test('checkout payload validation enforces legal and terms consent', () => {
  const payload = normalizeCheckoutPayload({
    packageId: 'locate',
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
  const report = buildReport({ packageId: 'locate', caseRef: 'TW-TEST-3' });
  assert.ok(report.disclaimer.includes('No refunds after work starts'));
  assert.ok(report.disclaimer.includes('redo'));
});

test('report adds explicit fallback language when direct hits are missing', () => {
  const report = buildReport({
    packageId: 'locate',
    caseRef: 'TW-TEST-4',
    intel: {
      sources: [
        {
          title: 'Government index fallback',
          url: 'https://www.usa.gov/state-county-local-governments',
          sourceType: 'fallback',
          confidence: 'medium',
          provider: 'static-fallback',
          domain: 'usa.gov'
        }
      ]
    }
  });

  const lines = report.sections.flatMap((section) => section.findings);
  assert.ok(lines.some((line) => line.includes('No direct verifiable hit surfaced')));
});
