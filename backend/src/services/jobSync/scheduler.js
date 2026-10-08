import { env } from '../../config/env.js';
import { logger } from '../../utils/logger.js';
import { runSync, configuredSource } from './syncService.js';

/*
  The in-process schedule of the job sync: every JOB_SYNC_INTERVAL_MINUTES
  while the server runs (off at 0, the default). It suits a server that
  stays up. A host that puts an idle server to sleep (a free Render web
  service) misses runs while asleep: use an external scheduler there,
  with `npm run sync:jobs` or POST /api/internal/job-sync (README).
  Runs never overlap: the sync's own lock refuses a second one.
*/
let timer = null;

export function startJobSyncSchedule() {
  const minutes = env.jobSync.intervalMinutes;
  if (!minutes || !configuredSource() || env.isTest || timer) return false;
  const tick = () => runSync({ trigger: 'schedule' }).catch((error) => logger.error('jobs.sync_schedule_failed', { errorName: error?.name || 'Error' }));
  // The first run a minute after start, then every interval.
  setTimeout(tick, 60_000).unref();
  timer = setInterval(tick, minutes * 60_000);
  timer.unref();
  logger.info('jobs.sync_scheduled', { everyMinutes: minutes, source: env.jobSync.sourceKey });
  return true;
}

export function stopJobSyncSchedule() {
  if (timer) clearInterval(timer);
  timer = null;
}
