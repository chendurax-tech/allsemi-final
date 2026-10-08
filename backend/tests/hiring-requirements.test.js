import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import {
  startServer, stopServer, client, signedIn, multipart, applicationFields, pdfBytes, wait,
} from './helpers.js';

/*
  Deleting a hiring requirement (a hiring request a company sent
  through Hire Talent, or one entered in the admin).

  No other record refers to a hiring requirement, so nothing blocks the
  delete. It removes the requirement, its attachment and its own email
  history, and nothing else: jobs, candidates, applications, ATS
  results, referrals, enquiries and the email history of other records
  are untouched. Only a role with requirements:delete may do it.
*/

let ctx;
let admin;
let recruiter;
let manager;

before(async () => {
  ctx = await startServer();
  admin = await signedIn('SUPER_ADMIN');
  recruiter = await signedIn('RECRUITER');
  manager = await signedIn('HIRING_MANAGER');
});
after(async () => { await stopServer(); });

const settle = () => wait(200);

async function hireTalent(email, role) {
  const response = await client().post('/api/requirements', {
    form: multipart({ contactName: 'RAM', company: 'ABC Technologies', email, role, positions: '20', hiringType: 'Permanent Staffing', consent: 'true' }),
  });
  assert.equal(response.status, 201);
  await settle();
  return ctx.models.Requirement.findOne({ email });
}

async function counts() {
  const { Job, Candidate, Application, ATSResult, Referral, Enquiry } = ctx.models;
  const entries = await Promise.all([Job, Candidate, Application, ATSResult, Referral, Enquiry].map((Model) => Model.countDocuments()));
  return Object.fromEntries(['jobs', 'candidates', 'applications', 'atsResults', 'referrals', 'enquiries'].map((name, i) => [name, entries[i]]));
}

test('a hiring requirement is deleted with its own email history; no other record is touched', async () => {
  const job = await ctx.models.Job.create({
    title: 'MERN Full Stack Developer', slug: 'hiring-req-job', status: 'published', category: 'Software', location: 'Chennai, India',
    experienceLevel: 'Mid-Level', requiredSkills: ['React', 'Node.js'], description: 'Build the platform.',
  });
  const applied = await client().post('/api/applications', {
    form: multipart(applicationFields({ email: 'hiring.req.candidate@example.com', jobId: String(job._id) }), { field: 'resume', name: 'resume.pdf', buffer: pdfBytes(), type: 'application/pdf' }),
  });
  assert.equal(applied.status, 201);
  await settle();

  const doomed = await hireTalent('ram@abc.example.com', 'MERN Full Stack Developer');
  const kept = await hireTalent('other@xyz.example.com', 'Verification engineers');
  const emailsOf = (id) => ctx.models.EmailLog.countDocuments({ entityType: 'requirement', entityId: String(id) });
  assert.ok(await emailsOf(doomed._id) > 0, 'the submission recorded its emails');
  const keptEmails = await emailsOf(kept._id);
  const otherEmails = await ctx.models.EmailLog.countDocuments({ entityType: { $ne: 'requirement' } });
  const before = await counts();

  const response = await admin.delete(`/api/admin/requirements/${doomed._id}`);
  assert.equal(response.status, 200);
  assert.deepEqual(response.body.data, { id: String(doomed._id), deleted: true });

  assert.equal(await ctx.models.Requirement.findById(doomed._id), null);
  assert.equal(await emailsOf(doomed._id), 0, 'its email history is removed with it');
  assert.ok(await ctx.models.Requirement.findById(kept._id), 'the other requirement stays');
  assert.equal(await emailsOf(kept._id), keptEmails, 'the other requirement keeps its email history');
  assert.equal(await ctx.models.EmailLog.countDocuments({ entityType: { $ne: 'requirement' } }), otherEmails, 'other email history is untouched');
  assert.deepEqual(await counts(), before, 'jobs, candidates, applications, ATS results, referrals and enquiries are untouched');

  const list = await admin.get('/api/admin/requirements');
  assert.ok(!list.body.data.some((item) => item.id === String(doomed._id)), 'it is no longer listed');
  const logged = await admin.get(`/api/admin/audit-logs?entityType=requirement&entityId=${doomed._id}&action=requirement.deleted`);
  assert.equal(logged.body.data.length, 1, 'the delete is audited');
});

test('only a role with requirements:delete can delete a hiring requirement', async () => {
  const requirement = await hireTalent('guarded@abc.example.com', 'Firmware engineers');
  for (const agent of [recruiter, manager]) {
    assert.equal((await agent.delete(`/api/admin/requirements/${requirement._id}`)).status, 403);
  }
  assert.equal((await client().delete(`/api/admin/requirements/${requirement._id}`)).status, 401);
  assert.ok(await ctx.models.Requirement.findById(requirement._id), 'a refused delete leaves it in place');
});

test('deleting an unknown or already deleted hiring requirement is a clear not-found', async () => {
  const requirement = await hireTalent('twice@abc.example.com', 'Layout engineers');
  assert.equal((await admin.delete(`/api/admin/requirements/${requirement._id}`)).status, 200);
  const again = await admin.delete(`/api/admin/requirements/${requirement._id}`);
  assert.equal(again.status, 404);
  assert.match(again.body.error?.message || JSON.stringify(again.body), /not found/i);
  assert.equal((await admin.delete('/api/admin/requirements/0123456789abcdef01234567')).status, 404);
});
