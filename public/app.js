import { clientPackages } from './packages.js';

const packagesGrid = document.getElementById('packages-grid');
const checkoutForm = document.getElementById('checkoutForm');
const packageInput = document.getElementById('packageId');
const statusEl = document.getElementById('status');
const salesStatus = document.getElementById('salesStatus');
const subjectTypeInput = document.getElementById('subjectType');
const packageSelectionHelp = document.getElementById('packageSelectionHelp');
const intakeGuidance = document.getElementById('intakeGuidance');
const selectedPackageSummary = document.getElementById('selectedPackageSummary');
const selectedPackageName = document.getElementById('selectedPackageName');
const selectedPackageTurnaround = document.getElementById('selectedPackageTurnaround');
const selectedPackageGuidance = document.getElementById('selectedPackageGuidance');

const intakeProgressHeading = document.getElementById('intakeProgressHeading');
const intakeProgressText = document.getElementById('intakeProgressText');
const intakeProgressFill = document.getElementById('intakeProgressFill');
const requiredSignalsStatus = document.getElementById('requiredSignalsStatus');
const recommendedSignalsStatus = document.getElementById('recommendedSignalsStatus');
const signalChipRow = document.getElementById('signalChipRow');
const clearDraftBtn = document.getElementById('clearDraftBtn');
const draftStatus = document.getElementById('draftStatus');
const briefPackage = document.getElementById('briefPackage');
const briefSubject = document.getElementById('briefSubject');
const briefJurisdiction = document.getElementById('briefJurisdiction');
const briefSignalStrength = document.getElementById('briefSignalStrength');
const briefObjective = document.getElementById('briefObjective');

const packageModal = document.getElementById('packageModal');
const packageModalClose = document.getElementById('packageModalClose');
const packageModalSelect = document.getElementById('packageModalSelect');
const packageModalLabel = document.getElementById('packageModalLabel');
const packageModalName = document.getElementById('packageModalName');
const packageModalPrice = document.getElementById('packageModalPrice');
const packageModalSummary = document.getElementById('packageModalSummary');
const packageModalAvailability = document.getElementById('packageModalAvailability');
const packageModalIncluded = document.getElementById('packageModalIncluded');
const packageModalWorkflow = document.getElementById('packageModalWorkflow');
const packageModalRequired = document.getElementById('packageModalRequired');
const packageModalRecommended = document.getElementById('packageModalRecommended');
const packageModalGuidance = document.getElementById('packageModalGuidance');
const heroReadyCount = document.getElementById('heroReadyCount');
const heroBlockedCount = document.getElementById('heroBlockedCount');
const heroTurnaroundWindow = document.getElementById('heroTurnaroundWindow');
const heroCoverageSummary = document.getElementById('heroCoverageSummary');
const heroPackageMatrix = document.getElementById('heroPackageMatrix');

const intakeFieldWrappers = new Map(
  [...document.querySelectorAll('[data-intake-field]')].map((el) => [el.dataset.intakeField, el])
);

const DRAFT_STORAGE_KEY = 'traceworksCheckoutDraftV1';
const FIELD_LABELS = {
  subjectName: 'Primary subject',
  county: 'County',
  lastKnownAddress: 'Last known address',
  parcelId: 'Parcel or APN',
  websiteProfile: 'Profile or listing URL',
  alternateNames: 'Aliases or alternate names',
  dateOfBirth: 'Date of birth',
  deathYear: 'Death year',
  subjectPhone: 'Subject phone',
  subjectEmail: 'Subject email'
};

let activeModalPackage = null;
let selectedPackage = null;
let packageCatalog = clientPackages.map((pkg) => ({
  ...pkg,
  launchReady: true,
  launchBlocked: false,
  launchMessage: '',
  launchBlockingAreas: [],
  launchBlockingDetails: [],
  readinessSummary: ''
}));
let lastDraftSavedAt = 0;
let draftSaveTimer = null;

async function track(type, detail = '') {
  try {
    await fetch('/api/track-event', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ type, packageId: packageInput?.value || '', page: 'home', detail })
    });
  } catch {}
}

function selectedCard() {
  return document.querySelector('[data-package-id].selected');
}

function setList(target, items = []) {
  if (!target) return;
  target.innerHTML = items.map((item) => `<li>${item}</li>`).join('');
}

function getPackageById(packageId) {
  return packageCatalog.find((pkg) => pkg.id === packageId) || null;
}

function packageAvailabilityCopy(pkg) {
  if (!pkg || pkg.launchReady !== false) return '';
  return pkg.readinessSummary || pkg.launchMessage || 'This package is not live yet in the current environment.';
}

function readyPackages() {
  return packageCatalog.filter((pkg) => pkg.launchReady !== false);
}

function turnaroundWindow(packages = readyPackages()) {
  const hours = packages
    .map((pkg) => Number(pkg.deliveryHours || 0))
    .filter((value) => Number.isFinite(value) && value > 0)
    .sort((left, right) => left - right);

  if (!hours.length) return 'Awaiting live package sync';
  const min = hours[0];
  const max = hours[hours.length - 1];
  return min === max ? `${min}h standard` : `${min}-${max}h typical`;
}

function renderHeroCommandCenter() {
  const ready = readyPackages();
  const blocked = packageCatalog.filter((pkg) => pkg.launchReady === false);

  if (heroReadyCount) heroReadyCount.textContent = String(ready.length);
  if (heroBlockedCount) heroBlockedCount.textContent = String(blocked.length);
  if (heroTurnaroundWindow) heroTurnaroundWindow.textContent = turnaroundWindow(ready);
  if (heroCoverageSummary) {
    heroCoverageSummary.textContent = ready.length
      ? `${ready.length}/${packageCatalog.length} packages live`
      : 'Coverage review in progress';
  }

  if (!heroPackageMatrix) return;

  heroPackageMatrix.innerHTML = packageCatalog
    .map((pkg) => {
      const tone = pkg.launchReady === false ? 'blocked' : 'ready';
      const selected = selectedPackage?.id === pkg.id ? ' active' : '';
      const note = pkg.launchReady === false
        ? 'Coverage pending'
        : `${Number(pkg.deliveryHours || 0) > 0 ? `${pkg.deliveryHours}h target` : 'Launch ready'}`;

      return `
        <button type="button" class="hero-package-row ${tone}${selected}" data-hero-package-id="${pkg.id}">
          <span class="hero-package-row-copy">
            <strong>${pkg.name}</strong>
            <small>${pkg.bestFor || pkg.summary || 'Investigative package'}</small>
          </span>
          <span class="hero-package-row-meta">${note}</span>
        </button>
      `;
    })
    .join('');

  heroPackageMatrix.querySelectorAll('[data-hero-package-id]').forEach((button) => {
    button.addEventListener('click', () => {
      const pkg = getPackageById(button.dataset.heroPackageId);
      if (!pkg) return;
      if (pkg.launchReady === false) {
        openPackageModal(pkg);
        return;
      }
      void selectPackage(pkg, { source: 'hero_matrix' });
    });
  });
}

async function syncPackageAvailability() {
  try {
    const response = await fetch('/api/packages');
    if (!response.ok) return;

    const data = await response.json().catch(() => ({}));
    const remoteById = new Map((data.packages || []).map((pkg) => [pkg.id, pkg]));

    packageCatalog = clientPackages.map((pkg) => {
      const remote = remoteById.get(pkg.id);
      if (!remote) return { ...pkg, launchReady: true, launchBlocked: false, launchMessage: '', launchBlockingAreas: [], launchBlockingDetails: [], readinessSummary: '' };
      return {
        ...pkg,
        launchReady: remote.launchReady !== false,
        launchBlocked: remote.launchReady === false,
        launchMessage: remote.launchMessage || '',
        launchBlockingAreas: Array.isArray(remote.launchBlockingAreas) ? remote.launchBlockingAreas : [],
        launchBlockingDetails: Array.isArray(remote.launchBlockingDetails) ? remote.launchBlockingDetails : [],
        readinessSummary: remote.readinessSummary || ''
      };
    });
  } catch (err) {
    // API unreachable — packages fall back to client defaults. Log for visibility.
    console.warn('[TraceWorks] Package availability sync failed:', err?.message || err);
  }
}

function setFieldVisibility(fieldName, visible) {
  const wrapper = intakeFieldWrappers.get(fieldName);
  if (!wrapper) return;
  wrapper.hidden = !visible;
  wrapper.querySelectorAll('input, textarea, select').forEach((input) => {
    input.disabled = !visible;
  });
}

function setDefaultIntakeState() {
  selectedPackage = null;
  if (packageInput) packageInput.value = '';
  if (selectedPackageSummary) selectedPackageSummary.hidden = true;
  if (selectedPackageName) selectedPackageName.textContent = 'Choose a tier above';
  if (selectedPackageTurnaround) selectedPackageTurnaround.textContent = 'Awaiting selection';
  if (selectedPackageGuidance) selectedPackageGuidance.textContent = '';
  if (packageSelectionHelp) {
    packageSelectionHelp.textContent = 'Start with a package above to unlock the recommended intake fields for that workflow.';
  }
  if (intakeGuidance) {
    intakeGuidance.textContent = 'We only search public-record and configured licensed sources. More identifiers improve match quality and reduce manual review.';
  }

  document.querySelectorAll('[data-package-id]').forEach((card) => card.classList.remove('selected'));
  for (const fieldName of intakeFieldWrappers.keys()) {
    setFieldVisibility(fieldName, true);
  }
  renderHeroCommandCenter();
}

function formatTime(timestamp) {
  if (!timestamp) return '';
  return new Date(timestamp).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function fieldLabel(fieldName) {
  return FIELD_LABELS[fieldName] || fieldName;
}

function readDraft() {
  try {
    return JSON.parse(localStorage.getItem(DRAFT_STORAGE_KEY) || 'null');
  } catch {
    return null;
  }
}

function writeDraft(payload) {
  try {
    localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(payload));
  } catch {}
}

function clearDraftStorage() {
  try {
    localStorage.removeItem(DRAFT_STORAGE_KEY);
  } catch {}
}

function formValue(fieldName) {
  if (!checkoutForm) return '';
  const field = checkoutForm.elements.namedItem(fieldName);
  if (!field) return '';

  if (typeof RadioNodeList !== 'undefined' && field instanceof RadioNodeList) {
    return String(field.value || '').trim();
  }

  if (typeof field.length === 'number' && typeof field.value === 'undefined') {
    return Array.from(field).find((item) => item.checked)?.value || '';
  }

  if (field.type === 'checkbox') {
    return field.checked ? 'true' : '';
  }

  return String(field.value || '').trim();
}

function hasMeaningfulValue(fieldName) {
  const value = formValue(fieldName);
  if (fieldName === 'alternateNames') {
    return value.split(/[\n,;]+/).map((item) => item.trim()).filter(Boolean).length > 0;
  }
  return value.length > 0;
}

function syncDraftStatus() {
  if (!draftStatus) return;
  draftStatus.textContent = lastDraftSavedAt
    ? `Draft saved ${formatTime(lastDraftSavedAt)}`
    : 'Draft saves locally';
}

function serializeDraft() {
  if (!checkoutForm) return {};
  const payload = Object.fromEntries(new FormData(checkoutForm).entries());
  delete payload.legalConsent;
  delete payload.tosConsent;
  return payload;
}

function queueDraftSave() {
  if (!checkoutForm) return;
  clearTimeout(draftSaveTimer);
  draftSaveTimer = window.setTimeout(() => {
    lastDraftSavedAt = Date.now();
    writeDraft({ savedAt: lastDraftSavedAt, data: serializeDraft() });
    syncDraftStatus();
  }, 180);
}

function applyPackageToForm(pkg) {
  selectedPackage = pkg;
  if (packageInput) packageInput.value = pkg.id;
  if (subjectTypeInput && pkg.intake?.defaultSubjectType) subjectTypeInput.value = pkg.intake.defaultSubjectType;

  const visibleFields = new Set(pkg.intake?.fields || []);
  for (const fieldName of intakeFieldWrappers.keys()) {
    setFieldVisibility(fieldName, visibleFields.has(fieldName));
  }

  if (selectedPackageSummary) selectedPackageSummary.hidden = false;
  if (selectedPackageName) selectedPackageName.textContent = pkg.name;
  if (selectedPackageTurnaround) selectedPackageTurnaround.textContent = `${pkg.turnaround} · ${pkg.price}`;
  if (selectedPackageGuidance) selectedPackageGuidance.textContent = pkg.intake?.guidance || pkg.summary || '';
  if (packageSelectionHelp) {
    packageSelectionHelp.textContent = `Essentials: ${(pkg.intake?.requiredSignals || []).join(' · ')}. Helpful identifiers: ${(pkg.intake?.recommendedSignals || []).join(' · ')}.`;
  }
  if (intakeGuidance) {
    intakeGuidance.textContent = pkg.intake?.guidance || 'More identifiers improve match quality and reduce manual review.';
  }
}

function countSatisfiedRequiredGroups(pkg) {
  const groups = pkg?.intake?.requiredGroups || [];
  const completed = groups.filter((group) => (group.anyOf || []).some((fieldName) => hasMeaningfulValue(fieldName)));
  return { total: groups.length, completed };
}

function countRecommendedFields(pkg) {
  const fields = pkg?.intake?.recommendedFields || [];
  const completed = fields.filter((fieldName) => hasMeaningfulValue(fieldName));
  return { total: fields.length, completed };
}

function identifierFieldList(pkg) {
  return [...new Set([
    ...(pkg?.intake?.requiredGroups || []).flatMap((group) => group.anyOf || []),
    ...(pkg?.intake?.recommendedFields || []),
    'subjectName',
    'county',
    'lastKnownAddress',
    'parcelId',
    'alternateNames',
    'dateOfBirth',
    'deathYear',
    'subjectPhone',
    'subjectEmail',
    'websiteProfile'
  ])];
}

function renderSignalChips(pkg, requiredGroups, recommendedFields) {
  if (!signalChipRow) return;
  if (!pkg) {
    signalChipRow.innerHTML = '';
    return;
  }

  const requiredChips = (pkg.intake?.requiredGroups || []).map((group) => {
    const met = requiredGroups.completed.some((item) => item.label === group.label);
    return `<span class="signal-chip ${met ? 'is-met' : 'is-pending'} required">${group.label}</span>`;
  });

  const recommendedChips = (pkg.intake?.recommendedFields || []).map((fieldName) => {
    const met = recommendedFields.completed.includes(fieldName);
    return `<span class="signal-chip ${met ? 'is-met' : 'is-pending'} optional">${fieldLabel(fieldName)}</span>`;
  });

  signalChipRow.innerHTML = [...requiredChips, ...recommendedChips].join('');
}

function updateBriefCard(pkg, requiredGroups, recommendedFields) {
  if (briefPackage) briefPackage.textContent = pkg?.name || 'Awaiting package selection';
  if (briefSubject) briefSubject.textContent = formValue('subjectName') || 'Awaiting subject name';

  const county = formValue('county');
  const state = formValue('state');
  if (briefJurisdiction) {
    briefJurisdiction.textContent = county ? `${county}${state ? `, ${state}` : ''}` : 'Awaiting county';
  }

  const identifierCount = identifierFieldList(pkg).filter((fieldName) => hasMeaningfulValue(fieldName)).length;
  if (briefSignalStrength) {
    const requiredNote = pkg ? `${requiredGroups.completed.length}/${requiredGroups.total} required` : '0 required';
    briefSignalStrength.textContent = `${identifierCount} identifiers on file - ${requiredNote}`;
  }

  if (briefObjective) {
    briefObjective.textContent =
      formValue('goals') ||
      formValue('requestedFindings') ||
      pkg?.intake?.guidance ||
      'Choose a package, add the strongest identifiers you have, and describe what the report needs to confirm or uncover.';
  }

  void recommendedFields;
}

function updateGuidedExperience() {
  const pkg = selectedPackage;

  if (!pkg) {
    if (intakeProgressHeading) intakeProgressHeading.textContent = 'Step 1 of 4 - Choose a package';
    if (intakeProgressText) intakeProgressText.textContent = 'Select a report tier above and the intake will guide you toward the strongest identifiers for that workflow.';
    if (intakeProgressFill) intakeProgressFill.style.width = '0%';
    if (requiredSignalsStatus) requiredSignalsStatus.textContent = 'Essential inputs: 0 / 0';
    if (recommendedSignalsStatus) recommendedSignalsStatus.textContent = 'Helpful identifiers: 0 / 0';
    renderSignalChips(null, { completed: [], total: 0 }, { completed: [], total: 0 });
    updateBriefCard(null, { completed: [], total: 0 }, { completed: [], total: 0 });
    syncDraftStatus();
    return;
  }

  const requiredGroups = countSatisfiedRequiredGroups(pkg);
  const recommendedFields = countRecommendedFields(pkg);
  const hasObjective = Boolean(formValue('requestedFindings') || formValue('goals'));
  const consentReady = checked(checkoutForm, 'legalConsent') && checked(checkoutForm, 'tosConsent');

  let heading = 'Step 2 of 4 - Strengthen identifiers';
  let copy = 'Add the strongest identifiers you have so the engine starts with higher-confidence seeds and fewer false positives.';
  let progress = 34;

  if (requiredGroups.completed.length === requiredGroups.total && !hasObjective) {
    heading = 'Step 3 of 4 - Define the report outcome';
    copy = 'Your minimum intake is in place. Now tell TraceWorks what the report must confirm, uncover, or document.';
    progress = 62;
  } else if (requiredGroups.completed.length === requiredGroups.total && hasObjective && !consentReady) {
    heading = 'Step 4 of 4 - Confirm legal use';
    copy = 'The intake is strong enough to start. Review the legal-use acknowledgements and proceed to Stripe checkout.';
    progress = 84;
  } else if (requiredGroups.completed.length === requiredGroups.total && hasObjective && consentReady) {
    heading = 'Ready for secure checkout';
    copy = 'Your request is structured for the selected package. Proceed to Stripe and the queue will begin immediately after payment confirmation.';
    progress = 100;
  }

  if (intakeProgressHeading) intakeProgressHeading.textContent = heading;
  if (intakeProgressText) intakeProgressText.textContent = copy;
  if (intakeProgressFill) intakeProgressFill.style.width = `${progress}%`;
  if (requiredSignalsStatus) requiredSignalsStatus.textContent = `Essential inputs: ${requiredGroups.completed.length} / ${requiredGroups.total}`;
  if (recommendedSignalsStatus) recommendedSignalsStatus.textContent = `Helpful identifiers: ${recommendedFields.completed.length} / ${recommendedFields.total}`;

  renderSignalChips(pkg, requiredGroups, recommendedFields);
  updateBriefCard(pkg, requiredGroups, recommendedFields);
  syncDraftStatus();
}

async function selectPackage(pkg, { shouldScroll = true, source = 'grid', trackSelection = true } = {}) {
  if (pkg.launchReady === false) {
    if (statusEl) statusEl.textContent = packageAvailabilityCopy(pkg) || `${pkg.name} is not live yet in the current environment.`;
    if (trackSelection) {
      await track('package_blocked', pkg.id);
    }
    return;
  }

  document.querySelectorAll('[data-package-id]').forEach((card) => card.classList.remove('selected'));
  const card = document.querySelector(`[data-package-id="${pkg.id}"]`);
  card?.classList.add('selected');

  applyPackageToForm(pkg);
  renderHeroCommandCenter();
  updateGuidedExperience();
  queueDraftSave();

  if (statusEl) statusEl.textContent = `${pkg.name} selected. Complete the structured intake below so the workflow starts with the strongest identifiers.`;

  if (shouldScroll) {
    document.getElementById('order')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  if (trackSelection) {
    await track(source === 'prefill' ? 'package_prefilled' : 'package_selected', pkg.id);
  }
}

function fillPackageModal(pkg) {
  if (!pkg) return;
  activeModalPackage = pkg;
  if (packageModalLabel) packageModalLabel.textContent = pkg.id.replaceAll('_', ' ').toUpperCase();
  if (packageModalName) packageModalName.textContent = pkg.name;
  if (packageModalPrice) packageModalPrice.textContent = pkg.price;
  if (packageModalSummary) packageModalSummary.textContent = pkg.summary || '';
  if (packageModalAvailability) {
    packageModalAvailability.textContent = packageAvailabilityCopy(pkg);
    packageModalAvailability.className = `package-modal-availability${pkg.launchReady === false ? ' blocked' : ' ready'}`;
  }
  if (packageModalGuidance) packageModalGuidance.textContent = pkg.intake?.guidance || '';
  setList(packageModalIncluded, pkg.includedFindings || []);
  setList(packageModalWorkflow, pkg.workflowScope || pkg.bullets || []);
  setList(packageModalRequired, pkg.intake?.requiredSignals || []);
  setList(packageModalRecommended, pkg.intake?.recommendedSignals || []);
  if (packageModalSelect) {
    packageModalSelect.disabled = pkg.launchReady === false;
    packageModalSelect.textContent = pkg.launchReady === false ? 'Source Coverage Pending' : 'Start Secure Intake';
  }
}

function openPackageModal(pkg) {
  if (!packageModal) return;
  fillPackageModal(pkg);
  if (typeof packageModal.showModal === 'function') {
    packageModal.showModal();
  } else {
    packageModal.setAttribute('open', 'open');
  }
}

function closePackageModal() {
  if (!packageModal) return;
  if (typeof packageModal.close === 'function') packageModal.close();
  else packageModal.removeAttribute('open');
}

function buildCard(pkg) {
  const includedCount = (pkg.includedFindings || []).length || (pkg.bullets || []).length;
  const workflowCount = (pkg.workflowScope || []).length || (pkg.bullets || []).length;
  const intakeGroupCount = (pkg.intake?.requiredGroups || []).length;
  const recommendedCount = (pkg.intake?.recommendedFields || []).length;
  const el = document.createElement('article');
  el.className = `card package-card${pkg.featured ? ' featured' : ''}${pkg.launchReady === false ? ' unavailable' : ''}`;
  el.dataset.packageId = pkg.id;
  el.innerHTML = `
    <div class="package-card-top">
      <div class="package-card-heading">
        <p class="label">${pkg.id.replaceAll('_', ' ').toUpperCase()}</p>
        <h4>${pkg.name}</h4>
      </div>
      <div class="package-card-badges">
        ${pkg.featured ? '<p class="feature-badge">Common choice</p>' : ''}
        ${pkg.launchReady === false ? '<p class="availability-badge blocked">Source Coverage Pending</p>' : '<p class="availability-badge ready">Launch Ready</p>'}
      </div>
    </div>
    <div class="package-price-row">
      <p class="price">${pkg.price}</p>
      <p class="pkg-turnaround">${pkg.turnaround || 'Typical delivery: same day to 24h'}</p>
    </div>
    <p class="pkg-meta"><strong>Best for:</strong> ${pkg.bestFor || 'Legal locate intelligence workflows'}</p>
    <p class="pkg-meta pkg-summary">${pkg.summary || ''}</p>
    <div class="package-stat-grid">
      <div class="package-stat">
        <span>Included findings</span>
        <strong>${includedCount}</strong>
      </div>
      <div class="package-stat">
        <span>Workflow modules</span>
        <strong>${workflowCount}</strong>
      </div>
      <div class="package-stat">
        <span>Essential inputs</span>
        <strong>${intakeGroupCount}</strong>
      </div>
      <div class="package-stat">
        <span>Helpful identifiers</span>
        <strong>${recommendedCount}</strong>
      </div>
    </div>
    ${packageAvailabilityCopy(pkg) ? `<p class="pkg-availability-copy">${packageAvailabilityCopy(pkg)}</p>` : ''}
    <ul class="package-checklist">${pkg.bullets.map((item) => `<li>${item}</li>`).join('')}</ul>
    <div class="card-actions">
      <button type="button" class="btn-outline package-detail-btn">View Scope</button>
      <button type="button" class="select-btn"${pkg.launchReady === false ? ' disabled aria-disabled="true"' : ''}>${pkg.launchReady === false ? 'Unavailable' : 'Start Intake'}</button>
    </div>
  `;

  el.querySelector('.package-detail-btn')?.addEventListener('click', async () => {
    openPackageModal(pkg);
    await track('package_detail_opened', pkg.id);
  });

  el.querySelector('.select-btn')?.addEventListener('click', async () => {
    await selectPackage(pkg, { source: 'grid' });
  });

  return el;
}

function renderPackages() {
  if (!packagesGrid) return;
  packagesGrid.innerHTML = '';
  for (const pkg of packageCatalog) {
    packagesGrid.appendChild(buildCard(pkg));
  }
}

function checked(form, name) {
  return form?.querySelector(`[name="${name}"]`)?.checked === true;
}

function restoreDraft() {
  if (!checkoutForm) return false;
  const draft = readDraft();
  if (!draft?.data) {
    syncDraftStatus();
    return false;
  }

  lastDraftSavedAt = Number(draft.savedAt || 0);

  for (const [name, value] of Object.entries(draft.data)) {
    const field = checkoutForm.elements.namedItem(name);
    if (!field || value == null) continue;

    if (typeof RadioNodeList !== 'undefined' && field instanceof RadioNodeList) {
      field.value = value;
      continue;
    }

    if (field.type === 'checkbox') {
      field.checked = value === 'true';
      continue;
    }

    field.value = value;
  }

  syncDraftStatus();
  return true;
}

checkoutForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.target;

  if (!packageInput?.value) {
    if (statusEl) statusEl.textContent = 'Please select a report tier above before checkout.';
    await track('checkout_blocked', 'missing_package');
    return;
  }

  if (!checked(form, 'legalConsent') || !checked(form, 'tosConsent')) {
    if (statusEl) statusEl.textContent = 'Please confirm legal use and accept terms before checkout.';
    await track('checkout_blocked', 'missing_consents');
    return;
  }

  if (statusEl) statusEl.textContent = 'Creating secure checkout session...';
  const payload = Object.fromEntries(new FormData(form).entries());
  payload.legalConsent = checked(form, 'legalConsent');
  payload.tosConsent = checked(form, 'tosConsent');

  await track('checkout_started');

  let response;
  let data;
  try {
    response = await fetch('/api/create-checkout', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload)
    });
    data = await response.json();
  } catch {
    if (statusEl) statusEl.textContent = 'Network error. Please check your connection and try again.';
    await track('checkout_error', 'network_failure');
    return;
  }

  if (!response.ok) {
    if (statusEl) statusEl.textContent = data.error || 'Unable to start checkout.';
    await track('checkout_error', data.error || 'unknown');
    return;
  }

  await track('checkout_redirect', data.caseRef || '');
  window.location.href = data.checkoutUrl;
});

checkoutForm?.addEventListener('input', () => {
  updateGuidedExperience();
  queueDraftSave();
});

checkoutForm?.addEventListener('change', () => {
  updateGuidedExperience();
  queueDraftSave();
});

document.getElementById('salesForm')?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.target;
  if (salesStatus) salesStatus.textContent = 'Submitting inquiry...';

  const payload = Object.fromEntries(new FormData(form).entries());
  let response;
  let data;
  try {
    response = await fetch('/api/contact-sales', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload)
    });
    data = await response.json();
  } catch {
    if (salesStatus) salesStatus.textContent = 'Network error. Please try again.';
    await track('sales_lead_error', 'network_failure');
    return;
  }

  if (!response.ok) {
    if (salesStatus) salesStatus.textContent = data.error || 'Unable to submit inquiry right now.';
    await track('sales_lead_error', data.error || 'unknown');
    return;
  }

  if (salesStatus) salesStatus.textContent = 'Received. We will be in touch from traceworks.tx@outlook.com.';
  form.reset();
  await track('sales_lead_submitted', payload.monthlyCases || '');
});

packageModalClose?.addEventListener('click', closePackageModal);
packageModal?.addEventListener('click', (event) => {
  if (event.target === packageModal) closePackageModal();
});
packageModalSelect?.addEventListener('click', async () => {
  if (!activeModalPackage) return;
  closePackageModal();
  await selectPackage(activeModalPackage, { source: 'modal' });
});

clearDraftBtn?.addEventListener('click', () => {
  clearDraftStorage();
  lastDraftSavedAt = 0;
  checkoutForm?.reset();
  setDefaultIntakeState();
  updateGuidedExperience();
  if (statusEl) statusEl.textContent = 'Local draft cleared. Choose a package to start a fresh request.';
});

async function boot() {
  await syncPackageAvailability();
  renderPackages();
  renderHeroCommandCenter();
  setDefaultIntakeState();
  const restoredDraft = restoreDraft();

  const requestedPackageId = new URLSearchParams(window.location.search).get('packageId');
  if (requestedPackageId) {
    const pkg = getPackageById(requestedPackageId);
    if (pkg) await selectPackage(pkg, { shouldScroll: false, source: 'prefill' });
  } else if (restoredDraft) {
    const pkg = getPackageById(formValue('packageId'));
    if (pkg) {
      await selectPackage(pkg, { shouldScroll: false, source: 'restore', trackSelection: false });
      if (statusEl && pkg.launchReady !== false) {
        statusEl.textContent = 'Local draft restored. Confirm the request details, then proceed to secure checkout.';
      }
    } else {
      updateGuidedExperience();
    }
  } else {
    updateGuidedExperience();
  }

  const yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  if (selectedCard() && statusEl && !statusEl.textContent) {
    statusEl.textContent = 'Package selected. Complete the secure intake form below.';
  }
}

boot();
