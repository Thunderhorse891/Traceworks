import { mkdir, writeFile, access } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { reportToHtml, reportToText } from './report.js';

const ROOT = process.env.REPORT_ARTIFACT_ROOT || '.data/reports';

export async function saveReportArtifacts(report) {
  const dir = join(ROOT, report.caseRef);
  await mkdir(dir, { recursive: true });

  const htmlPath = join(dir, 'report.html');
  const textPath = join(dir, 'report.txt');
  const jsonPath = join(dir, 'evidence.json');

  await writeFile(htmlPath, reportToHtml(report));
  await writeFile(textPath, reportToText(report));
  await writeFile(jsonPath, JSON.stringify({
    caseRef: report.caseRef,
    packageId: report.packageId,
    generatedAt: report.generatedAt,
    queryPlan: report.queryPlan,
    coverage: report.coverage,
    providerNote: report.providerNote,
    sources: report.sources,
    evidenceMatrix: report.evidenceMatrix
  }, null, 2));

  return { htmlPath, textPath, jsonPath };
}

export async function assertArtifactExists(path) {
  await access(path);
  return true;
}

export function publicArtifactHint(path) {
  return path;
}
