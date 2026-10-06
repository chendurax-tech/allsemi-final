import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { env } from '../../../config/env.js';
import { signPayload } from '../../../utils/tokens.js';

/*
  DEVELOPMENT ONLY. Stores private documents on the local disk under
  backend/.data/private so the project runs without an B2 account.
  env.js refuses this driver when NODE_ENV=production: a host's disk is
  wiped on every deploy and is not private storage.

  Downloads still go through an expiring signed link (served by
  GET /api/files/local/:token, see routes/public.routes.js), so the flow matches production.

  Files stored here stay here. When B2 is switched on later they are
  not copied to it; they keep being served from this folder, on this
  machine, outside production (see storageHolding in privateFiles.js).
*/
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../.data/private');

// `root` is only passed by the tests, which use a temporary folder.
export function createLocalFileDriver(root = ROOT) {
  function resolveKey(key) {
    const target = path.resolve(root, String(key));
    if (!target.startsWith(`${root}${path.sep}`)) throw new Error('Invalid storage key.');
    return target;
  }

  return {
    async put(key, buffer) {
      const target = resolveKey(key);
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.writeFile(target, buffer, { mode: 0o600 });
    },
    async signedUrl(key, { fileName, mimeType }) {
      const token = signPayload({ key, fileName, mimeType, store: 'local', exp: Date.now() + env.signedUrlTtlSeconds * 1000 });
      return { url: `/api/files/local/${token}`, expiresIn: env.signedUrlTtlSeconds };
    },
    async remove(key) {
      await fs.rm(resolveKey(key), { force: true });
    },
    async read(key) {
      try {
        return await fs.readFile(resolveKey(key));
      } catch {
        return null;
      }
    },
    // True when a file is stored under this key.
    async has(key) {
      try {
        return (await fs.stat(resolveKey(key))).isFile();
      } catch {
        return false;
      }
    },
    // Every key that is stored: the files under the root, as keys
    // (folders separated by "/"). An absent root holds nothing.
    async list() {
      const keys = [];
      const walk = async (folder, prefix) => {
        let entries;
        try {
          entries = await fs.readdir(folder, { withFileTypes: true });
        } catch {
          return;
        }
        for (const entry of entries) {
          if (entry.isDirectory()) await walk(path.join(folder, entry.name), `${prefix}${entry.name}/`);
          else if (entry.isFile()) keys.push(`${prefix}${entry.name}`);
        }
      };
      await walk(root, '');
      return keys.sort();
    },
  };
}
