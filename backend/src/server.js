import { env, validateEnv, describeConfig } from './config/env.js';
import { connectDatabase, disconnectDatabase } from './config/db.js';
import { createApp } from './app.js';
import { logger } from './utils/logger.js';
import { startJobSyncSchedule } from './services/jobSync/scheduler.js';
import { Application, Candidate } from './models/index.js';
import { APPLICATION_STATUSES } from './config/constants.js';

/*
  Process entry point: validate configuration, connect to MongoDB,
  start listening, and shut down cleanly on SIGTERM (which is what
  Render sends on every deploy).
*/
// Applications saved before the workflow was reduced to NEW and
// SHORTLISTED keep their old status until the one-time migration has
// run. The server still starts; this says what to do.
async function warnAboutOldRecruitmentData() {
  try {
    const [applications, candidates] = await Promise.all([
      Application.countDocuments({ status: { $nin: APPLICATION_STATUSES } }),
      // Candidates no longer have a status; a stored one is left over.
      Candidate.countDocuments({ status: { $exists: true } }),
    ]);
    if (applications + candidates > 0) {
      logger.warn('migration.needed', { message: `${applications} applications and ${candidates} candidates still carry a status from the earlier workflow. Run "npm run migrate:recruitment" to see the change, then "npm run migrate:recruitment -- --apply".` });
    }
  } catch (error) {
    logger.warn('migration.check_failed', { error });
  }
}

async function main() {
  // NODE_ENV=test switches to in-memory storage and turns the rate
  // limits off. That is for the test runner, which never starts this
  // file; a server must not listen in that mode.
  if (env.isTest) {
    logger.error('config.invalid', { message: 'NODE_ENV=test is for the test suite only. Use development or production to run the server.' });
    process.exit(1);
  }
  const { problems, warnings } = validateEnv();
  warnings.forEach((message) => logger.warn('config.warning', { message }));
  if (problems.length) {
    problems.forEach((message) => logger.error('config.invalid', { message }));
    process.exit(1);
  }

  await connectDatabase();
  await warnAboutOldRecruitmentData();
  const app = createApp();
  const server = app.listen(env.port, () => {
    logger.info('server.listening', describeConfig());
    // The job sync on a schedule, when JOB_SYNC_INTERVAL_MINUTES asks for one.
    startJobSyncSchedule();
  });

  let closing = false;
  const shutdown = (signal) => {
    if (closing) return;
    closing = true;
    logger.info('server.shutdown', { signal });
    server.close(async () => {
      await disconnectDatabase().catch(() => {});
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

process.on('unhandledRejection', (reason) => {
  logger.error('process.unhandled_rejection', { error: reason instanceof Error ? reason : new Error(String(reason)) });
});

main().catch((error) => {
  logger.error('server.start_failed', { error });
  process.exit(1);
});
