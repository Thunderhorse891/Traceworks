export class SourceAdapterError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = 'SourceAdapterError';
    this.details = details;
  }
}

export function requireValue(name, value) {
  if (value === undefined || value === null || value === '') {
    throw new SourceAdapterError(`Missing required value: ${name}`, { field: name });
  }
  return value;
}

export function nowIso() {
  return new Date().toISOString();
}

export function buildEvidenceEntry({ sourceId, sourceName, query, url, status, notes, rawCount, extractedCount }) {
  return {
    sourceId,
    sourceName,
    query,
    url,
    status,
    notes: notes || '',
    rawCount: rawCount ?? 0,
    extractedCount: extractedCount ?? 0,
    timestamp: nowIso()
  };
}
