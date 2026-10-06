import { randomUUID } from 'node:crypto';
import { env, integrations } from '../../config/env.js';
import { notConfigured, notFound } from '../../utils/AppError.js';

/*
  Private document storage: resumes and the attachments sent with a
  requirement or an enquiry.

  The contract every driver implements:
    put(key, buffer, mimeType)                -> void
    signedUrl(key, { fileName, mimeType })    -> { url, expiresIn }
    remove(key)                               -> void
    list()                                    -> [key]
  The local and memory drivers add read(key) for the development
  download route, and the local driver has(key).

  - Backblaze B2 (drivers/b2.js) is used whenever its credentials are
    set, and always in production. Objects are private; there is no
    public URL for them at any point.
  - A file is only ever reached through an endpoint that checks the
    caller's permission and then asks the driver for a signed URL that
    expires after SIGNED_URL_TTL_SECONDS.
  - Keys are random. The uploaded filename is stored as a label only
    and is never part of the key or a path.
  - The upload passes validation (utils/fileSniff.js) before put() is
    called. A malware scan can be added as one more step between
    validation and put() without changing any caller: see
    scanBeforeStore() below.

  Which store holds a file. The record saved in MongoDB carries a
  `storage` marker (b2, local or memory) written when the file is
  stored, so a file keeps working after the active driver changes: a
  resume saved on the local disk before B2 was switched on is still
  read from the local disk. See storageHolding() below. The marker is
  internal and is never part of an API response.
*/

const STORES = ['b2', 'local', 'memory'];
// A marker of the provider used before B2. This server cannot reach
// that store, so such a file is reported as unavailable.
const RETIRED_STORES = ['r2'];
const DEVELOPMENT_STORES = ['local', 'memory'];

const loaders = {
  async b2() {
    if (!integrations.b2()) {
      throw notConfigured('STORAGE_NOT_CONFIGURED', 'Document storage is not configured. Uploads are unavailable.');
    }
    const { createB2Driver } = await import('./drivers/b2.js');
    return createB2Driver();
  },
  async local() {
    const { createLocalFileDriver } = await import('./drivers/local.js');
    return createLocalFileDriver();
  },
  async memory() {
    const { createMemoryFileDriver } = await import('./drivers/memory.js');
    return createMemoryFileDriver();
  },
};

// One instance per store, created the first time it is needed.
const loaded = new Map();

function driver(name = env.fileStorageDriver) {
  if (!loaded.has(name)) {
    loaded.set(name, loaders[name]().catch((error) => {
      loaded.delete(name); // allow a retry once configuration is fixed
      throw error;
    }));
  }
  return loaded.get(name);
}

// For the tests: puts a driver in place by name (a stand-in for B2, a
// local driver on a temporary folder). Refused in production.
export function setDriversForTests(drivers) {
  if (env.isProduction) throw new Error('setDriversForTests is not available in production.');
  for (const [name, instance] of Object.entries(drivers)) {
    if (!STORES.includes(name)) throw new Error(`Unknown store "${name}".`);
    loaded.set(name, Promise.resolve(instance));
  }
}

async function onLocalDisk(key) {
  const local = await driver('local');
  return local.has(key);
}

/*
  storageHolding - the name of the store that holds a file, or null
  when that store cannot be reached from this server.

  - A record with a marker: that store. In production only the active
    store is ever used, so a file marked local or memory (stored from a
    development machine that shares this database) is reported as
    unavailable instead of being looked for somewhere it never was.
  - A record marked with the provider used before B2 (r2): not
    reachable, in any environment.
  - A record without a marker (stored before the marker existed):
    outside production, the local disk when the key is found there,
    otherwise the active store. In production, always the active store.
*/
export async function storageHolding(file, {
  active = env.fileStorageDriver,
  isProduction = env.isProduction,
  existsLocally = onLocalDisk,
} = {}) {
  const marker = file?.storage;
  if (RETIRED_STORES.includes(marker)) return null;
  if (STORES.includes(marker)) {
    if (isProduction && marker !== active) return null;
    return marker;
  }
  if (isProduction || active === 'local') return active;
  return (await existsLocally(file.key)) ? 'local' : active;
}

export function newObjectKey(folder, extension) {
  const now = new Date();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  return `${folder}/${now.getUTCFullYear()}/${month}/${randomUUID()}.${extension}`;
}

// Hook for a malware scanner. It receives the validated upload before
// anything is stored and should throw to reject the file. No scanner
// is connected in this release.
async function scanBeforeStore() {
  return { scanned: false };
}

/*
  storePrivateFile - stores a validated upload in the active store and
  returns the metadata that is saved in MongoDB (never the bytes).
  `inspection` is the result of inspectDocument() for this file.
*/
export async function storePrivateFile({ buffer, originalName, inspection, folder }) {
  await scanBeforeStore({ buffer, inspection });
  const key = newObjectKey(folder, inspection.extension);
  const storage = env.fileStorageDriver;
  const active = await driver(storage);
  await active.put(key, buffer, inspection.mime);
  return {
    key,
    originalName,
    mimeType: inspection.mime,
    size: buffer.length,
    uploadedAt: new Date(),
    storage,
  };
}

export async function signedUrlFor(file) {
  const holder = await storageHolding(file);
  if (!holder) throw notFound('This document is held in a store that this server does not use, so it cannot be opened from here.');
  const store = await driver(holder);
  return store.signedUrl(file.key, { fileName: file.originalName, mimeType: file.mimeType });
}

export async function removePrivateFile(file) {
  if (!file?.key) return;
  const holder = await storageHolding(file);
  if (!holder) return; // not in a store this server can reach: nothing to remove here
  const store = await driver(holder);
  await store.remove(file.key);
}

/*
  listStoredFiles - every file the stores this server can reach hold:
  the active store and, outside production, the local disk as well
  (files saved there before the provider was switched on).
  Returns [{ storage, key }]. removeStoredFile removes one of them.
  Both are for maintenance commands (scripts/clean-showcase.js), never
  for a request.
*/
export async function listStoredFiles() {
  const names = [env.fileStorageDriver];
  if (!env.isProduction && env.fileStorageDriver === 'b2') names.push('local');
  const found = [];
  for (const storage of names) {
    const store = await driver(storage);
    for (const key of await store.list()) found.push({ storage, key });
  }
  return found;
}

export async function removeStoredFile({ storage, key }) {
  if (!STORES.includes(storage)) return;
  const store = await driver(storage);
  await store.remove(key);
}

/*
  readLocalObject - the bytes behind a signed development link
  (GET /api/files/local/:token). `store` comes from the signed token
  and names the development store that issued the link. B2 is never
  read through here, and nothing is in production.
*/
export async function readLocalObject(key, store) {
  if (env.isProduction) return null;
  let name = store;
  // A link issued before the store was written into the token.
  if (!DEVELOPMENT_STORES.includes(name)) name = env.fileStorageDriver === 'memory' ? 'memory' : 'local';
  const holder = await driver(name);
  return holder.read(key);
}
