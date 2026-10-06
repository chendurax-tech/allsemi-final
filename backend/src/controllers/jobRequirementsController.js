import { ok } from '../utils/apiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError, notFound, badRequest } from '../utils/AppError.js';
import { assertObjectId } from '../utils/query.js';
import { ATSResult, Application, Candidate, Job } from '../models/index.js';
import { describeRequirementProfile } from '../models/Job.js';
import { ATS_ENGINE } from '../config/constants.js';
import { reevaluateJob, weightsFor, WEIGHTS, PROFILE_DEFAULT_WEIGHTS } from '../services/atsService.js';
import { assertAiConfigured, draftJobRequirements, compareCandidates } from '../services/aiService.js';
import { record } from '../services/auditService.js';

/*
  What a job asks for, and comparing candidates against it.

  - The REQUIREMENT PROFILE of a job (save, remove, draft with AI).
    A recruiter writes it. The model can draft one from the job
    description when a recruiter asks; a draft is returned to the form
    and is stored only when a recruiter saves it.
  - Running the RULES AGAIN for a job after its profile changed.
  - The AI COMPARISON OF SEVERAL CANDIDATES for one job.

  The two AI actions here run only when someone presses the button for
  them. Nothing here changes an application, a candidate, a label, a
  shortlist or a recruiter's review, and the public job is not touched
  either: a profile is saved without moving the job's "updated" date,
  and the public API never returns a profile.
*/

async function loadJob(req) {
  const job = await Job.findById(assertObjectId(req.params.id));
  if (!job) throw notFound('That job was not found.');
  return job;
}

// How this job is scored by the rules right now, for the editor.
const scoring = (job) => ({ ...weightsFor(job), baseline: WEIGHTS, profileDefaults: PROFILE_DEFAULT_WEIGHTS });

export const saveProfile = asyncHandler(async (req, res) => {
  const job = await loadJob(req);
  const { fromAiDraft, aiModel, ...fields } = req.body;
  const profile = {
    ...fields,
    source: fromAiDraft ? 'AI_REVIEWED' : 'MANUAL',
    aiModel: fromAiDraft ? aiModel : '',
    savedAt: new Date(),
    savedById: req.user.id,
    savedByName: req.user.name,
  };
  const existed = Boolean(job.requirementProfile);
  // `timestamps: false`: the profile is for staff, so saving it does
  // not change the "updated" date visitors see on the job.
  await Job.updateOne({ _id: job._id }, { $set: { requirementProfile: profile } }, { timestamps: false });
  const saved = await Job.findById(job._id);
  await record({
    req,
    action: 'job.requirements_saved',
    entityType: 'job',
    entityId: job._id,
    summary: `${existed ? 'Updated' : 'Added'} the requirement profile of "${job.title}"${fromAiDraft ? ' (from an AI draft, reviewed)' : ''}`,
    metadata: { source: profile.source, ownWeights: Boolean(profile.weights) },
  });
  ok(res, { requirementProfile: describeRequirementProfile(saved.requirementProfile), scoring: scoring(saved) });
});

export const removeProfile = asyncHandler(async (req, res) => {
  const job = await loadJob(req);
  if (job.requirementProfile) {
    await Job.updateOne({ _id: job._id }, { $set: { requirementProfile: null } }, { timestamps: false });
    await record({ req, action: 'job.requirements_removed', entityType: 'job', entityId: job._id, summary: `Removed the requirement profile of "${job.title}"` });
  }
  const saved = await Job.findById(job._id);
  ok(res, { requirementProfile: null, scoring: scoring(saved) });
});

// One draft or comparison per job at a time, in this process: a second
// click is refused instead of paying for the same request twice.
const inFlight = new Set();
async function once(key, work) {
  if (inFlight.has(key)) throw new AppError(409, 'AI_IN_PROGRESS', 'An AI request is already running for this job. Wait for it to finish.');
  inFlight.add(key);
  try {
    return await work();
  } finally {
    inFlight.delete(key);
  }
}

/*
  "Draft with AI": one request to OpenAI with the job as it is written.
  The draft comes back to the form. NOTHING IS STORED here: the job
  keeps the profile it had (or none) until a recruiter saves.
*/
export const draftProfile = asyncHandler(async (req, res) => {
  const id = assertObjectId(req.params.id);
  assertAiConfigured();
  await once(`draft:${id}`, async () => {
    const job = await loadJob(req);
    if (!String(job.description || '').trim() && !String(job.summary || '').trim() && !(job.responsibilities || []).length) {
      throw badRequest('This job has no description, summary or responsibilities to draft a profile from. Add them to the job first.');
    }
    const { draft, model } = await draftJobRequirements({ job, context: { actorId: req.user.id, actorName: req.user.name } });
    await record({ req, action: 'job.requirements_ai_drafted', entityType: 'job', entityId: job._id, summary: `AI drafted a requirement profile for "${job.title}" (not saved)`, metadata: { model } });
    ok(res, { draft, model, saved: false });
  });
});

// Runs the rules again for every existing result of this job. No model.
export const reevaluate = asyncHandler(async (req, res) => {
  const job = await loadJob(req);
  const outcome = await reevaluateJob({ jobId: job._id, runByName: req.user.name });
  await record({ req, action: 'ats.job_reevaluated', entityType: 'job', entityId: job._id, summary: `Rule-based evaluation ran again for ${outcome.evaluated} ${outcome.evaluated === 1 ? 'candidate' : 'candidates'} of "${job.title}"`, metadata: outcome });
  ok(res, outcome);
});

// ---------------------------------------------- comparing several candidates

// The stored comparison as staff see it. Names are looked up now, not
// stored: a comparison holds ids only.
async function describeComparison(job) {
  const stored = job.candidateComparison;
  if (!stored) return null;
  const people = await Candidate.find({ _id: { $in: stored.candidates.map((entry) => entry.candidateId) } }).select('name');
  const names = new Map(people.map((person) => [String(person._id), person.name]));
  return {
    jobId: String(job._id),
    summary: stored.summary,
    candidates: stored.candidates.map((entry) => ({
      resultId: String(entry.resultId),
      candidateId: String(entry.candidateId),
      applicationId: entry.applicationId ? String(entry.applicationId) : null,
      candidateName: names.get(String(entry.candidateId)) || 'Candidate no longer on record',
      label: entry.label,
      overallFit: entry.overallFit,
      standing: entry.standing,
      strengths: [...entry.strengths],
      gaps: [...entry.gaps],
      transferableSkills: [...entry.transferableSkills],
      uncertainties: [...entry.uncertainties],
    })),
    requirements: stored.requirements.map((item) => ({ requirement: item.requirement, comparison: item.comparison })),
    considerations: [...stored.considerations],
    usedRequirementProfile: Boolean(stored.usedRequirementProfile),
    model: stored.aiModel,
    comparedAt: stored.comparedAt,
    comparedByName: stored.comparedByName,
  };
}

export const readComparison = asyncHandler(async (req, res) => {
  const job = await loadJob(req);
  ok(res, { comparison: await describeComparison(job) });
});

/*
  "Compare candidates with AI": a recruiter picks two to five evaluated
  candidates of one job. One request goes to OpenAI with the job (and
  its requirement profile, when it has one) and the candidates,
  labelled "Candidate A", "Candidate B" and so on, with the same
  personal details removed as for a single comparison. The validated
  answer replaces the job's stored comparison.

  That one field is all that is written. No application, candidate,
  label, shortlist, review or ATS result is changed, and no order of
  preference is acted on: the recruiter decides.
*/
export const compareForJob = asyncHandler(async (req, res) => {
  const id = assertObjectId(req.params.id);
  assertAiConfigured();
  await once(`compare:${id}`, async () => {
    const job = await loadJob(req);
    const ids = req.body.resultIds;
    const results = await ATSResult.find({ _id: { $in: ids }, jobId: job._id, engine: ATS_ENGINE });
    if (results.length !== ids.length) throw badRequest('Choose evaluated candidates of this job only. One of the chosen results was not found for it.');
    // In the order the recruiter chose them.
    const ordered = ids.map((resultId) => results.find((result) => String(result._id) === String(resultId).toLowerCase()));
    if (new Set(ordered.map((result) => String(result.candidateId))).size !== ordered.length) throw badRequest('Choose each candidate once.');

    const entries = [];
    for (const result of ordered) {
      const [candidate, linked] = await Promise.all([
        Candidate.findById(result.candidateId),
        result.applicationId ? Application.findById(result.applicationId) : null,
      ]);
      if (!candidate) throw notFound('One of the chosen candidates no longer exists.');
      // Only the cover note of this candidate's own application is used.
      const application = linked && String(linked.candidateId) === String(candidate._id) ? linked : null;
      entries.push({ result, candidate, application });
    }

    const { comparison, labels, model } = await compareCandidates({ job, entries, context: { actorId: req.user.id, actorName: req.user.name } });

    const stored = {
      summary: comparison.summary,
      candidates: comparison.candidates.map((entry, index) => ({
        ...entry,
        label: labels[index],
        resultId: entries[index].result._id,
        candidateId: entries[index].candidate._id,
        applicationId: entries[index].application?._id || null,
      })),
      requirements: comparison.requirements,
      considerations: comparison.considerations,
      usedRequirementProfile: Boolean(job.requirementProfile),
      aiModel: model,
      comparedAt: new Date(),
      comparedById: req.user.id,
      comparedByName: req.user.name,
    };
    const written = await Job.updateOne({ _id: job._id }, { $set: { candidateComparison: stored } }, { timestamps: false });
    const saved = written.matchedCount ? await Job.findById(job._id) : null;
    if (!saved) throw notFound('That job no longer exists. The comparison was not saved.');

    await record({
      req,
      action: 'ats.ai_candidates_compared',
      entityType: 'job',
      entityId: job._id,
      summary: `AI compared ${entries.length} candidates for "${job.title}" (advisory)`,
      metadata: { model, candidates: entries.length, resultIds: ordered.map((result) => String(result._id)) },
    });
    ok(res, { comparison: await describeComparison(saved) });
  });
});
