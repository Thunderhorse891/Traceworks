/**
 * TraceWorks 7-Step WorkflowRunner.
 * Each tier executes the applicable steps in order.
 * Steps are never silently skipped — if not applicable they are documented.
 *
 * STEP 1: Property Search (CAD)
 * STEP 2: Owner ID + Entity Detection
 * STEP 3: Deed Index Search (county clerk)
 * STEP 4: Probate Search (TX Courts)
 * STEP 5: People / Heir Network Search
 * STEP 6: Entity Registry Search (TX SOS)
 * STEP 7: Build WorkflowResults
 */

import {
  texasCADScraper,
  entityOwnerDetector,
  truePeopleSearchScraper,
  fastPeopleSearchScraper,
  obituaryIndexScraper,
  txCourtsOnlineScraper,
  txSOSScraper,
  heirCandidateScorer,
  duckDuckGoSearch,
  countyDeedIndexUnavailable,
} from './source-modules.js';
import { makeWorkflowResults } from './schema.js';

const TIER_STEPS = {
  standard:              [1, 2, 7],
  ownership_encumbrance: [1, 2, 3, 7],
  probate_heirship:      [1, 2, 4, 5, 7],
  asset_network:         [1, 2, 3, 6, 7],
  comprehensive:         [1, 2, 3, 4, 5, 6, 7],
  custom:                [1, 2, 7],
};

export async function runWorkflow(tier, inputs, fetchImpl = fetch) {
  const startedAt = new Date().toISOString();
  const sources   = [];
  const steps     = TIER_STEPS[tier] || TIER_STEPS.standard;

  const {
    caseRef,
    companyName   = '',    // subject name or entity name
    county        = 'Harris',
    state         = 'TX',
    website       = '',
    goals         = '',
  } = inputs;

  // Split subject name into first/last for people searches
  const nameParts   = companyName.trim().split(/\s+/);
  const firstName   = nameParts[0] || '';
  const lastName    = nameParts.slice(1).join(' ') || nameParts[0] || '';

  let ownerName     = companyName;
  let entityCheck   = { isEntity: false, entityType: null, normalizedName: companyName };
  let heirCandidates = [];

  // ── STEP 1: Property Search ──────────────────────────────────
  if (steps.includes(1)) {
    const cadResult = await texasCADScraper(county, companyName, fetchImpl);
    sources.push(cadResult);

    // Pull owner name from CAD if available
    if (cadResult.status === 'found' && cadResult.data?.properties?.[0]?.ownerName) {
      ownerName = cadResult.data.properties[0].ownerName;
    }
  }

  // ── STEP 2: Owner ID + Entity Detection ──────────────────────
  if (steps.includes(2)) {
    entityCheck = entityOwnerDetector(ownerName);
  }

  // ── STEP 3: Deed Index Search ────────────────────────────────
  if (steps.includes(3)) {
    // Deed index portals require browser sessions — honest unavailable
    sources.push(countyDeedIndexUnavailable(county, state, ownerName));

    // Supplemental: DuckDuckGo search for public deed records
    const ddgResult = await duckDuckGoSearch(`${ownerName} deed record ${county} county ${state} site:cad.org OR site:countyclerk.com OR site:txcourts.gov`, fetchImpl);
    sources.push(ddgResult);
  }

  // ── STEP 4: Probate Search ───────────────────────────────────
  if (steps.includes(4)) {
    const probateResult = await txCourtsOnlineScraper(ownerName, county, fetchImpl);
    sources.push(probateResult);

    // Supplemental obituary search
    const obituaryResult = await obituaryIndexScraper(ownerName, county, state, fetchImpl);
    sources.push(obituaryResult);
  }

  // ── STEP 5: People / Heir Network Search ─────────────────────
  if (steps.includes(5)) {
    const [tpsResult, fpsResult] = await Promise.all([
      truePeopleSearchScraper(firstName, lastName, state, fetchImpl),
      fastPeopleSearchScraper(firstName, lastName, state, fetchImpl),
    ]);
    sources.push(tpsResult, fpsResult);

    // Build heir candidate list from both sources
    const tpsPeople = tpsResult.status === 'found' ? (tpsResult.data?.people || []) : [];
    const fpsPeople = fpsResult.status === 'found' ? (fpsResult.data?.people || []) : [];
    const allPeople = [...tpsPeople, ...fpsPeople];
    heirCandidates  = heirCandidateScorer(allPeople, lastName);
  }

  // ── STEP 6: Entity Registry Search ───────────────────────────
  if (steps.includes(6) && entityCheck.isEntity) {
    const sosResult = await txSOSScraper(entityCheck.normalizedName, fetchImpl);
    sources.push(sosResult);
  } else if (steps.includes(6) && !entityCheck.isEntity) {
    // Document that entity branch was evaluated but not triggered
    sources.push({
      sourceId:    'tx_sos_skipped',
      sourceLabel: 'TX Secretary of State (Entity Search)',
      sourceUrl:   'https://mycpa.cpa.state.tx.us/coa/',
      queryUsed:   ownerName,
      queriedAt:   new Date().toISOString(),
      status:      'not_found',
      errorDetail: `Entity detection ran on "${ownerName}" — determined to be an individual (not a corporate entity). Entity registry search not applicable.`,
      data:        null,
      confidence:  'not_found',
    });
  }

  // ── STEP 7: Build WorkflowResults ────────────────────────────
  return makeWorkflowResults({
    orderId: caseRef,
    tier,
    inputs: { ...inputs, entityDetected: entityCheck.isEntity, entityType: entityCheck.entityType },
    sources,
    startedAt,
    completedAt: new Date().toISOString(),
    ...(heirCandidates.length > 0 ? { heirCandidates } : {}),
  });
}
