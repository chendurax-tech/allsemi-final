import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  startServer, stopServer, client, signedIn, multipart, applicationFields, pdfBytes, wait,
} from './helpers.js';

/*
  The AI usage ledger and the figures the dashboard reads from it.

  No request ever leaves the machine. Each test that could reach OpenAI
  replaces fetch so that requests to api.openai.com are answered by a
  fake; every other request, the tests' own HTTP client talking to the
  local server, goes to the real fetch, which is put back when the test
  ends.

  The settings a test changes (prices, budget, thresholds, the key) are
  put back the same way, so the tests do not depend on their order.
*/

const { env } = await import('../src/config/env.js');
const { estimateCostUsd, priceFor, usageLevel } = await import('../src/services/aiUsageService.js');

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

// ------------------------------------------------------------ helpers

const NO_SETTINGS = { monthlyBudgetUsd: null, inputCostPerMillion: null, outputCostPerMillion: null, thresholds: { notice: 50, warning: 75, critical: 90 } };

// Changes env.aiUsage (or env.openai) for one test and puts it back.
function withSettings(t, target, values) {
  const original = { ...target };
  Object.assign(target, values);
  t.after(() => { Object.assign(target, original); });
}

const usagePath = '/api/admin/ai/usage';
const usage = async (agent = recruiter) => (await agent.get(usagePath)).body.data;
const ledger = async () => ctx.models.AiUsage.find({}).sort({ at: 1 });
const clearLedger = async () => ctx.models.AiUsage.deleteMany({});

let count = 0;
async function makeJob(tag, fields = {}) {
  count += 1;
  return ctx.models.Job.create({
    title: `Verification Engineer ${tag}`,
    slug: `usage-${tag}-${count}`,
    status: 'published',
    category: 'Semiconductor',
    location: 'Bengaluru, India',
    experienceLevel: 'Mid-Level',
    summary: 'Block-level verification of a PCIe controller.',
    description: 'Own the constrained-random testbench and the coverage closure.',
    responsibilities: ['Write the verification plan'],
    requiredSkills: ['UVM', 'Formal Verification'],
    ...fields,
  });
}

// An application through the public form: the candidate, the
// application and the rule-based result.
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

// A job with two applicants, and the three AI routes for it.
async function fixture(tag, { job: jobFields = {}, first = {}, second = {} } = {}) {
  const job = await makeJob(tag, jobFields);
  const one = await apply(job, { email: `usage.${tag}.one@example.com`, ...first });
  const two = await apply(job, { email: `usage.${tag}.two@example.com`, ...second });
  await wait(150);
  ctx.outbox.length = 0;
  const routes = {
    CANDIDATE_COMPARISON: (agent = recruiter) => agent.post(`/api/admin/ats-results/${one.id}/ai-comparison`),
    JOB_REQUIREMENTS: (agent = recruiter) => agent.post(`/api/admin/jobs/${job._id}/requirement-profile/ai-draft`),
    CANDIDATE_RANKING: (agent = recruiter) => agent.post(`/api/admin/jobs/${job._id}/candidate-comparison`, { json: { resultIds: [one.id, two.id] } }),
  };
  return { job, one, two, routes };
}

// ------------------------------------------------------- the OpenAI fake

const jsonResponse = (status, body) => new Response(typeof body === 'string' ? body : JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const aiAnswer = (overrides = {}) => ({
  overallMatch: 72,
  summary: 'The stated skills cover most of what the role asks for.',
  strongMatches: ['UVM testbench work is stated'],
  partialMatches: ['Coverage closure is mentioned without detail'],
  missingRequirements: ['Formal verification is not stated'],
  matchedSkills: ['UVM'],
  missingSkills: ['Formal Verification'],
  relevantExperience: 'Six years of block-level verification are stated.',
  experienceGaps: ['Formal verification experience is not stated.'],
  domainRelevance: 'The stated domain is the domain of the role.',
  transferableSkills: ['Python scripting carries over to regression tooling'],
  qualificationAssessment: 'The stated years of experience meet the level of the role.',
  strengths: ['Hands-on UVM experience'],
  concerns: ['No formal verification is mentioned'],
  evidence: [{ requirement: 'UVM', evidence: 'Lists UVM among the skills.' }],
  uncertainties: ['Whether the coverage closure was owned is not stated.'],
  recommendation: 'Worth a conversation. The recruiter decides.',
  ...overrides,
});

const draftAnswer = (overrides = {}) => ({
  requiredSkills: ['UVM'],
  preferredSkills: [],
  tools: ['VCS'],
  domains: ['Semiconductor'],
  requiredExperience: 'Block-level verification.',
  minimumYears: 4,
  preferredExperience: '',
  preferredYears: null,
  education: [],
  certifications: [],
  seniority: 'Mid level',
  location: 'Bengaluru',
  workArrangement: 'ON_SITE',
  responsibilities: ['Write the verification plan'],
  niceToHave: [],
  constraints: [],
  suggestedWeights: { skills: 50, experience: 20, preferredSkills: 0, tools: 15, domain: 10, location: 5, completeness: 0 },
  uncertainties: [],
  ...overrides,
});

const candidatesAnswer = (overrides = {}) => ({
  summary: 'Candidate A states more of what the role asks for than Candidate B.',
  candidates: ['Candidate A', 'Candidate B'].map((label, index) => ({
    label, overallFit: 80 - index * 20, standing: 'Compared on the stated skills.', strengths: ['UVM'], gaps: [], transferableSkills: [], uncertainties: [],
  })),
  requirements: [{ requirement: 'UVM', comparison: 'Candidate A states it. Candidate B does not.' }],
  considerations: ['Check the formal verification experience of both.'],
  ...overrides,
});

const schemaName = (call) => call.body.response_format.json_schema.name;
const answerFor = (call, overrides = {}) => {
  if (schemaName(call) === 'job_requirement_profile') return draftAnswer(overrides);
  if (schemaName(call) === 'candidates_job_comparison') return candidatesAnswer(overrides);
  return aiAnswer(overrides);
};

// The envelope OpenAI wraps an answer in. `usage` is left out when it
// is given as null.
const completion = (answer, { model = 'test-comparison-model-2026-01-01', usage: tokens = { prompt_tokens: 1200, completion_tokens: 300, total_tokens: 1500 }, finishReason = 'stop', refusal = null } = {}) => {
  const body = {
    id: 'chatcmpl-test',
    object: 'chat.completion',
    model,
    choices: [{ index: 0, finish_reason: finishReason, message: { role: 'assistant', content: typeof answer === 'string' || answer === null ? answer : JSON.stringify(answer), refusal } }],
  };
  if (tokens !== null) body.usage = tokens;
  return body;
};
const valid = (options) => (call) => jsonResponse(200, completion(answerFor(call), options));

function openAiStub(t, responder = valid()) {
  const realFetch = globalThis.fetch;
  const stub = { calls: [], responder };
  globalThis.fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : String(input?.url ?? input);
    if (!url.startsWith('https://api.openai.com/')) return realFetch(input, init);
    const call = { url, raw: String(init?.body ?? ''), body: null };
    stub.calls.push(call);
    try { call.body = JSON.parse(call.raw); } catch { call.body = null; }
    return stub.responder(call);
  };
  t.after(() => { globalThis.fetch = realFetch; });
  return stub;
}

const OPERATIONS = ['CANDIDATE_COMPARISON', 'JOB_REQUIREMENTS', 'CANDIDATE_RANKING'];

// =====================================================================
// Recording
// =====================================================================

test('usage ledger: every request to OpenAI is recorded once, with the model, the operation, the tokens and the ids', async (t) => {
  await clearLedger();
  const stub = openAiStub(t);
  const fx = await fixture('record');

  for (const operation of OPERATIONS) assert.equal((await fx.routes[operation]()).status, 200, operation);
  assert.equal(stub.calls.length, 3);
  const entries = await ledger();
  assert.deepEqual(entries.map((entry) => entry.operation), OPERATIONS, 'one entry per request, in order');

  for (const entry of entries) {
    assert.equal(entry.success, true);
    assert.equal(entry.errorCategory, '');
    assert.equal(entry.httpStatus, 200);
    assert.equal(entry.aiModel, 'test-comparison-model-2026-01-01', 'the model the provider says answered');
    assert.deepEqual([entry.inputTokens, entry.outputTokens], [1200, 300]);
    assert.ok(Math.abs(Date.now() - entry.at.getTime()) < 60_000, 'the time of the request');
    assert.ok(Number.isInteger(entry.durationMs) && entry.durationMs >= 0);
    assert.equal(String(entry.jobId), String(fx.job._id));
    assert.equal(entry.actorName, 'Test RECRUITER');
    assert.equal(String(entry.actorId), String((await ctx.models.User.findOne({ email: 'recruiter@example.com' }))._id));
  }
  const [single, draft, several] = entries;
  // The single comparison names the candidate, the application and the result.
  assert.deepEqual([String(single.candidateId), String(single.applicationId), String(single.atsResultId)], [String(fx.one.candidate._id), String(fx.one.application._id), fx.one.id]);
  // The draft is about a job only.
  assert.deepEqual([draft.candidateId, draft.applicationId, draft.atsResultId, draft.candidateCount], [null, null, null, null]);
  // The comparison of several candidates says how many, not who.
  assert.deepEqual([several.candidateId, several.applicationId, several.atsResultId, several.candidateCount], [null, null, null, 2]);

  // Running one again adds one more entry.
  assert.equal((await admin.post(`/api/admin/ats-results/${fx.one.id}/ai-comparison`)).status, 200);
  const after = await ledger();
  assert.equal(after.length, 4);
  assert.equal(after[3].actorName, 'Test SUPER_ADMIN');
});

test('usage ledger: a request that fails is recorded too, with the kind of failure, and one request is made each time', async (t) => {
  await clearLedger();
  const stub = openAiStub(t);
  const fx = await fixture('failures');
  const key = process.env.OPENAI_API_KEY;
  const providerText = `Incorrect API key provided: ${key}. PROVIDER-RAW-TEXT`;
  const reject = (error) => () => { throw error; };
  // An answer with one required key missing, whichever format was asked for.
  const invalid = (call) => { const answer = answerFor(call); delete answer[Object.keys(answer)[0]]; return jsonResponse(200, completion(answer)); };
  // [the fake answer, the category recorded, the HTTP status recorded, the code the admin receives]
  const cases = {
    'no credit left (429 insufficient_quota)': [() => jsonResponse(429, { error: { message: providerText, type: 'insufficient_quota', code: 'insufficient_quota' } }), 'quota', 429, 'AI_QUOTA_EXCEEDED'],
    'rate limited (429)': [() => jsonResponse(429, { error: { message: providerText, type: 'requests', code: 'rate_limit_exceeded' } }), 'rate_limit', 429, 'AI_FAILED'],
    'key refused (401)': [() => jsonResponse(401, { error: { message: providerText, type: 'invalid_request_error', code: 'invalid_api_key' } }), 'auth', 401, 'AI_FAILED'],
    'permission (403)': [() => jsonResponse(403, { error: { message: providerText, type: 'insufficient_permissions' } }), 'auth', 403, 'AI_FAILED'],
    'unknown model (404)': [() => jsonResponse(404, { error: { message: providerText, type: 'invalid_request_error', code: 'model_not_found' } }), 'model', 404, 'AI_FAILED'],
    'request refused (400)': [() => jsonResponse(400, { error: { message: providerText, type: 'invalid_request_error' } }), 'bad_request', 400, 'AI_FAILED'],
    'server error (500)': [() => jsonResponse(500, { error: { message: providerText, type: 'server_error' } }), 'provider', 500, 'AI_FAILED'],
    'a page instead of an answer (502)': [() => new Response(`<html>PROVIDER-RAW-TEXT ${key}</html>`, { status: 502, headers: { 'content-type': 'text/html' } }), 'provider', 502, 'AI_FAILED'],
    'network error': [reject(Object.assign(new TypeError(`fetch failed PROVIDER-RAW-TEXT ${key}`), { cause: { code: 'ECONNREFUSED' } })), 'network', null, 'AI_FAILED'],
    'timeout': [reject(new DOMException('The operation was aborted due to timeout', 'TimeoutError')), 'timeout', null, 'AI_FAILED'],
    'an answer that fails validation': [invalid, 'invalid_response', 200, 'AI_INVALID_RESPONSE'],
    'an answer that is not JSON': [() => jsonResponse(200, completion('not json at all')), 'invalid_response', 200, 'AI_INVALID_RESPONSE'],
    'an answer that was cut off': [(call) => jsonResponse(200, completion(answerFor(call), { finishReason: 'length' })), 'invalid_response', 200, 'AI_INVALID_RESPONSE'],
    'a refusal': [() => jsonResponse(200, completion(null, { refusal: 'I cannot help with that.' })), 'refused', 200, 'AI_INVALID_RESPONSE'],
    'a filtered answer': [(call) => jsonResponse(200, completion(answerFor(call), { finishReason: 'content_filter' })), 'refused', 200, 'AI_INVALID_RESPONSE'],
  };

  let expected = 0;
  for (const operation of OPERATIONS) {
    for (const [label, [responder, category, httpStatus, code]] of Object.entries(cases)) {
      const name = `${operation}, ${label}`;
      stub.responder = responder;
      const response = await fx.routes[operation]();
      expected += 1;
      assert.equal(response.body.error.code, code, name);
      assert.equal(stub.calls.length, expected, `${name}: one request, no retry`);
      const entries = await ledger();
      assert.equal(entries.length, expected, `${name}: one entry`);
      const entry = entries[entries.length - 1];
      assert.deepEqual([entry.operation, entry.success, entry.errorCategory, entry.httpStatus], [operation, false, category, httpStatus], name);
      assert.equal(String(entry.jobId), String(fx.job._id), name);
      // A failure before any answer has no tokens and so no cost. An
      // answer that could not be used was still paid for.
      if (httpStatus === 200) assert.deepEqual([entry.inputTokens, entry.outputTokens], [1200, 300], `${name}: the tokens of an unusable answer are recorded`);
      else assert.deepEqual([entry.inputTokens, entry.outputTokens, entry.estimatedCostUsd], [null, null, null], name);
    }
  }
  // Nothing was stored by any of the failures.
  assert.equal((await ctx.models.ATSResult.findById(fx.one.id)).aiComparison, null);
  const job = await ctx.models.Job.findById(fx.job._id);
  assert.deepEqual([job.requirementProfile, job.candidateComparison], [null, null]);
});

test('usage ledger: what is refused before anything is sent records nothing', async (t) => {
  await clearLedger();
  const stub = openAiStub(t);
  const fx = await fixture('nothing');

  // Not allowed, not signed in, not valid, not found.
  assert.equal((await fx.routes.CANDIDATE_COMPARISON(manager)).status, 403);
  assert.equal((await fx.routes.JOB_REQUIREMENTS(content)).status, 403);
  assert.equal((await fx.routes.CANDIDATE_RANKING(client())).status, 401);
  assert.equal((await recruiter.post(`/api/admin/jobs/${fx.job._id}/candidate-comparison`, { json: { resultIds: [fx.one.id] } })).status, 400);
  assert.equal((await recruiter.post('/api/admin/ats-results/aaaaaaaaaaaaaaaaaaaaaaaa/ai-comparison')).status, 404);

  // Not configured: nothing is sent, so there is nothing to record.
  const original = { ...env.openai };
  try {
    for (const missing of [{ apiKey: '' }, { model: '' }]) {
      Object.assign(env.openai, original, missing);
      for (const operation of OPERATIONS) {
        const response = await fx.routes[operation]();
        assert.deepEqual([response.status, response.body.error.code], [503, 'AI_NOT_CONFIGURED'], operation);
      }
    }
  } finally {
    Object.assign(env.openai, original);
  }

  // A second click while the first is running is refused and not recorded.
  let release;
  stub.responder = (call) => new Promise((resolve) => { release = () => resolve(jsonResponse(200, completion(answerFor(call)))); });
  const pending = fx.routes.CANDIDATE_COMPARISON();
  for (let i = 0; i < 300 && stub.calls.length === 0; i += 1) await wait(10);
  assert.equal(stub.calls.length, 1);
  const refused = await fx.routes.CANDIDATE_COMPARISON(admin);
  assert.deepEqual([refused.status, refused.body.error.code], [409, 'AI_IN_PROGRESS']);
  assert.equal(await ctx.models.AiUsage.countDocuments({}), 0, 'nothing recorded until a request has ended');
  release();
  assert.equal((await pending).status, 200);
  assert.equal(stub.calls.length, 1);
  assert.equal(await ctx.models.AiUsage.countDocuments({}), 1, 'the one request that was sent');
});

test('usage ledger: tokens are recorded when OpenAI reports them and left empty when it does not', async (t) => {
  await clearLedger();
  const stub = openAiStub(t);
  const fx = await fixture('tokens');
  const cases = [
    [{ prompt_tokens: 4321, completion_tokens: 987, total_tokens: 5308 }, [4321, 987]],
    [{ prompt_tokens: 0, completion_tokens: 0 }, [0, 0]],
    [{ prompt_tokens: 50 }, [50, null]],
    [null, [null, null]],
    [{ prompt_tokens: '4321', completion_tokens: 'many' }, [null, null]],
    [{ prompt_tokens: -5, completion_tokens: 12.5 }, [null, null]],
    ['a lot', [null, null]],
  ];
  for (const [reported, stored] of cases) {
    stub.responder = valid({ usage: reported });
    assert.equal((await fx.routes.CANDIDATE_COMPARISON()).status, 200);
    const entry = (await ledger()).pop();
    assert.deepEqual([entry.inputTokens, entry.outputTokens], stored, JSON.stringify(reported));
    assert.equal(entry.success, true);
  }
});

// =====================================================================
// Estimated cost
// =====================================================================

test('estimated cost: tokens times the price per million, from the configured price or the list price', () => {
  const configured = { ...NO_SETTINGS, inputCostPerMillion: 2, outputCostPerMillion: 8 };
  // 1,000,000 input at 2 + 1,000,000 output at 8 = 10.
  assert.equal(estimateCostUsd({ model: 'any-model', inputTokens: 1_000_000, outputTokens: 1_000_000 }, configured), 10);
  // 1200 * 2 / 1e6 + 300 * 8 / 1e6 = 0.0024 + 0.0024 = 0.0048.
  assert.equal(estimateCostUsd({ model: 'any-model', inputTokens: 1200, outputTokens: 300 }, configured), 0.0048);
  assert.deepEqual(priceFor('any-model', configured), { input: 2, output: 8, source: 'CONFIGURED' });

  // The list price of gpt-5.4-mini: 0.75 input and 4.50 output.
  assert.deepEqual(priceFor('gpt-5.4-mini', NO_SETTINGS), { input: 0.75, output: 4.5, source: 'LIST' });
  assert.deepEqual(priceFor('gpt-5.4-mini-2026-03-17', NO_SETTINGS), { input: 0.75, output: 4.5, source: 'LIST' }, 'a dated version of the model');
  assert.deepEqual(priceFor('GPT-5.4-Mini', NO_SETTINGS), { input: 0.75, output: 4.5, source: 'LIST' });
  // 1,000,000 * 0.75 + 1,000,000 * 4.5 = 5.25.
  assert.equal(estimateCostUsd({ model: 'gpt-5.4-mini', inputTokens: 1_000_000, outputTokens: 1_000_000 }, NO_SETTINGS), 5.25);
  // 1200 * 0.75 / 1e6 + 300 * 4.5 / 1e6 = 0.0009 + 0.00135 = 0.00225.
  assert.equal(estimateCostUsd({ model: 'gpt-5.4-mini-2026-03-17', inputTokens: 1200, outputTokens: 300 }, NO_SETTINGS), 0.00225);
  // A configured price wins over the list price.
  assert.equal(estimateCostUsd({ model: 'gpt-5.4-mini', inputTokens: 1_000_000, outputTokens: 0 }, configured), 2);

  // A model with no known price cannot be estimated. A similar name is
  // not the same model.
  for (const model of ['some-other-model', 'gpt-5.4-mini-pro', 'gpt-5.4', '', null, undefined]) {
    assert.equal(priceFor(model, NO_SETTINGS), null, String(model));
    assert.equal(estimateCostUsd({ model, inputTokens: 100, outputTokens: 100 }, NO_SETTINGS), null, String(model));
  }
  // One price without the other is not a price: the list price is used
  // where there is one.
  const half = { ...NO_SETTINGS, inputCostPerMillion: 2 };
  assert.equal(priceFor('any-model', half), null);
  assert.equal(priceFor('gpt-5.4-mini', half).source, 'LIST');

  // No token counts: nothing to estimate. Zero tokens cost nothing.
  assert.equal(estimateCostUsd({ model: 'gpt-5.4-mini', inputTokens: null, outputTokens: null }, NO_SETTINGS), null);
  assert.equal(estimateCostUsd({ model: 'gpt-5.4-mini', inputTokens: 0, outputTokens: 0 }, NO_SETTINGS), 0);
  assert.equal(estimateCostUsd({ model: 'gpt-5.4-mini', inputTokens: 1000, outputTokens: null }, NO_SETTINGS), 0.00075, 'only the input is known');
  assert.equal(estimateCostUsd({ model: 'gpt-5.4-mini', inputTokens: -1, outputTokens: 'x' }, NO_SETTINGS), null);
  // Six decimal places: 1 token at 0.75 per million is 0.00000075.
  assert.equal(estimateCostUsd({ model: 'gpt-5.4-mini', inputTokens: 1, outputTokens: 0 }, NO_SETTINGS), 0.000001);
  assert.equal(estimateCostUsd({ model: 'gpt-5.4-mini', inputTokens: 7, outputTokens: 3 }, NO_SETTINGS), 0.000019, '5.25 + 13.5 = 18.75 millionths, rounded');
  // A free model is priced at 0, which is not "unknown".
  assert.equal(estimateCostUsd({ model: 'x', inputTokens: 500, outputTokens: 500 }, { ...NO_SETTINGS, inputCostPerMillion: 0, outputCostPerMillion: 0 }), 0);
});

test('estimated cost: the cost stored with a request follows the tokens OpenAI reported and the price in force', async (t) => {
  await clearLedger();
  const stub = openAiStub(t);
  const fx = await fixture('cost');

  // The test model has no list price and none is configured: no estimate.
  assert.equal((await fx.routes.CANDIDATE_COMPARISON()).status, 200);
  assert.equal((await ledger()).pop().estimatedCostUsd, null);
  let summary = await usage();
  assert.deepEqual(summary.pricing, { known: false, source: null, inputPerMillionUsd: null, outputPerMillionUsd: null });
  assert.deepEqual([summary.month.estimatedSpendUsd, summary.month.unpricedRequests], [0, 1], 'a request with tokens and no price is counted as not priced');

  // The provider answers as gpt-5.4-mini: the list price applies.
  // 10,000 * 0.75 / 1e6 + 2,000 * 4.5 / 1e6 = 0.0075 + 0.009 = 0.0165.
  stub.responder = valid({ model: 'gpt-5.4-mini-2026-03-17', usage: { prompt_tokens: 10_000, completion_tokens: 2_000 } });
  assert.equal((await fx.routes.JOB_REQUIREMENTS()).status, 200);
  assert.equal((await ledger()).pop().estimatedCostUsd, 0.0165);

  // A configured price is used for every model.
  // 10,000 * 3 / 1e6 + 2,000 * 15 / 1e6 = 0.03 + 0.03 = 0.06.
  withSettings(t, env.aiUsage, { inputCostPerMillion: 3, outputCostPerMillion: 15 });
  assert.equal((await fx.routes.CANDIDATE_RANKING()).status, 200);
  assert.equal((await ledger()).pop().estimatedCostUsd, 0.06);
  // An answer that fails validation was paid for as well.
  stub.responder = () => jsonResponse(200, completion('not json', { usage: { prompt_tokens: 10_000, completion_tokens: 2_000 } }));
  assert.equal((await fx.routes.CANDIDATE_COMPARISON()).body.error.code, 'AI_INVALID_RESPONSE');
  const failed = (await ledger()).pop();
  assert.deepEqual([failed.success, failed.estimatedCostUsd], [false, 0.06]);

  summary = await usage();
  assert.deepEqual(summary.pricing, { known: true, source: 'CONFIGURED', inputPerMillionUsd: 3, outputPerMillionUsd: 15 });
  // 0.0165 + 0.06 + 0.06 = 0.1365; the first request stays unpriced:
  // a stored estimate is not rewritten when the price changes later.
  assert.deepEqual([summary.month.requests, summary.month.estimatedSpendUsd, summary.month.unpricedRequests], [4, 0.1365, 1]);
});

// =====================================================================
// Dashboard totals
// =====================================================================

const entryAt = (at, fields = {}) => ({
  at, operation: 'CANDIDATE_COMPARISON', aiModel: 'gpt-5.4-mini', success: true, errorCategory: '', httpStatus: 200,
  inputTokens: 1000, outputTokens: 200, estimatedCostUsd: 0.00165, ...fields,
});

test('dashboard figures: today and this month are added up from the ledger, in UTC', async (t) => {
  await clearLedger();
  const stub = openAiStub(t);
  const now = new Date();
  const utc = (year, month, day, ...time) => new Date(Date.UTC(year, month, day, ...time));
  const [y, m, d] = [now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()];
  const dayStart = utc(y, m, d);
  const monthStart = utc(y, m, 1);
  const monthEnd = utc(y, m + 1, 1);

  // Nothing yet.
  let summary = await usage();
  assert.equal(stub.calls.length, 0);
  assert.deepEqual([summary.estimated, summary.currency, summary.timeZone], [true, 'USD', 'UTC']);
  assert.equal(summary.model, 'test-comparison-model');
  assert.deepEqual(summary.today, { requests: 0, succeeded: 0, failed: 0, inputTokens: 0, outputTokens: 0, estimatedSpendUsd: 0, unpricedRequests: 0, from: dayStart.toISOString() });
  assert.deepEqual([summary.month.from, summary.month.to], [monthStart.toISOString(), monthEnd.toISOString()]);
  assert.equal(summary.lastRequest, null);
  assert.equal(summary.service.state, 'NOT_USED_YET');

  await ctx.models.AiUsage.create([
    // Today: two that worked, one that failed without tokens, one
    // that failed validation after using tokens, one without a price.
    entryAt(dayStart),
    entryAt(new Date(dayStart.getTime() + 1000), { operation: 'JOB_REQUIREMENTS', inputTokens: 3000, outputTokens: 1000, estimatedCostUsd: 0.00675 }),
    entryAt(new Date(dayStart.getTime() + 2000), { success: false, errorCategory: 'timeout', httpStatus: null, inputTokens: null, outputTokens: null, estimatedCostUsd: null }),
    entryAt(new Date(dayStart.getTime() + 3000), { operation: 'CANDIDATE_RANKING', success: false, errorCategory: 'invalid_response', inputTokens: 2000, outputTokens: 500, estimatedCostUsd: 0.00375 }),
    entryAt(new Date(dayStart.getTime() + 4000), { aiModel: 'unknown-model', inputTokens: 100, outputTokens: 10, estimatedCostUsd: null }),
    // The last millisecond of yesterday belongs to yesterday. It is in
    // this month unless today is the first.
    entryAt(new Date(dayStart.getTime() - 1), { inputTokens: 10, outputTokens: 1, estimatedCostUsd: 0.5 }),
    // The first moment of this month counts; the last millisecond of
    // last month and the first of next month do not.
    entryAt(monthStart, { inputTokens: 20, outputTokens: 2, estimatedCostUsd: 0.25 }),
    entryAt(new Date(monthStart.getTime() - 1), { inputTokens: 99999, outputTokens: 99999, estimatedCostUsd: 99 }),
    entryAt(utc(y, m - 1, 15), { estimatedCostUsd: 77 }),
    entryAt(utc(y - 1, m, d), { estimatedCostUsd: 55 }),
  ]);

  summary = await usage(admin);
  // Today: 1000 + 3000 + 2000 + 100 input, 200 + 1000 + 500 + 10
  // output, 0.00165 + 0.00675 + 0.00375 = 0.01215. When today is the
  // first of the month, the entry at the start of the month is today's
  // as well.
  const first = d === 1;
  assert.deepEqual(summary.today, {
    requests: first ? 6 : 5,
    succeeded: first ? 4 : 3,
    failed: 2,
    inputTokens: first ? 6120 : 6100,
    outputTokens: first ? 1712 : 1710,
    estimatedSpendUsd: first ? 0.26215 : 0.01215,
    unpricedRequests: 1,
    from: dayStart.toISOString(),
  });
  // This month: today's five, the start of the month, and yesterday's
  // last millisecond when yesterday was in this month.
  assert.deepEqual(summary.month, {
    requests: first ? 6 : 7,
    succeeded: first ? 4 : 5,
    failed: 2,
    inputTokens: first ? 6120 : 6130,
    outputTokens: first ? 1712 : 1713,
    estimatedSpendUsd: first ? 0.26215 : 0.76215,
    unpricedRequests: 1,
    from: monthStart.toISOString(),
    to: monthEnd.toISOString(),
  });
  // The last request is the newest entry.
  assert.deepEqual(
    [summary.lastRequest.operation, summary.lastRequest.model, summary.lastRequest.success, summary.lastRequest.errorCategory, summary.lastRequest.inputTokens, summary.lastRequest.estimatedCostUsd],
    ['CANDIDATE_COMPARISON', 'unknown-model', true, null, 100, null],
  );
  assert.equal(summary.lastRequest.at, new Date(dayStart.getTime() + 4000).toISOString());
  assert.equal(summary.service.state, 'AVAILABLE');
  assert.equal(stub.calls.length, 0, 'reading the figures never calls OpenAI');
  assert.equal(await ctx.models.AiUsage.countDocuments({}), 10, 'and writes nothing');

  // A real request moves the figures by exactly one.
  const fx = await fixture('totals');
  stub.responder = valid({ model: 'gpt-5.4-mini', usage: { prompt_tokens: 2000, completion_tokens: 400 } });
  assert.equal((await fx.routes.CANDIDATE_COMPARISON()).status, 200);
  const next = await usage();
  // 2000 * 0.75 / 1e6 + 400 * 4.5 / 1e6 = 0.0015 + 0.0018 = 0.0033.
  assert.equal(next.today.requests, summary.today.requests + 1);
  assert.equal(next.month.requests, summary.month.requests + 1);
  assert.equal(next.today.inputTokens, summary.today.inputTokens + 2000);
  assert.equal(next.today.estimatedSpendUsd, Math.round((summary.today.estimatedSpendUsd + 0.0033) * 1e6) / 1e6);
  assert.equal(next.lastRequest.atsResultId, fx.one.id);
});

// =====================================================================
// Thresholds
// =====================================================================

test('thresholds: 50, 75 and 90 percent of the budget are Notice, Warning and Critical, and can be changed', () => {
  const defaults = { notice: 50, warning: 75, critical: 90 };
  const expected = [
    [0, 'healthy'], [49.9, 'healthy'], [50, 'notice'], [74.9, 'notice'], [75, 'warning'], [89.9, 'warning'], [90, 'critical'], [100, 'critical'], [250, 'critical'],
  ];
  for (const [percent, level] of expected) assert.equal(usageLevel(percent, defaults), level, `${percent}%`);
  for (const nothing of [null, undefined, Number.NaN, Number.POSITIVE_INFINITY, '80']) assert.equal(usageLevel(nothing, defaults), null, String(nothing));

  const custom = { notice: 10, warning: 20, critical: 30 };
  assert.deepEqual([9.9, 10, 19.9, 20, 29.9, 30].map((percent) => usageLevel(percent, custom)), ['healthy', 'notice', 'notice', 'warning', 'warning', 'critical']);
  // The defaults of this server are 50, 75 and 90.
  assert.deepEqual(env.aiUsage.thresholds, defaults);
  assert.equal(usageLevel(60), 'notice');
});

test('thresholds: the dashboard level follows the estimated spend of the month against the budget', async (t) => {
  await clearLedger();
  openAiStub(t);
  const spend = async (amount) => {
    await clearLedger();
    await ctx.models.AiUsage.create(entryAt(new Date(), { estimatedCostUsd: amount }));
    return (await usage()).budget;
  };

  // No budget: the spend is estimated and there is no level.
  withSettings(t, env.aiUsage, { monthlyBudgetUsd: null });
  assert.deepEqual(await spend(999), { monthlyUsd: null, percentUsed: null, remainingUsd: null, level: null, levelLabel: 'No budget set', thresholds: { notice: 50, warning: 75, critical: 90 } });
  // A budget of 0 is not a budget.
  env.aiUsage.monthlyBudgetUsd = 0;
  assert.equal((await spend(1)).level, null);

  // A budget of 20 US dollars.
  env.aiUsage.monthlyBudgetUsd = 20;
  const cases = [
    [0, 0, 20, 'healthy', 'Healthy'],
    [9.98, 49.9, 10.02, 'healthy', 'Healthy'],
    [10, 50, 10, 'notice', 'Notice'],
    [14.98, 74.9, 5.02, 'notice', 'Notice'],
    [15, 75, 5, 'warning', 'Warning'],
    [17.98, 89.9, 2.02, 'warning', 'Warning'],
    [18, 90, 2, 'critical', 'Critical'],
    [20, 100, 0, 'critical', 'Critical'],
    [50, 250, 0, 'critical', 'Critical'],
  ];
  for (const [amount, percentUsed, remainingUsd, level, levelLabel] of cases) {
    assert.deepEqual(await spend(amount), { monthlyUsd: 20, percentUsed, remainingUsd, level, levelLabel, thresholds: { notice: 50, warning: 75, critical: 90 } }, `${amount} of 20`);
  }
  // Last month's spend does not count against this month's budget.
  await clearLedger();
  const now = new Date();
  await ctx.models.AiUsage.create(entryAt(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1) - 1), { estimatedCostUsd: 19 }));
  assert.deepEqual([(await usage()).budget.percentUsed, (await usage()).budget.level], [0, 'healthy']);

  // Other thresholds are honoured.
  env.aiUsage.thresholds = { notice: 10, warning: 20, critical: 30 };
  assert.deepEqual([(await spend(1.9)).level, (await spend(2)).level, (await spend(4)).level, (await spend(6)).level], ['healthy', 'notice', 'warning', 'critical']);
  assert.deepEqual((await usage()).budget.thresholds, { notice: 10, warning: 20, critical: 30 });
  await clearLedger();
});

// Loads config/env.js in a new process with exactly the given variables.
function loadConfig(overrides) {
  const script = "const m = await import('./src/config/env.js'); console.log(JSON.stringify({ aiUsage: m.env.aiUsage, config: m.describeConfig(), ...m.validateEnv() }));";
  const names = ['AI_MONTHLY_BUDGET_USD', 'AI_USAGE_NOTICE_PERCENT', 'AI_USAGE_WARNING_PERCENT', 'AI_USAGE_CRITICAL_PERCENT', 'OPENAI_INPUT_COST_PER_1M_TOKENS', 'OPENAI_OUTPUT_COST_PER_1M_TOKENS', 'OPENAI_API_KEY', 'OPENAI_MODEL'];
  const blank = Object.fromEntries(names.map((name) => [name, '']));
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', script], {
    cwd: new URL('..', import.meta.url),
    env: { PATH: process.env.PATH, ...blank, NODE_ENV: 'test', LOG_LEVEL: 'silent', FRONTEND_URL: 'http://localhost:5173', SESSION_SECRET: 'test-only-session-secret-0123456789-abcdefghij', MONGODB_URI: 'mongodb://localhost:27017/allsemis', ...overrides },
    encoding: 'utf8',
  });
  if (result.status !== 0) return { failed: true, stderr: result.stderr };
  return JSON.parse(result.stdout);
}

test('thresholds and prices: read from the environment, with 50, 75 and 90 as the defaults', () => {
  const empty = loadConfig({});
  assert.deepEqual(empty.aiUsage, { monthlyBudgetUsd: null, inputCostPerMillion: null, outputCostPerMillion: null, thresholds: { notice: 50, warning: 75, critical: 90 }, thresholdsValid: true });
  assert.equal(empty.config.aiMonthlyBudgetSet, false);
  assert.ok(!empty.warnings.some((warning) => /AI_USAGE|COST_PER_1M/.test(warning)));

  const set = loadConfig({ AI_MONTHLY_BUDGET_USD: '25.50', AI_USAGE_NOTICE_PERCENT: '40', AI_USAGE_WARNING_PERCENT: '60', AI_USAGE_CRITICAL_PERCENT: '80', OPENAI_INPUT_COST_PER_1M_TOKENS: '0.75', OPENAI_OUTPUT_COST_PER_1M_TOKENS: '4.5' });
  assert.deepEqual(set.aiUsage, { monthlyBudgetUsd: 25.5, inputCostPerMillion: 0.75, outputCostPerMillion: 4.5, thresholds: { notice: 40, warning: 60, critical: 80 }, thresholdsValid: true });
  assert.equal(set.config.aiMonthlyBudgetSet, true);
  // The budget is not printed with the configuration, only whether there is one.
  assert.ok(!JSON.stringify(set.config).includes('25.5'));

  // Thresholds that do not rise are a typing mistake: defaults, and a warning.
  for (const wrong of [
    { AI_USAGE_NOTICE_PERCENT: '80', AI_USAGE_WARNING_PERCENT: '75' },
    { AI_USAGE_WARNING_PERCENT: '95' },
    { AI_USAGE_NOTICE_PERCENT: '0' },
    { AI_USAGE_NOTICE_PERCENT: '75', AI_USAGE_WARNING_PERCENT: '75' },
  ]) {
    const loaded = loadConfig(wrong);
    assert.deepEqual(loaded.aiUsage.thresholds, { notice: 50, warning: 75, critical: 90 }, JSON.stringify(wrong));
    assert.ok(loaded.warnings.some((warning) => /AI_USAGE_NOTICE_PERCENT/.test(warning) && /50, 75, 90/.test(warning)), JSON.stringify(wrong));
  }
  // One price without the other is ignored, and start-up says so.
  const half = loadConfig({ OPENAI_INPUT_COST_PER_1M_TOKENS: '2' });
  assert.ok(half.warnings.some((warning) => /OPENAI_INPUT_COST_PER_1M_TOKENS/.test(warning) && /ignored/.test(warning)));

  // A value that is not an amount stops the server with its name.
  for (const [name, value] of [['AI_MONTHLY_BUDGET_USD', '-5'], ['AI_MONTHLY_BUDGET_USD', 'twenty'], ['OPENAI_OUTPUT_COST_PER_1M_TOKENS', 'x'], ['AI_USAGE_NOTICE_PERCENT', 'half']]) {
    const loaded = loadConfig({ [name]: value });
    assert.equal(loaded.failed, true, `${name}=${value}`);
    assert.ok(loaded.stderr.includes(name), `${name}=${value}: the message names the variable`);
  }
});

// =====================================================================
// Billing and quota errors
// =====================================================================

test('billing and quota errors: a clear answer, one request, nothing changed, and the dashboard turns Critical', async (t) => {
  await clearLedger();
  const stub = openAiStub(t);
  const fx = await fixture('quota');
  withSettings(t, env.aiUsage, { monthlyBudgetUsd: null });
  const key = process.env.OPENAI_API_KEY;
  const providerText = `You exceeded your current quota, please check your plan and billing details. ${key} PROVIDER-RAW-TEXT`;
  const snapshot = async () => JSON.stringify({
    applications: (await ctx.models.Application.find({ jobId: fx.job._id }).sort({ _id: 1 })).map((a) => [a.status, [...(a.labels || [])], a.shortlist?.at || null]),
    candidates: (await ctx.models.Candidate.find({ _id: { $in: [fx.one.candidate._id, fx.two.candidate._id] } }).sort({ _id: 1 })).map((c) => [...(c.labels || [])]),
    results: (await ctx.models.ATSResult.find({ jobId: fx.job._id }).sort({ _id: 1 })).map((r) => [r.totalScore, r.review.state, r.aiComparison]),
    job: [(await ctx.models.Job.findById(fx.job._id)).requirementProfile, (await ctx.models.Job.findById(fx.job._id)).candidateComparison, (await ctx.models.Job.findById(fx.job._id)).status],
  });
  const before = await snapshot();

  const refusals = {
    'insufficient_quota as code and type': { type: 'insufficient_quota', code: 'insufficient_quota' },
    'insufficient_quota as type only': { type: 'insufficient_quota', code: null },
    'insufficient_quota as code only': { type: 'invalid_request_error', code: 'insufficient_quota' },
    'spend limit reached': { type: 'invalid_request_error', code: 'billing_hard_limit_reached' },
    'billing not active': { type: 'billing_not_active', code: 'billing_not_active' },
  };
  let calls = 0;
  for (const [label, error] of Object.entries(refusals)) {
    for (const operation of OPERATIONS) {
      const name = `${label}, ${operation}`;
      stub.responder = () => jsonResponse(429, { error: { message: providerText, ...error } });
      const response = await fx.routes[operation]();
      calls += 1;
      assert.deepEqual([response.status, response.body.success, response.body.error.code], [503, false, 'AI_QUOTA_EXCEEDED'], name);
      assert.match(response.body.error.message, /^The OpenAI account has no credit left or has reached its spend limit[^<>{}]+Nothing was changed\.$/, name);
      const text = JSON.stringify(response.body);
      assert.ok(!text.includes(key) && !text.includes('PROVIDER-RAW-TEXT') && !text.includes('exceeded your current quota'), `${name}: no key and no provider text`);
      assert.equal(stub.calls.length, calls, `${name}: one request, no retry`);
      const entry = (await ledger()).pop();
      assert.deepEqual([entry.operation, entry.success, entry.errorCategory, entry.httpStatus], [operation, false, 'quota', 429], name);
    }
  }
  assert.equal(await snapshot(), before, 'no application, candidate, review, score, comparison or profile changed');
  assert.equal(ctx.outbox.length, 0, 'and no email was sent');

  // The dashboard: the service is refused for billing and the level is
  // Critical, although nothing was spent and no budget is set.
  let summary = await usage();
  assert.deepEqual([summary.service.state, summary.service.quotaExceeded], ['QUOTA_EXCEEDED', true]);
  assert.match(summary.service.message, /no credit left, has reached its spend limit or has no active billing/);
  assert.match(summary.service.message, /Nothing in recruitment was changed/);
  assert.deepEqual([summary.budget.level, summary.budget.levelLabel, summary.budget.monthlyUsd, summary.month.estimatedSpendUsd], ['critical', 'Critical', null, 0]);
  assert.deepEqual([summary.today.requests, summary.today.failed, summary.today.succeeded], [calls, calls, 0]);
  assert.equal(summary.lastRequest.errorCategory, 'quota');
  assert.ok(!JSON.stringify(summary).includes(key) && !JSON.stringify(summary).includes('PROVIDER-RAW-TEXT'));

  // The server is not blocked: reading the dashboard sent nothing, and
  // the next click is one more request, which is refused the same way.
  assert.equal(stub.calls.length, calls);
  assert.equal((await fx.routes.CANDIDATE_COMPARISON()).body.error.code, 'AI_QUOTA_EXCEEDED');
  assert.equal(stub.calls.length, calls + 1);

  // A different failure after it does not hide the billing problem.
  stub.responder = () => jsonResponse(500, { error: { type: 'server_error' } });
  assert.equal((await fx.routes.CANDIDATE_COMPARISON()).body.error.code, 'AI_FAILED');
  assert.equal((await usage()).service.state, 'QUOTA_EXCEEDED');

  // Recruitment goes on without AI.
  assert.equal((await client().get('/health', { origin: null, xhr: false })).status, 200);
  assert.equal((await recruiter.post('/api/admin/ats/run', { json: { applicationId: String(fx.one.application._id) } })).status, 201);
  const third = await apply(fx.job, { email: 'usage.quota.three@example.com' });
  assert.equal(third.application.status, 'NEW');

  // Once a request works again the warning goes, and the level is the
  // budget's again.
  stub.responder = valid();
  assert.equal((await fx.routes.CANDIDATE_COMPARISON()).status, 200);
  summary = await usage();
  assert.deepEqual([summary.service.state, summary.service.quotaExceeded, summary.budget.level, summary.budget.levelLabel], ['AVAILABLE', false, null, 'No budget set']);
  env.aiUsage.monthlyBudgetUsd = 100;
  assert.equal((await usage()).budget.level, 'healthy');

  // A plain rate limit is not a billing problem.
  stub.responder = () => jsonResponse(429, { error: { message: providerText, type: 'requests', code: 'rate_limit_exceeded' } });
  const limited = await fx.routes.CANDIDATE_COMPARISON();
  assert.deepEqual([limited.status, limited.body.error.code], [502, 'AI_FAILED']);
  assert.equal((await ledger()).pop().errorCategory, 'rate_limit');
  summary = await usage();
  assert.deepEqual([summary.service.state, summary.service.quotaExceeded, summary.budget.level], ['ATTENTION', false, 'healthy']);
  assert.match(summary.service.message, /busy/);
});

// =====================================================================
// What the ledger holds
// =====================================================================

const LEDGER_KEYS = [
  '_id', 'actorId', 'actorName', 'aiModel', 'applicationId', 'at', 'atsResultId', 'candidateCount', 'candidateId', 'durationMs',
  'errorCategory', 'estimatedCostUsd', 'httpStatus', 'inputTokens', 'jobId', 'operation', 'outputTokens', 'success',
];

test('usage ledger: no secret, no prompt, no answer and nothing a candidate wrote is stored in it', async (t) => {
  await clearLedger();
  const stub = openAiStub(t);
  const key = process.env.OPENAI_API_KEY;
  const fx = await fixture('content', {
    job: { title: 'JOBTITLE-MARKER Engineer', description: 'JOBDESCRIPTION-MARKER own the testbench.', summary: 'JOBSUMMARY-MARKER', responsibilities: ['RESPONSIBILITY-MARKER'] },
    first: {
      name: 'Zebedee Quillfeather', phone: '+91 90000 77123', headline: 'HEADLINE-MARKER Engineer', skills: 'SKILL-MARKER, UVM',
      message: 'COVERNOTE-MARKER I would like to apply.', location: 'LOCATION-MARKER, India',
    },
    second: { name: 'Ottoline Brackenridge', skills: 'OTHERSKILL-MARKER', message: 'SECONDNOTE-MARKER' },
  });
  await ctx.models.Candidate.updateOne({ _id: fx.one.candidate._id }, { $set: { summary: 'SUMMARY-MARKER ten years of verification.' } });

  const marked = (call) => {
    if (schemaName(call) === 'job_requirement_profile') return draftAnswer({ requiredSkills: ['ANSWER-MARKER'], requiredExperience: 'ANSWER-MARKER experience' });
    if (schemaName(call) === 'candidates_job_comparison') return candidatesAnswer({ summary: 'ANSWER-MARKER summary of the candidates.' });
    return aiAnswer({ summary: 'ANSWER-MARKER summary.', evidence: [{ requirement: 'UVM', evidence: 'ANSWER-MARKER evidence' }] });
  };
  // Each operation once successfully, once with a provider error whose
  // text repeats the key, and once with an answer that fails validation.
  for (const operation of OPERATIONS) {
    stub.responder = (call) => jsonResponse(200, completion(marked(call)));
    assert.equal((await fx.routes[operation]()).status, 200, operation);
    stub.responder = () => jsonResponse(401, { error: { message: `Incorrect API key provided: ${key}. PROVIDERTEXT-MARKER`, type: 'invalid_request_error', code: 'invalid_api_key' } });
    assert.equal((await fx.routes[operation]()).status, 502, operation);
    stub.responder = (call) => jsonResponse(200, completion({ ...marked(call), extra: 'ANSWER-MARKER extra' }));
    assert.equal((await fx.routes[operation]()).body.error.code, 'AI_INVALID_RESPONSE', operation);
  }
  assert.equal(stub.calls.length, 9);
  // The requests did carry the job and the candidates' own words...
  const sent = stub.calls.map((call) => call.raw).join('\n');
  for (const marker of ['JOBDESCRIPTION-MARKER', 'COVERNOTE-MARKER', 'SKILL-MARKER', 'SUMMARY-MARKER', '<candidate_data>']) assert.ok(sent.includes(marker), `${marker} was in a request`);

  // ...and the ledger holds none of it. Read as stored, not as the API shapes it.
  const raw = await ctx.models.AiUsage.find({}).lean();
  assert.equal(raw.length, 9);
  const stored = JSON.stringify(raw);
  const forbidden = [
    'MARKER', 'Zebedee', 'Quillfeather', 'Ottoline', 'Brackenridge', 'usage.content', '@example.com', '90000 77123', 'resume.pdf',
    key, 'sk-', 'Bearer', 'Incorrect API key', '<candidate_data>', '<job>', 'You help recruiters', 'verification', 'testbench', 'summary of the candidates',
  ];
  for (const text of forbidden) assert.ok(!stored.includes(text), `the ledger does not contain "${text === key ? 'the API key' : text}"`);
  for (const entry of raw) {
    const keys = Object.keys(entry).filter((name) => name !== '__v').sort();
    assert.deepEqual(keys, LEDGER_KEYS, 'exactly the documented fields');
    for (const [name, value] of Object.entries(entry)) {
      if (typeof value === 'string') assert.ok(value.length <= 120, `${name} is a short value, not content`);
    }
    assert.ok(['CANDIDATE_COMPARISON', 'JOB_REQUIREMENTS', 'CANDIDATE_RANKING'].includes(entry.operation));
    assert.match(entry.aiModel, /^test-comparison-model(-2026-01-01)?$/);
    assert.equal(entry.actorName, 'Test RECRUITER', 'the member of staff who asked, never a candidate');
  }

  // What the dashboard endpoint returns is as clean.
  const response = await recruiter.get(usagePath);
  const body = JSON.stringify(response.body);
  for (const text of forbidden.filter((item) => item !== 'verification')) assert.ok(!body.includes(text), `the usage answer does not contain "${text === key ? 'the API key' : text}"`);
  assert.ok(!('actorId' in response.body.data.lastRequest) && !('durationMs' in response.body.data.lastRequest));
});

// =====================================================================
// Access and service state
// =====================================================================

test('usage figures: for the roles that can start an AI request, and they never call OpenAI', async (t) => {
  await clearLedger();
  const stub = openAiStub(t);
  for (const [agent, status] of [[admin, 200], [recruiter, 200], [manager, 403], [content, 403], [client(), 401]]) {
    assert.equal((await agent.get(usagePath)).status, status);
  }
  // Read only: there is nothing to post, change or delete.
  assert.equal((await admin.post(usagePath, { json: {} })).status, 404);
  assert.equal((await admin.delete(usagePath)).status, 404);

  const summary = await usage(admin);
  assert.deepEqual(Object.keys(summary).sort(), ['budget', 'currency', 'estimated', 'generatedAt', 'lastRequest', 'model', 'month', 'pricing', 'service', 'timeZone', 'today']);
  assert.equal(summary.estimated, true, 'the figures say that they are an estimate');
  assert.deepEqual([summary.service.state, summary.service.quotaExceeded], ['NOT_USED_YET', false]);
  const text = JSON.stringify(summary);
  assert.ok(!text.includes(process.env.OPENAI_API_KEY) && !text.includes('sk-') && !/balance/i.test(text), 'no key, and no claim about a balance');

  // Without the key or the model: said plainly, and still no request.
  const original = { ...env.openai };
  try {
    for (const missing of [{ apiKey: '' }, { model: '' }, { apiKey: '', model: '' }]) {
      Object.assign(env.openai, original, missing);
      const off = await usage();
      assert.equal(off.service.state, 'NOT_CONFIGURED');
      assert.match(off.service.message, /OPENAI_API_KEY and OPENAI_MODEL/);
      assert.equal(off.model, missing.model === '' ? null : 'test-comparison-model');
    }
  } finally {
    Object.assign(env.openai, original);
  }
  assert.equal(stub.calls.length, 0);
  assert.equal(await ctx.models.AiUsage.countDocuments({}), 0);
});
