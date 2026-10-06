import { env, validateEnv, describeConfig } from '../src/config/env.js';
import { connectDatabase, disconnectDatabase } from '../src/config/db.js';
import { describeTarget } from '../src/seed/target.js';
import {
  planShowcaseCleanup, applyShowcaseCleanup, inspectStoredFiles, removeUnreferencedFiles, countCollections,
  RECRUITMENT_COLLECTIONS, PRESERVED_COLLECTIONS,
} from '../src/services/showcaseCleanup.js';

/*
  Showcase cleanup: removes the demonstration recruitment data from a
  development or showcase database, and the files that belong to it.

    npm run clean:showcase
        Looks and reports. Changes nothing.

    npm run clean:showcase -- --apply
        Removes the demonstration records: what the development seed
        created and what was typed in with an example address.

    npm run clean:showcase -- --apply --all
        Removes every job, candidate, application, requirement,
        referral, enquiry and ATS result, whoever created it.

    --unreferenced-files   with --apply: also removes stored files that
                           no record points at
    --database=<name>      needed with --apply when MONGODB_URI points
                           at a database that is not on this machine;
                           the name must match the one in MONGODB_URI
    --list                 prints every record, not only the first few

  What is removed, what is kept and why is described in
  src/services/showcaseCleanup.js. Users, insights, stories, expertise,
  services, locations and the site settings are never touched. Nothing
  is created.

  It does not run when NODE_ENV=production.
*/
const args = process.argv.slice(2);
const has = (flag) => args.includes(flag);
const apply = has('--apply');
const all = has('--all');
const SHOWN = has('--list') ? Infinity : 8;

function assertSafeTarget() {
  if (!apply) return;
  const target = describeTarget(env.mongodbUri);
  if (target.local) return;
  const named = args.find((arg) => arg.startsWith('--database='));
  const name = named ? named.slice('--database='.length) : '';
  if (!name || name !== target.database) {
    throw new Error(
      `MONGODB_URI points at a database that is not on this machine (${target.hosts.join(', ') || 'unknown host'}).\n`
      + 'This command deletes records and files.\n'
      + `If that is intended, name the database to confirm: npm run clean:showcase -- --database=${target.database || '<name>'} --apply${all ? ' --all' : ''}`,
    );
  }
}

function printRecords(title, items) {
  if (items.length === 0) return;
  console.log(`  ${title}: ${items.length}`);
  for (const item of items.slice(0, SHOWN)) console.log(`    - ${item.label}  [${item.reason}]`);
  if (items.length > SHOWN) console.log(`    ... and ${items.length - SHOWN} more (add --list to see all)`);
}

function printPlan(plan) {
  for (const name of RECRUITMENT_COLLECTIONS) {
    const { total, remove, keep } = plan.collections[name];
    console.log(`\n${name}: ${total} in the database`);
    printRecords(apply ? 'removed' : 'would be removed', remove);
    printRecords('kept', keep);
  }
  console.log(`\nFiles of removed records: ${plan.files.remove.length}${apply ? '' : ' would be removed'} (${plan.files.keptWithRecords} file reference${plan.files.keptWithRecords === 1 ? '' : 's'} stay${plan.files.keptWithRecords === 1 ? "s" : ""} with kept records)`);
  console.log(`Audit entries about removed records: ${plan.audit.remove.length} of ${plan.audit.total}${apply ? '' : ' would be removed'}`);
}

async function printFiles(files) {
  console.log(`\nPrivate file store: ${files.stored} file${files.stored === 1 ? '' : 's'} stored, ${files.referenced} of them belonging to a record.`);
  if (files.unreferenced.length) {
    console.log(`  ${files.unreferenced.length} stored file${files.unreferenced.length === 1 ? ' belongs' : 's belong'} to no record:`);
    for (const file of files.unreferenced.slice(0, SHOWN)) console.log(`    - ${file.storage}: ${file.key}`);
    if (files.unreferenced.length > SHOWN) console.log(`    ... and ${files.unreferenced.length - SHOWN} more (add --list to see all)`);
  }
  if (files.unreachable) console.log(`  ${files.unreachable} record${files.unreachable === 1 ? ' points' : 's point'} at a file held by a provider this server no longer uses. Those files cannot be checked or removed from here.`);
}

async function main() {
  if (env.isProduction) throw new Error('The showcase cleanup does not run when NODE_ENV=production.');
  const { problems } = validateEnv();
  if (problems.length) throw new Error(`Fix the environment first:\n- ${problems.join('\n- ')}`);
  assertSafeTarget();

  await connectDatabase();
  const target = describeTarget(env.mongodbUri);
  console.log(`Database: ${target.database || '(default)'} on ${target.hosts.join(', ') || 'unknown host'}. Private files: ${describeConfig().fileStorage}.`);
  console.log(apply
    ? `Applying the showcase cleanup${all ? ' to EVERY record in the recruitment collections (--all)' : ' to the demonstration records'}.`
    : 'Dry run: nothing is changed. Add "-- --apply" to remove what is listed as "would be removed".');

  const before = await countCollections();
  const plan = await planShowcaseCleanup({ all });
  printPlan(plan);

  let done = null;
  if (apply) done = await applyShowcaseCleanup(plan, { actorName: 'Showcase cleanup' });

  let files = null;
  let listingProblem = '';
  try {
    files = await inspectStoredFiles();
    if (apply && has('--unreferenced-files') && files.unreferenced.length) {
      const result = await removeUnreferencedFiles(files.unreferenced);
      console.log(`\nRemoved ${result.removed} stored file${result.removed === 1 ? '' : 's'} that belonged to no record.${result.failed.length ? ` ${result.failed.length} could not be removed.` : ''}`);
      files = await inspectStoredFiles();
    }
    await printFiles(files);
  } catch (error) {
    listingProblem = error.message;
    console.log(`\nThe private file store could not be listed (${listingProblem}). The records were handled; check the store by hand.`);
  }

  const after = await countCollections();
  console.log(`\n${apply ? 'Records before and after' : 'Records now'}:`);
  console.table(Object.fromEntries(Object.keys(after).map((name) => [name, apply ? { before: before[name], after: after[name] } : { now: after[name] }])));

  if (!apply) {
    const kept = RECRUITMENT_COLLECTIONS.reduce((sum, name) => sum + plan.collections[name].keep.length, 0);
    if (kept && !all) console.log(`${kept} record${kept === 1 ? ' is' : 's are'} not recognised as demonstration data and would be kept. Look at the list above. To remove those too, add --all.`);
    console.log('Nothing was changed.\n');
    return;
  }

  console.log(`Removed: ${Object.entries(done.records).map(([name, count]) => `${name} ${count}`).join(', ')}.`);
  console.log(`Files removed: ${done.filesRemoved}. Audit entries removed: ${done.auditRemoved}.`);
  if (done.filesUnreachable) console.log(`${done.filesUnreachable} file${done.filesUnreachable === 1 ? ' is' : 's are'} held by a provider this server no longer uses and could not be removed from here. The record${done.filesUnreachable === 1 ? '' : 's'} that pointed at ${done.filesUnreachable === 1 ? 'it was' : 'them were'} removed.`);
  if (done.filesFailed.length) {
    console.log(`${done.filesFailed.length} file${done.filesFailed.length === 1 ? '' : 's'} could not be removed from the store:`);
    for (const file of done.filesFailed) console.log(`  - ${file.name}: ${file.reason}`);
  }
  const preservedChanged = PRESERVED_COLLECTIONS.filter((name) => before[name] !== after[name]);
  if (preservedChanged.length) throw new Error(`A preserved collection changed size: ${preservedChanged.join(', ')}. This should never happen.`);
  const left = RECRUITMENT_COLLECTIONS.filter((name) => after[name] > 0);
  if (left.length) console.log(`Still holding records that were not recognised as demonstration data: ${left.map((name) => `${name} ${after[name]}`).join(', ')}. Run again with --all to remove them as well.`);
  else console.log('Jobs, candidates, applications, requirements, referrals, enquiries and ATS results are empty.');
  if (files && files.unreferenced.length) console.log(`${files.unreferenced.length} stored file${files.unreferenced.length === 1 ? '' : 's'} belong${files.unreferenced.length === 1 ? 's' : ''} to no record. Run again with --apply --unreferenced-files to remove them.`);
  else if (files && files.stored === 0) console.log('The private file store is empty.');
  if (done.filesFailed.length || listingProblem) process.exitCode = 2;
  console.log('');
}

main()
  .catch((error) => {
    console.error(`\nShowcase cleanup failed: ${error.message}\n`);
    process.exitCode = 1;
  })
  .finally(() => disconnectDatabase().catch(() => {}));
