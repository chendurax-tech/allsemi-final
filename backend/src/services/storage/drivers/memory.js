import { env } from '../../../config/env.js';
import { signPayload } from '../../../utils/tokens.js';

/*
  TESTS ONLY. Keeps objects in memory so the automated tests exercise
  upload, permission-checked access and deletion without any network.
*/
const objects = new Map();

export function createMemoryFileDriver() {
  return {
    async put(key, buffer, mimeType) {
      objects.set(key, { buffer, mimeType });
    },
    async signedUrl(key, { fileName, mimeType }) {
      const token = signPayload({ key, fileName, mimeType, store: 'memory', exp: Date.now() + env.signedUrlTtlSeconds * 1000 });
      return { url: `/api/files/local/${token}`, expiresIn: env.signedUrlTtlSeconds };
    },
    async remove(key) {
      objects.delete(key);
    },
    async read(key) {
      return objects.get(key)?.buffer || null;
    },
    // Every key that is stored (see listStoredFiles in privateFiles.js).
    async list() {
      return [...objects.keys()];
    },
  };
}

export const memoryFiles = objects;
