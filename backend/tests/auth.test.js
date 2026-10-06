import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer, stopServer, createUser, client, signedIn, PASSWORD, ORIGIN } from './helpers.js';

let ctx;
before(async () => { ctx = await startServer(); });
after(async () => { await stopServer(); });

test('health check', async () => {
  const response = await client().get('/api/health');
  assert.equal(response.status, 200);
  assert.equal(response.body.success, true);
});

test('sign-in: wrong password is refused, right password sets an HttpOnly session cookie', async () => {
  const user = await createUser('SUPER_ADMIN');
  const agent = client();

  const wrong = await agent.login(user.email, 'not-the-password-1');
  assert.equal(wrong.status, 401);
  assert.equal(wrong.body.error.code, 'UNAUTHENTICATED');
  const unknown = await agent.login('nobody@example.com', PASSWORD);
  assert.equal(unknown.status, 401);
  assert.equal(unknown.body.error.message, wrong.body.error.message, 'the response does not reveal whether the email exists');

  const good = await agent.login(user.email);
  assert.equal(good.status, 200);
  const cookieLine = good.setCookie.find((line) => line.startsWith('allsemis_sid='));
  assert.ok(cookieLine, 'a session cookie is set');
  assert.match(cookieLine, /HttpOnly/i);
  assert.match(cookieLine, /SameSite=Lax/i);

  // No credential material is ever returned in a body.
  const text = JSON.stringify(good.body);
  assert.ok(!/passwordHash|scrypt\$|tokenHash/.test(text));
  assert.ok(!text.includes(agent.cookie.split('=')[1]), 'the session token is not in the response body');
  assert.equal(good.body.data.user.role, 'SUPER_ADMIN');
  assert.ok(Array.isArray(good.body.data.user.permissions));

  const me = await agent.get('/api/auth/me');
  assert.equal(me.status, 200);
  assert.equal(me.body.data.user.email, user.email);
});

test('the session token is stored only as a hash', async () => {
  const agent = await signedIn('SUPER_ADMIN');
  const token = agent.cookie.split('=')[1];
  const sessions = await ctx.models.Session.find({});
  assert.ok(sessions.length > 0);
  assert.ok(sessions.every((session) => session.tokenHash !== token && session.tokenHash.length === 64));
});

test('sign-out ends the session on the server', async () => {
  const agent = await signedIn('RECRUITER');
  const cookie = agent.cookie;
  assert.equal((await agent.get('/api/auth/me')).status, 200);
  assert.equal((await agent.post('/api/auth/logout')).status, 200);
  // Replaying the old cookie no longer works.
  const replay = await client().get('/api/auth/me', { headers: { Cookie: cookie } });
  assert.equal(replay.status, 401);
});

test('unauthenticated calls to the admin API are refused', async () => {
  const anonymous = client();
  for (const path of ['/api/admin/candidates', '/api/admin/applications', '/api/admin/jobs', '/api/admin/referrals', '/api/admin/users', '/api/admin/audit-logs', '/api/admin/settings']) {
    const response = await anonymous.get(path);
    assert.equal(response.status, 401, path);
    assert.equal(response.body.success, false);
  }
  assert.equal((await anonymous.post('/api/admin/jobs', { json: { title: 'x' } })).status, 401);
  assert.equal((await anonymous.get('/api/admin/candidates', { headers: { Cookie: 'allsemis_sid=forged-value' } })).status, 401);
});

test('roles are enforced on the server', async () => {
  const content = await signedIn('CONTENT_MANAGER');
  const recruiter = await signedIn('RECRUITER');
  const manager = await signedIn('HIRING_MANAGER');
  const admin = await signedIn('SUPER_ADMIN');

  // A content manager sees no recruitment data.
  for (const path of ['/api/admin/candidates', '/api/admin/applications', '/api/admin/requirements', '/api/admin/referrals', '/api/admin/enquiries', '/api/admin/ats-results', '/api/admin/users', '/api/admin/audit-logs']) {
    assert.equal((await content.get(path)).status, 403, `content manager ${path}`);
  }
  assert.equal((await content.get('/api/admin/insights')).status, 200);

  // A recruiter cannot edit website content, manage users or delete jobs.
  assert.equal((await recruiter.post('/api/admin/insights', { json: { title: 'Nope' } })).status, 403);
  assert.equal((await recruiter.get('/api/admin/users')).status, 403);
  const job = await admin.post('/api/admin/jobs', { json: { title: 'Role for the permission test' } });
  assert.equal(job.status, 201);
  assert.equal((await recruiter.delete(`/api/admin/jobs/${job.body.data.id}`)).status, 403);
  assert.equal((await recruiter.get('/api/admin/candidates')).status, 200);

  // A hiring manager reads but does not write.
  assert.equal((await manager.get('/api/admin/jobs')).status, 200);
  assert.equal((await manager.patch(`/api/admin/jobs/${job.body.data.id}`, { json: { title: 'Changed' } })).status, 403);
  assert.equal((await manager.post('/api/admin/jobs', { json: { title: 'New' } })).status, 403);

  // A role sent by the client changes nothing.
  const sneaky = await recruiter.post('/api/admin/users', { json: { name: 'X', email: 'x@example.com', role: 'SUPER_ADMIN' } });
  assert.equal(sneaky.status, 403);
  const stillRecruiter = await recruiter.get('/api/auth/me', { headers: { 'X-Role': 'SUPER_ADMIN' } });
  assert.equal(stillRecruiter.body.data.user.role, 'RECRUITER');
});

test('publishing needs the publish permission', async () => {
  const admin = await signedIn('SUPER_ADMIN');
  const content = await signedIn('CONTENT_MANAGER');
  const recruiter = await signedIn('RECRUITER');
  // Content managers may read jobs but not write them.
  assert.equal((await content.post('/api/admin/jobs', { json: { title: 'x', status: 'published' } })).status, 403);
  // Recruiters hold jobs:publish.
  const published = await recruiter.post('/api/admin/jobs', { json: { title: 'Published by a recruiter', status: 'published' } });
  assert.equal(published.status, 201);
  assert.equal(published.body.data.status, 'published');
  assert.ok(published.body.data.publishedAt);
  assert.equal((await admin.delete(`/api/admin/jobs/${published.body.data.id}`)).status, 200);
});

test('state-changing requests need the app header and an allowed origin', async () => {
  const user = await createUser('SUPER_ADMIN');
  const noHeader = await client().post('/api/auth/login', { json: { email: user.email, password: PASSWORD }, xhr: false });
  assert.equal(noHeader.status, 403);
  const foreign = await client().post('/api/auth/login', { json: { email: user.email, password: PASSWORD }, origin: 'https://evil.example' });
  assert.equal(foreign.status, 403);

  const agent = await signedIn('SUPER_ADMIN');
  const forged = await agent.post('/api/admin/jobs', { json: { title: 'CSRF' }, origin: 'https://evil.example' });
  assert.equal(forged.status, 403);
  const formPost = await agent.post('/api/admin/jobs', { json: { title: 'CSRF' }, xhr: false });
  assert.equal(formPost.status, 403);
});

test('CORS allows only the configured frontend origin', async () => {
  const allowed = await client().get('/api/public/jobs', { origin: ORIGIN });
  assert.equal(allowed.headers.get('access-control-allow-origin'), ORIGIN);
  assert.equal(allowed.headers.get('access-control-allow-credentials'), 'true');
  const other = await client().get('/api/public/jobs', { origin: 'https://evil.example' });
  assert.equal(other.headers.get('access-control-allow-origin'), null);
});

test('security headers are set and stack traces are not returned', async () => {
  const response = await client().get('/api/does-not-exist');
  assert.equal(response.status, 404);
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(response.headers.get('x-powered-by'), null);
  assert.ok(response.headers.get('content-security-policy'));
  const bad = await client().post('/api/auth/login', { headers: { 'Content-Type': 'application/json' }, form: '{not json' });
  assert.equal(bad.status, 400);
  assert.ok(!/\n\s+at /.test(JSON.stringify(bad.body)) && !('stack' in bad.body.error), 'no stack trace in the response');
});

test('query operators cannot be injected through request bodies or query strings', async () => {
  const injected = await client().post('/api/auth/login', { json: { email: { $gt: '' }, password: { $gt: '' } } });
  assert.equal(injected.status, 400);
  assert.equal(injected.body.error.code, 'VALIDATION_ERROR');
  const agent = await signedIn('SUPER_ADMIN');
  const filtered = await agent.get('/api/admin/jobs?status[$ne]=draft');
  assert.equal(filtered.status, 200, 'an object-valued filter is ignored, not executed');
});

test('user management: create, change role, disable; sessions are revoked', async () => {
  const admin = await signedIn('SUPER_ADMIN');
  const created = await admin.post('/api/admin/users', { json: { name: 'New Recruiter', email: 'new.recruiter@example.com', role: 'RECRUITER' } });
  assert.equal(created.status, 201);
  assert.ok(created.body.data.temporaryPassword, 'a generated password is returned once');
  assert.ok(!('passwordHash' in created.body.data.user));
  const id = created.body.data.user.id;

  // The server always generates the first password. One sent by the
  // caller is ignored.
  const chosen = await admin.post('/api/admin/users', { json: { name: 'Chosen', email: 'chosen@example.com', role: 'RECRUITER', password: 'chosen-by-admin-123' } });
  assert.equal(chosen.status, 201);
  assert.ok(chosen.body.data.temporaryPassword);
  assert.equal(chosen.body.data.user.mustChangePassword, true);
  assert.equal((await client().login('chosen@example.com', 'chosen-by-admin-123')).status, 401);

  // A temporary password signs in but opens nothing until it is changed.
  const person = client();
  const firstLogin = await person.login('new.recruiter@example.com', created.body.data.temporaryPassword);
  assert.equal(firstLogin.status, 200);
  assert.equal(firstLogin.body.data.user.mustChangePassword, true);
  const blocked = await person.get('/api/admin/candidates');
  assert.equal(blocked.status, 403);
  assert.equal(blocked.body.error.code, 'PASSWORD_CHANGE_REQUIRED');
  const newPassword = 'a-new-passphrase-2026';
  assert.equal((await person.post('/api/auth/change-password', { json: { currentPassword: 'wrong-current-1', newPassword } })).status, 400);
  assert.equal((await person.post('/api/auth/change-password', { json: { currentPassword: created.body.data.temporaryPassword, newPassword: 'short' } })).status, 400);
  const same = await person.post('/api/auth/change-password', { json: { currentPassword: created.body.data.temporaryPassword, newPassword: created.body.data.temporaryPassword } });
  assert.equal(same.status, 400, 'a temporary password must actually be replaced');
  assert.equal((await person.post('/api/auth/change-password', { json: { currentPassword: created.body.data.temporaryPassword, newPassword } })).status, 200);
  assert.equal((await person.get('/api/admin/candidates')).status, 200);
  assert.equal((await client().login('new.recruiter@example.com', created.body.data.temporaryPassword)).status, 401, 'the temporary password no longer works');

  // Reset: the server generates a new temporary password, the person is
  // signed out and must change it again.
  const reset = await admin.post(`/api/admin/users/${id}/reset-password`);
  assert.equal(reset.status, 200);
  assert.ok(reset.body.data.temporaryPassword && reset.body.data.temporaryPassword !== created.body.data.temporaryPassword);
  assert.equal(reset.body.data.user.mustChangePassword, true);
  assert.equal((await person.get('/api/admin/candidates')).status, 401, 'the old session ended with the reset');
  assert.equal((await client().login('new.recruiter@example.com', newPassword)).status, 401, 'the old password no longer works');
  assert.equal((await person.login('new.recruiter@example.com', reset.body.data.temporaryPassword)).status, 200);
  assert.equal((await person.post('/api/auth/change-password', { json: { currentPassword: reset.body.data.temporaryPassword, newPassword } })).status, 200);
  // A password cannot be set through the edit route, and not for yourself.
  const viaEdit = await admin.patch(`/api/admin/users/${id}`, { json: { password: 'set-through-edit-123' } });
  assert.equal(viaEdit.status, 200);
  assert.equal((await client().login('new.recruiter@example.com', 'set-through-edit-123')).status, 401);
  const self = (await admin.get('/api/auth/me')).body.data.user.id;
  assert.equal((await admin.post(`/api/admin/users/${self}/reset-password`)).status, 400);
  assert.equal((await person.post(`/api/admin/users/${id}/reset-password`)).status, 403, 'only a super admin resets passwords');

  const changed = await admin.patch(`/api/admin/users/${id}`, { json: { role: 'CONTENT_MANAGER' } });
  assert.equal(changed.status, 200);
  assert.equal((await person.get('/api/admin/candidates')).status, 401, 'the old session ended when the role changed');

  await admin.patch(`/api/admin/users/${id}`, { json: { active: false } });
  assert.equal((await person.login('new.recruiter@example.com', newPassword)).status, 401, 'a disabled account cannot sign in');

  const list = await admin.get('/api/admin/users');
  assert.ok(list.body.data.every((user) => !('passwordHash' in user)));

  const logs = await admin.get('/api/admin/audit-logs?entityType=user');
  const actions = logs.body.data.map((entry) => entry.action);
  assert.ok(actions.includes('user.created') && actions.includes('user.role_changed') && actions.includes('user.disabled') && actions.includes('user.password_reset'));
});

test('repeated wrong passwords pause sign-in for that account, without revealing that it exists', async () => {
  const user = await createUser('RECRUITER', 'lockme@example.com');
  const agent = client();
  let wrong;
  for (let i = 0; i < 5; i += 1) {
    wrong = await agent.login(user.email, 'wrong-password-1');
    assert.equal(wrong.status, 401);
  }
  // The correct password is now refused...
  const paused = await agent.login(user.email, PASSWORD);
  assert.equal(paused.status, 401);
  assert.ok(!paused.setCookie.length, 'no session is created');
  // ...with exactly the answer a wrong password or an unknown email gets.
  const unknown = await agent.login('nobody.here@example.com', PASSWORD);
  assert.deepEqual(paused.body, wrong.body);
  assert.deepEqual(paused.body, unknown.body);
  assert.match(paused.body.error.message, /pauses for fifteen minutes/);

  // Once the pause has passed, the correct password works again.
  await ctx.models.User.updateOne({ email: user.email }, { $set: { lockedUntil: new Date(Date.now() - 1000) } });
  assert.equal((await agent.login(user.email, PASSWORD)).status, 200);
});

test('sign-in attempts are rate limited per connection', async () => {
  process.env.RATE_LIMIT_IN_TESTS = '1';
  try {
    const agent = client();
    let limited = null;
    for (let i = 0; i < 14 && !limited; i += 1) {
      const response = await agent.login('ratelimit@example.com', 'wrong-password-1');
      if (response.status === 429 && response.body.error.code === 'RATE_LIMITED') limited = response;
    }
    assert.ok(limited, 'a 429 is returned after too many attempts');
  } finally {
    delete process.env.RATE_LIMIT_IN_TESTS;
  }
});
