let deferredPrompt = null;
let networkIndicator = null;

function installButton() {
  return document.getElementById('installBtn');
}

function ensureNetworkIndicator() {
  if (networkIndicator || !document.body) return networkIndicator;
  networkIndicator = document.getElementById('networkIndicator');
  if (networkIndicator) return networkIndicator;

  const element = document.createElement('div');
  element.id = 'networkIndicator';
  element.className = 'network-indicator';
  element.hidden = true;
  element.textContent = 'Offline';
  document.body.appendChild(element);
  networkIndicator = element;
  return networkIndicator;
}

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

function syncNetworkIndicator() {
  const indicator = ensureNetworkIndicator();
  if (!indicator) return;
  const offline = navigator.onLine === false;
  indicator.hidden = !offline;
  document.body.classList.toggle('is-offline', offline);
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

window.triggerInstall = () => {
  triggerInstall().catch(() => {
    syncInstallButton();
  });
};

function bindInstallButton() {
  const button = installButton();
  if (!button || button.dataset.installBound === 'true') return;
  button.dataset.installBound = 'true';
  button.addEventListener('click', (event) => {
    event.preventDefault();
    triggerInstall().catch(() => {
      syncInstallButton();
    });
  });
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((error) => {
      console.warn('TraceWorks service worker registration failed.', error);
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

window.addEventListener('online', syncNetworkIndicator);
window.addEventListener('offline', syncNetworkIndicator);
document.addEventListener('visibilitychange', syncInstallButton);
document.addEventListener('DOMContentLoaded', () => {
  bindInstallButton();
  syncNetworkIndicator();
});
bindInstallButton();
syncNetworkIndicator();
syncInstallButton();
