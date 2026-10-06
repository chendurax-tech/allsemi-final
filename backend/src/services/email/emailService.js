import { env, integrations } from '../../config/env.js';
import { logger } from '../../utils/logger.js';

/*
  Email delivery. One function, send(), used by every notification.

  Drivers (config/env.js decides which one is in use):
    resend  - used whenever RESEND_API_KEY and EMAIL_FROM are set, and
              in production. Calls the Resend HTTP API from the server;
              the API key is never sent to the browser.
    log     - development, while Resend is not configured. Writes the
              message summary to the server log instead of sending it.
    memory  - tests. Keeps sent messages in `outbox`.

  send() never throws. A submission is saved in the database before any
  email is attempted, and a mail failure must not turn a saved
  submission into an error for the person who sent it. Failures are
  logged with the reason.
*/

export const outbox = [];

// POST https://api.resend.com/emails with a JSON body. `to` is a list,
// `reply_to` is only sent when there is one. The answer carries the id
// of the accepted message; an error answer carries a `message`.
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
    throw error;
  }
  return body.id || null;
}

export async function send({ to, subject, html, text, replyTo, template }) {
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
    logger.error('email.failed', { template, error });
    return { sent: false, reason: 'failed' };
  }
}
