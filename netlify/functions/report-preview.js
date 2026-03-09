import { buildReport, reportToHtml } from "./_lib/report.js";
import { gatherOsint } from "./_lib/osint.js";

export default async (event) => {
  const params = new URLSearchParams(event.queryStringParameters || {});
  const companyName = params.get("companyName") || "Sample Subject";
  const website = params.get("website") || "https://example.com";
  const goals = params.get("goals") || "Locate current contact channels and court-service viable addresses.";
  const intel = await gatherOsint(`${companyName} ${website} ${goals}`, { packageId: params.get("packageId") || "comprehensive" });

  const report = buildReport({
    caseRef: params.get("caseRef") || "TW-PREVIEW-0001",
    packageId: params.get("packageId") || "comprehensive",
    customerName: params.get("customerName") || "Sample Law Office",
    customerEmail: params.get("customerEmail") || "client@example.com",
    companyName,
    website,
    goals,
    intel
  });

  return {
    statusCode: 200,
    headers: { "content-type": "text/html; charset=utf-8" },
    body: reportToHtml(report)
  };
};
