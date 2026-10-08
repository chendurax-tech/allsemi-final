import mongoose from 'mongoose';
import { APPLICATION_SOURCES, RECRUITMENT_LABELS } from '../config/constants.js';
import { baseSchemaPlugin, describeFile } from './plugins.js';
import { privateFileSchema, noteSchema } from './shared.js';

const { Schema } = mongoose;

/*
  A candidate: one record per person, keyed by email. A second
  application from the same address is attached to this record instead
  of creating another, and does not change it (see
  services/candidateService.js). Candidate data is never returned by a
  public endpoint.
*/
const candidateSchema = new Schema({
  name: { type: String, required: true, trim: true, maxlength: 120 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 254 },
  phone: { type: String, default: '', trim: true, maxlength: 40 },
  location: { type: String, default: '', trim: true, maxlength: 120 },
  headline: { type: String, default: '', trim: true, maxlength: 160 }, // current role
  domain: { type: String, default: '', trim: true, maxlength: 120 },
  experienceYears: { type: Number, default: null, min: 0, max: 60 },
  skills: { type: [String], default: [] },
  summary: { type: String, default: '', maxlength: 4000 },
  noticePeriod: { type: String, default: '', trim: true, maxlength: 80 },
  expectedCompensation: { type: String, default: '', trim: true, maxlength: 120 },
  profileUrl: { type: String, default: '', trim: true, maxlength: 300 },
  preferredLocation: { type: String, default: '', trim: true, maxlength: 120 },
  education: {
    type: [new Schema({ degree: String, institution: String, year: String }, { _id: false })],
    default: [],
  },
  experience: {
    type: [new Schema({ title: String, employer: String, period: String, highlights: [String] }, { _id: false })],
    default: [],
  },
  // Added for resume extraction (services/resume/). Both are optional and
  // empty on every candidate stored before them. They are filled only
  // when a recruiter approves them from a resume extraction draft.
  certifications: { type: [String], default: [] },
  projects: {
    type: [new Schema({
      name: { type: String, default: '' },
      period: { type: String, default: '' },
      role: { type: String, default: '' },
      description: { type: String, default: '' },
      highlights: { type: [String], default: [] },
      technologies: { type: [String], default: [] },
    }, { _id: false })],
    default: [],
  },
  resume: { type: privateFileSchema, default: null },
  // Tags for staff (INTERVIEWED, REJECTED, SELECTED). A candidate has
  // no workflow status of their own: the status lives on each
  // application, and the only step there is SHORTLISTED.
  labels: { type: [{ type: String, enum: RECRUITMENT_LABELS }], default: [] },
  source: { type: String, enum: APPLICATION_SOURCES, default: 'WEBSITE' },
  notes: { type: [noteSchema], default: [] },
  consentAt: { type: Date, default: null },
}, { timestamps: true });

candidateSchema.plugin(baseSchemaPlugin);

// The storage key of the resume stays on the server.
const baseTransform = candidateSchema.get('toJSON').transform;
candidateSchema.set('toJSON', {
  ...candidateSchema.get('toJSON'),
  transform(doc, ret) {
    const out = baseTransform(doc, ret);
    out.resume = describeFile(doc.resume);
    return out;
  },
});

export const Candidate = mongoose.models.Candidate || mongoose.model('Candidate', candidateSchema);
