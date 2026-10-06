import { z } from 'zod';
import {
  requiredText, optionalText, email, optionalEmail, phone, url, stringList, flag, wholeNumberOr, optionalNumber, objectId, honeypotField,
} from './common.js';
import { HIRING_TYPES, WORK_MODES, ENQUIRY_TYPES } from '../config/constants.js';

/*
  The four public submissions. These schemas list every field a visitor
  may send. Anything else in the request (a status, a priority, an
  internal note, an id) is dropped before the handler runs, so a
  visitor cannot set it.
*/

const consent = flag.refine((value) => value === true, 'Please confirm before sending.');

// A. Hire Talent  ->  Requirement
export const requirementFormSchema = z.object({
  ...honeypotField,
  contactName: requiredText(120),
  company: requiredText(160),
  email,
  phone,
  hiringType: z.enum(['', ...HIRING_TYPES]).optional().default(''),
  domain: optionalText(120),
  role: requiredText(300),
  positions: wholeNumberOr(1, 999, 1),
  location: optionalText(160),
  workMode: z.enum(['', ...WORK_MODES]).optional().default(''),
  description: optionalText(6000, { multiline: true }),
  consent,
});

// B. Candidate application  ->  Candidate + Application
export const applicationFormSchema = z.object({
  ...honeypotField,
  name: requiredText(120),
  email,
  phone,
  location: optionalText(120),
  preferredLocation: optionalText(120),
  headline: optionalText(160),
  domain: optionalText(120),
  experienceYears: optionalNumber(0, 60),
  skills: stringList({ maxItems: 40 }).optional().default([]),
  noticePeriod: optionalText(80),
  expectedCompensation: optionalText(120),
  profileUrl: url,
  message: optionalText(4000, { multiline: true }),
  // Present when the form is opened from a job page.
  jobId: z.union([z.literal(''), objectId]).optional().default(''),
  consent,
});

// C. General enquiry  ->  Enquiry
export const enquiryFormSchema = z.object({
  ...honeypotField,
  name: requiredText(120),
  email,
  phone,
  company: optionalText(160),
  type: z.preprocess((value) => (value === '' ? undefined : value), z.enum(ENQUIRY_TYPES).optional().default('GENERAL')),
  subject: optionalText(200),
  message: requiredText(6000, { multiline: true }),
});

// D. Referral  ->  Referral
export const referralFormSchema = z.object({
  ...honeypotField,
  referrerName: requiredText(120),
  referrerEmail: email,
  referrerPhone: phone,
  relationship: optionalText(160),
  candidateName: requiredText(120),
  candidateEmail: optionalEmail,
  candidatePhone: phone,
  candidateRole: optionalText(160),
  candidateProfileUrl: url,
  domain: optionalText(120),
  message: requiredText(4000, { multiline: true }),
  consent,
});
