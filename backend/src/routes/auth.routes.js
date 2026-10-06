import { Router } from 'express';
import * as auth from '../controllers/authController.js';
import { requireAuth } from '../middleware/auth.js';
import { csrfProtection } from '../middleware/csrf.js';
import { loginLimiter, passwordLimiter } from '../middleware/rateLimiters.js';
import { validate } from '../middleware/validate.js';
import { loginSchema, changePasswordSchema } from '../validators/auth.js';

const router = Router();

router.post('/login', loginLimiter, csrfProtection, validate(loginSchema), auth.login);
router.post('/logout', csrfProtection, requireAuth, auth.logout);
router.get('/me', requireAuth, auth.me);
router.post('/change-password', passwordLimiter, csrfProtection, requireAuth, validate(changePasswordSchema), auth.changePassword);

export default router;
