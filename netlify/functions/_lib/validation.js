import { VALID_PACKAGE_IDS } from './packages.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
    // Accept subjectName (main form) or companyName (legacy field) for the subject
    companyName: clean(raw.companyName || raw.subjectName),
    county: clean(raw.county),
    state: clean(raw.state || 'TX').slice(0, 2).toUpperCase(),
    website: normalizeWebsite(raw.website),
    goals: clean(raw.goals),
    legalConsent: raw.legalConsent === true || raw.legalConsent === 'on' || raw.legalConsent === 'true',
    tosConsent: raw.tosConsent === true || raw.tosConsent === 'on' || raw.tosConsent === 'true'
  };
}

export function validateCheckoutPayload(payload) {
  const errors = [];
  if (!payload.packageId) errors.push('Package selection is required.');
  else if (!VALID_PACKAGE_IDS.includes(payload.packageId)) errors.push('Invalid package selection.');
  if (!payload.customerName || payload.customerName.length < 2) errors.push('Requestor name is required.');
  if (!payload.customerEmail || !EMAIL_RE.test(payload.customerEmail)) errors.push('A valid requestor email is required.');
  if (!payload.companyName || payload.companyName.length < 2) errors.push('Subject name or entity is required.');
  if (!payload.county || payload.county.length < 2) errors.push('Target county is required.');
  if (payload.goals && payload.goals.length > 1200) errors.push('Case objective is too long.');
  if (payload.website) {
    try { new URL(payload.website); } catch { errors.push('Website/profile URL is invalid.'); }
  }
  if (!payload.legalConsent) errors.push('Legal use acknowledgement is required.');
  if (!payload.tosConsent) errors.push('Terms consent is required.');
  return errors;
}
