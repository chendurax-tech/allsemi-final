import { ok } from '../utils/apiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { notFound } from '../utils/AppError.js';
import { assertObjectId } from '../utils/query.js';
import { can } from '../middleware/auth.js';
import { PERMISSIONS as P } from '../config/permissions.js';
import { ATS_ENGINE } from '../config/constants.js';
import {
  ATSResult, Application, Candidate, Job, ResumeExtraction,
} from '../models/index.js';
import { buildMatchExplanation, buildSkillGap } from '../services/matchExplanation.js';

/*
  Reading the rule-based ATS results: why a result scored as it did,
  where the skill gaps are, and the candidates of one job in score
  order. Read only, rules only: these run no ATS, call no model and
  change no record. (Semantic, embedding-based matching is future scope.)
*/

// The resume extraction to compare a result with: the one made from the
// result's own application when there is one, otherwise the candidate's
// latest. Only an extraction that still holds its text (EXTRACTED or
// APPROVED; a discarded one has none).
async function extractionFor(result) {
  const usable = { candidateId: result.candidateId, status: { $in: ['EXTRACTED', 'APPROVED'] }, rawText: { $ne: '' } };
  if (result.applicationId) {
    const own = await ResumeExtraction.findOne({ ...usable, applicationId: result.applicationId }).sort({ createdAt: -1 });
    if (own) return own;
  }
  return ResumeExtraction.findOne(usable).sort({ createdAt: -1 });
}

/*
  GET /ats-results/:id/explanation
  The explanation of one result, and its skill gaps. A role that may
  read resumes also gets which missing skills the resume text names;
  the text itself is never returned.
*/
export const explanation = asyncHandler(async (req, res) => {
  const result = await ATSResult.findById(assertObjectId(req.params.id));
  if (!result) throw notFound('That ATS result was not found.');
  const candidate = await Candidate.findById(result.candidateId).select('skills');
  let resume = null;
  if (can(req, P.RESUMES_READ)) {
    const extraction = await extractionFor(result);
    if (extraction) {
      resume = { text: extraction.rawText, skills: extraction.draft?.skills || [], extractionId: String(extraction._id), status: extraction.status };
    }
  }
  res.set('Cache-Control', 'no-store');
  ok(res, {
    resultId: String(result._id),
    candidateId: String(result.candidateId),
    jobId: String(result.jobId),
    explanation: buildMatchExplanation(result),
    skillGap: buildSkillGap({ result, profileSkills: candidate?.skills || [], resume }),
  });
});

/*
  The order of a job's ranking: the total score, highest first; on a tie
  the required-skills score, highest first; then the candidate's name
  (A to Z, ignoring case and accents); then the candidate id. The same
  results always come out in the same order.
*/
const collator = new Intl.Collator('en', { sensitivity: 'base' });
export function compareRanked(a, b) {
  return (b.totalScore - a.totalScore)
    || ((b.skillScore ?? 0) - (a.skillScore ?? 0))
    || collator.compare(a.candidate.name || '', b.candidate.name || '')
    || (a.candidate.id < b.candidate.id ? -1 : a.candidate.id > b.candidate.id ? 1 : 0);
}

/*
  GET /jobs/:id/ranking
  The candidates evaluated against one job, by their rule-based score.
  Each row carries the candidate fields the recruiter APIs already give
  (no resume, no storage key, no resume text), the score and band, the
  review and whether it is stale, and the candidate's application to
  the job when there is one. Applications to the job that have no
  result yet are listed apart, unranked.
*/
export const jobRanking = asyncHandler(async (req, res) => {
  const job = await Job.findById(assertObjectId(req.params.id));
  if (!job) throw notFound('That job was not found.');
  const [results, applications] = await Promise.all([
    ATSResult.find({ jobId: job._id, engine: ATS_ENGINE }),
    Application.find({ jobId: job._id }).sort({ submittedAt: -1 }).select('candidateId status labels submittedAt'),
  ]);
  const candidateIds = [...new Set([...results, ...applications].map((item) => String(item.candidateId)))];
  const candidates = await Candidate.find({ _id: { $in: candidateIds } }).select('name email headline location experienceYears labels');
  const candidateById = new Map(candidates.map((candidate) => [String(candidate._id), candidate]));
  // The candidate's latest application to this job.
  const applicationByCandidate = new Map();
  for (const application of applications) {
    const id = String(application.candidateId);
    if (!applicationByCandidate.has(id)) applicationByCandidate.set(id, application);
  }

  const describeCandidate = (candidate) => ({
    id: String(candidate._id),
    name: candidate.name,
    email: candidate.email,
    headline: candidate.headline,
    location: candidate.location,
    experienceYears: candidate.experienceYears,
    labels: [...(candidate.labels || [])],
  });
  const describeApplication = (application) => (application ? {
    id: String(application._id), status: application.status, labels: [...(application.labels || [])], submittedAt: application.submittedAt,
  } : null);

  const ranked = results
    .filter((result) => candidateById.has(String(result.candidateId)))
    .map((result) => ({
      resultId: String(result._id),
      candidate: describeCandidate(candidateById.get(String(result.candidateId))),
      application: describeApplication(applicationByCandidate.get(String(result.candidateId))),
      totalScore: result.totalScore,
      band: result.band,
      skillScore: result.skillScore,
      matchedSkills: result.matchedSkills.length,
      missingSkills: result.missingSkills.length,
      requiredSkills: result.requiredSkills.length,
      review: {
        state: result.review?.state || 'PENDING',
        reviewerName: result.review?.reviewerName || '',
        updatedAt: result.review?.updatedAt || null,
        stale: Boolean(result.review?.stale),
      },
      reevaluatedAt: result.reevaluation?.at || null,
      runAt: result.runAt,
      hasAiComparison: Boolean(result.aiComparison),
    }))
    .sort(compareRanked)
    .map((row, index) => ({ rank: index + 1, ...row }));

  const rankedIds = new Set(ranked.map((row) => row.candidate.id));
  const unranked = [...applicationByCandidate.entries()]
    .filter(([id]) => !rankedIds.has(id) && candidateById.has(id))
    .map(([id, application]) => ({ candidate: describeCandidate(candidateById.get(id)), application: describeApplication(application) }));

  res.set('Cache-Control', 'no-store');
  ok(res, {
    job: { id: String(job._id), title: job.title, status: job.status },
    order: 'Total score, highest first; then the required-skills score; then the candidate name; then the candidate id.',
    ranking: ranked,
    unranked,
  });
});
