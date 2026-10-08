import { test } from 'node:test';
import assert from 'node:assert/strict';

/*
  Resume text extraction (services/resume/textExtractor.js) and the
  storage read it relies on. No database and no network: the documents
  are built here, the stored file is in the in-memory store, and the B2
  driver is given a stand-in for the AWS SDK.
*/
process.env.NODE_ENV = 'test';
process.env.SESSION_SECRET = 'test-only-session-secret-0123456789-abcdefghij';
// Warnings are written, so the test below can check that no resume
// text ever reaches the log.
process.env.LOG_LEVEL = 'warn';

const { extractTextFromBuffer, extractResumeText, normaliseText } = await import('../src/services/resume/textExtractor.js');
const { RESUME_EXTRACTION_LIMITS } = await import('../src/config/constants.js');
const { storePrivateFile } = await import('../src/services/storage/privateFiles.js');
const { createB2Driver } = await import('../src/services/storage/drivers/b2.js');
const { samplePdf } = await import('../src/seed/samplePdf.js');
const { pngBytes, docBytes, zipBytes } = await import('./helpers.js');

// ---- building real documents ----

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

// A zip with stored (uncompressed) entries and their real contents.
// `declare` can overstate an entry's unpacked size in the index, and
// `deflated` marks an entry as compressed without compressing it.
function zipWith(entries, { declare = {}, deflated = [] } = {}) {
  const locals = [];
  const central = [];
  let offset = 0;
  for (const [name, content] of Object.entries(entries)) {
    const nameBytes = Buffer.from(name);
    const data = Buffer.from(content);
    const crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    if (deflated.includes(name)) local.writeUInt16LE(8, 8);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBytes.length, 26);
    const entry = Buffer.alloc(46);
    entry.writeUInt32LE(0x02014b50, 0);
    entry.writeUInt16LE(20, 4);
    entry.writeUInt16LE(20, 6);
    if (deflated.includes(name)) entry.writeUInt16LE(8, 10);
    entry.writeUInt32LE(crc, 16);
    entry.writeUInt32LE(data.length, 20);
    entry.writeUInt32LE(declare[name] ?? data.length, 24);
    entry.writeUInt16LE(nameBytes.length, 28);
    entry.writeUInt32LE(offset, 42);
    locals.push(local, nameBytes, data);
    central.push(entry, nameBytes);
    offset += local.length + nameBytes.length + data.length;
  }
  const directory = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(central.length / 2, 8);
  end.writeUInt16LE(central.length / 2, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, directory, end]);
}

const escapeXml = (text) => String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// A minimal real .docx: one paragraph per line.
function docx(paragraphs, { documentXml, declare, deflated } = {}) {
  const body = paragraphs.map((text) => `<w:p><w:r><w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r></w:p>`).join('');
  return zipWith({
    '[Content_Types].xml': '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
    '_rels/.rels': '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
    'word/document.xml': documentXml ?? `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}</w:body></w:document>`,
  }, { declare, deflated });
}

// A PDF with one page per list of lines. Text placed below the bottom
// of a page is not part of it, so long text needs several pages.
function multiPagePdf(pages) {
  const escape = (text) => String(text).replace(/[\\()]/g, '\\$&');
  const objects = ['<< /Type /Catalog /Pages 2 0 R >>', null, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'];
  const kids = [];
  for (const lines of pages) {
    const content = ['BT', '/F1 10 Tf', '40 780 Td', '14 TL', ...lines.map((line) => `(${escape(line)}) Tj T*`), 'ET'].join('\n');
    objects.push(`<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`);
    const contentRef = objects.length;
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents ${contentRef} 0 R /Resources << /Font << /F1 3 0 R >> >> >>`);
    kids.push(`${objects.length} 0 R`);
  }
  objects[1] = `<< /Type /Pages /Kids [${kids.join(' ')}] /Count ${kids.length} >>`;
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

// `count` lines of about 75 characters, `perPage` to a page.
function longResumePages(count, perPage = 50) {
  const lines = Array.from({ length: count }, (_, n) => `Line ${String(n).padStart(3, '0')} SystemVerilog UVM assertions coverage closure regression debug`);
  const pages = [];
  for (let i = 0; i < lines.length; i += perPage) pages.push(lines.slice(i, i + perPage));
  return pages;
}

const RESUME_LINES = [
  'Asha Verma',
  'Design Verification Engineer',
  'Bengaluru, India',
  'Skills: SystemVerilog, UVM, Python, Functional Coverage',
  'Experience: Senior Verification Engineer, Example Silicon, 2019 - 2024',
  'Education: B.Tech Electronics and Communication, 2015',
];

// Captures what the logger writes while `work` runs.
async function captureLog(work) {
  const lines = [];
  const out = process.stdout.write;
  const err = process.stderr.write;
  process.stdout.write = (chunk, ...rest) => { lines.push(String(chunk)); return out.call(process.stdout, chunk, ...rest); };
  process.stderr.write = (chunk, ...rest) => { lines.push(String(chunk)); return err.call(process.stderr, chunk, ...rest); };
  try {
    await work();
  } finally {
    process.stdout.write = out;
    process.stderr.write = err;
  }
  return lines.join('');
}

// ---- valid documents ----

test('resume extraction: the text of a valid PDF is read', async () => {
  const outcome = await extractTextFromBuffer(samplePdf(RESUME_LINES));
  assert.equal(outcome.status, 'EXTRACTED');
  assert.equal(outcome.ok, true);
  assert.equal(outcome.type, 'pdf');
  assert.equal(outcome.extractor, 'pdfjs-dist');
  assert.equal(outcome.pages, 1);
  assert.equal(outcome.pagesRead, 1);
  assert.equal(outcome.truncated, false);
  for (const line of RESUME_LINES) assert.ok(outcome.text.includes(line), `"${line}" is in the text`);
  assert.deepEqual(outcome.text.split('\n').filter(Boolean), RESUME_LINES, 'one line of text per line of the page, in order');
  assert.equal(outcome.characters, outcome.text.length);
  assert.ok(outcome.words > 20);
  assert.ok(outcome.durationMs >= 0);
});

test('resume extraction: the text of a valid DOCX is read', async () => {
  const outcome = await extractTextFromBuffer(docx(RESUME_LINES));
  assert.equal(outcome.status, 'EXTRACTED');
  assert.equal(outcome.type, 'docx');
  assert.equal(outcome.extractor, 'mammoth');
  assert.equal(outcome.pages, null, 'a DOCX has no pages to count');
  for (const line of RESUME_LINES) assert.ok(outcome.text.includes(line), `"${line}" is in the text`);
  assert.deepEqual(outcome.text.split('\n').filter(Boolean), RESUME_LINES, 'one paragraph per line, in order');
});

test('resume extraction: the text is normalised', () => {
  assert.equal(normaliseText('  Veriﬁcation  Engineer \r\n\r\n\r\n\r\nUVM​  '), 'Verification Engineer\n\nUVM');
  assert.equal(normaliseText('A\u0000B\tC'), 'AB C');
  assert.equal(normaliseText(null), '');
});

// ---- what is not read ----

test('resume extraction: a file that is not a PDF or a DOCX is not read', async () => {
  const legacy = await extractTextFromBuffer(docBytes());
  assert.equal(legacy.status, 'UNSUPPORTED');
  assert.equal(legacy.type, 'doc');
  assert.deepEqual(legacy.warnings, ['LEGACY_DOC'], 'a legacy Word file is named as such');
  assert.equal(legacy.text, '');

  for (const buffer of [pngBytes(), Buffer.from('Plain text resume. SystemVerilog, UVM, Python, Perl and more text here.'), zipBytes(['payload.js', 'readme.txt'])]) {
    const outcome = await extractTextFromBuffer(buffer);
    assert.equal(outcome.status, 'UNSUPPORTED');
    assert.equal(outcome.ok, false);
    assert.equal(outcome.text, '');
    assert.equal(outcome.extractor, null);
  }
});

test('resume extraction: a malformed file ends as MALFORMED and nothing of it is logged', async () => {
  const secret = 'ConfidentialResumeMarker';
  // A PDF header and end marker around content that is not a PDF.
  const brokenPdf = Buffer.from(`%PDF-1.4\n${secret} this is not a PDF body at all ${'x'.repeat(200)}\n%%EOF\n`, 'latin1');
  // A DOCX whose document part is marked as compressed but holds bytes
  // that are not compressed data (0xFF starts an invalid deflate block).
  const brokenDocx = docx([], { documentXml: Buffer.alloc(64, 0xff), deflated: ['word/document.xml'] });
  let outcomes;
  const log = await captureLog(async () => {
    outcomes = [await extractTextFromBuffer(brokenPdf), await extractTextFromBuffer(brokenDocx)];
  });
  assert.equal(outcomes[0].type, 'pdf');
  assert.equal(outcomes[0].status, 'MALFORMED');
  assert.equal(outcomes[1].type, 'docx');
  assert.equal(outcomes[1].status, 'MALFORMED');
  for (const outcome of outcomes) {
    assert.equal(outcome.ok, false);
    assert.equal(outcome.text, '');
    assert.ok(outcome.reason);
  }
  assert.ok(log.includes('resume.extraction_failed'), 'the failure is logged');
  assert.ok(!log.includes(secret), 'no content of the file is logged');
});

// ---- limits ----

test('resume extraction: the text is cut to the text limit', async () => {
  // About 37,500 characters on ten pages: more than the default limit.
  const outcome = await extractTextFromBuffer(multiPagePdf(longResumePages(500)));
  assert.equal(outcome.status, 'EXTRACTED');
  assert.equal(outcome.pages, 10);
  assert.equal(outcome.truncated, true);
  assert.ok(outcome.warnings.includes('TEXT_TRUNCATED'));
  assert.ok(outcome.characters <= RESUME_EXTRACTION_LIMITS.maxTextChars);
  assert.ok(outcome.characters > RESUME_EXTRACTION_LIMITS.maxTextChars - 200, 'cut near the limit, at a word boundary');
  assert.ok(outcome.text.startsWith('Line 000'));
  assert.ok(!outcome.text.includes('Line 499'));

  const small = await extractTextFromBuffer(docx(RESUME_LINES), { limits: { maxTextChars: 60 } });
  assert.equal(small.truncated, true);
  assert.ok(small.characters <= 60);
  assert.ok(small.text.startsWith('Asha Verma'));
});

test('resume extraction: file, unpacked-size, page and time limits', async () => {
  const pdf = samplePdf(RESUME_LINES);
  const big = await extractTextFromBuffer(pdf, { limits: { maxFileBytes: pdf.length - 1 } });
  assert.equal(big.status, 'TOO_LARGE');

  // A DOCX whose index declares a very large unpacked document is
  // refused before it is unpacked.
  const bomb = docx(RESUME_LINES, { declare: { 'word/document.xml': 500 * 1024 * 1024 } });
  assert.equal((await extractTextFromBuffer(bomb)).status, 'TOO_LARGE');
  assert.equal((await extractTextFromBuffer(docx(RESUME_LINES), { limits: { maxDocxEntries: 2 } })).status, 'TOO_LARGE');

  // Pages over the page limit are not read, and the result says so.
  const threePages = await extractTextFromBuffer(multiPagePdf(longResumePages(150)), { limits: { maxPages: 2 } });
  assert.equal(threePages.status, 'EXTRACTED');
  assert.equal(threePages.pages, 3);
  assert.equal(threePages.pagesRead, 2);
  assert.equal(threePages.truncated, true);
  assert.deepEqual(threePages.warnings, ['PAGES_NOT_READ']);
  assert.ok(threePages.text.includes('Line 099'));
  assert.ok(!threePages.text.includes('Line 100'), 'the third page is not read');

  const noPages = await extractTextFromBuffer(pdf, { limits: { maxPages: 0 } });
  assert.equal(noPages.status, 'NO_TEXT');
  assert.equal(noPages.pages, 1);
  assert.equal(noPages.pagesRead, 0);
  assert.deepEqual(noPages.warnings, ['PAGES_NOT_READ']);

  const late = await extractTextFromBuffer(pdf, { limits: { timeoutMs: 0 } });
  assert.equal(late.status, 'TIMEOUT');
  assert.equal(late.text, '');
});

// ---- no text ----

test('resume extraction: an empty file or a document with no text ends as NO_TEXT', async () => {
  const empty = await extractTextFromBuffer(Buffer.alloc(0));
  assert.equal(empty.status, 'NO_TEXT');
  assert.deepEqual(empty.warnings, ['EMPTY_FILE']);

  // A page with no text on it, as a scanned resume has.
  const blankPdf = await extractTextFromBuffer(samplePdf([]));
  assert.equal(blankPdf.status, 'NO_TEXT');
  assert.equal(blankPdf.type, 'pdf');
  assert.equal(blankPdf.pages, 1);
  assert.equal(blankPdf.text, '');
  assert.match(blankPdf.reason, /scanned/);

  const blankDocx = await extractTextFromBuffer(docx(['', ' ']));
  assert.equal(blankDocx.status, 'NO_TEXT');
  assert.equal(blankDocx.type, 'docx');

  // A few characters are not a resume.
  assert.equal((await extractTextFromBuffer(docx(['Page 1']))).status, 'NO_TEXT');
});

// ---- the stored file ----

test('resume extraction: a stored resume is read from the active store', async () => {
  const buffer = docx(RESUME_LINES);
  const inspection = { ok: true, type: 'docx', mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', extension: 'docx' };
  const stored = await storePrivateFile({ buffer, originalName: 'resume.docx', inspection, folder: 'resumes' });
  assert.equal(stored.storage, 'memory');

  const outcome = await extractResumeText(stored);
  assert.equal(outcome.status, 'EXTRACTED');
  assert.ok(outcome.text.includes('SystemVerilog'));

  // A file that is over the limit is not read.
  assert.equal((await extractResumeText(stored, { limits: { maxFileBytes: 10 } })).status, 'TOO_LARGE');
  // No file, a file no longer stored, a store this server cannot reach.
  assert.equal((await extractResumeText(null)).status, 'UNAVAILABLE');
  assert.equal((await extractResumeText({ ...stored, key: 'resumes/2026/01/missing.docx' })).status, 'UNAVAILABLE');
  assert.equal((await extractResumeText({ ...stored, storage: 'r2' })).status, 'UNAVAILABLE');
  // A read that fails for another reason is reported, not thrown.
  const failing = async () => { throw new Error('connection reset'); };
  assert.equal((await extractResumeText(stored, { read: failing })).status, 'UNAVAILABLE');
});

// ---- the B2 driver ----

function fakeSdk(answer) {
  const sent = [];
  class Command { constructor(input) { this.input = input; } }
  class GetObjectCommand extends Command {}
  class S3Client {
    constructor(config) { this.config = config; }
    async send(command) {
      sent.push(command);
      return answer(command);
    }
  }
  return { sent, sdk: { S3Client, GetObjectCommand, PutObjectCommand: Command, DeleteObjectCommand: Command, ListObjectVersionsCommand: Command, getSignedUrl: async () => '' } };
}

async function* chunks(...parts) {
  for (const part of parts) yield Buffer.from(part);
}

test('b2 driver: an object is read back for server-side work, within a size limit', async () => {
  const { sent, sdk } = fakeSdk(() => ({ ContentLength: 11, Body: chunks('hello ', 'world') }));
  const driver = await createB2Driver(sdk);
  const bytes = await driver.read('resumes/2026/01/a.pdf', { maxBytes: 100 });
  assert.equal(bytes.toString(), 'hello world');
  assert.equal(sent.length, 1);
  assert.ok(sent[0] instanceof sdk.GetObjectCommand);
  assert.equal(sent[0].input.Key, 'resumes/2026/01/a.pdf');
  assert.deepEqual(Object.keys(sent[0].input).sort(), ['Bucket', 'Key']);

  // Larger than allowed, by the stated length or by what arrives.
  const stated = await createB2Driver(fakeSdk(() => ({ ContentLength: 500, Body: chunks('x') })).sdk);
  await assert.rejects(stated.read('k', { maxBytes: 100 }), { code: 'OBJECT_TOO_LARGE' });
  const streamed = await createB2Driver(fakeSdk(() => ({ Body: chunks('x'.repeat(60), 'x'.repeat(60)) })).sdk);
  await assert.rejects(streamed.read('k', { maxBytes: 100 }), { code: 'OBJECT_TOO_LARGE' });

  // A body the SDK offers as a byte array.
  const array = await createB2Driver(fakeSdk(() => ({ Body: { transformToByteArray: async () => new Uint8Array([65, 66]) } })).sdk);
  assert.equal((await array.read('k')).toString(), 'AB');

  // A key the bucket does not hold.
  const missing = await createB2Driver(fakeSdk(() => { throw Object.assign(new Error('missing'), { name: 'NoSuchKey' }); }).sdk);
  assert.equal(await missing.read('k'), null);
  // Any other failure is passed on.
  const denied = await createB2Driver(fakeSdk(() => { throw Object.assign(new Error('denied'), { name: 'AccessDenied' }); }).sdk);
  await assert.rejects(denied.read('k'), { name: 'AccessDenied' });
});
