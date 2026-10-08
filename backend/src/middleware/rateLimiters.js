import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';

/*
  Rate limits. Counters are kept in memory, which is correct for one
  instance (the starting deployment). When the API runs on more than
  one instance, pass a shared store (Redis or MongoDB) to these
  limiters; nothing else changes.

  Limits can be overridden in tests through the options argument.
*/
function limiter({ windowMs, limit, message, ...options }) {
  return rateLimit({
    windowMs,
    limit,
    ...options,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    skip: () => env.isTest && process.env.RATE_LIMIT_IN_TESTS !== '1',
    handler: (req, res) => {
      res.status(429).json({ success: false, error: { code: 'RATE_LIMITED', message } });
    },
  });
}

// Everything under /api.
export const apiLimiter = limiter({
  windowMs: 15 * 60 * 1000,
  limit: 600,
  message: 'Too many requests. Please wait a few minutes and try again.',
});

// Failed sign-in attempts, per IP. A successful sign-in is not counted,
// so a shared office address is not locked out by people signing in
// normally. The pause in authService is the second line of defence
// against guessing one account from many IPs.
export const loginLimiter = limiter({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
  message: 'Too many sign-in attempts. Please wait fifteen minutes and try again.',
});

// Password changes, per IP. The route asks for the current password,
// so without a limit a stolen session could be used to guess it.
export const passwordLimiter = limiter({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
  message: 'Too many password attempts. Please wait fifteen minutes and try again.',
});

// Public form submissions, per IP, across all four forms.
export const formLimiter = limiter({
  windowMs: 10 * 60 * 1000,
  limit: 8,
  message: 'Too many submissions from this connection. Please wait a few minutes and try again.',
});

// Admin uploads.
export const uploadLimiter = limiter({
  windowMs: 10 * 60 * 1000,
  limit: 60,
  message: 'Too many uploads. Please wait a few minutes and try again.',
});

// Signed download links for private documents.
export const downloadLimiter = limiter({
  windowMs: 10 * 60 * 1000,
  limit: 120,
  message: 'Too many document requests. Please wait a few minutes and try again.',
});

// "Compare with AI". Every comparison is a paid request to OpenAI, so
// the limit is low and is counted per signed-in user (the route is
// behind requireAuth), or per IP if there is no user.
export const aiLimiter = limiter({
  windowMs: 10 * 60 * 1000,
  limit: 20,
  keyGenerator: (req) => (req.user?.id ? `user:${req.user.id}` : req.ip),
  message: 'Too many AI comparisons. Please wait a few minutes and try again.',
});

// The public website assistant (rule-based), per visitor address. A
// short burst limit stops rapid repeats; the hourly limit bounds the
// load one visitor can cause.
export const chatBurstLimiter = limiter({
  windowMs: 60 * 1000,
  limit: 10,
  message: 'You are sending messages quickly. Please wait a moment and try again.',
});
export const chatHourLimiter = limiter({
  windowMs: 60 * 60 * 1000,
  limit: 60,
  message: 'You have sent a lot of messages in a short time. Please try again later, or browse the openings on the Talent page.',
});

// Reading a resume (text extraction and parsing) runs on this server
// and takes real CPU time, so it has its own limit per signed-in user.
// It calls no AI service.
export const extractionLimiter = limiter({
  windowMs: 10 * 60 * 1000,
  limit: 30,
  keyGenerator: (req) => (req.user?.id ? `user:${req.user.id}` : req.ip),
  message: 'Too many resumes read in a short time. Please wait a few minutes and try again.',
});
