import { Router } from 'express';
import * as publicController from '../controllers/publicController.js';
import * as forms from '../controllers/formsController.js';
import { serveLocalFile } from '../controllers/filesController.js';
import { formLimiter, downloadLimiter, chatBurstLimiter, chatHourLimiter } from '../middleware/rateLimiters.js';
import * as chat from '../controllers/chatController.js';
import { chatSchema } from '../validators/chat.js';
import { singleDocument, checkDocument } from '../middleware/upload.js';
import { honeypot } from '../middleware/honeypot.js';
import { csrfProtection } from '../middleware/csrf.js';
import { validate } from '../middleware/validate.js';
import {
  requirementFormSchema, applicationFormSchema, enquiryFormSchema, referralFormSchema,
} from '../validators/publicForms.js';

/*
  Routes that need no sign-in: published content and the four public
  submissions. Nothing here reads recruitment data.
*/
const router = Router();

// ---- published content ----
router.get('/public/jobs', publicController.listJobs);
router.get('/public/jobs/:slug', publicController.getJob);
router.get('/public/insights', publicController.listInsights);
router.get('/public/insights/:slug', publicController.getInsight);
router.get('/public/stories', publicController.listStories);
router.get('/public/expertise', publicController.listExpertise);
router.get('/public/services', publicController.listServices);
router.get('/public/locations', publicController.listLocations);
router.get('/public/site', publicController.getSite);
router.get('/public/sitemap.xml', publicController.sitemap);

// ---- submissions ----
// Order matters: rate limit, then the origin check (a form on another
// website cannot post here), then multipart limits, then the honeypot,
// then field validation, then file inspection by content.
const submission = (field, schema, handler) => [
  formLimiter,
  csrfProtection,
  singleDocument(field),
  honeypot,
  validate(schema),
  checkDocument(),
  handler,
];

router.post('/requirements', ...submission('attachment', requirementFormSchema, forms.submitRequirement));
router.post('/applications', ...submission('resume', applicationFormSchema, forms.submitApplication));
router.post('/enquiries', ...submission('attachment', enquiryFormSchema, forms.submitEnquiry));
router.post('/referrals', ...submission('resume', referralFormSchema, forms.submitReferral));

// ---- the website assistant ----
// Public, rate limited, and checked like the forms: same-origin
// request (CSRF), validated body. It reads published jobs and public
// content only.
router.post('/public/chat', chatBurstLimiter, chatHourLimiter, csrfProtection, validate(chatSchema), chat.reply);

// ---- development/test file driver only (404 in production) ----
router.get('/files/local/:token', downloadLimiter, serveLocalFile);

export default router;
