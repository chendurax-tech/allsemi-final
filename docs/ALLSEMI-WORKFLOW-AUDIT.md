# ALLSEMIS workflow audit

Audit date: 5 October 2026. Scope: the admin panel, the backend API and the public pages, read from the code in this repository (`frontend/src`, `backend/src`) and from the seed data. It describes what is implemented, what is missing and what is unclear. It is not a statement that the system is ready for production.

How this was checked: by reading the code and by the automated tests (backend tests and browser tests of the admin and the public forms). The live MongoDB Atlas database, Cloudinary, Backblaze B2, Resend and OpenAI were not inspected or called.

Update, later the same day: the public Stories section and the public Insights pages were connected to the database. The rows and sections below that concern them say so.

Update, the following day: Expertise, Services, Locations and the contact details were connected in the same way. Every admin field that the public site shows is now read from the database. The rows and sections below say so.

Update, 6 October 2026, storage, images, email and configuration: the wiring for Cloudinary, Cloudflare R2 (the private storage provider at that point, see the last update below) and Resend was finished. Each service now uses its real provider as soon as its credentials are filled in, and documents and images stored before that keep working. Section 7 describes it. Cloudinary, R2 and Resend were still not called: the automated tests check the requests this code builds against stand-ins, so the first real run of each has to be checked by hand (steps in `backend/README.md`, "Connecting the services").

Update, 6 October 2026, AI comparison: a recruiter can now start an AI comparison of a candidate with a job ("Compare with AI" on an ATS result). The backend sends one request to OpenAI, validates the answer and stores it beside the rule-based result. It is advice: it never starts by itself, and it changes no score, no status and no application. The ATS and Settings rows and sections below, and sections 5, 7 and 8, say so. OpenAI was still not called: the automated tests answer it with a stand-in, so the first real comparison has to be checked by hand (steps in `backend/README.md`, "Connecting the services").

Update, 6 October 2026, private storage provider: private documents are now stored in Backblaze B2, through its S3-compatible API, instead of Cloudflare R2. Nothing else changed. Section 7 says so. Backblaze B2 was not called either: the first real run has to be checked by hand (steps in `backend/README.md`, "Connecting the services").

Update, 6 October 2026, showcase state: the development seed (`npm run seed`) no longer creates jobs or recruitment records. It creates the users and the website content and configuration only, so jobs, candidates, applications, requirements, referrals, enquiries and ATS results start empty and the admin opens on empty lists. The fictional sample jobs and recruitment records are created only with `npm run seed -- --with-demo-recruitment-data`, which is for a throwaway database and never for one that is shown to a client. A new command, `npm run clean:showcase`, takes demonstration recruitment data out of an existing development or showcase database, with the files it points at and the audit entries about it: without options it is a dry run that changes nothing, and `-- --apply` makes the changes. It never touches users or website content, and it refuses to run when `NODE_ENV=production`. It was not run against the live MongoDB Atlas database or a real B2 bucket: that run has to be made and read by hand (steps in `backend/README.md`, "Clean showcase state"). There is still no retention or scheduled deletion job.

Update, 6 October 2026, production sign-in: in production the site (`https://allsemi.vercel.app`) calls the API (`https://allsemi-backend.onrender.com`) directly, on another site, with no `/api` rewrite. Admin sign-in was accepted there and the screen then said "Your session ended. Sign in again." The cause: the session cookie was sent as `SameSite=Lax`, and a browser refuses a Lax cookie that arrives in a cross-site response, so the next request carried no cookie and was answered 401. The backend now decides the cookie's `SameSite` value for each sign-in. With `COOKIE_SAMESITE=lax`, which is still the default, the cookie is Lax when the browser reports the request as same-origin or same-site and None when it reports cross-site. `none` and `strict` are used as given. A None cookie is also Secure and Partitioned. Nothing else about sessions changed: they are stored on the server, the cookie is HttpOnly, and no token is in a response body or in browser storage. The CORS allow-list and the request header and origin checks are unchanged. `TRUST_PROXY` now defaults to 1 in production on Render, and an option line left empty in the environment now means "not set". The limit: with the site and the API on different sites the session cookie is a third-party cookie. Browsers that block third-party cookies (Safari and other WebKit browsers by default, Brave, Chrome in Incognito or with the setting switched on) may refuse it even with `SameSite=None`. The Partitioned attribute is meant to keep it working where the browser supports it, and that was not verified in those browsers. The `/api` rewrite on the frontend host makes the cookie first-party, does not have this limit and remains the recommended layout. The change is covered by 6 new backend tests (`backend/tests/session.test.js`), which check the headers the API sends and involve no browser, and it was reported as checked in headless Chromium in the environment where it was made. It was not run on the real Vercel and Render deployment, or in Safari or any other browser that blocks third-party cookies. The variables for this layout and a troubleshooting entry for the message are in `backend/README.md` ("Frontend on Vercel, and how it reaches the API"). Section 7, item 2, says so.

Reference documents: `backend/docs/API.md` (every endpoint), `backend/README.md` (setup and commands), `docs/ALLSEMI-PRODUCTION-ARCHITECTURE.md` (architecture and security).

## 1. Summary table

"Public connection" answers one question: does the public website show what the admin saved?

| Admin section | View | Create | Edit | Delete / archive | Publish | Special action | Public connection | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Dashboard | Yes | No | No | No | No | None | None (internal) | Working |
| Jobs | Yes | Yes | Yes, all fields | Archive yes. Delete only when the job has no applications | Publish, unpublish, archive | None | Connected. Public pages show published jobs only | Working |
| Candidates | Yes | No (created by an application or a referral conversion) | Yes, profile fields. Email is fixed | Delete, with applications, ATS results and resumes | Not applicable | Labels, notes, private resume, shortlist an application | None (never public) | Working |
| Applications | Yes | No (public form only) | Notes, source, labels | No (removed only with the candidate) | Not applicable | Shortlist with email, labels, private resume | None (never public) | Working |
| Requirements | Yes | Yes | Yes, all fields | Delete | Not applicable | Status, priority, private attachment | Public Hire Talent form writes here | Working |
| Referrals | Yes | No (public form only) | Candidate details, status, notes | Delete | Not applicable | Convert to candidate, private resume | Public Refer form writes here | Working. Conversion creates no application (see section 6) |
| ATS | Yes | Run evaluation | Review decision and note | No | Not applicable | Compare with AI: an advisory comparison a recruiter starts by hand on one result. The scores stay rule based | None (never public) | Working. The AI comparison needs the OpenAI settings on the server and has only been run against a stand-in |
| Enquiries | Yes | No (public form only) | Type, status, internal notes | Delete | Not applicable | Private attachment | Public enquiry form writes here | Working |
| Insights | Yes | Yes | Yes, all fields | Delete | Publish, move to draft | Image upload, Featured (leads the Insights page), landing page switch and order | Connected. `/insights` and article pages show published articles from the database. The landing page shows the published articles switched on for it | Working |
| Stories | Yes | Yes | Yes, all fields | Delete | Publish, move to draft | Image upload, order number, landing page switch | Connected. The landing page shows the published stories switched on for it, in the admin order | Working |
| Expertise | Yes | Yes | All fields except representative searches | No button (API exists) | Publish, move to draft | Image upload, order number | Connected. Header menu, home bands, `/expertise`, sector pages, About and the form domain choices show published sectors from the database | Working. Representative searches have no editor |
| Services | Yes | Yes | All fields except the heading of the "receives" block | No button (API exists) | Publish, move to draft | Order number | Connected. Home page cards and `/employers/:slug` pages show published services from the database | Working |
| Locations | Yes | Yes | All fields the site shows | Delete | Shown or hidden toggle | Office and network node kept apart by the server | Connected. The network map and office panel on home and About show the shown locations from the database | Working |
| Settings: Contact | Yes | Not applicable | Email, phone, address, hours | Not applicable | Saved is live | None | Connected on the Contact page. The office panel on home and About shows the office location record instead | Working |
| Settings: AI and ATS | Yes | No | No (read only) | No | No | None | None | Working. Shows what the server reports: AI comparison enabled or not, OpenAI connected or not, the model, and whether a key is set |
| Settings: Access and users | Yes | Add user | Role, enable or disable, reset password | No delete (disable only) | Not applicable | Temporary password shown once | None | Working. Name and email of a user cannot be edited |
| Audit log | Last 8 entries on the dashboard, and history on a candidate | No | No | No | No | None | None | API complete. No dedicated screen |

## 2. Section by section

Common to every section:

- No mock data. Every screen reads and writes through `/api/admin/...`, and the API reads and writes MongoDB. A browser reload reads everything again. Nothing is kept in `localStorage`.
- Every admin route requires a signed-in session, then the permission named on the route in `backend/src/routes/admin.routes.js`. Hidden buttons are a convenience. The server refuses the call regardless.
- Lists load up to 500 records in one request and search and filter in the browser. There are no page controls.
- Roles: super admin (everything), recruiter (recruitment, jobs including publish, ATS, shortlist. No deletes, no website content), hiring manager (read only, plus the ATS review), content manager (website content, images, site contact. No candidate data).

### Dashboard
- View: counts of open jobs, candidates, applications and shortlisted applications. Applications as New and Shortlisted with label counts. Open requirements. Six most recent applications. Content counts. Recent activity (super admin only).
- Create, edit, delete, publish: none.
- Data: computed from the same API data as the other screens. Activity from `GET /api/admin/audit-logs`.
- Hardcoded: nothing. Missing: nothing required.

### Jobs
- View: list with title, category, location, level, status, last update.
- Create and edit: every field the API accepts. Slug is generated on the server.
- Delete or archive: Archive is a status. Delete is refused with a clear message when the job has applications.
- Publish: draft, published, archived. Needs `jobs:publish`, checked on the server. Editing or deleting a published job needs the same permission.
- Model and API: `Job`, `/api/admin/jobs`. Persisted in MongoDB: yes.
- Public: connected. `/talent` and `/talent/jobs/:slug` read `GET /api/public/jobs`, which returns published jobs only. Applications are accepted only for a published job with applications switched on.
- Still hardcoded: the category and location choices in the admin form come from a fixed list in the frontend. The filter chips on `/talent` are that list plus any other category or location found on a published job, so a job saved with another value through the API still gets a chip.
- Missing: reorder (public order is featured first, then publish date). The publish date is set on first publish and not refreshed on a later republish.
- Security: consistent.

### Candidates
- View: list and a detail page (profile, skills, work history, notes, history, labels, resume, applications with their shortlist state, ATS results).
- Create: not in the admin. A candidate is created by a public application or by converting a referral.
- Edit: profile fields in a drawer. Labels (Interviewed, Rejected, Selected) saved immediately. Notes are append only. Email cannot be changed, because it identifies the candidate.
- Delete: super admin only. Removes the applications, ATS results and stored resumes of that person.
- Model and API: `Candidate`, `/api/admin/candidates`. Persisted: yes.
- Public: none, by design. No public endpoint returns candidate data.
- Missing: adding a candidate by hand, editing education and work history, replacing the resume from the admin.
- Security: the resume is private. Opening it needs two permissions, issues a link that expires after two minutes by default, and is recorded.

### Applications
- View: list with candidate, job, status (New or Shortlisted), labels, source, ATS score, date. A drawer shows the details typed into the form for that application.
- Create: public form only. Edit: recruiter notes, source, labels. The status is not an editable field.
- Delete: none. Removed only when the candidate is deleted.
- Special action: Shortlist (section 7). Private resume link.
- Model and API: `Application`, `/api/admin/applications`, `POST .../shortlist`, `POST .../shortlist-email`. Persisted: yes.
- Missing: an activity list per application in the admin (the audit entries exist and are readable through the audit API). Undoing a shortlist. The AI comparison is started and read on the ATS result page, not here.
- Note: a second application from the same email for the same job is stored as a second application. It never overwrites the first.

### Requirements
- View, create, edit: all fields, including status (New, Reviewing, Contacted, In progress, Closed) and priority.
- Delete: super admin. The attachment file is removed too.
- Model and API: `Requirement`, `/api/admin/requirements`. Persisted: yes.
- Public: the Hire Talent form on `/contact?type=employer` writes here, with an optional job description attachment (PDF, DOC or DOCX, 5 MB).
- Missing: linking a requirement to a job. Uploading an attachment from the admin.
- Security: opening the attachment needs only `requirements:read`, so a hiring manager can open it. There is no separate document permission as there is for resumes.

### Referrals
- View: list and a detail page (referred person, referrer, message, notes, status, resume).
- Create: public Refer form only. Edit: the referred person's details (for example to add a missing email), status, notes.
- Delete: super admin. The resume is removed only when nothing else uses the same stored file.
- Special action: Convert to candidate. Exact behaviour in section 6.
- Model and API: `Referral`, `/api/admin/referrals`, `POST .../convert`. Persisted: yes.
- Unclear: the referral statuses include Shortlisted and Rejected, which now read like the application workflow but are unrelated to it. They send nothing.

### ATS
- View: overview of all results and a result page per candidate and job, with the score, its weighted parts, each rule check and the matched and missing skills.
- Create: "Run evaluation" for a candidate and job. It also runs automatically with the first application to a job.
- Edit: the recruiter review (Pending, Advance, Hold, Reject) and a note. Scores cannot be edited.
- Model and API: `ATSResult`, `/api/admin/ats-results`, `/api/admin/ats/run`, `POST /api/admin/ats-results/:id/ai-comparison`. Persisted: yes.
- What it is: deterministic rules. Skills 45, experience 20, preferred skills 10, domain 10, location 10, profile completeness 5. The same inputs always give the same score. It is labelled "RULE-BASED ATS" everywhere.
- What it is not: it does not read the resume file. It compares the profile fields from the application form with the job. No score or check comes from an AI model.
- It never changes an application. Saving a review, including Reject, changes no status, adds no label and sends nothing.
- AI comparison: the result page has an "AI comparison" panel below the rule-based panels. The button "Compare with AI" asks the backend to compare the candidate with the job through OpenAI, and reads "Compare again" once a comparison is stored. Only a role with `ats:run` (recruiter and super admin) sees the button. A hiring manager can read a stored comparison and cannot start one.
- What the comparison shows: the model's estimate of the overall match (0 to 100, labelled as the model's estimate and kept apart from the rule-based score), a summary, matched and missing skills, relevant experience, experience gaps, a qualification assessment, strengths, concerns and a recommendation, then the model name, who asked and when.
- When it runs: only on that click. It is never run when a page loads, by the rule-based evaluation, by shortlisting or by a label. Running it again replaces the stored comparison, and re-running the rule-based evaluation keeps it.
- What it changes: its own field on the ATS result, and nothing else. No score, review, status or label changes, nobody is shortlisted and no email is sent. Each stored comparison is written to the audit log.
- What is sent: the job and the candidate's stated profile (current role, domain, years, skills, summary, cover note, work history, education). The name, email, phone, profile link and resume file are never sent, and email addresses, links, phone numbers and the candidate's own name are removed from the typed text as far as a pattern can find them. The location is sent only when the job is tied to a place. The full list is in `backend/docs/API.md`, section 9.6.
- Notices: the overview and the result page say at the top whether AI comparison is enabled on this server, following what the server reports. When it is not enabled the panel says so and offers no button.
- Limits: at most 20 requests per 10 minutes per signed-in user, one comparison at a time per result, and up to a minute for an answer. Both guards are kept in memory per server process.
- Not shown: the real OpenAI API was never called where this was written (no network, no key), and every test answers it with a stand-in. Whether the configured model accepts the strict answer format is untested, and the quality of the analysis is unproven. The comparison does not read the resume file either: no resume text extraction exists. The request sets no cap on output tokens beyond the answer format and the rate limit. A comparison can take up to a minute, so a hosting proxy's timeout must allow it. Sending candidate profile data to OpenAI is a decision for ALLSEMIS and its privacy notice.
- Unclear: the review decision words (Advance, Reject) overlap with the Shortlist action and the Rejected label. They are a note on the evaluation only.

### Enquiries
- View and edit: type, status (New, In progress, Closed), internal notes. The submitted details are read only.
- Delete: super admin.
- Public: the enquiry form on `/contact` writes here.
- Missing: replying from the admin. The type "Other" exists in the data but is not offered on the public form.
- Security: the attachment needs only `enquiries:read`.

### Insights
- View, create, edit: all fields. The body is typed as text and stored as blocks (paragraph, heading, quote, list). Image by upload or link.
- Delete: yes. Publish: draft and published.
- Model and API: `Insight`, `/api/admin/insights`, public `GET /api/public/insights`. Persisted: yes.
- Public: connected. The home page section, `/insights`, the article pages and the "From Insights" card on sector pages read `GET /api/public/insights` and `/insights/:slug`. Only published articles are returned. An unknown, draft or unpublished address shows a not-found state. The home page shows the published articles switched on with "Show on landing page", in the landing page order (lowest number first, then newest first), however many there are. The Featured switch only decides which article leads `/insights`.
- Hardcoded in the admin: the category list.

### Stories
- View, create, edit, delete, publish: complete. An order number sets the sequence, and "Show on landing page" keeps a published story on or off the landing page.
- Public: connected. The home page section reads `GET /api/public/stories`: published stories only, in the order number set in the admin, and the section shows those switched on for the landing page. With no story to show, or when the API cannot be reached, the section is left out.

### Expertise
- View, create, edit: name, short name, slug, order number, status, description, image, introduction, overview, domains, roles, hiring challenges, process flow, related article.
- Stored but with no editor: representative searches (a nested list). The sector page shows what the database holds.
- Delete: the API route exists, the admin has no button.
- Reorder: the order number is free text and is also the number shown on the site.
- Public: connected. The header menu, home page bands, `/expertise`, the sector pages (`/expertise/:slug`), the domain cards on About and the domain choices in the public forms read `GET /api/public/expertise`. Only published sectors are returned. A new sector gets a page, a menu entry and a form choice as soon as it is published. An unknown or unpublished address shows a not-found state.
- Fixed in the frontend: the drawing for each of the eight original sectors (a new sector gets a neutral drawing), the headings "Eight sectors. One standard." and "Eight engineering domains.", and the short name, which the header only uses when there are six sectors or fewer.

### Services
- View, create, edit: name, slug, order number, icon (fixed list of three), status, description, headline, lead, fit title and list, process title and steps, receive list, tags title and tags, questions and answers, button label and link.
- Stored but with no editor: the heading of the "receives" block. The page uses a fixed heading there.
- Delete: the API route exists, the admin has no button.
- Public: connected. Home page cards and the `/employers/:slug` pages read `GET /api/public/services`. Only published services are returned. For the three original services, the tags and the questions and answers written for the first release are used while the database record has none of its own, so a database created before these fields existed loses nothing. Once tags or questions are saved in the admin, the saved ones are shown.

### Locations
- View, create, edit, delete: city, country, region, type (office or network node), status, coordinates, address, phone, email, hours, description, label side, label offset, headquarters, shown or hidden.
- Stored but with no editor: label. Nothing on the site shows it.
- Office against network node: enforced on the server. A network node cannot carry an address, phone, email, hours or the headquarters flag, whatever the request contains. Bengaluru is the only office in the seed. Bhubaneswar and San Diego are network nodes.
- Public: connected. The map and the office panel on the home and About pages read `GET /api/public/locations`: city, country, region, type, coordinates, label side and offset, headquarters, and for an office its address, phone, email and hours. A hidden location leaves the map. With no shown location, or when the API cannot be reached, the section is left out.
- No public representation: description and status.
- Unclear: there is a `status` field and a separate shown or hidden toggle. Only the toggle affects the public API.

### Settings
- Exactly three tabs: Contact, AI and ATS, Access. No Homepage or About tabs.
- Contact: email, phone, address lines, hours. Saved to `SiteSettings` and served by `GET /api/public/site`. The public Contact page shows it, with no built-in fallback: an emptied value is left out. The office panel on the home and About pages shows the office location record (Locations), so the two are edited in two places.
- AI and ATS: read only. Shows the rule-based engine with its weights (to a role that can read the ATS), and an "AI comparison" panel with what the server reports: Status (Enabled or Not enabled), OpenAI (Connected or Not connected), the model when one is set, whether the API key is set on the server (Set or Not set), and the server's note. The key itself is never shown. "Connected" means the two OpenAI values are set on the server, not that OpenAI was contacted.
- Access: the role and permission table, read from the server.

### Users
- Inside Settings, Access. Super admin only. Add a user (the server generates a temporary password, shown once), change role, enable or disable, reset password.
- Safeguards: you cannot change your own role or disable yourself. The last active super admin cannot be removed. Sessions end when a role changes or an account is disabled.
- Missing: editing a user's name (the API accepts it, the screen has no control), deleting a user (disable only).

### Audit log
- Recorded: sign-in and failures, user changes, every create, edit, delete, publish and status change, label changes, shortlist and its email, resume and attachment access, referral conversion, public submissions, and each stored AI comparison (the model name and its number, not the text).
- View: the last eight entries on the dashboard (super admin) and the history on a candidate page.
- Missing: a dedicated screen. The API (`GET /api/admin/audit-logs`) already supports filters and paging.

### Security observations
1. `GET /api/admin/access` returns the role and permission table to any signed-in account. Low impact, but it could be limited to roles that see Settings.
2. Requirement and enquiry attachments open with the plain read permission. If attachments should be as restricted as resumes, they need their own permission.
3. Locations have no publish permission. Showing or hiding one needs only `content:write`. Not exploitable today, because every role that can write content can also publish.
4. No malware scan runs on uploads. Files are checked by structure (real PDF, DOC or DOCX) and size, stored privately and never executed. A scanner hook exists and is not connected.
5. Rate limits are kept in memory, which is correct for one server instance only. The guard against two AI comparisons for the same result at once is kept the same way.
6. Shortlisting cannot be undone from the admin. This is deliberate for now, because the email has already gone.
7. The AI comparison sends candidate profile text to OpenAI when a recruiter asks for it. The OpenAI key stays on the server, the name, email, phone, profile link and resume file are not sent, and the answer is validated before it is stored. The removal of names and contact details from typed text is pattern matching, not a guarantee. Whether candidate data may be sent to OpenAI at all is a decision for ALLSEMIS and its privacy notice.

## 3. Public connection matrix

| Data | Admin collection | Public API | Public pages that show it | Reads the database today? |
| --- | --- | --- | --- | --- |
| Jobs | Jobs | `GET /api/public/jobs`, `/jobs/:slug` (published only) | `/talent`, `/talent/jobs/:slug` | Yes |
| Site contact | Settings, Contact | `GET /api/public/site` | `/contact` info panel and closing block | Yes |
| Recruitment forms | Requirements, Candidates and Applications, Enquiries, Referrals | `POST /api/requirements`, `/applications`, `/enquiries`, `/referrals` | `/contact` (three routes), job page apply overlay, `/talent` general application, `/refer` | Yes, all four write to the database |
| Insights | Insights | `GET /api/public/insights`, `/insights/:slug` (published only) | Home page section, `/insights`, article pages, sector page card | Yes |
| Stories | Stories | `GET /api/public/stories` (published only) | Home page | Yes |
| Expertise | Expertise | `GET /api/public/expertise` (published only) | Header menu, home bands, `/expertise`, sector pages, About, form domain choices | Yes |
| Services | Services | `GET /api/public/services` (published only) | Home cards, `/employers/:slug` pages | Yes |
| Locations | Locations | `GET /api/public/locations` (shown only) | Network map and office panel on home and About | Yes |

Before the built-in files were removed, the seed content for these five types was compared with them field by field: same records, same text, same slugs, same count (8 sectors, 3 services, 3 stories, 3 locations, 14 articles of which 13 published). None of the five has a built-in version any more: the site shows what the database holds, and an edit saved in the admin is public at the next page load.

Pages with no admin collection at all (copy lives in the frontend): home hero, action cards, chip sequence, "Why ALLSEMIS" facts and figures, About, the Employers landing page, Talent landing copy, Refer page copy, header and footer navigation.

## 4. What was done to let each public page read the database

| Type | Fields added to the database or admin | Other work done |
| --- | --- | --- |
| Stories | None | Done: connected, with loading, empty and failure handling. |
| Insights | None | Done: connected. Topic chips are the fixed list plus any other topic a published article carries. |
| Locations | Admin editors for phone, email, hours and label offset | Done: connected. The map computes its geometry from the loaded records. The public order is creation time, then id. Open point: office contact details exist both on the office location (map panel) and in Settings, Contact (Contact page), and are edited separately. |
| Services | Tags title, tags, and questions and answers added to the model, validator, public API, seed and admin. Admin editors for the fit and process titles | Done: connected. Process steps ("Label: detail") and questions ("Question | Answer") are split for the page. One route, `/employers/:slug`, serves every published service. |
| Expertise | Admin editor for process flow. Representative searches still have none | Done: connected. Hiring challenges ("Title: detail") are split for the page. One route, `/expertise/:slug`, serves every published sector, and the header menu and form domain choices follow the list. A sector outside the original eight gets a neutral drawing. |

All five content types are connected.

## 5. Recruitment flow (as implemented after this change)

1. A job is published in the admin. Only published jobs are public.
2. A candidate applies through the public form. The server checks the job is published and accepting applications, validates the fields and the resume, and stores the resume privately.
3. A candidate record is created, or the existing one for that email is reused unchanged. An application is created with status New, no labels, and the details and resume sent with it.
4. The rule-based ATS evaluates the first application to a job automatically. A recruiter can run it again.
5. Optional: a recruiter opens the ATS result and clicks "Compare with AI". The backend sends the job and the candidate's stated profile to OpenAI and stores the validated answer beside the rule-based result. This happens only on that click and only when the server has the OpenAI settings. It gives analysis and a recommendation only: it changes no score and no status, and it never shortlists.
6. A recruiter reviews the application, the ATS result and, when there is one, the AI comparison.
7. A recruiter clicks Shortlist. The server checks the `applications:shortlist` permission (recruiter and super admin), sets the application to Shortlisted exactly once, records who and when in the application and in the audit log, and sends the candidate the shortlist email.
8. The recruiter sees the result: shortlisted, and what happened to the email (sent, or not sent and why). While the email service is not connected the application is still shortlisted and the email can be sent later with "Send shortlist email". Once the email service has accepted it, it cannot be sent again.

Interviewed, Rejected and Selected are labels on a candidate or an application. They can be added and removed freely, are used for filtering, and change no status, send no email and run nothing.

## 6. Referral "Convert to candidate": exact behaviour

Code: `convertReferral` in `backend/src/controllers/recruitmentController.js` and `linkCandidate` in `backend/src/services/candidateService.js`.

| Question | Answer |
| --- | --- |
| Who can do it | A role with both `referrals:write` and `candidates:write`: recruiter and super admin |
| Preconditions | The referral is not already converted (otherwise refused), and it has an email for the referred person (otherwise refused; the email can be added with "Edit details") |
| Does it create or link a candidate | Yes. If no candidate has that email, one is created with the referred person's name, email, phone, role, domain and profile link, and source "Referral". If one exists, it is linked and only its empty fields are filled |
| Are duplicate candidates prevented | Yes, by email. The same person referred under a different email would become a second candidate |
| What happens to the referral | It is linked to the candidate, its status becomes Converted, and it is closed to further edits (notes can still be added). It cannot be converted twice |
| Does it create an application | No |
| Is the resume carried over | For a new candidate, yes: the candidate points at the same stored file as the referral. An existing candidate who already has a resume keeps their own, and the referral keeps its copy |
| Is an ATS result created | No. The ATS compares a candidate with a job, and there is no job |
| Is an email sent | No. Neither the referred person nor the referrer is emailed |
| Is it audited | Yes, as `referral.converted` |

What is unclear or incomplete: a converted referral produces a candidate with no application. Since shortlisting acts on an application, a referred person cannot be shortlisted, evaluated by the ATS or seen in the Applications list unless they apply through the website themselves.

Smallest safe correction (proposed, not implemented): when converting, also create one application for that candidate with source "Referral", either general or for a job the recruiter picks in the same step. With a job chosen, the rule-based ATS runs as it does for any application. No email is sent at conversion. Shortlisting then works exactly as for any other application. This needs a decision on one point: whether choosing a job at conversion is required, optional or not offered.

## 7. External services: order to connect

The code for each is in the backend. A service is switched on by filling in its credentials in the backend's environment: when all of a provider's values are set the real provider is used, and until then the development fallback is (local files, local images, emails written to the server log). No other switch is needed, and a `FILE_STORAGE_DRIVER=local`, `MEDIA_STORAGE_DRIVER=local` or `EMAIL_DRIVER=log` line left in an older `.env` does not get in the way. The start-up log line `server.listening` and Settings in the admin show which driver each service is using. Nothing here needs frontend changes, and no credential is ever given to the frontend.

1. MongoDB Atlas: done. Before real use: a production database separate from the development one, a database user limited to it, and backups.
2. Deploy the API (Render) and the site (Vercel) with the `/api` rewrite, HTTPS, a production `SESSION_SECRET`, `FRONTEND_URL`, `TRUST_PROXY`, and the first super admin created with `npm run create-admin`. Production runs without the `/api` rewrite at present: the site calls the API on its Render address directly, and the session cookie is then `SameSite=None`, not `SameSite=Lax` (see the update of 6 October 2026, production sign-in, at the top). The rewrite remains the recommended layout, because it makes the session cookie first-party.
3. Backblaze B2 for private documents (resumes, requirement and enquiry attachments). This comes before real candidates apply: local file storage is for development only. In production private documents always use B2: the server refuses local storage, and refuses uploads until the B2 credentials are set. The bucket stays private, with no public address of any kind. Documents are reached only through a permission check and a signed link that expires after `SIGNED_URL_TTL_SECONDS` (two minutes when the variable is not set; `.env.example` keeps that value). Resumes are never put on Cloudinary.
   - Documents stored on a development machine before B2 is connected are not copied to B2. They keep opening on that machine, because each stored file records which store holds it. Production never reads a local disk. Real documents collected before B2 was connected have to be submitted again.
   - Nothing migrates objects from R2 to B2. A record written while R2 was the provider is reported as not available and is never looked for in B2.
   - A B2 bucket keeps versions, so a deleted file is removed version by version. The application key needs `readFiles`, `writeFiles`, `deleteFiles` and `listFiles` on the bucket. Without `listFiles` a deleted file is only hidden and the server log has `storage.b2_hidden_not_deleted`.
4. Resend for email, with the sending domain verified and `EMAIL_FROM` on that domain. From then on the four team notifications (requirement, application, enquiry, referral, each with the sender as reply-to), the confirmations and the shortlist email are really sent, and applications shortlisted earlier can be emailed with "Send shortlist email". Labels (Interviewed, Rejected, Selected) send nothing.
5. Cloudinary for public images (articles, stories, sectors). The admin uploads to the backend, the backend uploads to Cloudinary with a signed request, and the Cloudinary address is saved on the record and shown by the public site. Images that are links to other websites (the seeded pictures) are left exactly as they are. Images uploaded locally before Cloudinary was connected keep showing on that development machine and are not copied: upload them again to move them.
6. OpenAI, last, and optional. The code is in place: with `OPENAI_API_KEY` and `OPENAI_MODEL` both set in the backend's environment the AI comparison is available, and with either one empty it is not (the code has no default model). It is used only for the candidate and job comparison, through the backend, as analysis and recommendation. The recruiter still decides. Unlike items 3 to 5 it has no development fallback: without the two values the feature is simply off, and everything else works.

What has not been shown for item 6: no request has reached OpenAI from this code. The tests answer `api.openai.com` with a stand-in. Whether the configured model accepts the strict answer format, and how good the analysis is, will only be seen on real comparisons. The comparison does not read the resume file, the request sets no cap on output tokens beyond the answer format and the rate limit, and a comparison can take up to a minute, so a hosting proxy's timeout must allow it. Sending candidate profile data to OpenAI is a decision for ALLSEMIS and its privacy notice. After setting the two values, run the checks in `backend/README.md` ("Connecting the services"): the start-up line, one comparison, the stored model name, and a server log with no prompt in it.

What has not been shown for items 3 to 5: no request has reached Backblaze B2, Resend or Cloudinary from this code, and the AWS SDK that the B2 driver uses was not loaded in the environment where this was written. The tests show what the code sends and how it reads an answer, against stand-ins. After connecting each service, run the checks listed for it in `backend/README.md` ("Connecting the services"): the start-up line, one upload, one download, one email.

## 8. Remaining work before production

1. Run the backend tests and the frontend build and lint on a machine with the real packages installed. In the environment where this code was written they could only be run against stand-ins.
2. Run the one-time recruitment migration on any database that holds records from before this change (`npm run migrate:recruitment`, then with `-- --apply`), or reseed a development database.
3. Decide the referral conversion correction in section 6.
4. Connect B2, then Resend, then Cloudinary, and test each once for real: a resume upload and a private download that expires, a team notification and a shortlist email, an image upload that shows on the public site. The steps are in `backend/README.md` ("Connecting the services").
5. Done: all five public content types (Stories, Insights, Locations, Services, Expertise) are connected to the database. Still open: an admin editor for a sector's representative searches, and one place to edit the office contact details (they are held both on the office location and in Settings, Contact).
6. Add the missing admin editors (location phone, email and hours; service titles; expertise process flow and representative searches), delete buttons for expertise and services, and an audit log screen.
7. Decide whether shortlisting needs an undo, and whether the ATS review words should be renamed so they cannot be confused with Shortlist and the Rejected label.
8. Production configuration: the `/api` rewrite, cookie settings, proxy count, backups, error monitoring, and a shared store for rate limits if the API ever runs on more than one instance.
9. A privacy notice and a retention rule for candidate data, and a malware scan for uploads if required.
10. If the AI comparison is to be used: decide whether candidate profile data may be sent to OpenAI and say so in the privacy notice, set `OPENAI_API_KEY` and `OPENAI_MODEL`, and run one real comparison. Until then it has only been run against a stand-in.
