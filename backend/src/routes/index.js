import { Router } from 'express';
import publicRoutes from './public.routes.js';
import authRoutes from './auth.routes.js';
import adminRoutes from './admin.routes.js';
import { databaseReady } from '../config/db.js';
import * as jobSync from '../controllers/jobSyncController.js';

const router = Router();

// Liveness and readiness for the host's health check. No data.
router.get('/health', (req, res) => {
  if (databaseReady()) return res.status(200).json({ success: true, data: { status: 'ok' } });
  return res.status(503).json({ success: false, error: { code: 'DATABASE_UNAVAILABLE', message: 'The database is not reachable.' } });
});

// The job sync, for an external scheduler: bearer token JOB_SYNC_TOKEN,
// no session and no cookie. 404 while no token is configured.
router.post('/internal/job-sync', jobSync.trigger);

router.use('/auth', authRoutes);
router.use('/admin', adminRoutes);
router.use('/', publicRoutes);

export default router;
