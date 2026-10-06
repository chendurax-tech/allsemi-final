import { env } from '../config/env.js';
import { forbidden } from '../utils/AppError.js';

/*
  Cross-site request forgery protection for cookie-authenticated
  routes, also applied to the public form submissions so that a page on
  another website cannot post to them. Three independent layers:

  1. The session cookie is SameSite (lax by default), so a browser does
     not attach it to a cross-site POST in the first place.
  2. Every state-changing request must carry the header
     "X-Requested-With: XMLHttpRequest". A plain HTML form on another
     site cannot set a custom header, and a script on another site
     cannot either, because CORS only allows the configured frontend
     origin.
  3. If the browser sent an Origin header, it must be one of the
     allowed frontend origins.
*/
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export function csrfProtection(req, res, next) {
  if (SAFE_METHODS.has(req.method)) return next();
  if (req.get('X-Requested-With') !== 'XMLHttpRequest') {
    return next(forbidden('This request was not sent by the ALLSEMIS application.'));
  }
  // The configured origins never end in "/", and a browser never sends
  // one either, so the header is compared as it is.
  const origin = req.get('Origin');
  if (origin && !env.frontendUrls.includes(origin)) {
    return next(forbidden('This request came from an origin that is not allowed.'));
  }
  return next();
}
