/**
 * Canonical schema factories and validators for workflow results.
 *
 * Any code that constructs or consumes workflow result objects MUST use
 * makeWorkflowResults() so the shape stays consistent across the fulfillment
 * pipeline, report builders, and artifact persistence.
 */

/**
 * Construct a validated workflow result object.
 * All fields are passed through; required fields are enforced.
 */
export function makeWorkflowResults({
  orderId,
  tier,
  inputs,
  sources,
  startedAt,
  completedAt,
  overallStatus,
  partialReasons,
  failureReasons,
  ...extra
}) {
  if (!orderId) throw new Error('makeWorkflowResults: orderId is required');
  if (!tier) throw new Error('makeWorkflowResults: tier is required');
  if (!startedAt) throw new Error('makeWorkflowResults: startedAt is required');

  return {
    orderId,
    tier,
    inputs: inputs || {},
    sources: Array.isArray(sources) ? sources : [],
    startedAt,
    completedAt: completedAt || new Date().toISOString(),
    overallStatus: overallStatus || 'complete',
    partialReasons: Array.isArray(partialReasons) ? partialReasons : [],
    failureReasons: Array.isArray(failureReasons) ? failureReasons : [],
    ...extra,
  };
}

/**
 * Required fields for a valid workflow result object.
 * Use this in tests or pre-flight checks.
 */
export const WORKFLOW_RESULT_REQUIRED_FIELDS = [
  'orderId',
  'tier',
  'inputs',
  'sources',
  'startedAt',
  'overallStatus',
];

/**
 * Validate a workflow result shape.
 * Returns an array of missing field names (empty = valid).
 */
export function validateWorkflowResult(result) {
  if (!result || typeof result !== 'object') return WORKFLOW_RESULT_REQUIRED_FIELDS;
  return WORKFLOW_RESULT_REQUIRED_FIELDS.filter((f) => !(f in result));
}
