# Official job synchronisation

```
OFFICIAL COMPANY JOB SOURCE -> AUTOMATIC SYNCHRONISATION -> ALLSEMIS DATABASE
  -> PUBLIC WEBSITE -> CHATBOT (rule-based) -> APPLICATION -> RESUME EXTRACTION
  -> ATS (rule-based)
```

The company's own job postings are the **source of truth**. The sync copies them
into the database; nothing downstream rewrites them. The sync uses no AI service
and needs no API key.

Semantic matching and AI job intelligence are **future scope** (sections 7 and 8).

## 1. Status: what is and is not connected

**No official source is connected yet.** When this was built, the company
career site could not be reached from the development environment (the domain
did not resolve), so no real integration was written or tested against it. What
exists is a source-agnostic sync with two standard adapters, tested end to end
against local fixture sources (`tests/job-sync.test.js`). Connecting the real
source is configuration, plus a check of section 6, not code — unless the
source is neither of the two formats below, in which case one adapter is added
in `src/services/jobSync/sources.js`.

Without `JOB_SYNC_SOURCE_URL` the sync is off and the admin works exactly as
before: jobs are entered by hand.

## 2. Source formats

`JOB_SYNC_SOURCE_TYPE` picks the adapter.

### 2.1 `json-feed` (preferred)

An HTTP(S) address that answers JSON: an array of jobs, or `{ "jobs": [...] }`.
**It must list every open job in one answer**: a job that is not in it counts as
missing (section 3.4). Pagination is not supported.

| Field | Required | Accepted alternatives | Notes |
| --- | --- | --- | --- |
| `id` | yes | `jobId`, `reference`, `requisitionId` | Stable for the life of the posting. Letters, digits and `. : / # @ ? = & % + ~ - _`, up to 200. |
| `title` | yes | `name` | |
| `description` | yes | `descriptionHtml`, `body` | At least 20 characters. HTML is turned into text. |
| `summary` | no | `shortDescription` | |
| `location` | no | `city` (string or array) | |
| `department` | no | | |
| `category` | no | `domain` | |
| `employmentType` | no | `type` | Full-time, Contract, Contract-to-hire (and common spellings). Anything else is stored empty. |
| `experienceLevel` | no | `seniority` | One of the job levels; otherwise derived from `minYears` / `experience` ("5+ years"); otherwise empty. |
| `minYears` | no | `experience.minYears` | |
| `responsibilities` | no | | Array, or text split on lines. |
| `requiredSkills` | no | `skills` | Array, or text split on `,` `;` lines. |
| `preferredSkills` | no | | |
| `status` | no | `state` | Empty or `open/active/published/live/posted/accepting` = open; `closed/filled/expired/inactive/archived/removed/cancelled/on-hold/paused` = closed; any other word rejects the record. |
| `validThrough` | no | | A past date closes the job. |
| `url` | no | `applyUrl`, `link` | The official posting. http(s) only. |
| `updatedAt` | no | `modifiedAt`, `dateModified` | Shown only; changes are detected by content. |

### 2.2 `jsonld-pages`

The company's own job pages, read for the schema.org `JobPosting` JSON-LD they
publish for search engines. `JOB_SYNC_SOURCE_URL` is either an XML sitemap (its
`<loc>` entries, filtered by `JOB_SYNC_LINK_PATTERN` when set) or a listing page
(postings on it, plus links matching `JOB_SYNC_LINK_PATTERN`). Only pages on the
source's own host are read, at most 200 per run. A page that fails to load makes
the run *incomplete*: then no job is counted missing. The id is
`identifier.value`, else the page address.

### 2.3 Limits of every source

15-second timeout and 3 MB per answer; redirects followed; no credentials are
sent. A source that needs authentication (an ATS vendor API key)
is **not supported yet**: add the header in `fetchSource.js` and a secret
variable for it.

## 3. What a run does

`src/services/jobSync/syncService.js`. Every record is validated
(`normalize.js`) before anything is written; an invalid record is reported in
the run and skipped, and it does not stop the others.

1. **Identity.** A job is the pair `source` (`JOB_SYNC_SOURCE_KEY`) +
   `sourceJobId`, with a unique index. Re-running never creates a duplicate.
2. **New** open job: created with `JOB_SYNC_NEW_STATUS` (`published` by default,
   or `draft` to review before it goes live), with the job defaults otherwise.
3. **Changed** job: detected by a fingerprint of the official fields. Only those
   fields are written (title, summary, description, location, department,
   category, employment type, level, responsibilities, required and preferred
   skills). Status, featured, keywords, slug, requirement profile and
   applications are ALLSEMIS's and are never touched.
4. **Missing** (not in a complete listing): counted; after
   `JOB_SYNC_MISSING_THRESHOLD` consecutive runs (default 2) the job is archived.
   A listing that is empty, or that drops more than half (at least 3) of the
   imported jobs at once, is not trusted: nothing is counted missing and the run
   carries a note.
5. **Closed** at the source (status or `validThrough`): archived at once,
   marked `closedBySync`.
6. **Reopened** at the source: published again — only if it was the sync that
   closed it. A job staff archived stays archived.
7. **Never deleted.** Applications, candidates and ATS results are untouched.
8. **Failure.** A source that cannot be read (network, HTTP error, not JSON)
   is a FAILED run that changes nothing.
9. **Concurrency.** One run per source at a time (a lock in `jobsyncruns`, with a
   15-minute lease for a run interrupted by a restart). A second trigger is
   answered "already running".

Each run is stored in `jobsyncruns` (counts: discovered, created, updated,
unchanged, closed, reopened, missing, invalid; up to 50 record errors; notes) and
audited as `jobs.synced` or `jobs.sync_failed`. Logs carry counts and ids only,
never job text.

**In the admin**, an imported job's official fields are read-only, and the API
refuses a change to them (409) — the change belongs at the source. The job page
shows an "Official job" panel (source, link to the posting, last synchronised,
sync state). The Jobs page shows the sync panel with the recent runs and
"Sync now".

**Downstream, nothing changes**: imported jobs are ordinary `Job` records, so the
public site, the job API, the website assistant and the application form use them
as they are once published. Applications attach to the job's id.

## 4. Running it

Pick one. Runs never overlap, so combining them is safe.

| Way | How | Suits |
| --- | --- | --- |
| In the server | `JOB_SYNC_INTERVAL_MINUTES=60` | A server that stays up (paid Render instance). A sleeping free instance misses runs. |
| Command | `npm run sync:jobs` (prints the run as JSON; exit 1 = source failed, 2 = bad environment) | A Render cron job or any cron with the same environment. |
| Endpoint | `POST /api/internal/job-sync` with `Authorization: Bearer <JOB_SYNC_TOKEN>` | An external scheduler (GitHub Actions, cron-job.org). Off (404) until `JOB_SYNC_TOKEN` (32+ characters) is set. |
| By hand | "Sync now" on the admin Jobs page (`jobs:write`) | Checking a change right away. |

## 5. Environment variables

| Variable | Default | Meaning |
| --- | --- | --- |
| `JOB_SYNC_SOURCE_URL` | (empty: sync off) | The feed, sitemap or listing page. http(s); https expected in production. |
| `JOB_SYNC_SOURCE_TYPE` | `json-feed` | `json-feed` or `jsonld-pages`. |
| `JOB_SYNC_SOURCE_KEY` | `company-site` | The identity stored on each job. **Do not change it** after the first run: jobs would be imported again under the new key. |
| `JOB_SYNC_SOURCE_NAME` | `Company website` | How the admin names the source. |
| `JOB_SYNC_LINK_PATTERN` | (empty) | `jsonld-pages`: a regular expression the job page addresses match. |
| `JOB_SYNC_INTERVAL_MINUTES` | `0` (off) | In-server schedule. |
| `JOB_SYNC_MISSING_THRESHOLD` | `2` | Runs a job may be missing before it is archived. |
| `JOB_SYNC_NEW_STATUS` | `published` | `published` or `draft` for a newly imported job. |
| `JOB_SYNC_TOKEN` | (empty: endpoint off) | Bearer token of the trigger endpoint, 32+ characters. A secret. |

An invalid type, URL, link pattern or short token stops the server at start-up
with a message naming the variable.

## 6. Production checklist for the real source

To be done by a person with access to the company's systems:

1. Find out what the career site runs on and whether it offers a JSON feed or
   API of all open jobs (many ATS products do), or JobPosting JSON-LD on each job
   page (check one page with Google's Rich Results Test).
2. Confirm the id in it is stable across edits, and how a closed job is shown
   (removed, a status, or `validThrough`).
3. If neither format exists, or the API needs a key: an adapter is needed
   (section 2.3); do not point the sync at something else.
4. Set the variables on a **staging** database first with
   `JOB_SYNC_NEW_STATUS=draft`, run `npm run sync:jobs`, read the counts and the
   record errors, and compare a few jobs with the official postings.
5. Decide what happens to jobs that were entered by hand for the same postings:
   the sync does not match them (they have no source id), so they would appear
   twice. Archive the manual copies, or leave them and accept the duplicates.
6. Choose the schedule (section 4), then switch to `published`.

## 7. Semantic matching (future scope)

Not implemented in the current build. The job ranking orders candidates by the
rule-based ATS score, and skill gaps come from the rule-based match explanation;
neither needs an API key.

An earlier build had an embedding-based score (OpenAI embeddings of the approved
profile and the official job) shown next to the ATS score. It was removed so that
the application runs without paid AI services. If it is brought back, it should
stay an additional score that never changes the ATS result, use only the approved
profile, and have its similarity bounds calibrated on real ALLSEMIS data.

## 8. AI job intelligence (future scope)

Not implemented in the current build. An earlier build had a read-only,
evidence-checked AI reading of each official job (role, domain, seniority, key
skills, tools, responsibilities), refreshed after a sync. It was removed so that
the application runs without paid AI services. Importing and synchronising jobs
does not depend on it and works as described above.

Records an earlier build stored for either feature (`semanticmatches`,
`embeddingcaches`, `jobintelligences`) are not read; the ones tied to a candidate
or job are deleted with it.
