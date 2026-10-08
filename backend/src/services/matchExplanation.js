import { skillKey } from './resume/skillTaxonomy.js';

/*
  MATCH EXPLANATION AND SKILL GAPS.

  Pure functions: no database, no network, no model. They take a stored
  rule-based ATS result (models/ATSResult.js) and lay out what it
  already says, in a shape the admin can display. They add no reasons
  of their own: every statement comes from the result's scores, skill
  lists and `checks`, which the rule-based engine (services/atsService.js)
  wrote. Where a part was not scored, they say so instead of guessing.

  buildMatchExplanation(result)
    The score and band, each scored part with its weight, its share of
    the total and the engine's own wording, the skill lists, and the
    checks the engine listed without scoring.

  buildSkillGap({ result, profileSkills, resume })
    The job's skills the profile lacks (required, preferred, tools),
    each marked when the resume text names it although the approved
    profile does not, and the skills the candidate has that the job
    does not ask for. Skills are compared by the same exact key the ATS
    uses: a similar skill is not the same skill.
*/

const PARTS = [
  { key: 'skills', rule: 'Required skills', label: 'Required skills' },
  { key: 'experience', rule: 'Experience level', label: 'Experience' },
  { key: 'preferredSkills', rule: 'Preferred skills', label: 'Preferred skills' },
  { key: 'tools', rule: 'Tools and technologies', label: 'Tools and technologies' },
  { key: 'domain', rule: 'Domain relevance', label: 'Domain relevance' },
  { key: 'location', rule: 'Location', label: 'Location' },
  { key: 'completeness', rule: 'Profile completeness', label: 'Profile completeness' },
];
const SCORED_RULES = new Set(PARTS.map((part) => part.rule));

const WEIGHT_SOURCES = {
  BASELINE: 'Baseline weights',
  PROFILE: 'Requirement profile, default weights',
  JOB: "This job's own weights",
};

const plain = (value) => (value && typeof value.toObject === 'function' ? value.toObject() : value || {});
const list = (value) => (Array.isArray(value) ? [...value] : []);
const round1 = (value) => Math.round(value * 10) / 10;

function skillSet(matched, missing) {
  const have = list(matched);
  const lack = list(missing);
  const total = have.length + lack.length;
  return { matched: have, missing: lack, total, applies: total > 0 };
}

/*
  One scored part. `status` is the engine's result for its check (pass,
  review, fail, info), or not_applicable when the engine listed no check
  for it or left it out (a job with no preferred skills, for example).
  `counted` is false for a part the job weights at 0. `contribution`
  is the points the part added to the total: score x weight / sum of
  the weights counted, which is how the engine adds them up.
*/
// A part is scored when the engine gave its check a number, and counted
// when the result also carries a weight for it (`weights` holds only the
// parts the engine added into the total).
const scoredCheck = (checks, definition) => {
  const check = checks.find((item) => item.rule === definition.rule) || null;
  return { check, scored: Boolean(check) && typeof check.score === 'number' };
};

function part(definition, checks, weights, weightTotal) {
  const { check, scored } = scoredCheck(checks, definition);
  const weight = scored ? Number(weights[definition.key]) || 0 : 0;
  const counted = weight > 0;
  return {
    key: definition.key,
    label: definition.label,
    status: scored ? check.result : 'not_applicable',
    score: scored ? check.score : null,
    weight,
    counted,
    share: counted && weightTotal ? Math.round((weight / weightTotal) * 100) : 0,
    contribution: counted && weightTotal ? round1((check.score * weight) / weightTotal) : 0,
    detail: check ? check.detail : 'Not evaluated for this job.',
  };
}

export function buildMatchExplanation(input) {
  const result = plain(input);
  const checks = list(result.checks).map((check) => plain(check));
  const weights = result.weights && typeof result.weights === 'object' ? result.weights : {};
  const weightTotal = PARTS.reduce((sum, definition) => {
    const { scored } = scoredCheck(checks, definition);
    return scored ? sum + (Number(weights[definition.key]) || 0) : sum;
  }, 0);

  const parts = PARTS.map((definition) => part(definition, checks, weights, weightTotal));
  const byKey = Object.fromEntries(parts.map((item) => [item.key, item]));
  const skills = {
    required: skillSet(result.matchedSkills, result.missingSkills),
    preferred: skillSet(result.preferredMatched, result.preferredMissing),
    tools: skillSet(result.toolsMatched, result.toolsMissing),
  };

  // In the engine's own words: what passed, and what it asks a person to
  // look at. Only counted parts; the others are not part of the score.
  const strengths = parts.filter((item) => item.counted && item.status === 'pass').map((item) => ({ key: item.key, label: item.label, detail: item.detail }));
  const concerns = parts.filter((item) => item.counted && (item.status === 'review' || item.status === 'fail')).map((item) => ({ key: item.key, label: item.label, status: item.status, detail: item.detail }));
  // Checks the engine listed without a score (education, certifications,
  // notice period and the like), and parts the job does not count.
  const notes = checks
    .filter((check) => !SCORED_RULES.has(check.rule) || typeof check.score !== 'number')
    .map((check) => ({ rule: check.rule, status: check.result, detail: check.detail }));

  const summary = [`${result.totalScore}/100: ${result.band || 'no band'}.`];
  if (skills.required.applies) {
    summary.push(`${skills.required.matched.length} of ${skills.required.total} required skills found by name${skills.required.missing.length ? `; missing: ${skills.required.missing.join(', ')}` : ''}.`);
  }
  if (skills.preferred.applies) summary.push(`${skills.preferred.matched.length} of ${skills.preferred.total} preferred skills found by name.`);
  if (skills.tools.applies) summary.push(`${skills.tools.matched.length} of ${skills.tools.total} tools found by name.`);
  for (const key of ['experience', 'domain', 'location', 'completeness']) {
    if (byKey[key].counted) summary.push(`${byKey[key].label}: ${byKey[key].detail}`);
  }

  const review = plain(result.review);
  return {
    engine: result.engine || 'RULE_BASED',
    engineVersion: result.engineVersion || '',
    totalScore: result.totalScore,
    band: result.band || '',
    weightSource: result.weightSource || 'BASELINE',
    weightSourceLabel: WEIGHT_SOURCES[result.weightSource] || WEIGHT_SOURCES.BASELINE,
    usedRequirementProfile: Boolean(result.usedRequirementProfile),
    parts,
    experience: byKey.experience,
    domain: byKey.domain,
    location: byKey.location,
    completeness: byKey.completeness,
    skills,
    strengths,
    concerns,
    notes,
    summary,
    review: {
      state: review.state || 'PENDING',
      stale: Boolean(review.stale),
      scoreAtReview: review.scoreAtReview ?? null,
    },
    runAt: result.runAt || null,
  };
}

// ------------------------------------------------------------ skill gaps

const escape = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// The line of the resume text that names a skill by its exact name, as
// a whole word, in any case; null when it does not. No other spelling
// counts.
export function findMention(text, skill) {
  const name = String(skill || '').trim();
  if (!text || !name) return null;
  const pattern = new RegExp(`(?<![\\p{L}\\p{N}+#])${name.split(/\s+/).map(escape).join('\\s+')}(?![\\p{L}\\p{N}+#])`, 'iu');
  const match = pattern.exec(text);
  if (!match) return null;
  const start = text.lastIndexOf('\n', match.index) + 1;
  const end = text.indexOf('\n', match.index);
  const line = text.slice(start, end === -1 ? undefined : end).trim();
  return line.length > 200 ? `${line.slice(0, 199)}…` : line;
}

const MENTIONED = 'Mentioned in resume but not in approved profile';
const NOT_IN_PROFILE = 'Not in the approved profile';

function gapItems(skills, resume) {
  return list(skills).map((skill) => {
    const evidence = resume?.text ? findMention(resume.text, skill) : null;
    return evidence
      ? { skill, status: 'MENTIONED_IN_RESUME', label: MENTIONED, evidence }
      : { skill, status: 'NOT_IN_PROFILE', label: NOT_IN_PROFILE, evidence: null };
  });
}

/*
  buildSkillGap
    result         the ATS result
    profileSkills  the candidate's trusted (approved) skills
    resume         optional: { text, skills, extractionId, status } from
                   the candidate's resume extraction. `text` is used only
                   to find exact mentions here and is not returned.
*/
export function buildSkillGap({ result: input, profileSkills = [], resume = null }) {
  const result = plain(input);
  const jobSkills = [...list(result.requiredSkills), ...list(result.preferredMatched), ...list(result.preferredMissing), ...list(result.toolsMatched), ...list(result.toolsMissing)];
  const jobKeys = new Set(jobSkills.map(skillKey));
  const profileKeys = new Set(list(profileSkills).map(skillKey));

  const additionalProfile = [];
  const seen = new Set();
  for (const skill of list(profileSkills)) {
    const key = skillKey(skill);
    if (!key || jobKeys.has(key) || seen.has(key)) continue;
    seen.add(key);
    additionalProfile.push(skill);
  }
  // Skills read from the resume that are neither in the approved profile
  // nor asked for by the job.
  const additionalResume = [];
  for (const skill of list(resume?.skills)) {
    const key = skillKey(skill);
    if (!key || jobKeys.has(key) || profileKeys.has(key) || seen.has(key)) continue;
    seen.add(key);
    additionalResume.push({ skill, label: 'In the resume, not in the approved profile' });
  }

  const missingRequired = gapItems(result.missingSkills, resume);
  const missingPreferred = gapItems(result.preferredMissing, resume);
  const missingTools = gapItems(result.toolsMissing, resume);
  const all = [...missingRequired, ...missingPreferred, ...missingTools];
  return {
    missingRequired,
    missingPreferred,
    missingTools,
    additionalProfileSkills: additionalProfile,
    additionalResumeSkills: additionalResume,
    counts: {
      missingRequired: missingRequired.length,
      missingPreferred: missingPreferred.length,
      missingTools: missingTools.length,
      mentionedInResume: all.filter((item) => item.status === 'MENTIONED_IN_RESUME').length,
    },
    resume: resume
      ? { checked: Boolean(resume.text), extractionId: resume.extractionId || null, status: resume.status || null }
      : { checked: false, extractionId: null, status: null },
    note: 'Skills are compared by exact name, as the ATS compares them. A skill mentioned only in the resume is not counted until a recruiter adds it to the profile.',
  };
}
