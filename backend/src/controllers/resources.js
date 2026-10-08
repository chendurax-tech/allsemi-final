import { forgetEmails } from '../services/email/emailLog.js';
import { removeLegacyDerivedData } from '../services/legacyDerivedData.js';
import {
  Job, Candidate, Application, Requirement, Referral, Enquiry, Insight, Story, Expertise, Service, Location, ATSResult,
  insightOnLanding,
} from '../models/index.js';
import { PERMISSIONS as P } from '../config/permissions.js';
import {
  JOB_STATUSES, APPLICATION_STATUSES, RECRUITMENT_LABELS, APPLICATION_SOURCES, REQUIREMENT_STATUSES,
  REQUIREMENT_PRIORITIES, HIRING_TYPES, REFERRAL_STATUSES, ENQUIRY_STATUSES, ENQUIRY_TYPES, CONTENT_STATUSES, LOCATION_TYPES,
} from '../config/constants.js';
import { crudController } from './crudFactory.js';
import { removePrivateFile } from '../services/storage/privateFiles.js';
import { removeImage } from '../services/storage/publicMedia.js';
import { imageInUse } from '../services/mediaUsage.js';
import { badRequest, conflict } from '../utils/AppError.js';
import { logger } from '../utils/logger.js';
import { SOURCE_FIELDS, isImported } from '../services/jobSync/syncService.js';

/*
  The admin resources, each built from crudController with the rules
  that belong to it. Permissions are attached where the routes are
  declared (routes/admin.routes.js).
*/

async function dropFile(file, context) {
  try {
    await removePrivateFile(file);
  } catch (error) {
    logger.error('storage.delete_failed', { ...context, error });
  }
}

// When a record's uploaded image is replaced or the record is deleted,
// the old image is removed from media storage too, unless another
// record still shows it. removeImage itself ignores any id that is not
// one of this application's own uploads.
function mediaCleanup(Model, field) {
  const drop = async (publicId, doc) => {
    if (publicId && !(await imageInUse(publicId, { Model, id: doc._id }))) await removeImage(publicId);
  };
  return {
    async afterSave(doc, { before }) {
      const previous = before?.[field]?.publicId;
      if (previous && previous !== doc[field]?.publicId) await drop(previous, doc);
    },
    async beforeDelete(doc) {
      await drop(doc[field]?.publicId, doc);
    },
  };
}

export const jobs = crudController({
  Model: Job,
  entity: 'job',
  searchFields: ['title', 'category', 'department', 'location'],
  filters: { status: { allowed: JOB_STATUSES }, category: {} },
  defaultSort: { updatedAt: -1 },
  sortable: ['createdAt', 'updatedAt', 'title', 'publishedAt'],
  publishPermission: P.JOBS_PUBLISH,
  slugFrom: 'title',
  auditFields: ['title', 'slug', 'category', 'department', 'location', 'employmentType', 'experienceLevel', 'summary', 'description', 'responsibilities', 'requiredSkills', 'preferredSkills', 'keywords', 'featured', 'applicationEnabled'],
  async prepare(data, { req, existing }) {
    // An imported job's official fields belong to its source: they are
    // written by the job sync only. Staff keep what ALLSEMIS decides:
    // status, featured, applications on or off, keywords, the slug.
    if (isImported(existing)) {
      const changed = SOURCE_FIELDS.filter((field) => field in data && JSON.stringify(data[field] ?? null) !== JSON.stringify(existing[field] ?? null));
      if (changed.length) {
        throw conflict(`This job is imported from the official job source, which is its source of truth. ${changed.join(', ')} can only change there; the next sync brings the change in.`);
      }
    }
    const next = { ...data, updatedBy: req.user.id };
    if (!existing) next.createdBy = req.user.id;
    // The publish date is set by the server the first time a job goes live.
    if (data.status === 'published' && !(existing && existing.publishedAt)) next.publishedAt = new Date();
    return next;
  },
  // A job that people have applied to is recruitment history. It is
  // archived, not deleted, so its applications never point at nothing.
  async beforeDelete(doc) {
    const applications = await Application.countDocuments({ jobId: doc._id });
    if (applications > 0) {
      throw conflict(`This job has ${applications} ${applications === 1 ? 'application' : 'applications'}. Archive it instead of deleting it.`);
    }
    await ATSResult.deleteMany({ jobId: doc._id });
    await removeLegacyDerivedData({ jobIds: [doc._id] });
  },
});

export const candidates = crudController({
  Model: Candidate,
  entity: 'candidate',
  label: (doc) => doc.name,
  searchFields: ['name', 'email', 'headline', 'location', 'skills', 'domain'],
  filters: {
    label: { field: 'labels', allowed: RECRUITMENT_LABELS },
    source: { allowed: APPLICATION_SOURCES },
    domain: {},
    location: {},
  },
  auditFields: ['name', 'phone', 'location', 'headline', 'domain', 'experienceYears', 'skills', 'summary', 'noticePeriod', 'expectedCompensation', 'profileUrl', 'preferredLocation', 'source'],
});

export const applications = crudController({
  Model: Application,
  entity: 'application',
  label: (doc) => `application ${String(doc._id)}`,
  filters: {
    status: { allowed: APPLICATION_STATUSES },
    label: { field: 'labels', allowed: RECRUITMENT_LABELS },
    source: { allowed: APPLICATION_SOURCES },
    jobId: { objectId: true },
    candidateId: { objectId: true },
  },
  defaultSort: { submittedAt: -1 },
  sortable: ['submittedAt', 'updatedAt'],
  auditFields: ['source', 'recruiterNotes'],
});

export const requirements = crudController({
  Model: Requirement,
  entity: 'requirement',
  label: (doc) => doc.role,
  searchFields: ['role', 'company', 'contactName', 'email', 'location', 'domain', 'skills'],
  filters: {
    status: { allowed: REQUIREMENT_STATUSES },
    priority: { allowed: REQUIREMENT_PRIORITIES },
    hiringType: { allowed: HIRING_TYPES },
    domain: {},
  },
  auditFields: ['contactName', 'company', 'email', 'phone', 'hiringType', 'domain', 'role', 'positions', 'location', 'workMode', 'description', 'skills', 'experience', 'priority', 'internalNotes'],
  async prepare(data, { existing }) {
    return existing ? data : { ...data, source: 'ADMIN' };
  },
  async beforeDelete(doc) {
    if (doc.attachment?.key) await dropFile(doc.attachment, { requirementId: String(doc._id) });
    await forgetEmails('requirement', doc._id);
  },
});

export const referrals = crudController({
  Model: Referral,
  entity: 'referral',
  label: (doc) => doc.candidateName,
  searchFields: ['candidateName', 'candidateEmail', 'referrerName', 'referrerEmail', 'candidateRole', 'domain'],
  filters: { status: { allowed: REFERRAL_STATUSES }, domain: {} },
  auditFields: ['candidateName', 'candidateEmail', 'candidatePhone', 'candidateRole', 'candidateProfileUrl', 'domain'],
  async prepare(data, { existing }) {
    // A converted referral is a closed record: the candidate it became
    // is edited from here on. (Notes can still be added.)
    if (existing && (existing.status === 'CONVERTED' || existing.candidateId)) {
      throw conflict('This referral has been converted and can no longer be changed.');
    }
    // CONVERTED is only reached through the convert action, which
    // creates the candidate record it refers to.
    if (data.status === 'CONVERTED') {
      throw badRequest('Use "Convert to candidate" to mark a referral as converted.');
    }
    return data;
  },
  async beforeDelete(doc) {
    // After conversion the candidate record may point at the same
    // stored resume. The file is removed only when nothing else does.
    await forgetEmails('referral', doc._id);
    const key = doc.resume?.key;
    if (!key) return;
    const [onCandidates, onApplications, onOtherReferrals] = await Promise.all([
      Candidate.countDocuments({ 'resume.key': key }),
      Application.countDocuments({ 'resume.key': key }),
      Referral.countDocuments({ 'resume.key': key, _id: { $ne: doc._id } }),
    ]);
    if (onCandidates + onApplications + onOtherReferrals === 0) await dropFile(doc.resume, { referralId: String(doc._id) });
  },
});

export const enquiries = crudController({
  Model: Enquiry,
  entity: 'enquiry',
  label: (doc) => doc.subject || doc.name,
  searchFields: ['name', 'email', 'subject', 'company', 'message'],
  filters: { status: { allowed: ENQUIRY_STATUSES }, type: { allowed: ENQUIRY_TYPES } },
  auditFields: ['type', 'internalNotes'],
  async beforeDelete(doc) {
    if (doc.attachment?.key) await dropFile(doc.attachment, { enquiryId: String(doc._id) });
    await forgetEmails('enquiry', doc._id);
  },
});

const contentStatus = { status: { allowed: CONTENT_STATUSES } };

export const insights = crudController({
  Model: Insight,
  entity: 'insight',
  searchFields: ['title', 'category', 'author', 'tags', 'excerpt'],
  filters: { ...contentStatus, category: {} },
  defaultSort: { date: -1, createdAt: -1 },
  sortable: ['date', 'createdAt', 'updatedAt', 'title'],
  publishPermission: P.CONTENT_PUBLISH,
  slugFrom: 'title',
  auditFields: ['title', 'slug', 'excerpt', 'category', 'tags', 'topics', 'image', 'body', 'author', 'date', 'readTime', 'featured', 'showOnLanding', 'landingOrder', 'seoTitle', 'seoDescription'],
  // An article saved before the landing switch existed follows its
  // Featured flag. The first time such an article is edited, the answer
  // it had is stored, so that changing Featured afterwards does not take
  // it off (or put it on) the landing page behind the editor's back.
  async prepare(data, { existing }) {
    if (existing && typeof existing.showOnLanding !== 'boolean' && data.showOnLanding === undefined) {
      data.showOnLanding = insightOnLanding(existing);
    }
    return data;
  },
  ...mediaCleanup(Insight, 'image'),
});

export const stories = crudController({
  Model: Story,
  entity: 'story',
  label: (doc) => doc.name || 'story',
  searchFields: ['quote', 'name', 'role'],
  filters: contentStatus,
  defaultSort: { order: 1, createdAt: 1 },
  sortable: ['order', 'createdAt', 'updatedAt'],
  publishPermission: P.CONTENT_PUBLISH,
  auditFields: ['quote', 'name', 'role', 'photo', 'order', 'showOnLanding'],
  ...mediaCleanup(Story, 'photo'),
});

export const expertise = crudController({
  Model: Expertise,
  entity: 'expertise',
  searchFields: ['name', 'slug', 'domains'],
  filters: contentStatus,
  defaultSort: { num: 1 },
  sortable: ['num', 'name', 'updatedAt'],
  publishPermission: P.CONTENT_PUBLISH,
  slugFrom: 'name',
  keyFrom: 'name',
  auditFields: ['num', 'name', 'shortName', 'slug', 'desc', 'image', 'introduction', 'overview', 'domains', 'roles', 'hiringChallenges', 'processFlow', 'representativeSearches', 'relatedInsight'],
  ...mediaCleanup(Expertise, 'image'),
});

export const services = crudController({
  Model: Service,
  entity: 'service',
  searchFields: ['name', 'slug', 'description'],
  filters: contentStatus,
  defaultSort: { num: 1 },
  sortable: ['num', 'name', 'updatedAt'],
  publishPermission: P.CONTENT_PUBLISH,
  slugFrom: 'name',
  auditFields: ['num', 'name', 'slug', 'icon', 'description', 'headline', 'lead', 'fitTitle', 'fit', 'processTitle', 'process', 'receiveTitle', 'receive', 'tagsTitle', 'tags', 'questions', 'ctaLabel', 'ctaTo'],
});

export const locations = crudController({
  Model: Location,
  entity: 'location',
  label: (doc) => doc.city,
  searchFields: ['city', 'country', 'type'],
  filters: { type: { allowed: LOCATION_TYPES } },
  defaultSort: { createdAt: 1 },
  keyFrom: 'city',
  auditFields: ['city', 'country', 'region', 'label', 'type', 'status', 'isHeadquarters', 'address', 'phone', 'email', 'hours', 'lat', 'lon', 'description', 'labelSide', 'labelRaise', 'active'],
  async prepare(data, { existing }) {
    // A network node is never an office: it cannot carry an address or
    // contact details, whatever the request contains.
    const type = data.type ?? existing?.type;
    if (type === 'network') return { ...data, address: [], phone: '', email: '', hours: [], isHeadquarters: false };
    return data;
  },
});
