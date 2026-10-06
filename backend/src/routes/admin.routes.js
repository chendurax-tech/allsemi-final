import { Router } from 'express';
import { requireAuth, requirePermission, requirePasswordChanged } from '../middleware/auth.js';
import { csrfProtection } from '../middleware/csrf.js';
import { validate } from '../middleware/validate.js';
import { uploadLimiter, downloadLimiter, aiLimiter } from '../middleware/rateLimiters.js';
import { singleImage, checkImage } from '../middleware/upload.js';
import { PERMISSIONS as P } from '../config/permissions.js';
import * as resources from '../controllers/resources.js';
import * as recruitment from '../controllers/recruitmentController.js';
import * as ats from '../controllers/atsController.js';
import * as media from '../controllers/mediaController.js';
import * as system from '../controllers/systemController.js';
import * as auth from '../controllers/authController.js';
import { jobCreateSchema, jobUpdateSchema } from '../validators/jobs.js';
import {
  candidateUpdateSchema, noteSchema, applicationUpdateSchema, requirementCreateSchema, requirementUpdateSchema,
  referralUpdateSchema, enquiryUpdateSchema, atsRunSchema, atsReviewSchema,
} from '../validators/recruitment.js';
import {
  insightCreateSchema, insightUpdateSchema, storyCreateSchema, storyUpdateSchema, expertiseCreateSchema, expertiseUpdateSchema,
  serviceCreateSchema, serviceUpdateSchema, locationCreateSchema, locationUpdateSchema, contactSettingsSchema, mediaDeleteSchema,
} from '../validators/content.js';
import { userCreateSchema, userUpdateSchema } from '../validators/auth.js';

/*
  Admin API. Everything in this router is protected twice before a
  handler runs:
    router.use(requireAuth)        a valid session is required
    requirePermission(P.X)         the signed-in role must hold X
  and state-changing requests pass csrfProtection first. An account
  still on a temporary password is stopped by requirePasswordChanged.

  The permission each route needs is written on the route, so this
  file is also the reference for "who can call what".
*/
const router = Router();
router.use(csrfProtection);
router.use(requireAuth);
router.use(requirePasswordChanged);

const can = requirePermission;

// ---- access matrix and the signed-in user's capabilities ----
router.get('/access', auth.access);

// ---- jobs ----
router.get('/jobs', can(P.JOBS_READ), resources.jobs.list);
router.get('/jobs/:id', can(P.JOBS_READ), resources.jobs.read);
router.post('/jobs', can(P.JOBS_WRITE), validate(jobCreateSchema), resources.jobs.create);
router.patch('/jobs/:id', can(P.JOBS_WRITE), validate(jobUpdateSchema), resources.jobs.update);
router.delete('/jobs/:id', can(P.JOBS_DELETE), resources.jobs.remove);

// ---- candidates ----
router.get('/candidates', can(P.CANDIDATES_READ), resources.candidates.list);
router.get('/candidates/:id', can(P.CANDIDATES_READ), recruitment.candidateDetail);
router.patch('/candidates/:id', can(P.CANDIDATES_WRITE), validate(candidateUpdateSchema), recruitment.updateCandidate);
router.post('/candidates/:id/notes', can(P.CANDIDATES_WRITE), validate(noteSchema), recruitment.addCandidateNote);
router.get('/candidates/:id/resume-url', downloadLimiter, can(P.CANDIDATES_READ, P.RESUMES_READ), recruitment.candidateResumeUrl);
router.delete('/candidates/:id', can(P.CANDIDATES_DELETE), recruitment.deleteCandidate);

// ---- applications ----
router.get('/applications', can(P.APPLICATIONS_READ), resources.applications.list);
router.get('/applications/:id', can(P.APPLICATIONS_READ), resources.applications.read);
router.patch('/applications/:id', can(P.APPLICATIONS_WRITE), validate(applicationUpdateSchema), recruitment.updateApplication);
router.get('/applications/:id/resume-url', downloadLimiter, can(P.APPLICATIONS_READ, P.RESUMES_READ), recruitment.applicationResumeUrl);
// The only workflow action. Labels are edited with PATCH above.
router.post('/applications/:id/shortlist', can(P.APPLICATIONS_SHORTLIST), recruitment.shortlist);
router.post('/applications/:id/shortlist-email', can(P.APPLICATIONS_SHORTLIST), recruitment.shortlistEmail);

// ---- requirements ----
router.get('/requirements', can(P.REQUIREMENTS_READ), resources.requirements.list);
router.get('/requirements/:id', can(P.REQUIREMENTS_READ), resources.requirements.read);
router.post('/requirements', can(P.REQUIREMENTS_WRITE), validate(requirementCreateSchema), resources.requirements.create);
router.patch('/requirements/:id', can(P.REQUIREMENTS_WRITE), validate(requirementUpdateSchema), resources.requirements.update);
router.get('/requirements/:id/attachment-url', downloadLimiter, can(P.REQUIREMENTS_READ), recruitment.requirementAttachmentUrl);
router.delete('/requirements/:id', can(P.REQUIREMENTS_DELETE), resources.requirements.remove);

// ---- referrals ----
router.get('/referrals', can(P.REFERRALS_READ), resources.referrals.list);
router.get('/referrals/:id', can(P.REFERRALS_READ), resources.referrals.read);
router.patch('/referrals/:id', can(P.REFERRALS_WRITE), validate(referralUpdateSchema), recruitment.updateReferral);
router.post('/referrals/:id/notes', can(P.REFERRALS_WRITE), validate(noteSchema), recruitment.addReferralNote);
router.post('/referrals/:id/convert', can(P.REFERRALS_WRITE, P.CANDIDATES_WRITE), recruitment.convertReferral);
router.get('/referrals/:id/resume-url', downloadLimiter, can(P.REFERRALS_READ, P.RESUMES_READ), recruitment.referralResumeUrl);
router.delete('/referrals/:id', can(P.REFERRALS_DELETE), resources.referrals.remove);

// ---- enquiries ----
router.get('/enquiries', can(P.ENQUIRIES_READ), resources.enquiries.list);
router.get('/enquiries/:id', can(P.ENQUIRIES_READ), resources.enquiries.read);
router.patch('/enquiries/:id', can(P.ENQUIRIES_WRITE), validate(enquiryUpdateSchema), resources.enquiries.update);
router.get('/enquiries/:id/attachment-url', downloadLimiter, can(P.ENQUIRIES_READ), recruitment.enquiryAttachmentUrl);
router.delete('/enquiries/:id', can(P.ENQUIRIES_DELETE), resources.enquiries.remove);

// ---- ATS: rule-based evaluation and the AI comparison ----
router.get('/ats/engine', can(P.ATS_READ), ats.engine);
router.get('/ats-results', can(P.ATS_READ), ats.list);
router.get('/ats-results/:id', can(P.ATS_READ), ats.read);
router.post('/ats/run', can(P.ATS_RUN), validate(atsRunSchema), ats.run);
router.patch('/ats-results/:id/review', can(P.ATS_REVIEW), validate(atsReviewSchema), ats.review);
// "Compare with AI": the only route that calls OpenAI, and only when a
// recruiter asks. Advisory: it shortlists nobody.
router.post('/ats-results/:id/ai-comparison', aiLimiter, can(P.ATS_RUN), ats.aiCompare);

// ---- website content ----
function content(path, controller, createSchema, updateSchema) {
  router.get(`/${path}`, can(P.CONTENT_READ), controller.list);
  router.get(`/${path}/:id`, can(P.CONTENT_READ), controller.read);
  router.post(`/${path}`, can(P.CONTENT_WRITE), validate(createSchema), controller.create);
  router.patch(`/${path}/:id`, can(P.CONTENT_WRITE), validate(updateSchema), controller.update);
  router.delete(`/${path}/:id`, can(P.CONTENT_DELETE), controller.remove);
}
content('insights', resources.insights, insightCreateSchema, insightUpdateSchema);
content('stories', resources.stories, storyCreateSchema, storyUpdateSchema);
content('expertise', resources.expertise, expertiseCreateSchema, expertiseUpdateSchema);
content('services', resources.services, serviceCreateSchema, serviceUpdateSchema);
content('locations', resources.locations, locationCreateSchema, locationUpdateSchema);

// ---- media (public images, Cloudinary) ----
router.post('/media', uploadLimiter, can(P.MEDIA_UPLOAD), singleImage('file'), checkImage(), media.upload);
router.delete('/media', can(P.MEDIA_UPLOAD), validate(mediaDeleteSchema), media.remove);

// ---- settings ----
router.get('/settings', can(P.SETTINGS_READ), system.getSettings);
router.put('/settings/contact', can(P.SETTINGS_WRITE), validate(contactSettingsSchema), system.putContact);

// ---- users and audit log ----
router.get('/users', can(P.USERS_MANAGE), auth.listUsers);
router.post('/users', can(P.USERS_MANAGE), validate(userCreateSchema), auth.createUser);
router.patch('/users/:id', can(P.USERS_MANAGE), validate(userUpdateSchema), auth.updateUser);
router.post('/users/:id/reset-password', can(P.USERS_MANAGE), auth.resetUserPassword);
router.get('/audit-logs', can(P.AUDIT_READ), system.listAuditLogs);

export default router;
