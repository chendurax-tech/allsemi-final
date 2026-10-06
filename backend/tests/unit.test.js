import { test } from 'node:test';
import assert from 'node:assert/strict';

process.env.NODE_ENV = 'test';
process.env.SESSION_SECRET = 'test-only-session-secret-0123456789-abcdefghij';

const { hashPassword, verifyPassword, needsRehash, passwordProblem, generatePassword } = await import('../src/utils/password.js');
const { detectFileType, inspectDocument, inspectImage, imageDimensions } = await import('../src/utils/fileSniff.js');
const { cleanText, cleanList, escapeHtml, safeFileName, slugify } = await import('../src/utils/sanitize.js');
const { evaluate, skillKey } = await import('../src/services/atsService.js');
const { templates } = await import('../src/services/email/templates.js');
const { describeTarget } = await import('../src/seed/target.js');
const { planApplication, planCandidate } = await import('../src/services/recruitmentMigration.js');
const { serviceCreateSchema } = await import('../src/validators/content.js');
const { enquiryFormSchema, requirementFormSchema } = await import('../src/validators/publicForms.js');
const { zipBytes, docxBytes, docBytes } = await import('./helpers.js');
const { ROLE_PERMISSIONS, PERMISSIONS, roleCan } = await import('../src/config/permissions.js');
const { signPayload, verifyPayload, hashToken, newToken } = await import('../src/utils/tokens.js');

test('passwords are hashed with scrypt and verify correctly', async () => {
  const hash = await hashPassword('a-long-passphrase-42');
  assert.match(hash, /^scrypt\$32768\$8\$3\$/);
  assert.ok(!hash.includes('a-long-passphrase-42'));
  assert.equal(await verifyPassword('a-long-passphrase-42', hash), true);
  assert.equal(await verifyPassword('a-long-passphrase-43', hash), false);
  assert.equal(await verifyPassword('anything', 'not-a-hash'), false);
  assert.equal(needsRehash(hash), false);
  assert.notEqual(hash, await hashPassword('a-long-passphrase-42'), 'a new salt is used every time');
});

test('password rules', () => {
  assert.ok(passwordProblem('short1'));
  assert.ok(passwordProblem('onlyletterslongenough'));
  assert.equal(passwordProblem('long-enough-with-1-digit'), null);
  assert.equal(passwordProblem(generatePassword()), null);
});

test('file type is decided from the bytes, not the name', () => {
  const pdf = Buffer.concat([Buffer.from('%PDF-1.7\n'), Buffer.alloc(50, 0x20), Buffer.from('\n%%EOF\n')]);
  const exe = Buffer.concat([Buffer.from('MZ'), Buffer.alloc(50)]);
  const html = Buffer.from('<html><script>alert(1)</script></html>          ');
  assert.equal(detectFileType(pdf), 'pdf');
  assert.equal(detectFileType(exe), null);
  assert.equal(detectFileType(html), null);

  assert.equal(inspectDocument({ buffer: pdf, originalName: 'cv.pdf' }).ok, true);
  assert.equal(inspectDocument({ buffer: exe, originalName: 'cv.pdf' }).ok, false, 'an executable renamed to .pdf is refused');
  assert.equal(inspectDocument({ buffer: pdf, originalName: 'cv.docx' }).ok, false, 'extension must match the contents');
  assert.equal(inspectDocument({ buffer: pdf, originalName: 'cv.pdf.exe' }).ok, false);
  assert.equal(inspectImage({ buffer: pdf, originalName: 'photo.png' }).ok, false, 'a PDF is not an image');

  assert.equal(inspectDocument({ buffer: docxBytes(), originalName: 'cv.docx' }).ok, true);
  assert.equal(inspectDocument({ buffer: zipBytes(['payload.js', 'readme.txt']), originalName: 'cv.docx' }).ok, false, 'a plain zip is not a Word document');
  assert.equal(inspectDocument({ buffer: docBytes(), originalName: 'cv.doc' }).ok, true);
});

test('a file that only imitates a document is refused', () => {
  // The right first bytes, and nothing else of the format.
  const headerOnlyPdf = Buffer.concat([Buffer.from('%PDF-1.7\n<html><script>alert(1)</script></html>'), Buffer.alloc(60, 0x20)]);
  assert.equal(detectFileType(headerOnlyPdf), null, 'a PDF needs its end marker');
  assert.equal(detectFileType(Buffer.concat([Buffer.from('%PDF-evil'), Buffer.alloc(40, 0x20), Buffer.from('%%EOF')])), null, 'a PDF needs a version');

  // The names a .docx contains, written into a file that is not a zip
  // with those entries.
  const namesOnly = Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.from('[Content_Types].xml'), Buffer.alloc(20), Buffer.from('word/document.xml'), Buffer.alloc(20)]);
  assert.equal(detectFileType(namesOnly), null, 'entry names must come from the zip index');
  assert.equal(detectFileType(zipBytes(['[Content_Types].xml', 'xl/workbook.xml'])), null, 'another Office format is not a Word document');
  const truncated = docxBytes().subarray(0, 60);
  assert.equal(detectFileType(truncated), null);

  // The compound-file header followed by the stream name as loose text.
  const looseName = Buffer.concat([Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]), Buffer.alloc(700), Buffer.from('WordDocument', 'utf16le'), Buffer.alloc(200)]);
  assert.equal(detectFileType(looseName), null, 'the stream must be a directory entry');
});

test('text cleaning stays fast on hostile input', () => {
  const started = Date.now();
  cleanText('<'.repeat(200_000), { max: 20_000 });
  cleanText('<a'.repeat(100_000), { max: 20_000 });
  cleanList('<'.repeat(200_000));
  assert.ok(Date.now() - started < 500, `cleaning took ${Date.now() - started} ms`);
  // The validators refuse over-long text before it is cleaned at all.
  const result = enquiryFormSchema.safeParse({ name: 'A', email: 'a@example.com', message: '<'.repeat(30_000) });
  assert.equal(result.success, false);
  assert.equal(enquiryFormSchema.safeParse({ name: 'A', email: 'a@example.com', message: 'Hello', company: ['x'] }).success, false, 'an array is not text');
});

test('an empty number of positions falls back to one', () => {
  const base = { contactName: 'A Person', company: 'A Company', email: 'a@example.com', role: 'RTL Design Engineer', consent: 'true' };
  assert.equal(requirementFormSchema.parse(base).positions, 1);
  assert.equal(requirementFormSchema.parse({ ...base, positions: '' }).positions, 1);
  assert.equal(requirementFormSchema.parse({ ...base, positions: '4' }).positions, 4);
  assert.equal(requirementFormSchema.safeParse({ ...base, positions: '0' }).success, false);
  assert.equal(requirementFormSchema.safeParse({ ...base, positions: 'many' }).success, false);
});

test('a service link can only point inside this site', () => {
  const link = (ctaTo) => serviceCreateSchema.safeParse({ name: 'Permanent Staffing', ctaTo }).success;
  assert.equal(link('/contact?type=employer'), true);
  assert.equal(link(''), true);
  assert.equal(link('//evil.example'), false, 'a protocol-relative link leaves the site');
  assert.equal(link('/\\evil.example'), false);
  assert.equal(link('https://evil.example'), false);
  assert.equal(link('javascript:alert(1)'), false);
});

test('a misspelt NODE_ENV stops the process instead of running with development safeguards', async () => {
  const { spawnSync } = await import('node:child_process');
  const run = (value) => spawnSync(process.execPath, ['--input-type=module', '-e', "await import('./src/config/env.js');"], {
    cwd: new URL('..', import.meta.url), env: { ...process.env, NODE_ENV: value }, encoding: 'utf8',
  });
  const bad = run('prod');
  assert.notEqual(bad.status, 0);
  assert.match(bad.stderr, /NODE_ENV must be one of/);
  assert.equal(run('production').status, 0);
});

test('the seed recognises a database that is not on this machine', () => {
  assert.equal(describeTarget('mongodb://localhost:27017/allsemis').local, true);
  assert.equal(describeTarget('mongodb://127.0.0.1/allsemis').local, true);
  const atlas = describeTarget('mongodb+srv://someone:secret@cluster0.example.mongodb.net/allsemis?retryWrites=true');
  assert.deepEqual(atlas, { hosts: ['cluster0.example.mongodb.net'], database: 'allsemis', local: false });
  assert.ok(!JSON.stringify(atlas).includes('secret'), 'credentials are not returned');
  assert.equal(describeTarget('mongodb://localhost,db.example.com/allsemis').local, false);
  assert.equal(describeTarget('not a connection string').local, false);
});

test('image dimensions are read from the header', () => {
  const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]), Buffer.from([0, 0, 2, 128, 0, 0, 1, 104]), Buffer.alloc(8)]);
  assert.deepEqual(imageDimensions(png, 'png'), { width: 640, height: 360 });
});

test('text is cleaned of markup and control characters', () => {
  assert.equal(cleanText('  Hello <script>alert(1)</script> <b>world</b>  '), 'Hello alert(1) world');
  assert.equal(cleanText('a\u0000b\u0007c'), 'abc');
  assert.equal(cleanText('line one\n\n\n\nline two', { multiline: true }), 'line one\n\nline two');
  assert.deepEqual(cleanList('UVM, uvm , SystemVerilog,,<i>x</i>'), ['UVM', 'SystemVerilog', 'x']);
  assert.equal(escapeHtml('<a href="x">&\'</a>'), '&lt;a href=&quot;x&quot;&gt;&amp;&#39;&lt;/a&gt;');
  assert.equal(safeFileName('../../etc/passwd'), '.. .. etc passwd');
  assert.equal(slugify('  RTL Design Engineer (Senior)! '), 'rtl-design-engineer-senior');
});

test('email templates escape submitted values', () => {
  const message = templates.newEnquiryAdmin({ name: '<img src=x onerror=alert(1)>', email: 'a@example.com', type: 'GENERAL', subject: 'Hi', message: '<script>x</script>' });
  assert.ok(!message.html.includes('<script>x</script>'));
  assert.ok(!message.html.includes('<img src=x'));
  assert.ok(message.html.includes('&lt;script&gt;'));
  assert.ok(message.text.includes('Hi'));
});

test('confirmation emails repeat nothing a visitor typed', () => {
  const typed = 'Visit evil.example for a prize';
  const messages = [
    templates.requirementConfirmation({ contactName: typed, role: typed, location: typed }),
    templates.applicationConfirmation({ candidate: { name: typed }, job: null }),
    templates.enquiryConfirmation({ name: typed, subject: typed, message: typed }),
    templates.referralConfirmation({ referrerName: typed, candidateName: typed }),
  ];
  for (const message of messages) {
    assert.ok(!`${message.subject} ${message.html} ${message.text}`.includes('evil.example'));
  }
  // A job title is written by staff and is the one variable.
  assert.match(templates.applicationConfirmation({ job: { title: 'RTL Design Engineer' } }).subject, /RTL Design Engineer/);
});

test('the rule-based ATS is deterministic and explainable', () => {
  const job = {
    title: 'Design Verification Engineer', category: 'Semiconductor', department: 'Verification', location: 'Bangalore, IN',
    experienceLevel: 'Mid-Senior', requiredSkills: ['SystemVerilog', 'UVM', 'Functional Coverage', 'Assertions'], preferredSkills: ['Python', 'Formal Verification'], keywords: ['UVM'],
  };
  const candidate = {
    skills: ['system verilog', 'UVM', 'Functional Coverage', 'Python'], experienceYears: 6, domain: 'Semiconductor & Chip Engineering', headline: 'Design Verification Engineer',
    location: 'Bengaluru, India', phone: '1', noticePeriod: '30 days', resume: { key: 'k' },
  };
  const first = evaluate(candidate, job);
  const second = evaluate(candidate, job);
  assert.deepEqual(first, second, 'same inputs, same result');
  assert.equal(first.engine, 'RULE_BASED');
  assert.deepEqual(first.matchedSkills, ['SystemVerilog', 'UVM', 'Functional Coverage']);
  assert.deepEqual(first.missingSkills, ['Assertions']);
  assert.equal(first.skillScore, 75);
  assert.equal(first.experienceScore, 100);
  assert.equal(first.domainScore, 100);
  assert.equal(first.locationScore, 100, 'Bangalore and Bengaluru are the same city');
  assert.equal(first.preferredSkillScore, 50);
  assert.equal(first.completenessScore, 100);
  // 75*45 + 100*20 + 50*10 + 100*10 + 100*10 + 100*5 = 8375 / 100
  assert.equal(first.totalScore, 84);
  assert.equal(first.band, 'Good match');
  assert.ok(first.checks.every((check) => check.rule && check.detail));

  const junior = evaluate({ ...candidate, experienceYears: 2 }, job);
  assert.equal(junior.experienceScore, 50);
  assert.ok(junior.totalScore < first.totalScore);

  assert.equal(skillKey('C++'), 'c++');
  assert.notEqual(skillKey('C'), skillKey('C++'));
  // A category made of words that are also built-in property names.
  assert.doesNotThrow(() => evaluate(candidate, { ...job, category: 'constructor toString __proto__' }));

  const noSkills = evaluate(candidate, { ...job, requiredSkills: [], preferredSkills: [] });
  assert.ok(!('skills' in noSkills.weights), 'a component that does not apply is not weighted');
});

test('role permission table', () => {
  assert.ok(roleCan('SUPER_ADMIN', PERMISSIONS.USERS_MANAGE));
  assert.ok(!roleCan('RECRUITER', PERMISSIONS.USERS_MANAGE));
  assert.ok(!roleCan('RECRUITER', PERMISSIONS.CONTENT_WRITE));
  assert.ok(!roleCan('CONTENT_MANAGER', PERMISSIONS.CANDIDATES_READ));
  assert.ok(!roleCan('CONTENT_MANAGER', PERMISSIONS.RESUMES_READ));
  assert.ok(roleCan('HIRING_MANAGER', PERMISSIONS.CANDIDATES_READ));
  assert.ok(!roleCan('HIRING_MANAGER', PERMISSIONS.CANDIDATES_WRITE));
  assert.ok(!roleCan('UNKNOWN_ROLE', PERMISSIONS.JOBS_READ));
  assert.equal(new Set(Object.keys(ROLE_PERMISSIONS)).size, 4);
});

test('signed links expire and cannot be altered', () => {
  const good = signPayload({ key: 'resumes/x.pdf', exp: Date.now() + 5000 });
  assert.equal(verifyPayload(good).key, 'resumes/x.pdf');
  assert.equal(verifyPayload(signPayload({ key: 'x', exp: Date.now() - 1 })), null, 'expired');
  const [body, signature] = good.split('.');
  const forged = `${Buffer.from(JSON.stringify({ key: 'resumes/other.pdf', exp: Date.now() + 5000 })).toString('base64url')}.${signature}`;
  assert.equal(verifyPayload(forged), null, 'a changed payload fails the signature');
  assert.equal(verifyPayload(`${body}.AAAA`), null);
  const token = newToken();
  assert.notEqual(hashToken(token), token);
  assert.equal(hashToken(token), hashToken(token));
});

test('the API never describes where a private file is stored', async () => {
  const { describeFile } = await import('../src/models/plugins.js');
  const { Candidate, Application, Referral, Requirement, Enquiry } = await import('../src/models/index.js');
  const stored = { key: 'resumes/2026/01/0b0f5c1e-1111-4222-8333-444455556666.pdf', originalName: 'resume.pdf', mimeType: 'application/pdf', size: 1234, uploadedAt: new Date('2026-01-02T03:04:05Z'), storage: 'local' };

  assert.deepEqual(describeFile(stored), { fileName: 'resume.pdf', mimeType: 'application/pdf', size: 1234, uploadedAt: stored.uploadedAt });
  assert.equal(describeFile(null), null);
  assert.equal(describeFile({ originalName: 'no-key.pdf' }), null);

  const id = '507f1f77bcf86cd799439011';
  const records = [
    [new Candidate({ name: 'A Candidate', email: 'a@example.com', resume: stored }), 'resume'],
    [new Application({ candidateId: id, resume: stored }), 'resume'],
    [new Referral({ referrerName: 'R', referrerEmail: 'r@example.com', candidateName: 'C', resume: stored }), 'resume'],
    [new Requirement({ contactName: 'H', company: 'E', email: 'h@example.com', role: 'Engineers', attachment: stored }), 'attachment'],
    [new Enquiry({ name: 'N', email: 'n@example.com', message: 'Hello', attachment: stored }), 'attachment'],
  ];
  for (const [record, field] of records) {
    // The record keeps the marker and the key (they are saved)...
    assert.equal(record[field].storage, 'local');
    assert.equal(record[field].key, stored.key);
    // ...and the JSON a client receives has neither.
    const sent = record.toJSON();
    assert.deepEqual(Object.keys(sent[field]).sort(), ['fileName', 'mimeType', 'size', 'uploadedAt']);
    assert.ok(!JSON.stringify(sent).includes(stored.key));
    assert.ok(!JSON.stringify(sent).includes('"storage"'));
  }

  // A record saved before the marker existed has none, and none is made up.
  const { storage, ...legacy } = stored;
  assert.equal(new Candidate({ name: 'A Candidate', email: 'a@example.com', resume: legacy }).resume.storage, undefined);
  // Only the three known stores are accepted.
  const invalid = new Candidate({ name: 'A Candidate', email: 'a@example.com', resume: { ...stored, storage: 's3-public' } }).validateSync();
  assert.ok(invalid && invalid.errors['resume.storage']);
});

test('migration: old statuses become NEW or SHORTLISTED plus a label, once', () => {
  const pending = { at: null, byId: null, byName: '', email: { status: 'NOT_SENT', at: null, attempts: 0 } };
  const app = (status, extra = {}) => planApplication({ _id: 1, status, ...extra });

  assert.deepEqual(app('SCREENING'), { $set: { status: 'NEW', labels: [] } });
  assert.deepEqual(app('WITHDRAWN', { labels: [] }), { $set: { status: 'NEW' } });
  assert.deepEqual(app('REJECTED'), { $set: { status: 'NEW', labels: ['REJECTED'] } });
  assert.deepEqual(app('INTERVIEW'), { $set: { status: 'SHORTLISTED', labels: ['INTERVIEWED'], shortlist: pending } });
  assert.deepEqual(app('SELECTED', { labels: ['INTERVIEWED'] }), { $set: { status: 'SHORTLISTED', labels: ['INTERVIEWED', 'SELECTED'], shortlist: pending } });
  assert.deepEqual(app('SHORTLISTED', { labels: [] }), { $set: { shortlist: pending } }, 'no shortlist email is assumed to have been sent');
  assert.deepEqual(app('SOMETHING_ELSE', { labels: [] }), { $set: { status: 'NEW' } });

  // Already in the new shape: nothing to do, so a second run changes nothing.
  assert.equal(app('NEW', { labels: [] }), null);
  assert.equal(app('NEW', { labels: ['REJECTED'] }), null);
  assert.equal(app('SHORTLISTED', { labels: ['SELECTED'], shortlist: { at: new Date(), email: { status: 'SENT' } } }), null);

  assert.deepEqual(planCandidate({ _id: 1, status: 'INTERVIEW' }), { $set: { labels: ['INTERVIEWED'] }, $unset: { status: '' } });
  assert.deepEqual(planCandidate({ _id: 1, status: 'NEW', labels: [] }), { $unset: { status: '' } });
  assert.deepEqual(planCandidate({ _id: 1, status: 'REJECTED', labels: ['SELECTED'] }), { $set: { labels: ['REJECTED', 'SELECTED'] }, $unset: { status: '' } });
  assert.equal(planCandidate({ _id: 1, labels: ['SELECTED'] }), null);
  assert.equal(planCandidate({ _id: 1, labels: [] }), null);
});

test('the shortlist email is fixed wording with the job title as its only variable', () => {
  const withJob = templates.shortlistNotification({ job: { title: 'RTL Design Engineer' } });
  assert.equal(withJob.subject, 'Your application for RTL Design Engineer has been shortlisted');
  assert.match(withJob.text, /has been shortlisted/);
  assert.ok(!/within|guarantee|\d+ (hours|days)/i.test(withJob.text), 'no timeline or outcome is promised');
  assert.equal(templates.shortlistNotification({ job: null }).subject, 'Your application has been shortlisted');
});

test('shortlisting has its own permission, held by recruiters and super admins only', () => {
  assert.equal(roleCan('SUPER_ADMIN', PERMISSIONS.APPLICATIONS_SHORTLIST), true);
  assert.equal(roleCan('RECRUITER', PERMISSIONS.APPLICATIONS_SHORTLIST), true);
  assert.equal(roleCan('HIRING_MANAGER', PERMISSIONS.APPLICATIONS_SHORTLIST), false);
  assert.equal(roleCan('CONTENT_MANAGER', PERMISSIONS.APPLICATIONS_SHORTLIST), false);
});
