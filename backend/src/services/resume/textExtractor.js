import { RESUME_EXTRACTION_LIMITS, RESUME_EXTRACTION_TYPES } from '../../config/constants.js';
import { detectFileType } from '../../utils/fileSniff.js';
import { readPrivateFile } from '../storage/privateFiles.js';
import { logger } from '../../utils/logger.js';

/*
  RESUME TEXT EXTRACTION.

  Reads the text of a stored resume, on this server, with free local
  libraries: pdfjs-dist (Mozilla's PDF reader) for PDF and mammoth for
  DOCX. No AI service is called, nothing is sent anywhere, and there is
  no OCR: a scanned resume with no text layer ends as NO_TEXT and the
  recruiter reads it by hand. Legacy .doc files are not read in this
  phase (UNSUPPORTED).

  It only reads. It does not parse the text into a profile, and it
  writes nothing to a candidate, an application or an ATS result.

  The type is decided from the file's bytes (utils/fileSniff.js), as it
  was when the file was uploaded, never from its name or stored type.

  Limits (RESUME_EXTRACTION_LIMITS in config/constants.js):
  - a file over maxFileBytes is not read at all;
  - a DOCX whose zip index has too many entries or declares too large an
    unpacked size is refused before it is unpacked;
  - at most maxPages PDF pages are read;
  - the text is cut to maxTextChars, and `truncated` says so;
  - the extraction gives up after timeoutMs. The time is checked between
    PDF pages and the whole run is raced against a timer, so a parse
    that hangs ends as TIMEOUT. A single synchronous step inside a
    library cannot be interrupted from here; the page and size limits
    keep those steps small.

  A file problem never throws: the result says what happened in
  `status` (RESUME_EXTRACTION_STATUSES). The text of a resume is never
  logged; a failure is logged with the file type, the status and the
  name of the error only.

  Result:
    { ok, status, type, text, truncated, characters, words, pages,
      pagesRead, extractor, warnings, reason, durationMs }
*/

const EXTRACTORS = { pdf: 'pdfjs-dist', docx: 'mammoth' };

const REASONS = {
  EXTRACTED: 'Text was extracted from the resume.',
  NO_TEXT: 'No readable text was found. The resume may be a scanned image, which is not read in this phase: open the resume and read it.',
  UNSUPPORTED: 'Only PDF and DOCX resumes can be read. Open the resume and read it.',
  MALFORMED: 'The resume could not be read: the file appears to be damaged.',
  PROTECTED: 'The resume is password protected and cannot be read.',
  TOO_LARGE: 'The resume is larger than can be read.',
  TIMEOUT: 'Reading the resume took too long and was stopped.',
  UNAVAILABLE: 'The stored resume could not be read.',
};

class ExtractionStop extends Error {
  constructor(status) {
    super(status);
    this.name = 'ExtractionStop';
    this.status = status;
  }
}

// ------------------------------------------------------------- the text

const INVISIBLE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F­​-‍⁠﻿]/g;

// One form for every resume: Unicode compatibility forms folded (PDF
// ligatures such as "ﬁ" become "fi"), control and invisible characters
// removed, runs of spaces made one, at most one empty line in a row.
export function normaliseText(text) {
  return String(text || '')
    .normalize('NFKC')
    .replace(/\r\n?/g, '\n')
    .replace(INVISIBLE, '')
    .replace(/[^\S\n]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// Cut to `max` characters, at a line break or a space near the end
// when there is one, so a word is not split.
function cut(text, max) {
  if (text.length <= max) return { text, truncated: false };
  const head = text.slice(0, max);
  const boundary = Math.max(head.lastIndexOf('\n'), head.lastIndexOf(' '));
  return { text: (boundary > max - 200 ? head.slice(0, boundary) : head).trim(), truncated: true };
}

const countWords = (text) => (text.match(/\S+/g) || []).length;
const readable = (text) => text.replace(/[^\p{L}\p{N}]/gu, '').length;

// ------------------------------------------------------------------ PDF

let pdfjsModule = null;
async function loadPdfjs() {
  if (!pdfjsModule) {
    pdfjsModule = (async () => {
      const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
      // pdf.js parses in a worker in a browser. On the server it runs in
      // this process: the worker module is loaded here and handed over,
      // so pdf.js neither looks for a worker file nor starts a thread.
      if (!globalThis.pdfjsWorker) globalThis.pdfjsWorker = await import('pdfjs-dist/legacy/build/pdf.worker.mjs');
      return pdfjs;
    })().catch((error) => {
      pdfjsModule = null;
      throw error;
    });
  }
  return pdfjsModule;
}

// The text items of one page as lines. pdf.js marks the end of a line
// on some items; a change of vertical position also starts a new line.
function pageText(items) {
  const lines = [];
  let line = '';
  let lastY = null;
  for (const item of items) {
    if (typeof item?.str !== 'string') continue; // marked-content markers
    const y = Array.isArray(item.transform) ? item.transform[5] : null;
    if (line && lastY !== null && y !== null && Math.abs(y - lastY) > 2) {
      lines.push(line);
      line = '';
    }
    line += item.str;
    lastY = y;
    if (item.hasEOL) {
      lines.push(line);
      line = '';
      lastY = null;
    }
  }
  if (line) lines.push(line);
  return lines.join('\n');
}

async function readPdf(buffer, limits, deadline, task) {
  const pdfjs = await loadPdfjs();
  const loading = pdfjs.getDocument({
    // A copy: pdf.js takes ownership of the bytes it is given.
    data: new Uint8Array(buffer),
    // No script, no fonts, no network, no messages on the console.
    isEvalSupported: false,
    disableFontFace: true,
    useSystemFonts: false,
    useWorkerFetch: false,
    stopAtErrors: false,
    verbosity: 0,
  });
  task.cancel = () => loading.destroy().catch(() => {});
  const doc = await loading.promise;
  try {
    const pages = doc.numPages;
    const toRead = Math.min(pages, limits.maxPages);
    // Reading stops once there is clearly more text than will be kept.
    const enough = limits.maxTextChars * 2;
    const parts = [];
    let collected = 0;
    let pagesRead = 0;
    for (let number = 1; number <= toRead; number += 1) {
      if (Date.now() >= deadline) throw new ExtractionStop('TIMEOUT');
      const page = await doc.getPage(number);
      const content = await page.getTextContent();
      const text = pageText(content.items);
      page.cleanup();
      parts.push(text);
      collected += text.length;
      pagesRead += 1;
      if (collected > enough) break;
    }
    return { raw: parts.join('\n\n'), pages, pagesRead };
  } finally {
    await doc.destroy().catch(() => {});
  }
}

// ----------------------------------------------------------------- DOCX

/*
  The entries of a zip and the unpacked size each declares, read from
  its central directory, so an oversized DOCX (a "zip bomb") is refused
  before anything is unpacked. A zip that needs the ZIP64 extension is
  far beyond any resume and is refused as well. The declared sizes are
  what the file says about itself; the time limit covers a file that
  lies about them.
*/
function docxEntries(buffer, limits) {
  const END = 0x06054b50;
  const ENTRY = 0x02014b50;
  const lowest = Math.max(0, buffer.length - 22 - 65535);
  let end = -1;
  for (let i = buffer.length - 22; i >= lowest; i -= 1) {
    if (buffer.readUInt32LE(i) === END) { end = i; break; }
  }
  if (end < 0) throw new ExtractionStop('MALFORMED');
  const count = buffer.readUInt16LE(end + 10);
  if (count === 0xffff || count > limits.maxDocxEntries) throw new ExtractionStop('TOO_LARGE');
  let offset = buffer.readUInt32LE(end + 16);
  let unpacked = 0;
  for (let n = 0; n < count; n += 1) {
    if (offset + 46 > buffer.length || buffer.readUInt32LE(offset) !== ENTRY) throw new ExtractionStop('MALFORMED');
    const size = buffer.readUInt32LE(offset + 24);
    if (size === 0xffffffff) throw new ExtractionStop('TOO_LARGE');
    unpacked += size;
    if (unpacked > limits.maxDocxUnpackedBytes) throw new ExtractionStop('TOO_LARGE');
    offset += 46 + buffer.readUInt16LE(offset + 28) + buffer.readUInt16LE(offset + 30) + buffer.readUInt16LE(offset + 32);
  }
  return { count, unpacked };
}

let mammothModule = null;
async function loadMammoth() {
  if (!mammothModule) {
    mammothModule = import('mammoth').then((module) => module.default || module).catch((error) => {
      mammothModule = null;
      throw error;
    });
  }
  return mammothModule;
}

async function readDocx(buffer, limits) {
  docxEntries(buffer, limits);
  const mammoth = await loadMammoth();
  // The raw text only: paragraphs, with no styles, links or images.
  // mammoth's messages (unknown styles and the like) are not kept.
  const { value } = await mammoth.extractRawText({ buffer });
  return { raw: value || '', pages: null, pagesRead: null };
}

// --------------------------------------------------------------- running

function deadlineRace(work, ms, onTimeout) {
  let timer;
  const timeout = new Promise((resolve, reject) => {
    timer = setTimeout(() => {
      onTimeout();
      reject(new ExtractionStop('TIMEOUT'));
    }, ms);
    timer.unref?.();
  });
  return Promise.race([work, timeout]).finally(() => clearTimeout(timer));
}

// The status a library error stands for.
function statusOf(error) {
  if (error instanceof ExtractionStop) return error.status;
  if (error?.name === 'PasswordException') return 'PROTECTED';
  return 'MALFORMED';
}

function result(status, fields = {}) {
  const text = fields.text || '';
  return {
    ok: status === 'EXTRACTED',
    status,
    type: fields.type ?? null,
    text,
    truncated: Boolean(fields.truncated),
    characters: text.length,
    words: text ? countWords(text) : 0,
    pages: fields.pages ?? null,
    pagesRead: fields.pagesRead ?? null,
    extractor: fields.type ? (EXTRACTORS[fields.type] || null) : null,
    warnings: fields.warnings || [],
    reason: REASONS[status],
    durationMs: fields.durationMs ?? 0,
  };
}

/*
  extractTextFromBuffer - the text of a resume held in memory.
  `limits` may override RESUME_EXTRACTION_LIMITS (the tests use it).
*/
export async function extractTextFromBuffer(buffer, { limits: override = {} } = {}) {
  const limits = { ...RESUME_EXTRACTION_LIMITS, ...override };
  const started = Date.now();
  const elapsed = () => Date.now() - started;

  if (!Buffer.isBuffer(buffer) || buffer.length === 0) return result('NO_TEXT', { warnings: ['EMPTY_FILE'] });
  if (buffer.length > limits.maxFileBytes) return result('TOO_LARGE', { type: detectFileType(buffer) });

  const type = detectFileType(buffer);
  if (!type || !RESUME_EXTRACTION_TYPES.includes(type)) {
    return result('UNSUPPORTED', { type, warnings: type === 'doc' ? ['LEGACY_DOC'] : [] });
  }

  const task = { cancel: () => {} };
  let read;
  try {
    const work = type === 'pdf' ? readPdf(buffer, limits, started + limits.timeoutMs, task) : readDocx(buffer, limits);
    read = await deadlineRace(work, limits.timeoutMs, () => task.cancel());
  } catch (error) {
    const status = statusOf(error);
    // The type, the status and the error's name: never its message,
    // which could quote the document, and never the text.
    logger.warn('resume.extraction_failed', { type, status, errorName: error?.name || 'Error', durationMs: elapsed() });
    return result(status, { type, durationMs: elapsed() });
  }

  const warnings = [];
  if (read.pages !== null && read.pagesRead < read.pages) warnings.push('PAGES_NOT_READ');
  const normalised = normaliseText(read.raw);
  if (readable(normalised) < limits.minTextChars) {
    return result('NO_TEXT', { type, pages: read.pages, pagesRead: read.pagesRead, warnings, durationMs: elapsed() });
  }
  const kept = cut(normalised, limits.maxTextChars);
  if (kept.truncated) warnings.push('TEXT_TRUNCATED');
  return result('EXTRACTED', {
    type,
    text: kept.text,
    truncated: kept.truncated || warnings.includes('PAGES_NOT_READ'),
    pages: read.pages,
    pagesRead: read.pagesRead,
    warnings,
    durationMs: elapsed(),
  });
}

/*
  extractResumeText - the text of a stored resume: `file` is the
  metadata saved on a candidate or an application (privateFileSchema in
  models/shared.js). The caller has checked that the person asking may
  read resumes. A file the stores cannot provide ends as UNAVAILABLE,
  or TOO_LARGE when it is over the limit.
  `read` is only passed by the tests.
*/
export async function extractResumeText(file, { limits: override = {}, read = readPrivateFile } = {}) {
  const limits = { ...RESUME_EXTRACTION_LIMITS, ...override };
  if (!file?.key) return result('UNAVAILABLE', { warnings: ['NO_FILE'] });
  let buffer;
  try {
    buffer = await read(file, { maxBytes: limits.maxFileBytes });
  } catch (error) {
    if (error?.status === 413 || error?.code === 'FILE_TOO_LARGE') return result('TOO_LARGE');
    if (error?.status !== 404) logger.error('resume.read_failed', { errorName: error?.name || 'Error', code: error?.code });
    return result('UNAVAILABLE');
  }
  return extractTextFromBuffer(buffer, { limits });
}
