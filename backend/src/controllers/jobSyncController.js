import { timingSafeEqual, createHash } from 'node:crypto';
import { ok } from '../utils/apiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { notFound, unauthenticated } from '../utils/AppError.js';
import { env } from '../config/env.js';
import { JobSyncRun } from '../models/index.js';
import { runSync, configuredSource } from '../services/jobSync/syncService.js';

/*
  The job synchronisation for staff (status, recent runs, "Sync now")
  and for an external scheduler (POST /api/internal/job-sync with the
  bearer token JOB_SYNC_TOKEN). See services/jobSync/syncService.js.
*/

function describeSource() {
  const source = configuredSource();
  return source
    ? { configured: true, key: source.key, name: source.name, type: source.type, url: source.url, everyMinutes: env.jobSync.intervalMinutes || null, missingThreshold: env.jobSync.missingThreshold, newStatus: env.jobSync.newStatus, triggerEndpoint: Boolean(env.jobSync.token) }
    : { configured: false, reason: 'No official job source is configured (JOB_SYNC_SOURCE_URL).' };
}

export const status = asyncHandler(async (req, res) => {
  const runs = await JobSyncRun.find({}).sort({ startedAt: -1 }).limit(20);
  res.set('Cache-Control', 'no-store');
  ok(res, { source: describeSource(), runs: runs.map((run) => run.toJSON()) });
});

export const runNow = asyncHandler(async (req, res) => {
  const result = await runSync({ trigger: 'manual', actorName: req.user.name, req });
  ok(res, result);
});

// Compares two strings in constant time (by their hashes, so the lengths
// do not leak either).
const same = (a, b) => timingSafeEqual(createHash('sha256').update(String(a)).digest(), createHash('sha256').update(String(b)).digest());

export const trigger = asyncHandler(async (req, res) => {
  // Off unless a token is set: the route then does not exist.
  if (!env.jobSync.token) throw notFound();
  const header = String(req.get('authorization') || '');
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!token || !same(token, env.jobSync.token)) throw unauthenticated('A valid sync token is required.');
  const result = await runSync({ trigger: 'endpoint', actorName: 'Scheduler' });
  // Counts only: no job content.
  ok(res, result.skipped ? result : { id: result.id, status: result.status, counts: result.counts, failure: result.failure || '', startedAt: result.startedAt, finishedAt: result.finishedAt });
});
