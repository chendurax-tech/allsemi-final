import mongoose from 'mongoose';

const { Schema } = mongoose;

/*
  An append-only record of sensitive actions: sign-ins, status changes,
  publishing, resume access, user and role changes. Entries are written
  by services/auditService.js and are never updated or deleted by the
  running application. Two maintenance commands remove entries, on a
  development or showcase database only: the seed with --reset, and
  the showcase cleanup, which removes the entries about the
  demonstration records it deletes (services/showcaseCleanup.js).
  `metadata` holds only what explains the action (old and
  new status, a changed field list). It never holds a password, a
  token, a storage key or a document.
*/
const auditLogSchema = new Schema({
  actorId: { type: Schema.Types.ObjectId, ref: 'User', default: null, index: true },
  actorName: { type: String, default: 'System' },
  actorRole: { type: String, default: '' },
  action: { type: String, required: true, index: true }, // e.g. "application.shortlisted"
  entityType: { type: String, default: '', index: true },
  entityId: { type: String, default: '', index: true },
  summary: { type: String, default: '', maxlength: 400 },
  metadata: { type: Schema.Types.Mixed, default: {} },
  ip: { type: String, default: '' },
  at: { type: Date, default: Date.now, index: true },
});

auditLogSchema.set('toJSON', {
  versionKey: false,
  transform(doc, ret) {
    ret.id = String(ret._id);
    delete ret._id;
    ret.actorId = doc.actorId ? String(doc.actorId) : null;
    delete ret.ip;
    return ret;
  },
});

export const AuditLog = mongoose.models.AuditLog || mongoose.model('AuditLog', auditLogSchema);
