import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import {
  startServer, stopServer, client, signedIn, multipart, applicationFields, docBytes, docxWithText, wait,
} from './helpers.js';
import { samplePdf } from '../src/seed/samplePdf.js';
import { memoryFiles } from '../src/services/storage/drivers/memory.js';

/*
  Resume extraction drafts and recruiter approval, through the admin
  API: reading the resume of an application makes a draft and never
  changes the candidate; only the fields a recruiter approves are
  written, and every step is audited.
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

// A phrase that appears only inside the resume files, to check that no
// resume text leaks into a response, the audit log or the server.
const MARKER = 'Zircon Lattice Initiative';

const VLSI_LINES = [
  'Asha Verma',
  'Senior Design Verification Engineer',
  'Bengaluru, India | asha.verma@example.com | +91 98765 43210',
  'Summary',
  'Design verification engineer with 8+ years of experience.',
  'Skills',
  'SystemVerilog, UVM, SVA, Python, Synopsys VCS, AXI4',
  'Experience',
  'Senior Verification Engineer | Example Silicon Pvt Ltd | Jan 2021 - Present',
  '- Built a UVM testbench for a PCIe controller.',
  'Verification Engineer | Sample Semiconductors | Jul 2018 - Dec 2020',
  '- Verified a DDR4 controller.',
  'Projects',
  `Project Title: ${MARKER}`,
  'Description: Coverage-driven verification of an AXI crossbar.',
  'Tools: VCS, UVM, Python',
  'Education',
  'B.Tech in Electronics and Communication Engineering, NIT Trichy, 2018',
  'Certifications',
  '- Cadence Certified Xcelium User',
];

const PDF = { name: 'Asha Verma CV.pdf', type: 'application/pdf' };
const DOCX = { name: 'cv.docx', type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' };

// Applies through the public form, as a visitor, and returns the
// stored application and candidate.
async function apply(email, buffer, kind = PDF, overrides = {}) {
  const sent = await client().post('/api/applications', {
    form: multipart(applicationFields({ email, name: 'Asha From Form', skills: 'Perl, Teamwork', headline: 'Engineer (typed)', location: 'Mysuru, India', ...overrides }), { field: 'resume', name: kind.name, buffer, type: kind.type }),
  });
  assert.equal(sent.status, 201, JSON.stringify(sent.body));
  const candidate = await ctx.models.Candidate.findOne({ email });
  const application = await ctx.models.Application.findOne({ candidateId: candidate._id }).sort({ submittedAt: -1 });
  return { candidate, application };
}

const extract = (agent, applicationId) => agent.post(`/api/admin/applications/${applicationId}/resume-extraction`);
const approve = (agent, id, json) => agent.post(`/api/admin/resume-extractions/${id}/approve`, { json });
const discard = (agent, id, json = {}) => agent.post(`/api/admin/resume-extractions/${id}/discard`, { json });

// The candidate as stored, without the fields that change on any save.
async function stored(candidateId) {
  const doc = (await ctx.models.Candidate.findById(candidateId)).toObject();
  delete doc.updatedAt;
  delete doc.__v;
  return JSON.parse(JSON.stringify(doc));
}

async function auditFor(candidateId) {
  const logs = await admin.get(`/api/admin/audit-logs?entityType=candidate&entityId=${candidateId}&limit=100`);
  assert.equal(logs.status, 200);
  return logs.body.data;
}

// ------------------------------------------------------------ extraction

test('extraction: a PDF resume becomes a draft, and the candidate is not changed', async () => {
  const { candidate, application } = await apply('asha.pdf@example.com', samplePdf(VLSI_LINES));
  const before = await stored(candidate._id);
  const resultsBefore = await ctx.models.ATSResult.countDocuments({});
  // The form sends its own emails just after it answers: let them go first.
  await wait(300);
  ctx.outbox.length = 0;

  const response = await extract(recruiter, application._id);
  assert.equal(response.status, 201, JSON.stringify(response.body));
  const draft = response.body.data;
  assert.equal(draft.status, 'EXTRACTED');
  assert.equal(draft.candidateId, String(candidate._id));
  assert.equal(draft.applicationId, String(application._id));
  assert.equal(draft.parserVersion, '1');
  assert.equal(draft.extraction.type, 'pdf');
  assert.equal(draft.extraction.extractor, 'pdfjs-dist');
  assert.equal(draft.extractedByName, 'Test RECRUITER');
  assert.deepEqual(draft.resume, { fileName: 'Asha Verma CV.pdf', mimeType: 'application/pdf', size: application.resume.size });

  // The draft, with confidence and evidence per field.
  assert.equal(draft.draft.name, 'Asha Verma');
  assert.equal(draft.draft.email, 'asha.verma@example.com');
  assert.equal(draft.draft.location, 'Bengaluru, India');
  assert.equal(draft.draft.headline, 'Senior Design Verification Engineer');
  assert.deepEqual(draft.draft.skills.slice(0, 6), ['SystemVerilog', 'UVM', 'Assertions', 'Python', 'VCS', 'AXI']);
  assert.equal(draft.draft.experienceYears, 8);
  assert.deepEqual(draft.draft.experience.map((job) => job.employer), ['Example Silicon Pvt Ltd', 'Sample Semiconductors']);
  assert.deepEqual(draft.draft.education.map((entry) => entry.institution), ['NIT Trichy']);
  assert.deepEqual(draft.draft.certifications, ['Cadence Certified Xcelium User']);
  assert.deepEqual(draft.draft.projects.map((project) => project.name), [MARKER]);
  assert.equal(draft.confidence.name, 'high');
  assert.equal(draft.confidence.skills, 'high');
  assert.deepEqual(draft.evidence.name, ['Asha Verma']);
  assert.ok(Array.isArray(draft.warnings));
  assert.equal(draft.details.experienceYears.method, 'stated');

  // The text is held on the server, never sent.
  assert.ok(!('rawText' in draft));
  assert.ok(draft.rawTextLength > 300);
  const record = await ctx.models.ResumeExtraction.findById(draft.id);
  assert.equal(record.rawText.length, draft.rawTextLength);
  assert.ok(record.rawText.includes('Senior Verification Engineer'));
  assert.ok(!JSON.stringify(draft).includes(application.resume.key), 'no storage key in the response');

  // Nothing else happened: the profile, the ATS results and the mail.
  assert.deepEqual(await stored(candidate._id), before, 'the candidate is exactly as it was');
  assert.equal(await ctx.models.ATSResult.countDocuments({}), resultsBefore, 'the ATS is not run');
  await wait(300);
  assert.equal(ctx.outbox.length, 0, 'no email');

  // Audited, without resume content.
  const logs = await auditFor(candidate._id);
  const entry = logs.find((item) => item.action === 'candidate.resume_extracted');
  assert.ok(entry);
  assert.equal(entry.actorName, 'Test RECRUITER');
  assert.ok(!JSON.stringify(logs).includes(MARKER), 'the audit log holds no resume text');
});

test('extraction: a DOCX resume becomes a draft', async () => {
  const { candidate, application } = await apply('asha.docx@example.com', docxWithText(VLSI_LINES), DOCX);
  const before = await stored(candidate._id);
  const response = await extract(recruiter, application._id);
  assert.equal(response.status, 201);
  assert.equal(response.body.data.status, 'EXTRACTED');
  assert.equal(response.body.data.extraction.type, 'docx');
  assert.equal(response.body.data.extraction.extractor, 'mammoth');
  assert.equal(response.body.data.draft.name, 'Asha Verma');
  assert.ok(response.body.data.draft.skills.includes('UVM'));
  assert.deepEqual(await stored(candidate._id), before);
});

test('extraction: a resume with no text is stored as NO_TEXT, with nothing to apply', async () => {
  const { candidate, application } = await apply('scanned@example.com', samplePdf([]));
  const before = await stored(candidate._id);
  const response = await extract(recruiter, application._id);
  assert.equal(response.status, 201);
  const draft = response.body.data;
  assert.equal(draft.status, 'NO_TEXT');
  assert.equal(draft.draft, null);
  assert.equal(draft.rawTextLength, 0);
  assert.deepEqual(draft.warnings.map((warning) => warning.code), ['NO_TEXT']);
  assert.match(draft.warnings[0].message, /scanned/);
  assert.deepEqual(await stored(candidate._id), before);

  const refused = await approve(recruiter, draft.id, { fields: ['skills'] });
  assert.equal(refused.status, 409, 'nothing to approve');
});

test('extraction: a damaged resume is stored as FAILED with the reason', async () => {
  // Passes the upload check (a PDF header and end marker) but is not a PDF.
  const broken = Buffer.from(`%PDF-1.4\n${MARKER} not a real PDF body ${'x'.repeat(300)}\n%%EOF\n`, 'latin1');
  const { candidate, application } = await apply('damaged@example.com', broken);
  const before = await stored(candidate._id);
  const response = await extract(recruiter, application._id);
  assert.equal(response.status, 201);
  assert.equal(response.body.data.status, 'FAILED');
  assert.equal(response.body.data.failureReason, 'MALFORMED');
  assert.equal(response.body.data.draft, null);
  assert.deepEqual(await stored(candidate._id), before);
});

test('extraction: a resume that cannot be read, or an application without one, fails safely', async () => {
  // The stored file is gone.
  const missing = await apply('missing.file@example.com', samplePdf(VLSI_LINES));
  memoryFiles.delete(missing.application.resume.key);
  const gone = await extract(recruiter, missing.application._id);
  assert.equal(gone.status, 201);
  assert.deepEqual([gone.body.data.status, gone.body.data.failureReason], ['FAILED', 'UNAVAILABLE']);

  // A legacy Word file is not read in this phase.
  const legacy = await apply('legacy.doc@example.com', docBytes(), { name: 'cv.doc', type: 'application/msword' });
  const doc = await extract(recruiter, legacy.application._id);
  assert.deepEqual([doc.body.data.status, doc.body.data.failureReason], ['FAILED', 'UNSUPPORTED']);

  // No resume on the application, no application, a bad id.
  const bare = await ctx.models.Application.create({ candidateId: legacy.candidate._id, resume: null });
  assert.equal((await extract(recruiter, bare._id)).status, 400);
  assert.equal((await extract(recruiter, '64b000000000000000000000')).status, 404);
  assert.equal((await extract(recruiter, 'not-an-id')).status, 400);
  const orphan = await ctx.models.Application.create({ candidateId: '64b000000000000000000001', resume: missing.application.resume });
  assert.equal((await extract(recruiter, orphan._id)).status, 404, 'the candidate no longer exists');
});

test('extraction: the stored text is capped at 30,000 characters', async () => {
  const long = [...VLSI_LINES, ...Array.from({ length: 500 }, (_, n) => `Line ${n} regression triage, coverage closure and assertion debug on block level.`)];
  const { application } = await apply('long.resume@example.com', docxWithText(long), DOCX);
  const response = await extract(recruiter, application._id);
  assert.equal(response.body.data.status, 'EXTRACTED');
  assert.equal(response.body.data.extraction.truncated, true);
  assert.ok(response.body.data.rawTextLength <= 30_000);
  assert.ok(response.body.data.rawTextLength > 29_000);
  const record = await ctx.models.ResumeExtraction.findById(response.body.data.id);
  assert.ok(record.rawText.length <= 30_000);
});

test('drafts: a candidate\'s drafts are listed, newest first, without the text', async () => {
  const { candidate, application } = await apply('listed@example.com', samplePdf(VLSI_LINES));
  const first = (await extract(recruiter, application._id)).body.data;
  const second = (await extract(admin, application._id)).body.data;

  const listed = await recruiter.get(`/api/admin/candidates/${candidate._id}/resume-extractions`);
  assert.equal(listed.status, 200);
  assert.deepEqual(listed.body.data.map((item) => item.id), [second.id, first.id]);
  assert.ok(listed.body.data.every((item) => !('rawText' in item) && item.rawTextLength > 0));
  assert.equal(listed.headers.get('cache-control'), 'no-store');

  // A hiring manager may read candidates and resumes, so may read drafts.
  assert.equal((await manager.get(`/api/admin/candidates/${candidate._id}/resume-extractions`)).status, 200);
  assert.equal((await recruiter.get('/api/admin/candidates/64b000000000000000000000/resume-extractions')).status, 404);
  assert.equal((await recruiter.get('/api/admin/candidates/not-an-id/resume-extractions')).status, 400);
});

// --------------------------------------------------------------- approval

test('approval: only the chosen fields are written; the others stay as they were', async () => {
  const { candidate, application } = await apply('approve.some@example.com', samplePdf(VLSI_LINES));
  const draft = (await extract(recruiter, application._id)).body.data;
  const before = await stored(candidate._id);
  const atsBefore = JSON.stringify(await ctx.models.ATSResult.find({ candidateId: candidate._id }).lean());

  const response = await approve(recruiter, draft.id, { fields: ['skills', 'experience', 'location'], note: 'Checked against the resume.' });
  assert.equal(response.status, 200, JSON.stringify(response.body));
  const { extraction, candidate: updated } = response.body.data;
  assert.equal(extraction.status, 'APPROVED');
  assert.deepEqual(extraction.appliedFields, ['skills', 'experience', 'location']);
  assert.deepEqual(extraction.editedFields, []);
  assert.equal(extraction.reviewedByName, 'Test RECRUITER');
  assert.ok(extraction.reviewedAt);
  assert.equal(extraction.reviewNote, 'Checked against the resume.');

  const after = await stored(candidate._id);
  assert.deepEqual(after.skills, draft.draft.skills, 'the skills read from the resume replace the typed ones');
  assert.equal(after.location, 'Bengaluru, India');
  assert.deepEqual(after.experience, [
    { title: 'Senior Verification Engineer', employer: 'Example Silicon Pvt Ltd', period: 'Jan 2021 - Present', highlights: ['Built a UVM testbench for a PCIe controller.'] },
    { title: 'Verification Engineer', employer: 'Sample Semiconductors', period: 'Jul 2018 - Dec 2020', highlights: ['Verified a DDR4 controller.'] },
  ]);
  assert.deepEqual(updated.skills, after.skills);
  // Not chosen: unchanged.
  for (const field of ['name', 'email', 'phone', 'headline', 'experienceYears', 'education', 'certifications', 'projects', 'summary', 'labels', 'notes', 'resume', 'domain']) {
    assert.deepEqual(after[field], before[field], `${field} is unchanged`);
  }
  assert.equal(after.name, 'Asha From Form');
  assert.equal(after.headline, 'Engineer (typed)');

  // The ATS is not re-run by an approval.
  assert.equal(JSON.stringify(await ctx.models.ATSResult.find({ candidateId: candidate._id }).lean()), atsBefore);

  // A draft is approved once.
  assert.equal((await approve(recruiter, draft.id, { fields: ['name'] })).status, 409);
  assert.equal((await discard(recruiter, draft.id)).status, 409);

  // Audited: which fields, not their values.
  const logs = await auditFor(candidate._id);
  const entry = logs.find((item) => item.action === 'candidate.resume_extraction_approved');
  assert.ok(entry);
  assert.match(entry.summary, /skills, experience, location/);
  assert.deepEqual(entry.metadata.appliedFields, ['skills', 'experience', 'location']);
  assert.deepEqual(entry.metadata.changedFields, ['skills', 'experience', 'location']);
  assert.equal(entry.metadata.extractionId, draft.id);
  assert.ok(!JSON.stringify(logs).includes('Example Silicon'), 'no values in the audit log');

  // The candidate page shows it in the history.
  const detail = await recruiter.get(`/api/admin/candidates/${candidate._id}`);
  assert.ok(detail.body.data.history.some((item) => item.action === 'candidate.resume_extraction_approved'));
});

test('approval: the recruiter\'s edits are applied instead of the draft values', async () => {
  const { candidate, application } = await apply('approve.edit@example.com', samplePdf(VLSI_LINES));
  const draft = (await extract(recruiter, application._id)).body.data;

  const response = await approve(recruiter, draft.id, {
    fields: ['name', 'headline', 'skills', 'experienceYears', 'phone'],
    values: {
      name: 'Asha V. Verma',
      headline: 'Lead Design Verification Engineer',
      skills: ['sv', 'UVM', 'uvm', 'Static Timing Analysis', 'Custom Flow'],
      experienceYears: 7.5,
    },
  });
  assert.equal(response.status, 200, JSON.stringify(response.body));
  assert.deepEqual(response.body.data.extraction.editedFields, ['name', 'headline', 'skills', 'experienceYears']);
  const after = await stored(candidate._id);
  assert.equal(after.name, 'Asha V. Verma');
  assert.equal(after.headline, 'Lead Design Verification Engineer');
  assert.deepEqual(after.skills, ['SystemVerilog', 'UVM', 'STA', 'Custom Flow'], 'skills are given their taxonomy names at approval, once each');
  assert.equal(after.experienceYears, 7.5);
  assert.equal(after.phone, '+91 98765 43210', 'not edited: the draft value');
});

test('approval: the request is validated before anything is written', async () => {
  const { candidate, application } = await apply('approve.invalid@example.com', samplePdf(VLSI_LINES));
  const draft = (await extract(recruiter, application._id)).body.data;
  const before = await stored(candidate._id);
  const path = `/api/admin/resume-extractions/${draft.id}/approve`;

  const refusals = [
    {},
    { fields: [] },
    { fields: ['email'] },
    { fields: ['labels'] },
    { fields: 'skills' },
    { fields: ['skills'], values: { location: 'Pune' } },
    { fields: ['skills'], values: { email: 'other@example.com' } },
    { fields: ['experienceYears'], values: { experienceYears: 99 } },
    { fields: ['name'], values: { name: '' } },
    { fields: ['projects'], values: { projects: [{ description: 'no name' }] } },
    { fields: ['experience'], values: { experience: [{ highlights: ['nothing else'] }] } },
    { fields: ['skills'], values: { skills: { $gt: '' } } },
    { fields: ['skills'], append: ['projects'] },
  ];
  for (const body of refusals) {
    const response = await recruiter.post(path, { json: body });
    assert.equal(response.status, 400, `refused: ${JSON.stringify(body)}`);
  }
  assert.deepEqual(await stored(candidate._id), before, 'nothing was written');
  assert.equal((await ctx.models.ResumeExtraction.findById(draft.id)).status, 'EXTRACTED', 'the draft can still be approved');

  // A draft value that cannot be applied as it is must be edited first.
  const nameless = await apply('approve.nameless@example.com', samplePdf(['skills', 'UVM, SystemVerilog, Python', 'experience', 'Engineer | Example Silicon Pvt Ltd | 2019 - 2022']));
  const noName = (await extract(recruiter, nameless.application._id)).body.data;
  assert.equal(noName.draft.name, '');
  const blocked = await approve(recruiter, noName.id, { fields: ['name', 'skills'] });
  assert.equal(blocked.status, 400);
  assert.equal(blocked.body.error.details[0].field, 'values.name');
  assert.equal((await ctx.models.Candidate.findById(nameless.candidate._id)).name, 'Asha From Form');
  const fixed = await approve(recruiter, noName.id, { fields: ['name', 'skills'], values: { name: 'Typed By Recruiter' } });
  assert.equal(fixed.status, 200);
});

test('approval: projects and certifications are written to the new candidate fields', async () => {
  const { candidate, application } = await apply('approve.projects@example.com', docxWithText(VLSI_LINES), DOCX);
  const draft = (await extract(recruiter, application._id)).body.data;
  const before = await stored(candidate._id);
  assert.deepEqual(before.projects, [], 'a candidate starts without projects');
  assert.deepEqual(before.certifications, []);

  const response = await approve(recruiter, draft.id, { fields: ['projects', 'certifications', 'education'] });
  assert.equal(response.status, 200, JSON.stringify(response.body));
  const after = await stored(candidate._id);
  assert.deepEqual(after.projects, [{
    name: MARKER,
    period: '',
    role: '',
    description: 'Coverage-driven verification of an AXI crossbar.',
    highlights: [],
    technologies: ['VCS', 'UVM', 'Python', 'Functional Coverage', 'AXI'],
  }]);
  assert.deepEqual(after.certifications, ['Cadence Certified Xcelium User']);
  assert.deepEqual(after.education, [{ degree: 'B.Tech in Electronics and Communication Engineering', institution: 'NIT Trichy', year: '2018' }]);
  assert.deepEqual(response.body.data.candidate.projects, after.projects, 'the API returns them');
  assert.deepEqual(after.skills, before.skills);
});

test('approval: list fields can be added to what the candidate already has', async () => {
  const { candidate, application } = await apply('approve.append@example.com', samplePdf(VLSI_LINES), PDF, { skills: 'Perl, UVM, Teamwork' });
  const draft = (await extract(recruiter, application._id)).body.data;
  const response = await approve(recruiter, draft.id, { fields: ['skills'], append: ['skills'], values: { skills: ['UVM', 'SystemVerilog', 'Python'] } });
  assert.equal(response.status, 200);
  assert.deepEqual((await stored(candidate._id)).skills, ['Perl', 'UVM', 'Teamwork', 'SystemVerilog', 'Python']);
});

// ---------------------------------------------------------------- discard

test('discard: the draft is dropped, its text cleared, and the candidate is not changed', async () => {
  const { candidate, application } = await apply('discard.me@example.com', samplePdf(VLSI_LINES));
  const draft = (await extract(recruiter, application._id)).body.data;
  const before = await stored(candidate._id);

  const response = await discard(recruiter, draft.id, { note: 'Wrong resume.' });
  assert.equal(response.status, 200);
  assert.equal(response.body.data.status, 'DISCARDED');
  assert.equal(response.body.data.reviewedByName, 'Test RECRUITER');
  assert.equal(response.body.data.rawTextLength, 0);
  assert.equal((await ctx.models.ResumeExtraction.findById(draft.id)).rawText, '');
  assert.deepEqual(await stored(candidate._id), before);

  assert.equal((await discard(recruiter, draft.id)).status, 409);
  assert.equal((await approve(recruiter, draft.id, { fields: ['skills'] })).status, 409);
  assert.equal((await discard(recruiter, '64b000000000000000000000')).status, 404);
  assert.ok((await auditFor(candidate._id)).some((item) => item.action === 'candidate.resume_extraction_discarded'));
});

// ------------------------------------------------------ deletion and access

test('deleting a candidate deletes their drafts', async () => {
  const { candidate, application } = await apply('delete.drafts@example.com', samplePdf(VLSI_LINES));
  await extract(recruiter, application._id);
  await extract(recruiter, application._id);
  assert.equal(await ctx.models.ResumeExtraction.countDocuments({ candidateId: candidate._id }), 2);
  const removed = await admin.delete(`/api/admin/candidates/${candidate._id}`);
  assert.equal(removed.status, 200);
  assert.equal(await ctx.models.ResumeExtraction.countDocuments({ candidateId: candidate._id }), 0);
});

test('access: the routes need a session, the right permissions and the request protections', async () => {
  const { candidate, application } = await apply('access.check@example.com', samplePdf(VLSI_LINES));
  const draft = (await extract(recruiter, application._id)).body.data;
  const listPath = `/api/admin/candidates/${candidate._id}/resume-extractions`;

  // Signed out.
  assert.equal((await client().post(`/api/admin/applications/${application._id}/resume-extraction`)).status, 401);
  assert.equal((await client().get(listPath)).status, 401);
  // A hiring manager reads candidates but does not edit them.
  assert.equal((await extract(manager, application._id)).status, 403);
  assert.equal((await approve(manager, draft.id, { fields: ['skills'] })).status, 403);
  assert.equal((await discard(manager, draft.id)).status, 403);
  // A content manager sees no candidate data.
  assert.equal((await content.get(listPath)).status, 403);
  assert.equal((await extract(content, application._id)).status, 403);
  // The CSRF protections apply.
  assert.equal((await recruiter.post(`/api/admin/applications/${application._id}/resume-extraction`, { xhr: false })).status, 403);
  assert.equal((await recruiter.post(`/api/admin/resume-extractions/${draft.id}/approve`, { json: { fields: ['skills'] }, origin: 'https://evil.example.com' })).status, 403);
  // No public route reads a resume.
  assert.equal((await client().post(`/api/applications/${application._id}/resume-extraction`)).status, 404);

  assert.equal((await ctx.models.ResumeExtraction.findById(draft.id)).status, 'EXTRACTED', 'nothing happened to the draft');
});

test('a second public application cannot change the profile, and its resume only makes a draft', async () => {
  const first = await apply('second.try@example.com', samplePdf(VLSI_LINES));
  const before = await stored(first.candidate._id);
  // Someone else applies with the same email and another resume.
  const second = await apply('second.try@example.com', samplePdf(['Mallory Example', 'Skills', 'Python, Verilog, Perl, Tcl scripting and lab automation']), PDF, { name: 'Mallory Example', skills: 'Python' });
  assert.equal(String(second.candidate._id), String(first.candidate._id));
  assert.deepEqual(await stored(first.candidate._id), before, 'the form changes nothing');
  const draft = (await extract(recruiter, second.application._id)).body.data;
  assert.equal(draft.status, 'EXTRACTED');
  assert.equal(draft.draft.name, 'Mallory Example');
  assert.deepEqual(await stored(first.candidate._id), before, 'reading the resume changes nothing either');
});
