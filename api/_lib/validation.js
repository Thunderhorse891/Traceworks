import { PACKAGES } from './packages.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const VALID_PACKAGE_IDS = new Set(Object.keys(PACKAGES));

const TX_COUNTIES = new Set([
  'harris', 'dallas', 'tarrant', 'bexar', 'travis', 'collin', 'hidalgo', 'el paso',
  'denton', 'fort bend', 'montgomery', 'williamson', 'cameron', 'nueces', 'bell',
  'galveston', 'lubbock', 'jefferson', 'smith', 'webb', 'brazoria', 'hays',
  'ector', 'midland', 'mclennan', 'tom green', 'grayson', 'comal', 'johnson',
  'ellis', 'kaufman', 'brazos', 'rockwall', 'parker', 'bastrop', 'guadalupe',
  'hunt', 'henderson', 'potter', 'randall', 'wichita', 'walker', 'orange',
  'angelina', 'nacogdoches', 'henderson', 'cherokee', 'harrison', 'panola'
]);

function clean(value) {
  return String(value ?? '').trim();
}

function normalizeWebsite(value) {
  const v = clean(value);
  if (!v) return '';
  if (/^https?:\/\//i.test(v)) return v;
  return `https://${v}`;
}

export function normalizeCheckoutPayload(raw) {
  return {
    packageId: clean(raw.packageId),
    customerName: clean(raw.customerName),
    customerEmail: clean(raw.customerEmail).toLowerCase(),
    subjectName: clean(raw.subjectName || raw.companyName),
    county: clean(raw.county).toLowerCase(),
    state: clean(raw.state || 'TX').toUpperCase(),
    website: normalizeWebsite(raw.website),
    goals: clean(raw.goals),
    legalConsent: raw.legalConsent === true || raw.legalConsent === 'on' || raw.legalConsent === 'true',
    tosConsent: raw.tosConsent === true || raw.tosConsent === 'on' || raw.tosConsent === 'true'
  };
}

export function validateCheckoutPayload(payload) {
  const errors = [];

  if (!payload.packageId) {
    errors.push('Package selection is required.');
  } else if (!VALID_PACKAGE_IDS.has(payload.packageId)) {
    errors.push(`Invalid package: ${payload.packageId}.`);
  }

  if (!payload.customerName || payload.customerName.length < 2) {
    errors.push('Requestor name is required.');
  }

  if (!payload.customerEmail || !EMAIL_RE.test(payload.customerEmail)) {
    errors.push('A valid requestor email is required.');
  }

  if (!payload.subjectName || payload.subjectName.length < 2) {
    errors.push('Subject name or entity is required.');
  }

  if (!payload.county) {
    errors.push('County is required.');
  }

  if (!payload.state) {
    errors.push('State is required.');
  }

  if (payload.goals && payload.goals.length > 1200) {
    errors.push('Case objective is too long.');
  }

  if (payload.website) {
    try { new URL(payload.website); } catch { errors.push('Website/profile URL is invalid.'); }
  }

  if (!payload.legalConsent) errors.push('Legal use acknowledgement is required.');
  if (!payload.tosConsent) errors.push('Terms of Service consent is required.');

  return errors;
}
