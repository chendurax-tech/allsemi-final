// Talent jobs - the filter options for the Talent page and the helper
// that picks related positions for a job page.
//
// JOB_CATEGORIES and JOB_LOCATIONS are the usual choices, not the only
// ones: the Talent page adds a chip for any other category or location
// a published job has (jobChips below).
//
// There are no job records in this file. The public pages (Talent.jsx,
// JobDetail.jsx) read jobs from the backend through
// lib/usePublicData.js: published jobs only, created and managed in
// the admin (GET /api/public/jobs, GET /api/public/jobs/:slug). The
// admin's job form reads JOB_CATEGORIES and JOB_LOCATIONS from here
// too (admin/data/resources.js), so the filters on the Talent page and
// the choices in the admin stay the same list.

export const JOB_CATEGORIES = [
  'Semiconductor', 'AI & Cloud', 'Automotive', 'Aerospace', 'Healthcare',
];

export const JOB_LOCATIONS = [
  'Bangalore, IN', 'Remote (India)', 'Hybrid',
];

// Category and location names are matched without regard to capitals
// or spaces at the ends, however they were typed.
const sameName = (a, b) => String(a ?? '').trim().toLowerCase() === String(b ?? '').trim().toLowerCase();

// Whether a job belongs to a filter chip. `field` is 'category' or
// 'location'.
export function hasChip(job, field, chip) {
  return sameName(job[field], chip);
}

// The chips to offer for a filter: the fixed list in its order, then
// any other category (or location) a published job carries, so a job
// is never unreachable by filter. `jobs` is the published list from
// the API.
export function jobChips(fixed, jobs, field) {
  const chips = [...fixed];
  for (const job of jobs) {
    const name = String(job[field] ?? '').trim();
    if (name && !chips.some((chip) => sameName(chip, name))) chips.push(name);
  }
  return chips;
}

// Up to `count` other positions for a job page's "related positions"
// block: jobs in the same category first, the rest in the order they
// were given. `jobs` is the published list from the API.
export function relatedJobs(jobs, current, count = 3) {
  const sameCategory = (job) => Number(job.category === current.category);
  return jobs
    .filter((job) => job.slug !== current.slug)
    .sort((a, b) => sameCategory(b) - sameCategory(a))
    .slice(0, count);
}
