import { BUSINESS_EMAIL, getBusinessEmail } from './business.js';
import { findStrictSourceConfigGaps, loadSourceConfig, summarizeSourceConfig } from './sources/source-config.js';
import { resolveKvRestConfig, storageDriverName } from './storage-runtime.js';
import { validateStripeSecretKey, validateStripeWebhookSecret } from './stripe-config.js';

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
  const host = trim(env.SMTP_HOST);
  const user = trim(env.SMTP_USER);
  const pass = trim(env.SMTP_PASS);
  const from = trim(env.EMAIL_FROM);
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

export function auditLaunchReadiness(env = process.env) {
  const checks = [];
  baseUrlCheck(env, checks);
  stripeChecks(env, checks);
  storageChecks(env, checks);
  emailChecks(env, checks);
  secretChecks(env, checks);
  sourceChecks(env, checks);

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
    manualActions
  };
}
