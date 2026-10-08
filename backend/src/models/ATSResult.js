import mongoose from 'mongoose';
import { ATS_REVIEW_STATES, ATS_ENGINE, AI_COMPARISON_LIMITS as AI } from '../config/constants.js';
import { baseSchemaPlugin } from './plugins.js';

const { Schema } = mongoose;

/*
  One evaluation of one candidate against one job.

  The scores, skill lists and `checks` are produced by the RULE-BASED
  engine (services/atsService.js). Every one of those numbers comes
  from deterministic rules and can be explained from `checks`. No AI
  model is involved in them. A job with a requirement profile is scored
  against it, with the job's own weights when it has them: `weights`
  holds the weights this result was scored with and `weightSource`
  says where they came from.

  `aiComparison` is separate. It is empty until a recruiter presses
  "Compare with AI" for this result, and then holds the advisory
  analysis the model returned (services/aiService.js), validated on the
  server, with who asked for it and when. Running the comparison again
  replaces it. The AI code reads and writes `aiComparison` only: it
  never touches a rule-based field, the recruiter's review or the
  application. Re-running the rule-based evaluation leaves
  `aiComparison` as it is.
*/
const checkSchema = new Schema({
  rule: String,
  result: { type: String, enum: ['pass', 'review', 'fail', 'info'] },
  detail: String,
  score: { type: Number, default: null },
  weight: { type: Number, default: null },
}, { _id: false });

// The limits are AI_COMPARISON_LIMITS (config/constants.js). The answer
// is validated against them before it is stored (services/aiService.js).
// The model's name is stored as `aiModel` and returned by the API as
// `model`.
const evidenceSchema = new Schema({
  requirement: { type: String, required: true, maxlength: AI.evidence.requirement },
  evidence: { type: String, required: true, maxlength: AI.evidence.text },
}, { _id: false });

// strongMatches, partialMatches, missingRequirements, domainRelevance,
// transferableSkills, evidence, uncertainties and
// usedRequirementProfile were added later: a comparison stored before
// that has them empty, and the admin shows what there is.
const aiComparisonSchema = new Schema({
  overallMatch: { type: Number, required: true, min: 0, max: 100 },
  summary: { type: String, required: true, maxlength: AI.summary },
  strongMatches: { type: [String], default: [] },
  partialMatches: { type: [String], default: [] },
  missingRequirements: { type: [String], default: [] },
  domainRelevance: { type: String, default: '', maxlength: AI.domainRelevance },
  transferableSkills: { type: [String], default: [] },
  evidence: { type: [evidenceSchema], default: [] },
  uncertainties: { type: [String], default: [] },
  // Whether the job had a requirement profile when the comparison ran.
  usedRequirementProfile: { type: Boolean, default: false },
  matchedSkills: { type: [String], default: [] },
  missingSkills: { type: [String], default: [] },
  relevantExperience: { type: String, required: true, maxlength: AI.relevantExperience },
  experienceGaps: { type: [String], default: [] },
  qualificationAssessment: { type: String, required: true, maxlength: AI.qualificationAssessment },
  strengths: { type: [String], default: [] },
  concerns: { type: [String], default: [] },
  recommendation: { type: String, required: true, maxlength: AI.recommendation },
  aiModel: { type: String, required: true, maxlength: AI.model },
  comparedAt: { type: Date, required: true },
  comparedById: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  comparedByName: { type: String, default: '' },
}, { _id: false });

const atsResultSchema = new Schema({
  candidateId: { type: Schema.Types.ObjectId, ref: 'Candidate', required: true, index: true },
  jobId: { type: Schema.Types.ObjectId, ref: 'Job', required: true, index: true },
  applicationId: { type: Schema.Types.ObjectId, ref: 'Application', default: null },
  engine: { type: String, default: ATS_ENGINE },
  engineVersion: { type: String, default: '1' },

  totalScore: { type: Number, required: true },
  skillScore: { type: Number, required: true },
  preferredSkillScore: { type: Number, default: null },
  // Only for a job with a requirement profile that lists tools.
  toolScore: { type: Number, default: null },
  experienceScore: { type: Number, required: true },
  domainScore: { type: Number, required: true },
  locationScore: { type: Number, required: true },
  completenessScore: { type: Number, required: true },
  weights: { type: Schema.Types.Mixed, default: {} },
  // Where the weights came from: BASELINE (the fixed weights), PROFILE
  // (the job has a requirement profile) or JOB (the job's own weights).
  weightSource: { type: String, enum: ['BASELINE', 'PROFILE', 'JOB'], default: 'BASELINE' },
  usedRequirementProfile: { type: Boolean, default: false },
  band: { type: String, default: '' },

  requiredSkills: { type: [String], default: [] },
  matchedSkills: { type: [String], default: [] },
  missingSkills: { type: [String], default: [] },
  preferredMatched: { type: [String], default: [] },
  preferredMissing: { type: [String], default: [] },
  toolsMatched: { type: [String], default: [] },
  toolsMissing: { type: [String], default: [] },
  checks: { type: [checkSchema], default: [] },

  review: {
    state: { type: String, enum: ATS_REVIEW_STATES, default: 'PENDING' },
    note: { type: String, default: '', maxlength: 4000 },
    reviewerId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    reviewerName: { type: String, default: '' },
    updatedAt: { type: Date, default: null },
    // True when the rules were re-run after this review was saved (after
    // a recruiter approved resume data for the candidate) and the result
    // changed: the review was a review of an earlier result. Saving a
    // new review clears it. The review itself is kept as it was.
    stale: { type: Boolean, default: false },
    staleSince: { type: Date, default: null },
    // The total score the result had when the review was saved.
    scoreAtReview: { type: Number, default: null },
  },
  // The last time the rules were re-run because a recruiter approved
  // resume data for the candidate (services/resume/approvalReevaluation.js),
  // and what the result was before. Empty until that happens.
  reevaluation: {
    type: new Schema({
      at: { type: Date, required: true },
      reason: { type: String, enum: ['RESUME_APPROVED'], default: 'RESUME_APPROVED' },
      extractionId: { type: Schema.Types.ObjectId, ref: 'ResumeExtraction', default: null },
      byName: { type: String, default: '' },
      previousTotalScore: { type: Number, default: null },
      previousBand: { type: String, default: '' },
      changed: { type: Boolean, default: false },
    }, { _id: false }),
    default: null,
  },
  runAt: { type: Date, default: Date.now },
  runByName: { type: String, default: 'System' },

  // The advisory AI comparison. Empty until a recruiter asks for one.
  aiComparison: { type: aiComparisonSchema, default: null },
}, { timestamps: true });

// One result per candidate, job and engine: running the rule-based
// evaluation again updates the same result.
atsResultSchema.index({ candidateId: 1, jobId: 1, engine: 1 }, { unique: true });
atsResultSchema.plugin(baseSchemaPlugin);

const baseTransform = atsResultSchema.get('toJSON').transform;
atsResultSchema.set('toJSON', {
  ...atsResultSchema.get('toJSON'),
  transform(doc, ret) {
    const out = baseTransform(doc, ret);
    out.candidateId = String(doc.candidateId);
    out.jobId = String(doc.jobId);
    out.applicationId = doc.applicationId ? String(doc.applicationId) : null;
    if (out.review) {
      out.review = {
        state: doc.review.state,
        note: doc.review.note,
        reviewerName: doc.review.reviewerName,
        updatedAt: doc.review.updatedAt,
        stale: Boolean(doc.review.stale),
        staleSince: doc.review.staleSince || null,
        scoreAtReview: doc.review.scoreAtReview ?? null,
      };
    }
    const again = doc.reevaluation;
    out.reevaluation = again ? {
      at: again.at,
      reason: again.reason,
      extractionId: again.extractionId ? String(again.extractionId) : null,
      byName: again.byName || '',
      previousTotalScore: again.previousTotalScore ?? null,
      previousBand: again.previousBand || '',
      changed: Boolean(again.changed),
    } : null;
    // Always present: null until a comparison has been run. The id of
    // the person who ran it stays on the server; their name is enough.
    const ai = doc.aiComparison;
    out.aiComparison = ai ? {
      overallMatch: ai.overallMatch,
      summary: ai.summary,
      strongMatches: [...(ai.strongMatches || [])],
      partialMatches: [...(ai.partialMatches || [])],
      missingRequirements: [...(ai.missingRequirements || [])],
      domainRelevance: ai.domainRelevance || '',
      transferableSkills: [...(ai.transferableSkills || [])],
      evidence: (ai.evidence || []).map((item) => ({ requirement: item.requirement, evidence: item.evidence })),
      uncertainties: [...(ai.uncertainties || [])],
      usedRequirementProfile: Boolean(ai.usedRequirementProfile),
      matchedSkills: [...(ai.matchedSkills || [])],
      missingSkills: [...(ai.missingSkills || [])],
      relevantExperience: ai.relevantExperience,
      experienceGaps: [...(ai.experienceGaps || [])],
      qualificationAssessment: ai.qualificationAssessment,
      strengths: [...(ai.strengths || [])],
      concerns: [...(ai.concerns || [])],
      recommendation: ai.recommendation,
      model: ai.aiModel,
      comparedAt: ai.comparedAt,
      comparedByName: ai.comparedByName,
    } : null;
    return out;
  },
});

export const ATSResult = mongoose.models.ATSResult || mongoose.model('ATSResult', atsResultSchema);
