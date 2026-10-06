import 'dotenv/config';

/*
  Environment configuration - the only place process.env is read.

  Everything else imports `env` from here, so a missing or malformed
  value is caught once, at start-up, with a message that names it.
  Secrets are never logged: describeConfig() reports which integrations
  are configured, not their values.
*/

// NODE_ENV decides which safeguards apply, so a misspelt value (for
// example "prod") must stop the process instead of quietly running
// with the development ones.
const NODE_ENV = String(process.env.NODE_ENV || 'development').trim().toLowerCase();
if (!['development', 'test', 'production'].includes(NODE_ENV)) {
  throw new Error(`Environment variable NODE_ENV must be one of: development, test, production. Received "${NODE_ENV}".`);
}
const isProduction = NODE_ENV === 'production';
const isTest = NODE_ENV === 'test';

function str(name, fallback = '') {
  const value = process.env[name];
  return value === undefined || value === null ? fallback : String(value).trim();
}

function int(name, fallback) {
  const raw = str(name);
  if (!raw) return fallback;
  const value = Number.parseInt(raw, 10);
  if (Number.isNaN(value)) throw new Error(`Environment variable ${name} must be a whole number.`);
  return value;
}

function oneOf(name, allowed, fallback) {
  const value = str(name, fallback).toLowerCase();
  if (!allowed.includes(value)) {
    throw new Error(`Environment variable ${name} must be one of: ${allowed.join(', ')}. Received "${value}".`);
  }
  return value;
}

function list(name, fallback = '') {
  return str(name, fallback).split(',').map((item) => item.trim().replace(/\/+$/, '')).filter(Boolean);
}

// A driver variable is optional. Empty or absent means "decide from the
// credentials"; anything else must be one of the allowed names.
function optionalOneOf(name, allowed) {
  return str(name) ? oneOf(name, allowed, '') : '';
}

const cloudinary = {
  cloudName: str('CLOUDINARY_CLOUD_NAME'),
  apiKey: str('CLOUDINARY_API_KEY'),
  apiSecret: str('CLOUDINARY_API_SECRET'),
  folder: str('CLOUDINARY_FOLDER', 'allsemis'),
};

// Backblaze B2, used through its S3-compatible API. B2_ENDPOINT is the
// S3 endpoint of the bucket's region, in the form
// https://s3.<region>.backblazeb2.com. The region comes from B2_REGION
// and, when that is left empty, from the endpoint itself. Neither is
// written in code.
const B2_ENDPOINT_FORM = /^https:\/\/s3\.([a-z0-9-]+)\.backblazeb2\.com$/i;
const b2Endpoint = str('B2_ENDPOINT').replace(/\/+$/, '');
const b2 = {
  endpoint: b2Endpoint,
  region: (str('B2_REGION') || B2_ENDPOINT_FORM.exec(b2Endpoint)?.[1] || '').toLowerCase(),
  bucket: str('B2_BUCKET_NAME'),
  accessKeyId: str('B2_ACCESS_KEY_ID'),
  secretAccessKey: str('B2_SECRET_ACCESS_KEY'),
};

const resendApiKey = str('RESEND_API_KEY');
const emailFrom = str('EMAIL_FROM');

const openai = {
  apiKey: str('OPENAI_API_KEY'),
  model: str('OPENAI_MODEL'),
};

// "Configured" means every value the provider needs is present.
const configured = {
  cloudinary: Boolean(cloudinary.cloudName && cloudinary.apiKey && cloudinary.apiSecret),
  b2: Boolean(b2.endpoint && b2.region && b2.bucket && b2.accessKeyId && b2.secretAccessKey),
  resend: Boolean(resendApiKey && emailFrom),
  // The AI comparison needs the key and the model name. No model is
  // assumed by the code.
  openai: Boolean(openai.apiKey && openai.model),
};

/*
  resolveDriver - which driver one service uses.

  The rule is "the credentials decide": the real provider when its
  credentials are complete, otherwise the development fallback.

    nodeEnv      development | test | production
    requested    the value of the optional *_DRIVER variable, or ''
    provider     the real provider: b2, cloudinary or resend
    fallback     the development fallback: local or log
    configured   true when the provider's credentials are complete

  In order:
  1. Tests always use the in-memory driver, whatever .env says.
  2. A requested "memory" is honoured (it is refused in production by
     validateEnv below).
  3. Complete credentials select the provider. A requested fallback
     value (local, log) does not block this: .env files copied from the
     earlier template contain those lines, and filling in the
     credentials must be enough to switch the provider on.
  4. A requested provider name forces the provider even when its
     credentials are incomplete. The feature then answers "not
     configured" instead of quietly using the fallback.
  5. In production nothing falls back by itself: with no request and
     incomplete credentials the provider is still selected (and
     reported as not configured). Only an explicit local or log value
     selects the fallback there, and validateEnv refuses local storage.
  6. Otherwise: the development fallback.

  There is no switch that keeps the fallback while the credentials are
  complete. To use the fallback for a while, leave one of the
  provider's credentials empty (or comment the line out).
*/
export function resolveDriver({ nodeEnv, requested = '', provider, fallback, configured: complete }) {
  if (nodeEnv === 'test') return 'memory';
  if (requested === 'memory') return 'memory';
  if (complete || requested === provider) return provider;
  if (nodeEnv === 'production' && !requested) return provider;
  return fallback;
}

// The three services, each with its optional driver variable.
const SERVICES = {
  fileStorage: { variable: 'FILE_STORAGE_DRIVER', provider: 'b2', fallback: 'local', configured: configured.b2, credentials: 'the B2_* variables', effect: 'private documents are stored in Backblaze B2' },
  mediaStorage: { variable: 'MEDIA_STORAGE_DRIVER', provider: 'cloudinary', fallback: 'local', configured: configured.cloudinary, credentials: 'the CLOUDINARY_* variables', effect: 'images are stored in Cloudinary' },
  email: { variable: 'EMAIL_DRIVER', provider: 'resend', fallback: 'log', configured: configured.resend, credentials: 'RESEND_API_KEY and EMAIL_FROM', effect: 'email is sent through Resend' },
};
for (const service of Object.values(SERVICES)) {
  // In tests the variable is not even read: the in-memory drivers are
  // used whatever .env says.
  // FILE_STORAGE_DRIVER=r2 is a value of the earlier provider. It is
  // treated as not set, so an .env file that still carries it does not
  // stop the server; validateEnv says that the line can be removed.
  service.retired = !isTest && service.variable === 'FILE_STORAGE_DRIVER' && str(service.variable).toLowerCase() === 'r2';
  service.requested = isTest || service.retired ? '' : optionalOneOf(service.variable, [service.provider, service.fallback, 'memory']);
  service.driver = resolveDriver({ nodeEnv: NODE_ENV, ...service });
}

export const env = {
  NODE_ENV,
  isProduction,
  isTest,
  port: int('PORT', 4000),
  trustProxy: int('TRUST_PROXY', 0),
  logLevel: oneOf('LOG_LEVEL', ['debug', 'info', 'warn', 'error', 'silent'], isTest ? 'silent' : 'info'),

  mongodbUri: str('MONGODB_URI'),
  frontendUrls: list('FRONTEND_URL', isProduction ? '' : 'http://localhost:5173'),

  sessionSecret: str('SESSION_SECRET'),
  sessionTtlHours: int('SESSION_TTL_HOURS', 12),
  cookieSameSite: oneOf('COOKIE_SAMESITE', ['lax', 'strict', 'none'], 'lax'),
  cookieDomain: str('COOKIE_DOMAIN'),

  // The driver in use for each service (see resolveDriver above):
  //   fileStorageDriver   b2 | local | memory
  //   mediaStorageDriver  cloudinary | local | memory
  //   emailDriver         resend | log | memory
  fileStorageDriver: SERVICES.fileStorage.driver,
  mediaStorageDriver: SERVICES.mediaStorage.driver,
  emailDriver: SERVICES.email.driver,

  cloudinary,
  b2,
  signedUrlTtlSeconds: int('SIGNED_URL_TTL_SECONDS', 120),

  resendApiKey,
  emailFrom,
  adminNotificationEmail: str('ADMIN_NOTIFICATION_EMAIL'),

  openai,

  seed: {
    adminEmail: str('SEED_ADMIN_EMAIL'),
    adminPassword: str('SEED_ADMIN_PASSWORD'),
  },
};

export const integrations = {
  cloudinary: () => configured.cloudinary,
  b2: () => configured.b2,
  resend: () => configured.resend,
  openai: () => configured.openai,
};

/*
  validateEnv - called by server.js before anything listens.
  Hard failures stop the process. In production there is no fallback
  to local storage: a host's disk loses files on every deploy and is
  not private storage.
*/
export function validateEnv() {
  const problems = [];
  const warnings = [];

  if (!env.mongodbUri) problems.push('MONGODB_URI is required.');
  if (!env.sessionSecret) problems.push('SESSION_SECRET is required.');
  else if (env.sessionSecret.length < 32) problems.push('SESSION_SECRET must be at least 32 characters.');
  if (env.frontendUrls.length === 0) problems.push('FRONTEND_URL is required (the site origin allowed to call this API).');
  for (const origin of env.frontendUrls) {
    if (!/^https?:\/\/[^/]+$/.test(origin)) problems.push(`FRONTEND_URL entry "${origin}" must be an origin such as https://www.example.com.`);
  }
  if (env.trustProxy < 0 || env.trustProxy > 5) problems.push('TRUST_PROXY must be the number of proxies in front of this API (0 to 5).');
  if (env.cookieSameSite === 'none' && !env.isProduction) {
    warnings.push('COOKIE_SAMESITE=none needs HTTPS; browsers will drop the session cookie on plain http.');
  }

  if (env.isProduction) {
    if (env.fileStorageDriver !== 'b2') problems.push('Private documents must be stored in Backblaze B2 in production. Set the B2_* variables and remove FILE_STORAGE_DRIVER (or set it to "b2").');
    if (env.mediaStorageDriver !== 'cloudinary') problems.push('Public images must be stored in Cloudinary in production. Set the CLOUDINARY_* variables and remove MEDIA_STORAGE_DRIVER (or set it to "cloudinary").');
    if (env.emailDriver === 'memory') problems.push('EMAIL_DRIVER=memory is for tests only.');
    if (env.emailDriver === 'log') warnings.push('EMAIL_DRIVER=log in production: no email is sent. Set RESEND_API_KEY and EMAIL_FROM (a sender on a domain verified in Resend) and remove EMAIL_DRIVER.');
    if (env.frontendUrls.some((origin) => origin.startsWith('http://'))) problems.push('FRONTEND_URL must use https in production.');
    if (env.trustProxy === 0) warnings.push('TRUST_PROXY=0 in production: behind a hosting proxy every visitor appears to come from the proxy address, so rate limits are shared by everyone. Set it to the exact number of proxies in front of this API: 1 when browsers call the Render address directly, 2 when the frontend host forwards /api to it. Do not set it higher than the real count: a larger number lets a visitor forge the address.');
  }

  if (env.signedUrlTtlSeconds < 1) problems.push('SIGNED_URL_TTL_SECONDS must be at least 1 (the lifetime of a signed download link, in seconds).');
  else if (env.signedUrlTtlSeconds > 3600) warnings.push('SIGNED_URL_TTL_SECONDS is over one hour. A signed download link is the only credential a private document needs while it lasts: keep it short.');

  // Selected drivers need their credentials. These are warnings, not
  // failures, so the API can start and serve everything else; the
  // affected feature answers with a clear "not configured" error.
  if (env.fileStorageDriver === 'b2' && !integrations.b2()) warnings.push('Backblaze B2 is selected for private documents but the B2_* variables are incomplete (B2_ENDPOINT, B2_BUCKET_NAME, B2_ACCESS_KEY_ID and B2_SECRET_ACCESS_KEY are all needed, and B2_REGION when the endpoint does not name the region). Resume uploads will be refused.');

  // The endpoint is an address this server sends private documents to,
  // so a malformed one is a problem, not a warning.
  if (env.b2.endpoint) {
    const named = B2_ENDPOINT_FORM.exec(env.b2.endpoint)?.[1]?.toLowerCase();
    if (!/^https:\/\/[^/\s?#]+$/.test(env.b2.endpoint)) problems.push('B2_ENDPOINT must be the S3 endpoint of the bucket\'s region, in the form https://s3.<region>.backblazeb2.com, with no path.');
    else if (!named) warnings.push('B2_ENDPOINT is not in the form https://s3.<region>.backblazeb2.com. Check that it is the S3 endpoint shown for the bucket in Backblaze.');
    else if (str('B2_REGION') && str('B2_REGION').toLowerCase() !== named) problems.push(`B2_REGION ("${str('B2_REGION')}") does not match the region in B2_ENDPOINT ("${named}"). Signed links would be refused.`);
  }
  if (SERVICES.fileStorage.retired) warnings.push('FILE_STORAGE_DRIVER=r2 is ignored: private documents are stored in Backblaze B2 now. Remove the line (or set it to "b2").');
  if (['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET_NAME', 'R2_PUBLIC_URL'].some((name) => str(name))) warnings.push('The R2_* variables are no longer read. Private documents are stored in Backblaze B2 (the B2_* variables). Remove the R2_* lines.');
  if (env.mediaStorageDriver === 'cloudinary' && !integrations.cloudinary()) warnings.push('Cloudinary is selected for images but the CLOUDINARY_* variables are incomplete (CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET are all needed). Image uploads will be refused.');
  if (env.emailDriver === 'resend' && !integrations.resend()) warnings.push('Resend is selected for email but RESEND_API_KEY or EMAIL_FROM is missing. Emails will not be sent.');
  if (env.emailDriver !== 'memory' && !env.adminNotificationEmail) warnings.push('ADMIN_NOTIFICATION_EMAIL is not set. Admin notifications will not be sent.');

  // A driver variable that still names the development fallback while
  // the credentials are complete: the provider is used, and this says
  // so, because the file and the behaviour no longer read the same.
  for (const service of Object.values(SERVICES)) {
    if (service.requested === service.fallback && service.driver === service.provider) {
      warnings.push(`${service.variable}=${service.fallback} is ignored because ${service.credentials} are set: ${service.effect}. Remove the line. To use the "${service.fallback}" fallback instead, leave one of those variables empty.`);
    }
  }

  // The AI comparison needs both values. One without the other is
  // almost certainly an unfinished .env.
  if (Boolean(env.openai.apiKey) !== Boolean(env.openai.model)) {
    warnings.push(`${env.openai.apiKey ? 'OPENAI_API_KEY is set but OPENAI_MODEL is not' : 'OPENAI_MODEL is set but OPENAI_API_KEY is not'}. The AI comparison needs both and stays unavailable until both are set.`);
  }

  return { problems, warnings };
}

/*
  describeConfig - logged once at start-up (server.listening) and shown
  to administrators in Settings. No secret is included: the driver in
  use for each service, and true or false for each set of credentials.

  Reading it: fileStorage "b2", mediaStorage "cloudinary" and email
  "resend" mean the real providers are in use. "local" and "log" are
  the development fallbacks.
*/
export function describeConfig() {
  return {
    nodeEnv: env.NODE_ENV,
    port: env.port,
    frontendUrls: env.frontendUrls,
    fileStorage: env.fileStorageDriver,
    mediaStorage: env.mediaStorageDriver,
    email: env.emailDriver,
    cloudinaryConfigured: integrations.cloudinary(),
    b2Configured: integrations.b2(),
    resendConfigured: integrations.resend(),
    openaiConfigured: integrations.openai(),
  };
}
