import { ok, created } from '../utils/apiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { SESSION_COOKIE } from '../config/constants.js';
import { ROLES } from '../config/constants.js';
import { ROLE_PERMISSIONS } from '../config/permissions.js';
import { User } from '../models/index.js';
import {
  login as signIn, logout as signOut, cookieOptions, clearCookieOptions, publicUser, revokeSessions,
} from '../services/authService.js';
import { hashPassword, verifyPassword, generatePassword } from '../utils/password.js';
import { record } from '../services/auditService.js';
import { badRequest, conflict, notFound, unauthenticated } from '../utils/AppError.js';
import { assertObjectId } from '../utils/query.js';

export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  let result;
  try {
    result = await signIn({ email, password, ip: req.ip, userAgent: req.get('User-Agent') });
  } catch (error) {
    await record({ req, action: 'auth.login_failed', entityType: 'user', summary: 'Failed sign-in attempt', metadata: { email } });
    throw error;
  }
  res.cookie(SESSION_COOKIE, result.token, cookieOptions());
  await record({ req, user: result.user, action: 'auth.login', entityType: 'user', entityId: result.user._id, summary: `${result.user.name} signed in` });
  ok(res, { user: publicUser(result.user) });
});

export const logout = asyncHandler(async (req, res) => {
  await signOut(req.sessionToken);
  res.clearCookie(SESSION_COOKIE, clearCookieOptions());
  await record({ req, action: 'auth.logout', entityType: 'user', entityId: req.user.id, summary: `${req.user.name} signed out` });
  ok(res, { signedOut: true });
});

export const me = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id);
  if (!user) throw unauthenticated();
  ok(res, { user: publicUser(user) });
});

export const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const user = await User.findById(req.user.id).select('+passwordHash');
  if (!user || !(await verifyPassword(currentPassword, user.passwordHash))) {
    throw badRequest('The current password is not correct.');
  }
  // A temporary password must actually be replaced.
  if (await verifyPassword(newPassword, user.passwordHash)) {
    throw badRequest('Choose a password that is different from the current one.', [{ field: 'newPassword', message: 'Choose a password that is different from the current one.' }]);
  }
  user.passwordHash = await hashPassword(newPassword);
  user.mustChangePassword = false;
  await user.save();
  // Every other session for this account is signed out.
  await revokeSessions(user._id, { exceptSessionId: req.sessionId });
  await record({ req, action: 'user.password_changed', entityType: 'user', entityId: user._id, summary: `${user.name} changed their password` });
  ok(res, { changed: true });
});

// ---- access matrix (read by Settings > Access) ----
export const access = asyncHandler(async (req, res) => {
  ok(res, { roles: ROLES.map((role) => ({ role, permissions: ROLE_PERMISSIONS[role] })) });
});

// ---- user management (SUPER_ADMIN) ----
export const listUsers = asyncHandler(async (req, res) => {
  const users = await User.find({}).sort({ createdAt: 1 }).limit(500);
  ok(res, users.map((user) => user.toJSON()));
});

export const createUser = asyncHandler(async (req, res) => {
  const { name, email, role } = req.body;
  if (await User.findOne({ email })) throw conflict('A user with that email already exists.');
  // The server generates the first password. Whoever creates the
  // account sees it, so it is temporary: the new user must choose
  // their own at first sign-in.
  const password = generatePassword();
  const user = await User.create({ name, email, role, passwordHash: await hashPassword(password), mustChangePassword: true });
  await record({ req, action: 'user.created', entityType: 'user', entityId: user._id, summary: `Created user ${user.email} as ${role}`, metadata: { role } });
  // Shown once, here. It is not stored in readable form and cannot be
  // retrieved later.
  created(res, { user: user.toJSON(), temporaryPassword: password });
});

/*
  POST /api/admin/users/:id/reset-password
  Replaces another user's password with a generated temporary one,
  signs them out everywhere and returns the new password once. Your own
  password is changed with "Change password", which asks for the
  current one.
*/
export const resetUserPassword = asyncHandler(async (req, res) => {
  const user = await User.findById(assertObjectId(req.params.id)).select('+passwordHash');
  if (!user) throw notFound('That user was not found.');
  if (String(user._id) === req.user.id) throw badRequest('Use "Change password" to change your own password.');
  const password = generatePassword();
  user.passwordHash = await hashPassword(password);
  user.mustChangePassword = true;
  user.failedLogins = 0;
  user.lockedUntil = null;
  await user.save();
  await revokeSessions(user._id);
  await record({ req, action: 'user.password_reset', entityType: 'user', entityId: user._id, summary: `Password reset for ${user.email}` });
  ok(res, { user: user.toJSON(), temporaryPassword: password });
});

export const updateUser = asyncHandler(async (req, res) => {
  const user = await User.findById(assertObjectId(req.params.id));
  if (!user) throw notFound('That user was not found.');
  const { name, role, active } = req.body;
  const isSelf = String(user._id) === req.user.id;

  if (isSelf && (active === false || (role && role !== user.role))) {
    throw badRequest('You cannot change your own role or disable your own account.');
  }
  // Never leave the system without an active super admin.
  const removesSuperAdmin = user.role === 'SUPER_ADMIN' && user.active && ((role && role !== 'SUPER_ADMIN') || active === false);
  if (removesSuperAdmin) {
    const others = await User.countDocuments({ role: 'SUPER_ADMIN', active: true, _id: { $ne: user._id } });
    if (others === 0) throw badRequest('At least one active super admin is required.');
  }

  const changes = {};
  if (name !== undefined && name !== user.name) { changes.name = true; user.name = name; }
  if (role !== undefined && role !== user.role) { changes.role = { from: user.role, to: role }; user.role = role; }
  if (active !== undefined && active !== user.active) { changes.active = active; user.active = active; }
  await user.save();

  // Old sessions must not keep old access.
  if (changes.role || changes.active === false) await revokeSessions(user._id);

  if (changes.role) await record({ req, action: 'user.role_changed', entityType: 'user', entityId: user._id, summary: `${user.email}: ${changes.role.from} to ${changes.role.to}`, metadata: changes.role });
  if (changes.active !== undefined) await record({ req, action: changes.active ? 'user.enabled' : 'user.disabled', entityType: 'user', entityId: user._id, summary: `${user.email} ${changes.active ? 'enabled' : 'disabled'}` });
  if (changes.name) await record({ req, action: 'user.updated', entityType: 'user', entityId: user._id, summary: `Renamed user ${user.email}` });

  ok(res, user.toJSON());
});
