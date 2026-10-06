import mongoose from 'mongoose';
import { EMAIL_KINDS, EMAIL_LOG_STATES, EMAIL_FAILURE_CATEGORIES } from '../config/constants.js';

const { Schema } = mongoose;

/*
  The email record: one entry for every email this server sends, or
  tries to send, about a stored record (services/email/emailLog.js
  writes it).

  It does two jobs.

  1. It is the duplicate protection. `key` is the type of email and the
     record it is about ("requirementConfirmation:<id>") and is unique,
     so there is one entry per email. An automatic email is attempted
     once: a second automatic attempt for the same key sends nothing.
     After a failure a member of staff can ask for it again, and once
     the email service has accepted it (SENT) it is never sent again.

  2. It says what happened: when, which email, about which record, and
     when the email service refused it, why. The shortlist, regret and
     selection emails are guarded by the application itself
     (services/shortlistService.js, services/decisionEmailService.js)
     and are also written here, so every email has one history.

  What an entry holds: the type, who it was for (the team, the person
  who sent a form, or a candidate), the record, the outcome and the
  time. It does NOT hold the address, the subject or the text of the
  message: those are on the record it points at, and the templates are
  in code. `failure.message` is the email service's own sentence with
  anything that looks like a key removed; it is shown to a super admin
  only.
*/
const emailLogSchema = new Schema({
  key: { type: String, required: true, unique: true, maxlength: 120 },
  template: { type: String, required: true, maxlength: 60 },
  kind: { type: String, enum: EMAIL_KINDS, required: true },
  // TEAM: ADMIN_NOTIFICATION_EMAIL. SENDER: the address typed into the
  // form. CANDIDATE: the candidate of the application.
  recipient: { type: String, enum: ['TEAM', 'SENDER', 'CANDIDATE'], required: true },
  entityType: { type: String, required: true, maxlength: 40, index: true },
  entityId: { type: String, required: true, maxlength: 40, index: true },
  status: { type: String, enum: EMAIL_LOG_STATES, required: true },
  // true: sent by a submission. false: sent by a member of staff.
  automatic: { type: Boolean, default: true },
  attempts: { type: Number, default: 0 },
  at: { type: Date, default: Date.now, index: true }, // the last attempt
  sentAt: { type: Date, default: null },
  // The id the email service gave an accepted message.
  providerId: { type: String, default: '', maxlength: 120 },
  failure: {
    type: new Schema({
      category: { type: String, enum: ['', ...EMAIL_FAILURE_CATEGORIES], default: '' },
      httpStatus: { type: Number, default: null },
      providerError: { type: String, default: '', maxlength: 80 },
      message: { type: String, default: '', maxlength: 320 },
    }, { _id: false }),
    default: null,
  },
  // What is needed to write the same message again (no personal data).
  meta: { type: Schema.Types.Mixed, default: {} },
  // Who sent or resent it, for an email a member of staff started.
  actorId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  actorName: { type: String, default: '', maxlength: 120 },
}, { timestamps: true });

emailLogSchema.index({ entityType: 1, entityId: 1, at: 1 });

export const EmailLog = mongoose.models.EmailLog || mongoose.model('EmailLog', emailLogSchema);
