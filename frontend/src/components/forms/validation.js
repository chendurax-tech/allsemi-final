import { DOCUMENT_ACCEPT, DOCUMENT_MAX_BYTES } from '../../lib/api/public.js';

/*
  Client-side rules for the four public forms, and the wording for
  failures the server reports.

  The rules here repeat the backend's (backend/src/validators) so a
  visitor hears about a problem before sending. They are a convenience
  only: the server validates every submission again and its answer is
  the one that counts, which is why a server message for a field is
  always shown, even when the rule here let the value through.

  A rule is a function (value, values) -> message, where an empty
  string means the value is fine.
*/

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE = /^[+0-9 ()\-.]{6,25}$/;
const LINK = /^https?:\/\/[^\s<>"']+$/i;

const text = (value) => (typeof value === 'string' ? value.trim() : value);

export const required = (message = 'This field is required.') => (value) => {
  const cleaned = text(value);
  return cleaned === '' || cleaned === undefined || cleaned === null ? message : '';
};

export const email = (message = 'Enter a valid email address.') => (value) => (
  !text(value) || EMAIL.test(text(value)) ? '' : message
);

export const phone = (message = 'Enter a valid phone number: 6 to 25 digits, spaces and + ( ) - . only.') => (value) => (
  !text(value) || PHONE.test(text(value)) ? '' : message
);

export const link = (message = 'Enter a full link starting with http:// or https://.') => (value) => (
  !text(value) || LINK.test(text(value)) ? '' : message
);

// A number that may be left empty. `whole` refuses decimals.
export const numberBetween = (min, max, { whole = false } = {}) => (value) => {
  if (text(value) === '') return '';
  const number = Number(value);
  if (!Number.isFinite(number)) return 'Enter a number.';
  if (whole && !Number.isInteger(number)) return 'Enter a whole number.';
  if (number < min) return `Must be at least ${min}.`;
  if (number > max) return `Must be at most ${max}.`;
  return '';
};

export const accepted = (message = 'Please confirm before sending.') => (value) => (value === true ? '' : message);

/* ---------- documents ---------- */

const DOCUMENT_EXTENSIONS = DOCUMENT_ACCEPT.split(',').map((item) => item.trim().replace(/^\./, '').toLowerCase());
const DOCUMENT_LIMIT_MB = Math.round(DOCUMENT_MAX_BYTES / (1024 * 1024));

export const DOCUMENT_HINT = `PDF, DOC or DOCX. Up to ${DOCUMENT_LIMIT_MB} MB.`;

export function fileExtension(file) {
  const match = /\.([a-z0-9]+)$/i.exec(file?.name || '');
  return match ? match[1].toLowerCase() : '';
}

export function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Checks the name and the size only. The server decides the real type
// from the file's bytes, so a renamed file is refused there.
export function checkDocument(file) {
  if (!DOCUMENT_EXTENSIONS.includes(fileExtension(file))) return 'Only PDF, DOC or DOCX files are accepted.';
  if (file.size > DOCUMENT_MAX_BYTES) return `The file is larger than the ${DOCUMENT_LIMIT_MB} MB limit.`;
  if (file.size === 0) return 'The file is empty.';
  return '';
}

/* ---------- server failures ---------- */

// Codes that are about the attached document, not about a text field.
export const FILE_ERROR_CODES = ['FILE_TOO_LARGE', 'UNSUPPORTED_FILE_TYPE', 'UNEXPECTED_FILE'];

// One plain sentence for the error panel. Unknown codes fall back to
// the message the server sent.
export function describeFailure(error) {
  switch (error?.code) {
    case 'VALIDATION_ERROR':
      return 'Some details need attention. Check the highlighted fields and send again.';
    case 'RATE_LIMITED':
      return 'Too many submissions from this connection. Please wait a few minutes and try again.';
    case 'FILE_TOO_LARGE':
      return `The file is larger than the ${DOCUMENT_LIMIT_MB} MB limit. Choose a smaller file and send again.`;
    case 'UNSUPPORTED_FILE_TYPE':
      return error.message || 'This file type is not accepted. Attach a PDF, DOC or DOCX file.';
    case 'NETWORK_ERROR':
      return 'The server could not be reached. Check your connection and try again.';
    default:
      return error?.message || 'The submission could not be sent. Please try again.';
  }
}
