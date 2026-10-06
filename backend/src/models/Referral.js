import mongoose from 'mongoose';
import { REFERRAL_STATUSES } from '../config/constants.js';
import { baseSchemaPlugin, describeFile } from './plugins.js';
import { privateFileSchema, noteSchema } from './shared.js';

const { Schema } = mongoose;

const referralSchema = new Schema({
  referrerName: { type: String, required: true, trim: true, maxlength: 120 },
  referrerEmail: { type: String, required: true, lowercase: true, trim: true, maxlength: 254 },
  referrerPhone: { type: String, default: '', trim: true, maxlength: 40 },
  relationship: { type: String, default: '', trim: true, maxlength: 160 },
  candidateName: { type: String, required: true, trim: true, maxlength: 120 },
  candidateEmail: { type: String, default: '', lowercase: true, trim: true, maxlength: 254 },
  candidatePhone: { type: String, default: '', trim: true, maxlength: 40 },
  candidateRole: { type: String, default: '', trim: true, maxlength: 160 },
  candidateProfileUrl: { type: String, default: '', trim: true, maxlength: 300 },
  domain: { type: String, default: '', trim: true, maxlength: 120 },
  message: { type: String, default: '', maxlength: 4000 },
  resume: { type: privateFileSchema, default: null },
  status: { type: String, enum: REFERRAL_STATUSES, default: 'NEW', index: true },
  notes: { type: [noteSchema], default: [] },
  // Set when a recruiter converts the referral into a candidate record.
  candidateId: { type: Schema.Types.ObjectId, ref: 'Candidate', default: null },
  consentAt: { type: Date, default: null },
}, { timestamps: true });

referralSchema.plugin(baseSchemaPlugin);

const baseTransform = referralSchema.get('toJSON').transform;
referralSchema.set('toJSON', {
  ...referralSchema.get('toJSON'),
  transform(doc, ret) {
    const out = baseTransform(doc, ret);
    out.candidateId = doc.candidateId ? String(doc.candidateId) : null;
    out.resume = describeFile(doc.resume);
    return out;
  },
});

export const Referral = mongoose.models.Referral || mongoose.model('Referral', referralSchema);
