function firstNonBlank(env, keys) {
  for (const key of keys) {
    const value = String(env[key] || '').trim();
    if (value) return value;
  }
  return '';
}

export function resolveEmailSettings(env = process.env) {
  const host = firstNonBlank(env, ['SMTP_HOST']);
  const port = Number(firstNonBlank(env, ['SMTP_PORT']) || 587);
  const user = firstNonBlank(env, ['SMTP_USER', 'SMTP_USERNAME']);
  const pass = firstNonBlank(env, ['SMTP_PASS', 'SMTP_PASSWORD']);
  const from = firstNonBlank(env, ['EMAIL_FROM', 'FROM_ADDRESS']);

  return {
    host,
    port: Number.isFinite(port) && port > 0 ? port : 587,
    user,
    pass,
    from
  };
}

export function missingEmailConfigKeys(env = process.env) {
  const settings = resolveEmailSettings(env);
  const missing = [];
  if (!settings.host) missing.push('SMTP_HOST');
  if (!settings.user) missing.push('SMTP_USER');
  if (!settings.pass) missing.push('SMTP_PASS');
  return missing;
}
