import test from 'node:test';
import assert from 'node:assert/strict';

import { DISCLAIMERS } from '../netlify/functions/_lib/disclaimers.js';
import { makeWorkflowResults, scanForForbiddenPhrases } from '../netlify/functions/_lib/schema.js';

test('ownership disclaimer avoids forbidden clear-title phrasing', () => {
  const text = DISCLAIMERS.ownership_encumbrance;
  assert.equal(text.toLowerCase().includes('clear title'), false);
  assert.deepEqual(scanForForbiddenPhrases(text), []);
});

test('makeWorkflowResults carries heir candidates through to report layer', () => {
  const heirCandidates = [{ fullName: 'Jordan Mercer', confidence: 'likely' }];
  const out = makeWorkflowResults({
    orderId: 'TW-HEIR-1',
    tier: 'probate_heirship',
    inputs: { ownerName: 'Jordan Mercer' },
    sources: [],
    startedAt: new Date().toISOString(),
    heirCandidates,
  });

  assert.deepEqual(out.heirCandidates, heirCandidates);
});
