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

/*
  Emails a recruiter sends to a candidate about an application, each by
  its own button, after the label it belongs to has been added:
    regret     the application carries the REJECTED label
    selection  the application carries the SELECTED label
  Adding a label never sends one. Each has the same states as the
  shortlist email and is sent at most once per application.
*/
export const DECISION_EMAILS = {
  regret: { label: 'REJECTED', other: 'SELECTED', template: 'regretNotification', name: 'regret email' },
  selection: { label: 'SELECTED', other: 'REJECTED', template: 'selectionNotification', name: 'selection email' },
};

/*
  The email record (models/EmailLog.js).

  EMAIL_KINDS: who an email is for.
    TEAM_NOTIFICATION   to ADMIN_NOTIFICATION_EMAIL, automatic
    ACKNOWLEDGEMENT     to the person who sent a form, automatic
    CANDIDATE_DECISION  to a candidate, only by a recruiter's action
  EMAIL_LOG_STATES: SHORTLIST_EMAIL_STATES plus CAPPED, an
  acknowledgement that was not sent because the address had already
  received several within the hour.
  EMAIL_FAILURE_CATEGORIES: why the email service did not take a
  message, as one word. `sender_not_verified` is the one that needs an
  administrator: the domain in EMAIL_FROM is not verified in Resend, so
  Resend refuses every message from it.
*/
export const EMAIL_KINDS = ['TEAM_NOTIFICATION', 'ACKNOWLEDGEMENT', 'CANDIDATE_DECISION'];
export const EMAIL_LOG_STATES = [...SHORTLIST_EMAIL_STATES, 'CAPPED'];
export const EMAIL_FAILURE_CATEGORIES = ['sender_not_verified', 'invalid_sender', 'credentials', 'quota', 'rate_limited', 'recipient', 'provider', 'timeout', 'network', 'rejected', 'no_recipient'];

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
  domainRelevance: 800,
  skills: { maxItems: 60, maxLength: 80 }, // matchedSkills, missingSkills
  // experienceGaps, strengths, concerns, strongMatches, partialMatches,
  // missingRequirements, transferableSkills, uncertainties
  points: { maxItems: 10, maxLength: 300 },
  evidence: { maxItems: 12, requirement: 160, text: 300 },
  model: 100,
};

/*
  The requirement profile of a job (models/Job.js): what the job asks
  for, in a structured form. The same limits apply to a profile a
  recruiter types and to a draft the model returns.
*/
export const WORK_ARRANGEMENTS = ['', 'ON_SITE', 'HYBRID', 'REMOTE'];
export const REQUIREMENT_PROFILE_SOURCES = ['MANUAL', 'AI_REVIEWED'];
export const REQUIREMENT_PROFILE_LIMITS = {
  skills: { maxItems: 40, maxLength: 80 }, // requiredSkills, preferredSkills, tools, domains
  lines: { maxItems: 20, maxLength: 300 }, // education, certifications, responsibilities, niceToHave, constraints
  text: 400, // requiredExperience, preferredExperience
  short: 120, // seniority, location
  years: 50,
};
// The parts of the rule-based score a job can weight, in the order they
// are shown. `tools` only exists for a job with a requirement profile.
export const ATS_WEIGHT_KEYS = ['skills', 'experience', 'preferredSkills', 'tools', 'domain', 'location', 'completeness'];

// A comparison of several candidates for one job (models/Job.js).
export const CANDIDATE_COMPARISON_LIMITS = {
  minCandidates: 2,
  maxCandidates: 5,
  summary: 1500,
  text: 600,
  points: { maxItems: 8, maxLength: 300 },
  requirements: { maxItems: 12, requirement: 160, note: 300 },
};

/*
  The internal AI usage ledger (models/AiUsage.js).

  AI_OPERATIONS: what the request was for.
  AI_ERROR_CATEGORIES: why a request failed, as one word. `quota` is the
  one that needs an administrator: the OpenAI account has no credit
  left, has reached its spend limit or has no active billing.
*/
export const AI_OPERATIONS = ['CANDIDATE_COMPARISON', 'JOB_REQUIREMENTS', 'CANDIDATE_RANKING'];
export const AI_ERROR_CATEGORIES = ['quota', 'rate_limit', 'auth', 'model', 'bad_request', 'timeout', 'network', 'provider', 'invalid_response', 'refused'];
export const AI_USAGE_LEVELS = ['healthy', 'notice', 'warning', 'critical'];

/*
  List prices this code knows, in US dollars per million tokens, used
  to ESTIMATE spend when OPENAI_INPUT_COST_PER_1M_TOKENS and
  OPENAI_OUTPUT_COST_PER_1M_TOKENS are not set. A model name matches
  when it is the entry or a dated version of it ("gpt-5.4-mini-2026-...").
  Prices change: check them against OpenAI's pricing page and set the
  two variables when they differ. gpt-5.4-mini checked on 2026-10-06.
*/
export const MODEL_LIST_PRICES = {
  'gpt-5.4-mini': { input: 0.75, output: 4.5 },
};

// Upload limits and the document types each kind of upload accepts.
export const MAX_DOCUMENT_BYTES = 5 * 1024 * 1024;
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const DOCUMENT_TYPES = ['pdf', 'doc', 'docx'];
export const IMAGE_TYPES = ['jpg', 'png', 'webp'];

export const SESSION_COOKIE = 'allsemis_sid';
