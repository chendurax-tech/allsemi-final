import { randomUUID } from 'node:crypto';
import { logger } from '../utils/logger.js';

// Gives every request an id (returned as X-Request-Id and written on
// every log line for it) and logs one line when the response finishes.
// Bodies, cookies and query values are never logged.
export function requestContext(req, res, next) {
  req.id = randomUUID();
  res.setHeader('X-Request-Id', req.id);
  const started = process.hrtime.bigint();
  res.on('finish', () => {
    const ms = Number(process.hrtime.bigint() - started) / 1e6;
    logger.info('http.request', {
      requestId: req.id,
      method: req.method,
      path: req.originalUrl.split('?')[0],
      status: res.statusCode,
      ms: Math.round(ms),
      userId: req.user ? req.user.id : undefined,
    });
  });
  next();
}
