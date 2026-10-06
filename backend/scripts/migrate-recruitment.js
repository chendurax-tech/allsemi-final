import { validateEnv } from '../src/config/env.js';
import { connectDatabase, disconnectDatabase } from '../src/config/db.js';
import { Application, Candidate } from '../src/models/index.js';
import { planApplication, planCandidate } from '../src/services/recruitmentMigration.js';

/*
  One-time migration to the simplified recruitment workflow.

    npm run migrate:recruitment              shows what would change, changes nothing
    npm run migrate:recruitment -- --apply   makes the changes

  What it does is described in src/services/recruitmentMigration.js:
  the old application statuses become NEW or SHORTLISTED plus a label,
  and the candidate status is removed (kept as a label where it was
  INTERVIEW, SELECTED or REJECTED). It sends no email and deletes no
  record. It is safe to run more than once.

  It reads and writes the stored documents directly, because the old
  values are no longer part of the models.

  A development database can be reseeded instead:
    npm run seed -- --reset
*/
const apply = process.argv.includes('--apply');

async function migrate(collection, plan, name) {
  const counts = {};
  let changed = 0;
  const documents = await collection.find({}, { projection: { status: 1, labels: 1, shortlist: 1 } }).toArray();
  for (const doc of documents) {
    const update = plan(doc);
    if (!update) continue;
    changed += 1;
    const from = Object.hasOwn(doc, 'status') ? String(doc.status) : '(no status)';
    const to = update.$set?.status || (update.$unset ? '(status removed)' : from);
    const key = `${from} -> ${to}${update.$set?.labels?.length ? ` + ${update.$set.labels.join(', ')}` : ''}`;
    counts[key] = (counts[key] || 0) + 1;
    if (apply) await collection.updateOne({ _id: doc._id }, update);
  }
  console.log(`\n${name}: ${documents.length} read, ${changed} ${apply ? 'changed' : 'would change'}`);
  for (const [key, count] of Object.entries(counts)) console.log(`  ${String(count).padStart(4)}  ${key}`);
}

async function main() {
  const { problems } = validateEnv();
  if (problems.length) throw new Error(`Fix the environment first:\n- ${problems.join('\n- ')}`);
  await connectDatabase();
  console.log(apply ? 'Applying the recruitment migration.' : 'Dry run: nothing is changed. Add "-- --apply" to make the changes.');
  await migrate(Application.collection, planApplication, 'Applications');
  await migrate(Candidate.collection, planCandidate, 'Candidates');
  console.log(apply ? '\nDone.\n' : '\nNothing was changed.\n');
}

main()
  .catch((error) => {
    console.error(`\nMigration failed: ${error.message}\n`);
    process.exitCode = 1;
  })
  .finally(() => disconnectDatabase().catch(() => {}));
