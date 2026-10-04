# ALLSEMI Implementation Scope

Status note for the website, admin panel and ATS build. It records what the
quotation covers, what exists in the code today, what was added beyond the
itemised quotation, and what must be finished before production. It does not
restate or replace the quotation.

Baseline before this phase: commit `dbaa933` (29 Sep 2026).

## A. Included quotation scope

- Public ALLSEMIS website
- Careers and jobs, with the candidate application flow
- Recruitment ATS: resume upload and handling, text and data extraction,
  structured candidate profiles, rule-based filtering
- Admin dashboard: job, candidate and application management, resume access,
  recruitment requirements, ATS results, basic recruitment workflow
- AI-assisted evaluation: skills, experience and qualification extraction,
  job description to candidate comparison, matching assistance, match explanation
- Candidate and client AI chatbot

## B. Current implementation

This phase delivers the admin panel UI, the data model and three public-site
changes. Every admin screen runs on in-memory sample data.

- **Public website.** Unchanged except for the items below.
- **Service routes.** `/employers/permanent-staffing`, `/employers/project-staffing`
  and `/employers/rpo`, each with its own content. The landing page service
  cards link to them. Source: `src/pages/employers/servicesContent.js`.
- **Locations.** Bengaluru is the only confirmed office (`type: 'office'`).
  Bhubaneswar and San Diego are engineering network nodes (`type: 'network'`):
  drawn and labelled on the map from 1024px wide, listed in the location panel
  at every width, and never shown as offices. Source: `src/lib/officeLocations.js`.
- **Insights CMS structure.** Each article has category, tags, title, slug,
  excerpt, cover image, body, author, publish date, draft or published state,
  SEO title and SEO description. "Semiconductor" is a category with five
  published educational articles and one draft. Drafts never reach the site.
- **Stories CMS structure.** The three existing stories now live in
  `src/lib/storiesContent.js` with a publishing state. No story was added.
- **Expertise CMS structure.** The admin edits the eight existing sectors from
  the same data the public pages read.
- **Admin routes.** `/admin`, `/admin/jobs`, `/admin/jobs/new`, `/admin/jobs/:id`,
  `/admin/candidates`, `/admin/candidates/:id`, `/admin/applications`,
  `/admin/requirements`, `/admin/ats`, `/admin/ats/:candidateId`,
  `/admin/enquiries`, `/admin/insights`, `/admin/insights/new`,
  `/admin/insights/:id`, `/admin/stories`, `/admin/stories/new`,
  `/admin/expertise`, `/admin/expertise/new`, `/admin/services`,
  `/admin/locations`, `/admin/settings`.
- **ATS UX.** Eight stages: resume, extraction, structured profile, job
  description, rule-based checks, AI comparison, match explanation, recruiter
  review. Rule checks are computed from the job and the candidate profile and
  are shown separately from the AI reading. A result shows overall match,
  required, matched and missing skills, relevant experience and gaps, education
  match, domain relevance, strengths, potential gaps, evidence, the recruiter
  review state and an audit history. The AI text in each result is sample text.
- **Recruitment seed data.** Eight fictional candidates, ten applications, five
  requirements, five enquiries and eight sample evaluations. No real person,
  employer or client is represented.

## C. CMS extensions and implementation details

Full CMS control of every public section is not itemised in the quotation.
These capabilities were added because the client cannot supply all copy and
wants the site manageable from the admin. They are listed so scope stays clear.

- **Admin-manageable public content structures:** homepage copy, services,
  expertise sectors, insights, stories, locations, about content, contact
  details and jobs.
- **Location management:** city, country, type, status, address, coordinates,
  description, map label side and show or hide.
- **Content publishing states:** draft and published for insights, stories,
  expertise and services; published, draft and archived for jobs.
- **SEO fields:** per-article SEO title and description, used on the article
  page for the document title and meta description, with a fallback to the
  title and excerpt.

What is wired to the public site today: services, insights, stories, expertise
sectors and locations are read from shared data modules, so one edit to the
data changes both the site and the admin's starting state.

Later integration step: the homepage hero, recruitment actions, Why ALLSEMIS,
the landing Insights cards and the About page still hold their copy inside
approved components. The admin mirrors that copy in `src/admin/data/siteContent.js`.
Connecting those components to it means editing approved components, so it
waits for explicit approval.

## D. Not production-ready yet

**Authentication is required before production deployment.** The admin panel
has no sign-in. Keep `/admin` off any public domain until it does.

- Admin authentication, protected routes and role-based access
- Backend API
- Database persistence (admin edits reset on page reload)
- Real private resume storage with logged access, and candidate deletion on the server
- Real OpenAI integration. Nothing in this build calls an AI service. The
  planned backend `AIService` has five functions (`extractResume`,
  `parseJobDescription`, `compareCandidateToJob`, `generateMatchExplanation`,
  `answerChatbot`), returns structured JSON for extraction and matching, and
  reads the model name from server configuration. API keys stay on the server.
- Public form submission (contact, application, referral) and the chatbot UI
- Production security hardening

AI output is decision support for a recruiter. It is never an automatic hiring
decision.

## E. Third-party costs

Third-party API, hosting, database, email, file storage and AI usage costs are
separate from the development fee.
