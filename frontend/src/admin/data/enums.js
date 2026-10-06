/*
  Enumerations the admin screens need. They mirror
  backend/src/config/constants.js exactly: the API refuses any other
  spelling, so a value added or renamed there must be changed here too.

  The API stores and expects the enum value (IN_PROGRESS). People read
  the label ("In progress"). Selects and badges show label(value) and
  always send the value.
*/

export const ROLES = ['SUPER_ADMIN', 'RECRUITER', 'HIRING_MANAGER', 'CONTENT_MANAGER'];

// An application is New until a recruiter shortlists it. That is the
// whole workflow, and the status is set only by the shortlist action.
export const APPLICATION_STATUSES = ['NEW', 'SHORTLISTED'];
// Tags for the team. Not stages: a label changes no status and sends
// nothing. Candidates and applications can both carry them.
export const RECRUITMENT_LABELS = ['INTERVIEWED', 'REJECTED', 'SELECTED'];
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

export const LOCATION_TYPES = ['office', 'network'];
export const LOCATION_STATUSES = ['active', 'listed', 'planned', 'inactive'];

export const ATS_REVIEW_STATES = ['PENDING', 'ADVANCE', 'HOLD', 'REJECT'];

// Labels that sentence case alone would get wrong.
const SPECIAL_LABELS = { LINKEDIN: 'LinkedIn', ON_SITE: 'On site' };

// Text that is written in capitals but is not an enum value.
const KEPT_AS_WRITTEN = ['RPO'];

// label('IN_PROGRESS') -> 'In progress'. Anything that is not written
// as an enum value (a job category, 'published', a city) is returned
// unchanged.
export function label(value) {
  const text = String(value ?? '');
  if (SPECIAL_LABELS[text]) return SPECIAL_LABELS[text];
  if (KEPT_AS_WRITTEN.includes(text) || !/^[A-Z][A-Z0-9]*(_[A-Z0-9]+)*$/.test(text)) return text;
  const words = text.toLowerCase().replace(/_/g, ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}
