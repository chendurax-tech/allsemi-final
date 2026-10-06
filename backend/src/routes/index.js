import { Router } from 'express';
import publicRoutes from './public.routes.js';
import authRoutes from './auth.routes.js';
import adminRoutes from './admin.routes.js';
import { databaseReady } from '../config/db.js';

const router = Router();

// Liveness and readiness for the host's health check. No data.
router.get('/health', (req, res) => {
  if (databaseReady()) return res.status(200).json({ success: true, data: { status: 'ok' } });
  return res.status(503).json({ success: false, error: { code: 'DATABASE_UNAVAILABLE', message: 'The database is not reachable.' } });
});

router.use('/auth', authRoutes);
router.use('/admin', adminRoutes);
router.use('/', publicRoutes);

export default router;
