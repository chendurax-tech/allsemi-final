import { createHash, randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { env, integrations } from '../../config/env.js';
import { notConfigured, AppError } from '../../utils/AppError.js';
import { logger } from '../../utils/logger.js';

/*
  Public website media (article covers, story photos, sector visuals).

  Cloudinary is used whenever its credentials are set, and always in
  production. The image is uploaded from the server with a signed
  request, so the API secret never reaches the browser, and the
  response is reduced to the metadata stored in MongoDB:
    { url, publicId, width, height, format }
  (`alt` is added by the caller). Image bytes are never stored in
  MongoDB.

  The Cloudinary REST API is called directly with fetch: the two calls
  needed (upload, destroy) do not justify another dependency.

  Images from before Cloudinary was switched on keep working:
  - an image uploaded to the development folder has a "local-<uuid>"
    id and a /media/... address. app.js keeps serving that folder
    outside production whatever the active driver is, and such an
    image is still removed from that folder, not from Cloudinary;
  - an image entered as an external link has no publicId. Nothing here
    ever touches it.
  Local images are not copied to Cloudinary. To move one, upload it
  again from the admin.
*/

export const LOCAL_MEDIA_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../.data/media');
const memoryMedia = new Map();

const sha1 = (value) => createHash('sha1').update(value).digest('hex');

// Cloudinary request signature: the parameters, sorted by name and
// joined as a query string, followed by the API secret.
function sign(params) {
  const toSign = Object.keys(params).sort().map((key) => `${key}=${params[key]}`).join('&');
  return sha1(`${toSign}${env.cloudinary.apiSecret}`);
}

// Every failure of the image service, whether it refused the request,
// could not be reached or answered with something unusable, is logged
// here and reaches the caller as the same 502.
function uploadFailed(action, details) {
  logger.error('media.cloudinary_failed', { action, ...details });
  return new AppError(502, 'MEDIA_UPLOAD_FAILED', 'The image service did not accept the request. Try again.');
}

async function cloudinaryCall(action, fields) {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    if (value && typeof value === 'object' && 'blob' in value) form.append(key, value.blob, value.name);
    else form.append(key, String(value));
  }
  let response;
  try {
    response = await fetch(`https://api.cloudinary.com/v1_1/${env.cloudinary.cloudName}/image/${action}`, {
      method: 'POST',
      body: form,
      signal: AbortSignal.timeout(30_000),
    });
  } catch (error) {
    throw uploadFailed(action, { message: error?.message });
  }
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw uploadFailed(action, { status: response.status, message: body?.error?.message });
  return body;
}

async function uploadToCloudinary({ buffer, inspection }) {
  if (!integrations.cloudinary()) {
    throw notConfigured('MEDIA_NOT_CONFIGURED', 'Image storage is not configured. Uploads are unavailable.');
  }
  const params = { folder: env.cloudinary.folder, timestamp: Math.floor(Date.now() / 1000) };
  const body = await cloudinaryCall('upload', {
    ...params,
    api_key: env.cloudinary.apiKey,
    signature: sign(params),
    file: { blob: new Blob([buffer], { type: inspection.mime }), name: `upload.${inspection.extension}` },
  });
  // Without an address and an id there is nothing to store on a record.
  if (!body.secure_url || !body.public_id) throw uploadFailed('upload', { message: 'The answer had no secure_url or public_id.' });
  // The image is stored and usable either way. An id outside the folder
  // is one removeImage() will refuse later, so the image would stay in
  // Cloudinary after its record is gone: worth a line in the log.
  if (!isCloudinaryId(body.public_id)) logger.warn('media.id_outside_folder', { publicId: body.public_id, folder: env.cloudinary.folder });
  return {
    url: body.secure_url,
    publicId: body.public_id,
    width: body.width ?? null,
    height: body.height ?? null,
    format: body.format || inspection.extension,
  };
}

async function removeFromCloudinary(publicId) {
  if (!integrations.cloudinary()) return;
  const params = { public_id: publicId, timestamp: Math.floor(Date.now() / 1000) };
  await cloudinaryCall('destroy', { ...params, api_key: env.cloudinary.apiKey, signature: sign(params) });
}

/*
  uploadImage - `inspection` is the result of inspectImage() and
  `dimensions` what imageDimensions() read from the file header.
  `baseUrl` is only used by the development driver to build a URL.
*/
export async function uploadImage({ buffer, inspection, dimensions, baseUrl = '' }) {
  if (env.mediaStorageDriver === 'cloudinary') return uploadToCloudinary({ buffer, inspection });

  const publicId = `local-${randomUUID()}`;
  const fileName = `${publicId}.${inspection.extension}`;
  if (env.mediaStorageDriver === 'local') {
    // DEVELOPMENT ONLY: served by app.js from /media.
    await fs.mkdir(LOCAL_MEDIA_ROOT, { recursive: true });
    await fs.writeFile(path.join(LOCAL_MEDIA_ROOT, fileName), buffer);
  } else {
    memoryMedia.set(publicId, { buffer, mime: inspection.mime });
  }
  return {
    url: `${baseUrl}/media/${fileName}`,
    publicId,
    width: dimensions?.width ?? null,
    height: dimensions?.height ?? null,
    format: inspection.extension,
  };
}

// The two kinds of id this application's uploads produce.
const isLocalId = (publicId) => /^local-[0-9a-f-]{36}$/.test(publicId);

function isCloudinaryId(publicId) {
  const folder = `${env.cloudinary.folder}/`;
  return publicId.startsWith(folder) && /^[\w-]+$/.test(publicId.slice(folder.length));
}

/*
  ownsImage - true only for an id this application's uploads produce
  and that this server can remove:
  - a "local-<uuid>" id of the development and test drivers, outside
    production (in production there is no local folder);
  - an id directly inside the configured Cloudinary folder, while
    Cloudinary is the active driver. That is whenever its credentials
    are set, except in the tests, which therefore never call it.
  Which of the two an id is, is read from its shape and not from the
  active driver, so an image uploaded locally before Cloudinary was
  switched on is still recognised and is removed from the local
  folder. A record's image.publicId comes from a request, so it is
  checked here, inside the one function that deletes, and not only by
  the callers. An image with no publicId (an external link) is never
  owned.
*/
export function ownsImage(publicId) {
  if (typeof publicId !== 'string' || !publicId || publicId.length > 200) return false;
  if (isLocalId(publicId)) return !env.isProduction;
  return env.mediaStorageDriver === 'cloudinary' && isCloudinaryId(publicId);
}

export async function removeImage(publicId) {
  if (!ownsImage(publicId)) return;
  try {
    if (!isLocalId(publicId)) {
      await removeFromCloudinary(publicId);
    } else if (env.mediaStorageDriver === 'memory') {
      memoryMedia.delete(publicId);
    } else {
      const entries = await fs.readdir(LOCAL_MEDIA_ROOT).catch(() => []);
      await Promise.all(entries.filter((name) => name.startsWith(`${publicId}.`)).map((name) => fs.rm(path.join(LOCAL_MEDIA_ROOT, name), { force: true })));
    }
  } catch (error) {
    // The record no longer points at the image; an orphan in storage is
    // logged, not surfaced as a failure of the user's action.
    logger.warn('media.remove_failed', { publicId, error });
  }
}

export { memoryMedia };
