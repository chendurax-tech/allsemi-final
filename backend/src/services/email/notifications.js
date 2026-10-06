import { env } from '../../config/env.js';
import { sendRecorded } from './emailLog.js';
import { templates } from './templates.js';
import { logger } from '../../utils/logger.js';

/*
  Every email the API sends, in two groups that are kept apart.

  AUTOMATIC, sent by a public submission after its record is saved:
    - a notification to the ALLSEMIS team (ADMIN_NOTIFICATION_EMAIL)
      for every application, hiring requirement, enquiry and referral;
    - an acknowledgement to the person who sent the form, saying that
      it was received. It says nothing about an outcome.
  An application never sends a shortlist, regret or selection email.

  STARTED BY A RECRUITER, to a candidate, about one application:
    - the shortlist email, by the shortlist action
      (services/shortlistService.js);
    - the regret email and the selection email, each by its own button
      after the Rejected or Selected label was added
      (services/decisionEmailService.js).
  No label, ATS score or AI analysis sends any of them.

  Controllers call these functions after the record is saved; they
  never build or send an email themselves. Every email goes through
  sendRecorded() (emailLog.js), which keeps one entry per email and
  record and so never sends an automatic email twice. `ref` names the
  record: { entityType, entityId }. An object that was never stored
  (no _id) is sent without an entry.
*/

const refOf = (entityType, doc, id = doc?._id) => (id ? { entityType, entityId: String(id) } : null);

const toAdmin = (template, message, replyTo, ref, meta) => sendRecorded({
  message: { ...message, to: env.adminNotificationEmail, replyTo }, template, kind: 'TEAM_NOTIFICATION', recipient: 'TEAM', ref, meta,
});

/*
  Confirmations go to an address typed into a public form, which may
  belong to someone else. One address receives at most
  CONFIRMATIONS_PER_HOUR of them, so the forms cannot be used to fill a
  stranger's inbox. The submission itself is still saved and the team
  is still notified. The count is kept in memory, per instance, like
  the rate limits.
*/
const CONFIRMATIONS_PER_HOUR = 3;
const HOUR = 60 * 60 * 1000;
const recentConfirmations = new Map();

function confirmationAllowed(address) {
  const now = Date.now();
  if (recentConfirmations.size > 5000) {
    for (const [key, times] of recentConfirmations) {
      if (times.every((time) => now - time > HOUR)) recentConfirmations.delete(key);
    }
  }
  const times = (recentConfirmations.get(address) || []).filter((time) => now - time <= HOUR);
  if (times.length >= CONFIRMATIONS_PER_HOUR) {
    recentConfirmations.set(address, times);
    return false;
  }
  recentConfirmations.set(address, [...times, now]);
  return true;
}

// For the tests.
export const resetConfirmationLimits = () => recentConfirmations.clear();

async function toSender(template, message, to, ref, meta) {
  const address = String(to || '').toLowerCase();
  if (!address) return;
  const email = { message: { ...message, to: address }, template, kind: 'ACKNOWLEDGEMENT', recipient: 'SENDER', ref, meta };
  if (!confirmationAllowed(address)) {
    logger.warn('email.confirmation_capped', { template });
    // Recorded, so the admin shows that this acknowledgement was held back.
    await sendRecorded({ ...email, skip: 'CAPPED' });
    return;
  }
  await sendRecorded(email);
}

export async function notifyRequirement(requirement) {
  await Promise.all([
    toAdmin('newRequirementAdmin', templates.newRequirementAdmin(requirement), requirement.email, refOf('requirement', requirement)),
    toSender('requirementConfirmation', templates.requirementConfirmation(), requirement.email, refOf('requirement', requirement)),
  ]);
}

export async function notifyApplication({ candidate, job, application, isNewCandidate }) {
  await Promise.all([
    toAdmin('newApplicationAdmin', templates.newApplicationAdmin({ candidate, job, application, isNewCandidate }), candidate.email, refOf('application', application), { isNewCandidate: isNewCandidate !== false }),
    // A receipt only: it says the application arrived and nothing about
    // a decision.
    toSender('applicationConfirmation', templates.applicationConfirmation({ job }), candidate.email, refOf('application', application)),
  ]);
}

export async function notifyEnquiry(enquiry) {
  await Promise.all([
    toAdmin('newEnquiryAdmin', templates.newEnquiryAdmin(enquiry), enquiry.email, refOf('enquiry', enquiry)),
    toSender('enquiryConfirmation', templates.enquiryConfirmation(), enquiry.email, refOf('enquiry', enquiry)),
  ]);
}

export async function notifyReferral(referral) {
  await Promise.all([
    toAdmin('newReferralAdmin', templates.newReferralAdmin(referral), referral.referrerEmail, refOf('referral', referral)),
    toSender('referralConfirmation', templates.referralConfirmation(), referral.referrerEmail, refOf('referral', referral)),
  ]);
}

/*
  The emails a candidate receives by a recruiter's action. They are
  not sent by a public form, so the per-address cap above does not
  apply; the application itself allows each of them once
  (services/shortlistService.js, services/decisionEmailService.js).
  Unlike the notifications above, the result is returned: the recruiter
  is shown whether the email went out, and why not when it did not.
  `actor` is the member of staff who pressed the button.
*/
const toCandidate = (template, message, { candidate, application, actor }) => sendRecorded({
  message: { ...message, to: candidate.email },
  template,
  kind: 'CANDIDATE_DECISION',
  recipient: 'CANDIDATE',
  ref: refOf('application', application),
  automatic: false,
  actor,
});

export function notifyShortlisted({ candidate, job, application = null, actor = null }) {
  return toCandidate('shortlistNotification', templates.shortlistNotification({ job }), { candidate, application, actor });
}

export function notifyRegret({ candidate, job, application = null, actor = null }) {
  return toCandidate('regretNotification', templates.regretNotification({ job }), { candidate, application, actor });
}

export function notifySelected({ candidate, job, application = null, actor = null }) {
  return toCandidate('selectionNotification', templates.selectionNotification({ job }), { candidate, application, actor });
}

/*
  The automatic emails, by template, for sending one again from the
  admin after it failed (controllers/emailController.js). Each takes
  the stored record and returns what to send and to whom. The wording
  is the same as the first time.
*/
export const AUTOMATIC_EMAILS = {
  newRequirementAdmin: { entityType: 'requirement', kind: 'TEAM_NOTIFICATION', recipient: 'TEAM', build: ({ record }) => ({ ...templates.newRequirementAdmin(record), to: env.adminNotificationEmail, replyTo: record.email }) },
  requirementConfirmation: { entityType: 'requirement', kind: 'ACKNOWLEDGEMENT', recipient: 'SENDER', build: ({ record }) => ({ ...templates.requirementConfirmation(), to: record.email }) },
  newEnquiryAdmin: { entityType: 'enquiry', kind: 'TEAM_NOTIFICATION', recipient: 'TEAM', build: ({ record }) => ({ ...templates.newEnquiryAdmin(record), to: env.adminNotificationEmail, replyTo: record.email }) },
  enquiryConfirmation: { entityType: 'enquiry', kind: 'ACKNOWLEDGEMENT', recipient: 'SENDER', build: ({ record }) => ({ ...templates.enquiryConfirmation(), to: record.email }) },
  newReferralAdmin: { entityType: 'referral', kind: 'TEAM_NOTIFICATION', recipient: 'TEAM', build: ({ record }) => ({ ...templates.newReferralAdmin(record), to: env.adminNotificationEmail, replyTo: record.referrerEmail }) },
  referralConfirmation: { entityType: 'referral', kind: 'ACKNOWLEDGEMENT', recipient: 'SENDER', build: ({ record }) => ({ ...templates.referralConfirmation(), to: record.referrerEmail }) },
  newApplicationAdmin: {
    entityType: 'application',
    kind: 'TEAM_NOTIFICATION',
    recipient: 'TEAM',
    build: ({ record, candidate, job, meta }) => ({ ...templates.newApplicationAdmin({ candidate, job, application: record, isNewCandidate: meta?.isNewCandidate !== false }), to: env.adminNotificationEmail, replyTo: candidate.email }),
  },
  applicationConfirmation: { entityType: 'application', kind: 'ACKNOWLEDGEMENT', recipient: 'SENDER', build: ({ candidate, job }) => ({ ...templates.applicationConfirmation({ job }), to: candidate.email }) },
};
