import { JOBS } from '../../pages/talent/jobsContent.js';
import { ALL_ARTICLES } from '../../lib/insightsContent.js';
import { SECTORS } from '../../components/Expertise.jsx';
import { SECTOR_CONTENT, SECTOR_INSIGHT_SLUG } from '../../pages/expertise/sectorContent.js';
import { EXPERTISE_SLUGS } from '../../lib/expertiseRoutes.js';
import { SERVICES } from '../../pages/employers/servicesContent.js';
import { LOCATIONS } from '../../lib/officeLocations.js';
import { CANDIDATES, APPLICATIONS, REQUIREMENTS, ENQUIRIES, ATS_BASE } from './recruitment.js';
import { SITE_CONTENT, STORIES } from './siteContent.js';

/*
  buildSeed - the admin panel's starting state.

  Website content is read from the SAME modules the public site reads
  (jobs, articles, sectors, services, locations), so the admin screens
  show the real current content rather than a second copy. Recruitment
  records (candidates, applications, requirements, enquiries, ATS
  results) are sample data from recruitment.js.

  The state lives in memory for this UI phase: edits work during a
  session and reset on reload. The collection names and record shapes
  are the contract the backend API will implement.
*/

const LEVEL_MIN_YEARS = { 'Entry-Level': 0, 'Mid-Level': 2, 'Mid-Senior': 4, Senior: 7, 'Lead / Principal': 10 };

export function matchBand(overall) {
  if (overall >= 85) return 'Strong match';
  if (overall >= 70) return 'Good match';
  if (overall >= 50) return 'Partial match';
  return 'Low match';
}

// The rule-based layer: deterministic, explainable checks computed from
// the structured candidate profile and the job record. Exact-name skill
// matching is deliberately strict; the AI layer's semantic reading
// (stored per evaluation) is shown beside it, not merged into it.
function buildAtsResult(base, candidate, job) {
  const has = (skill) => candidate.skills.some((s) => s.toLowerCase() === skill.toLowerCase());
  const matchedSkills = job.requiredSkills.filter(has);
  const missingSkills = job.requiredSkills.filter((s) => !has(s));
  const preferredMatched = job.preferredSkills.filter(has);
  const preferredMissing = job.preferredSkills.filter((s) => !has(s));
  const minYears = LEVEL_MIN_YEARS[job.experienceLevel] ?? 0;
  const flexibleLocation = job.location === 'Hybrid' || job.location.startsWith('Remote');
  const sameCity = candidate.location.startsWith('Bengaluru');
  const ratio = matchedSkills.length / job.requiredSkills.length;

  let skillResult = 'fail';
  if (missingSkills.length === 0) skillResult = 'pass';
  else if (ratio >= 0.5) skillResult = 'review';

  let locationDetail = `Candidate is in ${candidate.location}. Role is in ${job.location}`;
  if (flexibleLocation) locationDetail = `Role is ${job.location}`;
  else if (sameCity) locationDetail = 'Candidate is in the role location';

  const ruleChecks = [
    { rule: 'Required skills present', result: skillResult, detail: `${matchedSkills.length} of ${job.requiredSkills.length} required skills found by exact name` },
    { rule: 'Experience level', result: candidate.experienceYears >= minYears ? 'pass' : 'review', detail: `${candidate.experienceYears} years stated. ${job.experienceLevel} is set at ${minYears}+ years` },
    { rule: 'Location', result: flexibleLocation || sameCity ? 'pass' : 'review', detail: locationDetail },
    { rule: 'Resume extraction', result: candidate.resume.extraction === 'Complete' ? 'pass' : 'review', detail: candidate.resume.extraction === 'Complete' ? 'All sections parsed' : 'Part of the document needs a manual check' },
  ];

  const history = [
    { at: candidate.resume.uploadedAt, actor: 'System', action: 'Resume received and stored' },
    { at: candidate.resume.uploadedAt, actor: 'System', action: 'Extraction completed. Structured profile created' },
    { at: base.runAt, actor: 'System', action: `Evaluated against ${job.title}: rule checks, then AI comparison` },
  ];
  if (base.review.updatedAt) {
    history.push({ at: base.review.updatedAt, actor: base.review.reviewer, action: `Recruiter review set to "${base.review.state}"` });
  }

  return {
    ...base,
    band: matchBand(base.overall),
    requiredSkills: job.requiredSkills,
    matchedSkills,
    missingSkills,
    preferredMatched,
    preferredMissing,
    experienceRequired: `${job.experienceLevel} (${minYears}+ years)`,
    ruleChecks,
    history,
  };
}

export function buildSeed() {
  const jobs = JOBS.map((job) => ({ ...job }));
  const candidates = CANDIDATES.map((c) => ({ ...c, extraction: c.resume.extraction }));

  const atsResults = ATS_BASE.map((base) => buildAtsResult(
    base,
    candidates.find((c) => c.id === base.candidateId),
    jobs.find((j) => j.id === base.jobId),
  ));

  const activity = atsResults
    .flatMap((r) => r.history.slice(2).map((h, i) => ({ id: `${r.id}-${i}`, ...h, candidateId: r.candidateId, jobId: r.jobId })))
    .sort((a, b) => (a.at < b.at ? 1 : -1));

  return {
    jobs,
    candidates,
    applications: APPLICATIONS.map((a) => ({ ...a })),
    requirements: REQUIREMENTS.map((r) => ({ ...r })),
    enquiries: ENQUIRIES.map((e) => ({ ...e })),
    atsResults,
    activity,
    insights: ALL_ARTICLES.map((a) => ({ id: a.slug, ...a })),
    stories: STORIES.map((s) => ({ ...s })),
    expertise: SECTORS.map((s) => {
      const content = SECTOR_CONTENT[s.id] || {};
      return {
        id: s.id,
        num: s.num,
        name: s.name,
        shortName: s.shortName,
        slug: EXPERTISE_SLUGS[s.id],
        desc: s.desc,
        image: s.image,
        alt: s.alt,
        introduction: content.introduction || '',
        overview: content.domainOverview || '',
        domains: content.domains || [],
        roles: content.roles || [],
        hiringChallenges: (content.hiringChallenges || []).map((h) => `${h.title}: ${h.detail}`),
        relatedInsight: SECTOR_INSIGHT_SLUG[s.id] || '',
        status: 'published',
      };
    }),
    services: SERVICES.map((s) => ({
      id: s.id,
      num: s.num,
      name: s.name,
      slug: s.slug,
      icon: s.icon,
      status: s.status,
      description: s.description,
      headline: s.page.headline,
      lead: s.page.lead,
      fit: s.page.fit,
      process: s.page.process.map((p) => `${p.label}: ${p.detail}`),
      receive: s.page.receive,
      ctaLabel: s.cta.label,
      ctaTo: s.cta.to,
    })),
    locations: LOCATIONS.map((l) => ({
      id: l.id,
      city: l.city,
      country: l.country,
      region: l.region,
      type: l.type,
      status: l.status,
      address: l.address,
      phone: l.phone,
      email: l.email,
      lat: l.coordinates[1],
      lon: l.coordinates[0],
      description: l.description,
      labelSide: l.visual?.labelSide || 'right',
      isHeadquarters: !!l.isHeadquarters,
      active: l.active !== false,
    })),
    site: SITE_CONTENT,
  };
}
