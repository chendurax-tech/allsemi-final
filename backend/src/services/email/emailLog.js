import { EmailLog } from '../../models/index.js';
import { deliver } from './emailService.js';
import { logger } from '../../utils/logger.js';

/*
  Sending an email with a record of it (models/EmailLog.js).

  sendRecorded() is what every notification goes through. For an email
  about a stored record it first claims the one entry that email has
  (type + record), then sends, then writes the outcome. The claim is
  what stops a duplicate:

    automatic email   one attempt, ever. If an entry already exists,
                      whatever its outcome, nothing is sent. A failed
                      one is sent again only when a member of staff
                      asks for it.
    explicit email    (a staff action: a retry, or a shortlist, regret
                      or selection email) allowed while the entry is
                      not SENT and no other attempt is running. Once
                      the email service has accepted the message it is
                      never sent again.

  An email that is not about a stored record (there is no id to key
  it by) is simply sent.

  The record is written with numbers, names of things and ids. It never
  holds the address, the subject or the text.
*/

// States from which a member of staff may ask for the email again.
export const RESENDABLE = ['NOT_SENT', 'LOGGED', 'NOT_CONFIGURED', 'FAILED', 'CAPPED'];
// An attempt that has been "sending" for longer than this is treated
// as abandoned (the process stopped mid-send).
const STALE_SENDING_MS = 2 * 60 * 1000;

const isDuplicateKey = (error) => error?.code === 11000;
export const emailKey = (template, entityId) => `${template}:${entityId}`;

// What deliver() answered, as one of EMAIL_LOG_STATES.
export function outcomeState(result) {
  if (result?.sent) return result.logged ? 'LOGGED' : 'SENT';
  if (result?.reason === 'not_configured') return 'NOT_CONFIGURED';
  return 'FAILED';
}

const actorFields = (actor) => (actor ? { actorId: actor.id || null, actorName: String(actor.name || '').slice(0, 120) } : {});

/*
  Claims the entry for one attempt. Returns { entry } when this caller
  may send, or { refused } with the reason it may not:
    'duplicate'     an automatic email that already has an entry
    'already_sent'  the email service has accepted this email before
    'in_progress'   another attempt is running
*/
async function claim({ key, template, kind, recipient, entityType, entityId, automatic, actor, meta }) {
  const now = new Date();
  try {
    const entry = await EmailLog.create({
      key, template, kind, recipient, entityType, entityId, status: 'SENDING', automatic, attempts: 1, at: now, meta: meta || {}, ...actorFields(actor),
    });
    return { entry };
  } catch (error) {
    if (!isDuplicateKey(error)) throw error;
  }
  if (automatic) return { refused: 'duplicate' };

  const claimed = await EmailLog.updateOne(
    {
      key,
      $or: [
        { status: { $in: RESENDABLE } },
        { status: 'SENDING', at: { $lte: new Date(now.getTime() - STALE_SENDING_MS) } },
      ],
    },
    { $set: { status: 'SENDING', at: now, automatic: false, ...actorFields(actor) }, $inc: { attempts: 1 } },
  );
  const entry = await EmailLog.findOne({ key });
  if (claimed.matchedCount && entry) return { entry };
  return { refused: entry?.status === 'SENT' ? 'already_sent' : 'in_progress' };
}

/*
  sendRecorded - sends `message` ({ to, subject, html, text, replyTo })
  and records it against `ref` ({ entityType, entityId }).

  Returns what deliver() returns, plus:
    { sent: false, reason: 'duplicate' }      automatic, already attempted
    { sent: false, reason: 'already_sent' }   accepted before: not sent again
    { sent: false, reason: 'in_progress' }    another attempt is running
  and `state`, one of EMAIL_LOG_STATES, when an attempt was made.

  With `skip: 'CAPPED'` nothing is sent and the entry says why.
*/
export async function sendRecorded({ message, template, kind, recipient, ref = null, automatic = true, actor = null, meta = null, skip = '' }) {
  const entityId = ref?.entityId ? String(ref.entityId) : '';
  if (!entityId) {
    if (skip) return { sent: false, reason: 'capped' };
    return deliver({ ...message, template });
  }
  const key = emailKey(template, entityId);

  let entry = null;
  try {
    const claimed = await claim({ key, template, kind, recipient, entityType: ref.entityType, entityId, automatic, actor, meta });
    if (claimed.refused) return { sent: false, reason: claimed.refused };
    entry = claimed.entry;
  } catch (error) {
    // The record could not be written. The email is still sent: a
    // notification must not be lost because its record failed.
    logger.error('email.record_failed', { template, error });
  }

  if (skip) {
    if (entry) await EmailLog.updateOne({ _id: entry._id }, { $set: { status: skip, at: new Date() } }).catch((error) => logger.error('email.record_failed', { template, error }));
    return { sent: false, reason: 'capped', state: skip };
  }

  const result = await deliver({ ...message, template });
  const state = outcomeState(result);
  if (entry) {
    const now = new Date();
    const failure = state === 'FAILED'
      ? (result.failure || { category: result.reason === 'no_recipient' ? 'no_recipient' : 'rejected', httpStatus: null, providerError: '', message: '' })
      : null;
    await EmailLog.updateOne(
      { _id: entry._id },
      { $set: { status: state, at: now, failure, providerId: result.id ? String(result.id).slice(0, 120) : '', ...(state === 'SENT' ? { sentAt: now } : {}) } },
    ).catch((error) => logger.error('email.record_failed', { template, error }));
  }
  return { ...result, state };
}

// The entries about one record, oldest first.
export function emailsFor(entityType, entityId) {
  return EmailLog.find({ entityType, entityId: String(entityId) }).sort({ createdAt: 1 });
}

// Removes the entries about records that no longer exist.
export function forgetEmails(entityType, entityIds) {
  const ids = (Array.isArray(entityIds) ? entityIds : [entityIds]).map(String);
  if (ids.length === 0) return Promise.resolve();
  return EmailLog.deleteMany({ entityType, entityId: { $in: ids } });
}
