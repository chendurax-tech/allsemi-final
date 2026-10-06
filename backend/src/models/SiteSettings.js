import mongoose from 'mongoose';
import { baseSchemaPlugin } from './plugins.js';

const { Schema } = mongoose;

/*
  Site-wide settings: one document, key "site". It holds the public
  contact details so they are edited in one place (Admin, Settings,
  Contact) instead of being repeated through the React code.
*/
const siteSettingsSchema = new Schema({
  key: { type: String, required: true, unique: true, default: 'site' },
  contact: {
    email: { type: String, default: '', trim: true, maxlength: 254 },
    phone: { type: String, default: '', trim: true, maxlength: 40 },
    address: { type: [String], default: [] },
    hours: { type: [String], default: [] },
  },
  updatedByName: { type: String, default: '' },
}, { timestamps: true });

siteSettingsSchema.plugin(baseSchemaPlugin, { hidden: ['key'] });

export const SiteSettings = mongoose.models.SiteSettings || mongoose.model('SiteSettings', siteSettingsSchema);
