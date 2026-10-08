import { Application, Candidate, Job, ResumeExtraction } from '../../models/index.js';
import { RESUME_EXTRACTION_LIMITS, CANDIDATE_PROFILE_LIMITS as L } from '../../config/constants.js';
import { extractResumeText } from './textExtractor.js';
import { parseResume } from './resumeParser.js';
import { normaliseSkills, skillKey } from './skillTaxonomy.js';
import { approvalValueSchemas } from '../../validators/resumeExtraction.js';
import { zodDetails } from '../../middleware/validate.js';
import { record, changedFields } from '../auditService.js';
import { notFound, badRequest, conflict, validationError } from '../../utils/AppError.js';
import { logger } from '../../utils/logger.js';
import { reevaluateAfterApproval } from './approvalReevaluation.js';

/*
  RESUME EXTRACTION DRAFTS AND RECRUITER APPROVAL.

  The trust boundary. What an applicant sends through the public form
  is untrusted, and so is everything read from their resume. Reading a
  resume therefore only ever produces a draft (models/ResumeExtraction.js)
  and never changes the candidate. A recruiter reads the draft and
  approves the fields they choose; only then, and only those fields,
  are written to the candidate. Every step is audited.

    createExtraction   a recruiter asks for the resume of one
                       application to be read. One draft is stored,
                       whatever the outcome. The candidate is untouched.
    approveExtraction  the chosen fields, as the recruiter edited them,
                       are written to the candidate. The draft becomes
                       APPROVED and records what was applied.
    discardExtraction  the draft becomes DISCARDED and its text is
                       cleared. The candidate is untouched.

  After an approval the rule-based ATS is run again for the candidate
  (approvalReevaluation.js), with its own rules and weights; a failure
  there is reported and never undoes the approval. Nothing here calls
  an AI service, changes an application or sends an email. The resume text is never logged and
  never written to the audit log: the log holds field names, counts and
  ids.
*/

// The extractor's outcome as the status of the draft.
function draftStatus(extracted) {
  if (extracted.status === 'EXTRACTED') return 'EXTRACTED';
  if (extracted.status === 'NO_TEXT') return 'NO_TEXT';
  return 'FAILED';
}

// The skills the job of this application asks for, so the parser also
// recognises a job-specific skill the taxonomy does not know.
function jobSkills(job) {
  if (!job) return [];
  const profile = job.requirementProfile || {};
  return [...(job.requiredSkills || []), ...(job.preferredSkills || []), ...(profile.requiredSkills || []), ...(profile.preferredSkills || []), ...(profile.tools || [])];
}

// The parser's result in the shape the draft is stored in: values in
// the shape of the candidate fields, and the confidence and evidence
// of each field next to them.
export function draftFromParse(parsed) {
  const f = parsed.fields;
  const draft = {
    name: f.name.value,
    // Shown to the recruiter for reference only: the email identifies
    // the candidate and is never applied from a resume.
    email: f.email.value,
    phone: f.phone.value,
    location: f.location.value,
    headline: f.headline.value,
    skills: f.skills.value,
    experienceYears: f.experienceYears.value,
    experience: f.experience.value.map((entry) => ({
      title: entry.title,
      employer: entry.employer,
      period: entry.period,
      highlights: entry.highlights,
      location: entry.location,
      current: entry.current,
      internship: entry.internship,
      heading: entry.heading,
      confidence: entry.confidence,
    })),
    education: f.education.value.map((entry) => ({
      degree: entry.degree, institution: entry.institution, year: entry.year, score: entry.score, confidence: entry.confidence,
    })),
    certifications: f.qualifications.value.map((item) => item.name),
    projects: f.projects.value.map((project) => ({
      name: project.name,
      period: project.period,
      role: project.role,
      description: project.description,
      highlights: project.highlights,
      technologies: project.technologies,
      confidence: project.confidence,
    })),
  };
  const fieldOf = { certifications: 'qualifications' };
  const keys = ['name', 'email', 'phone', 'location', 'headline', 'skills', 'experienceYears', 'experience', 'education', 'certifications', 'projects'];
  const confidence = Object.fromEntries(keys.map((key) => [key, f[fieldOf[key] || key].confidence]));
  const evidence = Object.fromEntries(keys.map((key) => [key, f[fieldOf[key] || key].evidence]));
  const details = {
    skills: { found: f.skills.details, unrecognised: f.skills.unrecognised },
    experienceYears: { method: f.experienceYears.method, stated: f.experienceYears.stated, computed: f.experienceYears.computed },
    headline: { source: f.headline.source },
    email: { alternatives: f.email.alternatives || [] },
    sections: parsed.sections,
  };
  const warnings = parsed.warnings.map((warning) => ({
    field: warning.field === 'qualifications' ? 'certifications' : warning.field,
    code: warning.code,
    message: warning.message,
  }));
  return { draft, confidence, evidence, details, warnings };
}

/*
  createExtraction - reads the resume of one application and stores
  the draft. The record is created as PENDING first, so an extraction
  in progress is visible, and then completed with the outcome.
*/
export async function createExtraction({ req, applicationId }) {
  const application = await Application.findById(applicationId);
  if (!application) throw notFound('That application was not found.');
  if (!application.resume?.key) throw badRequest('This application has no resume to read.');
  const [candidate, job] = await Promise.all([
    Candidate.findById(application.candidateId),
    application.jobId ? Job.findById(application.jobId) : null,
  ]);
  if (!candidate) throw notFound('The candidate for this application no longer exists.');

  const file = application.resume;
  const extraction = await ResumeExtraction.create({
    candidateId: candidate._id,
    applicationId: application._id,
    resume: { key: file.key, storage: file.storage || '', originalName: file.originalName, mimeType: file.mimeType, size: file.size },
    status: 'PENDING',
    extractedById: req.user.id,
    extractedByName: req.user.name,
  });

  const extracted = await extractResumeText(file);
  let status = draftStatus(extracted);
  extraction.extraction = {
    type: extracted.type || '',
    extractor: extracted.extractor || '',
    pages: extracted.pages,
    pagesRead: extracted.pagesRead,
    characters: extracted.characters,
    words: extracted.words,
    truncated: extracted.truncated,
    warnings: extracted.warnings,
    durationMs: extracted.durationMs,
  };

  if (status === 'EXTRACTED') {
    try {
      const parsed = parseResume(extracted.text, { extraSkills: jobSkills(job) });
      Object.assign(extraction, draftFromParse(parsed), { parserVersion: parsed.parserVersion });
      // The extractor has already cut the text; this is the stored cap.
      extraction.rawText = extracted.text.slice(0, RESUME_EXTRACTION_LIMITS.maxTextChars);
    } catch (error) {
      // A fault in the parser. The text is not logged.
      logger.error('resume.parse_failed', { extractionId: String(extraction._id), errorName: error?.name || 'Error' });
      status = 'FAILED';
      extraction.warnings = [{ field: null, code: 'PARSE_FAILED', message: 'The resume text was read but could not be parsed. Read the resume itself.' }];
    }
  } else {
    if (status === 'FAILED') extraction.failureReason = extracted.status;
    extraction.warnings = [{ field: null, code: extracted.status, message: extracted.reason }];
  }
  extraction.status = status;
  await extraction.save();

  await record({
    req,
    action: 'candidate.resume_extracted',
    entityType: 'candidate',
    entityId: candidate._id,
    summary: `Resume read for review (a draft; the profile was not changed): ${status}`,
    metadata: {
      extractionId: String(extraction._id),
      applicationId: String(application._id),
      status,
      failureReason: extraction.failureReason || '',
      fileType: extracted.type || '',
      characters: extracted.characters,
      skillsFound: (extraction.draft?.skills || []).length,
      warnings: extraction.warnings.length,
    },
  });
  return extraction;
}

export async function listExtractions(candidateId) {
  const candidate = await Candidate.findById(candidateId).select('_id');
  if (!candidate) throw notFound('That candidate was not found.');
  return ResumeExtraction.find({ candidateId: candidate._id }).sort({ createdAt: -1 }).limit(50);
}

// ------------------------------------------------------------ approval

const PROFILE_SHAPE = {
  experience: (entry) => ({ title: entry.title, employer: entry.employer, period: entry.period, highlights: entry.highlights }),
  education: (entry) => ({ degree: entry.degree, institution: entry.institution, year: entry.year }),
  projects: (entry) => ({ name: entry.name, period: entry.period, role: entry.role, description: entry.description, highlights: entry.highlights, technologies: entry.technologies }),
};

// The draft's value of one field, in the shape the candidate holds.
function draftValue(draft, field) {
  const value = draft?.[field];
  if (PROFILE_SHAPE[field]) return (value || []).map(PROFILE_SHAPE[field]);
  return value ?? (['skills', 'certifications'].includes(field) ? [] : '');
}

// What makes two entries of a list the same entry, when a list is
// added to the candidate's existing one.
const SAME = {
  skills: (item) => skillKey(item),
  certifications: (item) => item.toLowerCase(),
  experience: (item) => [item.title, item.employer, item.period].join('|').toLowerCase(),
  education: (item) => [item.degree, item.institution].join('|').toLowerCase(),
  projects: (item) => item.name.toLowerCase(),
};
const MAX_ITEMS = {
  skills: L.skills, certifications: L.certifications.maxItems, experience: L.experience.maxItems, education: L.education.maxItems, projects: L.projects.maxItems,
};

function plain(value) {
  return value && typeof value.toObject === 'function' ? value.toObject() : JSON.parse(JSON.stringify(value ?? null));
}

function appendTo(existing, added, field) {
  const key = SAME[field];
  const seen = new Set();
  const out = [];
  for (const item of [...(plain(existing) || []), ...added]) {
    const id = key(item);
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(item);
  }
  if (out.length > MAX_ITEMS[field]) throw badRequest(`Adding these would give the candidate more than ${MAX_ITEMS[field]} ${field}. Replace the list instead, or apply fewer.`);
  return out;
}

const STATUS_CONFLICT = {
  PENDING: 'This resume is still being read. Wait for it to finish.',
  FAILED: 'This resume could not be read, so there is nothing to apply.',
  NO_TEXT: 'No text was read from this resume, so there is nothing to apply.',
  APPROVED: 'This draft has already been approved.',
  DISCARDED: 'This draft has been discarded.',
};

/*
  approveExtraction - writes the chosen fields to the candidate.

  For each chosen field: the recruiter's edit when they sent one,
  otherwise the draft's value. Each value is validated before anything
  is written; a draft value that fails (a resume with no readable name,
  for example) must be edited first. Skills (and project technologies)
  are given their taxonomy names here, at approval, and nowhere else.

  The draft is marked APPROVED before the candidate is written, and
  only if it was still EXTRACTED, so two approvals of the same draft
  cannot both apply. If writing the candidate fails, the draft is put
  back to EXTRACTED.
*/
export async function approveExtraction({ req, id, body }) {
  const extraction = await ResumeExtraction.findById(id);
  if (!extraction) throw notFound('That resume extraction was not found.');
  if (extraction.status !== 'EXTRACTED') throw conflict(STATUS_CONFLICT[extraction.status]);
  const candidate = await Candidate.findById(extraction.candidateId);
  if (!candidate) throw notFound('The candidate for this extraction no longer exists.');

  const resolved = {};
  const edited = [];
  const problems = [];
  for (const field of body.fields) {
    if (Object.hasOwn(body.values, field)) {
      resolved[field] = body.values[field];
      edited.push(field);
      continue;
    }
    const result = approvalValueSchemas[field].safeParse(draftValue(extraction.draft, field));
    if (result.success) resolved[field] = result.data;
    else problems.push(...zodDetails(result.error).map((issue) => ({ field: `values.${field}${issue.field ? `.${issue.field}` : ''}`, message: `The value read from the resume cannot be applied as it is: ${issue.message} Edit it first.` })));
  }
  if (problems.length) throw validationError(problems);

  if (resolved.skills) resolved.skills = normaliseSkills(resolved.skills);
  if (resolved.projects) resolved.projects = resolved.projects.map((project) => ({ ...project, technologies: normaliseSkills(project.technologies) }));
  for (const field of body.append) resolved[field] = appendTo(candidate[field], resolved[field], field);

  const reviewedAt = new Date();
  const claimed = await ResumeExtraction.findOneAndUpdate(
    { _id: extraction._id, status: 'EXTRACTED' },
    { $set: { status: 'APPROVED', reviewedById: req.user.id, reviewedByName: req.user.name, reviewedAt, reviewNote: body.note || '', appliedFields: body.fields, editedFields: edited } },
    { new: true },
  );
  if (!claimed) throw conflict('This draft was reviewed by someone else a moment ago. Reload it.');

  const before = candidate.toObject();
  try {
    for (const field of body.fields) candidate.set(field, resolved[field]);
    await candidate.save();
  } catch (error) {
    await ResumeExtraction.updateOne(
      { _id: extraction._id, status: 'APPROVED' },
      { $set: { status: 'EXTRACTED', reviewedById: null, reviewedByName: '', reviewedAt: null, reviewNote: '', appliedFields: [], editedFields: [] } },
    );
    throw error;
  }
  const changed = changedFields(before, candidate.toObject(), body.fields);

  await record({
    req,
    action: 'candidate.resume_extraction_approved',
    entityType: 'candidate',
    entityId: candidate._id,
    summary: `Applied ${body.fields.length} ${body.fields.length === 1 ? 'field' : 'fields'} from a resume extraction: ${body.fields.join(', ')}`,
    metadata: {
      extractionId: String(extraction._id),
      applicationId: extraction.applicationId ? String(extraction.applicationId) : '',
      appliedFields: body.fields,
      editedFields: edited,
      changedFields: changed,
      appendedFields: body.append,
    },
  });
  // The candidate is saved: the ATS results for them are now out of date
  // and the rules are run again. Whatever happens here, the approval
  // stands; a failure is recorded and reported, not rolled back.
  const ats = await rerunAts({ req, candidate, extraction: claimed });
  const saved = await ResumeExtraction.findById(claimed._id);
  return { extraction: saved || claimed, candidate, ats };
}

const ATS_MESSAGES = {
  NONE: 'The candidate has no job to be evaluated against, so the ATS was not run.',
  UPDATED: 'The ATS evaluation was run again with the approved profile.',
  PARTIAL: 'The profile was updated, but the ATS evaluation could not be run again for every job. Run it again from the ATS screen.',
  FAILED: 'The profile was updated, but the ATS evaluation could not be run again. Run it again from the ATS screen.',
};

async function rerunAts({ req, candidate, extraction }) {
  let outcome;
  try {
    outcome = await reevaluateAfterApproval({ req, candidateId: candidate._id, extractionId: extraction._id });
  } catch (error) {
    logger.error('ats.reevaluation_failed', { candidateId: String(candidate._id), errorName: error?.name || 'Error' });
    outcome = { status: 'FAILED', results: [], failures: [{ jobId: null, code: 'UNEXPECTED' }], skipped: [] };
  }
  const summary = {
    status: outcome.status,
    at: new Date(),
    evaluated: outcome.results.length,
    changed: outcome.results.filter((result) => result.changed).length,
    failed: outcome.failures.length,
    staleReviews: outcome.results.filter((result) => result.reviewStale).length,
  };
  try {
    await ResumeExtraction.updateOne({ _id: extraction._id }, { $set: { atsReevaluation: summary } });
    if (outcome.failures.length) {
      await record({
        req,
        action: 'ats.reevaluation_failed',
        entityType: 'candidate',
        entityId: candidate._id,
        summary: `The ATS evaluation could not be re-run for ${outcome.failures.length} ${outcome.failures.length === 1 ? 'job' : 'jobs'} after resume data was approved. The approval stands.`,
        metadata: { extractionId: String(extraction._id), failedJobs: outcome.failures.map((failure) => failure.jobId || 'unknown') },
      });
    }
  } catch (error) {
    logger.error('ats.reevaluation_record_failed', { candidateId: String(candidate._id), errorName: error?.name || 'Error' });
  }
  return { ...outcome, ...summary, message: ATS_MESSAGES[outcome.status] };
}

/*
  discardExtraction - the draft is dropped: DISCARDED, with its text
  cleared, since nothing will be applied from it. The candidate is not
  touched. A draft being read, or one already reviewed, cannot be
  discarded.
*/
export async function discardExtraction({ req, id, note = '' }) {
  const discarded = await ResumeExtraction.findOneAndUpdate(
    { _id: id, status: { $in: ['EXTRACTED', 'NO_TEXT', 'FAILED'] } },
    { $set: { status: 'DISCARDED', rawText: '', reviewedById: req.user.id, reviewedByName: req.user.name, reviewedAt: new Date(), reviewNote: note } },
    { new: true },
  );
  if (!discarded) {
    const existing = await ResumeExtraction.findById(id).select('status');
    if (!existing) throw notFound('That resume extraction was not found.');
    throw conflict(STATUS_CONFLICT[existing.status]);
  }
  await record({
    req,
    action: 'candidate.resume_extraction_discarded',
    entityType: 'candidate',
    entityId: discarded.candidateId,
    summary: 'Resume extraction draft discarded. The profile was not changed.',
    metadata: { extractionId: String(discarded._id), applicationId: discarded.applicationId ? String(discarded.applicationId) : '' },
  });
  return discarded;
}
