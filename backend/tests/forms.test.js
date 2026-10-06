import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import {
  startServer, stopServer, client, signedIn, multipart, applicationFields, pdfBytes, exeBytes, wait,
} from './helpers.js';

let ctx;
before(async () => { ctx = await startServer(); });
after(async () => { await stopServer(); });

const resume = (overrides = {}) => ({ field: 'resume', name: 'resume.pdf', buffer: pdfBytes(), type: 'application/pdf', ...overrides });

// Each submission sends two emails. The notification goes to the team
// (ADMIN_NOTIFICATION_EMAIL, team@example.com in the tests) with the
// sender as reply-to, so a reply reaches the person who wrote. The
// confirmation goes to the sender and carries no reply-to.
function assertNotified({ admin, confirmation, sender }) {
  const toTeam = ctx.outbox.find((message) => message.template === admin);
  assert.ok(toTeam, `${admin} was sent`);
  assert.equal(toTeam.to, 'team@example.com');
  assert.equal(toTeam.replyTo, sender);
  const toSender = ctx.outbox.find((message) => message.template === confirmation);
  assert.ok(toSender, `${confirmation} was sent`);
  assert.equal(toSender.to, sender);
  assert.equal(toSender.replyTo, undefined);
}

async function publishedJob(overrides = {}) {
  return ctx.models.Job.create({
    title: 'Design Verification Engineer', slug: `dv-engineer-${Date.now()}-${Math.round(Math.random() * 1e6)}`, category: 'Semiconductor', location: 'Bangalore, IN',
    experienceLevel: 'Mid-Senior', requiredSkills: ['SystemVerilog', 'UVM'], preferredSkills: ['Python'], status: 'published', publishedAt: new Date(), ...overrides,
  });
}

test('general enquiry: saved, validated, and both emails are sent', async () => {
  ctx.outbox.length = 0;
  const response = await client().post('/api/enquiries', { form: multipart({ name: 'Asha', email: 'ASHA@Example.com', type: 'PARTNERSHIP', subject: 'Working together', message: 'We run training programmes.' }) });
  assert.equal(response.status, 201);
  assert.deepEqual(response.body, { success: true, data: { received: true } }, 'the response returns no record data');

  const saved = await ctx.models.Enquiry.findOne({ email: 'asha@example.com' });
  assert.ok(saved, 'the enquiry is in the database');
  assert.equal(saved.type, 'PARTNERSHIP');
  assert.equal(saved.status, 'NEW');

  await wait(150);
  const recipients = ctx.outbox.map((message) => message.to).sort();
  assert.deepEqual(recipients, ['asha@example.com', 'team@example.com']);
  assertNotified({ admin: 'newEnquiryAdmin', confirmation: 'enquiryConfirmation', sender: 'asha@example.com' });
});

test('validation: bad input is rejected with field details', async () => {
  const response = await client().post('/api/enquiries', { form: multipart({ name: '', email: 'not-an-email', message: '' }) });
  assert.equal(response.status, 400);
  assert.equal(response.body.error.code, 'VALIDATION_ERROR');
  const fields = response.body.error.details.map((detail) => detail.field).sort();
  assert.deepEqual(fields, ['email', 'message', 'name']);

  const tooLong = await client().post('/api/enquiries', { form: multipart({ name: 'A', email: 'a@example.com', message: 'x'.repeat(7000) }) });
  assert.equal(tooLong.status, 400);
});

test('a visitor cannot set internal fields, and markup is removed', async () => {
  const response = await client().post('/api/enquiries', {
    json: { name: 'Mallory <script>alert(1)</script>', email: 'mallory@example.com', message: '<img src=x onerror=alert(1)> hello', status: 'CLOSED', internalNotes: 'approved', type: 'GENERAL', _id: '507f1f77bcf86cd799439011' },
  });
  assert.equal(response.status, 201);
  const saved = await ctx.models.Enquiry.findOne({ email: 'mallory@example.com' });
  assert.equal(saved.status, 'NEW', 'status sent by the visitor is ignored');
  assert.equal(saved.internalNotes, '');
  assert.notEqual(String(saved._id), '507f1f77bcf86cd799439011');
  assert.ok(!saved.name.includes('<') && !saved.message.includes('<'), 'markup is stripped');
});

test('an applicant cannot shortlist or label their own application', async () => {
  ctx.outbox.length = 0;
  const job = await publishedJob();
  const fields = applicationFields({ email: 'self.promoter@example.com', name: 'Self Promoter', jobId: String(job._id), status: 'SHORTLISTED', labels: 'SELECTED', shortlist: 'true' });
  assert.equal((await client().post('/api/applications', { form: multipart(fields, resume()) })).status, 201);
  const candidate = await ctx.models.Candidate.findOne({ email: 'self.promoter@example.com' });
  const [application] = await ctx.models.Application.find({ candidateId: candidate._id });
  assert.equal(application.status, 'NEW');
  assert.deepEqual([...application.labels], []);
  assert.equal(application.shortlist, null);
  assert.deepEqual([...candidate.labels], []);
  await wait(150);
  assert.ok(!ctx.outbox.some((message) => message.template === 'shortlistNotification'), 'an application never triggers the shortlist email');
});

test('honeypot: a filled trap field is accepted and discarded', async () => {
  const before = await ctx.models.Enquiry.countDocuments({});
  const response = await client().post('/api/enquiries', { form: multipart({ name: 'Bot', email: 'bot@example.com', message: 'Buy now', website: 'http://spam.example' }) });
  assert.equal(response.status, 201);
  assert.equal(await ctx.models.Enquiry.countDocuments({}), before, 'nothing was saved');
});

test('forms refuse posts from other websites', async () => {
  const foreign = await client().post('/api/enquiries', { json: { name: 'X', email: 'x@example.com', message: 'hi' }, origin: 'https://evil.example' });
  assert.equal(foreign.status, 403);
  const plainForm = await client().post('/api/enquiries', { json: { name: 'X', email: 'x@example.com', message: 'hi' }, xhr: false });
  assert.equal(plainForm.status, 403);
});

test('hire talent: requirement saved with an optional JD attachment', async () => {
  ctx.outbox.length = 0;
  const response = await client().post('/api/requirements', {
    form: multipart({ contactName: 'Hiring Lead', company: 'Employer (sample)', email: 'lead@example.com', role: 'Verification engineers', positions: '3', hiringType: 'Permanent Staffing', workMode: 'HYBRID', location: 'Bengaluru', description: 'Three DV engineers.', consent: 'true', priority: 'HIGH', status: 'CLOSED' },
      { field: 'attachment', name: 'jd.pdf', buffer: pdfBytes(), type: 'application/pdf' }),
  });
  assert.equal(response.status, 201);
  const saved = await ctx.models.Requirement.findOne({ email: 'lead@example.com' });
  assert.equal(saved.status, 'NEW');
  assert.equal(saved.priority, 'MEDIUM', 'priority is recruiter-only');
  assert.equal(saved.positions, 3);
  assert.equal(saved.source, 'WEBSITE');
  assert.match(saved.attachment.key, /^requirements\/\d{4}\/\d{2}\/[0-9a-f-]{36}\.pdf$/, 'the stored key is random');
  assert.equal(saved.attachment.storage, 'memory', 'the store that holds the file is kept with the key');
  await wait(150);
  assert.equal(ctx.outbox.length, 2);
  assertNotified({ admin: 'newRequirementAdmin', confirmation: 'requirementConfirmation', sender: 'lead@example.com' });
});

test('application: creates the candidate, the application and a rule-based ATS result', async () => {
  ctx.outbox.length = 0;
  const job = await publishedJob();
  const response = await client().post('/api/applications', { form: multipart(applicationFields({ jobId: String(job._id) }), resume()) });
  assert.equal(response.status, 201);

  const candidate = await ctx.models.Candidate.findOne({ email: 'candidate.one@example.com' });
  assert.ok(candidate);
  assert.deepEqual([...candidate.labels], []);
  assert.equal(candidate.experienceYears, 6);
  assert.deepEqual([...candidate.skills], ['SystemVerilog', 'UVM', 'Functional Coverage']);
  assert.equal(candidate.resume.originalName, 'resume.pdf');
  assert.equal(candidate.resume.mimeType, 'application/pdf');

  const applications = await ctx.models.Application.find({ candidateId: candidate._id });
  assert.equal(applications.length, 1);
  assert.equal(String(applications[0].jobId), String(job._id));
  assert.equal(applications[0].status, 'NEW');
  assert.equal(applications[0].shortlist, null);

  const result = await ctx.models.ATSResult.findOne({ candidateId: candidate._id, jobId: job._id });
  assert.ok(result, 'an evaluation ran with the application');
  assert.equal(result.engine, 'RULE_BASED');
  assert.equal(result.skillScore, 100);

  await wait(150);
  assert.deepEqual(ctx.outbox.map((message) => message.template).sort(), ['applicationConfirmation', 'newApplicationAdmin']);
  assertNotified({ admin: 'newApplicationAdmin', confirmation: 'applicationConfirmation', sender: 'candidate.one@example.com' });
});

test('a second application from the same email does not create a second candidate', async () => {
  const jobA = await publishedJob();
  const jobB = await publishedJob({ title: 'RTL Design Engineer' });
  const fields = applicationFields({ email: 'repeat@example.com', name: 'Repeat Applicant' });
  assert.equal((await client().post('/api/applications', { form: multipart({ ...fields, jobId: String(jobA._id) }, resume()) })).status, 201);
  assert.equal((await client().post('/api/applications', { form: multipart({ ...fields, email: 'REPEAT@example.com', jobId: String(jobB._id), name: 'Someone Else', skills: 'Python' }, resume()) })).status, 201);

  const candidates = await ctx.models.Candidate.find({ email: 'repeat@example.com' });
  assert.equal(candidates.length, 1);
  const applications = await ctx.models.Application.find({ candidateId: candidates[0]._id });
  assert.equal(applications.length, 2);
});

test('a public submission never changes or removes what is already stored for that email', async () => {
  const { memoryFiles } = await import('../src/services/storage/drivers/memory.js');
  const job = await publishedJob();
  const owner = applicationFields({ email: 'owner@example.com', name: 'Real Owner', message: 'My real application.' });
  assert.equal((await client().post('/api/applications', { form: multipart({ ...owner, jobId: String(job._id) }, resume({ name: 'real-cv.pdf' })) })).status, 201);

  const before = await ctx.models.Candidate.findOne({ email: 'owner@example.com' });
  const [firstApplication] = await ctx.models.Application.find({ candidateId: before._id });
  const firstResult = await ctx.models.ATSResult.findOne({ candidateId: before._id, jobId: job._id });
  const originalKey = before.resume.key;

  // Someone else, who only knows the address, submits the same form.
  const intruder = applicationFields({
    email: 'owner@example.com', name: 'Not The Owner', phone: '+91 90000 99999', headline: 'Changed headline', skills: 'Nothing, Relevant', message: 'Replaced message.', jobId: String(job._id),
  });
  assert.equal((await client().post('/api/applications', { form: multipart(intruder, resume({ name: 'other.pdf' })) })).status, 201);

  const after = await ctx.models.Candidate.findOne({ email: 'owner@example.com' });
  assert.equal(after.name, 'Real Owner');
  assert.equal(after.phone, before.phone);
  assert.equal(after.headline, before.headline);
  assert.deepEqual([...after.skills], [...before.skills], 'skills are not merged in');
  assert.equal(after.resume.key, originalKey, 'the resume on the profile is not replaced');
  assert.ok(memoryFiles.has(originalKey), 'the original file is still stored');

  const unchanged = await ctx.models.Application.findById(firstApplication._id);
  assert.equal(unchanged.message, 'My real application.');
  assert.equal(unchanged.resume.key, originalKey);

  // The new submission is its own application, with what was sent.
  const applications = await ctx.models.Application.find({ candidateId: after._id });
  assert.equal(applications.length, 2);
  const added = applications.find((item) => String(item._id) !== String(firstApplication._id));
  assert.equal(added.message, 'Replaced message.');
  assert.equal(added.submittedProfile.name, 'Not The Owner');
  assert.deepEqual([...added.submittedProfile.skills], ['Nothing', 'Relevant']);
  assert.notEqual(added.resume.key, originalKey);
  assert.ok(memoryFiles.has(added.resume.key));

  // The evaluation a recruiter may have reviewed is not re-run.
  const result = await ctx.models.ATSResult.findOne({ candidateId: after._id, jobId: job._id });
  assert.equal(String(result._id), String(firstResult._id));
  assert.equal(String(result.applicationId), String(firstApplication._id));
  assert.equal(await ctx.models.ATSResult.countDocuments({ candidateId: after._id }), 1);
});

test('one address receives a limited number of confirmation emails', async () => {
  const { resetConfirmationLimits } = await import('../src/services/email/notifications.js');
  resetConfirmationLimits();
  ctx.outbox.length = 0;
  for (let i = 0; i < 5; i += 1) {
    const response = await client().post('/api/enquiries', { json: { name: 'Repeat Sender', email: 'flooded@example.com', message: `Message ${i}` } });
    assert.equal(response.status, 201);
  }
  await wait(200);
  assert.equal(ctx.outbox.filter((message) => message.to === 'flooded@example.com').length, 3, 'confirmations to one address are capped');
  assert.equal(ctx.outbox.filter((message) => message.template === 'newEnquiryAdmin').length, 5, 'the team still hears about every submission');
  assert.equal(await ctx.models.Enquiry.countDocuments({ email: 'flooded@example.com' }), 5, 'every submission is saved');
  resetConfirmationLimits();
});

test('applications to unpublished or unknown jobs are refused', async () => {
  const draft = await publishedJob({ status: 'draft' });
  const closed = await publishedJob({ applicationEnabled: false });
  assert.equal((await client().post('/api/applications', { form: multipart(applicationFields({ email: 'd@example.com', jobId: String(draft._id) }), resume()) })).status, 404);
  assert.equal((await client().post('/api/applications', { form: multipart(applicationFields({ email: 'd@example.com', jobId: '507f1f77bcf86cd799439011' }), resume()) })).status, 404);
  assert.equal((await client().post('/api/applications', { form: multipart(applicationFields({ email: 'd@example.com', jobId: String(closed._id) }), resume()) })).status, 400);
  assert.equal(await ctx.models.Candidate.countDocuments({ email: 'd@example.com' }), 0);
});

test('upload validation: type by content, extension match, size limit', async () => {
  const post = (file, email) => client().post('/api/applications', { form: multipart(applicationFields({ email }), file) });

  const noFile = await client().post('/api/applications', { form: multipart(applicationFields({ email: 'nofile@example.com' })) });
  assert.equal(noFile.status, 400, 'a resume is required');

  const renamedExe = await post(resume({ buffer: exeBytes(), name: 'resume.pdf' }), 'exe@example.com');
  assert.equal(renamedExe.status, 415);
  assert.equal(renamedExe.body.error.code, 'UNSUPPORTED_FILE_TYPE');

  const wrongExtension = await post(resume({ name: 'resume.docx' }), 'ext@example.com');
  assert.equal(wrongExtension.status, 415);

  const lyingMime = await post(resume({ buffer: Buffer.from('<html><script>alert(1)</script></html>'.padEnd(64)), name: 'resume.pdf', type: 'application/pdf' }), 'html@example.com');
  assert.equal(lyingMime.status, 415, 'the browser-supplied MIME type is not trusted');

  const tooBig = await post(resume({ buffer: Buffer.concat([pdfBytes(), Buffer.alloc(5 * 1024 * 1024 + 10)]) }), 'big@example.com');
  assert.equal(tooBig.status, 413);
  assert.equal(tooBig.body.error.code, 'FILE_TOO_LARGE');

  const wrongField = await client().post('/api/applications', { form: multipart(applicationFields({ email: 'field@example.com' }), { field: 'avatar', name: 'resume.pdf', buffer: pdfBytes() }) });
  assert.equal(wrongField.status, 400);

  for (const email of ['exe@example.com', 'ext@example.com', 'html@example.com', 'big@example.com', 'field@example.com', 'nofile@example.com']) {
    assert.equal(await ctx.models.Candidate.countDocuments({ email }), 0, `${email} was not saved`);
  }
});

test('referral: saved with consent required', async () => {
  ctx.outbox.length = 0;
  const fields = { referrerName: 'Ref Errer', referrerEmail: 'referrer@example.com', candidateName: 'Good Engineer', candidateEmail: 'good.engineer@example.com', candidateRole: 'DFT Engineer', relationship: 'Former colleague', message: 'Excellent on scan and ATPG.' };
  const withoutConsent = await client().post('/api/referrals', { form: multipart(fields) });
  assert.equal(withoutConsent.status, 400);
  const response = await client().post('/api/referrals', { form: multipart({ ...fields, consent: 'on' }, resume()) });
  assert.equal(response.status, 201);
  const saved = await ctx.models.Referral.findOne({ referrerEmail: 'referrer@example.com' });
  assert.equal(saved.status, 'NEW');
  assert.ok(saved.resume.key.startsWith('referrals/'));
  await wait(150);
  assert.deepEqual(ctx.outbox.map((message) => message.template).sort(), ['newReferralAdmin', 'referralConfirmation']);
  assertNotified({ admin: 'newReferralAdmin', confirmation: 'referralConfirmation', sender: 'referrer@example.com' });
  assert.ok(!ctx.outbox.some((message) => message.to === 'good.engineer@example.com'), 'the referred person is not emailed');
});

test('public endpoints never return recruitment data or unpublished content', async () => {
  const published = await publishedJob({ title: 'Visible role' });
  const draft = await publishedJob({ title: 'Hidden draft role', status: 'draft' });
  const archived = await publishedJob({ title: 'Hidden archived role', status: 'archived' });

  const list = await client().get('/api/public/jobs');
  assert.equal(list.status, 200);
  const titles = list.body.data.map((job) => job.title);
  assert.ok(titles.includes('Visible role'));
  assert.ok(!titles.includes('Hidden draft role') && !titles.includes('Hidden archived role'));
  assert.equal((await client().get(`/api/public/jobs/${published.slug}`)).status, 200);
  assert.equal((await client().get(`/api/public/jobs/${draft.slug}`)).status, 404);
  assert.equal((await client().get(`/api/public/jobs/${archived.slug}`)).status, 404);

  for (const path of ['/api/public/candidates', '/api/candidates', '/api/public/applications', '/api/public/referrals', '/api/public/enquiries', '/api/public/requirements']) {
    const response = await client().get(path);
    assert.equal(response.status, 404, path);
  }
  const text = JSON.stringify(list.body);
  assert.ok(!/createdBy|updatedBy|recruiterNotes|internalNotes/.test(text));
});

test('public submissions are rate limited per connection', async () => {
  process.env.RATE_LIMIT_IN_TESTS = '1';
  try {
    let limited = null;
    for (let i = 0; i < 12 && !limited; i += 1) {
      const response = await client().post('/api/enquiries', { json: { name: 'Flood', email: `flood${i}@example.com`, message: 'hello' } });
      if (response.status === 429) limited = response;
    }
    assert.ok(limited, 'a 429 is returned after too many submissions');
    assert.equal(limited.body.error.code, 'RATE_LIMITED');
    assert.ok(await ctx.models.Enquiry.countDocuments({ name: 'Flood' }) <= 8);
  } finally {
    delete process.env.RATE_LIMIT_IN_TESTS;
  }
});

test('signed-in staff can read what the forms saved', async () => {
  const recruiter = await signedIn('RECRUITER');
  const enquiries = await recruiter.get('/api/admin/enquiries?type=PARTNERSHIP');
  assert.equal(enquiries.status, 200);
  assert.ok(enquiries.body.data.some((enquiry) => enquiry.email === 'asha@example.com'));
  const referrals = await recruiter.get('/api/admin/referrals?q=Good Engineer');
  assert.equal(referrals.body.data.length, 1);
  assert.ok(!('key' in referrals.body.data[0].resume), 'the storage key is not returned');
  assert.ok(!('storage' in referrals.body.data[0].resume), 'nor where the file is stored');
});
