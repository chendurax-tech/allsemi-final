import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { env } from './config/env.js';
import apiRoutes from './routes/index.js';
import { requestContext } from './middleware/requestContext.js';
import { apiLimiter } from './middleware/rateLimiters.js';
import { notFoundHandler, errorHandler } from './middleware/errorHandler.js';
import { LOCAL_MEDIA_ROOT, memoryMedia } from './services/storage/publicMedia.js';

/*
  The Express application, without a listener (server.js starts it;
  the tests import it directly).

  Order of the global middleware:
    request id + log  ->  security headers  ->  CORS  ->  rate limit
    ->  body parsers (size limited)  ->  routes  ->  404  ->  errors
*/
export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  // Needed behind Render's proxy so req.ip is the visitor's address
  // (rate limits) and secure cookies work.
  app.set('trust proxy', env.trustProxy);

  app.use(requestContext);

  // This server returns JSON (and, in development only, uploaded
  // media). It never serves HTML, so the policy forbids everything.
  app.use(helmet({
    contentSecurityPolicy: {
      useDefaults: false,
      directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"], baseUri: ["'none'"], formAction: ["'none'"] },
    },
    crossOriginResourcePolicy: { policy: 'same-site' },
    referrerPolicy: { policy: 'no-referrer' },
    hsts: env.isProduction ? { maxAge: 15552000, includeSubDomains: true } : false,
  }));

  // Strict CORS: only the configured frontend origin(s), with
  // credentials. A request with no Origin header (server to server, a
  // health check) is not a browser cross-origin request and passes;
  // the session cookie and CSRF checks still apply to it.
  app.use(cors({
    origin(origin, callback) {
      if (!origin || env.frontendUrls.includes(origin)) return callback(null, true);
      return callback(null, false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'X-Requested-With'],
    exposedHeaders: ['X-Request-Id'],
    maxAge: 600,
  }));

  app.use('/api', apiLimiter);

  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: false, limit: '100kb' }));
  app.use(cookieParser());

  // API responses are never cached unless a route opts in (the public
  // content routes do).
  app.use('/api', (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });

  app.use('/api', apiRoutes);

  // Uploaded images of the development and test media drivers. In
  // production images are served by Cloudinary and this is not mounted.
  // Outside production the development folder is served whatever the
  // active driver is, so images uploaded before Cloudinary was switched
  // on keep their /media/... address.
  if (env.mediaStorageDriver === 'memory') {
    app.get('/media/:file', (req, res) => {
      const item = memoryMedia.get(String(req.params.file).replace(/\.[a-z]+$/, ''));
      if (!item) return res.status(404).end();
      res.set('Content-Type', item.mime);
      return res.send(item.buffer);
    });
  } else if (!env.isProduction) {
    app.use('/media', (req, res, next) => { res.set('Cross-Origin-Resource-Policy', 'cross-origin'); next(); }, express.static(LOCAL_MEDIA_ROOT, { index: false, dotfiles: 'deny', maxAge: '1h' }));
  }

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
