import { z } from 'zod';
import { cleanText, cleanList } from '../utils/sanitize.js';

/*
  Building blocks for request validation.

  Every text value is cleaned (markup and control characters removed)
  and then length-checked. A value that is not a string (an object or
  an array sent where text is expected) fails validation, which is also
  what stops a query operator such as { "$gt": "" } from being accepted
  as a field value.
*/

// The raw value is length-checked BEFORE it is cleaned, so the cleaning
// never runs over more than this, whatever the request contains. The
// limit after cleaning is the field's own.
const HARD_CAP = 20_000;
const TOO_LONG = 'This text is too long.';

export const text = (max, { multiline = false } = {}) => z
  .string({ invalid_type_error: 'Must be text.', required_error: 'Required.' })
  .max(HARD_CAP, TOO_LONG)
  .transform((value) => cleanText(value, { multiline, max: HARD_CAP }))
  .pipe(z.string().max(max, `Use at most ${max} characters.`));

export const requiredText = (max, options) => z
  .string({ invalid_type_error: 'Must be text.', required_error: 'Required.' })
  .max(HARD_CAP, TOO_LONG)
  .transform((value) => cleanText(value, { ...options, max: HARD_CAP }))
  .pipe(z.string().min(1, 'Required.').max(max, `Use at most ${max} characters.`));

export const optionalText = (max, options) => text(max, options).optional().default('');

export const email = z
  .string({ invalid_type_error: 'Must be text.', required_error: 'Required.' })
  .trim()
  .toLowerCase()
  .max(254, 'Use at most 254 characters.')
  .email('Enter a valid email address.');

export const optionalEmail = z.union([z.literal(''), email]).optional().default('');

export const phone = z
  .string({ invalid_type_error: 'Must be text.' })
  .max(200, 'Enter a valid phone number.')
  .transform((value) => cleanText(value, { max: 60 }))
  .pipe(z.string().regex(/^$|^[+0-9 ()\-.]{6,25}$/, 'Enter a valid phone number.'))
  .optional()
  .default('');

export const url = z
  .string({ invalid_type_error: 'Must be text.' })
  .trim()
  .max(300, 'Use at most 300 characters.')
  .regex(/^$|^https?:\/\/[^\s<>"']+$/i, 'Enter a full link starting with http:// or https://.')
  .optional()
  .default('');

// Tags and one-per-line lists arrive either as an array or, from a
// multipart form, as one comma or newline separated string.
// Both forms are bounded before they are cleaned.
const rawList = z.union([
  z.array(z.string().max(2000, TOO_LONG)).max(200, 'This list has too many items.'),
  z.string().max(HARD_CAP, TOO_LONG),
]);

export const stringList = ({ maxItems = 40, maxLength = 80 } = {}) => rawList
  .transform((value) => cleanList(value, { maxItems, maxLength }));

export const lineList = ({ maxItems = 40, maxLength = 400 } = {}) => rawList
  .transform((value) => {
    const items = Array.isArray(value) ? value : value.split('\n');
    return items.map((item) => cleanText(item, { max: maxLength })).filter(Boolean).slice(0, maxItems);
  });

// A checkbox in a multipart form arrives as "true" / "on" / "1".
export const flag = z
  .union([z.boolean(), z.string()])
  .transform((value) => value === true || ['true', 'on', '1', 'yes'].includes(String(value).toLowerCase()));

// z.coerce.number() turns '' and null into 0. An empty value must stay
// "not given" instead, so it is removed before the number is read.
const blankToUndefined = (value) => (value === '' || value === null ? undefined : value);

export const number = (min, max) => z.preprocess(
  blankToUndefined,
  z.coerce.number({ invalid_type_error: 'Enter a number.', required_error: 'Required.' })
    .min(min, `Must be at least ${min}.`)
    .max(max, `Must be at most ${max}.`),
);

export const wholeNumber = (min, max) => z.preprocess(
  blankToUndefined,
  z.coerce.number({ invalid_type_error: 'Enter a number.', required_error: 'Required.' })
    .int('Enter a whole number.')
    .min(min, `Must be at least ${min}.`)
    .max(max, `Must be at most ${max}.`),
);

// A whole number with a fallback: an empty or missing value becomes the
// fallback instead of failing.
export const wholeNumberOr = (min, max, fallback) => z.preprocess(
  blankToUndefined,
  z.coerce.number({ invalid_type_error: 'Enter a number.' })
    .int('Enter a whole number.')
    .min(min, `Must be at least ${min}.`)
    .max(max, `Must be at most ${max}.`)
    .optional()
    .default(fallback),
);

// A number that may be left empty: '' and null are stored as null.
export const optionalNumber = (min, max) => z.preprocess(
  (value) => (value === '' || value === undefined ? null : value),
  z.union([z.null(), z.coerce.number({ invalid_type_error: 'Enter a number.' }).min(min, `Must be at least ${min}.`).max(max, `Must be at most ${max}.`)]),
);

export const slug = z
  .string({ invalid_type_error: 'Must be text.' })
  .trim()
  .toLowerCase()
  .max(100, 'Use at most 100 characters.')
  .regex(/^$|^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase letters, numbers and hyphens only.');

export const objectId = z.string({ required_error: 'Required.', invalid_type_error: 'Must be text.' }).regex(/^[a-f0-9]{24}$/i, 'That id is not valid.');

export const isoDate = z.string().regex(/^$|^\d{4}-\d{2}-\d{2}$/, 'Use the format YYYY-MM-DD.');

// The honeypot field every public form carries. It is read by the
// honeypot middleware and is not stored.
export const honeypotField = { website: z.string().max(200).optional() };

// An image reference: either an uploaded image (with its publicId) or
// an external https link. Other schemes, including javascript: and
// data:, are refused.
export const media = z.object({
  url: z.string().trim().max(600).regex(/^$|^(https:\/\/|http:\/\/localhost[:/]|http:\/\/127\.0\.0\.1[:/]|\/media\/)[^\s<>"']*$/i, 'Use an uploaded image or an https link.').default(''),
  publicId: z.string().trim().max(200).default(''),
  width: z.number().int().positive().nullable().default(null),
  height: z.number().int().positive().nullable().default(null),
  format: z.string().trim().max(10).default(''),
  alt: text(300).default(''),
}).default({});
