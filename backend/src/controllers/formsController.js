import { created } from '../utils/apiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { badRequest, notFound } from '../utils/AppError.js';
import { Job, Requirement, Enquiry, Referral, ATSResult } from '../models/index.js';
import { storePrivateFile, removePrivateFile } from '../services/storage/privateFiles.js';
import { findOrCreateCandidate, createApplication } from '../services/candidateService.js';
import { runEvaluation } from '../services/atsService.js';
import { record } from '../services/auditService.js';
import {
  notifyRequirement, notifyApplication, notifyEnquiry, notifyReferral,
} from '../services/email/notifications.js';
import { logger } from '../utils/logger.js';
import { ATS_ENGINE } from '../config/constants.js';

/*
  The four public submissions.

  By the time a handler runs, the request has passed, in order:
    rate limit -> multipart limits -> honeypot -> zod validation ->
    file inspection by content.
  req.body therefore holds only the fields the form may send, already
  cleaned, and req.upload (when a file was sent) holds a document whose
  type was decided from its bytes.

  Each handler: stores the file privately, saves the record, then sends
  the two emails. The record is the source of truth; a mail failure is
  logged and does not fail the submission. The response says only that
  the submission was received. It returns no record data.
*/

async function storeUpload(req, folder) {
  if (!req.upload) return null;
  return storePrivateFile({ ...req.upload, folder });
}

// If saving the record fails after the file was stored, the file is
// removed again so no orphaned document is left behind.
async function withStoredFile(req, folder, save) {
  const file = await storeUpload(req, folder);
  try {
    return await save(file);
  } catch (error) {
    if (file) await removePrivateFile(file).catch((cleanupError) => logger.error('forms.cleanup_failed', { error: cleanupError }));
    throw error;
  }
}

const afterResponse = (work, event) => work.catch((error) => logger.error(event, { error }));

// A. Hire Talent
export const submitRequirement = asyncHandler(async (req, res) => {
  const { consent, website, ...fields } = req.body;
  const requirement = await withStoredFile(req, 'requirements', (attachment) => Requirement.create({
    ...fields,
    attachment,
    status: 'NEW',
    source: 'WEBSITE',
    consentAt: consent ? new Date() : null,
  }));
  await record({ req, action: 'requirement.submitted', entityType: 'requirement', entityId: requirement._id, summary: `Hiring requirement received: ${requirement.role}` });
  created(res, { received: true });
  afterResponse(notifyRequirement(requirement), 'forms.notify_failed');
});

// B. Candidate application
export const submitApplication = asyncHandler(async (req, res) => {
  const { consent, website, jobId, message, experienceYears, ...profile } = req.body;

  let job = null;
  if (jobId) {
    job = await Job.findById(jobId);
    // An unpublished job is indistinguishable from one that does not exist.
    if (!job || job.status !== 'published') throw notFound('That position is not available.');
    if (!job.applicationEnabled) throw badRequest('This position is not accepting applications.');
  }
  if (!req.upload) throw badRequest('Attach your resume as a PDF, DOC or DOCX file.');

  // An address that already has a candidate record keeps that record
  // exactly as it is: this form is not signed in, so it only ever adds
  // (see services/candidateService.js). The submitted details and the
  // resume are stored with the new application.
  const submitted = { ...profile, ...(experienceYears === null ? {} : { experienceYears }) };
  const { candidate, application, repeat, isNewCandidate } = await withStoredFile(req, 'resumes', async (storedResume) => {
    const found = await findOrCreateCandidate(submitted, { resume: storedResume, source: 'WEBSITE', consent });
    const applied = await createApplication({ candidate: found.candidate, job, message, resume: storedResume, profile: submitted, source: 'WEBSITE' });
    return { candidate: found.candidate, isNewCandidate: found.created, ...applied };
  });

  // The rule-based evaluation is quick and deterministic, so it runs
  // with the first application to a job. It is not run again by a later
  // public submission: a result a recruiter may already have reviewed
  // is only replaced when staff run the evaluation themselves. If it
  // fails, the application still stands.
  if (job) {
    try {
      const evaluated = await ATSResult.countDocuments({ candidateId: candidate._id, jobId: job._id, engine: ATS_ENGINE });
      if (evaluated === 0) await runEvaluation({ candidateId: candidate._id, jobId: job._id, applicationId: application._id });
    } catch (error) {
      logger.error('ats.auto_evaluation_failed', { applicationId: String(application._id), error });
    }
  }

  await record({ req, action: 'application.submitted', entityType: 'application', entityId: application._id, summary: `Application received${job ? ` for ${job.title}` : ''}`, metadata: { candidateId: String(candidate._id), newCandidate: isNewCandidate, repeat } });
  created(res, { received: true });
  afterResponse(notifyApplication({ candidate, job, application, isNewCandidate }), 'forms.notify_failed');
});

// C. General enquiry
export const submitEnquiry = asyncHandler(async (req, res) => {
  const { website, ...fields } = req.body;
  const enquiry = await withStoredFile(req, 'enquiries', (attachment) => Enquiry.create({ ...fields, attachment, status: 'NEW' }));
  await record({ req, action: 'enquiry.submitted', entityType: 'enquiry', entityId: enquiry._id, summary: `Enquiry received: ${enquiry.subject || enquiry.type}` });
  created(res, { received: true });
  afterResponse(notifyEnquiry(enquiry), 'forms.notify_failed');
});

// D. Referral
export const submitReferral = asyncHandler(async (req, res) => {
  const { consent, website, ...fields } = req.body;
  const referral = await withStoredFile(req, 'referrals', (resume) => Referral.create({
    ...fields,
    resume,
    status: 'NEW',
    consentAt: consent ? new Date() : null,
  }));
  await record({ req, action: 'referral.submitted', entityType: 'referral', entityId: referral._id, summary: `Referral received: ${referral.candidateName}` });
  created(res, { received: true });
  afterResponse(notifyReferral(referral), 'forms.notify_failed');
});
