import { readFile } from 'node:fs/promises';
import { Expertise } from '../models/index.js';

/*
  Adds an expertise sector that was added to the website content after
  a database was first seeded (scripts/add-sector.js), without touching
  any other sector.

  The sector's content is the record in seed/data/content.json, so a
  fresh development database (npm run seed) and an existing one end up
  with the same sector. Nothing else is read from that file.

  Rules:
  - A sector with the same key or the same slug already exists: nothing
    is done, so running it twice is safe and a sector the admin created
    by hand is never duplicated or overwritten.
  - Its order (num) is the one in content.json when no other sector has
    it; otherwise the next number after the highest one in use. No
    existing sector is renumbered.
  - Every other sector is left exactly as it is.
*/

export async function seedSector(key) {
  const content = JSON.parse(await readFile(new URL('../seed/data/content.json', import.meta.url), 'utf8'));
  const record = content.expertise.find((sector) => sector.key === key);
  if (!record) throw new Error(`There is no sector with the key "${key}" in seed/data/content.json.`);
  return record;
}

const pad = (n) => String(n).padStart(2, '0');

// What adding `record` to `existing` (the stored sectors) would do.
export function planSectorAddition(record, existing) {
  const clash = existing.find((sector) => sector.key === record.key || sector.slug === record.slug);
  if (clash) return { action: 'none', reason: `A sector with the ${clash.key === record.key ? 'key' : 'slug'} "${clash.key === record.key ? record.key : record.slug}" already exists ("${clash.name}").` };
  const used = new Set(existing.map((sector) => String(sector.num || '').trim()));
  let num = record.num;
  if (!num || used.has(num)) {
    const highest = existing.reduce((max, sector) => (/^\d+$/.test(String(sector.num || '')) ? Math.max(max, Number(sector.num)) : max), 0);
    num = pad(highest + 1);
  }
  return { action: 'insert', record: { ...record, num } };
}

export async function addSector(key, { apply = false } = {}) {
  const record = await seedSector(key);
  const existing = await Expertise.find({}).select('key slug num name').lean();
  const plan = planSectorAddition(record, existing);
  if (plan.action === 'insert' && apply) await Expertise.create(plan.record);
  return plan;
}
