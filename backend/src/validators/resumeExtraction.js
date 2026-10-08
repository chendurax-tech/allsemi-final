import { z } from 'zod';
import { requiredText, optionalText, text, phone, stringList, lineList, optionalNumber } from './common.js';
import { RESUME_APPROVAL_FIELDS, RESUME_APPROVAL_LIST_FIELDS, CANDIDATE_PROFILE_LIMITS as L } from '../config/constants.js';

/*
  Approving a resume extraction draft.

  The recruiter names the fields to apply in `fields`: nothing else is
  applied. For a chosen field the value applied is the recruiter's edit
  in `values` when there is one, and the draft's value otherwise. Both
  pass through the same schemas below (approvalValueSchemas), so a value
  read from a resume is held to the same rules as one a recruiter
  types.

  `append` names list fields whose values are added to what the
  candidate already has, without repeats, instead of replacing it.
*/

const experienceEntry = z.object({
  title: text(L.experience.title).default(''),
  employer: text(L.experience.employer).default(''),
  period: text(L.experience.period).default(''),
  highlights: lineList(L.experience.highlights).default([]),
}).refine((entry) => entry.title || entry.employer, 'Give each job a role or an employer.');

const educationEntry = z.object({
  degree: text(L.education.degree).default(''),
  institution: text(L.education.institution).default(''),
  year: text(L.education.year).default(''),
}).refine((entry) => entry.degree || entry.institution, 'Give each entry a degree or an institution.');

const projectEntry = z.object({
  name: requiredText(L.projects.name),
  period: text(L.projects.period).default(''),
  role: text(L.projects.role).default(''),
  description: text(L.projects.description, { multiline: true }).default(''),
  highlights: lineList(L.projects.highlights).default([]),
  technologies: stringList({ maxItems: L.projects.technologies }).default([]),
});

const list = (entry, maxItems) => z.array(entry, { invalid_type_error: 'Send a list.' }).max(maxItems, `Use at most ${maxItems} entries.`);

export const approvalValueSchemas = {
  name: requiredText(120),
  phone,
  location: text(120),
  headline: text(160),
  skills: stringList({ maxItems: L.skills }),
  experienceYears: optionalNumber(0, 60),
  experience: list(experienceEntry, L.experience.maxItems),
  education: list(educationEntry, L.education.maxItems),
  certifications: lineList(L.certifications),
  projects: list(projectEntry, L.projects.maxItems),
};

const unique = (items) => [...new Set(items)];

// Only the values that were sent are parsed, so a field the recruiter
// did not edit stays "not edited" instead of becoming an empty value.
const values = z.record(z.unknown(), { invalid_type_error: 'Send the edited values as an object.' })
  .default({})
  .transform((raw, ctx) => {
    const parsed = {};
    for (const [field, value] of Object.entries(raw)) {
      if (!Object.hasOwn(approvalValueSchemas, field)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: [field], message: 'This field cannot be applied from a resume.' });
        continue;
      }
      const result = approvalValueSchemas[field].safeParse(value);
      if (result.success) parsed[field] = result.data;
      else for (const issue of result.error.issues) ctx.addIssue({ ...issue, path: [field, ...issue.path] });
    }
    return parsed;
  });

export const resumeApprovalSchema = z.object({
  fields: z.array(z.enum(RESUME_APPROVAL_FIELDS), { required_error: 'Choose the fields to apply.', invalid_type_error: 'Send the fields to apply as a list.' })
    .min(1, 'Choose at least one field to apply.')
    .max(RESUME_APPROVAL_FIELDS.length * 2)
    .transform(unique),
  values,
  append: z.array(z.enum(RESUME_APPROVAL_LIST_FIELDS)).max(RESUME_APPROVAL_LIST_FIELDS.length * 2).default([]).transform(unique),
  note: optionalText(1000, { multiline: true }),
}).superRefine((body, ctx) => {
  for (const field of Object.keys(body.values)) {
    if (!body.fields.includes(field)) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['values', field], message: 'An edited value was sent for a field that is not chosen. Choose the field, or leave the value out.' });
  }
  for (const field of body.append) {
    if (!body.fields.includes(field)) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['append'], message: `"${field}" is not among the chosen fields.` });
  }
});

export const resumeDiscardSchema = z.object({
  note: optionalText(1000, { multiline: true }),
});
