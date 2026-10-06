import { ok, created } from '../utils/apiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError, notFound, badRequest } from '../utils/AppError.js';
import { pagination, equalityFilters, assertObjectId } from '../utils/query.js';
import { ATSResult, Application, Candidate, Job } from '../models/index.js';
import { ATS_REVIEW_STATES, ATS_ENGINE, ATS_WEIGHT_KEYS } from '../config/constants.js';
import { runEvaluation, WEIGHTS, PROFILE_DEFAULT_WEIGHTS, ENGINE_VERSION } from '../services/atsService.js';
import { aiStatus, assertAiConfigured, compareCandidateToJob } from '../services/aiService.js';
import { record } from '../services/auditService.js';

/*
  ATS results for the admin.

  Two separate things live on one result:
  - the RULE-BASED evaluation (list, read, run, review). Deterministic,
    no model involved. It runs with a first application and whenever
    staff run it.
  - the AI comparison (aiCompare). It calls OpenAI and runs ONLY when a
    recruiter asks for it with POST /ats-results/:id/ai-comparison.
    Reading or listing results, running the rules, opening a candidate
    or an application, shortlisting and labels never call a model.

  Neither one changes an application: no status, no shortlist, no
  label, no email. Both are advice. The recruiter decides, and
  shortlisting stays its own action (services/shortlistService.js).
*/

export const list = asyncHandler(async (req, res) => {
  const { page, limit, skip } = pagination(req.query);
  const filter = equalityFilters(req.query, {
    candidateId: { objectId: true },
    jobId: { objectId: true },
    review: { field: 'review.state', allowed: ATS_REVIEW_STATES },
  });
  const [items, total] = await Promise.all([
    ATSResult.find(filter).sort({ runAt: -1 }).skip(skip).limit(limit),
    ATSResult.countDocuments(filter),
  ]);
  ok(res, items.map((item) => item.toJSON()), { total, page, limit });
});

export const read = asyncHandler(async (req, res) => {
  const result = await ATSResult.findById(assertObjectId(req.params.id));
  if (!result) throw notFound('That ATS result was not found.');
  ok(res, result.toJSON());
});

// What the engine is and how it scores, and whether the AI comparison
// can be used, for the admin to display. No credential is returned.
export const engine = asyncHandler(async (req, res) => {
  ok(res, {
    engine: ATS_ENGINE,
    label: 'RULE-BASED ATS',
    version: ENGINE_VERSION,
    // The baseline: every job without a requirement profile.
    weights: WEIGHTS,
    // The starting weights of a job with a requirement profile, and the
    // parts a job can weight for itself.
    profileWeights: PROFILE_DEFAULT_WEIGHTS,
    weightKeys: ATS_WEIGHT_KEYS,
    ai: aiStatus(),
  });
});

export const run = asyncHandler(async (req, res) => {
  let { candidateId, jobId } = req.body;
  let applicationId = null;
  if (req.body.applicationId) {
    const application = await Application.findById(req.body.applicationId);
    if (!application) throw notFound('That application was not found.');
    if (!application.jobId) throw badRequest('A general application has no job to evaluate against.');
    candidateId = application.candidateId;
    jobId = application.jobId;
    applicationId = application._id;
  }
  const result = await runEvaluation({ candidateId, jobId, applicationId, runByName: req.user.name });
  await record({ req, action: 'ats.evaluated', entityType: 'atsResult', entityId: result._id, summary: `Rule-based evaluation ran: ${result.totalScore}/100`, metadata: { candidateId: String(result.candidateId), jobId: String(result.jobId), totalScore: result.totalScore } });
  created(res, result.toJSON());
});

export const review = asyncHandler(async (req, res) => {
  const result = await ATSResult.findById(assertObjectId(req.params.id));
  if (!result) throw notFound('That ATS result was not found.');
  const from = result.review?.state || 'PENDING';
  result.review = {
    state: req.body.state,
    note: req.body.note,
    reviewerId: req.user.id,
    reviewerName: req.user.name,
    updatedAt: new Date(),
  };
  await result.save();
  await record({ req, action: 'ats.reviewed', entityType: 'atsResult', entityId: result._id, summary: `Recruiter review: ${from} to ${req.body.state}`, metadata: { from, to: req.body.state, candidateId: String(result.candidateId), jobId: String(result.jobId) } });
  ok(res, result.toJSON());
});

// The results an AI comparison is running for at this moment, in this
// process. A second click on the same result is refused instead of
// paying for the same comparison twice. With more than one instance
// this guard is per instance, like the rate limits.
const aiInFlight = new Set();

/*
  "Compare with AI": a recruiter asks for an advisory comparison of the
  candidate and the job of one existing result. One request goes to
  OpenAI (services/aiService.js), the answer is validated, stored in
  `aiComparison` on the same result (replacing an earlier one) and
  audited. Nothing else is written: the rule-based fields, the review
  and the application are left exactly as they are. An answer that
  fails validation stores nothing.
*/
export const aiCompare = asyncHandler(async (req, res) => {
  const id = assertObjectId(req.params.id);
  // Checked first, so nothing is loaded or sent when AI is not set up.
  assertAiConfigured();
  if (aiInFlight.has(id)) {
    throw new AppError(409, 'AI_IN_PROGRESS', 'An AI comparison is already running for this result. Wait for it to finish.');
  }
  aiInFlight.add(id);
  try {
    const result = await ATSResult.findById(id);
    if (!result) throw notFound('That ATS result was not found.');
    const [candidate, job, linked] = await Promise.all([
      Candidate.findById(result.candidateId),
      Job.findById(result.jobId),
      result.applicationId ? Application.findById(result.applicationId) : null,
    ]);
    if (!candidate) throw notFound('The candidate for this result no longer exists.');
    if (!job) throw notFound('The job for this result no longer exists.');
    // Only the cover note of this candidate's own application is used.
    const application = linked && String(linked.candidateId) === String(candidate._id) ? linked : null;

    const { comparison, model } = await compareCandidateToJob({
      candidate,
      job,
      application,
      // Ids for the usage ledger. No content.
      context: { atsResultId: result._id, actorId: req.user.id, actorName: req.user.name },
    });

    // One field is written, and only if the result still exists: the
    // candidate may have been deleted while the comparison ran.
    const stored = await ATSResult.updateOne(
      { _id: result._id },
      { $set: { aiComparison: { ...comparison, usedRequirementProfile: Boolean(job.requirementProfile), aiModel: model, comparedAt: new Date(), comparedById: req.user.id, comparedByName: req.user.name } } },
    );
    const saved = stored.matchedCount ? await ATSResult.findById(result._id) : null;
    if (!saved) throw notFound('That ATS result no longer exists. The comparison was not saved.');

    await record({
      req,
      action: 'ats.ai_compared',
      entityType: 'atsResult',
      entityId: saved._id,
      summary: `AI comparison ran (advisory): ${comparison.overallMatch}/100`,
      metadata: { candidateId: String(saved.candidateId), jobId: String(saved.jobId), model, overallMatch: comparison.overallMatch },
    });
    ok(res, saved.toJSON());
  } finally {
    aiInFlight.delete(id);
  }
});
