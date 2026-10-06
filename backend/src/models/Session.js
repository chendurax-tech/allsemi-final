import mongoose from 'mongoose';

const { Schema } = mongoose;

/*
  A signed-in session. The cookie carries a random token; this
  collection stores only its HMAC (see utils/tokens.js). MongoDB
  removes a session automatically once expiresAt passes (TTL index),
  and deleting the document signs the user out everywhere it was used.
*/
const sessionSchema = new Schema({
  tokenHash: { type: String, required: true, unique: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  expiresAt: { type: Date, required: true },
  lastSeenAt: { type: Date, default: Date.now },
  ip: { type: String, default: '' },
  userAgent: { type: String, default: '', maxlength: 300 },
}, { timestamps: true });

sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const Session = mongoose.models.Session || mongoose.model('Session', sessionSchema);
