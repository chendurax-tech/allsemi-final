// Forwards a rejected promise from an async route handler to Express's
// error handler, so no controller needs its own try/catch.
export const asyncHandler = (handler) => (req, res, next) => {
  Promise.resolve(handler(req, res, next)).catch(next);
};
