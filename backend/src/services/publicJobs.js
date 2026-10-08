import { Job } from '../models/index.js';

/*
  What a visitor may know about a job: the published fields, listed one
  by one, so a draft or an internal field (a requirement profile, an AI
  comparison, who created it) can never reach the public. Used by the
  public job API (controllers/publicController.js) and by the public
  chat (services/chat/), so both show exactly the same thing.
*/

const day = (date) => (date ? new Date(date).toISOString().slice(0, 10) : '');

export function publicJob(job) {
  return {
    id: String(job._id),
    slug: job.slug,
    title: job.title,
    category: job.category,
    department: job.department,
    location: job.location,
    employmentType: job.employmentType,
    experienceLevel: job.experienceLevel,
    summary: job.summary,
    description: job.description,
    responsibilities: job.responsibilities,
    requiredSkills: job.requiredSkills,
    preferredSkills: job.preferredSkills,
    keywords: job.keywords,
    status: 'published',
    featured: job.featured,
    applicationEnabled: job.applicationEnabled,
    publishedAt: day(job.publishedAt),
    updatedAt: day(job.updatedAt),
  };
}

// Every published job, featured and newest first: the list the Talent
// page shows.
export async function listPublishedJobs() {
  const jobs = await Job.find({ status: 'published' }).sort({ featured: -1, publishedAt: -1 }).limit(500);
  return jobs.map(publicJob);
}
