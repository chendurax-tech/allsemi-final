/*
  Test harness. Starts the real Express app on a free port against an
  in-memory MongoDB (mongodb-memory-server), with the in-memory
  storage and email drivers, so the suite needs no network and no
  external account.

  Environment variables are set BEFORE the application modules are
  imported, because config/env.js reads them once at import time.
*/
process.env.NODE_ENV = 'test';
process.env.SESSION_SECRET = 'test-only-session-secret-0123456789-abcdefghij';
process.env.FRONTEND_URL = 'http://localhost:5173';
process.env.ADMIN_NOTIFICATION_EMAIL = 'team@example.com';
process.env.EMAIL_FROM = 'ALLSEMIS <no-reply@example.com>';
process.env.SIGNED_URL_TTL_SECONDS = '60';
process.env.LOG_LEVEL = 'silent';
// The AI comparison is configured, so its tests can run. Nothing ever
// reaches OpenAI: the tests that use it replace fetch for that address
// (see openAiStub in admin.test.js), and the suite has no network.
process.env.OPENAI_API_KEY = 'sk-test-0000-not-a-real-credential-0000';
process.env.OPENAI_MODEL = 'test-comparison-model';

export const ORIGIN = 'http://localhost:5173';
export const PASSWORD = 'correct-horse-battery-9';

let mongo;
let server;
let baseUrl;
let modules;

export async function startServer() {
  const { MongoMemoryServer } = await import('mongodb-memory-server');
  mongo = await MongoMemoryServer.create();
  const db = await import('../src/config/db.js');
  await db.connectDatabase(mongo.getUri());
  const { createApp } = await import('../src/app.js');
  const models = await import('../src/models/index.js');
  const { hashPassword } = await import('../src/utils/password.js');
  const email = await import('../src/services/email/emailService.js');
  server = createApp().listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
  modules = { db, models, hashPassword, email };
  return { baseUrl, models, outbox: email.outbox };
}

export async function stopServer() {
  if (server) await new Promise((resolve) => server.close(resolve));
  if (modules) await modules.db.disconnectDatabase();
  if (mongo) await mongo.stop();
}

export async function createUser(role, email = `${role.toLowerCase()}@example.com`) {
  const { User } = modules.models;
  const existing = await User.findOne({ email });
  if (existing) return existing;
  return User.create({ name: `Test ${role}`, email, role, passwordHash: await modules.hashPassword(PASSWORD) });
}

/*
  A small HTTP client with its own cookie jar, so each test can act as
  a different signed-in user. By default it sends what the real
  frontend sends (the allowed Origin and the X-Requested-With header);
  both can be overridden to test the protections themselves.
*/
export function client() {
  let cookie = '';
  async function request(method, path, { json, form, headers = {}, origin = ORIGIN, xhr = true } = {}) {
    const finalHeaders = { ...headers };
    if (origin) finalHeaders.Origin = origin;
    if (xhr) finalHeaders['X-Requested-With'] = 'XMLHttpRequest';
    if (cookie) finalHeaders.Cookie = cookie;
    let body;
    if (json !== undefined) {
      finalHeaders['Content-Type'] = 'application/json';
      body = JSON.stringify(json);
    } else if (form) {
      body = form;
    }
    const response = await fetch(`${baseUrl}${path}`, { method, headers: finalHeaders, body, redirect: 'manual' });
    const setCookie = response.headers.getSetCookie ? response.headers.getSetCookie() : [];
    for (const line of setCookie) {
      const [pair] = line.split(';');
      const [name, value] = pair.split('=');
      cookie = value ? `${name}=${value}` : '';
    }
    const contentType = response.headers.get('content-type') || '';
    const payload = contentType.includes('application/json') ? await response.json() : Buffer.from(await response.arrayBuffer());
    return { status: response.status, body: payload, headers: response.headers, setCookie };
  }
  return {
    get: (path, options) => request('GET', path, options),
    post: (path, options) => request('POST', path, options),
    patch: (path, options) => request('PATCH', path, options),
    put: (path, options) => request('PUT', path, options),
    delete: (path, options) => request('DELETE', path, options),
    async login(email, password = PASSWORD) {
      return request('POST', '/api/auth/login', { json: { email, password } });
    },
    get cookie() { return cookie; },
  };
}

export async function signedIn(role) {
  const user = await createUser(role);
  const agent = client();
  const response = await agent.login(user.email);
  if (response.status !== 200) throw new Error(`Could not sign in as ${role}: ${response.status}`);
  return agent;
}

// ---- sample files ----
export const pdfBytes = () => Buffer.concat([Buffer.from('%PDF-1.4\n%sample\n'), Buffer.alloc(400, 0x20), Buffer.from('\n%%EOF\n')]);
export const pngBytes = () => {
  const header = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]);
  const size = Buffer.alloc(8);
  size.writeUInt32BE(640, 0);
  size.writeUInt32BE(360, 4);
  return Buffer.concat([header, size, Buffer.alloc(64, 1)]);
};
export const exeBytes = () => Buffer.concat([Buffer.from('MZ'), Buffer.alloc(300, 0x90)]);

// A structurally valid zip (stored entries, with a central directory)
// holding the named entries. A .docx is such a zip with the Word parts.
export function zipBytes(names) {
  const locals = [];
  const central = [];
  let offset = 0;
  for (const name of names) {
    const nameBytes = Buffer.from(name);
    const data = Buffer.from('x');
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBytes.length, 26);
    const entry = Buffer.alloc(46);
    entry.writeUInt32LE(0x02014b50, 0);
    entry.writeUInt16LE(20, 4);
    entry.writeUInt16LE(20, 6);
    entry.writeUInt32LE(data.length, 20);
    entry.writeUInt32LE(data.length, 24);
    entry.writeUInt16LE(nameBytes.length, 28);
    entry.writeUInt32LE(offset, 42);
    locals.push(local, nameBytes, data);
    central.push(entry, nameBytes);
    offset += local.length + nameBytes.length + data.length;
  }
  const directory = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(names.length, 8);
  end.writeUInt16LE(names.length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, directory, end]);
}
export const docxBytes = () => zipBytes(['[Content_Types].xml', '_rels/.rels', 'word/document.xml']);

// A legacy Word file reduced to what identifies one: the compound file
// header and a directory whose entries include a "WordDocument" stream.
export function docBytes() {
  const file = Buffer.alloc(512 * 3);
  Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]).copy(file, 0);
  const entry = (at, name, type) => {
    const text = Buffer.from(name, 'utf16le');
    text.copy(file, at);
    file.writeUInt16LE(text.length + 2, at + 64);
    file[at + 66] = type;
  };
  entry(512, 'Root Entry', 5);
  entry(512 + 128, 'WordDocument', 2);
  return file;
}

export function multipart(fields, file) {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) form.append(key, String(value));
  if (file) form.append(file.field, new Blob([file.buffer], { type: file.type || 'application/octet-stream' }), file.name);
  return form;
}

export const applicationFields = (overrides = {}) => ({
  name: 'Test Candidate',
  email: 'candidate.one@example.com',
  phone: '+91 90000 40001',
  location: 'Bengaluru, India',
  headline: 'Design Verification Engineer',
  domain: 'Semiconductor & Chip Engineering',
  experienceYears: '6',
  skills: 'SystemVerilog, UVM, Functional Coverage',
  noticePeriod: '30 days',
  consent: 'true',
  ...overrides,
});

export const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
