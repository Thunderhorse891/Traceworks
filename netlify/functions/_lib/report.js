import { getPackage } from "./packages.js";

const TIER_BLUEPRINT = {
  standard: {
    dossierName: "Standard Property Snapshot",
    sections: [
      "County Appraisal District Lookup",
      "Tax Collector / Assessment Record",
      "Parcel GIS Lookup",
      "Source Trace Panel"
    ]
  },
  ownership_encumbrance: {
    dossierName: "Ownership & Encumbrance Intelligence Report",
    sections: [
      "County Appraisal District Lookup",
      "County Clerk Deed Index",
      "Grantor-Grantee Index",
      "Mortgage / Trust Deed Index",
      "Chain-of-Title Continuity Analysis"
    ]
  },
  probate_heirship: {
    dossierName: "Probate & Heirship Investigation Report",
    sections: [
      "Obituary Index Cross-Reference",
      "Probate Case Index Lookup",
      "People Association Lookup",
      "Heir Candidate Matrix"
    ]
  },
  asset_network: {
    dossierName: "Asset & Property Network Report",
    sections: [
      "County Appraisal District Lookup",
      "Tax Collector / Assessment Record",
      "Parcel GIS Lookup",
      "County Clerk Deed Index",
      "Grantor-Grantee Index",
      "Chain-of-Title Continuity Analysis"
    ]
  },
  comprehensive: {
    dossierName: "Comprehensive Investigative Report",
    sections: [
      "County Appraisal District Lookup",
      "Tax Collector / Assessment Record",
      "County Clerk Deed Index",
      "Grantor-Grantee Index",
      "Mortgage / Trust Deed Index",
      "Chain-of-Title Continuity Analysis",
      "Obituary Index Cross-Reference",
      "Probate Case Index Lookup",
      "People Association Lookup",
      "Heir Candidate Matrix",
      "Cross-Source Discrepancy Analysis",
      "Confidence Matrix",
      "Recommended Next Steps",
      "Source Trace Panel"
    ]
  }
};

function nonBlank(value, fallback = "") {
  if (value === null || value === undefined) return fallback;
  if (typeof value === "string" && value.trim().length === 0) return fallback;
  if (Array.isArray(value) && value.length === 0) return Array.isArray(fallback) ? fallback : [];
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
  if (sources.length === 0) return "Unverified";
  if (sources.length >= 8) return "High";
  if (sources.length >= 4) return "Medium";
  return "Guarded";
}

function buildOwnershipTrail(sources, subject) {
  return sources.slice(0, 5).map((source, index) => ({
    idx: index + 1,
    who: subject,
    what: "Cited source lead returned in this run",
    when: "Direct source pull required for date certainty",
    how: source.title,
    why: `Observed via ${source.provider || "provider"} (${source.sourceType})`
  }));
}

function buildEvidenceMatrix(sources) {
  return sources.slice(0, 10).map((source, idx) => ({
    idx: idx + 1,
    signal: source.title,
    strength: source.confidence,
    domain: source.domain || "unknown",
    provider: source.provider || "provider",
    recommendedFollowUp: "Capture the first-party source or screenshot before relying on this lead."
  }));
}

function buildRedFlags(report) {
  const flags = [];
  if (report.coverage.totalSources === 0) {
    flags.push("No cited OSINT sources were returned in this run. Treat every section as unverified until manual follow-up is completed.");
  }
  if (report.coverage.providersWithHits <= 1) {
    flags.push("Low provider diversity: corroborate with direct county, court, or registry pulls.");
  }
  if (report.coverage.distinctDomains <= 2 && report.coverage.totalSources > 0) {
    flags.push("Low domain diversity: corroborate with at least one government and one court or registry source.");
  }
  if (report.sources.some((source) => source.confidence === "low")) {
    flags.push("Low-confidence sources are present and should not be treated as verified without documentary follow-up.");
  }
  if (flags.length === 0) {
    flags.push("No major data-quality red flags detected in the cited source set.");
  }
  return flags;
}

function buildNextActions(report) {
  if (report.coverage.totalSources === 0) {
    return [
      "No cited OSINT hits returned. Start with direct county property, recorder, probate, or entity searches for the requested scope.",
      "Capture first-party source URLs or screenshots before generating any outward-facing deliverable.",
      "Do not treat uncovered sections as cleared; they remain unverified.",
      "Require human analyst review before legal or operational use."
    ];
  }

  const escalation = report.confidence === "Guarded"
    ? "Escalation rule: confidence is Guarded, so add manual clerk pull and analyst verification before court submission."
    : `Escalation rule: if confidence is ${report.confidence}, require human analyst review before court submission.`;

  return [
    `Within 24h: verify top ${Math.min(report.sources.length, 3)} citations with direct first-party source pulls.`,
    "Within 48h: prepare a source appendix with timestamps or screenshots for the strongest leads.",
    "Before filing or outreach: confirm identity and address matches against official county or court records.",
    escalation
  ];
}

export function buildReport({ packageId, customerName, customerEmail, companyName, website, goals, intel, caseRef }) {
  const pkg = getPackage(packageId);
  if (!pkg) throw new Error(`Unknown package: ${packageId}`);

  const blueprint = TIER_BLUEPRINT[pkg.id] ?? TIER_BLUEPRINT.standard;
  const subject = nonBlank(companyName, "Client subject");
  const objective = nonBlank(goals, "Case objective not supplied; report generated against the requested scope only.");
  const sources = Array.isArray(intel?.sources) ? intel.sources.filter(Boolean) : [];

  const coverage = intel?.coverage || {
    totalSources: sources.length,
    distinctDomains: new Set(sources.map((source) => source.domain || "unknown")).size,
    providersWithHits: new Set(sources.map((source) => source.provider).filter(Boolean)).size
  };

  const defaultProviderNote = sources.length
    ? "Only the cited sources below were returned in this run. Uncovered sections remain unverified and require manual follow-up."
    : "No cited OSINT sources were returned in this run. Report sections describe requested scope only and do not imply verified findings.";

  const sections = blueprint.sections.map((title, index) => {
    const source = sources[index] || null;
    return {
      title,
      findings: source
        ? [
            `${title} returned at least one cited lead for ${subject}.`,
            `Objective alignment: ${objective}`,
            `Primary corroboration: ${source.title} (${source.url}).`
          ].map((line) => nonBlank(line))
        : [
            `${title} did not return a cited source hit for ${subject} in this run.`,
            `Objective alignment: ${objective}`,
            "Manual follow-up is required before treating this section as verified."
          ]
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
    providerNote: nonBlank(intel?.providerNote, defaultProviderNote),
    queryPlan: intel?.queryPlan?.length ? intel.queryPlan : [subject],
    coverage,
    sections,
    ownershipTrail: buildOwnershipTrail(sources, subject),
    evidenceMatrix: buildEvidenceMatrix(sources),
    sources,
    disclaimer:
      "This dossier is an investigative research brief for legal and business support and is not legal advice. Verify filing, service, and outreach decisions with licensed professionals."
  };

  report.redFlags = buildRedFlags(report);
  report.nextActions48h = buildNextActions(report);
  return report;
}

export function reportToText(report) {
  const lines = [
    "TraceWorks Investigative Report",
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
  if (!report.evidenceMatrix.length) {
    lines.push("- No cited sources were returned in this run.");
  } else {
    for (const evidence of report.evidenceMatrix) {
      lines.push(`- #${evidence.idx} ${evidence.signal} | ${evidence.strength} | ${evidence.domain} | ${evidence.provider} | ${evidence.recommendedFollowUp}`);
    }
  }

  lines.push("\nRed Flags & Gaps");
  for (const flag of report.redFlags) lines.push(`- ${flag}`);

  lines.push("\nNext 48 Hours Actions");
  for (const action of report.nextActions48h) lines.push(`- ${action}`);

  lines.push("\nOwnership Trail");
  if (!report.ownershipTrail.length) {
    lines.push("- No ownership-trail citations were returned in this run.");
  } else {
    for (const row of report.ownershipTrail) {
      lines.push(`- #${row.idx} | ${row.who} | ${row.what} | ${row.when} | ${row.how} | ${row.why}`);
    }
  }

  lines.push("\nSource Citations");
  if (!report.sources.length) {
    lines.push("- No cited sources were returned in this run.");
  } else {
    for (const source of report.sources) lines.push(`- ${source.title} | ${source.url} | ${source.sourceType} | ${source.confidence}`);
  }

  lines.push("\nDisclaimer");
  lines.push(report.providerNote);
  lines.push(report.disclaimer);
  return lines.join("\n");
}

export function reportToHtml(report) {
  const findings = report.sections
    .map((section) => `<section class="card"><h3>${escapeHtml(section.title)}</h3><ul>${section.findings.map((finding) => `<li>${escapeHtml(nonBlank(finding))}</li>`).join("")}</ul></section>`)
    .join("");

  const trailRows = report.ownershipTrail
    .map((row) => `<tr><td>${row.idx}</td><td>${escapeHtml(row.who)}</td><td>${escapeHtml(row.what)}</td><td>${escapeHtml(row.when)}</td><td>${escapeHtml(row.how)}</td><td>${escapeHtml(row.why)}</td></tr>`)
    .join("");

  const evidenceRows = report.evidenceMatrix
    .map((evidence) => `<tr><td>${evidence.idx}</td><td>${escapeHtml(evidence.signal)}</td><td>${escapeHtml(evidence.strength)}</td><td>${escapeHtml(evidence.domain)}</td><td>${escapeHtml(evidence.provider)}</td><td>${escapeHtml(evidence.recommendedFollowUp)}</td></tr>`)
    .join("");

  const citationRows = report.sources
    .map((source, index) => `<tr><td>${index + 1}</td><td>${escapeHtml(source.title)}</td><td><a href="${escapeHtml(source.url)}">${escapeHtml(source.url)}</a></td><td>${escapeHtml(source.sourceType)}</td><td>${escapeHtml(source.confidence)}</td></tr>`)
    .join("");

  const redFlags = report.redFlags.map((flag) => `<li>${escapeHtml(flag)}</li>`).join("");
  const nextActions = report.nextActions48h.map((action) => `<li>${escapeHtml(action)}</li>`).join("");

  return `<!doctype html><html><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><title>TraceWorks Investigative Report</title>
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
    .empty{padding:12px;border:1px solid #334268;border-radius:10px;background:#10192e;color:#9bacd1}
    .disclaimer{margin-top:14px;color:#9bacd1;font-size:12px}
  </style></head><body>
  <article class="wrap"><header class="hero"><h1>${escapeHtml(report.dossierName)}</h1><p class="sub">TraceWorks investigative report based only on the cited sources returned in this run.</p>
  <div class="meta"><div class="pill"><strong>Case Ref:</strong> ${escapeHtml(report.caseRef)}</div><div class="pill"><strong>Client:</strong> ${escapeHtml(report.customerName)}</div><div class="pill"><strong>Subject:</strong> ${escapeHtml(report.subject)}</div><div class="pill"><strong>Package:</strong> ${escapeHtml(report.package)}</div><div class="pill"><strong>Confidence:</strong> ${escapeHtml(report.confidence)}</div><div class="pill"><strong>Generated:</strong> ${escapeHtml(report.generatedAt)}</div><div class="pill"><strong>Objective:</strong> ${escapeHtml(report.objective)}</div></div></header>
  <div class="body"><section class="card"><h3>OSINT Coverage Summary</h3><ul><li>Providers with hits: ${escapeHtml(report.coverage.providersWithHits)}</li><li>Distinct domains: ${escapeHtml(report.coverage.distinctDomains)}</li><li>Total sources: ${escapeHtml(report.coverage.totalSources)}</li><li>Query plan: ${escapeHtml(report.queryPlan.join(" | "))}</li></ul></section>${findings}
  <h2>Evidence Matrix</h2>
  ${report.evidenceMatrix.length ? `<table><thead><tr><th>#</th><th>Signal</th><th>Strength</th><th>Domain</th><th>Provider</th><th>Follow-up</th></tr></thead><tbody>${evidenceRows}</tbody></table>` : '<div class="empty">No cited sources were returned in this run.</div>'}
  <h2>Red Flags & Gaps</h2><section class="card"><ul>${redFlags}</ul></section>
  <h2>Next 48 Hours Actions</h2><section class="card"><ul>${nextActions}</ul></section>
  <h2>Ownership Trail — Who / What / When / How / Why</h2>
  ${report.ownershipTrail.length ? `<table><thead><tr><th>#</th><th>Who</th><th>What Happened</th><th>When</th><th>Instrument / Mechanism</th><th>Why / Context</th></tr></thead><tbody>${trailRows}</tbody></table>` : '<div class="empty">No ownership-trail citations were returned in this run.</div>'}
  <h2>Source Citations</h2>
  ${report.sources.length ? `<table><thead><tr><th>#</th><th>Source</th><th>URL</th><th>Type</th><th>Confidence</th></tr></thead><tbody>${citationRows}</tbody></table>` : '<div class="empty">No cited sources were returned in this run.</div>'}
  <p class="disclaimer">${escapeHtml(report.providerNote)}<br/>${escapeHtml(report.disclaimer)}</p></div></article>
  </body></html>`;
}
