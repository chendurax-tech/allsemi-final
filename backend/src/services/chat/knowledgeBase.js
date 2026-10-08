import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Service, Expertise, Location } from '../../models/index.js';
import { getSiteSettings } from '../settingsService.js';
import { CHAT_LIMITS } from '../../config/constants.js';

/*
  THE ALLSEMIS KNOWLEDGE THE PUBLIC ASSISTANT MAY STATE.

  Two sources, both official:
  - the knowledge file (src/knowledge/allsemi-knowledge.md): confirmed
    company copy and how the website really works, maintained as text;
  - the public content in the database, as the website shows it: the
    published services, the published expertise sectors, the active
    office and network locations and the contact details from Admin >
    Settings. These are read live (cached for a minute), so an edit in
    the admin reaches the assistant without a deploy.

  Retrieval is by words, not by embeddings: the knowledge is a few dozen
  short sections, which a word score ranks well and explains easily. A
  section is a candidate when it shares meaningful words with the
  question; the assistant answers from the best one.

  Nothing here is private: every section is information the public
  website already shows.
*/

const FILE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../knowledge/allsemi-knowledge.md');
const CACHE_MS = 60_000;

const STOP = new Set(['a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been', 'do', 'does', 'did', 'i', 'me', 'my', 'you', 'your', 'we', 'our', 'us', 'it', 'its', 'of', 'to', 'in', 'on', 'for', 'at', 'by', 'with', 'and', 'or', 'what', 'which', 'who', 'how', 'can', 'could', 'would', 'should', 'will', 'there', 'any', 'some', 'this', 'that', 'these', 'those', 'please', 'tell', 'about', 'give', 'show', 'have', 'has', 'from', 'as', 'if', 'so', 'than', 'then', 'into', 'also', 'just', 'get', 'know', 'want', 'need', 'like', 'more', 'info', 'information']);

// Words in a comparable form: lower case, letters and digits, a
// plural "s" dropped. "Openings" and "opening" are one word.
export function terms(text) {
  return String(text || '').toLowerCase().replace(/[^a-z0-9+#]+/g, ' ').split(' ')
    .filter((word) => word.length > 1 && !STOP.has(word))
    .map((word) => (word.length > 3 && word.endsWith('s') && !word.endsWith('ss') ? word.slice(0, -1) : word));
}

// ------------------------------------------------------------ the file

export function parseKnowledgeFile(text) {
  const sections = [];
  const body = String(text || '').replace(/<!--[\s\S]*?-->/g, '');
  for (const block of body.split(/^## /m).slice(1)) {
    const [head, ...rest] = block.split('\n');
    const [id, title] = head.split('|').map((part) => part.trim());
    let url = '';
    let keywords = '';
    const lines = [];
    for (const line of rest) {
      if (/^url:/i.test(line)) url = line.replace(/^url:/i, '').trim();
      else if (/^keywords:/i.test(line)) keywords = line.replace(/^keywords:/i, '').trim();
      else lines.push(line);
    }
    const content = lines.join('\n').trim();
    if (id && title && content) sections.push({ id: `kb:${id}`, title, url, keywords, text: content, source: 'knowledge' });
  }
  return sections;
}

let fileSections = null;
function knowledgeFile() {
  if (!fileSections) fileSections = parseKnowledgeFile(readFileSync(FILE, 'utf8'));
  return fileSections;
}

// ------------------------------------------------------ the database

const join = (items) => (items || []).filter(Boolean).join('; ');

async function databaseSections() {
  const [services, sectors, locations, settings] = await Promise.all([
    Service.find({ status: 'published' }).sort({ num: 1 }).limit(20),
    Expertise.find({ status: 'published' }).sort({ num: 1 }).limit(20),
    Location.find({ active: true }).sort({ createdAt: 1, _id: 1 }).limit(50),
    getSiteSettings(),
  ]);
  const sections = [];

  if (services.length) {
    sections.push({
      id: 'db:services',
      title: 'ALLSEMIS services',
      url: '/employers',
      keywords: 'services, offer, staffing, hire, hiring, employers, recruitment services, talent services',
      text: services.map((service) => `${service.name}: ${service.description}`).join('\n'),
      source: 'website',
    });
  }
  for (const service of services) {
    sections.push({
      id: `db:service:${service.slug}`,
      title: service.name,
      url: `/employers/${service.slug}`,
      keywords: `${service.name}, service, ${join(service.tags)}`,
      text: [service.description, service.lead, service.fit?.length ? `${service.fitTitle || 'A fit for'}: ${join(service.fit)}` : '', service.process?.length ? `${service.processTitle || 'Process'}: ${join(service.process)}` : '', service.receive?.length ? `${service.receiveTitle || 'You receive'}: ${join(service.receive)}` : '']
        .filter(Boolean).join('\n'),
      source: 'website',
    });
  }

  if (sectors.length) {
    sections.push({
      id: 'db:expertise',
      title: 'ALLSEMIS engineering expertise',
      url: '/expertise',
      keywords: 'expertise, sectors, industries, domains, industries served, specialisation, areas',
      text: `ALLSEMIS covers these engineering domains: ${sectors.map((sector) => sector.name).join('; ')}.`,
      source: 'website',
    });
  }
  for (const sector of sectors) {
    sections.push({
      id: `db:sector:${sector.slug}`,
      title: sector.name,
      url: `/expertise/${sector.slug}`,
      keywords: `${sector.name}, ${sector.shortName}, ${join(sector.domains)}, ${join(sector.roles)}`,
      text: [sector.desc, sector.introduction, sector.domains?.length ? `Domains: ${join(sector.domains)}` : '', sector.roles?.length ? `Roles recruited for: ${join(sector.roles)}` : '']
        .filter(Boolean).join('\n'),
      source: 'website',
    });
  }

  const offices = locations.filter((location) => location.type === 'office');
  const network = locations.filter((location) => location.type !== 'office');
  if (locations.length) {
    const officeLines = offices.map((office) => [
      `${office.label || office.city}${office.country ? `, ${office.country}` : ''}${office.isHeadquarters ? ' (headquarters)' : ''}${office.status === 'planned' ? ' (planned)' : ''}`,
      office.address?.length ? `Address: ${office.address.join(', ')}` : '',
      office.phone ? `Phone: ${office.phone}` : '',
      office.email ? `Email: ${office.email}` : '',
      office.hours?.length ? `Hours: ${office.hours.join('; ')}` : '',
    ].filter(Boolean).join('. '));
    const networkLine = network.length ? `Engineering network locations: ${network.map((node) => `${node.city}${node.country ? `, ${node.country}` : ''}${node.status === 'planned' ? ' (planned)' : ''}`).join('; ')}.` : '';
    sections.push({
      id: 'db:locations',
      title: 'ALLSEMIS locations',
      url: '/contact',
      keywords: 'locations, office, offices, where, based, address, city, country, headquarters, network, global',
      text: [officeLines.length ? `Offices:\n${officeLines.join('\n')}` : '', networkLine].filter(Boolean).join('\n'),
      source: 'website',
    });
  }

  const contact = settings?.contact || {};
  const contactLines = [
    contact.email ? `Email: ${contact.email}` : '',
    contact.phone ? `Phone: ${contact.phone}` : '',
    contact.address?.length ? `Address: ${contact.address.join(', ')}` : '',
    contact.hours?.length ? `Hours: ${contact.hours.join('; ')}` : '',
  ].filter(Boolean);
  sections.push({
    id: 'db:contact',
    title: 'Contacting ALLSEMIS',
    url: '/contact',
    keywords: 'contact, email, phone, call, reach, address, office hours, talk, enquiry, get in touch, recruitment team',
    text: `${contactLines.length ? `${contactLines.join('\n')}\n` : ''}The Contact page (/contact) has a form for hiring requirements, candidate profiles and general enquiries.`,
    source: 'website',
  });
  return sections;
}

let cached = { at: 0, sections: null };

/*
  allSections - every section, the file's and the database's. If the
  database cannot be read, the file's sections are still returned.
*/
export async function allSections({ fresh = false } = {}) {
  const file = knowledgeFile();
  if (!fresh && cached.sections && Date.now() - cached.at < CACHE_MS) return [...file, ...cached.sections];
  try {
    const sections = await databaseSections();
    cached = { at: Date.now(), sections };
    return [...file, ...sections];
  } catch {
    return cached.sections ? [...file, ...cached.sections] : file;
  }
}

// For the tests: drops the cached database sections.
export function clearKnowledgeCache() {
  cached = { at: 0, sections: null };
}

/*
  retrieve - the sections that best answer a question, best first.
  A word in the title or the keywords counts three times as much as a
  word in the text; rarer words count more than common ones. Sections
  that share no meaningful word with the question are not returned.
*/
export function rank(question, sections, { limit = CHAT_LIMITS.knowledgeChunks, prefer = [] } = {}) {
  const asked = [...new Set(terms(question))];
  if (!asked.length && !prefer.length) return [];
  const indexed = sections.map((section) => ({
    section,
    strong: terms(`${section.title} ${section.keywords}`),
    body: terms(section.text),
  }));
  const documents = indexed.length || 1;
  const idf = (word) => {
    const holding = indexed.filter((item) => item.strong.includes(word) || item.body.includes(word)).length;
    return Math.log(1 + documents / (1 + holding));
  };
  const scored = indexed.map((item) => {
    let score = 0;
    for (const word of asked) {
      const weight = idf(word);
      if (item.strong.includes(word)) score += 3 * weight;
      const inBody = item.body.filter((term) => term === word).length;
      if (inBody) score += Math.min(inBody, 3) * weight;
    }
    if (prefer.includes(item.section.id)) score += 100;
    return { section: item.section, score };
  });
  return scored.filter((item) => item.score > 0).sort((a, b) => b.score - a.score).slice(0, limit).map((item) => item.section);
}

export async function retrieve(question, options = {}) {
  return rank(question, await allSections(), options);
}
