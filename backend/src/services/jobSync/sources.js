import { fetchText, SourceError } from './fetchSource.js';

/*
  THE OFFICIAL JOB SOURCE ADAPTERS.

  Each adapter reads the configured source and returns
    { records, complete, errors }
  records   raw records in one common shape (normalize.js validates them)
  complete  true when the whole listing was read; only a complete read
            may count a job as missing from the source
  errors    [{ sourceJobId, message }] for pages that could not be read
  It throws a SourceError when the source itself cannot be read: then
  nothing is changed.

  json-feed     An API or feed that answers JSON: an array of jobs, or
                { "jobs": [...] }. The field names are listed in
                backend/docs/JOB-SYNC.md; common alternatives (id/jobId,
                url/applyUrl, ...) are accepted.
  jsonld-pages  The company's own job pages, read for the schema.org
                JobPosting data they carry (the structured data career
                sites publish for search engines). The configured URL is
                a listing page or an XML sitemap; job pages are followed
                on the same host only, and on a listing page only links
                matching JOB_SYNC_LINK_PATTERN.

  No other website is read: every address followed is on the host of the
  configured source.
*/

const MAX_PAGES = 200;

const first = (...values) => values.find((value) => value !== undefined && value !== null && value !== '');

// ------------------------------------------------------------ json-feed

function fromFeedItem(item) {
  const experience = item.experience && typeof item.experience === 'object' ? item.experience : {};
  return {
    sourceJobId: first(item.id, item.jobId, item.reference, item.requisitionId),
    title: first(item.title, item.name),
    description: first(item.description, item.descriptionHtml, item.body),
    summary: first(item.summary, item.shortDescription),
    location: Array.isArray(item.location) ? item.location.join(', ') : first(item.location, item.city),
    department: item.department,
    category: first(item.category, item.domain),
    employmentType: first(item.employmentType, item.type),
    experienceLevel: first(item.experienceLevel, item.seniority),
    minYears: first(item.minYears, experience.minYears),
    experience: typeof item.experience === 'string' ? item.experience : undefined,
    responsibilities: item.responsibilities,
    requiredSkills: first(item.requiredSkills, item.skills),
    preferredSkills: item.preferredSkills,
    status: first(item.status, item.state),
    validThrough: item.validThrough,
    sourceUrl: first(item.url, item.applyUrl, item.link),
    updatedAt: first(item.updatedAt, item.modifiedAt, item.dateModified),
  };
}

async function readJsonFeed(url) {
  const { text } = await fetchText(url, { accept: 'application/json' });
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new SourceError('The source did not answer with JSON.');
  }
  const items = Array.isArray(data) ? data : (Array.isArray(data?.jobs) ? data.jobs : null);
  if (!items) throw new SourceError('The JSON has no list of jobs (an array, or a "jobs" array).');
  return { records: items.filter((item) => item && typeof item === 'object').map(fromFeedItem), complete: true, errors: [] };
}

// ---------------------------------------------------------- jsonld-pages

// Every JobPosting in the JSON-LD blocks of a page, including those in
// @graph and ItemList wrappers.
export function jobPostingsIn(html) {
  const found = [];
  const visit = (node) => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) { node.forEach(visit); return; }
    const type = node['@type'];
    if (type === 'JobPosting' || (Array.isArray(type) && type.includes('JobPosting'))) found.push(node);
    visit(node['@graph']);
    visit(node.itemListElement);
    if (node.item) visit(node.item);
  };
  for (const match of String(html).matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try { visit(JSON.parse(match[1].trim())); } catch { /* a block that is not JSON is ignored */ }
  }
  return found;
}

const textOf = (value) => (value && typeof value === 'object' ? first(value.name, value.value, value['@value']) : value);

function placeOf(location) {
  const places = (Array.isArray(location) ? location : [location]).filter(Boolean).map((entry) => {
    const address = entry.address || entry;
    return [address.addressLocality, address.addressRegion, address.addressCountry && textOf(address.addressCountry)].filter(Boolean).join(', ');
  }).filter(Boolean);
  return places.join(' / ');
}

function fromJobPosting(posting, pageUrl) {
  const identifier = posting.identifier && typeof posting.identifier === 'object' ? posting.identifier.value : posting.identifier;
  const remote = posting.jobLocationType === 'TELECOMMUTE';
  const months = posting.experienceRequirements && typeof posting.experienceRequirements === 'object' ? posting.experienceRequirements.monthsOfExperience : undefined;
  return {
    sourceJobId: first(identifier, posting.url, pageUrl),
    title: posting.title,
    description: posting.description,
    location: [placeOf(posting.jobLocation), remote ? 'Remote' : ''].filter(Boolean).join(' / '),
    category: textOf(first(posting.occupationalCategory, posting.industry)),
    employmentType: posting.employmentType,
    minYears: months !== undefined ? Number(months) / 12 : undefined,
    experience: typeof posting.experienceRequirements === 'string' ? posting.experienceRequirements : undefined,
    responsibilities: posting.responsibilities,
    requiredSkills: posting.skills,
    validThrough: posting.validThrough,
    status: posting.jobStatus,
    sourceUrl: first(posting.url, pageUrl),
    updatedAt: first(posting.dateModified, posting.datePosted),
  };
}

const sameHost = (url, base) => {
  try { return new URL(url, base).host === new URL(base).host; } catch { return false; }
};

async function readJsonLdPages(url, { linkPattern = '' } = {}) {
  const listing = await fetchText(url, { accept: 'text/html,application/xml,text/xml' });
  const records = [];
  const errors = [];
  const pages = new Set();
  if (/<urlset[\s>]/i.test(listing.text)) {
    for (const match of listing.text.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)) {
      const address = match[1].replace(/&amp;/g, '&');
      if (sameHost(address, url) && (!linkPattern || new RegExp(linkPattern).test(address))) pages.add(address);
    }
  } else {
    for (const posting of jobPostingsIn(listing.text)) records.push(fromJobPosting(posting, listing.url));
    if (linkPattern) {
      const pattern = new RegExp(linkPattern);
      for (const match of listing.text.matchAll(/href=["']([^"'#]+)["']/gi)) {
        let address;
        try { address = new URL(match[1], listing.url).href; } catch { continue; }
        if (sameHost(address, url) && pattern.test(address)) pages.add(address);
      }
    }
  }
  let complete = true;
  if (pages.size > MAX_PAGES) {
    complete = false;
    errors.push({ sourceJobId: '', message: `The source lists ${pages.size} pages; only the first ${MAX_PAGES} are read.` });
  }
  for (const page of [...pages].slice(0, MAX_PAGES)) {
    try {
      const { text, url: finalUrl } = await fetchText(page, { accept: 'text/html' });
      const postings = jobPostingsIn(text);
      if (!postings.length) errors.push({ sourceJobId: page.slice(0, 200), message: 'The page has no JobPosting data.' });
      for (const posting of postings) records.push(fromJobPosting(posting, finalUrl));
    } catch (error) {
      // A page that cannot be read now may still exist: no job is
      // counted missing in this run.
      complete = false;
      errors.push({ sourceJobId: page.slice(0, 200), message: error instanceof SourceError ? error.message : 'The page could not be read.' });
    }
  }
  return { records, complete, errors };
}

export async function readSource({ type, url, linkPattern }) {
  if (type === 'json-feed') return readJsonFeed(url);
  if (type === 'jsonld-pages') return readJsonLdPages(url, { linkPattern });
  throw new SourceError(`Unknown source type "${type}".`);
}
