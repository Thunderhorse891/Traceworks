(() => {
  const WIDGET_TAG = "traceworks-landing";
  const DEFAULT_APP_BASE_URL = "https://traceworks.example.com";
  const PACKAGES = [{"id":"standard","name":"Standard Property Snapshot","price":"$99","summary":"Fast public-record property snapshot for legal professionals needing ownership confirmation, parcel data, and assessment history.","bestFor":"Quick property ownership lookup and parcel verification","deliveryHours":24,"featured":false,"includedFindings":["County CAD owner of record with parcel ID and legal description","Tax assessment status and last-known assessment value","Parcel GIS result with any known address discrepancies"]},{"id":"ownership_encumbrance","name":"Ownership & Encumbrance Intelligence Report","price":"$249","summary":"Deed and encumbrance intelligence for title due diligence, acquisition research, and curative planning. Not a title opinion.","bestFor":"Deed research, title due diligence, and lien identification","deliveryHours":48,"featured":true,"includedFindings":["Instrument history with volume/page references and recording dates","Grantor-grantee index entries with party names","Chain continuity assessment with any flagged gaps or conflicts"]},{"id":"probate_heirship","name":"Probate & Heirship Investigation Report","price":"$325","summary":"Heir and beneficiary investigation for probate support, estate administration, and court-workflow preparation. Not a legal heirship adjudication.","bestFor":"Heir locate, probate support, and beneficiary identification","deliveryHours":72,"featured":false,"includedFindings":["Obituary cross-reference with death year and location signals","Probate case index result with case number and status if found","Heir candidate matrix with confidence labels and contact leads"]},{"id":"asset_network","name":"Asset & Property Network Report","price":"$399","summary":"Extended property and asset network research for enforcement, collections, and recovery strategy. Combines property snapshot with deed and encumbrance intelligence.","bestFor":"Asset tracing, enforcement strategy, and collections support","deliveryHours":72,"featured":false,"includedFindings":["Multi-parcel ownership network from CAD and GIS sources","Deed and grantor-grantee cross-reference for known parcels","Chain continuity flags and documented source limitations"]},{"id":"comprehensive","name":"Comprehensive Investigative Report","price":"$549","summary":"Maximum-scope investigative report combining property, encumbrance, and heirship research into a single deliverable. For complex matters requiring full public-record coverage.","bestFor":"Full-scope legal investigation: property, deed, and heir research combined","deliveryHours":96,"featured":false,"includedFindings":["All property, deed, and heir sections with full source trace","Cross-source conflict flags where owner data disagrees","Confidence matrix and analyst-oriented next steps"]}];

  const FONT_HREF = 'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Libre+Baskerville:ital,wght@0,400;0,700;1,400&display=swap';

  const STYLES = `
    :host {
      display: block;
      color: #edf2fc;
      font-family: "Inter", "SF Pro Text", system-ui, sans-serif;
      --twx-bg: #060c14;
      --twx-surface: rgba(11,20,32,0.92);
      --twx-raised: rgba(15,28,46,0.92);
      --twx-border: rgba(120,160,220,0.18);
      --twx-border-strong: rgba(212,168,39,0.32);
      --twx-text: #edf2fc;
      --twx-text-2: #b8c6e0;
      --twx-text-3: #7a8fad;
      --twx-gold: #d4a827;
      --twx-gold-soft: #edc85a;
      --twx-success: #5ecb94;
      --twx-shadow: 0 24px 50px rgba(0,0,0,0.34);
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }

    * {
      box-sizing: border-box;
    }

    a {
      color: inherit;
      text-decoration: none;
    }

    .shell {
      overflow: hidden;
      border: 1px solid var(--twx-border);
      border-radius: 28px;
      background:
        radial-gradient(circle at top left, rgba(212,168,39,0.11), transparent 28%),
        radial-gradient(circle at 88% 12%, rgba(82,116,178,0.16), transparent 26%),
        linear-gradient(180deg, #07101b 0%, #0a111b 48%, #0d1520 100%);
      box-shadow: var(--twx-shadow);
    }

    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 16px;
      padding: 18px 24px;
      border-bottom: 1px solid var(--twx-border);
      backdrop-filter: blur(18px);
      background: rgba(7,12,22,0.72);
    }

    .brand {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      color: var(--twx-text);
      font-size: 20px;
      font-weight: 700;
      letter-spacing: -0.02em;
    }

    .brand-mark {
      color: var(--twx-gold);
    }

    .header-note {
      color: var(--twx-text-3);
      font-size: 11px;
      letter-spacing: 0.12em;
      text-transform: uppercase;
    }

    .hero {
      display: grid;
      grid-template-columns: minmax(0, 1.2fr) minmax(320px, 0.8fr);
      gap: 24px;
      padding: 28px 24px 22px;
    }

    .eyebrow {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      color: var(--twx-gold-soft);
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.18em;
      text-transform: uppercase;
    }

    .eyebrow::before {
      content: '';
      width: 34px;
      height: 1px;
      background: linear-gradient(90deg, rgba(212,168,39,0), rgba(212,168,39,0.9));
    }

    h1 {
      margin: 16px 0 12px;
      color: var(--twx-text);
      font-family: "Libre Baskerville", Georgia, serif;
      font-size: clamp(34px, 5vw, 54px);
      line-height: 1.06;
      letter-spacing: -0.03em;
    }

    .hero-copy {
      max-width: 680px;
      color: var(--twx-text-2);
      font-size: 16px;
      line-height: 1.8;
    }

    .hero-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      margin-top: 24px;
    }

    .btn {
      display: inline-flex;
      justify-content: center;
      align-items: center;
      min-height: 44px;
      padding: 0 18px;
      border-radius: 999px;
      border: 1px solid transparent;
      font-size: 13px;
      font-weight: 700;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      transition: transform 0.18s ease, border-color 0.18s ease, background 0.18s ease;
    }

    .btn:hover {
      transform: translateY(-1px);
    }

    .btn-primary {
      background: linear-gradient(135deg, #c99a1a, #edc85a);
      color: #09111c;
      box-shadow: 0 14px 26px rgba(212,168,39,0.18);
    }

    .btn-secondary {
      border-color: var(--twx-border);
      background: rgba(255,255,255,0.03);
      color: var(--twx-text);
    }

    .signal-row {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 22px;
    }

    .signal {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 7px 12px;
      border: 1px solid var(--twx-border);
      border-radius: 999px;
      background: rgba(120,160,220,0.08);
      color: var(--twx-text-2);
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.04em;
    }

    .signal::before {
      content: '';
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: var(--twx-success);
      box-shadow: 0 0 0 6px rgba(94,203,148,0.12);
    }

    .hero-panel {
      padding: 20px;
      border: 1px solid var(--twx-border);
      border-radius: 22px;
      background: rgba(7,12,22,0.68);
    }

    .panel-label {
      color: var(--twx-text-3);
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.12em;
      text-transform: uppercase;
    }

    .panel-title {
      margin: 12px 0 14px;
      color: var(--twx-text);
      font-size: 21px;
      line-height: 1.28;
      letter-spacing: -0.02em;
    }

    .metrics {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 12px;
      margin-top: 18px;
    }

    .metric {
      padding: 14px;
      border: 1px solid var(--twx-border);
      border-radius: 18px;
      background: rgba(255,255,255,0.02);
    }

    .metric strong {
      display: block;
      margin-top: 6px;
      color: var(--twx-text);
      font-size: 22px;
      letter-spacing: -0.03em;
    }

    .metric span,
    .metric small {
      color: var(--twx-text-3);
      font-size: 11px;
      letter-spacing: 0.06em;
      text-transform: uppercase;
    }

    .packages {
      padding: 4px 24px 28px;
    }

    .packages-head {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      gap: 16px;
      margin-bottom: 18px;
    }

    .packages-head h2 {
      margin: 8px 0 0;
      color: var(--twx-text);
      font-size: clamp(24px, 3vw, 34px);
      line-height: 1.15;
      letter-spacing: -0.02em;
    }

    .packages-head p {
      max-width: 560px;
      color: var(--twx-text-2);
      font-size: 14px;
      line-height: 1.7;
    }

    .packages-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      gap: 16px;
    }

    .package-card {
      position: relative;
      display: grid;
      gap: 12px;
      padding: 20px 18px;
      border: 1px solid var(--twx-border);
      border-radius: 22px;
      background: linear-gradient(180deg, rgba(15,28,46,0.86), rgba(9,17,28,0.9));
      min-height: 100%;
    }

    .package-card.featured {
      border-color: var(--twx-border-strong);
      box-shadow: 0 18px 34px rgba(0,0,0,0.24);
    }

    .package-card.featured::after {
      content: 'Most selected';
      position: absolute;
      top: 14px;
      right: 14px;
      padding: 4px 9px;
      border-radius: 999px;
      background: rgba(212,168,39,0.14);
      color: var(--twx-gold-soft);
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    .package-top {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 12px;
      padding-right: 84px;
    }

    .package-name {
      color: var(--twx-text);
      font-size: 18px;
      line-height: 1.35;
      letter-spacing: -0.01em;
    }

    .package-price {
      color: var(--twx-gold-soft);
      font-size: 24px;
      font-weight: 700;
      letter-spacing: -0.03em;
      white-space: nowrap;
    }

    .package-best-for,
    .package-summary,
    .package-delivery {
      color: var(--twx-text-2);
      font-size: 13px;
      line-height: 1.68;
    }

    .package-label {
      color: var(--twx-text-3);
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.14em;
      text-transform: uppercase;
    }

    ul {
      margin: 0;
      padding: 0;
      list-style: none;
      display: grid;
      gap: 8px;
    }

    li {
      display: flex;
      gap: 10px;
      color: var(--twx-text-2);
      font-size: 12px;
      line-height: 1.6;
    }

    li::before {
      content: '';
      width: 7px;
      height: 7px;
      margin-top: 6px;
      flex-shrink: 0;
      border-radius: 50%;
      background: rgba(212,168,39,0.9);
    }

    .package-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      margin-top: auto;
      padding-top: 4px;
    }

    .package-actions .btn {
      flex: 1 1 0;
      min-width: 150px;
    }

    .footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 16px;
      padding: 0 24px 24px;
      color: var(--twx-text-3);
      font-size: 12px;
      line-height: 1.65;
    }

    .footer strong {
      color: var(--twx-text-2);
      font-weight: 600;
    }

    @media (max-width: 980px) {
      .hero {
        grid-template-columns: 1fr;
      }
    }

    @media (max-width: 640px) {
      .header,
      .hero,
      .packages,
      .footer {
        padding-left: 16px;
        padding-right: 16px;
      }

      .packages-grid,
      .metrics {
        grid-template-columns: 1fr;
      }

      .package-top,
      .packages-head,
      .footer,
      .hero-actions {
        flex-direction: column;
        align-items: flex-start;
      }

      .package-card.featured::after {
        position: static;
        width: fit-content;
      }

      .package-top {
        padding-right: 0;
      }

      .package-actions {
        width: 100%;
      }

      .package-actions .btn {
        width: 100%;
      }
    }
  `;

  const escapeHtml = (value) =>
    String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');

  const normalizeBase = (input) => {
    const raw = (input || DEFAULT_APP_BASE_URL).trim();
    return raw.replace(/\/$/, '');
  };

  class TraceworksLanding extends HTMLElement {
    static get observedAttributes() {
      return ['app-base-url', 'headline', 'subhead', 'max-packages'];
    }

    constructor() {
      super();
      this.attachShadow({ mode: 'open' });
    }

    connectedCallback() {
      this.render();
    }

    attributeChangedCallback() {
      if (this.isConnected) this.render();
    }

    get appBaseUrl() {
      return normalizeBase(this.getAttribute('app-base-url'));
    }

    get headline() {
      return this.getAttribute('headline') || 'Evidence-grade property, probate, and ownership intelligence.';
    }

    get subhead() {
      return this.getAttribute('subhead') || 'TraceWorks converts a structured intake into a premium investigative dossier with real public-record sourcing, Stripe-backed checkout, and a report path that stays honest about confidence and gaps.';
    }

    get packageLimit() {
      const parsed = Number.parseInt(this.getAttribute('max-packages') || String(PACKAGES.length), 10);
      return Number.isFinite(parsed) && parsed > 0 ? parsed : PACKAGES.length;
    }

    render() {
      const appBaseUrl = this.appBaseUrl;
      const compareUrl = appBaseUrl + '/packages.html';
      const enterpriseUrl = appBaseUrl + '/enterprise.html';
      const intakeUrl = appBaseUrl + '/#order';
      const visiblePackages = PACKAGES.slice(0, this.packageLimit);
      const featuredCount = visiblePackages.filter((pkg) => pkg.featured).length || 1;

      const packageCards = visiblePackages.map((pkg) => {
        const intakeHref = appBaseUrl + '/?packageId=' + encodeURIComponent(pkg.id) + '#order';
        const findings = pkg.includedFindings
          .map((finding) => '<li>' + escapeHtml(finding) + '</li>')
          .join('');

        return `
          <article class="package-card ${pkg.featured ? 'featured' : ''}">
            <div class="package-top">
              <div>
                <div class="package-label">TraceWorks Package</div>
                <h3 class="package-name">${escapeHtml(pkg.name)}</h3>
              </div>
              <div class="package-price">${escapeHtml(pkg.price)}</div>
            </div>
            <p class="package-best-for"><strong>${escapeHtml(pkg.bestFor)}</strong></p>
            <p class="package-summary">${escapeHtml(pkg.summary)}</p>
            <p class="package-delivery"><span class="package-label">Typical Delivery</span><br />${escapeHtml(String(pkg.deliveryHours))} hours or less</p>
            <ul>${findings}</ul>
            <div class="package-actions">
              <a class="btn btn-primary" href="${intakeHref}" target="_blank" rel="noopener">Open Secure Intake</a>
              <a class="btn btn-secondary" href="${compareUrl}" target="_blank" rel="noopener">Compare Tiers</a>
            </div>
          </article>
        `;
      }).join('');

      this.shadowRoot.innerHTML = `
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link rel="stylesheet" href="${FONT_HREF}">
        <style>${STYLES}</style>
        <section class="shell" aria-label="TraceWorks Wix landing widget">
          <div class="header">
            <div class="brand">Trace<span class="brand-mark">Works™</span></div>
            <div class="header-note">Wix-ready customer shell</div>
          </div>
          <div class="hero">
            <div>
              <div class="eyebrow">Investigative Reports · Property · Probate · Ownership</div>
              <h1>${escapeHtml(this.headline)}</h1>
              <p class="hero-copy">${escapeHtml(this.subhead)}</p>
              <div class="hero-actions">
                <a class="btn btn-primary" href="${intakeUrl}" target="_blank" rel="noopener">Start Secure Intake</a>
                <a class="btn btn-secondary" href="${compareUrl}" target="_blank" rel="noopener">Compare Packages</a>
              </div>
              <div class="signal-row">
                <span class="signal">Structured intake</span>
                <span class="signal">Stripe-backed checkout</span>
                <span class="signal">Workflow-scoped automation</span>
                <span class="signal">Confidence-labeled findings</span>
              </div>
            </div>
            <aside class="hero-panel">
              <div class="panel-label">Launch posture</div>
              <h2 class="panel-title">Premium Wix shell, real TraceWorks runtime.</h2>
              <p class="hero-copy">This widget is designed to live inside Wix Studio while routing customers into the real TraceWorks PWA for checkout, fulfillment, and authenticated delivery.</p>
              <div class="metrics">
                <article class="metric">
                  <span>Packages surfaced</span>
                  <strong>${visiblePackages.length}</strong>
                  <small>from live package data</small>
                </article>
                <article class="metric">
                  <span>Featured paths</span>
                  <strong>${featuredCount}</strong>
                  <small>highest-conversion tiering</small>
                </article>
                <article class="metric">
                  <span>Design direction</span>
                  <strong>Premium</strong>
                  <small>evidence-first presentation</small>
                </article>
                <article class="metric">
                  <span>Enterprise path</span>
                  <strong>Ready</strong>
                  <small><a href="${enterpriseUrl}" target="_blank" rel="noopener">open enterprise flow</a></small>
                </article>
              </div>
            </aside>
          </div>
          <div class="packages">
            <div class="packages-head">
              <div>
                <div class="panel-label">Report tiers</div>
                <h2>TraceWorks packages for a Wix Studio front door</h2>
              </div>
              <p>Customers can browse the offer, then jump directly into your real intake and Stripe-backed purchase flow without duplicating business logic inside Wix.</p>
            </div>
            <div class="packages-grid">${packageCards}</div>
          </div>
          <div class="footer">
            <div><strong>Important:</strong> This Wix element preserves design and package merchandising. The actual TraceWorks backend, Stripe flow, OSINT automation, and delivery pipeline remain in your primary app runtime.</div>
            <a class="btn btn-secondary" href="${compareUrl}" target="_blank" rel="noopener">Open Full App</a>
          </div>
        </section>
      `;
    }
  }

  if (!customElements.get(WIDGET_TAG)) {
    customElements.define(WIDGET_TAG, TraceworksLanding);
  }
})();