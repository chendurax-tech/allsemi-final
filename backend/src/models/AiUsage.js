import mongoose from 'mongoose';
import { AI_OPERATIONS, AI_ERROR_CATEGORIES } from '../config/constants.js';

const { Schema } = mongoose;

/*
  The AI usage ledger: one entry for every request this server sends to
  OpenAI, whether it succeeded or failed (services/aiService.js writes
  it, services/aiUsageService.js reads it for the dashboard).

  It is an internal estimate of usage and spend, kept by ALLSEMIS. It
  is not read from OpenAI's billing and it is not the account balance.

  What an entry holds: when, which model, what the request was for,
  whether it worked, the token counts OpenAI reported, the cost
  estimated from them, and the ids of the records it was about.

  What it never holds: the prompt, the answer, a name, an email
  address, a phone number, resume text or any other candidate content,
  the API key or the provider's error message. The references are
  database ids only.
*/
const aiUsageSchema = new Schema({
  at: { type: Date, required: true, default: Date.now, index: true },
  operation: { type: String, enum: AI_OPERATIONS, required: true },
  // Stored as `aiModel` and returned by the API as `model`.
  aiModel: { type: String, default: '', maxlength: 100 },
  success: { type: Boolean, required: true },
  // Empty for a request that succeeded.
  errorCategory: { type: String, enum: ['', ...AI_ERROR_CATEGORIES], default: '' },
  httpStatus: { type: Number, default: null },
  // As reported by OpenAI. null when the answer carried no usage (a
  // request that never reached the service, for example).
  inputTokens: { type: Number, default: null, min: 0 },
  outputTokens: { type: Number, default: null, min: 0 },
  // US dollars, estimated from the token counts and the model's price.
  // null when there were no token counts or no price is known.
  estimatedCostUsd: { type: Number, default: null, min: 0 },
  durationMs: { type: Number, default: null, min: 0 },

  // What the request was about. Ids only.
  jobId: { type: Schema.Types.ObjectId, ref: 'Job', default: null },
  candidateId: { type: Schema.Types.ObjectId, ref: 'Candidate', default: null },
  applicationId: { type: Schema.Types.ObjectId, ref: 'Application', default: null },
  atsResultId: { type: Schema.Types.ObjectId, ref: 'ATSResult', default: null },
  // For a comparison of several candidates: how many.
  candidateCount: { type: Number, default: null, min: 0 },

  // Who started it.
  actorId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  actorName: { type: String, default: '', maxlength: 120 },
}, { timestamps: false });

const text = (value) => (value ? String(value) : null);

aiUsageSchema.set('toJSON', {
  virtuals: false,
  versionKey: false,
  transform(doc) {
    return {
      id: String(doc._id),
      at: doc.at,
      operation: doc.operation,
      model: doc.aiModel || null,
      success: doc.success,
      errorCategory: doc.errorCategory || null,
      inputTokens: doc.inputTokens ?? null,
      outputTokens: doc.outputTokens ?? null,
      estimatedCostUsd: doc.estimatedCostUsd ?? null,
      jobId: text(doc.jobId),
      candidateId: text(doc.candidateId),
      applicationId: text(doc.applicationId),
      atsResultId: text(doc.atsResultId),
      candidateCount: doc.candidateCount ?? null,
      actorName: doc.actorName || '',
    };
  },
});

export const AiUsage = mongoose.models.AiUsage || mongoose.model('AiUsage', aiUsageSchema);
