import { env } from '../../config/env.js';
import { send } from './emailService.js';
import { templates } from './templates.js';
import { logger } from '../../utils/logger.js';

/*
  The notifications each public submission triggers: one to the
  ALLSEMIS team, one confirmation to the sender. Controllers call these
  after the record is saved; they never build or send an email
  themselves.
*/

const toAdmin = (template, message, replyTo) => send({ ...message, to: env.adminNotificationEmail, replyTo, template });

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

async function toSender(template, message, to) {
  const address = String(to || '').toLowerCase();
  if (!address) return;
  if (!confirmationAllowed(address)) {
    logger.warn('email.confirmation_capped', { template });
    return;
  }
  await send({ ...message, to: address, template });
}

export async function notifyRequirement(requirement) {
  await Promise.all([
    toAdmin('newRequirementAdmin', templates.newRequirementAdmin(requirement), requirement.email),
    toSender('requirementConfirmation', templates.requirementConfirmation(), requirement.email),
  ]);
}

export async function notifyApplication({ candidate, job, application, isNewCandidate }) {
  await Promise.all([
    toAdmin('newApplicationAdmin', templates.newApplicationAdmin({ candidate, job, application, isNewCandidate }), candidate.email),
    toSender('applicationConfirmation', templates.applicationConfirmation({ job }), candidate.email),
  ]);
}

export async function notifyEnquiry(enquiry) {
  await Promise.all([
    toAdmin('newEnquiryAdmin', templates.newEnquiryAdmin(enquiry), enquiry.email),
    toSender('enquiryConfirmation', templates.enquiryConfirmation(), enquiry.email),
  ]);
}

export async function notifyReferral(referral) {
  await Promise.all([
    toAdmin('newReferralAdmin', templates.newReferralAdmin(referral), referral.referrerEmail),
    toSender('referralConfirmation', templates.referralConfirmation(), referral.referrerEmail),
  ]);
}

/*
  The email a candidate receives when a recruiter shortlists their
  application. It is sent by a staff action, not by a public form, so
  the per-address cap above does not apply; services/shortlistService.js
  makes sure it is sent at most once per application. Unlike the
  notifications above, the result is returned: the recruiter is shown
  whether the email went out.
*/
export function notifyShortlisted({ candidate, job }) {
  return send({ ...templates.shortlistNotification({ job }), to: candidate.email, template: 'shortlistNotification' });
}
