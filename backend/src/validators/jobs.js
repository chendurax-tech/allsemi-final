import { z } from 'zod';
import { requiredText, optionalText, stringList, lineList, slug, optionalNumber, wholeNumberOr, objectId } from './common.js';
import {
  JOB_STATUSES, EMPLOYMENT_TYPES, EXPERIENCE_LEVELS, WORK_ARRANGEMENTS, ATS_WEIGHT_KEYS,
  REQUIREMENT_PROFILE_LIMITS as PROFILE, CANDIDATE_COMPARISON_LIMITS as COMPARE,
} from '../config/constants.js';

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

/*
  A job's requirement profile (PUT /jobs/:id/requirement-profile).

  `weights` is the job's own weighting of the rule-based score: a whole
  number from 0 to 100 for each part, not all 0. null (or leaving it
  out) means the default weights. They do not have to add up to 100:
  the score is worked out from their proportions.

  `fromAiDraft` says the form was filled from an AI draft before a
  recruiter saved it. It only sets the label shown next to the profile.
*/
const profileWeights = z.object(Object.fromEntries(ATS_WEIGHT_KEYS.map((key) => [key, wholeNumberOr(0, 100, 0)])))
  .strict()
  .refine((weights) => Object.values(weights).some((value) => value > 0), { message: 'Give at least one part a weight above 0.' });

export const requirementProfileSchema = z.object({
  requiredSkills: stringList(PROFILE.skills).default([]),
  preferredSkills: stringList(PROFILE.skills).default([]),
  tools: stringList(PROFILE.skills).default([]),
  domains: stringList(PROFILE.skills).default([]),
  requiredExperience: optionalText(PROFILE.text, { multiline: true }),
  minYears: optionalNumber(0, PROFILE.years),
  preferredExperience: optionalText(PROFILE.text, { multiline: true }),
  preferredYears: optionalNumber(0, PROFILE.years),
  education: lineList(PROFILE.lines).default([]),
  certifications: lineList(PROFILE.lines).default([]),
  seniority: optionalText(PROFILE.short),
  location: optionalText(PROFILE.short),
  workArrangement: z.enum(WORK_ARRANGEMENTS).default(''),
  responsibilities: lineList(PROFILE.lines).default([]),
  niceToHave: lineList(PROFILE.lines).default([]),
  constraints: lineList(PROFILE.lines).default([]),
  // nullable, not a union with null: a wrong weight is then reported
  // under its own name (weights.skills), not as "weights" in general.
  weights: profileWeights.nullable().optional().default(null),
  fromAiDraft: z.boolean().optional().default(false),
  aiModel: optionalText(100),
});

// POST /jobs/:id/candidate-comparison: the ATS results to compare.
export const candidateComparisonSchema = z.object({
  resultIds: z.array(objectId)
    .min(COMPARE.minCandidates, `Choose at least ${COMPARE.minCandidates} candidates.`)
    .max(COMPARE.maxCandidates, `Choose at most ${COMPARE.maxCandidates} candidates.`)
    .refine((ids) => new Set(ids.map((id) => id.toLowerCase())).size === ids.length, { message: 'Choose each candidate once.' }),
});
