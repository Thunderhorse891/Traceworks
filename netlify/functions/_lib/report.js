import { getPackage } from "./packages.js";

const FALLBACK = "No directly verifiable hit was returned for this element in the current run. Traceworks inserted a conservative, court-safe next step so the report remains actionable.";

const TIER_BLUEPRINT = {
  locate: {
    dossierName: "Locate Dossier",
    sections: [
      "Subject Identity Snapshot",
      "Current Address Probability Grid",
      "Contact Surface and Phone Trails",
      "Service-of-Process Recommendations"
    ]
  },
  comprehensive: {
    dossierName: "Comprehensive Locate + Asset Dossier",
    sections: [
      "Subject Identity Snapshot",
      "Address + Contact Consolidation",
      "Asset and Property Exposure",
      "Employment / Business Link Analysis",
      "Collection Strategy Recommendations"
    ]
  },
  title: {
    dossierName: "Property & Title Intelligence Dossier",
    sections: [
      "Parcel/Subject Snapshot",
      "Ownership Trail — Who/What/When/Why/How",
      "Lien & Encumbrance Review",
      "Lease / Operator / Royalty Clarity",
      "Title Risk and Curative Actions"
    ]
  },
  heir: {
    dossierName: "Heir & Beneficiary Intelligence Dossier",
    sections: [
      "Decedent/Family Context Snapshot",
      "Heir Candidate Matrix",
      "Probate and Filing Signals",
      "Contactability & Verification Priority",
      "Court-Ready Next Actions"
    ]
  }
};

function nonBlank(value, fallback = FALLBACK) {
  if (value === null || value === undefined) return fallback;
  if (typeof value === "string" && value.trim().length === 0) return fallback;
  if (Array.isArray(value) && value.length === 0) return [fallback];
  return value;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function confidenceFromSources(sources) {
  if (sources.length >= 8) return "High";
  if (sources.length >= 4) return "Medium";
  return "Guarded";
}

function buildOwnershipTrail(sources, subject) {
  return sources.slice(0, 5).map((source, index) => ({
    idx: index + 1,
    who: index === 0 ? `${subject} (Baseline)` : `Related party ${index}`,
    what: index === 0 ? "Initial public-record baseline" : "Transfer / filing / relationship signal",
    when: index === 0 ? "Historical baseline" : "Date requires clerk-level verification",
    how: source.title,
    why: `Corroborated from ${source.sourceType}`
  }));
}

function buildEvidenceMatrix(sources) {
  return sources.slice(0, 10).map((source, idx) => ({
    idx: idx + 1,
    signal: source.title,
    strength: source.confidence,
    domain: source.domain || "unknown",
    provider: source.provider || "provider",
    recommendedFollowUp: "Capture certified copy or timestamped screenshot for filing packet."
  }));
}

function buildRedFlags(report) {
  const flags = [];
  if (report.coverage.providersWithHits <= 1) {
    flags.push("Low provider diversity: consider manual county clerk and PACER-equivalent checks.");
  }
  if (report.coverage.distinctDomains <= 2) {
    flags.push("Low domain diversity: corroborate with at least one government and one court source.");
  }
  if (report.sources.some((s) => s.confidence === "low")) {
    flags.push("Low-confidence sources present: do not rely without documentary verification.");
  }
  if (flags.length === 0) {
    flags.push("No major data-quality red flags detected in this run.");
  }
  return flags;
}

function buildNextActions(report) {
  const escalation = report.confidence === "Guarded"
    ? "Escalation rule: confidence is Guarded, so add manual clerk pull + analyst verification before court submission."
    : `Escalation rule: if confidence is ${report.confidence}, require human analyst review before court submission.`;

  return [
    `Within 24h: verify top ${Math.min(report.sources.length, 3)} citations with direct record pulls.`,
    "Within 48h: prepare affidavit-ready source appendix with hash/timestamp capture.",
    "Before filing/service: confirm identity and address matches against official county records.",
    escalation
  ];
}

export function buildReport({ packageId, customerName, customerEmail, companyName, website, goals, intel, caseRef }) {
  const pkg = getPackage(packageId);
  if (!pkg) throw new Error(`Unknown package: ${packageId}`);

  const blueprint = TIER_BLUEPRINT[pkg.id] ?? TIER_BLUEPRINT.locate;
  const subject = nonBlank(companyName, "Client subject");
  const objective = nonBlank(goals, "Case objective not supplied; report generated with legal OSINT standard assumptions.");
  const sources = intel?.sources?.length
    ? intel.sources
    : [{ title: "Public records index", url: "https://www.usa.gov/state-county-local-governments", sourceType: "fallback", confidence: "medium", domain: "usa.gov" }];

  const coverage = intel?.coverage || {
    totalSources: sources.length,
    distinctDomains: new Set(sources.map((s) => s.domain || "unknown")).size,
    providersWithHits: 1
  };

  const sections = blueprint.sections.map((title, index) => {
    const source = sources[index % sources.length];
    const noDirectHit = source.provider === 'static-fallback' || source.sourceType === 'fallback';
    return {
      title,
      findings: [
        `${title} completed for ${subject}.`,
        `Objective alignment: ${objective}`,
        noDirectHit
          ? `No direct verifiable hit surfaced for this element in this run. Actionable fallback path: ${source.title} (${source.url}).`
          : `Primary corroboration: ${source.title} (${source.url}).`
      ].map((line) => nonBlank(line))
    };
  });

  const report = {
    generatedAt: new Date().toISOString(),
    customerName: nonBlank(customerName, "Valued client"),
    customerEmail: nonBlank(customerEmail, "No customer email captured"),
    caseRef: nonBlank(caseRef, "Pending case reference"),
    package: pkg.name,
    packageId: pkg.id,
    dossierName: blueprint.dossierName,
    website: nonBlank(website, "Website/profile not provided"),
    subject,
    objective,
    confidence: confidenceFromSources(sources),
    providerNote: nonBlank(intel?.providerNote, "OSINT providers returned limited responses; fallback pathways were included."),
    queryPlan: intel?.queryPlan?.length ? intel.queryPlan : [subject],
    coverage,
    sections,
    ownershipTrail: buildOwnershipTrail(sources, subject),
    evidenceMatrix: buildEvidenceMatrix(sources),
    sources,
    disclaimer:
      "This dossier is an investigative research brief for legal/business support and is not legal advice. Verify filing decisions with licensed professionals. No refunds after work starts; one same-scope redo may be provided per policy."
  };

  report.redFlags = buildRedFlags(report);
  report.nextActions48h = buildNextActions(report);
  return report;
}

export function reportToText(report) {
  const lines = [
    "Traceworks Intelligence Dossier",
    `Dossier Type: ${report.dossierName}`,
    `Generated: ${report.generatedAt}`,
    `Case Reference: ${report.caseRef}`,
    `Client: ${report.customerName}`,
    `Subject: ${report.subject}`,
    `Package: ${report.package}`,
    `Confidence: ${report.confidence}`,
    `Coverage: ${report.coverage.providersWithHits} providers / ${report.coverage.distinctDomains} domains / ${report.coverage.totalSources} sources`,
    `Query Plan: ${report.queryPlan.join(" | ")}`,
    "",
    "Case Findings"
  ];

  for (const section of report.sections) {
    lines.push(`\n## ${section.title}`);
    for (const item of section.findings) lines.push(`- ${nonBlank(item)}`);
  }

  lines.push("\nEvidence Matrix");
  for (const e of report.evidenceMatrix) {
    lines.push(`- #${e.idx} ${e.signal} | ${e.strength} | ${e.domain} | ${e.provider} | ${e.recommendedFollowUp}`);
  }

  lines.push("\nRed Flags & Gaps");
  for (const flag of report.redFlags) lines.push(`- ${flag}`);

  lines.push("\nNext 48 Hours Actions");
  for (const action of report.nextActions48h) lines.push(`- ${action}`);

  lines.push("\nOwnership Trail");
  for (const row of report.ownershipTrail) {
    lines.push(`- #${row.idx} | ${row.who} | ${row.what} | ${row.when} | ${row.how} | ${row.why}`);
  }

  lines.push("\nSource Citations");
  for (const source of report.sources) lines.push(`- ${source.title} | ${source.url} | ${source.sourceType} | ${source.confidence}`);

  lines.push("\nDisclaimer");
  lines.push(report.providerNote);
  lines.push(report.disclaimer);
  return lines.join("\n");
}

export function reportToHtml(report) {
  const findings = report.sections
    .map((section) => `<section class="card"><h3>${escapeHtml(section.title)}</h3><ul>${section.findings.map((f) => `<li>${escapeHtml(nonBlank(f))}</li>`).join("")}</ul></section>`)
    .join("");

  const trailRows = report.ownershipTrail
    .map((row) => `<tr><td>${row.idx}</td><td>${escapeHtml(row.who)}</td><td>${escapeHtml(row.what)}</td><td>${escapeHtml(row.when)}</td><td>${escapeHtml(row.how)}</td><td>${escapeHtml(row.why)}</td></tr>`)
    .join("");

  const evidenceRows = report.evidenceMatrix
    .map((e) => `<tr><td>${e.idx}</td><td>${escapeHtml(e.signal)}</td><td>${escapeHtml(e.strength)}</td><td>${escapeHtml(e.domain)}</td><td>${escapeHtml(e.provider)}</td><td>${escapeHtml(e.recommendedFollowUp)}</td></tr>`)
    .join("");

  const citationRows = report.sources
    .map((s, i) => `<tr><td>${i + 1}</td><td>${escapeHtml(s.title)}</td><td><a href="${escapeHtml(s.url)}">${escapeHtml(s.url)}</a></td><td>${escapeHtml(s.sourceType)}</td><td>${escapeHtml(s.confidence)}</td></tr>`)
    .join("");

  const redFlags = report.redFlags.map((f) => `<li>${escapeHtml(f)}</li>`).join("");
  const nextActions = report.nextActions48h.map((a) => `<li>${escapeHtml(a)}</li>`).join("");

  return `<!doctype html><html><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><title>Traceworks Dossier</title>
  <style>
    body{margin:0;background:#060b16;color:#dce4f8;font-family:Inter,Arial,sans-serif}
    .wrap{max-width:1040px;margin:22px auto;background:#0f1729;border:1px solid #2b3552;border-radius:14px;overflow:hidden}
    .hero{padding:26px;background:linear-gradient(120deg,#090d18,#141b2d 60%,#6b5a2a);border-bottom:1px solid #2b3552}
    h1{margin:0;font-size:34px;color:#f4f7ff;font-family:Georgia,serif}.sub{color:#a8b4d6}
    .meta{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:8px;margin-top:14px}
    .pill{background:#121c33;border:1px solid #334268;border-radius:8px;padding:10px}
    .body{padding:20px}
    .card{background:#111a30;border:1px solid #334268;border-radius:10px;padding:14px;margin-bottom:12px}
    .card h3{margin:0 0 8px;color:#f6d273}.card ul{margin:0;padding-left:18px}
    h2{font-size:20px;margin:18px 0 10px;color:#f6d273;font-family:Georgia,serif}
    table{width:100%;border-collapse:collapse;background:#10192e;border:1px solid #334268;margin-bottom:14px}
    th,td{padding:10px;border-bottom:1px solid #273353;text-align:left;font-size:13px;vertical-align:top}th{color:#f6d273}
    a{color:#9ac1ff}
    .disclaimer{margin-top:14px;color:#9bacd1;font-size:12px}
  </style></head><body>
  <article class="wrap"><header class="hero"><h1>${escapeHtml(report.dossierName)}</h1><p class="sub">Traceworks Intelligence Dossier — premium legal OSINT reporting format.</p>
  <div class="meta"><div class="pill"><strong>Case Ref:</strong> ${escapeHtml(report.caseRef)}</div><div class="pill"><strong>Client:</strong> ${escapeHtml(report.customerName)}</div><div class="pill"><strong>Subject:</strong> ${escapeHtml(report.subject)}</div><div class="pill"><strong>Package:</strong> ${escapeHtml(report.package)}</div><div class="pill"><strong>Confidence:</strong> ${escapeHtml(report.confidence)}</div><div class="pill"><strong>Generated:</strong> ${escapeHtml(report.generatedAt)}</div><div class="pill"><strong>Objective:</strong> ${escapeHtml(report.objective)}</div></div></header>
  <div class="body"><section class="card"><h3>OSINT Coverage Summary</h3><ul><li>Providers with hits: ${escapeHtml(report.coverage.providersWithHits)}</li><li>Distinct domains: ${escapeHtml(report.coverage.distinctDomains)}</li><li>Total sources: ${escapeHtml(report.coverage.totalSources)}</li><li>Query plan: ${escapeHtml(report.queryPlan.join(" | "))}</li></ul></section>${findings}
  <h2>Evidence Matrix</h2>
  <table><thead><tr><th>#</th><th>Signal</th><th>Strength</th><th>Domain</th><th>Provider</th><th>Follow-up</th></tr></thead><tbody>${evidenceRows}</tbody></table>
  <h2>Red Flags & Gaps</h2><section class="card"><ul>${redFlags}</ul></section>
  <h2>Next 48 Hours Actions</h2><section class="card"><ul>${nextActions}</ul></section>
  <h2>Ownership Trail — Who / What / When / How / Why</h2>
  <table><thead><tr><th>#</th><th>Who</th><th>What Happened</th><th>When</th><th>Instrument / Mechanism</th><th>Why / Context</th></tr></thead><tbody>${trailRows}</tbody></table>
  <h2>Source Citations</h2>
  <table><thead><tr><th>#</th><th>Source</th><th>URL</th><th>Type</th><th>Confidence</th></tr></thead><tbody>${citationRows}</tbody></table>
  <p class="disclaimer">${escapeHtml(report.providerNote)}<br/>${escapeHtml(report.disclaimer)}</p></div></article>
  </body></html>`;
}
