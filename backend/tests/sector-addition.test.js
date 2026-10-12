import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { startServer, stopServer, client, signedIn } from './helpers.js';

/*
  Adding the Wireless & Telecom sector to a database that was seeded
  before it existed (npm run add-sector -- wireless-telecom): one sector
  is inserted, published, after the others; no other sector changes;
  running it again does nothing.
*/

let ctx;
let addSector;
let planSectorAddition;
before(async () => {
  ctx = await startServer();
  ({ addSector, planSectorAddition } = await import('../src/services/sectorAddition.js'));
});
after(async () => { await stopServer(); });

const content = async () => JSON.parse(await readFile(new URL('../src/seed/data/content.json', import.meta.url), 'utf8'));
const strip = (doc) => { const { _id, __v, createdAt, updatedAt, ...rest } = doc; return { id: String(_id), ...rest, updatedAt: String(updatedAt) }; };

test('the seed content holds nine sectors, Wireless & Telecom ninth, with every field the sector pages show', async () => {
  const { expertise } = await content();
  assert.equal(expertise.length, 9);
  const sector = expertise.find((item) => item.key === 'wireless-telecom');
  assert.deepEqual([sector.num, sector.name, sector.slug, sector.status], ['09', 'Wireless & Telecom', 'wireless-telecom', 'published']);
  for (const field of ['desc', 'introduction', 'overview', 'shortName', 'relatedInsight']) assert.ok(sector[field], field);
  for (const field of ['domains', 'roles', 'hiringChallenges', 'processFlow', 'representativeSearches']) assert.ok(sector[field].length >= 3, field);
  assert.ok(sector.image.url.startsWith('https://images.pexels.com/') && sector.image.alt);
  assert.equal(new Set(expertise.map((item) => item.num)).size, 9, 'every sector has its own order number');
  assert.equal(new Set(expertise.map((item) => item.slug)).size, 9);
  assert.ok((await content()).insights.some((article) => article.slug === sector.relatedInsight), 'the related article exists');
});

test('plan: insert with its own order number; the next free one when that is taken; nothing when it exists', () => {
  const record = { key: 'wireless-telecom', slug: 'wireless-telecom', num: '09', name: 'Wireless & Telecom' };
  const eight = Array.from({ length: 8 }, (_, i) => ({ key: `s${i}`, slug: `s${i}`, num: `0${i + 1}`, name: `S${i}` }));
  assert.deepEqual(planSectorAddition(record, eight), { action: 'insert', record });
  assert.equal(planSectorAddition(record, [...eight, { key: 'x', slug: 'x', num: '09', name: 'X' }]).record.num, '10');
  assert.equal(planSectorAddition(record, [...eight, { key: 'x', slug: 'x', num: '12', name: 'X' }]).record.num, '09');
  assert.equal(planSectorAddition(record, [{ key: 'wireless-telecom', slug: 'other', num: '04', name: 'Own' }]).action, 'none');
  assert.equal(planSectorAddition(record, [{ key: 'other', slug: 'wireless-telecom', num: '04', name: 'Own' }]).action, 'none');
});

test('add-sector: a dry run changes nothing; --apply inserts the one sector and leaves the other eight exactly as they were', async () => {
  const { Expertise } = ctx.models;
  const { expertise } = await content();
  await Expertise.insertMany(expertise.filter((item) => item.key !== 'wireless-telecom'));
  // An admin edit made before the addition must survive it.
  await Expertise.updateOne({ key: 'mobility' }, { $set: { desc: 'Edited in the admin.' } });
  const before = (await Expertise.find({}).sort({ num: 1 }).lean()).map(strip);

  const dry = await addSector('wireless-telecom');
  assert.equal(dry.action, 'insert');
  assert.equal(await Expertise.countDocuments(), 8, 'the dry run inserted nothing');

  const done = await addSector('wireless-telecom', { apply: true });
  assert.equal(done.action, 'insert');
  const afterAll = (await Expertise.find({}).sort({ num: 1 }).lean()).map(strip);
  assert.equal(afterAll.length, 9);
  assert.deepEqual(afterAll.filter((item) => item.key !== 'wireless-telecom'), before, 'no other sector changed, the admin edit included');

  const again = await addSector('wireless-telecom', { apply: true });
  assert.equal(again.action, 'none');
  assert.equal(await Expertise.countDocuments(), 9, 'running it again adds nothing');

  // The website shows it, last, at its own address, and the sitemap lists it.
  const listed = (await client().get('/api/public/expertise')).body.data;
  assert.deepEqual(listed.map((item) => item.num), ['01', '02', '03', '04', '05', '06', '07', '08', '09']);
  const shown = listed[8];
  assert.deepEqual([shown.id, shown.name, shown.slug], ['wireless-telecom', 'Wireless & Telecom', 'wireless-telecom']);
  assert.equal(shown.roles.length, 9);
  const xml = (await client().get('/api/public/sitemap.xml', { origin: null, xhr: false })).body.toString('utf8');
  assert.ok(xml.includes('/expertise/wireless-telecom</loc>'));
  // The admin manages it like any other sector.
  const manager = await signedIn('CONTENT_MANAGER');
  const inAdmin = (await manager.get('/api/admin/expertise?limit=100')).body.data.find((item) => item.key === 'wireless-telecom');
  assert.ok(inAdmin, 'listed in Admin > Expertise');
  const edited = await manager.patch(`/api/admin/expertise/${inAdmin.id}`, { json: { desc: 'Edited in the admin.' } });
  assert.equal(edited.status, 200);
  assert.equal((await client().get('/api/public/expertise')).body.data[8].desc, 'Edited in the admin.');
});
