import { logger } from '../utils/logger.js';

/*
  Basic anti-spam for the public forms.

  Each form includes a field named "website" that is hidden from people
  and left empty by the site's own code. Automated form fillers tend to
  complete every field. A submission that arrives with it filled is
  answered as if it had been accepted and is then discarded, so the
  sender learns nothing.

  This sits alongside the per-IP rate limit. If spam becomes
  significant, a CAPTCHA (for example Cloudflare Turnstile) can be
  verified here: it is the one place every public submission passes.
*/
export function honeypot(req, res, next) {
  const trap = req.body?.website;
  if (typeof trap === 'string' && trap.trim() !== '') {
    logger.warn('forms.honeypot', { requestId: req.id, path: req.path });
    return res.status(201).json({ success: true, data: { received: true } });
  }
  return next();
}
