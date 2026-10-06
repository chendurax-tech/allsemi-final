import { ok, created } from '../utils/apiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { notFound, badRequest, conflict } from '../utils/AppError.js';
import { assertObjectId } from '../utils/query.js';
import {
  Candidate, Application, Referral, Requirement, Enquiry, ATSResult, AuditLog,
} from '../models/index.js';
import { record } from '../services/auditService.js';
import { signedUrlFor } from '../services/storage/privateFiles.js';
import { deleteCandidateCascade, linkCandidate } from '../services/candidateService.js';
import { shortlistApplication, sendShortlistEmail } from '../services/shortlistService.js';
import { candidates, applications, referrals } from './resources.js';

/*
  Recruitment actions that are more than a field edit: the shortlist
  action, notes, private document access, cascade delete and referral
  conversion.
*/

// ---------- edits ----------
// The shared update handler writes the edit and audits label and status
// changes (see crudFactory.js). The rules that belong to one resource,
// such as a referral only becoming CONVERTED through the convert
// action, are declared with the resource in resources.js. Candidates
// and applications have no editable status: see the shortlist action.
export const updateCandidate = candidates.update;
export const updateApplication = applications.update;
export const updateReferral = referrals.update;

// ---------- shortlist ----------
// The one workflow action. The route requires applications:shortlist;
// the rules (once only, one email) are in services/shortlistService.js.
export const shortlist = asyncHandler(async (req, res) => {
  const { application, email } = await shortlistApplication(req, assertObjectId(req.params.id));
  ok(res, { application: application.toJSON(), email });
});

export const shortlistEmail = asyncHandler(async (req, res) => {
  const { application, email } = await sendShortlistEmail(req, assertObjectId(req.params.id));
  ok(res, { application: application.toJSON(), email });
});

// ---------- candidate detail ----------
export const candidateDetail = asyncHandler(async (req, res) => {
  const candidate = await candidates.load(req);
  const [candidateApplications, results, history] = await Promise.all([
    Application.find({ candidateId: candidate._id }).sort({ submittedAt: -1 }),
    ATSResult.find({ candidateId: candidate._id }).sort({ runAt: -1 }),
    AuditLog.find({ entityType: 'candidate', entityId: String(candidate._id) }).sort({ at: -1 }).limit(50),
  ]);
  ok(res, {
    candidate: candidate.toJSON(),
    applications: candidateApplications.map((a) => a.toJSON()),
    atsResults: results.map((r) => r.toJSON()),
    // The activity shown with the profile: what happened, when and by
    // whom. The full audit entries (with their metadata) are read
    // through the audit log, which needs its own permission.
    history: history.map((h) => ({ id: String(h._id), at: h.at, action: h.action, summary: h.summary, actorName: h.actorName })),
  });
});

function addNoteTo(controller, entity) {
  return asyncHandler(async (req, res) => {
    const doc = await controller.load(req);
    doc.notes.push({ text: req.body.text, authorId: req.user.id, authorName: req.user.name, at: new Date() });
    await doc.save();
    await record({ req, action: `${entity}.note_added`, entityType: entity, entityId: doc._id, summary: `Note added to ${entity}` });
    ok(res, doc.toJSON());
  });
}
export const addCandidateNote = addNoteTo(candidates, 'candidate');
export const addReferralNote = addNoteTo(referrals, 'referral');

export const deleteCandidate = asyncHandler(async (req, res) => {
  const candidate = await candidates.load(req);
  const name = candidate.name;
  const removed = await deleteCandidateCascade(candidate);
  await record({ req, action: 'candidate.deleted', entityType: 'candidate', entityId: candidate._id, summary: `Deleted candidate "${name}" with ${removed.applications} applications`, metadata: removed });
  ok(res, { id: String(candidate._id), deleted: true });
});

// ---------- private documents ----------
/*
  Every private document is reached the same way:
    1. requireAuth + requirePermission on the route,
    2. this handler loads the record and checks that it has a file,
    3. the access is written to the audit log,
    4. a signed URL that expires in SIGNED_URL_TTL_SECONDS is returned.
  The JSON for a record never includes its storage key. The only thing
  a client receives is this expiring link.
*/
function documentUrl({ Model, entity, field, describe }) {
  return asyncHandler(async (req, res) => {
    const doc = await Model.findById(assertObjectId(req.params.id));
    if (!doc) throw notFound(`That ${entity} was not found.`);
    const file = doc[field];
    if (!file || !file.key) throw notFound('No document is stored for this record.');
    const signed = await signedUrlFor(file);
    await record({ req, action: `${entity}.document_accessed`, entityType: entity, entityId: doc._id, summary: `Opened ${field} of ${describe(doc)}`, metadata: { fileName: file.originalName } });
    res.set('Cache-Control', 'no-store');
    ok(res, { url: signed.url, expiresIn: signed.expiresIn, fileName: file.originalName, mimeType: file.mimeType });
  });
}

export const candidateResumeUrl = documentUrl({ Model: Candidate, entity: 'candidate', field: 'resume', describe: (d) => d.name });
export const applicationResumeUrl = documentUrl({ Model: Application, entity: 'application', field: 'resume', describe: (d) => `application ${String(d._id)}` });
export const referralResumeUrl = documentUrl({ Model: Referral, entity: 'referral', field: 'resume', describe: (d) => d.candidateName });
export const requirementAttachmentUrl = documentUrl({ Model: Requirement, entity: 'requirement', field: 'attachment', describe: (d) => d.role });
export const enquiryAttachmentUrl = documentUrl({ Model: Enquiry, entity: 'enquiry', field: 'attachment', describe: (d) => d.subject || d.name });

// ---------- referral -> candidate ----------
// A new candidate record takes over the referral's resume: both point
// at the same stored object. A candidate who already has a resume
// keeps it, and the referral keeps its own. Stored files are removed
// only once nothing points at them (see resources.js and
// candidateService.js).
const copyFile = (file) => (file && file.key
  ? { key: file.key, originalName: file.originalName, mimeType: file.mimeType, size: file.size, uploadedAt: file.uploadedAt, ...(file.storage ? { storage: file.storage } : {}) }
  : null);

export const convertReferral = asyncHandler(async (req, res) => {
  const referral = await referrals.load(req);
  if (referral.candidateId || referral.status === 'CONVERTED') throw conflict('This referral has already been converted.');
  if (!referral.candidateEmail) throw badRequest('Add the candidate\'s email before converting the referral.');

  const { candidate, created: isNew } = await linkCandidate({
    name: referral.candidateName,
    email: referral.candidateEmail,
    phone: referral.candidatePhone,
    headline: referral.candidateRole,
    domain: referral.domain,
    profileUrl: referral.candidateProfileUrl,
    skills: [],
  }, { resume: copyFile(referral.resume), source: 'REFERRAL' });

  const from = referral.status;
  referral.candidateId = candidate._id;
  referral.status = 'CONVERTED';
  await referral.save();

  await record({ req, action: 'referral.converted', entityType: 'referral', entityId: referral._id, summary: `Referral of ${referral.candidateName} converted to a candidate`, metadata: { from, to: 'CONVERTED', candidateId: String(candidate._id), newCandidate: isNew } });
  created(res, { referral: referral.toJSON(), candidate: candidate.toJSON() });
});
