const DEFAULT_SOURCE_CONFIG = {
  countyProperty: [],
  countyRecorder: [],
  probateIndex: [],
  entitySearch: []
};

export function loadSourceConfig(env = process.env) {
  const raw = String(env.PUBLIC_RECORD_SOURCE_CONFIG || '').trim();
  if (!raw) return DEFAULT_SOURCE_CONFIG;
  try {
    const parsed = JSON.parse(raw);
    return {
      countyProperty: Array.isArray(parsed.countyProperty) ? parsed.countyProperty : [],
      countyRecorder: Array.isArray(parsed.countyRecorder) ? parsed.countyRecorder : [],
      probateIndex: Array.isArray(parsed.probateIndex) ? parsed.probateIndex : [],
      entitySearch: Array.isArray(parsed.entitySearch) ? parsed.entitySearch : []
    };
  } catch {
    throw new Error('PUBLIC_RECORD_SOURCE_CONFIG must be valid JSON.');
  }
}
