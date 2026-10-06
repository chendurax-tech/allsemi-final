import mongoose from 'mongoose';
import {
  JOB_STATUSES, EMPLOYMENT_TYPES, EXPERIENCE_LEVELS, WORK_ARRANGEMENTS, REQUIREMENT_PROFILE_SOURCES,
  REQUIREMENT_PROFILE_LIMITS as PROFILE, CANDIDATE_COMPARISON_LIMITS as COMPARE,
} from '../config/constants.js';
import { baseSchemaPlugin } from './plugins.js';

const { Schema } = mongoose;

/*
  The requirement profile: what this job asks for, in a structured
  form. It is optional. A job without one is evaluated by the rule-based
  ATS exactly as before, with the baseline weights.

  A profile is written by a recruiter. The model can draft one from the
  job description when a recruiter asks for it (services/aiService.js),
  and the draft is only ever stored after a recruiter has read it and
  saved it. `weights` are this job's own weights for the rule-based
  score (see services/atsService.js); null means the default weights.

  It is for staff: the public API never returns it
  (controllers/publicController.js lists the fields a visitor gets).
*/
const requirementProfileSchema = new Schema({
  requiredSkills: { type: [String], default: [] },
  preferredSkills: { type: [String], default: [] },
  tools: { type: [String], default: [] },
  domains: { type: [String], default: [] },
  requiredExperience: { type: String, default: '', maxlength: PROFILE.text },
  minYears: { type: Number, default: null, min: 0, max: PROFILE.years },
  preferredExperience: { type: String, default: '', maxlength: PROFILE.text },
  preferredYears: { type: Number, default: null, min: 0, max: PROFILE.years },
  education: { type: [String], default: [] },
  certifications: { type: [String], default: [] },
  seniority: { type: String, default: '', maxlength: PROFILE.short },
  location: { type: String, default: '', maxlength: PROFILE.short },
  workArrangement: { type: String, enum: WORK_ARRANGEMENTS, default: '' },
  responsibilities: { type: [String], default: [] },
  niceToHave: { type: [String], default: [] },
  constraints: { type: [String], default: [] },
  // { skills, experience, preferredSkills, tools, domain, location,
  // completeness }: whole numbers from 0 to 100, or null.
  weights: { type: Schema.Types.Mixed, default: null },
  // MANUAL: typed by a recruiter. AI_REVIEWED: drafted by the model,
  // then read and saved by a recruiter.
  source: { type: String, enum: REQUIREMENT_PROFILE_SOURCES, default: 'MANUAL' },
  aiModel: { type: String, default: '', maxlength: 100 },
  savedAt: { type: Date, default: null },
  savedById: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  savedByName: { type: String, default: '' },
}, { _id: false });

/*
  The latest AI comparison of several candidates for this job. Advisory,
  started by a recruiter, replaced by the next one. Candidates are
  referred to by id; no name is stored here. It is removed when one of
  its candidates is deleted.
*/
const comparedCandidateSchema = new Schema({
  resultId: { type: Schema.Types.ObjectId, ref: 'ATSResult', required: true },
  candidateId: { type: Schema.Types.ObjectId, ref: 'Candidate', required: true },
  applicationId: { type: Schema.Types.ObjectId, ref: 'Application', default: null },
  label: { type: String, required: true, maxlength: 20 },
  overallFit: { type: Number, required: true, min: 0, max: 100 },
  standing: { type: String, required: true, maxlength: COMPARE.text },
  strengths: { type: [String], default: [] },
  gaps: { type: [String], default: [] },
  transferableSkills: { type: [String], default: [] },
  uncertainties: { type: [String], default: [] },
}, { _id: false });

const comparedRequirementSchema = new Schema({
  requirement: { type: String, required: true, maxlength: COMPARE.requirements.requirement },
  comparison: { type: String, required: true, maxlength: COMPARE.requirements.note },
}, { _id: false });

const candidateComparisonSchema = new Schema({
  summary: { type: String, required: true, maxlength: COMPARE.summary },
  candidates: { type: [comparedCandidateSchema], default: [] },
  requirements: { type: [comparedRequirementSchema], default: [] },
  considerations: { type: [String], default: [] },
  usedRequirementProfile: { type: Boolean, default: false },
  aiModel: { type: String, required: true, maxlength: 100 },
  comparedAt: { type: Date, required: true },
  comparedById: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  comparedByName: { type: String, default: '' },
}, { _id: false });

const jobSchema = new Schema({
  title: { type: String, required: true, trim: true, maxlength: 160 },
  slug: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 100 },
  category: { type: String, default: '', trim: true, maxlength: 80 },
  department: { type: String, default: '', trim: true, maxlength: 120 },
  location: { type: String, default: '', trim: true, maxlength: 120 },
  employmentType: { type: String, enum: EMPLOYMENT_TYPES, default: 'Full-time' },
  experienceLevel: { type: String, enum: EXPERIENCE_LEVELS, default: 'Mid-Senior' },
  summary: { type: String, default: '', maxlength: 600 },
  description: { type: String, default: '', maxlength: 8000 },
  responsibilities: { type: [String], default: [] },
  requiredSkills: { type: [String], default: [] },
  preferredSkills: { type: [String], default: [] },
  keywords: { type: [String], default: [] },
  // Optional. See requirementProfileSchema above.
  requirementProfile: { type: requirementProfileSchema, default: null },
  // Read through its own admin endpoint, never with the job.
  candidateComparison: { type: candidateComparisonSchema, default: null },
  // Only 'published' jobs are ever returned by the public API.
  status: { type: String, enum: JOB_STATUSES, default: 'draft', index: true },
  featured: { type: Boolean, default: false },
  applicationEnabled: { type: Boolean, default: true },
  publishedAt: { type: Date, default: null },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  updatedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
}, { timestamps: true });

jobSchema.plugin(baseSchemaPlugin, { hidden: ['createdBy', 'updatedBy', 'candidateComparison'] });

// What staff are told about a profile: everything in it except the id
// of the person who saved it. Always present on a job: null when the
// job has none.
export function describeRequirementProfile(profile) {
  if (!profile) return null;
  const list = (items) => [...(items || [])];
  return {
    requiredSkills: list(profile.requiredSkills),
    preferredSkills: list(profile.preferredSkills),
    tools: list(profile.tools),
    domains: list(profile.domains),
    requiredExperience: profile.requiredExperience || '',
    minYears: profile.minYears ?? null,
    preferredExperience: profile.preferredExperience || '',
    preferredYears: profile.preferredYears ?? null,
    education: list(profile.education),
    certifications: list(profile.certifications),
    seniority: profile.seniority || '',
    location: profile.location || '',
    workArrangement: profile.workArrangement || '',
    responsibilities: list(profile.responsibilities),
    niceToHave: list(profile.niceToHave),
    constraints: list(profile.constraints),
    weights: profile.weights ? { ...profile.weights } : null,
    source: profile.source || 'MANUAL',
    model: profile.aiModel || null,
    savedAt: profile.savedAt || null,
    savedByName: profile.savedByName || '',
  };
}

const baseTransform = jobSchema.get('toJSON').transform;
jobSchema.set('toJSON', {
  ...jobSchema.get('toJSON'),
  transform(doc, ret) {
    const out = baseTransform(doc, ret);
    out.requirementProfile = describeRequirementProfile(doc.requirementProfile);
    return out;
  },
});

export const Job = mongoose.models.Job || mongoose.model('Job', jobSchema);
