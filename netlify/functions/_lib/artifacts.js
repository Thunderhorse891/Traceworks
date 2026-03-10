import { mkdir, writeFile, access } from 'node:fs/promises';
import { join } from 'node:path';
import { dynamicReportToHtml, dynamicReportToText } from './dynamic-report-builder.js';
import { reportTextToPdfBuffer } from './pdf.js';

const ROOT = process.env.REPORT_ARTIFACT_ROOT || '.data/reports';

export async function saveReportArtifacts(report) {
  const dir = join(ROOT, report.orderId);
  await mkdir(dir, { recursive: true });

  const htmlPath = join(dir, 'report.html');
  const textPath = join(dir, 'report.txt');
  const pdfPath = join(dir, 'report.pdf');
  const jsonPath = join(dir, 'workflow-results.json');

  const html = dynamicReportToHtml(report);
  const text = dynamicReportToText(report);

  await writeFile(htmlPath, html);
  await writeFile(textPath, text);
  await writeFile(pdfPath, reportTextToPdfBuffer(text));
  await writeFile(jsonPath, JSON.stringify(report, null, 2));

  return { htmlPath, textPath, pdfPath, jsonPath };
}

export async function assertArtifactExists(path) {
  await access(path);
  return true;
}

export function publicArtifactHint(path) {
  return path;
}
