import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

/*
  The email rules.

  AUTOMATIC, by a public submission: a notification to the team for
  every application, hiring requirement, enquiry and referral, and an
  acknowledgement to the person who sent the form.

  BY A RECRUITER, to a candidate: the shortlist email (the shortlist
  action), the regret email and the selection email (each by its own
  button, after the Rejected or the Selected label was added). No
  label, score or AI analysis sends any of them.

  Every email is recorded once per record, an automatic email is never
  sent twice, and an email the service has accepted is never sent
  again.

  Most tests run with the in-memory email driver of the other test
  files and read `outbox`. The tests about failures switch this
  process to the Resend driver and answer api.resend.com with a
  stand-in, so no request ever leaves the machine. A made-up key is set
  before the application is imported, because the configuration is
  read once; it is not a real credential.
*/
process.env.RESEND_API_KEY = 're_test_MUST-NOT-LEAK-0000';

const {
  startServer, stopServer, client, signedIn, multipart, applicationFields, pdfBytes, wait,
} = await import('./helpers.js');
const { env } = await import('../src/config/env.js');
const { describeFailure } = await import('../src/services/email/emailService.js');
const { templates } = await import('../src/services/email/templates.js');

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

const TEAM = 'team@example.com';
const DECISION_TEMPLATES = ['shortlistNotification', 'regretNotification', 'selectionNotification'];
const resume = () => ({ field: 'resume', name: 'resume.pdf', buffer: pdfBytes(), type: 'application/pdf' });

// The emails a submission sends leave after the response.
async function settle() {
  await wait(200);
}
async function quiet() {
  await settle();
  ctx.outbox.length = 0;
}
const sent = (template) => ctx.outbox.filter((message) => message.template === template);
const records = async (entityType, entityId) => (await ctx.models.EmailLog.find({ entityType, entityId: String(entityId) })).map((entry) => entry.toObject());
const recordOf = async (template, entityId) => ctx.models.EmailLog.findOne({ key: `${template}:${entityId}` });
const audit = async (query) => (await admin.get(`/api/admin/audit-logs?${query}`)).body.data;

let count = 0;
async function publishedJob(fields = {}) {
  count += 1;
  return ctx.models.Job.create({
    title: `Verification Engineer ${count}`, slug: `emails-job-${count}`, status: 'published', category: 'Semiconductor', location: 'Bengaluru, India',
    experienceLevel: 'Mid-Level', requiredSkills: ['SystemVerilog', 'UVM'], description: 'Own the testbench.', ...fields,
  });
}

// One application through the public form, with its emails settled and
// the outbox emptied, so a test starts from nothing.
async function applied(tag, fields = {}) {
  const job = await publishedJob();
  const email = `emails.${tag}@example.com`;
  const response = await client().post('/api/applications', { form: multipart(applicationFields({ email, name: `Candidate ${tag}`, jobId: String(job._id), ...fields }), resume()) });
  assert.equal(response.status, 201);
  const candidate = await ctx.models.Candidate.findOne({ email });
  const application = await ctx.models.Application.findOne({ candidateId: candidate._id, jobId: job._id });
  await settle();
  const submissionEmails = ctx.outbox.splice(0);
  const id = String(application._id);
  return {
    job, candidate, application, id, submissionEmails,
    path: `/api/admin/applications/${id}`,
    regret: `/api/admin/applications/${id}/regret-email`,
    selection: `/api/admin/applications/${id}/selection-email`,
    shortlist: `/api/admin/applications/${id}/shortlist`,
    shortlistEmail: `/api/admin/applications/${id}/shortlist-email`,
  };
}
const stored = async (fx) => ctx.models.Application.findById(fx.application._id);
const label = (fx, labels, agent = recruiter) => agent.patch(fx.path, { json: { labels } });

// What must never move because of a label or an email.
async function snapshot(fx) {
  const application = await stored(fx);
  const results = await ctx.models.ATSResult.find({ candidateId: fx.candidate._id }).sort({ _id: 1 });
  return JSON.stringify({
    status: application.status,
    shortlistAt: application.shortlist?.at || null,
    applications: await ctx.models.Application.countDocuments({ candidateId: fx.candidate._id }),
    candidates: await ctx.models.Candidate.countDocuments({ email: fx.candidate.email }),
    candidateLabels: [...((await ctx.models.Candidate.findById(fx.candidate._id)).labels || [])],
    ats: results.map((result) => [String(result._id), result.totalScore, result.review.state, String(result.runAt), result.aiComparison]),
    aiRequests: await ctx.models.AiUsage.countDocuments({}),
  });
}

// ---- Resend, answered by a stand-in ----
// While `provider.on` is set this process sends through the Resend
// driver and every request to api.resend.com is recorded and answered
// by `provider.answer`. Requests to OpenAI are counted and refused.
const realFetch = globalThis.fetch;
const provider = { requests: [], openai: 0, answer: null };
const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
globalThis.fetch = async (input, init = {}) => {
  const url = typeof input === 'string' ? input : String(input?.url ?? input);
  if (url.startsWith('https://api.openai.com/')) { provider.openai += 1; throw new Error('No test here may reach OpenAI.'); }
  if (!url.startsWith('https://api.resend.com/')) return realFetch(input, init);
  const request = { url, headers: init.headers || {}, body: JSON.parse(init.body) };
  provider.requests.push(request);
  if (!provider.answer) throw new TypeError('fetch failed');
  return provider.answer(request);
};
function useResend(t, answer) {
  const driver = env.emailDriver;
  env.emailDriver = 'resend';
  provider.requests.length = 0;
  provider.answer = answer;
  t.after(() => { env.emailDriver = driver; provider.answer = null; provider.requests.length = 0; });
}
const accepted = () => json(200, { id: `re-sample-${provider.requests.length}` });
// What Resend answers while the sender's domain is not verified.
const DOMAIN_MESSAGE = 'The allsemi.com domain is not verified. Please, add and verify your domain on https://resend.com/domains';
const domainNotVerified = () => json(403, { statusCode: 403, name: 'validation_error', message: DOMAIN_MESSAGE });

// The server log, captured, so a test can check that no key is in it.
const logLines = [];
for (const stream of [process.stdout, process.stderr]) {
  const write = stream.write.bind(stream);
  stream.write = (chunk, ...rest) => {
    if (typeof chunk === 'string' && chunk.startsWith('{"time":"')) {
      logLines.push(chunk);
      const done = rest.find((item) => typeof item === 'function');
      if (done) done();
      return true;
    }
    return write(chunk, ...rest);
  };
}
function withLog(t) {
  const level = env.logLevel;
  env.logLevel = 'info';
  logLines.length = 0;
  t.after(() => { env.logLevel = level; });
}
const logged = (event) => logLines.map((line) => JSON.parse(line)).filter((entry) => entry.event === event);
const assertNoKey = (value, where) => assert.ok(!(typeof value === 'string' ? value : JSON.stringify(value)).includes('MUST-NOT-LEAK'), `${where} must not contain the email key`);

// What no email may carry.
function assertNothingInternal(message, fx, where) {
  const text = `${message.subject}\n${message.html}\n${message.text}`;
  for (const [name, value] of Object.entries({
    'the application id': fx.id,
    'the candidate id': String(fx.candidate._id),
    'the job id': String(fx.job._id),
    'a storage key': 'resumes/',
    'the recruiter notes': 'RECRUITER-NOTE-MARKER',
    'the candidate notes': 'CANDIDATE-NOTE-MARKER',
    'a recruiter name': 'Test RECRUITER',
  })) assert.ok(!text.includes(value), `${where} must not contain ${name}`);
  assert.ok(!/\bATS\b|score|\/ ?100|\bAI\b|analysis|comparison|artificial/i.test(text), `${where} must not mention a score or an analysis`);
}

// =====================================================================
// Automatic emails
// =====================================================================

test('new application: the team is notified automatically, and the candidate receives a receipt and no decision email', async () => {
  ctx.outbox.length = 0;
  const fx = await applied('auto', { message: 'I would like to apply.' });
  const messages = fx.submissionEmails;

  assert.deepEqual(messages.map((message) => message.template).sort(), ['applicationConfirmation', 'newApplicationAdmin']);
  const toTeam = messages.find((message) => message.template === 'newApplicationAdmin');
  assert.deepEqual([toTeam.to, toTeam.replyTo], [TEAM, 'emails.auto@example.com'], 'to ADMIN_NOTIFICATION_EMAIL, with the candidate as reply-to');
  assert.match(toTeam.subject, /^New application: Candidate auto for Verification Engineer/);
  assert.ok(toTeam.text.includes('emails.auto@example.com') && toTeam.text.includes('I would like to apply.'));
  assertNoKey(toTeam, 'the team notification');

  // The candidate hears that the application arrived, and nothing else.
  const receipt = messages.find((message) => message.template === 'applicationConfirmation');
  assert.equal(receipt.to, 'emails.auto@example.com');
  assert.ok(!/shortlist|selected|regret|unsuccessful|not be taking/i.test(`${receipt.subject} ${receipt.text}`), 'a receipt says nothing about a decision');
  assert.ok(!messages.some((message) => DECISION_TEMPLATES.includes(message.template)));

  // The application is NEW and waits for a recruiter.
  const application = await stored(fx);
  assert.equal(application.status, 'NEW');
  assert.deepEqual([application.shortlist, application.decisionEmails.regret.status, application.decisionEmails.selection.status], [null, 'NOT_SENT', 'NOT_SENT']);

  // Both emails are on record, once each.
  const entries = await records('application', fx.id);
  assert.deepEqual(entries.map((entry) => [entry.template, entry.kind, entry.recipient, entry.status, entry.automatic, entry.attempts]).sort(), [
    ['applicationConfirmation', 'ACKNOWLEDGEMENT', 'SENDER', 'SENT', true, 1],
    ['newApplicationAdmin', 'TEAM_NOTIFICATION', 'TEAM', 'SENT', true, 1],
  ]);
  assert.ok(entries.every((entry) => entry.sentAt instanceof Date));
});

test('referral: the team is notified and the person who referred receives an acknowledgement', async () => {
  ctx.outbox.length = 0;
  const response = await client().post('/api/referrals', {
    form: multipart({ referrerName: 'Ref Errer', referrerEmail: 'emails.referrer@example.com', candidateName: 'Good Engineer', candidateEmail: 'emails.referred@example.com', candidateRole: 'DFT Engineer', relationship: 'Former colleague', message: 'Excellent on scan and ATPG.', consent: 'true' }),
  });
  assert.equal(response.status, 201);
  await settle();
  const referral = await ctx.models.Referral.findOne({ referrerEmail: 'emails.referrer@example.com' });

  assert.deepEqual(ctx.outbox.map((message) => message.template).sort(), ['newReferralAdmin', 'referralConfirmation']);
  const [toTeam] = sent('newReferralAdmin');
  assert.deepEqual([toTeam.to, toTeam.replyTo, toTeam.subject], [TEAM, 'emails.referrer@example.com', 'New referral: Good Engineer']);
  const [courtesy] = sent('referralConfirmation');
  assert.deepEqual([courtesy.to, courtesy.replyTo, courtesy.subject], ['emails.referrer@example.com', undefined, 'We received your referral']);
  assert.match(courtesy.text, /We received your referral/);
  // The referred person is not written to, and nothing they or the
  // referrer typed is repeated in the acknowledgement.
  assert.ok(!ctx.outbox.some((message) => message.to === 'emails.referred@example.com'));
  assert.ok(!/Good Engineer|Ref Errer|ATPG/.test(`${courtesy.html}${courtesy.text}`));
  assert.ok(!/\b\d+\s*(hours?|days?|weeks?)\b|within|business day/i.test(courtesy.text), 'no response time is promised');
  assert.deepEqual((await records('referral', referral._id)).map((entry) => [entry.template, entry.status]).sort(), [['newReferralAdmin', 'SENT'], ['referralConfirmation', 'SENT']]);
});

test('general enquiry: the team is notified and the visitor is told it was received, will be reviewed and will be answered', async () => {
  ctx.outbox.length = 0;
  const response = await client().post('/api/enquiries', { form: multipart({ name: 'Asha', email: 'emails.asha@example.com', type: 'GENERAL', subject: 'A question', message: 'ENQUIRY-TEXT-MARKER' }) });
  assert.equal(response.status, 201);
  await settle();
  const enquiry = await ctx.models.Enquiry.findOne({ email: 'emails.asha@example.com' });

  assert.deepEqual(ctx.outbox.map((message) => message.template).sort(), ['enquiryConfirmation', 'newEnquiryAdmin']);
  const [toTeam] = sent('newEnquiryAdmin');
  assert.deepEqual([toTeam.to, toTeam.replyTo, toTeam.subject], [TEAM, 'emails.asha@example.com', 'New enquiry: A question']);
  assert.ok(toTeam.text.includes('ENQUIRY-TEXT-MARKER'), 'the team sees what was written');
  const [courtesy] = sent('enquiryConfirmation');
  assert.deepEqual([courtesy.to, courtesy.replyTo], ['emails.asha@example.com', undefined]);
  assert.match(courtesy.text, /We received your enquiry\. The ALLSEMIS team will review it and get in touch with you/);
  assert.ok(!/\b\d+\s*(hours?|days?|weeks?)\b|within|business day/i.test(courtesy.text), 'no response time is promised');
  assert.ok(!/ENQUIRY-TEXT-MARKER|Asha|A question/.test(`${courtesy.html}${courtesy.text}`), 'nothing the visitor typed is repeated');
  assert.ok(!courtesy.text.includes(String(enquiry._id)) && !courtesy.text.includes(TEAM), 'no internal id and no internal address');
  assert.deepEqual((await records('enquiry', enquiry._id)).map((entry) => [entry.template, entry.status]).sort(), [['enquiryConfirmation', 'SENT'], ['newEnquiryAdmin', 'SENT']]);
});

test('hire talent: the team is notified and the company contact is told it was received, will be reviewed and will be contacted', async () => {
  ctx.outbox.length = 0;
  const response = await client().post('/api/requirements', {
    form: multipart({ contactName: 'Hiring Lead', company: 'Employer (sample)', email: 'emails.lead@example.com', role: 'Verification engineers', positions: '3', hiringType: 'Permanent Staffing', workMode: 'HYBRID', location: 'Bengaluru', description: 'REQUIREMENT-TEXT-MARKER', consent: 'true' }),
  });
  assert.equal(response.status, 201);
  await settle();
  const requirement = await ctx.models.Requirement.findOne({ email: 'emails.lead@example.com' });

  assert.deepEqual(ctx.outbox.map((message) => message.template).sort(), ['newRequirementAdmin', 'requirementConfirmation']);
  const [toTeam] = sent('newRequirementAdmin');
  assert.deepEqual([toTeam.to, toTeam.replyTo, toTeam.subject], [TEAM, 'emails.lead@example.com', 'New hiring requirement: Verification engineers']);
  assert.ok(toTeam.text.includes('REQUIREMENT-TEXT-MARKER'));
  const [courtesy] = sent('requirementConfirmation');
  assert.deepEqual([courtesy.to, courtesy.replyTo], ['emails.lead@example.com', undefined]);
  assert.match(courtesy.text, /We received your hiring requirement\. A member of the ALLSEMIS team will review it and contact you/);
  assert.ok(!/\b\d+\s*(hours?|days?|weeks?)\b|within|business day/i.test(courtesy.text), 'no response time is promised');
  assert.ok(!/REQUIREMENT-TEXT-MARKER|Hiring Lead|Employer/.test(`${courtesy.html}${courtesy.text}`));
  assert.ok(!/recruiter|Test RECRUITER/i.test(courtesy.text), 'no recruiter is named');
  assert.deepEqual((await records('requirement', requirement._id)).map((entry) => [entry.template, entry.status]).sort(), [['newRequirementAdmin', 'SENT'], ['requirementConfirmation', 'SENT']]);
});

test('automatic emails are sent once: the same email for the same record is not sent a second time by itself', async () => {
  const notifications = await import('../src/services/email/notifications.js');
  notifications.resetConfirmationLimits();
  const enquiry = await ctx.models.Enquiry.create({ name: 'Twice', email: 'emails.twice@example.com', type: 'GENERAL', subject: 'Once only', message: 'Hello' });
  ctx.outbox.length = 0;

  await notifications.notifyEnquiry(enquiry);
  assert.deepEqual(ctx.outbox.map((message) => message.template).sort(), ['enquiryConfirmation', 'newEnquiryAdmin']);
  // The same call again, as a retried request or a second worker would make it.
  await notifications.notifyEnquiry(enquiry);
  await Promise.all([notifications.notifyEnquiry(enquiry), notifications.notifyEnquiry(enquiry)]);
  assert.equal(ctx.outbox.length, 2, 'still one notification and one acknowledgement');
  const entries = await records('enquiry', enquiry._id);
  assert.equal(entries.length, 2, 'one entry per email');
  assert.ok(entries.every((entry) => entry.status === 'SENT' && entry.attempts === 1));

  // A different record is a different email.
  const other = await ctx.models.Enquiry.create({ name: 'Other', email: 'emails.twice.other@example.com', type: 'GENERAL', subject: 'Another', message: 'Hello' });
  await notifications.notifyEnquiry(other);
  assert.equal(ctx.outbox.length, 4);

  // The record holds no address, subject or text.
  const raw = JSON.stringify(await ctx.models.EmailLog.find({ entityId: String(enquiry._id) }).lean());
  for (const text of ['emails.twice@example.com', TEAM, 'Once only', 'Hello', 'We received']) assert.ok(!raw.includes(text), `the email record does not hold "${text}"`);
  notifications.resetConfirmationLimits();
});

// =====================================================================
// Shortlist
// =====================================================================

test('shortlist email: only the explicit shortlist action sends it, once', async () => {
  const fx = await applied('shortlist');
  const before = await snapshot(fx);

  // Nothing that is not the shortlist action sends it: a strong ATS
  // score, running the rules again, a review, a label.
  const result = await ctx.models.ATSResult.findOne({ candidateId: fx.candidate._id, jobId: fx.job._id });
  assert.ok(result, 'the rules ran with the application');
  await ctx.models.ATSResult.updateOne({ _id: result._id }, { $set: { totalScore: 100, band: 'Strong match' } });
  assert.equal((await recruiter.post('/api/admin/ats/run', { json: { applicationId: fx.id } })).status, 201);
  assert.equal((await recruiter.patch(`/api/admin/ats-results/${result._id}/review`, { json: { state: 'ADVANCE', note: 'Looks strong.' } })).status, 200);
  assert.equal((await label(fx, ['INTERVIEWED'])).status, 200);
  await settle();
  assert.equal(ctx.outbox.length, 0, 'no email from a score, a review or a label');
  assert.equal((await stored(fx)).status, 'NEW');
  void before;

  // The action: one email to the candidate, and the application is SHORTLISTED.
  const done = await recruiter.post(fx.shortlist);
  assert.equal(done.status, 200);
  assert.deepEqual([done.body.data.application.status, done.body.data.email], ['SHORTLISTED', 'SENT']);
  assert.deepEqual(ctx.outbox.map((message) => [message.template, message.to]), [['shortlistNotification', 'emails.shortlist@example.com']]);
  assertNothingInternal(ctx.outbox[0], fx, 'the shortlist email');

  // Not twice: neither the action nor the email.
  assert.equal((await recruiter.post(fx.shortlist)).status, 409);
  assert.equal((await admin.post(fx.shortlistEmail)).status, 409);
  assert.equal(ctx.outbox.length, 1);
  const entry = await recordOf('shortlistNotification', fx.id);
  assert.deepEqual([entry.kind, entry.recipient, entry.status, entry.automatic, entry.attempts, entry.actorName], ['CANDIDATE_DECISION', 'CANDIDATE', 'SENT', false, 1, 'Test RECRUITER']);
});

// =====================================================================
// Regret and selection
// =====================================================================

const DECISIONS = [
  { kind: 'regret', label: 'REJECTED', other: 'SELECTED', template: 'regretNotification', name: 'regret email', subject: /^Update on your application for Verification Engineer/, says: /we will not be taking your application for this role forward/ },
  { kind: 'selection', label: 'SELECTED', other: 'REJECTED', template: 'selectionNotification', name: 'selection email', subject: /^You have been selected for Verification Engineer/, says: /you have been selected for Verification Engineer/ },
];

for (const decision of DECISIONS) {
  test(`${decision.name}: a label sends nothing; only the explicit action sends it, once, and nothing else changes`, async () => {
    const fx = await applied(`${decision.kind}.once`);
    await ctx.models.Application.updateOne({ _id: fx.application._id }, { $set: { recruiterNotes: 'RECRUITER-NOTE-MARKER' } });
    await ctx.models.Candidate.updateOne({ _id: fx.candidate._id }, { $set: { notes: [{ text: 'CANDIDATE-NOTE-MARKER', authorName: 'Test RECRUITER', at: new Date() }] } }).catch(() => {});
    const before = await snapshot(fx);
    const path = fx[decision.kind];

    // Without the label the action is refused.
    const early = await recruiter.post(path);
    assert.deepEqual([early.status, early.body.error.code], [409, 'CONFLICT']);
    assert.match(early.body.error.message, new RegExp(`Add the ${decision.label.charAt(0)}${decision.label.slice(1).toLowerCase()} label`));

    // Adding the label, on the application or on the candidate, sends nothing.
    assert.equal((await label(fx, [decision.label])).status, 200);
    assert.equal((await recruiter.patch(`/api/admin/candidates/${fx.candidate._id}`, { json: { labels: [decision.label] } })).status, 200);
    await settle();
    assert.equal(ctx.outbox.length, 0, 'a label is a tag: no email');
    assert.equal((await stored(fx)).decisionEmails[decision.kind].status, 'NOT_SENT');
    await ctx.models.Candidate.updateOne({ _id: fx.candidate._id }, { $set: { labels: [] } });

    // The action: one email, to the candidate.
    const done = await recruiter.post(path);
    assert.equal(done.status, 200);
    assert.equal(done.body.data.email, 'SENT');
    const state = done.body.data.application.decisionEmails[decision.kind];
    assert.deepEqual([state.status, state.attempts, state.failure, state.byName], ['SENT', 1, '', 'Test RECRUITER']);
    assert.ok(Math.abs(Date.now() - Date.parse(state.sentAt)) < 60_000);
    assert.ok(!JSON.stringify(done.body).includes('byId'), 'the id of the sender stays on the server');
    assert.equal(ctx.outbox.length, 1);
    const [message] = ctx.outbox;
    assert.deepEqual([message.template, message.to, message.replyTo], [decision.template, `emails.${decision.kind}.once@example.com`, undefined]);
    assert.match(message.subject, decision.subject);
    assert.match(message.text, decision.says);
    assertNothingInternal(message, fx, `the ${decision.name}`);
    assert.ok(!/reason|because|skills|experience|resume/i.test(message.text), 'no reason and nothing from the profile');

    // The label is kept, the status did not move, no evaluation ran and no AI was asked.
    const after = await stored(fx);
    assert.deepEqual([...after.labels], [decision.label]);
    assert.equal(await snapshot(fx), before, 'status, shortlist, records, ATS results and AI usage are as they were');
    assert.equal(after.decisionEmails[decision.kind === 'regret' ? 'selection' : 'regret'].status, 'NOT_SENT', 'the other email is untouched');
    assert.equal(provider.openai, 0);

    // On record, and audited without the text of the email.
    const entry = await recordOf(decision.template, fx.id);
    assert.deepEqual([entry.kind, entry.recipient, entry.entityType, entry.status, entry.automatic, entry.attempts], ['CANDIDATE_DECISION', 'CANDIDATE', 'application', 'SENT', false, 1]);
    const log = await audit(`entityType=application&entityId=${fx.id}&action=application.${decision.kind}_email`);
    assert.equal(log.length, 1);
    assert.deepEqual(log[0].metadata, { state: 'SENT', candidateId: String(fx.candidate._id) });
    assert.match(log[0].summary, /: sent$/);

    // Never twice: again, by someone else, after the label came off and went back on.
    const again = await recruiter.post(path);
    assert.deepEqual([again.status, again.body.error.code], [409, 'CONFLICT']);
    assert.match(again.body.error.message, /has already been sent for this application/);
    assert.equal((await admin.post(path)).status, 409);
    assert.equal((await label(fx, [])).status, 200);
    assert.equal((await recruiter.post(path)).status, 409);
    assert.equal((await label(fx, [decision.label])).status, 200);
    assert.equal((await recruiter.post(path)).status, 409);
    await settle();
    assert.equal(ctx.outbox.length, 1, 'one email, whatever was pressed afterwards');
    assert.equal((await stored(fx)).decisionEmails[decision.kind].attempts, 1);
  });
}

test('regret and selection emails: two presses at the same moment send one email, and both labels together send none', async () => {
  const fx = await applied('decision.race');
  await label(fx, ['REJECTED']);
  ctx.outbox.length = 0;
  const answers = await Promise.all([recruiter.post(fx.regret), admin.post(fx.regret), recruiter.post(fx.regret), admin.post(fx.regret)]);
  assert.deepEqual(answers.map((answer) => answer.status).sort(), [200, 409, 409, 409]);
  assert.equal(sent('regretNotification').length, 1);
  assert.equal((await stored(fx)).decisionEmails.regret.attempts, 1);

  // Both labels: the two emails say opposite things, so neither is sent.
  const both = await applied('decision.both');
  await label(both, ['REJECTED', 'SELECTED']);
  ctx.outbox.length = 0;
  for (const path of [both.regret, both.selection]) {
    const refused = await recruiter.post(path);
    assert.deepEqual([refused.status, refused.body.error.code], [409, 'CONFLICT']);
    assert.match(refused.body.error.message, /carries both the .* label\. Remove one of them/);
  }
  assert.equal(ctx.outbox.length, 0);
  // With one removed, the email that matches the remaining label goes out.
  await label(both, ['SELECTED']);
  assert.equal((await recruiter.post(both.regret)).status, 409, 'not the regret email');
  assert.equal((await recruiter.post(both.selection)).status, 200);
  assert.deepEqual(ctx.outbox.map((message) => message.template), ['selectionNotification']);

  // A shortlisted application can be labelled and emailed like any other, and stays shortlisted.
  const listed = await applied('decision.shortlisted');
  assert.equal((await recruiter.post(listed.shortlist)).status, 200);
  await label(listed, ['INTERVIEWED', 'REJECTED']);
  ctx.outbox.length = 0;
  assert.equal((await recruiter.post(listed.regret)).status, 200);
  const application = await stored(listed);
  assert.deepEqual([application.status, [...application.labels], application.shortlist.email.status], ['SHORTLISTED', ['INTERVIEWED', 'REJECTED'], 'SENT']);
  assert.deepEqual(ctx.outbox.map((message) => message.template), ['regretNotification']);
});

test('regret and selection emails: who may send them, and what is refused before anything is sent', async () => {
  const fx = await applied('decision.access');
  await label(fx, ['REJECTED']);
  ctx.outbox.length = 0;

  for (const path of [fx.regret, fx.selection]) {
    assert.equal((await client().post(path)).status, 401, 'signed out');
    assert.equal((await manager.post(path)).status, 403, 'a hiring manager reads and does not email candidates');
    assert.equal((await content.post(path)).status, 403);
    assert.equal((await recruiter.post(path, { xhr: false })).status, 403, 'without the X-Requested-With header');
    assert.equal((await recruiter.post(path, { origin: 'https://evil.example' })).status, 403, 'from another origin');
    assert.equal((await recruiter.get(path)).status, 404, 'the action is a POST');
  }
  assert.equal((await recruiter.post('/api/admin/applications/not-an-id/regret-email')).status, 400);
  assert.equal((await recruiter.post('/api/admin/applications/aaaaaaaaaaaaaaaaaaaaaaaa/regret-email')).status, 404);
  // A hiring manager cannot add the label either, and a label sent with
  // a public application is dropped, so neither route can be reached
  // from outside the team.
  assert.equal((await label(fx, ['SELECTED'], manager)).status, 403);
  await settle();
  assert.equal(ctx.outbox.length, 0);
  assert.equal((await stored(fx)).decisionEmails.regret.status, 'NOT_SENT');

  // The two roles that decide on applications can send it.
  assert.equal((await admin.post(fx.regret)).status, 200);
  assert.equal(ctx.outbox.length, 1);
});

// =====================================================================
// Failures and retries (Resend answered by a stand-in)
// =====================================================================

test('what Resend answers is turned into a reason, without the key', () => {
  const failure = (status, name, message) => describeFailure(Object.assign(new Error(message), { status, providerError: name, providerMessage: message }));
  assert.deepEqual(failure(403, 'validation_error', DOMAIN_MESSAGE), { category: 'sender_not_verified', httpStatus: 403, providerError: 'validation_error', message: DOMAIN_MESSAGE });
  assert.equal(failure(403, 'validation_error', 'You can only send testing emails to your own email address (owner@example.com). To send emails to other recipients, please verify a domain at resend.com/domains').category, 'sender_not_verified');
  assert.equal(failure(422, 'invalid_from_address', 'Invalid `from` field. The email address needs to follow the `email@example.com` or `Name <email@example.com>` format.').category, 'invalid_sender');
  assert.equal(failure(401, 'missing_api_key', 'Missing API key in the authorization header.').category, 'credentials');
  assert.equal(failure(403, 'invalid_api_key', 'API key is invalid').category, 'credentials');
  assert.equal(failure(429, 'daily_quota_exceeded', 'You have reached your daily email sending quota.').category, 'quota');
  assert.equal(failure(429, 'rate_limit_exceeded', 'Too many requests. You can only make 2 requests per second.').category, 'rate_limited');
  assert.equal(failure(422, 'validation_error', 'Invalid `to` field.').category, 'recipient');
  assert.equal(failure(500, 'application_error', 'An unexpected error occurred.').category, 'provider');
  assert.equal(failure(418, '', 'Something else').category, 'rejected');
  assert.equal(describeFailure(new DOMException('The operation was aborted due to timeout', 'TimeoutError')).category, 'timeout');
  assert.equal(describeFailure(new TypeError('fetch failed')).category, 'network');
  // A key that came back in the provider's text is removed.
  const leaked = failure(403, 'invalid_api_key', `API key re_test_MUST-NOT-LEAK-0000 is invalid. Authorization: Bearer re_other_key_12345`);
  assert.ok(!/MUST-NOT-LEAK|re_other_key/.test(JSON.stringify(leaked)));
  assert.equal(leaked.category, 'credentials');
});

test('shortlist email fails: the application stays shortlisted, the reason is kept, and the retry sends it once', async (t) => {
  const fx = await applied('fail.shortlist');
  withLog(t);
  useResend(t, domainNotVerified);

  const done = await recruiter.post(fx.shortlist);
  assert.equal(done.status, 200, 'the shortlist itself succeeds');
  assert.deepEqual([done.body.data.application.status, done.body.data.email], ['SHORTLISTED', 'FAILED']);
  assert.deepEqual([done.body.data.application.shortlist.email.status, done.body.data.application.shortlist.email.failure, done.body.data.application.shortlist.email.attempts], ['FAILED', 'sender_not_verified', 1]);
  assert.equal(provider.requests.length, 1, 'one request to Resend, not repeated by itself');
  assert.equal(provider.requests[0].body.to[0], 'emails.fail.shortlist@example.com');
  // What the recruiter is sent holds a category, not the provider's text.
  assert.ok(!JSON.stringify(done.body).includes('allsemi.com') && !JSON.stringify(done.body).includes('resend.com'));

  // The cause can be read on the server: the log, the email record and the audit log.
  const [line] = logged('email.failed');
  assert.deepEqual([line.template, line.category, line.providerStatus, line.providerError, line.providerMessage], ['shortlistNotification', 'sender_not_verified', 403, 'validation_error', DOMAIN_MESSAGE]);
  const entry = await recordOf('shortlistNotification', fx.id);
  assert.deepEqual([entry.status, entry.attempts, entry.failure.category, entry.failure.httpStatus, entry.failure.providerError, entry.failure.message], ['FAILED', 1, 'sender_not_verified', 403, 'validation_error', DOMAIN_MESSAGE]);
  const [audited] = await audit(`entityType=application&entityId=${fx.id}&action=application.shortlist_email`);
  assert.deepEqual(audited.metadata, { state: 'FAILED', candidateId: String(fx.candidate._id), reason: 'sender_not_verified', providerStatus: 403, providerError: 'validation_error', providerMessage: DOMAIN_MESSAGE });
  assertNoKey(logLines.join(''), 'the server log');
  assertNoKey([entry.toObject(), audited, done.body], 'the record, the audit entry and the answer');

  // Still failing: a retry is one more request, the application is not
  // shortlisted again and no second application appears.
  const retry = await recruiter.post(fx.shortlistEmail);
  assert.deepEqual([retry.status, retry.body.data.email, retry.body.data.application.status], [200, 'FAILED', 'SHORTLISTED']);
  assert.equal(provider.requests.length, 2);
  assert.equal((await recruiter.post(fx.shortlist)).status, 409, 'it cannot be shortlisted a second time');
  assert.equal(provider.requests.length, 2);
  assert.equal(await ctx.models.Application.countDocuments({ candidateId: fx.candidate._id }), 1);

  // The sender is fixed: the retry is accepted, once.
  provider.answer = accepted;
  const fixed = await admin.post(fx.shortlistEmail);
  assert.deepEqual([fixed.status, fixed.body.data.email], [200, 'SENT']);
  assert.deepEqual([fixed.body.data.application.shortlist.email.status, fixed.body.data.application.shortlist.email.failure, fixed.body.data.application.shortlist.email.attempts], ['SENT', '', 3]);
  assert.equal(provider.requests.length, 3);
  assert.equal((await recruiter.post(fx.shortlistEmail)).status, 409, 'not sent again after it was accepted');
  assert.equal((await recruiter.post(fx.shortlist)).status, 409);
  assert.equal(provider.requests.length, 3, 'no further request');
  const final = await recordOf('shortlistNotification', fx.id);
  assert.deepEqual([final.status, final.attempts, final.failure, final.providerId], ['SENT', 3, null, 're-sample-3']);
  assert.equal((await stored(fx)).shortlist.byName, 'Test RECRUITER', 'the shortlist decision is the first one');
});

for (const decision of DECISIONS) {
  test(`${decision.name} fails: the label stays, nothing else changes, and the retry sends it once`, async (t) => {
    const fx = await applied(`fail.${decision.kind}`);
    await label(fx, [decision.label]);
    const before = await snapshot(fx);
    const path = fx[decision.kind];
    useResend(t, domainNotVerified);

    const failed = await recruiter.post(path);
    assert.equal(failed.status, 200, 'the attempt is answered, with what happened');
    assert.equal(failed.body.data.email, 'FAILED');
    const state = failed.body.data.application.decisionEmails[decision.kind];
    assert.deepEqual([state.status, state.failure, state.attempts, state.sentAt, state.byName], ['FAILED', 'sender_not_verified', 1, null, '']);
    assert.deepEqual([...(await stored(fx)).labels], [decision.label], 'the label is kept');
    assert.equal(await snapshot(fx), before);
    assert.equal(provider.requests.length, 1, 'one request, no automatic retry');
    const [audited] = await audit(`entityType=application&entityId=${fx.id}&action=application.${decision.kind}_email`);
    assert.deepEqual([audited.metadata.state, audited.metadata.reason, audited.metadata.providerStatus], ['FAILED', 'sender_not_verified', 403]);
    assert.match(audited.summary, /not sent \(the email service did not accept it\)$/);

    // A network failure next: still FAILED, still retryable.
    provider.answer = null;
    const offline = await recruiter.post(path);
    assert.deepEqual([offline.body.data.email, offline.body.data.application.decisionEmails[decision.kind].failure], ['FAILED', 'network']);

    // Then it works: sent once, and never again.
    provider.answer = accepted;
    const done = await recruiter.post(path);
    assert.deepEqual([done.status, done.body.data.email], [200, 'SENT']);
    const sentState = done.body.data.application.decisionEmails[decision.kind];
    assert.deepEqual([sentState.status, sentState.failure, sentState.attempts, sentState.byName], ['SENT', '', 3, 'Test RECRUITER']);
    assert.equal(provider.requests.length, 3);
    assert.equal(provider.requests[2].body.to[0], `emails.fail.${decision.kind}@example.com`);
    assert.match(provider.requests[2].body.subject, decision.subject);
    assert.equal((await recruiter.post(path)).status, 409);
    assert.equal((await admin.post(path)).status, 409);
    assert.equal(provider.requests.length, 3);
    assert.equal(await snapshot(fx), before, 'no status, record, evaluation or AI request changed through any of it');
    assert.equal(await ctx.models.EmailLog.countDocuments({ key: `${decision.template}:${fx.id}` }), 1, 'one record for the email, not one per attempt');
    assert.equal(provider.openai, 0);
  });
}

test('automatic emails that failed: the record shows it, a member of staff can send one again, and never after it was accepted', async (t) => {
  const notifications = await import('../src/services/email/notifications.js');
  notifications.resetConfirmationLimits();
  useResend(t, domainNotVerified);
  const response = await client().post('/api/enquiries', { form: multipart({ name: 'Resend', email: 'emails.resend@example.com', type: 'GENERAL', subject: 'Did this arrive', message: 'Hello' }) });
  assert.equal(response.status, 201, 'the enquiry is saved whatever happens to the emails');
  await settle();
  const enquiry = await ctx.models.Enquiry.findOne({ email: 'emails.resend@example.com' });
  assert.equal(provider.requests.length, 2, 'one attempt each, no automatic retry');

  // What the admin is shown.
  const path = `/api/admin/emails?entityType=enquiry&entityId=${enquiry._id}`;
  const listed = await recruiter.get(path);
  assert.equal(listed.status, 200);
  assert.deepEqual(listed.body.data.map((entry) => [entry.template, entry.kind, entry.recipient, entry.status, entry.attempts, entry.canResend, entry.failure]).sort(), [
    ['enquiryConfirmation', 'ACKNOWLEDGEMENT', 'SENDER', 'FAILED', 1, true, { category: 'sender_not_verified' }],
    ['newEnquiryAdmin', 'TEAM_NOTIFICATION', 'TEAM', 'FAILED', 1, true, { category: 'sender_not_verified' }],
  ]);
  assert.ok(!JSON.stringify(listed.body).includes('emails.resend@example.com') && !JSON.stringify(listed.body).includes('allsemi.com'), 'no address and no provider text for a recruiter');
  // A super admin also sees what the email service said.
  const forAdmin = (await admin.get(path)).body.data.find((entry) => entry.template === 'newEnquiryAdmin');
  assert.deepEqual(forAdmin.failure, { category: 'sender_not_verified', httpStatus: 403, providerError: 'validation_error', message: DOMAIN_MESSAGE });
  assertNoKey(listed.body, 'the list');

  // Who may read and resend follows the record the email is about.
  const teamEntry = listed.body.data.find((entry) => entry.template === 'newEnquiryAdmin');
  const courtesyEntry = listed.body.data.find((entry) => entry.template === 'enquiryConfirmation');
  assert.equal((await client().get(path)).status, 401);
  assert.equal((await content.get(path)).status, 403);
  assert.equal((await manager.get(path)).status, 403, 'a hiring manager does not read enquiries');
  assert.equal((await recruiter.get('/api/admin/emails?entityType=user&entityId=aaaaaaaaaaaaaaaaaaaaaaaa')).status, 400);
  assert.equal((await recruiter.get(`/api/admin/emails?entityType=enquiry&entityId=nope`)).status, 400);
  assert.equal((await client().post(`/api/admin/emails/${teamEntry.id}/resend`)).status, 401);
  assert.equal((await content.post(`/api/admin/emails/${teamEntry.id}/resend`)).status, 403);
  assert.equal((await recruiter.post(`/api/admin/emails/${teamEntry.id}/resend`, { xhr: false })).status, 403);
  assert.equal((await recruiter.post('/api/admin/emails/aaaaaaaaaaaaaaaaaaaaaaaa/resend')).status, 404);
  assert.equal(provider.requests.length, 2, 'nothing was sent by any refused request');

  // Still failing: one more request, still on record as failed.
  const again = await recruiter.post(`/api/admin/emails/${teamEntry.id}/resend`);
  assert.deepEqual([again.status, again.body.data.status, again.body.data.attempts, again.body.data.automatic], [200, 'FAILED', 2, false]);
  assert.equal(provider.requests.length, 3);

  // The sender is fixed: each email goes out once, with the same wording and addresses as the first time.
  provider.answer = accepted;
  const team = await recruiter.post(`/api/admin/emails/${teamEntry.id}/resend`);
  assert.deepEqual([team.status, team.body.data.status, team.body.data.attempts, team.body.data.canResend, team.body.data.failure], [200, 'SENT', 3, false, null]);
  const courtesy = await admin.post(`/api/admin/emails/${courtesyEntry.id}/resend`);
  assert.deepEqual([courtesy.status, courtesy.body.data.status], [200, 'SENT']);
  const [teamRequest, courtesyRequest] = provider.requests.slice(3);
  assert.deepEqual([teamRequest.body.to, teamRequest.body.reply_to, teamRequest.body.subject], [[TEAM], 'emails.resend@example.com', 'New enquiry: Did this arrive']);
  assert.deepEqual([courtesyRequest.body.to, courtesyRequest.body.subject, 'reply_to' in courtesyRequest.body], [['emails.resend@example.com'], 'We received your message', false]);
  assert.deepEqual(teamRequest.body.text, provider.requests.find((request) => request.body.to[0] === TEAM).body.text, 'the same message as the first attempt');

  // Accepted: never sent again, by anyone.
  for (const id of [teamEntry.id, courtesyEntry.id]) {
    const refused = await recruiter.post(`/api/admin/emails/${id}/resend`);
    assert.deepEqual([refused.status, refused.body.error.code], [409, 'CONFLICT']);
    assert.match(refused.body.error.message, /already been sent/);
  }
  assert.equal(provider.requests.length, 5);
  assert.equal(await ctx.models.EmailLog.countDocuments({ entityId: String(enquiry._id) }), 2);
  const resent = await audit(`entityType=enquiry&entityId=${enquiry._id}&action=email.resent`);
  assert.equal(resent.length, 3, 'each explicit resend is audited');
  notifications.resetConfirmationLimits();
});

test('candidate emails are not resent from the email record, and the record goes when its application is deleted', async () => {
  const fx = await applied('record');
  assert.equal((await recruiter.post(fx.shortlist)).status, 200);
  ctx.outbox.length = 0;
  const listed = (await recruiter.get(`/api/admin/emails?entityType=application&entityId=${fx.id}`)).body.data;
  assert.deepEqual(listed.map((entry) => [entry.template, entry.status, entry.canResend]).sort(), [
    ['applicationConfirmation', 'SENT', false],
    ['newApplicationAdmin', 'SENT', false],
    ['shortlistNotification', 'SENT', false],
  ]);
  assert.ok((await manager.get(`/api/admin/emails?entityType=application&entityId=${fx.id}`)).status === 200, 'a role that reads applications reads their emails');
  // The shortlist email has its own action: the record does not send it.
  const shortlistEntry = listed.find((entry) => entry.template === 'shortlistNotification');
  const refused = await recruiter.post(`/api/admin/emails/${shortlistEntry.id}/resend`);
  assert.deepEqual([refused.status, refused.body.error.code], [409, 'CONFLICT']);
  assert.equal(ctx.outbox.length, 0);

  // Deleting the candidate removes the applications and their email record.
  assert.equal((await admin.delete(`/api/admin/candidates/${fx.candidate._id}`)).status, 200);
  assert.equal(await ctx.models.EmailLog.countDocuments({ entityId: fx.id }), 0);
});

// =====================================================================
// The wording
// =====================================================================

test('templates: every email to a candidate or a sender is fixed wording with no internal detail', () => {
  const job = { title: 'RTL Design Engineer' };
  const all = {
    shortlist: templates.shortlistNotification({ job }),
    regret: templates.regretNotification({ job }),
    selection: templates.selectionNotification({ job }),
    regretGeneral: templates.regretNotification({ job: null }),
    selectionGeneral: templates.selectionNotification({ job: null }),
    requirement: templates.requirementConfirmation(),
    enquiry: templates.enquiryConfirmation(),
    referral: templates.referralConfirmation(),
    application: templates.applicationConfirmation({ job }),
  };
  for (const [name, message] of Object.entries(all)) {
    assert.ok(message.subject && message.html && message.text, `${name} has a subject, HTML and text`);
    const text = `${message.subject}\n${message.text}`;
    assert.ok(!/\bATS\b|score|\bAI\b|analysis|notes?\b|\b[a-f0-9]{24}\b|resumes\//i.test(text), `${name}: no score, analysis, note, id or storage key`);
    assert.ok(!/\b\d+\s*(hours?|days?|weeks?)\b|within \d|business day/i.test(text), `${name}: no response time is promised`);
    assert.ok(![String.fromCharCode(0x2013), String.fromCharCode(0x2014)].some((dash) => `${message.html}${message.text}`.includes(dash)), `${name}: no dash characters`);
    assert.ok(message.html.includes('ALLSEMIS'));
  }
  assert.equal(all.regret.subject, 'Update on your application for RTL Design Engineer');
  assert.match(all.regret.text, /Thank you for applying for RTL Design Engineer/);
  assert.match(all.regret.text, /we will not be taking your application for this role forward/);
  assert.match(all.regret.text, /wish you every success/);
  assert.equal(all.regretGeneral.subject, 'Update on your application');
  assert.equal(all.selection.subject, 'You have been selected for RTL Design Engineer');
  assert.match(all.selection.text, /contact you at this address about the next steps/);
  assert.ok(!/offer|salary|start date|contract/i.test(all.selection.text), 'the selection email states no terms');
  assert.match(all.enquiry.text, /received your enquiry.*review it and get in touch/);
  assert.match(all.requirement.text, /received your hiring requirement.*review it and contact you/);
});
