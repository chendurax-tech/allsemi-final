import { ok } from '../utils/apiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { badRequest, conflict, forbidden, notFound } from '../utils/AppError.js';
import { assertObjectId, text } from '../utils/query.js';
import { can } from '../middleware/auth.js';
import { PERMISSIONS as P } from '../config/permissions.js';
import { EmailLog, Application, Candidate, Job, Requirement, Enquiry, Referral } from '../models/index.js';
import { emailsFor, sendRecorded, RESENDABLE } from '../services/email/emailLog.js';
import { AUTOMATIC_EMAILS } from '../services/email/notifications.js';
import { record } from '../services/auditService.js';

/*
  The email record for the admin: what was sent about one record, and
  sending an automatic email again after it failed.

  Which role may read or resend follows the record the email is about:
  the emails of a requirement need the requirement permissions, and so
  on. An unknown kind of record is refused.
*/
const RECORDS = {
  requirement: { Model: Requirement, read: P.REQUIREMENTS_READ, write: P.REQUIREMENTS_WRITE },
  enquiry: { Model: Enquiry, read: P.ENQUIRIES_READ, write: P.ENQUIRIES_WRITE },
  referral: { Model: Referral, read: P.REFERRALS_READ, write: P.REFERRALS_WRITE },
  application: { Model: Application, read: P.APPLICATIONS_READ, write: P.APPLICATIONS_WRITE },
};

// What staff are told about one email. The address and the text are
// not in the record. The email service's own sentence is for a super
// admin (audit:read) only.
function describe(entry, req) {
  const failure = entry.status === 'FAILED' && entry.failure
    ? { category: entry.failure.category || 'rejected', ...(can(req, P.AUDIT_READ) ? { httpStatus: entry.failure.httpStatus ?? null, providerError: entry.failure.providerError || '', message: entry.failure.message || '' } : {}) }
    : null;
  return {
    id: String(entry._id),
    template: entry.template,
    kind: entry.kind,
    recipient: entry.recipient,
    entityType: entry.entityType,
    entityId: entry.entityId,
    status: entry.status,
    automatic: entry.automatic !== false,
    attempts: entry.attempts || 0,
    at: entry.at,
    sentAt: entry.sentAt || null,
    failure,
    // Only an automatic email is sent again from this record. The
    // shortlist, regret and selection emails have their own buttons.
    canResend: entry.kind !== 'CANDIDATE_DECISION' && RESENDABLE.includes(entry.status),
    actorName: entry.actorName || '',
  };
}

// GET /emails?entityType=requirement&entityId=<id>
export const list = asyncHandler(async (req, res) => {
  const entityType = text(req.query.entityType, 40);
  const known = Object.hasOwn(RECORDS, entityType) ? RECORDS[entityType] : null;
  if (!known) throw badRequest('Name the kind of record: requirement, enquiry, referral or application.');
  if (!can(req, known.read)) throw forbidden();
  const entityId = assertObjectId(req.query.entityId);
  const entries = await emailsFor(entityType, entityId);
  ok(res, entries.map((entry) => describe(entry, req)));
});

/*
  POST /emails/:id/resend - sends an automatic email again after it
  failed, was held back or was only written to the log. The same email,
  written again from the stored record with the same wording. It is
  refused once the email service has accepted it, so a successful email
  is never sent twice, and it is refused for the emails a recruiter
  sends to a candidate, which have their own actions.
*/
export const resend = asyncHandler(async (req, res) => {
  const entry = await EmailLog.findById(assertObjectId(req.params.id));
  if (!entry) throw notFound('That email was not found.');
  const known = Object.hasOwn(RECORDS, entry.entityType) ? RECORDS[entry.entityType] : null;
  const email = Object.hasOwn(AUTOMATIC_EMAILS, entry.template) ? AUTOMATIC_EMAILS[entry.template] : null;
  if (!known) throw notFound('That email was not found.');
  if (!can(req, known.read) || !can(req, known.write)) throw forbidden();
  if (!email || entry.kind === 'CANDIDATE_DECISION') throw conflict('This email is sent with its own action on the application.');
  if (entry.status === 'SENT') throw conflict('This email has already been sent. It is not sent twice.');

  const stored = await known.Model.findById(entry.entityId);
  if (!stored) throw notFound('The record this email was about no longer exists.');
  let candidate = null;
  let job = null;
  if (entry.entityType === 'application') {
    [candidate, job] = await Promise.all([Candidate.findById(stored.candidateId), stored.jobId ? Job.findById(stored.jobId) : null]);
    if (!candidate) throw notFound('The candidate of this application no longer exists.');
  }

  const result = await sendRecorded({
    message: email.build({ record: stored, candidate, job, meta: entry.meta }),
    template: entry.template,
    kind: email.kind,
    recipient: email.recipient,
    ref: { entityType: entry.entityType, entityId: entry.entityId },
    automatic: false,
    actor: req.user,
  });
  if (result.reason === 'already_sent') throw conflict('This email has already been sent. It is not sent twice.');
  if (result.reason === 'in_progress') throw conflict('This email is being sent. Check again in a moment.');

  const fresh = await EmailLog.findById(entry._id);
  await record({
    req,
    action: 'email.resent',
    entityType: entry.entityType,
    entityId: entry.entityId,
    summary: `Sent an automatic email again (${entry.template}): ${fresh.status === 'SENT' ? 'sent' : 'not sent'}`,
    metadata: { template: entry.template, state: fresh.status, ...(fresh.failure?.category ? { reason: fresh.failure.category } : {}) },
  });
  ok(res, describe(fresh, req));
});
