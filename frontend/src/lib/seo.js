import { useEffect } from 'react';
import {
  DEFAULT_SITE_URL, SITE_NAME, DEFAULT_IMAGE, DEFAULT_IMAGE_ALT, PAGE_SEO,
  absoluteFrom, organizationData, breadcrumbData, fixedPageData,
} from './seoPages.js';

/*
  The <head> of each public page: title, meta description, canonical
  address, robots, Open Graph and Twitter tags, and structured data
  (JSON-LD).

  Each page calls useSeo() once with what it knows. One set of tags is
  kept and updated in place, so moving between pages never leaves a
  tag of the page before behind. The build writes the same tags into
  the HTML of the fixed pages (vite.config.js), so crawlers and link
  previews that do not run JavaScript read them too.

  The canonical address is always the clean public address of the
  page: the site address (VITE_SITE_URL), the path, no query, no
  trailing slash.
*/

export const SITE_URL = String((import.meta.env && import.meta.env.VITE_SITE_URL) || DEFAULT_SITE_URL).replace(/\/+$/, '');

export const absoluteUrl = (pathOrUrl = '/') => absoluteFrom(SITE_URL, pathOrUrl);

const ORG_ID = `${SITE_URL}/#organization`;
export const organizationJsonLd = () => organizationData(SITE_URL);
export const breadcrumbJsonLd = (trail) => breadcrumbData(SITE_URL, trail);

const escapeHtml = (text) => String(text || '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const EMPLOYMENT_TYPES = { 'Full-time': 'FULL_TIME', Contract: 'CONTRACTOR', 'Contract-to-hire': ['CONTRACTOR', 'FULL_TIME'] };

/*
  Where a job is, in schema.org terms, from its free-text location, or
  null when that cannot be told: "Remote (India)" is a remote job open
  to that country; "Bangalore, IN" or "Hybrid, Bangalore, IN" is a
  place. A location such as "Hybrid" alone names no place, and such a
  job gets no JobPosting data rather than an invented one.
*/
export function jobPlace(location) {
  const text = String(location || '').trim();
  const remote = text.match(/remote\s*\(([^)]+)\)/i);
  if (remote) return { jobLocationType: 'TELECOMMUTE', applicantLocationRequirements: { '@type': 'Country', name: remote[1].trim() } };
  const parts = text.replace(/\b(hybrid|on-?site)\b/ig, '').split(',').map((part) => part.trim()).filter(Boolean);
  if (parts.length < 2 || /remote/i.test(text)) return null;
  const address = { '@type': 'PostalAddress', addressLocality: parts[0], addressCountry: parts[parts.length - 1] };
  if (parts.length > 2) address.addressRegion = parts[1];
  return { jobLocation: { '@type': 'Place', address } };
}

/*
  JobPosting data for one published job (the public job API returns
  published jobs only), or null when a required part is missing. The
  hiring organisation is ALLSEMIS, which recruits for the role.
*/
export function jobPostingJsonLd(job) {
  if (!job || !job.title || !job.publishedAt) return null;
  const place = jobPlace(job.location);
  const body = [job.summary, job.description].filter(Boolean);
  if (!place || body.length === 0) return null;
  const list = (items) => (items && items.length ? `<ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>` : '');
  const description = [
    ...body.map((text) => `<p>${escapeHtml(text)}</p>`),
    job.responsibilities?.length ? `<p>Responsibilities:</p>${list(job.responsibilities)}` : '',
    job.requiredSkills?.length ? `<p>Required skills:</p>${list(job.requiredSkills)}` : '',
  ].join('');
  const skills = [...(job.requiredSkills || []), ...(job.preferredSkills || [])];
  return {
    '@type': 'JobPosting',
    title: job.title,
    description,
    datePosted: job.publishedAt,
    ...(EMPLOYMENT_TYPES[job.employmentType] ? { employmentType: EMPLOYMENT_TYPES[job.employmentType] } : {}),
    hiringOrganization: { '@type': 'Organization', name: SITE_NAME, sameAs: `${SITE_URL}/`, logo: absoluteUrl('/icons/favicon-512.png') },
    ...place,
    identifier: { '@type': 'PropertyValue', name: SITE_NAME, value: job.id || job.slug },
    url: absoluteUrl(`/talent/jobs/${job.slug}`),
    directApply: Boolean(job.applicationEnabled),
    ...(job.category ? { industry: job.category } : {}),
    ...(skills.length ? { skills: skills.join(', ') } : {}),
    ...(job.experienceLevel ? { qualifications: `Experience level: ${job.experienceLevel}` } : {}),
  };
}

// Article data for one published insight.
export function articleJsonLd(article) {
  if (!article || !article.title) return null;
  return {
    '@type': 'Article',
    headline: clip(article.title, 110),
    description: clip(article.seoDescription || article.excerpt, 300),
    ...(article.image ? { image: [absoluteUrl(article.image)] } : {}),
    ...(article.date ? { datePublished: article.date } : {}),
    author: article.author ? { '@type': /allsemis/i.test(article.author) ? 'Organization' : 'Person', name: article.author } : { '@id': ORG_ID },
    publisher: { '@id': ORG_ID },
    mainEntityOfPage: absoluteUrl(`/insights/${article.slug}`),
  };
}

// The tags this module owns. Each is found (or made) by its selector.
function metaTag(attr, key) {
  let el = document.head.querySelector(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  return el;
}
function setMeta(attr, key, value) {
  if (value === null || value === undefined || value === '') {
    document.head.querySelector(`meta[${attr}="${key}"]`)?.remove();
    return;
  }
  metaTag(attr, key).setAttribute('content', String(value));
}
function setCanonical(href) {
  let el = document.head.querySelector('link[rel="canonical"]');
  if (!href) {
    el?.remove();
    return;
  }
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', 'canonical');
    document.head.appendChild(el);
  }
  el.setAttribute('href', href);
}
function setJsonLd(items) {
  const graph = (items || []).filter(Boolean);
  let el = document.getElementById('seo-jsonld');
  if (graph.length === 0) {
    el?.remove();
    return;
  }
  if (!el) {
    el = document.createElement('script');
    el.type = 'application/ld+json';
    el.id = 'seo-jsonld';
    document.head.appendChild(el);
  }
  // "<" is escaped so no text can close the script element.
  el.textContent = JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }).replace(/</g, '\\u003c');
}

const clip = (text, max) => {
  const value = String(text || '').replace(/\s+/g, ' ').trim();
  return value.length > max ? `${value.slice(0, max - 1).replace(/\s+\S*$/, '')}…` : value;
};

/*
  applySeo - sets the head for one page.
    title, description   shown in search results (description clipped to 160)
    path                 the page's path; the canonical address is made from it
    robots               'index,follow' (default) or 'noindex' (a not-found state)
    type                 Open Graph type: 'website' (default) or 'article'
    image, imageAlt      the sharing image (default: the site image)
    jsonLd               structured data objects (without @context)
    article              { publishedTime, modifiedTime, author } for an article
*/
export function applySeo({ title, description, path, robots = 'index,follow', type = 'website', image, imageAlt, jsonLd = [], article = null }) {
  const noindex = /noindex/.test(robots);
  const pageTitle = title || PAGE_SEO['/'].title;
  const text = clip(description || PAGE_SEO['/'].description, 160);
  const url = noindex ? null : absoluteUrl(path || window.location.pathname);
  const picture = absoluteUrl(image || DEFAULT_IMAGE);

  document.title = pageTitle;
  setMeta('name', 'description', text);
  setMeta('name', 'robots', robots);
  setCanonical(url);
  setMeta('property', 'og:site_name', SITE_NAME);
  setMeta('property', 'og:type', type);
  setMeta('property', 'og:title', pageTitle);
  setMeta('property', 'og:description', text);
  setMeta('property', 'og:url', url || absoluteUrl(window.location.pathname));
  setMeta('property', 'og:image', picture);
  setMeta('property', 'og:image:alt', imageAlt || DEFAULT_IMAGE_ALT);
  setMeta('property', 'og:locale', 'en_US');
  setMeta('property', 'article:published_time', article?.publishedTime || null);
  setMeta('property', 'article:modified_time', article?.modifiedTime || null);
  setMeta('name', 'twitter:card', 'summary_large_image');
  setMeta('name', 'twitter:title', pageTitle);
  setMeta('name', 'twitter:description', text);
  setMeta('name', 'twitter:image', picture);
  setJsonLd(noindex ? [] : jsonLd);
}

// The head of one of the fixed pages (PAGE_SEO), with its breadcrumb.
export function fixedPageSeo(path) {
  const page = PAGE_SEO[path] || PAGE_SEO['/'];
  return { title: page.title, description: page.description, path, jsonLd: fixedPageData(SITE_URL, path) };
}

/*
  useSeo - applies a head while the page is shown. `meta` may be null
  while the page has nothing to say yet (still loading); the head of
  the address is then left as it is.
*/
export function useSeo(meta) {
  const key = meta ? JSON.stringify(meta) : '';
  useEffect(() => {
    if (key) applySeo(JSON.parse(key));
  }, [key]);
}
