import { z } from 'zod';
import { requiredText, optionalText, stringList, lineList, slug } from './common.js';
import { JOB_STATUSES, EMPLOYMENT_TYPES, EXPERIENCE_LEVELS } from '../config/constants.js';

export const jobCreateSchema = z.object({
  title: requiredText(160),
  slug: slug.optional().default(''),
  category: optionalText(80),
  department: optionalText(120),
  location: optionalText(120),
  employmentType: z.enum(EMPLOYMENT_TYPES).default('Full-time'),
  experienceLevel: z.enum(EXPERIENCE_LEVELS).default('Mid-Senior'),
  summary: optionalText(600, { multiline: true }),
  description: optionalText(8000, { multiline: true }),
  responsibilities: lineList().default([]),
  requiredSkills: stringList().default([]),
  preferredSkills: stringList().default([]),
  keywords: stringList().default([]),
  status: z.enum(JOB_STATUSES).default('draft'),
  featured: z.boolean().default(false),
  applicationEnabled: z.boolean().default(true),
});

export const jobUpdateSchema = jobCreateSchema.partial();
