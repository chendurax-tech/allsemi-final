import { Candidate, Application, ATSResult, Referral, Job, ResumeExtraction } from '../models/index.js';
import { removeLegacyDerivedData } from './legacyDerivedData.js';
import { removePrivateFile } from './storage/privateFiles.js';
import { forgetEmails } from './email/emailLog.js';
import { logger } from '../utils/logger.js';

/*
  Candidate records.

  One candidate per email address, so a person who applies twice does
  not become two records.

  The public application form is not signed in, and an email address is
  not a secret. A submission that names an address which already has a
  record therefore never changes that record or anything stored for it:
  - the profile is left exactly as it is;
  - the resume on the profile is left as it is, and no stored file is
    deleted;
  - an earlier application is never edited. Every submission becomes
    its own application, carrying the profile details and the resume
    that were sent with it.
  A recruiter sees the new application next to the existing profile and
  updates the profile in the admin if the details are right. Without
  this rule, anyone who knew a candidate's email could overwrite their
  application or replace their resume through the public form.

  Staff actions (converting a referral) are signed in and may fill in a
  profile: see linkCandidate.
*/

const PROFILE_FIELDS = ['name', 'phone', 'location', 'preferredLocation', 'headline', 'domain', 'experienceYears', 'skills', 'noticePeriod', 'expectedCompensation', 'profileUrl'];
const FILL_IF_EMPTY = ['phone', 'location', 'headline', 'domain', 'summary', 'noticePeriod', 'expectedCompensation', 'profileUrl', 'preferredLocation'];

const isDuplicateKey = (error) => error?.code === 11000;

// The profile details as they were submitted, for the application.
export function profileSnapshot(profile) {
  const snapshot = {};
  for (const field of PROFILE_FIELDS) {
    if (profile[field] !== undefined) snapshot[field] = profile[field];
  }
  return snapshot;
}

/*
  findOrCreateCandidate - used by the public application form.
  A new address gets a candidate built from the submission. A known
  address gets its existing record back, untouched.
*/
export async function findOrCreateCandidate(profile, { resume = null, source = 'WEBSITE', consent = false } = {}) {
  const existing = await Candidate.findOne({ email: profile.email });
  if (existing) return { candidate: existing, created: false };
  try {
    const candidate = await Candidate.create({ ...profile, source, resume, consentAt: consent ? new Date() : null });
    return { candidate, created: true };
  } catch (error) {
    // Two first submissions from one address at the same moment: the
    // unique index lets one through, and the other uses that record.
    if (!isDuplicateKey(error)) throw error;
    const candidate = await Candidate.findOne({ email: profile.email });
    if (!candidate) throw error;
    return { candidate, created: false };
  }
}

/*
  linkCandidate - used by signed-in staff actions only (referral
  conversion). Creates the candidate, or fills the EMPTY fields of an
  existing one. A field that already has a value, and a resume that is
  already there, are kept.
*/
export async function linkCandidate(profile, { resume = null, source = 'WEBSITE' } = {}) {
  let candidate = await Candidate.findOne({ email: profile.email });
  const created = !candidate;
  if (created) {
    candidate = new Candidate({ ...profile, source, resume });
  } else {
    for (const field of FILL_IF_EMPTY) {
      if (!candidate[field] && profile[field]) candidate[field] = profile[field];
    }
    if (resume && !candidate.resume?.key) candidate.resume = resume;
  }
  await candidate.save();
  return { candidate, created, tookResume: Boolean(resume && candidate.resume?.key === resume.key) };
}

// Every public submission is a new application, and it always starts
// as NEW: nothing sent through the form can shortlist or label it.
// `repeat` tells the audit log that this person had already applied to
// the same job (or had already sent a general application).
export async function createApplication({ candidate, job, message, resume, profile, source = 'WEBSITE' }) {
  const repeat = (await Application.countDocuments({
    candidateId: candidate._id,
    jobId: job ? job._id : null,
  })) > 0;
  const application = await Application.create({
    candidateId: candidate._id,
    jobId: job ? job._id : null,
    message: message || '',
    resume: resume || null,
    submittedProfile: profile ? profileSnapshot(profile) : null,
    source,
    submittedAt: new Date(),
  });
  return { application, repeat };
}

/*
  Deleting a candidate removes the profile, the applications, the ATS
  results, the resume extraction drafts and every stored resume for
  that person. Referrals that were
  converted into this candidate keep their own record but lose the
  link and the resume, which is that person's document too.
*/
export async function deleteCandidateCascade(candidate) {
  const [applications, linkedReferrals] = await Promise.all([
    Application.find({ candidateId: candidate._id }),
    Referral.find({ candidateId: candidate._id }),
  ]);
  const files = new Map();
  if (candidate.resume?.key) files.set(candidate.resume.key, candidate.resume);
  for (const record of [...applications, ...linkedReferrals]) {
    if (record.resume?.key) files.set(record.resume.key, record.resume);
  }
  for (const file of files.values()) {
    try {
      await removePrivateFile(file);
    } catch (error) {
      logger.error('candidate.resume_delete_failed', { candidateId: String(candidate._id), error });
    }
  }
  // The email record of the applications goes with them.
  await forgetEmails('application', applications.map((application) => application._id));
  await Application.deleteMany({ candidateId: candidate._id });
  await ATSResult.deleteMany({ candidateId: candidate._id });
  // The resume extraction drafts hold text read from this person's
  // resume, so they go too.
  await ResumeExtraction.deleteMany({ candidateId: candidate._id });
  // Semantic analyses an earlier build stored quote the profile: they go too.
  await removeLegacyDerivedData({ candidateIds: [candidate._id] });
  // An AI comparison of several candidates is about all of them
  // together: one that includes this candidate is removed with them.
  await Job.updateMany({ 'candidateComparison.candidates.candidateId': candidate._id }, { $set: { candidateComparison: null } }, { timestamps: false });
  await Referral.updateMany({ candidateId: candidate._id }, { $set: { candidateId: null, resume: null } });
  await candidate.deleteOne();
  return { applications: applications.length, files: files.size };
}
