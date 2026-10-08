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
// The last three are no longer made (the website assistant is rule-based;
// semantic matching and AI Job Intelligence are future scope). They stay
// so that ledger entries an earlier build wrote can still be read.
export const AI_OPERATIONS = ['CANDIDATE_COMPARISON', 'JOB_REQUIREMENTS', 'CANDIDATE_RANKING', 'PUBLIC_CHAT', 'EMBEDDING', 'JOB_INTELLIGENCE'];
/*
  The public website chat (services/chat/, rule-based). Limits on what a
  visitor may send and on what an answer shows, in characters and items.
  The conversation itself is never stored on the server.
*/
export const CHAT_LIMITS = {
  message: 1000,
  historyItems: 10,
  historyText: 1500,
  contextJobs: 10,
  jobsShown: 5,
  knowledgeChunks: 4,
};
export const CHAT_INTENTS = ['greeting', 'restricted', 'private_data', 'job_search', 'job_detail', 'apply', 'contact', 'company', 'general'];

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

/*
  Resume text extraction (services/resume/textExtractor.js). Runs only
  when a recruiter asks for it, on a resume that is already stored.
  Local parsing only: no AI service and no OCR. Legacy .doc files are
  not read in this phase.
    maxFileBytes        a stored file larger than this is not read
    maxPages            PDF pages read; the rest are skipped
    maxTextChars        the text kept (and stored) is cut to this
    timeoutMs           the whole extraction gives up after this
    maxDocxEntries      entries in a DOCX zip
    maxDocxUnpackedBytes  the declared unpacked size of a DOCX
    minTextChars        less readable text than this counts as no text
*/
export const RESUME_EXTRACTION_TYPES = ['pdf', 'docx'];
export const RESUME_EXTRACTION_LIMITS = {
  maxFileBytes: MAX_DOCUMENT_BYTES,
  maxPages: 30,
  maxTextChars: 30_000,
  timeoutMs: 15_000,
  maxDocxEntries: 1000,
  maxDocxUnpackedBytes: 30 * 1024 * 1024,
  minTextChars: 40,
};
// What an extraction ended as.
//   EXTRACTED    text was read (it may have been cut: see `truncated`)
//   NO_TEXT      the file has no readable text: a scanned image, or empty
//   UNSUPPORTED  not a PDF or a DOCX (a legacy .doc, for example)
//   MALFORMED    the file could not be parsed
//   PROTECTED    a password-protected PDF
//   TOO_LARGE    the file, or its unpacked content, is over the limits
//   TIMEOUT      parsing took longer than timeoutMs
//   UNAVAILABLE  the stored file could not be read
export const RESUME_EXTRACTION_STATUSES = ['EXTRACTED', 'NO_TEXT', 'UNSUPPORTED', 'MALFORMED', 'PROTECTED', 'TOO_LARGE', 'TIMEOUT', 'UNAVAILABLE'];

/*
  A stored resume extraction draft (models/ResumeExtraction.js).
    PENDING    the extraction has started
    EXTRACTED  text was read and parsed: a draft is ready for review
    FAILED     the resume could not be read (see failureReason)
    NO_TEXT    the resume has no readable text (a scanned image)
    APPROVED   a recruiter applied chosen fields to the candidate
    DISCARDED  a recruiter dropped the draft; nothing was applied
*/
export const RESUME_DRAFT_STATUSES = ['PENDING', 'EXTRACTED', 'FAILED', 'NO_TEXT', 'APPROVED', 'DISCARDED'];

// The candidate fields a recruiter may apply from a draft. The email is
// not one of them: it identifies the candidate record and is never
// changed from a resume.
export const RESUME_APPROVAL_FIELDS = ['name', 'phone', 'location', 'headline', 'skills', 'experienceYears', 'experience', 'education', 'certifications', 'projects'];
// The list fields, which can be added to the candidate's existing list
// instead of replacing it.
export const RESUME_APPROVAL_LIST_FIELDS = ['skills', 'experience', 'education', 'certifications', 'projects'];

// Limits on the profile lists a candidate holds (models/Candidate.js),
// shared by the model and the approval validator.
export const CANDIDATE_PROFILE_LIMITS = {
  skills: 60,
  experience: { maxItems: 20, title: 160, employer: 160, period: 80, highlights: { maxItems: 8, maxLength: 300 } },
  education: { maxItems: 10, degree: 160, institution: 160, year: 20 },
  certifications: { maxItems: 20, maxLength: 200 },
  projects: { maxItems: 15, name: 160, period: 80, role: 160, description: 1000, highlights: { maxItems: 8, maxLength: 300 }, technologies: 30 },
};

export const SESSION_COOKIE = 'allsemis_sid';
