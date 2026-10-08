import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer, stopServer, client } from './helpers.js';

/*
  The sitemap of the public website (GET /api/public/sitemap.xml, served
  by the website at /sitemap.xml): only canonical public addresses of
  published records, never the admin, the API or anything private.
*/

let ctx;
before(async () => { ctx = await startServer(); });
after(async () => { await stopServer(); });

const SITE = 'http://localhost:5173';
const locs = (xml) => [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);

test('sitemap: the fixed pages and every published sector, service, article and job, and nothing else', async () => {
  const { Job, Insight, Expertise, Service, Candidate } = ctx.models;
  await Expertise.create([
    { key: 'semi', num: '01', name: 'Semiconductor & Chip Engineering', slug: 'semiconductor-chip-engineering', status: 'published' },
    { key: 'hidden', num: '09', name: 'Hidden sector', slug: 'hidden-sector', status: 'draft' },
  ]);
  await Service.create([
    { num: '01', name: 'Permanent Staffing', slug: 'permanent-staffing', status: 'published' },
    { num: '04', name: 'Draft service', slug: 'draft-service', status: 'draft' },
  ]);
  await Insight.create([
    { title: 'Hiring VLSI engineers', slug: 'hiring-vlsi-engineers', status: 'published', date: '2026-09-24' },
    { title: 'Unfinished', slug: 'unfinished-article', status: 'draft', date: '2026-09-25' },
  ]);
  const base = { category: 'Semiconductor', location: 'Bangalore, IN', experienceLevel: 'Mid-Level', description: 'Own the testbench.' };
  await Job.create([
    { ...base, title: 'Design Verification Engineer', slug: 'design-verification-engineer', status: 'published', publishedAt: new Date('2026-09-20') },
    { ...base, title: 'Draft role', slug: 'draft-role', status: 'draft' },
    { ...base, title: 'Archived role', slug: 'archived-role', status: 'archived' },
  ]);
  await Candidate.create({ name: 'Private Person', email: 'private.person@example.com' });

  const response = await client().get('/api/public/sitemap.xml', { origin: null, xhr: false });
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /application\/xml/);
  const xml = response.body.toString('utf8');
  assert.match(xml, /^<\?xml version="1\.0" encoding="UTF-8"\?>\n<urlset xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9">/);

  assert.deepEqual(locs(xml), [
    `${SITE}/`, `${SITE}/employers`, `${SITE}/talent`, `${SITE}/expertise`, `${SITE}/insights`, `${SITE}/about`, `${SITE}/contact`, `${SITE}/refer`,
    `${SITE}/expertise/semiconductor-chip-engineering`,
    `${SITE}/employers/permanent-staffing`,
    `${SITE}/insights/hiring-vlsi-engineers`,
    `${SITE}/talent/jobs/design-verification-engineer`,
  ]);
  assert.ok(xml.includes('<loc>http://localhost:5173/insights/hiring-vlsi-engineers</loc><lastmod>2026-09-24</lastmod>'));
  assert.ok(!/admin|\/api\/|draft|archived|hidden|private|candidate|ats|referral|enquir|requirement/i.test(locs(xml).join(' ')), 'nothing private, draft or archived');
  assert.ok(!locs(xml).some((loc) => loc !== `${SITE}/` && loc.endsWith('/')), 'no trailing slashes');
});
