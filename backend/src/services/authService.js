import { User, Session } from '../models/index.js';
import { env } from '../config/env.js';
import { SESSION_COOKIE } from '../config/constants.js';
import { permissionsFor } from '../config/permissions.js';
import { hashPassword, verifyPassword, needsRehash } from '../utils/password.js';
import { newToken, hashToken } from '../utils/tokens.js';
import { normaliseEmail } from '../utils/sanitize.js';
import { unauthenticated } from '../utils/AppError.js';

/*
  Authentication.

  - Passwords are stored as scrypt hashes (utils/password.js).
  - A successful sign-in creates a server-side session and sets an
    HttpOnly cookie holding a random token. Nothing is put in
    localStorage and no token is ever returned in a response body.
  - Five wrong passwords pause sign-in for that account for fifteen
    minutes, on top of the per-IP rate limit on the route. The pause is
    short on purpose: it slows guessing without letting someone who
    knows an email address keep its owner out for long.
  - The same answer (status, code and message) is returned for an
    unknown email, a wrong password, a disabled account and a paused
    account, and a password hash is always computed, so a sign-in
    attempt does not reveal which emails have an account. The message
    itself mentions the pause, so a person who is paused can tell why
    a correct password is refused.
*/

const MAX_FAILED_LOGINS = 5;
const LOCK_MINUTES = 15;

// A valid hash of a random string, computed once. Verifying against it
// when the email is unknown makes both paths take the same time.
let dummyHashPromise;
const dummyHash = () => {
  if (!dummyHashPromise) dummyHashPromise = hashPassword(newToken(18));
  return dummyHashPromise;
};

export function cookieOptions() {
  const options = {
    httpOnly: true,
    secure: env.isProduction || env.cookieSameSite === 'none',
    sameSite: env.cookieSameSite,
    path: '/',
    maxAge: env.sessionTtlHours * 60 * 60 * 1000,
  };
  if (env.cookieDomain) options.domain = env.cookieDomain;
  return options;
}

export function clearCookieOptions() {
  const { maxAge, ...rest } = cookieOptions();
  return rest;
}

export function publicUser(user) {
  return {
    id: String(user._id || user.id),
    name: user.name,
    email: user.email,
    role: user.role,
    mustChangePassword: Boolean(user.mustChangePassword),
    permissions: permissionsFor(user.role),
  };
}

export const SIGN_IN_REFUSED = 'The email or password is not correct. After five wrong attempts, sign-in for an account pauses for fifteen minutes.';

// Counts a wrong password. The count is incremented in the database in
// one step, so attempts that arrive together are all counted.
async function countFailure(userId) {
  await User.updateOne({ _id: userId }, { $inc: { failedLogins: 1 } });
  const current = await User.findById(userId);
  if (current && current.failedLogins >= MAX_FAILED_LOGINS) {
    await User.updateOne({ _id: userId }, { $set: { failedLogins: 0, lockedUntil: new Date(Date.now() + LOCK_MINUTES * 60 * 1000) } });
  }
}

export async function login({ email, password, ip, userAgent }) {
  const invalid = () => unauthenticated(SIGN_IN_REFUSED);
  const user = await User.findOne({ email: normaliseEmail(email) }).select('+passwordHash');

  if (!user) {
    await verifyPassword(password, await dummyHash());
    throw invalid();
  }
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    await verifyPassword(password, await dummyHash());
    throw invalid();
  }

  const matches = await verifyPassword(password, user.passwordHash);
  if (!matches || !user.active) {
    if (!matches) await countFailure(user._id);
    throw invalid();
  }

  user.failedLogins = 0;
  user.lockedUntil = null;
  user.lastLoginAt = new Date();
  if (needsRehash(user.passwordHash)) user.passwordHash = await hashPassword(password);
  await user.save();

  const token = newToken();
  await Session.create({
    tokenHash: hashToken(token),
    userId: user._id,
    expiresAt: new Date(Date.now() + env.sessionTtlHours * 60 * 60 * 1000),
    ip: ip || '',
    userAgent: String(userAgent || '').slice(0, 300),
  });

  return { token, user };
}

// Resolves the session cookie to an active user, or null.
export async function resolveSession(token) {
  if (!token || typeof token !== 'string') return null;
  const session = await Session.findOne({ tokenHash: hashToken(token) });
  if (!session) return null;
  if (session.expiresAt <= new Date()) {
    await session.deleteOne();
    return null;
  }
  const user = await User.findById(session.userId);
  if (!user || !user.active) {
    await session.deleteOne();
    return null;
  }
  // Touch at most once a minute to avoid a write on every request.
  if (!session.lastSeenAt || Date.now() - session.lastSeenAt.getTime() > 60_000) {
    session.lastSeenAt = new Date();
    await session.save();
  }
  return { session, user };
}

export async function logout(token) {
  if (!token) return;
  await Session.deleteOne({ tokenHash: hashToken(token) });
}

// Signs a user out everywhere. Called when a password or role changes
// or an account is disabled, so old sessions cannot keep old access.
export async function revokeSessions(userId, { exceptSessionId } = {}) {
  const filter = { userId };
  if (exceptSessionId) filter._id = { $ne: exceptSessionId };
  await Session.deleteMany(filter);
}

export { SESSION_COOKIE };
