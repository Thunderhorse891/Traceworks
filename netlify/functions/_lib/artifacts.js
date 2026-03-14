import { mkdir, writeFile, access, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { dynamicReportToHtml, dynamicReportToText } from './dynamic-report-builder.js';
import { reportTextToPdfBuffer } from './pdf.js';
import { getKvClient, makeKvUri, parseKvUri, usesKvStorage } from './storage-runtime.js';

const ARTIFACT_TYPES = {
  html: {
    diskName: 'report.html',
    contentType: 'text/html; charset=utf-8',
    filename: (orderId) => `${orderId}-report.html`,
    fromStoredValue: (value) => ({ body: String(value), isBase64Encoded: false })
  },
  txt: {
    diskName: 'report.txt',
    contentType: 'text/plain; charset=utf-8',
    filename: (orderId) => `${orderId}-report.txt`,
    fromStoredValue: (value) => ({ body: String(value), isBase64Encoded: false })
  },
  pdf: {
    diskName: 'report.pdf',
    contentType: 'application/pdf',
    filename: (orderId) => `${orderId}-report.pdf`,
    fromStoredValue: (value) => ({ body: String(value), isBase64Encoded: true }),
    readDisk: async (path) => ({ body: (await readFile(path)).toString('base64'), isBase64Encoded: true })
  },
  json: {
    diskName: 'workflow-results.json',
    contentType: 'application/json; charset=utf-8',
    filename: (orderId) => `${orderId}-workflow-results.json`,
    fromStoredValue: (value) => ({ body: String(value), isBase64Encoded: false })
  }
};

function artifactRoot() {
  return process.env.REPORT_ARTIFACT_ROOT || '.data/reports';
}

function artifactPrefix() {
  return process.env.REPORT_ARTIFACT_PREFIX || 'traceworks:artifacts';
}

function artifactKey(orderId, kind) {
  return `${artifactPrefix()}:${orderId}:${kind}`;
}

export async function saveReportArtifacts(report) {
  const html = dynamicReportToHtml(report);
  const text = dynamicReportToText(report);
  const pdf = reportTextToPdfBuffer(text);

  if (usesKvStorage()) {
    const kv = await getKvClient();
    const htmlKey = artifactKey(report.orderId, 'html');
    const textKey = artifactKey(report.orderId, 'txt');
    const pdfKey = artifactKey(report.orderId, 'pdf');
    const jsonKey = artifactKey(report.orderId, 'json');

    await kv.set(htmlKey, html);
    await kv.set(textKey, text);
    await kv.set(pdfKey, Buffer.from(pdf).toString('base64'));
    await kv.set(jsonKey, JSON.stringify(report));

    return {
      htmlPath: makeKvUri(htmlKey),
      textPath: makeKvUri(textKey),
      pdfPath: makeKvUri(pdfKey),
      jsonPath: makeKvUri(jsonKey)
    };
  }

  const dir = join(artifactRoot(), report.orderId);
  await mkdir(dir, { recursive: true });

  const htmlPath = join(dir, 'report.html');
  const textPath = join(dir, 'report.txt');
  const pdfPath = join(dir, 'report.pdf');
  const jsonPath = join(dir, 'workflow-results.json');

  await writeFile(htmlPath, html);
  await writeFile(textPath, text);
  await writeFile(pdfPath, pdf);
  await writeFile(jsonPath, JSON.stringify(report, null, 2));

  return { htmlPath, textPath, pdfPath, jsonPath };
}

export async function assertArtifactExists(path) {
  const kvKey = parseKvUri(path);
  if (kvKey) {
    const kv = await getKvClient();
    const value = await kv.get(kvKey);
    if (value == null) throw new Error(`Artifact does not exist: ${path}`);
    return true;
  }

  await access(path);
  return true;
}

export async function readArtifact(orderId, kind = 'html') {
  const spec = ARTIFACT_TYPES[kind];
  if (!spec) {
    throw new Error(`Unsupported artifact format: ${kind}`);
  }

  if (usesKvStorage()) {
    const kv = await getKvClient();
    const value = await kv.get(artifactKey(orderId, kind));
    if (value == null) throw new Error(`Artifact does not exist: ${orderId}/${kind}`);
    return {
      ...spec.fromStoredValue(value),
      contentType: spec.contentType,
      filename: spec.filename(orderId)
    };
  }

  const diskPath = join(artifactRoot(), orderId, spec.diskName);
  const payload = spec.readDisk
    ? await spec.readDisk(diskPath)
    : { body: await readFile(diskPath, 'utf8'), isBase64Encoded: false };

  return {
    ...payload,
    contentType: spec.contentType,
    filename: spec.filename(orderId)
  };
}

export function publicArtifactHint(path) {
  return path;
}
