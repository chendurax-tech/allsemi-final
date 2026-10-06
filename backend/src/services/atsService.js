import { ATSResult, Candidate, Job } from '../models/index.js';
import { ATS_ENGINE, LEVEL_MIN_YEARS, ATS_WEIGHT_KEYS } from '../config/constants.js';
import { notFound } from '../utils/AppError.js';

/*
  RULE-BASED ATS.

  A deterministic, explainable comparison of a candidate profile with a
  job. The same inputs always give the same result, every number can be
  traced to a check listed in `checks`, and no AI model is involved.
  It is decision support: it never changes a candidate's or an
  application's status. A recruiter does that.

  THE BASELINE. A job without a requirement profile is scored with
  these components and weights (out of 100):
    required skills     45   exact-name match after normalising case,
                             spacing and punctuation
    experience          20   stated years against the job level
    preferred skills    10
    domain relevance    10   candidate domain / current role against the
                             job category, department and title
    location            10   remote or hybrid roles pass; otherwise the
                             candidate's city against the job's
    profile completeness 5

  A JOB WITH A REQUIREMENT PROFILE (models/Job.js) is scored against
  that profile, still by rules only:
    - its required and preferred skills are used (the job's own lists
      when the profile leaves one empty);
    - its minimum years replace the years set for the job level;
    - its tools and technologies are a component of their own;
    - its domains count for domain relevance, next to the job category;
    - its work arrangement and location are used for the location rule;
    - education, certifications and other constraints are listed as
      checks for the recruiter and are not scored: a name match in
      free text is not reliable enough to move a score;
    - its weights, when it has them, replace the baseline weights. A
      weight of 0 leaves a component out of the score.

  A component that does not apply (a job with no preferred skills, for
  example) is left out and the remaining weights are rescaled, so it
  neither helps nor hurts. Notice period is reported as information and
  is not scored.

  The AI comparison a recruiter can ask for (services/aiService.js) is
  stored in its own field, `aiComparison`, on the same result. It does
  not replace these rules, and nothing here reads or writes it.
*/

export const ENGINE_VERSION = '2';
// The baseline: used for every job that has no requirement profile.
export const WEIGHTS = { skills: 45, experience: 20, preferredSkills: 10, domain: 10, location: 10, completeness: 5 };
// The starting weights of a job with a requirement profile, until a
// recruiter sets the job's own.
export const PROFILE_DEFAULT_WEIGHTS = { skills: 40, experience: 20, preferredSkills: 10, tools: 10, domain: 10, location: 5, completeness: 5 };

/*
  The weights one job is scored with: { weights, source }.
    BASELINE  no requirement profile
    PROFILE   a profile without weights of its own
    JOB       the weights saved in the job's profile
*/
export function weightsFor(job) {
  const profile = job?.requirementProfile || null;
  if (!profile) return { weights: { ...WEIGHTS }, source: 'BASELINE' };
  const own = profile.weights && typeof profile.weights === 'object' ? profile.weights : null;
  if (!own) return { weights: { ...PROFILE_DEFAULT_WEIGHTS }, source: 'PROFILE' };
  const weights = {};
  for (const key of ATS_WEIGHT_KEYS) {
    const value = Number(own[key]);
    weights[key] = Number.isFinite(value) && value > 0 ? Math.min(100, Math.round(value)) : 0;
  }
  // Weights that add up to nothing cannot score anything.
  if (Object.values(weights).every((value) => value === 0)) return { weights: { ...PROFILE_DEFAULT_WEIGHTS }, source: 'PROFILE' };
  return { weights, source: 'JOB' };
}

const round = (value) => Math.round(value);

// "System Verilog", "systemverilog" and "SystemVerilog" are one skill;
// "C" and "C++" are not.
export function skillKey(skill) {
  return String(skill || '').toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9+#]/g, '');
}

function matchSkills(wanted, have) {
  const owned = new Set(have.map(skillKey).filter(Boolean));
  const matched = [];
  const missing = [];
  for (const skill of wanted) {
    if (owned.has(skillKey(skill))) matched.push(skill);
    else missing.push(skill);
  }
  return { matched, missing };
}

const STOP_WORDS = new Set(['engineering', 'engineer', 'technology', 'technologies', 'systems', 'system', 'senior', 'lead', 'principal', 'junior', 'with', 'and', 'the', 'for']);
const words = (text) => new Set(
  String(text || '').toLowerCase().replace(/[^a-z0-9+# ]/g, ' ').split(/\s+/).filter((w) => w.length >= 3 && !STOP_WORDS.has(w)),
);
const overlaps = (a, b) => [...a].some((word) => b.has(word));

// Job categories and the sector names candidates choose on the form do
// not share words in every case; these pairs are treated as the same
// domain.
const DOMAIN_ALIASES = {
  automotive: ['mobility', 'embedded', 'vehicle'],
  aerospace: ['mobility', 'communications', 'satellite'],
  semiconductor: ['chip', 'vlsi', 'silicon', 'asic'],
  cloud: ['infrastructure', 'platform'],
  healthcare: ['medical'],
  fintech: ['banking', 'payments', 'finance'],
};

function domainCheck(candidate, job, profileDomains = []) {
  const stated = `${candidate.domain || ''} ${candidate.headline || ''}`.trim();
  if (!stated) return { score: 0, result: 'review', detail: 'The candidate has not stated a domain or current role.' };

  // The domains named in the job's requirement profile come first.
  for (const domain of profileDomains) {
    const domainWords = words(domain);
    for (const word of [...domainWords]) (Object.hasOwn(DOMAIN_ALIASES, word) ? DOMAIN_ALIASES[word] : []).forEach((alias) => domainWords.add(alias));
    if (domainWords.size && overlaps(domainWords, words(candidate.domain))) {
      return { score: 100, result: 'pass', detail: `Candidate domain "${candidate.domain}" matches "${domain}" in the job's requirement profile.` };
    }
  }
  for (const domain of profileDomains) {
    if (overlaps(words(domain), words(candidate.headline))) {
      return { score: 60, result: 'review', detail: `Current role "${candidate.headline}" relates to "${domain}" in the job's requirement profile, but the stated domain does not match it.` };
    }
  }

  const categoryWords = words(job.category);
  for (const word of [...categoryWords]) (Object.hasOwn(DOMAIN_ALIASES, word) ? DOMAIN_ALIASES[word] : []).forEach((alias) => categoryWords.add(alias));
  if (categoryWords.size && overlaps(categoryWords, words(candidate.domain))) {
    return { score: 100, result: 'pass', detail: `Candidate domain "${candidate.domain}" matches the job category "${job.category}".` };
  }
  const roleWords = words(`${job.title} ${job.department} ${(job.keywords || []).join(' ')}`);
  if (overlaps(roleWords, words(candidate.headline))) {
    return { score: 60, result: 'review', detail: `Current role "${candidate.headline}" is related to this role, but the stated domain does not match "${job.category}".` };
  }
  if (categoryWords.size && overlaps(categoryWords, words(candidate.headline))) {
    return { score: 60, result: 'review', detail: `Current role "${candidate.headline}" relates to "${job.category}".` };
  }
  return { score: 0, result: 'review', detail: `Neither the stated domain nor the current role matches "${job.category || job.title}".` };
}

const cityOf = (location) => String(location || '').split(',')[0].trim().toLowerCase().replace('bangalore', 'bengaluru');

const ARRANGEMENT_LABELS = { ON_SITE: 'on site', HYBRID: 'hybrid', REMOTE: 'remote' };

function locationCheck(candidate, job, profile = null) {
  const arrangement = profile?.workArrangement || '';
  if (arrangement === 'REMOTE' || arrangement === 'HYBRID') {
    return { score: 100, result: 'pass', detail: `The job's requirement profile sets the role as ${ARRANGEMENT_LABELS[arrangement]}.` };
  }
  const jobLocation = String(profile?.location || job.location || '').trim();
  if (!jobLocation) return null; // not applicable
  // A profile that says "on site" settles it; otherwise the wording of
  // the location decides, as it always has.
  if (arrangement !== 'ON_SITE' && /remote|hybrid/i.test(jobLocation)) return { score: 100, result: 'pass', detail: `The role is ${jobLocation}.` };
  const jobCity = cityOf(jobLocation);
  const candidatePlaces = [candidate.location, candidate.preferredLocation].filter(Boolean);
  if (candidatePlaces.length === 0) return { score: 50, result: 'review', detail: `The candidate has not stated a location. The role is in ${jobLocation}.` };
  if (candidatePlaces.some((place) => place.toLowerCase().replace('bangalore', 'bengaluru').includes(jobCity))) {
    return { score: 100, result: 'pass', detail: `The candidate is in, or prefers, the role location (${jobLocation}).` };
  }
  return { score: 40, result: 'review', detail: `The candidate is in ${candidate.location || candidate.preferredLocation}. The role is in ${jobLocation}.` };
}

const isYears = (value) => typeof value === 'number' && Number.isFinite(value) && value >= 0;

function experienceCheck(candidate, job, profile = null) {
  const fromProfile = isYears(profile?.minYears);
  const minYears = fromProfile ? profile.minYears : (LEVEL_MIN_YEARS[job.experienceLevel] ?? 0);
  const asked = fromProfile ? `The job's requirement profile asks for ${minYears}+ years.` : `${job.experienceLevel} is set at ${minYears}+ years.`;
  const years = candidate.experienceYears;
  if (years === null || years === undefined) {
    return { score: 0, result: 'review', detail: `Experience is not stated. ${asked}` };
  }
  if (years >= minYears) return { score: 100, result: 'pass', detail: `${years} years stated. ${asked}` };
  return { score: round((years / minYears) * 100), result: 'review', detail: `${years} years stated. ${asked}` };
}

// Everything the candidate typed that could name a degree or a
// certificate, as one normalised text.
const flat = (text) => ` ${String(text || '').toLowerCase().replace(/[^a-z0-9+#]+/g, ' ').trim()} `;
function statedText(candidate) {
  const parts = [candidate.headline, candidate.summary, ...(candidate.skills || [])];
  for (const entry of candidate.education || []) parts.push(entry?.degree, entry?.institution);
  for (const entry of candidate.experience || []) parts.push(entry?.title, ...(entry?.highlights || []));
  return flat(parts.filter(Boolean).join(' '));
}

// Listed for the recruiter, never scored: which of the named items
// appear in what the candidate typed.
function namedItemsCheck(rule, items, haystack) {
  if (!items.length) return null;
  const found = [];
  const notFound = [];
  for (const item of items) {
    const needle = flat(item);
    (needle.trim() && haystack.includes(needle) ? found : notFound).push(item);
  }
  const parts = [];
  if (found.length) parts.push(`Named in the profile: ${found.join(', ')}.`);
  if (notFound.length) parts.push(`Not found by name: ${notFound.join(', ')}.`);
  parts.push('Not scored: check the resume.');
  return { rule, result: notFound.length ? 'review' : 'pass', detail: parts.join(' '), score: null, weight: null };
}

function completenessCheck(candidate) {
  const items = [
    ['phone', Boolean(candidate.phone)],
    ['location', Boolean(candidate.location)],
    ['current role', Boolean(candidate.headline)],
    ['domain', Boolean(candidate.domain)],
    ['experience', candidate.experienceYears !== null && candidate.experienceYears !== undefined],
    ['three or more skills', (candidate.skills || []).length >= 3],
    ['resume', Boolean(candidate.resume && candidate.resume.key)],
    ['notice period', Boolean(candidate.noticePeriod)],
  ];
  const missing = items.filter(([, present]) => !present).map(([label]) => label);
  const score = round(((items.length - missing.length) / items.length) * 100);
  return {
    score,
    result: score >= 75 ? 'pass' : 'review',
    detail: missing.length ? `Missing from the profile: ${missing.join(', ')}.` : 'The profile is complete.',
  };
}

export function matchBand(total) {
  if (total >= 85) return 'Strong match';
  if (total >= 70) return 'Good match';
  if (total >= 50) return 'Partial match';
  return 'Low match';
}

/*
  evaluate - pure function, no database access. Takes plain candidate
  and job objects and returns the result fields. A job with a
  requirement profile is scored against it (see the top of this file).
*/
export function evaluate(candidate, job) {
  const profile = job.requirementProfile || null;
  const { weights: WEIGHT, source: weightSource } = weightsFor(job);
  const own = (list, fallback) => (profile && (list || []).length ? list : fallback || []);

  const candidateSkills = candidate.skills || [];
  const requiredSkills = own(profile?.requiredSkills, job.requiredSkills);
  const preferredSkills = own(profile?.preferredSkills, job.preferredSkills);
  const tools = profile ? (profile.tools || []) : [];
  const required = matchSkills(requiredSkills, candidateSkills);
  const preferred = matchSkills(preferredSkills, candidateSkills);
  const tooling = matchSkills(tools, candidateSkills);

  const components = [];
  const checks = [];
  const add = (key, rule, check) => {
    if (!check) return null;
    const weight = WEIGHT[key] ?? 0;
    // A weight of 0 (only a job's own weights can say that) keeps the
    // check on the list and out of the score.
    if (weight > 0) components.push({ key, score: check.score, weight });
    checks.push({ rule, result: check.result, detail: weight > 0 ? check.detail : `${check.detail} Not counted in the score for this job.`, score: check.score, weight });
    return check.score;
  };

  let skillScore = 100;
  if (requiredSkills.length) {
    const ratio = required.matched.length / requiredSkills.length;
    skillScore = round(ratio * 100);
    let result = 'fail';
    if (required.missing.length === 0) result = 'pass';
    else if (ratio >= 0.5) result = 'review';
    add('skills', 'Required skills', { score: skillScore, result, detail: `${required.matched.length} of ${requiredSkills.length} required skills found by name.` });
  } else {
    checks.push({ rule: 'Required skills', result: 'info', detail: 'The job lists no required skills, so skills are not scored.', score: null, weight: null });
  }

  const experienceScore = add('experience', 'Experience level', experienceCheck(candidate, job, profile));
  if (profile && isYears(profile.preferredYears)) {
    const years = candidate.experienceYears;
    const stated = years === null || years === undefined ? 'Experience is not stated.' : `${years} years stated.`;
    checks.push({ rule: 'Preferred experience', result: 'info', detail: `The job's requirement profile prefers ${profile.preferredYears}+ years. ${stated} Not scored.`, score: null, weight: null });
  }

  let preferredSkillScore = null;
  if (preferredSkills.length) {
    preferredSkillScore = round((preferred.matched.length / preferredSkills.length) * 100);
    add('preferredSkills', 'Preferred skills', {
      score: preferredSkillScore,
      result: preferred.missing.length === 0 ? 'pass' : 'info',
      detail: `${preferred.matched.length} of ${preferredSkills.length} preferred skills found by name.`,
    });
  }

  let toolScore = null;
  if (tools.length) {
    toolScore = round((tooling.matched.length / tools.length) * 100);
    let result = 'review';
    if (tooling.missing.length === 0) result = 'pass';
    add('tools', 'Tools and technologies', { score: toolScore, result, detail: `${tooling.matched.length} of ${tools.length} tools and technologies found by name among the candidate's skills.` });
  }

  const domainScore = add('domain', 'Domain relevance', domainCheck(candidate, job, profile ? (profile.domains || []) : []));
  const location = locationCheck(candidate, job, profile);
  const locationScore = location ? add('location', 'Location', location) : 100;
  if (!location) checks.push({ rule: 'Location', result: 'info', detail: 'The job has no location, so location is not scored.', score: null, weight: null });
  const completenessScore = add('completeness', 'Profile completeness', completenessCheck(candidate));

  if (profile) {
    const haystack = statedText(candidate);
    for (const check of [
      namedItemsCheck('Education', profile.education || [], haystack),
      namedItemsCheck('Certifications', profile.certifications || [], haystack),
    ]) if (check) checks.push(check);
    const unscored = [
      [(profile.constraints || []).length, 'other constraint', 'other constraints'],
      [(profile.niceToHave || []).length, 'nice-to-have requirement', 'nice-to-have requirements'],
      [(profile.responsibilities || []).length, 'key responsibility', 'key responsibilities'],
    ].filter(([count]) => count > 0).map(([count, one, many]) => `${count} ${count === 1 ? one : many}`);
    if (unscored.length) {
      checks.push({ rule: 'Other requirements', result: 'info', detail: `The job's requirement profile also lists ${unscored.join(', ')}. The rules do not evaluate these: read them against the resume, or ask for the AI comparison.`, score: null, weight: null });
    }
  }

  checks.push({
    rule: 'Notice period',
    result: 'info',
    detail: candidate.noticePeriod ? `Stated: ${candidate.noticePeriod}. Not scored.` : 'Not stated. Not scored.',
    score: null,
    weight: null,
  });

  const weightTotal = components.reduce((sum, c) => sum + c.weight, 0);
  const totalScore = weightTotal ? round(components.reduce((sum, c) => sum + c.score * c.weight, 0) / weightTotal) : 0;

  return {
    engine: ATS_ENGINE,
    engineVersion: ENGINE_VERSION,
    totalScore,
    skillScore,
    preferredSkillScore,
    toolScore,
    experienceScore,
    domainScore,
    locationScore,
    completenessScore,
    weights: Object.fromEntries(components.map((c) => [c.key, c.weight])),
    // BASELINE: the fixed weights. PROFILE: the job has a requirement
    // profile. JOB: the profile also carries the job's own weights.
    weightSource,
    usedRequirementProfile: Boolean(profile),
    band: matchBand(totalScore),
    requiredSkills,
    matchedSkills: required.matched,
    missingSkills: required.missing,
    preferredMatched: preferred.matched,
    preferredMissing: preferred.missing,
    toolsMatched: tooling.matched,
    toolsMissing: tooling.missing,
    checks,
  };
}

/*
  runEvaluation - evaluates a candidate against a job and stores the
  result (one per candidate and job). Re-running replaces the scores
  and keeps the recruiter's review and any AI comparison.
*/
export async function runEvaluation({ candidateId, jobId, applicationId = null, runByName = 'System' }) {
  const [candidate, job] = await Promise.all([Candidate.findById(candidateId), Job.findById(jobId)]);
  if (!candidate) throw notFound('That candidate was not found.');
  if (!job) throw notFound('That job was not found.');

  const fields = evaluate(candidate, job);
  let result = await ATSResult.findOne({ candidateId: candidate._id, jobId: job._id, engine: ATS_ENGINE });
  if (result) {
    result.set(fields);
    if (applicationId) result.applicationId = applicationId;
  } else {
    result = new ATSResult({ candidateId: candidate._id, jobId: job._id, applicationId, ...fields });
  }
  result.runAt = new Date();
  result.runByName = runByName;
  await result.save();
  return result;
}

/*
  reevaluateJob - runs the rules again for every existing result of one
  job, after its requirement profile changed. Rule-based only: no model
  is called, no result is created, and no application, candidate, label
  or review is touched. Returns how many results were updated.
*/
export async function reevaluateJob({ jobId, runByName = 'System' }) {
  const results = await ATSResult.find({ jobId, engine: ATS_ENGINE }).select('candidateId jobId applicationId');
  let evaluated = 0;
  for (const result of results) {
    try {
      await runEvaluation({ candidateId: result.candidateId, jobId: result.jobId, applicationId: result.applicationId, runByName });
      evaluated += 1;
    } catch (error) {
      // A result whose candidate no longer exists is left as it is.
      if (error?.statusCode !== 404 && error?.status !== 404) throw error;
    }
  }
  return { evaluated, total: results.length };
}
