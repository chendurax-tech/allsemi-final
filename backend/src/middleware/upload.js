import multer from 'multer';
import { MAX_DOCUMENT_BYTES, MAX_IMAGE_BYTES } from '../config/constants.js';
import { inspectDocument, inspectImage } from '../utils/fileSniff.js';
import { safeFileName } from '../utils/sanitize.js';
import { unsupportedFile, badRequest } from '../utils/AppError.js';

/*
  Upload handling.

  Files are read into memory (never written to the server's disk),
  limited to one file per request and to a fixed size, and then checked
  by content in checkDocument / checkImage before anything is stored.
  The request's text fields are limited too, so a multipart body cannot
  be used to send an unbounded payload.
*/
function uploader(maxBytes) {
  return multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: maxBytes,
      files: 1,
      fields: 60,
      fieldSize: 64 * 1024,
      parts: 70,
    },
  });
}

const documents = uploader(MAX_DOCUMENT_BYTES);
const images = uploader(MAX_IMAGE_BYTES);

// One optional document, in the named field. Any other file field is
// rejected by multer (LIMIT_UNEXPECTED_FILE).
export const singleDocument = (field) => documents.single(field);
export const singleImage = (field) => images.single(field);

/*
  checkDocument / checkImage - run after multer. They decide the file's
  type from its bytes and attach the result as req.upload:
    { buffer, originalName, inspection }
  or leave req.upload null when no file was sent.
*/
function check(inspect, { required }) {
  return (req, res, next) => {
    req.upload = null;
    if (!req.file) {
      if (required) return next(badRequest('A file is required.'));
      return next();
    }
    if (!req.file.buffer || req.file.buffer.length === 0) return next(badRequest('The file is empty.'));
    const originalName = safeFileName(req.file.originalname);
    const inspection = inspect({ buffer: req.file.buffer, originalName });
    if (!inspection.ok) return next(unsupportedFile(inspection.reason));
    req.upload = { buffer: req.file.buffer, originalName, inspection };
    return next();
  };
}

export const checkDocument = (options = {}) => check(inspectDocument, { required: false, ...options });
export const checkImage = (options = {}) => check(inspectImage, { required: true, ...options });
