import { env, integrations } from '../../config/env.js';
import { logger } from '../../utils/logger.js';

/*
  Email delivery. One function, deliver(), used by every notification.

  Drivers (config/env.js decides which one is in use):
    resend  - used whenever RESEND_API_KEY and EMAIL_FROM are set, and
              in production. Calls the Resend HTTP API from the server;
              the API key is never sent to the browser.
    log     - development, while Resend is not configured. Writes the
              message summary to the server log instead of sending it.
    memory  - tests. Keeps sent messages in `outbox`.

  send() and deliver() never throw. A submission is saved in the
  database before any email is attempted, and a mail failure must not
  turn a saved submission into an error for the person who sent it.
  Failures are logged with the reason the email service gave.

  This file only sends. Which emails exist, who gets them and the
  record that stops one being sent twice are in notifications.js and
  emailLog.js.
*/

export const outbox = [];

// POST https://api.resend.com/emails with a JSON body. `to` is a list,
// `reply_to` is only sent when there is one. The answer carries the id
// of the accepted message; an error answer carries a `name` and a
// `message`, which are kept on the error for the log and the record.
async function sendWithResend(message) {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: env.emailFrom,
      to: [message.to],
      subject: message.subject,
      html: message.html,
      text: message.text,
      ...(message.replyTo ? { reply_to: message.replyTo } : {}),
    }),
    signal: AbortSignal.timeout(15_000),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(body?.message || `Resend responded with ${response.status}`);
    error.status = response.status;
    error.providerError = typeof body?.name === 'string' ? body.name : '';
    error.providerMessage = typeof body?.message === 'string' ? body.message : '';
    throw error;
  }
  return body.id || null;
}

// The email service's own sentence, safe to keep: anything that looks
// like a key is removed and it is cut short. It is never shown to a
// visitor.
function safeProviderText(value) {
  let text = String(value || '');
  if (env.resendApiKey) text = text.split(env.resendApiKey).join('[key]');
  return text.replace(/\bre_[A-Za-z0-9_-]{6,}/g, '[key]').replace(/Bearer\s+\S+/gi, 'Bearer [key]').replace(/\s+/g, ' ').trim().slice(0, 300);
}

/*
  describeFailure - why the email service did not take a message:
  { category, httpStatus, providerError, message }.

  `category` is one of EMAIL_FAILURE_CATEGORIES (config/constants.js),
  worked out from Resend's status, error name and sentence. It is what
  the admin shows a recruiter. `message` is Resend's own sentence for
  the server log, the email record and the audit log.
*/
export function describeFailure(error) {
  const httpStatus = Number.isInteger(error?.status) ? error.status : null;
  const providerError = safeProviderText(error?.providerError).slice(0, 80);
  const message = safeProviderText(error?.providerMessage || error?.message);
  let category = 'rejected';
  if (httpStatus === null) {
    category = error?.name === 'TimeoutError' || error?.name === 'AbortError' ? 'timeout' : 'network';
  } else if (/domain is not verified|verify a domain|only send testing emails/i.test(message)) {
    category = 'sender_not_verified';
  } else if (providerError === 'invalid_from_address' || /invalid `?from`? field/i.test(message)) {
    category = 'invalid_sender';
  } else if (httpStatus === 401 || ['missing_api_key', 'invalid_api_key', 'restricted_api_key'].includes(providerError) || /api key/i.test(message)) {
    category = 'credentials';
  } else if (['daily_quota_exceeded', 'monthly_quota_exceeded'].includes(providerError) || /quota/i.test(message)) {
    category = 'quota';
  } else if (httpStatus === 429) {
    category = 'rate_limited';
  } else if (/`?to`? field|recipient/i.test(message)) {
    category = 'recipient';
  } else if (httpStatus >= 500) {
    category = 'provider';
  }
  return { category, httpStatus, providerError, message };
}

/*
  deliver - sends one message and says exactly what happened:
    { sent: true, id }                         accepted by Resend
    { sent: true }                             kept in the test outbox
    { sent: true, logged: true }               development: written to the log
    { sent: false, reason: 'no_recipient' }
    { sent: false, reason: 'not_configured' }
    { sent: false, reason: 'failed', failure } Resend refused it or could
                                               not be reached; `failure`
                                               is describeFailure()
  It never throws. A refusal is logged with Resend's status, error name
  and sentence, so the cause can be read from the server log. The API
  key is never logged.
*/
export async function deliver({ to, subject, html, text, replyTo, template }) {
  if (!to) {
    logger.warn('email.skipped', { template, reason: 'no recipient' });
    return { sent: false, reason: 'no_recipient' };
  }
  try {
    if (env.emailDriver === 'memory') {
      outbox.push({ to, subject, html, text, replyTo, template });
      return { sent: true };
    }
    if (env.emailDriver === 'log') {
      logger.info('email.logged', { template, to, subject });
      return { sent: true, logged: true };
    }
    if (!integrations.resend()) {
      logger.error('email.not_configured', { template });
      return { sent: false, reason: 'not_configured' };
    }
    const id = await sendWithResend({ to, subject, html, text, replyTo });
    logger.info('email.sent', { template, id });
    return { sent: true, id };
  } catch (error) {
    const failure = describeFailure(error);
    logger.error('email.failed', { template, error, category: failure.category, providerStatus: failure.httpStatus, providerError: failure.providerError, providerMessage: failure.message });
    return { sent: false, reason: 'failed', failure };
  }
}

// send - deliver(), without the detail of a failure. Kept for callers
// that only need to know whether the message went out.
export async function send(message) {
  const { failure, ...result } = await deliver(message);
  return result;
}
