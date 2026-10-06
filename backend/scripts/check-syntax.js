import { readdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// npm run check - parses every source file with Node. A quick guard
// that needs no database and no extra tooling.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function files(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...await files(full));
    else if (entry.name.endsWith('.js')) out.push(full);
  }
  return out;
}

const targets = (await Promise.all(['src', 'scripts', 'tests'].map((dir) => files(path.join(root, dir)).catch(() => [])))).flat();
let failed = 0;
for (const file of targets) {
  const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  if (result.status !== 0) {
    failed += 1;
    console.error(result.stderr);
  }
}
console.log(`${targets.length - failed} of ${targets.length} files parse cleanly.`);
process.exit(failed ? 1 : 0);
