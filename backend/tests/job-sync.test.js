import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {
  startServer, stopServer, client, signedIn, multipart, applicationFields, pdfBytes,
} from './helpers.js';

/*
  Job synchronisation from the official job source
  (services/jobSync/). The "company website" here is a local HTTP server
  the tests control: it serves a JSON feed and schema.org JobPosting
  pages, and can fail on demand. Nothing outside this machine is read.
*/

let ctx;
let env;
let sync;
let recruiter;
let content;
let feedServer;
let base;
const site = { feed: [], status: 200, body: null, pages: {}, listing: '' };

before(async () => {
  ctx = await startServer();
  ({ env } = await import('../src/config/env.js'));
  sync = await import('../src/services/jobSync/syncService.js');
  recruiter = await signedIn('RECRUITER');
  content = await signedIn('CONTENT_MANAGER');
  feedServer = http.createServer((req, res) => {
    if (req.url === '/api/jobs') {
      res.writeHead(site.status, { 'Content-Type': 'application/json' });
      res.end(site.body ?? JSON.stringify({ jobs: site.feed }));
      return;
    }
    if (req.url === '/careers') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(site.listing);
      return;
    }
    if (site.pages[req.url]) {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(site.pages[req.url]);
      return;
    }
    res.writeHead(404);
    res.end();
  });
  await new Promise((resolve) => feedServer.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${feedServer.address().port}`;
});
after(async () => {
  await new Promise((resolve) => feedServer.close(resolve));
  await stopServer();
});

const SOURCE = () => ({ key: 'acme-site', name: 'ACME Careers', type: 'json-feed', url: `${base}/api/jobs`, linkPattern: '' });
const run = (overrides = {}) => sync.runSync({ trigger: 'test', source: { ...SOURCE(), ...overrides } });
const imported = () => ctx.models.Job.find({ source: 'acme-site' }).sort({ sourceJobId: 1 });

function sourceJob(id, overrides = {}) {
  return {
    id,
    title: `Verification Engineer ${id}`,
    description: `<p>Own the UVM testbench for block ${id}.</p><ul><li>Write SystemVerilog assertions</li><li>Close coverage</li></ul>`,
    location: 'Bangalore, IN',
    employmentType: 'FULL_TIME',
    experience: { minYears: 4 },
    requiredSkills: ['SystemVerilog', 'UVM'],
    responsibilities: ['Write the verification plan'],
    status: 'open',
    url: `https://careers.acme.example/jobs/${id}`,
    updatedAt: '2026-10-01T10:00:00Z',
    ...overrides,
  };
}

beforeEach(async () => {
  site.feed = [];
  site.status = 200;
  site.body = null;
  await ctx.models.Job.deleteMany({ source: 'acme-site' });
  await ctx.models.JobSyncRun.deleteMany({});
});

// ---------------------------------------------------------------- B2, B6

test('sync: new jobs are imported once, with their source identity, and a repeat changes nothing', async () => {
  site.feed = ['A1', 'A2', 'A3', 'A4', 'A5'].map((id) => sourceJob(id));
  const first = await run();
  assert.equal(first.status, 'SUCCEEDED');
  assert.deepEqual(JSON.parse(JSON.stringify(first.counts)), { discovered: 5, created: 5, updated: 0, unchanged: 0, closed: 0, reopened: 0, missing: 0, invalid: 0 });
  let jobs = await imported();
  assert.equal(jobs.length, 5);
  const a1 = jobs[0];
  assert.equal(a1.sourceJobId, 'A1');
  assert.equal(a1.source, 'acme-site');
  assert.equal(a1.sourceUrl, 'https://careers.acme.example/jobs/A1', 'the official address is kept');
  assert.equal(a1.status, 'published', 'published by default (JOB_SYNC_NEW_STATUS)');
  assert.ok(a1.publishedAt && a1.lastSyncedAt);
  assert.equal(a1.syncStatus, 'ACTIVE');
  assert.equal(a1.slug, 'verification-engineer-a1');
  assert.equal(a1.employmentType, 'Full-time');
  assert.equal(a1.experienceLevel, 'Mid-Senior', '4 years');
  assert.match(a1.description, /Own the UVM testbench for block A1\.\n/, 'HTML becomes text');
  assert.ok(!/[<>]/.test(a1.description));
  assert.deepEqual(a1.requiredSkills, ['SystemVerilog', 'UVM']);

  const second = await run();
  assert.deepEqual(JSON.parse(JSON.stringify(second.counts)), { discovered: 5, created: 0, updated: 0, unchanged: 5, closed: 0, reopened: 0, missing: 0, invalid: 0 });
  jobs = await imported();
  assert.equal(jobs.length, 5, 'still 5 jobs: no duplicate');

  site.feed.push(sourceJob('A6'));
  const third = await run();
  assert.equal(third.counts.created, 1);
  assert.equal((await imported()).length, 6);
});

// -------------------------------------------------------------------- B3

test('sync: a changed posting updates the same job, keeps its slug and its applications', async () => {
  site.feed = [sourceJob('U1')];
  await run();
  const job = (await imported())[0];
  // Someone applies to it through the existing application flow.
  const applied = await client().post('/api/applications', { form: multipart(applicationFields({ email: 'sync.applicant@example.com', jobId: String(job._id) }), { field: 'resume', name: 'cv.pdf', buffer: pdfBytes(), type: 'application/pdf' }) });
  assert.equal(applied.status, 201, 'the imported job takes applications through the existing form');
  site.feed = [sourceJob('U1', { title: 'Senior Verification Engineer U1', requiredSkills: ['SystemVerilog', 'UVM', 'Formal Verification'], updatedAt: '2026-10-05T10:00:00Z' })];
  const result = await run();
  assert.equal(result.counts.updated, 1);
  const jobs = await imported();
  assert.equal(jobs.length, 1);
  assert.equal(String(jobs[0]._id), String(job._id), 'the same record');
  assert.equal(jobs[0].title, 'Senior Verification Engineer U1');
  assert.equal(jobs[0].slug, job.slug, 'the public address does not move');
  assert.deepEqual(jobs[0].requiredSkills, ['SystemVerilog', 'UVM', 'Formal Verification']);
  assert.notEqual(jobs[0].sourceFingerprint, job.sourceFingerprint);
  assert.equal(jobs[0].sourceUpdatedAt.toISOString(), '2026-10-05T10:00:00.000Z');
  assert.equal(await ctx.models.Application.countDocuments({ jobId: job._id }), 1);
});

// -------------------------------------------------------------------- B4

test('sync: a job closed at the source is archived, and reopened when the source reopens it', async () => {
  site.feed = [sourceJob('C1'), sourceJob('C2')];
  await run();
  site.feed = [sourceJob('C1', { status: 'closed' }), sourceJob('C2')];
  const closed = await run();
  assert.equal(closed.counts.closed, 1);
  let c1 = await ctx.models.Job.findOne({ sourceJobId: 'C1' });
  assert.deepEqual([c1.status, c1.syncStatus, c1.closedBySync], ['archived', 'CLOSED', true]);
  // Not on the public site, not in the assistant.
  assert.equal((await client().get(`/api/public/jobs/${c1.slug}`)).status, 404);
  site.feed = [sourceJob('C1'), sourceJob('C2')];
  const reopened = await run();
  assert.equal(reopened.counts.reopened, 1);
  c1 = await ctx.models.Job.findOne({ sourceJobId: 'C1' });
  assert.deepEqual([c1.status, c1.syncStatus], ['published', 'ACTIVE']);

  // A job staff archived themselves is never reopened by the sync.
  await ctx.models.Job.updateOne({ sourceJobId: 'C2' }, { $set: { status: 'archived' } });
  await run();
  assert.equal((await ctx.models.Job.findOne({ sourceJobId: 'C2' })).status, 'archived');

  // A posting past its validThrough date is closed.
  site.feed = [sourceJob('C1', { validThrough: '2020-01-01' }), sourceJob('C2')];
  await run();
  assert.equal((await ctx.models.Job.findOne({ sourceJobId: 'C1' })).status, 'archived');
  // A closed posting that was never imported is not imported.
  site.feed.push(sourceJob('C3', { status: 'filled' }));
  await run();
  assert.equal(await ctx.models.Job.countDocuments({ sourceJobId: 'C3' }), 0);
});

test('sync: a job missing from the source is closed only after repeated complete misses', async () => {
  site.feed = ['M1', 'M2', 'M3', 'M4', 'M5', 'M6'].map((id) => sourceJob(id));
  await run();
  site.feed = site.feed.filter((job) => job.id !== 'M1');
  const once = await run();
  assert.equal(once.counts.missing, 1);
  let m1 = await ctx.models.Job.findOne({ sourceJobId: 'M1' });
  assert.deepEqual([m1.status, m1.syncStatus, m1.missingCount], ['published', 'MISSING', 1], 'first miss: recorded, still open');
  const twice = await run();
  assert.equal(twice.counts.closed, 1);
  m1 = await ctx.models.Job.findOne({ sourceJobId: 'M1' });
  assert.deepEqual([m1.status, m1.syncStatus, m1.missingCount], ['archived', 'CLOSED', 2], 'second miss in a row: closed');
  assert.ok(await ctx.models.Job.exists({ sourceJobId: 'M1' }), 'never deleted');

  // Coming back before the threshold resets the count.
  site.feed = site.feed.filter((job) => job.id !== 'M2');
  await run();
  site.feed.push(sourceJob('M2'));
  await run();
  const m2 = await ctx.models.Job.findOne({ sourceJobId: 'M2' });
  assert.deepEqual([m2.status, m2.syncStatus, m2.missingCount], ['published', 'ACTIVE', 0]);

  // An empty or cut-off listing counts nobody missing.
  site.feed = [];
  const empty = await run();
  assert.equal(empty.counts.missing, 0);
  assert.match(empty.notes[0], /too many at once/);
  site.feed = [sourceJob('M2')];
  const cut = await run();
  assert.equal(cut.counts.missing + cut.counts.closed, 0);
  assert.equal(await ctx.models.Job.countDocuments({ source: 'acme-site', status: 'published' }), 5);
});

// -------------------------------------------------------------------- B8

test('sync: an unreachable or broken source changes nothing and is recorded', async () => {
  site.feed = [sourceJob('F1'), sourceJob('F2')];
  await run();
  const before = JSON.stringify(await imported());
  for (const setup of [
    () => { site.status = 500; },
    () => { site.status = 200; site.body = '<html>maintenance</html>'; },
    () => { site.status = 200; site.body = '{"items": 3}'; },
  ]) {
    setup();
    const result = await run();
    assert.equal(result.status, 'FAILED');
    assert.ok(result.failure);
  }
  site.status = 200;
  site.body = null;
  const down = await run({ url: 'http://127.0.0.1:1/api/jobs' });
  assert.equal(down.status, 'FAILED');
  assert.equal(down.failure, 'The source could not be reached.');
  const after = JSON.stringify(await imported());
  assert.equal(after.replace(/"lastSyncedAt":"[^"]+"/g, ''), before.replace(/"lastSyncedAt":"[^"]+"/g, ''), 'no job changed, none closed');
  assert.equal(await ctx.models.JobSyncRun.countDocuments({ status: 'FAILED' }), 4);
  // The next run retries normally.
  assert.equal((await run()).status, 'SUCCEEDED');
});

// -------------------------------------------------------------------- B9

test('sync: malformed records are rejected one by one; the valid ones still sync', async () => {
  site.feed = [
    sourceJob('V1'),
    { title: 'No id', description: 'A job without any identity at all, which cannot be synced.' },
    sourceJob('V2', { title: '' }),
    sourceJob('V3', { description: 'Too short' }),
    sourceJob('V4', { status: 'maybe-later' }),
    sourceJob('V5', { url: 'javascript:alert(1)' }),
    sourceJob('bad id with spaces'),
    sourceJob('V1', { title: 'Duplicate of V1' }),
    sourceJob('V6', { employmentType: 'mystery', experience: undefined }),
  ];
  const result = await run();
  assert.equal(result.status, 'PARTIAL');
  assert.equal(result.counts.created, 2);
  assert.equal(result.counts.invalid, 7);
  assert.deepEqual((await imported()).map((job) => job.sourceJobId), ['V1', 'V6']);
  assert.equal((await ctx.models.Job.findOne({ sourceJobId: 'V1' })).title, 'Verification Engineer V1', 'the duplicate did not overwrite the first');
  const v6 = await ctx.models.Job.findOne({ sourceJobId: 'V6' });
  assert.deepEqual([v6.employmentType, v6.experienceLevel], ['', ''], 'not stated by the source: left empty, not invented');
  assert.ok(result.errors.some((error) => /no title/.test(error.message)));
  assert.ok(result.errors.some((error) => /not an http/.test(error.message)));

  // An update that would make a job invalid leaves the job as it was.
  site.feed = [sourceJob('V1', { description: '' }), sourceJob('V6')];
  await run();
  assert.equal((await ctx.models.Job.findOne({ sourceJobId: 'V1' })).description.includes('UVM testbench'), true);
});

// ------------------------------------------------------------ concurrency

test('sync: two runs at the same moment do not duplicate jobs', async () => {
  site.feed = ['P1', 'P2', 'P3'].map((id) => sourceJob(id));
  const results = await Promise.all([run(), run(), run()]);
  assert.ok(results.some((result) => result.skipped), 'a run already in progress is refused');
  assert.equal((await imported()).length, 3);
  // Even without the lock, the identity is unique in the database.
  await assert.rejects(ctx.models.Job.create({ title: 'Twin', slug: 'twin-p1', source: 'acme-site', sourceJobId: 'P1' }), { code: 11000 });
});

// --------------------------------------------------- JobPosting pages (B1)

test('sync: official job pages with schema.org JobPosting data', async () => {
  const posting = (id, extra = {}) => `<html><head><script type="application/ld+json">${JSON.stringify({
    '@context': 'https://schema.org', '@type': 'JobPosting', identifier: { '@type': 'PropertyValue', value: id }, title: `Senior UVM Verification Engineer ${id}`,
    description: '<p>Lead UVM-based verification of PCIe subsystems.</p>', employmentType: 'FULL_TIME', datePosted: '2026-09-30',
    jobLocation: { '@type': 'Place', address: { addressLocality: 'Bengaluru', addressCountry: 'IN' } }, experienceRequirements: { monthsOfExperience: 84 }, skills: 'UVM, SystemVerilog, PCIe', ...extra,
  })}</script></head><body>Job ${id}</body></html>`;
  site.listing = '<a href="/careers/jobs/J1">J1</a><a href="/careers/jobs/J2">J2</a><a href="https://elsewhere.example/careers/jobs/X">X</a><a href="/about">About</a>';
  site.pages = { '/careers/jobs/J1': posting('J1'), '/careers/jobs/J2': posting('J2') };
  const result = await run({ type: 'jsonld-pages', url: `${base}/careers`, linkPattern: '/careers/jobs/' });
  assert.equal(result.status, 'SUCCEEDED', JSON.stringify(result.errors));
  const jobs = await imported();
  assert.deepEqual(jobs.map((job) => job.sourceJobId), ['J1', 'J2']);
  assert.equal(jobs[0].location, 'Bengaluru, IN');
  assert.equal(jobs[0].experienceLevel, 'Senior', '84 months');
  assert.deepEqual(jobs[0].requiredSkills, ['UVM', 'SystemVerilog', 'PCIe']);
  assert.equal(jobs[0].sourceUrl, `${base}/careers/jobs/J1`);
  // A page that cannot be read makes the listing incomplete: nobody is
  // counted missing.
  delete site.pages['/careers/jobs/J2'];
  const partial = await run({ type: 'jsonld-pages', url: `${base}/careers`, linkPattern: '/careers/jobs/' });
  assert.equal(partial.counts.missing, 0);
  assert.ok(partial.notes.some((note) => /could not be read completely/.test(note)));
});

// -------------------------------------------------- the website, assistant

test('sync: a new imported job is on the public site, in the assistant, and takes applications', async () => {
  site.feed = [sourceJob('W1', { title: 'Senior UVM Verification Engineer', description: 'Lead UVM verification for a networking SoC at the company.', requiredSkills: ['UVM', 'SystemVerilog'] })];
  await run();
  const job = (await imported())[0];
  const listed = await client().get('/api/public/jobs');
  assert.ok(listed.body.data.some((item) => item.slug === job.slug));
  const page = await client().get(`/api/public/jobs/${job.slug}`);
  assert.equal(page.status, 200);
  assert.ok(!('sourceJobId' in page.body.data) && !('sourceFingerprint' in page.body.data), 'the public API keeps its own field list');

  const asked = await client().post('/api/public/chat', { json: { message: 'Is there a Senior UVM Verification Engineer opening?' } });
  assert.ok(asked.body.data.jobs.some((card) => card.id === String(job._id)), 'the assistant finds the new job');
  const follow = await client().post('/api/public/chat', { json: { message: 'How do I apply?', context: asked.body.data.context } });
  assert.ok(follow.body.data.actions.some((action) => action.href === `/talent/jobs/${job.slug}?apply=1`));

  // Closed at the source: gone from the site and the assistant.
  site.feed = [sourceJob('W1', { title: 'Senior UVM Verification Engineer', description: 'Lead UVM verification for a networking SoC at the company.', status: 'closed' })];
  await run();
  assert.ok(!(await client().get('/api/public/jobs')).body.data.some((item) => item.slug === job.slug));
  const gone = await client().post('/api/public/chat', { json: { message: 'Is there a Senior UVM Verification Engineer opening?' } });
  assert.ok(!gone.body.data.jobs.some((card) => card.id === String(job._id)));
});

// ---------------------------------------------------------------- admin

test('admin: the official fields of an imported job cannot be edited; ALLSEMIS fields can', async () => {
  site.feed = [sourceJob('E1')];
  await run();
  const job = (await imported())[0];
  const edit = await recruiter.patch(`/api/admin/jobs/${job._id}`, { json: { title: 'Renamed by staff' } });
  assert.equal(edit.status, 409);
  assert.match(edit.body.error.message, /source of truth/);
  const allowed = await recruiter.patch(`/api/admin/jobs/${job._id}`, { json: { featured: true, keywords: ['networking'] } });
  assert.equal(allowed.status, 200);
  assert.equal(allowed.body.data.title, 'Verification Engineer E1');
  assert.equal(allowed.body.data.sourceUrl, 'https://careers.acme.example/jobs/E1', 'staff see the source');
  // Manual jobs are edited as before.
  const manual = await recruiter.post('/api/admin/jobs', { json: { title: 'Manual role' } });
  assert.equal((await recruiter.patch(`/api/admin/jobs/${manual.body.data.id}`, { json: { title: 'Manual role renamed' } })).status, 200);
});

test('admin: sync status, history and a run on demand; the trigger endpoint needs its token', async () => {
  const saved = { ...env.jobSync };
  Object.assign(env.jobSync, { sourceUrl: `${base}/api/jobs`, sourceType: 'json-feed', sourceKey: 'acme-site', sourceName: 'ACME Careers', token: '' });
  try {
    site.feed = [sourceJob('S1')];
    const runNow = await recruiter.post('/api/admin/job-sync/run');
    assert.equal(runNow.status, 200);
    assert.equal(runNow.body.data.counts.created, 1);
    const status = await recruiter.get('/api/admin/job-sync');
    assert.equal(status.body.data.source.name, 'ACME Careers');
    assert.equal(status.body.data.runs[0].status, 'SUCCEEDED');
    assert.equal((await content.post('/api/admin/job-sync/run')).status, 403);
    assert.equal((await client().get('/api/admin/job-sync')).status, 401);

    // The external trigger: off without a token, then only with it.
    assert.equal((await client().post('/api/internal/job-sync', { origin: null, xhr: false })).status, 404);
    env.jobSync.token = 'x'.repeat(40);
    assert.equal((await client().post('/api/internal/job-sync', { origin: null, xhr: false, headers: { Authorization: 'Bearer wrong' } })).status, 401);
    const triggered = await client().post('/api/internal/job-sync', { origin: null, xhr: false, headers: { Authorization: `Bearer ${'x'.repeat(40)}` } });
    assert.equal(triggered.status, 200);
    assert.equal(triggered.body.data.counts.unchanged, 1);
    assert.ok(!JSON.stringify(triggered.body).includes('Verification Engineer S1'), 'counts only');
    const logs = await ctx.models.AuditLog.find({ action: 'jobs.synced' }).lean();
    assert.ok(logs.length >= 2);
    assert.ok(!JSON.stringify(logs).includes(env.jobSync.token));
  } finally {
    Object.assign(env.jobSync, saved);
  }
});
