/**
 * Canonical disclaimer text for each workflow tier.
 *
 * Rules:
 * - Must NOT contain "clear title" — use scanForForbiddenPhrases() to verify.
 * - Must NOT constitute a legal opinion or title commitment.
 * - Must be consistent with the no-refund redo policy in /refund-policy.html.
 */

export const DISCLAIMERS = {
  standard:
    'This report provides public-record intelligence for investigative and legal-support purposes only. ' +
    'It is not legal advice. All findings require independent verification before use in any legal proceeding, ' +
    'collection action, or service attempt. Traceworks does not guarantee the accuracy or completeness of ' +
    'third-party public records.',

  ownership_encumbrance:
    'This report provides ownership and encumbrance intelligence derived from public-record sources only. ' +
    'It does not constitute a title commitment, title insurance, or a legal opinion regarding ownership status or ' +
    'marketability. The presence or absence of instruments in this report does not confirm or deny the existence ' +
    'of unrecorded claims, easements, or other interests. All findings must be independently verified by a ' +
    'licensed title professional or attorney before use in any transaction or legal proceeding.',

  probate_heirship:
    'This report provides investigative intelligence to support heir identification and probate research. ' +
    'It is not a legal determination of heirship, kinship, or entitlement. Heir candidates identified in this ' +
    'report have not been legally adjudicated and require independent verification through probate proceedings ' +
    'or legal counsel before any distribution or contact action.',

  asset_network:
    'This report provides property portfolio and entity intelligence derived from public-record sources. ' +
    'It is not a legal opinion on ownership, valuation, or asset availability. All findings require ' +
    'independent verification before use in any enforcement, collection, or transactional context.',

  comprehensive:
    'This report provides multi-source investigative intelligence for legal and business support purposes only. ' +
    'It is not legal advice, a title opinion, or a definitive statement of ownership, heirship, or asset status. ' +
    'Cross-source discrepancies identified in this report require manual reconciliation by qualified professionals ' +
    'before reliance in any legal proceeding or transaction.',

  // Frontend payment-link tier aliases
  locate:
    'This report provides investigative intelligence for legal locate workflows only. ' +
    'It is not legal advice. All address and contact findings require independent verification before use ' +
    'in any service attempt, collection action, or legal proceeding.',

  title:
    'This report provides title and encumbrance intelligence derived from public-record sources. ' +
    'It does not constitute a title commitment, title insurance, or legal opinion on ownership or marketability. ' +
    'Independent verification by a licensed title professional is required before use in any transaction.',

  heir:
    'This report provides investigative intelligence for heir and probate research support. ' +
    'It is not a legal determination of heirship or entitlement. All candidates require independent ' +
    'verification through qualified legal counsel or probate proceedings.',
};

/**
 * Scan disclaimer text for phrases that would create legal risk.
 * Returns an array of matched forbidden phrases (empty = clean).
 */
// These phrases must not appear in disclaimers as positive assertions.
// Negation contexts (e.g. "does not constitute") are acceptable — this list
// catches cases where the phrase appears without a preceding negation marker.
const FORBIDDEN_PHRASES = [
  'clear title',
  'clean title',
  'free and clear',
  'we guarantee',
  'guaranteed results',
  'is legal advice',
  'constitutes legal advice',
];

export function scanForForbiddenPhrases(text) {
  const lower = String(text).toLowerCase();
  return FORBIDDEN_PHRASES.filter((phrase) => lower.includes(phrase));
}
