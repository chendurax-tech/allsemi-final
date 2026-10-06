import { env, validateEnv } from '../config/env.js';
import { connectDatabase, disconnectDatabase } from '../config/db.js';
import { seedDatabase } from './seedData.js';
import { describeTarget } from './target.js';

/*
  DEVELOPMENT SEED  -  npm run seed [-- --reset]

  Fills an empty development database so the site and the admin can be
  used straight away. It is never the source of truth: once it has run,
  the database is, and nothing reads these files again.

  It creates the users and the website content and configuration
  (insights, stories, expertise, services, locations, contact details).
  It creates no job and no recruitment record: jobs, candidates,
  applications, requirements, referrals, enquiries and ATS results
  start empty. The fictional samples of those are only added with
    npm run seed -- --with-demo-recruitment-data
  which is meant for a throwaway database, never for one that is shown
  to a client.

  This file is the command line: it checks the environment, connects,
  runs seedDatabase() (seedData.js, which describes what is created)
  and prints the result.

  - Refuses to run when NODE_ENV=production.
  - Refuses to run against a database that is not on this machine,
    unless the database is named on the command line:
      npm run seed -- --database=<name>
    The name must match the one in MONGODB_URI. This is what stops a
    development .env that points at a shared or live cluster from
    being seeded, or emptied, by accident.
  - Refuses to run on a database that already has users, unless
    --reset is passed, in which case every collection is emptied first.
  - User passwords are taken from SEED_ADMIN_PASSWORD or generated, and
    printed once. They are never written to a file.
*/

const args = new Set(process.argv.slice(2));

function assertSafeTarget() {
  const target = describeTarget(env.mongodbUri);
  if (target.local) return;
  const named = [...args].find((arg) => arg.startsWith('--database='));
  const name = named ? named.slice('--database='.length) : '';
  if (!name || name !== target.database) {
    throw new Error(
      `MONGODB_URI points at a database that is not on this machine (${target.hosts.join(', ') || 'unknown host'}).\n`
      + 'The seed creates users and website content and, with --reset, deletes everything first.\n'
      + `If that is really intended, name the database to confirm: npm run seed -- --database=${target.database || '<name>'}${args.has('--reset') ? ' --reset' : ''}`,
    );
  }
}

async function main() {
  if (env.isProduction) throw new Error('The development seed does not run when NODE_ENV=production. Use "npm run create-admin" to create the first production user.');
  const { problems } = validateEnv();
  if (problems.length) throw new Error(`Fix the environment first:\n- ${problems.join('\n- ')}`);
  assertSafeTarget();

  await connectDatabase();
  const { counts, credentials } = await seedDatabase({ reset: args.has('--reset'), demoRecruitment: args.has('--with-demo-recruitment-data') });

  console.log('\nSeed complete.');
  console.table(counts);
  console.log('\nSign-in details for this development database (shown once, not stored anywhere):');
  console.table(credentials);
  console.log('Do not use these accounts or this seed in production.\n');
}

main()
  .catch((error) => {
    console.error(`\nSeed failed: ${error.message}\n`);
    process.exitCode = 1;
  })
  .finally(() => disconnectDatabase().catch(() => {}));
