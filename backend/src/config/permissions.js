/*
  Role-based access control.

  A permission is "<area>:<action>". Every protected route names the
  permission it needs (see routes/admin.routes.js) and the
  requirePermission middleware checks it against this table on the
  server. The admin UI reads the same table to decide what to show, but
  hiding a button is never the control: the API refuses the call.

  To change what a role can do, edit ROLE_PERMISSIONS here. Nothing
  else needs to change.
*/

export const PERMISSIONS = {
  JOBS_READ: 'jobs:read',
  JOBS_WRITE: 'jobs:write',
  JOBS_PUBLISH: 'jobs:publish',
  JOBS_DELETE: 'jobs:delete',

  CANDIDATES_READ: 'candidates:read',
  CANDIDATES_WRITE: 'candidates:write',
  CANDIDATES_DELETE: 'candidates:delete',
  RESUMES_READ: 'resumes:read',

  APPLICATIONS_READ: 'applications:read',
  APPLICATIONS_WRITE: 'applications:write',
  // Shortlisting changes the application's status and emails the
  // candidate, so it has its own permission.
  APPLICATIONS_SHORTLIST: 'applications:shortlist',

  REQUIREMENTS_READ: 'requirements:read',
  REQUIREMENTS_WRITE: 'requirements:write',
  REQUIREMENTS_DELETE: 'requirements:delete',

  REFERRALS_READ: 'referrals:read',
  REFERRALS_WRITE: 'referrals:write',
  REFERRALS_DELETE: 'referrals:delete',

  ENQUIRIES_READ: 'enquiries:read',
  ENQUIRIES_WRITE: 'enquiries:write',
  ENQUIRIES_DELETE: 'enquiries:delete',

  ATS_READ: 'ats:read',
  ATS_RUN: 'ats:run',
  ATS_REVIEW: 'ats:review',

  CONTENT_READ: 'content:read',
  CONTENT_WRITE: 'content:write',
  CONTENT_PUBLISH: 'content:publish',
  CONTENT_DELETE: 'content:delete',
  MEDIA_UPLOAD: 'media:upload',

  SETTINGS_READ: 'settings:read',
  SETTINGS_WRITE: 'settings:write',

  USERS_MANAGE: 'users:manage',
  AUDIT_READ: 'audit:read',
};

const P = PERMISSIONS;
const ALL = Object.values(P);

export const ROLE_PERMISSIONS = {
  // Everything, including users, roles and the audit log.
  SUPER_ADMIN: ALL,

  // Runs recruitment day to day. No website content, users or settings.
  RECRUITER: [
    P.JOBS_READ, P.JOBS_WRITE, P.JOBS_PUBLISH,
    P.CANDIDATES_READ, P.CANDIDATES_WRITE, P.RESUMES_READ,
    P.APPLICATIONS_READ, P.APPLICATIONS_WRITE, P.APPLICATIONS_SHORTLIST,
    P.REQUIREMENTS_READ, P.REQUIREMENTS_WRITE,
    P.REFERRALS_READ, P.REFERRALS_WRITE,
    P.ENQUIRIES_READ, P.ENQUIRIES_WRITE,
    P.ATS_READ, P.ATS_RUN, P.ATS_REVIEW,
    P.SETTINGS_READ,
  ],

  // Reviews jobs, candidates and ATS results. Read only, plus the
  // recruiter-review decision on an ATS result.
  HIRING_MANAGER: [
    P.JOBS_READ,
    P.CANDIDATES_READ, P.RESUMES_READ,
    P.APPLICATIONS_READ,
    P.REQUIREMENTS_READ,
    P.ATS_READ, P.ATS_REVIEW,
    P.SETTINGS_READ,
  ],

  // Owns the public website content. Sees no candidate data.
  CONTENT_MANAGER: [
    P.CONTENT_READ, P.CONTENT_WRITE, P.CONTENT_PUBLISH, P.CONTENT_DELETE,
    P.MEDIA_UPLOAD,
    P.JOBS_READ,
    P.SETTINGS_READ, P.SETTINGS_WRITE,
  ],
};

export function permissionsFor(role) {
  return ROLE_PERMISSIONS[role] || [];
}

export function roleCan(role, permission) {
  return permissionsFor(role).includes(permission);
}
