import { api, upload, toFormData } from './client.js';

/*
  Public (no sign-in) API functions: published content and the four
  submission forms. Submissions are multipart so a document can be
  attached, and report upload progress through onProgress (0 to 1).
*/
export const DOCUMENT_ACCEPT = '.pdf,.doc,.docx';
export const DOCUMENT_MAX_BYTES = 5 * 1024 * 1024;

export const publicApi = {
  jobs: (options) => api.get('/api/public/jobs', undefined, options).then((r) => r.data),
  job: (slug, options) => api.get(`/api/public/jobs/${encodeURIComponent(slug)}`, undefined, options).then((r) => r.data),
  site: (options) => api.get('/api/public/site', undefined, options).then((r) => r.data),
  insights: (options) => api.get('/api/public/insights', undefined, options).then((r) => r.data),
  insight: (slug, options) => api.get(`/api/public/insights/${encodeURIComponent(slug)}`, undefined, options).then((r) => r.data),
  stories: (options) => api.get('/api/public/stories', undefined, options).then((r) => r.data),
  expertise: (options) => api.get('/api/public/expertise', undefined, options).then((r) => r.data),
  services: (options) => api.get('/api/public/services', undefined, options).then((r) => r.data),
  locations: (options) => api.get('/api/public/locations', undefined, options).then((r) => r.data),
};

const submit = (path, fields, files, options) => upload(path, toFormData(fields, files), options).then((r) => r.data);

export const formsApi = {
  // Hire Talent. files: { attachment }
  submitRequirement: (fields, attachment, options) => submit('/api/requirements', fields, { attachment }, options),
  // Candidate application. files: { resume } (required)
  submitApplication: (fields, resume, options) => submit('/api/applications', fields, { resume }, options),
  // General enquiry. files: { attachment }
  submitEnquiry: (fields, attachment, options) => submit('/api/enquiries', fields, { attachment }, options),
  // Referral. files: { resume }
  submitReferral: (fields, resume, options) => submit('/api/referrals', fields, { resume }, options),
};
