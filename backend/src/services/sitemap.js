import { env } from '../config/env.js';
import { Job, Insight, Expertise, Service } from '../models/index.js';

/*
  The XML sitemap of the public website: the canonical address of every
  page a search engine may index, and nothing else.

  Listed: the fixed pages, and the published sectors, services, articles
  and jobs, each at the address the website shows it on. Never listed:
  the admin, the API, drafts, unpublished or closed records, and
  anything about candidates, applications, ATS results, requirements,
  referrals or enquiries. Old sector addresses that redirect are not
  listed either: only the address they redirect to.

  The website serves it at /sitemap.xml (frontend/vercel.json forwards
  that address here). Addresses use PUBLIC_SITE_URL, or the first
  FRONTEND_URL when it is not set.
*/

const FIXED_PAGES = ['/', '/employers', '/talent', '/expertise', '/insights', '/about', '/contact', '/refer'];
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

const escapeXml = (text) => String(text).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]));
const day = (value) => {
  if (!value) return '';
  if (typeof value === 'string') return DAY.test(value) ? value : '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
};

export function siteUrl() {
  return String(env.publicSiteUrl || env.frontendUrls[0] || '').replace(/\/+$/, '');
}

export async function sitemapEntries() {
  const [sectors, services, insights, jobs] = await Promise.all([
    Expertise.find({ status: 'published' }).select('slug').sort({ num: 1 }).limit(200).lean(),
    Service.find({ status: 'published' }).select('slug').sort({ num: 1 }).limit(200).lean(),
    Insight.find({ status: 'published' }).select('slug date').sort({ date: -1 }).limit(1000).lean(),
    Job.find({ status: 'published' }).select('slug publishedAt updatedAt').sort({ publishedAt: -1 }).limit(2000).lean(),
  ]);
  const slugged = (list) => list.filter((item) => SLUG.test(String(item.slug || '')));
  return [
    ...FIXED_PAGES.map((path) => ({ path })),
    ...slugged(sectors).map((sector) => ({ path: `/expertise/${sector.slug}` })),
    ...slugged(services).map((service) => ({ path: `/employers/${service.slug}` })),
    ...slugged(insights).map((article) => ({ path: `/insights/${article.slug}`, lastmod: day(article.date) })),
    ...slugged(jobs).map((job) => ({ path: `/talent/jobs/${job.slug}`, lastmod: day(job.updatedAt || job.publishedAt) })),
  ];
}

export async function sitemapXml() {
  const base = siteUrl();
  const seen = new Set();
  const urls = [];
  for (const entry of await sitemapEntries()) {
    const loc = `${base}${entry.path === '/' ? '/' : entry.path}`;
    if (seen.has(loc)) continue;
    seen.add(loc);
    urls.push(`  <url><loc>${escapeXml(loc)}</loc>${entry.lastmod ? `<lastmod>${entry.lastmod}</lastmod>` : ''}</url>`);
  }
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`;
}
