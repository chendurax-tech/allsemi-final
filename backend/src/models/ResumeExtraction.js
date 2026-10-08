import mongoose from 'mongoose';
import { RESUME_DRAFT_STATUSES, RESUME_EXTRACTION_STATUSES, RESUME_EXTRACTION_LIMITS, RESUME_APPROVAL_FIELDS } from '../config/constants.js';
import { baseSchemaPlugin, describeFile } from './plugins.js';

const { Schema } = mongoose;

/*
  One resume extraction: the text of the resume sent with one
  application, read on this server and parsed by rules into a DRAFT
  profile (services/resume/). Started by a recruiter, never by an
  application.

  The draft is a suggestion. It is never copied onto the candidate on
  its own: a recruiter reviews it and approves the fields they choose
  (services/resume/resumeExtractionService.js). Until then the
  candidate record is exactly as it was.

    draft       the values read, in the shape of the candidate fields
    confidence  per field: high, medium, low or null (nothing read)
    evidence    per field: the lines of the resume each value came from
    details     what the parser adds to a field (how the years were
                worked out, how each skill was found, skills listed but
                not known)
    warnings    what could not be read with confidence

  `rawText` is the extracted text, cut to RESUME_EXTRACTION_LIMITS.
  maxTextChars. It stays on the server: it is never part of the JSON,
  never logged, never sent to an AI service. It is cleared when the
  draft is discarded, and the record goes with its candidate.

  The resume reference (key and store) is internal too: the JSON says
  only the file's name, type and size.
*/

const fileReferenceSchema = new Schema({
  key: { type: String, required: true },
  storage: { type: String, default: '' },
  originalName: { type: String, default: '', maxlength: 160 },
  mimeType: { type: String, default: '' },
  size: { type: Number, default: null },
}, { _id: false });

const resumeExtractionSchema = new Schema({
  candidateId: { type: Schema.Types.ObjectId, ref: 'Candidate', required: true, index: true },
  applicationId: { type: Schema.Types.ObjectId, ref: 'Application', default: null, index: true },
  resume: { type: fileReferenceSchema, default: null },

  status: { type: String, enum: RESUME_DRAFT_STATUSES, default: 'PENDING', index: true },
  // Why a FAILED extraction failed, as the text extractor reported it.
  failureReason: { type: String, enum: ['', ...RESUME_EXTRACTION_STATUSES], default: '' },

  // What the text extractor reported. Numbers and names, no content.
  extraction: {
    type: new Schema({
      type: { type: String, default: '' },
      extractor: { type: String, default: '' },
      pages: { type: Number, default: null },
      pagesRead: { type: Number, default: null },
      characters: { type: Number, default: 0 },
      words: { type: Number, default: 0 },
      truncated: { type: Boolean, default: false },
      warnings: { type: [String], default: [] },
      durationMs: { type: Number, default: 0 },
    }, { _id: false }),
    default: null,
  },

  parserVersion: { type: String, default: '' },
  draft: { type: Schema.Types.Mixed, default: null },
  confidence: { type: Schema.Types.Mixed, default: null },
  evidence: { type: Schema.Types.Mixed, default: null },
  details: { type: Schema.Types.Mixed, default: null },
  warnings: {
    type: [new Schema({ field: { type: String, default: null }, code: String, message: String }, { _id: false })],
    default: [],
  },

  rawText: { type: String, default: '', maxlength: RESUME_EXTRACTION_LIMITS.maxTextChars },

  extractedById: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  extractedByName: { type: String, default: '' },

  reviewedById: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  reviewedByName: { type: String, default: '' },
  reviewedAt: { type: Date, default: null },
  reviewNote: { type: String, default: '', maxlength: 1000 },
  // The candidate fields the recruiter applied, and which of those they
  // edited before applying.
  appliedFields: { type: [{ type: String, enum: RESUME_APPROVAL_FIELDS }], default: [] },
  editedFields: { type: [{ type: String, enum: RESUME_APPROVAL_FIELDS }], default: [] },
  // After an approval the rule-based ATS is run again for the candidate
  // (services/resume/approvalReevaluation.js). What came of it: NONE
  // (no job to evaluate against), UPDATED, PARTIAL or FAILED, with
  // counts. Empty until the draft is approved.
  atsReevaluation: {
    type: new Schema({
      status: { type: String, enum: ['NONE', 'UPDATED', 'PARTIAL', 'FAILED'], required: true },
      at: { type: Date, required: true },
      evaluated: { type: Number, default: 0 },
      changed: { type: Number, default: 0 },
      failed: { type: Number, default: 0 },
      staleReviews: { type: Number, default: 0 },
    }, { _id: false }),
    default: null,
  },
}, { timestamps: true });

resumeExtractionSchema.index({ candidateId: 1, createdAt: -1 });
resumeExtractionSchema.plugin(baseSchemaPlugin, { hidden: ['rawText', 'extractedById', 'reviewedById'] });

const baseTransform = resumeExtractionSchema.get('toJSON').transform;
resumeExtractionSchema.set('toJSON', {
  ...resumeExtractionSchema.get('toJSON'),
  transform(doc, ret) {
    const out = baseTransform(doc, ret);
    out.candidateId = String(doc.candidateId);
    out.applicationId = doc.applicationId ? String(doc.applicationId) : null;
    out.resume = doc.resume ? describeFile({ key: doc.resume.key, originalName: doc.resume.originalName, mimeType: doc.resume.mimeType, size: doc.resume.size }) : null;
    // How much text is held, never the text.
    out.rawTextLength = (doc.rawText || '').length;
    return out;
  },
});

export const ResumeExtraction = mongoose.models.ResumeExtraction || mongoose.model('ResumeExtraction', resumeExtractionSchema);
