import { randomBytes, createHmac, timingSafeEqual } from 'node:crypto';
import { env } from '../config/env.js';

/*
  Opaque random tokens.

  The browser holds the raw token (in an HttpOnly cookie). The database
  holds only an HMAC of it, keyed with SESSION_SECRET, so a copy of the
  database does not contain anything that can be replayed as a session.
*/
export function newToken(bytes = 32) {
  return randomBytes(bytes).toString('base64url');
}

export function hashToken(token) {
  return createHmac('sha256', env.sessionSecret).update(String(token)).digest('hex');
}

// Signs a short payload (used by the local development file driver to
// build expiring download links). Not used for sessions.
export function signPayload(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = createHmac('sha256', env.sessionSecret).update(body).digest('base64url');
  return `${body}.${signature}`;
}

export function verifyPayload(token) {
  const [body, signature] = String(token || '').split('.');
  if (!body || !signature) return null;
  const expected = createHmac('sha256', env.sessionSecret).update(body).digest('base64url');
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (typeof payload.exp !== 'number' || payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}
