// The eight stages every ATS evaluation passes through, in order. The
// screens draw this sequence wherever a result or the process is shown,
// so the product never reads as "resume in, percentage out".
export const ATS_STAGES = [
  { key: 'resume', label: 'Resume', sub: 'Received and stored privately' },
  { key: 'extraction', label: 'Extraction', sub: 'Text and fields read from the file' },
  { key: 'profile', label: 'Structured profile', sub: 'Skills, experience, education' },
  { key: 'job', label: 'Job description', sub: 'Requirements parsed' },
  { key: 'rules', label: 'Rule-based checks', sub: 'Deterministic and exact' },
  { key: 'semantic', label: 'AI comparison', sub: 'Meaning, not keywords' },
  { key: 'explanation', label: 'Match explanation', sub: 'Reasons with evidence' },
  { key: 'review', label: 'Recruiter review', sub: 'A person decides' },
];
