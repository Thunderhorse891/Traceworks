import { mkdir, writeFile, access } from 'node:fs/promises';
import { join } from 'node:path';
import { dynamicReportToHtml, dynamicReportToText } from './dynamic-report-builder.js';

const ROOT = process.env.REPORT_ARTIFACT_ROOT || '.data/reports';

export async function saveReportArtifacts(report) {
  const dir = join(ROOT, report.orderId);
  await mkdir(dir, { recursive: true });

  const htmlPath = join(dir, 'report.html');
  const textPath = join(dir, 'report.txt');
  const jsonPath = join(dir, 'workflow-results.json');

  await writeFile(htmlPath, dynamicReportToHtml(report));
  await writeFile(textPath, dynamicReportToText(report));
  await writeFile(jsonPath, JSON.stringify(report, null, 2));

  return { htmlPath, textPath, jsonPath };
}

export async function assertArtifactExists(path) {
  await access(path);
  return true;
}

export function publicArtifactHint(path) {
  return path;
}
