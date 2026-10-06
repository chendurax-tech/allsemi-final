import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer, stopServer, client, createUser, multipart, applicationFields, pdfBytes, wait } from './helpers.js';
import { seedDatabase } from '../src/seed/seedData.js';
import { memoryFiles } from '../src/services/storage/drivers/memory.js';
import {
  planShowcaseCleanup, applyShowcaseCleanup, inspectStoredFiles, removeUnreferencedFiles, countCollections,
  isReservedAddress, RECRUITMENT_COLLECTIONS, PRESERVED_COLLECTIONS,
} from '../src/services/showcaseCleanup.js';

/*
  The clean showcase state.

  - The development seed creates users and website content, and no job
    or recruitment record.
  - The showcase cleanup (npm run clean:showcase) takes the
    demonstration recruitment data out of a database that already has
    it, with its files and audit entries, and touches nothing else.

  The files are in the in-memory store, as in every other test.
*/

let ctx;
let credentials;
const EMPTY = { Job: 0, Candidate: 0, Application: 0, Requirement: 0, Referral: 0, Enquiry: 0, ATSResult: 0 };
const CONTENT = { Insight: 14, Story: 3, Expertise: 8, Service: 3, Location: 3, SiteSettings: 1 };
const pick = (counts, names) => Object.fromEntries(names.map((name) => [name, counts[name]]));
const removedIn = (plan, name) => plan.collections[name].remove.length;
const keptIn = (plan, name) => plan.collections[name].keep.length;

// Everything the cleanup must leave exactly as it was.
async function preservedSnapshot() {
  const { Insight, Story, Expertise, Service, Location, SiteSettings, User } = ctx.models;
  const out = {};
  for (const [name, Model] of Object.entries({ Insight, Story, Expertise, Service, Location, SiteSettings, User })) {
    out[name] = JSON.stringify((await Model.find({}).sort({ _id: 1 })).map((doc) => doc.toObject()));
  }
  return out;
}

// The seed already has a user for each role, with passwords of its own,
// so the test users get addresses of their own.
async function signedInAs(role) {
  const user = await createUser(role, `test.${role.toLowerCase()}@example.com`);
  const agent = client();
  assert.equal((await agent.login(user.email)).status, 200);
  return agent;
}

before(async () => { ctx = await startServer(); });
after(async () => { await stopServer(); });

test('the seed creates users and website content, and no job or recruitment record', async () => {
  const result = await seedDatabase({ log: () => {}, sampleFiles: true });
  credentials = result.credentials;
  assert.deepEqual(pick(result.counts, RECRUITMENT_COLLECTIONS), EMPTY);
  assert.deepEqual(pick(result.counts, Object.keys(CONTENT)), CONTENT);
  assert.equal(result.counts.User, 4);
  assert.equal(memoryFiles.size, 0, 'no sample resume is stored');

  // The public site has its content and shows no vacancy.
  const get = async (path) => (await client().get(path)).body.data;
  assert.deepEqual(await get('/api/public/jobs'), []);
  assert.equal((await get('/api/public/insights')).length, 13);
  assert.equal((await get('/api/public/stories')).length, 3);
  assert.equal((await get('/api/public/expertise')).length, 8);
  assert.equal((await get('/api/public/services')).length, 3);
  assert.equal((await get('/api/public/locations')).length, 3);
  assert.ok((await get('/api/public/site')).contact.email);

  // The seeded administrator signs in, and every recruitment list is empty.
  const admin = client();
  assert.equal((await admin.login(credentials[0].email, credentials[0].password)).status, 200);
  for (const list of ['jobs', 'candidates', 'applications', 'requirements', 'referrals', 'enquiries', 'ats-results']) {
    const response = await admin.get(`/api/admin/${list}`);
    assert.equal(response.status, 200, list);
    assert.deepEqual(response.body.data, [], `${list} is empty`);
  }
});

test('the demonstration records are only created when asked for', async () => {
  const result = await seedDatabase({ reset: true, log: () => {}, sampleFiles: true, demoRecruitment: true });
  credentials = result.credentials;
  assert.deepEqual(pick(result.counts, RECRUITMENT_COLLECTIONS), { Job: 10, Candidate: 8, Application: 10, Requirement: 5, Referral: 3, Enquiry: 5, ATSResult: 10 });
  assert.deepEqual(pick(result.counts, Object.keys(CONTENT)), CONTENT);
  assert.equal(memoryFiles.size, 8, 'one sample resume per sample candidate');
});

test('reserved example addresses are recognised, real ones are not', () => {
  for (const address of ['a@example.com', 'A@EXAMPLE.ORG', 'x@mail.example.net', 'dev@something.test', 'me@host.invalid', 'q@localhost', 'p@site.example']) {
    assert.equal(isReservedAddress(address), true, address);
  }
  for (const address of ['a@gmail.com', 'hr@examplecorp.com', 'x@example.co.in', 'y@myexample.com', 'z@contest.org', '', null, 'no-at-sign']) {
    assert.equal(isReservedAddress(address), false, String(address));
  }
});

let real;
test('a dry run reads, decides and changes nothing', async () => {
  const { Job, Candidate, Application, AuditLog } = ctx.models;
  const admin = await signedInAs('SUPER_ADMIN');
  const recruiter = await signedInAs('RECRUITER');
  const seededJobs = await Job.find({ status: 'published' }).sort({ slug: 1 });

  // Records that are not demonstration data: someone with an address
  // of their own applies to a seeded job with a resume and sends a
  // requirement with an attachment, and the admin adds a job.
  const applied = await client().post('/api/applications', { form: multipart(applicationFields({ name: 'Real Person', email: 'real.person@engineer-mail.co', jobId: String(seededJobs[0]._id) }), { field: 'resume', name: 'real.pdf', buffer: pdfBytes(), type: 'application/pdf' }) });
  assert.equal(applied.status, 201);
  const requirement = await client().post('/api/requirements', { form: multipart({ contactName: 'Real Lead', company: 'Real Company', email: 'lead@real-company.co', role: 'Verification engineers', positions: '2', hiringType: 'Permanent Staffing', workMode: 'HYBRID', location: 'Bengaluru', description: 'Two engineers.', consent: 'true' }, { field: 'attachment', name: 'jd.pdf', buffer: pdfBytes(), type: 'application/pdf' }) });
  assert.equal(requirement.status, 201);
  const ownJob = await admin.post('/api/admin/jobs', { json: { title: 'A job the admin added', category: 'Semiconductor', location: 'Bangalore, IN', employmentType: 'Full-time', experienceLevel: 'Mid-Senior', summary: 'Added by hand.', description: 'Added by hand.', requiredSkills: ['UVM'] } });
  assert.equal(ownJob.status, 201);

  // Records typed in while trying the forms, with example addresses.
  const tried = await client().post('/api/applications', { form: multipart(applicationFields({ name: 'Form Tester', email: 'form.tester@example.org', jobId: String(seededJobs[1]._id) }), { field: 'resume', name: 'tester.pdf', buffer: pdfBytes(), type: 'application/pdf' }) });
  assert.equal(tried.status, 201);
  assert.equal((await client().post('/api/enquiries', { json: { name: 'Tester', email: 'tester@example.net', message: 'Trying the form.' } })).status, 201);
  await wait(200);

  // Activity about a demo candidate and about the real one, in the audit log.
  const demoCandidate = await Candidate.findOne({ email: /@example\.com$/ });
  const realCandidate = await Candidate.findOne({ email: 'real.person@engineer-mail.co' });
  assert.equal((await recruiter.get(`/api/admin/candidates/${demoCandidate._id}/resume-url`)).status, 200);
  assert.equal((await recruiter.get(`/api/admin/candidates/${realCandidate._id}/resume-url`)).status, 200);
  // A file that no record points at (left by an earlier seed run, say).
  memoryFiles.set('resumes/2025/01/left-behind.pdf', { buffer: pdfBytes(), mimeType: 'application/pdf' });

  real = { candidate: realCandidate, job: seededJobs[0], ownJobId: ownJob.body.data.id, admin, recruiter };
  const before = await countCollections();
  const files = memoryFiles.size;
  const snapshot = await preservedSnapshot();

  const plan = await planShowcaseCleanup();
  assert.equal(plan.all, false);
  // candidates: the eight samples and the form tester go, the real one stays
  assert.equal(removedIn(plan, 'Candidate'), 9);
  assert.deepEqual(plan.collections.Candidate.keep.map((item) => item.label), ['Real Person <real.person@engineer-mail.co>']);
  assert.ok(plan.collections.Candidate.remove.some((item) => item.label.includes('form.tester@example.org') && /reserved for examples/.test(item.reason)));
  assert.ok(plan.collections.Candidate.remove.filter((item) => item.reason === 'created by the development seed').length === 8);
  // applications follow their candidate
  assert.equal(removedIn(plan, 'Application'), 11);
  assert.equal(keptIn(plan, 'Application'), 1);
  // jobs: nine seeded jobs go; the one the real person applied to and the admin's own job stay
  assert.equal(removedIn(plan, 'Job'), 9);
  assert.equal(keptIn(plan, 'Job'), 2);
  assert.ok(plan.collections.Job.keep.some((item) => item.id === String(real.job._id) && /kept because 1 application from a kept candidate points at it/.test(item.reason)));
  assert.ok(plan.collections.Job.keep.some((item) => item.id === real.ownJobId && item.reason === 'not recognised as demonstration data'));
  // the rest
  assert.deepEqual([removedIn(plan, 'Requirement'), keptIn(plan, 'Requirement')], [5, 1]);
  assert.deepEqual([removedIn(plan, 'Enquiry'), keptIn(plan, 'Enquiry')], [6, 0]);
  assert.deepEqual([removedIn(plan, 'Referral'), keptIn(plan, 'Referral')], [3, 0]);
  assert.equal(removedIn(plan, 'ATSResult') + keptIn(plan, 'ATSResult'), before.ATSResult);
  assert.ok(plan.collections.ATSResult.keep.every((item) => item.label.includes('real.person@engineer-mail.co')));
  // files: one per removed candidate (an application points at the same file as its candidate)
  assert.equal(plan.files.remove.length, 9);
  assert.equal(plan.files.keptWithRecords, 3, 'the real candidate, their application and the real requirement');
  assert.ok(plan.audit.remove.length >= 1);

  // Nothing was changed by looking.
  assert.deepEqual(await countCollections(), before);
  assert.equal(memoryFiles.size, files);
  assert.deepEqual(await preservedSnapshot(), snapshot);
  assert.equal(await AuditLog.countDocuments({ action: 'system.showcase_cleanup' }), 0);
  assert.equal(await Application.countDocuments({}), 12);
});

test('applying it removes the demonstration records, their files and their audit entries, and nothing else', async () => {
  const { AuditLog, Candidate, Requirement } = ctx.models;
  const snapshot = await preservedSnapshot();
  const before = await countCollections();
  const demoCandidateIds = (await Candidate.find({ email: /@example\.(com|org)$/ })).map((doc) => String(doc._id));
  const realRequirement = await Requirement.findOne({ email: 'lead@real-company.co' });
  const signIns = await AuditLog.countDocuments({ action: 'auth.login' });
  assert.ok(await AuditLog.countDocuments({ entityType: 'candidate', entityId: { $in: demoCandidateIds } }) >= 1);

  const plan = await planShowcaseCleanup();
  const done = await applyShowcaseCleanup(plan, { actorName: 'Test' });
  assert.deepEqual(done.records, { Job: 9, Candidate: 9, Application: 11, Requirement: 5, Referral: 3, Enquiry: 6, ATSResult: removedIn(plan, 'ATSResult') });
  assert.equal(done.filesRemoved, 9);
  assert.deepEqual([done.filesFailed, done.filesUnreachable], [[], 0]);

  const counts = await countCollections();
  assert.deepEqual(pick(counts, RECRUITMENT_COLLECTIONS), { Job: 2, Candidate: 1, Application: 1, Requirement: 1, Referral: 0, Enquiry: 0, ATSResult: keptIn(plan, 'ATSResult') });
  assert.deepEqual(pick(counts, PRESERVED_COLLECTIONS), pick(before, PRESERVED_COLLECTIONS));
  assert.deepEqual(await preservedSnapshot(), snapshot, 'users and website content are exactly as they were');

  // Files: the real resume and the real attachment are still stored
  // and still open; the left-behind file is reported, not removed.
  assert.ok(memoryFiles.has(real.candidate.resume.key));
  assert.ok(memoryFiles.has(realRequirement.attachment.key));
  assert.equal(memoryFiles.size, 3);
  assert.equal((await real.recruiter.get(`/api/admin/candidates/${real.candidate._id}/resume-url`)).status, 200);
  const files = await inspectStoredFiles();
  assert.deepEqual({ stored: files.stored, referenced: files.referenced, unreachable: files.unreachable }, { stored: 3, referenced: 2, unreachable: 0 });
  assert.deepEqual(files.unreferenced, [{ storage: 'memory', key: 'resumes/2025/01/left-behind.pdf' }]);

  // Audit: nothing about a removed record is left; the real
  // candidate's entry, the sign-ins and the cleanup's own entry are.
  assert.equal(await AuditLog.countDocuments({ entityType: 'candidate', entityId: { $in: demoCandidateIds } }), 0);
  assert.ok(await AuditLog.countDocuments({ entityType: 'candidate', entityId: String(real.candidate._id) }) >= 1);
  assert.equal(await AuditLog.countDocuments({ action: 'auth.login' }), signIns);
  const entry = await AuditLog.findOne({ action: 'system.showcase_cleanup' });
  assert.equal(entry.actorName, 'Test');
  assert.deepEqual(entry.metadata.records, done.records);
  assert.ok(!JSON.stringify(entry.toObject()).includes('@'), 'the entry names nobody');

  // A file held by the provider used before B2 cannot be removed from
  // here: its record goes, and the file is reported, not counted as removed.
  await Candidate.create({ name: 'Old Store', email: 'old.store@example.com', phone: '+91 90000 00001', location: 'Pune', headline: 'Engineer', skills: ['UVM'], consentAt: new Date(), resume: { key: 'resumes/2026/01/old-store.pdf', originalName: 'old.pdf', mimeType: 'application/pdf', size: 10, storage: 'r2' } });
  const oldStore = await applyShowcaseCleanup(await planShowcaseCleanup());
  assert.deepEqual([oldStore.records.Candidate, oldStore.filesRemoved, oldStore.filesUnreachable], [1, 0, 1]);

  // Running it again finds nothing more to do.
  const again = await planShowcaseCleanup();
  assert.equal(RECRUITMENT_COLLECTIONS.reduce((sum, name) => sum + removedIn(again, name), 0), 0);
  assert.deepEqual(again.files.remove, []);

  // The left-behind file is removed only when that is asked for.
  assert.deepEqual(await removeUnreferencedFiles(files.unreferenced), { removed: 1, failed: [] });
  assert.equal(memoryFiles.size, 2);
});

test('with "all", every recruitment record and file goes and the showcase state is reached', async () => {
  const { AuditLog } = ctx.models;
  const snapshot = await preservedSnapshot();
  const plan = await planShowcaseCleanup({ all: true });
  assert.equal(plan.all, true);
  assert.equal(RECRUITMENT_COLLECTIONS.reduce((sum, name) => sum + keptIn(plan, name), 0), 0);
  assert.equal(plan.files.remove.length, 2);
  const done = await applyShowcaseCleanup(plan);
  assert.equal(done.filesRemoved, 2);

  const counts = await countCollections();
  assert.deepEqual(pick(counts, RECRUITMENT_COLLECTIONS), EMPTY);
  assert.deepEqual(pick(counts, Object.keys(CONTENT)), CONTENT);
  assert.deepEqual(await preservedSnapshot(), snapshot);
  assert.equal(memoryFiles.size, 0, 'no resume or attachment is left in the store');
  assert.deepEqual(await inspectStoredFiles(), { stored: 0, referenced: 0, unreferenced: [], unreachable: 0 });
  assert.equal(await AuditLog.countDocuments({ entityType: { $in: ['job', 'candidate', 'application', 'requirement', 'referral', 'enquiry', 'atsResult'] } }), 0);

  // The site and the admin work on the empty state.
  const get = async (path) => (await client().get(path)).body.data;
  assert.deepEqual(await get('/api/public/jobs'), []);
  assert.equal((await get('/api/public/insights')).length, 13);
  assert.equal((await get('/api/public/stories')).length, 3);
  assert.equal((await get('/api/public/locations')).length, 3);
  const admin = client();
  assert.equal((await admin.login(credentials[0].email, credentials[0].password)).status, 200, 'the seeded administrator still signs in');
  for (const list of ['jobs', 'candidates', 'applications', 'requirements', 'referrals', 'enquiries', 'ats-results']) {
    const response = await admin.get(`/api/admin/${list}`);
    assert.deepEqual([response.status, response.body.data], [200, []], list);
  }
  assert.equal((await admin.get('/api/admin/ats/engine')).status, 200);

  // And the recruitment features still work afterwards: a job can be
  // added and published, and an application to it is accepted.
  const job = await admin.post('/api/admin/jobs', { json: { title: 'First real job', category: 'Semiconductor', location: 'Bangalore, IN', employmentType: 'Full-time', experienceLevel: 'Mid-Senior', summary: 'A real vacancy.', description: 'A real vacancy.', requiredSkills: ['UVM'], status: 'published' } });
  assert.equal(job.status, 201);
  assert.equal((await get('/api/public/jobs')).length, 1);
  const applied = await client().post('/api/applications', { form: multipart(applicationFields({ email: 'first.applicant@engineer-mail.co', jobId: job.body.data.id }), { field: 'resume', name: 'cv.pdf', buffer: pdfBytes(), type: 'application/pdf' }) });
  assert.equal(applied.status, 201);
  assert.equal((await admin.get('/api/admin/candidates')).body.data.length, 1);
});
