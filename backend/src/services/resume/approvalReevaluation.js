import { Application, ATSResult } from '../../models/index.js';
import { ATS_ENGINE } from '../../config/constants.js';
import { runEvaluation } from '../atsService.js';
import { record } from '../auditService.js';
import { logger } from '../../utils/logger.js';

/*
  THE RULES AGAIN, AFTER A RECRUITER APPROVES RESUME DATA.

  When fields from a resume extraction are approved, the candidate
  profile the rule-based ATS reads has changed, so its results for that
  candidate are out of date. This runs the existing evaluation
  (runEvaluation in services/atsService.js) again for each job the
  candidate is evaluated against or has applied to. It adds no scoring
  of its own: the weights and rules are the ATS's.

  The recruiter's review. runEvaluation keeps the review on a result
  when it re-runs, which is right when nothing changed. When the result
  did change, an earlier review was a review of a different result, so
  it is marked stale (review.stale, with review.staleSince): the review
  itself is kept, and the admin can show it as "reviewed before the
  result changed". Saving a new review clears the mark. A result whose
  review was never saved has nothing to mark.

  Each re-run result records `reevaluation` (when, why, the score
  before) and is audited. A failure for one job is recorded and does
  not stop the others, and never undoes the approval that led here: the
  caller reports it so a recruiter can run the evaluation again.
*/

// What a recruiter would see change on a result: the scores, the
// skill lists and the checks.
const COMPARED = ['totalScore', 'skillScore', 'preferredSkillScore', 'toolScore', 'experienceScore', 'domainScore', 'locationScore', 'completenessScore', 'band',
  'matchedSkills', 'missingSkills', 'preferredMatched', 'preferredMissing', 'toolsMatched', 'toolsMissing', 'checks'];

function fingerprint(result) {
  const plain = result.toObject ? result.toObject() : result;
  return JSON.stringify(COMPARED.map((field) => plain[field] ?? null));
}

const notFoundError = (error) => error?.status === 404 || error?.statusCode === 404;

/*
  The jobs to evaluate the candidate against: every job they applied to
  (with their latest application to it) and every job they already
  have a result for.
*/
async function targetsFor(candidateId) {
  const [applications, results] = await Promise.all([
    Application.find({ candidateId, jobId: { $ne: null } }).sort({ submittedAt: -1 }).select('jobId'),
    ATSResult.find({ candidateId, engine: ATS_ENGINE }).select('jobId applicationId'),
  ]);
  const targets = new Map();
  for (const application of applications) {
    const jobId = String(application.jobId);
    if (!targets.has(jobId)) targets.set(jobId, application._id);
  }
  for (const result of results) {
    const jobId = String(result.jobId);
    if (!targets.has(jobId)) targets.set(jobId, result.applicationId || null);
  }
  return targets;
}

/*
  reevaluateAfterApproval - returns
    { status, results, failures, skipped }
  status: NONE (nothing to evaluate), UPDATED, PARTIAL (some failed) or
  FAILED (all failed).
*/
export async function reevaluateAfterApproval({ req, candidateId, extractionId }) {
  const actorName = req?.user?.name || 'System';
  const targets = await targetsFor(candidateId);
  const results = [];
  const failures = [];
  const skipped = [];

  for (const [jobId, applicationId] of targets) {
    try {
      const before = await ATSResult.findOne({ candidateId, jobId, engine: ATS_ENGINE });
      const previous = before ? { fingerprint: fingerprint(before), totalScore: before.totalScore, band: before.band } : null;
      const reviewed = Boolean(before?.review?.updatedAt);
      const alreadyStale = Boolean(before?.review?.stale);

      const after = await runEvaluation({ candidateId, jobId, applicationId, runByName: actorName });
      const changed = !previous || fingerprint(after) !== previous.fingerprint;
      const markStale = changed && reviewed && !alreadyStale;
      const now = new Date();
      const set = {
        reevaluation: {
          at: now,
          reason: 'RESUME_APPROVED',
          extractionId,
          byName: actorName,
          previousTotalScore: previous ? previous.totalScore : null,
          previousBand: previous ? previous.band : '',
          changed,
        },
      };
      if (markStale) Object.assign(set, { 'review.stale': true, 'review.staleSince': now });
      await ATSResult.updateOne({ _id: after._id }, { $set: set });

      const entry = {
        jobId,
        resultId: String(after._id),
        previousTotalScore: previous ? previous.totalScore : null,
        totalScore: after.totalScore,
        band: after.band,
        changed,
        created: !previous,
        reviewStale: markStale || alreadyStale,
      };
      results.push(entry);
      await record({
        req,
        action: 'ats.reevaluated',
        entityType: 'atsResult',
        entityId: after._id,
        summary: previous
          ? `Rule-based evaluation re-run after resume data was approved: ${previous.totalScore} to ${after.totalScore}/100${markStale ? '. The earlier review predates this result.' : ''}`
          : `Rule-based evaluation run after resume data was approved: ${after.totalScore}/100`,
        metadata: {
          candidateId: String(candidateId),
          jobId,
          extractionId: String(extractionId),
          previousTotalScore: entry.previousTotalScore,
          totalScore: after.totalScore,
          changed,
          reviewMarkedStale: markStale,
        },
      });
    } catch (error) {
      // A job deleted in the meantime has nothing to evaluate against.
      if (notFoundError(error)) {
        skipped.push(jobId);
        continue;
      }
      logger.error('ats.reevaluation_failed', { candidateId: String(candidateId), jobId, errorName: error?.name || 'Error' });
      failures.push({ jobId, code: 'EVALUATION_FAILED' });
    }
  }

  let status = 'UPDATED';
  if (!results.length && !failures.length) status = 'NONE';
  else if (failures.length && results.length) status = 'PARTIAL';
  else if (failures.length) status = 'FAILED';
  return { status, results, failures, skipped };
}
