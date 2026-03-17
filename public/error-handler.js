/**
 * error-handler.js — TraceWorks global error handler
 * Loads early (first script on every page). Captures unhandled JS errors
 * and promise rejections, reports them to /api/track-event, and manages
 * the offline/online connection indicator.
 *
 * Design principles:
 *  - Never throws — wraps all code in try/catch
 *  - Never blocks the main thread
 *  - Uses sendBeacon for fire-and-forget error reporting
 */
(function () {
  'use strict';

  // ── Error reporting ────────────────────────────────────────────────────────
  function reportError(type, message, source, lineno) {
    try {
      var payload = JSON.stringify({
        event: 'js_error',
        type: type,
        message: String(message).slice(0, 300),
        source: String(source || '').slice(0, 200),
        lineno: lineno || 0,
        url: location.href,
        ua: navigator.userAgent.slice(0, 150),
        ts: Date.now(),
      });
      if (navigator.sendBeacon) {
        navigator.sendBeacon('/api/track-event', payload);
      }
    } catch (_) {
      // Reporter must never throw — silently swallow
    }
  }

  // Catch synchronous JS errors (unhandled exceptions)
  window.onerror = function (message, source, lineno, colno, error) {
    reportError('uncaught', message, source, lineno);
    return false; // Let browser still log it to console
  };

  // Catch unhandled promise rejections
  window.addEventListener('unhandledrejection', function (event) {
    var reason = event.reason;
    var msg = reason instanceof Error ? reason.message : String(reason);
    reportError('unhandledrejection', msg, location.href, 0);
  });

  // ── Online / Offline indicator ─────────────────────────────────────────────
  function updateConnectionState() {
    try {
      if (navigator.onLine) {
        document.body.classList.remove('is-offline');
      } else {
        document.body.classList.add('is-offline');
      }
    } catch (_) {}
  }

  window.addEventListener('online',  updateConnectionState);
  window.addEventListener('offline', updateConnectionState);

  // Set initial state once DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', updateConnectionState);
  } else {
    updateConnectionState();
  }
})();
