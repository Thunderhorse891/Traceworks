export const TERMINAL_STATUSES = new Set([
  'completed',
  'manual_review',
  'failed',
  'delivery_failed',
  'refunded',
  'canceled'
]);

export const ARTIFACT_READY_STATUSES = new Set([
  'completed',
  'manual_review',
  'delivery_failed'
]);

export const STATUS_LABELS = Object.freeze({
  pending_payment: 'Payment Pending',
  paid: 'Payment Confirmed',
  queued: 'Queued',
  running: 'Research Running',
  completed: 'Completed',
  manual_review: 'Manual Review',
  failed: 'Failed',
  delivery_failed: 'Delivery Failed',
  refunded: 'Refunded',
  canceled: 'Canceled'
});

export const STATUS_VARIANTS = Object.freeze({
  pending_payment: 'queued',
  paid: 'queued',
  queued: 'queued',
  running: 'processing',
  completed: 'completed',
  manual_review: 'retrying',
  failed: 'failed',
  delivery_failed: 'failed',
  refunded: 'failed',
  canceled: 'failed'
});

export function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function statusLabel(status) {
  return STATUS_LABELS[status] || status || 'unknown';
}

export function statusVariant(status) {
  return STATUS_VARIANTS[status] || 'queued';
}

export function statusBadgeHtml(status) {
  return `<span class="status-badge status-${statusVariant(status)}">${escapeHtml(statusLabel(status))}</span>`;
}

export function formatShortDate(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  } catch {
    return iso;
  }
}

export function formatDateTime(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString(undefined, { hour12: true });
  } catch {
    return iso;
  }
}

export function confirmationDeliveryLabel(status) {
  if (status === 'sent') return 'Sent';
  if (status === 'failed') return 'Needs resend';
  return 'Pending';
}

export function briefSignals(input = {}) {
  const aliasCount = Array.isArray(input.alternateNames) ? input.alternateNames.length : 0;
  return [
    ['Address', input.lastKnownAddress],
    ['Parcel', input.parcelId],
    ['Aliases', aliasCount ? `${aliasCount} captured` : ''],
    ['DOB', input.dateOfBirth],
    ['Death year', input.deathYear],
    ['Phone', input.subjectPhone],
    ['Email', input.subjectEmail],
    ['URL', input.websiteProfile],
    ['Search seeds', Array.isArray(input.searchSeeds) && input.searchSeeds.length ? `${input.searchSeeds.length} loaded` : '']
  ].filter(([, value]) => value);
}

export function renderSignalChips(signals, className = 'brief-chip') {
  return signals
    .map(([label, value]) => `<span class="${escapeHtml(className)}">${escapeHtml(label)}: ${escapeHtml(value)}</span>`)
    .join('');
}

export function buildArtifactUrl({ caseRef, format, statusToken = '', email = '' }) {
  const query = new URLSearchParams({ caseRef, format });
  if (statusToken) query.set('status_token', statusToken);
  else if (email) query.set('email', email);
  return `/api/order-artifact?${query.toString()}`;
}
