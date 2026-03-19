import { VALID_PACKAGE_IDS } from './packages.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const SUBJECT_TYPES = new Set(['property', 'person', 'entity', 'estate', 'mixed']);
const PROHIBITED_USE_RULES = [
  {
    pattern: /\b(employment screening|employment decision|hiring decision|pre[- ]employment|job applicant|background check)\b/i,
    message: 'TraceWorks cannot be used for employment screening or hiring decisions.'
  },
  {
    pattern: /\b(tenant screening|tenant check|renter screening|lease approval|housing decision|landlord screening)\b/i,
    message: 'TraceWorks cannot be used for tenant screening or housing decisions.'
  },
  {
    pattern: /\b(credit check|credit decision|loan underwriting|loan approval|insurance underwriting|insurance eligibility)\b/i,
    message: 'TraceWorks cannot be used for credit, lending, or insurance underwriting decisions.'
  },
  {
    pattern: /\b(student screening|admission decision|school admission)\b/i,
    message: 'TraceWorks cannot be used for student screening or admissions decisions.'
  },
  {
    pattern: /\b(stalk|harass|intimidat|doxx|spy on|unlawful surveillance|track my ex|find my ex)\b/i,
    message: 'TraceWorks cannot be used for stalking, harassment, unlawful surveillance, or personal targeting.'
  },
  {
    pattern: /\b(identity theft|impersonat|social engineering|fraud)\b/i,
    message: 'TraceWorks cannot be used for identity theft, impersonation, fraud, or social engineering.'
  }
];

function clean(value) {
  return String(value ?? '').trim();
}

function cleanLong(value, max = 1600) {
  return clean(value).slice(0, max);
}

function cleanList(value) {
  if (Array.isArray(value)) return value.map((item) => clean(item)).filter(Boolean);
  return clean(value)
    .split(/[\n,;]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeWebsite(value) {
  const v = clean(value);
  if (!v) return '';
  if (/^https?:\/\//i.test(v)) return v;
  return `https://${v}`;
}

function looksLikeUrl(value) {
  const v = clean(value);
  if (!v) return false;
  return /^https?:\/\//i.test(v) || /^[a-z0-9-]+(\.[a-z0-9-]+)+([/?#].*)?$/i.test(v);
}

function normalizeState(value) {
  return clean(value || 'TX').slice(0, 2).toUpperCase();
}

function normalizeSubjectType(value) {
  const normalized = clean(value).toLowerCase();
  return SUBJECT_TYPES.has(normalized) ? normalized : 'person';
}

function normalizeOptionalEmail(value) {
  return clean(value).toLowerCase();
}

function normalizePhone(value) {
  return clean(value).replace(/\s+/g, ' ');
}

function normalizeDate(value) {
  return clean(value);
}

function normalizeYear(value) {
  return clean(value).replace(/[^\d]/g, '').slice(0, 4);
}

function normalizeAddressAndProfile(raw) {
  const explicitAddress = clean(raw.lastKnownAddress);
  const explicitProfile = normalizeWebsite(raw.websiteProfile || '');
  const legacy = clean(raw.website);

  if (explicitAddress || explicitProfile) {
    return {
      lastKnownAddress: explicitAddress,
      websiteProfile: explicitProfile,
    };
  }

  if (!legacy) {
    return { lastKnownAddress: '', websiteProfile: '' };
  }

  if (looksLikeUrl(legacy)) {
    return { lastKnownAddress: '', websiteProfile: normalizeWebsite(legacy) };
  }

  return { lastKnownAddress: legacy, websiteProfile: '' };
}

function unique(values) {
  return [...new Set(values.filter(Boolean).map((value) => String(value).trim()).filter(Boolean))];
}

function prohibitedPurposeErrors(payload) {
  const purposeText = [payload.goals, payload.requestedFindings].filter(Boolean).join(' ');
  if (!purposeText) return [];

  return unique(
    PROHIBITED_USE_RULES
      .filter((rule) => rule.pattern.test(purposeText))
      .map((rule) => rule.message)
  );
}

export function normalizeCheckoutPayload(raw) {
  const subjectName = clean(raw.companyName || raw.subjectName);
  const { lastKnownAddress, websiteProfile } = normalizeAddressAndProfile(raw);

  return {
    packageId: clean(raw.packageId),
    customerName: clean(raw.customerName),
    customerEmail: normalizeOptionalEmail(raw.customerEmail),
    // Legacy alias kept for compatibility with older handlers/tests.
    companyName: subjectName,
    subjectName,
    subjectType: normalizeSubjectType(raw.subjectType),
    county: clean(raw.county),
    state: normalizeState(raw.state),
    lastKnownAddress,
    websiteProfile,
    // Legacy alias kept because older order records may still read from `website`.
    website: websiteProfile,
    parcelId: clean(raw.parcelId),
    alternateNames: cleanList(raw.alternateNames),
    dateOfBirth: normalizeDate(raw.dateOfBirth),
    deathYear: normalizeYear(raw.deathYear),
    subjectPhone: normalizePhone(raw.subjectPhone),
    subjectEmail: normalizeOptionalEmail(raw.subjectEmail),
    requestedFindings: cleanLong(raw.requestedFindings, 1600),
    goals: cleanLong(raw.goals, 1600),
    legalConsent: raw.legalConsent === true || raw.legalConsent === 'on' || raw.legalConsent === 'true',
    tosConsent: raw.tosConsent === true || raw.tosConsent === 'on' || raw.tosConsent === 'true',
  };
}

function secondaryProbateSignals(payload) {
  return [
    payload.deathYear,
    payload.dateOfBirth,
    payload.lastKnownAddress,
    payload.subjectPhone,
    payload.subjectEmail,
    ...(payload.alternateNames || []),
  ].filter(Boolean);
}

export function validateCheckoutPayload(payload) {
  const errors = [];
  const currentYear = new Date().getFullYear();
  const phoneDigits = payload.subjectPhone.replace(/[^\d]/g, '');

  if (!payload.packageId) errors.push('Package selection is required.');
  else if (!VALID_PACKAGE_IDS.includes(payload.packageId)) errors.push('Invalid package selection.');

  if (!payload.customerName || payload.customerName.length < 2) errors.push('Requestor name is required.');
  if (!payload.customerEmail || !EMAIL_RE.test(payload.customerEmail)) errors.push('A valid requestor email is required.');
  if (!payload.subjectName || payload.subjectName.length < 2) errors.push('Primary subject name is required.');
  if (!payload.county || payload.county.length < 2) errors.push('Target county is required.');

  if (payload.websiteProfile) {
    try {
      new URL(payload.websiteProfile);
    } catch {
      errors.push('Profile or website URL is invalid.');
    }
  }

  if (payload.subjectEmail && !EMAIL_RE.test(payload.subjectEmail)) {
    errors.push('Subject email must be a valid email address.');
  }

  if (payload.subjectPhone && (phoneDigits.length < 7 || phoneDigits.length > 20)) {
    errors.push('Subject phone number looks invalid.');
  }

  if (payload.dateOfBirth) {
    const timestamp = Date.parse(payload.dateOfBirth);
    if (!DATE_RE.test(payload.dateOfBirth) || Number.isNaN(timestamp)) {
      errors.push('Date of birth must use YYYY-MM-DD format.');
    }
  }

  if (payload.deathYear) {
    const year = Number(payload.deathYear);
    if (!Number.isInteger(year) || year < 1800 || year > currentYear) {
      errors.push(`Death year must be between 1800 and ${currentYear}.`);
    }
  }

  if (payload.goals && payload.goals.length > 1400) errors.push('Case objective is too long.');
  if (payload.requestedFindings && payload.requestedFindings.length > 1400) errors.push('Requested findings are too long.');
  errors.push(...prohibitedPurposeErrors(payload));

  if (payload.packageId === 'probate_heirship' && secondaryProbateSignals(payload).length === 0) {
    errors.push('Probate research requires at least one additional identifier such as death year, date of birth, address, alias, phone, or email.');
  }

  if (!payload.legalConsent) errors.push('Legal use acknowledgement is required.');
  if (!payload.tosConsent) errors.push('Terms consent is required.');

  return errors;
}

export function buildInputCriteria(payload) {
  const requestedFindingsList = cleanList(payload.requestedFindings);
  const searchSeeds = unique([
    payload.parcelId,
    payload.lastKnownAddress,
    payload.subjectName,
    payload.subjectPhone,
    payload.subjectEmail,
    payload.websiteProfile,
    ...(payload.alternateNames || []),
  ]);

  return {
    subjectName: payload.subjectName,
    subjectType: payload.subjectType,
    county: payload.county,
    state: payload.state,
    lastKnownAddress: payload.lastKnownAddress,
    websiteProfile: payload.websiteProfile,
    website: payload.websiteProfile,
    parcelId: payload.parcelId,
    alternateNames: payload.alternateNames || [],
    dateOfBirth: payload.dateOfBirth,
    deathYear: payload.deathYear,
    subjectPhone: payload.subjectPhone,
    subjectEmail: payload.subjectEmail,
    requestedFindings: payload.requestedFindings,
    requestedFindingsList,
    goals: payload.goals,
    searchSeeds,
    investigationBrief: [
      payload.subjectName ? `Primary subject: ${payload.subjectName}` : '',
      payload.county ? `County: ${payload.county}, ${payload.state}` : '',
      payload.lastKnownAddress ? `Address seed: ${payload.lastKnownAddress}` : '',
      payload.parcelId ? `Parcel seed: ${payload.parcelId}` : '',
      requestedFindingsList.length ? `Requested findings: ${requestedFindingsList.join('; ')}` : '',
      payload.goals ? `Outcome needed: ${payload.goals}` : '',
    ]
      .filter(Boolean)
      .join(' | '),
  };
}

export function resolveInvestigationInput(order = {}) {
  const source = order.input_criteria || {};
  const normalized = normalizeCheckoutPayload({
    packageId: order.packageId || source.packageId,
    customerName: order.customerName || '',
    customerEmail: order.customerEmail || '',
    subjectName: source.subjectName || order.subjectName || source.companyName || '',
    companyName: source.companyName || source.subjectName || order.subjectName || '',
    subjectType: source.subjectType || order.subjectType || 'person',
    county: source.county || order.county || '',
    state: source.state || order.state || 'TX',
    lastKnownAddress: source.lastKnownAddress || order.lastKnownAddress || '',
    websiteProfile: source.websiteProfile || order.websiteProfile || source.website || order.website || '',
    website: source.website || order.website || '',
    parcelId: source.parcelId || order.parcelId || '',
    alternateNames: source.alternateNames || order.alternateNames || [],
    dateOfBirth: source.dateOfBirth || order.dateOfBirth || '',
    deathYear: source.deathYear || order.deathYear || '',
    subjectPhone: source.subjectPhone || order.subjectPhone || '',
    subjectEmail: source.subjectEmail || order.subjectEmail || '',
    requestedFindings: source.requestedFindings || order.requestedFindings || '',
    goals: source.goals || order.goals || '',
    legalConsent: true,
    tosConsent: true,
  });

  return buildInputCriteria(normalized);
}
