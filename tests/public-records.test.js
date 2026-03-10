import test from 'node:test';
import assert from 'node:assert/strict';

import { gatherPublicRecordIntel } from '../netlify/functions/_lib/public-records.js';

function jsonResponse(status, data) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async text() {
      return JSON.stringify(data);
    }
  };
}

function htmlResponse(status, html) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async text() {
      return html;
    }
  };
}

test('gatherPublicRecordIntel runs config-driven html/json adapters and logs evidence', async () => {
  const env = {
    PAID_FULFILLMENT_STRICT: 'true',
    PUBLIC_RECORD_SOURCE_CONFIG: JSON.stringify({
      countyProperty: [
        {
          id: 'county_property_demo_html',
          name: 'County Property Search Demo',
          type: 'html',
          request: { urlTemplate: 'https://example.com/property-search?q={address}', method: 'GET' },
          extraction: {
            itemRegex: '<tr><td>([^<]*)</td><td>([^<]*)</td><td>([^<]*)</td></tr>',
            map: { owner: 1, address: 2, parcel: 3 }
          }
        }
      ],
      countyRecorder: [
        {
          id: 'county_recorder_demo_html',
          name: 'County Recorder Demo',
          type: 'html',
          request: { urlTemplate: 'https://example.com/recorder-search?name={owner}' },
          extraction: {
            itemRegex: '<tr><td>([^<]*)</td><td>([^<]*)</td><td>([^<]*)</td><td>([^<]*)</td></tr>',
            map: { recordingDate: 1, instrumentType: 2, grantorGrantee: 3, instrumentNumber: 4 }
          }
        }
      ],
      probateIndex: [],
      entitySearch: [
        {
          id: 'entity_search_demo_json',
          name: 'Entity Search Demo',
          type: 'json',
          request: { urlTemplate: 'https://example.com/entity-search?name={entityName}' },
          extraction: {
            itemsPath: 'results',
            map: { entityName: 'name', state: 'state', status: 'status', filingNumber: 'filingNumber' }
          }
        }
      ]
    })
  };

  const fetchImpl = async (url) => {
    if (url.includes('/property-search')) {
      return htmlResponse(200, '<table><tr><td>Jane Owner</td><td>100 Main St</td><td>A-1</td></tr></table>');
    }
    if (url.includes('/recorder-search')) {
      return htmlResponse(200, '<table><tr><td>2024-01-01</td><td>Deed</td><td>Jane Owner</td><td>12345</td></tr></table>');
    }
    if (url.includes('/entity-search')) {
      return jsonResponse(200, { results: [{ name: 'Main Holdings LLC', state: 'TX', status: 'active', filingNumber: 'F-77' }] });
    }
    return htmlResponse(404, 'not found');
  };

  const out = await gatherPublicRecordIntel(
    {
      packageKey: 'title_property',
      input: { address: '100 Main St', ownerName: 'Jane Owner', entityName: 'Main Holdings LLC' }
    },
    { fetchImpl, env }
  );

  assert.equal(out.gaps.length, 0);
  assert.equal(out.findings.property.length, 1);
  assert.equal(out.findings.recorder.length, 1);
  assert.equal(out.findings.entity.length, 1);
  assert.ok(out.evidence.length >= 3);
  assert.ok(out.sources.every((s) => s.queryUsed && s.sourceUrl));
});

test('gatherPublicRecordIntel fails loudly in strict mode when config is missing', async () => {
  await assert.rejects(
    gatherPublicRecordIntel(
      { packageKey: 'title_property', input: { ownerName: 'Missing Config' } },
      { env: { PAID_FULFILLMENT_STRICT: 'true', PUBLIC_RECORD_SOURCE_CONFIG: '{"countyProperty":[],"countyRecorder":[],"probateIndex":[],"entitySearch":[]}' } }
    ),
    /Missing required public record source configuration/
  );
});
