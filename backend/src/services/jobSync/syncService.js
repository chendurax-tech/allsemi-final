import { Job, JobSyncRun } from '../../models/index.js';
import { env } from '../../config/env.js';
import { uniqueSlug } from '../../controllers/crudFactory.js';
import { record as audit } from '../auditService.js';
import { logger } from '../../utils/logger.js';
import { readSource } from './sources.js';
import { SourceError } from './fetchSource.js';
import { normalizeRecord, fingerprint, RecordError } from './normalize.js';

/*
  JOB SYNCHRONISATION FROM THE OFFICIAL JOB SOURCE.

    official job source -> sync -> ALLSEMIS database -> public site,
                                                        assistant, ATS

  The official posting is the source of truth. One run:

  1. Reads the source (sources.js). If it cannot be read, nothing is
     changed: the run is recorded as FAILED and the next run retries.
  2. Validates every record (normalize.js). An invalid record is
     reported and skipped; the valid ones still sync.
  3. For each valid record, by its identity (source + sourceJobId):
     - new:       a job is created with the source's fields, the status
                  JOB_SYNC_NEW_STATUS (published by default) and a slug
                  from the title. A record that is already closed at the
                  source is not imported.
     - known:     the source fields are written if the official content
                  changed (by fingerprint); otherwise nothing but the
                  sync time changes. AI-derived data never overwrites
                  them: nothing derived is written here at all.
     - closed:    the job is archived (the existing "closed" state; the
                  public site and the assistant show published jobs
                  only). Applications are kept.
     - reopened:  a job this sync archived is published again when the
                  source lists it as open. A job staff archived
                  themselves is never reopened.
  4. Jobs of this source that the listing no longer contains are not
     deleted. Each complete, successful run that misses one counts it
     (MISSING); after JOB_SYNC_MISSING_THRESHOLD consecutive misses
     (2 by default) it is archived. A run that could not read the whole
     listing counts nobody missing, and neither does a listing that
     suddenly lacks most jobs (an empty or cut-off answer looks like
     that): it is recorded, and the jobs are left as they are.

  Running it again with the same source changes nothing (idempotent),
  and two runs at the same moment cannot both write (JobSyncRun lock).
  Each run is logged (JobSyncRun) and audited, with counts only.
*/

// The fields an imported job takes from the official source. Staff
// cannot edit them in the admin (controllers/resources.js); the sync
// writes them.
export const SOURCE_FIELDS = ['title', 'summary', 'description', 'location', 'department', 'category', 'employmentType', 'experienceLevel', 'responsibilities', 'requiredSkills', 'preferredSkills'];

const LEASE_MS = 15 * 60 * 1000;
const MAX_ERRORS = 50;

export function configuredSource() {
  const { sourceUrl, sourceType, sourceKey, sourceName, linkPattern } = env.jobSync;
  if (!sourceUrl) return null;
  return { url: sourceUrl, type: sourceType, key: sourceKey, name: sourceName, linkPattern };
}

async function acquireLock(source, trigger, actorName) {
  // A run that never finished (the server stopped mid-run) is released.
  await JobSyncRun.updateMany(
    { source: source.key, active: true, startedAt: { $lt: new Date(Date.now() - LEASE_MS) } },
    { $set: { active: false, status: 'FAILED', finishedAt: new Date(), failure: 'The run did not finish (interrupted).' } },
  );
  try {
    return await JobSyncRun.create({ source: source.key, sourceName: source.name, sourceUrl: source.url, trigger, triggeredByName: actorName, status: 'RUNNING', active: true, startedAt: new Date() });
  } catch (error) {
    if (error?.code === 11000) return null;
    throw error;
  }
}

const sameValue = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

async function createJob(source, item, now) {
  const status = env.jobSync.newStatus;
  const job = new Job({
    ...item.fields,
    slug: await uniqueSlug(Job, item.fields.title),
    status,
    publishedAt: status === 'published' ? now : null,
    source: source.key,
    sourceJobId: item.sourceJobId,
    sourceUrl: item.sourceUrl,
    sourceUpdatedAt: item.sourceUpdatedAt,
    sourceFingerprint: fingerprint(item.fields),
    lastSyncedAt: now,
    syncStatus: 'ACTIVE',
    missingCount: 0,
    closedBySync: false,
  });
  await job.save();
  return job;
}

/*
  applyRecord - one validated record against the database. Returns what
  happened, as a list: created; or any of updated, closed, reopened; or
  unchanged. Empty for a closed record that was never imported.
*/
async function applyRecord(source, item, now) {
  let job = await Job.findOne({ source: source.key, sourceJobId: item.sourceJobId });
  if (!job) {
    if (item.status === 'closed') return [];
    try {
      await createJob(source, item, now);
      return ['created'];
    } catch (error) {
      // Another run created it a moment ago: carry on as an update.
      if (error?.code !== 11000 || !(await Job.exists({ source: source.key, sourceJobId: item.sourceJobId }))) throw error;
      job = await Job.findOne({ source: source.key, sourceJobId: item.sourceJobId });
    }
  }
  const outcomes = [];
  const print = fingerprint(item.fields);
  if (print !== job.sourceFingerprint) {
    for (const field of SOURCE_FIELDS) if (!sameValue(job[field], item.fields[field])) job.set(field, item.fields[field]);
    job.sourceFingerprint = print;
    outcomes.push('updated');
  }
  if (item.sourceUrl && item.sourceUrl !== job.sourceUrl) job.sourceUrl = item.sourceUrl;
  if (item.sourceUpdatedAt) job.sourceUpdatedAt = item.sourceUpdatedAt;
  job.lastSyncedAt = now;
  job.missingCount = 0;
  if (item.status === 'closed') {
    if (job.status !== 'archived') {
      job.status = 'archived';
      job.closedBySync = true;
      outcomes.push('closed');
    }
    job.syncStatus = 'CLOSED';
  } else {
    if (job.status === 'archived' && job.closedBySync) {
      job.status = 'published';
      if (!job.publishedAt) job.publishedAt = now;
      job.closedBySync = false;
      outcomes.push('reopened');
    }
    job.syncStatus = 'ACTIVE';
  }
  await job.save();
  return outcomes.length ? outcomes : ['unchanged'];
}

/*
  reconcileMissing - the jobs of this source that the listing did not
  contain. See point 4 at the top of this file.
*/
async function reconcileMissing(source, seen, now, run) {
  const tracked = await Job.find({ source: source.key, sourceJobId: { $type: 'string' }, syncStatus: { $in: ['ACTIVE', 'MISSING'] } });
  const absent = tracked.filter((job) => !seen.has(job.sourceJobId));
  if (!absent.length) return;
  const guard = Math.max(3, Math.ceil(tracked.length / 2));
  if (seen.size === 0 || absent.length > guard) {
    run.notes.push(`${absent.length} of ${tracked.length} imported jobs were not in the listing. That is too many at once to be trusted (an empty or cut-off answer), so none was counted missing.`);
    return;
  }
  for (const job of absent) {
    job.missingCount = (job.missingCount || 0) + 1;
    if (job.missingCount >= env.jobSync.missingThreshold) {
      if (job.status !== 'archived') {
        job.status = 'archived';
        job.closedBySync = true;
      }
      job.syncStatus = 'CLOSED';
      run.counts.closed += 1;
    } else {
      job.syncStatus = 'MISSING';
      run.counts.missing += 1;
    }
    await job.save();
  }
}

/*
  runSync - one synchronisation run. Returns the run record (JSON), or
  { skipped: true, reason } when no source is configured or a run is
  already in progress. Never throws for a source problem: that is a
  FAILED run.
*/
export async function runSync({ trigger = 'manual', actorName = 'System', req = null, source = configuredSource() } = {}) {
  if (!source) return { skipped: true, reason: 'No job source is configured (JOB_SYNC_SOURCE_URL).' };
  const run = await acquireLock(source, trigger, actorName);
  if (!run) return { skipped: true, reason: 'A synchronisation of this source is already running.' };
  const now = new Date();
  logger.info('jobs.sync_started', { source: source.key, trigger });

  let listing;
  try {
    listing = await readSource(source);
  } catch (error) {
    run.status = 'FAILED';
    run.failure = error instanceof SourceError ? error.message : 'The source could not be read.';
    if (!(error instanceof SourceError)) logger.error('jobs.sync_read_failed', { source: source.key, errorName: error?.name || 'Error' });
    return finish(run, { req, source });
  }

  const addError = (sourceJobId, message) => {
    if (run.errors.length < MAX_ERRORS) run.errors.push({ sourceJobId: String(sourceJobId || '').slice(0, 200), message: String(message).slice(0, 300) });
  };
  listing.errors.forEach((error) => addError(error.sourceJobId, error.message));

  const seen = new Set();
  run.counts.discovered = listing.records.length;
  for (const raw of listing.records) {
    let item;
    try {
      item = normalizeRecord(raw);
    } catch (error) {
      run.counts.invalid += 1;
      addError(error instanceof RecordError ? error.sourceJobId : '', error.message);
      continue;
    }
    if (seen.has(item.sourceJobId)) {
      run.counts.invalid += 1;
      addError(item.sourceJobId, 'The same job id is listed more than once; the first was used.');
      continue;
    }
    seen.add(item.sourceJobId);
    try {
      for (const outcome of await applyRecord(source, item, now)) run.counts[outcome] += 1;
    } catch (error) {
      run.counts.invalid += 1;
      addError(item.sourceJobId, error?.name === 'ValidationError' ? 'The job could not be saved: a field is not valid.' : 'The job could not be saved.');
      logger.error('jobs.sync_record_failed', { source: source.key, sourceJobId: item.sourceJobId, errorName: error?.name || 'Error' });
    }
  }

  if (listing.complete) await reconcileMissing(source, seen, now, run);
  else run.notes.push('The listing could not be read completely, so no job was counted missing in this run.');

  run.status = run.errors.length ? 'PARTIAL' : 'SUCCEEDED';
  return finish(run, { req, source });
}

async function finish(run, { req, source }) {
  run.active = false;
  run.finishedAt = new Date();
  await run.save();
  const { counts } = run;
  logger.info('jobs.sync_finished', { source: source.key, status: run.status, ...counts.toObject?.() ?? counts, errors: run.errors.length, failure: run.failure || undefined });
  await audit({
    req,
    user: req?.user || null,
    action: run.status === 'FAILED' ? 'jobs.sync_failed' : 'jobs.synced',
    entityType: 'jobSync',
    entityId: run._id,
    summary: run.status === 'FAILED'
      ? `Job sync from ${source.name} failed: ${run.failure}`
      : `Job sync from ${source.name}: ${counts.created} new, ${counts.updated} updated, ${counts.closed} closed, ${counts.reopened} reopened, ${counts.unchanged} unchanged${counts.invalid ? `, ${counts.invalid} invalid` : ''}`,
    metadata: { source: source.key, trigger: run.trigger, status: run.status, ...JSON.parse(JSON.stringify(counts)) },
  });
  return run.toJSON();
}

// Whether a job's official fields are owned by the source.
export const isImported = (job) => Boolean(job && job.sourceJobId && job.source && job.source !== 'manual');
