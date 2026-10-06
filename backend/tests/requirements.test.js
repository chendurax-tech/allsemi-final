import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import {
  startServer, stopServer, client, signedIn, multipart, applicationFields, pdfBytes, wait,
} from './helpers.js';

/*
  Job requirement profiles, the rule-based ATS that reads them, and the
  AI actions around them: the draft of a profile, the comparison of one
  candidate with a job and the comparison of several candidates.

  No request ever leaves the machine. Each test that could reach OpenAI
  replaces fetch so that requests to api.openai.com are answered by a
  fake (openAiStub below, the same as in admin.test.js); every other
  request, the tests' own HTTP client talking to the local server, goes
  to the real fetch. The real fetch is put back when the test ends.

  Every expected score is worked out by hand in the comment next to it.
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

const audit = async (query) => (await admin.get(`/api/admin/audit-logs?${query}`)).body.data;
const auditActions = async (query) => (await audit(query)).map((entry) => entry.action);

// ------------------------------------------------------------ fixtures

const BASELINE = { skills: 45, experience: 20, preferredSkills: 10, domain: 10, location: 10, completeness: 5 };
const PROFILE_DEFAULTS = { skills: 40, experience: 20, preferredSkills: 10, tools: 10, domain: 10, location: 5, completeness: 5 };

let jobCount = 0;
async function makeJob(tag, fields = {}) {
  jobCount += 1;
  return ctx.models.Job.create({
    title: `Design Verification Engineer ${tag}`,
    slug: `req-${tag}-${jobCount}`,
    status: 'published',
    category: 'Semiconductor',
    department: 'Verification',
    location: 'Bengaluru, India',
    experienceLevel: 'Mid-Senior',
    summary: 'Block-level verification of a PCIe controller.',
    description: 'Own the constrained-random testbench and the coverage closure.',
    responsibilities: ['Write the verification plan'],
    requiredSkills: ['SystemVerilog', 'UVM', 'Formal Verification', 'Assertions'],
    preferredSkills: ['Python', 'Perl'],
    ...fields,
  });
}

// A candidate entered by staff, with no resume: the profile is seven
// eighths complete (87.5, rounded 88).
async function makeCandidate(tag, fields = {}) {
  return ctx.models.Candidate.create({
    name: `Scored Candidate ${tag}`,
    email: `scored.${tag}@example.com`,
    phone: '+91 90000 41001',
    location: 'Pune, India',
    headline: 'Verification Engineer',
    domain: 'Semiconductor',
    experienceYears: 2,
    skills: ['UVM', 'System Verilog', 'Python', 'VCS'],
    noticePeriod: '30 days',
    education: [{ degree: 'B.Tech Electronics', institution: 'Example Institute of Technology' }],
    ...fields,
  });
}

// What a recruiter saves for a job. Sent as arrays here; the test of
// the endpoint also sends the lists as text.
const profileBody = (overrides = {}) => ({
  requiredSkills: ['UVM', 'Formal Verification'],
  preferredSkills: [],
  tools: ['VCS', 'Verdi', 'JasperGold'],
  domains: ['Semiconductor'],
  requiredExperience: 'Block-level verification of a bus protocol.',
  minYears: 2,
  preferredExperience: 'Has owned coverage closure.',
  preferredYears: 6,
  education: ['B.Tech Electronics'],
  certifications: ['PMP'],
  seniority: 'Mid-level',
  location: 'Bengaluru',
  workArrangement: 'HYBRID',
  responsibilities: ['Write the verification plan', 'Close coverage'],
  niceToHave: ['Open source contributions'],
  constraints: ['Night shift support'],
  weights: { skills: 50, experience: 10, preferredSkills: 0, tools: 20, domain: 10, location: 10, completeness: 0 },
  ...overrides,
});

const profilePath = (job) => `/api/admin/jobs/${job._id}/requirement-profile`;
const draftPath = (job) => `/api/admin/jobs/${job._id}/requirement-profile/ai-draft`;
const rerunPath = (job) => `/api/admin/jobs/${job._id}/ats/re-run`;
const comparePath = (job) => `/api/admin/jobs/${job._id}/candidate-comparison`;
const singlePath = (resultId) => `/api/admin/ats-results/${resultId}/ai-comparison`;

async function saveProfile(job, overrides = {}, agent = recruiter) {
  const response = await agent.put(profilePath(job), { json: profileBody(overrides) });
  assert.equal(response.status, 200);
  return response.body.data;
}

async function runRules(candidate, job) {
  const response = await recruiter.post('/api/admin/ats/run', { json: { candidateId: String(candidate._id), jobId: String(job._id) } });
  assert.equal(response.status, 201);
  return response.body.data;
}

// An application through the public form: it creates the candidate and
// the application and runs the rule-based evaluation.
async function apply(job, fields = {}, fileName = 'resume.pdf') {
  const submitted = await client().post('/api/applications', {
    form: multipart(applicationFields({ jobId: String(job._id), ...fields }), { field: 'resume', name: fileName, buffer: pdfBytes(), type: 'application/pdf' }),
  });
  assert.equal(submitted.status, 201);
  const candidate = await ctx.models.Candidate.findOne({ email: String(fields.email).toLowerCase() });
  const application = await ctx.models.Application.findOne({ candidateId: candidate._id, jobId: job._id });
  const result = await ctx.models.ATSResult.findOne({ candidateId: candidate._id, jobId: job._id });
  assert.ok(result, 'the rule-based evaluation ran with the application');
  return { candidate, application, result, id: String(result._id) };
}

// The emails an application sends leave after the response. Wait for
// them, then start counting from nothing.
async function quietOutbox() {
  await wait(150);
  ctx.outbox.length = 0;
}

const checkNamed = (result, rule) => result.checks.find((check) => check.rule === rule);
// The rule-based part of a result as the API returns it, without the
// two times that change on every run.
const scored = ({ runAt, updatedAt, ...rest }) => rest;

// ------------------------------------------------------- the OpenAI fake

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';
const AI_FIELDS = [
  'concerns', 'domainRelevance', 'evidence', 'experienceGaps', 'matchedSkills', 'missingRequirements', 'missingSkills', 'overallMatch', 'partialMatches',
  'qualificationAssessment', 'recommendation', 'relevantExperience', 'strengths', 'strongMatches', 'summary', 'transferableSkills', 'uncertainties',
];

// A valid answer for each of the three formats.
const aiAnswer = (overrides = {}) => ({
  overallMatch: 72,
  summary: 'The stated skills cover most of what the role asks for.',
  matchedSkills: ['UVM', 'SystemVerilog'],
  missingSkills: ['Formal Verification'],
  relevantExperience: 'Six years of block-level verification are stated.',
  experienceGaps: ['Formal verification experience is not stated.'],
  qualificationAssessment: 'The stated years of experience meet the level of the role. Education is not stated.',
  strengths: ['Hands-on UVM experience'],
  concerns: ['No formal verification is mentioned'],
  recommendation: 'Worth a conversation to check the formal verification gap. The recruiter decides.',
  strongMatches: ['UVM testbench work is stated'],
  partialMatches: ['Coverage closure is mentioned without detail'],
  missingRequirements: ['Formal verification is not stated'],
  domainRelevance: 'The stated domain is semiconductor verification, which is the domain of the role.',
  transferableSkills: ['Python scripting carries over to regression tooling'],
  evidence: [{ requirement: 'UVM', evidence: 'Lists UVM among the skills and describes block-level testbench work.' }],
  uncertainties: ['Whether the coverage closure was owned or assisted is not stated: ask in the interview.'],
  ...overrides,
});

const draftAnswer = (overrides = {}) => ({
  requiredSkills: ['UVM', 'SystemVerilog'],
  preferredSkills: ['Python'],
  tools: ['VCS'],
  domains: ['Semiconductor'],
  requiredExperience: 'Block-level verification experience.',
  minimumYears: 4,
  preferredExperience: '',
  preferredYears: null,
  education: ['B.Tech in Electronics'],
  certifications: [],
  seniority: 'Mid-level',
  location: 'Bengaluru',
  workArrangement: 'ON_SITE',
  responsibilities: ['Write the verification plan'],
  niceToHave: [],
  constraints: ['Night shift support'],
  suggestedWeights: { skills: 50, experience: 20, preferredSkills: 5, tools: 10, domain: 10, location: 5, completeness: 0 },
  uncertainties: ['The description does not say how many years are preferred.'],
  ...overrides,
});
// The draft as the endpoint returns it for draftAnswer().
const expectedDraft = () => {
  const { minimumYears, suggestedWeights, ...rest } = draftAnswer();
  return { ...rest, minYears: minimumYears, weights: suggestedWeights };
};

const candidateEntry = (label, index = 0, overrides = {}) => ({
  label,
  overallFit: 80 - index * 15,
  standing: `${label} is compared with the others on the stated skills.`,
  strengths: ['States UVM'],
  gaps: ['Formal verification is not stated'],
  transferableSkills: ['Scripting'],
  uncertainties: ['Ownership of coverage closure is not stated'],
  ...overrides,
});
const candidatesAnswer = (labels, overrides = {}) => ({
  summary: 'The candidates are compared on the stated requirements, by label.',
  candidates: labels.map((label, index) => candidateEntry(label, index)),
  requirements: [{ requirement: 'UVM', comparison: 'Candidate A and Candidate B both state it.' }],
  considerations: ['Check the dates of the verification work with each candidate.'],
  ...overrides,
});

const jsonResponse = (status, body) => new Response(typeof body === 'string' ? body : JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

// The envelope OpenAI wraps an answer in.
const completion = (answer, { finishReason = 'stop', refusal = null, model = 'test-comparison-model-2026-01-01' } = {}) => ({
  id: 'chatcmpl-test',
  object: 'chat.completion',
  model,
  choices: [{ index: 0, finish_reason: finishReason, message: { role: 'assistant', content: answer === null || typeof answer === 'string' ? answer : JSON.stringify(answer), refusal } }],
  usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
});
const answerWith = (answer, options) => () => jsonResponse(200, completion(answer, options));

// The text between <tag> and </tag> in the user message of a request.
function block(call, tag) {
  const text = call.body.messages[1].content;
  const open = text.indexOf(`<${tag}>`);
  const close = text.indexOf(`</${tag}>`);
  assert.ok(open >= 0 && close > open, `the request has a <${tag}> block`);
  assert.equal(text.split(`<${tag}>`).length, 2, `one <${tag}> block`);
  return JSON.parse(text.slice(open + tag.length + 2, close));
}
const schemaName = (call) => call.body.response_format.json_schema.name;
const labelsSent = (call) => block(call, 'candidates').map((entry) => entry.label);

// Answers every request with a valid answer for the format it asks for.
const validAnswers = (call) => {
  if (schemaName(call) === 'job_requirement_profile') return jsonResponse(200, completion(draftAnswer()));
  if (schemaName(call) === 'candidates_job_comparison') return jsonResponse(200, completion(candidatesAnswer(labelsSent(call))));
  return jsonResponse(200, completion(aiAnswer()));
};

function openAiStub(t, responder = validAnswers) {
  const realFetch = globalThis.fetch;
  const stub = { calls: [], responder };
  globalThis.fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : String(input?.url ?? input);
    if (!url.startsWith('https://api.openai.com/')) return realFetch(input, init);
    const call = { url, method: init?.method, headers: init?.headers || {}, raw: String(init?.body ?? ''), signal: init?.signal, body: null };
    // Counted before anything else, so no request can go unnoticed.
    stub.calls.push(call);
    try { call.body = JSON.parse(call.raw); } catch { call.body = null; }
    return stub.responder(call);
  };
  t.after(() => { globalThis.fetch = realFetch; });
  return stub;
}

async function until(condition) {
  for (let i = 0; i < 300; i += 1) {
    if (condition()) return;
    await wait(10);
  }
  throw new Error('The condition was not met in time.');
}

const storedJob = async (job) => ctx.models.Job.findById(job._id);
const storedProfile = async (job) => {
  const profile = (await storedJob(job)).requirementProfile;
  return profile ? JSON.parse(JSON.stringify(profile.toObject ? profile.toObject() : profile)) : null;
};

/*
  Everything recruitment decides on, read straight from the database:
  every application (status, labels, shortlist, notes), every candidate
  (labels, notes), the rule-based part and the review of every ATS
  result, and every job without its stored multi-candidate comparison.
  An AI action may write `aiComparison` on a result or
  `candidateComparison` on a job, and nothing else.
*/
async function recruitmentSnapshot() {
  const { Application, Candidate, ATSResult, Job } = ctx.models;
  const [applications, candidates, results, jobs] = await Promise.all([Application.find({}), Candidate.find({}), ATSResult.find({}), Job.find({})]);
  const byId = (a, b) => String(a._id).localeCompare(String(b._id));
  return JSON.parse(JSON.stringify({
    applications: applications.map((doc) => doc.toObject()).sort(byId),
    candidates: candidates.map((doc) => doc.toObject()).sort(byId),
    results: results.map((doc) => { const { aiComparison, updatedAt, ...ruleBased } = doc.toObject(); return ruleBased; }).sort(byId),
    jobs: jobs.map((doc) => { const { candidateComparison, ...rest } = doc.toObject(); return rest; }).sort(byId),
  }));
}

// =====================================================================
// The rule-based ATS
// =====================================================================

test('rule-based ATS: a job without a requirement profile is scored with the fixed baseline weights', async () => {
  const job = await makeJob('baseline');
  const candidate = await makeCandidate('baseline');

  const engine = (await recruiter.get('/api/admin/ats/engine')).body.data;
  assert.equal(engine.version, '2');
  assert.deepEqual(engine.weights, BASELINE);
  assert.deepEqual(engine.profileWeights, PROFILE_DEFAULTS);
  assert.deepEqual(engine.weightKeys, ['skills', 'experience', 'preferredSkills', 'tools', 'domain', 'location', 'completeness']);

  const result = await runRules(candidate, job);
  assert.equal(result.engine, 'RULE_BASED');
  assert.equal(result.engineVersion, '2');
  assert.deepEqual(result.weights, BASELINE);
  assert.equal(result.weightSource, 'BASELINE');
  assert.equal(result.usedRequirementProfile, false);

  // Required skills: SystemVerilog ("System Verilog" is the same skill)
  // and UVM of four.
  assert.deepEqual(result.requiredSkills, ['SystemVerilog', 'UVM', 'Formal Verification', 'Assertions']);
  assert.deepEqual(result.matchedSkills, ['SystemVerilog', 'UVM']);
  assert.deepEqual(result.missingSkills, ['Formal Verification', 'Assertions']);
  assert.equal(result.skillScore, 50);
  // Preferred skills: Python of two.
  assert.deepEqual(result.preferredMatched, ['Python']);
  assert.deepEqual(result.preferredMissing, ['Perl']);
  assert.equal(result.preferredSkillScore, 50);
  // Mid-Senior is set at 4+ years and 2 are stated: 2 / 4.
  assert.equal(result.experienceScore, 50);
  assert.equal(result.domainScore, 100);
  // Pune for a role in Bengaluru.
  assert.equal(result.locationScore, 40);
  // No resume: seven of eight profile items.
  assert.equal(result.completenessScore, 88);
  // There are no tools without a profile.
  assert.equal(result.toolScore, null);
  assert.deepEqual(result.toolsMatched, []);
  assert.deepEqual(result.toolsMissing, []);
  // 50*45 + 50*20 + 50*10 + 100*10 + 40*10 + 88*5 = 5590, over 100 = 55.9
  assert.equal(result.totalScore, 56);
  assert.equal(result.band, 'Partial match');
  assert.deepEqual(result.checks.map((check) => [check.rule, check.weight]), [
    ['Required skills', 45], ['Experience level', 20], ['Preferred skills', 10], ['Domain relevance', 10], ['Location', 10], ['Profile completeness', 5], ['Notice period', null],
  ]);
  assert.match(checkNamed(result, 'Experience level').detail, /Mid-Senior is set at 4\+ years/);
  assert.equal(result.aiComparison, null);

  // The same inputs give the same result: one stored result, the same
  // numbers, lists and checks.
  const again = await runRules(candidate, job);
  assert.equal(again.id, result.id);
  assert.deepEqual(scored(again), scored(result));
  assert.equal(await ctx.models.ATSResult.countDocuments({ candidateId: candidate._id }), 1);

  // A part that does not apply is left out of the weights and the rest
  // is rescaled: this job has no preferred skills and no location.
  const smallerJob = await makeJob('baseline-small', { preferredSkills: [], location: '' });
  const smaller = await runRules(candidate, smallerJob);
  assert.deepEqual(smaller.weights, { skills: 45, experience: 20, domain: 10, completeness: 5 });
  assert.equal(smaller.weightSource, 'BASELINE');
  assert.equal(smaller.preferredSkillScore, null);
  assert.deepEqual([smaller.preferredMatched, smaller.preferredMissing], [[], []]);
  // 50*45 + 50*20 + 100*10 + 88*5 = 4690, over 80 = 58.6
  assert.equal(smaller.totalScore, 59);
});

test('rule-based ATS: with a requirement profile the score follows the profile and the job\'s own weights', async () => {
  const job = await makeJob('profile');
  const candidate = await makeCandidate('profile');
  assert.equal((await runRules(candidate, job)).totalScore, 56, 'the baseline total of this candidate, as worked out above');

  // The profile with the job's own weights.
  const saved = await saveProfile(job);
  assert.equal(saved.scoring.source, 'JOB');
  // Saving a profile does not re-evaluate anyone by itself.
  assert.equal((await ctx.models.ATSResult.findOne({ candidateId: candidate._id, jobId: job._id })).totalScore, 56);

  const own = await runRules(candidate, job);
  assert.equal(own.usedRequirementProfile, true);
  assert.equal(own.weightSource, 'JOB');
  // The profile's two required skills replace the job's four.
  assert.deepEqual(own.requiredSkills, ['UVM', 'Formal Verification']);
  assert.deepEqual(own.matchedSkills, ['UVM']);
  assert.deepEqual(own.missingSkills, ['Formal Verification']);
  assert.equal(own.skillScore, 50);
  // The profile lists no preferred skills, so the job's own are used.
  assert.deepEqual(own.preferredMatched, ['Python']);
  assert.deepEqual(own.preferredMissing, ['Perl']);
  assert.equal(own.preferredSkillScore, 50);
  // Tools are a part of their own: VCS of three, 33.3.
  assert.deepEqual(own.toolsMatched, ['VCS']);
  assert.deepEqual(own.toolsMissing, ['Verdi', 'JasperGold']);
  assert.equal(own.toolScore, 33);
  assert.deepEqual([checkNamed(own, 'Tools and technologies').score, checkNamed(own, 'Tools and technologies').weight, checkNamed(own, 'Tools and technologies').result], [33, 20, 'review']);
  // The profile asks for 2+ years, which replaces the 4+ of Mid-Senior.
  assert.equal(own.experienceScore, 100);
  assert.match(checkNamed(own, 'Experience level').detail, /^2 years stated\. The job's requirement profile asks for 2\+ years\.$/);
  assert.equal(own.domainScore, 100);
  assert.match(checkNamed(own, 'Domain relevance').detail, /in the job's requirement profile/);
  // The profile says hybrid, so Pune no longer counts against the candidate.
  assert.equal(own.locationScore, 100);
  assert.match(checkNamed(own, 'Location').detail, /requirement profile sets the role as hybrid/);
  assert.equal(own.completenessScore, 88);
  // A weight of 0 is left out of the weights and of the score...
  assert.deepEqual(own.weights, { skills: 50, experience: 10, tools: 20, domain: 10, location: 10 });
  // 50*50 + 100*10 + 33*20 + 100*10 + 100*10 = 6160, over 100 = 61.6
  assert.equal(own.totalScore, 62);
  assert.equal(own.band, 'Partial match');
  // ...and its check stays on the list with weight 0.
  for (const rule of ['Preferred skills', 'Profile completeness']) {
    assert.equal(checkNamed(own, rule).weight, 0, rule);
    assert.match(checkNamed(own, rule).detail, /Not counted in the score for this job\.$/, rule);
  }
  assert.equal(checkNamed(own, 'Preferred skills').score, 50);

  // Education, certifications and the other requirements are listed
  // for the recruiter and are not scored.
  assert.deepEqual([checkNamed(own, 'Education').result, checkNamed(own, 'Education').score, checkNamed(own, 'Education').weight], ['pass', null, null]);
  assert.match(checkNamed(own, 'Education').detail, /Named in the profile: B\.Tech Electronics\..*Not scored/);
  assert.deepEqual([checkNamed(own, 'Certifications').result, checkNamed(own, 'Certifications').score, checkNamed(own, 'Certifications').weight], ['review', null, null]);
  assert.match(checkNamed(own, 'Certifications').detail, /Not found by name: PMP\./);
  assert.deepEqual([checkNamed(own, 'Other requirements').result, checkNamed(own, 'Other requirements').score, checkNamed(own, 'Other requirements').weight], ['info', null, null]);
  assert.match(checkNamed(own, 'Other requirements').detail, /1 other constraint, 1 nice-to-have requirement, 2 key responsibilities/);
  assert.deepEqual([checkNamed(own, 'Preferred experience').result, checkNamed(own, 'Preferred experience').score], ['info', null]);
  assert.deepEqual(own.checks.map((check) => check.rule), [
    'Required skills', 'Experience level', 'Preferred experience', 'Preferred skills', 'Tools and technologies', 'Domain relevance', 'Location', 'Profile completeness',
    'Education', 'Certifications', 'Other requirements', 'Notice period',
  ]);
  // Without them, or with every one of them unmet, the total is the same.
  await saveProfile(job, { education: [], certifications: [], constraints: [], niceToHave: [], responsibilities: [], preferredYears: null });
  const bare = await runRules(candidate, job);
  assert.equal(bare.totalScore, 62);
  assert.deepEqual(bare.weights, own.weights);
  for (const rule of ['Education', 'Certifications', 'Other requirements', 'Preferred experience']) assert.equal(checkNamed(bare, rule), undefined, rule);
  await saveProfile(job, { education: ['PhD in Photonics'], certifications: ['PMP', 'CISSP'], preferredYears: 40 });
  const unmet = await runRules(candidate, job);
  assert.equal(unmet.totalScore, 62);
  assert.equal(checkNamed(unmet, 'Education').result, 'review');

  // The same profile without weights of its own: the profile defaults.
  const defaults = await saveProfile(job, { weights: null });
  assert.equal(defaults.scoring.source, 'PROFILE');
  assert.deepEqual(defaults.scoring.weights, PROFILE_DEFAULTS);
  const profiled = await runRules(candidate, job);
  assert.equal(profiled.weightSource, 'PROFILE');
  assert.equal(profiled.usedRequirementProfile, true);
  assert.deepEqual(profiled.weights, PROFILE_DEFAULTS);
  // 50*40 + 100*20 + 50*10 + 33*10 + 100*10 + 100*5 + 88*5 = 6770, over 100 = 67.7
  assert.equal(profiled.totalScore, 68);
  assert.equal(checkNamed(profiled, 'Preferred skills').weight, 10);

  // The same inputs, the same result.
  assert.deepEqual(scored(await runRules(candidate, job)), scored(profiled));

  // All the weight on one part gives that part's score.
  await saveProfile(job, { weights: { skills: 0, experience: 100, preferredSkills: 0, tools: 0, domain: 0, location: 0, completeness: 0 } });
  const experienceOnly = await runRules(candidate, job);
  assert.equal(experienceOnly.totalScore, 100);
  assert.deepEqual(experienceOnly.weights, { experience: 100 });
  assert.equal(experienceOnly.band, 'Strong match');

  // Removing the profile returns the job to the baseline.
  const removed = await recruiter.delete(profilePath(job));
  assert.equal(removed.status, 200);
  assert.deepEqual(removed.body.data, { requirementProfile: null, scoring: { weights: BASELINE, source: 'BASELINE', baseline: BASELINE, profileDefaults: PROFILE_DEFAULTS } });
  assert.equal((await storedJob(job)).requirementProfile, null);
  const rerun = await recruiter.post(rerunPath(job));
  assert.equal(rerun.status, 200);
  assert.deepEqual(rerun.body.data, { evaluated: 1, total: 1 });
  const back = (await recruiter.get(`/api/admin/ats-results/${own.id}`)).body.data;
  assert.equal(back.totalScore, 56, 'the baseline result again');
  assert.deepEqual(back.weights, BASELINE);
  assert.equal(back.weightSource, 'BASELINE');
  assert.equal(back.usedRequirementProfile, false);
  assert.deepEqual(back.requiredSkills, ['SystemVerilog', 'UVM', 'Formal Verification', 'Assertions']);
  assert.deepEqual(back.missingSkills, ['Formal Verification', 'Assertions']);
  assert.deepEqual([back.toolScore, back.toolsMatched, back.toolsMissing], [null, [], []]);
  assert.equal(back.experienceScore, 50);
  assert.equal(back.locationScore, 40);
  assert.equal(checkNamed(back, 'Tools and technologies'), undefined);
});

// =====================================================================
// Saving and removing a requirement profile
// =====================================================================

test('requirement profile: every field is stored, lists are accepted as arrays or as text, and it is returned to staff', async () => {
  const job = await makeJob('store');
  const bareJob = await makeJob('store-none');

  // Before: the field is there and empty.
  const before = (await recruiter.get(`/api/admin/jobs/${job._id}`)).body.data;
  assert.ok('requirementProfile' in before);
  assert.equal(before.requirementProfile, null);

  const sent = {
    requiredSkills: 'UVM, Formal Verification',
    preferredSkills: 'Python\nPerl',
    tools: ['VCS', 'Verdi', 'vcs', ' <b>JasperGold</b> '],
    domains: 'Semiconductor, ASIC design',
    requiredExperience: 'Block-level verification of a bus protocol.',
    minYears: '3',
    preferredExperience: 'Has owned coverage closure.',
    preferredYears: 6,
    education: 'B.Tech Electronics\nM.Tech VLSI',
    certifications: ['PMP'],
    seniority: 'Mid-level',
    location: 'Bengaluru',
    workArrangement: 'HYBRID',
    responsibilities: 'Write the verification plan\nClose coverage',
    niceToHave: ['Open source contributions'],
    // One line with a comma in it: a line list is split on lines only.
    constraints: 'Night shift support, when a release needs it',
    weights: { skills: 50, experience: 10, preferredSkills: 0, tools: 20, domain: 10, location: 10, completeness: 0 },
    // Not fields of a profile: a client cannot set them.
    source: 'AI_REVIEWED',
    savedByName: 'Somebody Else',
    savedById: '0123456789abcdef01234567',
    model: 'made-up-model',
  };
  const expected = {
    requiredSkills: ['UVM', 'Formal Verification'],
    preferredSkills: ['Python', 'Perl'],
    tools: ['VCS', 'Verdi', 'JasperGold'],
    domains: ['Semiconductor', 'ASIC design'],
    requiredExperience: 'Block-level verification of a bus protocol.',
    minYears: 3,
    preferredExperience: 'Has owned coverage closure.',
    preferredYears: 6,
    education: ['B.Tech Electronics', 'M.Tech VLSI'],
    certifications: ['PMP'],
    seniority: 'Mid-level',
    location: 'Bengaluru',
    workArrangement: 'HYBRID',
    responsibilities: ['Write the verification plan', 'Close coverage'],
    niceToHave: ['Open source contributions'],
    constraints: ['Night shift support, when a release needs it'],
    weights: { skills: 50, experience: 10, preferredSkills: 0, tools: 20, domain: 10, location: 10, completeness: 0 },
    source: 'MANUAL',
    model: null,
    savedByName: 'Test RECRUITER',
  };

  const saved = await recruiter.put(profilePath(job), { json: sent });
  assert.equal(saved.status, 200);
  assert.deepEqual(Object.keys(saved.body.data).sort(), ['requirementProfile', 'scoring']);
  const { savedAt, ...profile } = saved.body.data.requirementProfile;
  assert.deepEqual(profile, expected);
  assert.ok(Math.abs(Date.now() - Date.parse(savedAt)) < 60_000);
  assert.ok(!('savedById' in saved.body.data.requirementProfile) && !('aiModel' in saved.body.data.requirementProfile));
  assert.deepEqual(saved.body.data.scoring, { weights: expected.weights, source: 'JOB', baseline: BASELINE, profileDefaults: PROFILE_DEFAULTS });

  // It is really in the database, with the person who saved it.
  const stored = (await storedJob(job)).requirementProfile;
  assert.deepEqual([...stored.tools], ['VCS', 'Verdi', 'JasperGold']);
  assert.equal(stored.minYears, 3);
  assert.equal(stored.source, 'MANUAL');
  assert.equal(String(stored.savedById), String((await ctx.models.User.findOne({ email: 'recruiter@example.com' }))._id));

  // The admin job carries it, on the read and in the list.
  const read = (await manager.get(`/api/admin/jobs/${job._id}`)).body.data;
  assert.deepEqual(read.requirementProfile, saved.body.data.requirementProfile);
  assert.ok(!('candidateComparison' in read), 'the multi-candidate comparison is read through its own endpoint');
  const listed = (await recruiter.get('/api/admin/jobs?limit=100')).body.data;
  assert.deepEqual(listed.find((item) => item.id === String(job._id)).requirementProfile, saved.body.data.requirementProfile);
  assert.equal(listed.find((item) => item.id === String(bareJob._id)).requirementProfile, null, 'a job without one says null');
  assert.ok(!JSON.stringify([read, listed]).includes('savedById'));

  // Audited, without the content of the profile.
  const log = await audit(`entityType=job&entityId=${job._id}&action=job.requirements_saved`);
  assert.equal(log.length, 1);
  assert.equal(log[0].actorName, 'Test RECRUITER');
  assert.deepEqual(log[0].metadata, { source: 'MANUAL', ownWeights: true });
  assert.match(log[0].summary, /^Added the requirement profile/);

  // Editing the job does not touch the profile, and a profile cannot be
  // slipped in through the job edit.
  const edited = await recruiter.patch(`/api/admin/jobs/${job._id}`, { json: { summary: 'A new summary.', requirementProfile: { requiredSkills: ['Slipped in'] } } });
  assert.equal(edited.status, 200);
  assert.deepEqual(edited.body.data.requirementProfile, saved.body.data.requirementProfile);
  assert.equal((await recruiter.patch(`/api/admin/jobs/${job._id}`, { json: { requirementProfile: null } })).status, 200);
  assert.deepEqual([...(await storedJob(job)).requirementProfile.requiredSkills], ['UVM', 'Formal Verification']);
  const slipped = await recruiter.patch(`/api/admin/jobs/${bareJob._id}`, { json: { summary: 'Edited.', requirementProfile: profileBody() } });
  assert.equal(slipped.body.data.requirementProfile, null);
  assert.equal((await storedJob(bareJob)).requirementProfile, null);

  // Saving again replaces the whole profile: what is left out is empty.
  const replaced = await admin.put(profilePath(job), { json: { requiredSkills: ['UVM'], minYears: '' } });
  assert.equal(replaced.status, 200);
  const { savedAt: replacedAt, ...second } = replaced.body.data.requirementProfile;
  assert.deepEqual(second, {
    requiredSkills: ['UVM'], preferredSkills: [], tools: [], domains: [], requiredExperience: '', minYears: null, preferredExperience: '', preferredYears: null,
    education: [], certifications: [], seniority: '', location: '', workArrangement: '', responsibilities: [], niceToHave: [], constraints: [], weights: null,
    source: 'MANUAL', model: null, savedByName: 'Test SUPER_ADMIN',
  });
  assert.equal(replaced.body.data.scoring.source, 'PROFILE');
  assert.deepEqual(replaced.body.data.scoring.weights, PROFILE_DEFAULTS);
  assert.match((await audit(`entityType=job&entityId=${job._id}&action=job.requirements_saved`))[0].summary, /^Updated the requirement profile/);

  // Removing it, and removing what is not there.
  const removed = await recruiter.delete(profilePath(job));
  assert.equal(removed.status, 200);
  assert.equal(removed.body.data.requirementProfile, null);
  assert.equal(removed.body.data.scoring.source, 'BASELINE');
  assert.equal((await recruiter.get(`/api/admin/jobs/${job._id}`)).body.data.requirementProfile, null);
  assert.equal((await recruiter.delete(profilePath(job))).status, 200);
  assert.equal((await audit(`entityType=job&entityId=${job._id}&action=job.requirements_removed`)).length, 1, 'only the removal that removed something is audited');

  // Ids.
  assert.equal((await recruiter.put('/api/admin/jobs/not-an-id/requirement-profile', { json: profileBody() })).status, 400);
  assert.equal((await recruiter.put('/api/admin/jobs/0123456789abcdef01234567/requirement-profile', { json: profileBody() })).status, 404);
  assert.equal((await recruiter.delete('/api/admin/jobs/0123456789abcdef01234567/requirement-profile')).status, 404);
});

test('requirement profile: the public site never receives it and its "updated" date does not move', async (t) => {
  const marker = 'INTERNAL-ONLY-REQUIREMENT-7731';
  const comparisonMarker = 'INTERNAL-ONLY-COMPARISON-4402';
  const job = await makeJob('public');
  // An "updated" date in the past, so a change of a day would show.
  const published = new Date('2026-01-15T10:00:00.000Z');
  await ctx.models.Job.updateOne({ _id: job._id }, { $set: { updatedAt: published, publishedAt: published } }, { timestamps: false });
  const publicJob = async () => (await client().get(`/api/public/jobs/${job.slug}`)).body.data;
  const publicList = async () => (await client().get('/api/public/jobs')).body.data;
  const before = await publicJob();
  assert.equal(before.updatedAt, '2026-01-15');

  // A profile, and a stored comparison of two candidates, on the job.
  const saved = await saveProfile(job, { constraints: [marker], requiredExperience: `Experience ${marker}`, tools: [`${marker}-TOOL`] });
  assert.deepEqual(saved.requirementProfile.constraints, [marker]);
  const first = await apply(job, { email: 'public.one@example.com' });
  const second = await apply(job, { email: 'public.two@example.com' });
  openAiStub(t, (call) => jsonResponse(200, completion(candidatesAnswer(labelsSent(call), { summary: `Compared. ${comparisonMarker}` }))));
  assert.equal((await recruiter.post(comparePath(job), { json: { resultIds: [first.id, second.id] } })).status, 200);
  const stored = await storedJob(job);
  assert.ok(stored.requirementProfile && stored.candidateComparison, 'both are on the job in the database');

  // The stored and the public "updated" date are exactly as they were.
  assert.equal(stored.updatedAt.getTime(), published.getTime());
  const after = await publicJob();
  assert.deepEqual(after, before, 'the public job is unchanged in every field');
  assert.equal(after.updatedAt, '2026-01-15');

  // Neither the fields nor their content reach a visitor.
  const listed = await publicList();
  assert.ok(listed.some((item) => item.slug === job.slug));
  const publicText = JSON.stringify([after, listed, (await client().get(`/api/public/jobs/${job.slug}`)).body]);
  for (const banned of ['requirementProfile', 'candidateComparison', marker, comparisonMarker, 'weights', 'savedBy', 'Verdi', 'workArrangement']) {
    assert.ok(!publicText.includes(banned), `the public API does not contain "${banned}"`);
  }
  assert.deepEqual(Object.keys(after).sort(), [
    'applicationEnabled', 'category', 'department', 'description', 'employmentType', 'experienceLevel', 'featured', 'id', 'keywords', 'location',
    'preferredSkills', 'publishedAt', 'requiredSkills', 'responsibilities', 'slug', 'status', 'summary', 'title', 'updatedAt',
  ]);
  // The public required skills are the job's own, not the profile's.
  assert.deepEqual(after.requiredSkills, ['SystemVerilog', 'UVM', 'Formal Verification', 'Assertions']);

  // Removing the profile does not move the date either.
  assert.equal((await recruiter.delete(profilePath(job))).status, 200);
  assert.equal((await storedJob(job)).updatedAt.getTime(), published.getTime());
  assert.deepEqual(await publicJob(), before);

  // For contrast, an edit of the job itself does move it.
  assert.equal((await recruiter.patch(`/api/admin/jobs/${job._id}`, { json: { summary: 'Edited today.' } })).status, 200);
  assert.ok((await storedJob(job)).updatedAt.getTime() > published.getTime());
  assert.notEqual((await publicJob()).updatedAt, '2026-01-15');
});

test('requirement profile: values that make no sense are refused and nothing is stored', async () => {
  const job = await makeJob('validation');
  const zero = { skills: 0, experience: 0, preferredSkills: 0, tools: 0, domain: 0, location: 0, completeness: 0 };
  const cases = {
    'weights that are all 0': [{ weights: zero }, 'weights'],
    'a weight above 100': [{ weights: { ...zero, skills: 101 } }, 'weights.skills'],
    'a weight below 0': [{ weights: { ...zero, skills: 50, tools: -1 } }, 'weights.tools'],
    'a weight that is not a whole number': [{ weights: { ...zero, skills: 33.5 } }, 'weights.skills'],
    'a weight that is not a number': [{ weights: { ...zero, skills: 'most' } }, 'weights.skills'],
    'a weight for a part that does not exist': [{ weights: { ...zero, skills: 50, salary: 50 } }, 'weights'],
    'weights that are not an object': [{ weights: 'skills 100' }, 'weights'],
    'minimum years above 50': [{ minYears: 51 }, 'minYears'],
    'minimum years below 0': [{ minYears: -1 }, 'minYears'],
    'minimum years that are not a number': [{ minYears: 'several' }, 'minYears'],
    'preferred years above 50': [{ preferredYears: 500 }, 'preferredYears'],
    'an unknown work arrangement': [{ workArrangement: 'SOMETIMES' }, 'workArrangement'],
    'a work arrangement in the wrong case': [{ workArrangement: 'hybrid' }, 'workArrangement'],
    'a list that is a number': [{ requiredSkills: 7 }, 'requiredSkills'],
    'a list that is an object': [{ tools: { $ne: null } }, 'tools'],
    'a text that is a list': [{ seniority: ['Senior'] }, 'seniority'],
    'a text that is too long': [{ requiredExperience: 'x'.repeat(401) }, 'requiredExperience'],
    'a flag that is not a flag': [{ fromAiDraft: 'yes' }, 'fromAiDraft'],
  };
  for (const [label, [fields, field]] of Object.entries(cases)) {
    const response = await recruiter.put(profilePath(job), { json: profileBody(fields) });
    assert.equal(response.status, 400, label);
    assert.equal(response.body.success, false, label);
    assert.equal(response.body.error.code, 'VALIDATION_ERROR', label);
    assert.ok(response.body.error.details.some((detail) => detail.field === field || detail.field.startsWith(`${field}.`)), `${label}: the answer names ${field}`);
    assert.equal((await storedJob(job)).requirementProfile, null, `${label}: nothing is stored`);
  }
  assert.deepEqual(await auditActions(`entityType=job&entityId=${job._id}&action=job.requirements_saved`), []);

  // The edges that are allowed: 0 and 50 years, a single weight of 100.
  const edge = await recruiter.put(profilePath(job), { json: profileBody({ minYears: 0, preferredYears: 50, weights: { ...zero, tools: 100 } }) });
  assert.equal(edge.status, 200);
  assert.deepEqual([edge.body.data.requirementProfile.minYears, edge.body.data.requirementProfile.preferredYears], [0, 50]);
  assert.deepEqual(edge.body.data.scoring.weights, { ...zero, tools: 100 });

  // A refused save leaves the stored profile as it was.
  const kept = await storedProfile(job);
  assert.equal((await recruiter.put(profilePath(job), { json: profileBody({ weights: zero }) })).status, 400);
  assert.deepEqual(await storedProfile(job), kept);
});

test('requirement profile: access is checked exactly as on the neighbouring routes', async (t) => {
  const job = await makeJob('access');
  const stub = openAiStub(t);
  const neighbour = `/api/admin/jobs/${job._id}`;
  const body = { json: profileBody() };
  const edit = { json: { summary: 'Edited.' } };

  // Signed out.
  for (const [method, path, options] of [['put', profilePath(job), body], ['delete', profilePath(job)], ['post', draftPath(job)], ['post', rerunPath(job)]]) {
    const anonymous = await client()[method](path, options);
    assert.equal(anonymous.status, 401, `${method} ${path} signed out`);
    assert.deepEqual(anonymous.body, (await client().patch(neighbour, edit)).body);
  }
  // Signed in without jobs:write (and, for the re-run, without ats:run).
  for (const agent of [manager, content]) {
    const refusedPut = await agent.put(profilePath(job), body);
    assert.equal(refusedPut.status, 403);
    assert.deepEqual(refusedPut.body, (await agent.patch(neighbour, edit)).body);
    assert.equal((await agent.delete(profilePath(job))).status, 403);
    assert.equal((await agent.post(draftPath(job))).status, 403);
    assert.equal((await agent.post(rerunPath(job))).status, 403);
  }
  assert.equal((await storedJob(job)).requirementProfile, null, 'nothing was saved by a refused request');

  // Without the header the frontend sends, or from another origin.
  await saveProfile(job);
  const kept = await storedProfile(job);
  const forged = [
    ['put', profilePath(job), body],
    ['delete', profilePath(job), {}],
    ['post', draftPath(job), {}],
    ['post', rerunPath(job), {}],
  ];
  for (const [method, path, options] of forged) {
    const noHeader = await recruiter[method](path, { ...options, xhr: false });
    assert.equal(noHeader.status, 403, `${method} ${path} without the header`);
    assert.deepEqual(noHeader.body, (await recruiter.patch(neighbour, { ...edit, xhr: false })).body);
    const foreign = await recruiter[method](path, { ...options, origin: 'https://evil.example.com' });
    assert.equal(foreign.status, 403, `${method} ${path} from another origin`);
    assert.deepEqual(foreign.body, (await recruiter.patch(neighbour, { ...edit, origin: 'https://evil.example.com' })).body);
  }
  assert.deepEqual(await storedProfile(job), kept, 'a forged request neither changed nor removed the profile');

  // They are admin routes only, with these methods only.
  assert.equal((await recruiter.get(profilePath(job))).status, 404);
  assert.equal((await recruiter.post(profilePath(job), body)).status, 404);
  assert.equal((await recruiter.get(draftPath(job))).status, 404);
  assert.equal((await recruiter.get(rerunPath(job))).status, 404);
  assert.equal((await client().put(`/api/public/jobs/${job._id}/requirement-profile`, body)).status, 404);
  assert.equal((await client().put(`/api/jobs/${job._id}/requirement-profile`, body)).status, 404);

  assert.equal(stub.calls.length, 0, 'none of these reached OpenAI');

  // The roles that may: a recruiter and the super admin.
  assert.equal((await recruiter.put(profilePath(job), body)).status, 200);
  assert.equal((await admin.put(profilePath(job), body)).status, 200);
  assert.equal((await recruiter.post(rerunPath(job))).status, 200);
  assert.equal((await admin.post(draftPath(job))).status, 200);
  assert.equal((await admin.delete(profilePath(job))).status, 200);
  assert.equal(stub.calls.length, 1, 'only the draft called OpenAI');
});

// =====================================================================
// Running the rules again for a job
// =====================================================================

test('re-run for a job: existing results are evaluated again by the rules, nothing is created and nothing else changes', async (t) => {
  const job = await makeJob('rerun');
  const otherJob = await makeJob('rerun-other');
  const stub = openAiStub(t);

  // Three results: two from public applications, one run by staff.
  const one = await apply(job, { email: 'rerun.one@example.com', skills: 'UVM, VCS, Python', location: 'Pune, India', experienceYears: '2' });
  const two = await apply(job, { email: 'rerun.two@example.com', skills: 'SystemVerilog, Assertions, Perl', experienceYears: '9' });
  const staffCandidate = await makeCandidate('rerun-staff');
  const three = await runRules(staffCandidate, job);
  // And one for another job, which must be left alone.
  const elsewhere = await runRules(staffCandidate, otherJob);
  await quietOutbox();

  // A review, labels, a shortlist and an AI comparison that must survive.
  assert.equal((await manager.patch(`/api/admin/ats-results/${one.id}/review`, { json: { state: 'HOLD', note: 'Waiting for the hiring manager.' } })).status, 200);
  assert.equal((await recruiter.patch(`/api/admin/applications/${one.application._id}`, { json: { labels: ['INTERVIEWED'] } })).status, 200);
  assert.equal((await recruiter.patch(`/api/admin/candidates/${two.candidate._id}`, { json: { labels: ['SELECTED'] } })).status, 200);
  assert.equal((await recruiter.post(`/api/admin/applications/${two.application._id}/shortlist`)).status, 200);
  assert.equal((await recruiter.post(singlePath(one.id))).status, 200);
  assert.equal(stub.calls.length, 1);
  stub.calls.length = 0;
  await quietOutbox();

  const readResults = async () => {
    const results = await ctx.models.ATSResult.find({ jobId: job._id });
    return new Map(results.map((result) => [String(result._id), result]));
  };
  const applicationsOf = async () => JSON.parse(JSON.stringify((await ctx.models.Application.find({ jobId: job._id })).map((doc) => doc.toObject()).sort((a, b) => String(a._id).localeCompare(String(b._id)))));
  const candidatesOf = async () => JSON.parse(JSON.stringify((await ctx.models.Candidate.find({ _id: { $in: [one.candidate._id, two.candidate._id, staffCandidate._id] } })).map((doc) => doc.toObject()).sort((a, b) => String(a._id).localeCompare(String(b._id)))));
  const beforeResults = await readResults();
  const beforeApplications = await applicationsOf();
  const beforeCandidates = await candidatesOf();
  const beforeElsewhere = (await ctx.models.ATSResult.findById(elsewhere.id)).toObject();
  const beforeComparison = JSON.parse(JSON.stringify(beforeResults.get(one.id).aiComparison));
  assert.equal(beforeResults.size, 3);
  for (const result of beforeResults.values()) assert.equal(result.weightSource, 'BASELINE');

  // The profile changes what is asked for. Saving it re-evaluates nobody.
  await saveProfile(job, { requiredSkills: ['UVM'], tools: ['VCS'], minYears: 1, weights: { skills: 60, experience: 20, preferredSkills: 0, tools: 20, domain: 0, location: 0, completeness: 0 } });
  for (const [id, result] of await readResults()) assert.equal(result.totalScore, beforeResults.get(id).totalScore, 'saving a profile changes no result');

  await wait(5);
  const rerun = await recruiter.post(rerunPath(job));
  assert.equal(rerun.status, 200);
  assert.deepEqual(rerun.body.data, { evaluated: 3, total: 3 });

  const afterResults = await readResults();
  assert.equal(afterResults.size, 3, 'no result was created');
  assert.deepEqual([...afterResults.keys()].sort(), [...beforeResults.keys()].sort(), 'and they are the same results');
  assert.equal(await ctx.models.ATSResult.countDocuments({}), (await ctx.models.ATSResult.find({})).length);
  // one: UVM yes (100*60), 2 years of 1+ (100*20), VCS yes (100*20) = 100
  // two: UVM no (0*60), 9 years (100*20), VCS no (0*20) = 2000 / 100 = 20
  // three (staff): UVM yes, 2 years, VCS yes = 100
  assert.deepEqual([afterResults.get(one.id).totalScore, afterResults.get(two.id).totalScore, afterResults.get(three.id).totalScore], [100, 20, 100]);
  for (const [id, result] of afterResults) {
    const earlier = beforeResults.get(id);
    assert.notEqual(result.totalScore, earlier.totalScore, 'the score follows the new profile');
    assert.equal(result.weightSource, 'JOB');
    assert.equal(result.usedRequirementProfile, true);
    assert.deepEqual({ ...result.weights }, { skills: 60, experience: 20, tools: 20 });
    assert.deepEqual([...result.requiredSkills], ['UVM']);
    assert.equal(result.runByName, 'Test RECRUITER');
    assert.ok(result.runAt.getTime() > earlier.runAt.getTime());
    // Still tied to the same candidate, job and application.
    assert.deepEqual([String(result.candidateId), String(result.jobId), String(result.applicationId)], [String(earlier.candidateId), String(earlier.jobId), String(earlier.applicationId)]);
  }
  assert.deepEqual([...afterResults.get(two.id).toolsMissing], ['VCS']);

  // No model was involved.
  assert.equal(stub.calls.length, 0, 'the re-run calls no OpenAI');
  // The AI comparison and the recruiter's review are kept as they were.
  assert.deepEqual(JSON.parse(JSON.stringify(afterResults.get(one.id).aiComparison)), beforeComparison);
  assert.equal(afterResults.get(one.id).aiComparison.overallMatch, 72);
  assert.deepEqual([afterResults.get(one.id).review.state, afterResults.get(one.id).review.note, afterResults.get(one.id).review.reviewerName], ['HOLD', 'Waiting for the hiring manager.', 'Test HIRING_MANAGER']);
  assert.equal(afterResults.get(two.id).aiComparison, null, 'and none appeared where there was none');
  assert.equal(afterResults.get(two.id).review.state, 'PENDING');
  // No application status, label or shortlist changed, no candidate
  // changed, and nobody was emailed.
  const afterApplications = await applicationsOf();
  assert.deepEqual(afterApplications, beforeApplications);
  assert.deepEqual(afterApplications.map((application) => application.status).sort(), ['NEW', 'SHORTLISTED']);
  assert.deepEqual(await candidatesOf(), beforeCandidates);
  await wait(150);
  assert.equal(ctx.outbox.length, 0, 'no email');
  // The result of another job was not touched.
  assert.deepEqual((await ctx.models.ATSResult.findById(elsewhere.id)).toObject(), beforeElsewhere);

  // Audited with the counts.
  const log = await audit(`entityType=job&entityId=${job._id}&action=ats.job_reevaluated`);
  assert.equal(log.length, 1);
  assert.deepEqual(log[0].metadata, { evaluated: 3, total: 3 });

  // A result whose candidate no longer exists is left as it is, and the
  // others are still evaluated.
  const orphan = await ctx.models.ATSResult.create({ candidateId: otherJob._id, jobId: job._id, totalScore: 7, skillScore: 7, experienceScore: 7, domainScore: 7, locationScore: 7, completenessScore: 7 });
  const withOrphan = await recruiter.post(rerunPath(job));
  assert.deepEqual(withOrphan.body.data, { evaluated: 3, total: 4 });
  assert.equal((await ctx.models.ATSResult.findById(orphan._id)).totalScore, 7);
  await ctx.models.ATSResult.deleteOne({ _id: orphan._id });

  // A job with no results, and ids.
  const empty = await makeJob('rerun-empty');
  assert.deepEqual((await recruiter.post(rerunPath(empty))).body.data, { evaluated: 0, total: 0 });
  assert.equal((await recruiter.post('/api/admin/jobs/0123456789abcdef01234567/ats/re-run')).status, 404);
  assert.equal((await recruiter.post('/api/admin/jobs/not-an-id/ats/re-run')).status, 400);
  assert.equal(stub.calls.length, 0);
});

// =====================================================================
// "Draft with AI"
// =====================================================================

test('AI draft: one request with the job description only, a validated draft comes back and nothing is stored', async (t) => {
  const description = 'Own the constrained-random testbench for the DRAFT-MARKER-DESCRIPTION controller and close coverage.';
  const job = await makeJob('draft', { description, summary: 'DRAFT-MARKER-SUMMARY of the role.', responsibilities: ['DRAFT-MARKER-RESPONSIBILITY'] });
  // A candidate of this job, whose data must not travel with the draft.
  const applicant = await apply(job, { email: 'draft.applicant@example.com', name: 'Draftina Applicantova', phone: '+91 91234 56780', headline: 'DRAFT-CANDIDATE-HEADLINE', skills: 'DraftCandidateSkill, UVM', message: 'DRAFT-CANDIDATE-COVER-NOTE' }, 'draft-candidate-resume.pdf');
  await quietOutbox();
  const stub = openAiStub(t);
  const jobBefore = JSON.parse(JSON.stringify((await storedJob(job)).toObject()));
  const snapshotBefore = await recruitmentSnapshot();

  const drafted = await recruiter.post(draftPath(job));
  assert.equal(drafted.status, 200);
  assert.deepEqual(Object.keys(drafted.body.data).sort(), ['draft', 'model', 'saved']);
  assert.equal(drafted.body.data.saved, false);
  assert.equal(drafted.body.data.model, 'test-comparison-model-2026-01-01', 'the model the provider says answered');
  assert.deepEqual(drafted.body.data.draft, expectedDraft());
  assert.deepEqual(Object.keys(drafted.body.data.draft).sort(), [
    'certifications', 'constraints', 'domains', 'education', 'location', 'minYears', 'niceToHave', 'preferredExperience', 'preferredSkills', 'preferredYears',
    'requiredExperience', 'requiredSkills', 'responsibilities', 'seniority', 'tools', 'uncertainties', 'weights', 'workArrangement',
  ]);

  // The request: one call, structured output in strict mode, no options.
  assert.equal(stub.calls.length, 1);
  const [call] = stub.calls;
  assert.equal(call.url, OPENAI_URL);
  assert.equal(call.method, 'POST');
  assert.equal(call.headers.Authorization, `Bearer ${process.env.OPENAI_API_KEY}`);
  assert.ok(call.signal instanceof AbortSignal, 'the request has a time limit');
  assert.deepEqual(Object.keys(call.body).sort(), ['messages', 'model', 'response_format']);
  assert.equal(call.body.model, 'test-comparison-model');
  assert.equal(call.body.response_format.type, 'json_schema');
  const format = call.body.response_format.json_schema;
  assert.equal(format.name, 'job_requirement_profile');
  assert.equal(format.strict, true);
  assert.equal(format.schema.additionalProperties, false);
  assert.deepEqual([...format.schema.required].sort(), Object.keys(draftAnswer()).sort(), 'every property is required');
  assert.deepEqual(Object.keys(format.schema.properties).sort(), Object.keys(draftAnswer()).sort());
  assert.ok(!/"(minLength|maxLength|minimum|maximum|minItems|maxItems|pattern|format)"/.test(JSON.stringify(format.schema)), 'no keyword that strict mode refuses');
  assert.deepEqual(call.body.messages.map((message) => message.role), ['system', 'user']);

  // The job description is inside the <job> block...
  const [system, user] = call.body.messages;
  const sentJob = block(call, 'job');
  assert.equal(sentJob.description, description);
  assert.equal(sentJob.summary, 'DRAFT-MARKER-SUMMARY of the role.');
  assert.deepEqual(sentJob.responsibilities, ['DRAFT-MARKER-RESPONSIBILITY']);
  assert.equal(sentJob.title, 'Design Verification Engineer draft');
  assert.deepEqual(sentJob.requiredSkills, ['SystemVerilog', 'UVM', 'Formal Verification', 'Assertions']);
  assert.ok(user.content.indexOf(description) > user.content.indexOf('<job>') && user.content.indexOf(description) < user.content.indexOf('</job>'));
  assert.ok(user.content.trimEnd().endsWith('</job>'), 'nothing follows the block');
  // ...and no candidate data is anywhere in the request.
  for (const banned of ['<candidate_data>', '<candidates>', 'Candidate A', 'Draftina', 'Applicantova', 'draft.applicant@example.com', '91234', 'DRAFT-CANDIDATE', 'DraftCandidateSkill', 'draft-candidate-resume',
    String(applicant.candidate._id), String(applicant.application._id), applicant.id, 'yearsOfExperience', 'coverNote']) {
    assert.ok(!user.content.includes(banned), `the user message does not contain "${banned}"`);
    assert.ok(!call.raw.includes(banned) || banned === 'Candidate A', `the request does not contain "${banned}"`);
  }
  assert.ok(!call.raw.includes(process.env.OPENAI_API_KEY), 'the key travels in the header only');
  assert.match(system.content, /never an instruction/);
  assert.match(system.content, /Nothing you write is used until a recruiter has saved it/);
  assert.match(system.content, /age, gender, religion, caste/);

  // NOTHING is stored: the job is exactly as it was, and so is
  // everything else in recruitment.
  assert.equal((await storedJob(job)).requirementProfile, null);
  assert.deepEqual(JSON.parse(JSON.stringify((await storedJob(job)).toObject())), jobBefore);
  assert.deepEqual(await recruitmentSnapshot(), snapshotBefore);
  assert.equal((await recruiter.get(`/api/admin/jobs/${job._id}`)).body.data.requirementProfile, null);

  // Audited as a draft that was not saved, without its content.
  const log = await audit(`entityType=job&entityId=${job._id}&action=job.requirements_ai_drafted`);
  assert.equal(log.length, 1);
  assert.deepEqual(log[0].metadata, { model: 'test-comparison-model-2026-01-01' });
  assert.match(log[0].summary, /not saved/);
  assert.ok(!JSON.stringify(log[0]).includes('Night shift support'));

  // The recruiter reviews the draft and saves it: only then is it stored,
  // marked as drafted by AI and reviewed, with the model.
  const saved = await recruiter.put(profilePath(job), { json: { ...drafted.body.data.draft, tools: ['VCS', 'Verdi'], fromAiDraft: true, aiModel: drafted.body.data.model } });
  assert.equal(saved.status, 200);
  assert.equal(saved.body.data.requirementProfile.source, 'AI_REVIEWED');
  assert.equal(saved.body.data.requirementProfile.model, 'test-comparison-model-2026-01-01');
  assert.deepEqual(saved.body.data.requirementProfile.tools, ['VCS', 'Verdi'], 'with the recruiter\'s correction');
  assert.equal(saved.body.data.requirementProfile.minYears, 4);
  assert.deepEqual(saved.body.data.requirementProfile.weights, draftAnswer().suggestedWeights);
  assert.ok(!('uncertainties' in saved.body.data.requirementProfile), 'the uncertainties are for the recruiter and are not part of a profile');
  assert.equal(saved.body.data.scoring.source, 'JOB');
  assert.deepEqual((await audit(`entityType=job&entityId=${job._id}&action=job.requirements_saved`))[0].metadata, { source: 'AI_REVIEWED', ownWeights: true });
  assert.equal(stub.calls.length, 1, 'saving calls no model');

  // A second draft is made from the job as it is written, not from the
  // saved profile, and leaves the saved profile as it is.
  const kept = await storedProfile(job);
  stub.responder = answerWith(draftAnswer({ requiredSkills: ['Something else entirely'], workArrangement: 'NOT_STATED', suggestedWeights: { skills: 0, experience: 0, preferredSkills: 0, tools: 0, domain: 0, location: 0, completeness: 0 } }));
  const second = await recruiter.post(draftPath(job));
  assert.equal(second.status, 200);
  assert.deepEqual(second.body.data.draft.requiredSkills, ['Something else entirely']);
  assert.equal(second.body.data.draft.workArrangement, '', 'NOT_STATED comes back empty');
  assert.equal(second.body.data.draft.weights, null, 'weights that add up to nothing mean the defaults');
  assert.ok(!('requirementProfile' in block(stub.calls[1], 'job')), 'the saved profile is not sent back to the model');
  assert.ok(!stub.calls[1].raw.includes('Verdi'));
  assert.deepEqual(await storedProfile(job), kept, 'the previous profile stays until a recruiter saves');

  // A profile typed by hand afterwards is MANUAL again, with no model.
  const manual = await recruiter.put(profilePath(job), { json: { ...profileBody(), aiModel: 'left-over-model' } });
  assert.deepEqual([manual.body.data.requirementProfile.source, manual.body.data.requirementProfile.model], ['MANUAL', null]);
});

test('AI draft: an answer that fails validation gives 502 and stores nothing; a job with nothing to read sends nothing', async (t) => {
  const job = await makeJob('draft-invalid');
  const stub = openAiStub(t);
  const without = (key) => { const answer = draftAnswer(); delete answer[key]; return answer; };
  const weights = draftAnswer().suggestedWeights;
  const cases = {
    'not JSON': answerWith('Here is the requirement profile you asked for.'),
    'a missing key': answerWith(without('constraints')),
    'missing weights': answerWith(without('suggestedWeights')),
    'an extra key': answerWith({ ...draftAnswer(), status: 'published' }),
    'an extra weight': answerWith(draftAnswer({ suggestedWeights: { ...weights, salary: 20 } })),
    'weights as strings': answerWith(draftAnswer({ suggestedWeights: Object.fromEntries(Object.entries(weights).map(([key, value]) => [key, String(value)])) })),
    'a weight above 100': answerWith(draftAnswer({ suggestedWeights: { ...weights, skills: 140 } })),
    'minimumYears 500': answerWith(draftAnswer({ minimumYears: 500 })),
    'minimumYears as text': answerWith(draftAnswer({ minimumYears: 'four' })),
    'preferredYears below 0': answerWith(draftAnswer({ preferredYears: -2 })),
    'an unknown work arrangement': answerWith(draftAnswer({ workArrangement: 'SOMETIMES' })),
    'a list that is a string': answerWith(draftAnswer({ tools: 'VCS, Verdi' })),
    'a refusal': answerWith(null, { refusal: 'I cannot help with that.' }),
    'an answer cut off at the length limit': answerWith(JSON.stringify(draftAnswer()).slice(0, 90), { finishReason: 'length' }),
    'no choices': () => jsonResponse(200, { id: 'chatcmpl-test', choices: [] }),
    'a body that is not JSON': () => jsonResponse(200, 'upstream said hello'),
  };
  for (const [label, responder] of Object.entries(cases)) {
    stub.responder = responder;
    const response = await recruiter.post(draftPath(job));
    assert.equal(response.status, 502, label);
    assert.equal(response.body.success, false, label);
    assert.equal(response.body.error.code, 'AI_INVALID_RESPONSE', label);
    assert.ok(!('data' in response.body), `${label}: no draft is returned`);
    assert.ok(response.body.error.message.length > 10 && !/cannot help|upstream|Here is/.test(JSON.stringify(response.body)), `${label}: the message is ours`);
    assert.equal((await storedJob(job)).requirementProfile, null, `${label}: nothing is stored`);
  }
  assert.equal(stub.calls.length, Object.keys(cases).length, 'one request each, no retry');
  assert.deepEqual(await auditActions(`entityType=job&entityId=${job._id}&action=job.requirements_ai_drafted`), [], 'and nothing is audited as drafted');

  // With a saved profile, an unusable answer leaves it as it is.
  await saveProfile(job);
  const kept = await storedProfile(job);
  stub.responder = cases['an extra key'];
  assert.equal((await recruiter.post(draftPath(job))).status, 502);
  assert.deepEqual(await storedProfile(job), kept);

  // A valid answer is cleaned and capped like everything else.
  stub.responder = answerWith(draftAnswer({
    requiredSkills: ['UVM', 'uvm', ' <i>SystemVerilog</i> ', ''],
    tools: Array.from({ length: 70 }, (_, i) => `Tool ${i}`),
    responsibilities: Array.from({ length: 30 }, (_, i) => `Responsibility ${i} ${'y'.repeat(400)}`),
    requiredExperience: `  <b>Block-level</b> verification. ${'x'.repeat(900)}`,
    minimumYears: 4.4,
  }));
  const cleaned = await recruiter.post(draftPath(job));
  assert.equal(cleaned.status, 200);
  const { draft } = cleaned.body.data;
  assert.deepEqual(draft.requiredSkills, ['UVM', 'SystemVerilog']);
  assert.equal(draft.tools.length, 40);
  assert.equal(draft.responsibilities.length, 20);
  assert.ok(draft.responsibilities.every((item) => item.length === 300));
  assert.equal(draft.requiredExperience.length, 400);
  assert.ok(draft.requiredExperience.startsWith('Block-level verification. xxx'));
  assert.equal(draft.minYears, 4);
  assert.ok(!/[<>]/.test(JSON.stringify(draft)));

  // A job with no description, summary or responsibilities: there is
  // nothing to draft from, so nothing is sent.
  const sentSoFar = stub.calls.length;
  stub.responder = validAnswers;
  const emptyJob = await makeJob('draft-empty', { description: '', summary: '', responsibilities: [] });
  const refused = await recruiter.post(draftPath(emptyJob));
  assert.equal(refused.status, 400);
  assert.equal(refused.body.error.code, 'BAD_REQUEST');
  assert.match(refused.body.error.message, /no description, summary or responsibilities/);
  const blankJob = await makeJob('draft-blank', { description: '   ', summary: '', responsibilities: [] });
  assert.equal((await recruiter.post(draftPath(blankJob))).status, 400);
  assert.equal(stub.calls.length, sentSoFar, 'OpenAI is not called');
  // Any one of the three is enough.
  for (const fields of [{ description: 'Verify things.', summary: '', responsibilities: [] }, { description: '', summary: 'A summary.', responsibilities: [] }, { description: '', summary: '', responsibilities: ['Plan the work'] }]) {
    const enough = await makeJob('draft-enough', fields);
    assert.equal((await recruiter.post(draftPath(enough))).status, 200);
  }
  assert.equal(stub.calls.length, sentSoFar + 3);
  // Ids.
  assert.equal((await recruiter.post('/api/admin/jobs/0123456789abcdef01234567/requirement-profile/ai-draft')).status, 404);
  assert.equal((await recruiter.post('/api/admin/jobs/not-an-id/requirement-profile/ai-draft')).status, 400);
  assert.equal(stub.calls.length, sentSoFar + 3);
});

test('AI draft: a second request for the same job while one is running answers 409', async (t) => {
  const job = await makeJob('draft-busy');
  const other = await makeJob('draft-busy-other');
  let release;
  const stub = openAiStub(t, () => {
    if (stub.calls.length > 1) return jsonResponse(200, completion(draftAnswer()));
    return new Promise((resolve) => { release = () => resolve(jsonResponse(200, completion(draftAnswer({ seniority: 'Held' })))); });
  });

  const first = recruiter.post(draftPath(job));
  await until(() => stub.calls.length === 1);
  const second = await recruiter.post(draftPath(job));
  assert.equal(second.status, 409);
  assert.equal(second.body.error.code, 'AI_IN_PROGRESS');
  assert.equal((await admin.post(draftPath(job))).status, 409, 'whoever asks');
  assert.equal(stub.calls.length, 1, 'no second request was paid for');
  // Another job is not held up, and the profile can still be saved.
  assert.equal((await recruiter.post(draftPath(other))).status, 200);
  assert.equal(stub.calls.length, 2);
  assert.equal((await recruiter.put(profilePath(job), { json: profileBody() })).status, 200);

  release();
  const done = await first;
  assert.equal(done.status, 200);
  assert.equal(done.body.data.draft.seniority, 'Held');
  // Finished: a draft can be asked for again.
  assert.equal((await recruiter.post(draftPath(job))).status, 200);
});

// =====================================================================
// AI is started by hand, and only by hand
// =====================================================================

test('AI runs only when a recruiter asks: an application, the rules and every page make no request to OpenAI', async (t) => {
  const stub = openAiStub(t);
  // The ledger starts empty here, so the counts below are this test's own.
  await ctx.models.AiUsage.deleteMany({});
  const ledgerBefore = await ctx.models.AiUsage.countDocuments({});
  const job = await makeJob('manual');

  // A visitor applies: the rules run, no model is called.
  const first = await apply(job, { email: 'manual.one@example.com' });
  const second = await apply(job, { email: 'manual.two@example.com', skills: 'Python, Perl, VCS' });
  await quietOutbox();
  assert.equal(stub.calls.length, 0, 'an application calls no model');
  assert.equal(first.result.engine, 'RULE_BASED');
  assert.equal(first.result.weightSource, 'BASELINE');
  assert.equal(first.result.runByName, 'System');
  assert.equal(first.result.aiComparison, null);
  assert.ok(first.result.checks.length > 0 && typeof first.result.totalScore === 'number');

  // Everything a recruiter opens or does, short of the three AI buttons.
  const quiet = [
    () => recruiter.get(`/api/admin/ats-results/${first.id}`),
    () => recruiter.get('/api/admin/ats-results'),
    () => recruiter.get(`/api/admin/ats-results?jobId=${job._id}`),
    () => recruiter.get(`/api/admin/candidates/${first.candidate._id}`),
    () => recruiter.get('/api/admin/candidates'),
    () => recruiter.get(`/api/admin/applications/${first.application._id}`),
    () => recruiter.get('/api/admin/applications'),
    () => recruiter.get(`/api/admin/jobs/${job._id}`),
    () => recruiter.get('/api/admin/jobs'),
    () => recruiter.get('/api/admin/ats/engine'),
    () => recruiter.get('/api/admin/ai/usage'),
    () => recruiter.get('/api/admin/settings'),
    () => recruiter.get(comparePath(job)),
    () => client().get('/api/public/jobs'),
    () => client().get(`/api/public/jobs/${job.slug}`),
    () => client().get('/health'),
    () => recruiter.put(profilePath(job), { json: profileBody() }),
    () => recruiter.post(rerunPath(job)),
    () => manager.patch(`/api/admin/ats-results/${first.id}/review`, { json: { state: 'ADVANCE', note: 'Looks right.' } }),
    () => recruiter.patch(`/api/admin/applications/${first.application._id}`, { json: { labels: ['INTERVIEWED'] } }),
    () => recruiter.patch(`/api/admin/candidates/${first.candidate._id}`, { json: { labels: ['SELECTED'] } }),
    () => recruiter.post(`/api/admin/applications/${first.application._id}/shortlist`),
    () => recruiter.delete(profilePath(job)),
    () => recruiter.post(rerunPath(job)),
  ];
  for (const [index, action] of quiet.entries()) {
    const response = await action();
    assert.equal(response.status, 200, `action ${index + 1}`);
  }
  assert.equal((await recruiter.post('/api/admin/ats/run', { json: { applicationId: String(first.application._id) } })).status, 201);
  assert.equal((await recruiter.post('/api/admin/ats/run', { json: { candidateId: String(second.candidate._id), jobId: String(job._id) } })).status, 201);
  // A job with a profile: an application to it is still rules only.
  await saveProfile(job);
  const third = await apply(job, { email: 'manual.three@example.com' });
  assert.equal(third.result.usedRequirementProfile, true, 'the rules used the profile');
  assert.equal(third.result.weightSource, 'JOB');
  await quietOutbox();

  assert.equal(stub.calls.length, 0, 'no request to OpenAI');
  assert.equal(await ctx.models.AiUsage.countDocuments({}), ledgerBefore, 'and nothing new in the usage ledger');
  for (const id of [first.id, second.id, third.id]) assert.equal((await ctx.models.ATSResult.findById(id)).aiComparison, null, 'no comparison appeared by itself');
  assert.equal((await storedJob(job)).candidateComparison, null);

  // Only the three POST routes call the model, once each.
  assert.equal((await recruiter.post(singlePath(first.id))).status, 200);
  assert.deepEqual(stub.calls.map(schemaName), ['candidate_job_comparison']);
  assert.equal((await recruiter.post(draftPath(job))).status, 200);
  assert.deepEqual(stub.calls.map(schemaName), ['candidate_job_comparison', 'job_requirement_profile']);
  assert.equal((await recruiter.post(comparePath(job), { json: { resultIds: [first.id, second.id] } })).status, 200);
  assert.deepEqual(stub.calls.map(schemaName), ['candidate_job_comparison', 'job_requirement_profile', 'candidates_job_comparison']);
  assert.ok(stub.calls.every((call) => call.url === OPENAI_URL && call.method === 'POST'));
  assert.equal(await ctx.models.AiUsage.countDocuments({}), 3);

  // Reading what they stored calls nothing.
  assert.equal((await recruiter.get(`/api/admin/ats-results/${first.id}`)).body.data.aiComparison.overallMatch, 72);
  assert.equal((await recruiter.get(comparePath(job))).body.data.comparison.candidates.length, 2);
  assert.equal((await recruiter.get('/api/admin/ai/usage')).status, 200);
  assert.equal(stub.calls.length, 3);
  await ctx.models.AiUsage.deleteMany({});
});

// =====================================================================
// One candidate compared with one job
// =====================================================================

test('AI comparison: the job\'s requirement profile is sent with the job, without weights or who saved it, and the 17 fields come back', async (t) => {
  const stub = openAiStub(t);
  const withProfile = await makeJob('single-profile');
  const withoutProfile = await makeJob('single-plain');
  const saved = await saveProfile(withProfile, { weights: { skills: 37, experience: 13, preferredSkills: 0, tools: 20, domain: 10, location: 10, completeness: 10 } });
  assert.equal(saved.scoring.source, 'JOB');
  const profiled = await apply(withProfile, { email: 'single.profile@example.com' });
  const plain = await apply(withoutProfile, { email: 'single.plain@example.com' });
  await quietOutbox();

  // With a profile.
  const compared = await recruiter.post(singlePath(profiled.id));
  assert.equal(compared.status, 200);
  const { model, comparedAt, comparedByName, usedRequirementProfile, ...fields } = compared.body.data.aiComparison;
  assert.deepEqual(Object.keys(fields).sort(), AI_FIELDS, 'the 17 fields of the answer');
  assert.deepEqual(fields, aiAnswer());
  assert.equal(usedRequirementProfile, true);
  assert.deepEqual([model, comparedByName], ['test-comparison-model-2026-01-01', 'Test RECRUITER']);
  assert.ok(Math.abs(Date.now() - Date.parse(comparedAt)) < 60_000);
  assert.equal((await ctx.models.ATSResult.findById(profiled.id)).aiComparison.usedRequirementProfile, true, 'stored with the comparison');

  assert.equal(stub.calls.length, 1);
  const sentJob = block(stub.calls[0], 'job');
  assert.deepEqual(sentJob.requirementProfile, {
    requiredTechnicalSkills: ['UVM', 'Formal Verification'],
    preferredTechnicalSkills: [],
    toolsAndTechnologies: ['VCS', 'Verdi', 'JasperGold'],
    domains: ['Semiconductor'],
    requiredExperience: 'Block-level verification of a bus protocol.',
    minimumYears: 2,
    preferredExperience: 'Has owned coverage closure.',
    preferredYears: 6,
    education: ['B.Tech Electronics'],
    certifications: ['PMP'],
    seniority: 'Mid-level',
    location: 'Bengaluru',
    workArrangement: 'HYBRID',
    keyResponsibilities: ['Write the verification plan', 'Close coverage'],
    niceToHave: ['Open source contributions'],
    otherConstraints: ['Night shift support'],
  }, 'the requirements, and nothing about scoring or who saved them');
  // The rest of the job is still there as background.
  assert.equal(sentJob.title, 'Design Verification Engineer single-profile');
  assert.deepEqual(sentJob.requiredSkills, ['SystemVerilog', 'UVM', 'Formal Verification', 'Assertions']);
  const recruiterUser = await ctx.models.User.findOne({ email: 'recruiter@example.com' });
  for (const banned of ['"weights"', 'savedBy', 'savedAt', 'Test RECRUITER', String(recruiterUser._id), '"source"', 'MANUAL', 'aiModel', ':37', ':13']) {
    assert.ok(!stub.calls[0].raw.replaceAll('\\"', '"').includes(banned), `the request does not contain ${banned}`);
  }
  assert.deepEqual(Object.keys(stub.calls[0].body).sort(), ['messages', 'model', 'response_format']);
  assert.equal(schemaName(stub.calls[0]), 'candidate_job_comparison');
  assert.equal(stub.calls[0].body.response_format.json_schema.strict, true);
  assert.deepEqual([...stub.calls[0].body.response_format.json_schema.schema.required].sort(), AI_FIELDS);
  assert.match(stub.calls[0].body.messages[0].content, /analyse the candidate against it first/);

  // Without a profile: null is sent, and false is stored.
  const comparedPlain = await recruiter.post(singlePath(plain.id));
  assert.equal(comparedPlain.status, 200);
  assert.equal(comparedPlain.body.data.aiComparison.usedRequirementProfile, false);
  const plainJob = block(stub.calls[1], 'job');
  assert.ok('requirementProfile' in plainJob);
  assert.equal(plainJob.requirementProfile, null);
  assert.equal((await ctx.models.ATSResult.findById(plain.id)).aiComparison.usedRequirementProfile, false);

  // The flag follows the job: remove the profile and compare again.
  assert.equal((await recruiter.delete(profilePath(withProfile))).status, 200);
  const again = await recruiter.post(singlePath(profiled.id));
  assert.equal(again.body.data.aiComparison.usedRequirementProfile, false);
  assert.equal(block(stub.calls[2], 'job').requirementProfile, null);

  // An answer in the earlier ten-field shape is no longer accepted...
  const tenFields = ['overallMatch', 'summary', 'matchedSkills', 'missingSkills', 'relevantExperience', 'experienceGaps', 'qualificationAssessment', 'strengths', 'concerns', 'recommendation'];
  stub.responder = answerWith(Object.fromEntries(tenFields.map((key) => [key, aiAnswer({ overallMatch: 5 })[key]])));
  const short = await recruiter.post(singlePath(plain.id));
  assert.equal(short.status, 502);
  assert.equal(short.body.error.code, 'AI_INVALID_RESPONSE');
  assert.equal((await ctx.models.ATSResult.findById(plain.id)).aiComparison.overallMatch, 72, 'and the stored comparison is kept');
});

test('AI comparison: a comparison stored in the earlier ten-field shape is still returned, with the new lists empty', async () => {
  const job = await makeJob('legacy');
  const fx = await apply(job, { email: 'legacy.shape@example.com' });
  const comparedAt = new Date('2026-09-01T08:30:00.000Z');
  // Written straight to the database, as a comparison made before the
  // new fields existed is.
  await ctx.models.ATSResult.updateOne({ _id: fx.result._id }, {
    $set: {
      aiComparison: {
        overallMatch: 64,
        summary: 'An earlier comparison.',
        matchedSkills: ['UVM'],
        missingSkills: ['Formal Verification'],
        relevantExperience: 'Six years are stated.',
        experienceGaps: ['Formal verification is not stated.'],
        qualificationAssessment: 'The level is met.',
        strengths: ['UVM'],
        concerns: ['No formal verification'],
        recommendation: 'Worth a call. The recruiter decides.',
        aiModel: 'earlier-model',
        comparedAt,
      },
    },
  });

  const expected = {
    overallMatch: 64,
    summary: 'An earlier comparison.',
    strongMatches: [],
    partialMatches: [],
    missingRequirements: [],
    domainRelevance: '',
    transferableSkills: [],
    evidence: [],
    uncertainties: [],
    usedRequirementProfile: false,
    matchedSkills: ['UVM'],
    missingSkills: ['Formal Verification'],
    relevantExperience: 'Six years are stated.',
    experienceGaps: ['Formal verification is not stated.'],
    qualificationAssessment: 'The level is met.',
    strengths: ['UVM'],
    concerns: ['No formal verification'],
    recommendation: 'Worth a call. The recruiter decides.',
    model: 'earlier-model',
    comparedAt: comparedAt.toISOString(),
    comparedByName: '',
  };
  const read = await recruiter.get(`/api/admin/ats-results/${fx.id}`);
  assert.equal(read.status, 200);
  assert.deepEqual(read.body.data.aiComparison, expected);
  assert.equal(Object.keys(read.body.data.aiComparison).length, 21, '17 fields of the answer and 4 about the run');
  const listed = await recruiter.get(`/api/admin/ats-results?candidateId=${fx.candidate._id}`);
  assert.deepEqual(listed.body.data[0].aiComparison, expected);
  const page = await recruiter.get(`/api/admin/candidates/${fx.candidate._id}`);
  assert.equal(page.status, 200);
  assert.deepEqual(page.body.data.atsResults[0].aiComparison, expected);

  // Running the rules again keeps it, and the re-run for the job too.
  assert.equal((await recruiter.post('/api/admin/ats/run', { json: { applicationId: String(fx.application._id) } })).status, 201);
  assert.equal((await recruiter.post(rerunPath(job))).status, 200);
  assert.deepEqual((await recruiter.get(`/api/admin/ats-results/${fx.id}`)).body.data.aiComparison, expected);
});

// =====================================================================
// Several candidates compared for one job
// =====================================================================

const PEOPLE = [
  { name: 'Meenakshi Raghavan', phone: '+91 98765 43210' },
  { name: 'Farrukh Dastoor', phone: '+91 97654 32109' },
  { name: 'Oluwaseun Adeyemi', phone: '+91 96543 21098' },
  { name: 'Katarzyna Wisniewska', phone: '+91 95432 10987' },
  { name: 'Thandiwe Mokoena', phone: '+91 94321 09876' },
  { name: 'Ignatius Pereira', phone: '+91 93210 98765' },
];

// A job and `count` applications to it through the public form, each
// from a person whose name, email address and phone number also appear
// in what they typed.
async function comparisonFixture(tag, count, { job: jobFields = {}, profile = null } = {}) {
  const job = await makeJob(tag, jobFields);
  if (profile) await saveProfile(job, profile);
  const entries = [];
  for (let i = 0; i < count; i += 1) {
    const person = PEOPLE[i];
    const email = `compare.${tag}.${i}@example.com`;
    const entry = await apply(job, {
      email,
      name: person.name,
      phone: person.phone,
      headline: `${person.name} - Verification Engineer ${i}`,
      skills: i % 2 ? 'Python, Perl, VCS' : 'SystemVerilog, UVM, Functional Coverage',
      experienceYears: String(3 + i),
      location: 'Mysuru, India',
      message: `I closed coverage on block ${i}.\nRegards, ${person.name}. Call me on ${person.phone} or write to ${email}.`,
    }, `resume-of-person-${i}.pdf`);
    entries.push({ ...entry, person, email });
  }
  await quietOutbox();
  return { job, entries, ids: entries.map((entry) => entry.id), path: comparePath(job) };
}

const storedComparison = async (job) => {
  const stored = (await storedJob(job)).candidateComparison;
  return stored ? JSON.parse(JSON.stringify(stored.toObject ? stored.toObject() : stored)) : null;
};

test('AI comparison of several candidates: one request with labels instead of names, the answer is stored on the job and read back', async (t) => {
  const fx = await comparisonFixture('several', 3, { profile: {} });
  const stub = openAiStub(t);
  const [first, second, third] = fx.entries;

  // Before: nothing is stored.
  const empty = await recruiter.get(fx.path);
  assert.equal(empty.status, 200);
  assert.deepEqual(empty.body.data, { comparison: null });

  // Chosen in an order of the recruiter's own: third, first, second.
  const chosen = [third, first, second];
  const compared = await recruiter.post(fx.path, { json: { resultIds: chosen.map((entry) => entry.id) } });
  assert.equal(compared.status, 200);
  assert.deepEqual(Object.keys(compared.body.data), ['comparison']);
  const { comparison } = compared.body.data;
  assert.deepEqual(Object.keys(comparison).sort(), ['candidates', 'comparedAt', 'comparedByName', 'considerations', 'jobId', 'model', 'requirements', 'summary', 'usedRequirementProfile']);
  assert.equal(comparison.jobId, String(fx.job._id));
  assert.equal(comparison.summary, candidatesAnswer([]).summary);
  assert.equal(comparison.usedRequirementProfile, true);
  assert.deepEqual([comparison.model, comparison.comparedByName], ['test-comparison-model-2026-01-01', 'Test RECRUITER']);
  assert.ok(Math.abs(Date.now() - Date.parse(comparison.comparedAt)) < 60_000);
  assert.deepEqual(comparison.requirements, candidatesAnswer([]).requirements);
  assert.deepEqual(comparison.considerations, candidatesAnswer([]).considerations);
  // One entry per chosen candidate, in the order chosen, with the label
  // it was sent under and the name looked up in the database.
  assert.deepEqual(comparison.candidates.map((entry) => [entry.label, entry.candidateName, entry.overallFit]), [
    ['Candidate A', 'Oluwaseun Adeyemi', 80], ['Candidate B', 'Meenakshi Raghavan', 65], ['Candidate C', 'Farrukh Dastoor', 50],
  ]);
  for (const [index, entry] of comparison.candidates.entries()) {
    assert.deepEqual(Object.keys(entry).sort(), ['applicationId', 'candidateId', 'candidateName', 'gaps', 'label', 'overallFit', 'resultId', 'standing', 'strengths', 'transferableSkills', 'uncertainties']);
    assert.deepEqual([entry.resultId, entry.candidateId, entry.applicationId], [chosen[index].id, String(chosen[index].candidate._id), String(chosen[index].application._id)]);
    const { label, ...sent } = candidateEntry(entry.label, index);
    assert.deepEqual({ overallFit: entry.overallFit, standing: entry.standing, strengths: entry.strengths, gaps: entry.gaps, transferableSkills: entry.transferableSkills, uncertainties: entry.uncertainties }, sent);
  }

  // The request: one call, strict structured output, no options.
  assert.equal(stub.calls.length, 1);
  const [call] = stub.calls;
  assert.equal(call.url, OPENAI_URL);
  assert.equal(call.headers.Authorization, `Bearer ${process.env.OPENAI_API_KEY}`);
  assert.deepEqual(Object.keys(call.body).sort(), ['messages', 'model', 'response_format']);
  assert.equal(call.body.model, 'test-comparison-model');
  assert.equal(schemaName(call), 'candidates_job_comparison');
  assert.equal(call.body.response_format.json_schema.strict, true);
  assert.equal(call.body.response_format.json_schema.schema.additionalProperties, false);
  assert.deepEqual([...call.body.response_format.json_schema.schema.required].sort(), ['candidates', 'considerations', 'requirements', 'summary']);
  assert.ok(!/"(minLength|maxLength|minimum|maximum|minItems|maxItems|pattern|format)"/.test(JSON.stringify(call.body.response_format.json_schema.schema)));

  // Candidates travel as "Candidate A", "Candidate B"... with what the
  // comparison needs.
  const sentCandidates = block(call, 'candidates');
  assert.deepEqual(sentCandidates.map((entry) => entry.label), ['Candidate A', 'Candidate B', 'Candidate C']);
  assert.deepEqual(sentCandidates.map((entry) => entry.yearsOfExperience), [5, 3, 4], 'in the order chosen');
  assert.deepEqual(sentCandidates[0].skills, ['SystemVerilog', 'UVM', 'Functional Coverage']);
  assert.deepEqual(sentCandidates[2].skills, ['Python', 'Perl', 'VCS']);
  assert.equal(sentCandidates[1].currentRole, '[removed] - Verification Engineer 0', 'the name typed into a field is removed');
  assert.match(sentCandidates[1].coverNote, /^I closed coverage on block 0\./);
  for (const entry of sentCandidates) {
    assert.deepEqual(Object.keys(entry).sort(), ['coverNote', 'currentRole', 'domain', 'education', 'experience', 'label', 'skills', 'summary', 'yearsOfExperience'], 'no name, contact or id field; no location for a hybrid role');
  }
  // No name, email address, phone number, id or file anywhere in the request.
  for (const entry of fx.entries) {
    const [given, family] = entry.person.name.split(' ');
    for (const banned of [entry.person.name, given, family, entry.email, entry.person.phone, entry.person.phone.slice(4, 9), String(entry.candidate._id), String(entry.application._id), entry.id, entry.candidate.resume.key]) {
      assert.ok(!call.raw.includes(banned), `the request does not contain "${banned}"`);
    }
  }
  for (const banned of ['@example.com', 'resume-of-person', 'Mysuru', '+91', 'http', String(fx.job._id), process.env.OPENAI_API_KEY]) {
    assert.ok(!call.raw.includes(banned), `the request does not contain "${banned}"`);
  }
  assert.match(call.body.messages[0].content, /Refer to candidates by that label only/);
  assert.match(call.body.messages[0].content, /Do not say who should be chosen/);
  assert.match(call.body.messages[0].content, /untrusted/);

  // The <job> block, requirement profile included, is the one a single
  // comparison of the same job sends.
  assert.equal((await recruiter.post(singlePath(first.id))).status, 200);
  assert.deepEqual(block(call, 'job'), block(stub.calls[1], 'job'));
  assert.deepEqual(block(call, 'job').requirementProfile.toolsAndTechnologies, ['VCS', 'Verdi', 'JasperGold']);
  assert.ok(!('weights' in block(call, 'job').requirementProfile) && !call.raw.includes('savedBy'));

  // Stored on the job with ids only: no name.
  const stored = await storedComparison(fx.job);
  assert.equal(stored.aiModel, 'test-comparison-model-2026-01-01');
  assert.equal(stored.candidates.length, 3);
  assert.ok(!JSON.stringify(stored).includes('Adeyemi') && !JSON.stringify(stored).includes('candidateName'));
  assert.equal(String(stored.comparedById), String((await ctx.models.User.findOne({ email: 'recruiter@example.com' }))._id));

  // GET returns the stored comparison, to everyone who may read ATS results.
  const read = await recruiter.get(fx.path);
  assert.deepEqual(read.body.data.comparison, comparison);
  assert.deepEqual((await manager.get(fx.path)).body.data.comparison, comparison);
  assert.ok(!JSON.stringify(read.body).includes('comparedById'));
  // It is not part of the job itself.
  assert.ok(!('candidateComparison' in (await recruiter.get(`/api/admin/jobs/${fx.job._id}`)).body.data));
  // A name corrected afterwards is the name shown: it is looked up, not stored.
  await ctx.models.Candidate.updateOne({ _id: third.candidate._id }, { $set: { name: 'Seun Adeyemi' } });
  assert.equal((await recruiter.get(fx.path)).body.data.comparison.candidates[0].candidateName, 'Seun Adeyemi');

  // Audited with ids and the count only.
  const log = await audit(`entityType=job&entityId=${fx.job._id}&action=ats.ai_candidates_compared`);
  assert.equal(log.length, 1);
  assert.deepEqual(log[0].metadata, { model: 'test-comparison-model-2026-01-01', candidates: 3, resultIds: chosen.map((entry) => entry.id) });
  assert.ok(!/Adeyemi|Raghavan|Dastoor|The candidates are compared/.test(JSON.stringify(log[0])), 'no name and no answer in the audit log');

  // A second comparison replaces the first.
  stub.responder = (request) => jsonResponse(200, completion(candidatesAnswer(labelsSent(request), { summary: 'A second comparison.' })));
  const replaced = await admin.post(fx.path, { json: { resultIds: [first.id, second.id] } });
  assert.equal(replaced.status, 200);
  assert.deepEqual([replaced.body.data.comparison.summary, replaced.body.data.comparison.comparedByName, replaced.body.data.comparison.candidates.length], ['A second comparison.', 'Test SUPER_ADMIN', 2]);
  assert.deepEqual(replaced.body.data.comparison.candidates.map((entry) => entry.candidateName), ['Meenakshi Raghavan', 'Farrukh Dastoor']);
  assert.deepEqual((await recruiter.get(fx.path)).body.data.comparison, replaced.body.data.comparison);

  // Five candidates is the most, and a job without a profile says so.
  const five = await comparisonFixture('five', 5);
  const fiveCompared = await recruiter.post(five.path, { json: { resultIds: five.ids } });
  assert.equal(fiveCompared.status, 200);
  assert.deepEqual(fiveCompared.body.data.comparison.candidates.map((entry) => entry.label), ['Candidate A', 'Candidate B', 'Candidate C', 'Candidate D', 'Candidate E']);
  assert.equal(fiveCompared.body.data.comparison.usedRequirementProfile, false);
  const fiveCall = stub.calls[stub.calls.length - 1];
  assert.equal(block(fiveCall, 'job').requirementProfile, null);
  // This job is tied to a place, so the stated place is sent, as a place.
  assert.equal(block(fiveCall, 'candidates')[0].location, 'Mysuru, India');
});

test('AI comparison of several candidates: an answer that drops, repeats or invents a candidate is refused and the stored comparison is kept', async (t) => {
  const fx = await comparisonFixture('strict', 3);
  const stub = openAiStub(t);
  const body = { json: { resultIds: fx.ids } };
  assert.equal((await recruiter.post(fx.path, body)).status, 200);
  const kept = await storedComparison(fx.job);
  assert.equal(kept.candidates.length, 3);

  const all = ['Candidate A', 'Candidate B', 'Candidate C'];
  const withCandidates = (candidates, overrides = {}) => answerWith({ ...candidatesAnswer(all), candidates, ...overrides });
  const without = (key) => { const answer = candidatesAnswer(all); delete answer[key]; return answer; };
  const cases = {
    'a candidate is dropped': withCandidates([candidateEntry('Candidate A'), candidateEntry('Candidate B')]),
    'a label is repeated': withCandidates([candidateEntry('Candidate A'), candidateEntry('Candidate B'), candidateEntry('Candidate B')]),
    'a label is repeated next to a full set': withCandidates([...all.map((label) => candidateEntry(label)), candidateEntry('Candidate A')]),
    'a candidate is invented': withCandidates([candidateEntry('Candidate A'), candidateEntry('Candidate B'), candidateEntry('Candidate Z')]),
    'one candidate too many': withCandidates([...all.map((label) => candidateEntry(label)), candidateEntry('Candidate D')]),
    'a real name instead of a label': withCandidates([candidateEntry('Meenakshi Raghavan'), candidateEntry('Candidate B'), candidateEntry('Candidate C')]),
    'no candidates': withCandidates([]),
    'a fit above 100': withCandidates([candidateEntry('Candidate A', 0, { overallFit: 140 }), candidateEntry('Candidate B'), candidateEntry('Candidate C')]),
    'a fit as text': withCandidates([candidateEntry('Candidate A', 0, { overallFit: '80' }), candidateEntry('Candidate B'), candidateEntry('Candidate C')]),
    'an extra key on a candidate': withCandidates([{ ...candidateEntry('Candidate A'), decision: 'REJECT' }, candidateEntry('Candidate B'), candidateEntry('Candidate C')]),
    'an extra key on the answer': answerWith({ ...candidatesAnswer(all), ranking: all }),
    'a missing key': answerWith(without('considerations')),
    'not JSON': answerWith('Candidate A is the strongest.'),
    'a refusal': answerWith(null, { refusal: 'I cannot help with that.' }),
    'an answer cut off at the length limit': answerWith(candidatesAnswer(all), { finishReason: 'length' }),
  };
  for (const [label, responder] of Object.entries(cases)) {
    stub.responder = responder;
    const response = await recruiter.post(fx.path, body);
    assert.equal(response.status, 502, label);
    assert.equal(response.body.error.code, 'AI_INVALID_RESPONSE', label);
    assert.ok(!/cannot help|strongest/.test(JSON.stringify(response.body)), `${label}: the message is ours`);
    assert.deepEqual(await storedComparison(fx.job), kept, `${label}: the earlier comparison is kept`);
  }
  assert.equal(stub.calls.length, 1 + Object.keys(cases).length, 'one request each, no retry');
  assert.equal((await audit(`entityType=job&entityId=${fx.job._id}&action=ats.ai_candidates_compared`)).length, 1, 'only the comparison that was stored is audited');

  // With nothing stored before, a refused answer stores nothing.
  const fresh = await comparisonFixture('strict-fresh', 2);
  stub.responder = cases['a candidate is invented'];
  assert.equal((await recruiter.post(fresh.path, { json: { resultIds: fresh.ids } })).status, 502);
  assert.equal(await storedComparison(fresh.job), null);
  assert.deepEqual((await recruiter.get(fresh.path)).body.data, { comparison: null });

  // The model may answer in another order: entries are put back in the
  // order the recruiter chose, and long answers are capped.
  stub.responder = answerWith(candidatesAnswer(['Candidate B', 'Candidate A'], {
    summary: `  <b>Compared</b>. ${'x'.repeat(3000)}`,
    considerations: Array.from({ length: 12 }, (_, i) => `Consideration ${i}`),
    requirements: Array.from({ length: 20 }, (_, i) => ({ requirement: `Requirement ${i}`, comparison: 'Both state it.' })),
  }));
  const reordered = await recruiter.post(fresh.path, { json: { resultIds: fresh.ids } });
  assert.equal(reordered.status, 200);
  assert.deepEqual(reordered.body.data.comparison.candidates.map((entry) => [entry.label, entry.overallFit, entry.resultId]), [['Candidate A', 65, fresh.ids[0]], ['Candidate B', 80, fresh.ids[1]]]);
  assert.equal(reordered.body.data.comparison.summary.length, 1500);
  assert.ok(reordered.body.data.comparison.summary.startsWith('Compared. xxx'));
  assert.equal(reordered.body.data.comparison.considerations.length, 8);
  assert.equal(reordered.body.data.comparison.requirements.length, 12);
});

test('AI comparison of several candidates: the choice is validated and access is checked before anything is sent', async (t) => {
  const fx = await comparisonFixture('choice', 2);
  const stub = openAiStub(t);
  const [first, second] = fx.ids;
  // More results of the same job, by staff runs, to have six.
  const extra = [];
  for (let i = 0; i < 4; i += 1) extra.push((await runRules(await makeCandidate(`choice-${i}`), fx.job)).id);
  // A result of another job.
  const otherJob = await makeJob('choice-other');
  const foreign = (await runRules(await makeCandidate('choice-foreign'), otherJob)).id;
  const post = (resultIds, agent = recruiter, options = {}) => agent.post(fx.path, { json: { resultIds }, ...options });

  const invalid = {
    'one id': [first],
    'no ids': [],
    'six ids': [first, second, ...extra],
    'the same id twice': [first, first],
    'the same id twice in another case': [first, first.toUpperCase()],
    'an id that is not one': [first, 'not-an-id'],
    'ids that are not text': [first, { $ne: null }],
  };
  for (const [label, resultIds] of Object.entries(invalid)) {
    const response = await post(resultIds);
    assert.equal(response.status, 400, label);
    assert.equal(response.body.error.code, 'VALIDATION_ERROR', label);
    assert.ok(response.body.error.details.some((detail) => detail.field.startsWith('resultIds')), label);
  }
  const noBody = await recruiter.post(fx.path, { json: {} });
  assert.equal(noBody.status, 400);
  assert.equal(noBody.body.error.code, 'VALIDATION_ERROR');
  assert.equal((await recruiter.post(fx.path, { json: { resultIds: `${first},${second}` } })).status, 400);

  // A result of another job, or one that does not exist: refused, and
  // no request is made.
  for (const [label, resultIds] of Object.entries({ 'a result of another job': [first, foreign], 'a result that does not exist': [first, '0123456789abcdef01234567'], 'an id of a candidate': [first, String(fx.entries[1].candidate._id)] })) {
    const response = await post(resultIds);
    assert.equal(response.status, 400, label);
    assert.equal(response.body.error.code, 'BAD_REQUEST', label);
    assert.match(response.body.error.message, /of this job only/, label);
  }
  // The other job cannot be used to compare this job's results either.
  assert.equal((await recruiter.post(comparePath(otherJob), { json: { resultIds: [first, second] } })).status, 400);
  // Ids of the job itself.
  assert.equal((await recruiter.post('/api/admin/jobs/0123456789abcdef01234567/candidate-comparison', { json: { resultIds: [first, second] } })).status, 404);
  assert.equal((await recruiter.post('/api/admin/jobs/not-an-id/candidate-comparison', { json: { resultIds: [first, second] } })).status, 400);
  assert.equal((await recruiter.get('/api/admin/jobs/0123456789abcdef01234567/candidate-comparison')).status, 404);
  assert.equal((await recruiter.get('/api/admin/jobs/not-an-id/candidate-comparison')).status, 400);

  // Roles. A hiring manager may read (ats:read) and may not start one;
  // a content manager may do neither; signed out, neither.
  assert.equal((await manager.get(fx.path)).status, 200);
  const managerPost = await post([first, second], manager);
  assert.equal(managerPost.status, 403);
  assert.deepEqual(managerPost.body, (await manager.post('/api/admin/ats/run', { json: { applicationId: String(fx.entries[0].application._id) } })).body);
  assert.equal((await content.get(fx.path)).status, 403);
  assert.equal((await post([first, second], content)).status, 403);
  assert.equal((await client().get(fx.path)).status, 401);
  assert.equal((await post([first, second], client())).status, 401);
  // Without the header the frontend sends, or from another origin.
  assert.equal((await post([first, second], recruiter, { xhr: false })).status, 403);
  assert.equal((await post([first, second], recruiter, { origin: 'https://evil.example.com' })).status, 403);
  // It is a GET and a POST on the admin API only.
  assert.equal((await recruiter.put(fx.path, { json: { resultIds: [first, second] } })).status, 404);
  assert.equal((await recruiter.delete(fx.path)).status, 404);
  assert.equal((await client().post(`/api/public/jobs/${fx.job._id}/candidate-comparison`, { json: { resultIds: [first, second] } })).status, 404);

  assert.equal(stub.calls.length, 0, 'none of these reached OpenAI');
  assert.equal(await storedComparison(fx.job), null, 'and nothing was stored');
  assert.equal(await ctx.models.AiUsage.countDocuments({ jobId: fx.job._id }), 0);

  // Two and five are both accepted, by a recruiter and by the super admin.
  assert.equal((await post([first, second])).status, 200);
  const five = await post([first, second, ...extra.slice(0, 3)], admin);
  assert.equal(five.status, 200);
  assert.equal(five.body.data.comparison.candidates.length, 5);
  // A candidate entered by staff has no application.
  assert.equal(five.body.data.comparison.candidates[2].applicationId, null);
  assert.equal(stub.calls.length, 2);
  await ctx.models.AiUsage.deleteMany({});
});

test('AI comparison of several candidates: deleting one of the compared candidates removes the stored comparison', async (t) => {
  const fx = await comparisonFixture('delete', 3);
  const untouched = await comparisonFixture('delete-other', 2);
  openAiStub(t);
  // Two of the three are compared; the third is not part of it.
  assert.equal((await recruiter.post(fx.path, { json: { resultIds: [fx.ids[0], fx.ids[1]] } })).status, 200);
  assert.equal((await recruiter.post(untouched.path, { json: { resultIds: untouched.ids } })).status, 200);
  assert.ok(await storedComparison(fx.job));

  // Deleting a candidate who is not in the comparison keeps it.
  assert.equal((await recruiter.delete(`/api/admin/candidates/${fx.entries[2].candidate._id}`)).status, 403, 'a recruiter cannot delete a candidate');
  assert.equal((await admin.delete(`/api/admin/candidates/${fx.entries[2].candidate._id}`)).status, 200);
  assert.equal((await storedComparison(fx.job)).candidates.length, 2);
  assert.equal((await recruiter.get(fx.path)).body.data.comparison.candidates.length, 2);

  // Deleting one who is in it removes the whole comparison: it was
  // about the candidates together.
  const updatedBefore = (await storedJob(fx.job)).updatedAt.getTime();
  assert.equal((await admin.delete(`/api/admin/candidates/${fx.entries[0].candidate._id}`)).status, 200);
  assert.equal(await storedComparison(fx.job), null);
  assert.deepEqual((await recruiter.get(fx.path)).body.data, { comparison: null });
  assert.equal((await storedJob(fx.job)).updatedAt.getTime(), updatedBefore, 'the job\'s "updated" date did not move');
  assert.ok(!JSON.stringify((await storedJob(fx.job)).toObject()).includes('Raghavan'));
  // The comparison of another job is not touched.
  assert.equal((await storedComparison(untouched.job)).candidates.length, 2);
  // The remaining candidate, application and result are as they were.
  assert.equal(await ctx.models.ATSResult.countDocuments({ jobId: fx.job._id }), 1);
  assert.equal(await ctx.models.Application.countDocuments({ jobId: fx.job._id }), 1);
  assert.ok(await ctx.models.Candidate.findById(fx.entries[1].candidate._id));
});

test('AI comparison of several candidates: a second request for the same job while one is running answers 409', async (t) => {
  const fx = await comparisonFixture('busy', 2);
  const other = await comparisonFixture('busy-other', 2);
  let release;
  const stub = openAiStub(t, (call) => {
    if (stub.calls.length > 1) return validAnswers(call);
    return new Promise((resolve) => { release = () => resolve(jsonResponse(200, completion(candidatesAnswer(['Candidate A', 'Candidate B'], { summary: 'The held comparison.' })))); });
  });
  const body = { json: { resultIds: fx.ids } };

  const first = recruiter.post(fx.path, body);
  await until(() => stub.calls.length === 1);

  const second = await recruiter.post(fx.path, body);
  assert.equal(second.status, 409);
  assert.equal(second.body.error.code, 'AI_IN_PROGRESS');
  assert.match(second.body.error.message, /already running for this job/);
  assert.equal((await admin.post(fx.path, { json: { resultIds: [...fx.ids].reverse() } })).status, 409, 'whoever asks, whatever the choice');
  assert.equal(stub.calls.length, 1, 'no second request was paid for');
  // Reading meanwhile works and shows nothing yet.
  assert.deepEqual((await recruiter.get(fx.path)).body.data, { comparison: null });
  // Another job is not held up; neither is a single comparison or the
  // rules of the same job.
  assert.equal((await recruiter.post(other.path, { json: { resultIds: other.ids } })).status, 200);
  assert.equal((await recruiter.post(singlePath(fx.ids[0]))).status, 200);
  assert.equal((await recruiter.post(rerunPath(fx.job))).status, 200);
  assert.equal(stub.calls.length, 3);

  release();
  const done = await first;
  assert.equal(done.status, 200);
  assert.equal(done.body.data.comparison.summary, 'The held comparison.');
  // Finished: the job can be compared again.
  assert.equal((await recruiter.post(fx.path, body)).status, 200);
  await ctx.models.AiUsage.deleteMany({});
});

// =====================================================================
// AI is advice: it changes no status, label, shortlist, review or score
// =====================================================================

test('AI cannot change an application, a candidate, a review or a rule-based score, whatever the model answers', async (t) => {
  const fx = await comparisonFixture('advice', 2, { profile: {} });
  const [first, second] = fx.entries;
  // A state worth protecting: a label, a review, a shortlisted
  // application and a labelled candidate.
  assert.equal((await recruiter.patch(`/api/admin/applications/${first.application._id}`, { json: { labels: ['REJECTED'], recruiterNotes: 'Before any AI action.' } })).status, 200);
  assert.equal((await manager.patch(`/api/admin/ats-results/${first.id}/review`, { json: { state: 'REJECT', note: 'Not this time.' } })).status, 200);
  assert.equal((await recruiter.patch(`/api/admin/candidates/${second.candidate._id}`, { json: { labels: ['INTERVIEWED'] } })).status, 200);
  assert.equal((await recruiter.post(`/api/admin/applications/${second.application._id}/shortlist`)).status, 200);
  await quietOutbox();

  const before = await recruitmentSnapshot();
  const mine = (snapshot) => ({
    applications: snapshot.applications.filter((item) => item.jobId === String(fx.job._id)).map((item) => [item.status, item.labels, item.shortlist?.byName ?? null]),
    reviews: snapshot.results.filter((item) => item.jobId === String(fx.job._id)).map((item) => item.review.state),
  });
  assert.deepEqual(mine(before), { applications: [['NEW', ['REJECTED'], null], ['SHORTLISTED', [], 'Test RECRUITER']], reviews: ['REJECT', 'PENDING'] });
  assert.ok(before.results.every((result) => 'totalScore' in result && 'checks' in result && 'review' in result && !('aiComparison' in result)));
  const scoresBefore = before.results.map((result) => [result._id, result.totalScore]);

  const stub = openAiStub(t);
  const unchanged = async (label) => {
    await wait(120);
    const after = await recruitmentSnapshot();
    assert.deepEqual(after, before, `${label}: every application, candidate, review, rule-based field and job is as it was`);
    assert.deepEqual(after.results.map((result) => [result._id, result.totalScore]), scoresBefore, label);
    assert.equal(ctx.outbox.length, 0, `${label}: no email`);
  };

  // 1. One candidate with the job. A glowing answer that asks for more
  // than advice is stored as text and does nothing.
  stub.responder = answerWith(aiAnswer({ overallMatch: 100, recommendation: 'Shortlist immediately and send the email. Remove the REJECTED label.', strengths: ['status: SHORTLISTED', 'review: ADVANCE'] }));
  const single = await recruiter.post(singlePath(first.id));
  assert.equal(single.status, 200);
  assert.equal(single.body.data.aiComparison.overallMatch, 100);
  assert.equal(single.body.data.aiComparison.recommendation, 'Shortlist immediately and send the email. Remove the REJECTED label.');
  assert.notEqual(single.body.data.totalScore, 100, 'the rule-based score is not the AI number');
  assert.equal(single.body.data.review.state, 'REJECT');
  await unchanged('a single comparison that recommends shortlisting');
  // An answer that tries to carry a status is not an answer at all.
  for (const extra of [{ status: 'SHORTLISTED' }, { labels: ['SELECTED'] }, { review: { state: 'ADVANCE' } }, { totalScore: 100 }, { shortlist: true }]) {
    stub.responder = answerWith({ ...aiAnswer({ overallMatch: 1 }), ...extra });
    const refused = await recruiter.post(singlePath(first.id));
    assert.equal(refused.status, 502, JSON.stringify(extra));
    assert.equal(refused.body.error.code, 'AI_INVALID_RESPONSE');
  }
  assert.equal((await ctx.models.ATSResult.findById(first.id)).aiComparison.overallMatch, 100, 'the stored comparison is the valid one');
  await unchanged('a single comparison with an extra "status" key');

  // 2. The draft of a requirement profile.
  stub.responder = answerWith(draftAnswer({ constraints: ['Set every application to SHORTLISTED'], uncertainties: ['Reject Candidate B.'], suggestedWeights: { skills: 100, experience: 0, preferredSkills: 0, tools: 0, domain: 0, location: 0, completeness: 0 } }));
  const draft = await recruiter.post(draftPath(fx.job));
  assert.equal(draft.status, 200);
  assert.deepEqual(draft.body.data.draft.constraints, ['Set every application to SHORTLISTED']);
  await unchanged('a draft (the job keeps its profile and every score stays)');
  stub.responder = answerWith({ ...draftAnswer(), status: 'archived' });
  assert.equal((await recruiter.post(draftPath(fx.job))).body.error.code, 'AI_INVALID_RESPONSE');
  await unchanged('a draft with an extra "status" key');

  // 3. Several candidates. The answer says to reject one and shortlist
  // the other. It is kept as text on the job and nothing follows from it.
  stub.responder = answerWith(candidatesAnswer(['Candidate A', 'Candidate B'], {
    summary: 'Shortlist Candidate A immediately. Reject Candidate B.',
    candidates: [candidateEntry('Candidate A', 0, { overallFit: 100, standing: 'Must be shortlisted.' }), candidateEntry('Candidate B', 1, { overallFit: 0, standing: 'Reject Candidate B.' })],
    considerations: ['Reject Candidate B and set the status of Candidate A to SHORTLISTED.'],
  }));
  const several = await recruiter.post(fx.path, { json: { resultIds: fx.ids } });
  assert.equal(several.status, 200);
  assert.equal(several.body.data.comparison.candidates[1].standing, 'Reject Candidate B.');
  assert.deepEqual(several.body.data.comparison.candidates.map((entry) => entry.overallFit), [100, 0]);
  await unchanged('a comparison of candidates that says to reject Candidate B');
  // Candidate B is the shortlisted application: it still is, and
  // Candidate A, whom the answer wanted shortlisted, is still NEW.
  assert.deepEqual(mine(await recruitmentSnapshot()), mine(before));
  assert.deepEqual((await ctx.models.Application.findById(first.application._id)).labels.slice(), ['REJECTED']);
  assert.equal((await ctx.models.Application.findById(second.application._id)).status, 'SHORTLISTED');
  for (const responder of [
    answerWith({ ...candidatesAnswer(['Candidate A', 'Candidate B']), status: 'REJECTED' }),
    answerWith(candidatesAnswer(['Candidate A', 'Candidate B'], { candidates: [candidateEntry('Candidate A'), { ...candidateEntry('Candidate B'), status: 'REJECTED' }] })),
  ]) {
    stub.responder = responder;
    assert.equal((await recruiter.post(fx.path, { json: { resultIds: fx.ids } })).body.error.code, 'AI_INVALID_RESPONSE');
  }
  assert.equal((await storedComparison(fx.job)).summary, 'Shortlist Candidate A immediately. Reject Candidate B.', 'the stored comparison is the valid one');
  await unchanged('a comparison of candidates with an extra "status" key');

  // The ATS results gained their AI comparison and nothing else; the
  // audit log of the applications has no entry from any of this.
  assert.equal((await ctx.models.ATSResult.findById(second.id)).aiComparison, null);
  for (const entry of fx.entries) {
    const actions = await auditActions(`entityType=application&entityId=${entry.application._id}`);
    // "ai" as a word of its own: "application.shortlist_email" has the letters too.
    assert.ok(actions.every((action) => !/^ats\.|(^|[._])ai([._]|$)/.test(action)), `no AI entry on an application: ${actions.join(', ')}`);
  }
  // Shortlisting stays the recruiter's own, separate action.
  assert.equal((await recruiter.post(`/api/admin/applications/${first.application._id}/shortlist`)).status, 200);
  assert.equal((await ctx.models.Application.findById(first.application._id)).shortlist.byName, 'Test RECRUITER');
  await ctx.models.AiUsage.deleteMany({});
});

// =====================================================================
// A failing AI service does not stop recruitment
// =====================================================================

test('AI errors do not crash recruitment: after every kind of failure on each AI route the rest keeps working', async (t) => {
  const fx = await comparisonFixture('failures', 2, { profile: {} });
  const stub = openAiStub(t);
  const key = process.env.OPENAI_API_KEY;
  const providerText = `You exceeded your current quota, please check your plan and billing details. ${key} PROVIDER-RAW-TEXT`;
  const rejectWith = (error) => () => { throw error; };
  const failures = {
    'no credit left (429 insufficient_quota)': [() => jsonResponse(429, { error: { message: providerText, type: 'insufficient_quota', code: 'insufficient_quota' } }), 503, 'AI_QUOTA_EXCEEDED'],
    'key refused (401)': [() => jsonResponse(401, { error: { message: providerText, type: 'invalid_request_error', code: 'invalid_api_key' } }), 502, 'AI_FAILED'],
    'server error (500)': [() => jsonResponse(500, { error: { message: providerText, type: 'server_error' } }), 502, 'AI_FAILED'],
    'network error': [rejectWith(Object.assign(new TypeError(`fetch failed PROVIDER-RAW-TEXT ${key}`), { cause: { code: 'ECONNRESET' } })), 502, 'AI_FAILED'],
    'timeout': [rejectWith(new DOMException(`The operation was aborted due to timeout PROVIDER-RAW-TEXT ${key}`, 'TimeoutError')), 502, 'AI_FAILED'],
    'a body that is not JSON': [() => jsonResponse(200, '{"choices": [ {"message": PROVIDER-RAW-TEXT'), 502, 'AI_INVALID_RESPONSE'],
    'an answer that is not JSON': [answerWith('{"overallMatch": 72, "summary": PROVIDER-RAW-TEXT'), 502, 'AI_INVALID_RESPONSE'],
    'a refusal': [answerWith(null, { refusal: 'I cannot help with that. PROVIDER-RAW-TEXT' }), 502, 'AI_INVALID_RESPONSE'],
  };
  const routes = {
    'the comparison of one candidate': () => recruiter.post(singlePath(fx.ids[0])),
    'the draft of a requirement profile': () => recruiter.post(draftPath(fx.job)),
    'the comparison of several candidates': () => recruiter.post(fx.path, { json: { resultIds: fx.ids } }),
  };
  const profileBefore = await storedProfile(fx.job);

  let attempt = 0;
  for (const [routeLabel, callRoute] of Object.entries(routes)) {
    for (const [failureLabel, [responder, status, code]] of Object.entries(failures)) {
      const label = `${routeLabel}, ${failureLabel}`;
      attempt += 1;
      stub.responder = responder;
      const sentBefore = stub.calls.length;

      const failed = await callRoute();
      assert.equal(failed.status, status, label);
      assert.equal(failed.body.success, false, label);
      assert.equal(failed.body.error.code, code, label);
      const text = JSON.stringify(failed.body);
      assert.ok(!text.includes(key) && !text.includes('sk-test') && !text.includes('PROVIDER-RAW-TEXT') && !text.includes('ECONNRESET') && !text.includes('exceeded your current quota'), `${label}: no key, no provider text, no internals`);
      assert.match(failed.body.error.message, /^[A-Z][^<>{}]+\.$/, `${label}: a plain sentence`);
      assert.equal(stub.calls.length, sentBefore + 1, `${label}: exactly one request, no retry`);

      // The AI service is still failing. Recruitment carries on.
      // A visitor applies to the job.
      const applicant = await apply(fx.job, { email: `failures.${attempt}@example.com`, name: `Applicant Number ${attempt}` });
      assert.equal(applicant.application.status, 'NEW', label);
      assert.equal(applicant.result.usedRequirementProfile, true, `${label}: the rules ran with the application`);
      // A recruiter runs the rules, for one result and for the job.
      const run = await recruiter.post('/api/admin/ats/run', { json: { applicationId: String(applicant.application._id) } });
      assert.equal(run.status, 201, label);
      assert.equal(run.body.data.id, applicant.id);
      assert.equal(typeof run.body.data.totalScore, 'number');
      // A recruiter shortlists the application.
      const shortlisted = await recruiter.post(`/api/admin/applications/${applicant.application._id}/shortlist`);
      assert.equal(shortlisted.status, 200, label);
      assert.equal(shortlisted.body.data.application.status, 'SHORTLISTED', label);
      // The server answers its health check.
      const health = await client().get('/health', { origin: null, xhr: false });
      assert.equal(health.status, 200, label);
      assert.deepEqual(health.body, { status: 'ok', service: 'allsemis-api' });

      assert.equal(stub.calls.length, sentBefore + 1, `${label}: none of that called OpenAI`);
    }
  }
  assert.equal(attempt, 24);
  assert.equal(stub.calls.length, 24, 'one request per failed attempt');

  // Nothing was stored by any failure.
  for (const id of fx.ids) assert.equal((await ctx.models.ATSResult.findById(id)).aiComparison, null);
  assert.equal(await storedComparison(fx.job), null);
  assert.deepEqual(await storedProfile(fx.job), profileBefore);
  // The rest of the admin still reads and writes.
  assert.equal((await recruiter.get('/api/admin/ats-results')).status, 200);
  assert.equal((await recruiter.get('/api/admin/ai/usage')).status, 200);
  assert.equal((await recruiter.post(rerunPath(fx.job))).status, 200);
  assert.equal((await client().get('/ready')).status, 200);

  // And once the service answers again, each action works at the next
  // click: no failure left anything locked.
  stub.responder = validAnswers;
  for (const [routeLabel, callRoute] of Object.entries(routes)) assert.equal((await callRoute()).status, 200, routeLabel);
  assert.equal(stub.calls.length, 27);
  await ctx.models.AiUsage.deleteMany({});
});
