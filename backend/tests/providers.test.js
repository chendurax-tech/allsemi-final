import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/*
  The external providers: Resend, Cloudinary, Backblaze B2, and the
  rule that decides which driver each service uses.

  Nothing here reaches a provider. `fetch` is replaced by a stand-in
  that records each request and answers what the test tells it to, and
  the B2 driver is handed a stand-in for the AWS SDK. So these tests
  show what this code SENDS and how it reads an answer. They do not
  show that Resend, Cloudinary or B2 accept it: that needs one real
  run with real credentials (see "Connecting the services" in
  README.md).

  This file runs in its own process (node --test starts one per file)
  as a development server with credentials filled in, which is the
  case the other test files never see: they run with NODE_ENV=test and
  the in-memory drivers. Every variable is set before the application
  is imported, the driver variables included, so a .env on this machine
  cannot change what is tested. None of the values is a real credential.
*/
const SECRETS = {
  cloudinary: 'cloudinary-secret-MUST-NOT-LEAK',
  b2: 'b2-secret-MUST-NOT-LEAK',
  resend: 're_resend-key-MUST-NOT-LEAK',
  openai: 'sk-openai-key-MUST-NOT-LEAK',
  session: 'providers-test-session-secret-0123456789-abcdef',
};
const CONFIG = {
  NODE_ENV: 'development',
  PORT: '',
  TRUST_PROXY: '0',
  LOG_LEVEL: 'info',
  MONGODB_URI: '',
  FRONTEND_URL: 'http://localhost:5173',
  SESSION_SECRET: SECRETS.session,
  SESSION_TTL_HOURS: '',
  COOKIE_SAMESITE: 'lax',
  COOKIE_DOMAIN: '',
  FILE_STORAGE_DRIVER: '',
  MEDIA_STORAGE_DRIVER: '',
  EMAIL_DRIVER: '',
  CLOUDINARY_CLOUD_NAME: 'sample-cloud',
  CLOUDINARY_API_KEY: '123456789012345',
  CLOUDINARY_API_SECRET: SECRETS.cloudinary,
  CLOUDINARY_FOLDER: 'allsemis-test',
  B2_ENDPOINT: 'https://s3.us-west-004.backblazeb2.com',
  B2_REGION: 'us-west-004',
  B2_BUCKET_NAME: 'sample-private-bucket',
  B2_ACCESS_KEY_ID: 'sample-access-key-id',
  B2_SECRET_ACCESS_KEY: SECRETS.b2,
  SIGNED_URL_TTL_SECONDS: '90',
  RESEND_API_KEY: SECRETS.resend,
  EMAIL_FROM: 'ALLSEMIS <no-reply@example.com>',
  ADMIN_NOTIFICATION_EMAIL: 'team@example.com',
  // A key without a model: the AI comparison must count as not configured.
  OPENAI_API_KEY: SECRETS.openai,
  OPENAI_MODEL: '',
  SEED_ADMIN_EMAIL: '',
  SEED_ADMIN_PASSWORD: '',
};
Object.assign(process.env, CONFIG);

// ---- the server log, captured ----
// The logger writes one JSON line per event. Those lines are kept here
// (and not printed) so a test can check what was logged. Anything else
// written to the streams, the test runner's own output included, is
// passed through untouched.
const logLines = [];
for (const stream of [process.stdout, process.stderr]) {
  const write = stream.write.bind(stream);
  stream.write = (chunk, ...rest) => {
    if (typeof chunk === 'string' && chunk.startsWith('{"time":"')) {
      logLines.push(chunk);
      const done = rest.find((item) => typeof item === 'function');
      if (done) done();
      return true;
    }
    return write(chunk, ...rest);
  };
}
const logged = (event) => logLines.map((line) => JSON.parse(line)).filter((entry) => entry.event === event);
function assertNoSecret(value, where) {
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  for (const [name, secret] of Object.entries(SECRETS)) {
    assert.ok(!text.includes(secret), `${where} must not contain the ${name} secret`);
  }
}

// ---- fetch, replaced ----
// Requests to this test's own server go through. Every other request
// is recorded and answered by `provider.answer`; with no answer set it
// fails, so nothing can reach the network by accident.
const realFetch = globalThis.fetch;
let baseUrl = 'http://127.0.0.1:0';
const provider = { requests: [], answer: null };
globalThis.fetch = async (url, init = {}) => {
  if (String(url).startsWith(`${baseUrl}/`)) return realFetch(url, init);
  const request = { url: String(url), method: init.method, headers: init.headers || {}, body: init.body };
  provider.requests.push(request);
  if (!provider.answer) throw new Error(`Unexpected request to ${request.url}`);
  return provider.answer(request);
};
const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
function answerWith(answer) {
  provider.requests.length = 0;
  provider.answer = answer;
}

const { env, integrations, resolveDriver, describeConfig, validateEnv } = await import('../src/config/env.js');
const { send } = await import('../src/services/email/emailService.js');
const notifications = await import('../src/services/email/notifications.js');
const media = await import('../src/services/storage/publicMedia.js');
const files = await import('../src/services/storage/privateFiles.js');
const { createLocalFileDriver } = await import('../src/services/storage/drivers/local.js');
const { createB2Driver } = await import('../src/services/storage/drivers/b2.js');
const { verifyPayload } = await import('../src/utils/tokens.js');
const { AppError } = await import('../src/utils/AppError.js');

const sha1 = (value) => createHash('sha1').update(value).digest('hex');
const pdfBytes = () => Buffer.concat([Buffer.from('%PDF-1.4\n%sample\n'), Buffer.alloc(200, 0x20), Buffer.from('\n%%EOF\n')]);
const pngBytes = () => Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52, 0, 0, 2, 128, 0, 0, 1, 104]), Buffer.alloc(64, 1)]);
const pdfInspection = { ok: true, type: 'pdf', mime: 'application/pdf', extension: 'pdf' };
const pngInspection = { ok: true, type: 'png', mime: 'image/png', extension: 'png' };

// ---- stand-ins for the two stores ----
// "B2": records what it is asked and keeps the objects in a map. The
// real driver is checked on its own further down.
const b2Calls = [];
const b2Objects = new Map();
const fakeB2 = {
  async put(key, buffer, mimeType) { b2Calls.push({ op: 'put', key, mimeType }); b2Objects.set(key, buffer); },
  async signedUrl(key, details) { b2Calls.push({ op: 'signedUrl', key, ...details }); return { url: `https://b2.invalid/${key}?signed=1`, expiresIn: env.signedUrlTtlSeconds }; },
  async remove(key) { b2Calls.push({ op: 'remove', key }); b2Objects.delete(key); },
};
// The local disk driver, on a temporary folder instead of backend/.data.
let localRoot;
let localDisk;
let server;

before(async () => {
  localRoot = await fs.mkdtemp(path.join(await fs.realpath(os.tmpdir()), 'allsemis-private-'));
  localDisk = createLocalFileDriver(localRoot);
  files.setDriversForTests({ b2: fakeB2, local: localDisk });
  const { createApp } = await import('../src/app.js');
  server = createApp().listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  if (localRoot) await fs.rm(localRoot, { recursive: true, force: true });
});

const get = (pathOrUrl) => realFetch(pathOrUrl.startsWith('http') ? pathOrUrl : `${baseUrl}${pathOrUrl}`, { redirect: 'manual' });

// =====================================================================
// Driver selection
// =====================================================================

test('driver resolution: the credentials decide, for every combination', () => {
  const services = [
    { provider: 'b2', fallback: 'local' },
    { provider: 'cloudinary', fallback: 'local' },
    { provider: 'resend', fallback: 'log' },
  ];
  for (const { provider: real, fallback } of services) {
    const pick = (nodeEnv, requested, configured) => resolveDriver({ nodeEnv, requested, provider: real, fallback, configured });

    // Development: the provider when its credentials are complete,
    // otherwise the fallback.
    assert.equal(pick('development', '', false), fallback, 'no credentials: the development fallback');
    assert.equal(pick('development', '', true), real, 'complete credentials: the real provider');
    assert.equal(pick('development', fallback, false), fallback);
    assert.equal(pick('development', fallback, true), real, 'a fallback line left over from the template does not block the provider');
    assert.equal(pick('development', real, true), real);
    assert.equal(pick('development', real, false), real, 'a provider named explicitly is forced, even with incomplete credentials');
    assert.equal(pick('development', 'memory', false), 'memory');
    assert.equal(pick('development', 'memory', true), 'memory');
    assert.equal(resolveDriver({ nodeEnv: 'development', provider: real, fallback, configured: false }), fallback, 'an absent variable is the same as an empty one');

    // Production: never the fallback unless it was asked for by name
    // (and validateEnv then refuses local storage).
    assert.equal(pick('production', '', false), real, 'production does not fall back by itself');
    assert.equal(pick('production', '', true), real);
    assert.equal(pick('production', real, false), real);
    assert.equal(pick('production', real, true), real);
    assert.equal(pick('production', fallback, true), real);
    assert.equal(pick('production', fallback, false), fallback);
    assert.equal(pick('production', 'memory', true), 'memory');
    assert.equal(pick('production', 'memory', false), 'memory');

    // Tests: always memory.
    for (const requested of ['', real, fallback, 'memory']) {
      for (const configured of [true, false]) assert.equal(pick('test', requested, configured), 'memory');
    }
  }
});

// Loads config/env.js in a new process with exactly the given
// variables. Every variable the application reads is set (to empty
// unless given), so a .env file on this machine adds nothing.
function loadConfig(overrides) {
  const blank = Object.fromEntries(Object.keys(CONFIG).map((key) => [key, '']));
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', "const m = await import('./src/config/env.js'); console.log(JSON.stringify({ config: m.describeConfig(), ...m.validateEnv() }));"], {
    cwd: new URL('..', import.meta.url),
    env: { PATH: process.env.PATH, ...blank, NODE_ENV: 'development', LOG_LEVEL: 'silent', COOKIE_SAMESITE: 'lax', FRONTEND_URL: 'http://localhost:5173', SESSION_SECRET: SECRETS.session, MONGODB_URI: 'mongodb://localhost:27017/allsemis', ...overrides },
    encoding: 'utf8',
  });
  if (result.status !== 0) return { failed: true, stderr: result.stderr };
  return { ...JSON.parse(result.stdout), raw: result.stdout };
}
const CREDENTIALS = Object.fromEntries(Object.entries(CONFIG).filter(([key]) => /^(CLOUDINARY_|B2_|RESEND_|EMAIL_FROM|ADMIN_)/.test(key)));
const drivers = (loaded) => [loaded.config.fileStorage, loaded.config.mediaStorage, loaded.config.email];
const TEMPLATE_LINES = { FILE_STORAGE_DRIVER: 'local', MEDIA_STORAGE_DRIVER: 'local', EMAIL_DRIVER: 'log' };
const PROVIDER_LINES = { FILE_STORAGE_DRIVER: 'b2', MEDIA_STORAGE_DRIVER: 'cloudinary', EMAIL_DRIVER: 'resend' };

test('configuration as the server loads it: development', () => {
  // Nothing filled in: the development fallbacks.
  const empty = loadConfig({});
  assert.deepEqual(drivers(empty), ['local', 'local', 'log']);
  assert.deepEqual(empty.problems, []);
  assert.deepEqual([empty.config.b2Configured, empty.config.cloudinaryConfigured, empty.config.resendConfigured, empty.config.openaiConfigured], [false, false, false, false]);

  // An .env copied from the earlier template (which set the three
  // driver lines to the fallbacks) with the credentials filled in: the
  // real providers are used, and the start-up warnings say why.
  const filled = loadConfig({ ...CREDENTIALS, ...TEMPLATE_LINES });
  assert.deepEqual(drivers(filled), ['b2', 'cloudinary', 'resend']);
  assert.deepEqual(filled.problems, []);
  for (const name of Object.keys(TEMPLATE_LINES)) {
    assert.ok(filled.warnings.some((warning) => warning.startsWith(`${name}=${TEMPLATE_LINES[name]} is ignored`)), `${name} is reported as ignored`);
  }
  assertNoSecret(filled.raw, 'the start-up configuration and its warnings');

  // The same without the driver lines: same providers, nothing to report.
  const clean = loadConfig({ ...CREDENTIALS });
  assert.deepEqual(drivers(clean), ['b2', 'cloudinary', 'resend']);
  assert.deepEqual(clean.warnings, []);

  // One credential missing per provider: the fallback, as if none were set.
  const partial = loadConfig({ ...CREDENTIALS, B2_BUCKET_NAME: '', CLOUDINARY_API_SECRET: '', EMAIL_FROM: '' });
  assert.deepEqual(drivers(partial), ['local', 'local', 'log']);
  assert.deepEqual([partial.config.b2Configured, partial.config.cloudinaryConfigured, partial.config.resendConfigured], [false, false, false]);

  // A provider named explicitly is used even without credentials, and
  // the warnings say what will not work.
  const forced = loadConfig({ ...PROVIDER_LINES });
  assert.deepEqual(drivers(forced), ['b2', 'cloudinary', 'resend']);
  assert.ok(forced.warnings.some((warning) => /^Backblaze B2 is selected .* incomplete/.test(warning)));
  assert.ok(forced.warnings.some((warning) => /^Cloudinary is selected .* incomplete/.test(warning)));
  assert.ok(forced.warnings.some((warning) => /^Resend is selected .* missing/.test(warning)));

  // An unknown driver name stops the process and names the variable.
  const unknown = loadConfig({ FILE_STORAGE_DRIVER: 'off' });
  assert.equal(unknown.failed, true);
  assert.match(unknown.stderr, /FILE_STORAGE_DRIVER must be one of: b2, local, memory/);
});

test('configuration: Backblaze B2 is described by its endpoint, region, bucket and key', () => {
  const b2Only = Object.fromEntries(Object.entries(CONFIG).filter(([key]) => key.startsWith('B2_')));

  // Without any B2 value the server starts on the local fallback.
  const none = loadConfig({});
  assert.equal(none.config.fileStorage, 'local');
  assert.equal(none.config.b2Configured, false);
  assert.deepEqual(none.problems, []);

  // All five values: B2.
  const all = loadConfig(b2Only);
  assert.equal(all.config.fileStorage, 'b2');
  assert.equal(all.config.b2Configured, true);
  assert.deepEqual(all.problems, []);

  // The region may be left out when the endpoint names it.
  const noRegion = loadConfig({ ...b2Only, B2_REGION: '' });
  assert.equal(noRegion.config.b2Configured, true);
  assert.equal(noRegion.config.fileStorage, 'b2');
  // Each of the other four is needed.
  for (const name of ['B2_ENDPOINT', 'B2_BUCKET_NAME', 'B2_ACCESS_KEY_ID', 'B2_SECRET_ACCESS_KEY']) {
    const missing = loadConfig({ ...b2Only, [name]: '' });
    assert.equal(missing.config.b2Configured, false, `${name} is needed`);
    assert.equal(missing.config.fileStorage, 'local', `without ${name} the local fallback is used`);
    assert.deepEqual(missing.problems, [], `a missing ${name} does not stop the server in development`);
  }
  // An endpoint that is not on backblazeb2.com gives no region by itself.
  assert.equal(loadConfig({ ...b2Only, B2_ENDPOINT: 'https://storage.example.com', B2_REGION: '' }).config.b2Configured, false);

  // A trailing slash is accepted; a path, plain http or a region that
  // disagrees with the endpoint is a problem named at start-up.
  assert.deepEqual(loadConfig({ ...b2Only, B2_ENDPOINT: 'https://s3.us-west-004.backblazeb2.com/' }).problems, []);
  assert.ok(loadConfig({ ...b2Only, B2_ENDPOINT: 'https://s3.us-west-004.backblazeb2.com/my-bucket' }).problems.some((problem) => problem.startsWith('B2_ENDPOINT must be the S3 endpoint')));
  assert.ok(loadConfig({ ...b2Only, B2_ENDPOINT: 'http://s3.us-west-004.backblazeb2.com' }).problems.some((problem) => problem.startsWith('B2_ENDPOINT must be the S3 endpoint')));
  assert.ok(loadConfig({ ...b2Only, B2_REGION: 'eu-central-003' }).problems.some((problem) => problem.startsWith('B2_REGION ("eu-central-003") does not match')));
  assert.ok(loadConfig({ ...b2Only, B2_ENDPOINT: 'https://storage.example.com' }).warnings.some((warning) => warning.startsWith('B2_ENDPOINT is not in the form')));

  // What is left of the earlier provider in an .env file does not stop
  // the server and is not used: it is reported.
  const leftovers = loadConfig({ FILE_STORAGE_DRIVER: 'r2', R2_ACCOUNT_ID: 'old-account', R2_ACCESS_KEY_ID: 'old-id', R2_SECRET_ACCESS_KEY: 'old-secret-MUST-NOT-LEAK', R2_BUCKET_NAME: 'old-bucket' });
  assert.equal(leftovers.failed, undefined);
  assert.equal(leftovers.config.fileStorage, 'local');
  assert.equal(leftovers.config.b2Configured, false);
  assert.ok(!('r2Configured' in leftovers.config));
  assert.ok(leftovers.warnings.some((warning) => warning.startsWith('FILE_STORAGE_DRIVER=r2 is ignored')));
  assert.ok(leftovers.warnings.some((warning) => warning.startsWith('The R2_* variables are no longer read')));
  assert.ok(!leftovers.raw.includes('old-secret-MUST-NOT-LEAK'));
  assert.equal(loadConfig({ ...b2Only, FILE_STORAGE_DRIVER: 'r2' }).config.fileStorage, 'b2');
  assertNoSecret(all.raw, 'the start-up configuration');
});

test('configuration as the server loads it: production and test', () => {
  const production = { NODE_ENV: 'production', FRONTEND_URL: 'https://www.example.com', TRUST_PROXY: '1' };

  // Complete credentials, with or without the old template lines.
  for (const lines of [{}, TEMPLATE_LINES, PROVIDER_LINES]) {
    const ready = loadConfig({ ...production, ...CREDENTIALS, ...lines });
    assert.deepEqual(drivers(ready), ['b2', 'cloudinary', 'resend']);
    assert.deepEqual(ready.problems, []);
  }

  // No credentials and no driver lines: the providers stay selected
  // (the features answer "not configured"), nothing falls back.
  const bare = loadConfig({ ...production });
  assert.deepEqual(drivers(bare), ['b2', 'cloudinary', 'resend']);
  assert.deepEqual(bare.problems, []);
  assert.ok(bare.warnings.some((warning) => warning.startsWith('Backblaze B2 is selected')));
  assert.ok(bare.warnings.some((warning) => warning.startsWith('Cloudinary is selected')));
  assert.ok(bare.warnings.some((warning) => warning.startsWith('Resend is selected')));

  // Local storage asked for by name, without credentials: the server
  // refuses to start. Email in log mode is allowed, with a warning.
  const local = loadConfig({ ...production, ...TEMPLATE_LINES });
  assert.deepEqual(drivers(local), ['local', 'local', 'log']);
  assert.ok(local.problems.some((problem) => problem.startsWith('Private documents must be stored in Backblaze B2 in production')));
  assert.ok(local.problems.some((problem) => problem.startsWith('Public images must be stored in Cloudinary in production')));
  assert.ok(local.warnings.some((warning) => warning.startsWith('EMAIL_DRIVER=log in production')));
  assert.ok(loadConfig({ ...production, ...CREDENTIALS, EMAIL_DRIVER: 'memory' }).problems.includes('EMAIL_DRIVER=memory is for tests only.'));

  // Tests: memory, whatever is set.
  assert.deepEqual(drivers(loadConfig({ NODE_ENV: 'test', ...CREDENTIALS, ...PROVIDER_LINES })), ['memory', 'memory', 'memory']);
});

test('configuration: the AI comparison needs the key and the model, and signed links must have a lifetime', () => {
  assert.equal(loadConfig({}).config.openaiConfigured, false);
  const keyOnly = loadConfig({ OPENAI_API_KEY: SECRETS.openai });
  assert.equal(keyOnly.config.openaiConfigured, false);
  assert.ok(keyOnly.warnings.some((warning) => warning.startsWith('OPENAI_API_KEY is set but OPENAI_MODEL is not')));
  const modelOnly = loadConfig({ OPENAI_MODEL: 'sample-model' });
  assert.equal(modelOnly.config.openaiConfigured, false);
  assert.ok(modelOnly.warnings.some((warning) => warning.startsWith('OPENAI_MODEL is set but OPENAI_API_KEY is not')));
  const both = loadConfig({ OPENAI_API_KEY: SECRETS.openai, OPENAI_MODEL: 'sample-model' });
  assert.equal(both.config.openaiConfigured, true);
  assert.ok(!both.warnings.some((warning) => warning.includes('OPENAI')));
  assertNoSecret(both.raw, 'the start-up configuration');

  assert.ok(loadConfig({ SIGNED_URL_TTL_SECONDS: '0' }).problems.some((problem) => problem.startsWith('SIGNED_URL_TTL_SECONDS must be at least 1')));
  assert.ok(loadConfig({ SIGNED_URL_TTL_SECONDS: '86400' }).warnings.some((warning) => warning.startsWith('SIGNED_URL_TTL_SECONDS is over one hour')));
  assert.deepEqual(loadConfig({ SIGNED_URL_TTL_SECONDS: '300' }).problems, []);
});

test('this process: filled-in credentials select the real providers, and the start-up line holds no secret', () => {
  const config = describeConfig();
  assert.deepEqual([config.fileStorage, config.mediaStorage, config.email], ['b2', 'cloudinary', 'resend']);
  assert.deepEqual([config.b2Configured, config.cloudinaryConfigured, config.resendConfigured], [true, true, true]);
  assert.equal(config.openaiConfigured, false, 'a key without a model is not a configured AI');
  assert.equal(integrations.openai(), false);
  assertNoSecret(config, 'describeConfig()');
  assertNoSecret(validateEnv(), 'validateEnv()');
  assert.equal(env.signedUrlTtlSeconds, 90);
});

// =====================================================================
// Resend
// =====================================================================

test('resend: the request that is sent', async () => {
  answerWith(() => json(200, { id: 'sample-message-id' }));
  const result = await send({ to: 'someone@example.com', subject: 'A subject', html: '<p>Hello</p>', text: 'Hello', replyTo: 'sender@example.com', template: 'sample' });
  assert.deepEqual(result, { sent: true, id: 'sample-message-id' });

  assert.equal(provider.requests.length, 1);
  const [request] = provider.requests;
  assert.equal(request.url, 'https://api.resend.com/emails');
  assert.equal(request.method, 'POST');
  assert.equal(request.headers.Authorization, `Bearer ${SECRETS.resend}`);
  assert.equal(request.headers['Content-Type'], 'application/json');
  assert.deepEqual(JSON.parse(request.body), {
    from: 'ALLSEMIS <no-reply@example.com>',
    to: ['someone@example.com'],
    subject: 'A subject',
    html: '<p>Hello</p>',
    text: 'Hello',
    reply_to: 'sender@example.com',
  });
  // The key travels in the Authorization header and nowhere else.
  assertNoSecret(request.body, 'the request body');
  assertNoSecret(result, 'the value send() returns');

  // Without a reply-to address the field is left out, not sent empty.
  answerWith(() => json(200, { id: 'another-id' }));
  await send({ to: 'someone@example.com', subject: 'S', html: '<p>H</p>', text: 'H', template: 'sample' });
  assert.ok(!('reply_to' in JSON.parse(provider.requests[0].body)));

  // No recipient: nothing is sent at all.
  answerWith(() => json(200, { id: 'unused' }));
  assert.deepEqual(await send({ to: '', subject: 'S', html: 'H', text: 'H', template: 'sample' }), { sent: false, reason: 'no_recipient' });
  assert.equal(provider.requests.length, 0);
});

test('resend: a refusal or a network failure is reported, never thrown, and the key is not logged', async () => {
  const message = { to: 'someone@example.com', subject: 'S', html: '<p>H</p>', text: 'H', template: 'sample' };
  logLines.length = 0;

  answerWith(() => json(422, { statusCode: 422, name: 'validation_error', message: 'The sender domain is not verified.' }));
  assert.deepEqual(await send(message), { sent: false, reason: 'failed' });

  answerWith(() => json(401, { statusCode: 401, name: 'validation_error', message: 'API key is invalid' }));
  assert.deepEqual(await send(message), { sent: false, reason: 'failed' });

  answerWith(() => new Response('<html>Bad gateway</html>', { status: 502 }));
  assert.deepEqual(await send(message), { sent: false, reason: 'failed' }, 'an answer that is not JSON');

  answerWith(() => { throw new TypeError('fetch failed'); });
  assert.deepEqual(await send(message), { sent: false, reason: 'failed' }, 'the service could not be reached');

  const failures = logged('email.failed');
  assert.equal(failures.length, 4, 'each failure is logged');
  assert.equal(failures[0].error.message, 'The sender domain is not verified.', 'with the reason the service gave');
  assert.equal(failures[2].error.message, 'Resend responded with 502');
  assertNoSecret(logLines.join(''), 'the server log');
});

test('resend: the five workflows go to the right address with the right reply-to', async () => {
  notifications.resetConfirmationLimits();
  const sent = () => provider.requests.map((request) => JSON.parse(request.body));
  const admin = (messages) => messages.find((message) => message.to[0] === 'team@example.com');
  const other = (messages) => messages.find((message) => message.to[0] !== 'team@example.com');
  const accept = () => json(200, { id: randomUUID() });

  // 1. Hire Talent
  answerWith(accept);
  await notifications.notifyRequirement({ contactName: 'Hiring Lead', company: 'Employer (sample)', email: 'lead@example.com', role: 'Verification engineers', positions: 3 });
  assert.equal(sent().length, 2);
  assert.deepEqual([admin(sent()).to, admin(sent()).reply_to, admin(sent()).subject], [['team@example.com'], 'lead@example.com', 'New hiring requirement: Verification engineers']);
  assert.deepEqual(other(sent()).to, ['lead@example.com']);
  assert.ok(!('reply_to' in other(sent())));

  // 2. Candidate application
  answerWith(accept);
  await notifications.notifyApplication({ candidate: { name: 'A Candidate', email: 'candidate@example.com' }, job: { title: 'RTL Design Engineer' }, application: { message: 'Hello' }, isNewCandidate: true });
  assert.deepEqual([admin(sent()).to, admin(sent()).reply_to, admin(sent()).subject], [['team@example.com'], 'candidate@example.com', 'New application: A Candidate for RTL Design Engineer']);
  assert.deepEqual(other(sent()).to, ['candidate@example.com']);

  // 3. General enquiry
  answerWith(accept);
  await notifications.notifyEnquiry({ name: 'Asha', email: 'asha@example.com', type: 'GENERAL', subject: 'A question', message: 'Hello' });
  assert.deepEqual([admin(sent()).to, admin(sent()).reply_to, admin(sent()).subject], [['team@example.com'], 'asha@example.com', 'New enquiry: A question']);

  // 4. Referral: the reply goes to the person who referred.
  answerWith(accept);
  await notifications.notifyReferral({ referrerName: 'Ref Errer', referrerEmail: 'referrer@example.com', candidateName: 'Good Engineer', candidateEmail: 'good.engineer@example.com' });
  assert.deepEqual([admin(sent()).to, admin(sent()).reply_to, admin(sent()).subject], [['team@example.com'], 'referrer@example.com', 'New referral: Good Engineer']);
  assert.deepEqual(other(sent()).to, ['referrer@example.com'], 'the referred person is not emailed');

  // 5. Shortlist: one email, to the candidate, and its result is returned.
  answerWith(accept);
  const result = await notifications.notifyShortlisted({ candidate: { name: 'A Candidate', email: 'candidate@example.com' }, job: { title: 'RTL Design Engineer' } });
  assert.equal(result.sent, true);
  assert.equal(sent().length, 1);
  assert.deepEqual([sent()[0].to, sent()[0].subject], [['candidate@example.com'], 'Your application for RTL Design Engineer has been shortlisted']);
  assert.ok(!('reply_to' in sent()[0]));

  // Every one of them is sent from EMAIL_FROM, to exactly one address.
  assert.ok(sent().every((message) => message.from === 'ALLSEMIS <no-reply@example.com>' && message.to.length === 1));
  notifications.resetConfirmationLimits();
});

// =====================================================================
// Cloudinary
// =====================================================================

const cloudinaryAnswer = { asset_id: 'x', public_id: 'allsemis-test/abc123', version: 1, width: 640, height: 360, format: 'png', resource_type: 'image', bytes: 88, url: 'http://res.cloudinary.com/sample-cloud/image/upload/v1/allsemis-test/abc123.png', secure_url: 'https://res.cloudinary.com/sample-cloud/image/upload/v1/allsemis-test/abc123.png' };

test('cloudinary: the upload is signed on the server and reduced to the stored metadata', async () => {
  answerWith(() => json(200, cloudinaryAnswer));
  const startedAt = Math.floor(Date.now() / 1000);
  const stored = await media.uploadImage({ buffer: pngBytes(), inspection: pngInspection, dimensions: { width: 1, height: 1 }, baseUrl: 'http://localhost:4000' });

  // What is stored in MongoDB: exactly these five values, from the answer.
  assert.deepEqual(stored, { url: cloudinaryAnswer.secure_url, publicId: 'allsemis-test/abc123', width: 640, height: 360, format: 'png' });

  assert.equal(provider.requests.length, 1);
  const [request] = provider.requests;
  assert.equal(request.url, 'https://api.cloudinary.com/v1_1/sample-cloud/image/upload');
  assert.equal(request.method, 'POST');
  assert.ok(request.body instanceof FormData);
  const fields = Object.fromEntries(request.body.entries());
  assert.deepEqual(Object.keys(fields).sort(), ['api_key', 'file', 'folder', 'signature', 'timestamp']);
  assert.equal(fields.api_key, '123456789012345');
  assert.equal(fields.folder, 'allsemis-test');
  assert.match(fields.timestamp, /^\d{10}$/);
  assert.ok(Number(fields.timestamp) >= startedAt && Number(fields.timestamp) <= startedAt + 5, 'the timestamp is the current time in seconds');
  // The signature, worked out again here: the signed parameters sorted
  // by name, joined as a query string, followed by the API secret.
  assert.equal(fields.signature, sha1(`folder=${fields.folder}&timestamp=${fields.timestamp}${SECRETS.cloudinary}`));
  // The secret itself is never a field, a header or part of the address.
  for (const [name, value] of Object.entries(fields)) {
    if (typeof value === 'string') assertNoSecret(value, `the "${name}" field`);
  }
  assertNoSecret(JSON.stringify(request.headers), 'the request headers');
  assertNoSecret(request.url, 'the request address');
  // The image itself, with the type decided from its bytes.
  assert.equal(fields.file.type, 'image/png');
  assert.equal(fields.file.name, 'upload.png');
  assert.ok(Buffer.from(await fields.file.arrayBuffer()).equals(pngBytes()));
  assertNoSecret(stored, 'the stored metadata');
});

test('cloudinary: a refusal, an unreachable service or an unusable answer is a 502 MEDIA_UPLOAD_FAILED', async () => {
  const upload = () => media.uploadImage({ buffer: pngBytes(), inspection: pngInspection, dimensions: null });
  const refused = (error) => error instanceof AppError && error.status === 502 && error.code === 'MEDIA_UPLOAD_FAILED';
  logLines.length = 0;

  answerWith(() => json(401, { error: { message: 'Invalid Signature. String to sign - folder=allsemis-test&timestamp=1' } }));
  await assert.rejects(upload, refused);

  answerWith(() => { throw new TypeError('fetch failed'); });
  await assert.rejects(upload, refused, 'the service could not be reached');

  answerWith(() => json(200, { width: 640, height: 360 }));
  await assert.rejects(upload, refused, 'an answer with no address and no id is not stored');

  const failures = logged('media.cloudinary_failed');
  assert.equal(failures.length, 3);
  assert.equal(failures[0].status, 401);
  assertNoSecret(logLines.join(''), 'the server log');
});

test('cloudinary: only ids inside the configured folder are removed, with a signed destroy request', async () => {
  assert.equal(media.ownsImage('allsemis-test/abc123'), true);
  assert.equal(media.ownsImage('someone-elses/abc123'), false);
  assert.equal(media.ownsImage('allsemis-test/nested/abc123'), false);
  assert.equal(media.ownsImage('allsemis-test/../other'), false);
  assert.equal(media.ownsImage('allsemis-testing/abc123'), false, 'a folder that only starts the same is not ours');
  assert.equal(media.ownsImage(''), false, 'an image entered as a link has no id and is never owned');
  assert.equal(media.ownsImage(undefined), false);
  assert.equal(media.ownsImage('https://images.example.com/photo.jpg'), false);

  answerWith(() => json(200, { result: 'ok' }));
  const startedAt = Math.floor(Date.now() / 1000);
  await media.removeImage('allsemis-test/abc123');
  assert.equal(provider.requests.length, 1);
  const [request] = provider.requests;
  assert.equal(request.url, 'https://api.cloudinary.com/v1_1/sample-cloud/image/destroy');
  assert.equal(request.method, 'POST');
  const fields = Object.fromEntries(request.body.entries());
  assert.deepEqual(Object.keys(fields).sort(), ['api_key', 'public_id', 'signature', 'timestamp']);
  assert.equal(fields.public_id, 'allsemis-test/abc123');
  assert.equal(fields.api_key, '123456789012345');
  assert.ok(Number(fields.timestamp) >= startedAt && Number(fields.timestamp) <= startedAt + 5);
  assert.equal(fields.signature, sha1(`public_id=allsemis-test/abc123&timestamp=${fields.timestamp}${SECRETS.cloudinary}`));
  assertNoSecret(JSON.stringify(fields), 'the destroy request');

  // Anything that is not this application's own upload: no request at all.
  answerWith(() => json(200, { result: 'ok' }));
  for (const publicId of ['someone-elses/abc123', 'allsemis-test/nested/abc123', '', 'https://images.example.com/photo.jpg']) await media.removeImage(publicId);
  assert.equal(provider.requests.length, 0);

  // A failed removal is logged and does not throw: the record that
  // pointed at the image is already saved.
  answerWith(() => json(500, { error: { message: 'Server error' } }));
  await assert.doesNotReject(() => media.removeImage('allsemis-test/abc123'));
});

test('images uploaded before Cloudinary was switched on keep working and are removed locally', async () => {
  // An image the local development driver stored earlier.
  const publicId = `local-${randomUUID()}`;
  const file = path.join(media.LOCAL_MEDIA_ROOT, `${publicId}.png`);
  await fs.mkdir(media.LOCAL_MEDIA_ROOT, { recursive: true });
  await fs.writeFile(file, pngBytes());
  try {
    assert.equal(env.mediaStorageDriver, 'cloudinary');

    // Its /media address is still served.
    const shown = await get(`/media/${publicId}.png`);
    assert.equal(shown.status, 200);
    assert.ok(Buffer.from(await shown.arrayBuffer()).equals(pngBytes()));

    // It is recognised by the shape of its id and removed from the
    // local folder. Cloudinary is not called.
    assert.equal(media.ownsImage(publicId), true);
    answerWith(null);
    await media.removeImage(publicId);
    assert.equal(provider.requests.length, 0);
    await assert.rejects(fs.stat(file), { code: 'ENOENT' });
    assert.equal((await get(`/media/${publicId}.png`)).status, 404);

    // The folder is not a way to read anything else.
    assert.equal((await get('/media/..%2f..%2fpackage.json')).status, 404);
    assert.equal((await get('/media/')).status, 404);
  } finally {
    await fs.rm(file, { force: true });
    // Leave no empty folder behind (rmdir only removes an empty one).
    await fs.rmdir(media.LOCAL_MEDIA_ROOT).catch(() => {});
    await fs.rmdir(path.dirname(media.LOCAL_MEDIA_ROOT)).catch(() => {});
  }
});

// =====================================================================
// Private documents: which store holds a file
// =====================================================================

const fileRecord = (key, extra = {}) => ({ key, originalName: 'resume.pdf', mimeType: 'application/pdf', size: pdfBytes().length, uploadedAt: new Date(), ...extra });
const localKey = () => `resumes/2026/01/${randomUUID()}.pdf`;

test('private files: the store is written on the record when a file is stored', async () => {
  b2Calls.length = 0;
  const record = await files.storePrivateFile({ buffer: pdfBytes(), originalName: 'My Resume.pdf', inspection: pdfInspection, folder: 'resumes' });
  assert.deepEqual(Object.keys(record).sort(), ['key', 'mimeType', 'originalName', 'size', 'storage', 'uploadedAt']);
  assert.equal(record.storage, 'b2', 'the active store, which is B2 once its credentials are set');
  assert.match(record.key, /^resumes\/\d{4}\/\d{2}\/[0-9a-f-]{36}\.pdf$/, 'the key is random and holds nothing of the file name');
  assert.equal(record.originalName, 'My Resume.pdf');
  assert.equal(record.size, pdfBytes().length);
  assert.deepEqual(b2Calls, [{ op: 'put', key: record.key, mimeType: 'application/pdf' }]);
  assert.ok(!(await localDisk.has(record.key)), 'nothing is written to the local disk');

  // Opening and removing it use B2.
  const link = await files.signedUrlFor(record);
  assert.deepEqual(link, { url: `https://b2.invalid/${record.key}?signed=1`, expiresIn: 90 });
  await files.removePrivateFile(record);
  assert.deepEqual(b2Calls.slice(1), [
    { op: 'signedUrl', key: record.key, fileName: 'My Resume.pdf', mimeType: 'application/pdf' },
    { op: 'remove', key: record.key },
  ]);
});

test('private files: a file marked local is served through a signed local link while B2 is the active store', async () => {
  assert.equal(env.fileStorageDriver, 'b2');
  const key = localKey();
  await localDisk.put(key, pdfBytes());
  const record = fileRecord(key, { storage: 'local', originalName: 'Local "Resume".pdf' });

  b2Calls.length = 0;
  const link = await files.signedUrlFor(record);
  assert.deepEqual(b2Calls, [], 'B2 is not asked about a file it does not hold');
  assert.match(link.url, /^\/api\/files\/local\/[\w-]+\.[\w-]+$/);
  assert.equal(link.expiresIn, 90);
  assert.ok(!link.url.includes(key), 'the key is not readable from the link');

  // The link carries the key, the store and an expiry, signed.
  const payload = verifyPayload(link.url.split('/').pop());
  assert.equal(payload.key, key);
  assert.equal(payload.store, 'local');
  assert.ok(payload.exp > Date.now() + 80_000 && payload.exp <= Date.now() + 90_000);

  const download = await get(link.url);
  assert.equal(download.status, 200);
  assert.equal(download.headers.get('content-type'), 'application/pdf');
  assert.equal(download.headers.get('content-disposition'), 'inline; filename="Local _Resume_.pdf"');
  assert.equal(download.headers.get('cache-control'), 'private, no-store');
  assert.equal(download.headers.get('x-content-type-options'), 'nosniff');
  assert.ok(Buffer.from(await download.arrayBuffer()).equals(pdfBytes()));

  // The link is still the only way in: an altered one, or the bare key, fails.
  assert.equal((await get(`${link.url.slice(0, -4)}AAAA`)).status, 404);
  assert.equal((await get(`/api/files/local/${encodeURIComponent(key)}`)).status, 404);
  assert.equal((await get(`/${key}`)).status, 404);

  // Removing it removes the local file, not an B2 object.
  await files.removePrivateFile(record);
  assert.deepEqual(b2Calls, []);
  assert.equal(await localDisk.has(key), false);
  assert.equal((await get(link.url)).status, 404, 'a link to a removed document stops working');
});

test('private files: a record from before the marker is found on the local disk, or else in the active store', async () => {
  // Stored on the local disk by an earlier version: no marker.
  const onDisk = fileRecord(localKey());
  await localDisk.put(onDisk.key, pdfBytes());
  assert.equal(await files.storageHolding(onDisk), 'local');
  b2Calls.length = 0;
  const link = await files.signedUrlFor(onDisk);
  assert.match(link.url, /^\/api\/files\/local\//);
  const download = await get(link.url);
  assert.equal(download.status, 200);
  assert.ok(Buffer.from(await download.arrayBuffer()).equals(pdfBytes()));
  await files.removePrivateFile(onDisk);
  assert.equal(await localDisk.has(onDisk.key), false);
  assert.deepEqual(b2Calls, []);

  // Not on the local disk: the active store.
  const elsewhere = fileRecord(localKey());
  assert.equal(await files.storageHolding(elsewhere), 'b2');
  assert.deepEqual(await files.signedUrlFor(elsewhere), { url: `https://b2.invalid/${elsewhere.key}?signed=1`, expiresIn: 90 });
  await files.removePrivateFile(elsewhere);
  assert.deepEqual(b2Calls.map((call) => call.op), ['signedUrl', 'remove']);

  // A marker always wins over what happens to be on the disk.
  const marked = fileRecord(localKey(), { storage: 'b2' });
  await localDisk.put(marked.key, pdfBytes());
  assert.equal(await files.storageHolding(marked), 'b2');
  await localDisk.remove(marked.key);

  // A key that tries to leave the storage folder is simply not found there.
  assert.equal(await localDisk.has('../../etc/passwd'), false);
  assert.equal(await localDisk.read('../../etc/passwd'), null);
  assert.equal(await files.storageHolding(fileRecord('../../etc/passwd')), 'b2');

  // Nothing to remove, nothing done.
  b2Calls.length = 0;
  await files.removePrivateFile(null);
  await files.removePrivateFile({});
  assert.deepEqual(b2Calls, []);
});

test('private files: a record of the earlier provider is not looked for in B2', async () => {
  const old = fileRecord('resumes/2026/01/old.pdf', { storage: 'r2' });
  for (const options of [{}, { active: 'b2', isProduction: true }, { active: 'local', isProduction: false }]) {
    assert.equal(await files.storageHolding(old, options), null);
  }
  b2Calls.length = 0;
  await assert.rejects(() => files.signedUrlFor(old), (error) => error.status === 404);
  await files.removePrivateFile(old);
  assert.deepEqual(b2Calls, [], 'B2 is never asked about a file it does not hold');
});

test('private files: production never falls back to the local disk', async () => {
  // The decision itself, with production settings.
  let probed = 0;
  const production = { active: 'b2', isProduction: true, existsLocally: async () => { probed += 1; return true; } };
  assert.equal(await files.storageHolding(fileRecord('resumes/2026/01/a.pdf'), production), 'b2', 'no marker: the active store');
  assert.equal(await files.storageHolding(fileRecord('resumes/2026/01/a.pdf', { storage: 'b2' }), production), 'b2');
  assert.equal(probed, 0, 'the local disk is not even looked at');
  assert.equal(await files.storageHolding(fileRecord('resumes/2026/01/a.pdf', { storage: 'local' }), production), null, 'a file stored on a development machine is not available');
  assert.equal(await files.storageHolding(fileRecord('resumes/2026/01/a.pdf', { storage: 'memory' }), production), null);

  // Outside production the same record is looked for on the disk.
  const development = { ...production, isProduction: false };
  assert.equal(await files.storageHolding(fileRecord('resumes/2026/01/a.pdf'), development), 'local');
  assert.equal(probed, 1);
  assert.equal(await files.storageHolding(fileRecord('resumes/2026/01/a.pdf'), { ...development, active: 'local' }), 'local');
  assert.equal(await files.storageHolding(fileRecord('resumes/2026/01/a.pdf', { storage: 'local' }), development), 'local');

  // The server itself: a document and an image are put where the
  // development drivers keep them, and a validly signed link and the
  // image address are requested. A development server serves both. A
  // production server answers 404 to both.
  const script = `
    import { promises as fs } from 'node:fs';
    import path from 'node:path';
    const { createLocalFileDriver } = await import('./src/services/storage/drivers/local.js');
    const { LOCAL_MEDIA_ROOT } = await import('./src/services/storage/publicMedia.js');
    const { createApp } = await import('./src/app.js');
    const disk = createLocalFileDriver();
    const key = 'providers-test/' + process.env.SAMPLE_ID + '.pdf';
    const image = path.join(LOCAL_MEDIA_ROOT, 'local-' + process.env.SAMPLE_ID + '.png');
    const out = {};
    let server;
    try {
      await disk.put(key, Buffer.from('%PDF-1.4 sample'));
      await fs.mkdir(LOCAL_MEDIA_ROOT, { recursive: true });
      await fs.writeFile(image, Buffer.from('sample'));
      const link = await disk.signedUrl(key, { fileName: 'resume.pdf', mimeType: 'application/pdf' });
      server = createApp().listen(0);
      await new Promise((resolve) => server.once('listening', resolve));
      const base = 'http://127.0.0.1:' + server.address().port;
      out.document = (await fetch(base + link.url)).status;
      out.image = (await fetch(base + '/media/' + path.basename(image))).status;
    } finally {
      if (server) await new Promise((resolve) => server.close(resolve));
      await disk.remove(key).catch(() => {});
      await fs.rm(image, { force: true });
      // Leave no empty folder behind (rmdir only removes an empty one).
      for (const folder of ['../private/providers-test', '../private', '.', '..']) await fs.rmdir(path.resolve(LOCAL_MEDIA_ROOT, folder)).catch(() => {});
    }
    console.log('RESULT ' + JSON.stringify(out));
  `;
  const run = (nodeEnv) => {
    const result = spawnSync(process.execPath, ['--input-type=module', '-e', script], {
      cwd: new URL('..', import.meta.url),
      env: { ...process.env, NODE_ENV: nodeEnv, LOG_LEVEL: 'silent', FRONTEND_URL: 'https://www.example.com', SAMPLE_ID: randomUUID() },
      encoding: 'utf8',
    });
    const line = result.stdout.split('\n').find((text) => text.startsWith('RESULT '));
    assert.ok(line, `the ${nodeEnv} server ran: ${result.stderr}`);
    return JSON.parse(line.slice('RESULT '.length));
  };
  assert.deepEqual(run('development'), { document: 200, image: 200 });
  assert.deepEqual(run('production'), { document: 404, image: 404 });
});

// =====================================================================
// The B2 driver
// =====================================================================

/*
  The AWS SDK is not loaded here. The driver is given a stand-in with
  the same five names, which records how the client is built and what
  each command and the presigner are given. This checks what THIS code
  asks for. It does not check the SDK, the signature or B2 itself.
*/
function fakeAwsSdk({ versions = null, listFails = false } = {}) {
  const seen = { clients: [], sent: [], presigned: [] };
  class Command { constructor(input) { this.input = input; } }
  class PutObjectCommand extends Command {}
  class GetObjectCommand extends Command {}
  class DeleteObjectCommand extends Command {}
  class ListObjectVersionsCommand extends Command {}
  class S3Client {
    constructor(config) { this.config = config; seen.clients.push(this); }
    async send(command) {
      seen.sent.push(command);
      if (command instanceof ListObjectVersionsCommand) {
        if (listFails) throw Object.assign(new Error('AccessDenied'), { name: 'AccessDenied' });
        return versions || {};
      }
      return {};
    }
  }
  const getSignedUrl = async (client, command, options) => {
    seen.presigned.push({ client, command, options });
    return `${client.config.endpoint}/${command.input.Bucket}/${command.input.Key}?X-Amz-Expires=${options.expiresIn}&X-Amz-Signature=sample`;
  };
  return { seen, sdk: { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, ListObjectVersionsCommand, getSignedUrl } };
}

test('b2 driver: the endpoint, the region, the bucket, and what each operation asks of the SDK', async () => {
  const { seen, sdk } = fakeAwsSdk();
  const driver = await createB2Driver(sdk);

  // One client, on the endpoint and region from the environment, with
  // the credentials. Nothing about the provider is written in code.
  assert.equal(seen.clients.length, 1);
  const [client] = seen.clients;
  assert.equal(client.config.endpoint, 'https://s3.us-west-004.backblazeb2.com');
  assert.equal(client.config.region, 'us-west-004');
  assert.equal(client.config.forcePathStyle, true);
  assert.deepEqual(client.config.credentials, { accessKeyId: 'sample-access-key-id', secretAccessKey: SECRETS.b2 });
  assert.equal(client.config.requestChecksumCalculation, 'WHEN_REQUIRED');
  assert.equal(client.config.responseChecksumValidation, 'WHEN_REQUIRED');

  // put: the bytes, under the key, with the type decided from the bytes.
  const key = 'resumes/2026/01/0b0f5c1e-1111-4222-8333-444455556666.pdf';
  await driver.put(key, pdfBytes(), 'application/pdf');
  assert.equal(seen.sent.length, 1);
  assert.ok(seen.sent[0] instanceof sdk.PutObjectCommand);
  assert.deepEqual(Object.keys(seen.sent[0].input).sort(), ['Body', 'Bucket', 'ContentType', 'Key'], 'no ACL or other option that could make the object public');
  assert.equal(seen.sent[0].input.Bucket, 'sample-private-bucket');
  assert.equal(seen.sent[0].input.Key, key);
  assert.equal(seen.sent[0].input.ContentType, 'application/pdf');
  assert.ok(seen.sent[0].input.Body.equals(pdfBytes()));

  // signedUrl: a presigned GET that expires after SIGNED_URL_TTL_SECONDS.
  const pdf = await driver.signedUrl(key, { fileName: 'My Resume (final).pdf', mimeType: 'application/pdf' });
  assert.equal(seen.presigned.length, 1);
  assert.equal(seen.presigned[0].client, client);
  assert.ok(seen.presigned[0].command instanceof sdk.GetObjectCommand);
  assert.deepEqual(seen.presigned[0].command.input, {
    Bucket: 'sample-private-bucket',
    Key: key,
    ResponseContentType: 'application/pdf',
    ResponseContentDisposition: 'inline; filename="My Resume (final).pdf"',
  });
  assert.deepEqual(seen.presigned[0].options, { expiresIn: 90 });
  assert.equal(pdf.expiresIn, 90);
  assert.match(pdf.url, /^https:\/\/s3\.us-west-004\.backblazeb2\.com\/sample-private-bucket\//);
  assert.equal(seen.sent.length, 1, 'presigning sends nothing');

  // Word files download, and a file name cannot break out of the header.
  const docx = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  await driver.signedUrl(key, { fileName: 'cv"\r\nX-Injected: 1.docx', mimeType: docx });
  assert.equal(seen.presigned[1].command.input.ResponseContentDisposition, 'attachment; filename="cv___X-Injected_ 1.docx"');
  assert.equal(seen.presigned[1].command.input.ResponseContentType, docx);
  await driver.signedUrl(key, { fileName: '', mimeType: 'application/pdf' });
  assert.equal(seen.presigned[2].command.input.ResponseContentDisposition, 'inline; filename="document"');

  // remove, when the bucket lists no version of the key (already gone):
  // the versions are asked for and nothing is sent after that. A plain
  // delete would add a hide marker for a file that is not there.
  await driver.remove(key);
  assert.ok(seen.sent[1] instanceof sdk.ListObjectVersionsCommand);
  assert.deepEqual(seen.sent[1].input, { Bucket: 'sample-private-bucket', Prefix: key });
  assert.equal(seen.sent.length, 2);

  // The driver has no way to read an object back through the API
  // server: B2 documents are only ever reached by a presigned link.
  assert.deepEqual(Object.keys(driver).sort(), ['list', 'put', 'remove', 'signedUrl']);
});

test('b2 driver: listing names every key the bucket holds, hidden versions included, page by page', async () => {
  const pages = [
    { Versions: [{ Key: 'resumes/a.pdf', VersionId: '1' }, { Key: 'resumes/a.pdf', VersionId: '2' }], DeleteMarkers: [{ Key: 'resumes/hidden.pdf', VersionId: '3' }], IsTruncated: true, NextKeyMarker: 'resumes/hidden.pdf', NextVersionIdMarker: '3' },
    { Versions: [{ Key: 'attachments/b.docx', VersionId: '4' }], IsTruncated: false },
  ];
  const { seen, sdk } = fakeAwsSdk();
  let call = 0;
  const base = sdk.S3Client.prototype.send;
  sdk.S3Client.prototype.send = async function send(command) {
    await base.call(this, command);
    return command instanceof sdk.ListObjectVersionsCommand ? pages[call++] : {};
  };
  const driver = await createB2Driver(sdk);
  assert.deepEqual(await driver.list(), ['attachments/b.docx', 'resumes/a.pdf', 'resumes/hidden.pdf']);
  assert.deepEqual(seen.sent.map((command) => command.input), [
    { Bucket: 'sample-private-bucket' },
    { Bucket: 'sample-private-bucket', KeyMarker: 'resumes/hidden.pdf', VersionIdMarker: '3' },
  ]);
});

test('b2 driver: removing a file deletes every stored version, not only hides it', async () => {
  const key = 'resumes/2026/01/0b0f5c1e-1111-4222-8333-444455556666.pdf';
  // The bucket holds the file, an earlier hide marker for it, and
  // another file whose key merely starts with the same text.
  const { seen, sdk } = fakeAwsSdk({ versions: {
    Versions: [{ Key: key, VersionId: 'v-file' }, { Key: `${key}.bak`, VersionId: 'v-other' }],
    DeleteMarkers: [{ Key: key, VersionId: 'v-marker' }],
  } });
  const driver = await createB2Driver(sdk);
  await driver.remove(key);
  const deletes = seen.sent.filter((command) => command instanceof sdk.DeleteObjectCommand).map((command) => command.input);
  assert.deepEqual(deletes, [
    { Bucket: 'sample-private-bucket', Key: key, VersionId: 'v-file' },
    { Bucket: 'sample-private-bucket', Key: key, VersionId: 'v-marker' },
  ], 'each version of this key by its id; the other file is left alone');

  // The application key may not list versions: the file is still
  // hidden, nothing is thrown, and the log says the bytes remain.
  const before = logLines.length;
  const denied = fakeAwsSdk({ listFails: true });
  const limited = await createB2Driver(denied.sdk);
  await limited.remove(key);
  const sent = denied.seen.sent.filter((command) => command instanceof denied.sdk.DeleteObjectCommand).map((command) => command.input);
  assert.deepEqual(sent, [{ Bucket: 'sample-private-bucket', Key: key }]);
  assert.ok(logLines.slice(before).join('').includes('storage.b2_hidden_not_deleted'));
});

test('no secret reached the server log during these tests', () => {
  assert.ok(logLines.length > 0, 'the log was captured');
  assertNoSecret(logLines.join(''), 'the server log');
});
