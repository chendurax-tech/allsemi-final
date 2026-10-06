import { test } from 'node:test';
import assert from 'node:assert/strict';

process.env.NODE_ENV = 'test';
process.env.SESSION_SECRET = 'test-only-session-secret-0123456789-abcdefghij';

const { hashPassword, verifyPassword, needsRehash, passwordProblem, generatePassword } = await import('../src/utils/password.js');
const { detectFileType, inspectDocument, inspectImage, imageDimensions } = await import('../src/utils/fileSniff.js');
const { cleanText, cleanList, escapeHtml, safeFileName, slugify } = await import('../src/utils/sanitize.js');
const { evaluate, skillKey } = await import('../src/services/atsService.js');
const { weightsFor, WEIGHTS, PROFILE_DEFAULT_WEIGHTS, ENGINE_VERSION } = await import('../src/services/atsService.js');
const { parseRequirements, parseCandidates } = await import('../src/services/aiService.js');
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

// ---------------------------------------------------------------------
// The rule-based ATS with and without a job requirement profile. Every
// expected number below is worked out by hand in the comment next to
// it, from the rules written at the top of services/atsService.js.
// ---------------------------------------------------------------------
const PROFILE_JOB = {
  title: 'Design Verification Engineer', category: 'Semiconductor', department: 'Verification', location: 'Bengaluru, India', experienceLevel: 'Mid-Senior',
  requiredSkills: ['SystemVerilog', 'UVM', 'Formal Verification', 'Assertions'], preferredSkills: ['Python', 'Perl'],
};
// No resume, so the profile is seven eighths complete: 87.5, rounded 88.
const PROFILE_CANDIDATE = {
  skills: ['UVM', 'System Verilog', 'Python', 'VCS'], experienceYears: 2, domain: 'Semiconductor', headline: 'Verification Engineer',
  location: 'Pune, India', phone: '+91 90000 41001', noticePeriod: '30 days', education: [{ degree: 'B.Tech Electronics', institution: 'Example Institute of Technology' }],
};
const REQUIREMENT_PROFILE = {
  requiredSkills: ['UVM', 'Formal Verification'],
  preferredSkills: [],
  tools: ['VCS', 'Verdi', 'JasperGold'],
  domains: ['Semiconductor'],
  minYears: 2,
  preferredYears: 6,
  education: ['B.Tech Electronics'],
  certifications: ['PMP'],
  workArrangement: 'HYBRID',
  responsibilities: ['Write the verification plan', 'Close coverage'],
  niceToHave: ['Open source contributions'],
  constraints: ['Night shift support'],
  weights: null,
};
const OWN_WEIGHTS = { skills: 50, experience: 10, preferredSkills: 0, tools: 20, domain: 10, location: 10, completeness: 0 };
const checkNamed = (result, rule) => result.checks.find((check) => check.rule === rule);

test('rule-based ATS: a job without a requirement profile is scored with the fixed baseline weights', () => {
  assert.deepEqual(WEIGHTS, { skills: 45, experience: 20, preferredSkills: 10, domain: 10, location: 10, completeness: 5 });
  assert.equal(ENGINE_VERSION, '2');
  assert.deepEqual(weightsFor(PROFILE_JOB), { weights: WEIGHTS, source: 'BASELINE' });
  assert.deepEqual(weightsFor({ ...PROFILE_JOB, requirementProfile: null }), { weights: WEIGHTS, source: 'BASELINE' });

  const result = evaluate(PROFILE_CANDIDATE, PROFILE_JOB);
  assert.deepEqual(evaluate(PROFILE_CANDIDATE, PROFILE_JOB), result, 'same inputs, same result');
  assert.deepEqual(evaluate(PROFILE_CANDIDATE, { ...PROFILE_JOB, requirementProfile: null }), result, 'a profile that is null is no profile');

  assert.deepEqual(result.weights, { skills: 45, experience: 20, preferredSkills: 10, domain: 10, location: 10, completeness: 5 });
  assert.equal(result.weightSource, 'BASELINE');
  assert.equal(result.usedRequirementProfile, false);
  assert.equal(result.engineVersion, '2');
  // Required: SystemVerilog and UVM of four. "System Verilog" is the same skill.
  assert.deepEqual(result.requiredSkills, PROFILE_JOB.requiredSkills);
  assert.deepEqual(result.matchedSkills, ['SystemVerilog', 'UVM']);
  assert.deepEqual(result.missingSkills, ['Formal Verification', 'Assertions']);
  assert.equal(result.skillScore, 50);
  // Preferred: Python of two.
  assert.deepEqual(result.preferredMatched, ['Python']);
  assert.deepEqual(result.preferredMissing, ['Perl']);
  assert.equal(result.preferredSkillScore, 50);
  // Mid-Senior is 4+ years, 2 are stated: 2 / 4.
  assert.equal(result.experienceScore, 50);
  assert.equal(result.domainScore, 100);
  // Pune for a role in Bengaluru.
  assert.equal(result.locationScore, 40);
  assert.equal(result.completenessScore, 88);
  // Tools only exist for a job with a profile.
  assert.equal(result.toolScore, null);
  assert.deepEqual([result.toolsMatched, result.toolsMissing], [[], []]);
  // 50*45 + 50*20 + 50*10 + 100*10 + 40*10 + 88*5 = 5590, over 100 = 55.9
  assert.equal(result.totalScore, 56);
  assert.equal(result.band, 'Partial match');
  assert.deepEqual(result.checks.map((check) => check.rule), ['Required skills', 'Experience level', 'Preferred skills', 'Domain relevance', 'Location', 'Profile completeness', 'Notice period']);
  assert.deepEqual(result.checks.map((check) => check.weight), [45, 20, 10, 10, 10, 5, null]);

  // A part that does not apply is left out and the rest is rescaled.
  const smaller = evaluate(PROFILE_CANDIDATE, { ...PROFILE_JOB, preferredSkills: [], location: '' });
  assert.deepEqual(smaller.weights, { skills: 45, experience: 20, domain: 10, completeness: 5 });
  assert.equal(smaller.weightSource, 'BASELINE');
  // 50*45 + 50*20 + 100*10 + 88*5 = 4690, over 80 = 58.6
  assert.equal(smaller.totalScore, 59);
  assert.equal(smaller.preferredSkillScore, null);
});

test('rule-based ATS: a job with a requirement profile is scored against the profile', () => {
  assert.deepEqual(PROFILE_DEFAULT_WEIGHTS, { skills: 40, experience: 20, preferredSkills: 10, tools: 10, domain: 10, location: 5, completeness: 5 });
  const withDefaults = { ...PROFILE_JOB, requirementProfile: REQUIREMENT_PROFILE };
  const withOwn = { ...PROFILE_JOB, requirementProfile: { ...REQUIREMENT_PROFILE, weights: OWN_WEIGHTS } };
  assert.deepEqual(weightsFor(withDefaults), { weights: PROFILE_DEFAULT_WEIGHTS, source: 'PROFILE' });
  assert.deepEqual(weightsFor(withOwn), { weights: OWN_WEIGHTS, source: 'JOB' });

  // The profile, with the starting weights of a profile.
  const profiled = evaluate(PROFILE_CANDIDATE, withDefaults);
  assert.deepEqual(evaluate(PROFILE_CANDIDATE, withDefaults), profiled, 'same inputs, same result');
  assert.equal(profiled.usedRequirementProfile, true);
  assert.equal(profiled.weightSource, 'PROFILE');
  assert.deepEqual(profiled.weights, PROFILE_DEFAULT_WEIGHTS);
  // The profile's required skills, not the job's four.
  assert.deepEqual(profiled.requiredSkills, ['UVM', 'Formal Verification']);
  assert.deepEqual(profiled.matchedSkills, ['UVM']);
  assert.deepEqual(profiled.missingSkills, ['Formal Verification']);
  assert.equal(profiled.skillScore, 50);
  // The profile lists no preferred skills, so the job's own are used.
  assert.deepEqual(profiled.preferredMatched, ['Python']);
  assert.deepEqual(profiled.preferredMissing, ['Perl']);
  assert.equal(profiled.preferredSkillScore, 50);
  // Tools are a part of their own: VCS of three, 33.3.
  assert.deepEqual(profiled.toolsMatched, ['VCS']);
  assert.deepEqual(profiled.toolsMissing, ['Verdi', 'JasperGold']);
  assert.equal(profiled.toolScore, 33);
  // The profile asks for 2+ years, which replaces the 4+ of Mid-Senior.
  assert.equal(profiled.experienceScore, 100);
  assert.match(checkNamed(profiled, 'Experience level').detail, /requirement profile asks for 2\+ years/);
  assert.equal(profiled.domainScore, 100);
  // The profile says hybrid, so the city no longer counts.
  assert.equal(profiled.locationScore, 100);
  assert.equal(profiled.completenessScore, 88);
  // 50*40 + 100*20 + 50*10 + 33*10 + 100*10 + 100*5 + 88*5 = 6770, over 100 = 67.7
  assert.equal(profiled.totalScore, 68);
  assert.equal(checkNamed(profiled, 'Tools and technologies').weight, 10);
  assert.equal(checkNamed(profiled, 'Tools and technologies').score, 33);

  // The same profile with the job's own weights: a different total.
  const own = evaluate(PROFILE_CANDIDATE, withOwn);
  assert.equal(own.weightSource, 'JOB');
  // A weight of 0 leaves the part out of the weights and the score...
  assert.deepEqual(own.weights, { skills: 50, experience: 10, tools: 20, domain: 10, location: 10 });
  // 50*50 + 100*10 + 33*20 + 100*10 + 100*10 = 6160, over 100 = 61.6
  assert.equal(own.totalScore, 62);
  assert.notEqual(own.totalScore, profiled.totalScore);
  assert.notEqual(own.totalScore, evaluate(PROFILE_CANDIDATE, PROFILE_JOB).totalScore, 'and not the baseline total (56) either');
  // ...and keeps its check on the list, marked as not counted.
  for (const rule of ['Preferred skills', 'Profile completeness']) {
    const check = checkNamed(own, rule);
    assert.equal(check.weight, 0, rule);
    assert.match(check.detail, /Not counted in the score for this job\.$/, rule);
    assert.equal(typeof check.score, 'number', `${rule}: the part is still worked out`);
  }
  assert.equal(own.preferredSkillScore, 50);
  assert.equal(own.completenessScore, 88);
  // The parts themselves are the same: only their weight changed.
  for (const key of ['skillScore', 'experienceScore', 'toolScore', 'domainScore', 'locationScore', 'matchedSkills', 'missingSkills', 'toolsMatched', 'toolsMissing']) {
    assert.deepEqual(own[key], profiled[key], key);
  }

  // One part carrying all the weight gives that part's score.
  const only = (key) => evaluate(PROFILE_CANDIDATE, { ...PROFILE_JOB, requirementProfile: { ...REQUIREMENT_PROFILE, weights: { skills: 0, experience: 0, preferredSkills: 0, tools: 0, domain: 0, location: 0, completeness: 0, [key]: 100 } } });
  assert.deepEqual([only('skills').totalScore, only('experience').totalScore, only('tools').totalScore, only('completeness').totalScore], [50, 100, 33, 88]);
  assert.deepEqual(only('tools').weights, { tools: 100 });
  // Weights are proportions: they need not add up to 100.
  const halved = evaluate(PROFILE_CANDIDATE, { ...PROFILE_JOB, requirementProfile: { ...REQUIREMENT_PROFILE, weights: { skills: 25, experience: 5, preferredSkills: 0, tools: 10, domain: 5, location: 5, completeness: 0 } } });
  assert.equal(halved.totalScore, own.totalScore);
});

test('rule-based ATS: education, certifications and other requirements of a profile are listed and never scored', () => {
  const job = { ...PROFILE_JOB, requirementProfile: { ...REQUIREMENT_PROFILE, weights: OWN_WEIGHTS } };
  const result = evaluate(PROFILE_CANDIDATE, job);

  const education = checkNamed(result, 'Education');
  assert.deepEqual([education.result, education.score, education.weight], ['pass', null, null]);
  assert.match(education.detail, /Named in the profile: B\.Tech Electronics\./);
  assert.match(education.detail, /Not scored: check the resume\./);
  const certifications = checkNamed(result, 'Certifications');
  assert.deepEqual([certifications.result, certifications.score, certifications.weight], ['review', null, null]);
  assert.match(certifications.detail, /Not found by name: PMP\./);
  const other = checkNamed(result, 'Other requirements');
  assert.deepEqual([other.result, other.score, other.weight], ['info', null, null]);
  assert.match(other.detail, /1 other constraint, 1 nice-to-have requirement, 2 key responsibilities/);
  const preferred = checkNamed(result, 'Preferred experience');
  assert.deepEqual([preferred.result, preferred.score, preferred.weight], ['info', null, null]);
  assert.match(preferred.detail, /prefers 6\+ years\. 2 years stated\. Not scored\./);

  // Take them all away, or make every one of them unmet: the same total
  // and the same weights, because none of them is part of the score.
  const { education: e, certifications: c, constraints: k, niceToHave: n, responsibilities: r, preferredYears: y, ...scoredOnly } = job.requirementProfile;
  const without = evaluate(PROFILE_CANDIDATE, { ...PROFILE_JOB, requirementProfile: scoredOnly });
  assert.equal(without.totalScore, result.totalScore);
  assert.deepEqual(without.weights, result.weights);
  for (const rule of ['Education', 'Certifications', 'Other requirements', 'Preferred experience']) assert.equal(checkNamed(without, rule), undefined, rule);
  const unmet = evaluate(PROFILE_CANDIDATE, { ...PROFILE_JOB, requirementProfile: { ...job.requirementProfile, education: ['PhD in Photonics'], certifications: ['PMP', 'CISSP', 'Six Sigma'], preferredYears: 40, constraints: Array.from({ length: 12 }, (_, i) => `Constraint ${i}`) } });
  assert.equal(unmet.totalScore, result.totalScore);
  assert.equal(checkNamed(unmet, 'Education').result, 'review');
  // Every check that is not scored says so with a null score and weight.
  for (const check of result.checks.filter((item) => item.weight === null)) assert.equal(check.score, null, check.rule);
  assert.ok(result.checks.every((check) => check.rule && check.detail));
});

test('rule-based ATS: the weights of a job are read defensively', () => {
  const job = (weights) => ({ ...PROFILE_JOB, requirementProfile: { ...REQUIREMENT_PROFILE, weights } });
  // All zero, or not an object: nothing to score with, so the profile defaults.
  assert.deepEqual(weightsFor(job({ skills: 0, experience: 0, preferredSkills: 0, tools: 0, domain: 0, location: 0, completeness: 0 })), { weights: PROFILE_DEFAULT_WEIGHTS, source: 'PROFILE' });
  assert.deepEqual(weightsFor(job({})), { weights: PROFILE_DEFAULT_WEIGHTS, source: 'PROFILE' });
  assert.deepEqual(weightsFor(job('skills=100')), { weights: PROFILE_DEFAULT_WEIGHTS, source: 'PROFILE' });
  // A missing, negative or unreadable part counts for nothing; a part
  // above 100 is capped; a decimal is rounded; an unknown part is ignored.
  assert.deepEqual(weightsFor(job({ skills: 250, experience: -5, tools: 'many', domain: 9.6, bonus: 80 })), {
    weights: { skills: 100, experience: 0, preferredSkills: 0, tools: 0, domain: 10, location: 0, completeness: 0 }, source: 'JOB',
  });
  // What is returned is a copy: changing it changes no later evaluation.
  weightsFor(PROFILE_JOB).weights.skills = 1;
  weightsFor(job(null)).weights.skills = 1;
  assert.equal(WEIGHTS.skills, 45);
  assert.equal(PROFILE_DEFAULT_WEIGHTS.skills, 40);
});

test('AI draft of a requirement profile: the answer is validated and returned in the shape a profile is stored in', () => {
  const answer = (overrides = {}) => ({
    requiredSkills: ['UVM', 'uvm', '<b>SystemVerilog</b>'], preferredSkills: [], tools: ['VCS'], domains: ['Semiconductor'],
    requiredExperience: 'Block-level verification.', minimumYears: 4.4, preferredExperience: '', preferredYears: null,
    education: ['B.Tech'], certifications: [], seniority: '', location: '', workArrangement: 'NOT_STATED',
    responsibilities: ['Plan'], niceToHave: [], constraints: [],
    suggestedWeights: { skills: 50, experience: 20, preferredSkills: 0, tools: 15, domain: 10, location: 5, completeness: 0 },
    uncertainties: ['The level is not stated.'],
    ...overrides,
  });
  const draft = parseRequirements(JSON.stringify(answer()));
  assert.deepEqual(Object.keys(draft).sort(), [
    'certifications', 'constraints', 'domains', 'education', 'location', 'minYears', 'niceToHave', 'preferredExperience', 'preferredSkills', 'preferredYears',
    'requiredExperience', 'requiredSkills', 'responsibilities', 'seniority', 'tools', 'uncertainties', 'weights', 'workArrangement',
  ]);
  assert.deepEqual(draft.requiredSkills, ['UVM', 'SystemVerilog'], 'no repeats and no markup');
  assert.equal(draft.minYears, 4, 'minimumYears becomes minYears, as a whole number');
  assert.equal(draft.preferredYears, null);
  assert.equal(draft.workArrangement, '', 'NOT_STATED is stored as empty');
  assert.deepEqual(draft.weights, answer().suggestedWeights);
  assert.equal(parseRequirements(JSON.stringify(answer({ workArrangement: 'REMOTE' }))).workArrangement, 'REMOTE');
  // Weights that add up to nothing mean "use the defaults".
  assert.equal(parseRequirements(JSON.stringify(answer({ suggestedWeights: { skills: 0, experience: 0, preferredSkills: 0, tools: 0, domain: 0, location: 0, completeness: 0 } }))).weights, null);

  const without = (key) => { const value = answer(); delete value[key]; return value; };
  const refused = {
    'not JSON': 'Here is the profile.',
    'a missing key': without('constraints'),
    'no weights': without('suggestedWeights'),
    'an extra key': { ...answer(), status: 'published' },
    'an extra weight': answer({ suggestedWeights: { ...answer().suggestedWeights, salary: 10 } }),
    'a missing weight': answer({ suggestedWeights: { skills: 50, experience: 50 } }),
    'weights as text': answer({ suggestedWeights: { skills: '50', experience: '20', preferredSkills: '0', tools: '15', domain: '10', location: '5', completeness: '0' } }),
    'a weight above 100': answer({ suggestedWeights: { ...answer().suggestedWeights, skills: 101 } }),
    'years above the limit': answer({ minimumYears: 500 }),
    'negative years': answer({ preferredYears: -1 }),
    'years as text': answer({ minimumYears: '4' }),
    'an unknown work arrangement': answer({ workArrangement: 'SOMETIMES' }),
    'a list that is text': answer({ tools: 'VCS, Verdi' }),
  };
  for (const [label, value] of Object.entries(refused)) {
    assert.equal(parseRequirements(typeof value === 'string' ? value : JSON.stringify(value)), null, label);
  }
});

test('AI comparison of several candidates: the answer must hold every label that was sent, once', () => {
  const entry = (label, overallFit = 70) => ({ label, overallFit, standing: `${label} compared with the others.`, strengths: ['UVM'], gaps: [], transferableSkills: [], uncertainties: [] });
  const answer = (candidates, overrides = {}) => JSON.stringify({ summary: 'Two profiles compared.', candidates, requirements: [{ requirement: 'UVM', comparison: 'Candidate A states it.' }], considerations: ['Check the dates.'], ...overrides });
  const labels = ['Candidate A', 'Candidate B'];

  // Returned in the order sent, whatever order the model used.
  const parsed = parseCandidates(answer([entry('Candidate B', 41.6), entry('Candidate A', 88)]), labels);
  assert.deepEqual(parsed.candidates.map((item) => [item.label, item.overallFit]), [['Candidate A', 88], ['Candidate B', 42]]);
  assert.equal(parsed.summary, 'Two profiles compared.');

  assert.equal(parseCandidates(answer([entry('Candidate A')]), labels), null, 'a candidate is missing');
  assert.equal(parseCandidates(answer([entry('Candidate A'), entry('Candidate A')]), labels), null, 'a label is repeated');
  assert.equal(parseCandidates(answer([entry('Candidate A'), entry('Candidate B'), entry('Candidate A')]), labels), null, 'a label is repeated next to a full set');
  assert.equal(parseCandidates(answer([entry('Candidate A'), entry('Candidate Z')]), labels), null, 'a label that was not sent');
  assert.equal(parseCandidates(answer([entry('Candidate A'), entry('Candidate B'), entry('Candidate C')]), labels), null, 'one candidate too many');
  assert.equal(parseCandidates(answer([entry('candidate a'), entry('Candidate B')]), labels), null, 'the label must be unchanged');
  assert.equal(parseCandidates(answer([entry('Candidate A', 140), entry('Candidate B')]), labels), null, 'a fit above 100');
  assert.equal(parseCandidates(answer([{ ...entry('Candidate A'), status: 'REJECTED' }, entry('Candidate B')]), labels), null, 'an extra key on a candidate');
  assert.equal(parseCandidates(answer([entry('Candidate A'), entry('Candidate B')], { shortlist: ['Candidate A'] }), labels), null, 'an extra key on the answer');
  assert.equal(parseCandidates(answer([entry('Candidate A'), entry('Candidate B')], { summary: '' }), labels), null, 'an empty summary');
  assert.equal(parseCandidates('not json', labels), null);
});
