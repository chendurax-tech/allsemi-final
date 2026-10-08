// The frontend API layer. Import from here:
//   import { jobsApi, formsApi, ApiError } from '../lib/api/index.js';
export { api, request, upload, apiUrl, toFormData, onUnauthorized, ApiError } from './client.js';
export { authApi } from './auth.js';
export {
  jobsApi, candidatesApi, applicationsApi, requirementsApi, referralsApi, enquiriesApi,
  insightsApi, storiesApi, expertiseApi, servicesApi, locationsApi,
  atsApi, resumeApi, settingsApi, usersApi, auditApi, ADMIN_RESOURCES,
} from './admin.js';
export { uploadsApi, IMAGE_ACCEPT, IMAGE_MAX_BYTES } from './uploads.js';
export { publicApi, formsApi, chatApi, DOCUMENT_ACCEPT, DOCUMENT_MAX_BYTES } from './public.js';
