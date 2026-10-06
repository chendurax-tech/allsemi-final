import { z } from 'zod';
import { requiredText, optionalText, text, stringList, lineList, slug, isoDate, media, optionalEmail, phone, number } from './common.js';
import { CONTENT_STATUSES, LOCATION_TYPES, LOCATION_STATUSES } from '../config/constants.js';
import { cleanText } from '../utils/sanitize.js';

const status = z.enum(CONTENT_STATUSES).default('draft');

const bodyBlock = z.object({
  type: z.enum(['p', 'h2', 'quote', 'list']),
  text: z.string().max(6000).optional().default('').transform((value) => cleanText(value, { multiline: true, max: 6000 })),
  items: z.array(z.string().max(600)).max(60).optional().transform((items) => (items ? items.map((item) => cleanText(item, { max: 600 })).filter(Boolean) : undefined)),
});

export const insightCreateSchema = z.object({
  title: requiredText(200),
  slug: slug.optional().default(''),
  excerpt: optionalText(600, { multiline: true }),
  category: optionalText(60),
  tags: stringList().default([]),
  topics: stringList({ maxItems: 12, maxLength: 40 }).default([]),
  image: media,
  body: z.array(bodyBlock).max(200).default([]),
  author: optionalText(120),
  date: isoDate.optional().default(''),
  readTime: optionalText(40),
  featured: z.boolean().default(false),
  showOnLanding: z.boolean().default(false),
  landingOrder: z.coerce.number().int().min(0).max(999).default(0),
  status,
  seoTitle: optionalText(200),
  seoDescription: optionalText(400, { multiline: true }),
});
export const insightUpdateSchema = insightCreateSchema.partial();

export const storyCreateSchema = z.object({
  quote: requiredText(1200, { multiline: true }),
  name: optionalText(120),
  role: optionalText(160),
  photo: media,
  order: z.coerce.number().int().min(0).max(999).default(0),
  showOnLanding: z.boolean().default(true),
  status,
});
export const storyUpdateSchema = storyCreateSchema.partial();

export const expertiseCreateSchema = z.object({
  key: slug.optional().default(''),
  num: optionalText(4),
  name: requiredText(120),
  shortName: optionalText(40),
  slug: slug.optional().default(''),
  desc: optionalText(400, { multiline: true }),
  image: media,
  introduction: optionalText(600, { multiline: true }),
  overview: optionalText(4000, { multiline: true }),
  domains: stringList({ maxItems: 30, maxLength: 80 }).default([]),
  roles: stringList({ maxItems: 30, maxLength: 80 }).default([]),
  hiringChallenges: lineList({ maxItems: 12, maxLength: 400 }).default([]),
  processFlow: stringList({ maxItems: 10, maxLength: 40 }).default([]),
  representativeSearches: z.array(z.object({
    ref: optionalText(40),
    title: optionalText(120),
    requirement: optionalText(300),
    signals: stringList({ maxItems: 12, maxLength: 60 }).default([]),
  })).max(6).default([]),
  relatedInsight: slug.optional().default(''),
  status,
});
export const expertiseUpdateSchema = expertiseCreateSchema.partial();

export const serviceCreateSchema = z.object({
  num: optionalText(4),
  name: requiredText(120),
  slug: slug.optional().default(''),
  icon: optionalText(40).transform((value) => value || 'die'),
  description: optionalText(800, { multiline: true }),
  headline: optionalText(240),
  lead: optionalText(800, { multiline: true }),
  fitTitle: optionalText(200),
  fit: lineList({ maxItems: 12 }).default([]),
  processTitle: optionalText(200),
  process: lineList({ maxItems: 12 }).default([]),
  receiveTitle: optionalText(200),
  receive: lineList({ maxItems: 12 }).default([]),
  tagsTitle: optionalText(200),
  tags: stringList({ maxItems: 24, maxLength: 60 }).default([]),
  questions: lineList({ maxItems: 12, maxLength: 800 }).default([]),
  ctaLabel: optionalText(80),
  ctaTo: z.string().trim().max(200).regex(/^$|^\/(?![/\\])[^\s<>"'\\]*$/, 'Use a path on this site, starting with "/".').optional().default(''),
  status,
});
export const serviceUpdateSchema = serviceCreateSchema.partial();

const locationFields = {
  key: slug.optional().default(''),
  city: requiredText(80),
  country: optionalText(80),
  region: optionalText(40),
  label: optionalText(120),
  type: z.enum(LOCATION_TYPES).default('network'),
  status: z.enum(LOCATION_STATUSES).default('listed'),
  isHeadquarters: z.boolean().default(false),
  address: lineList({ maxItems: 6, maxLength: 160 }).default([]),
  phone,
  email: optionalEmail,
  hours: lineList({ maxItems: 6, maxLength: 120 }).default([]),
  lat: number(-90, 90),
  lon: number(-180, 180),
  description: optionalText(400, { multiline: true }),
  labelSide: z.enum(['left', 'right']).default('right'),
  labelRaise: z.coerce.number().min(0).max(80).default(0),
  active: z.boolean().default(true),
};
export const locationCreateSchema = z.object(locationFields);
export const locationUpdateSchema = z.object(locationFields).partial();

export const contactSettingsSchema = z.object({
  email: optionalEmail,
  phone,
  address: lineList({ maxItems: 6, maxLength: 160 }).default([]),
  hours: lineList({ maxItems: 6, maxLength: 120 }).default([]),
});

export const mediaDeleteSchema = z.object({ publicId: z.string().trim().min(1).max(200) });
export { text };
