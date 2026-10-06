import { Application, Candidate, Job } from '../models/index.js';
import { DECISION_EMAILS, RECRUITMENT_LABELS } from '../config/constants.js';
import { badRequest, conflict, notFound } from '../utils/AppError.js';
import { notifyRegret, notifySelected } from './email/notifications.js';
import { emailState, failureOf } from './shortlistService.js';
import { record } from './auditService.js';
import { logger } from '../utils/logger.js';

/*
  The regret email and the selection email.

  Rejected and Selected are labels on an application: tags a recruiter
  adds after reviewing the candidate. A label changes no status and
  sends nothing. When the recruiter also wants the candidate told, they
  press "Send regret email" or "Send selection email", and that press
  is the only thing that reaches this file.

    recruiter reviews the candidate
      -> adds the Rejected (or Selected) label and saves
      -> presses "Send regret email" (or "Send selection email")
      -> the candidate receives that email, once

  What is guaranteed:

  1. The email is sent only for an application that carries the label
     at that moment. Without the label the request is refused.
  2. The candidate gets each email at most once per application. Every
     attempt first claims the email with a conditional update, exactly
     as the shortlist email does. Once the email service has accepted
     it (SENT) no further attempt is allowed, even if the label is
     taken off and put back.
  3. Nothing else changes: not the status of the application, not its
     labels, not the candidate. No evaluation runs and no AI is asked.
     When the email fails the label stays and the email can be sent
     again from the admin.
  4. An application that carries both labels is not emailed: the two
     emails say opposite things, so the recruiter removes one first.
*/

// An attempt that has been "sending" for longer than this is treated
// as abandoned (the process stopped mid-send) and may be retried.
const STALE_SENDING_MS = 2 * 60 * 1000;
const RETRYABLE = ['NOT_SENT', 'LOGGED', 'NOT_CONFIGURED', 'FAILED'];
const NOTIFY = { regret: notifyRegret, selection: notifySelected };

const OUTCOME = {
  SENT: 'sent',
  LOGGED: 'not sent (development mode, written to the server log)',
  NOT_CONFIGURED: 'not sent (the email service is not connected)',
  FAILED: 'not sent (the email service did not accept it)',
};
const labelName = (label) => label.charAt(0) + label.slice(1).toLowerCase();

async function load(applicationId) {
  const application = await Application.findById(applicationId);
  if (!application) throw notFound('That application was not found.');
  return application;
}

/*
  sendDecisionEmail - `kind` is 'regret' or 'selection'. Returns the
  application as it now is and the state the attempt ended in. Throws
  409 when the label is missing, when both labels are on, when the
  email was already sent or when another attempt is running.
*/
export async function sendDecisionEmail(req, applicationId, kind) {
  const config = DECISION_EMAILS[kind];
  if (!config) throw badRequest('That email does not exist.');
  const path = `decisionEmails.${kind}`;

  const before = await load(applicationId);
  const labels = RECRUITMENT_LABELS.filter((name) => (before.labels || []).includes(name));
  if (!labels.includes(config.label)) {
    throw conflict(`Add the ${labelName(config.label)} label to this application and save it first. The ${config.name} is only sent for an application that carries that label.`);
  }
  if (labels.includes(config.other)) {
    throw conflict(`This application carries both the ${labelName(config.label)} and the ${labelName(config.other)} label. Remove one of them before emailing the candidate.`);
  }

  // The claim: one attempt at a time, and never again after SENT. An
  // application stored before these emails existed has no state yet.
  const now = new Date();
  const claimed = await Application.updateOne(
    {
      _id: before._id,
      labels: config.label,
      $or: [
        { [`${path}.status`]: { $in: RETRYABLE } },
        { [`${path}.status`]: { $exists: false } },
        { [`${path}.status`]: 'SENDING', [`${path}.at`]: { $lte: new Date(now.getTime() - STALE_SENDING_MS) } },
      ],
    },
    { $set: { [`${path}.status`]: 'SENDING', [`${path}.at`]: now }, $inc: { [`${path}.attempts`]: 1 } },
  );
  if (!claimed.matchedCount) {
    const current = await load(before._id);
    const status = current.decisionEmails?.[kind]?.status;
    if (status === 'SENT') throw conflict(`The ${config.name} has already been sent for this application.`);
    if (!(current.labels || []).includes(config.label)) throw conflict(`The ${labelName(config.label)} label is no longer on this application.`);
    throw conflict(`The ${config.name} is being sent. Check again in a moment.`);
  }

  const [candidate, job] = await Promise.all([
    Candidate.findById(before.candidateId),
    before.jobId ? Job.findById(before.jobId) : null,
  ]);

  let state = 'FAILED';
  let result = null;
  try {
    if (candidate) result = await NOTIFY[kind]({ candidate, job, application: before, actor: req.user });
    state = candidate ? emailState(result) : 'FAILED';
  } catch (error) {
    // Sending does not throw; this is a guard so a fault here can never
    // leave the attempt marked as "sending".
    logger.error('decision_email.failed', { kind, applicationId: String(before._id), error });
  }
  const failed = failureOf(state, result);
  const finished = new Date();
  await Application.updateOne(
    { _id: before._id },
    {
      $set: {
        [`${path}.status`]: state,
        [`${path}.at`]: finished,
        [`${path}.failure`]: failed.category,
        ...(state === 'SENT' ? { [`${path}.sentAt`]: finished, [`${path}.byId`]: req.user.id, [`${path}.byName`]: req.user.name } : {}),
      },
    },
  );
  await record({
    req,
    action: `application.${kind}_email`,
    entityType: 'application',
    entityId: before._id,
    summary: `${config.name.charAt(0).toUpperCase()}${config.name.slice(1)}${job ? ` for ${job.title}` : ''}: ${OUTCOME[state]}`,
    metadata: { state, candidateId: String(before.candidateId), ...failed.audit },
  });
  return { application: await load(before._id), email: state };
}
