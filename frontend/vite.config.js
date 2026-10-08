import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import {
  PAGE_SEO, SEO_PATHS, DEFAULT_SITE_URL, SITE_NAME, DEFAULT_IMAGE, DEFAULT_IMAGE_ALT, absoluteFrom, fixedPageData,
} from './src/lib/seoPages.js';

// In development the frontend and the API run on different ports. The
// dev server forwards /api (and /media, the local development image
// store) to the backend, so the browser sees one origin: the session
// cookie is first-party and no CORS exception is needed. In
// production the host does the same forwarding (see
// docs/ALLSEMI-PRODUCTION-ARCHITECTURE.md).
const API_TARGET = process.env.VITE_DEV_API_TARGET || 'http://localhost:4000';

// The public address of the site (canonical addresses, sharing tags,
// robots.txt). The same value is read by src/lib/seo.js.
const SITE_URL = String(process.env.VITE_SITE_URL || DEFAULT_SITE_URL).replace(/\/+$/, '');

const attr = (text) => String(text).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// The <head> tags of one fixed page (src/lib/seoPages.js). `shell` is
// the generic copy served for every other address (a job, an article,
// an address that does not exist): no canonical address and no
// structured data, which the page then sets for itself in the browser.
function headFor(path, { shell = false } = {}) {
  const page = PAGE_SEO[path] || PAGE_SEO['/'];
  const url = absoluteFrom(SITE_URL, path);
  const image = absoluteFrom(SITE_URL, DEFAULT_IMAGE);
  const jsonLd = JSON.stringify({ '@context': 'https://schema.org', '@graph': fixedPageData(SITE_URL, path) }).replace(/</g, '\\u003c');
  const tags = [
    `<title>${attr(page.title)}</title>`,
    `<meta name="description" content="${attr(page.description)}" />`,
    shell ? '' : '<meta name="robots" content="index,follow" />',
    shell ? '' : `<link rel="canonical" href="${url}" />`,
    `<meta property="og:site_name" content="${SITE_NAME}" />`,
    '<meta property="og:type" content="website" />',
    `<meta property="og:title" content="${attr(page.title)}" />`,
    `<meta property="og:description" content="${attr(page.description)}" />`,
    shell ? '' : `<meta property="og:url" content="${url}" />`,
    `<meta property="og:image" content="${image}" />`,
    '<meta property="og:image:width" content="1200" />',
    '<meta property="og:image:height" content="630" />',
    `<meta property="og:image:alt" content="${attr(DEFAULT_IMAGE_ALT)}" />`,
    '<meta property="og:locale" content="en_US" />',
    '<meta name="twitter:card" content="summary_large_image" />',
    `<meta name="twitter:title" content="${attr(page.title)}" />`,
    `<meta name="twitter:description" content="${attr(page.description)}" />`,
    `<meta name="twitter:image" content="${image}" />`,
    shell ? '' : `<script type="application/ld+json" id="seo-jsonld">${jsonLd}</script>`,
  ].filter(Boolean);
  return `<!--seo:start-->\n  ${tags.join('\n  ')}\n  <!--seo:end-->`;
}

/*
  allsemis-seo - the head of every fixed page in the HTML itself, for
  crawlers and link previews that do not run JavaScript.

  index.html (the home page) gets the home page's head. The build also
  writes dist/seo/<page>.html for each other fixed page, dist/spa.html
  (the generic copy for every other address) and dist/robots.txt.
  frontend/vercel.json serves each fixed page from its own file and
  every other address from spa.html; the build stops if a fixed page
  has no rewrite there, so the two lists cannot drift apart.
*/
function seoPlugin() {
  let outDir = '';
  let building = false;
  return {
    name: 'allsemis-seo',
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir);
      building = config.command === 'build';
    },
    transformIndexHtml(html) {
      return html.replace('<!--seo-->', headFor('/'));
    },
    closeBundle() {
      if (!building) return;
      const vercel = JSON.parse(readFileSync(resolve(outDir, '..', 'vercel.json'), 'utf8'));
      const missing = SEO_PATHS.filter((path) => path !== '/' && !(vercel.rewrites || []).some((rule) => rule.source === path && rule.destination === `/seo${path}.html`));
      if (missing.length) throw new Error(`frontend/vercel.json has no rewrite for ${missing.join(', ')}. Add { "source": "<path>", "destination": "/seo<path>.html" } for each.`);

      const html = readFileSync(join(outDir, 'index.html'), 'utf8');
      const withHead = (head) => html.replace(/<!--seo:start-->[\s\S]*?<!--seo:end-->/, head);
      for (const path of SEO_PATHS) {
        if (path === '/') continue;
        const file = join(outDir, 'seo', `${path.slice(1)}.html`);
        mkdirSync(dirname(file), { recursive: true });
        writeFileSync(file, withHead(headFor(path)));
      }
      writeFileSync(join(outDir, 'spa.html'), withHead(headFor('/', { shell: true })));
      writeFileSync(join(outDir, 'robots.txt'), [
        'User-agent: *',
        'Allow: /',
        'Disallow: /admin',
        'Disallow: /api/',
        'Disallow: /seo/',
        '',
        `Sitemap: ${SITE_URL}/sitemap.xml`,
        '',
      ].join('\n'));
    },
  };
}

export default defineConfig({
  plugins: [react(), seoPlugin()],
  server: {
    host: true,   // lets you open the dev URL on your phone over LAN
    proxy: {
      '/api': { target: API_TARGET, changeOrigin: false },
      '/media': { target: API_TARGET, changeOrigin: false },
    },
  },
});
