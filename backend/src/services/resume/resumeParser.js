import { createSkillMatcher, skillKey } from './skillTaxonomy.js';

/*
  RESUME PARSER.

  Turns the text of a resume (services/resume/textExtractor.js) into a
  DRAFT candidate profile, by rules only: section headings, patterns
  for contact details and dates, and the skill taxonomy
  (skillTaxonomy.js). No AI model is involved and nothing is sent
  anywhere.

  The draft is a suggestion for a recruiter, never a record. This file
  reads text and returns data: it touches no database, no request and
  no candidate. A recruiter reviews the draft and decides what, if
  anything, goes onto the candidate profile.

  What it will not do: guess. A field that cannot be read with some
  confidence is left empty and a warning says so. Every value carries
  a confidence level and, where practical, the line of the resume it
  was read from (`evidence`), so the recruiter can check it.

  Confidence:
    high    read from a labelled line or a clear structure ("Email:",
            a skills section, a dated job with a title and an employer)
    medium  read from a usual position or pattern that is not certain
            (a name in the first lines, a skill in a sentence)
    low     read, but the structure was unclear: check it
    null    nothing was read

  parseResume(text, { now, extraSkills }) returns
    { parserVersion, fields, sections, warnings }
  fields: name, email, phone, location, headline, skills,
          experienceYears, experience, education, qualifications,
          projects. Each is { value, confidence, evidence } with a few
  field-specific additions (see the end of this file).
*/

export const PARSER_VERSION = '1';

const LIMITS = {
  evidence: 200,
  evidenceItems: 3,
  highlight: 300,
  highlightsPerEntry: 8,
  experienceEntries: 15,
  educationEntries: 8,
  projects: 12,
  qualifications: 15,
  qualification: 200,
  unrecognisedSkills: 40,
  headerLines: 15,
};

const HIGH = 'high';
const MEDIUM = 'medium';
const LOW = 'low';

// --------------------------------------------------------------- lines

const BULLET = /^\s*(?:[•●○◦▪■□►▶➢➤✓✔✗*·‣⁃»]|[-–—](?=\s))\s*/;
const NUMBERED = /^\s*\(?\d{1,2}[.)]\s+/;

const isBullet = (text) => BULLET.test(text);
const stripBullet = (text) => text.replace(BULLET, '').replace(NUMBERED, '').trim();
const words = (text) => text.split(/\s+/).filter(Boolean);
const snippet = (text) => (text.length > LIMITS.evidence ? `${text.slice(0, LIMITS.evidence - 1)}…` : text);

function toLines(text) {
  return String(text || '')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .map((line, index) => ({ text: line, index }));
}

// ------------------------------------------------------------ sections

const HEADINGS = {
  summary: ['summary', 'professional summary', 'career summary', 'profile', 'professional profile', 'profile summary', 'career objective', 'objective', 'about me', 'overview', 'executive summary', 'career profile', 'personal statement', 'summary of qualifications'],
  skills: ['skills', 'technical skills', 'key skills', 'core skills', 'skill set', 'skillset', 'skills summary', 'core competencies', 'competencies', 'technical competencies', 'technical expertise', 'areas of expertise', 'expertise', 'technical proficiency', 'technical proficiencies', 'tools and technologies', 'technologies', 'tools', 'eda tools', 'software skills', 'technical summary', 'it skills', 'computer skills', 'skills and tools', 'technical skills and tools', 'skills and expertise', 'technical skill set', 'key competencies'],
  experience: ['experience', 'work experience', 'professional experience', 'employment history', 'employment', 'work history', 'career history', 'professional background', 'relevant experience', 'industry experience', 'experience summary', 'organizational experience', 'organisational experience', 'internship', 'internships', 'internship experience', 'work and internship experience', 'professional experience and internships', 'employment details', 'career details', 'job history'],
  education: ['education', 'educational background', 'academic background', 'academics', 'academic details', 'education details', 'educational details', 'educational qualification', 'educational qualifications', 'academic qualification', 'academic qualifications', 'qualification', 'qualifications', 'education and qualifications', 'scholastic profile', 'academic profile', 'education and training', 'academic record'],
  projects: ['projects', 'project', 'academic projects', 'key projects', 'personal projects', 'major projects', 'notable projects', 'project experience', 'project details', 'projects undertaken', 'selected projects', 'project work', 'technical projects', 'mini projects', 'projects handled', 'project profile', 'projects and research'],
  qualifications: ['certifications', 'certification', 'certificates', 'licenses and certifications', 'professional certifications', 'certifications and training', 'certifications and courses', 'courses', 'courses and certifications', 'trainings', 'training', 'training and certifications', 'professional qualifications', 'professional development', 'certification courses'],
  other: ['achievements', 'awards', 'awards and achievements', 'achievements and awards', 'honors', 'honours', 'honors and awards', 'publications', 'papers', 'patents', 'languages', 'languages known', 'interests', 'hobbies', 'hobbies and interests', 'personal details', 'personal information', 'personal profile', 'declaration', 'references', 'extracurricular activities', 'extra curricular activities', 'activities', 'volunteering', 'volunteer experience', 'strengths', 'contact', 'contact details', 'contact information', 'co curricular activities', 'positions of responsibility', 'leadership', 'additional information'],
};
const HEADING_SECTION = new Map(Object.entries(HEADINGS).flatMap(([section, names]) => names.map((name) => [name, section])));

// Inside a skills section these introduce a group of skills, not a new
// section ("Languages" there means programming languages).
const SKILL_GROUPS = new Set(['languages', 'tools', 'eda tools', 'technologies', 'scripting', 'scripting languages', 'programming languages', 'protocols', 'operating systems', 'methodologies', 'hdl', 'hdls', 'software', 'hardware', 'platforms', 'simulators', 'debuggers', 'verification', 'design', 'frameworks', 'databases', 'version control']);

// The headings that may start a line and carry their content after a
// colon ("Technical Skills: Verilog, UVM"). Words like "Tools:" are
// left out: inside a job or a project they label a list, not a section.
const INLINE_HEADINGS = new Set([...HEADINGS.skills.filter((name) => /skill|competenc|expertise|proficien/.test(name)), ...HEADINGS.summary, 'certifications', 'certification']);

const headingKey = (text) => text.toLowerCase().replace(/&/g, ' and ').replace(/[^a-z ]+/g, ' ').replace(/\s+/g, ' ').trim();

function headingOf(text) {
  if (text.length > 50 || isBullet(text) || NUMBERED.test(text)) return null;
  const key = headingKey(text);
  if (!key || words(key).length > 6) return null;
  return HEADING_SECTION.has(key) ? { section: HEADING_SECTION.get(key), key } : null;
}

function inlineHeadingOf(text) {
  const match = /^([^:]{3,45}):\s*(\S.*)$/.exec(text);
  if (!match) return null;
  const key = headingKey(match[1]);
  if (!INLINE_HEADINGS.has(key)) return null;
  return { section: HEADING_SECTION.get(key), key, rest: match[2] };
}

/*
  splitSections - the lines grouped under the section headings found.
  The lines before the first heading are the "header". A heading that
  is not recognised does not start a section, so its lines stay with
  the section above.
*/
export function splitSections(lines) {
  const sections = [{ key: 'header', heading: null, lines: [] }];
  let current = sections[0];
  for (const line of lines) {
    const heading = headingOf(line.text);
    if (heading && !(current.key === 'skills' && SKILL_GROUPS.has(heading.key))) {
      current = { key: heading.section, heading: line.text, lines: [] };
      sections.push(current);
      continue;
    }
    const inline = inlineHeadingOf(line.text);
    if (inline && inline.section !== current.key) {
      current = { key: inline.section, heading: line.text, lines: [{ text: inline.rest, index: line.index }] };
      sections.push(current);
      continue;
    }
    current.lines.push(line);
  }
  return sections;
}

const linesOf = (sections, key) => sections.filter((section) => section.key === key).flatMap((section) => section.lines);

// ---------------------------------------------------------------- dates

const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
const MONTH = '(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)';
const YEAR = '(?:19[6-9]\\d|20\\d\\d)';
const MM = '(?:0?[1-9]|1[0-2])';
// "Jan 2020", "January, 2020", "Jan'20", "01/2020", "1-2020", "2020-01", "2020".
const DATE = `(?<![\\d/.])(?:${MONTH}\\.?(?:[\\s,-]*${YEAR}|\\s*['’]\\d{2})|${MM}[/.-]${YEAR}|${YEAR}[/.-]${MM}(?![\\d])|${YEAR})(?![\\d])`;
const ONGOING = '(?:present|current(?:ly)?|now|ongoing|today|till\\s+(?:date|now)|to\\s+date|until\\s+now|date)';
const RANGE = new RegExp(`(${DATE})\\s*(?:-|–|—|~|to|till|until)\\s*(${DATE}|${ONGOING})`, 'i');
const RANGES = new RegExp(RANGE.source, 'gi');
const SINCE = new RegExp(`\\b(?:since|from)\\s+(${DATE})(?!\\s*(?:-|–|—|~|to|till|until))`, 'i');
const YEAR_RE = new RegExp(YEAR, 'g');

// One date as written: { year, month } with month null when only the
// year is given. null when the text is not a date.
export function parseDate(text) {
  const value = String(text || '').trim().toLowerCase();
  let match = new RegExp(`^(${MONTH})\\.?[\\s,-]*(${YEAR})$`, 'i').exec(value);
  if (match) return { year: Number(match[2]), month: MONTHS[match[1].slice(0, 3)] };
  match = new RegExp(`^(${MONTH})\\.?\\s*['’](\\d{2})$`, 'i').exec(value);
  if (match) {
    const short = Number(match[2]);
    const century = short <= (new Date().getUTCFullYear() % 100) + 1 ? 2000 : 1900;
    return { year: century + short, month: MONTHS[match[1].slice(0, 3)] };
  }
  match = new RegExp(`^(${MM})[/.-](${YEAR})$`).exec(value);
  if (match) return { year: Number(match[2]), month: Number(match[1]) };
  match = new RegExp(`^(${YEAR})[/.-](${MM})$`).exec(value);
  if (match) return { year: Number(match[1]), month: Number(match[2]) };
  match = new RegExp(`^(${YEAR})$`).exec(value);
  if (match) return { year: Number(match[1]), month: null };
  return null;
}

/*
  findDateRange - the first period in a line: "Jan 2020 - Present",
  "2018 – 2021", "06/2019 to 03/2022", "Since 2021".
  { text, index, start, end, ongoing } or null. `end` is null when
  the period is ongoing.
*/
export function findDateRange(text) {
  const range = RANGE.exec(text);
  if (range) {
    const start = parseDate(range[1]);
    const ongoing = new RegExp(`^${ONGOING}$`, 'i').test(range[2].trim());
    const end = ongoing ? null : parseDate(range[2]);
    if (start && (ongoing || end)) return { text: range[0].trim(), index: range.index, start, end, ongoing };
  }
  const since = SINCE.exec(text);
  if (since) {
    const start = parseDate(since[1]);
    if (start) return { text: since[0].trim(), index: since.index, start, end: null, ongoing: true };
  }
  return null;
}

const monthIndex = (date) => date.year * 12 + ((date.month || 1) - 1);

// The months a period covers, as [from, to) month indexes. A period
// with months counts both its first and its last month; a year-only
// end counts up to the start of that year ("2019 - 2023" is 4 years).
function periodMonths({ start, end, current }, now) {
  const from = monthIndex(start);
  let to;
  if (current || !end) to = now.getUTCFullYear() * 12 + now.getUTCMonth() + 1;
  else to = end.month ? monthIndex(end) + 1 : end.year * 12;
  return { from, to };
}

// -------------------------------------------------------- vocabularies

const TITLE_WORDS = /\b(?:engineer|engineers|developer|designer|architect|manager|lead|analyst|scientist|consultant|intern|internship|specialist|technician|programmer|administrator|director|head|officer|associate|trainee|researcher|professor|fellow|technologist|executive|tester|president|vp|cto|ceo|founder|co-founder|apprentice|assistant|member of technical staff|mts|smts|sde)\b/i;
const COMPANY_WORDS = /\b(?:pvt|private|ltd|limited|inc|llc|llp|gmbh|corp|corporation|company|co\.|technologies|technology|semiconductors?|systems|solutions|labs?|laboratories|electronics|microelectronics|software|services|group|industries|international|india|global|ventures|studios?|consulting|networks|devices|instruments|automotive|motors|research|university|institute)\b/i;
const INTERN = /\b(?:intern|internship|trainee|apprentice)\b/i;

const CITIES = ['bengaluru', 'bangalore', 'hyderabad', 'chennai', 'pune', 'noida', 'greater noida', 'delhi', 'new delhi', 'gurugram', 'gurgaon', 'mumbai', 'navi mumbai', 'kolkata', 'ahmedabad', 'kochi', 'cochin', 'coimbatore', 'thiruvananthapuram', 'trivandrum', 'mysuru', 'mysore', 'visakhapatnam', 'vizag', 'chandigarh', 'jaipur', 'indore', 'bhubaneswar', 'mangaluru', 'mangalore', 'vadodara', 'surat', 'nagpur', 'lucknow', 'madurai', 'vijayawada', 'goa', 'singapore', 'penang', 'kuala lumpur', 'austin', 'san jose', 'santa clara', 'sunnyvale', 'san diego', 'san francisco', 'milpitas', 'folsom', 'hillsboro', 'portland', 'boston', 'new york', 'dallas', 'phoenix', 'chandler', 'raleigh', 'munich', 'dresden', 'berlin', 'eindhoven', 'grenoble', 'hsinchu', 'taipei', 'seoul', 'tokyo', 'shanghai', 'shenzhen', 'beijing', 'dubai', 'abu dhabi', 'london', 'cambridge', 'bristol', 'ottawa', 'toronto', 'tel aviv', 'haifa', 'dublin', 'paris', 'amsterdam'];
const COUNTRIES = ['india', 'usa', 'us', 'united states', 'singapore', 'malaysia', 'germany', 'netherlands', 'france', 'uk', 'united kingdom', 'canada', 'japan', 'taiwan', 'korea', 'south korea', 'china', 'israel', 'uae', 'ireland', 'karnataka', 'telangana', 'tamil nadu', 'maharashtra', 'kerala', 'gujarat', 'uttar pradesh', 'andhra pradesh', 'west bengal', 'haryana', 'california', 'texas', 'oregon', 'arizona'];
const placeRe = (names) => new RegExp(`(?<![\\p{L}])(?:${names.map((name) => name.replace(/ /g, '\\s+')).join('|')})(?![\\p{L}])`, 'iu');
const CITY_RE = placeRe(CITIES);
const COUNTRY_ONLY_RE = new RegExp(`^(?:${COUNTRIES.map((name) => name.replace(/ /g, '\\s+')).join('|')})$`, 'i');
const isPlace = (part) => CITY_RE.test(part) && words(part).length <= 4 && !TITLE_WORDS.test(part) && !COMPANY_WORDS.test(part.replace(/\bindia\b/i, ''));

// A place as a place: parts with a number in them (a house number, a
// PIN code) are dropped, and at most the last three parts are kept.
function placeOnly(text) {
  return text
    .split(',')
    .map((part) => part.replace(/[\s-]+\d[\d\s-]{2,9}$/, '').trim())
    .filter((part) => part && !/\d/.test(part))
    .slice(-3)
    .join(', ');
}

const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g;
const PHONE_RE = /(?<![\w])\+?\d[\d\s().-]{7,18}\d(?![\w])/g;
const LINK_RE = /\b(?:https?:\/\/|www\.)\S+|\blinkedin\.com\/\S+|\bgithub\.com\/\S+/gi;

// "2019 - 2023" and "2019.06 - 2023.03" are periods, not phone numbers.
function looksLikeDates(match) {
  const groups = match.match(/\d+/g) || [];
  const isYear = (group) => /^(?:19|20)\d{2}$/.test(group);
  return groups.some(isYear) && groups.every((group) => isYear(group) || group.length <= 2);
}

// ------------------------------------------------------------- results

const field = (value, confidence, evidence = [], extra = {}) => ({
  value,
  confidence: confidence || null,
  evidence: evidence.filter(Boolean).slice(0, LIMITS.evidenceItems).map(snippet),
  ...extra,
});
const empty = (value, extra = {}) => field(value, null, [], extra);

function warn(warnings, fieldName, code, message) {
  warnings.push({ field: fieldName, code, message });
}

// ------------------------------------------------------------- contact

function findEmail(lines, warnings) {
  const found = [];
  for (const line of lines) {
    for (const match of line.text.matchAll(EMAIL_RE)) found.push({ email: match[0].toLowerCase(), line: line.text });
  }
  if (!found.length) {
    warn(warnings, 'email', 'NOT_FOUND', 'No email address was found.');
    return empty('');
  }
  const distinct = [...new Set(found.map((item) => item.email))];
  if (distinct.length > 1) {
    warn(warnings, 'email', 'MULTIPLE', `${distinct.length} email addresses were found. The first one is suggested.`);
    return field(distinct[0], MEDIUM, [found[0].line], { alternatives: distinct.slice(1, 4) });
  }
  return field(distinct[0], HIGH, [found[0].line]);
}

function findPhone(lines, headerCount, warnings) {
  for (const [position, line] of lines.entries()) {
    // Periods are blanked out first: "2019 - 2023" is not a phone number.
    const text = line.text.replace(EMAIL_RE, ' ').replace(LINK_RE, ' ').replace(RANGES, ' ');
    for (const match of text.matchAll(PHONE_RE)) {
      const raw = match[0].trim();
      const digits = (raw.match(/\d/g) || []).length;
      if (digits < 10 || digits > 15 || looksLikeDates(raw)) continue;
      const labelled = /\b(?:phone|mobile|mob|tel|telephone|contact|cell|ph)\b/i.test(line.text);
      const confidence = (labelled || position < headerCount) && digits <= 13 ? HIGH : MEDIUM;
      return field(raw, confidence, [line.text]);
    }
  }
  warn(warnings, 'phone', 'NOT_FOUND', 'No phone number was found.');
  return empty('');
}

const NAME_WORD = /^(?:\p{Lu}[\p{Ll}'’-]+|\p{Lu}{2,}|\p{Lu}\.?|\p{Lu}[\p{Ll}]+-\p{Lu}[\p{Ll}]+)$/u;
const NOT_A_NAME = /\b(?:resume|curriculum|vitae|cv|profile|summary|page|confidential)\b/i;

function looksLikeName(text, matcher) {
  if (!text || text.length > 60 || /[@\d:/|]/.test(text) || NOT_A_NAME.test(text)) return false;
  const parts = words(text);
  if (parts.length < 2 || parts.length > 4) return false;
  if (!parts.every((part) => NAME_WORD.test(part))) return false;
  if (!parts.some((part) => part.replace(/\./g, '').length >= 2)) return false;
  if (TITLE_WORDS.test(text) || COMPANY_WORDS.test(text) || CITY_RE.test(text) || headingOf(text)) return false;
  return matcher.find(text, { list: false }).length === 0;
}

// "ASHA VERMA" -> "Asha Verma". Mixed-case names are kept as written.
function nameCase(text) {
  if (text !== text.toUpperCase()) return text;
  return words(text).map((part) => (part.replace(/\./g, '').length > 1 ? part[0] + part.slice(1).toLowerCase() : part)).join(' ');
}

function findName(header, matcher, warnings) {
  for (const line of header) {
    const labelled = /^(?:full\s+)?name\s*[:\-–]\s*(.+)$/i.exec(line.text);
    if (labelled && looksLikeName(labelled[1].trim(), matcher)) return { ...field(nameCase(labelled[1].trim()), HIGH, [line.text]), line: line.index };
  }
  for (const [position, line] of header.slice(0, 6).entries()) {
    const first = line.text.split(/\s*[|•·,]\s*|\s[-–—]\s/)[0].trim();
    if (looksLikeName(first, matcher)) {
      return { ...field(nameCase(first), position === 0 ? HIGH : MEDIUM, [line.text]), line: line.index };
    }
  }
  warn(warnings, 'name', 'NOT_FOUND', 'The name could not be read with confidence. Take it from the resume.');
  return { ...empty(''), line: null };
}

function findLocation(lines, header, warnings) {
  for (const line of lines.slice(0, 30)) {
    const labelled = /^(?:current\s+)?(?:location|address|city|based\s+in|residence|current\s+city|place)\s*[:\-–]\s*(.+)$/i.exec(line.text);
    if (labelled) {
      const place = placeOnly(labelled[1]);
      if (place) return field(place, HIGH, [line.text]);
    }
  }
  for (const line of header) {
    const segments = line.text.replace(EMAIL_RE, ' ').replace(LINK_RE, ' ').split(/\s*[|•·]\s*|\s[-–—]\s/);
    for (const segment of segments) {
      if (isPlace(segment)) {
        const place = placeOnly(segment.trim());
        if (place) return field(place, MEDIUM, [line.text]);
      }
    }
  }
  warn(warnings, 'location', 'NOT_FOUND', 'No location was found in the contact details.');
  return empty('');
}

// ---------------------------------------------------------- experience

// A line that can name a role or an employer: short, not a bullet, not
// a sentence.
function isHeaderLike(text) {
  if (!text || isBullet(text) || NUMBERED.test(text)) return false;
  if (words(text).length > 12 || text.length > 110) return false;
  if (/[.!?]$/.test(text) && !/\b(?:ltd|inc|pvt|corp|co)\.$/i.test(text)) return false;
  return !/^\p{Ll}/u.test(text);
}

const PART_SPLIT = /\s*(?:\||•|·|;|,|\s[-–—]\s|\(|\)|\s+at\s+|\s@\s)\s*/i;
const cleanPart = (part) => part.replace(/^[\s,:;|–—-]+|[\s,:;|–—-]+$/g, '').trim();

function classifyParts(parts) {
  const out = { title: '', employer: '', location: '', other: [] };
  for (const part of parts.map(cleanPart).filter(Boolean)) {
    if (!out.location && (isPlace(part) || COUNTRY_ONLY_RE.test(part))) out.location = part;
    else if (COUNTRY_ONLY_RE.test(part)) continue;
    else if (!out.title && TITLE_WORDS.test(part) && !COMPANY_WORDS.test(part)) out.title = part;
    else if (!out.employer && COMPANY_WORDS.test(part) && !TITLE_WORDS.test(part)) out.employer = part;
    else out.other.push(part);
  }
  // A title with one more unlabelled part: that part is the employer.
  if (out.title && !out.employer && out.other.length) out.employer = out.other.shift();
  // An employer with one unlabelled part that reads like a role.
  if (!out.title && out.employer && out.other.length && TITLE_WORDS.test(out.other[0])) out.title = out.other.shift();
  return out;
}

function partsOf(text, range) {
  const without = range ? `${text.slice(0, range.index)} ${text.slice(range.index + range.text.length)}` : text;
  return without.replace(/\s+/g, ' ').split(PART_SPLIT);
}

/*
  The jobs in an experience section. Each job is anchored on the line
  that carries its period. Resumes put the role and the employer
  either on that line, or on the lines just above it, or just below
  it; which layout this resume uses is decided from its first job and
  applied to all of them.
*/
function parseExperience(lines, now, warnings) {
  const anchors = [];
  lines.forEach((line, position) => {
    const range = findDateRange(line.text);
    if (range) anchors.push({ position, range });
  });
  if (!anchors.length) {
    if (lines.length) warn(warnings, 'experience', 'NO_DATES', 'The experience section has no periods that could be read, so no jobs were separated. Read it in the resume.');
    return [];
  }

  const before = (k) => {
    const limit = k ? anchors[k - 1].position : -1;
    const taken = [];
    for (let j = anchors[k].position - 1; j > limit && taken.length < 2; j -= 1) {
      if (!isHeaderLike(lines[j].text) || findDateRange(lines[j].text)) break;
      taken.unshift(j);
    }
    return taken;
  };

  const first = anchors[0];
  const firstOwn = classifyParts(partsOf(lines[first.position].text, first.range));
  let layout = 'after';
  if (firstOwn.title && (firstOwn.employer || firstOwn.other.length)) layout = 'inline';
  else if (before(0).length) layout = 'before';

  const beforeLines = anchors.map((_, k) => (layout === 'before' ? before(k) : []));
  const entries = [];
  for (const [k, anchor] of anchors.entries()) {
    const anchorLine = lines[anchor.position];
    const nextStart = k + 1 < anchors.length ? (beforeLines[k + 1][0] ?? anchors[k + 1].position) : lines.length;
    const headerIdx = [...beforeLines[k], anchor.position];
    let parts = [...beforeLines[k].flatMap((j) => partsOf(lines[j].text)), ...partsOf(anchorLine.text, anchor.range)];
    let found = classifyParts(parts);
    // The role or the employer on the lines just below the period.
    for (let j = anchor.position + 1; j < nextStart && headerIdx.length < 4 && !(found.title && found.employer); j += 1) {
      if (layout === 'before' || !isHeaderLike(lines[j].text)) break;
      headerIdx.push(j);
      parts = [...parts, ...partsOf(lines[j].text)];
      found = classifyParts(parts);
    }

    const highlights = [];
    for (let j = anchor.position + 1; j < nextStart; j += 1) {
      if (headerIdx.includes(j)) continue;
      const text = stripBullet(lines[j].text);
      if (text && highlights.length < LIMITS.highlightsPerEntry) highlights.push(text.slice(0, LIMITS.highlight));
    }

    const { start, end, ongoing } = anchor.range;
    const valid = (ongoing || monthIndex(end) >= monthIndex(start)) && start.year <= now.getUTCFullYear() + 1;
    const exact = Boolean(start.month && (ongoing || end.month));
    let confidence = LOW;
    if (found.title && found.employer && exact) confidence = HIGH;
    else if (found.title && (found.employer || exact)) confidence = MEDIUM;

    const heading = headerIdx.map((j) => lines[j].text).join(' | ');
    entries.push({
      title: found.title,
      employer: found.employer,
      location: found.location,
      period: anchor.range.text,
      start,
      end: ongoing ? null : end,
      current: ongoing,
      internship: INTERN.test(`${found.title} ${heading}`),
      validPeriod: valid,
      highlights,
      heading,
      confidence,
      evidence: [snippet(heading)],
    });
    if (!valid) warn(warnings, 'experience', 'INVALID_PERIOD', `The period "${anchor.range.text}" does not read as a valid period. It is not counted in the total.`);
    if (!found.title || !found.employer) warn(warnings, 'experience', 'ENTRY_UNCLEAR', `The ${!found.title ? 'role' : 'employer'} of the job "${snippet(heading)}" could not be told apart. Check it.`);
  }
  return entries.slice(0, LIMITS.experienceEntries);
}

const STATED_YEARS = [
  /(?:total|overall|relevant|work)?\s*experience\s*[:\-–]\s*(\d{1,2}(?:\.\d{1,2})?)\s*\+?\s*(?:years?|yrs?)(?:\s*(?:and|&|,)?\s*(\d{1,2})\s*(?:months?|mos?))?/i,
  /(\d{1,2}(?:\.\d{1,2})?)\s*\+?\s*(?:years?|yrs?)(?:\s*(?:and|&|,)?\s*(\d{1,2})\s*(?:months?|mos?))?\s+(?:of\s+)?(?:[\p{L}&/-]+\s+){0,4}?experience/iu,
  /experience\s+of\s+(?:over\s+|more\s+than\s+|around\s+|about\s+|nearly\s+|almost\s+)?(\d{1,2}(?:\.\d{1,2})?)\s*\+?\s*(?:years?|yrs?)(?:\s*(?:and|&|,)?\s*(\d{1,2})\s*(?:months?|mos?))?/i,
];

function statedYears(lines) {
  for (const line of lines) {
    for (const pattern of STATED_YEARS) {
      const match = pattern.exec(line.text);
      if (match) {
        const years = Number(match[1]) + (match[2] ? Number(match[2]) / 12 : 0);
        if (years > 0 && years <= 50) return { years: Math.round(years * 10) / 10, line: line.text };
      }
    }
  }
  return null;
}

/*
  The total years of work: the periods of the jobs (internships left
  out), with overlapping periods counted once. Compared with what the
  resume states ("8+ years of experience") when it states it.
*/
function experienceYears(entries, statedLines, now, warnings) {
  const counted = entries.filter((entry) => entry.validPeriod && !entry.internship);
  const interns = entries.filter((entry) => entry.internship);
  if (interns.length) warn(warnings, 'experienceYears', 'INTERNSHIPS_EXCLUDED', `${interns.length} internship${interns.length === 1 ? ' is' : 's are'} not counted in the total years.`);

  let computed = null;
  if (counted.length) {
    const spans = counted.map((entry) => periodMonths(entry, now)).filter((span) => span.to > span.from).sort((a, b) => a.from - b.from);
    let months = 0;
    let open = null;
    for (const span of spans) {
      if (!open || span.from > open.to) {
        if (open) months += open.to - open.from;
        open = { ...span };
      } else open.to = Math.max(open.to, span.to);
    }
    if (open) months += open.to - open.from;
    if (months > 0) computed = Math.round((months / 12) * 10) / 10;
  }
  const yearOnly = counted.some((entry) => !entry.start.month || (!entry.current && !entry.end.month));
  const stated = statedYears(statedLines);

  if (stated) {
    const agrees = computed === null || Math.abs(stated.years - computed) <= 1;
    if (!agrees) warn(warnings, 'experienceYears', 'MISMATCH', `The resume states ${stated.years} years; the job periods add up to ${computed}. Check which is right.`);
    return field(stated.years, agrees ? HIGH : MEDIUM, [stated.line], { method: 'stated', stated: stated.years, computed });
  }
  if (computed !== null) {
    if (yearOnly) warn(warnings, 'experienceYears', 'YEAR_ONLY_DATES', 'Some periods give only years, so the total is approximate.');
    return field(computed, yearOnly ? LOW : MEDIUM, counted.map((entry) => entry.period), { method: 'computed', stated: null, computed });
  }
  warn(warnings, 'experienceYears', 'NOT_FOUND', 'The total years of experience could not be worked out.');
  return empty(null, { method: null, stated: null, computed: null });
}

// ------------------------------------------------------------ headline

const LABELLED_TITLE = /^(?:current\s+(?:role|designation|position|title)|designation|position|job\s+title|title|role)\s*[:\-–]\s*(.+)$/i;

function findHeadline(header, nameLine, summary, entries, warnings) {
  for (const line of [...header, ...summary]) {
    const labelled = LABELLED_TITLE.exec(line.text);
    if (labelled && labelled[1].length <= 120) return field(labelled[1].trim(), HIGH, [line.text], { source: 'labelled' });
  }
  const latest = entries.find((entry) => entry.current && entry.title && !entry.internship)
    || entries.filter((entry) => entry.title && !entry.internship).sort((a, b) => monthIndex(b.start) - monthIndex(a.start))[0];
  const afterName = nameLine === null ? header.slice(0, 4) : header.filter((line) => line.index > nameLine).slice(0, 4);
  for (const line of afterName) {
    for (const segment of line.text.split(/\s*[|•·]\s*|\s[-–—]\s/)) {
      const text = segment.trim();
      if (TITLE_WORDS.test(text) && words(text).length <= 10 && !/[@]/.test(text) && !findDateRange(text)) {
        const same = latest && skillKey(latest.title) === skillKey(text);
        return field(text, same ? HIGH : MEDIUM, [line.text], { source: 'header' });
      }
    }
  }
  if (latest) return field(latest.title, MEDIUM, [latest.heading], { source: 'experience' });
  warn(warnings, 'headline', 'NOT_FOUND', 'The current role could not be read.');
  return empty('', { source: null });
}

// ----------------------------------------------------------- education

const DEGREE_CI = /\b(?:b\.?\s?tech|m\.?\s?tech|b\.?\s?sc|m\.?\s?sc|b\.?\s?com|bca|mca|mba|ph\.?\s?d|doctor\s+of\s+philosophy|bachelor(?:'s|s)?(?:\s+(?:of|in)\s+[\p{L} &]+|\s+degree)?|master(?:'s|s)?(?:\s+(?:of|in)\s+[\p{L} &]+|\s+degree)?|diploma|post\s+graduate\s+diploma|pg\s+diploma|higher\s+secondary|senior\s+secondary|secondary\s+school|hsc|ssc|sslc|puc|pre[-\s]university|class\s+(?:x|xii|10|12)(?:th)?|(?:10|12)th(?:\s+(?:standard|grade|class))?|intermediate)(?![\p{L}])/iu;
const DEGREE_CS = /(?<![\p{L}])(?:B\.\s?E\.?|M\.\s?E\.?|B\.\s?S\.?|M\.\s?S\.?|BE|ME|BS|MS|B\.Eng|M\.Eng|BEng|MEng)(?![\p{L}])/u;
const INSTITUTION = /\b(?:university|universit[äe]t|institute|college|school|academy|polytechnic|iit|nit|iiit|bits|vidyalaya|vidyapeeth|vidyapith|iisc)\b/i;
const SCORE = /\b(?:cgpa|gpa|cpi|sgpa|percentage|grade|marks)\b\s*[:\-–]?\s*(\d{1,2}(?:\.\d{1,2})?\s*(?:\/\s*\d{1,2}(?:\.\d)?)?\s*%?)|(\d{2}(?:\.\d{1,2})?\s*%)/i;

function degreeIn(text) {
  return DEGREE_CI.exec(text) || DEGREE_CS.exec(text);
}

function degreeText(text, match) {
  const from = text.slice(match.index);
  // The degree and its subject, up to the institution, a period or a
  // separator.
  const stop = from.search(/\s*(?:\||,|;|\(|\s[-–—]\s|\bfrom\b|\bat\b|(?:19|20)\d{2})/i);
  let degree = (stop > 0 ? from.slice(0, stop) : from).trim();
  const institution = INSTITUTION.exec(degree);
  if (institution && institution.index > 0) degree = degree.slice(0, institution.index).trim();
  return degree.replace(/[\s,:;–—-]+$/, '');
}

// The part of a line that names a university, an institute or a
// college. "B.Tech from IIT Madras" gives "IIT Madras"; a part that
// holds both a degree and an institution with nothing to tell them
// apart gives nothing.
function institutionIn(text) {
  for (const part of text.split(/\s*[|,;]\s*|\s[-–—]\s/)) {
    if (!INSTITUTION.test(part)) continue;
    let value = part;
    if (degreeIn(value)) {
      const after = /\b(?:from|at)\s+(.+)$/i.exec(value);
      if (!after || !INSTITUTION.test(after[1])) continue;
      value = after[1];
    }
    value = cleanPart(value.replace(new RegExp(`\\(?${DATE}.*$`, 'i'), ''));
    if (value) return value.slice(0, 160);
  }
  return '';
}

function parseEducation(lines, fallback, warnings) {
  const source = lines.length ? lines : fallback;
  const fromSection = lines.length > 0;
  const entries = [];
  const used = new Set();
  for (const [position, line] of source.entries()) {
    const text = stripBullet(line.text);
    const match = degreeIn(text);
    if (!match) continue;
    const block = [position];
    for (let j = position + 1; j < source.length && j <= position + 2; j += 1) {
      if (degreeIn(stripBullet(source[j].text))) break;
      block.push(j);
    }
    let institution = '';
    for (const j of block) {
      institution = institutionIn(stripBullet(source[j].text));
      if (institution) break;
    }
    // An institution named on the line above the degree.
    if (!institution && position > 0 && !used.has(position - 1)) {
      const above = stripBullet(source[position - 1].text);
      if (!degreeIn(above) && institutionIn(above)) {
        institution = institutionIn(above);
        block.unshift(position - 1);
      }
    }
    const joined = block.map((j) => source[j].text).join(' ');
    const range = findDateRange(joined);
    const years = joined.match(YEAR_RE) || [];
    const year = range ? String(range.end ? range.end.year : '') : (years.length ? years[years.length - 1] : '');
    const score = SCORE.exec(joined);
    const degree = degreeText(text, match);
    block.forEach((j) => used.add(j));
    let confidence = LOW;
    if (fromSection && degree && institution) confidence = HIGH;
    else if (fromSection && degree) confidence = MEDIUM;
    entries.push({
      degree,
      institution,
      year,
      score: score ? (score[1] || score[2]).replace(/\s+/g, '') : '',
      confidence,
      evidence: [snippet(block.map((j) => source[j].text).join(' | '))],
    });
    if (entries.length >= LIMITS.educationEntries) break;
  }
  if (!entries.length) {
    warn(warnings, 'education', 'NOT_FOUND', fromSection ? 'The education section names no degree that could be read.' : 'No education section was found.');
  } else if (!fromSection) {
    warn(warnings, 'education', 'NO_SECTION', 'No education section was found; the degrees were read from elsewhere in the resume. Check them.');
  }
  return entries;
}

// ------------------------------------------------------------ projects

const PROJECT_LABEL = /^(?:project\s*(?:title|name)?\s*(?:\d{1,2})?|title)\s*[:\-–]\s*(.+)$/i;
const FIELD_LABEL = /^(tools?(?:\s+used)?|technolog(?:y|ies)(?:\s+used)?|tech(?:nology)?\s+stack|environment|skills(?:\s+used)?|languages?|platform|software|description|summary|objective|role|responsibilit(?:y|ies)|duration|period|team\s+size|client|organi[sz]ation|company)\s*[:\-–]\s*(.*)$/i;
const TOOL_LABELS = /^(?:tools?|technolog|tech|environment|skills|languages?|platform|software)/i;

function parseProjects(lines, matcher, warnings, { present }) {
  const projects = [];
  let current = null;
  const close = () => {
    if (current && (current.name || current.description || current.highlights.length)) projects.push(current);
    current = null;
  };
  // A title may carry the period: "Smart Parking (2019)",
  // "SoC bring-up | Jan 2022 - Jun 2022".
  const open = (title, line) => {
    close();
    let name = title;
    let period = '';
    const range = findDateRange(name);
    const year = /\(?\s*((?:19|20)\d{2})\s*\)?$/.exec(name);
    if (range) { period = range.text; name = name.replace(range.text, ' '); }
    else if (year && year.index > 0) { period = year[1]; name = name.slice(0, year.index); }
    current = { name: cleanPart(name.replace(/[()]\s*$/, '')).slice(0, 160), period, role: '', description: '', highlights: [], technologies: [], labelled: false, evidence: [snippet(line.text)] };
  };
  for (const line of lines) {
    const text = line.text;
    const labelled = PROJECT_LABEL.exec(text);
    if (labelled) {
      open(labelled[1], line);
      current.labelled = true;
      continue;
    }
    const label = FIELD_LABEL.exec(stripBullet(text));
    if (label && current) {
      const [, key, rest] = label;
      if (TOOL_LABELS.test(key)) current.technologies.push(...rest.split(/\s*[,;|/]\s*/).filter(Boolean));
      else if (/^(?:description|summary|objective)/i.test(key)) current.description = [current.description, rest].filter(Boolean).join(' ');
      else if (/^role/i.test(key)) current.role = rest.slice(0, 160);
      else if (/^(?:duration|period)/i.test(key)) current.period = rest.slice(0, 80);
      else if (rest) current.highlights.push(rest.slice(0, LIMITS.highlight));
      continue;
    }
    const numbered = NUMBERED.test(text);
    const titleLike = !isBullet(text) && (numbered || (isHeaderLike(text) && words(text).length <= 14));
    if (titleLike && (!current || current.highlights.length || current.description || numbered || !current.name)) {
      open(stripBullet(text), line);
      continue;
    }
    if (!current) open('', line);
    const content = stripBullet(text);
    if (isBullet(text) || current.description) {
      if (current.highlights.length < LIMITS.highlightsPerEntry) current.highlights.push(content.slice(0, LIMITS.highlight));
    } else current.description = content.slice(0, 600);
  }
  close();

  const out = projects.slice(0, LIMITS.projects).map((project) => {
    const blockText = [project.name, project.description, ...project.highlights].join('\n');
    const listed = project.technologies.map((item) => matcher.normalise(item) || item.trim()).filter(Boolean);
    const inText = matcher.find(blockText).map((hit) => hit.name);
    const technologies = [...new Map([...listed, ...inText].map((name) => [skillKey(name), name])).values()];
    let confidence = MEDIUM;
    if (project.labelled || (project.name && (project.description || project.highlights.length) && technologies.length)) confidence = HIGH;
    if (!project.name) confidence = LOW;
    const { labelled, ...rest } = project;
    return { ...rest, technologies, confidence };
  });
  if (!out.length) warn(warnings, 'projects', 'NOT_FOUND', present ? 'The projects section has no projects that could be read.' : 'No projects section was found.');
  else if (out.some((project) => !project.name)) warn(warnings, 'projects', 'UNTITLED', 'A project without a clear title was found. Check it.');
  return out;
}

// --------------------------------------------------------------- skills

/*
  The skills: from the skills section (taken as a list, so short names
  like "C" count there), then from the rest of the resume (sentences,
  where only unambiguous names count), and from "Tools:" lines in jobs
  and projects (taken as lists). One entry per skill, under its
  canonical name, with where it was found.
*/
function parseSkills(sections, matcher, warnings) {
  const found = new Map();
  const unrecognised = new Map();
  // The skills in one list item, by item: a long list repeats itself.
  const listed = new Map();
  const note = (hit, source, line) => {
    const known = found.get(hit.name);
    if (known) {
      known.mentions += 1;
      if (source === 'skills' && known.source !== 'skills') Object.assign(known, { source, evidence: snippet(line), confidence: HIGH });
      return;
    }
    found.set(hit.name, { name: hit.name, category: hit.category, source, mentions: 1, evidence: snippet(line), confidence: source === 'skills' ? HIGH : MEDIUM });
  };

  for (const section of sections) {
    for (const line of section.lines) {
      const text = line.text;
      if (section.key === 'skills') {
        const items = text.replace(/^[^:]{1,40}:\s*/, '').split(/\s*[,;|•·]\s*|\s+-\s+/).map(stripBullet).filter(Boolean);
        for (const item of items) {
          if (!listed.has(item)) listed.set(item, matcher.find(item, { list: true }));
          const hits = listed.get(item);
          hits.forEach((hit) => note(hit, 'skills', text));
          const plain = item.replace(/[.]+$/, '').trim();
          if (!hits.length && plain.length >= 2 && plain.length <= 40 && words(plain).length <= 4 && !/[:]/.test(plain)) {
            const key = skillKey(plain);
            if (key && !unrecognised.has(key)) unrecognised.set(key, plain);
          }
        }
        continue;
      }
      const toolLine = FIELD_LABEL.exec(stripBullet(text));
      const list = Boolean(toolLine && TOOL_LABELS.test(toolLine[1]));
      for (const hit of matcher.find(list ? toolLine[2] : text, { list })) note(hit, section.key, text);
    }
  }

  const all = [...found.values()];
  const ordered = [...all.filter((item) => item.source === 'skills'), ...all.filter((item) => item.source !== 'skills')];
  const hasSection = sections.some((section) => section.key === 'skills');
  if (!hasSection) warn(warnings, 'skills', 'NO_SECTION', 'No skills section was found. The skills were read from the rest of the resume.');
  if (!ordered.length) warn(warnings, 'skills', 'NOT_FOUND', 'No known skills were found.');
  const unknown = [...unrecognised.values()].filter((item) => !found.has(matcher.normalise(item))).slice(0, LIMITS.unrecognisedSkills);
  let confidence = null;
  if (ordered.length) confidence = ordered.some((item) => item.source === 'skills') ? HIGH : MEDIUM;
  return field(ordered.map((item) => item.name), confidence, ordered.slice(0, LIMITS.evidenceItems).map((item) => item.evidence), {
    details: ordered,
    // Listed in the skills section but not in the taxonomy. Kept as
    // written, for the recruiter to accept or drop.
    unrecognised: unknown,
  });
}

// ------------------------------------------------------- qualifications

function parseQualifications(lines, warnings, present) {
  const items = [];
  const seen = new Set();
  for (const line of lines) {
    const text = stripBullet(line.text).slice(0, LIMITS.qualification);
    const key = text.toLowerCase();
    if (text.length < 3 || seen.has(key)) continue;
    seen.add(key);
    items.push({ name: text, confidence: MEDIUM, evidence: [snippet(line.text)] });
    if (items.length >= LIMITS.qualifications) break;
  }
  if (!items.length) warn(warnings, 'qualifications', 'NOT_FOUND', present ? 'The certifications section is empty.' : 'No certifications or courses section was found.');
  return items;
}

// ---------------------------------------------------------------- parse

const entriesField = (entries) => {
  if (!entries.length) return empty([]);
  const rank = { high: 3, medium: 2, low: 1 };
  const lowest = entries.reduce((min, entry) => (rank[entry.confidence] < rank[min] ? entry.confidence : min), HIGH);
  return field(entries, lowest, entries.map((entry) => entry.evidence[0]));
};

/*
  parseResume - the draft profile read from the text of one resume.
  `now` is the date an ongoing job is counted up to (the tests fix it).
  `extraSkills` are skill names to look for besides the taxonomy (the
  skills the jobs in this system ask for), matched by exact name.
*/
export function parseResume(text, { now = new Date(), extraSkills = [] } = {}) {
  const warnings = [];
  const matcher = createSkillMatcher(extraSkills);
  const lines = toLines(text);
  if (!lines.length) {
    warn(warnings, null, 'NO_TEXT', 'There is no text to read.');
    return {
      parserVersion: PARSER_VERSION,
      fields: {
        name: empty(''), email: empty(''), phone: empty(''), location: empty(''), headline: empty('', { source: null }),
        skills: empty([], { details: [], unrecognised: [] }), experienceYears: empty(null, { method: null, stated: null, computed: null }),
        experience: empty([]), education: empty([]), qualifications: empty([]), projects: empty([]),
      },
      sections: [],
      warnings,
    };
  }

  const sections = splitSections(lines);
  const header = linesOf(sections, 'header').slice(0, LIMITS.headerLines);
  const present = (key) => sections.some((section) => section.key === key);

  const name = findName(header, matcher, warnings);
  const email = findEmail(lines, warnings);
  const phone = findPhone([...header, ...lines.filter((line) => !header.includes(line))], header.length, warnings);
  const location = findLocation(lines, header, warnings);

  const experienceLines = linesOf(sections, 'experience');
  if (!present('experience')) warn(warnings, 'experience', 'NO_SECTION', 'No experience section was found.');
  const entries = parseExperience(experienceLines, now, warnings);
  const totalYears = experienceYears(entries, [...header, ...linesOf(sections, 'summary'), ...lines.filter((line) => /total\s+experience/i.test(line.text))], now, warnings);
  const headline = findHeadline(header, name.line, linesOf(sections, 'summary'), entries, warnings);

  const otherLines = [...header, ...linesOf(sections, 'other'), ...linesOf(sections, 'summary')];
  const education = parseEducation(linesOf(sections, 'education'), otherLines, warnings);
  const qualifications = parseQualifications(linesOf(sections, 'qualifications'), warnings, present('qualifications'));
  const projects = parseProjects(linesOf(sections, 'projects'), matcher, warnings, { present: present('projects') });
  const skills = parseSkills(sections, matcher, warnings);

  const { line: _nameLine, ...nameField } = name;
  return {
    parserVersion: PARSER_VERSION,
    fields: {
      name: nameField,
      email,
      phone,
      location,
      headline,
      skills,
      experienceYears: totalYears,
      experience: entriesField(entries),
      education: entriesField(education),
      qualifications: entriesField(qualifications),
      projects: entriesField(projects),
    },
    sections: sections.filter((section) => section.key !== 'header').map((section) => ({ key: section.key, heading: section.heading, lines: section.lines.length })),
    warnings,
  };
}
