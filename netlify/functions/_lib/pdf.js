function escapePdfText(input) {
  return String(input || '')
    .replaceAll('\\', '\\\\')
    .replaceAll('(', '\\(')
    .replaceAll(')', '\\)')
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, '?');
}

export function reportTextToPdfBuffer(text) {
  const lines = String(text || '')
    .split(/\r?\n/)
    .flatMap((line) => {
      const chunks = [];
      let rest = line;
      while (rest.length > 100) {
        chunks.push(rest.slice(0, 100));
        rest = rest.slice(100);
      }
      chunks.push(rest);
      return chunks;
    })
    .slice(0, 300);

  const contentLines = ['BT', '/F1 10 Tf', '50 790 Td', '12 TL'];
  for (const line of lines) {
    contentLines.push(`(${escapePdfText(line)}) Tj`);
    contentLines.push('T*');
  }
  contentLines.push('ET');
  const stream = contentLines.join('\n');

  const objects = [];
  const addObj = (str) => {
    objects.push(str);
    return objects.length;
  };

  const catalogId = addObj('<< /Type /Catalog /Pages 2 0 R >>');
  const pagesId = addObj('<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
  const pageId = addObj('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>');
  const fontId = addObj('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  const contentId = addObj(`<< /Length ${Buffer.byteLength(stream, 'utf8')} >>\nstream\n${stream}\nendstream`);

  void catalogId; void pagesId; void pageId; void fontId; void contentId;

  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  for (let i = 0; i < objects.length; i += 1) {
    offsets.push(Buffer.byteLength(pdf, 'utf8'));
    pdf += `${i + 1} 0 obj\n${objects[i]}\nendobj\n`;
  }

  const xrefStart = Buffer.byteLength(pdf, 'utf8');
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += '0000000000 65535 f \n';
  for (let i = 1; i <= objects.length; i += 1) {
    pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }

  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;
  return Buffer.from(pdf, 'utf8');
}
