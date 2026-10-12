import { validateEnv } from '../src/config/env.js';
import { connectDatabase, disconnectDatabase } from '../src/config/db.js';
import { addSector } from '../src/services/sectorAddition.js';

/*
  Adds one expertise sector from the website content to an existing
  database, for a sector added after the database was seeded.

    npm run add-sector -- wireless-telecom            shows what would happen, changes nothing
    npm run add-sector -- wireless-telecom --apply    adds the sector

  The sector is created with its content from seed/data/content.json
  and appears on the website at once (it is published). What it does,
  and what it never does, is described in src/services/sectorAddition.js:
  it only ever inserts the one sector, never renumbers, edits or
  deletes another, and does nothing when the sector already exists.
  It is safe to run more than once. After it, the sector is edited in
  Admin > Expertise like any other.
*/

const args = process.argv.slice(2);
const apply = args.includes('--apply');
const key = args.find((arg) => !arg.startsWith('--'));

async function main() {
  if (!key) throw new Error('Name the sector: npm run add-sector -- <key>, for example wireless-telecom.');
  const { problems } = validateEnv();
  if (problems.length) throw new Error(`Fix the environment first:\n- ${problems.join('\n- ')}`);
  await connectDatabase();
  console.log(apply ? `Adding the sector "${key}".` : 'Dry run: nothing is changed. Add "--apply" to add the sector.');
  const plan = await addSector(key, { apply });
  if (plan.action === 'none') console.log(`\nNothing to do. ${plan.reason}\n`);
  else console.log(`\n${apply ? 'Added' : 'Would add'} "${plan.record.name}" at /expertise/${plan.record.slug}, order ${plan.record.num}, ${plan.record.status}. No other sector ${apply ? 'was' : 'would be'} changed.\n`);
}

main()
  .catch((error) => {
    console.error(`\nAdding the sector failed: ${error.message}\n`);
    process.exitCode = 1;
  })
  .finally(() => disconnectDatabase().catch(() => {}));
