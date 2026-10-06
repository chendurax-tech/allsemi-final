import mongoose from 'mongoose';
import { JOB_STATUSES, EMPLOYMENT_TYPES, EXPERIENCE_LEVELS } from '../config/constants.js';
import { baseSchemaPlugin } from './plugins.js';

const { Schema } = mongoose;

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
  // Only 'published' jobs are ever returned by the public API.
  status: { type: String, enum: JOB_STATUSES, default: 'draft', index: true },
  featured: { type: Boolean, default: false },
  applicationEnabled: { type: Boolean, default: true },
  publishedAt: { type: Date, default: null },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  updatedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
}, { timestamps: true });

jobSchema.plugin(baseSchemaPlugin, { hidden: ['createdBy', 'updatedBy'] });

export const Job = mongoose.models.Job || mongoose.model('Job', jobSchema);
