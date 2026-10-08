import { forgetEmails } from './email/emailLog.js';
import { removeLegacyDerivedData } from './legacyDerivedData.js';
import { readFile } from 'node:fs/promises';
import {
  Job, Candidate, Application, Requirement, Referral, Enquiry, ATSResult, ResumeExtraction,
  Insight, Story, Expertise, Service, Location, SiteSettings, User, AuditLog,
} from '../models/index.js';
import { removePrivateFile, listStoredFiles, removeStoredFile, storageHolding } from './storage/privateFiles.js';

/*
  Showcase cleanup - takes the demonstration recruitment data out of a
  development or showcase database, so the admin opens on empty lists
  and the site shows no made-up vacancy or recruitment activity.

  It is used by "npm run clean:showcase" (scripts/clean-showcase.js).
  Nothing in the running application calls it.

  It works in two steps, so that nothing is deleted before it has been
  looked at:
    planShowcaseCleanup()   reads the database and decides, record by
                            record, what would be removed. Changes nothing.
    applyShowcaseCleanup()  carries a plan out.

  What is never touched: users, sessions, insights, stories, expertise,
  services, locations and the site settings.

  What is looked at: jobs, candidates, applications, requirements,
  referrals, enquiries and ATS results, the files those records point
  at, and the audit entries about them.

  Which records count as demonstration data:
  - a record the development seed created: a job with one of the seed's
    slugs, or a candidate, requirement, enquiry or referral with one of
    the seed's email addresses (seed/data/*.json);
  - a record whose email address is on a domain reserved for examples
    and tests (example.com, example.org, example.net, .test, .example,
    .invalid, .localhost). Nobody can own such an address, so it was
    typed in while trying the forms;
  - what belongs to those: the applications and ATS results of a demo
    candidate, an application whose candidate no longer exists, and an
    ATS result whose candidate or job is removed or no longer exists.
  Everything else is treated as possibly real and is kept, with its
  files, unless `all` is asked for. A demo job that still has an
  application from a kept candidate is kept too, and reported, because
  that application would otherwise point at nothing.

  With `all`, every record in the seven collections is removed.

  Files. A file is removed from the store when a removed record points
  at it and no kept record does (an application carries a reference to
  the same file as its candidate). Files that no record points at at
  all are counted and listed; they are removed only when
  `unreferencedFiles` is asked for.

  Audit entries. Entries about a job, candidate, application,
  requirement, referral, enquiry or ATS result that does not exist
  after the cleanup are removed: they would keep the names of the
  removed records on the dashboard. Entries about anything else
  (sign-ins, users, content, settings, images) are kept. One entry is
  added that says the cleanup ran, with the numbers.
*/

const RECRUITMENT = [
  { name: 'Job', Model: Job, audit: 'job' },
  { name: 'Candidate', Model: Candidate, audit: 'candidate' },
  { name: 'Application', Model: Application, audit: 'application' },
  { name: 'Requirement', Model: Requirement, audit: 'requirement' },
  { name: 'Referral', Model: Referral, audit: 'referral' },
  { name: 'Enquiry', Model: Enquiry, audit: 'enquiry' },
  { name: 'ATSResult', Model: ATSResult, audit: 'atsResult' },
];
const PRESERVED = [
  { name: 'User', Model: User },
  { name: 'Insight', Model: Insight },
  { name: 'Story', Model: Story },
  { name: 'Expertise', Model: Expertise },
  { name: 'Service', Model: Service },
  { name: 'Location', Model: Location },
  { name: 'SiteSettings', Model: SiteSettings },
];
const FILE_FIELDS = { Candidate: 'resume', Application: 'resume', Referral: 'resume', Requirement: 'attachment', Enquiry: 'attachment' };

const seedFile = async (name) => JSON.parse(await readFile(new URL(`../seed/data/${name}.json`, import.meta.url), 'utf8'));
const lower = (value) => String(value || '').trim().toLowerCase();

// Domains nobody can register (RFC 2606 and RFC 6761).
export function isReservedAddress(email) {
  const domain = lower(email).split('@')[1] || '';
  if (!domain) return false;
  return /(^|\.)example\.(com|org|net)$/.test(domain) || /(^|\.)(test|example|invalid|localhost)$/.test(domain);
}

async function seedKeys() {
  const [content, recruitment] = await Promise.all([seedFile('content'), seedFile('recruitment')]);
  return {
    jobSlugs: new Set((content.jobs || []).map((job) => lower(job.slug))),
    candidateEmails: new Set((recruitment.candidates || []).map((item) => lower(item.email))),
    requirementEmails: new Set((recruitment.requirements || []).map((item) => lower(item.email))),
    enquiryEmails: new Set((recruitment.enquiries || []).map((item) => lower(item.email))),
    referrerEmails: new Set((recruitment.referrals || []).map((item) => lower(item.referrerEmail))),
  };
}

const idOf = (value) => (value ? String(value) : '');
const describe = {
  Job: (doc) => `${doc.title} (${doc.slug}, ${doc.status})`,
  Candidate: (doc) => `${doc.name} <${doc.email}>`,
  Application: (doc, context) => `application of ${context.candidateLabel(doc.candidateId)} for ${context.jobLabel(doc.jobId)}`,
  Requirement: (doc) => `${doc.role || 'requirement'} from ${doc.contactName} <${doc.email}>`,
  Referral: (doc) => `${doc.candidateName} referred by ${doc.referrerName} <${doc.referrerEmail}>`,
  Enquiry: (doc) => `${doc.subject || 'enquiry'} from ${doc.name} <${doc.email}>`,
  ATSResult: (doc, context) => `evaluation of ${context.candidateLabel(doc.candidateId)} for ${context.jobLabel(doc.jobId)}`,
};

/*
  planShowcaseCleanup - reads everything and decides. Returns
    {
      all,
      collections: { <Model name>: { total, remove: [{ id, label, reason }], keep: [{ id, label, reason }] } },
      preserved:   { <Model name>: count },
      files:       { remove: [file], keptWithRecords: n, noLongerReachable: n },
      audit:       { remove: n, total: n },
    }
*/
export async function planShowcaseCleanup({ all = false } = {}) {
  const seed = await seedKeys();
  const docs = {};
  for (const { name, Model } of RECRUITMENT) docs[name] = await Model.find({});

  const candidateById = new Map(docs.Candidate.map((doc) => [idOf(doc._id), doc]));
  const jobById = new Map(docs.Job.map((doc) => [idOf(doc._id), doc]));
  const context = {
    candidateLabel: (id) => (candidateById.get(idOf(id)) ? `${candidateById.get(idOf(id)).name} <${candidateById.get(idOf(id)).email}>` : 'a candidate that no longer exists'),
    jobLabel: (id) => (!id ? 'no particular job' : jobById.get(idOf(id)) ? `"${jobById.get(idOf(id)).title}"` : 'a job that no longer exists'),
  };

  const decisions = Object.fromEntries(RECRUITMENT.map(({ name }) => [name, { total: docs[name].length, remove: [], keep: [] }]));
  const removed = Object.fromEntries(RECRUITMENT.map(({ name }) => [name, new Set()]));
  const decide = (name, doc, remove, reason) => {
    decisions[name][remove ? 'remove' : 'keep'].push({ id: idOf(doc._id), label: describe[name](doc, context), reason });
    if (remove) removed[name].add(idOf(doc._id));
  };
  const byAddress = (email, seeded) => {
    if (seeded.has(lower(email))) return 'created by the development seed';
    if (isReservedAddress(email)) return 'its email address is on a domain reserved for examples';
    return '';
  };

  // Candidates, requirements, enquiries, referrals: by address.
  for (const doc of docs.Candidate) {
    const demo = byAddress(doc.email, seed.candidateEmails);
    decide('Candidate', doc, all || Boolean(demo), demo || (all ? 'every record is removed (--all)' : 'not recognised as demonstration data'));
  }
  for (const [name, field, seeded] of [['Requirement', 'email', seed.requirementEmails], ['Enquiry', 'email', seed.enquiryEmails], ['Referral', 'referrerEmail', seed.referrerEmails]]) {
    for (const doc of docs[name]) {
      const demo = byAddress(doc[field], seeded);
      decide(name, doc, all || Boolean(demo), demo || (all ? 'every record is removed (--all)' : 'not recognised as demonstration data'));
    }
  }

  // Applications follow their candidate.
  for (const doc of docs.Application) {
    const candidate = candidateById.get(idOf(doc.candidateId));
    if (all) decide('Application', doc, true, 'every record is removed (--all)');
    else if (!candidate) decide('Application', doc, true, 'its candidate no longer exists');
    else if (removed.Candidate.has(idOf(candidate._id))) decide('Application', doc, true, 'its candidate is demonstration data');
    else decide('Application', doc, false, 'its candidate is kept');
  }

  // Jobs: the seed's jobs go, unless a kept application still points at one.
  const keptApplicationsByJob = new Map();
  for (const doc of docs.Application) {
    if (removed.Application.has(idOf(doc._id)) || !doc.jobId) continue;
    keptApplicationsByJob.set(idOf(doc.jobId), (keptApplicationsByJob.get(idOf(doc.jobId)) || 0) + 1);
  }
  for (const doc of docs.Job) {
    const seeded = seed.jobSlugs.has(lower(doc.slug));
    const held = keptApplicationsByJob.get(idOf(doc._id)) || 0;
    if (all) decide('Job', doc, true, 'every record is removed (--all)');
    else if (seeded && held) decide('Job', doc, false, `a demo job, kept because ${held} application${held === 1 ? '' : 's'} from a kept candidate point${held === 1 ? 's' : ''} at it`);
    else if (seeded) decide('Job', doc, true, 'created by the development seed');
    else decide('Job', doc, false, 'not recognised as demonstration data');
  }

  // ATS results follow their candidate and their job.
  for (const doc of docs.ATSResult) {
    const candidateGone = !candidateById.has(idOf(doc.candidateId)) || removed.Candidate.has(idOf(doc.candidateId));
    const jobGone = !jobById.has(idOf(doc.jobId)) || removed.Job.has(idOf(doc.jobId));
    if (all) decide('ATSResult', doc, true, 'every record is removed (--all)');
    else if (candidateGone) decide('ATSResult', doc, true, 'its candidate is removed or no longer exists');
    else if (jobGone) decide('ATSResult', doc, true, 'its job is removed or no longer exists');
    else decide('ATSResult', doc, false, 'its candidate and job are kept');
  }

  // Files: of removed records, unless a kept record points at the same file.
  const keptKeys = new Set();
  const candidates = new Map();
  let keptWithRecords = 0;
  for (const [name, field] of Object.entries(FILE_FIELDS)) {
    for (const doc of docs[name]) {
      const file = doc[field];
      if (!file?.key) continue;
      if (removed[name].has(idOf(doc._id))) candidates.set(file.key, file.toObject ? file.toObject() : { ...file });
      else { keptKeys.add(file.key); keptWithRecords += 1; }
    }
  }
  const filesToRemove = [...candidates.values()].filter((file) => !keptKeys.has(file.key));

  // Audit entries about recruitment records that will not exist afterwards.
  const survivors = new Map(RECRUITMENT.map(({ name, audit }) => [audit, new Set(docs[name].filter((doc) => !removed[name].has(idOf(doc._id))).map((doc) => idOf(doc._id)))]));
  const auditTotal = await AuditLog.countDocuments({});
  const auditEntries = await AuditLog.find({ entityType: { $in: [...survivors.keys()] } });
  const auditRemove = auditEntries.filter((entry) => !survivors.get(entry.entityType).has(idOf(entry.entityId))).map((entry) => entry._id);

  const preserved = {};
  for (const { name, Model } of PRESERVED) preserved[name] = await Model.countDocuments({});

  return {
    all,
    collections: decisions,
    preserved,
    files: { remove: filesToRemove, keptWithRecords },
    audit: { remove: auditRemove, total: auditTotal },
  };
}

/*
  applyShowcaseCleanup - carries a plan out, in this order: the files
  (while the records that point at them still exist), then the records,
  then the audit entries. A file that cannot be removed does not stop
  the rest: it is returned in `filesFailed` and is found again by
  inspectStoredFiles(). A file held by a provider this server no
  longer uses cannot be removed from here and is counted in
  `filesUnreachable`.
*/
export async function applyShowcaseCleanup(plan, { actorName = 'System' } = {}) {
  const done = { records: {}, filesRemoved: 0, filesUnreachable: 0, filesFailed: [], auditRemoved: 0 };

  for (const file of plan.files.remove) {
    try {
      if (!(await storageHolding(file))) {
        done.filesUnreachable += 1;
        continue;
      }
      await removePrivateFile(file);
      done.filesRemoved += 1;
    } catch (error) {
      done.filesFailed.push({ name: file.originalName, reason: error.message });
    }
  }

  for (const { name, Model } of RECRUITMENT) {
    const ids = plan.collections[name].remove.map((item) => item.id);
    done.records[name] = ids.length ? (await Model.deleteMany({ _id: { $in: ids } })).deletedCount ?? ids.length : 0;
  }

  // The email record of the removed records goes with them. It holds
  // ids and outcomes only, and would otherwise point at nothing.
  for (const [name, entityType] of [['Application', 'application'], ['Requirement', 'requirement'], ['Referral', 'referral'], ['Enquiry', 'enquiry']]) {
    await forgetEmails(entityType, plan.collections[name].remove.map((item) => item.id));
  }

  // A kept job may hold an AI comparison that includes a removed
  // candidate. A comparison is about all of its candidates together,
  // so it goes with any one of them.
  const removedCandidates = plan.collections.Candidate.remove.map((item) => item.id);
  if (removedCandidates.length) {
    // The resume extraction drafts of a removed candidate go with them.
    await ResumeExtraction.deleteMany({ candidateId: { $in: removedCandidates } });
    await removeLegacyDerivedData({ candidateIds: removedCandidates });
    await Job.updateMany({ 'candidateComparison.candidates.candidateId': { $in: removedCandidates } }, { $set: { candidateComparison: null } }, { timestamps: false });
  }

  if (plan.audit.remove.length) {
    done.auditRemoved = (await AuditLog.deleteMany({ _id: { $in: plan.audit.remove } })).deletedCount ?? plan.audit.remove.length;
  }

  const total = Object.values(done.records).reduce((sum, count) => sum + count, 0);
  await AuditLog.create({
    actorName,
    action: 'system.showcase_cleanup',
    entityType: 'system',
    summary: `Showcase cleanup removed ${total} demonstration recruitment records${plan.all ? ' (every record)' : ''}`,
    metadata: { records: done.records, files: done.filesRemoved, auditEntries: done.auditRemoved },
  });
  return done;
}

/*
  inspectStoredFiles - what the stores hold compared with what the
  records point at. Returns
    { stored, referenced, unreferenced: [{ storage, key }], unreachable: n }
  `unreferenced` are files no record points at (for example the sample
  resumes of an earlier seed run that was reset). `unreachable` counts
  records that point at a file this server cannot reach (stored with a
  provider that is no longer used).
*/
export async function inspectStoredFiles() {
  const keys = new Set();
  let unreachable = 0;
  for (const [name, field] of Object.entries(FILE_FIELDS)) {
    const Model = RECRUITMENT.find((item) => item.name === name).Model;
    for (const doc of await Model.find({})) {
      const file = doc[field];
      if (!file?.key) continue;
      keys.add(file.key);
      if (file.storage === 'r2') unreachable += 1;
    }
  }
  const stored = await listStoredFiles();
  return {
    stored: stored.length,
    referenced: stored.filter((file) => keys.has(file.key)).length,
    unreferenced: stored.filter((file) => !keys.has(file.key)),
    unreachable,
  };
}

export async function removeUnreferencedFiles(files) {
  let removed = 0;
  const failed = [];
  for (const file of files) {
    try {
      await removeStoredFile(file);
      removed += 1;
    } catch (error) {
      failed.push({ key: file.key, reason: error.message });
    }
  }
  return { removed, failed };
}

// The number of records in each collection, for the report.
export async function countCollections() {
  const counts = {};
  for (const { name, Model } of [...PRESERVED, ...RECRUITMENT]) counts[name] = await Model.countDocuments({});
  counts.AuditLog = await AuditLog.countDocuments({});
  return counts;
}

export const RECRUITMENT_COLLECTIONS = RECRUITMENT.map((item) => item.name);
export const PRESERVED_COLLECTIONS = PRESERVED.map((item) => item.name);
