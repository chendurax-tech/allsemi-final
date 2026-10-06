# ALLSEMIS API reference

This document describes the HTTP API served by the ALLSEMIS backend (`backend/`). It was written by reading the source: routes, validators, controllers, models and tests. If the code and this document disagree, the code is right and this file needs an update.

Where each fact comes from:

| Topic | Source file |
| --- | --- |
| Routes and the permission each one needs | `src/routes/*.js` |
| Request bodies | `src/validators/*.js` |
| Allowed values and limits | `src/config/constants.js` |
| Roles and permissions | `src/config/permissions.js` |
| Response shapes | `src/models/*.js`, `src/controllers/*.js` |
| Worked request and response examples | `tests/*.test.js` |

Contents:

1. Conventions
2. Authentication
3. Roles and permissions
4. Health
5. Public content
6. Public submissions
7. Admin API
8. Upload behaviour
9. The rule-based ATS and the AI comparison
10. Audit log

---

## 1. Conventions

### 1.1 Base path

Every endpoint is under `/api`, except the two health endpoints `GET /health` and `GET /ready` (section 4). In local development the server listens on `http://localhost:4000` and the Vite dev server forwards `/api` to it, so the browser calls `/api/...` on the frontend origin.

### 1.2 Response shape

Success:

```json
{ "success": true, "data": { }, "meta": { "total": 42, "page": 1, "limit": 100 } }
```

`meta` is present only on paginated lists.

Error:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Some fields need attention.",
    "details": [ { "field": "email", "message": "Enter a valid email address." } ]
  }
}
```

`details` is present on validation errors only. It is a list of `{ field, message }`. Nested fields use a dotted path, for example `image.url`.

Every response carries an `X-Request-Id` header. The same id is written on the server log lines for that request.

Records are returned with `id` (a 24 character hex string) instead of `_id`, with `createdAt` and `updatedAt`, and without `__v`.

### 1.3 Error codes

These are the codes the code returns, with their HTTP status.

| Status | Code | When |
| --- | --- | --- |
| 400 | `BAD_REQUEST` | A rule the validators do not cover: an id in the URL that is not a valid id, a filter value that is not allowed, a missing required file, an empty file, a wrong current password on change-password, a new password equal to the current one, a password reset on your own account, and similar. The same code is used, with the 4xx status Express gives it, for a request that Express or a body parser rejects as malformed (for example a URL parameter that cannot be decoded, which answers 400, or an unsupported charset). |
| 400 | `VALIDATION_ERROR` | The body failed validation. `details` lists the fields. Also returned for a database-level validation failure. |
| 400 | `INVALID_JSON` | The JSON body could not be parsed. Only the body parser's parse failure maps to this code. |
| 400 | `INVALID_ID` | The database rejected a value as an id (most invalid ids are caught earlier and return `BAD_REQUEST`). |
| 400 | `UNEXPECTED_FILE` | A file was sent in a multipart field that does not accept one. |
| 400 | `UPLOAD_REJECTED` | Any other multipart limit was exceeded (too many fields or parts, a text field over 64 KB). |
| 401 | `UNAUTHENTICATED` | No valid session, or a refused sign-in (unknown email, wrong password, disabled account or paused account, all with the same message). |
| 403 | `FORBIDDEN` | The role lacks the permission, a published record is edited or deleted by a role without the publish permission, the `X-Requested-With` header is missing, or the `Origin` is not allowed. |
| 403 | `PASSWORD_CHANGE_REQUIRED` | An admin route was called by an account that is still on a temporary password (section 2.2). |
| 404 | `NOT_FOUND` | Unknown endpoint, unknown record, a record with no stored document, an expired download link, or, in production, a document that was stored on a development machine (section 8.5). |
| 409 | `CONFLICT` | A unique value is already in use (for example a user email), a referral was already converted, a job that has applications is deleted, an image that a saved record still uses is removed through the media endpoint, an application that is already shortlisted is shortlisted again, or a shortlist email is requested for an application that is not shortlisted, whose email was already sent, or while an attempt is in progress (section 7.4). |
| 409 | `AI_IN_PROGRESS` | An AI request is already running in this server process for the same ATS result (the comparison of one candidate, section 7.8) or for the same job (the draft of a requirement profile, section 7.2, or the comparison of several candidates, section 7.8). |
| 413 | `FILE_TOO_LARGE` | The uploaded file is over 5 MB. |
| 413 | `PAYLOAD_TOO_LARGE` | A JSON body over 1 MB or a URL-encoded body over 100 KB. |
| 415 | `UNSUPPORTED_FILE_TYPE` | The file content is not an accepted type, or the extension does not match the content. |
| 429 | `RATE_LIMITED` | A rate limit was reached (section 2.5). |
| 500 | `INTERNAL_ERROR` | An unexpected fault. In production the message is generic. Outside production it includes the internal error message. A stack trace is never sent. |
| 502 | `MEDIA_UPLOAD_FAILED` | An image upload did not succeed at Cloudinary: it refused the request, could not be reached, or answered without an address for the image. The reason is in the server log (`media.cloudinary_failed`), not in the response. A failed removal is logged only and does not produce this error. |
| 502 | `AI_FAILED` | The one request an AI action sends to OpenAI did not succeed: OpenAI could not be reached, did not answer within 60 seconds, or answered with an error status that is not a quota or billing refusal. The message is one of this API's own sentences. OpenAI's status and a short error identifier are in the server log (`ai.request_failed`), not in the response. Nothing is stored and the request is not retried (section 7.8). |
| 502 | `AI_INVALID_RESPONSE` | OpenAI answered an AI action, but the answer could not be used: it was not exactly the fields that action expects, with the expected types, or it was a refusal, cut off or filtered. Nothing is stored (section 7.8). |
| 503 | `DATABASE_UNAVAILABLE` | Returned by `GET /api/health` only, when the database connection is down (section 4). `GET /ready` answers 503 in the same situation, with its own fixed body and no error code. |
| 503 | `STORAGE_NOT_CONFIGURED` | Backblaze B2 is the document store in use but its variables are incomplete. Returned by an upload, and by a `resume-url` or `attachment-url` request for a document that is held in B2. |
| 503 | `MEDIA_NOT_CONFIGURED` | Cloudinary is the image store in use but its variables are incomplete. |
| 503 | `AI_NOT_CONFIGURED` | An AI action was asked for while `OPENAI_API_KEY` or `OPENAI_MODEL` is not set. OpenAI is not called, and nothing is written to the usage ledger (section 9.9). |
| 503 | `AI_QUOTA_EXCEEDED` | OpenAI refused the request of an AI action with the error code or type `insufficient_quota`, `billing_hard_limit_reached`, `billing_not_active` or `quota_exceeded` (usually with HTTP 429): the OpenAI account has no credit left, has reached its spend limit or has no active billing. The message says so, asks for an administrator to check billing on the OpenAI account, and says that nothing was changed. The request is not retried, and asking again does not help until the account is put right. |

The five `AI_` codes are returned by the three AI routes only: `POST /api/admin/ats-results/:id/ai-comparison` and `POST /api/admin/jobs/:id/candidate-comparison` (section 7.8), and `POST /api/admin/jobs/:id/requirement-profile/ai-draft` (section 7.2).

The frontend client (`frontend/src/lib/api/client.js`) adds two codes of its own that never come from the server: `NETWORK_ERROR` (the request did not reach the server) and `REQUEST_FAILED` (a failure response without the standard error body).

### 1.4 Required request headers

| Header | Rule |
| --- | --- |
| `X-Requested-With: XMLHttpRequest` | Required on every state-changing request (`POST`, `PATCH`, `PUT`, `DELETE`) to the auth routes, the admin routes and the four public submission routes. Without it the response is 403 `FORBIDDEN`. Not needed on `GET`. |
| `Origin` | Browsers send it automatically. If it is present on a state-changing request it must be exactly equal to one of the origins in `FRONTEND_URL`, otherwise 403 `FORBIDDEN`. The header is compared as it was sent (the configured origins are stored without a trailing slash, and a browser never sends one). A request with no `Origin` header passes this check. |
| `Content-Type` | `application/json` for JSON bodies. `multipart/form-data` for uploads (let the browser set the boundary). |
| `Cookie` | The session cookie, sent by the browser. Use `credentials: 'include'` with `fetch`. |

CORS allows only the origins in `FRONTEND_URL`, with credentials, the methods `GET, POST, PATCH, PUT, DELETE`, and the request headers `Content-Type` and `X-Requested-With`. The allowed origin is always answered by name, never with a wildcard. `http://localhost:5173` is the default origin only outside production. `X-Request-Id` is exposed to scripts. Preflight results may be cached for 600 seconds. A request from any other origin receives no CORS headers.

These checks are the same whatever `SameSite` value the session cookie has (section 2.1). When the frontend and the API are on the same site the cookie is `SameSite=Lax`, which is a third layer: a browser then does not attach it to a cross-site `POST`. When the frontend calls the API on another site the cookie has to be `SameSite=None`, that layer does not apply, and the `X-Requested-With` and `Origin` checks are what protects a state-changing request.

### 1.5 Body size limits

| Body | Limit |
| --- | --- |
| JSON | 1 MB |
| URL-encoded | 100 KB |
| Multipart | 1 file, 5 MB file size, 60 text fields, 64 KB per text field, 70 parts in total |

### 1.6 Validation and text cleaning

- Unknown fields are dropped. A client cannot set a field the validator does not list (for example `status` on a public form, `createdBy` on a job, or `role` anywhere except user management).
- Every text field must be a string. An object or array where text is expected fails with `VALIDATION_ERROR`. This is also what stops query operators such as `{ "$gt": "" }`.
- The raw text is length-checked before it is cleaned: a text value over 20,000 characters is rejected ("This text is too long.") whatever the field's own limit is. A list sent as an array may hold at most 200 items of at most 2,000 characters each, and a list sent as one string at most 20,000 characters. The cleaning therefore never runs over more than that.
- Text is then cleaned, and the field's own limit is checked on the cleaned text: control characters, HTML tags and any remaining `<` or `>` are removed. Single-line fields collapse whitespace to single spaces. Multi-line fields keep line breaks and collapse three or more line breaks to two. The tag-stripping pattern runs in linear time, so a long run of `<` characters cannot slow a request down.
- A text field over its limit is rejected ("Use at most N characters."), not cut.
- List fields come in two kinds:
  - **String list** (skills, tags, keywords): a JSON array of strings, or one string split on commas and line breaks. Items are cleaned, cut to the item length limit, de-duplicated without regard to case, and the list is cut to the item count limit.
  - **Line list** (responsibilities, address lines): a JSON array of strings, or one string split on line breaks. Items are cleaned, cut to the item length limit, empty lines dropped, and the list cut to the item count limit.
- Emails are trimmed and lower-cased, at most 254 characters.
- Phone numbers, when given, must be 6 to 25 characters from digits, spaces, `+`, `(`, `)`, `-` and `.`.
- Links must start with `http://` or `https://`, at most 300 characters.
- Slugs are lower-case letters, numbers and hyphens, at most 100 characters.
- Booleans in JSON bodies for the admin API must be real booleans (`true` / `false`). The consent checkbox on public forms also accepts the strings `true`, `on`, `1` and `yes`.
- Numbers sent in multipart forms are converted from text. For `positions` an empty string is not read as 0: an empty or missing value becomes the default of 1. `experienceYears` accepts an empty string and stores it as not stated.

### 1.7 Pagination, search, sort and filters (admin lists)

| Parameter | Meaning |
| --- | --- |
| `page` | Page number, starting at 1. Default 1. |
| `limit` | Page size. Default 100, maximum 500. For audit logs: default 50, maximum 200. |
| `q` | Case-insensitive "contains" search over the resource's search fields. At most 100 characters. Ignored on resources with no search fields. |
| `sort` | A field name for ascending order, or the name with a leading `-` for descending, for example `sort=-updatedAt`. Only the fields listed for the resource are accepted. Anything else falls back to the default order. |
| filters | Exact-match filters, listed per resource. A value outside the allowed set returns 400 `BAD_REQUEST`. A filter that expects an id returns 400 when the value is not a valid id. |

Only plain string values are read from the query string. `?status[$ne]=draft` is ignored, not executed.

List responses return `data` as an array and `meta` as `{ total, page, limit }`, where `total` counts all records that match the filter.

### 1.8 Cookies

One cookie is used: the session cookie `allsemis_sid` (section 2.1). The API sets no other cookie and returns no token in any response body.

### 1.9 Caching

Every `/api` response has `Cache-Control: no-store`, and so have `GET /health` and `GET /ready`. The exception is the public content endpoints, which send `Cache-Control: public, max-age=0, must-revalidate`. A browser may keep a copy of those but checks it with the server before every use, so a record that was just edited, published or unpublished in the admin is correct at the next page load.

---

## 2. Authentication

Sign-in creates a server-side session stored in MongoDB. The browser holds only an opaque random token in an HttpOnly cookie.

### 2.1 Session cookie

| Attribute | Value |
| --- | --- |
| Name | `allsemis_sid` |
| `HttpOnly` | Always |
| `Secure` | Always when `NODE_ENV=production`, and whenever `SameSite` is `None` |
| `SameSite` | Decided for each sign-in request from `COOKIE_SAMESITE` (`lax` by default, `strict` or `none`) and from how the browser reports the request. See below. |
| `Partitioned` | Set when `SameSite` is `None` |
| `Path` | `/` |
| `Max-Age` | `SESSION_TTL_HOURS` hours (default 12) |
| `Domain` | Set only when `COOKIE_DOMAIN` is set. Without it the cookie belongs to the API host only. |

The `SameSite` value (`sessionSameSite` in `src/services/authService.js`):

| `COOKIE_SAMESITE` | The browser reports the sign-in request as | `SameSite` |
| --- | --- | --- |
| `lax` (default) | same-origin or same-site (`Sec-Fetch-Site: same-origin` or `same-site`) | `Lax` |
| `lax` (default) | cross-site (`Sec-Fetch-Site: cross-site`) | `None` |
| `lax` (default) | any other value, or no `Sec-Fetch-Site` header | `Lax` |
| `none` | anything | `None` |
| `strict` | anything | `Strict` |

- A browser sets `Sec-Fetch-Site` itself and a page cannot set it. The rule exists because a browser refuses a `SameSite=Lax` cookie that arrives in a cross-site response: with the frontend on one site calling the API directly on another, a `Lax` cookie is not kept and the request after the sign-in is answered 401.
- `POST /api/auth/logout` clears the cookie with the same attributes, decided from the sign-out request in the same way.
- `COOKIE_SAMESITE=strict` logs a `config.warning` at start-up: signing in then works only when the frontend and the API are on the same site.
- With the frontend and the API on different sites the session cookie is a third-party cookie. Browsers that block third-party cookies (Safari and other WebKit browsers by default, Brave, Chrome in Incognito or with the setting switched on) may refuse it even with `SameSite=None`. The `Partitioned` attribute is meant to keep the cookie working where the browser supports it, and that was not verified in those browsers. A deployment in which the frontend host forwards `/api` to this API makes the cookie first-party and does not have this limit (`backend/README.md`, "Frontend on Vercel, and how it reaches the API").
- The request header and origin checks of section 1.4 do not depend on `SameSite` and apply in every case.

The token is 32 random bytes. The database stores an HMAC-SHA256 of it keyed with `SESSION_SECRET`, never the token itself. A session ends at its fixed expiry time (it is not extended by activity), at sign-out, or when it is revoked (section 2.4). MongoDB removes expired sessions through a TTL index.

### 2.2 Endpoints

#### POST /api/auth/login

Public. Needs `X-Requested-With`. Rate limited (section 2.5).

| Field | Type | Rules |
| --- | --- | --- |
| `email` | string | Required. Valid email. |
| `password` | string | Required. 1 to 200 characters. |

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "665f1c2e9b3a4d0012ab34cd",
      "name": "Sample Recruiter",
      "email": "recruiter@example.com",
      "role": "RECRUITER",
      "mustChangePassword": false,
      "permissions": ["jobs:read", "jobs:write", "jobs:publish", "..."]
    }
  }
}
```

The response also sets the session cookie, with the attributes of section 2.1. No token is in the body. Errors:

- 401 `UNAUTHENTICATED`, message "The email or password is not correct. After five wrong attempts, sign-in for an account pauses for fifteen minutes.", for an unknown email, a wrong password, a disabled account and a paused account alike (section 2.3). The status, code and message are the same in all four cases, so the answer does not show whether an email has an account.
- 429 `RATE_LIMITED` when the per-IP limit is reached.

`mustChangePassword` is `true` while the account is on a temporary password: after an administrator created the account or reset its password, or after `npm run create-admin` generated the password. While it is set the account can sign in, sign out, call `GET /api/auth/me` and change its password. Every route under `/api/admin` answers 403 `PASSWORD_CHANGE_REQUIRED` ("Change your temporary password to continue.") until the password has been changed.

#### POST /api/auth/logout

Signed-in users. Deletes the session on the server and clears the cookie, with the same attributes the sign-in sets (section 2.1).

```json
{ "success": true, "data": { "signedOut": true } }
```

#### GET /api/auth/me

Signed-in users. Returns the same `user` object as login. 401 when there is no valid session.

#### POST /api/auth/change-password

Signed-in users. Needs `X-Requested-With`. Rate limited (section 2.5).

| Field | Type | Rules |
| --- | --- | --- |
| `currentPassword` | string | Required. 1 to 200 characters. |
| `newPassword` | string | Required. Password rule below. Must differ from the current password. |

```json
{ "success": true, "data": { "changed": true } }
```

A wrong `currentPassword` returns 400 `BAD_REQUEST`. A `newPassword` equal to the current password returns 400 `BAD_REQUEST` with `details` naming the field `newPassword` ("Choose a password that is different from the current one."), so a temporary password is really replaced. A `newPassword` that breaks the password rule returns 400 `VALIDATION_ERROR`. On success, `mustChangePassword` becomes `false` and every other session of that user is signed out. The session that made the request stays signed in.

**Password rule** (used wherever a person chooses a password): at least 12 characters, at most 200, with at least one letter and one digit.

### 2.3 Account lockout

After 5 wrong passwords for one account with no successful sign-in in between, sign-in for that account is paused for 15 minutes. While it is paused, sign-in is refused even with the right password, with exactly the same 401 `UNAUTHENTICATED` answer (same status, code and message) that a wrong password or an unknown email gets. There is no separate code for a paused account. The message itself mentions the pause, so a person who is paused can tell why a correct password is refused.

Wrong passwords are counted in the database in one atomic step (`$inc`), so attempts that arrive at the same moment are all counted. A successful sign-in, or a password reset by an administrator, clears the counter.

### 2.4 Session revocation

All sessions of a user are deleted when:

- an administrator changes the user's role,
- an administrator disables the user,
- an administrator resets the user's password (`POST /api/admin/users/:id/reset-password`),
- the user changes their own password (all sessions except the current one).

A session is also rejected, and deleted, when its user no longer exists or is disabled.

### 2.5 Rate limits

Counted in memory, per server instance. Every limiter counts per client IP address, except the AI limiter, which counts per signed-in user. `GET /health` and `GET /ready` are outside `/api` and are answered before any limiter, so they are never rate limited.

| Limiter | Applies to | Limit |
| --- | --- | --- |
| API | Everything under `/api` | 600 requests per 15 minutes |
| Sign-in | `POST /api/auth/login` | 10 failed requests per 15 minutes. A successful sign-in is not counted. |
| Password change | `POST /api/auth/change-password` | 10 failed requests per 15 minutes. A successful change is not counted. |
| Public forms | The four submission endpoints together | 8 requests per 10 minutes |
| Uploads | `POST /api/admin/media` | 60 requests per 10 minutes |
| Downloads | The signed link endpoints and `GET /api/files/local/:token` | 120 requests per 10 minutes |
| AI | The three AI routes together: `POST /api/admin/ats-results/:id/ai-comparison`, `POST /api/admin/jobs/:id/requirement-profile/ai-draft` and `POST /api/admin/jobs/:id/candidate-comparison` | 20 requests per 10 minutes, per signed-in user |

Over the limit the response is 429 `RATE_LIMITED`. Standard `RateLimit` headers (draft 7) are sent. The limiters are skipped when `NODE_ENV=test` unless a test sets `RATE_LIMIT_IN_TESTS=1`.

For the sign-in and password-change limiters only requests that end in an error (a status of 400 or above) are counted, so people who sign in normally from a shared address do not use up the limit. The per-account pause of section 2.3 is the second guard against guessing one account from many addresses.

The AI limiter is low because every AI action is a paid request to OpenAI. The three AI routes share one count. Its key is the id of the signed-in user, so two users behind one address each have their own count. It runs after the session check and before the permission check, and it counts requests to the three routes, not requests that reached OpenAI: a request that is then refused or fails (400, 403, 404, 409, 502, 503) is counted too.

Confirmation emails have their own cap, per recipient address and not per IP (section 6).

---

## 3. Roles and permissions

There are four roles. The table is `ROLE_PERMISSIONS` in `src/config/permissions.js`. The server checks it on every admin request. The role is read from the session and the database, never from anything the client sends.

| Permission | SUPER_ADMIN | RECRUITER | HIRING_MANAGER | CONTENT_MANAGER |
| --- | :-: | :-: | :-: | :-: |
| `jobs:read` | yes | yes | yes | yes |
| `jobs:write` | yes | yes | no | no |
| `jobs:publish` | yes | yes | no | no |
| `jobs:delete` | yes | no | no | no |
| `candidates:read` | yes | yes | yes | no |
| `candidates:write` | yes | yes | no | no |
| `candidates:delete` | yes | no | no | no |
| `resumes:read` | yes | yes | yes | no |
| `applications:read` | yes | yes | yes | no |
| `applications:write` | yes | yes | no | no |
| `applications:shortlist` | yes | yes | no | no |
| `requirements:read` | yes | yes | yes | no |
| `requirements:write` | yes | yes | no | no |
| `requirements:delete` | yes | no | no | no |
| `referrals:read` | yes | yes | no | no |
| `referrals:write` | yes | yes | no | no |
| `referrals:delete` | yes | no | no | no |
| `enquiries:read` | yes | yes | no | no |
| `enquiries:write` | yes | yes | no | no |
| `enquiries:delete` | yes | no | no | no |
| `ats:read` | yes | yes | yes | no |
| `ats:run` | yes | yes | no | no |
| `ats:review` | yes | yes | yes | no |
| `content:read` | yes | no | no | yes |
| `content:write` | yes | no | no | yes |
| `content:publish` | yes | no | no | yes |
| `content:delete` | yes | no | no | yes |
| `media:upload` | yes | no | no | yes |
| `settings:read` | yes | yes | yes | yes |
| `settings:write` | yes | no | no | yes |
| `users:manage` | yes | no | no | no |
| `audit:read` | yes | no | no | no |

In short:

- **SUPER_ADMIN**: everything, including users, deletes and the audit log.
- **RECRUITER**: day to day recruitment, including shortlisting an application and labelling candidates and applications. No website content, no users, no deletes.
- **HIRING_MANAGER**: reads jobs, candidates, resumes, applications, requirements and ATS results, and may record the review decision on an ATS result. Cannot shortlist or label.
- **CONTENT_MANAGER**: website content, images and the public contact details. May read jobs. Sees no candidate data.

Shortlisting has its own permission, `applications:shortlist`, because it changes an application's status and emails the candidate. `applications:write` alone does not allow it.

`ats:run` covers running the rule-based evaluation (for one candidate, or again for every result of a job), starting either AI comparison (section 7.8) and reading the AI usage estimate (section 7.15). The AI draft of a requirement profile needs `ats:run` and `jobs:write` together (section 7.2). `ats:read` is enough to read a stored AI comparison, of one candidate or of several, so a hiring manager can read one and cannot start one. Saving or removing a job's requirement profile needs `jobs:write`.

To change what a role can do, edit `ROLE_PERMISSIONS`. Nothing else needs to change.

---

## 4. Health

Three endpoints, all public. None needs a sign-in, a cookie or a request header, and none returns data about the system. The first two are outside `/api`: they do not use the response shape of section 1.2, they are answered before CORS, the rate limiters and the body parsers (`src/app.js`), and both are sent with `Cache-Control: no-store`.

#### GET /health

Liveness: is the process up. It needs no database and no other service, so it answers 200 whenever the process can answer at all. The body is fixed:

```json
{ "status": "ok", "service": "allsemis-api" }
```

It holds no version, no host name and no configuration. It is the endpoint for an uptime monitor. In production: `https://allsemi-backend.onrender.com/health`.

#### GET /ready

Readiness: can the process serve requests that need the database. 200 when the database connection is up:

```json
{ "status": "ready", "service": "allsemis-api" }
```

503 when it is not:

```json
{ "status": "unavailable", "service": "allsemis-api" }
```

#### GET /api/health

Unchanged. For the host's health check.

```json
{ "success": true, "data": { "status": "ok" } }
```

When the database connection is down the status is 503 and the body is the standard error shape:

```json
{ "success": false, "error": { "code": "DATABASE_UNAVAILABLE", "message": "The database is not reachable." } }
```

The host's health check path (Render) can stay `/api/health` or be set to `/ready`: both answer 503 while the database connection is down. An uptime monitor should use `/health`.

---

## 5. Public content

No sign-in. Read only. Only published records are returned (for locations: only records with `active: true`). Responses are built from an explicit field list, so drafts and internal fields cannot leak. No candidate, application, requirement, referral or enquiry data can be reached from these routes. Responses are sent with `Cache-Control: public, max-age=0, must-revalidate` (section 2), so an edit saved in the admin is public at the next page load.

#### GET /api/public/jobs

Published jobs, featured first, then newest `publishedAt` first. At most 500.

```json
{
  "success": true,
  "data": [
    {
      "id": "665f1c2e9b3a4d0012ab34cd",
      "slug": "design-verification-engineer",
      "title": "Design Verification Engineer",
      "category": "Semiconductor",
      "department": "Verification",
      "location": "Bangalore, IN",
      "employmentType": "Full-time",
      "experienceLevel": "Mid-Senior",
      "summary": "...",
      "description": "...",
      "responsibilities": ["..."],
      "requiredSkills": ["SystemVerilog", "UVM"],
      "preferredSkills": ["Python"],
      "keywords": ["UVM"],
      "status": "published",
      "featured": false,
      "applicationEnabled": true,
      "publishedAt": "2026-09-01",
      "updatedAt": "2026-09-20"
    }
  ]
}
```

Dates are `YYYY-MM-DD` strings here.

A job's requirement profile and its stored comparison of several candidates (sections 7.2 and 7.8) are for staff. They are not in the field list of the public job, so neither public job endpoint ever returns them.

#### GET /api/public/jobs/:slug

One published job, same shape. 404 `NOT_FOUND` ("That position is not available.") when the slug is unknown or the job is a draft or archived.

#### GET /api/public/insights

Published articles, newest `date` first (articles with the same date: the one added last first), without the body. At most 500. The public Insights pages and the home page section read this list.

```json
{
  "success": true,
  "data": [
    {
      "slug": "notes-on-dft-hiring",
      "title": "Notes on DFT hiring",
      "excerpt": "A short primer.",
      "category": "Semiconductor",
      "tags": [],
      "topics": [],
      "image": "https://images.example.com/cover.jpg",
      "alt": "A cover",
      "author": "",
      "date": "2026-09-10",
      "readTime": "",
      "featured": false,
      "showOnLanding": true,
      "landingOrder": 1,
      "status": "published",
      "seoTitle": "",
      "seoDescription": ""
    }
  ]
}
```

`image` and `alt` are plain strings here (the image URL and its alt text).

`showOnLanding` says whether the article is in the Insights section of the landing page, and `landingOrder` where (lowest first; articles with the same number newest first). The landing page reads them from this list and shows every published article that is switched on, however many there are. An article saved before these fields existed follows its `featured` flag, which is what decided the landing page until then. The first time such an article is edited through the admin API, the answer it had is stored, so changing `featured` afterwards does not move it on or off the landing page.

#### GET /api/public/insights/:slug

One published article, same fields plus `body`: an array of blocks. A block is `{ "type": "p" | "h2" | "quote", "text": "..." }` or `{ "type": "list", "items": ["..."] }`. 404 when the slug is unknown or the article is a draft.

#### GET /api/public/stories

Published stories ordered by `order`, then creation time. At most 100. The landing page Stories section reads this list and shows the stories whose `showOnLanding` is `true`, in this order.

```json
{ "success": true, "data": [ { "id": "...", "quote": "...", "name": "...", "role": "...", "photo": "https://...", "alt": "...", "showOnLanding": true, "status": "published" } ] }
```

A story saved before `showOnLanding` existed, and never given a value since, is reported as `true`.

#### GET /api/public/expertise

Published sectors ordered by `num`. At most 100. Fields: `id` (the sector's stable `key`), `num`, `name`, `shortName`, `slug`, `desc`, `image` (URL), `alt`, `introduction`, `domainOverview` (stored as `overview`), `domains`, `roles`, `hiringChallenges`, `processFlow`, `representativeSearches`, `relatedInsight`.

#### GET /api/public/services

Published services ordered by `num`. At most 100.

```json
{
  "success": true,
  "data": [
    {
      "id": "permanent-staffing",
      "num": "01",
      "slug": "permanent-staffing",
      "name": "Permanent Staffing",
      "icon": "die",
      "status": "published",
      "description": "...",
      "cta": { "label": "...", "to": "/employers/permanent-staffing" },
      "page": {
        "headline": "...", "lead": "...",
        "fitTitle": "...", "fit": ["..."],
        "processTitle": "...", "process": ["..."],
        "receiveTitle": "...", "receive": ["..."],
        "tagsTitle": "...", "tags": ["..."],
        "questions": ["Question | Answer"]
      }
    }
  ]
}
```

#### GET /api/public/locations

Locations with `active: true`, oldest first (`createdAt`, then `_id`, so the order is stable when two records share a creation time). At most 100.

```json
{
  "success": true,
  "data": [
    {
      "id": "pune",
      "city": "Pune",
      "country": "India",
      "region": "",
      "label": "",
      "type": "network",
      "status": "listed",
      "isHeadquarters": false,
      "address": [],
      "phone": "",
      "email": "",
      "hours": [],
      "coordinates": [73.85, 18.52],
      "description": "",
      "visual": { "labelSide": "right" },
      "active": true
    }
  ]
}
```

`coordinates` is `[longitude, latitude]`. `visual` also carries `labelRaise` (a number) when the stored value is not 0. For a location of type `network`, `address`, `phone`, `email` and `hours` are always empty and `isHeadquarters` is always `false`, whatever is stored.

#### GET /api/public/site

The public contact details.

```json
{ "success": true, "data": { "contact": { "email": "hello@example.com", "phone": "+91 90000 12345", "address": ["Line one", "Line two"], "hours": ["Mon-Fri"] } } }
```

---

## 6. Public submissions

Four endpoints, no sign-in. Each accepts `multipart/form-data` (needed when a file is attached) or JSON. Each request passes, in order: the form rate limit, the header and origin check, the multipart limits, the honeypot, field validation, then file inspection by content.

Common behaviour:

- Success is always `201` with `{ "success": true, "data": { "received": true } }`. No record data is returned.
- **Honeypot**: every form may carry a field named `website` (at most 200 characters) that the site leaves empty. A submission that arrives with it filled is answered with the same 201 response and is discarded. Nothing is saved and no email is sent.
- The record is saved first. Two emails are then sent after the response: a notification to `ADMIN_NOTIFICATION_EMAIL` (reply-to set to the sender) and a confirmation to the sender. An email failure is logged and never fails the submission.
- **Confirmation emails are fixed wording.** The address was typed into a public form and is not verified, so a confirmation repeats nothing the visitor typed: no name, subject, role or message. The only variable is the title of the job applied to, which staff write. The team notification carries the submitted details, HTML-escaped.
- **At most 3 confirmation emails per address per hour.** The count is kept in memory, per server instance. Over that number the confirmation is skipped (and logged as `email.confirmation_capped`). The submission is still saved and the team notification is still sent.
- A new requirement, application, enquiry or referral always starts with status `NEW`. A visitor cannot set status, labels, priority, notes or any other internal field.
- If saving the record fails after the file was stored, the file is removed again.
- Each submission writes an audit entry (section 10).

#### POST /api/requirements (Hire Talent)

File field: `attachment` (optional). PDF, DOC or DOCX, up to 5 MB.

| Field | Type | Rules |
| --- | --- | --- |
| `contactName` | string | Required. At most 120. |
| `company` | string | Required. At most 160. |
| `email` | string | Required. Valid email. |
| `phone` | string | Optional. Phone rule. |
| `hiringType` | string | Optional. Empty, or one of `Permanent Staffing`, `Project Staffing`, `RPO`, `Specialised Search`. |
| `domain` | string | Optional. At most 120. |
| `role` | string | Required. At most 300. The role or roles being hired. |
| `positions` | whole number | Optional. 1 to 999. Default 1. |
| `location` | string | Optional. At most 160. |
| `workMode` | string | Optional. Empty, or one of `ON_SITE`, `HYBRID`, `REMOTE`. |
| `description` | string | Optional. Multi-line. At most 6000. |
| `consent` | boolean | Required, must be true. |

The saved requirement has `source: "WEBSITE"`, `priority: "MEDIUM"` and `consentAt` set to the time of submission.

#### POST /api/applications (candidate application)

File field: `resume` (required). PDF, DOC or DOCX, up to 5 MB.

| Field | Type | Rules |
| --- | --- | --- |
| `name` | string | Required. At most 120. |
| `email` | string | Required. Valid email. |
| `phone` | string | Optional. Phone rule. |
| `location` | string | Optional. At most 120. |
| `preferredLocation` | string | Optional. At most 120. |
| `headline` | string | Optional. At most 160. The current role. |
| `domain` | string | Optional. At most 120. |
| `experienceYears` | number | Optional. Empty, or 0 to 60. |
| `skills` | string list | Optional. At most 40 items of at most 80 characters. |
| `noticePeriod` | string | Optional. At most 80. |
| `expectedCompensation` | string | Optional. At most 120. |
| `profileUrl` | string | Optional. Link rule. |
| `message` | string | Optional. Multi-line. At most 4000. |
| `jobId` | string | Optional. Empty for a general application, or the `id` of a published job. |
| `consent` | boolean | Required, must be true. |

Behaviour:

- With a `jobId`: the job must exist and be published, otherwise 404 `NOT_FOUND` ("That position is not available."). A draft or archived job answers exactly like an unknown one. If the job has `applicationEnabled: false` the response is 400 `BAD_REQUEST`.
- No resume: 400 `BAD_REQUEST`.
- **One candidate per email.** If no candidate has this email, one is created from the submitted profile with `source: "WEBSITE"`, the submitted resume and `consentAt` set to the time of submission (`findOrCreateCandidate` in `src/services/candidateService.js`).
- **A public submission never changes an existing candidate.** The form is not signed in and an email address is not a secret, so when a candidate with this email already exists the record is left exactly as it is: no empty field is filled in, no skills are merged, the name and `consentAt` are not touched, the resume on the profile is not replaced and no stored file is deleted. A recruiter sees the new application beside the existing profile and updates the profile in the admin if the details are right.
- **Every submission creates a new application.** No earlier application is ever edited. The new application stores the message, its own resume and `submittedProfile`: the `name`, `phone`, `location`, `preferredLocation`, `headline`, `domain`, `experienceYears`, `skills`, `noticePeriod`, `expectedCompensation` and `profileUrl` as they were typed into the form for this application. A repeat for the same job (or a second general application) is still a new row, whatever the status or labels of the earlier one. It is only flagged in the audit metadata as `repeat: true`.
- **An application always starts as `NEW`, with no labels and no shortlist details.** Nothing sent through the form can change that: a `status`, `labels` or `shortlist` value in the submission is dropped, and a new candidate record starts with no labels. An application never triggers the shortlist email. Only the shortlist action of a signed-in user changes the status (section 7.4).
- With a job, the rule-based ATS runs for the candidate and the job straight away (section 9), against the job's requirement profile when it has one, but only when no ATS result exists yet for that candidate and job. A later public submission does not run it again and does not point the existing result at the new application, so a result a recruiter may already have reviewed is replaced only when staff run the evaluation themselves. If the evaluation fails, the application still stands and the failure is logged. The evaluation changes nothing on the application: it stays `NEW`. A submission never calls a model: no AI action starts by itself (section 9.6).
- The team notification shows the details submitted with this application and says when the address already had a candidate record (and that the existing profile was not changed).
- Audit action: `application.submitted`, with metadata `candidateId`, `newCandidate` and `repeat`.

#### POST /api/enquiries (general enquiry)

File field: `attachment` (optional). PDF, DOC or DOCX, up to 5 MB.

| Field | Type | Rules |
| --- | --- | --- |
| `name` | string | Required. At most 120. |
| `email` | string | Required. Valid email. |
| `phone` | string | Optional. Phone rule. |
| `company` | string | Optional. At most 160. |
| `type` | string | Optional. One of `HIRING`, `CAREER`, `PARTNERSHIP`, `GENERAL`, `OTHER`. Default `GENERAL`. An empty value counts as left out. |
| `subject` | string | Optional. At most 200. |
| `message` | string | Required. Multi-line. At most 6000. |

This form has no consent field.

#### POST /api/referrals (referral)

File field: `resume` (optional). PDF, DOC or DOCX, up to 5 MB.

| Field | Type | Rules |
| --- | --- | --- |
| `referrerName` | string | Required. At most 120. |
| `referrerEmail` | string | Required. Valid email. |
| `referrerPhone` | string | Optional. Phone rule. |
| `relationship` | string | Optional. At most 160. |
| `candidateName` | string | Required. At most 120. |
| `candidateEmail` | string | Optional. Empty or a valid email. Needed later to convert the referral. Staff can add it afterwards (section 7.6). |
| `candidatePhone` | string | Optional. Phone rule. |
| `candidateRole` | string | Optional. At most 160. |
| `candidateProfileUrl` | string | Optional. Link rule. |
| `domain` | string | Optional. At most 120. |
| `message` | string | Required. Multi-line. At most 4000. |
| `consent` | boolean | Required, must be true. |

The confirmation email goes to the referrer. The referred person is not emailed.

Example with `fetch`:

```js
const form = new FormData();
form.append('name', 'Test Candidate');
form.append('email', 'candidate.one@example.com');
form.append('skills', 'SystemVerilog, UVM, Functional Coverage');
form.append('consent', 'true');
form.append('resume', file, file.name);

await fetch('/api/applications', {
  method: 'POST',
  headers: { 'X-Requested-With': 'XMLHttpRequest' },
  credentials: 'include',
  body: form,
});
```

---

## 7. Admin API

Everything under `/api/admin` requires a valid session (401 `UNAUTHENTICATED` otherwise) and the permission named on the route (403 `FORBIDDEN` otherwise). Where a route names two permissions, the role must hold both. State-changing requests also need `X-Requested-With` and an allowed origin. An account that is still on a temporary password gets 403 `PASSWORD_CHANGE_REQUIRED` from every route here until the password is changed (section 2.2).

"CRUD list" below means the shared list behaviour of section 1.7.

### 7.1 Access matrix

#### GET /api/admin/access

Any signed-in user. Returns the role and permission table for the admin UI.

```json
{ "success": true, "data": { "roles": [ { "role": "SUPER_ADMIN", "permissions": ["jobs:read", "..."] } ] } }
```

### 7.2 Jobs

| Method and path | Permission |
| --- | --- |
| `GET /api/admin/jobs` | `jobs:read` |
| `GET /api/admin/jobs/:id` | `jobs:read` |
| `POST /api/admin/jobs` | `jobs:write` |
| `PATCH /api/admin/jobs/:id` | `jobs:write` |
| `DELETE /api/admin/jobs/:id` | `jobs:delete` |
| `PUT /api/admin/jobs/:id/requirement-profile` | `jobs:write` |
| `DELETE /api/admin/jobs/:id/requirement-profile` | `jobs:write` |
| `POST /api/admin/jobs/:id/requirement-profile/ai-draft` | `jobs:write` and `ats:run` |

The last three are described under "The requirement profile of a job" at the end of this section. Three more routes under `/api/admin/jobs/:id` belong to the ATS and are in section 7.8: `POST .../ats/re-run`, and `GET` and `POST .../candidate-comparison`.

List: search fields `title`, `category`, `department`, `location`. Filters `status` (`draft`, `published`, `archived`) and `category`. Sortable `createdAt`, `updatedAt`, `title`, `publishedAt`. Default order `-updatedAt`.

Body for create. `PATCH` takes the same fields, all optional, and changes only the fields that are sent.

| Field | Type | Rules |
| --- | --- | --- |
| `title` | string | Required. At most 160. |
| `slug` | string | Optional. Slug rule. Empty means "derive from the title". |
| `category` | string | At most 80. |
| `department` | string | At most 120. |
| `location` | string | At most 120. |
| `employmentType` | string | `Full-time`, `Contract` or `Contract-to-hire`. Default `Full-time`. |
| `experienceLevel` | string | `Entry-Level`, `Mid-Level`, `Mid-Senior`, `Senior` or `Lead / Principal`. Default `Mid-Senior`. |
| `summary` | string | Multi-line. At most 600. |
| `description` | string | Multi-line. At most 8000. |
| `responsibilities` | line list | At most 40 items of at most 400 characters. |
| `requiredSkills` | string list | At most 40 items of at most 80 characters. |
| `preferredSkills` | string list | Same. |
| `keywords` | string list | Same. |
| `status` | string | `draft`, `published` or `archived`. Default `draft`. |
| `featured` | boolean | Default `false`. |
| `applicationEnabled` | boolean | Default `true`. |

```json
{
  "success": true,
  "data": {
    "id": "665f1c2e9b3a4d0012ab34cd",
    "title": "Physical Design Engineer",
    "slug": "physical-design-engineer",
    "category": "Semiconductor",
    "department": "",
    "location": "Bangalore, IN",
    "employmentType": "Full-time",
    "experienceLevel": "Mid-Senior",
    "summary": "",
    "description": "",
    "responsibilities": ["Own block-level PnR", "Close timing"],
    "requiredSkills": ["Place and Route", "STA"],
    "preferredSkills": [],
    "keywords": [],
    "status": "draft",
    "featured": false,
    "applicationEnabled": true,
    "publishedAt": null,
    "createdAt": "2026-10-04T10:00:00.000Z",
    "updatedAt": "2026-10-04T10:00:00.000Z",
    "requirementProfile": null
  }
}
```

Create returns 201. Delete returns `{ "id": "...", "deleted": true }`.

Notable behaviour:

- **Slug.** The server derives the slug from the title when it is empty and makes it unique by adding `-2`, `-3` and so on. On update the slug changes only when `slug` is sent.
- **Publishing needs `jobs:publish`.** Creating a job as `published`, or changing a job's status to or from `published`, is refused with 403 unless the role holds `jobs:publish`. Having `jobs:write` is not enough. (In the current table every role with `jobs:write` also holds `jobs:publish`; the rule matters if the table is changed.)
- **A published job can only be edited or deleted by a role that holds `jobs:publish`.** What is published is what the public sees, so any `PATCH` or `DELETE` on a job whose stored status is `published` is refused with 403 without that permission, whatever fields the request sends. This is on top of `jobs:write` or `jobs:delete` on the route.
- `publishedAt` is set by the server the first time a job becomes `published` and is not changed afterwards.
- Only `published` jobs appear on the public endpoints. Moving a job back to `draft` or to `archived` removes it from them.
- `createdBy` and `updatedBy` are recorded on the server and are not returned.
- A job that has applications cannot be deleted: `DELETE` answers 409 `CONFLICT` ("Archive it instead of deleting it."). Set its status to `archived` instead. Deleting a job that has no applications removes the job and any ATS results stored for it.
- `requirementProfile` is always present on a job returned by the admin API, in the list and on its own: `null`, or the profile described below. It is not a field of `POST` or `PATCH`: a `requirementProfile` sent with either is dropped like any other unknown field. It is changed only through its own routes.
- A stored comparison of several candidates (section 7.8) is kept on the job document and is never returned with the job. It is read through its own endpoint.

#### The requirement profile of a job

A requirement profile is a structured list of what one job asks for: skills, tools, domains, experience, education, certifications, seniority, location, work arrangement, responsibilities and other conditions, with optional weights for the rule-based score. A recruiter writes it. The model can draft one from the job's own text when a recruiter asks, and a draft is stored only after a recruiter has read it and saved it.

- **It is optional.** A job without one is evaluated by the rule-based ATS exactly as before, with the baseline weights. A job with one is evaluated against it (section 9.1), and the two AI comparisons are given it as the list of requirements (sections 9.6 and 9.8).
- **It is for staff only.** It is never part of the public API (section 5).
- **Saving or removing it does not change the job's `updatedAt`**, which is the "updated" date a visitor sees on the job. `updatedBy` is not changed either.
- **Saving or removing it does not run the rules again.** ATS results that already exist keep their scores until the rules are run again, with `POST /api/admin/jobs/:id/ats/re-run` for every result of the job or with `POST /api/admin/ats/run` for one (section 7.8). An evaluation made after the save uses the profile.
- The publish rule of the job routes above is not applied here: the profile is not part of what is published, so `jobs:write` is enough on a published job as well.

`requirementProfile` as it is returned:

| Field | Type | Rules and meaning |
| --- | --- | --- |
| `requiredSkills` | string list | At most 40 items of at most 80 characters. The technical skills the job requires. |
| `preferredSkills` | string list | Same limits. The technical skills the job prefers. |
| `tools` | string list | Same limits. Tools and technologies. |
| `domains` | string list | Same limits. Industries or application areas. |
| `requiredExperience` | string | Multi-line. At most 400. The experience the job requires, in words. |
| `minYears` | number or null | 0 to 50. The minimum years of experience. `null` when not given. |
| `preferredExperience` | string | Multi-line. At most 400. Experience the job prefers. |
| `preferredYears` | number or null | 0 to 50. The preferred years of experience. `null` when not given. |
| `education` | line list | At most 20 items of at most 300 characters. Degrees or fields of study. |
| `certifications` | line list | Same limits. Certifications or licences. |
| `seniority` | string | At most 120. |
| `location` | string | At most 120. Where the role is based. |
| `workArrangement` | string | Empty, `ON_SITE`, `HYBRID` or `REMOTE`. |
| `responsibilities` | line list | At most 20 items of at most 300 characters. The key responsibilities. |
| `niceToHave` | line list | Same limits. Anything else that is a bonus and not a skill. |
| `constraints` | line list | Same limits. Other explicit conditions of the job. |
| `weights` | object or null | The job's own weights for the rule-based score: `{ skills, experience, preferredSkills, tools, domain, location, completeness }`, each a whole number from 0 to 100, not all 0. They do not have to add up to 100: the score is worked out from their proportions. `null` means the profile default weights (section 9.1). |
| `source` | string | Set by the server. `MANUAL`: typed by a recruiter. `AI_REVIEWED`: filled from an AI draft, then read and saved by a recruiter. |
| `model` | string or null | Set by the server. The model name of the draft when `source` is `AI_REVIEWED`, otherwise `null`. |
| `savedAt` | date | Set by the server. When the profile was last saved. |
| `savedByName` | string | Set by the server. The name of the user who saved it. That user's id is kept on the server and is not returned. |

How each field is used by the rule-based ATS, and which fields are listed without being scored, is in section 9.1. The limits are `REQUIREMENT_PROFILE_LIMITS` in `src/config/constants.js`.

**PUT /api/admin/jobs/:id/requirement-profile** saves the profile. Permission `jobs:write`. The body holds the first seventeen fields of the table, all optional, and two more:

| Field | Type | Rules |
| --- | --- | --- |
| `fromAiDraft` | boolean | Optional. Default `false`. `true` says the form was filled from an AI draft before the recruiter saved it: the profile is then stored with `source: "AI_REVIEWED"`. It changes nothing else. |
| `aiModel` | string | Optional. At most 100. The `model` the draft endpoint returned. It is stored only when `fromAiDraft` is `true`. |

- The save replaces the whole profile. A field that is left out is saved empty (an empty list, an empty text, `null` for a number and for `weights`).
- The lists follow the list rules of section 1.6: an array of strings, or one string that is split (string lists on commas and line breaks, line lists on line breaks).
- In `weights`, a key that is not one of the seven is a validation error, a key that is left out counts as 0, and weights that are all 0 are refused ("Give at least one part a weight above 0.").
- `source`, `model`, `savedAt` and `savedByName` cannot be sent: they are dropped like any other unknown field.
- Errors: 400 `BAD_REQUEST` for an id that is not valid, 400 `VALIDATION_ERROR` for the body, 404 `NOT_FOUND` when the job does not exist.
- Audit action: `job.requirements_saved` (section 10.2).

Returns 200 with the saved profile and how the job is scored now:

```json
{
  "success": true,
  "data": {
    "requirementProfile": {
      "requiredSkills": ["SystemVerilog", "UVM"],
      "preferredSkills": ["Python"],
      "tools": ["VCS"],
      "domains": ["Semiconductor"],
      "requiredExperience": "",
      "minYears": 5,
      "preferredExperience": "",
      "preferredYears": null,
      "education": [],
      "certifications": [],
      "seniority": "",
      "location": "",
      "workArrangement": "",
      "responsibilities": [],
      "niceToHave": [],
      "constraints": [],
      "weights": null,
      "source": "MANUAL",
      "model": null,
      "savedAt": "2026-10-06T10:00:00.000Z",
      "savedByName": "Sample Recruiter"
    },
    "scoring": {
      "weights": { "skills": 40, "experience": 20, "preferredSkills": 10, "tools": 10, "domain": 10, "location": 5, "completeness": 5 },
      "source": "PROFILE",
      "baseline": { "skills": 45, "experience": 20, "preferredSkills": 10, "domain": 10, "location": 10, "completeness": 5 },
      "profileDefaults": { "skills": 40, "experience": 20, "preferredSkills": 10, "tools": 10, "domain": 10, "location": 5, "completeness": 5 }
    }
  }
}
```

`scoring.weights` are the weights the rules use for this job now, and `scoring.source` says where they come from: `BASELINE` (the job has no profile), `PROFILE` (a profile without weights of its own, so the profile default weights) or `JOB` (the weights saved in the profile). `baseline` and `profileDefaults` are the two fixed sets, for the editor to show.

**DELETE /api/admin/jobs/:id/requirement-profile** removes the profile. Permission `jobs:write`. Returns 200 with `{ "requirementProfile": null, "scoring": { ... } }`, where `scoring.source` is `BASELINE`. A job that has no profile gets the same answer, and then nothing is written and no audit entry is made. Errors: 400 `BAD_REQUEST` for an id that is not valid, 404 `NOT_FOUND` when the job does not exist. Audit action: `job.requirements_removed`.

**POST /api/admin/jobs/:id/requirement-profile/ai-draft** is "Draft with AI". It asks OpenAI to turn the job's own text into a draft requirement profile and returns the draft. **It stores nothing.** The job keeps the profile it had, or none, until a recruiter saves one with the `PUT` above. It needs `jobs:write` and `ats:run` together, takes no request body, and runs only when a signed-in user calls it. Section 9.7 describes what is sent to OpenAI.

The checks run in this order, and the first one that fails gives the answer:

1. The checks every admin route has: the general API rate limit, the `X-Requested-With` header and the origin (403), a valid session (401), and a password that is no longer temporary (403 `PASSWORD_CHANGE_REQUIRED`).
2. The AI rate limit: 20 requests per 10 minutes per signed-in user, shared by the three AI routes (429 `RATE_LIMITED`, section 2.5).
3. The `jobs:write` and `ats:run` permissions (403 `FORBIDDEN`).
4. The id in the URL is a valid id (400 `BAD_REQUEST`).
5. `OPENAI_API_KEY` and `OPENAI_MODEL` are both set (503 `AI_NOT_CONFIGURED`).
6. No draft is already running for this job in this server process (409 `AI_IN_PROGRESS`).
7. The job exists (404 `NOT_FOUND`).
8. The job has a description, a summary or at least one responsibility to draft from (400 `BAD_REQUEST`).
9. One request goes to OpenAI. There is no retry. A quota or billing refusal answers 503 `AI_QUOTA_EXCEEDED`, any other failure 502 `AI_FAILED`, and an answer that does not pass validation 502 `AI_INVALID_RESPONSE`.
10. The audit entry `job.requirements_ai_drafted` is written (section 10.2).

Returns 200:

```json
{
  "success": true,
  "data": {
    "draft": {
      "requiredSkills": ["SystemVerilog", "UVM"],
      "preferredSkills": ["Python"],
      "tools": [],
      "domains": ["Semiconductor"],
      "requiredExperience": "Block-level verification experience.",
      "minYears": 5,
      "preferredExperience": "",
      "preferredYears": null,
      "education": [],
      "certifications": [],
      "seniority": "",
      "location": "Bangalore",
      "workArrangement": "",
      "responsibilities": ["Own the verification plan"],
      "niceToHave": [],
      "constraints": [],
      "weights": { "skills": 45, "experience": 20, "preferredSkills": 10, "tools": 0, "domain": 10, "location": 10, "completeness": 5 },
      "uncertainties": ["The description does not say whether the role is on site."]
    },
    "model": "<the-model-name-openai-reported>",
    "saved": false
  }
}
```

The text of the example is made up to show the shape. It is not the output of a real model.

- `draft` holds the sixteen requirement fields of the profile, with the same limits, and two more. `weights` are the weights the model suggests, each a whole number from 0 to 100, or `null` when the suggested weights add up to 0. `uncertainties` (at most 20 items of at most 300 characters) lists what the description leaves vague, contradictory or unsaid, for the recruiter to settle before saving. `uncertainties` is not part of a stored profile.
- `minYears` and `preferredYears` are whole numbers from 0 to 50, or `null` when the job's text states no number. `workArrangement` is empty when the text does not state one.
- `saved` is always `false`.
- To keep a draft, the recruiter reads it, corrects it and sends it with the `PUT` above, with `fromAiDraft: true` and the returned `model` as `aiModel`.
- The request stays open until OpenAI answers or 60 seconds have passed.

### 7.3 Candidates

| Method and path | Permission |
| --- | --- |
| `GET /api/admin/candidates` | `candidates:read` |
| `GET /api/admin/candidates/:id` | `candidates:read` |
| `PATCH /api/admin/candidates/:id` | `candidates:write` |
| `POST /api/admin/candidates/:id/notes` | `candidates:write` |
| `GET /api/admin/candidates/:id/resume-url` | `candidates:read` and `resumes:read` |
| `DELETE /api/admin/candidates/:id` | `candidates:delete` |

There is no create endpoint. A candidate is created by a public application or by converting a referral.

List: search fields `name`, `email`, `headline`, `location`, `skills`, `domain`. Filters `label` (`INTERVIEWED`, `REJECTED`, `SELECTED`: candidates that carry that label), `source` (`WEBSITE`, `REFERRAL`, `LINKEDIN`, `RECRUITER`), `domain`, `location`. There is no `status` filter: a candidate has no status. Sortable `createdAt`, `updatedAt`. Default order `-createdAt`.

Candidate object:

```json
{
  "id": "665f1c2e9b3a4d0012ab34cd",
  "name": "Test Candidate",
  "email": "candidate.one@example.com",
  "phone": "+91 90000 40001",
  "location": "Bengaluru, India",
  "headline": "Design Verification Engineer",
  "domain": "Semiconductor & Chip Engineering",
  "experienceYears": 6,
  "skills": ["SystemVerilog", "UVM", "Functional Coverage"],
  "summary": "",
  "noticePeriod": "30 days",
  "expectedCompensation": "",
  "profileUrl": "",
  "preferredLocation": "",
  "education": [],
  "experience": [],
  "resume": { "fileName": "resume.pdf", "mimeType": "application/pdf", "size": 425, "uploadedAt": "2026-10-04T10:00:00.000Z" },
  "labels": [],
  "source": "WEBSITE",
  "notes": [],
  "consentAt": "2026-10-04T10:00:00.000Z",
  "createdAt": "2026-10-04T10:00:00.000Z",
  "updatedAt": "2026-10-04T10:00:00.000Z"
}
```

`resume` is `null` when no file is stored. The storage key is never part of the object.

A candidate has no status. The workflow status lives on each application (section 7.4). `labels` holds zero or more of `INTERVIEWED`, `REJECTED` and `SELECTED`. A label is a tag staff put on a record to find it again. It is not a stage: adding or removing one changes no status, sends no email and runs no evaluation.

**GET /api/admin/candidates/:id** returns the candidate with related data:

```json
{
  "success": true,
  "data": {
    "candidate": { },
    "applications": [ ],
    "atsResults": [ ],
    "history": [ ]
  }
}
```

`applications` holds the candidate's applications, newest `submittedAt` first, each with its `submittedProfile` (section 7.4). `atsResults` is newest `runAt` first, each with its `aiComparison` (section 7.8).

`history` is the newest 50 audit entries for this candidate, each reduced to five fields:

```json
{ "id": "665f1c2e9b3a4d0012ab34d1", "at": "2026-10-04T10:00:00.000Z", "action": "candidate.application_shortlisted", "summary": "Shortlisted for Design Verification Engineer", "actorName": "Sample Recruiter" }
```

The full entries, with `metadata`, `actorId` and `actorRole`, are read through the audit log, which needs `audit:read` (section 7.13).

**PATCH /api/admin/candidates/:id**. All fields optional:

| Field | Type | Rules |
| --- | --- | --- |
| `name` | string | 1 to 120. |
| `phone` | string | Phone rule. |
| `location` | string | At most 120. |
| `headline` | string | At most 160. |
| `domain` | string | At most 120. |
| `experienceYears` | number or null | 0 to 60. |
| `skills` | string list | At most 60 items of at most 80 characters. |
| `summary` | string | Multi-line. At most 4000. |
| `noticePeriod` | string | At most 80. |
| `expectedCompensation` | string | At most 120. |
| `profileUrl` | string | Link rule. |
| `preferredLocation` | string | At most 120. |
| `source` | string | One of the sources. |
| `labels` | array of strings | The full set of labels the candidate should carry after the edit: any of `INTERVIEWED`, `REJECTED`, `SELECTED`, or `[]` for none. See "Labels" in section 7.4. |

The email cannot be changed. There is no `status` field: one sent in the body is dropped like any other unknown field. Returns the candidate. A label change is audited as `candidate.labels_changed` with the labels added and removed. This endpoint (and referral conversion, section 7.6) is the only way a candidate profile changes after it is created. The public application form never changes it.

**POST /api/admin/candidates/:id/notes**. Body `{ "text": "..." }`, required, multi-line, at most 4000. Appends a note with the author's name and the time, and returns the candidate.

```json
{ "notes": [ { "text": "Call booked for Tuesday.", "authorId": "...", "authorName": "Sample Recruiter", "at": "2026-10-04T10:00:00.000Z" } ] }
```

**GET /api/admin/candidates/:id/resume-url**. Returns a short-lived link to the resume (section 8.4).

```json
{ "success": true, "data": { "url": "https://...", "expiresIn": 120, "fileName": "resume.pdf", "mimeType": "application/pdf" } }
```

404 when the candidate has no stored resume.

**DELETE /api/admin/candidates/:id** is a cascade delete. It removes:

- the candidate profile,
- every application of the candidate,
- every ATS result of the candidate,
- every stored resume file of that person: the resume on the profile, the ones attached to applications, and the ones on referrals that were converted into this candidate.

Referrals that were converted into this candidate keep their own record but lose the link to the candidate and their resume reference. Their stored file is removed with the rest, whether it was shared with the candidate or was the referral's own copy, because it is that person's document too. A storage delete that fails is logged and does not stop the delete. Returns `{ "id": "...", "deleted": true }`.

### 7.4 Applications

| Method and path | Permission |
| --- | --- |
| `GET /api/admin/applications` | `applications:read` |
| `GET /api/admin/applications/:id` | `applications:read` |
| `PATCH /api/admin/applications/:id` | `applications:write` |
| `GET /api/admin/applications/:id/resume-url` | `applications:read` and `resumes:read` |
| `POST /api/admin/applications/:id/shortlist` | `applications:shortlist` |
| `POST /api/admin/applications/:id/shortlist-email` | `applications:shortlist` |

There are no create or delete endpoints. Applications are created by the public form (one new application per submission) and removed with their candidate.

**Status and labels.** An application has two statuses: `NEW` and `SHORTLISTED`. It arrives as `NEW`. The only thing that changes the status is the shortlist action below, called by a signed-in user whose role holds `applications:shortlist`. The status is not an editable field, the public form cannot set it, and neither the rule-based ATS nor its review changes it. The AI comparison (section 7.8) is advice and does not change it either. Nothing shortlists automatically. `INTERVIEWED`, `REJECTED` and `SELECTED` are labels: tags, not stages.

List: no text search. Filters `status` (`NEW`, `SHORTLISTED`), `label` (`INTERVIEWED`, `REJECTED`, `SELECTED`: applications that carry that label), `source`, `jobId`, `candidateId`. Sortable `submittedAt`, `updatedAt`. Default order `-submittedAt`.

```json
{
  "id": "665f1c2e9b3a4d0012ab34ce",
  "candidateId": "665f1c2e9b3a4d0012ab34cd",
  "jobId": "665f1c2e9b3a4d0012ab34aa",
  "status": "NEW",
  "labels": [],
  "shortlist": null,
  "source": "WEBSITE",
  "message": "",
  "submittedProfile": {
    "name": "Test Candidate",
    "phone": "+91 90000 40001",
    "location": "Bengaluru, India",
    "preferredLocation": "",
    "headline": "Design Verification Engineer",
    "domain": "Semiconductor & Chip Engineering",
    "experienceYears": 6,
    "skills": ["SystemVerilog", "UVM", "Functional Coverage"],
    "noticePeriod": "30 days",
    "expectedCompensation": "",
    "profileUrl": ""
  },
  "recruiterNotes": "",
  "resume": { "fileName": "resume.pdf", "mimeType": "application/pdf", "size": 425, "uploadedAt": "2026-10-04T10:00:00.000Z" },
  "submittedAt": "2026-10-04T10:00:00.000Z",
  "createdAt": "2026-10-04T10:00:00.000Z",
  "updatedAt": "2026-10-04T10:00:00.000Z"
}
```

`jobId` is `null` for a general application.

`shortlist` is `null` until the application is shortlisted. After that it records who shortlisted it, when, and what happened to the candidate's email:

```json
{
  "status": "SHORTLISTED",
  "shortlist": {
    "at": "2026-10-04T11:00:00.000Z",
    "byId": "665f1c2e9b3a4d0012ab34c0",
    "byName": "Sample Recruiter",
    "email": { "status": "SENT", "at": "2026-10-04T11:00:01.000Z", "attempts": 1 }
  }
}
```

`shortlist.email.at` is the time of the last attempt and `attempts` counts the attempts. On a record that was shortlisted before this workflow existed (a migrated record), `at` and `byId` are `null` and `byName` is empty. On the sample applications that the development seed adds only when it is run with `--with-demo-recruitment-data`, `byId` is `null` and `byName` is `Seed`.

`shortlist.email.status` is one of (`SHORTLIST_EMAIL_STATES` in `src/config/constants.js`):

| State | Meaning |
| --- | --- |
| `NOT_SENT` | Nothing has been attempted. |
| `SENDING` | An attempt is in progress. |
| `SENT` | The email service accepted the message. |
| `LOGGED` | `EMAIL_DRIVER=log`: the message was written to the server log, not sent. |
| `NOT_CONFIGURED` | The email service has no credentials yet. Nothing was sent. |
| `FAILED` | The email service refused the message or could not be reached. |

`submittedProfile` is what the applicant typed into the form for this application. It is kept with the application and is never copied over an existing candidate profile, so it can differ from the candidate record with the same `candidateId`. It is `null` on an application that did not come from the public form (the development seed's samples, for example). It is read-only: `PATCH` does not accept it.

**PATCH** body, all optional:

| Field | Type | Rules |
| --- | --- | --- |
| `source` | string | `WEBSITE`, `REFERRAL`, `LINKEDIN` or `RECRUITER`. |
| `recruiterNotes` | string | Multi-line. At most 8000. |
| `labels` | array of strings | The full set of labels the application should carry after the edit: any of `INTERVIEWED`, `REJECTED`, `SELECTED`, or `[]` for none. |

These three fields are the whole body. `status` is not accepted: one sent in the body is dropped like any other unknown field, the response is still 200 and the stored status does not change. Returns the application.

**Labels.** The same rules apply to `labels` on a candidate (section 7.3) and on an application. The two lists are separate: labelling an application does not label its candidate, and the reverse.

- `PATCH` sends the full set, not a change. To remove a label, send the list without it. Leaving `labels` out of the body leaves the stored labels as they are.
- The set is stored once each and in a fixed order (`INTERVIEWED`, `REJECTED`, `SELECTED`), whatever order or repeats the request has. `["REJECTED", "INTERVIEWED", "REJECTED"]` is stored as `["INTERVIEWED", "REJECTED"]`.
- A value that is not one of the three labels, a value that is not an array, or an array of more than 6 items returns 400 `VALIDATION_ERROR`.
- Labels are tags only. A label change changes no status, sends no email and runs no evaluation. `SELECTED` or `REJECTED` on a record is a note for staff, not a decision the system acts on, and the candidate is not told.
- A label change is audited as `candidate.labels_changed` or `application.labels_changed` with metadata `{ added, removed }`.

**POST /api/admin/applications/:id/shortlist** (no body). Permission `applications:shortlist`. The one workflow action.

- The status is set to `SHORTLISTED` with a single conditional update, so an application is shortlisted once. A second call, and every call but one of several that arrive at the same moment, answers 409 `CONFLICT` ("This application is already shortlisted."). Only a `NEW` application can be shortlisted: one that still has a status from the earlier workflow (before `npm run migrate:recruitment` has run) also answers 409 `CONFLICT`, with a message that names the migration, and nobody is emailed. Shortlisting cannot be undone through the API.
- `shortlist` is stored with `at`, `byId` and `byName` of the signed-in user, and the email as `NOT_SENT` with 0 attempts.
- Two audit entries are written: `application.shortlisted` on the application (metadata `from`, `to`, `candidateId`, `jobId`) and `candidate.application_shortlisted` on the candidate, so it shows in the candidate's `history`.
- The shortlist email is then sent to the candidate's email address, inside the same request, and the attempt is audited as `application.shortlist_email` (metadata `state`, `candidateId`). The email is the `shortlistNotification` template (`src/services/email/templates.js`): fixed wording whose only variable is the job title, which staff write. Nothing the candidate typed is repeated and no timeline or outcome is promised. It is not subject to the cap of 3 confirmation emails per address (section 6).
- A problem with the email never undoes the shortlist. The response reports what happened, and the email can be sent later with the endpoint below.
- Labels are not touched.
- 404 `NOT_FOUND` for an unknown application. 400 `BAD_REQUEST` for an id that is not valid.

Returns 200:

```json
{
  "success": true,
  "data": {
    "application": {
      "id": "665f1c2e9b3a4d0012ab34ce",
      "status": "SHORTLISTED",
      "labels": [],
      "shortlist": {
        "at": "2026-10-04T11:00:00.000Z",
        "byId": "665f1c2e9b3a4d0012ab34c0",
        "byName": "Sample Recruiter",
        "email": { "status": "SENT", "at": "2026-10-04T11:00:01.000Z", "attempts": 1 }
      }
    },
    "email": "SENT"
  }
}
```

`application` is the full application object as it now is. `email` is the state the attempt ended in: `SENT`, `LOGGED`, `NOT_CONFIGURED` or `FAILED`. It is the same value as `application.shortlist.email.status`.

**POST /api/admin/applications/:id/shortlist-email** (no body). Permission `applications:shortlist`. Sends the shortlist email for an application that is already `SHORTLISTED` and has not had one accepted yet: after the email service was set up, after a failure, or for an application whose email is still `NOT_SENT` (a record shortlisted before this workflow existed and since migrated, or one of the development seed's samples). It does not change the status.

- An attempt is allowed when `shortlist.email.status` is `NOT_SENT`, `LOGGED`, `NOT_CONFIGURED` or `FAILED`, or `SENDING` with a last attempt more than two minutes old (an attempt that was abandoned mid-send). Each attempt first claims the email with a conditional update, sets it to `SENDING` and adds 1 to `attempts`.
- **At most one accepted email per application.** Once the status is `SENT`, no further attempt is allowed.
- 409 `CONFLICT` when the application is not shortlisted ("Shortlist the application first."), when the email was already sent, or while another attempt is in progress.
- A shortlisted record that has no `shortlist` details gets them first, with `at: null`, `byId: null` and an empty `byName`.
- The attempt is audited as `application.shortlist_email` (metadata `state`, `candidateId`).
- 404 `NOT_FOUND` for an unknown application. 400 `BAD_REQUEST` for an id that is not valid.

Returns 200 with the same shape as the shortlist action: `{ application, email }`.

The resume attached to an application is the one sent with it, and each application keeps its own. A later public submission never replaces the resume on the candidate profile or on an earlier application, so the resume sent with a later application is opened through that application's `resume-url`.

### 7.5 Requirements

| Method and path | Permission |
| --- | --- |
| `GET /api/admin/requirements` | `requirements:read` |
| `GET /api/admin/requirements/:id` | `requirements:read` |
| `POST /api/admin/requirements` | `requirements:write` |
| `PATCH /api/admin/requirements/:id` | `requirements:write` |
| `GET /api/admin/requirements/:id/attachment-url` | `requirements:read` |
| `DELETE /api/admin/requirements/:id` | `requirements:delete` |

List: search fields `role`, `company`, `contactName`, `email`, `location`, `domain`, `skills`. Filters `status` (`NEW`, `REVIEWING`, `CONTACTED`, `IN_PROGRESS`, `CLOSED`), `priority` (`HIGH`, `MEDIUM`, `LOW`), `hiringType`, `domain`. Sortable `createdAt`, `updatedAt`. Default order `-createdAt`.

Body for create (JSON). `PATCH` takes the same fields, all optional.

| Field | Type | Rules |
| --- | --- | --- |
| `contactName` | string | At most 120. |
| `company` | string | At most 160. |
| `email` | string | Empty or a valid email. |
| `phone` | string | Phone rule. |
| `hiringType` | string | Empty, or one of the four hiring types. |
| `domain` | string | At most 120. |
| `role` | string | Required. At most 300. |
| `positions` | whole number | 1 to 999. Default 1. |
| `location` | string | At most 160. |
| `workMode` | string | Empty, `ON_SITE`, `HYBRID` or `REMOTE`. |
| `description` | string | Multi-line. At most 6000. |
| `skills` | string list | At most 40 items of at most 80 characters. |
| `experience` | string | At most 120. |
| `priority` | string | `HIGH`, `MEDIUM` or `LOW`. Default `MEDIUM`. |
| `status` | string | One of the requirement statuses. Default `NEW`. |
| `internalNotes` | string | Multi-line. At most 8000. |

The response object has these fields plus `id`, `attachment` (file description or `null`), `source` (`WEBSITE` or `ADMIN`), `consentAt`, `createdAt`, `updatedAt`.

Notable behaviour:

- A requirement created here gets `source: "ADMIN"`. One sent through the public form has `source: "WEBSITE"`.
- An attachment can only arrive through the public form. The admin create endpoint takes JSON and stores no file.
- `attachment-url` returns a signed link in the same shape as `resume-url`. 404 when there is no attachment.
- Delete also removes the stored attachment.

### 7.6 Referrals

| Method and path | Permission |
| --- | --- |
| `GET /api/admin/referrals` | `referrals:read` |
| `GET /api/admin/referrals/:id` | `referrals:read` |
| `PATCH /api/admin/referrals/:id` | `referrals:write` |
| `POST /api/admin/referrals/:id/notes` | `referrals:write` |
| `POST /api/admin/referrals/:id/convert` | `referrals:write` and `candidates:write` |
| `GET /api/admin/referrals/:id/resume-url` | `referrals:read` and `resumes:read` |
| `DELETE /api/admin/referrals/:id` | `referrals:delete` |

There is no create endpoint. Referrals arrive through the public form.

List: search fields `candidateName`, `candidateEmail`, `referrerName`, `referrerEmail`, `candidateRole`, `domain`. Filters `status` (`NEW`, `REVIEWING`, `CONTACTED`, `SHORTLISTED`, `REJECTED`, `CONVERTED`), `domain`. Sortable `createdAt`, `updatedAt`. Default order `-createdAt`.

The object has the public form fields plus `id`, `resume` (file description or `null`), `status`, `notes`, `candidateId` (`null` until converted), `consentAt`, `createdAt`, `updatedAt`.

**PATCH** body, all optional:

| Field | Type | Rules |
| --- | --- | --- |
| `status` | string | One of the referral statuses. |
| `candidateName` | string | 1 to 120. |
| `candidateEmail` | string | Empty or a valid email. |
| `candidatePhone` | string | Phone rule. |
| `candidateRole` | string | At most 160. |
| `candidateProfileUrl` | string | Link rule. |
| `domain` | string | At most 120. |

Staff can correct what the referrer entered about the referred person. In particular a missing `candidateEmail` can be added here before the referral is converted. Only the fields that are sent change. An edit of these fields is audited as `referral.updated` with the names of the changed fields.

Setting `status` to `CONVERTED` through `PATCH` returns 400 `BAD_REQUEST`. Use the convert action.

A converted referral is closed: any `PATCH` on it returns 409 `CONFLICT`. The candidate record it became is edited from then on. Notes can still be added.

**POST .../notes** works as for candidates.

**POST /api/admin/referrals/:id/convert** (no body) turns the referral into a candidate:

- 409 `CONFLICT` if the referral was already converted.
- 400 `BAD_REQUEST` if the referral has no candidate email. The email is the candidate key. Add it with `PATCH` first.
- The candidate is found or created by email (`linkCandidate` in `src/services/candidateService.js`, which only signed-in staff actions use). A new candidate gets the referral's candidate name, email, phone, role (as `headline`), domain and profile link, and `source: "REFERRAL"`.
- An existing candidate only has EMPTY fields filled, from the same referral values (`phone`, `headline`, `domain`, `profileUrl`). A field that already has a value is kept, and the name, skills, labels and source are not changed.
- Resume: a new candidate, or an existing candidate with no resume, takes the referral's resume, and both records then point at the same stored file. An existing candidate who already has a resume keeps it, and the referral keeps its own file.
- The referral gets `candidateId` and status `CONVERTED`.

Returns 201:

```json
{ "success": true, "data": { "referral": { "status": "CONVERTED", "candidateId": "..." }, "candidate": { "source": "REFERRAL", "email": "referred.person@example.com" } } }
```

`candidate` is the full candidate object. For a candidate that already existed, `source` is whatever it was before.

**DELETE** removes the referral. Its resume file is removed from storage only if no candidate, no application and no other referral points at the same stored key. A file that a candidate took over at conversion therefore stays until that candidate is deleted, and a file that only the referral holds is removed with it.

### 7.7 Enquiries

| Method and path | Permission |
| --- | --- |
| `GET /api/admin/enquiries` | `enquiries:read` |
| `GET /api/admin/enquiries/:id` | `enquiries:read` |
| `PATCH /api/admin/enquiries/:id` | `enquiries:write` |
| `GET /api/admin/enquiries/:id/attachment-url` | `enquiries:read` |
| `DELETE /api/admin/enquiries/:id` | `enquiries:delete` |

There is no create endpoint.

List: search fields `name`, `email`, `subject`, `company`, `message`. Filters `status` (`NEW`, `IN_PROGRESS`, `CLOSED`) and `type` (`HIRING`, `CAREER`, `PARTNERSHIP`, `GENERAL`, `OTHER`). Sortable `createdAt`, `updatedAt`. Default order `-createdAt`.

The object: `id`, `name`, `email`, `phone`, `company`, `type`, `subject`, `message`, `attachment` (file description or `null`), `status`, `internalNotes`, `createdAt`, `updatedAt`.

**PATCH** body, all optional: `status`, `type`, `internalNotes` (multi-line, at most 8000). Delete also removes the stored attachment.

### 7.8 ATS

| Method and path | Permission |
| --- | --- |
| `GET /api/admin/ats/engine` | `ats:read` |
| `GET /api/admin/ats-results` | `ats:read` |
| `GET /api/admin/ats-results/:id` | `ats:read` |
| `POST /api/admin/ats/run` | `ats:run` |
| `PATCH /api/admin/ats-results/:id/review` | `ats:review` |
| `POST /api/admin/ats-results/:id/ai-comparison` | `ats:run` |
| `POST /api/admin/jobs/:id/ats/re-run` | `ats:run` |
| `GET /api/admin/jobs/:id/candidate-comparison` | `ats:read` |
| `POST /api/admin/jobs/:id/candidate-comparison` | `ats:run` |
| `GET /api/admin/ai/usage` | `ats:run` |

Section 9 explains the engine, the three AI actions and the usage ledger. The requirement profile of a job is in section 7.2.

**GET /api/admin/ats/engine** describes the engine so the admin can label it truthfully, and says whether the AI comparison can be used on this server.

```json
{
  "success": true,
  "data": {
    "engine": "RULE_BASED",
    "label": "RULE-BASED ATS",
    "version": "2",
    "weights": { "skills": 45, "experience": 20, "preferredSkills": 10, "domain": 10, "location": 10, "completeness": 5 },
    "profileWeights": { "skills": 40, "experience": 20, "preferredSkills": 10, "tools": 10, "domain": 10, "location": 5, "completeness": 5 },
    "weightKeys": ["skills", "experience", "preferredSkills", "tools", "domain", "location", "completeness"],
    "ai": { "available": true, "keyConfigured": true, "model": "<your-openai-model>", "reason": "AI comparison is available. It is advisory and runs only when a recruiter asks for it." }
  }
}
```

`weights` is the baseline: the weights of every job without a requirement profile. `profileWeights` is what a job with a profile starts from until it has weights of its own, and `weightKeys` lists the parts a job can weight (section 9.1).

`ai` is the status of the AI actions (`aiStatus()` in `src/services/aiService.js`). `GET /api/admin/settings` returns the same object as `system.ai` (section 7.11).

| Field | Type | Meaning |
| --- | --- | --- |
| `available` | boolean | `true` only when `OPENAI_API_KEY` and `OPENAI_MODEL` are both set. The code has no default model. |
| `keyConfigured` | boolean | Whether `OPENAI_API_KEY` is set. The key, or any part of it, is never returned. |
| `model` | string or null | The value of `OPENAI_MODEL`, or `null` when it is not set. |
| `reason` | string | One sentence for the admin to show. |

`reason` is one of four sentences:

- "AI comparison is available. It is advisory and runs only when a recruiter asks for it."
- "AI comparison is not available: OPENAI_API_KEY and OPENAI_MODEL are not set on the server."
- "AI comparison is not available: OPENAI_API_KEY is not set on the server."
- "AI comparison is not available: OPENAI_MODEL is not set on the server."

The status is read from the server's configuration. Reading it does not contact OpenAI, so `available: true` means that the two values are set, not that OpenAI accepts them.

**GET /api/admin/ats-results**. Paginated, newest `runAt` first. Filters `candidateId`, `jobId`, `review` (`PENDING`, `ADVANCE`, `HOLD`, `REJECT`). No text search and no `sort` parameter. Every result, here and on `GET /api/admin/ats-results/:id`, carries `aiComparison`: `null` until an AI comparison has been run for it. Reading or listing results never runs one.

**POST /api/admin/ats/run**. Body is one of:

```json
{ "applicationId": "665f1c2e9b3a4d0012ab34ce" }
```

```json
{ "candidateId": "665f1c2e9b3a4d0012ab34cd", "jobId": "665f1c2e9b3a4d0012ab34aa" }
```

Returns 201 with the result. With `applicationId`, the candidate and job are taken from the application. A general application (no job) returns 400. An unknown application, candidate or job returns 404. There is one result per candidate and job (the unique index also includes `engine`, and every result in this release has `engine: "RULE_BASED"`). Running again updates that result (same `id`), replaces the scores and keeps the review and any stored AI comparison. A run never starts an AI comparison. A run with `applicationId` also sets the result's `applicationId` to that application. This endpoint is the only way an existing result is re-run: a later public application does not do it (section 9.5).

```json
{
  "success": true,
  "data": {
    "id": "665f1c2e9b3a4d0012ab34cf",
    "candidateId": "665f1c2e9b3a4d0012ab34cd",
    "jobId": "665f1c2e9b3a4d0012ab34aa",
    "applicationId": null,
    "engine": "RULE_BASED",
    "engineVersion": "2",
    "totalScore": 84,
    "skillScore": 75,
    "preferredSkillScore": 50,
    "toolScore": null,
    "experienceScore": 100,
    "domainScore": 100,
    "locationScore": 100,
    "completenessScore": 100,
    "weights": { "skills": 45, "experience": 20, "preferredSkills": 10, "domain": 10, "location": 10, "completeness": 5 },
    "weightSource": "BASELINE",
    "usedRequirementProfile": false,
    "band": "Good match",
    "requiredSkills": ["SystemVerilog", "UVM", "Functional Coverage", "Assertions"],
    "matchedSkills": ["SystemVerilog", "UVM", "Functional Coverage"],
    "missingSkills": ["Assertions"],
    "preferredMatched": ["Python"],
    "preferredMissing": ["Formal Verification"],
    "toolsMatched": [],
    "toolsMissing": [],
    "checks": [
      { "rule": "Required skills", "result": "review", "detail": "3 of 4 required skills found by name.", "score": 75, "weight": 45 }
    ],
    "review": { "state": "PENDING", "note": "", "reviewerName": "", "updatedAt": null },
    "runAt": "2026-10-04T10:00:00.000Z",
    "runByName": "Sample Recruiter",
    "aiComparison": null
  }
}
```

`weights` holds the weights this result was scored with (only the parts that applied). `weightSource` says where they came from: `BASELINE` (the job has no requirement profile), `PROFILE` (it has one, with the default weights of a profile) or `JOB` (the profile carries the job's own weights). `usedRequirementProfile` is `true` for the last two. `toolScore`, `toolsMatched` and `toolsMissing` are filled only for a job whose profile lists tools. A check that is listed and not scored has `score` and `weight` `null`. A check whose part has weight 0 for the job has `weight` 0.

**POST /api/admin/jobs/:id/ats/re-run** runs the rules again for every ATS result the job already has, for example after its requirement profile changed. No body. It is rule based only: no model is called, no result is created, and no application, candidate, label, review or stored AI comparison is changed. Returns `{ "evaluated": 3, "total": 3 }`. A result whose candidate no longer exists is left as it is and is not counted in `evaluated`. Audit entry `ats.job_reevaluated`.

**PATCH /api/admin/ats-results/:id/review** records a person's decision on the result.

| Field | Type | Rules |
| --- | --- | --- |
| `state` | string | Required. `PENDING`, `ADVANCE`, `HOLD` or `REJECT`. |
| `note` | string | Optional. Multi-line. At most 4000. |

Returns the result with `review` updated (`state`, `note`, `reviewerName`, `updatedAt`). The review states are a note on the result and nothing else. Neither running an evaluation nor reviewing one changes an application: not its status and not its labels. A review of `ADVANCE` does not shortlist and a review of `REJECT` does not label. Shortlisting is always the separate action of a signed-in user (section 7.4).

**POST /api/admin/ats-results/:id/ai-comparison** is "Compare with AI". It asks OpenAI for an advisory comparison of the candidate and the job of one existing ATS result, validates the answer and stores it in `aiComparison` on that result. It is one of the three routes that call a model (the others are the requirement profile draft of section 7.2 and the comparison of several candidates below), and it runs only when a signed-in user with `ats:run` calls it. `:id` is the id of the ATS result. There is no request body: the server reads the candidate, the job and the linked application itself. Section 9.6 describes what is sent to OpenAI and what is not.

The checks run in this order, and the first one that fails gives the answer:

1. The checks every admin route has: the general API rate limit, the `X-Requested-With` header and the origin (403), a valid session (401), and a password that is no longer temporary (403 `PASSWORD_CHANGE_REQUIRED`).
2. The AI comparison rate limit: 20 requests per 10 minutes per signed-in user (429 `RATE_LIMITED`, section 2.5).
3. The `ats:run` permission (403 `FORBIDDEN`).
4. The id in the URL is a valid id (400 `BAD_REQUEST`).
5. `OPENAI_API_KEY` and `OPENAI_MODEL` are both set (503 `AI_NOT_CONFIGURED`). This comes before anything is read from the database, so nothing is loaded or sent when AI is not set up.
6. No comparison is already running for this result (409 `AI_IN_PROGRESS`).
7. The result exists, and so do its candidate and its job (404 `NOT_FOUND`).
8. One request goes to OpenAI. A quota or billing refusal answers 503 `AI_QUOTA_EXCEEDED`, any other failure 502 `AI_FAILED`, and an answer that does not pass validation 502 `AI_INVALID_RESPONSE`. Whatever the outcome, the request is written to the usage ledger (section 9.9).
9. The validated answer is written to `aiComparison` on the result, and to no other field. If the result was deleted while the comparison ran (for example with its candidate), the answer is 404 and the result is not created again.
10. The audit entry `ats.ai_compared` is written (section 10.2).

Returns 200 with the whole ATS result, including the new `aiComparison`. The rule-based fields are returned as they were. The example leaves most of them out (they are in the example of `POST /api/admin/ats/run` above), and its text is the stand-in answer used in `tests/admin.test.js`, not the output of a real model.

```json
{
  "success": true,
  "data": {
    "id": "665f1c2e9b3a4d0012ab34cf",
    "candidateId": "665f1c2e9b3a4d0012ab34cd",
    "jobId": "665f1c2e9b3a4d0012ab34aa",
    "applicationId": "665f1c2e9b3a4d0012ab34ce",
    "engine": "RULE_BASED",
    "totalScore": 84,
    "band": "Good match",
    "review": { "state": "PENDING", "note": "", "reviewerName": "", "updatedAt": null },
    "runAt": "2026-10-04T10:00:00.000Z",
    "runByName": "System",
    "aiComparison": {
      "overallMatch": 72,
      "summary": "The stated skills cover most of what the role asks for.",
      "strongMatches": ["UVM testbench work is stated"],
      "partialMatches": ["Coverage closure is mentioned without detail"],
      "missingRequirements": ["Formal verification is not stated"],
      "domainRelevance": "The stated domain is semiconductor verification, which is the domain of the role.",
      "transferableSkills": ["Python scripting carries over to regression tooling"],
      "evidence": [{ "requirement": "UVM", "evidence": "Lists UVM among the skills and describes block-level testbench work." }],
      "uncertainties": ["Whether the coverage closure was owned or assisted is not stated: ask in the interview."],
      "usedRequirementProfile": false,
      "matchedSkills": ["UVM", "SystemVerilog"],
      "missingSkills": ["Formal Verification"],
      "relevantExperience": "Six years of block-level verification are stated.",
      "experienceGaps": ["Formal verification experience is not stated."],
      "qualificationAssessment": "The stated years of experience meet the level of the role. Education is not stated.",
      "strengths": ["Hands-on UVM experience"],
      "concerns": ["No formal verification is mentioned"],
      "recommendation": "Worth a conversation to check the formal verification gap. The recruiter decides.",
      "model": "<the-model-name-openai-reported>",
      "comparedAt": "2026-10-06T10:00:00.000Z",
      "comparedByName": "Sample Recruiter"
    }
  }
}
```

`aiComparison` is `null` until a comparison has been stored, and then holds seventeen fields from the model's answer and four the server adds:

| Field | Type | Limits and meaning |
| --- | --- | --- |
| `overallMatch` | whole number | 0 to 100. The model's estimate of how well the stated profile meets the stated requirements of the job. It is not the rule-based `totalScore` and does not change it. |
| `summary` | string | At most 1200 characters. How the candidate compares with the job. With `overallMatch` this is the overall fit. |
| `strongMatches` | string list | At most 10 items of at most 300 characters. Requirements the candidate data clearly meets. |
| `partialMatches` | string list | At most 10 items of at most 300 characters. Requirements met in part or only by a related skill, with what is missing. |
| `missingRequirements` | string list | At most 10 items of at most 300 characters. Requirements the candidate data does not state. |
| `domainRelevance` | string | At most 800 characters. How the stated domain and industry experience relate to the job's. |
| `transferableSkills` | string list | At most 10 items of at most 300 characters. Stated skills or experience that would carry over, with the requirement they relate to. |
| `evidence` | list of `{ requirement, evidence }` | At most 12 items. `requirement` at most 160 characters, `evidence` at most 300. What the candidate data states that supports the reading of a requirement. It comes from the typed profile and the cover note: the resume file is not read (section 9.6). |
| `uncertainties` | string list | At most 10 items of at most 300 characters. What the model could not judge from the data, with what the recruiter could ask or check. |
| `matchedSkills` | string list | At most 60 items of at most 80 characters. Skills the job asks for that the candidate data states. |
| `missingSkills` | string list | At most 60 items of at most 80 characters. Skills the job asks for that the candidate data does not state. |
| `relevantExperience` | string | At most 1200 characters. |
| `experienceGaps` | string list | At most 10 items of at most 300 characters. |
| `qualificationAssessment` | string | At most 800 characters. |
| `strengths` | string list | At most 10 items of at most 300 characters. |
| `concerns` | string list | At most 10 items of at most 300 characters. Points the recruiter may want to check. |
| `recommendation` | string | At most 800 characters. Advice on what to check or do next. It is not a decision. |
| `usedRequirementProfile` | boolean | Added by the server. Whether the job had a requirement profile when the comparison ran, and so whether the analysis was made against it. |
| `model` | string | Added by the server. At most 100 characters. The model name OpenAI reported in its answer, or the value of `OPENAI_MODEL` when the answer names none. |
| `comparedAt` | date | Added by the server. When the comparison was stored. |
| `comparedByName` | string | Added by the server. The name of the user who asked. That user's id is kept on the server and is not returned. |

The limits are `AI_COMPARISON_LIMITS` in `src/config/constants.js`. `matchedSkills` and `missingSkills` inside `aiComparison` are the model's lists. The fields of the same names at the top level of the result are the rule-based ones, and neither pair is derived from the other.

How the answer is validated before anything is stored:

- It must be a JSON object with exactly the seventeen keys of the first seventeen rows. A missing key, an extra key or a value of the wrong type makes the whole answer invalid.
- A comparison stored before the seven newer fields existed (`strongMatches`, `partialMatches`, `missingRequirements`, `domainRelevance`, `transferableSkills`, `evidence`, `uncertainties`) is returned with those lists empty and `domainRelevance` `""`.
- `overallMatch` must be a number from 0 to 100. A decimal is rounded. A number outside that range, a string or `null` makes the answer invalid.
- A text is cleaned like any other text (section 1.6: control characters, HTML tags and angle brackets removed, whitespace collapsed) and cut to its limit. A text that is empty after cleaning makes the answer invalid.
- A list is cleaned item by item: each item is cut to its length, empty items and repeats (compared without regard to case) are dropped, and the list keeps its first items up to the limit.
- A refusal, an answer cut off at the provider's length limit, a filtered answer and an answer of more than 100,000 characters are invalid.
- An invalid answer stores nothing and writes no `ats.ai_compared` entry. A comparison stored earlier stays as it was.

Behaviour:

- **Running it again replaces the stored comparison.** One comparison is kept per result, with who asked for it last and when.
- **Only `aiComparison` is written.** The scores, the checks, the skill lists and the `review` of the result are not changed, and neither is the application or the candidate: no status, no shortlist, no label and no email. A comparison that says "shortlist this candidate" is text in `recommendation` and nothing more.
- **`POST /api/admin/ats/run` keeps it.** Re-running the rule-based evaluation replaces the scores and leaves `aiComparison` as it is.
- The comparison is stored in the ATS result document, so it is removed with the result (when its candidate is deleted, or its job).
- The request stays open until OpenAI answers or 60 seconds have passed. There is no retry.
- The guard of step 6 and the rate limit of step 2 are kept in the memory of one server process (section 9.6).

Errors of this endpoint:

| Status | Code | When |
| --- | --- | --- |
| 400 | `BAD_REQUEST` | The id in the URL is not a valid id. |
| 401 | `UNAUTHENTICATED` | No valid session. |
| 403 | `FORBIDDEN` | The role does not hold `ats:run`, the `X-Requested-With` header is missing, or the `Origin` is not allowed. |
| 403 | `PASSWORD_CHANGE_REQUIRED` | The account is still on a temporary password. |
| 404 | `NOT_FOUND` | No ATS result has this id, its candidate or its job no longer exists, or the result was deleted while the comparison ran. |
| 409 | `AI_IN_PROGRESS` | A comparison for this result is already running in this server process. |
| 429 | `RATE_LIMITED` | More than 20 requests to this endpoint in 10 minutes by the same user. |
| 502 | `AI_FAILED` | OpenAI could not be reached, did not answer within 60 seconds or answered with an error status. The message says which kind it was in the API's own words: a general failure, credentials that OpenAI did not accept (its 401 or 403), a model name it does not know (its 404), a busy service or a usage limit (its 429), or an answer that took too long. OpenAI's own error text is never passed on. |
| 502 | `AI_INVALID_RESPONSE` | OpenAI answered, and the answer did not pass the validation above. |
| 503 | `AI_NOT_CONFIGURED` | `OPENAI_API_KEY` or `OPENAI_MODEL` is not set. |
| 503 | `AI_QUOTA_EXCEEDED` | OpenAI refused the request because the account has no credit left, has reached its spend limit or has no active billing. Nothing is retried and nothing is stored. |

#### Comparing several candidates of one job

**POST /api/admin/jobs/:id/candidate-comparison** is "Compare candidates with AI". A recruiter chooses two to five evaluated candidates of one job, and OpenAI is asked once for an advisory comparison of them with each other, against the same requirements. Permission `ats:run`, behind the same AI rate limit (20 requests per 10 minutes per signed-in user, shared by the three AI routes). `:id` is the id of the job.

| Field | Type | Rules |
| --- | --- | --- |
| `resultIds` | list of ids | Required. Two to five ids of ATS results of this job, each once, each for a different candidate. |

- Fewer than two ids, more than five or a repeated id answers 400 `VALIDATION_ERROR`. A result that is not an evaluation of this job answers 400 `BAD_REQUEST`. Neither sends anything to OpenAI.
- The candidates are sent under the labels "Candidate A", "Candidate B" and so on, in the order chosen, each reduced and scrubbed exactly as for the single comparison (section 9.6): no name, email address, phone number or link. The job is sent with its requirement profile when it has one.
- The answer must hold exactly one entry for every label that was sent. An answer that drops a candidate, repeats a label, names a candidate that was not sent or carries any other key is refused whole (502 `AI_INVALID_RESPONSE`) and the comparison stored before stays.
- The validated answer is stored on the job and replaces the one stored before. One comparison is kept per job. It holds ids, not names, and it is removed when one of its candidates is deleted.
- That one field is all that is written. No application, candidate, label, shortlist, review or ATS result is changed. The model is told not to say who should be chosen, and whatever it writes is text for the recruiter.
- A second request for the same job while one is running answers 409 `AI_IN_PROGRESS`. The errors are those of the single comparison.
- Audit entry `ats.ai_candidates_compared` (section 10.2).

Returns 200 with `{ "comparison": { ... } }`. **GET /api/admin/jobs/:id/candidate-comparison** (permission `ats:read`) returns the stored comparison in the same shape, or `{ "comparison": null }`. Reading it calls no model.

```json
{
  "success": true,
  "data": {
    "comparison": {
      "jobId": "665f1c2e9b3a4d0012ab34aa",
      "summary": "Candidate A states more of what the role asks for than Candidate B.",
      "candidates": [
        {
          "resultId": "665f1c2e9b3a4d0012ab34cf",
          "candidateId": "665f1c2e9b3a4d0012ab34cd",
          "applicationId": "665f1c2e9b3a4d0012ab34ce",
          "candidateName": "Sample Candidate",
          "label": "Candidate A",
          "overallFit": 80,
          "standing": "States the required verification skills and the years the role asks for.",
          "strengths": ["UVM"],
          "gaps": [],
          "transferableSkills": [],
          "uncertainties": []
        }
      ],
      "requirements": [{ "requirement": "UVM", "comparison": "Candidate A states it. Candidate B does not." }],
      "considerations": ["Check the formal verification experience of both."],
      "usedRequirementProfile": true,
      "model": "<the-model-name-openai-reported>",
      "comparedAt": "2026-10-06T10:00:00.000Z",
      "comparedByName": "Sample Recruiter"
    }
  }
}
```

`candidateName` is looked up when the comparison is read. `overallFit` is a whole number from 0 to 100 on the same scale for every candidate of the comparison. `summary` holds at most 1500 characters, `standing` 600, each list 8 items of 300 characters, and `requirements` 12 items (`CANDIDATE_COMPARISON_LIMITS` in `src/config/constants.js`). The example shows one of the candidates.

#### AI usage

**GET /api/admin/ai/usage** returns the figures of the AI usage panel on the dashboard. Permission `ats:run`: the roles that can start a paid AI request. It adds up the usage ledger of this backend (section 9.9). It never calls OpenAI and returns no credential.

```json
{
  "success": true,
  "data": {
    "estimated": true,
    "currency": "USD",
    "timeZone": "UTC",
    "generatedAt": "2026-10-06T10:00:00.000Z",
    "model": "gpt-5.4-mini",
    "service": { "state": "AVAILABLE", "message": "The last AI request worked.", "quotaExceeded": false },
    "today": { "requests": 3, "succeeded": 3, "failed": 0, "inputTokens": 6000, "outputTokens": 1200, "estimatedSpendUsd": 0.0099, "unpricedRequests": 0, "from": "2026-10-06T00:00:00.000Z" },
    "month": { "requests": 3, "succeeded": 3, "failed": 0, "inputTokens": 6000, "outputTokens": 1200, "estimatedSpendUsd": 0.0099, "unpricedRequests": 0, "from": "2026-10-01T00:00:00.000Z", "to": "2026-11-01T00:00:00.000Z" },
    "budget": { "monthlyUsd": 20, "percentUsed": 0, "remainingUsd": 19.9901, "level": "healthy", "levelLabel": "Healthy", "thresholds": { "notice": 50, "warning": 75, "critical": 90 } },
    "pricing": { "known": true, "source": "LIST", "inputPerMillionUsd": 0.75, "outputPerMillionUsd": 4.5 },
    "lastRequest": { "id": "665f1c2e9b3a4d0012ab34d0", "at": "2026-10-06T09:58:00.000Z", "operation": "CANDIDATE_COMPARISON", "model": "gpt-5.4-mini-2026-03-17", "success": true, "errorCategory": null, "inputTokens": 2000, "outputTokens": 400, "estimatedCostUsd": 0.0033, "jobId": "665f1c2e9b3a4d0012ab34aa", "candidateId": "665f1c2e9b3a4d0012ab34cd", "applicationId": "665f1c2e9b3a4d0012ab34ce", "atsResultId": "665f1c2e9b3a4d0012ab34cf", "candidateCount": null, "actorName": "Sample Recruiter" }
  }
}
```

| Field | Meaning |
| --- | --- |
| `estimated` | Always `true`. Every money figure here is an estimate kept by ALLSEMIS, not a figure from OpenAI. |
| `timeZone` | Always `UTC`. `today` and `month` are the UTC day and the UTC calendar month. |
| `model` | The value of `OPENAI_MODEL`, or `null`. |
| `service.state` | `NOT_CONFIGURED` (the key or the model is not set), `QUOTA_EXCEEDED` (the latest quota or billing refusal has not been followed by a request that worked), `ATTENTION` (the last request failed for another reason), `AVAILABLE` (the last request worked) or `NOT_USED_YET`. It describes the last request this server sent. It is not a live check. |
| `today`, `month` | Requests sent, how many worked and failed, the token counts OpenAI reported, the estimated spend, and `unpricedRequests`: requests that used tokens and could not be priced. |
| `budget.monthlyUsd` | `AI_MONTHLY_BUDGET_USD`, or `null` when it is not set. |
| `budget.percentUsed`, `budget.remainingUsd` | The estimated spend of the month against the budget. `null` without a budget. |
| `budget.level` | `healthy`, `notice`, `warning` or `critical`: at or above `thresholds.notice`, `.warning` and `.critical` percent of the budget (50, 75 and 90 unless changed). `null` without a budget. Always `critical` while `service.state` is `QUOTA_EXCEEDED`. |
| `budget.levelLabel` | `Healthy`, `Notice`, `Warning`, `Critical` or `No budget set`. |
| `pricing` | The price per million tokens used for the configured model, and where it comes from: `CONFIGURED` (the two price variables) or `LIST` (the list price the code knows). `known: false` when there is none, and then the spend cannot be estimated. |
| `lastRequest` | The newest ledger entry, or `null`. Ids, numbers and the name of the member of staff who asked. No content. |

### 7.9 Content

All five content resources share the same routes and permissions:

| Method and path | Permission |
| --- | --- |
| `GET /api/admin/<resource>` | `content:read` |
| `GET /api/admin/<resource>/:id` | `content:read` |
| `POST /api/admin/<resource>` | `content:write` |
| `PATCH /api/admin/<resource>/:id` | `content:write` |
| `DELETE /api/admin/<resource>/:id` | `content:delete` |

`<resource>` is `insights`, `stories`, `expertise`, `services` or `locations`. `PATCH` takes the create fields, all optional, and changes only what is sent. Create returns 201 with the record. Delete returns `{ "id": "...", "deleted": true }`.

Shared behaviour:

- **Publishing needs `content:publish`.** For insights, stories, expertise and services, `status` is `draft` (default) or `published`. Creating a record as `published`, or changing status to or from `published`, is refused with 403 unless the role holds `content:publish`. Locations have no publish step.
- **A published record can only be edited or deleted by a role that holds `content:publish`.** Any `PATCH` or `DELETE` on an insight, story, expertise or service record whose stored status is `published` is refused with 403 without that permission, whatever fields the request sends. (In the current table every role with `content:write` or `content:delete` also holds `content:publish`; the rule matters if the table is changed.)
- Only `published` records (and `active` locations) are returned by the public endpoints.
- Slugs are derived on the server when left empty and made unique, as for jobs.

**Image fields** (`image` on insights and expertise, `photo` on stories) take a media object:

| Field | Type | Rules |
| --- | --- | --- |
| `url` | string | At most 600. Empty, an `https://` link, a `/media/...` path, or a `http://localhost` or `http://127.0.0.1` link (local development). Anything else, including `javascript:` and `data:`, is refused. |
| `publicId` | string | At most 200. The id returned by the media upload. Empty for an external link. |
| `width`, `height` | integer or null | Positive. |
| `format` | string | At most 10. |
| `alt` | string | At most 300. |

Send the object returned by `POST /api/admin/media` unchanged. When a record's uploaded image is replaced, or the record is deleted, the old image is removed from media storage, but only if no other insight, story or expertise record still uses the same `publicId`. An image two records share stays until the last of them lets go of it. A `publicId` that is not one of this application's own uploads (section 7.10) is never deleted from storage, whatever record names it.

#### Insights (`/api/admin/insights`)

List: search fields `title`, `category`, `author`, `tags`, `excerpt`. Filters `status`, `category`. Sortable `date`, `createdAt`, `updatedAt`, `title`. Default order newest `date` first.

| Field | Type | Rules |
| --- | --- | --- |
| `title` | string | Required. At most 200. |
| `slug` | string | Optional. Slug rule. |
| `excerpt` | string | Multi-line. At most 600. |
| `category` | string | At most 60. |
| `tags` | string list | At most 40 items of at most 80 characters. |
| `topics` | string list | At most 12 items of at most 40 characters. |
| `image` | media object | See above. |
| `body` | array | At most 200 blocks. A block is `{ type, text?, items? }`. `type` is `p`, `h2`, `quote` or `list`. `text` is multi-line, at most 6000. `items` is at most 60 strings of at most 600. |
| `author` | string | At most 120. |
| `date` | string | `YYYY-MM-DD` or empty. |
| `readTime` | string | At most 40. |
| `featured` | boolean | Default `false`. The newest featured article leads the Insights page. |
| `showOnLanding` | boolean | Default `false`. Puts the article in the Insights section of the landing page (once it is published). |
| `landingOrder` | whole number | 0 to 999. Default 0. The position on the landing page, lowest first. |
| `status` | string | `draft` or `published`. |
| `seoTitle` | string | At most 200. |
| `seoDescription` | string | Multi-line. At most 400. |

```json
{
  "success": true,
  "data": {
    "id": "665f1c2e9b3a4d0012ab34d0",
    "title": "Notes on DFT hiring",
    "slug": "notes-on-dft-hiring",
    "excerpt": "A short primer.",
    "category": "Semiconductor",
    "tags": [], "topics": [],
    "image": { "url": "https://images.example.com/cover.jpg", "publicId": "", "width": null, "height": null, "format": "", "alt": "A cover" },
    "body": [ { "type": "p", "text": "Body text bold." }, { "type": "list", "text": "", "items": ["one", "two"] } ],
    "author": "", "date": "", "readTime": "", "featured": false,
    "showOnLanding": false, "landingOrder": 0,
    "status": "draft", "seoTitle": "", "seoDescription": ""
  }
}
```

`showOnLanding` in a response is always `true` or `false`. For a record that has no stored value it is worked out the same way as on the public endpoint, so the switch in the editor agrees with the landing page.

#### Stories (`/api/admin/stories`)

List: search fields `quote`, `name`, `role`. Filter `status`. Sortable `order`, `createdAt`, `updatedAt`. Default order `order` ascending.

| Field | Type | Rules |
| --- | --- | --- |
| `quote` | string | Required. Multi-line. At most 1200. |
| `name` | string | At most 120. |
| `role` | string | At most 160. |
| `photo` | media object | See above. |
| `order` | whole number | 0 to 999. Default 0. The position on the landing page, lowest first. |
| `showOnLanding` | boolean | Default `true`. Switch off to keep a published story off the landing page. |
| `status` | string | `draft` or `published`. |

#### Expertise (`/api/admin/expertise`)

List: search fields `name`, `slug`, `domains`. Filter `status`. Sortable `num`, `name`, `updatedAt`. Default order `num` ascending.

| Field | Type | Rules |
| --- | --- | --- |
| `key` | string | Optional. Slug rule (at most 100 characters). Derived from the name when empty, and made unique. Fixed once created: `PATCH` ignores it. |
| `num` | string | At most 4. For example `01`. |
| `name` | string | Required. At most 120. |
| `shortName` | string | At most 40. |
| `slug` | string | Optional. Slug rule. |
| `desc` | string | Multi-line. At most 400. |
| `image` | media object | See above. |
| `introduction` | string | Multi-line. At most 600. |
| `overview` | string | Multi-line. At most 4000. |
| `domains` | string list | At most 30 items of at most 80 characters. |
| `roles` | string list | At most 30 items of at most 80 characters. |
| `hiringChallenges` | line list | At most 12 items of at most 400 characters. |
| `processFlow` | string list | At most 10 items of at most 40 characters. |
| `representativeSearches` | array | At most 6 objects. Each is `{ ref, title, requirement, signals }`: `ref` at most 40, `title` at most 120, `requirement` at most 300, `signals` a string list of at most 12 items of at most 60 characters. |
| `relatedInsight` | string | An insight slug. |
| `status` | string | `draft` or `published`. |

`representativeSearches` is returned by the public endpoint and shown on the sector page. The validator accepts it, so it can be set through this API. The admin screens in `frontend/src/admin` do not send it in this release, so in practice it comes from the seed.

#### Services (`/api/admin/services`)

List: search fields `name`, `slug`, `description`. Filter `status`. Sortable `num`, `name`, `updatedAt`. Default order `num` ascending.

| Field | Type | Rules |
| --- | --- | --- |
| `num` | string | At most 4. |
| `name` | string | Required. At most 120. |
| `slug` | string | Optional. Slug rule. |
| `icon` | string | At most 40. Default `die`. |
| `description` | string | Multi-line. At most 800. |
| `headline` | string | At most 240. |
| `lead` | string | Multi-line. At most 800. |
| `fitTitle` | string | At most 200. |
| `fit` | line list | At most 12 items of at most 400 characters. |
| `processTitle` | string | At most 200. |
| `process` | line list | Same as `fit`. |
| `receiveTitle` | string | At most 200. |
| `receive` | line list | Same as `fit`. |
| `tagsTitle` | string | At most 200. The heading of the tags block on the service page. |
| `tags` | string list | At most 24 items of at most 60 characters. |
| `questions` | line list | At most 12 items of at most 800 characters. Each line is `Question | Answer`: the text before the first ` | ` is the question, the rest is the answer. |
| `ctaLabel` | string | At most 80. |
| `ctaTo` | string | Empty, or a path on this site starting with `/`. It may not start with `//` or `/\`, and may not contain a backslash, whitespace, quotes or angle brackets, so it cannot point at another site. At most 200. |
| `status` | string | `draft` or `published`. |

All of these are returned by the public endpoint and shown on the public service page, except `receiveTitle`: the validator accepts it and the public endpoint returns it, but the admin screens do not send it and the service page uses a fixed heading for that block.

#### Locations (`/api/admin/locations`)

List: search fields `city`, `country`, `type`. Filter `type` (`office`, `network`). Sortable `createdAt`, `updatedAt`. Default order oldest first.

| Field | Type | Rules |
| --- | --- | --- |
| `key` | string | Optional. Slug rule (at most 100 characters). Derived from the city when empty, and made unique. Fixed once created. |
| `city` | string | Required. At most 80. |
| `country` | string | At most 80. |
| `region` | string | At most 40. |
| `label` | string | At most 120. The map label text. |
| `type` | string | `office` or `network`. Default `network`. |
| `status` | string | `active`, `listed`, `planned` or `inactive`. Default `listed`. |
| `isHeadquarters` | boolean | Default `false`. |
| `address` | line list | At most 6 lines of at most 160 characters. |
| `phone` | string | Phone rule. |
| `email` | string | Empty or a valid email. |
| `hours` | line list | At most 6 lines of at most 120 characters. |
| `lat` | number | Required. -90 to 90. |
| `lon` | number | Required. -180 to 180. |
| `description` | string | Multi-line. At most 400. |
| `labelSide` | string | `left` or `right`. Default `right`. |
| `labelRaise` | number | 0 to 80. Default 0. The map label offset. |
| `active` | boolean | Default `true`. |

**A network location never keeps office details.** If the record's type is `network` (from the request, or already stored when the request does not send a type), the server sets `address` to `[]`, `phone` to `""`, `email` to `""`, `hours` to `[]` and `isHeadquarters` to `false` on every create and update, whatever the request contains. The public endpoint applies the same rule again when it builds its response.

```json
{ "success": true, "data": { "id": "...", "key": "pune", "city": "Pune", "country": "India", "type": "network", "status": "listed", "isHeadquarters": false, "address": [], "phone": "", "email": "", "hours": [], "lat": 18.52, "lon": 73.85, "labelSide": "right", "active": true } }
```

`label` and `labelRaise` (map label text and offset) are accepted by the validator, so they can be set through this API. The admin screens do not send them in this release, so in practice they come from the seed.

### 7.10 Media

| Method and path | Permission |
| --- | --- |
| `POST /api/admin/media` | `media:upload` |
| `DELETE /api/admin/media` | `media:upload` |

**POST /api/admin/media**. `multipart/form-data`. Rate limited (60 per 10 minutes).

| Field | Type | Rules |
| --- | --- | --- |
| `file` | file | Required. JPG, PNG or WebP, up to 5 MB. |
| `alt` | string | Optional. Cut to 300 characters. |

Returns 201 with the media object to store on a record:

```json
{ "success": true, "data": { "url": "https://res.cloudinary.com/<cloud>/image/upload/...", "publicId": "allsemis/abc123", "width": 640, "height": 360, "format": "png", "alt": "Engineer at a bench" } }
```

SVG is not accepted. A missing file returns 400 `BAD_REQUEST`.

**DELETE /api/admin/media**. JSON body `{ "publicId": "..." }` (1 to 200 characters). Removes an uploaded image that is no longer wanted, for example one replaced before saving. Only ids that belong to this application are accepted. Which kind an id is, is read from its shape: an id directly inside the configured Cloudinary folder (`<CLOUDINARY_FOLDER>/<name>`) is removed from Cloudinary, while Cloudinary is the image store in use; a `local-<uuid>` id of the development and test drivers is removed from the local folder, outside production only, whatever the image store in use is. An image uploaded locally before Cloudinary was connected can therefore still be removed. Anything else returns 400 `BAD_REQUEST`, including a `local-<uuid>` id in production. If a saved insight, story or expertise record still uses the image, the response is 409 `CONFLICT` ("That image is still used by a saved record.") and nothing is removed: such an image goes away by editing or deleting the record. Otherwise returns `{ "removed": true }`.

The same ownership check sits inside the one function that deletes from media storage (`removeImage` in `src/services/storage/publicMedia.js`, through `ownsImage`). It ignores any `publicId` that is not one of this application's own uploads, so a `publicId` typed into a record can never be used to delete someone else's image. An image with no `publicId` (one entered as a link, such as the seeded pictures) is never touched.

Upload errors: 503 `MEDIA_NOT_CONFIGURED` when Cloudinary is the image store in use and its variables are incomplete, 502 `MEDIA_UPLOAD_FAILED` when the upload did not succeed at Cloudinary. With the development driver the returned `url` is `<api-origin>/media/local-<uuid>.<ext>` and the `publicId` is `local-<uuid>`.

### 7.11 Settings

| Method and path | Permission |
| --- | --- |
| `GET /api/admin/settings` | `settings:read` |
| `PUT /api/admin/settings/contact` | `settings:write` |

**GET /api/admin/settings**

```json
{
  "success": true,
  "data": {
    "contact": { "email": "hello@example.com", "phone": "+91 90000 12345", "address": ["Line one", "Line two"], "hours": ["Mon-Fri"] },
    "updatedAt": "2026-10-04T10:00:00.000Z",
    "updatedByName": "Sample Content Manager",
    "system": {
      "fileStorage": "b2",
      "mediaStorage": "cloudinary",
      "email": "resend",
      "b2Configured": true,
      "cloudinaryConfigured": true,
      "resendConfigured": true,
      "ai": { "available": true, "keyConfigured": true, "model": "<your-openai-model>", "reason": "AI comparison is available. It is advisory and runs only when a recruiter asks for it." }
    }
  }
}
```

`system` reports which driver each service is using (`fileStorage`: `b2`, `local` or `memory`; `mediaStorage`: `cloudinary`, `local` or `memory`; `email`: `resend`, `log` or `memory`) and whether each provider's credentials are complete, as booleans (`b2Configured` for Backblaze B2; the field was `r2Configured` while Cloudflare R2 was the provider). The driver follows the credentials (section 8.6). `system.ai` is the status of the AI comparison, the same object as `ai` on `GET /api/admin/ats/engine` (section 7.8): two booleans, the model name from `OPENAI_MODEL` (or `null`) and one sentence. `system` never contains a key, a secret or a connection string. It is a part of what the server logs once at start-up as `server.listening` (`describeConfig` in `src/config/env.js`). That log line also holds `nodeEnv`, `port`, `frontendUrls`, `trustProxy` (the number of proxies the server trusts) and `sessionCookie` (`httpOnly`, `secure`, `sameSite` and `domain`: how the session cookie is sent, never its value), and `openaiConfigured`. These are in the log only and are not returned by this endpoint.

**PUT /api/admin/settings/contact** replaces the whole contact block. A field that is left out is saved empty.

| Field | Type | Rules |
| --- | --- | --- |
| `email` | string | Empty or a valid email. |
| `phone` | string | Phone rule. |
| `address` | line list | At most 6 lines of at most 160 characters. |
| `hours` | line list | At most 6 lines of at most 120 characters. |

Returns `{ contact, updatedAt, updatedByName }`. The saved contact block is what `GET /api/public/site` serves.

### 7.12 Users

| Method and path | Permission |
| --- | --- |
| `GET /api/admin/users` | `users:manage` |
| `POST /api/admin/users` | `users:manage` |
| `PATCH /api/admin/users/:id` | `users:manage` |
| `POST /api/admin/users/:id/reset-password` | `users:manage` |

There is no delete endpoint. Disable a user instead.

**GET** returns all users (at most 500), oldest first, as a plain array without `meta`.

```json
{ "success": true, "data": [ { "id": "...", "name": "Sample Admin", "email": "admin@example.com", "role": "SUPER_ADMIN", "active": true, "mustChangePassword": false, "lastLoginAt": null, "createdAt": "...", "updatedAt": "..." } ] }
```

The password hash, the failed sign-in counter and the lock time are never returned.

**POST** body:

| Field | Type | Rules |
| --- | --- | --- |
| `name` | string | Required. At most 120. |
| `email` | string | Required. Valid email. Must not be in use (409 `CONFLICT`). |
| `role` | string | Required. `SUPER_ADMIN`, `RECRUITER`, `HIRING_MANAGER` or `CONTENT_MANAGER`. |

There is no `password` field. One sent by the caller is dropped like any other unknown field. The server always generates a 20 character temporary password, always sets `mustChangePassword: true`, and returns the password once. Returns 201:

```json
{ "success": true, "data": { "user": { "id": "...", "email": "new.recruiter@example.com", "role": "RECRUITER", "mustChangePassword": true }, "temporaryPassword": "<shown once>" } }
```

It is not stored in readable form and cannot be retrieved later. The new user signs in with it and must choose their own password before any admin route answers (section 2.2).

**PATCH** body, all optional: `name` (1 to 120), `role`, `active` (boolean). There is no `password` field here either: a password cannot be set through this endpoint. Returns the user.

**POST /api/admin/users/:id/reset-password** (no body) replaces another user's password:

- The server generates a new temporary password, sets `mustChangePassword: true` and clears the failed sign-in counter and any pause.
- Every session of that user is deleted, so they are signed out everywhere.
- 400 `BAD_REQUEST` for your own account ("Use \"Change password\" to change your own password."). Your own password is changed with `POST /api/auth/change-password`, which asks for the current one.
- 404 `NOT_FOUND` for an unknown user. 400 `BAD_REQUEST` for an id that is not valid.

Returns 200, with the password shown once:

```json
{ "success": true, "data": { "user": { "id": "...", "email": "new.recruiter@example.com", "role": "RECRUITER", "mustChangePassword": true }, "temporaryPassword": "<shown once>" } }
```

Rules:

- You cannot change your own role or disable your own account (400).
- The last active super admin cannot be demoted or disabled (400).
- A role change, a disable or a password reset signs the user out everywhere.
- An administrator never chooses or sees a lasting password for another user: only the generated temporary one, once.

### 7.13 Audit logs

#### GET /api/admin/audit-logs

Permission `audit:read`. Read only: there is no endpoint that creates, edits or deletes an entry. Newest first. `limit` defaults to 50, maximum 200.

| Parameter | Meaning |
| --- | --- |
| `entityType` | Exact match, for example `candidate`, `job`, `user`. |
| `entityId` | Exact match on the record id. |
| `actorId` | The id of the user who acted. |
| `action` | Exact match, for example `candidate.document_accessed`. |
| `from`, `to` | Date or date-time bounds on the entry time. |

```json
{
  "success": true,
  "data": [
    {
      "id": "665f1c2e9b3a4d0012ab34d1",
      "actorId": "665f1c2e9b3a4d0012ab34c0",
      "actorName": "Sample Recruiter",
      "actorRole": "RECRUITER",
      "action": "application.shortlisted",
      "entityType": "application",
      "entityId": "665f1c2e9b3a4d0012ab34ce",
      "summary": "Shortlisted for Design Verification Engineer",
      "metadata": { "from": "NEW", "to": "SHORTLISTED", "candidateId": "665f1c2e9b3a4d0012ab34cd", "jobId": "665f1c2e9b3a4d0012ab34aa" },
      "at": "2026-10-04T10:00:00.000Z"
    }
  ],
  "meta": { "total": 120, "page": 1, "limit": 50 }
}
```

Section 10 lists the actions.

### 7.14 Files (development and test only)

#### GET /api/files/local/:token

Serves a private document that is held by a development store: the `local` driver (files under `backend/.data/private`) or, in the tests, the `memory` driver.

- **In production this route always answers 404.** Documents are in Backblaze B2 there, B2 serves its own presigned links, and the host's disk is never read.
- Outside production it answers whatever the document store in use is. With B2 connected on a development machine it still serves the documents that were stored on that machine's disk before, because those were not copied to B2 (section 8.5). A document that is held in B2 never gets a link to this route, and this route cannot read B2.
- No session is needed. The token is the credential. It is issued only by the permission-checked `resume-url` and `attachment-url` endpoints.
- The token is signed with HMAC-SHA256 using `SESSION_SECRET`. It carries the key, the file name and type, the store that holds the file and an expiry time (`SIGNED_URL_TTL_SECONDS`). An expired or altered token returns 404, and so does a token for a document that is no longer stored.
- PDFs are sent with `Content-Disposition: inline`, Word files as `attachment`. The response has `Cache-Control: private, no-store` and `X-Content-Type-Options: nosniff`.
- Rate limited with the download limiter.

---

## 8. Upload behaviour

### 8.1 Multipart field names

| Endpoint | File field | Required | Accepted types |
| --- | --- | --- | --- |
| `POST /api/requirements` | `attachment` | No | PDF, DOC, DOCX |
| `POST /api/applications` | `resume` | Yes | PDF, DOC, DOCX |
| `POST /api/enquiries` | `attachment` | No | PDF, DOC, DOCX |
| `POST /api/referrals` | `resume` | No | PDF, DOC, DOCX |
| `POST /api/admin/media` | `file` | Yes | JPG, PNG, WebP |

One file per request. A file in any other field returns 400 `UNEXPECTED_FILE`.

### 8.2 How the type is decided

The file name and the MIME type sent by the browser are not trusted. A file is accepted only when both of these hold:

1. Its bytes have the structure of an allowed type. For documents this is more than the first few bytes (see the table).
2. Its extension belongs to that same type.

| Type | Detected by | Extensions | Stored MIME type |
| --- | --- | --- | --- |
| PDF | A header of the form `%PDF-1.x` or `%PDF-2.x` (x is one digit) AND an `%%EOF` marker in the last 2 KB of the file | `.pdf` | `application/pdf` |
| DOC | OLE compound file header AND a directory entry named `WordDocument` (a 128-byte aligned entry of type stream). The text `WordDocument` elsewhere in the file does not count | `.doc` | `application/msword` |
| DOCX | Zip header AND a zip central directory (the index at the end of the file) that lists both `[Content_Types].xml` and `word/document.xml`. The names appearing elsewhere in the bytes do not count | `.docx` | `application/vnd.openxmlformats-officedocument.wordprocessingml.document` |
| JPG | JPEG header | `.jpg`, `.jpeg` | `image/jpeg` |
| PNG | PNG header | `.png` | `image/png` |
| WebP | `RIFF` and `WEBP` markers | `.webp` | `image/webp` |

Executables, scripts, plain zip archives, other Office formats (a spreadsheet, for example), HTML and SVG do not pass these checks and are refused whatever they are named. A file that has only the first bytes of a PDF, a truncated DOCX, or a zip with a malformed index is refused. A PDF renamed to `.docx` is refused because the extension does not match. Files under 12 bytes are refused.

These are structural checks. They are not a malware scan: a file that is a real PDF or Word document can still carry something harmful for the program that opens it (section 8.5).

Errors:

| Case | Response |
| --- | --- |
| Over 5 MB | 413 `FILE_TOO_LARGE` |
| Wrong type, or extension does not match content | 415 `UNSUPPORTED_FILE_TYPE` |
| Empty file | 400 `BAD_REQUEST` |
| File in the wrong field | 400 `UNEXPECTED_FILE` |
| Required file missing | 400 `BAD_REQUEST` |

### 8.3 Size limits

5 MB for documents (`MAX_DOCUMENT_BYTES`) and 5 MB for images (`MAX_IMAGE_BYTES`). Files are read into memory and are never written to the server's disk by the upload middleware.

### 8.4 What is stored where

**Private documents** (resumes, requirement and enquiry attachments):

- The bytes go to the private file store: Backblaze B2, through its S3-compatible API, whenever its credentials are set, and always in production (section 8.6).
- The object key is random: `<folder>/<year>/<month>/<uuid>.<ext>`, where the folder is `resumes`, `requirements`, `enquiries` or `referrals`. The uploaded file name is never part of the key.
- MongoDB stores only `{ key, originalName, mimeType, size, uploadedAt, storage }` on the record. `originalName` is a cleaned label of at most 120 characters. `storage` is `b2`, `local` or `memory`: the store that holds the bytes, written when the file is stored. A record saved before this field existed has none. The value `r2`, the marker of the earlier provider, is still accepted by the schema only so that a record written while Cloudflare R2 was the provider still saves. Nothing is stored under it now.
- The API describes a file as `{ fileName, mimeType, size, uploadedAt }`. It never returns the key or `storage` as a field: both are internal, and no request can set them.

**Public images**:

- The bytes go to the media store: Cloudinary whenever its credentials are set, and always in production, uploaded from the server with a signed request, into the folder named by `CLOUDINARY_FOLDER`.
- MongoDB stores only `{ url, publicId, width, height, format, alt }` on the record.

No file bytes are stored in MongoDB.

### 8.5 How private documents are served

There is no public URL for a private document. The only way to reach one:

1. Call the record's `resume-url` or `attachment-url` endpoint with a session that holds the required permissions (for a resume: the record's read permission and `resumes:read`).
2. The server loads the record, checks that a file is stored, and writes an audit entry (`<entity>.document_accessed`, with the file name and who asked).
3. The server returns `{ url, expiresIn, fileName, mimeType }`.

When the document is held in B2, `url` is a presigned GET URL that expires after `SIGNED_URL_TTL_SECONDS` (120 when the variable is not set; `.env.example` keeps 120). When it is held by the development driver it is a path, `/api/files/local/<token>`, with the same lifetime (section 7.14). PDFs open in the browser. Word files download.

Which of the two it is depends on where the document is, not on the store in use now. The `storage` value on the record decides (section 8.4):

| Record | Outside production | In production |
| --- | --- | --- |
| `storage: "b2"` | B2. 503 `STORAGE_NOT_CONFIGURED` if the B2 variables have been removed. | B2 |
| `storage: "local"` | The local disk of this machine | 404 `NOT_FOUND`: "This document is held in a store that this server does not use, so it cannot be opened from here." |
| `storage: "r2"` (written while Cloudflare R2 was the provider) | 404 `NOT_FOUND` with the same message. The file is never looked for in B2. | 404 `NOT_FOUND` with the same message. The file is never looked for in B2. |
| No `storage` (saved before the field existed) | The local disk when the key is found there, otherwise the store in use | The store in use, which is B2. No fallback to a disk. |

So a resume stored on a development machine before B2 was connected still opens on that machine afterwards. It is not copied to B2, and nothing migrates objects from R2 either. Deleting a record removes its file from the store that holds it, by the same rule. In B2 every version of the file is deleted by its version id, an earlier hide marker included, because a delete without a version id only hides the file. When the bucket lists no version of the key (the file is already gone), nothing more is sent: a delete without a version id would only add a hide marker for a file that is not there. If the application key cannot list versions, the file is hidden, the request does not fail, and the server log has `storage.b2_hidden_not_deleted`. Nothing is removed for a record marked `r2`.

Each driver can also list the keys it holds (`list()`). The B2 driver lists every key the bucket holds in any version, hidden ones included. No request uses the listing: it is for the maintenance command `npm run clean:showcase`, which compares the stored files with the records (`backend/README.md`, "Clean showcase state").

Every call issues a new link and a new audit entry. The link is the credential while it lasts, so treat it like one.

A hook for a malware scanner exists between validation and storage (`scanBeforeStore` in `src/services/storage/privateFiles.js`). No scanner is connected in this release, so uploads are checked for structure (section 8.2) and size only, and are not scanned for malware.

### 8.6 Providers, development and test drivers

| Driver | Used when | Private documents | Images |
| --- | --- | --- | --- |
| `b2` / `cloudinary` | The provider's credentials are complete, and always in production | Backblaze B2, presigned links | Cloudinary |
| `local` | Outside production, while the provider's credentials are not complete | Files under `backend/.data/private`, served through `/api/files/local/:token` | Files under `backend/.data/media`, served at `/media/<name>` by the API |
| `memory` | Always when `NODE_ENV=test` | Kept in process memory | Kept in process memory, served at `/media/<name>` |

The driver follows the credentials: `b2` when `B2_ENDPOINT`, `B2_BUCKET_NAME`, `B2_ACCESS_KEY_ID` and `B2_SECRET_ACCESS_KEY` are all set and the region is known (from `B2_REGION`, or from an endpoint of the form `https://s3.<region>.backblazeb2.com`), `cloudinary` when `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY` and `CLOUDINARY_API_SECRET` are all set. `FILE_STORAGE_DRIVER` and `MEDIA_STORAGE_DRIVER` are optional: the provider name forces the provider (which then answers 503 until its credentials are complete), and `local` does not block a provider whose credentials are complete. `FILE_STORAGE_DRIVER=r2`, a value of the earlier provider, is ignored with a start-up warning, and the `R2_*` variables are no longer read. `backend/README.md` ("Which driver is used") has the full rule. `GET /api/admin/settings` and the `server.listening` log line show the driver in use.

Local storage is refused at start-up when `NODE_ENV=production`, and in production the API serves neither `/media` nor `/api/files/local/:token`. Outside production `/media` serves the local image folder whatever the image store in use is, so images uploaded before Cloudinary was connected keep their address.

The email drivers follow the same pattern: `resend` sends through Resend and is used when `RESEND_API_KEY` and `EMAIL_FROM` are both set (and in production), `log` writes the template name, recipient and subject to the server log instead of sending, and `memory` (tests only) keeps messages in an in-process outbox. `EMAIL_DRIVER` is optional in the same way.

---

## 9. The rule-based ATS, the AI actions and the usage ledger

The ATS evaluation is a set of rules in `src/services/atsService.js`. It is not AI. It calls no model and needs no key, and the same candidate and job always give the same result. Every number in a result can be traced to an entry in `checks`.

What the job asks for can be written down per job as a requirement profile (section 7.2). A job without one is scored with the baseline below, exactly as before. A job with one is scored against its profile, with its own weights when it has them (section 9.1).

The AI actions a recruiter can ask for are separate, optional steps: the comparison of one candidate with a job (section 9.6), the draft of a job's requirement profile (section 9.7) and the comparison of several candidates (section 9.8). They do not replace these rules, and none of the scores, checks or skill lists of sections 9.1 to 9.4 come from them. Every request they send is written to the usage ledger (section 9.9).

It is decision support. It never changes an application: not its status and not its labels. It does not shortlist, label, advance or reject anyone. Shortlisting is always the action of a signed-in person (section 7.4).

### 9.1 Components and weights

The baseline, used for every job without a requirement profile:

| Component | Weight | How it is scored (0 to 100) |
| --- | --- | --- |
| Required skills (`skills`) | 45 | Share of the job's required skills found in the candidate's skills, by name. |
| Experience (`experience`) | 20 | Candidate's stated years against the minimum for the job's level. |
| Preferred skills (`preferredSkills`) | 10 | Share of the job's preferred skills found by name. |
| Domain relevance (`domain`) | 10 | Candidate's domain and current role against the job's category, title, department and keywords. |
| Location (`location`) | 10 | Candidate's location or preferred location against the job's location. |
| Profile completeness (`completeness`) | 5 | Share of eight profile items that are present. |

Details:

- **Skill names** are compared after normalising: lower case, `&` becomes `and`, and everything except letters, digits, `+` and `#` is removed. "System Verilog" and "SystemVerilog" match. "C" and "C++" do not. There is no synonym or fuzzy matching.
- **Required skills check result**: `pass` when none is missing, `review` when at least half are found, otherwise `fail`.
- **Experience**: the minimum years per level are Entry-Level 0, Mid-Level 2, Mid-Senior 4, Senior 7, Lead / Principal 10. At or above the minimum scores 100. Below it scores `round(years / minimum * 100)`. Years not stated scores 0 with result `review`.
- **Domain**: 100 when the candidate's domain shares a word with the job category (after removing common words such as "engineering", and with a small alias list, for example semiconductor with chip, vlsi, silicon, asic). 60 when only the current role relates to the job's title, department, keywords or category. Otherwise 0.
- **Location**: 100 when the job location contains "remote" or "hybrid". 100 when the candidate's location or preferred location contains the job's city ("Bangalore" and "Bengaluru" are treated as the same city). 50 when the candidate states no location. Otherwise 40.
- **Completeness**: phone, location, current role, domain, experience, three or more skills, a stored resume, notice period. The check passes at 75 or more.
- **Notice period** is reported as information and is not scored.

**A job with a requirement profile** is scored by the same rules against the profile:

| What the profile holds | What the rules do with it |
| --- | --- |
| `requiredSkills`, `preferredSkills` | Used in place of the job's own lists. When the profile leaves one empty, the job's own list is used. |
| `minYears` | Replaces the minimum years of the job's level in the experience rule. |
| `tools` | A component of its own, `tools` ("Tools and technologies"): the share of the tools found by name among the candidate's skills. `pass` when none is missing, otherwise `review`. |
| `domains` | Checked first for domain relevance (100 when the candidate's domain matches one, 60 when only the current role relates to one), then the job category as in the baseline. |
| `workArrangement`, `location` | `REMOTE` or `HYBRID` passes the location rule. Otherwise the profile's location is used, or the job's when the profile has none. |
| `preferredYears` | Listed as the check "Preferred experience". Not scored. |
| `education`, `certifications` | Listed as checks of their own, saying which items are named in what the candidate typed. `pass` or `review`, `score` and `weight` `null`. Not scored: a name match in free text is not reliable enough to move a score. |
| `responsibilities`, `niceToHave`, `constraints` | Counted in one `info` check, "Other requirements". The rules do not evaluate them. The AI comparison reads them. |
| `seniority`, `requiredExperience`, `preferredExperience` | Not used by the rules. Sent to the AI comparison. |

The weights of a job with a profile:

| `weightSource` | Weights |
| --- | --- |
| `PROFILE` | The profile has no weights: `skills` 40, `experience` 20, `preferredSkills` 10, `tools` 10, `domain` 10, `location` 5, `completeness` 5. |
| `JOB` | The weights saved in the profile, each a whole number from 0 to 100. They need not add up to 100: section 9.2 uses their proportions. A weight of 0 keeps the check on the list, with `weight` 0 and a note in its detail, and leaves it out of the score. |

A result is still deterministic: the same candidate, job and profile always give the same result. Changing a profile changes no stored result until the rules are run again (`POST /api/admin/ats/run` for one, `POST /api/admin/jobs/:id/ats/re-run` for all results of the job).

### 9.2 How the total is computed

```
totalScore = round( sum(score x weight) / sum(weight) )
```

over the components that apply. A component that does not apply is left out and the remaining weights are rescaled, so it neither helps nor hurts:

- a job with no required skills: `skills` is left out,
- a job with no preferred skills: `preferredSkills` is left out,
- a job with no location: `location` is left out,
- a job whose requirement profile lists no tools, or a job without a profile: `tools` is left out,
- a part the job's own weights set to 0 is left out.

The result's `weights` object lists only the components that were used.

Worked example from `tests/unit.test.js`: skills 75, experience 100, preferred skills 50, domain 100, location 100, completeness 100.

```
(75 x 45 + 100 x 20 + 50 x 10 + 100 x 10 + 100 x 10 + 100 x 5) / 100 = 83.75, rounded to 84
```

### 9.3 Bands

| Total | Band |
| --- | --- |
| 85 and above | Strong match |
| 70 to 84 | Good match |
| 50 to 69 | Partial match |
| Below 50 | Low match |

### 9.4 Checks

Each entry in `checks` is `{ rule, result, detail, score, weight }`. `result` is `pass`, `review`, `fail` or `info`. Entries that are not scored have `score: null` and `weight: null`.

### 9.5 When it runs

- Automatically when a public application names a job and no ATS result exists yet for that candidate and job. `runByName` is `System`. A later public submission for the same candidate and job does not run it again and does not point the existing result at the new application.
- On demand through `POST /api/admin/ats/run`. `runByName` is the user's name. This is the only way an existing result is re-run.
- By the development seed, for each sample application, only when it is run with `--with-demo-recruitment-data`. `runByName` is `Seed`. `npm run seed` without that option creates no job, no application and no ATS result.

One result is kept per candidate and job. A new run replaces the scores and keeps the review and any stored AI comparison.

The evaluation reads the candidate profile, not an application's `submittedProfile`. Because a public submission never changes an existing profile, a repeat application with different details does not change what the engine sees until a recruiter updates the profile.

Where it sits in the recruitment flow:

1. A job is published.
2. A candidate applies through the public form.
3. The candidate record (if the email is new) and the application are created. The application is `NEW`.
4. The rule-based ATS runs for the candidate and the job (when the application names a job and no result exists yet for that pair).
5. A recruiter reviews the application and the ATS result.
6. Optional: the recruiter starts an AI comparison of the candidate with the job for that result (`POST /api/admin/ats-results/:id/ai-comparison`, section 9.6), or of several candidates of the job (section 9.8), and reads the analysis. Neither ever starts by itself, and an application never causes a request to OpenAI.
7. A recruiter shortlists the application (`POST /api/admin/applications/:id/shortlist`). It becomes `SHORTLISTED`.
8. The candidate receives the shortlist email.

Steps 4, 5 and 6 change nothing on the application: no status, no label, no shortlist. An AI analysis cannot reject, shortlist or select anyone. Step 7 happens only when a signed-in user with `applications:shortlist` calls the endpoint.

### 9.6 The AI comparison

The AI comparison is an optional second opinion on one ATS result. A recruiter starts it with "Compare with AI" in the admin, which calls `POST /api/admin/ats-results/:id/ai-comparison` (section 7.8). The server sends the job and the candidate's stated profile to OpenAI, validates the answer and stores it in `aiComparison` on the result. Everything that talks to the model is in one file, `src/services/aiService.js`.

`engine` is `RULE_BASED` on every result. The comparison is not a second result and not a second engine: it is one field, stored in the same `ATSResult` document beside the rule-based fields. The AI code sends none of the rule-based fields to the model and writes none of them, and the rule-based engine neither reads nor writes `aiComparison`.

**When it runs, and what it never does**

- It runs only when a signed-in user with `ats:run` calls the endpoint. That is the only code path that calls a model.
- It is never called when a page, a record or a list is read, by the rule-based evaluation (automatic or on demand), by a review, by a label change, by the shortlist action or by a public submission.
- It never changes an application's status, never shortlists, never adds a label and never sends an email. `SHORTLISTED` is still set only by the shortlist action (section 7.4), which stays the only workflow action. The comparison is advice and the recruiter decides.

**Configuration**

- `OPENAI_API_KEY` and `OPENAI_MODEL`, in the backend's environment. Both are needed. The code has no default model: with either one empty the comparison is unavailable, the endpoint answers 503 `AI_NOT_CONFIGURED` and OpenAI is not called.
- One of the two set without the other is a `config.warning` at start-up, never a start-up failure. The `server.listening` log line reports `openaiConfigured` as true or false.
- The key stays on the server. It is sent to OpenAI in the `Authorization` header and nowhere else: it is not logged, not stored and not part of any API response. The browser calls this API only and never calls OpenAI.

**The request to OpenAI**

- One `POST` to `https://api.openai.com/v1/chat/completions` per comparison, made by the server with `fetch`.
- The body holds three things: `model` (the value of `OPENAI_MODEL`), `messages` (a system message with the rules and a user message with the data) and `response_format` of type `json_schema`, with `strict: true` and a schema named `candidate_job_comparison` that requires the seventeen fields of section 7.8 and allows no other. No other option is sent: no temperature and no limit on output tokens.
- The schema carries no length or range keywords. The limits of section 7.8 are written in the field descriptions the model reads, and the server enforces them when the answer arrives.
- The request is given up after 60 seconds. There is no retry: a failed or invalid comparison is run again only when a person asks again.

**What is sent**

| Block | Fields | Limits, in characters and items |
| --- | --- | --- |
| Job (`<job>`) | `title`, `category`, `department`, `location`, `employmentType`, `experienceLevel`, `minimumYearsForThisLevel` (the minimum years of section 9.1 for the job's level), `summary`, `description`, `responsibilities`, `requiredSkills`, `preferredSkills` | Title 160, category 80, department 120, location 120, summary 600, description 6000. Responsibilities: 30 items of 300. Required skills and preferred skills: 40 items of 80 each. |
| Candidate (`<candidate_data>`) | `currentRole` (the headline), `domain`, `yearsOfExperience`, `skills`, `summary`, `coverNote`, `experience` (title, employer, period, highlights), `education` (degree, institution) | Current role 160, domain 120, summary 3000, cover note 3000. Skills: 60 items of 80. Experience: 8 entries, each with title 160, employer 160, period 80 and 5 highlights of 240. Education: 6 entries, each with degree 160 and institution 160. |
| Candidate, only for a job tied to a place | `location`, `preferredLocation` | 120 each, reduced to place names. |

- Every text is cut to its limit before it is sent, so a very long submission cannot produce a very large request.
- `coverNote` is the message of the application the result is linked to (`applicationId`), and only when that application belongs to the same candidate. A result with no linked application sends no cover note.
- **Location.** The candidate's location and preferred location are sent only when the job has a location that does not contain "remote" or "hybrid", which is the test the rule-based location check uses. They are sent as a place: the text is split at commas, a part that contains a digit (a house or flat number) is left out, a postal code after a place name is removed, and at most the last three parts are kept. The job's own location is always sent.
- The comparison reads the candidate profile as it is stored now, like the rule-based evaluation (section 9.5), plus that one cover note. It does not read an application's `submittedProfile`.

**What is never sent**

- The candidate's name, email, phone and profile link.
- The resume file, its name, its storage key or anything read from it. No resume text extraction exists in this code, so the comparison is based on the profile the candidate typed and the cover note, not on the contents of the resume.
- Notes, labels, the notice period, the expected compensation and the recruiter notes on the application.
- The year of a degree, which says more about age than about the qualification.
- The rule-based scores and checks, the review, and the ids of the candidate, the job and the application.

**Removal from the text the candidate typed**

A candidate can write a name or a contact detail inside a free-text field, so every candidate text is also passed through patterns before it is sent. What a pattern finds is replaced with `[removed]`.

- Email addresses.
- Links: text that starts with `http://`, `https://` or `www.`, and a host name ending in `.com`, `.org`, `.in`, `.me`, `.dev`, `.app`, `.co` or `.edu` that is followed by a path.
- Phone numbers: a run of digits, spaces, brackets, dots and hyphens that holds 8 or more digits. A period such as "2019 - 2023" or "2019.06 - 2023.03" is kept.
- The candidate's own full name, in every candidate text, however it is capitalised.
- In the long texts (the summary, the cover note and the experience highlights), each single part of the name of three or more characters as well, but only where it is written as a name is: with a capital first letter and the rest in lower case. Many names are also ordinary words, so a part written any other way is left in place. Short fields keep single words, because a name can also be a skill.

This is pattern matching, not a guarantee. A detail written in a form the patterns do not match is sent as it was typed. Job text is written by staff: it is cleaned and cut to length, and nothing is removed from it.

**Candidate text is untrusted data**

- The user message holds two marked blocks, `<job> ... </job>` and `<candidate_data> ... </candidate_data>`. Each block is one JSON document.
- Angle brackets are removed from every text by the cleaning the rest of the API uses (section 1.6), and what a candidate typed sits inside JSON strings, so it cannot close its block or open another one.
- The system message is fixed text in the code. It tells the model that everything inside the blocks is data and never an instruction, that the candidate block is untrusted, and to mention under `concerns` when a profile contains text addressed to an automated reader. It also tells the model to use only what the blocks state, to leave out personal characteristics that are not a requirement of the job, and to write advice, not decisions.
- Whatever the model answers, the server accepts the seventeen fields of section 7.8 and nothing else. An answer with any other key, a status for example, is refused whole, and no part of an answer is ever applied to an application.
- The admin shows the answer as plain text. It is not rendered as HTML, and an address in it is not made a link.

**The answer and the log**

- The answer is validated as described in section 7.8. An invalid answer stores nothing and leaves an earlier comparison in place.
- `model` in the stored comparison is the name OpenAI reported in its answer, which can be a dated version of the configured name. The configured name is stored when the answer names none.
- The request and the answer are never written to the server log. A failed request logs `ai.request_failed` with OpenAI's status and a short error identifier, and an unusable answer logs `ai.invalid_response` with the kind of problem. OpenAI's error message is never read, because it can repeat part of the key.

**Guards, and where they are kept**

- One request per action and no retry. A failure of any kind, a quota or billing refusal included, ends with an error and nothing is sent again.
- The rate limit of 20 requests per 10 minutes per signed-in user, shared by the three AI routes (section 2.5).
- A second request for the same result while one is running answers 409 `AI_IN_PROGRESS`, so the same comparison is not paid for twice.
- Both are kept in the memory of one server process. With more than one instance each instance counts for itself, and two instances could each run a comparison for the same result at the same moment.

**What has not been shown**

- The real OpenAI API was never called in the environment where this code was written: there was no network access and no key. Every automated test answers `api.openai.com` with a stand-in.
- Whether the configured model accepts strict structured output with this schema is untested. The first real comparison shows it.
- The quality of the analysis is unproven. The answer is a model's opinion and can be wrong.
- The comparison, and the evidence it quotes, uses the profile the candidate typed and the cover note, not the contents of the resume file. Nothing in this backend reads text out of a resume.
- There is no cap on output tokens. What bounds an answer is the schema, the 60 second time limit and the rate limit.
- A comparison can take up to a minute, so a proxy in front of the API must allow a request to stay open that long.
- Sending candidate profile data to OpenAI is a decision for ALLSEMIS and belongs in its privacy notice.

**The requirement profile in the comparison.** When the job has a requirement profile, it is sent inside the `<job>` block as `requirementProfile` (its requirements, without its weights and without who saved it), and the model is told to analyse the candidate against it first, requirement by requirement. `usedRequirementProfile` on the stored comparison records that. Without a profile the value sent is `null` and the model works from the job description and its skill lists.

### 9.7 The AI draft of a requirement profile

"Draft with AI" (`POST /api/admin/jobs/:id/requirement-profile/ai-draft`, section 7.2) sends the job as it is written (title, category, department, location, level, summary, description, responsibilities and skill lists) to OpenAI once and asks for the requirements in a structured form, with suggested weights and a list of what the description leaves unclear. No candidate data is involved. The answer is validated like every other answer (exactly the keys of the schema, lists and texts cut to `REQUIREMENT_PROFILE_LIMITS`, years from 0 to 50, weights from 0 to 100) and returned to the form. Nothing is stored: a profile exists only after a recruiter has read the draft and saved it, and it is then marked `AI_REVIEWED`. The model is told to use only what the description states and to leave out any condition about a personal characteristic.

### 9.8 The AI comparison of several candidates

"Compare candidates with AI" (`POST /api/admin/jobs/:id/candidate-comparison`, section 7.8) sends one request with the same `<job>` block as the single comparison and a `<candidates>` block: one entry per chosen candidate, under the label "Candidate A", "Candidate B" and so on, each reduced and scrubbed exactly as in section 9.6. Every candidate is judged against the same requirements, the job's requirement profile when it has one. The model is told to refer to candidates by label only, to return one entry per label, not to say who should be chosen and not to put anyone out of consideration. The answer is stored on the job as its latest comparison and changes nothing else.

### 9.9 The AI usage ledger

Every request this backend sends to OpenAI is written once to the `aiusages` collection (`src/models/AiUsage.js`), by the one function that sends them (`request()` in `src/services/aiService.js`), whether it worked, failed at the provider, never arrived or came back with an answer that could not be used. A request that is refused before anything is sent (not configured, not permitted, not valid, already running) writes nothing.

| Field | Meaning |
| --- | --- |
| `at` | When the request ended. |
| `operation` | `CANDIDATE_COMPARISON`, `JOB_REQUIREMENTS` or `CANDIDATE_RANKING` (the comparison of several candidates). |
| `aiModel` | The model OpenAI said answered, or the configured one. Returned by the API as `model`. |
| `success` | Whether a validated answer came back. |
| `errorCategory` | Empty for a success. Otherwise `quota`, `rate_limit`, `auth`, `model`, `bad_request`, `timeout`, `network`, `provider`, `invalid_response` or `refused`. |
| `httpStatus` | OpenAI's status, or `null` when there was no answer. |
| `inputTokens`, `outputTokens` | `usage.prompt_tokens` and `usage.completion_tokens` from OpenAI's answer. `null` when the answer carried none. Recorded for an unusable answer too: it was paid for. |
| `estimatedCostUsd` | See below. `null` without token counts or without a price. |
| `durationMs` | How long the request took. |
| `jobId`, `candidateId`, `applicationId`, `atsResultId` | The records the request was about. Ids only. |
| `candidateCount` | For a comparison of several candidates: how many. |
| `actorId`, `actorName` | The member of staff who started it. |

It never holds the prompt, the answer, a candidate's name, email address or phone number, resume text or any other content, the API key or OpenAI's error message. Entries are not changed after they are written and are not removed automatically.

**The estimate.** `estimatedCostUsd = (inputTokens x input price + outputTokens x output price) / 1,000,000`, rounded to six decimal places, with prices in US dollars per million tokens. The price is `OPENAI_INPUT_COST_PER_1M_TOKENS` and `OPENAI_OUTPUT_COST_PER_1M_TOKENS` when both are set. Otherwise it is the list price the code knows for the model (`MODEL_LIST_PRICES` in `src/config/constants.js`): 0.75 input and 4.50 output for `gpt-5.4-mini` and its dated versions, checked on 2026-10-06. For any other model without configured prices no cost is estimated. Prices change, so the list price should be checked against OpenAI's pricing page and overridden with the two variables when it differs. Cached input tokens are counted at the full input price, so the estimate errs on the high side. The cost is stored with the request at the price in force at that moment and is not rewritten later.

**What it is not.** The figures of `GET /api/admin/ai/usage` are an internal estimate kept by ALLSEMIS. They are not read from OpenAI's billing, they are not the prepaid balance, and they do not include requests made with the same key from anywhere else. No OpenAI administrator key is used or needed.

**Billing and quota errors.** When OpenAI refuses a request with the error code or type `insufficient_quota`, `billing_hard_limit_reached`, `billing_not_active` or `quota_exceeded`, the action answers 503 `AI_QUOTA_EXCEEDED` with a sentence the admin shows. Nothing is retried, nothing is stored on the result or the job, and no application or candidate is touched. The ledger records the request with `errorCategory` `quota`, and until a later request works the usage answer reports `service.state` `QUOTA_EXCEEDED` and the level `critical`, whatever the estimated spend is. The rest of the backend is not affected: applications, the rule-based ATS and shortlisting need no model.

---

## 10. Audit log

Sensitive actions are written to the `auditlogs` collection by `src/services/auditService.js`. The running application never updates or deletes an entry. Two commands outside it do delete entries, and neither runs when `NODE_ENV=production`: `npm run seed -- --reset` empties the collection with every other one, and `npm run clean:showcase -- --apply` removes the entries about the recruitment records it removes and adds one entry of its own (`system.showcase_cleanup`, section 10.2). Writing an entry never fails the action it describes: a write failure is logged and the request continues.

### 10.1 Entry fields

`actorId`, `actorName`, `actorRole`, `action`, `entityType`, `entityId`, `summary` (at most 400 characters), `metadata`, `at`. The client IP is stored with the entry and is not returned by the API. For public submissions and failed sign-ins the actor is `System` with no id.

### 10.2 Actions

Authentication and users:

| Action | Written when | Metadata |
| --- | --- | --- |
| `auth.login` | A user signs in. | none |
| `auth.login_failed` | A sign-in attempt fails (unknown email, wrong password, disabled or paused account). | `email` (the address that was tried) |
| `auth.logout` | A user signs out. | none |
| `user.created` | A user is created. | `role` |
| `user.updated` | A user is renamed. | none |
| `user.role_changed` | A user's role changes. | `from`, `to` |
| `user.enabled`, `user.disabled` | A user is enabled or disabled. | none |
| `user.password_reset` | An administrator resets a user's password (`POST /api/admin/users/:id/reset-password`). | none |
| `user.password_changed` | A user changes their own password. | none |

Public submissions:

| Action | Written when | Metadata |
| --- | --- | --- |
| `requirement.submitted` | Hire Talent form. | none |
| `application.submitted` | Every application sent through the public form. Each one is a new application. | `candidateId`, `newCandidate`, `repeat` (`true` when the candidate had already applied to the same job, or had already sent a general application; any earlier application counts) |
| `enquiry.submitted` | Enquiry form. | none |
| `referral.submitted` | Referral form. | none |

Records. `<entity>` is `job`, `candidate`, `application`, `requirement`, `referral`, `enquiry`, `insight`, `story`, `expertise`, `service` or `location`. Not every entity uses every action: only the ones its routes allow.

| Action | Written when | Metadata |
| --- | --- | --- |
| `<entity>.created` | A record is created in the admin. | none |
| `<entity>.updated` | One or more of the resource's audited fields, other than status, changed. | `fields`: the names of the changed fields |
| `<entity>.status_changed` | The status changed and neither value is `published`. Never written for a candidate (it has no status) or an application (its status changes only through the shortlist action, which writes `application.shortlisted`). | `from`, `to` |
| `candidate.labels_changed`, `application.labels_changed` | The set of labels on a candidate or an application changed. | `added`, `removed`: the labels added and the labels removed |
| `<entity>.published` | The status became `published` (also written on create as published). | `from`, `to` on update |
| `<entity>.unpublished` | The status left `published`. | `from`, `to` |
| `<entity>.deleted` | A record is deleted. | none, except `candidate.deleted`: `applications` and `files` (the counts removed) |
| `candidate.note_added`, `referral.note_added` | A note is added. | none |
| `application.shortlisted` | An application is shortlisted. | `from`, `to` (`SHORTLISTED`), `candidateId`, `jobId` (empty for a general application) |
| `candidate.application_shortlisted` | The same event, written on the candidate so it appears in the candidate's history. | `applicationId` |
| `application.shortlist_email` | An attempt to send the shortlist email ended, from the shortlist action or from `shortlist-email`. One entry per attempt. | `state` (`SENT`, `LOGGED`, `NOT_CONFIGURED` or `FAILED`), `candidateId` |
| `referral.converted` | A referral is converted. | `from`, `to`, `candidateId`, `newCandidate` |
| `candidate.document_accessed`, `application.document_accessed`, `referral.document_accessed`, `requirement.document_accessed`, `enquiry.document_accessed` | A signed link to a private document is issued. | `fileName` |

ATS, media and settings:

| Action | Written when | Metadata |
| --- | --- | --- |
| `ats.evaluated` | An evaluation is run from the admin. (The automatic run with the first public application to a job writes no separate entry.) | `candidateId`, `jobId`, `totalScore` |
| `ats.reviewed` | A review decision is saved. | `from`, `to`, `candidateId`, `jobId` |
| `ats.ai_compared` | An AI comparison was validated and stored (`POST /api/admin/ats-results/:id/ai-comparison`). A failed or invalid comparison writes no entry. | `candidateId`, `jobId`, `model` (the model name stored with the comparison), `overallMatch` (the model's number) |
| `ats.ai_candidates_compared` | An AI comparison of several candidates was validated and stored for a job. Written on the job. A failed or invalid comparison writes no entry. | `model`, `candidates` (how many), `resultIds` |
| `ats.job_reevaluated` | The rules were run again for the existing results of a job. Written on the job. | `evaluated`, `total` |
| `job.requirements_saved` | A job's requirement profile was added or updated. | `source`, `ownWeights` |
| `job.requirements_removed` | A job's requirement profile was removed. | none |
| `job.requirements_ai_drafted` | An AI draft of a requirement profile was returned to the form. Nothing was stored. | `model` |
| `media.uploaded` | An image is uploaded. | `format`, `bytes` |
| `media.removed` | An uploaded image is removed through the media endpoint. | none |
| `settings.contact_updated` | The public contact details are saved. | none |

Maintenance command:

| Action | Written when | Metadata |
| --- | --- | --- |
| `system.showcase_cleanup` | `npm run clean:showcase -- --apply` has run (`backend/README.md`, "Clean showcase state"). One entry per run, also when nothing was removed. No request writes it: the command writes it straight to the collection, with `entityType` `system`, no `entityId`, no `actorId` and the `actorName` `Showcase cleanup`. | `records` (the number of records removed from each collection: `Job`, `Candidate`, `Application`, `Requirement`, `Referral`, `Enquiry`, `ATSResult`), `files` (the number of files of those records removed from the store), `auditEntries` (the number of audit entries removed) |

The same command removes every entry whose `entityType` is `job`, `candidate`, `application`, `requirement`, `referral`, `enquiry` or `atsResult` and whose record does not exist after the cleanup. Entries of any other `entityType` (`user`, `media`, `settings`, the content types) are kept. A dry run (the command without `--apply`) writes and removes nothing.

### 10.3 What metadata holds and does not hold

Stored:

- old and new status or role values,
- the labels added to and removed from a candidate or an application,
- the state a shortlist email attempt ended in,
- the names of edited fields (never their values),
- the file name of a document that was opened,
- ids and counts that explain the action,
- for an AI comparison, the model name and the number the model gave (`overallMatch`),
- for a failed sign-in, the email that was tried.

Never stored:

- passwords or password hashes,
- session tokens or cookies,
- storage keys,
- document contents,
- what was sent to OpenAI for an AI comparison, or the text of its answer,
- the edited field values themselves.

As a second guard, the audit service drops any metadata entry whose name contains `pass`, `password`, `secret`, `token`, `key`, `hash`, `cookie` or `authorization`. Text values are cut to 300 characters, lists to 30 items of 120 characters each.

The `summary` line is plain text for people and can contain a record's title or name, for example the job title or the candidate's name. The summaries of `application.shortlisted` and `candidate.application_shortlisted` name the job ("Shortlisted for <job title>"), or "a general application" when there is no job. The summary of `ats.ai_compared` is "AI comparison ran (advisory): <overallMatch>/100". The summary of `system.showcase_cleanup` is "Showcase cleanup removed <n> demonstration recruitment records", followed by " (every record)" when the command ran with `--all`. It contains no name and no address.
