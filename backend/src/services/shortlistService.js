import { Application, Candidate, Job } from '../models/index.js';
import { conflict, notFound } from '../utils/AppError.js';
import { notifyShortlisted } from './email/notifications.js';
import { record } from './auditService.js';
import { logger } from '../utils/logger.js';

/*
  Shortlisting: the one workflow action of the recruitment process.

    application arrives (NEW)
      -> rule-based ATS result, recruiter review
      -> a recruiter shortlists it (SHORTLISTED)
      -> the candidate is told by email

  The decision is always a person's. Nothing in the ATS, and nothing
  an AI comparison may add later, calls this: it is reached only
  through the shortlist endpoint, by a signed-in user whose role holds
  applications:shortlist.

  Two things are guaranteed here:

  1. An application is shortlisted once. The change is a single
     conditional update ("set SHORTLISTED where it is NEW"), so
     two clicks, two tabs or two recruiters at the same moment produce
     one shortlist and one email, and the second caller is told it was
     already done.

  2. The candidate gets at most one shortlist email per application.
     Each attempt first claims the email with another conditional
     update. Once an attempt has been accepted by the email service
     (SENT) no further attempt is allowed. While email is not set up
     (LOGGED in development, NOT_CONFIGURED, FAILED) the application
     stays shortlisted and the email can be sent later from the admin.
*/

// An attempt that has been "sending" for longer than this is treated
// as abandoned (the process stopped mid-send) and may be retried.
const STALE_SENDING_MS = 2 * 60 * 1000;

const RETRYABLE = ['NOT_SENT', 'LOGGED', 'NOT_CONFIGURED', 'FAILED'];

// How each outcome reads in the audit log.
const OUTCOME = {
  SENT: 'sent',
  LOGGED: 'not sent (development mode, written to the server log)',
  NOT_CONFIGURED: 'not sent (the email service is not connected)',
  FAILED: 'not sent (the email service did not accept it)',
};

// What the email service answered, as one of SHORTLIST_EMAIL_STATES.
// 'already_sent' is the email record saying that this email was
// accepted before: it is sent, and it is not sent a second time.
export function emailState(result) {
  if (result?.sent) return result.logged ? 'LOGGED' : 'SENT';
  if (result?.reason === 'already_sent') return 'SENT';
  if (result?.reason === 'not_configured') return 'NOT_CONFIGURED';
  return 'FAILED';
}

// Why an attempt failed, as one of EMAIL_FAILURE_CATEGORIES, and what
// the audit log keeps about it. The email service's own sentence is
// kept without any address in it.
export function failureOf(state, result) {
  if (state !== 'FAILED') return { category: '', audit: {} };
  const failure = result?.failure || null;
  const category = failure?.category || (result?.reason === 'no_recipient' ? 'no_recipient' : 'rejected');
  const audit = { reason: category };
  if (failure?.httpStatus) audit.providerStatus = failure.httpStatus;
  if (failure?.providerError) audit.providerError = failure.providerError;
  if (failure?.message) audit.providerMessage = failure.message.replace(/[^\s@()<>]{1,64}@[^\s@()<>]{1,255}/g, '[address]');
  return { category, audit };
}

async function load(applicationId) {
  const application = await Application.findById(applicationId);
  if (!application) throw notFound('That application was not found.');
  return application;
}

/*
  Claims the email for one attempt and sends it. Returns the state the
  attempt ended in. Throws 409 when the email was already sent or
  another attempt is in progress.
*/
async function attemptEmail(req, applicationId) {
  const now = new Date();
  const claimed = await Application.updateOne(
    {
      _id: applicationId,
      status: 'SHORTLISTED',
      $or: [
        { 'shortlist.email.status': { $in: RETRYABLE } },
        { 'shortlist.email.status': 'SENDING', 'shortlist.email.at': { $lte: new Date(now.getTime() - STALE_SENDING_MS) } },
      ],
    },
    { $set: { 'shortlist.email.status': 'SENDING', 'shortlist.email.at': now }, $inc: { 'shortlist.email.attempts': 1 } },
  );
  if (!claimed.matchedCount) {
    const current = await load(applicationId);
    if (current.shortlist?.email?.status === 'SENT') throw conflict('The shortlist email has already been sent for this application.');
    throw conflict('The shortlist email is being sent. Check again in a moment.');
  }

  const application = await load(applicationId);
  const [candidate, job] = await Promise.all([
    Candidate.findById(application.candidateId),
    application.jobId ? Job.findById(application.jobId) : null,
  ]);

  let state = 'FAILED';
  let result = null;
  try {
    if (candidate) result = await notifyShortlisted({ candidate, job, application, actor: req.user });
    state = candidate ? emailState(result) : 'FAILED';
  } catch (error) {
    // Sending does not throw; this is a guard so a fault here can never
    // leave the attempt marked as "sending".
    logger.error('shortlist.email_failed', { applicationId: String(applicationId), error });
  }
  const failed = failureOf(state, result);
  await Application.updateOne({ _id: applicationId }, { $set: { 'shortlist.email.status': state, 'shortlist.email.at': new Date(), 'shortlist.email.failure': failed.category } });
  await record({
    req,
    action: 'application.shortlist_email',
    entityType: 'application',
    entityId: applicationId,
    summary: `Shortlist email${job ? ` for ${job.title}` : ''}: ${OUTCOME[state]}`,
    // When the email service refused it: its status, error name and
    // sentence, so the cause can be read here. Never a key.
    metadata: { state, candidateId: String(application.candidateId), ...failed.audit },
  });
  return state;
}

/*
  shortlistApplication - marks the application SHORTLISTED, records who
  did it, then sends the candidate's email. Returns the application as
  it now is and the state of the email.
*/
export async function shortlistApplication(req, applicationId) {
  const before = await load(applicationId);
  const now = new Date();
  const claimed = await Application.updateOne(
    { _id: before._id, status: 'NEW' },
    {
      $set: {
        status: 'SHORTLISTED',
        shortlist: { at: now, byId: req.user.id, byName: req.user.name, email: { status: 'NOT_SENT', at: null, attempts: 0 } },
      },
    },
  );
  if (!claimed.matchedCount) {
    const current = await load(before._id);
    if (current.status === 'SHORTLISTED') throw conflict('This application is already shortlisted.');
    // A status from before the workflow was reduced. Shortlisting it
    // now could email someone who was already further along.
    throw conflict('This application still has a status from the earlier workflow. Run "npm run migrate:recruitment" on the server, then try again.');
  }

  const job = before.jobId ? await Job.findById(before.jobId) : null;
  const role = job ? job.title : 'a general application';
  await record({ req, action: 'application.shortlisted', entityType: 'application', entityId: before._id, summary: `Shortlisted for ${role}`, metadata: { from: before.status, to: 'SHORTLISTED', candidateId: String(before.candidateId), jobId: before.jobId ? String(before.jobId) : '' } });
  // The same event on the candidate's own history.
  await record({ req, action: 'candidate.application_shortlisted', entityType: 'candidate', entityId: before.candidateId, summary: `Shortlisted for ${role}`, metadata: { applicationId: String(before._id) } });

  const email = await attemptEmail(req, before._id);
  return { application: await load(before._id), email };
}

/*
  sendShortlistEmail - sends the email for an application that is
  already shortlisted and has not had one accepted yet: after email
  was set up, after a failure, or for a record shortlisted before this
  workflow existed.
*/
export async function sendShortlistEmail(req, applicationId) {
  const application = await load(applicationId);
  if (application.status !== 'SHORTLISTED') throw conflict('Shortlist the application first.');
  // A record shortlisted before this workflow has no shortlist details.
  if (!application.shortlist) {
    await Application.updateOne(
      { _id: application._id, shortlist: null },
      { $set: { shortlist: { at: null, byId: null, byName: '', email: { status: 'NOT_SENT', at: null, attempts: 0 } } } },
    );
  }
  const email = await attemptEmail(req, application._id);
  return { application: await load(application._id), email };
}
