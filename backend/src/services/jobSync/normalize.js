import { createHash } from 'node:crypto';
import { cleanText, cleanList } from '../../utils/sanitize.js';
import { EMPLOYMENT_TYPES, EXPERIENCE_LEVELS } from '../../config/constants.js';

/*
  ONE SOURCE RECORD -> ONE VALIDATED JOB RECORD.

  Every record read from the official source passes through here before
  anything is written. A record that fails is reported and skipped; it
  never reaches the database, and it does not stop the other records.

  Nothing is invented: a field the source does not give stays empty
  (an employment type or a level that cannot be mapped is '', not a
  default). Text is cleaned of markup and control characters and cut to
  the lengths the job model allows.
*/

const LIMITS = { id: 200, title: 160, summary: 600, description: 8000, location: 120, department: 120, category: 80, url: 600 };

export class RecordError extends Error {
  constructor(message, sourceJobId = '') {
    super(message);
    this.name = 'RecordError';
    this.sourceJobId = sourceJobId;
  }
}

// HTML (as many feeds and JobPosting descriptions carry it) to plain
// text with line breaks. Script and style contents are dropped.
export function htmlToText(value) {
  const text = String(value ?? '');
  if (!/[<&]/.test(text)) return text;
  return text
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|ul|ol|h[1-6]|tr|section)>/gi, '\n')
    .replace(/<li[^>]*>/gi, '- ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n');
}

const text = (value, max, { multiline = false } = {}) => cleanText(htmlToText(value), { multiline, max: max * 2 }).slice(0, max).trim();
const list = (value, maxItems = 40, maxLength = 160) => {
  const items = Array.isArray(value) ? value : (typeof value === 'string' && value.trim() ? value.split(/\n|,|;/) : []);
  return cleanList(items.map((item) => htmlToText(item)), { maxItems, maxLength });
};

const OPEN = new Set(['open', 'active', 'published', 'live', 'posted', 'accepting']);
const CLOSED = new Set(['closed', 'filled', 'expired', 'inactive', 'archived', 'removed', 'cancelled', 'canceled', 'on-hold', 'paused']);

function mapStatus(value, validThrough) {
  if (validThrough) {
    const until = new Date(validThrough);
    if (!Number.isNaN(until.getTime()) && until.getTime() < Date.now()) return 'closed';
  }
  if (value === undefined || value === null || value === '') return 'open';
  const word = String(value).trim().toLowerCase();
  if (OPEN.has(word)) return 'open';
  if (CLOSED.has(word)) return 'closed';
  return null;
}

function mapEmploymentType(value) {
  const words = (Array.isArray(value) ? value : [value]).map((item) => String(item ?? '').trim().toLowerCase().replace(/[\s_]+/g, '-'));
  for (const word of words) {
    const exact = EMPLOYMENT_TYPES.find((type) => type.toLowerCase() === word);
    if (exact) return exact;
    if (['full-time', 'fulltime', 'permanent'].includes(word)) return 'Full-time';
    if (['contract-to-hire', 'contract-to-perm', 'temp-to-perm'].includes(word)) return 'Contract-to-hire';
    if (['contract', 'contractor', 'temporary', 'temp', 'fixed-term'].includes(word)) return 'Contract';
  }
  return '';
}

// A stated level as it is, or the level the stated minimum years fall
// in (the same steps the job levels use: config/constants.js).
function mapExperienceLevel(level, minYears, experienceText) {
  if (level) {
    const exact = EXPERIENCE_LEVELS.find((option) => option.toLowerCase() === String(level).trim().toLowerCase());
    if (exact) return exact;
  }
  let years = Number.isFinite(Number(minYears)) && minYears !== null && minYears !== '' ? Number(minYears) : null;
  if (years === null && experienceText) {
    const match = /(\d{1,2})\s*(?:\+|-|–|to)?\s*(?:\d{1,2}\s*)?(?:years?|yrs?)/i.exec(String(experienceText));
    if (match) years = Number(match[1]);
    else if (/\b(fresher|graduate|entry[\s-]level|no experience)\b/i.test(String(experienceText))) years = 0;
  }
  if (years === null || years < 0) return '';
  if (years >= 10) return 'Lead / Principal';
  if (years >= 7) return 'Senior';
  if (years >= 4) return 'Mid-Senior';
  if (years >= 2) return 'Mid-Level';
  return 'Entry-Level';
}

function validDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/*
  normalizeRecord - a raw record from an adapter (already in the common
  shape: sourceJobId, title, description, ...) to a validated record,
  or a RecordError.
*/
export function normalizeRecord(raw) {
  const sourceJobId = cleanText(raw?.sourceJobId == null ? '' : String(raw.sourceJobId), { max: LIMITS.id * 2 }).slice(0, LIMITS.id).trim();
  if (!sourceJobId) throw new RecordError('The record has no job id.');
  if (!/^[\w.:/#@?=&%+~-]+$/.test(sourceJobId)) throw new RecordError('The job id contains characters that are not allowed.', sourceJobId);
  const title = text(raw.title, LIMITS.title);
  if (!title) throw new RecordError('The record has no title.', sourceJobId);
  const description = text(raw.description, LIMITS.description, { multiline: true });
  if (description.length < 20) throw new RecordError('The record has no description (or one of fewer than 20 characters).', sourceJobId);
  const status = mapStatus(raw.status, raw.validThrough);
  if (!status) throw new RecordError(`The status "${String(raw.status).slice(0, 40)}" is not one the sync understands.`, sourceJobId);
  let sourceUrl = '';
  if (raw.sourceUrl) {
    sourceUrl = String(raw.sourceUrl).trim().slice(0, LIMITS.url);
    if (!/^https?:\/\/[^\s<>"']+$/i.test(sourceUrl)) throw new RecordError('The job address is not an http(s) address.', sourceJobId);
  }
  return {
    sourceJobId,
    sourceUrl,
    sourceUpdatedAt: validDate(raw.updatedAt),
    status,
    fields: {
      title,
      summary: text(raw.summary, LIMITS.summary, { multiline: true }),
      description,
      location: text(raw.location, LIMITS.location),
      department: text(raw.department, LIMITS.department),
      category: text(raw.category, LIMITS.category),
      employmentType: mapEmploymentType(raw.employmentType),
      experienceLevel: mapExperienceLevel(raw.experienceLevel, raw.minYears, raw.experience),
      responsibilities: list(raw.responsibilities, 30, 400),
      requiredSkills: list(raw.requiredSkills, 40, 80),
      preferredSkills: list(raw.preferredSkills, 40, 80),
    },
  };
}

// The official content of a record, as a hash: a change of any source
// field changes it; a repeat of the same content does not.
export function fingerprint(fields) {
  const ordered = Object.keys(fields).sort().map((key) => [key, fields[key]]);
  return createHash('sha256').update(JSON.stringify(ordered)).digest('hex');
}
