import { APPLICATION_STATUSES, RECRUITMENT_LABELS, LEGACY_STATUS_MAP } from '../config/constants.js';

/*
  The one-time data change that goes with the simplified recruitment
  workflow. These two functions decide, for one stored record, what has
  to change; scripts/migrate-recruitment.js applies it.

  Applications
    NEW, SHORTLISTED                 kept
    SCREENING, WITHDRAWN             -> NEW
    REJECTED                         -> NEW, label REJECTED
    INTERVIEW                        -> SHORTLISTED, label INTERVIEWED
    SELECTED                         -> SHORTLISTED, label SELECTED
    any other value                  -> NEW
  A shortlisted application without shortlist details gets them, with
  the email marked NOT_SENT: no shortlist email existed before, so none
  is assumed, and none is sent by the migration.

  Candidates
    The candidate status is removed (the status lives on applications).
    INTERVIEW, SELECTED and REJECTED are kept as the matching label.

  Each function returns null when the record is already in the new
  shape, so running the migration twice changes nothing the second
  time.
*/

const emptyShortlist = () => ({ at: null, byId: null, byName: '', email: { status: 'NOT_SENT', at: null, attempts: 0 } });

const cleanLabels = (labels) => RECRUITMENT_LABELS.filter((label) => Array.isArray(labels) && labels.includes(label));

const sameList = (a, b) => Array.isArray(a) && a.length === b.length && a.every((item, i) => item === b[i]);

// -> { $set: {...} } or null
export function planApplication(doc) {
  const set = {};
  const mapped = APPLICATION_STATUSES.includes(doc.status) ? { status: doc.status, label: null } : (LEGACY_STATUS_MAP[doc.status] || { status: 'NEW', label: null });
  if (mapped.status !== doc.status) set.status = mapped.status;

  const labels = cleanLabels([...(Array.isArray(doc.labels) ? doc.labels : []), mapped.label]);
  if (!sameList(doc.labels, labels)) set.labels = labels;

  if (mapped.status === 'SHORTLISTED' && !doc.shortlist) set.shortlist = emptyShortlist();
  return Object.keys(set).length ? { $set: set } : null;
}

// -> { $set: {...}, $unset: {...} } or null
export function planCandidate(doc) {
  const update = {};
  const legacy = Object.hasOwn(doc, 'status') ? LEGACY_STATUS_MAP[doc.status] : null;
  const labels = cleanLabels([...(Array.isArray(doc.labels) ? doc.labels : []), legacy ? legacy.label : null]);
  if (!sameList(doc.labels, labels)) update.$set = { labels };
  if (Object.hasOwn(doc, 'status')) update.$unset = { status: '' };
  return Object.keys(update).length ? update : null;
}
