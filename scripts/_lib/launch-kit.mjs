import crypto from 'node:crypto';

export const LAUNCH_SECRET_KEYS = Object.freeze([
  'ADMIN_API_KEY',
  'STATUS_TOKEN_SECRET',
  'QUEUE_CRON_SECRET'
]);

export const CORE_ENV_VARS = Object.freeze([
  'URL',
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'SMTP_HOST',
  'SMTP_PORT',
  'SMTP_USER',
  'SMTP_PASS',
  'EMAIL_FROM',
  'OWNER_EMAIL',
  'TRACEWORKS_STORAGE_DRIVER',
  'UPSTASH_REDIS_REST_URL',
  'UPSTASH_REDIS_REST_TOKEN'
]);

export const SOURCE_ENDPOINT_CONTRACTS = Object.freeze([
  {
    env: 'APPRAISAL_API_URL',
    label: 'County appraisal district source',
    params: ['county', 'state', 'q'],
    exampleShape: ['ownerName', 'parcelId', 'legalDescription', 'assessedValue']
  },
  {
    env: 'TAX_COLLECTOR_API_URL',
    label: 'County tax collector source',
    params: ['county', 'state', 'parcelId'],
    exampleShape: ['parcelId', 'taxYear', 'amountDue', 'status']
  },
  {
    env: 'PARCEL_GIS_API_URL',
    label: 'County parcel GIS source',
    params: ['county', 'state', 'q'],
    exampleShape: ['parcelId', 'address', 'latitude', 'longitude']
  },
  {
    env: 'COUNTY_CLERK_API_URL',
    label: 'County clerk deed index source',
    params: ['county', 'state', 'q', 'queryType'],
    exampleShape: ['instruments[]']
  },
  {
    env: 'GRANTOR_GRANTEE_API_URL',
    label: 'Grantor-grantee source',
    params: ['county', 'state', 'ownerName', 'parcelId'],
    exampleShape: ['instruments[]']
  },
  {
    env: 'MORTGAGE_INDEX_API_URL',
    label: 'Mortgage / trust deed source',
    params: ['county', 'state', 'parcelId'],
    exampleShape: ['instrumentNumber', 'recordingDate', 'lender', 'borrower']
  },
  {
    env: 'OBITUARY_API_URL',
    label: 'Obituary source',
    params: ['name', 'county', 'state', 'deathYear'],
    exampleShape: ['decedentName', 'publishedAt', 'city', 'sourceUrl']
  },
  {
    env: 'PROBATE_API_URL',
    label: 'Probate index source',
    params: ['county', 'state', 'name', 'deathYear'],
    exampleShape: ['caseNumber', 'filingDate', 'status', 'court']
  },
  {
    env: 'PEOPLE_ASSOC_API_URL',
    label: 'Licensed people-association source',
    params: ['name', 'address', 'related'],
    exampleShape: ['candidates[]']
  }
]);

function wrapValue(value) {
  return String(value).includes(' ') ? JSON.stringify(String(value)) : String(value);
}

export function generateOpaqueSecret(bytes = 32) {
  return crypto.randomBytes(bytes).toString('base64url');
}

export function generateLaunchSecrets() {
  return {
    ADMIN_API_KEY: generateOpaqueSecret(24),
    STATUS_TOKEN_SECRET: generateOpaqueSecret(32),
    QUEUE_CRON_SECRET: generateOpaqueSecret(24)
  };
}

export function buildNetlifyEnvTemplate({
  siteUrl = 'https://traceworks.example.com',
  ownerEmail = 'traceworks.tx@outlook.com',
  emailFrom = ownerEmail,
  storageDriver = 'kv',
  secrets = generateLaunchSecrets()
} = {}) {
  const lines = [
    '# Core runtime',
    `URL=${wrapValue(siteUrl)}`,
    'STRIPE_SECRET_KEY=<rotate-and-paste-live-secret>',
    'STRIPE_WEBHOOK_SECRET=<rotate-and-paste-live-webhook-secret>',
    '',
    '# Email delivery',
    'SMTP_HOST=smtp-mail.outlook.com',
    'SMTP_PORT=587',
    `SMTP_USER=${wrapValue(ownerEmail)}`,
    'SMTP_PASS=<rotate-and-paste-smtp-password>',
    `EMAIL_FROM=${wrapValue(emailFrom)}`,
    `OWNER_EMAIL=${wrapValue(ownerEmail)}`,
    '',
    '# Durable storage',
    `TRACEWORKS_STORAGE_DRIVER=${storageDriver}`,
    'UPSTASH_REDIS_REST_URL=<upstash-rest-url>',
    'UPSTASH_REDIS_REST_TOKEN=<upstash-rest-token>',
    '',
    '# Runtime secrets',
    `ADMIN_API_KEY=${wrapValue(secrets.ADMIN_API_KEY)}`,
    `STATUS_TOKEN_SECRET=${wrapValue(secrets.STATUS_TOKEN_SECRET)}`,
    `QUEUE_CRON_SECRET=${wrapValue(secrets.QUEUE_CRON_SECRET)}`,
    '',
    '# Source coverage',
    'APPRAISAL_API_URL=<property-source-endpoint>',
    'TAX_COLLECTOR_API_URL=<tax-source-endpoint>',
    'PARCEL_GIS_API_URL=<gis-source-endpoint>',
    'COUNTY_CLERK_API_URL=<deed-index-endpoint>',
    'GRANTOR_GRANTEE_API_URL=<grantor-grantee-endpoint>',
    'MORTGAGE_INDEX_API_URL=<mortgage-index-endpoint>',
    'OBITUARY_API_URL=<obituary-endpoint>',
    'PROBATE_API_URL=<probate-endpoint>',
    'PEOPLE_ASSOC_LICENSED=true',
    'PEOPLE_ASSOC_API_URL=<licensed-people-association-endpoint>'
  ];

  return lines.join('\n');
}

export function formatSourceEndpointContracts() {
  return SOURCE_ENDPOINT_CONTRACTS.map((contract) => {
    const params = contract.params.join(', ');
    const shape = contract.exampleShape.join(', ');
    return `${contract.env}: ${contract.label}. Query params: ${params}. Expected payload keys: ${shape}.`;
  });
}
