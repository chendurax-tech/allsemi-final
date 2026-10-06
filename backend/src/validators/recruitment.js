import { z } from 'zod';
import {
  requiredText, optionalText, text, email, optionalEmail, phone, url, stringList, wholeNumberOr, optionalNumber, objectId,
} from './common.js';
import {
  APPLICATION_SOURCES, RECRUITMENT_LABELS, REQUIREMENT_STATUSES, REQUIREMENT_PRIORITIES,
  HIRING_TYPES, WORK_MODES, REFERRAL_STATUSES, ENQUIRY_STATUSES, ENQUIRY_TYPES, ATS_REVIEW_STATES,
} from '../config/constants.js';

const years = optionalNumber(0, 60);

// The whole set of labels a record should carry after the edit, in the
// fixed order of RECRUITMENT_LABELS and without repeats.
const labels = z
  .array(z.enum(RECRUITMENT_LABELS), { invalid_type_error: 'Send the labels as a list.' })
  .max(RECRUITMENT_LABELS.length * 2, 'That is not a valid set of labels.')
  .transform((chosen) => RECRUITMENT_LABELS.filter((label) => chosen.includes(label)));

export const candidateUpdateSchema = z.object({
  name: requiredText(120),
  phone,
  location: text(120),
  headline: text(160),
  domain: text(120),
  experienceYears: years,
  skills: stringList({ maxItems: 60 }),
  summary: text(4000, { multiline: true }),
  noticePeriod: text(80),
  expectedCompensation: text(120),
  profileUrl: url,
  preferredLocation: text(120),
  source: z.enum(APPLICATION_SOURCES),
  labels,
}).partial();

export const noteSchema = z.object({ text: requiredText(4000, { multiline: true }) });

// No status here: an application is shortlisted through the shortlist
// action, never by editing a field.
export const applicationUpdateSchema = z.object({
  source: z.enum(APPLICATION_SOURCES),
  recruiterNotes: text(8000, { multiline: true }),
  labels,
}).partial();

const requirementFields = {
  contactName: optionalText(120),
  company: optionalText(160),
  email: optionalEmail,
  phone,
  hiringType: z.enum(['', ...HIRING_TYPES]).default(''),
  domain: optionalText(120),
  role: requiredText(300),
  positions: wholeNumberOr(1, 999, 1),
  location: optionalText(160),
  workMode: z.enum(['', ...WORK_MODES]).default(''),
  description: optionalText(6000, { multiline: true }),
  skills: stringList().default([]),
  experience: optionalText(120),
  priority: z.enum(REQUIREMENT_PRIORITIES).default('MEDIUM'),
  status: z.enum(REQUIREMENT_STATUSES).default('NEW'),
  internalNotes: optionalText(8000, { multiline: true }),
};

export const requirementCreateSchema = z.object(requirementFields);
export const requirementUpdateSchema = z.object(requirementFields).partial();

// Staff can correct what the referrer entered about the candidate. The
// email in particular is needed before a referral can be converted.
export const referralUpdateSchema = z.object({
  status: z.enum(REFERRAL_STATUSES),
  candidateName: requiredText(120),
  candidateEmail: optionalEmail,
  candidatePhone: phone,
  candidateRole: text(160),
  candidateProfileUrl: url,
  domain: text(120),
}).partial();

export const enquiryUpdateSchema = z.object({
  status: z.enum(ENQUIRY_STATUSES),
  type: z.enum(ENQUIRY_TYPES),
  internalNotes: text(8000, { multiline: true }),
}).partial();

export const atsRunSchema = z.union([
  z.object({ applicationId: objectId }),
  z.object({ candidateId: objectId, jobId: objectId }),
]);

export const atsReviewSchema = z.object({
  state: z.enum(ATS_REVIEW_STATES),
  note: optionalText(4000, { multiline: true }),
});

export { email };
