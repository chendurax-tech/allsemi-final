# ALLSEMIS production architecture

This document describes how the ALLSEMIS website, admin panel and backend fit together, how data and files are protected, and how the system is meant to be deployed and grown. It describes the code as it is in this repository. It is not a claim that the system has been proven in production or is ready for it: the 182 automated tests in `backend/tests` cover the behaviours listed in `backend/README.md`. In the environment where this code was written the npm registry was unreachable, so the tests were run against local stand-ins for express, mongoose and the other packages, not the real packages. They must be run with the real dependencies (`npm install && npm test`) before deployment (they download a MongoDB binary through `mongodb-memory-server` on first run).

Related documents:

- `backend/README.md`: setup, environment variables, deployment steps.
- `backend/docs/API.md`: every endpoint, field, limit, error code and audit action.

Contents:

1. Architecture overview
2. Database
3. Authentication
4. RBAC
5. Media storage
6. Private file storage
7. Email
8. ATS
9. AI comparison
10. Security model
11. Deployment
12. Free-tier strategy
13. Scaling path
14. Status of this phase

---

## 1. Architecture overview

There are two deployable parts and five external services. Four are needed to run the site. The fifth, OpenAI, is optional.

- **Frontend** (`frontend/`): a React application built with Vite. It is served as static files. It contains the public website and the admin panel (`/admin`). It holds no secret and no API key.
- **Backend** (`backend/`): a Node.js service (Express, Mongoose). It owns all data access, authentication, authorisation, file handling and email. Every credential lives here, in environment variables.
- **MongoDB Atlas**: the database.
- **Cloudinary**: public website images.
- **Backblaze B2**: private documents (resumes and attachments), through B2's S3-compatible API.
- **Resend**: outgoing email.
- **OpenAI**: the optional AI comparison of a candidate with a job. It is called from the backend, and only when a recruiter asks for a comparison (section 9).

```
                          Browser
                             |
                             |  HTTPS
                             v
            +----------------------------------+
            |  Frontend host (Vercel)          |
            |  static React + Vite build       |
            |  rewrite:  /api/*  ->  API       |
            +----------------------------------+
                             |
                             |  HTTPS   /api/*
                             v
            +----------------------------------+
            |  API (Render web service)        |
            |  Node.js + Express               |
            |  sessions, RBAC, validation,     |
            |  uploads, rule-based ATS, audit  |
            +----------------------------------+
               |          |          |         |
               v          v          v         v
          +---------+ +----------+ +-------+ +--------+
          | MongoDB | |Cloudinary| |  B2   | | Resend |
          | Atlas   | | public   | |private| | email  |
          | data    | | images   | | files | |        |
          +---------+ +----------+ +-------+ +--------+

  Also from the API, only when a recruiter clicks "Compare with AI":
    API -> OpenAI         : one request per comparison (section 9)

  Also direct from the browser:
    Browser -> Cloudinary : public images, by their URL
    Browser -> B2         : one private document, through a short-lived
                            signed URL issued by the API
```

The diagram shows the recommended layout, with the `/api` rewrite on the frontend host. Production runs without that rewrite at present: the browser loads the site from Vercel and calls the API on its Render address directly (section 11).

How a request flows:

1. The browser loads the site from the frontend host.
2. The site calls `/api/...`. In the recommended setup the frontend host forwards that path to the API, so the browser only ever talks to one origin. In the layout production uses now, the frontend is built with the API's address (`VITE_API_BASE_URL`) and the browser sends the same paths to that address, as cross-site requests. In local development the Vite dev server does the same forwarding (`frontend/vite.config.js` proxies `/api` and `/media` to `http://localhost:4000`).
3. The API applies, in order: a request id and request log, security headers, CORS, the general rate limit, body parsers with size limits, the route's own checks (session, permission, validation), then the handler.
4. The handler reads or writes MongoDB and, where needed, calls Cloudinary, B2, Resend or OpenAI from the server.

The frontend talks to the API only through `frontend/src/lib/api`. That layer sends the session cookie, adds the `X-Requested-With` header, and turns error responses into one error type.

---

## 2. Database

MongoDB, accessed through Mongoose. **MongoDB is the source of truth** for every record the admin and the public forms create. File bytes are never stored in it, only keys and metadata.

Collections, by model (`backend/src/models`). Collection names are the lower-case plural Mongoose derives from the model name, for example `candidates` and `auditlogs`.

| Model | What it holds |
| --- | --- |
| `User` | Staff accounts: name, email, role, active flag, scrypt password hash, must-change-password flag, last sign-in, failed sign-in counter and the time a sign-in pause ends. |
| `Session` | One document per signed-in session: the HMAC of the session token, the user, the expiry, last seen time, IP and user agent. A TTL index removes expired sessions. |
| `Job` | Job postings: title, slug, category, location, level, description, skills, status (`draft`, `published`, `archived`), publish date. |
| `Candidate` | One record per person, keyed by email: profile, skills, resume metadata, labels, source, notes, consent time. It has no status. A public submission creates it and never changes it afterwards. Staff change it in the admin. |
| `Application` | A candidate's application to a job (or a general application), one per submission: status (`NEW` or `SHORTLISTED`), labels, the shortlist details (who shortlisted it, when, and what happened to the candidate's email), source, message, recruiter notes, the resume sent with it, and the profile details typed into the form for that application (`submittedProfile`). |
| `Requirement` | Hiring requirements from the Hire Talent form or entered by staff: contact, role, positions, priority, status, internal notes, optional attachment. |
| `Referral` | Referrals from the public form: referrer, referred person, status, notes, optional resume, and the candidate it was converted into. |
| `Enquiry` | Messages from the contact form: sender, type, subject, message, status, internal notes, optional attachment. |
| `ATSResult` | One rule-based evaluation per candidate and job: scores, weights, band, matched and missing skills, the list of checks, and the reviewer's decision. Once a recruiter has asked for one, it also holds the advisory AI comparison in its own field, `aiComparison` (section 9). |
| `Insight` | Articles: title, slug, category, tags, cover image metadata, body blocks, author, date, status, SEO fields. |
| `Story` | Quotes shown on the site: quote, name, role, photo metadata, order, status. |
| `Expertise` | Sector pages: key, number, name, slug, descriptions, domains, roles, hiring challenges, process, status. |
| `Service` | Service pages: number, name, slug, icon, descriptions, lists, call-to-action, status. |
| `Location` | Map locations: city, country, type (`office` or `network`), coordinates, and office details for offices only. |
| `SiteSettings` | One document (key `site`) with the public contact details. |
| `AuditLog` | Append-only record of sensitive actions. |

Rules that live in the data layer:

- Every status, label, shortlist email state and role is an enumeration defined once in `src/config/constants.js` and reused by models, validators and the seed.
- Unique indexes: user email, candidate email, job, insight, expertise and service slugs, expertise and location keys, session token hash, and one ATS result per candidate, job and engine.
- Sensitive fields are removed where JSON is produced, not left to each controller: the password hash is never selected by default, and a stored file is described as `{ fileName, mimeType, size, uploadedAt }` without its storage key and without the name of the store that holds it.
- **One candidate per email, and the public form only ever adds** (`backend/src/services/candidateService.js`). The application form is not signed in and an email address is not a secret. A submission from a new address creates the candidate (`findOrCreateCandidate`). A submission that names an address which already has a candidate leaves that record exactly as it is: no empty field is filled in, no skills are merged, the resume is not replaced and no stored file is deleted. Every submission becomes a new application (`createApplication`) that carries its own resume and `submittedProfile`. A repeat for the same job is flagged only in the audit metadata (`repeat: true`, set when the candidate had already applied to the same job, whatever became of the earlier application). A recruiter compares the new application with the profile and updates the profile in the admin.
- Signed-in staff actions may fill in a profile. Converting a referral uses `linkCandidate`, which creates the candidate or fills only the empty fields of an existing one. `deleteCandidateCascade` removes a candidate with the applications, ATS results and stored resumes of that person.
- **An application has two statuses, `NEW` and `SHORTLISTED`** (`APPLICATION_STATUSES`). It arrives as `NEW` with no labels and no shortlist details, and nothing sent through the public form can change that. The status is not an editable field: `PATCH /api/admin/applications/:id` accepts only the source, the recruiter notes and the labels. The only thing that sets `SHORTLISTED` is the shortlist action (`backend/src/services/shortlistService.js`), which uses one conditional update ("set `SHORTLISTED` where it is not already"), so two clicks, two tabs or two recruiters at the same moment produce one shortlist. A candidate has no status of their own.
- **`INTERVIEWED`, `REJECTED` and `SELECTED` are labels** (`RECRUITMENT_LABELS`), kept as a `labels` list on candidates and on applications. A label is a tag staff use to find and filter records. It is not a stage: adding or removing one changes no status, sends no email and runs no evaluation. The edit sends the full set, which is stored once each in a fixed order.
- **The shortlist email is tracked on the application.** `shortlist.email` holds a state (`SHORTLIST_EMAIL_STATES`: `NOT_SENT`, `SENDING`, `SENT`, `LOGGED`, `NOT_CONFIGURED`, `FAILED`), the time of the last attempt and the number of attempts. Each attempt first claims the email with a conditional update, and once the email service has accepted a message (`SENT`) no further attempt is allowed, so a candidate receives at most one accepted shortlist email per application.

**The seed is for development only.** `npm run seed` fills an empty development database with the users and with the website content and configuration the site already showed: insights, stories, expertise, services, locations and the site settings. It creates no job and no recruitment record: jobs, candidates, applications, requirements, referrals, enquiries and ATS results start empty, and no sample resume file is stored. The sample jobs and the clearly fictional recruitment samples on `example.com` are created only with `npm run seed -- --with-demo-recruitment-data`, which is for a throwaway database (an automated end-to-end run, or trying the admin) and never for a database that is shown to a client. The seed refuses to run when `NODE_ENV=production`. It also refuses a MongoDB that is not on this machine (any host other than `localhost`, `127.0.0.1` or `[::1]`, or any `mongodb+srv://` connection string) unless the database name is confirmed with `--database=<name>` and matches the one in `MONGODB_URI`. A database that already has users needs `--reset`, which empties every collection first, the website content included, so it must not be used on a database whose content was edited in the admin. Once it has run, the database is the source of truth and the seed files are not read again. The first production user is created with `npm run create-admin`. Of the 10 sample applications that the option adds, 6 are `NEW` and 4 are `SHORTLISTED` (shortlisted by `Seed`, email `NOT_SENT`: the seed sends no email), and some samples carry a label.

**Demonstration data is taken out of an existing database with a command, not with a reset.** `npm run clean:showcase` (`backend/scripts/clean-showcase.js`, logic in `backend/src/services/showcaseCleanup.js`) brings a development or showcase database to the state the seed now starts in: the seven recruitment collections empty, the users and the website content as they were. Nothing in the running application calls it, and it refuses to run when `NODE_ENV=production`.

- Without options it is a dry run: it reads, lists what would be removed and what would be kept with the reason for each, compares the stored files with the records, prints the record counts and changes nothing. `-- --apply` makes the changes. `-- --apply --all` removes every record in the seven collections, whoever created it. `--unreferenced-files`, with `--apply`, also removes stored files that no record points at. `--list` prints every record instead of the first few. With `--apply`, a database that is not on this machine has to be named with `--database=<name>`, by the same guard the seed uses.
- Demonstration data is: a record the seed created (a job with one of the seed's slugs, or a candidate, requirement or enquiry with one of the seed's email addresses, or a referral with one of the seed's referrer addresses, from `backend/src/seed/data/*.json`); a record whose address is on a domain reserved for examples and tests (`example.com`, `example.org`, `example.net`, `.test`, `.example`, `.invalid`, `.localhost`); and what belongs to those (an application whose candidate is removed or no longer exists, and an ATS result whose candidate or job is removed or no longer exists).
- Everything else is treated as possibly real and is kept with its files, unless `--all` is given. A demo job that still has an application from a kept candidate is kept too, and reported, because that application would otherwise point at nothing.
- A file is removed from the store when a removed record points at it and no kept record points at the same file. Files that no record points at are counted and listed, and are removed only on request.
- Audit entries about a job, candidate, application, requirement, referral, enquiry or ATS result that does not exist after the cleanup are removed. Entries about anything else are kept. Each run with `--apply` adds one entry, `system.showcase_cleanup`, with the numbers.
- Never touched: users, sessions, insights, stories, expertise, services, locations and the site settings.
- With `--apply` it exits with a non-zero status when a file could not be removed or the store could not be listed.

The order of use and the full rules are in `backend/README.md` ("Clean showcase state").

**Records saved by an earlier version need a one-time migration.** Before the workflow was reduced, applications and candidates carried more statuses (`SCREENING`, `INTERVIEW`, `SELECTED`, `REJECTED`, `WITHDRAWN`). `npm run migrate:recruitment` shows what would change and changes nothing. `npm run migrate:recruitment -- --apply` makes the change (`backend/scripts/migrate-recruitment.js`, `backend/src/services/recruitmentMigration.js`, `LEGACY_STATUS_MAP` in `constants.js`): each older application status becomes `NEW` or `SHORTLISTED` plus a label where one applies, the candidate status is removed (kept as a label where it was `INTERVIEW`, `SELECTED` or `REJECTED`), and a migrated shortlisted application has its email marked `NOT_SENT`. The migration sends no email, deletes no record and is safe to run twice. Until it has run the server still starts, and logs a `migration.needed` warning on start while applications with an older status exist (`backend/src/server.js`). A development database can be reseeded instead (`npm run seed -- --reset`). The steps are in `backend/README.md`.

---

## 3. Authentication

Staff sign in with email and password. Authentication uses **server-side sessions**, not tokens held by JavaScript.

**Session**

- At sign-in the server creates a random 32-byte token and a `Session` document.
- The browser receives the token in a cookie named `allsemis_sid`: `HttpOnly` always, `Path=/`, `Secure` always in production and whenever `SameSite` is `None`, host-only unless `COOKIE_DOMAIN` is set, with a lifetime of `SESSION_TTL_HOURS` (default 12 hours).
- **`SameSite` is decided for each sign-in request** (`sessionSameSite` in `backend/src/services/authService.js`). `COOKIE_SAMESITE=none` or `strict` is used as given. With `lax`, which is still the default, the cookie is `Lax` when the browser reports the request as same-origin or same-site, and `None` when it reports cross-site. The browser reports this in the `Sec-Fetch-Site` request header, which a page cannot set. A request without that header gets the configured value. A `SameSite=None` cookie is also marked `Partitioned`. Sign-out clears the cookie with the same attributes.
- The reason for that rule: a browser refuses a `SameSite=Lax` cookie that arrives in a cross-site response. With the frontend on one site calling the API directly on another, which is the layout production uses now (section 11), a `Lax` cookie was not kept. The sign-in was accepted, the next request arrived without a cookie and was answered 401, and the admin showed "Your session ended. Sign in again."
- **The limit of a cross-site layout.** With the frontend and the API on different sites the session cookie is a third-party cookie. Browsers that block third-party cookies (Safari and other WebKit browsers by default, Brave, Chrome in Incognito or with the setting switched on) may refuse it even with `SameSite=None`. The `Partitioned` attribute is meant to keep the cookie working where the browser supports it, and that was not verified in those browsers. The `/api` rewrite on the frontend host makes the cookie first-party, does not have this limit, and remains the recommended layout.
- The database stores only an HMAC-SHA256 of the token, keyed with `SESSION_SECRET`. A copy of the database contains nothing that can be replayed as a session.
- Nothing is put in `localStorage` and no token is returned in a response body.
- The expiry is fixed at sign-in. It is not extended by activity.
- On every protected request the server looks up the session, checks the expiry, loads the user from the database and checks that the account is still active. The role used for authorisation is the one in the database at that moment.

**Passwords**

- Hashed with scrypt, using Node's built-in implementation: N = 32768 (2^15), r = 8, p = 3, a 16-byte random salt per password and a 64-byte derived key.
- Stored as `scrypt$N$r$p$<salt>$<key>`. Because the parameters are inside the hash, they can be raised later: older hashes still verify and are re-hashed at the next successful sign-in.
- Password rule: at least 12 characters, at most 200, with at least one letter and one digit.
- Comparison is constant-time. When the email is unknown, a dummy hash is still verified so both paths take similar time.

**Sign-in protection**

- The same answer (401 `UNAUTHENTICATED`, with the same message) is returned for an unknown email, a wrong password, a disabled account and a paused account, so a sign-in attempt does not show which emails have an account.
- **Lockout**: 5 wrong passwords for one account pause sign-in for that account for 15 minutes. While it is paused, even the right password is refused, with exactly the answer above. There is no separate code or status for a paused account. The message mentions the pause, so the owner can tell why a correct password is refused. Wrong passwords are counted in the database in one atomic step (`$inc`), so attempts that arrive together are all counted.
- **Rate limit**: 10 failed sign-in requests per 15 minutes per IP address. Successful sign-ins are not counted, so a shared office address is not shut out by people signing in normally. `POST /api/auth/change-password` has the same kind of limit (10 failed requests per 15 minutes), because it asks for the current password and could otherwise be used to guess it from a stolen session.
- Failed and successful sign-ins are written to the audit log.

**Session revocation**

- Sign-out deletes the session on the server.
- Changing a user's role, disabling the user or resetting the password deletes all of that user's sessions.
- A user changing their own password signs out every other session of theirs.
- Rotating `SESSION_SECRET` invalidates every session at once.

Accounts are created by an administrator (or `npm run create-admin`). There is no public registration and no password reset by email in this release. An administrator resets a password in user management.

**Temporary passwords**

- An administrator never sets another user's password. `POST /api/admin/users` and `POST /api/admin/users/:id/reset-password` take no password: the server generates a temporary one, returns it once as `temporaryPassword`, and sets `mustChangePassword`. `PATCH /api/admin/users/:id` changes name, role and active only.
- A reset also deletes that user's sessions. It is refused for your own account, which is changed with `POST /api/auth/change-password`.
- While `mustChangePassword` is set, the account can sign in, read its own profile and change its password. Every route under `/api/admin` answers 403 `PASSWORD_CHANGE_REQUIRED`.
- `POST /api/auth/change-password` refuses a new password equal to the current one, so a temporary password is really replaced.

---

## 4. RBAC

Four roles:

| Role | In short |
| --- | --- |
| `SUPER_ADMIN` | Everything, including users, deletes and the audit log. |
| `RECRUITER` | Day to day recruitment: jobs (including publishing), candidates, resumes, applications (including shortlisting), requirements, referrals, enquiries, ATS. No website content, no users, no deletes. |
| `HIRING_MANAGER` | Reads jobs, candidates, resumes, applications, requirements and ATS results. May record the review decision on an ATS result. Cannot shortlist or label. |
| `CONTENT_MANAGER` | Website content, images and public contact details. May read jobs. Sees no candidate data. |

Where the table lives: `backend/src/config/permissions.js`. A permission is `<area>:<action>`, for example `candidates:read`. `ROLE_PERMISSIONS` maps each role to its permissions. The full table is reproduced in `backend/docs/API.md`.

How it is enforced:

- Every admin route names the permission it needs (`backend/src/routes/admin.routes.js`). The router first requires a valid session, then `requirePermission` checks the signed-in role against the table.
- Some routes need two permissions, and the role must hold both. A resume link needs the record's read permission and `resumes:read`: `candidates:read` and `resumes:read` for a candidate's resume, `applications:read` and `resumes:read` for an application's, `referrals:read` and `resumes:read` for a referral's.
- Publishing has its own permission. Moving a job or a content record to or from `published` is checked inside the handler, in addition to the write permission on the route.
- Shortlisting has its own permission, `applications:shortlist`, held by `SUPER_ADMIN` and `RECRUITER` only. It changes an application's status and emails the candidate, so `applications:write` alone does not allow it. Both shortlist routes (`POST /api/admin/applications/:id/shortlist` and `.../shortlist-email`) require it.
- The AI comparison uses `ats:run`, the permission that already covers running the rule-based evaluation, held by `SUPER_ADMIN` and `RECRUITER`. A role with `ats:read` only (the hiring manager) can read a stored comparison and cannot start one.
- A record that is published can only be edited or deleted by a role that holds the publish permission for it (`jobs:publish` for jobs, `content:publish` for insights, stories, expertise and services), because what is published is what the public sees (`backend/src/controllers/crudFactory.js`).
- **The server enforces it.** The admin UI reads the same table (`GET /api/admin/access`, and the `permissions` list returned at sign-in) to decide what to show, but hiding a button is never the control. A call the role may not make is refused with 403.
- Nothing the client sends is used for an access decision. A `role` field in a request body is dropped by validation everywhere except user management, which itself needs `users:manage`.

To change what a role can do, edit `ROLE_PERMISSIONS`. No other file needs to change.

---

## 5. Media storage

Public website images (article covers, story photos, sector visuals) are stored in **Cloudinary**. The path of an image is: admin, backend, Cloudinary, the Cloudinary address into MongoDB, the public API, the website.

- Cloudinary is used whenever `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY` and `CLOUDINARY_API_SECRET` are all set, and always in production. Until then a development machine keeps images in a local folder (last point of this section).

- The admin uploads an image to the API (`POST /api/admin/media`, permission `media:upload`). The API checks it and uploads it to Cloudinary from the server with a signed request, into the folder named by `CLOUDINARY_FOLDER`. The Cloudinary secret never reaches the browser.
- Accepted: JPG, PNG and WebP, up to 5 MB, with the type decided from the file's bytes. SVG is refused.
- MongoDB stores only this metadata on the record that uses the image:

```json
{ "url": "https://...", "publicId": "allsemis/<id>", "width": 1200, "height": 630, "format": "jpg", "alt": "Description of the image" }
```

- `publicId` is what a later replace or remove needs. An image entered as an external `https` link has no `publicId`.
- When a record's uploaded image is replaced, or the record is deleted, the API removes the old image from Cloudinary, but only if no other insight, story or expertise record still uses it (`backend/src/services/mediaUsage.js`). A failed removal is logged and does not fail the user's action.
- A `publicId` on a record comes from a request, so the one function that deletes (`removeImage` in `backend/src/services/storage/publicMedia.js`) ignores any id that is not one of this application's own uploads (`ownsImage`): an id directly inside the configured Cloudinary folder, or a `local-<uuid>` id of the development drivers. Which of the two an id is, is read from its shape, so each image is removed from the place it was uploaded to. A `local-<uuid>` id is only accepted outside production.
- `DELETE /api/admin/media` removes an upload that was never attached to a record. It refuses an id that is not this application's own (400) and answers 409 when a saved insight, story or expertise record still uses the image.
- A failed upload (Cloudinary refused it, could not be reached, or answered without an address) is answered with 502 `MEDIA_UPLOAD_FAILED`. The reason goes to the server log, not to the browser.
- In development, while Cloudinary is not configured, the `local` driver writes images to `backend/.data/media` and the API serves them at `/media`. In production that route is not mounted.
- **Existing images keep working when Cloudinary is switched on.** An image that is a link to another website (the seeded pictures) has no `publicId`: it is shown as it is and is never uploaded, moved or deleted. An image uploaded to the local folder earlier keeps its `/media/...` address: outside production the API serves that folder whatever the active driver is, and removing such an image removes the local file. Local images are not copied to Cloudinary. To move one, it is uploaded again in the admin.

---

## 6. Private file storage

Resumes and the attachments sent with a requirement or an enquiry are private. They are stored in **Backblaze B2** through its S3-compatible API, with the AWS SDK that is already in `backend/package.json` (`@aws-sdk/client-s3` and `@aws-sdk/s3-request-presigner`). B2 is used whenever `B2_ENDPOINT`, `B2_BUCKET_NAME`, `B2_ACCESS_KEY_ID` and `B2_SECRET_ACCESS_KEY` are all set and the region is known (from `B2_REGION`, or from an endpoint of the form `https://s3.<region>.backblazeb2.com`), and always in production. Cloudflare R2 was the earlier provider: the `R2_*` variables are no longer read, and a start-up warning says they can be removed when one is still set.

- **The bucket is private.** Its type in Backblaze must be Private. The driver takes the endpoint and the region from the environment, puts the bucket name in the path of the address (`forcePathStyle`), sends checksum headers only when an operation requires them, and sends no ACL or other option that could make an object public. There is no public URL for a document at any point.
- **Random keys.** Each object is stored as `<folder>/<year>/<month>/<uuid>.<ext>`. The uploaded file name is kept only as a label in MongoDB and is never part of the key or a path.
- **Metadata only in MongoDB**: `{ key, originalName, mimeType, size, uploadedAt, storage }`. `storage` names the store that holds the bytes (`b2`, or `local` or `memory` on a development machine and in the tests) and is written when the file is stored. The value `r2` is still accepted by the schema only so that a record written while R2 was the provider still saves. The API never returns the key or `storage` as a field, and no request can set them.
- **Signed URLs.** A document is reached only through an admin endpoint (`.../resume-url` or `.../attachment-url`). The endpoint requires a session and the right permissions (for a resume, the record's read permission and `resumes:read`), loads the record, writes an audit entry, and returns a presigned B2 URL that expires after `SIGNED_URL_TTL_SECONDS` (120 seconds when the variable is not set; `.env.example` keeps 120). PDFs open in the browser. Word files download.
- **Audit.** Every issued link is recorded as `<entity>.document_accessed` with who asked, when, and the file name.
- **Validation before storage.** Only PDF, DOC and DOCX are accepted, up to 5 MB, with the type decided from the file's structure and an extension that must match (`backend/src/utils/fileSniff.js`). A PDF needs a `%PDF-1.x` or `%PDF-2.x` header and an `%%EOF` marker in the last 2 KB. A DOCX is verified by reading the zip central directory for `[Content_Types].xml` and `word/document.xml`. A DOC needs an OLE directory entry named `WordDocument`. These are structural checks, not a malware scan.
- **Malware-scan hook.** `scanBeforeStore()` in `backend/src/services/storage/privateFiles.js` is called between validation and storage. It is a placeholder: no scanner is connected in this release. A scanner can be added there without changing any caller.
- **Each application keeps its own resume.** A public submission never replaces the resume on an existing candidate profile and never deletes a stored file.
- **Deletion.** Deleting a candidate removes every stored resume of that person: the one on the profile, the ones on applications and the ones on referrals converted into that candidate. Deleting a requirement or an enquiry removes its file. Deleting a referral removes its resume file only if no candidate, application or other referral points at the same stored key. A B2 bucket keeps versions, and an S3 delete without a version id only hides the file, so the driver lists the versions of the key and deletes each one by its version id, including an earlier hide marker. For that the application key needs `listFiles` besides `readFiles`, `writeFiles` and `deleteFiles`. When the bucket lists no version of the key (the file is already gone), nothing more is sent: a delete without a version id would only add a hide marker for a file that is not there. If the application key cannot list versions, the file is hidden, the action does not fail, and the server log has `storage.b2_hidden_not_deleted`. There is no retention or scheduled deletion job: a stored file stays until its record is deleted, or until the showcase cleanup command (section 2) removes it with its record.

Three drivers implement the same small contract (`put`, `signedUrl`, `remove`, `list`): `b2`, `local` for development while B2 is not configured (files under `backend/.data/private`, served through an expiring signed link at `/api/files/local/:token`), and `memory` for tests. `local` is refused at start-up in production. `list` returns the keys a store holds. The B2 driver lists every key the bucket holds in any version, hidden ones included. No request uses it: `listStoredFiles` in `backend/src/services/storage/privateFiles.js` is for the showcase cleanup command (section 2), which compares the stored files with the records. Outside production, when B2 is the active store, it lists the local folder as well.

**A file is read from the store that holds it** (`storageHolding` in `backend/src/services/storage/privateFiles.js`), which is what keeps earlier documents working when B2 is switched on:

- A record with a `storage` value uses that store. A resume stored on a development machine's disk before B2 was connected still opens from that disk, through the same permission check, audit entry and expiring signed link.
- A record without one (saved before the field existed) is looked for on the local disk first, outside production, and otherwise in the active store.
- **Production never reads a local disk.** There the active store, B2, is always used. A record marked as stored on a development machine answers 404 with a message that the document is held in a store this server does not use, and `GET /api/files/local/:token` always answers 404.
- A record marked `r2` was written while R2 was the provider. Its file is reported as not available (404) in every environment and is never looked for in B2.
- Nothing is copied between stores. Documents stored locally stay on that machine, and nothing migrates objects from R2 to B2. Real documents collected before B2 was connected have to be submitted again.

---

## 7. Email

Email is sent through **Resend**, by calling its HTTP API from the server (`POST https://api.resend.com/emails`). The API key stays on the server: it travels in the `Authorization` header of that request and is never logged or returned. Resend is used whenever `RESEND_API_KEY` and `EMAIL_FROM` are both set, and in production. `EMAIL_FROM` must be an address on a domain verified in Resend.

- **Centralised templates.** Every message is defined in `backend/src/services/email/templates.js`. Controllers never build an email. Each template returns a subject, an HTML body and a plain text body.
- **Three kinds of message, with different rules.** A notification to the ALLSEMIS team carries what was submitted, and every value that came from a form is HTML-escaped. A confirmation to the person who submitted is fixed wording: the address was typed into a public form and is not verified, so the confirmation repeats nothing the visitor typed (no name, subject, role or message). The only variable is a job title, which staff write. The forms therefore cannot be used to send text of someone's choosing from the ALLSEMIS address. The shortlist email to a candidate is fixed wording as well, with the staff-written job title as its only variable. It is sent by a recruiter's action, not by a form.
- **Templates**

| Template | Sent to | When |
| --- | --- | --- |
| `newRequirementAdmin` | `ADMIN_NOTIFICATION_EMAIL` | A Hire Talent requirement is submitted. |
| `requirementConfirmation` | The employer who submitted | Same. |
| `newApplicationAdmin` | `ADMIN_NOTIFICATION_EMAIL` | A candidate applies. |
| `applicationConfirmation` | The candidate | Same. |
| `newEnquiryAdmin` | `ADMIN_NOTIFICATION_EMAIL` | An enquiry is submitted. |
| `enquiryConfirmation` | The sender | Same. |
| `newReferralAdmin` | `ADMIN_NOTIFICATION_EMAIL` | A referral is submitted. |
| `referralConfirmation` | The referrer | Same. |
| `shortlistNotification` | The candidate | A signed-in user shortlists the candidate's application. At most one accepted email per application. |
| `regretNotification` | The candidate | A signed-in user presses "Send regret email" on an application that carries the Rejected label. At most one accepted email per application. |
| `selectionNotification` | The candidate | A signed-in user presses "Send selection email" on an application that carries the Selected label. At most one accepted email per application. |

- **Two groups, kept apart.** Automatic emails are sent by a public submission: the notification to the team for every application, requirement, enquiry and referral, and the acknowledgement to the person who submitted. Emails to a candidate about a decision (shortlist, regret, selection) are sent only by a recruiter's explicit action. Applying, an ATS score, an AI analysis and a label never send one.
- **The regret and the selection email** (`backend/src/services/decisionEmailService.js`). Rejected and Selected stay labels. After the label is on the application, a recruiter with `applications:shortlist` presses the button and confirms. The email goes out once per application, the label stays, and no status, evaluation or AI request is involved. An application with both labels is not emailed until one is removed. The wording carries no score, analysis, note, reason or anything from the resume.
- **The email record** (`EmailLog`, `backend/src/services/email/emailLog.js`). Every email about a stored record has one entry: the type, the record, who it was for, the outcome, the time and the attempts. It holds no address, subject or text. The entry is claimed before sending, which is the duplicate protection: an automatic email is attempted once, a failed one can be sent again by a member of staff from the "Emails" list on the record, and an email the service has accepted is never sent again.
- **A refusal is diagnosable.** When Resend refuses a message, its status, error name and sentence are kept in the server log (`email.failed`), in the email record and, for the candidate emails, in the audit entry, without the API key. The admin shows a plain reason, for example that the domain in `EMAIL_FROM` is not verified in Resend. Resend refuses every email from an unverified domain, the team notifications included, so nothing is delivered until the sender's domain is verified. Records are still saved, a shortlist still takes effect, and what was not sent can be sent later.

- Admin notifications set reply-to to the person who submitted. Attachments are never emailed: the message says to open the document from the admin.
- The team notification for an application shows the details submitted with that application, and says when the address already had a candidate record and that the existing profile was not changed.
- **One address receives at most 3 confirmation emails per hour** (`backend/src/services/email/notifications.js`), so the forms cannot be used to fill a stranger's inbox. The count is kept in memory, per instance. Over that number the confirmation is skipped. The submission is still saved and the team notification is still sent.
- **Sending never fails a submission.** The record is saved first, the response is returned, and the two emails are sent afterwards. `send()` never throws. A failure is logged with the template name and the reason.
- **The shortlist email** is sent by `notifyShortlisted` (`notifications.js`), called only from the shortlist action (`backend/src/services/shortlistService.js`). It promises no timeline or outcome. The cap of 3 per hour does not apply to it, because it is a staff action and is limited to one accepted email per application instead. Unlike the notifications above it is sent inside the request and its result is returned to the caller, so the recruiter sees whether it went out: `SENT`, `LOGGED` (the `log` driver), `NOT_CONFIGURED` (no Resend credentials) or `FAILED`. A problem with the email never undoes the shortlist. While the email has not been accepted it can be sent later from the admin (`POST /api/admin/applications/:id/shortlist-email`).
- Drivers: `resend`, `log` for development while Resend is not configured (writes the template, recipient and subject to the server log instead of sending), `memory` for tests.
- Adding or removing a label (`INTERVIEWED`, `REJECTED`, `SELECTED`) sends no email.
- If `ADMIN_NOTIFICATION_EMAIL` is not set, admin notifications are skipped and a warning is logged at start-up.

---

## 8. ATS

The ATS evaluation is a **rule-based engine** (`backend/src/services/atsService.js`). It compares a candidate profile with a job using rules. It is deterministic: the same inputs always give the same result. It is not AI and calls no model. The AI actions of section 9 are separate, optional steps that a recruiter starts by hand. What they return is stored beside the rule-based result and neither replaces nor changes it.

The baseline, used for every job without a requirement profile:

| Component | Weight |
| --- | --- |
| Required skills, matched by normalised name | 45 |
| Experience, stated years against the job level | 20 |
| Preferred skills | 10 |
| Domain relevance | 10 |
| Location | 10 |
| Profile completeness | 5 |

- **Job-specific requirements.** A job can carry a requirement profile (`requirementProfile` on the `Job` document, edited on the job's page in the admin): required and preferred technical skills, tools and technologies, domains, required and preferred experience with minimum and preferred years, education, certifications, seniority, location and work arrangement, key responsibilities, nice-to-have requirements and other constraints, and optionally the job's own weights. It is optional and for staff only: the public API never returns it, and saving it does not move the job's public "updated" date.
- A job with a profile is scored against it by the same kind of rules: its skill lists, its minimum years in place of the level's, its tools as a component of their own, its domains, its work arrangement and location. The weights are the job's own when the profile has them, otherwise the defaults of a profile (skills 40, experience 20, preferred skills 10, tools 10, domain 10, location 5, completeness 5). Education, certifications, preferred years, responsibilities, nice-to-have requirements and other constraints are listed as checks for the recruiter and are not scored, because a name match in free text is not reliable enough to move a score. Each result records which weights it was scored with (`weightSource`: `BASELINE`, `PROFILE` or `JOB`).
- Changing a profile changes no stored result. Staff run the rules again, for one result or for all results of the job (`POST /api/admin/jobs/:id/ats/re-run`, rule based only).
- The total is the weighted average of the components that apply, rounded to a whole number. A component that does not apply (for example a job with no preferred skills) is left out and the other weights are rescaled.
- Bands: 85 and above "Strong match", 70 to 84 "Good match", 50 to 69 "Partial match", below 50 "Low match".
- Every result carries a `checks` list that explains each number, and `engine: "RULE_BASED"`.
- One result is stored per candidate and job. Re-running replaces the scores and keeps the reviewer's decision and any stored AI comparison.
- It runs automatically when a public application names a job and no ATS result exists yet for that candidate and job, and on demand from the admin. A later public submission does not run it again and does not point the existing result at the new application, so a result a recruiter may already have reviewed is only replaced when staff run the evaluation themselves.
- **It never changes an application.** It does not advance, shortlist, label or reject anyone. A reviewer records a decision (`PENDING`, `ADVANCE`, `HOLD`, `REJECT`) on the result, and that review changes nothing on the application either. Shortlisting is a separate action that only a signed-in person takes.

The scoring rules are described in full in `backend/docs/API.md`, section 9.

**Where the ATS sits in the recruitment flow**

```
published job
  -> candidate application (public form)
  -> candidate and application created (application status NEW)
  -> rule-based ATS result
  -> recruiter review
  -> AI comparison of the candidate with the job   optional, only when a recruiter clicks "Compare with AI" (section 9)
  -> AI candidate versus job analysis, read by the recruiter
  -> recruiter decision
  -> SHORTLIST (a signed-in user with applications:shortlist)
  -> candidate receives the shortlist email
```

- The shortlist decision is always a signed-in person's action. Neither the rule-based ATS, nor its review, nor the AI comparison calls it.
- The AI comparison gives analysis and a recommendation only. It never starts by itself, an application never causes a request to OpenAI, and it changes no status, adds no label, sends no email and never shortlists or rejects an application.
- `INTERVIEWED`, `REJECTED` and `SELECTED` are labels staff may add to a candidate or an application at any point. They are tags, not steps in this flow.

---

## 9. AI comparison

A recruiter can ask for three things from AI, each by its own button and each one request to OpenAI:

| Action | Route | What it returns | What it writes |
| --- | --- | --- | --- |
| "Compare with AI": one candidate against one job | `POST /api/admin/ats-results/:id/ai-comparison` (`ats:run`) | Overall fit, strong matches, partial matches, missing requirements, relevant experience, domain relevance, transferable skills, concerns, evidence from the candidate's profile, where the AI is uncertain, matched and missing skills, a qualification assessment and a recommendation. | `aiComparison` on the ATS result. |
| "Draft with AI": a job's requirement profile from its description | `POST /api/admin/jobs/:id/requirement-profile/ai-draft` (`jobs:write` and `ats:run`) | A draft profile with suggested weights and what the description leaves unclear. No candidate data is sent. | Nothing. The draft fills the form, and a profile is stored only when a recruiter saves it. |
| "Compare candidates with AI": two to five candidates of one job | `POST /api/admin/jobs/:id/candidate-comparison` (`ats:run`) | A summary, one entry per candidate (fit, standing, strengths, gaps, transferable skills, uncertainties), a requirement by requirement comparison and points to weigh. | The job's latest comparison (`candidateComparison` on the `Job` document, ids only, removed when one of its candidates is deleted). |

When a job has a requirement profile, both comparisons are made against it, so every candidate is judged against the same structured requirements. Candidates in the comparison of several are sent as "Candidate A", "Candidate B" and so on.

All three are advice. None changes an application status, a candidate, a label, a shortlist or a recruiter's review, and none rejects anyone. The recruiter decides. The rest of this section describes the single comparison in detail. The other two use the same request function, the same data minimisation, the same validation and the same guards.

**Where it lives**

- `backend/src/services/aiService.js` is the only file that talks to a model. It builds the request, calls OpenAI and validates the answer. It stores nothing.
- `aiCompare` in `backend/src/controllers/atsController.js` is the caller of the single comparison (the other two actions are in `backend/src/controllers/jobRequirementsController.js`). It is reached through one route, `POST /api/admin/ats-results/:id/ai-comparison`, which takes no body, needs `ats:run` and has its own rate limit.
- The validated answer is stored in `aiComparison` on the `ATSResult` document, beside the rule-based fields, with the model name, the time and the name of the user who asked. `engine` stays `RULE_BASED`: there is no second engine and no second result. The AI code sends none of the rule-based fields to the model and writes none of them. Re-running the rule-based evaluation keeps `aiComparison`, and running the comparison again replaces it.
- In the frontend, `atsApi.compareWithAi` (`frontend/src/lib/api/admin.js`) calls that route. The browser talks to the ALLSEMIS backend only. No frontend code calls OpenAI or holds a key.

**What it never does**

- It is never called when a page loads, by the rule-based evaluation, by a review, by shortlisting, by a label or by a public submission. One click by a signed-in user with `ats:run` sends one request.
- It never changes an application's status, never shortlists, never adds a label and never sends an email. Shortlisting remains the only workflow action and the only thing that sets `SHORTLISTED`, and a signed-in person takes it (section 8).

**How the call is made**

- One request per comparison to OpenAI's chat completions endpoint (`POST https://api.openai.com/v1/chat/completions`), made by the server with `fetch`.
- The model name comes from `OPENAI_MODEL`. The code has no default model. The comparison is available only when `OPENAI_API_KEY` and `OPENAI_MODEL` are both set. Otherwise the route answers 503 `AI_NOT_CONFIGURED` and nothing is loaded or sent.
- The answer format is fixed by a strict JSON schema (`response_format` of type `json_schema` with `strict: true`) that requires seventeen fields and allows no others: `overallMatch`, `summary`, `strongMatches`, `partialMatches`, `missingRequirements`, `matchedSkills`, `missingSkills`, `relevantExperience`, `experienceGaps`, `domainRelevance`, `transferableSkills`, `qualificationAssessment`, `strengths`, `concerns`, `evidence`, `uncertainties` and `recommendation`. No other option is sent: no temperature and no limit on output tokens.
- The request is given up after 60 seconds and is not retried. It runs inside the admin request that asked for it, never inside a public request.
- The key travels in the `Authorization` header of that request. It is never logged, stored or returned.

**The checks on the route, in order**

The checks every admin route has (the request header and origin, the session, the temporary-password check), then the AI rate limit, the `ats:run` permission, a valid id, the configuration (503 `AI_NOT_CONFIGURED`), the guard against a second comparison for the same result (409 `AI_IN_PROGRESS`), and the result, its candidate and its job (404). Only then is OpenAI called. A quota or billing refusal answers 503 `AI_QUOTA_EXCEEDED`, any other provider failure 502 `AI_FAILED` and an unusable answer 502 `AI_INVALID_RESPONSE`. Neither stores anything, and a comparison stored earlier stays as it was. A stored comparison is audited as `ats.ai_compared` with the candidate id, the job id, the model name and the model's number, and without the text of the answer.

**Data minimisation: what is sent and what is not**

- Sent about the job: title, category, department, location, employment type, experience level and the minimum years that level implies, summary, description, responsibilities, required skills and preferred skills, and the job's requirement profile when it has one (its requirements, without its weights and without who saved it).
- Sent about the candidate: current role, domain, years of experience, skills, summary, the cover note of the application the result is linked to, work history (title, employer, period, highlights) and education (degree and institution, without the year).
- Never sent: the candidate's name, email, phone and profile link, the resume file or anything read from it, notes, labels, the notice period, the expected compensation, the recruiter notes on the application, the rule-based scores and the review.
- **Removal from free text.** Email addresses, links, phone numbers and the candidate's own full name are removed from every text the candidate typed and replaced with `[removed]`. In the long texts (summary, cover note, experience highlights) a single part of the name is removed too, but only where it is written with a capital first letter, because many names are also ordinary words. This is done with patterns: a detail written in a form the patterns do not match is sent as it was typed.
- **Location.** The candidate's location and preferred location are sent only when the job is tied to a place, which is when the rule-based location check would look at them. They are sent as place names, without house numbers or postal codes. For a remote or hybrid job, or a job with no location, they are not sent.
- **Size limits.** Every text is cut to a fixed length and every list to a fixed number of items before it is sent, for example 6000 characters for the job description and 3000 each for the candidate's summary and the cover note. The full list is in `backend/docs/API.md`, section 9.6.

**Untrusted input, validated output**

- What a candidate typed is untrusted. It is sent as JSON inside a marked block, `<candidate_data> ... </candidate_data>`, after the job in its own block. Angle brackets are removed from all text, so the block cannot be closed from inside.
- The instructions to the model are fixed text in the code. They say that everything inside the blocks is data and never an instruction, that the analysis may use only what the blocks state, that personal characteristics which are not a requirement of the job must not be considered or mentioned, and that the answer is advice and never a decision.
- The answer is validated on the server before it is stored: exactly the seventeen keys, the right types, `overallMatch` a number from 0 to 100. Texts are cleaned and cut (1200 characters for the summary and the relevant experience, 800 for the qualification assessment and the recommendation) and lists are capped (60 skills of 80 characters, 10 points of 300 characters). A refusal, a cut-off answer, a filtered answer, an extra key or a wrong type stores nothing.
- The admin renders the answer as plain text.

**The status the admin is shown**

`GET /api/admin/ats/engine` (as `ai`) and `GET /api/admin/settings` (as `system.ai`) return `{ available, keyConfigured, model, reason }`: whether both values are set, whether a key is set, the model name from `OPENAI_MODEL` or `null`, and one sentence. No part of the key is returned. The status is read from the configuration and does not contact OpenAI, so "available" means the values are set, not that OpenAI accepts them.

**Admin screens**

- **ATS result page.** An "AI comparison" panel follows the rule-based panels (`frontend/src/admin/components/AiComparison.jsx`). When the server reports the comparison as available, a role with `ats:run` sees the button "Compare with AI", which reads "Compare again" once a comparison is stored. The request is sent by the button's click and by nothing else: not when the page opens and not again after a failure. A role without `ats:run` can read a stored comparison and is told that it cannot start one. When the server reports it as not available, the panel says so with the server's reason, and a comparison stored earlier is still shown. The model's number is labelled as the model's estimate and is drawn differently from the rule-based score.
- **Job page.** A "Requirement profile" panel below the job form (`frontend/src/admin/components/RequirementProfile.jsx`) edits the profile and the job's own weights, offers "Draft with AI" (the draft fills the form and is not saved) and "Run the rules again for this job".
- **ATS overview page.** A "Compare candidates" panel (`frontend/src/admin/components/CandidateComparison.jsx`) lets a recruiter choose a job and two to five of its evaluated candidates and shows the stored comparison.
- **Dashboard.** The "AI usage" panel described above, for roles with `ats:run`.
- **ATS overview and ATS result pages.** A notice at the top follows the server's status: it says that AI comparison is enabled on this server and runs only when a recruiter starts it, or that it is not enabled.
- **Settings, AI and ATS.** Still read only, and Settings still has exactly three tabs: Contact, AI and ATS, Access. The "AI comparison" panel shows Status (Enabled or Not enabled), OpenAI (Connected or Not connected), the model when one is set, whether the API key is set on the server (Set or Not set), and the server's note.

**AI usage and estimated spend**

- Every request sent to OpenAI is written once to an internal ledger, the `AiUsage` collection (`backend/src/models/AiUsage.js`), by the one function that sends them, whether it worked or failed: time, model, operation, success or the category of the failure, the token counts OpenAI reported, the estimated cost, and the ids of the job, candidate, application and ATS result it was about, with who started it. It never holds the prompt, the answer, a name, an email address, resume text, the API key or OpenAI's error message.
- The cost is an estimate: input tokens and output tokens times a price per million tokens. The price is `OPENAI_INPUT_COST_PER_1M_TOKENS` and `OPENAI_OUTPUT_COST_PER_1M_TOKENS` when both are set, otherwise the list price the code knows for the model (0.75 input and 4.50 output US dollars for `gpt-5.4-mini`, checked on 2026-10-06, and prices change).
- `GET /api/admin/ai/usage` (`ats:run`) adds the ledger up for the "AI usage" panel on the admin dashboard (`frontend/src/admin/components/AiUsagePanel.jsx`): AI requests today and this month, estimated spend today and this month, the current model, the last request and the AI service status. Days and months are UTC. Reading it never calls OpenAI.
- **AI usage alerts (pay-as-you-go, no budget).** `AI_USAGE_NOTICE_USD`, `AI_USAGE_WARNING_USD` and `AI_USAGE_CRITICAL_USD` are alert thresholds on the estimated usage of the current calendar month (UTC). When one is reached, an alert is shown at the top of every admin screen (`frontend/src/admin/components/AiUsageAlert.jsx`) for the roles with `ats:run`, asking the admin to check the OpenAI account and add credits if needed. It stays until dismissed and comes back only when the level or the month changes. The thresholds never limit, delay or refuse an AI request. With none set, usage is still estimated and shown, with no alert.
- **It is an internal estimate, labelled as estimated everywhere it is shown.** It is not read from OpenAI's billing, it is not the prepaid balance, and it does not see use of the same key anywhere else. No OpenAI administrator key is used or needed. Entries are not removed automatically.
- **Billing and quota errors.** When OpenAI refuses a request because the account has no credit left, has reached its spend limit or has no active billing, the action answers 503 `AI_QUOTA_EXCEEDED` with a clear sentence, nothing is retried, nothing is stored and no application or candidate is touched. The admin then shows a Critical alert until a later request works. Applications, the rule-based ATS and shortlisting go on without AI.

**Guards, per process**

One request per action, with no retry. The rate limit (20 requests per 10 minutes per signed-in user, shared by the three AI routes) and the guard that refuses a second comparison for the same result while one is running are kept in the memory of one server process. With more than one instance each instance counts for itself (section 13, step 4).

**What has not been shown**

- The real OpenAI API was never called in the environment where this code was written: there was no network access and no key. Every test answers `api.openai.com` with a stand-in.
- Whether the configured model accepts strict structured output with this schema is untested.
- The quality of the analysis is unproven. The answer is a model's opinion and can be wrong.
- The comparison uses the profile the candidate typed and the cover note, not the contents of the resume file. No resume text extraction exists.
- There is no cap on output tokens. What bounds an answer is the schema, the 60 second time limit and the rate limit.
- A comparison can take up to a minute, so a hosting proxy's timeout must allow it.
- Sending candidate profile data to OpenAI is a decision for ALLSEMIS and belongs in its privacy notice.

---

## 10. Security model

**Headers** (helmet, `backend/src/app.js`)

- `Content-Security-Policy: default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'`. The API returns JSON and never serves HTML.
- `Cross-Origin-Resource-Policy: same-site`, `Referrer-Policy: no-referrer`, `X-Content-Type-Options: nosniff`.
- `Strict-Transport-Security` with a max age of 15552000 seconds and `includeSubDomains`, in production only.
- `X-Powered-By` is disabled.
- API responses are `Cache-Control: no-store`, except the public content endpoints, which may be kept by a browser but must be checked with the server before each use (`public, max-age=0, must-revalidate`), so an edit or an unpublish in the admin is public at the next page load.

**CORS**

- Only the origins listed in `FRONTEND_URL` are allowed, with credentials. Allowed methods: `GET, POST, PATCH, PUT, DELETE`. Allowed request headers: `Content-Type`, `X-Requested-With`.
- An allowed origin is answered by name, never with a wildcard. `http://localhost:5173` is the default origin only outside production.
- In production every `FRONTEND_URL` entry must be `https`.
- This is the same in every layout of section 11. A frontend on another site than the API is allowed because its exact origin is in `FRONTEND_URL`, and for no other reason.

**CSRF**

Three independent layers protect cookie-authenticated routes. The same check is applied to the public form submissions so another website cannot post to them.

1. The session cookie is `SameSite=Lax` whenever the frontend and the API are on the same site, so a browser does not attach it to a cross-site POST. When the frontend is on another site than the API, the cookie has to be `SameSite=None` (section 3) and this layer does not apply. The next two always do, whatever `SameSite` is.
2. Every state-changing request must carry `X-Requested-With: XMLHttpRequest`. A plain HTML form on another site cannot set it, and a script on another site cannot either, because CORS allows only the configured origin.
3. If the request has an `Origin` header, it must be exactly equal to one of the `FRONTEND_URL` entries. The header is compared as it was sent.

**Rate limits** (in memory, per IP address unless the row says otherwise)

| Scope | Limit |
| --- | --- |
| Everything under `/api` | 600 requests per 15 minutes |
| Sign-in | 10 failed requests per 15 minutes (a successful sign-in is not counted) |
| Password change | 10 failed requests per 15 minutes (a successful change is not counted) |
| The four public forms together | 8 requests per 10 minutes |
| Admin image uploads | 60 requests per 10 minutes |
| Signed document links | 120 requests per 10 minutes |
| AI comparison | 20 requests per 10 minutes, per signed-in user |

On top of this: the per-account sign-in pause (5 wrong passwords, 15 minutes), the cap of 3 confirmation emails per address per hour, and a honeypot field on the public forms. A submission with the honeypot filled is answered as if accepted and then discarded. The honeypot middleware is the one place every public submission passes, so a CAPTCHA check can be added there if spam becomes a problem.

**Validation and sanitisation**

- Every request body is parsed by a zod schema (`backend/src/validators`). Only declared fields reach a handler, with declared types. Unknown fields are dropped, so a client cannot set a status, a role or an owner by adding it to the request.
- Text is stored as plain text. Control characters and HTML tags are removed on the way in, and each field has a length limit.
- Raw text is length-checked before it is cleaned: at most 20,000 characters for a text value, and at most 200 items of 2,000 characters for a list. The cleaning never runs over more than that, and the tag-stripping pattern is linear-time, so hostile input cannot make a request slow (`backend/src/utils/sanitize.js`, `backend/src/validators/common.js`).
- A value that is not a string where text is expected fails validation. Query string filters are read as plain strings only and limited to allowed values. Together these stop MongoDB operator injection.
- Values are escaped again where they are placed into HTML (email templates). React escapes text when it renders.
- Body size limits: JSON 1 MB, URL-encoded 100 KB, multipart one file of 5 MB with at most 60 text fields.
- Image links on content must be `https` (or a local development address). `javascript:` and `data:` links are refused.
- A service's call-to-action link (`ctaTo`) must be a path on the same site. It may not start with `//` or `/\`, so it cannot lead to another site.

**Upload rules**

- File type is decided from the file's bytes, and the extension must belong to the detected type. The browser-supplied name and MIME type are not trusted.
- For documents the check is structural, not only the first bytes: a PDF needs a `%PDF-1.x` or `%PDF-2.x` header and an `%%EOF` marker in the last 2 KB, a DOCX is verified by reading the zip central directory for `[Content_Types].xml` and `word/document.xml`, and a DOC needs an OLE directory entry named `WordDocument`. This is not a malware scan. The scan hook in `backend/src/services/storage/privateFiles.js` is still not connected.
- Documents: PDF, DOC, DOCX. Images: JPG, PNG, WebP. 5 MB each. Executables, scripts, archives, HTML and SVG are refused.
- Files are held in memory during the request and are not written to the server's disk.
- Private documents get random keys and are only served through signed, expiring, audited links.

**Error handling**

- One error handler produces one error shape: `{ success: false, error: { code, message, details } }`.
- Known errors return a clear message. Anything unexpected is logged in full on the server under the request id and the client receives a generic message. Stack traces are never sent.
- Only a body-parser parse failure is answered as `INVALID_JSON`. Another malformed request that Express or its parsers reject (a URL parameter that cannot be decoded, for example) keeps its own 4xx status with the code `BAD_REQUEST`, and is not treated as a server fault.
- Public submissions answer only `{ received: true }`. They return no record data.
- Unpublished content and unknown records answer the same way (404), so a draft cannot be told apart from something that does not exist.

**Logging and redaction**

- One JSON line per event. Each request gets an id, returned as `X-Request-Id` and written on its log lines.
- The request log holds method, path without the query string, status, duration and user id. Bodies, cookies and query values are not logged.
- Values under keys that look like credentials (password, secret, token, authorization, cookie, API key, session, hash) are replaced with `[redacted]` before a line is written.
- Start-up logs which integrations are configured as true or false, never their values. The same line (`server.listening`) holds the proxy count (`trustProxy`) and how the session cookie is sent (`sessionCookie`: `httpOnly`, `secure`, `sameSite`, `domain`), never a cookie value or a secret.
- What is sent to OpenAI for an AI comparison, and what it answers, is never logged. A failed comparison logs OpenAI's status and a short error identifier only. OpenAI's own error message is not read, because it can repeat part of the key.

**Audit log**

- Sensitive actions are recorded: sign-ins and failures, user and role changes, creates, edits, status changes, label changes, shortlisting and each attempt to send the shortlist email, publishing, deletes, private document access, ATS runs and reviews, AI comparisons, media uploads, settings changes, and each public submission.
- A shortlist is recorded as `application.shortlisted` on the application and as `candidate.application_shortlisted` on the candidate. Each email attempt is recorded as `application.shortlist_email` with the state it ended in. A label change is recorded as `candidate.labels_changed` or `application.labels_changed` with the labels added and removed.
- An AI comparison that was stored is recorded as `ats.ai_compared` with the candidate id, the job id, the model name and the number the model gave. The text of the answer is not copied into the log, and a failed or invalid comparison writes no entry.
- Entries hold who, what, which record, when, and small descriptive metadata: old and new status, the labels added and removed, the names of edited fields, a file name. They never hold passwords, tokens, storage keys, document contents or edited values.
- The running application never updates or deletes an entry. Two commands outside it do, and neither runs in production: the showcase cleanup removes the entries about the recruitment records it removes and adds one entry of its own, `system.showcase_cleanup` (section 2), and `npm run seed -- --reset` empties the collection. Reading the log needs `audit:read` (super admin only).
- The candidate page (`GET /api/admin/candidates/:id`) shows that candidate's activity as `history` entries reduced to `{ id, at, action, summary, actorName }`. The full entries, with their metadata, stay behind `audit:read`.
- A failure to write an audit entry is logged and does not fail the action.

**AI comparison** (section 9 has the detail)

- **The key is server-side only.** `OPENAI_API_KEY` is read by the backend, sent to OpenAI in the `Authorization` header and nowhere else. The browser never calls OpenAI.
- **Data minimisation.** Only job-relevant data is sent. The candidate's name, email, phone, profile link, resume file, notes, labels, notice period and expected compensation are never sent, and patterns remove email addresses, links, phone numbers and the candidate's own name from the text the candidate typed.
- **Candidate text is untrusted.** It is sent as data inside a marked block, and the instructions tell the model to treat it as data.
- **The answer is untrusted too.** It can only fill ten fixed fields, it is validated and cut to length on the server before it is stored, and the admin shows it as plain text. No part of an answer is applied to an application.
- **Cost guards.** 20 requests per 10 minutes per signed-in user, and one comparison at a time per result.

**Not covered in this release**

- No malware scanning of uploads (the hook exists). The upload checks are structural only.
- No CAPTCHA (rate limit and honeypot only).
- No two-factor authentication and no self-service password reset.
- Rate-limit counters, the confirmation-email counters and the guard against two AI comparisons for the same result at once are per instance and reset when the process restarts.
- The removal of names and contact details from text sent to OpenAI is pattern matching, not a guarantee, and the request to OpenAI sets no cap on output tokens (section 9).

---

## 11. Deployment

| Part | Host | Notes |
| --- | --- | --- |
| Frontend | Vercel | Root directory `frontend`. Static build. Address in production: `https://allsemi.vercel.app`. `frontend/vercel.json` holds the routing: trailing slashes redirect (308) to the address without one; the two old sector addresses redirect permanently; each fixed public page is served from its own HTML file (`/seo/<page>.html`, written by the build with that page's title, description, canonical address, sharing tags and structured data); `/sitemap.xml` is forwarded to the API (`GET /api/public/sitemap.xml`); every other address gets the generic `/spa.html`. It also sets long caching for the hashed `/assets/*` files, a day for the chip frames and videos, and `X-Robots-Tag: noindex` for `/admin`. There is no `/api` rewrite. `VITE_API_BASE_URL` holds the address of the API and `VITE_SITE_URL` the public address of the site (canonical addresses, sharing tags and `robots.txt`; default `https://allsemi.vercel.app`). Both are URLs, not secrets, and are read at build time. When the site moves to its own domain, set `VITE_SITE_URL` (frontend) and `PUBLIC_SITE_URL` (backend) to it, and change the `/sitemap.xml` destination in `vercel.json` if the API address changes. |
| Backend | Render web service | Root directory `backend`, build `npm install`, start `npm start`, health check `/api/health` (or `/ready`). An uptime monitor uses `/health`. Address in production: `https://allsemi-backend.onrender.com`. The browser calls it directly. |
| Database | MongoDB Atlas | Connection string in `MONGODB_URI`. |
| Public images | Cloudinary | `CLOUDINARY_*` variables. |
| Private documents | Backblaze B2 | Bucket of type Private with no public address, `B2_*` variables. |
| Email | Resend | Verified sending domain, `RESEND_API_KEY`, `EMAIL_FROM`, `ADMIN_NOTIFICATION_EMAIL`. |
| AI comparison (optional) | OpenAI | `OPENAI_API_KEY` and `OPENAI_MODEL`. Both are needed, and the code has no default model. Called from the backend only. |

How the frontend reaches the API. Three layouts are supported (options A, B and C in `backend/README.md`), and production uses the third one now:

| Layout | The browser calls | Session cookie | `COOKIE_SAMESITE` | `TRUST_PROXY` on Render | In use |
| --- | --- | --- | --- | --- | --- |
| A: `/api` rewrite on the frontend host (recommended) | The site's own origin | First-party, `SameSite=Lax` | `lax` | 2 | No |
| B: the API on a subdomain of the site | The subdomain | Same-site, `SameSite=Lax`, with `COOKIE_DOMAIN` | `lax` | 1 | No |
| C: unrelated domains | The Render address directly | Third-party, `SameSite=None`, `Secure`, `Partitioned` | `none` (recommended, to be explicit) or `lax` | 1, which is also the default on Render in production | Yes: production now |

Key points (the step by step is in `backend/README.md`):

- **How the frontend reaches the API.** Recommended: a rewrite in `frontend/vercel.json` that forwards `/api/:path*` to the backend, placed before the existing catch-all rewrite to `/index.html`. The browser then calls `/api` on the site's own origin, the session cookie is first-party, and `COOKIE_SAMESITE=lax` works. Alternatives: the API on a subdomain of the same site with `COOKIE_DOMAIN`, or unrelated domains with `VITE_API_BASE_URL`, where the browser calls the API directly and the session cookie is a third-party cookie.
- **What production uses now: direct cross-site calls from Vercel to Render (layout C).** The frontend at `https://allsemi.vercel.app` is built with `VITE_API_BASE_URL=https://allsemi-backend.onrender.com` and calls the API at that address. Changing that variable needs a new Vercel build. On Render: `NODE_ENV=production`, `FRONTEND_URL=https://allsemi.vercel.app` (the exact origin, `https`, no path), `COOKIE_SAMESITE=none` (`lax` also works, because of the rule in section 3), `COOKIE_DOMAIN` empty, and `TRUST_PROXY=1` or not set. The other variables production mode needs are unchanged (see "Production mode is strict" below). The step by step and a troubleshooting entry for the message "Your session ended. Sign in again." are in `backend/README.md`.
- **The limit of layout C.** The session cookie is a third-party cookie there. Browsers that block third-party cookies (Safari and other WebKit browsers by default, Brave, Chrome in Incognito or with the setting switched on) may refuse it even with `SameSite=None`. The `Partitioned` attribute is meant to keep it working where the browser supports it, and that was not verified in those browsers. Layout A does not have this limit and remains the recommended layout.
- **The credentials select the provider.** Each of the three services uses its real provider as soon as all of its values are set, and its development fallback (local files, local images, emails written to the log) until then. The rule is one small function, `resolveDriver` in `backend/src/config/env.js`. The `FILE_STORAGE_DRIVER`, `MEDIA_STORAGE_DRIVER` and `EMAIL_DRIVER` variables are optional: the provider name forces the provider, and a `local` or `log` value left over from an earlier `.env` does not block a provider whose credentials are complete (a start-up warning says the line is ignored). There is deliberately no switch that keeps a fallback while the credentials are complete: emptying one credential is the way, so the configuration file and the behaviour cannot disagree. The `server.listening` log line and `GET /api/admin/settings` show the driver in use and, as true or false, whether each provider's credentials are complete. No secret is logged or returned.
- **Secrets are server-side only.** The Cloudinary secret, the B2 application key, the Resend key and the OpenAI key are read from the backend's environment. They are never sent to the browser, never placed in a `VITE_` variable, and never part of an API response.
- **Production mode is strict.** With `NODE_ENV=production` the server refuses to start unless `MONGODB_URI`, a `SESSION_SECRET` of at least 32 characters and an `https` `FRONTEND_URL` are set, private documents use B2 and images use Cloudinary. There is no fallback to local storage: with no credentials the providers stay selected and the affected feature answers that it is not configured.
- **OpenAI is optional in every mode.** The server starts without `OPENAI_API_KEY` and `OPENAI_MODEL`, and the AI actions then answer that AI is not set up. One of the two set without the other is a start-up warning.
- **An AI comparison can keep a request open for up to 60 seconds.** A proxy in front of the API (the frontend host's `/api` rewrite, the backend host's own) must allow that, or the browser is given the proxy's error before the API has answered.
- **`NODE_ENV` is checked first.** It must be `development`, `test` or `production`. Any other value (a misspelt `prod`, for example) stops the process as soon as the configuration is loaded, so it can never run with the development safeguards by mistake. The server also refuses to start with `NODE_ENV=test`: that mode uses in-memory storage and turns the rate limits off, and is for the test suite only.
- **`TRUST_PROXY`** must be a whole number from 0 to 5, or the server refuses to start. When it is not set, the value is 1 in production on Render (Render sets `RENDER=true`) and 0 everywhere else. A value that is set always wins. Set it to the exact number of proxies in front of this API (1 when browsers call the Render address directly, 2 when the frontend host forwards `/api` to it), because rate limits and audit entries use the client address derived from it. Do not set it higher than the real count: a larger number lets a visitor forge the address. With `TRUST_PROXY=0` in production the server logs a warning: behind a hosting proxy every visitor then appears to come from the proxy address, so rate limits are shared by everyone. After deploying, check the request log: if every request shows the same address, the number is too low.
- **An empty option line means "not set".** `COOKIE_SAMESITE=` or `LOG_LEVEL=` with nothing after it gives the default instead of stopping the server, and an empty `FRONTEND_URL` outside production gives `http://localhost:5173`. In production an empty `FRONTEND_URL` still stops the server.
- **Health check**: `GET /health` is liveness: public, no sign-in, no database or other service needed, always 200 with the fixed body `{"status":"ok","service":"allsemis-api"}` while the process can answer. It is the address for an uptime monitor (`https://allsemi-backend.onrender.com/health`). `GET /ready` is readiness: 200 when the database connection is up and 503 when it is not, with no detail. `GET /api/health` is unchanged and answers like `/ready`. None of the three returns configuration or data.
- **AI usage variables (optional, none is a secret)**: `AI_USAGE_NOTICE_USD`, `AI_USAGE_WARNING_USD` and `AI_USAGE_CRITICAL_USD` are the estimated-usage alert thresholds (US dollars, current calendar month, UTC). They are not a budget, not a limit and not the OpenAI balance, and they never block AI. Empty: no alert. `OPENAI_INPUT_COST_PER_1M_TOKENS` and `OPENAI_OUTPUT_COST_PER_1M_TOKENS` override the list price. Production keeps `OPENAI_MODEL=gpt-5.4-mini`.
- **Nothing to migrate** for the requirement profile and the usage ledger: the new fields are optional and the `AiUsage` collection is created on first use.
- **Shutdown**: the server stops accepting connections and closes the database connection on `SIGTERM`.
- **First user**: `npm run create-admin`. The development seed never runs in production, and it refuses a database that is not on the machine it runs on unless the database name is confirmed with `--database=<name>`.
- **An existing database**: if it holds applications or candidates saved by an earlier version, run `npm run migrate:recruitment` (dry run), then `npm run migrate:recruitment -- --apply` (section 2).

### Public website: loading and search

- **First download.** Only the landing page is in the first JavaScript file; every other page is its own file, fetched ahead in the background once the first page has loaded (`frontend/src/App.jsx`). The admin is never in the public download.
- **Heavy media.** The chip sequence uses WebP frames (`public/chip-frames/*.webp`, and `chip-frames/sm/` at 768px for phones), loaded in scroll order four at a time when the section comes near; the PNGs are the fallback. Its fog animation runs only while the section is on screen. Phones get `hero-loop-mobile.mp4` (960 x 540, H.264), larger screens `hero-loop.mp4`.
- **Stable layout.** The web fonts load without blocking the first paint, and each has a local fallback sized to its metrics (`styles/tailwind.css`, FONT FALLBACKS), so the swap moves nothing. `<main>` is at least a screen tall, so a page still loading never shows the footer and then pushes it away. An image that fails to load is hidden and its frame keeps its size (`main.jsx`).
- **Search.** Each page sets its own title, description, canonical address, robots, Open Graph and Twitter tags and JSON-LD through `useSeo` (`src/lib/seo.js`); the text of the fixed pages is in `src/lib/seoPages.js`. Structured data: Organization and WebSite on the home page, BreadcrumbList on every other page, JobPosting on a published job whose location names a place, Article on an article. A not-found state is `noindex` with no canonical. `robots.txt` (written by the build) disallows `/admin`, `/api/` and `/seo/` and names the sitemap.
- **Sitemap.** `GET /api/public/sitemap.xml` (`backend/src/services/sitemap.js`) lists the fixed pages and the published sectors, services, articles and jobs at their public addresses, from `PUBLIC_SITE_URL` (or the first `FRONTEND_URL`). Nothing private, draft or archived is listed.
- **Limit.** The page body is still drawn by JavaScript. Google and Bing render it; a crawler that does not run JavaScript sees the head of each fixed page but not its text.

---

## 12. Free-tier strategy

Each service starts on its free tier. That keeps the starting cost at zero while the site has little traffic and few records. Free tiers have limits, and the limits change, so **this document quotes no numbers and no prices. Check each provider's current limits and terms before launch and again from time to time.**

What to watch, in general terms:

| Service | What to watch on a free tier |
| --- | --- |
| Backend host (Render) | A free web service may be put to sleep when idle. The first request after a sleep is slow, which affects the first sign-in or form submission of the day. In-memory rate-limit counters reset when the process restarts. Notification emails are sent by the same process just after the response, so they depend on it staying up for those moments. |
| Frontend host (Vercel) | Bandwidth and build allowances, and whether the free plan's terms allow a commercial site. |
| MongoDB Atlas | Storage size, connection limits and shared performance on a free cluster, and what backup options the tier includes. Plan your own exports if the tier has no backups. |
| Cloudinary | Storage, bandwidth and transformation allowances. Large original images use them up faster. |
| Backblaze B2 | Stored volume and the number of read and write operations. |
| Resend | Daily and monthly sending limits and the number of domains. Each public submission sends up to two emails: the team notification, and a confirmation unless that address has already received 3 in the hour. Each shortlist sends one email to the candidate. |
| OpenAI (optional) | This is not a free tier: every comparison is a paid request. The application sends one request per click, allows each signed-in user 20 requests per 10 minutes, and sets no limit on the length of an answer. Watch the usage page of the OpenAI account. |

Practical habits:

- Look at each provider's usage page monthly.
- Treat a sleeping backend as the first thing to pay for once staff use the admin daily.
- Keep uploaded images reasonably sized before uploading.
- The audit log and sessions also use database storage. Sessions expire on their own. Audit entries do not.

---

## 13. Scaling path

Upgrade in the order the limits are reached. Most early steps are plan changes with no code change.

| Step | When | Code change needed |
| --- | --- | --- |
| 1. Always-on backend instance | Cold starts bother staff or visitors. | None. A plan change on the host. |
| 2. Paid database tier | Storage, connections or backups become a constraint. | None. Same connection string format. The pool size is set in `backend/src/config/db.js` if it needs tuning. |
| 3. Paid email, image and file plans | Quotas are approached. | None. |
| 4. More than one backend instance | One instance cannot carry the load, or zero-downtime deploys are wanted. | **A shared rate-limit store.** The limiters in `backend/src/middleware/rateLimiters.js` keep counters in memory, which is only correct for one instance. Pass a shared store (Redis or MongoDB) to them. The cap on confirmation emails per address (`backend/src/services/email/notifications.js`) is counted in memory in the same way and needs the same treatment. So does the guard that refuses a second AI comparison for the same result while one is running (`backend/src/controllers/atsController.js`). Sessions are already in MongoDB and need no change. The once-only shortlist and its single email are enforced by conditional updates in MongoDB and need no change either. |
| 5. Server-side pagination in the admin lists | A list approaches 500 records. | The frontend API layer asks for up to 500 records per list (`frontend/src/lib/api/admin.js`) and the API caps `limit` at 500. The API already supports `page`, `limit`, `q`, `sort` and filters, so the change is in the admin screens: request pages and search on the server instead of loading a whole collection. The public list endpoints also return at most 500 jobs or insights without paging and would need paging at that size. |
| 6. Indexed search | Search over large collections gets slow. | `q` is a case-insensitive "contains" match (`backend/src/utils/query.js`), which scans. Move to a text index or a search service and change `searchFilter`. |
| 7. Notifications on a queue | Email volume grows, or lost notifications matter. | Emails are sent in-process after the response with no retry (`backend/src/controllers/formsController.js`, `backend/src/services/email/notifications.js`). Move sending to a queue with a worker and retries. The templates stay as they are. The shortlist email is different today: it is sent inside the shortlist request, and a failed one is retried only when a person asks for it from the admin. |
| 8. Background jobs for the AI comparison | Comparisons are started often, or a request that stays open for up to a minute is a problem for the host. | The AI comparison runs inside the admin request that asked for it and keeps it open until OpenAI answers or 60 seconds have passed. Run it from a queue and store the result when it is ready. The rule-based evaluation is fast enough to stay inside the application request. |
| 9. Upload path | Larger files or many concurrent uploads. | Files are buffered in memory (`backend/src/middleware/upload.js`). Move to streaming or direct uploads to storage with presigned requests, keeping the content checks. |
| 10. Malware scanning and CAPTCHA | Before accepting documents at volume, or when spam appears. | Connect a scanner in `scanBeforeStore()` and a CAPTCHA check in `backend/src/middleware/honeypot.js`. |
| 11. Audit log retention | The audit collection becomes a large share of storage. | Add an archive or retention job. The application itself never deletes entries. |

---

## 14. Status of this phase

What exists in the repository now:

- **The backend** (`backend/`): the API, authentication, RBAC, validation, uploads, storage drivers, email, the rule-based ATS with job requirement profiles, the three AI actions (OpenAI) with their usage ledger, the `/health` and `/ready` endpoints, the shortlist action and its email, labels, the audit log, the development seed, the `create-admin` script, the one-time `migrate:recruitment` script, the `clean:showcase` command and the automated tests.
- **The frontend API layer** (`frontend/src/lib/api`): the client, and the auth, admin, upload and public functions that call the backend.
- **The dev proxy** (`frontend/vite.config.js`): `/api` and `/media` are forwarded to `http://localhost:4000` (override with `VITE_DEV_API_TARGET`).

What is connected to the API in this phase:

- **The admin screens read and write through the API** (`frontend/src/admin`). The admin store loads each collection the signed-in role may read and sends every change to the backend. Sign-in uses the backend session. An account on a temporary password is shown the change-password screen. User management calls `usersApi.resetPassword` and shows the temporary password once. The referral page has an "Edit details" drawer, which is how a missing candidate email is added before converting. The applications drawer shows the details sent with each application (`submittedProfile`). Shortlisting is done through one component, `ShortlistPanel` (`frontend/src/admin/components/ShortlistPanel.jsx`), shown in the application drawer, on the candidate page and on the ATS result page. It calls the shortlist endpoint, shows what the server reported about the email, and offers to send the email later when it has not been accepted. Labels are edited with `LabelPicker`. There is no candidate status control. The dashboard shows the New and Shortlisted counts, and beside them the number of applications carrying each label.
- **The jobs pages and the four public forms are wired to the API.** The Talent page and the job page read `/api/public/jobs`. The Hire Talent, application, enquiry and referral forms post to `/api/requirements`, `/api/applications`, `/api/enquiries` and `/api/referrals`. The Contact page reads the contact details from `/api/public/site`. There are no bundled contact details any more: a value that is empty in Settings, Contact is left out of the page, and when the API cannot be reached the panel says the details could not be loaded.
- **Stories and Insights are wired to the API.** The home page Stories section reads `/api/public/stories`. The home page Insights section, the Insights page, the article pages and the "From Insights" card on a sector page read `/api/public/insights` and `/api/public/insights/:slug`. There is no bundled story or article any more: the database is the only source, and only published records are returned. An unknown, draft or unpublished article address shows a not-found state. The admin chooses what the landing page shows: each story and each article has a "Show on landing page" switch in its editor, stories are ordered by their order number and articles by their landing page order. The two landing page sections lay out however many are chosen (one, two, three, or more). When nothing is chosen or published, or the API cannot be reached, the section is left out and the rest of the page is unaffected.

- **Expertise, Services and Locations are wired to the API.** The header sector menu, the home page sector bands, `/expertise`, the sector pages (`/expertise/:slug`), the eight domain cards on About and the domain choices in the public forms read `/api/public/expertise`. The home page service cards and the service pages (`/employers/:slug`) read `/api/public/services`. The network map and the office panel on the home and About pages read `/api/public/locations`. Each list is requested once per page load and shared by every component that shows it. There is no bundled sector, service or location record any more. A sector or service that is unpublished, or a location that is hidden, leaves the site at the next page load, and its address shows a not-found state. The only text kept in the frontend for these pages is: the fixed section headings, the drawing used for each of the eight original sectors (a sector added later gets a neutral drawing), and the tags and questions of the three original services, which are used only while the database record has none of its own.

- **The AI comparison is wired to the API.** The ATS result page has an "AI comparison" panel (`frontend/src/admin/components/AiComparison.jsx`) with the button "Compare with AI", which calls `POST /api/admin/ats-results/:id/ai-comparison` and shows the stored comparison. The ATS overview and result pages show a notice that follows the server's status, and Settings, AI and ATS shows what the server reports. Section 9 describes the screens.

What is a later step:

- **Pages with no admin collection keep their copy in the frontend:** the home hero, action cards and facts, About, the Employers landing page, the Talent and Refer page copy, and the header and footer navigation. No admin screen edits these, so there is nothing to connect.

What is not part of this phase:

- **Reading the resume file.** No resume text extraction exists. The rule-based ATS and the AI comparison both work from the profile the candidate typed, and the AI comparison also from the cover note.
- **Anything automatic from the AI comparison.** It runs only when a recruiter asks for it, it is advice, and nothing shortlists an application automatically. The scores of the ATS are still rule-based.

What has not been shown:

- The system has not been run in production, and this document does not claim it is ready for production. **Cloudinary, Backblaze B2, Resend and OpenAI have not been contacted from this code.** `backend/tests/providers.test.js` checks what the code sends to Cloudinary, B2 and Resend and how it reads an answer, with `fetch` replaced by a stand-in and the B2 driver given a stand-in for the AWS SDK. The AI tests in `backend/tests/admin.test.js`, `requirements.test.js` and `ai-usage.test.js` do the same for OpenAI: every request to `api.openai.com` is answered by a stand-in. Backblaze B2 itself and the real AWS SDK were never contacted in the environment where this was written: there was no network access, there were no credentials, and the SDK package is not installed there. No request reached any provider. The first real run of each service has to be checked by hand: the steps are under "Connecting the services" in `backend/README.md`. The 182 automated tests in `backend/tests`, in eleven files (26 in `unit.test.js`, 14 in `auth.test.js`, 17 in `forms.test.js`, 35 in `admin.test.js`, 22 in `providers.test.js`, 6 in `showcase.test.js`, 6 in `session.test.js`, 6 in `health.test.js`, 20 in `requirements.test.js`, 13 in `ai-usage.test.js` and 17 in `emails.test.js`), cover the behaviours listed in `backend/README.md`. In the environment where this code was written the npm registry was unreachable, so the tests were run against local stand-ins for express, mongoose and the other packages, not the real packages. They must be run with the real dependencies (`npm install && npm test`) before deployment. They download a MongoDB binary through `mongodb-memory-server` on first run.
- **The AI comparison has only been run against a stand-in.** The real OpenAI API was never called in the environment where this was written (no network access and no key). Whether the configured model accepts strict structured output with this schema is untested, and the quality of the analysis is unproven. The comparison uses the profile the candidate typed and the cover note, not the contents of the resume file: no resume text extraction exists. The request sets no cap on output tokens beyond what the schema and the rate limit allow. A comparison can take up to a minute, so a hosting proxy's timeout must allow it. Sending candidate profile data to OpenAI is a decision for ALLSEMIS and its privacy notice.
- Further checks were made in the same environment, with the backend of this repository running and stand-ins answering in place of the providers. The checks for Cloudinary, Resend and OpenAI were run earlier, before the private storage provider was changed: an image upload through to the public page, the five email workflows, and Compare with AI from the button to the stored result. The storage checks were run again for Backblaze B2, with a stand-in for the AWS SDK that behaves like a versioned B2 bucket: 29 API checks passed for B2 (resume and attachment upload, a signed link with the configured lifetime, refusals for signed-out and unauthorized users, the 5 MB limit, the file types, and complete deletion) and 7 for the local fallback. The 21 browser checks were run again with the B2 stand-in and passed. This shows that the application calls the providers as intended and keeps its own rules. It does not show that the real providers accept those calls.
- **The showcase cleanup was not run against the owner's real database or a real B2 bucket.** That run is the owner's, and its numbers are printed by the command (`backend/README.md`, "Clean showcase state"). `backend/tests/showcase.test.js` covers the seed and the cleanup on an in-memory database with the in-memory file store, and `backend/tests/providers.test.js` covers the B2 listing against a stand-in for the AWS SDK. The figures that follow were reported from the sandbox where this code was written and cannot be read from the repository. The command itself was run there on a database seeded with the demonstration data, with the files on the local disk: a dry run, then `--apply`, then `--apply --all --unreferenced-files`. It ended with all seven recruitment collections at 0, the content collections unchanged and no file left. 30 browser checks passed on a database seeded by the new seed: the public pages, admin sign-in, the seven empty lists, the content lists unchanged, and a job that could still be created.
- **The production sign-in fix was not run on the real deployment.** `backend/tests/session.test.js` starts the real application in a separate process, in production mode and in development mode, and checks the headers it sends for the preflight, the sign-in, an authenticated request and the sign-out. It involves no browser. The figures that follow were reported from the environment where the change was made and cannot be read from the repository. The failure was reproduced in headless Chromium with the frontend and the API on different sites and the API in production mode: the browser blocked the cookie with the reason `SameSiteLax`, and the screen showed "Your session ended. Sign in again." With the change, the same run signs in and stays signed in after a reload, and the stored cookie is `HttpOnly`, `Secure`, `SameSite=None` and partitioned, and is invisible to page JavaScript. Not shown: the real Vercel and Render deployment, and Safari or any other browser that blocks third-party cookies.
