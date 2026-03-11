/**
 * TraceWorks Source Runner
 * Tier-aware connector orchestration engine.
 *
 * Responsibilities:
 *   - Select connectors based on investigation tier
 *   - Build connector-specific inputs from order payload
 *   - Run connectors (parallel where safe, sequential where rate-limited)
 *   - Deduplicate results across connectors
 *   - Aggregate evidence records
 *   - Return structured RunnerResult
 *
 * RunnerResult:
 *   {
 *     tier, inputs, startedAt, completedAt,
 *     results: [],     // flat deduplicated result objects
 *     evidence: [],    // flat evidence records with type/label/confidence
 *     sources: [],     // connector execution summaries
 *     errors: [],      // connector-level errors
 *     litigationSignalCount: number,
 *     connectorHealth: { [connectorName]: { success, resultCount, errors } }
 *   }
 */

import { CONNECTOR_MAP, TIER_CONNECTORS } from './connectors/index.js';

function buildConnectorInput(connectorName, { companyName = '', county = 'Harris', state = 'TX', website = '', fetchImpl = fetch }) {
  const nameParts = companyName.trim().split(/\s+/);
  const firstName = nameParts[0] || '';
  const lastName = nameParts.slice(1).join(' ') || nameParts[0] || '';

  const base = { fetchImpl };

  switch (connectorName) {
    case 'county-property':
      return { ...base, county, query: companyName, state };

    case 'county-recorder':
      return { ...base, county, query: companyName, state };

    case 'probate-index':
      return { ...base, name: companyName, county, state };

    case 'entity-search':
      return { ...base, entityName: companyName };

    case 'corporate-filings':
      return { ...base, entityName: companyName, state };

    case 'domain-records':
      return { ...base, domain: website || `${companyName.toLowerCase().replace(/\s+/g, '')}.com`, subjectName: companyName };

    case 'news-search':
      return { ...base, query: companyName, county, state };

    case 'people-search':
      return { ...base, firstName, lastName, state };

    case 'address-history':
      return { ...base, firstName, lastName, state };

    case 'phone-association':
      return { ...base, firstName, lastName, state };

    default:
      return { ...base, query: companyName };
  }
}

function dedupeResults(allResults) {
  const seen = new Set();
  return allResults.filter((r) => {
    // Deduplicate by address string or URL or phone number
    const key = r.address || r.url || r.phone || r.formatted || JSON.stringify(r).slice(0, 120);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function dedupeEvidence(allEvidence) {
  const seen = new Set();
  return allEvidence.filter((e) => {
    const key = `${e.type}:${e.sourceUrl || e.label}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function runSources(tier, inputs) {
  const startedAt = new Date().toISOString();
  const connectorNames = TIER_CONNECTORS[tier] || TIER_CONNECTORS.standard;

  // Skip domain-records if no website provided
  const filtered = connectorNames.filter((name) => {
    if (name === 'domain-records' && !inputs.website) return false;
    return true;
  });

  // Run all selected connectors in parallel
  const runs = await Promise.allSettled(
    filtered.map(async (name) => {
      const connector = CONNECTOR_MAP[name];
      if (!connector) return { name, skipped: true, reason: `Connector '${name}' not found in registry` };

      const input = buildConnectorInput(name, inputs);
      const result = await connector.runConnector(input);
      return { name, ...result };
    })
  );

  const allResults = [];
  const allEvidence = [];
  const allErrors = [];
  const sources = [];
  const health = {};

  for (const run of runs) {
    if (run.status === 'rejected') {
      const err = String(run.reason?.message || run.reason || 'unknown');
      allErrors.push(err);
      continue;
    }

    const { name, success, results = [], evidence = [], errors = [], skipped, reason, litigationSignalCount } = run.value;

    health[name] = { success: Boolean(success), resultCount: results.length, errors };

    sources.push({
      connector: name,
      success: Boolean(success),
      skipped: Boolean(skipped),
      skipReason: reason || null,
      resultCount: results.length,
      evidenceCount: evidence.length,
      errorCount: errors.length,
      litigationSignals: litigationSignalCount || 0,
    });

    allResults.push(...results);
    allEvidence.push(...evidence);
    allErrors.push(...errors);
  }

  const completedAt = new Date().toISOString();
  const uniqueResults = dedupeResults(allResults);
  const uniqueEvidence = dedupeEvidence(allEvidence);
  const litigationSignalCount = uniqueEvidence.filter((e) => e.flagged || e.type === 'litigation_signal').length;

  return {
    tier,
    inputs,
    startedAt,
    completedAt,
    results: uniqueResults,
    evidence: uniqueEvidence,
    sources,
    errors: allErrors,
    litigationSignalCount,
    connectorHealth: health,
    summary: {
      connectorsRun: filtered.length,
      connectorsSucceeded: sources.filter((s) => s.success).length,
      totalResults: uniqueResults.length,
      totalEvidence: uniqueEvidence.length,
    },
  };
}
