import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { startServer, stopServer, client, signedIn } from './helpers.js';
import { env } from '../src/config/env.js';

/*
  GET /health and GET /ready.

  /health is the address an uptime monitor calls: public, no sign-in,
  no cookie, no database, a fixed answer. /ready adds one fact, whether
  the database connection is up. /api/health is the older check and
  stays as it was.

  The test that disconnects the database is the last one in this file.
  It connects again before it ends, so stopServer() finds the server as
  it expects it.
*/

let ctx;
before(async () => { ctx = await startServer(); });
after(async () => { await stopServer(); });

// What a monitor sends: no cookie, no Origin, no X-Requested-With.
const bare = { origin: null, xhr: false };
const ALIVE = { status: 'ok', service: 'allsemis-api' };

// Every header of a response as one text, names included.
const headerText = (response) => [...response.headers.entries()].map(([name, value]) => `${name}: ${value}`).join('\n');

test('GET /health answers 200 with a fixed body to a request that carries nothing', async () => {
  const response = await client().get('/health', bare);
  assert.equal(response.status, 200);
  assert.deepEqual(response.body, ALIVE, 'exactly these two fields');
  assert.match(response.headers.get('content-type'), /^application\/json/);
  assert.equal(response.headers.get('cache-control'), 'no-store', 'a monitor never gets a stored copy');
  assert.deepEqual(response.setCookie, [], 'no cookie is set');
  assert.equal(response.headers.get('set-cookie'), null);

  // The same answer every time: there is nothing in it that varies.
  const again = await client().get('/health', bare);
  assert.deepEqual(again.body, response.body);
});

test('GET /health needs no sign-in and does not look at the session', async () => {
  // Signed out, with the headers the frontend sends.
  const asFrontend = await client().get('/health');
  assert.equal(asFrontend.status, 200);
  assert.deepEqual(asFrontend.body, ALIVE);

  // Signed in: the same answer, and the session cookie is neither
  // replaced nor cleared.
  const recruiter = await signedIn('RECRUITER');
  const cookieBefore = recruiter.cookie;
  assert.ok(cookieBefore, 'the agent holds a session cookie');
  const signedInAnswer = await recruiter.get('/health');
  assert.equal(signedInAnswer.status, 200);
  assert.deepEqual(signedInAnswer.body, ALIVE);
  assert.deepEqual(signedInAnswer.setCookie, []);
  assert.equal(recruiter.cookie, cookieBefore);
  assert.equal((await recruiter.get('/api/auth/me')).status, 200, 'and the session still works');

  // A cookie that is not a session, and a request from another website:
  // neither is read, so neither changes the answer.
  const junkCookie = await client().get('/health', { ...bare, headers: { Cookie: 'allsemis_sid=not-a-session; other=1' } });
  assert.equal(junkCookie.status, 200);
  assert.deepEqual(junkCookie.body, ALIVE);
  assert.deepEqual(junkCookie.setCookie, []);
  const foreign = await client().get('/health', { origin: 'https://evil.example.com', xhr: false });
  assert.equal(foreign.status, 200);
  assert.deepEqual(foreign.body, ALIVE);
  assert.equal(foreign.headers.get('access-control-allow-origin'), null, 'no other site is told it may read the answer');

  // A query string is ignored.
  const withQuery = await client().get('/health?verbose=1&debug=true', bare);
  assert.deepEqual(withQuery.body, ALIVE);

  // For contrast: the admin API on the same server does need a session.
  assert.equal((await client().get('/api/admin/jobs')).status, 401);
});

test('GET /health exposes no secret, no connection string and no internals', async () => {
  const { host, port } = mongoose.connection;
  const secrets = [
    process.env.SESSION_SECRET,
    process.env.OPENAI_API_KEY,
    env.sessionSecret,
    env.openai.apiKey,
    env.mongodbUri,
    `${host}:${port}`,
    'mongodb',
    'sk-test',
    'test-only-session',
  ].filter(Boolean);
  assert.ok(secrets.length >= 6, 'the values that must not appear are known to this test');

  for (const path of ['/health', '/ready']) {
    const response = await client().get(path, bare);
    assert.equal(response.status, 200);
    const text = `${JSON.stringify(response.body)}\n${headerText(response)}`;
    for (const secret of secrets) assert.ok(!text.includes(secret), `${path} does not contain "${secret.slice(0, 12)}..."`);
    assert.deepEqual(Object.keys(response.body).sort(), ['service', 'status'], `${path}: the body has these two keys only`);
    // No version, host name, uptime, environment name or stack trace.
    assert.ok(!/stack|node_modules|\.js\b|Error|version|uptime|hostname|NODE_ENV|development|production|\btest\b/i.test(JSON.stringify(response.body)), `${path}: nothing about the process`);
    assert.ok(!/\n\s+at\s/.test(text), `${path}: no stack trace`);
    assert.equal(response.headers.get('x-powered-by'), null, `${path}: the framework is not named`);
    assert.equal(response.headers.get('server'), null);
  }

  // The security headers every response carries are on this one too.
  const response = await client().get('/health', bare);
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  assert.match(response.headers.get('content-security-policy'), /default-src 'none'/);
});

test('/health is a GET only: HEAD answers 200 without a body, other methods are not routes', async () => {
  const head = await fetch(`${ctx.baseUrl}/health`, { method: 'HEAD' });
  assert.equal(head.status, 200);
  assert.equal(await head.text(), '');
  assert.equal(head.headers.get('cache-control'), 'no-store');
  assert.equal(head.headers.get('set-cookie'), null);

  // With the headers the frontend sends, so the answer is the router's
  // and not the CSRF check's.
  for (const method of ['post', 'put', 'patch', 'delete']) {
    const response = await client()[method]('/health', { json: method === 'delete' ? undefined : { status: 'down' } });
    assert.equal(response.status, 404, `${method.toUpperCase()} /health`);
    assert.equal(response.body.success, false);
    assert.equal(response.body.error.code, 'NOT_FOUND');
    assert.ok(!/stack|\bat\s/.test(JSON.stringify(response.body)));
  }
  // Nothing a POST carried changed the answer.
  assert.deepEqual((await client().get('/health', bare)).body, ALIVE);
  // The path is exact.
  assert.equal((await client().get('/health/details', bare)).status, 404);
  assert.equal((await client().get('/healthz', bare)).status, 404);
});

test('/health is outside the API rate limit: a monitor is never refused', async () => {
  // The limits are switched off in tests; this test switches them on.
  process.env.RATE_LIMIT_IN_TESTS = '1';
  try {
    // /api is counted: the answer carries the limit headers.
    const counted = await client().get('/api/health', bare);
    assert.equal(counted.status, 200);
    assert.ok(counted.headers.get('ratelimit-policy') || counted.headers.get('ratelimit'), 'a request under /api is counted');

    // 50 quick requests, all at once, all answered, none counted.
    const burst = await Promise.all(Array.from({ length: 50 }, () => client().get('/health', bare)));
    assert.deepEqual(burst.map((response) => response.status), Array(50).fill(200));
    assert.ok(burst.every((response) => response.body.status === 'ok'));
    for (const response of burst) {
      assert.equal(response.headers.get('ratelimit-policy'), null, '/health is not counted by a limiter');
      assert.equal(response.headers.get('ratelimit'), null);
      assert.equal(response.headers.get('retry-after'), null);
    }

    // Use up the whole allowance of /api for this address (600 requests
    // in fifteen minutes; one was made above).
    let refused = null;
    for (let i = 0; i < 620 && !refused; i += 1) {
      const response = await client().get('/api/health', bare);
      if (response.status === 429) refused = response;
      else assert.equal(response.status, 200);
    }
    assert.ok(refused, 'the API limit was reached');
    assert.equal(refused.body.error.code, 'RATE_LIMITED');

    // The API now refuses this address. /health and /ready still answer.
    assert.equal((await client().get('/api/health', bare)).status, 429);
    const after = await Promise.all(Array.from({ length: 50 }, () => client().get('/health', bare)));
    assert.deepEqual(after.map((response) => response.status), Array(50).fill(200));
    assert.deepEqual(after[49].body, ALIVE);
    assert.equal((await client().get('/ready', bare)).status, 200);
  } finally {
    delete process.env.RATE_LIMIT_IN_TESTS;
  }
  assert.equal((await client().get('/api/health', bare)).status, 200, 'switched off again for the rest of the file');
});

test('GET /ready says whether the database is connected, and /health does not depend on it', async () => {
  const db = await import('../src/config/db.js');
  const recruiter = await signedIn('RECRUITER');

  // Connected.
  assert.equal(db.databaseReady(), true);
  const ready = await client().get('/ready', bare);
  assert.equal(ready.status, 200);
  assert.deepEqual(ready.body, { status: 'ready', service: 'allsemis-api' });
  assert.equal(ready.headers.get('cache-control'), 'no-store');
  assert.deepEqual(ready.setCookie, []);
  const apiHealth = await client().get('/api/health', bare);
  assert.equal(apiHealth.status, 200);
  assert.deepEqual(apiHealth.body, { success: true, data: { status: 'ok' } });

  // Where to connect again afterwards: the address of the test database.
  const { host, port, name } = mongoose.connection;
  const uri = `mongodb://${host}:${port}/${name}`;
  await db.disconnectDatabase();
  try {
    assert.equal(db.databaseReady(), false);

    // /health: still 200, the same body, and quickly (it does not wait
    // for a database that is not there).
    const started = Date.now();
    const alive = await client().get('/health', bare);
    assert.equal(alive.status, 200);
    assert.deepEqual(alive.body, ALIVE);
    assert.ok(Date.now() - started < 2000, 'the answer does not wait for the database');
    // Also with a session cookie: the session is not looked up.
    const withSession = await recruiter.get('/health');
    assert.equal(withSession.status, 200);
    assert.deepEqual(withSession.body, ALIVE);
    assert.equal((await fetch(`${ctx.baseUrl}/health`, { method: 'HEAD' })).status, 200);

    // /ready: 503, with no detail about why.
    const unavailable = await client().get('/ready', bare);
    assert.equal(unavailable.status, 503);
    assert.deepEqual(unavailable.body, { status: 'unavailable', service: 'allsemis-api' });
    assert.equal(unavailable.headers.get('cache-control'), 'no-store');
    const unavailableText = `${JSON.stringify(unavailable.body)}\n${headerText(unavailable)}`;
    assert.ok(!/mongodb|ECONN|timed out|stack|127\.0\.0\.1/i.test(unavailableText), 'no reason, address or error text');

    // /api/health: 503 in the API's error shape, as before.
    const apiDown = await client().get('/api/health', bare);
    assert.equal(apiDown.status, 503);
    assert.equal(apiDown.body.success, false);
    assert.equal(apiDown.body.error.code, 'DATABASE_UNAVAILABLE');
    assert.ok(!/mongodb|127\.0\.0\.1/i.test(JSON.stringify(apiDown.body)));
  } finally {
    await db.connectDatabase(uri);
  }

  // Connected again: ready, and the data is where it was.
  assert.equal(db.databaseReady(), true);
  const back = await client().get('/ready', bare);
  assert.equal(back.status, 200);
  assert.deepEqual(back.body, { status: 'ready', service: 'allsemis-api' });
  assert.equal((await client().get('/api/health', bare)).status, 200);
  assert.equal((await recruiter.get('/api/admin/jobs')).status, 200, 'the session made before the interruption still works');
});
