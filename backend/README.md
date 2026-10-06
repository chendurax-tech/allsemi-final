# ALLSEMIS backend

The API behind the ALLSEMIS website and admin panel. It is a Node.js service built with Express and MongoDB (Mongoose). It provides:

- sign-in for staff, with server-side sessions and four roles,
- the admin API for jobs, candidates, applications, hiring requirements, referrals, enquiries, website content, images, settings, users and the audit log,
- the shortlist action: a recruiter shortlists an application, once, and the candidate receives one email,
- the four public form submissions (Hire Talent, candidate application, enquiry, referral),
- read-only public endpoints for published content,
- private storage for resumes and attachments, and public storage for website images,
- notification and confirmation emails, and the shortlist email,
- a rule-based ATS that scores a candidate against a job. It is not AI and calls no model. It never shortlists anyone: that is always a signed-in person's action,
- an optional AI comparison of a candidate with a job, through OpenAI. It runs only when a recruiter clicks "Compare with AI" on an ATS result. It is advice: it changes no score and no application, and it never shortlists anyone either.

Reference documents:

- `docs/API.md`: every endpoint, request field, limit, error code and audit action.
- `../docs/ALLSEMI-PRODUCTION-ARCHITECTURE.md`: how the pieces fit together, the security model and the deployment plan.

Status: this service has not been run in production yet. The automated tests in `tests/` cover the behaviours listed under "Tests" below. In the environment where this code was written the npm registry was unreachable, so the tests were run against local stand-ins for express, mongoose and the other packages, not the real packages. Run them yourself with the real dependencies (`npm install && npm test`) before deployment and before relying on any of it.

## Requirements

- Node.js 20.11 or newer (`engines.node` in `package.json` is `>=20.11`).
- npm.
- A MongoDB database. MongoDB Atlas is assumed below. Any MongoDB reachable through a connection string works.
- For production only: a Cloudinary account, a Backblaze B2 bucket and a Resend account. Local development needs none of them: until their credentials are filled in, files and images are kept under `backend/.data/` and emails are written to the server log. See "Connecting the services".
- Optional: an OpenAI API key and a model name, for the AI comparison. Without them everything else works, and the AI comparison answers that it is not set up.

## Folder structure

```
backend/
  .env.example            every environment variable, with placeholders
  package.json
  docs/
    API.md                API reference
  scripts/
    create-admin.js       creates a user from the command line
    migrate-recruitment.js  one-time change of older recruitment records (npm run migrate:recruitment)
    clean-showcase.js     takes demonstration recruitment data out of a development or showcase database (npm run clean:showcase)
    check-syntax.js       parses every source file (npm run check)
  src/
    server.js             entry point: validate config, connect, listen, shut down cleanly
    app.js                the Express app: headers, CORS, rate limit, parsers, routes, errors
    config/
      env.js              the only place process.env is read; validateEnv()
      constants.js        statuses, recruitment labels, shortlist email states, roles, upload limits, AI comparison limits, cookie name
      permissions.js      the role and permission table
      db.js               MongoDB connection
    routes/
      index.js            /api/health and the three routers
      public.routes.js    public content, public submissions, local file route
      auth.routes.js      login, logout, me, change-password
      admin.routes.js     the admin API, with the permission on each route
    controllers/          request handlers (crudFactory.js builds the shared list/read/create/update/delete)
    validators/           zod schemas: the exact request body of every endpoint
    models/               Mongoose models
    middleware/           auth, CSRF check, rate limiters, uploads, honeypot, validation, errors, request id
    services/
      authService.js      sign-in, sessions, the pause after repeated wrong passwords
      auditService.js     audit log writer
      atsService.js       the rule-based ATS
      aiService.js        the AI comparison (OpenAI): the only file that calls a model
      candidateService.js find or create a candidate, link a candidate (staff), new applications, cascade delete
      shortlistService.js the shortlist action and its email: once per application
      recruitmentMigration.js  what the one-time migration changes on one stored record
      showcaseCleanup.js  what the showcase cleanup removes and what it keeps
      mediaUsage.js       which saved records still use an uploaded image
      settingsService.js  site settings document
      email/              the email service (Resend, log, memory), templates, notifications
      storage/            private files (B2, local, memory) and public media (Cloudinary, local, memory)
    utils/                password hashing, tokens, file type detection, sanitising, logging, query helpers
    seed/                 development seed, its data, and the check of where MONGODB_URI points (target.js)
  tests/                  automated tests (node:test)
```

At run time the development drivers create `backend/.data/` (ignored by git): `.data/private` for documents and `.data/media` for images.

## Local setup

All commands run from the repository root unless a `cd` is shown.

### 1. Install

```bash
cd backend
npm install
```

### 2. Create the environment file

```bash
cp .env.example .env
```

### 3. Set the minimum variables

Two values are needed for local development. Everything else has a working default.

| Variable | What to put |
| --- | --- |
| `MONGODB_URI` | Your connection string (next step). |
| `SESSION_SECRET` | A random string of at least 32 characters. |

Generate a session secret:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Leave the rest as it is in `.env.example`: `FRONTEND_URL=http://localhost:5173`, and the Cloudinary, B2 and Resend values empty. While they are empty the development fallbacks are used: uploaded files go to `backend/.data/` and emails are written to the server log instead of being sent. Filling in a provider's values switches that provider on (see "Connecting the services"). The two OpenAI values can stay empty as well: the AI comparison is then unavailable and nothing else is affected.

### 4. MongoDB Atlas

1. Sign in at MongoDB Atlas and create a project.
2. Create a cluster on the free tier.
3. Under **Database Access**, add a database user with a password. Give it read and write access to the database you will use. Use a long generated password.
4. Under **Network Access**, add the IP address you are connecting from. For local development that is your current IP.
5. Open **Connect**, choose the driver option and copy the connection string.
6. Replace the password placeholder with the database user's password and add a database name before the `?`. If you leave the name out, the driver uses a database called `test`.
7. Put the result in `.env`:

```
MONGODB_URI=mongodb+srv://<db-user>:<db-password>@<your-cluster-host>/<database-name>?retryWrites=true&w=majority
```

If the password contains characters such as `@`, `/` or `:`, URL-encode them.

### 5. Seed the development database

With a MongoDB on this machine (`MONGODB_URI` host `localhost`, `127.0.0.1` or `[::1]`):

```bash
npm run seed
```

With any other MongoDB, which includes every Atlas (`mongodb+srv://`) connection string from step 4, the seed refuses to run until the database is named on the command line. The name must be the same as the database name in `MONGODB_URI`:

```bash
npm run seed -- --database=<database-name>
```

This confirmation is what stops a development `.env` that points at a shared or live cluster from being seeded, or emptied, by accident. A connection string that is not local and has no database name cannot be confirmed, so add the name to `MONGODB_URI` first (step 4).

What it creates:

- Four sample users, one per role: `admin@example.com` (SUPER_ADMIN), `recruiter@example.com` (RECRUITER), `hiring.manager@example.com` (HIRING_MANAGER), `content@example.com` (CONTENT_MANAGER).
- The website content and configuration, exported from what the site already showed: 14 insights (one of them a draft), 3 stories, 8 expertise sectors, 3 services, 3 locations, and the site settings with the public contact details.

What it does not create: any job, or any recruitment record. Jobs, candidates, applications, requirements, referrals, enquiries and ATS results start empty, and no sample resume file is stored. The admin opens on empty lists, and the public site shows no vacancy until a job is created and published in the admin.

The fictional sample jobs and recruitment records are created only when they are asked for:

```bash
npm run seed -- --with-demo-recruitment-data
```

That option is for a throwaway database: an automated end-to-end run, or trying the admin. Never use it on a database that is shown to a client. It adds:

- 10 published jobs.
- Fictional recruitment samples on the reserved `example.com` domain: 8 candidates, 10 applications (each with a rule-based ATS result), 5 requirements, 5 enquiries, 3 referrals. No real person is represented. Of the 10 applications, 6 are `NEW` and 4 are `SHORTLISTED`. The shortlisted samples are marked as shortlisted by `Seed` with the shortlist email `NOT_SENT`: the seed sends no email. Three applications and two candidates carry a label (`INTERVIEWED`, `SELECTED` or `REJECTED`). Candidates have no status.
- With the `local` file driver, a placeholder PDF resume for each sample candidate, so opening a resume can be tried. With B2 no sample file is uploaded.

`npm run clean:showcase` takes such records out of a database again (see "Clean showcase state").

The seed prints a table of record counts, then the sign-in details. **The sign-in details are printed once and are not stored anywhere.** Copy them when they appear. Each account gets its own generated password, unless `SEED_ADMIN_PASSWORD` is set, in which case all four accounts use it. `SEED_ADMIN_EMAIL` changes the email of the admin account.

The seed refuses to run:

- when `NODE_ENV=production`,
- when the required variables are missing or invalid,
- on a database that is not on this machine (any host other than `localhost`, `127.0.0.1` or `[::1]`, or any `mongodb+srv://` connection string), unless `--database=<name>` is passed and matches the database name in `MONGODB_URI`,
- on a database that already has users, unless `--reset` is passed.

To empty the database and seed again:

```bash
npm run seed -- --reset
```

For a database that is not on this machine, pass both options: `npm run seed -- --database=<database-name> --reset`.

`--reset` deletes every document in every collection the application uses, including users, sessions and the audit log. That includes the website content: insights, stories, expertise, services, locations and the site settings are emptied and created again from the seed files, so every edit made in the admin is lost. **Do not run `npm run seed -- --reset` on a database whose content was edited in the admin.** To take demonstration recruitment records out of such a database, use `npm run clean:showcase` (see "Clean showcase state"), which leaves the users and the content as they are. `--reset` does not delete files under `backend/.data/`. The seed is for development only. Once it has run, the database is the source of truth and the seed files are not read again.

### 6. Start the API

```bash
npm run dev
```

The server restarts when a file changes. It listens on `http://localhost:4000`. On start it logs one JSON line, `server.listening`, that shows which driver each service is using (`fileStorage`, `mediaStorage`, `email`) and which integrations are configured (as true or false, never the values). With nothing filled in it reads `"fileStorage":"local","mediaStorage":"local","email":"log"`. Check it with:

```bash
curl http://localhost:4000/api/health
```

If a required variable is missing or invalid, the process logs `config.invalid` lines that name the problem and exits. Two more start-up rules:

- `NODE_ENV` must be `development`, `test` or `production`. Any other value (for example `prod`) stops the process as soon as the configuration is loaded, with an error that names the variable, so a misspelt value never runs with the development safeguards.
- The server refuses to start with `NODE_ENV=test`. That mode switches to in-memory storage and turns the rate limits off, and is for the test suite only.

### 7. Start the frontend

In a second terminal:

```bash
cd frontend && npm install && npm run dev
```

The Vite dev server runs on `http://localhost:5173` and proxies `/api` and `/media` to `http://localhost:4000`. The browser therefore sees one origin, the session cookie is first-party, and no CORS exception is needed. To point the proxy at another address, set `VITE_DEV_API_TARGET` when starting the frontend:

```bash
VITE_DEV_API_TARGET=http://localhost:4100 npm run dev
```

If you open the dev site from another device through your LAN address, add that origin to `FRONTEND_URL` (comma separated), because state-changing requests are checked against it. Do image work on `localhost` while the local media driver is in use: it builds image links from the host you are browsing on, and the content validators accept `http` image links only for `localhost` and `127.0.0.1`. With Cloudinary connected the links are `https` Cloudinary addresses and this does not matter.

### 8. Sign in

Open `http://localhost:5173/admin` and sign in with one of the accounts the seed printed. The lists of jobs, candidates, applications, requirements, referrals, enquiries and ATS results are empty until records are created.

### Upgrading an existing database

This applies only to a database that holds applications or candidates saved by an earlier version of this code. A newly seeded or empty database needs nothing.

The recruitment workflow was reduced. An application is now `NEW` or `SHORTLISTED`, a candidate has no status, and `INTERVIEWED`, `REJECTED` and `SELECTED` are labels (tags, not stages). Records saved before that change still carry the older statuses (`SCREENING`, `INTERVIEW`, `SELECTED`, `REJECTED`, `WITHDRAWN`) until they are migrated. The server still starts with such records. On start it logs a `migration.needed` warning that gives the number of applications with an older status and of candidates that still carry a status, and names the command below. Until the migration has run, an application with an older status cannot be shortlisted: the API refuses it and no email is sent.

```bash
npm run migrate:recruitment              # dry run: prints what would change, changes nothing
npm run migrate:recruitment -- --apply   # makes the changes
```

What `--apply` does (`scripts/migrate-recruitment.js`, `src/services/recruitmentMigration.js`, `LEGACY_STATUS_MAP` in `src/config/constants.js`):

| Stored application status | Becomes |
| --- | --- |
| `NEW`, `SHORTLISTED` | Kept. |
| `SCREENING`, `WITHDRAWN` | `NEW` |
| `REJECTED` | `NEW`, with the label `REJECTED` |
| `INTERVIEW` | `SHORTLISTED`, with the label `INTERVIEWED` |
| `SELECTED` | `SHORTLISTED`, with the label `SELECTED` |
| Any other value | `NEW` |

- A shortlisted application that has no shortlist details gets them, with the email marked `NOT_SENT`. No shortlist email existed before, so none is assumed to have been sent.
- The candidate status is removed. Where it was `INTERVIEW`, `SELECTED` or `REJECTED` it is kept as the matching label (`INTERVIEWED`, `SELECTED`, `REJECTED`).
- It sends no email and deletes no record. A recruiter can send the shortlist email for a migrated application afterwards from the admin (`POST /api/admin/applications/:id/shortlist-email`, see `docs/API.md`).
- It is safe to run twice: a record that is already in the new shape is left alone.

The script checks the environment the same way the server does and connects to `MONGODB_URI`, so run it where those variables point at the database you mean to change. Run the dry run first and read its counts.

A development database can be reseeded instead of migrated: `npm run seed -- --reset` (add `--database=<database-name>` for a database that is not on this machine, as in step 5). That deletes everything in it first.

## Clean showcase state

The showcase state is a database in which jobs, candidates, applications, requirements, referrals, enquiries and ATS results are empty, and the users, the website content and the site settings are as they were. A database seeded with `npm run seed` starts in that state. A database that already exists (seeded by an earlier version of the seed, seeded with `--with-demo-recruitment-data`, or used to try the forms) is brought to it with `npm run clean:showcase` (`scripts/clean-showcase.js`, logic in `src/services/showcaseCleanup.js`).

**Do not run `npm run seed -- --reset` on a database whose content was edited in the admin.** `--reset` empties every collection, the website content included, so those edits are lost. The cleanup command is the way to reach the showcase state on an existing database.

The command checks the environment the same way the server does, connects to `MONGODB_URI` and uses the private file store the environment selects, so run it where those variables point at the database and the store you mean. It refuses to run when `NODE_ENV=production`. Nothing in the running application calls it. Use it in this order:

1. Dry run. It reads and reports, and changes nothing:

   ```bash
   npm run clean:showcase
   ```

   For each of the seven collections it prints the number of records, the records that would be removed and the records that would be kept, each with the reason. Then it prints the number of files of removed records, the number of audit entries about removed records, what the private file store holds compared with what the records point at, and a table of the record counts. The first 8 records of each list are printed. `npm run clean:showcase -- --list` prints every record.

2. Read the "kept" lists. A kept record is one the command does not recognise as demonstration data. Decide for each whether it is real or was typed in as a test. Read the "would be removed" lists as well: a job is recognised by its slug, so a seeded job that was edited in the admin and still has the seed's slug is on that list.

3. Remove the demonstration records, the files they point at and the audit entries about them:

   ```bash
   npm run clean:showcase -- --apply
   ```

4. Only if the kept records are test data as well, remove every record in the seven collections, whoever created it:

   ```bash
   npm run clean:showcase -- --apply --all
   ```

5. Only if the dry run reported stored files that belong to no record, remove those too:

   ```bash
   npm run clean:showcase -- --apply --unreferenced-files
   ```

   `--unreferenced-files` has no effect without `--apply`, and it can be given together with `--all`. "No record" means no record in the database the command is connected to. Do not use it on a bucket or a `backend/.data/private` folder that another database also stores files in: that database's files belong to no record here and would be removed.

6. Run the dry run again (`npm run clean:showcase`) and confirm that the seven collections are at 0 in the table of record counts, that the content collections and the users have the numbers they had before, and that the file store line no longer lists a stored file that belongs to no record. If records were kept on purpose (step 4 was skipped), they are the only ones still listed.

For a database that is not on this machine (any host other than `localhost`, `127.0.0.1` or `[::1]`, or any `mongodb+srv://` connection string), every form with `--apply` also needs `--database=<name>`, and the name must match the database name in `MONGODB_URI`:

```bash
npm run clean:showcase -- --database=<database-name> --apply
```

This is the same guard the seed uses (step 5 of "Local setup"). The dry run needs no confirmation, because it only reads.

Which records count as demonstration data:

- A record the development seed created: a job whose slug is one of the seed's job slugs (`src/seed/data/content.json`), or a candidate, a requirement or an enquiry whose email address, or a referral whose referrer's email address, is one the seed uses for that kind of record (`src/seed/data/recruitment.json`). Capital letters make no difference.
- A candidate, requirement or enquiry whose email address, or a referral whose referrer's email address, is on a domain reserved for examples and tests: `example.com`, `example.org`, `example.net` and their subdomains, and any name that ends in `.test`, `.example`, `.invalid` or `.localhost` (`localhost` itself included). Nobody can own such an address, so it was typed in while trying the forms. An address that only looks similar, such as one at `examplecorp.com` or `example.co.in`, is not recognised.
- What belongs to those: an application whose candidate is removed or no longer exists, and an ATS result whose candidate or whose job is removed or no longer exists.

What is kept unless `--all` is given:

- Every other record. It is treated as possibly real and is kept with its files: a candidate, requirement, enquiry or referral with any other address, a job with any other slug, the applications of a kept candidate, and an ATS result whose candidate and job are both kept.
- A demo job that still has an application from a kept candidate. It is kept and reported with the number of such applications, because that application would otherwise point at nothing.

With `--all`, every record in the seven collections is removed.

Files (a resume on a candidate, an application or a referral, an attachment on a requirement or an enquiry):

- A file is removed from the store when a removed record points at it and no kept record points at the same file. An application carries a reference to the same file as its candidate, so that file stays while either record is kept.
- The files are removed first, then the records, then the audit entries. A file that could not be removed does not stop the rest: it is named in the output with the reason.
- Stored files that no record points at (for example the sample resumes of an earlier seed run that was reset) are counted and listed. They are removed only with `--apply --unreferenced-files`.
- The stores that are compared with the records are the active store and, when B2 is the active store, the local folder `backend/.data/private` of this machine as well. With B2 the comparison lists every key the bucket holds in any version, hidden ones included, which needs the `listFiles` capability.
- A record that points at a file of the earlier provider (marker `r2`) is counted in the report. That file cannot be checked or removed from here.

Audit entries:

- Entries about a job, candidate, application, requirement, referral, enquiry or ATS result that does not exist after the cleanup are removed, because they would keep the names of the removed records on the dashboard. Apart from `npm run seed -- --reset`, which empties the whole collection, this is the only place where audit entries are deleted.
- Entries about anything else (sign-ins, users, content, settings, images) are kept.
- Every run with `--apply` adds one entry, `system.showcase_cleanup`, with the actor name `Showcase cleanup`. Its metadata holds the number of records removed from each collection, the number of files removed and the number of audit entries removed. It names no person.

What is never touched: users, sessions, insights, stories, expertise, services, locations and the site settings. Nothing is created except the one audit entry. After `--apply` the command compares the number of records in the users and content collections with the numbers before, and fails if one of them changed.

Exit status: 0 after a dry run and after an `--apply` run that removed everything it set out to remove. 1 when the command refuses to run or fails (production, an invalid environment, a database that is not named, a database error). 2 after an `--apply` run in which a file could not be removed from the store or the store could not be listed. In that case the records were handled and the store has to be checked by hand. A dry run that cannot list the store says so in its output.

There is no retention or scheduled deletion job. This command removes only what it is asked to, when it is run.

## Environment variables

Every variable in `.env.example`. "Required" means the server refuses to start without it. Example values are placeholders, not working credentials.

| Variable | Purpose | Required | Example format |
| --- | --- | --- | --- |
| `PORT` | Port the server listens on. Default 4000. | No | `4000` |
| `NODE_ENV` | `development`, `production` or `test`. Default `development`. Any other value stops the process at start-up. `test` is for the test suite: the server refuses to start with it. | No (set `production` in production) | `development` |
| `TRUST_PROXY` | The exact number of proxies in front of this API, a whole number from 0 to 5. 0 locally. On Render: 1 when browsers call the Render address directly, 2 when the frontend host forwards `/api` to it. Do not set it higher than the real number: a larger number lets a visitor forge the address. | No (set it on Render; 0 in production logs a warning) | `0` |
| `LOG_LEVEL` | `debug`, `info`, `warn`, `error` or `silent`. Default `info`. | No | `info` |
| `MONGODB_URI` | MongoDB connection string. | Yes | `mongodb+srv://<db-user>:<db-password>@<your-cluster-host>/<database-name>` |
| `FRONTEND_URL` | Origin or origins allowed to call the API, comma separated, no trailing slash, no path. Used for CORS and the origin check. Defaults to `http://localhost:5173` outside production. | Yes in production (must be https) | `https://www.<your-domain>` |
| `SESSION_SECRET` | Key for hashing session tokens and signing development download links. At least 32 characters. | Yes | `<random-string-of-32-or-more-characters>` |
| `SESSION_TTL_HOURS` | Session lifetime in hours. Default 12. | No | `12` |
| `COOKIE_SAMESITE` | `lax`, `strict` or `none`. Default `lax`. | No | `lax` |
| `COOKIE_DOMAIN` | Cookie domain, for an API on a subdomain of the site. | No | `.<your-domain>` |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary cloud name. | To use Cloudinary (all three) | `<your-cloud-name>` |
| `CLOUDINARY_API_KEY` | Cloudinary API key. | To use Cloudinary (all three) | `<your-cloudinary-api-key>` |
| `CLOUDINARY_API_SECRET` | Cloudinary API secret. Server only. | To use Cloudinary (all three) | `<your-cloudinary-api-secret>` |
| `CLOUDINARY_FOLDER` | Folder images are uploaded into. Default `allsemis`. Choose it once: only images inside it are ever removed by the application. | No | `allsemis` |
| `B2_ENDPOINT` | The S3 endpoint of the Backblaze B2 bucket's region, in the form `https://s3.<region>.backblazeb2.com`, with no path. A trailing slash is tolerated. An address with a path, or one that does not start with `https://`, stops the server at start-up. | To use B2 (all four) | `https://s3.<region>.backblazeb2.com` |
| `B2_REGION` | The region of the bucket. Optional when the endpoint names the region. When both are given they must match, or the server stops at start-up. | Only when the endpoint does not name the region | `<region>` |
| `B2_BUCKET_NAME` | Name of the private bucket. | To use B2 (all four) | `<your-private-bucket>` |
| `B2_ACCESS_KEY_ID` | The keyID of the Backblaze application key. | To use B2 (all four) | `<your-b2-key-id>` |
| `B2_SECRET_ACCESS_KEY` | The applicationKey of the Backblaze application key. Server only. | To use B2 (all four) | `<your-b2-application-key>` |
| `SIGNED_URL_TTL_SECONDS` | Lifetime of a signed download link, in seconds. The code default is 120 when the variable is not set, and `.env.example` keeps 120. A longer value such as 900 is accepted. Must be at least 1. A value over 3600 logs a warning. | No | `120` |
| `RESEND_API_KEY` | Resend API key. Server only. | To use Resend (both) | `<your-resend-api-key>` |
| `EMAIL_FROM` | Sender, on a domain verified in Resend. | To use Resend (both) | `ALLSEMIS <no-reply@<your-domain>>` |
| `ADMIN_NOTIFICATION_EMAIL` | Where notifications of new submissions are sent. Without it no admin notification is sent. | No (recommended) | `<team-inbox>@<your-domain>` |
| `FILE_STORAGE_DRIVER` | Optional, normally left out. Private documents: `b2` or `local`. See "Which driver is used". | No | (left out) |
| `MEDIA_STORAGE_DRIVER` | Optional, normally left out. Public images: `cloudinary` or `local`. | No | (left out) |
| `EMAIL_DRIVER` | Optional, normally left out. `resend` or `log`. | No | (left out) |
| `OPENAI_API_KEY` | OpenAI API key for the AI comparison of a candidate with a job. Used only when a recruiter clicks "Compare with AI". The rule-based ATS needs no key. Server only. | To use the AI comparison (both) | `<your-openai-api-key>` |
| `OPENAI_MODEL` | The model the AI comparison calls. The code has no default: without it the AI comparison is unavailable. | To use the AI comparison (both) | `<a-model-name-from-your-openai-account>` |
| `SEED_ADMIN_EMAIL` | Development seed only: email of the sample admin. Default `admin@example.com`. | No | `<you>@example.com` |
| `SEED_ADMIN_PASSWORD` | Development seed only: one password for all four sample accounts. Empty means generate one per account and print it once. Must have at least 12 characters with a letter and a digit. | No | (empty) |

Notes:

- When `NODE_ENV=test`, the in-memory drivers are always used, whatever `.env` says, and `src/server.js` refuses to start. The tests import the app directly.
- `TRUST_PROXY` outside 0 to 5 is a start-up failure. `TRUST_PROXY=0` with `NODE_ENV=production` is a `config.warning`: behind a hosting proxy every visitor then appears to come from the proxy address, so the rate limits are shared by everyone.
- `OPENAI_API_KEY` and `OPENAI_MODEL` never stop the server from starting. With one of the two set and the other empty the server logs a `config.warning`, and the AI comparison stays unavailable until both are set.
- Two more variables are read outside `.env.example`: `ADMIN_PASSWORD` (optional, by `npm run create-admin`) and `RATE_LIMIT_IN_TESTS` (by the tests).
- The `R2_*` variables of the earlier provider (`R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_PUBLIC_URL`) are no longer read. If one of them is still set, the server logs a `config.warning` at start-up saying that the lines can be removed.

### Which driver is used

Each of the three services has a real provider and a development fallback:

| Service | Real provider | Used when | Development fallback |
| --- | --- | --- | --- |
| Private documents | Backblaze B2 (`b2`) | `B2_ENDPOINT`, `B2_BUCKET_NAME`, `B2_ACCESS_KEY_ID` and `B2_SECRET_ACCESS_KEY` are all set, and the region is known from `B2_REGION` or from the endpoint | `local`: files under `backend/.data/private` |
| Public images | Cloudinary (`cloudinary`) | `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY` and `CLOUDINARY_API_SECRET` are all set | `local`: files under `backend/.data/media` |
| Email | Resend (`resend`) | `RESEND_API_KEY` and `EMAIL_FROM` are both set | `log`: the message is written to the server log, not sent |

The rule (`resolveDriver` in `src/config/env.js`): **the credentials decide.** When a provider's values are all set, that provider is used. Otherwise the fallback is used. Nothing else has to be switched.

- The three `*_DRIVER` variables are optional and are normally left out.
- Setting one to the provider name (`b2`, `cloudinary`, `resend`) forces that provider even when its credentials are incomplete. The server starts, logs a `config.warning`, and the feature answers with a clear error (`STORAGE_NOT_CONFIGURED`, `MEDIA_NOT_CONFIGURED`) or, for email, logs that nothing was sent. It does not quietly use the fallback.
- Setting one to `local` or `log` does not block a provider whose credentials are complete. Earlier versions of `.env.example` contained `FILE_STORAGE_DRIVER=local`, `MEDIA_STORAGE_DRIVER=local` and `EMAIL_DRIVER=log`, so an existing `.env` usually still has those lines. With the credentials filled in the provider is used anyway, and a `config.warning` at start-up says the line is ignored and can be removed.
- There is no switch that keeps the fallback while the credentials are complete. To use the fallback for a while, empty one of the provider's values or comment its line out (for example `# B2_BUCKET_NAME=...`), and restart.
- `FILE_STORAGE_DRIVER=r2` is a value of the earlier provider. It is treated as not set, so it does not stop the server, and a `config.warning` at start-up says the line can be removed. Any other unknown value stops the process.
- In production nothing falls back by itself. With no credentials the provider is still selected and reported as not configured. `local` storage asked for by name stops the server at start-up. `EMAIL_DRIVER=log` without Resend credentials is accepted with a warning: no email is sent.
- `NODE_ENV=test` always uses the in-memory drivers.
- The AI comparison is not one of these three services. It has no driver and no fallback: it is available when `OPENAI_API_KEY` and `OPENAI_MODEL` are both set, and unavailable otherwise.

## Connecting the services

Each service is connected the same way: put its values in the backend's environment (`backend/.env` locally, the host's environment settings in production), restart the server, and read the `server.listening` line it logs. Nothing in the frontend changes, and no frontend variable is involved.

**Secrets stay on the server.** The Cloudinary API secret, the B2 application key, the Resend key and the OpenAI key are read by the backend only. Never put any of them in the frontend, in a `VITE_` variable (every `VITE_` variable is compiled into the public site), in git, or in a message or ticket. No API response contains them: `GET /api/admin/settings` reports true or false for each service and, for the AI comparison, the model name and one sentence. It never holds a key.

### Cloudinary (public website images)

Variables:

```
CLOUDINARY_CLOUD_NAME=<your-cloud-name>
CLOUDINARY_API_KEY=<your-cloudinary-api-key>
CLOUDINARY_API_SECRET=<your-cloudinary-api-secret>
CLOUDINARY_FOLDER=allsemis
```

Where the values come from: create a Cloudinary account. Its console shows the cloud name of your product environment, and an API key with its API secret. `CLOUDINARY_FOLDER` is a name you choose.

How it is used: admin, then backend, then Cloudinary, then the Cloudinary address into MongoDB, then the public API, then the website. The server uploads each image with a signed request, so the secret never reaches the browser and no upload preset is needed. Only image metadata is stored in MongoDB: `{ url, publicId, width, height, format, alt }`. The delete endpoint only accepts image ids inside `CLOUDINARY_FOLDER`, and answers 409 while a saved insight, story or expertise record still uses the image.

Check after starting the server:

1. The `server.listening` line shows `"mediaStorage":"cloudinary"` and `"cloudinaryConfigured":true`.
2. In the admin, open an insight, a story or a sector, upload one image and save. The address shown under the image starts with `https://res.cloudinary.com/<your-cloud-name>/`.
3. Open the public page that shows the record. The image loads from that address.
4. In the Cloudinary media library, the image is inside the folder named by `CLOUDINARY_FOLDER`, and the `publicId` saved on the record starts with that folder name followed by `/`. If it does not, the image still shows, but the application will not remove it from Cloudinary when the record is deleted or the image replaced (the server logs `media.id_outside_folder` when this happens).

Notes:

- **Existing images keep working.** An image that is a link to another website (the seeded pictures) has no `publicId`. It is shown as it is and is never uploaded, moved or deleted.
- An image uploaded on a development machine before Cloudinary was connected has an address under `/media/` and an id of the form `local-<uuid>`. Outside production the API keeps serving `backend/.data/media`, so it still shows on that machine, and replacing it or deleting its record removes the local file. It is **not** copied to Cloudinary. To move it, upload the image again in the admin.
- In production `/media` is not served at all. A record whose image address points at a development machine has to be given a new image.
- Do not change `CLOUDINARY_FOLDER` after images have been uploaded. Images in the old folder keep showing, but the application no longer removes them.
- A refused or failed upload answers 502 `MEDIA_UPLOAD_FAILED` and the reason Cloudinary gave is in the server log (`media.cloudinary_failed`).

### Backblaze B2 (private documents)

Private documents are stored in a Backblaze B2 bucket through B2's S3-compatible API, with the AWS SDK that is already in `package.json` (`@aws-sdk/client-s3` and `@aws-sdk/s3-request-presigner`). Cloudflare R2 was the earlier provider. The `R2_*` variables are no longer read.

Variables:

```
B2_ENDPOINT=https://s3.<region>.backblazeb2.com
B2_REGION=<region>
B2_BUCKET_NAME=<your-private-bucket>
B2_ACCESS_KEY_ID=<your-b2-key-id>
B2_SECRET_ACCESS_KEY=<your-b2-application-key>
SIGNED_URL_TTL_SECONDS=120
```

Where the values come from:

1. In Backblaze, create a bucket. Its name is `B2_BUCKET_NAME`.
2. **Keep the bucket private.** The bucket type must be Private ("Files in bucket are: Private"). Resumes must never have a public address.
3. `B2_ENDPOINT` is the bucket's "Endpoint" shown on the Buckets page, as a full address that starts with `https://` and has no path: `https://s3.<region>.backblazeb2.com`. A trailing slash is tolerated. `B2_REGION` is the `<region>` part of that address. It can be left empty when the endpoint has this form. When both are given they must match, or the server stops at start-up.
4. Create an application key for that bucket with read and write access. Its keyID is `B2_ACCESS_KEY_ID` and its applicationKey is `B2_SECRET_ACCESS_KEY`. The key needs these capabilities on the bucket: `readFiles`, `writeFiles`, `deleteFiles` and `listFiles`. `listFiles` is what lets the versions of a file be found when it is deleted (see "Deletion" below).
5. `SIGNED_URL_TTL_SECONDS` is the lifetime of a signed link in seconds. The code default is 120 when the variable is not set, and `.env.example` keeps 120. A longer value such as 900 is accepted. A value over 3600 logs a warning.

How it is used: resumes, requirement attachments and enquiry attachments are stored under random keys. Staff open a document through a permission-checked endpoint that writes an audit entry and returns a presigned GET link valid for `SIGNED_URL_TTL_SECONDS`. MongoDB stores the key, descriptive metadata and the name of the store that holds the file, never the file itself. The browser never receives a B2 credential, the key or a permanent address.

The driver (`src/services/storage/drivers/b2.js`) takes the endpoint and the region from the environment, puts the bucket name in the path of the address (`forcePathStyle`), sends checksum headers only when an operation requires them, and sends no ACL or other option that could make an object public when it uploads.

The upload rules are the same for every store and are enforced on the server before anything is stored: PDF, DOC or DOCX, decided from the file's bytes, at most 5 MB, one file per request.

Deletion: a B2 bucket keeps versions, and an S3 delete without a version id only hides the file. The driver therefore lists the versions of the key and deletes each one by its version id, including an earlier hide marker. When the bucket lists no version of the key (the file is already gone), nothing more is sent: a delete without a version id would only add a hide marker for a file that is not there. If the application key cannot list versions, the file is hidden, the action does not fail, and the server log has `storage.b2_hidden_not_deleted`: the bytes are then still in the bucket. A file is deleted when its record is deleted (a candidate with its applications, a requirement, a referral, an enquiry), or by the showcase cleanup command (see "Clean showcase state"). That command also lists the bucket, to compare it with the records: every key in any version, hidden ones included. There is no retention or scheduled deletion job.

Check after starting the server, on the first real run:

1. The `server.listening` line shows `"fileStorage":"b2"` and `"b2Configured":true`.
2. Send one application with a resume through the public form. In Backblaze the bucket now holds one file under `resumes/<year>/<month>/` (an attachment sent with the Hire Talent form goes under `requirements/...`).
3. In the admin, "Open resume" opens that resume. The address is on the `B2_ENDPOINT` host, with the bucket name in the path, and carries a signature and an expiry.
4. Wait longer than `SIGNED_URL_TTL_SECONDS` and reload that address: it is refused. Opening the file's plain address without the signature is refused too.
5. Delete the test candidate in the admin. No version of the file is left in the bucket. Look with "show versions" or the equivalent view, because a file that is only hidden does not appear in the normal listing.
6. The bucket type is Private.

If `B2_ENDPOINT` or `B2_REGION` is wrong for the bucket, signed links are refused with a signature error.

Recommended in Backblaze (operational notes, not checked by the code):

- Restrict the application key to this one bucket.
- Keep the bucket type Private.
- Optionally, as defence in depth, add a lifecycle rule that keeps only the last version of a file. It is not required: the driver deletes every version itself.

Notes:

- **Files stored before B2 was connected are not copied to B2.** A resume saved on a development machine stays in `backend/.data/private` on that machine. Outside production it keeps opening from there: each stored file records which store holds it, and a record from before that marker existed is looked for on the local disk first. In production the local disk is never read: a record marked as stored on a development machine answers 404 with a message that the document is held in a store this server does not use, and an older record without the marker gets a link that B2 refuses, because the object was never there. If real documents were collected on a development machine, they have to be submitted again once B2 is connected.
- For the same reason, do not point a development machine without B2 credentials at a database that production uses: the documents it stores would exist only on that machine.
- **Nothing is migrated from R2.** The marker on a stored file is `b2`, `local` or `memory`. A record written while R2 was the provider carries the marker `r2`, which the schema still accepts only so that such a record still saves. Its file is reported as not available (404) and is never looked for in B2. No code copies objects from R2, or from the local disk, to B2.
- Removing the B2 values later does not move files back. Records stored in B2 then answer 503 `STORAGE_NOT_CONFIGURED` until the values are set again.
- `GET /api/files/local/:token` serves the development copies only. It is not a way into B2, and in production it always answers 404.

### Resend (email)

Variables:

```
RESEND_API_KEY=<your-resend-api-key>
EMAIL_FROM=ALLSEMIS <no-reply@<your-domain>>
ADMIN_NOTIFICATION_EMAIL=<team-inbox>@<your-domain>
```

Where the values come from:

1. Create a Resend account.
2. Add your sending domain and verify it by creating the DNS records Resend shows you. **`EMAIL_FROM` must be an address on that verified domain.** Mail from an unverified domain is refused, and the server then logs `email.failed` with the reason Resend gave.
3. Create an API key in the Resend dashboard. A key that can only send is enough.
4. `ADMIN_NOTIFICATION_EMAIL` is the team inbox that should receive the notifications.

Resend is used as soon as `RESEND_API_KEY` and `EMAIL_FROM` are both set. Until then the `log` driver writes each message's template, recipient and subject to the server log and sends nothing.

What is sent:

| Event | Template | To | Reply-to |
| --- | --- | --- | --- |
| Hire Talent requirement submitted | `newRequirementAdmin` | `ADMIN_NOTIFICATION_EMAIL` | The employer who submitted |
| Candidate application submitted | `newApplicationAdmin` | `ADMIN_NOTIFICATION_EMAIL` | The candidate |
| General enquiry submitted | `newEnquiryAdmin` | `ADMIN_NOTIFICATION_EMAIL` | The sender |
| Referral submitted | `newReferralAdmin` | `ADMIN_NOTIFICATION_EMAIL` | The referrer |
| A recruiter shortlists an application | `shortlistNotification` | The candidate | None |

Each of the four submissions also sends a fixed-wording confirmation to the person who submitted (`requirementConfirmation`, `applicationConfirmation`, `enquiryConfirmation`, `referralConfirmation`). Adding or removing a label (`INTERVIEWED`, `REJECTED`, `SELECTED`) sends nothing.

A confirmation repeats nothing the visitor typed (no name, subject, role or message), and the only variable is a job title, which staff write. One address receives at most 3 confirmations per hour (counted in memory, per server instance). Over that number the submission is still saved and the team notification is still sent. A failed email is logged and never fails the submission.

The shortlist email (`shortlistNotification`) is fixed wording too, with the staff-written job title as its only variable, and it is sent at most once per application. It is a staff action, so the cap of 3 per hour does not apply to it. The result is reported to the recruiter. With the `log` driver (`LOGGED`), with Resend credentials missing (`NOT_CONFIGURED`) or after a failure (`FAILED`) the application is still shortlisted and the email can be sent later from the admin.

Check after starting the server:

1. The `server.listening` line shows `"email":"resend"` and `"resendConfigured":true`, and there is no `config.warning` about `ADMIN_NOTIFICATION_EMAIL`.
2. Send one enquiry through the public Contact form, using an address you can read. The team inbox receives the notification, and pressing reply addresses the person who wrote. That person receives the confirmation.
3. The server log shows `email.sent` twice, each with a message id that can be found in the Resend dashboard. `email.failed` means Resend refused: the line carries its reason.
4. Shortlist one test application: the candidate address receives one email, and the admin shows the email as sent.

Notes:

- Applications shortlisted while email was in `log` mode were not emailed. Each can be sent afterwards with "Send shortlist email" in the admin.
- The shortlist email and the application confirmation ask the reader to reply if they did not apply, and the shortlist email has no reply-to. A reply therefore goes to the `EMAIL_FROM` address, so use an address that someone reads, or one that forwards.
- The API key is sent to Resend in the `Authorization` header only. It is never logged and never returned.

### OpenAI (the AI comparison)

Variables:

```
OPENAI_API_KEY=<your-openai-api-key>
OPENAI_MODEL=<a-model-name-from-your-openai-account>
```

Where the values come from:

1. Create an API key in your OpenAI account. Every comparison is a request OpenAI charges for.
2. `OPENAI_MODEL` is the name of the model to call, written exactly as OpenAI lists it for your account. **The code has no default model.** The request asks for structured output with a strict JSON schema, so the model has to be one that supports that.

Both values are needed. With either one empty the AI comparison is unavailable, and one set without the other logs a `config.warning` at start-up. Unlike the three services above there is no fallback and no driver: OpenAI is optional, and everything else works without it.

How it is used: a recruiter opens an ATS result in the admin and clicks "Compare with AI". The browser calls this API (`POST /api/admin/ats-results/:id/ai-comparison`, permission `ats:run`). The server sends one request to OpenAI's chat completions endpoint with the job and the candidate's stated profile, waits up to 60 seconds, validates the answer, stores it on the ATS result as `aiComparison`, writes the audit entry `ats.ai_compared` and returns the result. There is no retry. Running it again replaces the stored comparison.

What it never does: it is never called when a page loads, by the rule-based evaluation, by shortlisting or by a label. It never changes an application's status, never shortlists and never sends an email. Shortlisting is still the only workflow action, and the recruiter decides.

What is sent, in short (`docs/API.md`, section 9.6, has the full list and the size limits):

- Sent: the job's title, category, department, location, type, level, summary, description, responsibilities and skills, and the candidate's current role, domain, years of experience, skills, summary, cover note, work history and education (without the year).
- Never sent: the candidate's name, email, phone and profile link, the resume file or anything read from it, notes, labels, the notice period and the expected compensation.
- Email addresses, links, phone numbers and the candidate's own name are also removed from the text the candidate typed, as far as a pattern can find them. A single part of the name is removed only where it is written with a capital first letter.
- The candidate's location is sent only when the job is tied to a place, and then without house numbers or postal codes.
- What a candidate typed is sent as data inside a marked block, and the instructions tell the model to treat it as data. The answer can only fill ten fixed fields and is validated on the server before it is stored.

Check after starting the server:

1. The `server.listening` line shows `"openaiConfigured":true`, and there is no `config.warning` that names `OPENAI_API_KEY` or `OPENAI_MODEL`.
2. In the admin, Settings, AI and ATS shows the AI comparison as Enabled, OpenAI as Connected, the model name, and the API key as Set. This says that the two values are set. It does not say that OpenAI accepts them: the server does not contact OpenAI to show this screen.
3. Open the ATS result of a test application and click "Compare with AI" once. Use a made-up profile for this first run, not a real person's. It can take up to a minute. The "AI comparison" panel then shows the result, and the button reads "Compare again".
4. Read the line under the comparison. "Model:" shows the model name OpenAI reported for the answer, which can be a dated version of the name in `OPENAI_MODEL`. The same name is stored as `aiComparison.model` and in the metadata of the `ats.ai_compared` audit entry.
5. Read the server log for that request. It holds the usual `http.request` line (method, path, status 200, duration, user id) and nothing of the comparison itself: no prompt, no candidate text, no answer and no key. After a failure there is one `ai.request_failed` or `ai.invalid_response` line with a status and a short error identifier.
6. Check that nothing else changed: the application has the status it had, the rule-based score is the same, and no email was sent.

Notes:

- **The real OpenAI API was never called where this code was written.** There was no network access and no key. Every automated test answers `api.openai.com` with a stand-in, so the first real comparison is the first time OpenAI sees this request.
- **Whether the configured model accepts strict structured output with this schema is untested.** If it does not, OpenAI answers with an error, the admin shows the 502 `AI_FAILED` sentence, and the `ai.request_failed` log line carries the status OpenAI returned.
- **The quality of the analysis is unproven.** The answer is a model's opinion and can be wrong. Read the first comparisons against the profile and the job before anyone relies on them.
- **The resume file is not read.** The comparison uses the profile the candidate typed and the cover note. No resume text extraction exists in this code.
- **There is no cap on output tokens.** The request sets no limit on the length of the answer. What bounds it is the schema, the 60 second time limit, and the rate limit of 20 requests per 10 minutes per signed-in user.
- **A comparison can take up to a minute.** A proxy in front of the API (the frontend host's `/api` rewrite, the backend host's own) must allow a request to stay open that long. The server does not stop a comparison when the browser's connection ends, so a comparison that outlasted a proxy may still be stored and show after a reload.
- The rate limit, and the guard that refuses a second comparison for the same result while one is running (409 `AI_IN_PROGRESS`), are kept in memory per server process.
- **Sending candidate profile data to OpenAI is a decision for ALLSEMIS**, and it belongs in the privacy notice. Until that is decided, leave the two values empty.
- Emptying either value switches the AI comparison off again. Comparisons already stored stay on their ATS results and can still be read.
- The API key is sent to OpenAI in the `Authorization` header only. It is never logged and never returned. OpenAI's error messages are not read, because they can repeat part of the key.

## Creating the first production user

The development seed does not run in production. The first account is created from the command line with `scripts/create-admin.js`:

```bash
npm run create-admin -- --email you@<your-domain> --name "Your Name"
```

What the script does:

- Checks the environment the same way the server does, connects to `MONGODB_URI`, and refuses if a user with that email already exists.
- `--role` is optional and defaults to `SUPER_ADMIN`. The other values are `RECRUITER`, `HIRING_MANAGER` and `CONTENT_MANAGER`.
- If `--email` or `--name` is missing it asks for it.
- Password: if the `ADMIN_PASSWORD` environment variable is set, it is used (it must have at least 12 characters with a letter and a digit). Otherwise the script generates a password, prints it once, and sets the account's `mustChangePassword` flag. While the flag is set the account can sign in, read its own profile and change its password, and every route under `/api/admin` answers 403 `PASSWORD_CHANGE_REQUIRED`. The admin shows the change-password screen after sign-in.

```bash
npm run create-admin -- --email recruiter@<your-domain> --name "A Recruiter" --role RECRUITER
```

Run it where the production variables are available: in a shell on the hosted service if your plan provides one, or on your own machine with a `.env` whose `MONGODB_URI` points at the production database (Atlas network access must allow your address). The script needs `MONGODB_URI`, `SESSION_SECRET` and a valid `FRONTEND_URL` to pass the environment check. After the first super admin exists, create other users through user management (`POST /api/admin/users`, see `docs/API.md`). That endpoint takes no password: the server generates a temporary one and returns it once. `POST /api/admin/users/:id/reset-password` does the same for an existing user.

## Scripts

| Command | What it does |
| --- | --- |
| `npm start` | Starts the server (`node src/server.js`). Used in production. |
| `npm run dev` | Starts the server and restarts it on file changes (`node --watch`). |
| `npm run seed` | Fills an empty development database with the users and the website content and configuration. It creates no job and no recruitment record. `npm run seed -- --with-demo-recruitment-data` also adds the fictional sample jobs and recruitment records, for a throwaway database only. `npm run seed -- --reset` empties every collection first, the website content included. A database that is not on this machine also needs `--database=<name>`. Refuses to run in production. |
| `npm run create-admin` | Creates a user from the command line. Pass options after `--`. |
| `npm run migrate:recruitment` | One-time migration of recruitment records saved by an earlier version: older application statuses become `NEW` or `SHORTLISTED` plus a label, and the candidate status is removed. Without options it is a dry run that changes nothing. `npm run migrate:recruitment -- --apply` makes the changes. Sends no email, deletes no record, safe to run twice. See "Upgrading an existing database". |
| `npm run clean:showcase` | Takes demonstration recruitment data out of an existing development or showcase database. Without options it is a dry run that changes nothing. `npm run clean:showcase -- --apply` removes the demonstration records, the files they point at and the audit entries about them. With `--apply`, `--all` removes every record in the seven recruitment collections and `--unreferenced-files` also removes stored files that no record points at. `--list` prints every record. With `--apply`, a database that is not on this machine also needs `--database=<name>`. Never touches users or website content. Refuses to run in production. See "Clean showcase state". |
| `npm test` | Runs the automated tests in `tests/` (`node --test --test-concurrency=1 tests/unit.test.js tests/auth.test.js tests/forms.test.js tests/admin.test.js tests/providers.test.js tests/showcase.test.js`). |
| `npm run check` | Parses every `.js` file in `src`, `scripts` and `tests` with `node --check`. Needs no database. |

## Tests

```bash
npm install
npm test
```

The suite starts the real Express app on a free port against an in-memory MongoDB (`mongodb-memory-server`), with the in-memory storage and email drivers. It needs no Atlas, Cloudinary, Backblaze B2, Resend or OpenAI account. It does need the real npm packages installed, and `mongodb-memory-server` downloads a MongoDB binary the first time it runs, so the first run needs network access and takes longer.

One file is different. `providers.test.js` runs as a development server with made-up credentials filled in, which is the case the other files never see. It replaces `fetch` with a stand-in that records each request, and hands the B2 driver a stand-in for the AWS SDK, so it shows what this code sends to Resend, Cloudinary and Backblaze B2 and how it reads their answers. **It does not contact any of them, and it does not load the AWS SDK.** Whether the real services accept those requests is only shown by one real run of each (the checks under "Connecting the services"). It sets every variable itself, so a `.env` on the machine does not change what it tests. It writes a few small sample files under `backend/.data/` and removes them again.

The AI comparison tests in `admin.test.js` work the same way for OpenAI. Each one replaces `fetch` so that a request to `https://api.openai.com/` is recorded and answered by a stand-in, while every other request goes to the real `fetch`. The key and the model name are made-up values set in `tests/helpers.js`. **No request reaches OpenAI.** The tests show what this code sends and how it treats an answer. They do not show that OpenAI accepts the request, that the configured model supports the schema, or that the analysis is any good. The full list of what has not been shown is in the notes under "OpenAI (the AI comparison)" in "Connecting the services".

The `test` script in `package.json` is `node --test --test-concurrency=1 tests/unit.test.js tests/auth.test.js tests/forms.test.js tests/admin.test.js tests/providers.test.js tests/showcase.test.js`. The six files are named one by one, so the command does not depend on the shell expanding a pattern and runs the same way on Windows, macOS and Linux. There are 114 tests in six files: 20 in `unit.test.js`, 14 in `auth.test.js`, 17 in `forms.test.js`, 35 in `admin.test.js`, 22 in `providers.test.js` and 6 in `showcase.test.js`.

The tests have to be run locally. Nothing in this repository proves they pass on your machine until you run them. In the environment where this code was written the npm registry was unreachable, so the tests were run against local stand-ins for express, mongoose and the other packages, not the real packages. They must be run with the real dependencies (`npm install && npm test`) before deployment.

What the tests cover:

- **`unit.test.js`**: scrypt hashing and verification; the password rule; file type detection from bytes (a renamed executable, a wrong extension and a plain zip are refused, a DOCX and a DOC with the right structure are accepted); a file that only imitates a document is refused (a PDF header with no end marker or no version, entry names that are not in the zip index, another Office format, a truncated DOCX, the `WordDocument` name as loose text); text cleaning stays fast on hostile input and over-long text is refused before it is cleaned; a service link can only be a path on the site; a misspelt `NODE_ENV` stops the process; the seed's check of whether a connection string is on this machine; image dimensions read from the header; text cleaning and HTML escaping in email templates; confirmation emails repeat nothing a visitor typed; the rule-based ATS with a worked example and a determinism check; the role and permission table; signed download tokens (expiry and tampering); the recruitment migration (each older status becomes `NEW` or `SHORTLISTED` plus a label, a shortlisted record gets its email marked `NOT_SENT`, and a record already in the new shape is left alone); the shortlist email is fixed wording with the job title as its only variable; `applications:shortlist` is held by SUPER_ADMIN and RECRUITER only; the JSON of a candidate, application, referral, requirement or enquiry never contains a file's storage key or the name of the store that holds it, and a store name that is not known is refused.
- **`auth.test.js`**: health check; sign-in (wrong password, unknown email, HttpOnly SameSite cookie, no credential in the response); session token stored only as a hash; sign-out ends the session on the server; admin routes refuse unauthenticated calls; roles enforced on the server; publishing needs the publish permission; the `X-Requested-With` and origin checks; CORS allow-list; security headers and no stack traces; query operator injection; user management (the server generates the temporary password and ignores one sent by the caller, a temporary password opens nothing until it is changed, change-password refuses a wrong current password, a weak one and one equal to the current one, reset-password, no password through the edit route, no reset of your own account, session revocation, audit entries); repeated wrong passwords pause sign-in with the same answer a wrong password or an unknown email gets; sign-in rate limit.
- **`forms.test.js`**: each public form saves a record and sends both emails (the team notification goes to `ADMIN_NOTIFICATION_EMAIL` with the sender as reply-to, the confirmation goes to the sender, and a referral does not email the referred person); validation errors with field details; visitors cannot set internal fields and markup is removed; an applicant cannot shortlist or label their own application (a `status`, `labels` or `shortlist` value sent through the form is dropped, and no shortlist email is sent); honeypot; posts from other origins refused; requirement attachment stored under a random key, with the store that holds it kept on the record; an application creates the candidate, the application and an ATS result; a second application from the same email creates no second candidate; a public submission never changes or removes what is already stored for that email (profile, skills, resume, earlier application, existing ATS result) and becomes its own application with the submitted details; one address receives at most 3 confirmation emails while every submission is saved and the team is notified; applications to draft, unknown or closed jobs refused; upload validation (required file, type by content, extension match, size limit, wrong field); referral consent; public endpoints return only published content and no recruitment data; form rate limit; staff can read saved submissions without the storage key or the store name.
- **`admin.test.js`**: jobs (create, edit, publish, unpublish, archive, delete, slug handling, filters, audit entries); insights (drafts stay private, publishing audited, unsafe image links refused); a network location never keeps office details; image upload metadata and refusal of SVG and non-images; media removal (an id that is not this application's own is refused, an image a saved record uses is refused with 409, an image two records share is kept until the last one is deleted); private resumes (401 without a session, 403 without permission, no key in responses, a working short-lived link, a tampered link fails, access audited); labels on applications and candidates (stored once each in a fixed order, unknown labels refused, a `status` sent in an edit dropped, the `label` filter, audit entries, and no status change, email or ATS run), candidate notes and search; the shortlist action (permission and request header checked on the server, status, who and when, one email of fixed wording, audit entries, a second call and a request to send the email again both answer 409); five shortlist calls at the same moment give one shortlist and one email; the shortlist email sent later for an application whose email was not accepted, and refused when the application is not shortlisted, when the email was already sent or while an attempt is in progress; ATS run, re-run and review, which shortlist nothing and run no AI comparison; the AI comparison, in 13 tests against a stand-in for OpenAI (one request to the chat completions endpoint, with the key in the `Authorization` header, the model from `OPENAI_MODEL`, a strict JSON schema and no other option; the validated answer is stored, returned and audited without its text; a second run replaces it and a rule-based re-run keeps it; only job-relevant data is sent, without the name, email, phone, links, notes, labels, notice period, compensation or anything of the resume file; the location is sent only for a job tied to a place, without a house number or postal code; long text is cut before it is sent; reading, listing, running the rules, reviewing, labelling, shortlisting and a new public application send nothing to OpenAI; a comparison changes no application, candidate or rule-based field and sends no email; an answer that fails validation, a refusal and a cut-off answer give 502 `AI_INVALID_RESPONSE` and store nothing; a valid answer is cleaned and capped; a provider error, a network failure and a timeout give 502 `AI_FAILED` without the key or the provider's text, and are not retried; a missing key or model gives 503 `AI_NOT_CONFIGURED` and OpenAI is not called; access is checked exactly as on the neighbouring routes; instructions typed by a candidate stay inside the data block and change nothing; a second request for the same result while one is running answers 409; a result deleted while the comparison runs is not recreated; the limit of 20 requests per signed-in user); referral status, notes, resume link and conversion; a referral's missing candidate email can be added, an existing candidate keeps their own fields and resume on conversion, and deleting the referral removes only its own file; the candidate page returns reduced history entries; candidate cascade delete including the stored file; a job with applications cannot be deleted (409) and a malformed URL is a 400; a repeat application keeps the earlier one and its resume, and the newer resume and submitted details are read through the new application; contact settings and that settings expose no credential; the audit log is read-only and restricted. Public stories and public insights follow the admin (publish, edit, order, unpublish and delete are public at the next request; drafts are never listed or opened by address; only public fields are returned; responses must be revalidated).
- **`providers.test.js`** (no provider is contacted, see above):
  - Driver selection: `resolveDriver` for every combination of environment, driver variable and credentials; the configuration as the server loads it in development, production and test (nothing filled in gives the fallbacks; an `.env` with the earlier template lines plus credentials gives the real providers and a warning per ignored line; one missing credential gives the fallback; a provider named explicitly is forced; an unknown driver name stops the process; production never selects a fallback by itself and refuses local storage); the Backblaze B2 settings (without any B2 value the server starts on the local fallback; `B2_REGION` may be left out when the endpoint names the region; each of the other four values is needed; a trailing slash on the endpoint is accepted; an endpoint with a path or on plain `http`, and a region that disagrees with the endpoint, are problems named at start-up; `FILE_STORAGE_DRIVER=r2` and `R2_*` variables left in an `.env` do not stop the server, are not used and are reported); the AI comparison counts as configured only with both the key and the model; `SIGNED_URL_TTL_SECONDS` below 1 is refused and a value over one hour gives a warning; the start-up configuration and its warnings contain no secret.
  - Resend: the address, method, `Authorization` header and JSON body of the request (`from`, `to`, `subject`, `html`, `text`, `reply_to`, and no `reply_to` when there is none); a refusal, an answer that is not JSON and a network failure make `send()` return `{ sent: false }` without throwing; the five workflows (four team notifications with the sender as reply-to, their confirmations, and the shortlist email to the candidate) as they reach Resend; the key is in no log line and no returned value.
  - Cloudinary: the upload goes to the configured cloud name with `api_key`, `timestamp`, `folder`, the image and a signature that the test works out again on its own, and never the secret; the result is reduced to `{ url, publicId, width, height, format }`; a refusal, a network failure and an answer with no address are all 502 `MEDIA_UPLOAD_FAILED`; only ids directly inside the configured folder are removed, with a signed destroy request, and anything else causes no request; an image uploaded locally before Cloudinary was connected is still served at `/media`, is removed from the local folder and causes no Cloudinary request.
  - Private documents: the store is written on the record when a file is stored; a file marked `local` is served through a signed local link while B2 is the active store, with the right headers, and an altered link or the bare key fails; a record from before the marker is found on the local disk, or else in the active store; a marker wins over what is on the disk; a key that tries to leave the storage folder is not found; a record of the earlier provider (marker `r2`) answers 404 and B2 is not asked about it; production never looks at the local disk, and a production server answers 404 to a validly signed local link and to `/media` where a development server answers 200.
  - The B2 driver, against a stand-in for the AWS SDK: one client on the endpoint and region from the environment with `forcePathStyle` and checksums only when required, the credentials, the bucket, key and content type of an upload (and no option that could make an object public), a presigned GET with `expiresIn` equal to `SIGNED_URL_TTL_SECONDS`, PDFs inline and Word files as attachments, a file name that cannot break out of the header, the listing (every key the bucket holds in any version, hidden ones included, read page by page), and the delete: every version of the key is deleted by its version id, an earlier hide marker included, another file whose key starts with the same text is left alone, when the bucket lists no version of the key nothing is sent after the versions were asked for, and when the versions cannot be listed the file is hidden, nothing is thrown and `storage.b2_hidden_not_deleted` is logged.
- **`showcase.test.js`** (the seed and the showcase cleanup, with the files in the in-memory store): the seed creates the four users and the website content (14 insights, 3 stories, 8 expertise sectors, 3 services, 3 locations, the site settings) and no job or recruitment record, stores no sample resume, the public site shows its content and no vacancy, and the seeded administrator signs in and finds the seven recruitment lists empty; the demonstration records (10 jobs, 8 candidates, 10 applications, 5 requirements, 3 referrals, 5 enquiries, 10 ATS results and one sample resume per sample candidate) are created only when they are asked for; an address on a domain reserved for examples and tests is recognised, and an address that only looks similar is not; a dry run of the cleanup decides record by record (the seed's records and the records typed in with an example address would be removed, a candidate with an address of their own is kept with their application and files, the demo job that candidate applied to is kept with the reason, a job added in the admin is kept) and changes no record, no file and no audit entry; applying it removes the demonstration records, their files and the audit entries about them, leaves the users and the website content exactly as they were, keeps the files of kept records stored and openable, keeps the sign-in entries, adds one `system.showcase_cleanup` entry with the numbers and without any address, finds nothing more to do when planned again, and reports a stored file that no record points at without removing it until that is asked for; with `all`, every recruitment record and every file goes, no audit entry about a recruitment record is left, the public site and the admin work on the empty lists, and afterwards a job can be created and published and an application to it is accepted.

## Deployment

The planned setup: the frontend on Vercel, this API on Render, the database on MongoDB Atlas, images on Cloudinary, private documents on Backblaze B2, email through Resend.

### Backend on Render

1. Create a **Web Service** from the repository.
2. Settings:

| Setting | Value |
| --- | --- |
| Root directory | `backend` |
| Build command | `npm install` |
| Start command | `npm start` |
| Health check path | `/api/health` |

3. Make sure the service runs Node 20.11 or newer.
4. Add the environment variables:

```
NODE_ENV=production
TRUST_PROXY=1
MONGODB_URI=<your-cluster-uri>
FRONTEND_URL=https://www.<your-domain>
SESSION_SECRET=<random-string-of-32-or-more-characters>
COOKIE_SAMESITE=lax
```

plus the Cloudinary, B2 and Resend variables from "Connecting the services", including `ADMIN_NOTIFICATION_EMAIL`. Add `OPENAI_API_KEY` and `OPENAI_MODEL` only if the AI comparison is to be used. The three `*_DRIVER` variables are not needed: in production private documents always use B2 and images always use Cloudinary. Do not set the `SEED_*` variables. The server listens on `PORT` when the host sets it, otherwise on 4000.

5. In Atlas **Network Access**, allow the addresses the Render service connects from.
6. Deploy, open `https://<your-backend-host>/api/health`, and read the `server.listening` line in the service's log: it must show `"fileStorage":"b2"`, `"mediaStorage":"cloudinary"`, `"email":"resend"` and `true` for `b2Configured`, `cloudinaryConfigured` and `resendConfigured`. `openaiConfigured` is `true` only when both OpenAI values are set. Then create the first user (see above) and run the checks under "Connecting the services" once against the deployed service.
7. If the database already holds applications or candidates saved by an earlier version of this code, run the recruitment migration against it (see "Upgrading an existing database"). The server logs a `migration.needed` warning on start while applications with an older status exist.

`TRUST_PROXY=1` tells Express there is one proxy in front of the app, so the client address used for rate limits and stored on audit entries is the one that proxy forwards, not the proxy's own. Set it to the exact number of proxies in front of this API: 1 when browsers call the Render address directly, 2 when the frontend host forwards `/api` to it. Do not set it higher than the real count: a larger number lets a visitor forge the address. With `TRUST_PROXY=0` in production the server logs a warning, because behind a hosting proxy every visitor then appears to come from the proxy address and the rate limits are shared by everyone. The server shuts down cleanly on `SIGTERM`, which is what a deploy sends.

**What `NODE_ENV=production` enforces** (`validateEnv` in `src/config/env.js`). `NODE_ENV` itself must be spelt exactly `production`: a value that is not `development`, `test` or `production` stops the process. The server refuses to start unless:

- `MONGODB_URI` is set,
- `SESSION_SECRET` is set and has at least 32 characters,
- `FRONTEND_URL` is set, every entry is a bare origin, and every entry uses `https`,
- `TRUST_PROXY` is between 0 and 5,
- `SIGNED_URL_TTL_SECONDS` is at least 1,
- `B2_ENDPOINT`, when set, is an `https` address with no path, and `B2_REGION`, when set, matches the region the endpoint names,
- private documents use B2 and images use Cloudinary. That is the case unless `FILE_STORAGE_DRIVER` or `MEDIA_STORAGE_DRIVER` is set to `local` (or `memory`) while the credentials are incomplete,
- `EMAIL_DRIVER` is not `memory`.

There is no fallback to local storage in production. The code also: sets the session cookie `Secure`, sends an HSTS header, returns a generic message for unexpected errors, does not serve `/media`, and answers 404 on `GET /api/files/local/:token`. Incomplete B2, Cloudinary or Resend credentials are warnings, not start-up failures: the server starts and the affected feature reports that it is not configured (uploads answer 503, emails are not sent). `EMAIL_DRIVER=log` without Resend credentials is accepted in production with a warning, so read the start-up line: `"email":"resend"` and `"resendConfigured":true` are what you want to see if you expect email to be sent. The OpenAI values are never required: with either one missing the AI comparison answers 503 `AI_NOT_CONFIGURED` and everything else works.

### Frontend on Vercel, and how it reaches the API

The frontend calls `/api/...`. There are three ways to connect it to the backend. Option A is recommended.

#### Option A (recommended): a rewrite on the frontend host

The browser calls `/api` on the site's own origin and Vercel forwards it to Render. The session cookie is first-party and no CORS exception is involved.

Edit `frontend/vercel.json`. The `/api` rewrite must come **before** the existing catch-all rewrite to `/index.html`, otherwise the catch-all answers first and API calls return the HTML page.

```json
{
  "rewrites": [
    { "source": "/api/:path*", "destination": "https://<your-backend-host>/api/:path*" },
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

Backend variables: `FRONTEND_URL=https://www.<your-domain>` (the site origin the browser uses), `COOKIE_SAMESITE=lax`, `COOKIE_DOMAIN` empty. Do not set `VITE_API_BASE_URL` on the frontend.

Three things to check after deploying with option A:

- Uploads of up to 5 MB pass through the frontend host. Confirm that its proxy accepts request bodies of that size.
- An AI comparison can keep a request open for up to 60 seconds. If the AI comparison is used, confirm that the frontend host's proxy waits that long for the API.
- There is now one more proxy between the visitor and the API. Rate limits are per client address, and the address depends on `TRUST_PROXY`. Submit a form from two different networks and look at the `ip` stored on the audit entries in the `auditlogs` collection. If every visitor shows the same address, the forwarding chain is longer than `TRUST_PROXY` says and the value needs to be raised to match. Never raise it above the real number of proxies: a larger number lets a visitor forge the address.

#### Option B: the API on a subdomain of the same site

For example the site on `https://www.<your-domain>` and the API on `https://api.<your-domain>` (a custom domain on the Render service). The two are the same site, so a `SameSite=Lax` cookie is still sent.

- Frontend build: `VITE_API_BASE_URL=https://api.<your-domain>`
- Backend: `FRONTEND_URL=https://www.<your-domain>`, `COOKIE_SAMESITE=lax`, `COOKIE_DOMAIN=.<your-domain>`

Requests are cross-origin, so they rely on the CORS allow-list. `FRONTEND_URL` must match the site origin exactly.

#### Option C: unrelated domains

For example the site on a Vercel domain and the API on a Render domain.

- Frontend build: `VITE_API_BASE_URL=https://<your-backend-host>`
- Backend: `FRONTEND_URL=https://<your-frontend-host>`, `COOKIE_SAMESITE=none`

With `none` the cookie is always marked `Secure`. Caveat: the session cookie is then a third-party cookie. Some browsers block third-party cookies, by default or by user setting, and in those browsers sign-in may fail. Use option A or B for anything staff rely on.

## Security notes for operators

- **Do not commit secrets.** `.env` and `.env.*` are ignored by git (only `.env.example` is tracked). Keep it that way. Never put a key in the frontend: every `VITE_` variable is public. The Cloudinary secret, the B2 application key, the Resend key and the OpenAI key exist only in the backend's environment. They are not logged (the start-up line and `GET /api/admin/settings` report true or false, and for the AI comparison the model name) and no API response contains them.
- **The AI comparison sends candidate profile text to OpenAI.** It does so only when a recruiter asks for a comparison, and without the name, email, phone, profile link or resume file. What is sent and what is removed is listed in `docs/API.md`, section 9.6. Whether to use it, and what the privacy notice says about it, is a decision for ALLSEMIS. The request and the answer are never written to the server log.
- **Rotating `SESSION_SECRET` signs everyone out.** Session tokens are stored as an HMAC keyed with it, so existing sessions stop matching. Rotate it if it may have leaked.
- **The B2 bucket must stay private.** Its type must be Private ("Files in bucket are: Private"). The code makes no object public and never builds a public address of one. Documents are reachable only through signed links that expire after `SIGNED_URL_TTL_SECONDS`, issued after a permission check, and each access is audited.
- **The `local` and `log` drivers are for development.** Local storage is refused in production because a host's disk is not private and is wiped on deploy. `backend/.data/` is ignored by git and must not be deployed. Files and images stored there are not copied to B2 or Cloudinary when those are connected: they stay on that machine.
- **The seed is for development.** It refuses to run in production, and it refuses a database that is not on this machine unless the database name is confirmed with `--database=<name>`. Never use the sample accounts on a real database.
- **Temporary passwords are shown once.** The seed and `create-admin` print a generated password one time, and the two user management endpoints that generate one (`POST /api/admin/users` and `POST /api/admin/users/:id/reset-password`) return it one time. It is stored only as a scrypt hash. An administrator cannot choose another user's password, and an account on a temporary password can use nothing under `/api/admin` until its owner has changed it.
- **Database access.** Give the database user access to the one database only, and keep Atlas network access as narrow as your host allows.
- **Logs.** The server logs one JSON line per request (method, path without the query string, status, duration, user id). Request bodies and cookies are not logged, and values under keys that look like credentials are redacted.
- **Uploads are not virus-scanned.** Files are checked by structure and size: a PDF needs its version header and end marker, a DOCX is read as a zip whose index lists the Word parts, a DOC needs a `WordDocument` directory entry. These are structural checks, not a malware scan: a real PDF or Word file can still carry something harmful. A hook for a scanner exists (`scanBeforeStore` in `src/services/storage/privateFiles.js`) but none is connected in this release.
