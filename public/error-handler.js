const TRACEWORKS_ERROR_ENDPOINT = '/api/track-event';

function normalizeErrorValue(value) {
  if (value instanceof Error) return `${value.name}: ${value.message}`;
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function postClientError(event, detail) {
  const body = JSON.stringify({
    event,
    href: window.location.href,
    userAgent: navigator.userAgent,
    detail,
  });

  try {
    if (navigator.sendBeacon) {
      const blob = new Blob([body], { type: 'application/json' });
      navigator.sendBeacon(TRACEWORKS_ERROR_ENDPOINT, blob);
      return;
    }
  } catch {
    // Fall back to keepalive fetch below.
  }

  fetch(TRACEWORKS_ERROR_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    keepalive: true,
  }).catch(() => {
    // Never throw from the error reporter.
  });
}

window.addEventListener('error', (event) => {
  postClientError('client_error', {
    message: event.message || 'Uncaught error',
    source: event.filename || '',
    line: event.lineno || 0,
    column: event.colno || 0,
  });
});

window.addEventListener('unhandledrejection', (event) => {
  postClientError('client_unhandled_rejection', {
    reason: normalizeErrorValue(event.reason),
  });
});
