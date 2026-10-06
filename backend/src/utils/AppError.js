/*
  AppError - an error that is safe to show to the caller.

  Anything thrown that is NOT an AppError is treated as an internal
  fault: it is logged in full on the server and the client only ever
  receives a generic message (see middleware/errorHandler.js).
*/
export class AppError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    this.details = details;
    this.expose = true;
  }
}

export const badRequest = (message = 'The request is not valid.', details) => new AppError(400, 'BAD_REQUEST', message, details);
export const validationError = (details, message = 'Some fields need attention.') => new AppError(400, 'VALIDATION_ERROR', message, details);
export const unauthenticated = (message = 'Sign in to continue.') => new AppError(401, 'UNAUTHENTICATED', message);
export const forbidden = (message = 'You do not have permission to do this.') => new AppError(403, 'FORBIDDEN', message);
export const notFound = (message = 'Not found.') => new AppError(404, 'NOT_FOUND', message);
export const conflict = (message = 'This conflicts with an existing record.') => new AppError(409, 'CONFLICT', message);
export const tooLarge = (message = 'The file is too large.') => new AppError(413, 'FILE_TOO_LARGE', message);
export const unsupportedFile = (message = 'This file type is not accepted.') => new AppError(415, 'UNSUPPORTED_FILE_TYPE', message);
export const tooManyRequests = (message = 'Too many requests. Please wait and try again.') => new AppError(429, 'RATE_LIMITED', message);
export const notConfigured = (code, message) => new AppError(503, code, message);
