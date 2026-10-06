import mongoose from 'mongoose';
import { ROLES } from '../config/constants.js';
import { baseSchemaPlugin } from './plugins.js';

const { Schema } = mongoose;

const userSchema = new Schema({
  name: { type: String, required: true, trim: true, maxlength: 120 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 254 },
  // Never selected by default, and removed from JSON by the plugin.
  passwordHash: { type: String, required: true, select: false },
  role: { type: String, enum: ROLES, required: true },
  active: { type: Boolean, default: true },
  mustChangePassword: { type: Boolean, default: false },
  lastLoginAt: { type: Date, default: null },
  failedLogins: { type: Number, default: 0 },
  lockedUntil: { type: Date, default: null },
}, { timestamps: true });

userSchema.plugin(baseSchemaPlugin, { hidden: ['passwordHash', 'failedLogins', 'lockedUntil'] });

export const User = mongoose.models.User || mongoose.model('User', userSchema);
