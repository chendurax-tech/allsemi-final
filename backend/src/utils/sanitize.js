/*
  Text sanitisation for anything typed into a public form or the admin.

  The API stores plain text. Markup is removed on the way in, and
  values are escaped again on the way out wherever they are placed into
  HTML (see services/email/templates.js). React escapes text when it
  renders, so the admin and the site never interpret stored text as
  markup either.
*/

// Control characters except tab, line feed and carriage return.
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

// Nothing longer than this is ever cleaned. The validators refuse
// longer text before it reaches here; this is the backstop for any
// other caller.
const MAX_INPUT = 50_000;

export function cleanText(value, { multiline = false, max = 5000 } = {}) {
  if (value === undefined || value === null) return '';
  // The tag pattern excludes "<" inside a tag, so each character is
  // looked at once however many "<" the text holds. (With /<[^>]*>/ a
  // long run of "<" made every one of them scan to the end.)
  let text = String(value)
    .slice(0, MAX_INPUT)
    .replace(CONTROL_CHARS, '')
    .replace(/<[^<>]*>/g, '') // tags
    .replace(/[<>]/g, ''); // any stray angle bracket left behind
  text = multiline
    ? text.replace(/\r\n?/g, '\n').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n')
    : text.replace(/\s+/g, ' ');
  return text.trim().slice(0, max);
}

export function cleanList(value, { maxItems = 40, maxLength = 80 } = {}) {
  let items = value;
  if (typeof value === 'string') items = value.split(/[,\n]/);
  if (!Array.isArray(items)) return [];
  const seen = new Set();
  const out = [];
  for (const item of items) {
    const text = cleanText(item, { max: maxLength });
    const key = text.toLowerCase();
    if (text && !seen.has(key)) {
      seen.add(key);
      out.push(text);
    }
    if (out.length >= maxItems) break;
  }
  return out;
}

export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function normaliseEmail(value) {
  return String(value || '').trim().toLowerCase();
}

// A filename is only ever stored as a label. It is never used to build
// a storage key or a path.
export function safeFileName(value, fallback = 'document') {
  const name = String(value || '')
    .replace(CONTROL_CHARS, '')
    .replace(/[\\/]/g, ' ')
    .replace(/[^\w .()\-]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120);
  return name || fallback;
}

export function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 96);
}
