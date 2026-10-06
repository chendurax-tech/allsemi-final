/*
  Shared enumerations. Models, validators, the seed and the admin API
  all read these, so a status can only be spelled one way.
*/

export const ROLES = ['SUPER_ADMIN', 'RECRUITER', 'HIRING_MANAGER', 'CONTENT_MANAGER'];

/*
  The recruitment workflow is deliberately small.

  An application has two states: it arrives as NEW and a recruiter
  shortlists it. Shortlisting is the one workflow action: it is done
  through its own endpoint, is audited and sends the candidate an
  email. The status cannot be set any other way.

  INTERVIEWED, REJECTED and SELECTED are LABELS. A label is a tag staff
  put on a candidate or an application to find it again. It is not a
  stage: adding or removing one changes no status and sends nothing.
*/
export const APPLICATION_STATUSES = ['NEW', 'SHORTLISTED'];
export const RECRUITMENT_LABELS = ['INTERVIEWED', 'REJECTED', 'SELECTED'];

// What happened to the shortlist email for an application.
//   NOT_SENT        nothing has been attempted
//   SENDING         an attempt is in progress
//   SENT            the email service accepted the message
//   LOGGED          EMAIL_DRIVER=log: written to the server log, not sent
//   NOT_CONFIGURED  the email service has no credentials yet
//   FAILED          the email service refused or could not be reached
export const SHORTLIST_EMAIL_STATES = ['NOT_SENT', 'SENDING', 'SENT', 'LOGGED', 'NOT_CONFIGURED', 'FAILED'];

// The statuses used before the workflow was reduced, and what each
// becomes. Read by scripts/migrate-recruitment.js only.
export const LEGACY_STATUS_MAP = {
  SCREENING: { status: 'NEW', label: null },
  INTERVIEW: { status: 'SHORTLISTED', label: 'INTERVIEWED' },
  SELECTED: { status: 'SHORTLISTED', label: 'SELECTED' },
  REJECTED: { status: 'NEW', label: 'REJECTED' },
  WITHDRAWN: { status: 'NEW', label: null },
};
export const APPLICATION_SOURCES = ['WEBSITE', 'REFERRAL', 'LINKEDIN', 'RECRUITER'];

export const REQUIREMENT_STATUSES = ['NEW', 'REVIEWING', 'CONTACTED', 'IN_PROGRESS', 'CLOSED'];
export const REQUIREMENT_PRIORITIES = ['HIGH', 'MEDIUM', 'LOW'];
export const HIRING_TYPES = ['Permanent Staffing', 'Project Staffing', 'RPO', 'Specialised Search'];
export const WORK_MODES = ['ON_SITE', 'HYBRID', 'REMOTE'];

export const REFERRAL_STATUSES = ['NEW', 'REVIEWING', 'CONTACTED', 'SHORTLISTED', 'REJECTED', 'CONVERTED'];

export const ENQUIRY_TYPES = ['HIRING', 'CAREER', 'PARTNERSHIP', 'GENERAL', 'OTHER'];
export const ENQUIRY_STATUSES = ['NEW', 'IN_PROGRESS', 'CLOSED'];

export const JOB_STATUSES = ['draft', 'published', 'archived'];
export const CONTENT_STATUSES = ['draft', 'published'];
export const EMPLOYMENT_TYPES = ['Full-time', 'Contract', 'Contract-to-hire'];
export const EXPERIENCE_LEVELS = ['Entry-Level', 'Mid-Level', 'Mid-Senior', 'Senior', 'Lead / Principal'];

// The minimum years each job level implies. The rule-based ATS reads it.
export const LEVEL_MIN_YEARS = {
  'Entry-Level': 0,
  'Mid-Level': 2,
  'Mid-Senior': 4,
  Senior: 7,
  'Lead / Principal': 10,
};

export const LOCATION_TYPES = ['office', 'network'];
export const LOCATION_STATUSES = ['active', 'listed', 'planned', 'inactive'];

export const ATS_REVIEW_STATES = ['PENDING', 'ADVANCE', 'HOLD', 'REJECT'];
export const ATS_ENGINE = 'RULE_BASED';

// Limits on a stored AI comparison, in characters and items. The model
// is told these numbers, the answer is cut to them when it is validated
// (services/aiService.js) and the ATS result model stores no more.
export const AI_COMPARISON_LIMITS = {
  summary: 1200,
  relevantExperience: 1200,
  qualificationAssessment: 800,
  recommendation: 800,
  skills: { maxItems: 60, maxLength: 80 }, // matchedSkills, missingSkills
  points: { maxItems: 10, maxLength: 300 }, // experienceGaps, strengths, concerns
  model: 100,
};

// Upload limits and the document types each kind of upload accepts.
export const MAX_DOCUMENT_BYTES = 5 * 1024 * 1024;
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const DOCUMENT_TYPES = ['pdf', 'doc', 'docx'];
export const IMAGE_TYPES = ['jpg', 'png', 'webp'];

export const SESSION_COOKIE = 'allsemis_sid';
