import { ok } from '../utils/apiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { notFound } from '../utils/AppError.js';
import { text } from '../utils/query.js';
import { Job, Insight, Story, Expertise, Service, Location, insightOnLanding, storyOnLanding } from '../models/index.js';
import { getSiteSettings } from '../services/settingsService.js';

/*
  Public, read-only content. Every query here is restricted to
  published (or, for locations, active) records, and every response is
  built from an explicit list of fields, so a draft or an internal
  field can never be returned to a visitor. No candidate, application,
  requirement, referral or enquiry data is reachable from these routes.
*/

// A browser may keep a copy but must check it with the server before
// using it (the check is a small conditional request). So a page shows
// what is published now: a story or article that was just unpublished
// is gone at the next page load, not a minute later.
const cache = (res) => res.set('Cache-Control', 'public, max-age=0, must-revalidate');
const day = (date) => (date ? new Date(date).toISOString().slice(0, 10) : '');

function publicJob(job) {
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

export const listJobs = asyncHandler(async (req, res) => {
  const jobs = await Job.find({ status: 'published' }).sort({ featured: -1, publishedAt: -1 }).limit(500);
  cache(res);
  ok(res, jobs.map(publicJob));
});

export const getJob = asyncHandler(async (req, res) => {
  const slug = text(req.params.slug, 100).toLowerCase();
  const job = slug ? await Job.findOne({ slug, status: 'published' }) : null;
  if (!job) throw notFound('That position is not available.');
  cache(res);
  ok(res, publicJob(job));
});

function publicInsight(article, { withBody = false } = {}) {
  const out = {
    slug: article.slug,
    title: article.title,
    excerpt: article.excerpt,
    category: article.category,
    tags: article.tags,
    topics: article.topics,
    image: article.image?.url || '',
    alt: article.image?.alt || '',
    author: article.author,
    date: article.date,
    readTime: article.readTime,
    featured: article.featured,
    showOnLanding: insightOnLanding(article),
    landingOrder: article.landingOrder || 0,
    status: 'published',
    seoTitle: article.seoTitle,
    seoDescription: article.seoDescription,
  };
  if (withBody) out.body = article.body.map((block) => (block.type === 'list' ? { type: 'list', items: block.items || [] } : { type: block.type, text: block.text }));
  return out;
}

export const listInsights = asyncHandler(async (req, res) => {
  // Newest first; articles with the same date in the order the admin
  // list shows them (the one added last first).
  const articles = await Insight.find({ status: 'published' }).sort({ date: -1, createdAt: -1 }).limit(500);
  cache(res);
  ok(res, articles.map((article) => publicInsight(article)));
});

export const getInsight = asyncHandler(async (req, res) => {
  const slug = text(req.params.slug, 100).toLowerCase();
  const article = slug ? await Insight.findOne({ slug, status: 'published' }) : null;
  if (!article) throw notFound('That article is not available.');
  cache(res);
  ok(res, publicInsight(article, { withBody: true }));
});

export const listStories = asyncHandler(async (req, res) => {
  const stories = await Story.find({ status: 'published' }).sort({ order: 1, createdAt: 1 }).limit(100);
  cache(res);
  ok(res, stories.map((story) => ({
    id: String(story._id), quote: story.quote, name: story.name, role: story.role, photo: story.photo?.url || '', alt: story.photo?.alt || '', showOnLanding: storyOnLanding(story), status: 'published',
  })));
});

export const listExpertise = asyncHandler(async (req, res) => {
  const sectors = await Expertise.find({ status: 'published' }).sort({ num: 1 }).limit(100);
  cache(res);
  ok(res, sectors.map((sector) => ({
    id: sector.key,
    num: sector.num,
    name: sector.name,
    shortName: sector.shortName,
    slug: sector.slug,
    desc: sector.desc,
    image: sector.image?.url || '',
    alt: sector.image?.alt || '',
    introduction: sector.introduction,
    domainOverview: sector.overview,
    domains: sector.domains,
    roles: sector.roles,
    hiringChallenges: sector.hiringChallenges,
    processFlow: sector.processFlow,
    representativeSearches: sector.representativeSearches,
    relatedInsight: sector.relatedInsight,
  })));
});

export const listServices = asyncHandler(async (req, res) => {
  const services = await Service.find({ status: 'published' }).sort({ num: 1 }).limit(100);
  cache(res);
  ok(res, services.map((service) => ({
    id: service.slug,
    num: service.num,
    slug: service.slug,
    name: service.name,
    icon: service.icon,
    status: 'published',
    description: service.description,
    cta: { label: service.ctaLabel, to: service.ctaTo },
    page: {
      headline: service.headline,
      lead: service.lead,
      fitTitle: service.fitTitle,
      fit: service.fit,
      processTitle: service.processTitle,
      process: service.process,
      receiveTitle: service.receiveTitle,
      receive: service.receive,
      tagsTitle: service.tagsTitle,
      tags: service.tags,
      questions: service.questions,
    },
  })));
});

export const listLocations = asyncHandler(async (req, res) => {
  // Oldest first; records created in the same instant (the seed) keep
  // the order they were inserted in.
  const locations = await Location.find({ active: true }).sort({ createdAt: 1, _id: 1 }).limit(100);
  cache(res);
  ok(res, locations.map((location) => {
    const office = location.type === 'office';
    return {
      id: location.key,
      city: location.city,
      country: location.country,
      region: location.region,
      label: location.label,
      type: location.type,
      status: location.status,
      isHeadquarters: office && location.isHeadquarters,
      // A network node never exposes an address or contact details.
      address: office ? location.address : [],
      phone: office ? location.phone : '',
      email: office ? location.email : '',
      hours: office ? location.hours : [],
      coordinates: [location.lon, location.lat],
      description: location.description,
      visual: { labelSide: location.labelSide, ...(location.labelRaise ? { labelRaise: location.labelRaise } : {}) },
      active: true,
    };
  }));
});

export const getSite = asyncHandler(async (req, res) => {
  const settings = await getSiteSettings();
  cache(res);
  ok(res, { contact: settings.toJSON().contact });
});
