import { readFile } from 'node:fs/promises';
import { env } from '../config/env.js';
import {
  User, Session, Job, Candidate, Application, Requirement, Referral, Enquiry, ATSResult,
  Insight, Story, Expertise, Service, Location, AuditLog, SiteSettings,
} from '../models/index.js';
import { hashPassword, generatePassword, passwordProblem } from '../utils/password.js';
import { storePrivateFile } from '../services/storage/privateFiles.js';
import { inspectDocument } from '../utils/fileSniff.js';
import { runEvaluation } from '../services/atsService.js';
import { samplePdf } from './samplePdf.js';

/*
  The development seed's data, as a function. seed.js is the command
  line around it; anything else that needs a filled development
  database (a local end-to-end run, for example) calls it directly.

  seedDatabase() expects the database to be connected already.

  - Refuses to run on a database that already has users, unless
    `reset` is true, in which case every collection is emptied first.
  - What it creates: the users, and the website content and
    configuration the public site shows (insights, stories, expertise,
    services, locations, contact details), exported to
    seed/data/content.json.
  - What it does NOT create: jobs, candidates, applications,
    requirements, referrals, enquiries and ATS results. Those seven
    collections are left empty, so the admin opens on empty lists and
    the site shows no made-up vacancy or recruitment activity.
  - `demoRecruitment: true` (command line: --with-demo-recruitment-data)
    adds the fictional sample jobs and recruitment records as well.
    That is for automated end-to-end runs and for trying the admin on a
    throwaway database. The samples use the reserved example.com
    domain and represent no real person. Never use it on a database
    that is shown to a client: "npm run clean:showcase" is what takes
    such records out again.
  - User passwords are taken from SEED_ADMIN_PASSWORD or generated.
    They are returned to the caller once and are never written to a
    file.

  Returns { counts, credentials }:
    counts       the number of records in each collection, by model name
    credentials  [{ name, email, role, password }] for the seeded users
*/

const data = async (name) => JSON.parse(await readFile(new URL(`./data/${name}.json`, import.meta.url), 'utf8'));

export async function seedDatabase({ reset = false, log = console.log, demoRecruitment = false, sampleFiles = env.fileStorageDriver === 'local' } = {}) {
  const models = [User, Session, Job, Candidate, Application, Requirement, Referral, Enquiry, ATSResult, Insight, Story, Expertise, Service, Location, AuditLog, SiteSettings];

  if (await User.countDocuments({})) {
    if (!reset) throw new Error('This database already has users. Run "npm run seed -- --reset" to empty it and seed again.');
    for (const Model of models) await Model.deleteMany({});
    log('Existing data removed.');
  }

  const content = await data('content');

  // ---- users ----
  const sharedPassword = env.seed.adminPassword;
  if (sharedPassword && passwordProblem(sharedPassword)) throw new Error(`SEED_ADMIN_PASSWORD: ${passwordProblem(sharedPassword)}`);
  const accounts = [
    { name: 'Sample Admin', email: env.seed.adminEmail || 'admin@example.com', role: 'SUPER_ADMIN' },
    { name: 'Sample Recruiter', email: 'recruiter@example.com', role: 'RECRUITER' },
    { name: 'Sample Hiring Manager', email: 'hiring.manager@example.com', role: 'HIRING_MANAGER' },
    { name: 'Sample Content Manager', email: 'content@example.com', role: 'CONTENT_MANAGER' },
  ];
  const credentials = [];
  for (const account of accounts) {
    const password = sharedPassword || generatePassword();
    await User.create({ ...account, passwordHash: await hashPassword(password) });
    credentials.push({ ...account, password });
  }

  // ---- website content and configuration ----
  await Insight.insertMany(content.insights);
  await Story.insertMany(content.stories);
  await Expertise.insertMany(content.expertise);
  await Service.insertMany(content.services);
  await Location.insertMany(content.locations);
  await SiteSettings.create({ key: 'site', contact: content.site.contact, updatedByName: 'Seed' });

  if (demoRecruitment) await seedDemoRecruitment({ content, sampleFiles });

  const counts = {};
  for (const Model of models) counts[Model.modelName] = await Model.countDocuments({});

  return {
    counts,
    credentials: credentials.map(({ name, email, role, password }) => ({ name, email, role, password })),
  };
}

/*
  The fictional sample jobs and recruitment records. Only created when
  seedDatabase() is asked for them (demoRecruitment). With sample files
  on (the default for the local file driver) each sample candidate
  gets a placeholder PDF, so opening a resume can be tried. With B2 no
  sample files are uploaded.
*/
async function seedDemoRecruitment({ content, sampleFiles }) {
  const recruitment = await data('recruitment');
  const jobs = await Job.insertMany(content.jobs.map((job) => ({ ...job, publishedAt: job.publishedAt ? new Date(job.publishedAt) : null })));
  const jobBySlug = new Map(jobs.map((job) => [job.slug, job]));

  const candidateByEmail = new Map();
  for (const sample of recruitment.candidates) {
    const { resumeFileName, createdAt, ...fields } = sample;
    let resume = null;
    if (sampleFiles) {
      const buffer = samplePdf(['SAMPLE RESUME (fictional record, development seed)', '', fields.name, fields.headline, fields.location, '', `Skills: ${fields.skills.join(', ')}`]);
      const inspection = inspectDocument({ buffer, originalName: resumeFileName });
      resume = await storePrivateFile({ buffer, originalName: resumeFileName, inspection, folder: 'resumes' });
    }
    const candidate = await Candidate.create({ ...fields, resume, consentAt: new Date(createdAt), createdAt: new Date(createdAt) });
    candidateByEmail.set(candidate.email, candidate);
  }

  for (const sample of recruitment.applications) {
    const candidate = candidateByEmail.get(sample.candidateEmail);
    const job = jobBySlug.get(sample.jobSlug);
    const application = await Application.create({
      candidateId: candidate._id,
      jobId: job._id,
      status: sample.status,
      labels: sample.labels || [],
      // Shortlisted samples carry no email: none was sent to these
      // fictional addresses.
      shortlist: sample.status === 'SHORTLISTED' ? { at: new Date(sample.submittedAt), byId: null, byName: 'Seed', email: { status: 'NOT_SENT', at: null, attempts: 0 } } : null,
      source: sample.source,
      recruiterNotes: sample.recruiterNotes,
      resume: candidate.resume ? { key: candidate.resume.key, originalName: candidate.resume.originalName, mimeType: candidate.resume.mimeType, size: candidate.resume.size, uploadedAt: candidate.resume.uploadedAt, ...(candidate.resume.storage ? { storage: candidate.resume.storage } : {}) } : null,
      submittedAt: new Date(sample.submittedAt),
    });
    await runEvaluation({ candidateId: candidate._id, jobId: job._id, applicationId: application._id, runByName: 'Seed' });
  }

  const dated = (items) => items.map(({ createdAt, ...rest }) => ({ ...rest, createdAt: new Date(createdAt) }));
  await Requirement.insertMany(dated(recruitment.requirements));
  await Enquiry.insertMany(dated(recruitment.enquiries));
  await Referral.insertMany(dated(recruitment.referrals));
}
