import { ZodError } from 'zod';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { AppError } from '../utils/AppError.js';
import { fail } from '../utils/apiResponse.js';
import { zodDetails } from './validate.js';

export function notFoundHandler(req, res) {
  return fail(res, 404, 'NOT_FOUND', 'This endpoint does not exist.');
}

/*
  The single error handler. It turns known error types into the API's
  error shape and treats everything else as an internal fault: the full
  error (with stack) goes to the server log under the request id, and
  the client receives a generic message. Stack traces and internal
  messages are never sent in a response.
*/
export function errorHandler(error, req, res, next) {
  // The response has started, so no error body can be sent. Express
  // closes the connection; the fault is still logged.
  if (res.headersSent) {
    logger.error('http.error_after_headers', { requestId: req.id, error });
    next(error);
    return;
  }

  if (error instanceof AppError) {
    if (error.status >= 500) logger.error('http.app_error', { requestId: req.id, code: error.code, error });
    return fail(res, error.status, error.code, error.message, error.details);
  }

  if (error instanceof ZodError) {
    return fail(res, 400, 'VALIDATION_ERROR', 'Some fields need attention.', zodDetails(error));
  }

  // multer
  if (error?.name === 'MulterError') {
    if (error.code === 'LIMIT_FILE_SIZE') return fail(res, 413, 'FILE_TOO_LARGE', 'The file is larger than the 5 MB limit.');
    if (error.code === 'LIMIT_UNEXPECTED_FILE') return fail(res, 400, 'UNEXPECTED_FILE', 'A file was sent in a field that does not accept one.');
    return fail(res, 400, 'UPLOAD_REJECTED', 'The upload was not accepted.');
  }

  // body-parser
  if (error?.type === 'entity.too.large') return fail(res, 413, 'PAYLOAD_TOO_LARGE', 'The request is too large.');
  if (error?.type === 'entity.parse.failed') return fail(res, 400, 'INVALID_JSON', 'The request body is not valid JSON.');

  // mongoose
  if (error?.name === 'ValidationError' && error.errors) {
    const details = Object.values(error.errors).map((item) => ({ field: item.path, message: item.message }));
    return fail(res, 400, 'VALIDATION_ERROR', 'Some fields need attention.', details);
  }
  if (error?.name === 'CastError') return fail(res, 400, 'INVALID_ID', 'That id is not valid.');
  if (error?.code === 11000) {
    const field = Object.keys(error.keyPattern || error.keyValue || {})[0];
    return fail(res, 409, 'CONFLICT', field ? `Another record already uses that ${field}.` : 'This conflicts with an existing record.');
  }

  // Errors Express and its parsers raise for a malformed request carry
  // their own 4xx status (a URL parameter that cannot be decoded, an
  // unsupported charset). They are the client's mistake, not a fault.
  const status = error?.status || error?.statusCode;
  if (Number.isInteger(status) && status >= 400 && status < 500) {
    return fail(res, status, 'BAD_REQUEST', 'The request is not valid.');
  }

  logger.error('http.unhandled_error', { requestId: req.id, method: req.method, path: req.originalUrl.split('?')[0], error });
  const message = env.isProduction ? 'Something went wrong on our side. Please try again.' : `Internal error: ${error?.message || 'unknown'}`;
  return fail(res, 500, 'INTERNAL_ERROR', message);
}
