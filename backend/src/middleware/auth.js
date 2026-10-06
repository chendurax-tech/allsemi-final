import { SESSION_COOKIE } from '../config/constants.js';
import { roleCan } from '../config/permissions.js';
import { resolveSession } from '../services/authService.js';
import { unauthenticated, forbidden, AppError } from '../utils/AppError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

/*
  Authentication and authorisation middleware.

  Every protected route is written as:
      router.<method>(path, requireAuth, requirePermission(P.X), handler)
  so the order is always: 1. is there a valid session, 2. may this role
  do this, 3. run the operation.

  The user, role and permissions come from the session and the
  database. Nothing the client sends (a role, a user id, an "isAdmin"
  flag) is read to make an access decision.
*/

export const requireAuth = asyncHandler(async (req, res, next) => {
  const token = req.cookies?.[SESSION_COOKIE];
  const resolved = await resolveSession(token);
  if (!resolved) throw unauthenticated();
  req.user = {
    id: String(resolved.user._id),
    name: resolved.user.name,
    email: resolved.user.email,
    role: resolved.user.role,
    mustChangePassword: resolved.user.mustChangePassword,
  };
  req.sessionId = resolved.session._id;
  req.sessionToken = token;
  next();
});

/*
  An account that was given a temporary password (created by an admin
  or by create-admin without ADMIN_PASSWORD) can sign in, read its own
  profile and change its password. Every other protected route answers
  403 PASSWORD_CHANGE_REQUIRED until the password has been changed.
*/
export function requirePasswordChanged(req, res, next) {
  if (req.user?.mustChangePassword) {
    return next(new AppError(403, 'PASSWORD_CHANGE_REQUIRED', 'Change your temporary password to continue.'));
  }
  return next();
}

export function requirePermission(...permissions) {
  return (req, res, next) => {
    if (!req.user) return next(unauthenticated());
    const allowed = permissions.every((permission) => roleCan(req.user.role, permission));
    if (!allowed) return next(forbidden());
    return next();
  };
}

// For use inside a handler when the permission depends on the request
// (publishing needs more than editing, for example).
export function assertPermission(req, permission) {
  if (!req.user || !roleCan(req.user.role, permission)) throw forbidden();
}

export const can = (req, permission) => Boolean(req.user && roleCan(req.user.role, permission));
