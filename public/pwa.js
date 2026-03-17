/**
 * pwa.js — TraceWorks PWA bootstrapper
 * Handles: service worker registration, install prompt, install button sync.
 * Note: window.onerror / offline indicator are in error-handler.js (loads earlier).
 */

let deferredPrompt = null;

function installButton() {
  return document.getElementById('installBtn');
}

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

function syncInstallButton() {
  const button = installButton();
  if (!button) return;
  button.hidden = isStandalone() || !deferredPrompt;
}

async function triggerInstall() {
  if (!deferredPrompt) return false;
  deferredPrompt.prompt();
  const choice = await deferredPrompt.userChoice.catch(() => null);
  deferredPrompt = null;
  syncInstallButton();
  return choice?.outcome === 'accepted';
}

// Expose for programmatic use (e.g. banner buttons)
window.triggerInstall = () => {
  triggerInstall().catch(() => syncInstallButton());
};

// Bind install button via event listener so CSP can drop 'unsafe-inline' in future
document.addEventListener('DOMContentLoaded', () => {
  const btn = installButton();
  if (btn) {
    btn.removeAttribute('onclick'); // remove any inline handler from HTML
    btn.addEventListener('click', () => window.triggerInstall());
  }
});

// Service worker registration
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Registration failures are non-fatal — keep the site usable
    });
  });
}

window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  deferredPrompt = event;
  syncInstallButton();
});

window.addEventListener('appinstalled', () => {
  deferredPrompt = null;
  syncInstallButton();
});

document.addEventListener('visibilitychange', syncInstallButton);
syncInstallButton();
