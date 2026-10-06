/*
  Builds a small, valid one-page PDF. The development seed uses it to
  give each sample candidate a placeholder resume, so the private
  document flow (store, permission check, signed link) can be tried
  locally. The content states that it is a sample.
*/
export function samplePdf(lines) {
  const escape = (text) => String(text).replace(/[\\()]/g, '\\$&').replace(/[^\x20-\x7e]/g, '?');
  const content = ['BT', '/F1 12 Tf', '72 760 Td', '16 TL']
    .concat(lines.map((line) => `(${escape(line)}) Tj T*`))
    .concat(['ET'])
    .join('\n');
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  let pdf = '%PDF-1.4\n';
  const offsets = [];
  objects.forEach((body, index) => {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${index + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xrefAt = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.forEach((offset) => { pdf += `${String(offset).padStart(10, '0')} 00000 n \n`; });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefAt}\n%%EOF\n`;
  return Buffer.from(pdf, 'latin1');
}
