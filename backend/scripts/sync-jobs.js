import { validateEnv } from '../src/config/env.js';
import { connectDatabase, disconnectDatabase } from '../src/config/db.js';
import { runSync } from '../src/services/jobSync/syncService.js';

/*
  npm run sync:jobs - one job synchronisation from the official job source
  (JOB_SYNC_SOURCE_URL), for an external scheduler (a cron job, a Render
  cron job, a CI schedule). Prints the run's counts as JSON. Exit code 1
  when the source could not be read, 2 when the environment is invalid.
*/
const { problems } = validateEnv();
if (problems.length) {
  console.error(`Fix the environment first:\n- ${problems.join('\n- ')}`);
  process.exit(2);
}
await connectDatabase();
try {
  const run = await runSync({ trigger: 'command', actorName: 'Command line' });
  console.log(JSON.stringify(run, null, 2));
  process.exitCode = run.status === 'FAILED' ? 1 : 0;
} finally {
  await disconnectDatabase();
}
