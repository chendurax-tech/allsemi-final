import { asyncHandler } from '../utils/asyncHandler.js';
import { notFound } from '../utils/AppError.js';
import { env } from '../config/env.js';
import { verifyPayload } from '../utils/tokens.js';
import { readLocalObject } from '../services/storage/privateFiles.js';

/*
  GET /api/files/local/:token

  Serves a private document held by the DEVELOPMENT and TEST stores
  (the local disk, or memory in the tests). The token is the signed,
  expiring link issued by a permission-checked admin endpoint; it
  carries the key and the store, and cannot be altered.

  - In production this route always answers 404: documents are in B2,
    which serves its own presigned URLs, and nothing is read from the
    host's disk.
  - Outside production it keeps working when B2 is the active store,
    so a document saved on the local disk before B2 was switched on
    can still be opened. A document that is in B2 never gets a link to
    this route.
*/
export const serveLocalFile = asyncHandler(async (req, res) => {
  if (env.isProduction) throw notFound();
  const payload = verifyPayload(req.params.token);
  if (!payload) throw notFound('This link has expired. Open the document again from the admin.');
  const buffer = await readLocalObject(payload.key, payload.store);
  if (!buffer) throw notFound('The document is no longer stored.');
  const disposition = payload.mimeType === 'application/pdf' ? 'inline' : 'attachment';
  const asciiName = String(payload.fileName || 'document').replace(/[^\w .()-]/g, '_');
  res.set({
    'Content-Type': payload.mimeType,
    'Content-Disposition': `${disposition}; filename="${asciiName}"`,
    'Cache-Control': 'private, no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  res.status(200).send(buffer);
});
