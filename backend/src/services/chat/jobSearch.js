import { listPublishedJobs } from '../publicJobs.js';
import { normaliseSkill } from '../resume/skillTaxonomy.js';
import { terms } from './knowledgeBase.js';
import { CHAT_LIMITS } from '../../config/constants.js';

/*
  JOB SEARCH FOR THE PUBLIC ASSISTANT.

  Every answer about openings comes from the published jobs in the
  database (services/publicJobs.js: the same list and the same fields as
  the Talent page). A draft or archived job is never read, and no
  internal field leaves this module: a job leaves it only as a card for
  the website.

  A question is read for:
    a location   a place one of the published jobs is in ("Chennai",
                 "remote"; Bangalore and Bengaluru are one place)
    a level      "fresher", "entry level", "senior", ...
    topics       the remaining meaningful words, widened by a few
                 domain words ("VLSI" also means semiconductor, RTL,
                 verification, ...) and by the skill taxonomy
  A job matches when it is in the location and at the level asked for
  (when asked) and shares a topic with the question (when there is one).
*/

// Words that only say "a job" and narrow nothing.
const JOB_WORDS = new Set(['job', 'jobs', 'opening', 'openings', 'role', 'roles', 'position', 'positions', 'vacancy', 'vacancie', 'vacancies', 'opportunity', 'opportunitie', 'opportunities', 'career', 'careers', 'hiring', 'hire', 'current', 'currently', 'available', 'open', 'list', 'all', 'now', 'today', 'latest', 'new', 'apply', 'work', 'working', 'see', 'find', 'search', 'looking', 'look', 'allsemi', 'allsemis', 'company', 'here', 'yours', 'offer', 'offering', 'post', 'posted', 'recruiting', 'field', 'area', 'related', 'kind', 'type', 'fresher', 'freshers', 'graduate', 'graduates', 'entry', 'level', 'junior', 'senior', 'mid', 'lead', 'principal', 'experienced', 'experience', 'year', 'years', 'location', 'located', 'city', 'based', 'india', 'remote', 'hybrid', 'onsite', 'site', 'ones', 'one', 'other', 'else', 'accept', 'accepting', 'allow', 'take', 'suitable', 'eligible', 'good', 'best', 'match', 'matching', 'require', 'requiring', 'required', 'similar', 'them', 'these', 'those', 'interested', 'role?', 'openings?']);
// Words that mean "engineering in general" here: every ALLSEMIS role is
// an engineering role, so they do not narrow the list.
const BROAD_WORDS = new Set(['engineering', 'engineer', 'engineers', 'technical', 'tech', 'technology']);

// A few domain words visitors use that the job texts may not.
const WIDEN = {
  vlsi: ['vlsi', 'semiconductor', 'asic', 'rtl', 'soc', 'chip', 'silicon', 'verification', 'dft', 'physical design', 'analog'],
  chip: ['chip', 'semiconductor', 'vlsi', 'asic', 'silicon', 'soc'],
  semiconductor: ['semiconductor', 'vlsi', 'chip', 'silicon', 'asic'],
  hardware: ['hardware', 'semiconductor', 'vlsi', 'embedded', 'electronics', 'fpga'],
  embedded: ['embedded', 'firmware', 'rtos', 'microcontroller', 'autosar'],
  firmware: ['firmware', 'embedded'],
  automotive: ['automotive', 'adas', 'autosar', 'iso 26262', 'mobility', 'vehicle'],
  aerospace: ['aerospace', 'avionics', 'satellite'],
  software: ['software', 'developer', 'programming', 'python', 'java', 'c++'],
  developer: ['developer', 'software', 'programming'],
  ai: ['ai', 'machine learning', 'ml', 'cloud', 'data'],
  ml: ['machine learning', 'ml', 'ai'],
  cloud: ['cloud', 'infrastructure', 'platform', 'devops'],
  verification: ['verification', 'uvm', 'systemverilog', 'dv'],
  design: ['design'],
  dft: ['dft', 'scan', 'atpg', 'mbist'],
  analog: ['analog', 'mixed-signal', 'mixed signal'],
};

const LEVELS = [
  { words: ['fresher', 'freshers', 'graduate', 'graduates', 'entry', 'junior', 'intern', 'internship', 'beginner', 'trainee'], level: 'Entry-Level', label: 'entry level / freshers' },
  { words: ['senior', 'experienced'], level: 'Senior', label: 'senior' },
  { words: ['lead', 'principal', 'staff'], level: 'Lead / Principal', label: 'lead / principal' },
  { words: ['mid'], level: 'Mid-Level', label: 'mid level' },
];

const placeKey = (text) => String(text || '').toLowerCase().replace(/bengaluru/g, 'bangalore').replace(/[^a-z ]+/g, ' ').trim();
const lower = (text) => String(text || '').toLowerCase();

// The place words of the published jobs' locations ("bangalore",
// "chennai", "remote").
function placeWords(jobs) {
  const words = new Set();
  for (const job of jobs) {
    for (const word of placeKey(job.location).split(/\s+/)) {
      if (word.length > 2 && !['in', 'india', 'the'].includes(word)) words.add(word);
    }
  }
  return words;
}

// Where a word is found decides how much it counts: in the title or the
// required skills most, then the category, preferred skills and
// keywords, then the description.
function jobText(job) {
  return {
    core: lower([job.title, ...(job.requiredSkills || [])].join(' | ')),
    strong: lower([job.category, job.department, ...(job.preferredSkills || []), ...(job.keywords || [])].join(' | ')),
    weak: lower([job.summary, (job.description || '').slice(0, 800), ...(job.responsibilities || [])].join(' | ')),
  };
}

const contains = (haystack, needle) => new RegExp(`(?<![a-z0-9+#])${needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![a-z0-9+#])`).test(haystack);

/*
  readQuery - what a question asks for: { location, level, topics }.
  `topics` is a list of word groups; a job matches a group when it
  holds any word of it.
*/
export function readQuery(question, jobs = []) {
  const words = terms(question);
  const raw = lower(question);
  const places = placeWords(jobs);
  let location = null;
  for (const word of placeKey(question).split(/\s+/)) {
    if (places.has(word)) { location = word; break; }
  }
  if (!location && /\bremote\b/.test(raw)) location = 'remote';
  if (!location && /\bhybrid\b/.test(raw)) location = 'hybrid';

  let level = null;
  for (const option of LEVELS) {
    if (option.words.some((word) => new RegExp(`\\b${word}\\b`).test(raw))) { level = option; break; }
  }
  if (!level && /\b0\s*(?:-|to)\s*[12]\s*(?:years?|yrs?)\b|\bno experience\b/.test(raw)) level = LEVELS[0];

  const topics = [];
  const seen = new Set();
  for (const word of words) {
    const place = placeKey(word);
    if (JOB_WORDS.has(word) || BROAD_WORDS.has(word) || place === location || places.has(place) || /^\d+$/.test(word)) continue;
    if (seen.has(word)) continue;
    seen.add(word);
    const exact = new Set([word]);
    const skill = normaliseSkill(word);
    if (skill) exact.add(skill.toLowerCase());
    topics.push({ word, any: [...new Set([...exact, ...(WIDEN[word] || [])])], exact: [...exact] });
  }
  return { location, level, topics };
}

function score(job, query) {
  const text = jobText(job);
  let total = 0;
  for (const topic of query.topics) {
    if (topic.any.some((needle) => contains(text.core, needle))) total += 4;
    else if (topic.any.some((needle) => contains(text.strong, needle))) total += 2;
    // In the description only the word itself counts, not the words it
    // was widened with: "verification" in a medical-device description
    // is not a VLSI role.
    else if (topic.exact.some((needle) => contains(text.weak, needle))) total += 1;
  }
  return total;
}

function inLocation(job, location) {
  return !location || placeKey(job.location).split(/\s+/).includes(location);
}

function atLevel(job, level) {
  return !level || job.experienceLevel === level.level;
}

/*
  searchJobs - the published jobs that answer a question, best first.
  Returns { jobs, query, total } where total is how many jobs are
  published at all. `among` limits the search to those jobs (a
  follow-up such as "which of these accept freshers?").
*/
export async function searchJobs(question, { among = null } = {}) {
  const published = await listPublishedJobs();
  const pool = among ? published.filter((job) => among.includes(job.id)) : published;
  const query = readQuery(question, published);
  const ranked = pool
    .filter((job) => inLocation(job, query.location) && atLevel(job, query.level))
    .map((job) => ({ job, points: score(job, query) }))
    .filter((item) => !query.topics.length || item.points > 0)
    .sort((a, b) => b.points - a.points);
  return { jobs: ranked.map((item) => item.job), query, total: published.length, published };
}

/*
  findNamedJob - the published job a question names by its title
  ("requirements for the Physical Design Engineer role"), or null. A
  title counts as named when most of its words are in the question.
*/
export function findNamedJob(question, jobs) {
  const asked = new Set(terms(question));
  let best = null;
  for (const job of jobs) {
    const title = [...new Set(terms(job.title))];
    if (!title.length) continue;
    const found = title.filter((word) => asked.has(word)).length;
    const share = found / title.length;
    if ((found >= 2 && share >= 0.66) || (title.length === 1 && found === 1)) {
      if (!best || share > best.share || (share === best.share && found > best.found)) best = { job, share, found };
    }
  }
  return best ? best.job : null;
}

// ------------------------------------------------------------- shapes

const cut = (text, max) => {
  const value = String(text || '').replace(/\s+/g, ' ').trim();
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
};

// A job as a card for the website. Links are the website's own pages:
// the job page, and the same page with its application form opened.
export function jobCard(job) {
  return {
    id: job.id,
    title: job.title,
    location: job.location || '',
    experienceLevel: job.experienceLevel || '',
    employmentType: job.employmentType || '',
    category: job.category || '',
    summary: cut(job.summary || job.description, 200),
    skills: [...(job.requiredSkills || [])].slice(0, 6),
    applicationEnabled: Boolean(job.applicationEnabled),
    url: `/talent/jobs/${encodeURIComponent(job.slug)}`,
    applyUrl: job.applicationEnabled ? `/talent/jobs/${encodeURIComponent(job.slug)}?apply=1` : null,
  };
}

