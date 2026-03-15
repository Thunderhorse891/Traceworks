import { BUSINESS_EMAIL, getBusinessEmail } from './business.js';
import { resolveEmailSettings } from './email-config.js';
import { resolvePremiumOsintConfig } from './osint-config.js';
import { PACKAGE_LIST, getPackage } from './packages.js';
import { assessPackageJurisdictionCoverage, findStrictSourceConfigGaps, loadSourceConfig, summarizeSourceConfig, usingBundledSourceConfig } from './sources/source-config.js';
import { resolveKvRestConfig, storageDriverName } from './storage-runtime.js';
import { validateStripeSecretKey, validateStripeWebhookSecret } from './stripe-config.js';

const PUBLIC_GATE_MESSAGE = 'TraceWorks is temporarily not accepting paid orders while launch requirements are being completed. No charge was created.';
const PACKAGE_SOURCE_PENDING_MESSAGE = 'This package is not live yet because the required source coverage is not fully connected.';
const JURISDICTION_SOURCE_PENDING_MESSAGE = 'This package is live, but automated source coverage is not configured for the requested jurisdiction yet. No charge was created.';

const CUSTOMER_CORE_BLOCKING_IDS = new Set([
  'base_url',
  'stripe_secret',
  'stripe_webhook',
  'storage_driver',
  'kv_rest',
  'smtp',
  'status_token_secret',
  'queue_cron_secret',
  'source_config'
]);

const PACKAGE_SOURCE_REQUIREMENTS = Object.freeze({
  standard: [
    { id: 'APPRAISAL_API_URL', label: 'County appraisal district source' },
    { id: 'TAX_COLLECTOR_API_URL', label: 'County tax collector source' },
    { id: 'PARCEL_GIS_API_URL', label: 'County parcel GIS source' }
  ],
  ownership_encumbrance: [
    { id: 'APPRAISAL_API_URL', label: 'County appraisal district source' },
    { id: 'COUNTY_CLERK_API_URL', label: 'County clerk deed index source' },
    { id: 'GRANTOR_GRANTEE_API_URL', label: 'Grantor-grantee source' },
    { id: 'MORTGAGE_INDEX_API_URL', label: 'Mortgage / trust deed source' }
  ],
  probate_heirship: [
    { id: 'OBITUARY_API_URL', label: 'Obituary source' },
    { id: 'PROBATE_API_URL', label: 'Probate index source' },
    { id: 'PEOPLE_ASSOC_LICENSED', label: 'Licensed people-association flag', type: 'booleanTrue' },
    { id: 'PEOPLE_ASSOC_API_URL', label: 'Licensed people-association source' }
  ],
  asset_network: [
    { id: 'APPRAISAL_API_URL', label: 'County appraisal district source' },
    { id: 'TAX_COLLECTOR_API_URL', label: 'County tax collector source' },
    { id: 'PARCEL_GIS_API_URL', label: 'County parcel GIS source' },
    { id: 'COUNTY_CLERK_API_URL', label: 'County clerk deed index source' },
    { id: 'GRANTOR_GRANTEE_API_URL', label: 'Grantor-grantee source' }
  ],
  comprehensive: [
    { id: 'APPRAISAL_API_URL', label: 'County appraisal district source' },
    { id: 'TAX_COLLECTOR_API_URL', label: 'County tax collector source' },
    { id: 'PARCEL_GIS_API_URL', label: 'County parcel GIS source' },
    { id: 'COUNTY_CLERK_API_URL', label: 'County clerk deed index source' },
    { id: 'GRANTOR_GRANTEE_API_URL', label: 'Grantor-grantee source' },
    { id: 'MORTGAGE_INDEX_API_URL', label: 'Mortgage / trust deed source' },
    { id: 'OBITUARY_API_URL', label: 'Obituary source' },
    { id: 'PROBATE_API_URL', label: 'Probate index source' },
    { id: 'PEOPLE_ASSOC_LICENSED', label: 'Licensed people-association flag', type: 'booleanTrue' },
    { id: 'PEOPLE_ASSOC_API_URL', label: 'Licensed people-association source' }
  ]
});

function trim(value) {
  return String(value || '').trim();
}

function isStrictFulfillment(env = process.env) {
  return trim(env.PAID_FULFILLMENT_STRICT || 'true').toLowerCase() !== 'false';
}

function configuredBaseUrl(env = process.env) {
  return trim(env.URL || env.SITE_URL || '');
}

function addCheck(checks, check) {
  checks.push(check);
}

function makeCheck({ id, label, severity = 'warning', status, detail, action = '' }) {
  return { id, label, severity, status, detail, action };
}

function envRequirementMissing(requirement, env = process.env) {
  const value = trim(env[requirement.id]);
  if (requirement.type === 'booleanTrue') return value.toLowerCase() !== 'true';
  return !value;
}

function packageRequirementFailures(packageId, env = process.env) {
  const requirements = PACKAGE_SOURCE_REQUIREMENTS[packageId] || [];
  return requirements.filter((requirement) => envRequirementMissing(requirement, env));
}

function baseUrlCheck(env, checks) {
  const value = configuredBaseUrl(env);
  if (!value) {
    addCheck(checks, makeCheck({
      id: 'base_url',
      label: 'Public base URL',
      severity: 'blocking',
      status: 'fail',
      detail: 'URL is not configured. Stripe redirects and emailed status links will fall back to the request host.',
      action: 'Set URL in Netlify site environment variables to your canonical production origin.'
    }));
    return;
  }

  try {
    const parsed = new URL(value);
    if (parsed.protocol !== 'https:') {
      addCheck(checks, makeCheck({
        id: 'base_url',
        label: 'Public base URL',
        severity: 'blocking',
        status: 'fail',
        detail: `Configured URL uses ${parsed.protocol}. Production checkout and emailed case links should be HTTPS.`,
        action: 'Update URL to the HTTPS production origin.'
      }));
      return;
    }

    if (parsed.hostname.includes('localhost')) {
      addCheck(checks, makeCheck({
        id: 'base_url',
        label: 'Public base URL',
        severity: 'blocking',
        status: 'fail',
        detail: 'Configured URL points to localhost.',
        action: 'Set URL to the public production origin before launch.'
      }));
      return;
    }

    if (parsed.hostname.endsWith('.netlify.app')) {
      addCheck(checks, makeCheck({
        id: 'base_url',
        label: 'Public base URL',
        severity: 'warning',
        status: 'warn',
        detail: `Production is configured on the Netlify domain ${parsed.hostname}.`,
        action: 'This can launch today, but point your final branded domain here when DNS is ready.'
      }));
      return;
    }

    addCheck(checks, makeCheck({
      id: 'base_url',
      label: 'Public base URL',
      severity: 'warning',
      status: 'pass',
      detail: `Production URL is set to ${parsed.origin}.`
    }));
  } catch {
    addCheck(checks, makeCheck({
      id: 'base_url',
      label: 'Public base URL',
      severity: 'blocking',
      status: 'fail',
      detail: 'Configured URL is not a valid absolute URL.',
      action: 'Set URL to a valid HTTPS origin such as https://app.example.com.'
    }));
  }
}

function stripeChecks(env, checks) {
  const keyCheck = validateStripeSecretKey(env.STRIPE_SECRET_KEY);
  if (!keyCheck.ok) {
    addCheck(checks, makeCheck({
      id: 'stripe_secret',
      label: 'Stripe secret key',
      severity: 'blocking',
      status: 'fail',
      detail: keyCheck.message,
      action: 'Set STRIPE_SECRET_KEY to a valid Stripe secret key.'
    }));
  } else if (keyCheck.key.startsWith('sk_test_')) {
    addCheck(checks, makeCheck({
      id: 'stripe_secret',
      label: 'Stripe secret key',
      severity: 'warning',
      status: 'warn',
      detail: 'Stripe is configured with a test secret key.',
      action: 'Switch to sk_live_ when you are ready to charge real customers.'
    }));
  } else {
    addCheck(checks, makeCheck({
      id: 'stripe_secret',
      label: 'Stripe secret key',
      severity: 'warning',
      status: 'pass',
      detail: 'Stripe secret key format looks production-ready.'
    }));
  }

  const webhookCheck = validateStripeWebhookSecret(env.STRIPE_WEBHOOK_SECRET);
  addCheck(checks, webhookCheck.ok
    ? makeCheck({
        id: 'stripe_webhook',
        label: 'Stripe webhook secret',
        severity: 'warning',
        status: 'pass',
        detail: 'Stripe webhook secret format looks valid.'
      })
    : makeCheck({
        id: 'stripe_webhook',
        label: 'Stripe webhook secret',
        severity: 'blocking',
        status: 'fail',
        detail: webhookCheck.message,
        action: 'Set STRIPE_WEBHOOK_SECRET to the live webhook signing secret from Stripe.'
      }));
}

function storageChecks(env, checks) {
  const driver = storageDriverName(env);
  if (driver !== 'kv') {
    addCheck(checks, makeCheck({
      id: 'storage_driver',
      label: 'Durable storage driver',
      severity: 'blocking',
      status: 'fail',
      detail: `TraceWorks is running with ${driver} storage. Netlify file storage is not durable across function instances.`,
      action: 'Set TRACEWORKS_STORAGE_DRIVER=kv and connect Upstash REST KV before launch.'
    }));
    return;
  }

  const kvConfig = resolveKvRestConfig(env);
  if (!kvConfig.configured) {
    addCheck(checks, makeCheck({
      id: 'kv_rest',
      label: 'REST KV connection',
      severity: 'blocking',
      status: 'fail',
      detail: 'TRACEWORKS_STORAGE_DRIVER=kv is selected but the REST KV credentials are incomplete.',
      action: 'Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN.'
    }));
    return;
  }

  addCheck(checks, makeCheck({
    id: 'storage_driver',
    label: 'Durable storage driver',
    severity: 'warning',
    status: 'pass',
    detail: 'REST KV storage is configured for orders, queue state, and artifacts.'
  }));
}

function emailChecks(env, checks) {
  const { host, user, pass, from } = resolveEmailSettings(env);
  const ownerEmail = getBusinessEmail();

  if (!host || !user || !pass) {
    addCheck(checks, makeCheck({
      id: 'smtp',
      label: 'SMTP delivery',
      severity: 'blocking',
      status: 'fail',
      detail: 'SMTP credentials are incomplete. Customer confirmations and report delivery emails cannot send.',
      action: 'Set SMTP_HOST, SMTP_USER, SMTP_PASS, and SMTP_PORT.'
    }));
  } else {
    addCheck(checks, makeCheck({
      id: 'smtp',
      label: 'SMTP delivery',
      severity: 'warning',
      status: 'pass',
      detail: `SMTP is configured for ${host}.`
    }));
  }

  if (!from) {
    addCheck(checks, makeCheck({
      id: 'email_from',
      label: 'Email From identity',
      severity: 'warning',
      status: 'warn',
      detail: `EMAIL_FROM is not set. Emails will send from the owner mailbox ${ownerEmail}.`,
      action: 'Set EMAIL_FROM to the branded sender identity after SPF/DKIM is ready.'
    }));
  } else {
    addCheck(checks, makeCheck({
      id: 'email_from',
      label: 'Email From identity',
      severity: 'warning',
      status: 'pass',
      detail: `Emails will send from ${from}.`
    }));
  }

  if (ownerEmail === BUSINESS_EMAIL && !trim(env.OWNER_EMAIL)) {
    addCheck(checks, makeCheck({
      id: 'owner_email',
      label: 'Owner notification inbox',
      severity: 'warning',
      status: 'warn',
      detail: `OWNER_EMAIL is not explicitly set, so the fallback inbox ${BUSINESS_EMAIL} will receive owner copies and ops alerts.`,
      action: 'Set OWNER_EMAIL explicitly if this business mailbox is changing.'
    }));
  } else {
    addCheck(checks, makeCheck({
      id: 'owner_email',
      label: 'Owner notification inbox',
      severity: 'warning',
      status: 'pass',
      detail: `Owner notifications route to ${ownerEmail}.`
    }));
  }
}

function secretChecks(env, checks) {
  const requiredSecrets = [
    ['admin_api_key', 'ADMIN_API_KEY', 'Admin API authentication'],
    ['status_token_secret', 'STATUS_TOKEN_SECRET', 'Signed customer status links'],
    ['queue_cron_secret', 'QUEUE_CRON_SECRET', 'Scheduled queue worker authentication']
  ];

  for (const [id, key, label] of requiredSecrets) {
    const configured = Boolean(trim(env[key]));
    addCheck(checks, configured
      ? makeCheck({
          id,
          label,
          severity: 'warning',
          status: 'pass',
          detail: `${key} is configured.`
        })
      : makeCheck({
          id,
          label,
          severity: 'blocking',
          status: 'fail',
          detail: `${key} is missing.`,
          action: `Set ${key} before launch.`
        }));
  }
}

function premiumOsintChecks(env, checks) {
  const config = resolvePremiumOsintConfig(env);
  const configuredCount = config.configuredProviders.length;

  if (config.apify.templateError) {
    addCheck(checks, makeCheck({
      id: 'premium_osint_template',
      label: 'Premium OSINT actor template',
      severity: 'warning',
      status: 'warn',
      detail: config.apify.templateError,
      action: 'Fix APIFY_OSINT_INPUT_TEMPLATE or remove it to use the default documented actor input.'
    }));
  }

  if (configuredCount === 0) {
    addCheck(checks, makeCheck({
      id: 'premium_osint',
      label: 'Premium OSINT providers',
      severity: 'warning',
      status: 'warn',
      detail: 'Neither Firecrawl nor Apify OSINT enrichment is configured. Paid reports can still run, but premium web-intelligence enrichment is disabled.',
      action: 'Set FIRECRAWL_API_KEY and/or APIFY_API_TOKEN to enable premium OSINT providers.'
    }));
    return;
  }

  addCheck(checks, makeCheck({
    id: 'premium_osint',
    label: 'Premium OSINT providers',
    severity: 'warning',
    status: 'pass',
    detail: `Premium OSINT enrichment is configured via ${config.configuredProviders.join(' and ')}.`
  }));
}

function sourceChecks(env, checks) {
  const strict = isStrictFulfillment(env);
  try {
    const sourceConfig = loadSourceConfig(env);
    const summary = summarizeSourceConfig(sourceConfig);
    const gaps = strict ? findStrictSourceConfigGaps(sourceConfig) : [];

    if (strict && gaps.length) {
      addCheck(checks, makeCheck({
        id: 'source_config',
        label: 'Strict source coverage',
        severity: 'blocking',
        status: 'fail',
        detail: `Strict fulfillment is enabled, but these source families are unconfigured: ${gaps.join(', ')}.`,
        action: 'Populate PUBLIC_RECORD_SOURCE_CONFIG so every required source family exists before taking paid orders.'
      }));
    } else {
      addCheck(checks, makeCheck({
        id: 'source_config',
        label: 'Strict source coverage',
        severity: 'warning',
        status: 'pass',
        detail: `Source catalog includes ${summary.totalSources} configured sources across ${Object.keys(summary.families).length} families.`
      }));
    }

    if (usingBundledSourceConfig(env)) {
      addCheck(checks, makeCheck({
        id: 'bundled_source_catalog',
        label: 'Bundled source catalog',
        severity: 'warning',
        status: 'warn',
        detail: 'TraceWorks is using the built-in Texas-first source catalog. Coverage is jurisdiction-limited until you provide a production PUBLIC_RECORD_SOURCE_CONFIG.',
        action: 'Provide an explicit PUBLIC_RECORD_SOURCE_CONFIG when you need broader or non-Texas county coverage.'
      }));
    } else {
      addCheck(checks, makeCheck({
        id: 'bundled_source_catalog',
        label: 'Bundled source catalog',
        severity: 'warning',
        status: 'pass',
        detail: 'A custom PUBLIC_RECORD_SOURCE_CONFIG is configured for this environment.'
      }));
    }

    if (summary.browserBackedSources > 0) {
      addCheck(checks, makeCheck({
        id: 'browser_sources',
        label: 'Browser-backed source dependencies',
        severity: 'warning',
        status: 'warn',
        detail: `${summary.browserBackedSources} configured sources are browser-backed and will fall into manual review in the current runtime.`,
        action: 'Keep these sources honest in customer messaging or replace them with API/HTML/JSON connectors.'
      }));
    } else {
      addCheck(checks, makeCheck({
        id: 'browser_sources',
        label: 'Browser-backed source dependencies',
        severity: 'warning',
        status: 'pass',
        detail: 'No browser-only connectors are configured in the current source catalog.'
      }));
    }

    if (!strict) {
      addCheck(checks, makeCheck({
        id: 'strict_mode',
        label: 'Strict fulfillment mode',
        severity: 'warning',
        status: 'warn',
        detail: 'PAID_FULFILLMENT_STRICT is disabled, so some missing sources will not block paid workflow execution.',
        action: 'Enable strict fulfillment for a more conservative production posture.'
      }));
    } else {
      addCheck(checks, makeCheck({
        id: 'strict_mode',
        label: 'Strict fulfillment mode',
        severity: 'warning',
        status: 'pass',
        detail: 'Strict fulfillment is enabled.'
      }));
    }
  } catch (error) {
    addCheck(checks, makeCheck({
      id: 'source_config',
      label: 'Strict source coverage',
      severity: 'blocking',
      status: 'fail',
      detail: String(error?.message || error),
      action: 'Fix PUBLIC_RECORD_SOURCE_CONFIG so it parses cleanly before launch.'
    }));
  }
}

function sourceModuleChecks(env, checks) {
  const requirements = [
    {
      id: 'property_source_modules',
      label: 'Property source modules',
      keys: ['APPRAISAL_API_URL', 'TAX_COLLECTOR_API_URL', 'PARCEL_GIS_API_URL'],
      description: 'Standard property and asset-network workflows rely on appraisal, tax, and parcel modules.'
    },
    {
      id: 'title_source_modules',
      label: 'Title source modules',
      keys: ['COUNTY_CLERK_API_URL', 'GRANTOR_GRANTEE_API_URL', 'MORTGAGE_INDEX_API_URL'],
      description: 'Ownership and encumbrance workflows rely on deed, grantor-grantee, and mortgage modules.'
    },
    {
      id: 'probate_source_modules',
      label: 'Probate source modules',
      keys: ['OBITUARY_API_URL', 'PROBATE_API_URL'],
      description: 'Probate and heirship workflows rely on obituary and probate modules.'
    }
  ];

  for (const requirement of requirements) {
    const missing = requirement.keys.filter((key) => !trim(env[key]));
    if (missing.length) {
      addCheck(checks, makeCheck({
        id: requirement.id,
        label: requirement.label,
        severity: 'blocking',
        status: 'fail',
        detail: `${requirement.description} Missing: ${missing.join(', ')}.`,
        action: `Set ${missing.join(', ')} before taking paid orders for these workflows.`
      }));
      continue;
    }

    addCheck(checks, makeCheck({
      id: requirement.id,
      label: requirement.label,
      severity: 'warning',
      status: 'pass',
      detail: `${requirement.description} Required source module endpoints are configured.`
    }));
  }

  const peopleAssocLicensed = trim(env.PEOPLE_ASSOC_LICENSED).toLowerCase() === 'true';
  const peopleAssocUrl = trim(env.PEOPLE_ASSOC_API_URL);
  if (!peopleAssocLicensed || !peopleAssocUrl) {
    const missing = [];
    if (!peopleAssocLicensed) missing.push('PEOPLE_ASSOC_LICENSED=true');
    if (!peopleAssocUrl) missing.push('PEOPLE_ASSOC_API_URL');
    addCheck(checks, makeCheck({
      id: 'people_association_source',
      label: 'Licensed people-association source',
      severity: 'blocking',
      status: 'fail',
      detail: `Probate and comprehensive workflows include a licensed people-association lookup. Missing: ${missing.join(', ')}.`,
      action: 'Set PEOPLE_ASSOC_LICENSED=true and PEOPLE_ASSOC_API_URL only when the licensed connector is actually available.'
    }));
  } else {
    addCheck(checks, makeCheck({
      id: 'people_association_source',
      label: 'Licensed people-association source',
      severity: 'warning',
      status: 'pass',
      detail: 'Licensed people-association lookup is configured.'
    }));
  }
}

function collectLaunchChecks(env = process.env) {
  const checks = [];
  baseUrlCheck(env, checks);
  stripeChecks(env, checks);
  storageChecks(env, checks);
  emailChecks(env, checks);
  secretChecks(env, checks);
  premiumOsintChecks(env, checks);
  sourceModuleChecks(env, checks);
  sourceChecks(env, checks);
  return checks;
}

export function auditLaunchReadiness(env = process.env) {
  const checks = collectLaunchChecks(env);
  const blockingCount = checks.filter((check) => check.severity === 'blocking' && check.status === 'fail').length;
  const warningCount = checks.filter((check) => check.status === 'warn').length;
  const ok = blockingCount === 0;

  const manualActions = [
    'Run one live end-to-end checkout on the deployed domain: intake -> Stripe -> webhook -> queue -> report delivery.',
    'Verify customer and owner emails land in inboxes, not spam, from the real deployed environment.',
    'Validate the highest-value county/source connectors with real identifiers and confirm the returned evidence matches the report narrative.',
    'Review Netlify function logs and queue metrics after the first paid order to confirm retries, dead-letter handling, and artifact delivery behave as expected.'
  ];

  return {
    ok,
    blockingCount,
    warningCount,
    checks,
    packageReadiness: listPackageLaunchStatus(env, checks),
    manualActions
  };
}

const PUBLIC_REASON_BY_CHECK = Object.freeze({
  base_url: 'operations',
  stripe_secret: 'payments',
  stripe_webhook: 'payments',
  storage_driver: 'storage',
  kv_rest: 'storage',
  smtp: 'delivery',
  admin_api_key: 'operations',
  status_token_secret: 'tracking',
  queue_cron_secret: 'operations',
  property_source_modules: 'sources',
  title_source_modules: 'sources',
  probate_source_modules: 'sources',
  people_association_source: 'sources',
  source_config: 'sources'
});

export function assessPaidOrderLaunchGate(env = process.env) {
  const checks = collectLaunchChecks(env);
  const blockingChecks = checks.filter((check) => check.severity === 'blocking' && check.status === 'fail');
  const reasonCodes = [...new Set(
    blockingChecks.map((check) => PUBLIC_REASON_BY_CHECK[check.id] || 'operations')
  )];

  return {
    ok: blockingChecks.length === 0,
    blockingChecks,
    reasonCodes,
    publicMessage: blockingChecks.length ? PUBLIC_GATE_MESSAGE : '',
    internalMessage: blockingChecks.length
      ? `Launch gate blocked automated paid-order flow: ${blockingChecks.map((check) => `${check.label} (${check.id})`).join(', ')}.`
      : ''
  };
}

export function assessPackageLaunchGate(packageId, env = process.env, existingChecks = null) {
  const pkg = getPackage(packageId);
  const checks = existingChecks || collectLaunchChecks(env);
  const coreBlockingChecks = checks.filter((check) => CUSTOMER_CORE_BLOCKING_IDS.has(check.id) && check.status === 'fail');
  const missingSourceRequirements = packageRequirementFailures(packageId, env);

  const sourceBlockingDetails = missingSourceRequirements.map((requirement) => ({
    id: requirement.id,
    label: requirement.label,
    detail: requirement.type === 'booleanTrue'
      ? `${requirement.id} must be set to true.`
      : `${requirement.id} is missing.`
  }));

  const blockingAreas = [
    ...new Set([
      ...coreBlockingChecks.map((check) => PUBLIC_REASON_BY_CHECK[check.id] || 'operations'),
      ...(sourceBlockingDetails.length ? ['sources'] : [])
    ])
  ];

  const available = coreBlockingChecks.length === 0 && sourceBlockingDetails.length === 0;
  const readinessSummary = available
    ? `${pkg?.name || packageId} is launch-ready in the current environment.`
    : coreBlockingChecks.length
      ? PUBLIC_GATE_MESSAGE
      : PACKAGE_SOURCE_PENDING_MESSAGE;

  return {
    id: packageId,
    name: pkg?.name || packageId,
    launchReady: available,
    launchMessage: readinessSummary,
    launchBlockingAreas: blockingAreas,
    launchBlockingDetails: [
      ...coreBlockingChecks.map((check) => ({ id: check.id, label: check.label, detail: check.detail })),
      ...sourceBlockingDetails
    ],
    readinessSummary,
    requiredSourceCoverage: (PACKAGE_SOURCE_REQUIREMENTS[packageId] || []).map((requirement) => ({
      id: requirement.id,
      label: requirement.label,
      ready: !envRequirementMissing(requirement, env)
    }))
  };
}

export function listPackageLaunchStatus(env = process.env, existingChecks = null) {
  const checks = existingChecks || collectLaunchChecks(env);
  return PACKAGE_LIST.map((pkg) => assessPackageLaunchGate(pkg.id, env, checks));
}

export function assessOrderLaunchGate(packageId, input = {}, env = process.env, existingChecks = null) {
  const packageGate = assessPackageLaunchGate(packageId, env, existingChecks);
  const orderCoverage = assessPackageJurisdictionCoverage({ packageId, input, env });

  if (!packageGate.launchReady) {
    return {
      ...packageGate,
      orderCoverage,
      manualReviewLikely: orderCoverage.manualReviewFamilies.length > 0,
      manualReviewDetails: orderCoverage.manualReviewFamilies.map((family) => ({
        id: `${family.family}_manual_review`,
        label: `${family.label} automation boundary`,
        detail: family.detail
      }))
    };
  }

  const jurisdictionBlockingDetails = orderCoverage.blockingFamilies.map((family) => ({
    id: `${family.family}_coverage`,
    label: `${family.label} coverage`,
    detail: family.detail
  }));

  const manualReviewDetails = orderCoverage.manualReviewFamilies.map((family) => ({
    id: `${family.family}_manual_review`,
    label: `${family.label} automation boundary`,
    detail: family.detail
  }));

  const launchReady = jurisdictionBlockingDetails.length === 0;
  const readinessSummary = launchReady
    ? manualReviewDetails.length
      ? `${packageGate.name} covers ${orderCoverage.locationLabel}, but at least one required family remains browser-backed in the current runtime.`
      : `${packageGate.name} is automation-ready for ${orderCoverage.locationLabel}.`
    : `${packageGate.name} is not automation-ready for ${orderCoverage.locationLabel}.`;

  return {
    ...packageGate,
    launchReady,
    launchMessage: launchReady
      ? packageGate.launchMessage
      : `${JURISDICTION_SOURCE_PENDING_MESSAGE} Requested location: ${orderCoverage.locationLabel}.`,
    launchBlockingAreas: launchReady
      ? packageGate.launchBlockingAreas
      : [...new Set([...packageGate.launchBlockingAreas, 'jurisdiction'])],
    launchBlockingDetails: launchReady
      ? packageGate.launchBlockingDetails
      : [...packageGate.launchBlockingDetails, ...jurisdictionBlockingDetails],
    readinessSummary,
    orderCoverage,
    manualReviewLikely: manualReviewDetails.length > 0,
    manualReviewDetails
  };
}
