import mongoose from 'mongoose';
import { ENQUIRY_TYPES, ENQUIRY_STATUSES } from '../config/constants.js';
import { baseSchemaPlugin, describeFile } from './plugins.js';
import { privateFileSchema } from './shared.js';

const { Schema } = mongoose;

const enquirySchema = new Schema({
  name: { type: String, required: true, trim: true, maxlength: 120 },
  email: { type: String, required: true, lowercase: true, trim: true, maxlength: 254 },
  phone: { type: String, default: '', trim: true, maxlength: 40 },
  company: { type: String, default: '', trim: true, maxlength: 160 },
  type: { type: String, enum: ENQUIRY_TYPES, default: 'GENERAL', index: true },
  subject: { type: String, default: '', trim: true, maxlength: 200 },
  message: { type: String, required: true, maxlength: 6000 },
  attachment: { type: privateFileSchema, default: null },
  status: { type: String, enum: ENQUIRY_STATUSES, default: 'NEW', index: true },
  internalNotes: { type: String, default: '', maxlength: 8000 },
}, { timestamps: true });

enquirySchema.plugin(baseSchemaPlugin);

const baseTransform = enquirySchema.get('toJSON').transform;
enquirySchema.set('toJSON', {
  ...enquirySchema.get('toJSON'),
  transform(doc, ret) {
    const out = baseTransform(doc, ret);
    out.attachment = describeFile(doc.attachment);
    return out;
  },
});

export const Enquiry = mongoose.models.Enquiry || mongoose.model('Enquiry', enquirySchema);
