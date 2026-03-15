async function annotatePackageAvailability() {
  const cards = [...document.querySelectorAll('[data-package-card]')];
  if (!cards.length) return;

  try {
    const response = await fetch('/api/packages');
    if (!response.ok) return;

    const data = await response.json().catch(() => ({}));
    const packages = Array.isArray(data.packages) ? data.packages : [];
    const byId = new Map(packages.map((pkg) => [pkg.id, pkg]));

    for (const card of cards) {
      const packageId = card.dataset.packageId || '';
      const pkg = byId.get(packageId);
      if (!pkg) continue;

      const statusEl = card.querySelector('[data-package-status]');
      const cta = card.querySelector('[data-package-cta]');
      const ready = pkg.launchReady !== false;

      if (statusEl) {
        statusEl.textContent = ready
          ? 'Launch ready in the current environment.'
          : (pkg.readinessSummary || pkg.launchMessage || 'This package is not live yet in the current environment.');
        statusEl.className = `pkg-availability ${ready ? 'ready' : 'blocked'}`;
      }

      if (cta && !ready) {
        card.classList.add('unavailable');
        cta.textContent = 'Source Coverage Pending';
        cta.setAttribute('aria-disabled', 'true');
        cta.setAttribute('tabindex', '-1');
        cta.removeAttribute('href');
      }
    }
  } catch {}
}

annotatePackageAvailability();
