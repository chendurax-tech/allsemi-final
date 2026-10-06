import mongoose from 'mongoose';
import { APPLICATION_STATUSES, APPLICATION_SOURCES, RECRUITMENT_LABELS, SHORTLIST_EMAIL_STATES } from '../config/constants.js';
import { baseSchemaPlugin, describeFile } from './plugins.js';
import { privateFileSchema } from './shared.js';

const { Schema } = mongoose;

const applicationSchema = new Schema({
  candidateId: { type: Schema.Types.ObjectId, ref: 'Candidate', required: true, index: true },
  // Empty for a general application that is not tied to one job.
  jobId: { type: Schema.Types.ObjectId, ref: 'Job', default: null, index: true },
  // NEW or SHORTLISTED. Only the shortlist action changes it (see
  // services/shortlistService.js); it is not an editable field.
  status: { type: String, enum: APPLICATION_STATUSES, default: 'NEW', index: true },
  // Tags for staff (INTERVIEWED, REJECTED, SELECTED). Not stages: they
  // change no status and trigger nothing.
  labels: { type: [{ type: String, enum: RECRUITMENT_LABELS }], default: [] },
  // Who shortlisted the application and what happened to the email.
  // Empty until the application is shortlisted.
  shortlist: {
    type: new Schema({
      at: { type: Date, default: null },
      byId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
      byName: { type: String, default: '' },
      email: {
        type: new Schema({
          status: { type: String, enum: SHORTLIST_EMAIL_STATES, default: 'NOT_SENT' },
          at: { type: Date, default: null }, // the last attempt
          attempts: { type: Number, default: 0 },
        }, { _id: false }),
        default: () => ({}),
      },
    }, { _id: false }),
    default: null,
  },
  source: { type: String, enum: APPLICATION_SOURCES, default: 'WEBSITE' },
  message: { type: String, default: '', maxlength: 4000 },
  // What the applicant typed into the form for THIS application. It is
  // kept with the application and never copied over an existing
  // candidate profile (see services/candidateService.js).
  submittedProfile: {
    type: new Schema({
      name: { type: String, default: '' },
      phone: { type: String, default: '' },
      location: { type: String, default: '' },
      preferredLocation: { type: String, default: '' },
      headline: { type: String, default: '' },
      domain: { type: String, default: '' },
      experienceYears: { type: Number, default: null },
      skills: { type: [String], default: [] },
      noticePeriod: { type: String, default: '' },
      expectedCompensation: { type: String, default: '' },
      profileUrl: { type: String, default: '' },
    }, { _id: false }),
    default: null,
  },
  recruiterNotes: { type: String, default: '', maxlength: 8000 },
  // The resume sent with this application. Kept here as well as on the
  // candidate, so an earlier application still shows what was sent then.
  resume: { type: privateFileSchema, default: null },
  submittedAt: { type: Date, default: Date.now, index: true },
}, { timestamps: true });

applicationSchema.plugin(baseSchemaPlugin);

const baseTransform = applicationSchema.get('toJSON').transform;
applicationSchema.set('toJSON', {
  ...applicationSchema.get('toJSON'),
  transform(doc, ret) {
    const out = baseTransform(doc, ret);
    out.candidateId = doc.candidateId ? String(doc.candidateId) : null;
    out.jobId = doc.jobId ? String(doc.jobId) : null;
    out.resume = describeFile(doc.resume);
    if (out.shortlist) out.shortlist.byId = doc.shortlist.byId ? String(doc.shortlist.byId) : null;
    return out;
  },
});

export const Application = mongoose.models.Application || mongoose.model('Application', applicationSchema);
