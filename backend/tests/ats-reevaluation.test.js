import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import {
  startServer, stopServer, client, signedIn, multipart, applicationFields,
} from './helpers.js';
import { samplePdf } from '../src/seed/samplePdf.js';

/*
  After a recruiter approves resume data, the rule-based ATS is run
  again for the candidate (services/resume/approvalReevaluation.js);
  an earlier review of a changed result is marked stale. Also the
  explanation endpoint and the per-job ranking.
*/

let ctx;
let admin;
let recruiter;
let manager;
let content;

before(async () => {
  ctx = await startServer();
  admin = await signedIn('SUPER_ADMIN');
  recruiter = await signedIn('RECRUITER');
  manager = await signedIn('HIRING_MANAGER');
  content = await signedIn('CONTENT_MANAGER');
});
after(async () => { await stopServer(); });

const RESUME = [
  'Asha Verma',
  'Senior Design Verification Engineer',
  'Bengaluru, India | asha.verma@example.com | +91 98765 43210',
  'Summary',
  'Design verification engineer with 8+ years of experience.',
  'Skills',
  'SystemVerilog, UVM, Python, Synopsys VCS',
  'Experience',
  'Senior Verification Engineer | Example Silicon Pvt Ltd | Jan 2021 - Present',
  '- Wrote Formal Verification properties for an arbiter.',
  'Verification Engineer | Sample Semiconductors | Jul 2018 - Dec 2020',
  '- Verified a DDR4 controller.',
];

async function publishedJob(fields) {
  const made = await recruiter.post('/api/admin/jobs', { json: { experienceLevel: 'Senior', category: 'Semiconductor', location: 'Bengaluru, India', ...fields } });
  assert.equal(made.status, 201, JSON.stringify(made.body));
  const published = await recruiter.patch(`/api/admin/jobs/${made.body.data.id}`, { json: { status: 'published' } });
  assert.equal(published.status, 200);
  return made.body.data;
}

// Applies to a job through the public form: the ATS runs once then,
// on the profile the applicant typed.
async function applyTo(job, email, overrides = {}) {
  const sent = await client().post('/api/applications', {
    form: multipart(applicationFields({ email, name: 'Asha From Form', skills: 'Perl', experienceYears: '1', headline: 'Engineer', location: 'Mysuru, India', jobId: job.id, ...overrides }), { field: 'resume', name: 'cv.pdf', buffer: samplePdf(RESUME), type: 'application/pdf' }),
  });
  assert.equal(sent.status, 201, JSON.stringify(sent.body));
  const candidate = await ctx.models.Candidate.findOne({ email });
  const application = await ctx.models.Application.findOne({ candidateId: candidate._id, jobId: job.id });
  return { candidate, application };
}

async function extractDraft(applicationId) {
  const response = await recruiter.post(`/api/admin/applications/${applicationId}/resume-extraction`);
  assert.equal(response.status, 201);
  assert.equal(response.body.data.status, 'EXTRACTED');
  return response.body.data;
}

const approve = (id, json) => recruiter.post(`/api/admin/resume-extractions/${id}/approve`, { json });
const resultOf = (candidateId, jobId) => ctx.models.ATSResult.findOne({ candidateId, jobId });
const snapshot = async (Model, filter) => JSON.stringify(await Model.find(filter).sort({ _id: 1 }).lean());

// ---------------------------------------------------------------- re-run

test('approval re-runs the ATS with the approved data, and the score follows it', async () => {
  const job = await publishedJob({ title: 'DV Engineer A', requiredSkills: ['SystemVerilog', 'UVM'], preferredSkills: ['Python'] });
  const { candidate, application } = await applyTo(job, 'rerun.score@example.com');
  const first = await resultOf(candidate._id, job.id);
  assert.ok(first, 'the first application ran the ATS');
  assert.deepEqual(first.matchedSkills, [], 'on the typed profile (Perl)');
  const firstScore = first.totalScore;

  const draft = await extractDraft(application._id);
  const response = await approve(draft.id, { fields: ['skills', 'experienceYears', 'location'] });
  assert.equal(response.status, 200, JSON.stringify(response.body));
  const { ats, candidate: updated } = response.body.data;
  assert.equal(ats.status, 'UPDATED');
  assert.equal(ats.evaluated, 1);
  assert.equal(ats.failed, 0);
  assert.equal(ats.message, 'The ATS evaluation was run again with the approved profile.');
  assert.deepEqual(ats.results.map((item) => [item.jobId, item.previousTotalScore, item.changed, item.created]), [[job.id, firstScore, true, false]]);

  // The stored result is the evaluation of the approved profile.
  const rerun = await resultOf(candidate._id, job.id);
  assert.equal(String(rerun._id), String(first._id), 'the same result is updated');
  assert.deepEqual(rerun.matchedSkills, ['SystemVerilog', 'UVM']);
  assert.deepEqual(rerun.preferredMatched, ['Python']);
  assert.equal(rerun.experienceScore, 100, '8 years approved, Senior asks 7');
  assert.ok(rerun.totalScore > firstScore);
  assert.equal(ats.results[0].totalScore, rerun.totalScore);
  assert.deepEqual(updated.skills, ['SystemVerilog', 'UVM', 'Python', 'VCS', 'Design Verification', 'Formal Verification', 'DDR']);
  // The candidate was saved before the rules ran.
  const saved = await ctx.models.Candidate.findById(candidate._id);
  assert.ok(rerun.runAt >= saved.updatedAt);
  assert.equal(rerun.runByName, 'Test RECRUITER');

  // What happened is on the result and in the log.
  assert.deepEqual([rerun.reevaluation.reason, rerun.reevaluation.previousTotalScore, rerun.reevaluation.changed, String(rerun.reevaluation.extractionId)], ['RESUME_APPROVED', firstScore, true, draft.id]);
  const read = await recruiter.get(`/api/admin/ats-results/${rerun._id}`);
  assert.equal(read.body.data.reevaluation.previousTotalScore, firstScore);
  const logs = await admin.get(`/api/admin/audit-logs?entityType=atsResult&entityId=${rerun._id}`);
  assert.ok(logs.body.data.some((entry) => entry.action === 'ats.reevaluated' && entry.metadata.totalScore === rerun.totalScore));
  const extraction = await ctx.models.ResumeExtraction.findById(draft.id);
  assert.deepEqual([extraction.atsReevaluation.status, extraction.atsReevaluation.evaluated, extraction.atsReevaluation.changed], ['UPDATED', 1, 1]);
});

test('an earlier review of a result that changed is marked stale, not passed off as a review of the new score', async () => {
  const job = await publishedJob({ title: 'DV Engineer B', requiredSkills: ['SystemVerilog', 'UVM'] });
  const { candidate, application } = await applyTo(job, 'rerun.review@example.com');
  const first = await resultOf(candidate._id, job.id);
  const reviewed = await recruiter.patch(`/api/admin/ats-results/${first._id}/review`, { json: { state: 'HOLD', note: 'Profile too thin.' } });
  assert.equal(reviewed.status, 200);
  assert.equal(reviewed.body.data.review.scoreAtReview, first.totalScore);
  assert.equal(reviewed.body.data.review.stale, false);

  const draft = await extractDraft(application._id);
  const response = await approve(draft.id, { fields: ['skills'] });
  assert.equal(response.body.data.ats.results[0].reviewStale, true);
  assert.equal(response.body.data.ats.staleReviews, 1);

  const after = (await recruiter.get(`/api/admin/ats-results/${first._id}`)).body.data;
  assert.notEqual(after.totalScore, first.totalScore);
  // The review is kept, as it was, and marked as earlier than the result.
  assert.deepEqual([after.review.state, after.review.note, after.review.reviewerName], ['HOLD', 'Profile too thin.', 'Test RECRUITER']);
  assert.equal(after.review.stale, true);
  assert.ok(after.review.staleSince);
  assert.equal(after.review.scoreAtReview, first.totalScore, 'the score the review was given against');
  const explained = (await recruiter.get(`/api/admin/ats-results/${first._id}/explanation`)).body.data;
  assert.deepEqual(explained.explanation.review, { state: 'HOLD', stale: true, scoreAtReview: first.totalScore });
  const logs = await admin.get(`/api/admin/audit-logs?entityType=atsResult&entityId=${first._id}`);
  assert.ok(logs.body.data.some((entry) => entry.action === 'ats.reevaluated' && entry.metadata.reviewMarkedStale === true));

  // A new review is a review of this result: the mark goes.
  const again = await recruiter.patch(`/api/admin/ats-results/${first._id}/review`, { json: { state: 'ADVANCE', note: 'Resume confirms it.' } });
  assert.deepEqual([again.body.data.review.stale, again.body.data.review.staleSince, again.body.data.review.scoreAtReview], [false, null, after.totalScore]);

  // An approval that changes nothing the ATS reads leaves the review alone.
  const secondDraft = await extractDraft(application._id);
  const unchanged = await approve(secondDraft.id, { fields: ['name'], values: { name: 'Asha Verma' } });
  assert.deepEqual([unchanged.body.data.ats.results[0].changed, unchanged.body.data.ats.results[0].reviewStale], [false, false]);
  const kept = (await recruiter.get(`/api/admin/ats-results/${first._id}`)).body.data;
  assert.deepEqual([kept.review.state, kept.review.stale, kept.reevaluation.changed], ['ADVANCE', false, false]);
});

test('other candidates and other jobs are not touched by an approval', async () => {
  const job = await publishedJob({ title: 'DV Engineer C', requiredSkills: ['UVM'] });
  const other = await publishedJob({ title: 'DV Engineer D', requiredSkills: ['UVM'] });
  const { candidate, application } = await applyTo(job, 'rerun.mine@example.com');
  const bystander = await applyTo(job, 'rerun.bystander@example.com');
  await applyTo(other, 'rerun.elsewhere@example.com');

  const before = {
    bystanderResults: await snapshot(ctx.models.ATSResult, { candidateId: bystander.candidate._id }),
    otherJobResults: await snapshot(ctx.models.ATSResult, { jobId: other.id }),
    bystander: await snapshot(ctx.models.Candidate, { _id: bystander.candidate._id }),
    jobs: await snapshot(ctx.models.Job, { _id: { $in: [job.id, other.id] } }),
    applications: await snapshot(ctx.models.Application, {}),
  };
  const draft = await extractDraft(application._id);
  const response = await approve(draft.id, { fields: ['skills'] });
  assert.equal(response.body.data.ats.evaluated, 1, 'only the job this candidate is evaluated against');
  assert.equal(await snapshot(ctx.models.ATSResult, { candidateId: bystander.candidate._id }), before.bystanderResults);
  assert.equal(await snapshot(ctx.models.ATSResult, { jobId: other.id }), before.otherJobResults);
  assert.equal(await snapshot(ctx.models.Candidate, { _id: bystander.candidate._id }), before.bystander);
  assert.equal(await snapshot(ctx.models.Job, { _id: { $in: [job.id, other.id] } }), before.jobs);
  assert.equal(await snapshot(ctx.models.Application, {}), before.applications, 'no application changes');
  assert.equal(await ctx.models.ATSResult.countDocuments({ candidateId: candidate._id, jobId: other.id }), 0, 'no result is made for a job the candidate never applied to');
});

test('a failed re-run does not undo the approval, and says so', async () => {
  const job = await publishedJob({ title: 'DV Engineer E', requiredSkills: ['UVM'] });
  const { candidate, application } = await applyTo(job, 'rerun.fails@example.com');
  const result = await resultOf(candidate._id, job.id);
  // A result that can no longer be saved: its stored review state is not
  // one the model accepts, so the evaluation fails when it saves.
  await ctx.models.ATSResult.collection.updateOne({ _id: result._id }, { $set: { 'review.state': 'NOT_A_STATE' } });

  const draft = await extractDraft(application._id);
  const response = await approve(draft.id, { fields: ['skills', 'experienceYears'] });
  assert.equal(response.status, 200, 'the approval itself succeeded');
  const { ats, extraction } = response.body.data;
  assert.equal(ats.status, 'FAILED');
  assert.deepEqual(ats.failures, [{ jobId: job.id, code: 'EVALUATION_FAILED' }]);
  assert.match(ats.message, /profile was updated, but the ATS evaluation could not be run again/);
  assert.equal(extraction.status, 'APPROVED');
  assert.deepEqual([extraction.atsReevaluation.status, extraction.atsReevaluation.failed], ['FAILED', 1]);

  const saved = await ctx.models.Candidate.findById(candidate._id);
  assert.ok(saved.skills.includes('UVM'), 'the approved data stays');
  assert.equal(saved.experienceYears, 8);
  const stale = await ctx.models.ATSResult.collection.findOne({ _id: result._id });
  assert.equal(stale.totalScore, result.totalScore, 'the result is as it was');
  const logs = await admin.get(`/api/admin/audit-logs?entityType=candidate&entityId=${candidate._id}`);
  assert.ok(logs.body.data.some((entry) => entry.action === 'ats.reevaluation_failed'));
  assert.ok(logs.body.data.some((entry) => entry.action === 'candidate.resume_extraction_approved'));
});

test('an approval for a candidate with no job runs nothing', async () => {
  const sent = await client().post('/api/applications', {
    form: multipart(applicationFields({ email: 'general.only@example.com' }), { field: 'resume', name: 'cv.pdf', buffer: samplePdf(RESUME), type: 'application/pdf' }),
  });
  assert.equal(sent.status, 201);
  const candidate = await ctx.models.Candidate.findOne({ email: 'general.only@example.com' });
  const application = await ctx.models.Application.findOne({ candidateId: candidate._id });
  const draft = await extractDraft(application._id);
  const response = await approve(draft.id, { fields: ['skills'] });
  assert.deepEqual([response.body.data.ats.status, response.body.data.ats.evaluated], ['NONE', 0]);
  assert.equal(await ctx.models.ATSResult.countDocuments({ candidateId: candidate._id }), 0);
});

// ----------------------------------------------------------- explanation

test('explanation endpoint: the result laid out, with skill gaps the resume can settle', async () => {
  const job = await publishedJob({ title: 'DV Engineer F', requiredSkills: ['SystemVerilog', 'UVM', 'Formal Verification'], preferredSkills: ['Python', 'PCIe'] });
  const { candidate, application } = await applyTo(job, 'explain.me@example.com');
  const draft = await extractDraft(application._id);
  // The recruiter approves only some of the skills the resume names.
  await approve(draft.id, { fields: ['skills'], values: { skills: ['SystemVerilog', 'Python'] } });
  const result = await resultOf(candidate._id, job.id);

  const response = await recruiter.get(`/api/admin/ats-results/${result._id}/explanation`);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  const { explanation, skillGap } = response.body.data;
  assert.equal(explanation.totalScore, result.totalScore);
  assert.equal(explanation.band, result.band);
  assert.deepEqual(explanation.skills.required.missing, ['UVM', 'Formal Verification']);
  assert.deepEqual(skillGap.missingRequired.map((item) => [item.skill, item.status]), [['UVM', 'MENTIONED_IN_RESUME'], ['Formal Verification', 'MENTIONED_IN_RESUME']]);
  assert.equal(skillGap.missingRequired[1].evidence, '- Wrote Formal Verification properties for an arbiter.');
  assert.deepEqual(skillGap.missingPreferred.map((item) => [item.skill, item.status]), [['PCIe', 'NOT_IN_PROFILE']]);
  assert.equal(skillGap.resume.checked, true);
  assert.equal(skillGap.resume.extractionId, draft.id);
  // Not added to the candidate.
  assert.deepEqual((await ctx.models.Candidate.findById(candidate._id)).skills, ['SystemVerilog', 'Python']);
  // No resume text beyond the lines that name a missing skill.
  assert.ok(!JSON.stringify(response.body).includes('DDR4 controller'));

  assert.equal((await manager.get(`/api/admin/ats-results/${result._id}/explanation`)).status, 200);
  assert.equal((await content.get(`/api/admin/ats-results/${result._id}/explanation`)).status, 403);
  assert.equal((await client().get(`/api/admin/ats-results/${result._id}/explanation`)).status, 401);
  assert.equal((await recruiter.get('/api/admin/ats-results/64b000000000000000000000/explanation')).status, 404);
});

// ---------------------------------------------------------------- ranking

test('ranking: the candidates of one job by score, with a fixed order for ties', async () => {
  const job = await publishedJob({ title: 'Ranked Role', requiredSkills: ['SystemVerilog', 'UVM'], preferredSkills: ['Python'] });
  const otherJob = await publishedJob({ title: 'Unranked Role', requiredSkills: ['UVM'] });
  const make = (name, email, skills) => ctx.models.Candidate.create({
    name, email, skills, experienceYears: 8, location: 'Bengaluru, India', headline: 'Verification Engineer', domain: 'Semiconductor', phone: '+91 90000 00000', noticePeriod: '30 days',
    resume: { key: `resumes/ranking/${email}.pdf`, originalName: 'cv.pdf', mimeType: 'application/pdf', size: 10, storage: 'memory' },
  });
  const top = await make('Zara Top', 'rank.top@example.com', ['SystemVerilog', 'UVM', 'Python']);
  const tieB = await make('bravo Tie', 'rank.bravo@example.com', ['SystemVerilog']);
  const tieA = await make('Alpha Tie', 'rank.alpha@example.com', ['SystemVerilog']);
  const low = await make('Low Score', 'rank.low@example.com', []);
  const elsewhere = await make('Other Job Only', 'rank.elsewhere@example.com', ['UVM']);
  const waiting = await make('Not Yet Scored', 'rank.waiting@example.com', ['UVM']);
  for (const candidate of [top, tieB, tieA, low]) {
    await ctx.models.Application.create({ candidateId: candidate._id, jobId: job.id, resume: null });
    const run = await recruiter.post('/api/admin/ats/run', { json: { candidateId: String(candidate._id), jobId: job.id } });
    assert.equal(run.status, 201);
  }
  await recruiter.post('/api/admin/ats/run', { json: { candidateId: String(elsewhere._id), jobId: otherJob.id } });
  await ctx.models.Application.create({ candidateId: waiting._id, jobId: job.id, resume: null });

  const response = await recruiter.get(`/api/admin/jobs/${job.id}/ranking`);
  assert.equal(response.status, 200);
  const { ranking, unranked } = response.body.data;
  assert.deepEqual(response.body.data.job, { id: job.id, title: 'Ranked Role', status: 'published' });
  assert.deepEqual(ranking.map((row) => [row.rank, row.candidate.name]), [[1, 'Zara Top'], [2, 'Alpha Tie'], [3, 'bravo Tie'], [4, 'Low Score']]);
  const scores = ranking.map((row) => row.totalScore);
  assert.deepEqual(scores, [...scores].sort((a, b) => b - a), 'highest first');
  assert.equal(ranking[1].totalScore, ranking[2].totalScore, 'a tie, ordered by name');
  assert.ok(!ranking.some((row) => row.candidate.name === 'Other Job Only'), 'only this job\'s candidates');
  assert.deepEqual(unranked.map((row) => row.candidate.name), ['Not Yet Scored']);

  const row = ranking[0];
  assert.equal(row.band, 'Strong match');
  assert.deepEqual(row.review, { state: 'PENDING', reviewerName: '', updatedAt: null, stale: false });
  assert.ok(row.application.id);
  assert.deepEqual(Object.keys(row.candidate).sort(), ['email', 'experienceYears', 'headline', 'id', 'labels', 'location', 'name']);
  const raw = JSON.stringify(response.body);
  assert.ok(!raw.includes('resumes/ranking/'), 'no storage key');
  assert.ok(!raw.includes('rawText'));

  // The same request gives the same order.
  assert.deepEqual((await recruiter.get(`/api/admin/jobs/${job.id}/ranking`)).body.data.ranking.map((item) => item.resultId), ranking.map((item) => item.resultId));

  // Access.
  assert.equal((await manager.get(`/api/admin/jobs/${job.id}/ranking`)).status, 200, 'reads candidates and ATS results');
  assert.equal((await content.get(`/api/admin/jobs/${job.id}/ranking`)).status, 403);
  assert.equal((await client().get(`/api/admin/jobs/${job.id}/ranking`)).status, 401);
  assert.equal((await recruiter.get('/api/admin/jobs/64b000000000000000000000/ranking')).status, 404);
  assert.equal((await recruiter.get('/api/admin/jobs/not-an-id/ranking')).status, 400);
});
