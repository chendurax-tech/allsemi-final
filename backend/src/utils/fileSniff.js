import { DOCUMENT_TYPES, IMAGE_TYPES } from '../config/constants.js';

/*
  File type detection from the file's own bytes.

  The name and MIME type a browser sends are whatever the sender wants
  them to be, so neither is trusted. An upload is accepted only when
    1. its bytes have the structure of an allowed type (not only the
       first few bytes: see the checks below), and
    2. its extension is one that belongs to that same type.
  The MIME type stored and served afterwards is the detected one.

  Executables, scripts, plain archives, HTML and SVG never pass these
  checks, so they are refused whatever they are named.

  These are structural checks. They are not a malware scan: a document
  that is a real PDF or Word file can still carry something harmful
  for the program that opens it. services/storage/privateFiles.js has
  the hook where a scanner is connected.
*/

const TYPES = {
  pdf: { mime: 'application/pdf', extensions: ['pdf'] },
  doc: { mime: 'application/msword', extensions: ['doc'] },
  docx: { mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', extensions: ['docx'] },
  jpg: { mime: 'image/jpeg', extensions: ['jpg', 'jpeg'] },
  png: { mime: 'image/png', extensions: ['png'] },
  webp: { mime: 'image/webp', extensions: ['webp'] },
};

const startsWith = (buffer, bytes, offset = 0) => bytes.every((byte, i) => buffer[offset + i] === byte);

// A PDF starts with "%PDF-1." or "%PDF-2." and ends with an "%%EOF"
// marker. The marker is looked for in the last 2 KB, because some
// writers leave a few bytes after it.
function isPdf(buffer) {
  const header = buffer.toString('latin1', 0, 8);
  if (!/^%PDF-[12]\.\d$/.test(header)) return false;
  return buffer.subarray(Math.max(0, buffer.length - 2048)).includes(Buffer.from('%%EOF'));
}

// The entry names of a zip, read from its central directory (the index
// at the end of the file), not searched for anywhere in the bytes.
function zipEntryNames(buffer) {
  const END = 0x06054b50;
  const ENTRY = 0x02014b50;
  // The end record is 22 bytes plus a comment of at most 65535 bytes.
  const lowest = Math.max(0, buffer.length - 22 - 65535);
  let end = -1;
  for (let i = buffer.length - 22; i >= lowest; i -= 1) {
    if (buffer.readUInt32LE(i) === END) { end = i; break; }
  }
  if (end < 0) return null;
  const count = buffer.readUInt16LE(end + 10);
  let offset = buffer.readUInt32LE(end + 16);
  const names = [];
  for (let n = 0; n < count && n < 5000; n += 1) {
    if (offset + 46 > buffer.length || buffer.readUInt32LE(offset) !== ENTRY) return null;
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    if (offset + 46 + nameLength > buffer.length) return null;
    names.push(buffer.toString('utf8', offset + 46, offset + 46 + nameLength));
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return names;
}

// A legacy Word file is an OLE compound file with a stream named
// "WordDocument". Directory entries are 128 bytes, aligned to 128, with
// the name in UTF-16LE, its byte length (26, with the terminator) at
// +64 and the entry type (2 = stream) at +66. The text "WordDocument"
// somewhere else in the file does not count.
function hasWordStream(buffer) {
  const marker = Buffer.from('WordDocument', 'utf16le');
  let at = buffer.indexOf(marker, 512);
  while (at !== -1) {
    if (at % 128 === 0 && at + 67 < buffer.length && buffer.readUInt16LE(at + 64) === 26 && buffer[at + 66] === 2) return true;
    at = buffer.indexOf(marker, at + 2);
  }
  return false;
}

export function detectFileType(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 12) return null;

  // %PDF-
  if (startsWith(buffer, [0x25, 0x50, 0x44, 0x46, 0x2d])) return isPdf(buffer) ? 'pdf' : null;
  // PNG
  if (startsWith(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'png';
  // JPEG
  if (startsWith(buffer, [0xff, 0xd8, 0xff])) return 'jpg';
  // RIFF....WEBP
  if (startsWith(buffer, [0x52, 0x49, 0x46, 0x46]) && startsWith(buffer, [0x57, 0x45, 0x42, 0x50], 8)) return 'webp';
  // Legacy Word: an OLE compound file that contains a WordDocument stream.
  if (startsWith(buffer, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])) {
    return hasWordStream(buffer) ? 'doc' : null;
  }
  // DOCX: a zip whose index lists the Word document part. A plain zip,
  // a jar or another Office format does not have it.
  if (startsWith(buffer, [0x50, 0x4b, 0x03, 0x04])) {
    let names = null;
    try {
      names = zipEntryNames(buffer);
    } catch {
      names = null; // a truncated or malformed index
    }
    if (!names) return null;
    return names.includes('[Content_Types].xml') && names.includes('word/document.xml') ? 'docx' : null;
  }
  return null;
}

function extensionOf(fileName) {
  const match = /\.([A-Za-z0-9]{1,8})$/.exec(String(fileName || ''));
  return match ? match[1].toLowerCase() : '';
}

/*
  inspectUpload - the single gate every uploaded file passes.
  Returns { ok: true, type, mime, extension } or { ok: false, reason }.
*/
export function inspectUpload({ buffer, originalName }, allowed) {
  const extension = extensionOf(originalName);
  const type = detectFileType(buffer);
  if (!type || !allowed.includes(type)) {
    return { ok: false, reason: `Only ${allowed.map((t) => t.toUpperCase()).join(', ')} files are accepted.` };
  }
  if (!TYPES[type].extensions.includes(extension)) {
    return { ok: false, reason: 'The file extension does not match the file contents.' };
  }
  return { ok: true, type, mime: TYPES[type].mime, extension: TYPES[type].extensions[0] };
}

export const inspectDocument = (file) => inspectUpload(file, DOCUMENT_TYPES);
export const inspectImage = (file) => inspectUpload(file, IMAGE_TYPES);

// Width and height read from the image header, so media metadata does
// not depend on what the uploader claims.
export function imageDimensions(buffer, type) {
  try {
    if (type === 'png') return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
    if (type === 'jpg') {
      let offset = 2;
      while (offset + 9 < buffer.length) {
        if (buffer[offset] !== 0xff) { offset += 1; continue; }
        const marker = buffer[offset + 1];
        const isFrame = marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker);
        if (isFrame) return { height: buffer.readUInt16BE(offset + 5), width: buffer.readUInt16BE(offset + 7) };
        offset += 2 + buffer.readUInt16BE(offset + 2);
      }
    }
    if (type === 'webp') {
      const format = buffer.toString('ascii', 12, 16);
      if (format === 'VP8X') return { width: 1 + buffer.readUIntLE(24, 3), height: 1 + buffer.readUIntLE(27, 3) };
      if (format === 'VP8 ') return { width: buffer.readUInt16LE(26) & 0x3fff, height: buffer.readUInt16LE(28) & 0x3fff };
      if (format === 'VP8L') {
        const bits = buffer.readUInt32LE(21);
        return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
      }
    }
  } catch {
    // fall through: dimensions are optional metadata
  }
  return { width: null, height: null };
}
