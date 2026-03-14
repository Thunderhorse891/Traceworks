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

window.triggerInstall = () => {
  triggerInstall().catch(() => {
    syncInstallButton();
  });
};

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Ignore registration failures and keep the site usable.
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
