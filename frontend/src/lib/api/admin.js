import { api, apiUrl } from './client.js';

/*
  Admin API functions, one object per resource. Every call needs a
  signed-in session and the matching permission; the backend enforces
  both, so a function failing with 403 is the expected result for a
  role that may not use it.

  list(params) accepts: q (search), page, limit, sort and the
  resource's own filters (status, category, ...). It resolves to
  { items, meta: { total, page, limit } }.
*/
// A record id as one path segment, whatever it contains.
const seg = (id) => encodeURIComponent(String(id));

function resource(name, operations = ['list', 'get', 'create', 'update', 'remove']) {
  const base = `/api/admin/${name}`;
  const all = {
    list: (params) => api.get(base, { limit: 500, ...params }).then((r) => ({ items: r.data, meta: r.meta })),
    get: (id) => api.get(`${base}/${seg(id)}`).then((r) => r.data),
    create: (data) => api.post(base, data).then((r) => r.data),
    update: (id, data) => api.patch(`${base}/${seg(id)}`, data).then((r) => r.data),
    remove: (id) => api.delete(`${base}/${seg(id)}`).then((r) => r.data),
  };
  // Only the calls the backend has a route for are exposed.
  return Object.fromEntries(operations.map((operation) => [operation, all[operation]]));
}

// A private document is never linked to directly. This asks the
// backend for a short-lived signed link (the access is audited) and
// returns it ready to open.
const signedLink = (path) => api.get(path).then((r) => ({ ...r.data, url: apiUrl(r.data.url) }));

export const jobsApi = {
  ...resource('jobs'),
  // The job's requirement profile: an optional structured list of what
  // the job asks for. save and remove resolve to
  // { requirementProfile, scoring }. Neither changes an evaluation that
  // already exists.
  saveRequirementProfile: (id, profile) => api.put(`/api/admin/jobs/${seg(id)}/requirement-profile`, profile).then((r) => r.data),
  removeRequirementProfile: (id) => api.delete(`/api/admin/jobs/${seg(id)}/requirement-profile`).then((r) => r.data),
  // Sent only when a recruiter presses "Draft with AI". One AI request,
  // about a minute at most. Resolves to { draft, model, saved: false }:
  // the server stores nothing, the draft goes into the form.
  draftRequirementProfile: (id) => api.post(`/api/admin/jobs/${seg(id)}/requirement-profile/ai-draft`).then((r) => r.data),
  // Rule based only, no AI: runs the rules again for every evaluation
  // the job already has. Resolves to { evaluated, total }.
  reevaluate: (id) => api.post(`/api/admin/jobs/${seg(id)}/ats/re-run`).then((r) => r.data),
  // The stored AI comparison of several candidates for this job, or
  // null. Reading it asks no model anything.
  candidateComparison: (id) => api.get(`/api/admin/jobs/${seg(id)}/candidate-comparison`).then((r) => r.data.comparison),
  // Sent only when a recruiter presses "Compare candidates with AI".
  // resultIds: two to five ATS result ids of this job. One AI request.
  // Resolves to the comparison, which replaces the stored one.
  compareCandidates: (id, resultIds) => api.post(`/api/admin/jobs/${seg(id)}/candidate-comparison`, { resultIds }).then((r) => r.data.comparison),
};

export const candidatesApi = {
  // Candidates are created by an application or a converted referral.
  ...resource('candidates', ['list', 'update', 'remove']),
  // { candidate, applications, atsResults, history }
  detail: (id) => api.get(`/api/admin/candidates/${seg(id)}`).then((r) => r.data),
  addNote: (id, text) => api.post(`/api/admin/candidates/${seg(id)}/notes`, { text }).then((r) => r.data),
  resumeUrl: (id) => signedLink(`/api/admin/candidates/${seg(id)}/resume-url`),
};

export const applicationsApi = {
  ...resource('applications', ['list', 'get', 'update']),
  // The one workflow action. Both resolve to { application, email },
  // where email is what happened to the candidate's shortlist email.
  shortlist: (id) => api.post(`/api/admin/applications/${seg(id)}/shortlist`).then((r) => r.data),
  shortlistEmail: (id) => api.post(`/api/admin/applications/${seg(id)}/shortlist-email`).then((r) => r.data),
  resumeUrl: (id) => signedLink(`/api/admin/applications/${seg(id)}/resume-url`),
};

export const requirementsApi = {
  ...resource('requirements'),
  attachmentUrl: (id) => signedLink(`/api/admin/requirements/${seg(id)}/attachment-url`),
};

export const referralsApi = {
  ...resource('referrals', ['list', 'get', 'update', 'remove']),
  addNote: (id, text) => api.post(`/api/admin/referrals/${seg(id)}/notes`, { text }).then((r) => r.data),
  // { referral, candidate }
  convert: (id) => api.post(`/api/admin/referrals/${seg(id)}/convert`).then((r) => r.data),
  resumeUrl: (id) => signedLink(`/api/admin/referrals/${seg(id)}/resume-url`),
};

export const enquiriesApi = {
  ...resource('enquiries', ['list', 'get', 'update', 'remove']),
  attachmentUrl: (id) => signedLink(`/api/admin/enquiries/${seg(id)}/attachment-url`),
};

export const insightsApi = resource('insights');
export const storiesApi = resource('stories');
export const expertiseApi = resource('expertise');
export const servicesApi = resource('services');
export const locationsApi = resource('locations');

// The ATS. Everything here is the rule-based engine except
// compareWithAi, which asks the ALLSEMIS backend to run the AI
// comparison for one stored result. The browser never calls an AI
// provider itself and never holds a key.
export const atsApi = {
  list: (params) => api.get('/api/admin/ats-results', { limit: 500, ...params }).then((r) => ({ items: r.data, meta: r.meta })),
  get: (id) => api.get(`/api/admin/ats-results/${seg(id)}`).then((r) => r.data),
  engine: () => api.get('/api/admin/ats/engine').then((r) => r.data),
  // Pass { applicationId } or { candidateId, jobId }.
  run: (target) => api.post('/api/admin/ats/run', target).then((r) => r.data),
  review: (id, state, note) => api.patch(`/api/admin/ats-results/${seg(id)}/review`, { state, note }).then((r) => r.data),
  // Sent only when a recruiter presses "Compare with AI". No body: the
  // server reads the job and the candidate itself. Resolves to the
  // whole ATS result with its new aiComparison, and can take about a
  // minute.
  compareWithAi: (id) => api.post(`/api/admin/ats-results/${seg(id)}/ai-comparison`).then((r) => r.data),
};

// The AI usage figures for the dashboard. The server adds up its own
// record of the AI requests it sent: reading this calls no AI provider
// and costs nothing. The spend in it is an estimate, not a balance.
export const aiApi = {
  usage: () => api.get('/api/admin/ai/usage').then((r) => r.data),
};

export const settingsApi = {
  get: () => api.get('/api/admin/settings').then((r) => r.data),
  saveContact: (contact) => api.put('/api/admin/settings/contact', contact).then((r) => r.data),
  access: () => api.get('/api/admin/access').then((r) => r.data.roles),
};

export const usersApi = {
  list: () => api.get('/api/admin/users').then((r) => r.data),
  // create and resetPassword resolve to { user, temporaryPassword }.
  // The server generates the password and returns it this once.
  create: (data) => api.post('/api/admin/users', data).then((r) => r.data),
  update: (id, data) => api.patch(`/api/admin/users/${seg(id)}`, data).then((r) => r.data),
  resetPassword: (id) => api.post(`/api/admin/users/${seg(id)}/reset-password`).then((r) => r.data),
};

export const auditApi = {
  list: (params) => api.get('/api/admin/audit-logs', params).then((r) => ({ items: r.data, meta: r.meta })),
};

// The store loads each collection through this map.
export const ADMIN_RESOURCES = {
  jobs: jobsApi,
  candidates: candidatesApi,
  applications: applicationsApi,
  requirements: requirementsApi,
  referrals: referralsApi,
  enquiries: enquiriesApi,
  insights: insightsApi,
  stories: storiesApi,
  expertise: expertiseApi,
  services: servicesApi,
  locations: locationsApi,
};
