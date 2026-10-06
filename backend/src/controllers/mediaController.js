import { created, ok } from '../utils/apiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { imageDimensions } from '../utils/fileSniff.js';
import { uploadImage, removeImage, ownsImage } from '../services/storage/publicMedia.js';
import { imageInUse } from '../services/mediaUsage.js';
import { cleanText } from '../utils/sanitize.js';
import { badRequest, conflict } from '../utils/AppError.js';
import { record } from '../services/auditService.js';

/*
  POST /api/admin/media  (multipart, field "file", optional "alt")
  The image has already passed checkImage (type decided from its
  bytes, size limited by multer). The response is the media metadata
  the admin stores on the record: { url, publicId, width, height,
  format, alt }.
*/
export const upload = asyncHandler(async (req, res) => {
  const { buffer, inspection, originalName } = req.upload;
  const dimensions = imageDimensions(buffer, inspection.type);
  const baseUrl = `${req.protocol}://${req.get('host')}`;
  const media = await uploadImage({ buffer, inspection, dimensions, baseUrl });
  const alt = cleanText(req.body?.alt, { max: 300 });
  await record({ req, action: 'media.uploaded', entityType: 'media', entityId: media.publicId, summary: `Uploaded image ${originalName}`, metadata: { format: media.format, bytes: buffer.length } });
  created(res, { ...media, alt });
});

/*
  DELETE /api/admin/media  { publicId }
  Removes an uploaded image that is no longer attached to a record
  (for example an upload that was replaced before saving). Only ids
  inside this application's own media folder are accepted, and an image
  a saved record still shows is refused: it is removed by editing or
  deleting that record.
*/
export const remove = asyncHandler(async (req, res) => {
  const { publicId } = req.body;
  if (!ownsImage(publicId)) throw badRequest('That image cannot be removed from here.');
  if (await imageInUse(publicId)) throw conflict('That image is still used by a saved record.');
  await removeImage(publicId);
  await record({ req, action: 'media.removed', entityType: 'media', entityId: publicId, summary: 'Removed an uploaded image' });
  ok(res, { removed: true });
});
