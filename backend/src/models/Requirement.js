import mongoose from 'mongoose';
import { REQUIREMENT_STATUSES, REQUIREMENT_PRIORITIES, HIRING_TYPES, WORK_MODES } from '../config/constants.js';
import { baseSchemaPlugin, describeFile } from './plugins.js';
import { privateFileSchema } from './shared.js';

const { Schema } = mongoose;

/*
  A hiring requirement: what an employer sent through "Hire Talent",
  or one a recruiter entered in the admin.
*/
const requirementSchema = new Schema({
  contactName: { type: String, default: '', trim: true, maxlength: 120 },
  company: { type: String, default: '', trim: true, maxlength: 160 },
  email: { type: String, default: '', lowercase: true, trim: true, maxlength: 254 },
  phone: { type: String, default: '', trim: true, maxlength: 40 },
  hiringType: { type: String, enum: ['', ...HIRING_TYPES], default: '' },
  domain: { type: String, default: '', trim: true, maxlength: 120 },
  role: { type: String, required: true, trim: true, maxlength: 300 }, // the role or roles being hired
  positions: { type: Number, default: 1, min: 1, max: 999 },
  location: { type: String, default: '', trim: true, maxlength: 160 },
  workMode: { type: String, enum: ['', ...WORK_MODES], default: '' },
  description: { type: String, default: '', maxlength: 6000 },
  attachment: { type: privateFileSchema, default: null },
  // Recruiter-side detail
  skills: { type: [String], default: [] },
  experience: { type: String, default: '', trim: true, maxlength: 120 },
  priority: { type: String, enum: REQUIREMENT_PRIORITIES, default: 'MEDIUM' },
  status: { type: String, enum: REQUIREMENT_STATUSES, default: 'NEW', index: true },
  internalNotes: { type: String, default: '', maxlength: 8000 },
  source: { type: String, enum: ['WEBSITE', 'ADMIN'], default: 'WEBSITE' },
  consentAt: { type: Date, default: null },
}, { timestamps: true });

requirementSchema.plugin(baseSchemaPlugin);

const baseTransform = requirementSchema.get('toJSON').transform;
requirementSchema.set('toJSON', {
  ...requirementSchema.get('toJSON'),
  transform(doc, ret) {
    const out = baseTransform(doc, ret);
    out.attachment = describeFile(doc.attachment);
    return out;
  },
});

export const Requirement = mongoose.models.Requirement || mongoose.model('Requirement', requirementSchema);
