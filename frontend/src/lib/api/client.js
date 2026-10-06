/*
  API client - the one place the frontend talks to the ALLSEMIS backend.

  Every request in the app goes through request() or upload() below;
  no component calls fetch() itself. That keeps four things consistent:

  - Base URL. Requests go to "/api/..." on the same origin by default
    (the Vite dev server and the production host proxy /api to the
    backend). Set VITE_API_BASE_URL only when the API is on another
    origin. This is a URL, not a secret; no key is ever put in the
    frontend.
  - Session. The backend sets an HttpOnly cookie at sign-in. The
    browser sends it automatically (credentials: 'include'); JavaScript
    never sees, stores or sends a token, and nothing is kept in
    localStorage.
  - CSRF. Every request carries "X-Requested-With", which the backend
    requires on state-changing calls.
  - Errors. A failed request throws an ApiError with the backend's
    { code, message, details }, so screens show one consistent message
    shape. A 401 from a protected route also notifies the admin's auth
    provider (an expired session returns the user to the sign-in page).
*/

const BASE = ((import.meta.env && import.meta.env.VITE_API_BASE_URL) || '').replace(/\/+$/, '');

export class ApiError extends Error {
  constructor({ status = 0, code = 'NETWORK_ERROR', message = 'The server could not be reached. Check your connection and try again.', details } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details || [];
  }

  // { fieldName: message } for showing errors beside form fields.
  get fields() {
    return Object.fromEntries(this.details.filter((d) => d && d.field).map((d) => [d.field, d.message]));
  }
}

const unauthorizedListeners = new Set();
export function onUnauthorized(listener) {
  unauthorizedListeners.add(listener);
  return () => unauthorizedListeners.delete(listener);
}

export function apiUrl(path) {
  // The backend returns some links (a signed download link in
  // development, for example) as paths on its own origin.
  return /^https?:\/\//i.test(path) ? path : `${BASE}${path}`;
}

function toQuery(params) {
  if (!params) return '';
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') search.set(key, String(value));
  }
  const text = search.toString();
  return text ? `?${text}` : '';
}

function failure(status, body, path) {
  const error = new ApiError({
    status,
    code: body?.error?.code || (status === 0 ? 'NETWORK_ERROR' : 'REQUEST_FAILED'),
    message: body?.error?.message || (status ? 'The request could not be completed. Please try again.' : undefined),
    details: body?.error?.details,
  });
  if (status === 401 && !path.startsWith('/api/auth/login')) unauthorizedListeners.forEach((listener) => listener(error));
  return error;
}

/*
  request(path, options) -> { data, meta }
  options: method, query (object), body (sent as JSON), formData, signal
*/
export async function request(path, { method = 'GET', query, body, formData, signal } = {}) {
  const headers = { 'X-Requested-With': 'XMLHttpRequest', Accept: 'application/json' };
  let payload;
  if (formData) {
    payload = formData; // the browser sets the multipart boundary
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }

  let response;
  try {
    response = await fetch(`${BASE}${path}${toQuery(query)}`, { method, headers, body: payload, credentials: 'include', signal });
  } catch (error) {
    if (error?.name === 'AbortError') throw error;
    throw new ApiError();
  }

  let parsed = null;
  try {
    parsed = await response.json();
  } catch {
    parsed = null;
  }
  if (!response.ok || !parsed || parsed.success === false) throw failure(response.status, parsed, path);
  return { data: parsed.data, meta: parsed.meta || null };
}

/*
  upload(path, formData, { onProgress }) -> { data }
  Uses XMLHttpRequest because fetch cannot report upload progress.
  onProgress receives a number from 0 to 1.
*/
export function upload(path, formData, { onProgress, method = 'POST', signal } = {}) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(method, `${BASE}${path}`);
    xhr.withCredentials = true;
    xhr.responseType = 'text';
    xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest');
    xhr.setRequestHeader('Accept', 'application/json');
    if (onProgress) {
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) onProgress(event.total ? event.loaded / event.total : 0);
      };
    }
    xhr.onload = () => {
      let parsed = null;
      try {
        parsed = JSON.parse(xhr.responseText);
      } catch {
        parsed = null;
      }
      if (xhr.status >= 200 && xhr.status < 300 && parsed && parsed.success !== false) {
        if (onProgress) onProgress(1);
        resolve({ data: parsed.data, meta: parsed.meta || null });
      } else {
        reject(failure(xhr.status, parsed, path));
      }
    };
    xhr.onerror = () => reject(new ApiError());
    xhr.onabort = () => reject(Object.assign(new Error('Upload cancelled'), { name: 'AbortError' }));
    if (signal) signal.addEventListener('abort', () => xhr.abort(), { once: true });
    xhr.send(formData);
  });
}

export const api = {
  get: (path, query, options) => request(path, { ...options, query }),
  post: (path, body, options) => request(path, { ...options, method: 'POST', body }),
  patch: (path, body, options) => request(path, { ...options, method: 'PATCH', body }),
  put: (path, body, options) => request(path, { ...options, method: 'PUT', body }),
  delete: (path, body, options) => request(path, { ...options, method: 'DELETE', body }),
};

// Builds multipart form data from a plain object. Arrays are sent as
// one comma separated value, which the backend splits again. A field
// that was left empty is not sent at all, so the backend applies its
// own default instead of receiving an empty string.
export function toFormData(fields, files = {}) {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined || value === null || value === '') continue;
    if (Array.isArray(value) && value.length === 0) continue;
    form.append(key, Array.isArray(value) ? value.join(', ') : String(value));
  }
  for (const [key, file] of Object.entries(files)) {
    if (file) form.append(key, file, file.name);
  }
  return form;
}
