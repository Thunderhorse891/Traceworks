'use strict';

class SourceAdapterError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = 'SourceAdapterError';
    this.details = details;
  }
}

function requireValue(name, value) {
  if (value === undefined || value === null || value === '') {
    throw new SourceAdapterError(`Missing required value: ${name}`, { field: name });
  }
  return value;
}

function nowIso() {
  return new Date().toISOString();
}

function buildEvidenceEntry({
  sourceId,
  sourceName,
  query,
  url,
  status,
  notes,
  rawCount,
  extractedCount,
}) {
  return {
    sourceId,
    sourceName,
    query,
    url,
    status,
    notes: notes || '',
    rawCount: rawCount ?? 0,
    extractedCount: extractedCount ?? 0,
    timestamp: nowIso(),
  };
}

module.exports = {
  SourceAdapterError,
  requireValue,
  nowIso,
  buildEvidenceEntry,
};
