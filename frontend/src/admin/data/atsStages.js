// The stages an evaluation passes through in this release, in order.
// The screens draw this sequence wherever a result or the process is
// shown, so the product never reads as "resume in, percentage out".
// Every stage here is something the rule-based engine really does:
// there is no resume text extraction. The AI comparison is not a stage:
// it is a separate step a recruiter may start on the result screen.
export const ATS_STAGES = [
  { key: 'resume', label: 'Resume', sub: 'Stored privately' },
  { key: 'profile', label: 'Profile', sub: 'From the application form' },
  { key: 'job', label: 'Job requirements', sub: 'Skills, level and location' },
  { key: 'rules', label: 'Rule-based checks', sub: 'Deterministic and exact' },
  { key: 'score', label: 'Score', sub: 'Weighted total out of 100' },
  { key: 'review', label: 'Recruiter review', sub: 'A person decides' },
];

export const ATS_STAGE_COLUMNS = 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-6';

// The scored components of a result, in the order the engine applies
// them. `weight` names the key in result.weights; a component the
// engine left out (a job with no preferred skills, for example) has no
// weight there and is shown as not scored. `rule` is the name of the
// check the engine lists for the component. "Tools and technologies"
// exists only for a job whose requirement profile lists tools.
export const ATS_COMPONENTS = [
  { score: 'skillScore', weight: 'skills', label: 'Required skills', rule: 'Required skills' },
  { score: 'experienceScore', weight: 'experience', label: 'Experience', rule: 'Experience level' },
  { score: 'preferredSkillScore', weight: 'preferredSkills', label: 'Preferred skills', rule: 'Preferred skills' },
  { score: 'toolScore', weight: 'tools', label: 'Tools and technologies', rule: 'Tools and technologies' },
  { score: 'domainScore', weight: 'domain', label: 'Domain relevance', rule: 'Domain relevance' },
  { score: 'locationScore', weight: 'location', label: 'Location', rule: 'Location' },
  { score: 'completenessScore', weight: 'completeness', label: 'Profile completeness', rule: 'Profile completeness' },
];

// Which weights a result was scored with (result.weightSource).
//   BASELINE  the job had no requirement profile
//   PROFILE   it had one, without weights of its own
//   JOB       it had one that carries the job's own weights
export const WEIGHT_SOURCE_LABELS = {
  BASELINE: 'Baseline weights',
  PROFILE: 'Requirement profile, default weights',
  JOB: "This job's own weights",
};
