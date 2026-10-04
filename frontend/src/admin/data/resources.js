import { JOB_CATEGORIES, JOB_LOCATIONS } from '../../pages/talent/jobsContent.js';
import { CATEGORIES, ARTICLE_STATUSES, DEFAULT_AUTHOR } from '../../lib/insightsContent.js';
import { LOCATION_TYPES, LOCATION_STATUSES } from '../../lib/officeLocations.js';
import { SERVICE_ICONS } from '../../pages/employers/servicesContent.js';
import {
  APPLICATION_STATUSES, APPLICATION_SOURCES, REQUIREMENT_PRIORITIES, REQUIREMENT_STATUSES, ENQUIRY_STATUSES,
} from './recruitment.js';
import { formatDate, today } from '../lib/format.js';

/*
  Resource definitions - one entry per admin list. Each entry declares
  the collection it reads, its table columns, its filters and its edit
  fields. ResourceList, ResourceEditor and ResourceForm render every
  screen from these definitions, so adding a field to a resource is a
  change here, not a new component.

  editor: 'page'   rows open /<base>/:id, new records at /<base>/new
          'drawer' rows open an edit drawer on the list
          'link'   rows open a custom page (rowLink)
  newAs:  'page' where a drawer resource still has a /new route
*/

const candidateName = (item, state) => state.candidates.find((c) => c.id === item.candidateId)?.name || 'Removed candidate';
const jobTitle = (item, state) => state.jobs.find((j) => j.id === item.jobId)?.title || 'Removed job';
const CONTENT_STATUS_ACTIONS = [{ label: 'Publish', value: 'published' }, { label: 'Move to draft', value: 'draft' }];
const CONTENT_STATUSES = ['draft', 'published'];

export const RESOURCES = {
  jobs: {
    collection: 'jobs', title: 'Jobs', singular: 'job', eyebrow: 'Recruitment', idPrefix: 'job',
    description: 'Roles shown on the Talent page. Published jobs are public. Drafts and archived jobs are not.',
    basePath: '/admin/jobs', editor: 'page', canCreate: true, canDelete: true, titleKey: 'title',
    publicPath: (item) => (item.status === 'published' && item.slug ? `/talent/jobs/${item.slug}` : null),
    search: (item) => [item.title, item.category, item.location, item.department].join(' '),
    filters: [
      { key: 'status', label: 'Status', options: ['published', 'draft', 'archived'] },
      { key: 'category', label: 'Category', options: JOB_CATEGORIES },
    ],
    columns: [
      { key: 'title', label: 'Role', primary: true, sub: (item) => item.department },
      { key: 'category', label: 'Category' },
      { key: 'location', label: 'Location' },
      { key: 'experienceLevel', label: 'Experience' },
      { key: 'status', label: 'Status', type: 'badge' },
      { key: 'updatedAt', label: 'Updated', type: 'date' },
    ],
    statusActions: [{ label: 'Publish', value: 'published' }, { label: 'Unpublish', value: 'draft' }, { label: 'Archive', value: 'archived' }],
    blank: () => ({ title: '', slug: '', category: 'Semiconductor', department: '', location: 'Bangalore, IN', employmentType: 'Full-time', experienceLevel: 'Mid-Senior', summary: '', description: '', responsibilities: [], requiredSkills: [], preferredSkills: [], keywords: [], status: 'draft', featured: false, applicationEnabled: true, publishedAt: today() }),
    fields: [
      { key: 'title', label: 'Job title', required: true, wide: true },
      { key: 'slug', label: 'URL slug', hint: 'Used in the job page address.' },
      { key: 'department', label: 'Department' },
      { key: 'category', label: 'Category', type: 'select', options: JOB_CATEGORIES },
      { key: 'location', label: 'Location', type: 'select', options: JOB_LOCATIONS },
      { key: 'employmentType', label: 'Employment type', type: 'select', options: ['Full-time', 'Contract', 'Contract-to-hire'] },
      { key: 'experienceLevel', label: 'Experience', type: 'select', options: ['Entry-Level', 'Mid-Level', 'Mid-Senior', 'Senior', 'Lead / Principal'] },
      { key: 'summary', label: 'Summary', type: 'textarea', rows: 2 },
      { key: 'description', label: 'Description', type: 'textarea', rows: 5 },
      { key: 'responsibilities', label: 'Responsibilities', type: 'lines' },
      { key: 'requiredSkills', label: 'Required skills', type: 'tags', hint: 'The ATS rule checks compare these against each candidate profile.' },
      { key: 'preferredSkills', label: 'Preferred skills', type: 'tags' },
      { key: 'keywords', label: 'Search keywords', type: 'tags', wide: true },
      { key: 'featured', label: 'Feature this job', type: 'toggle' },
      { key: 'applicationEnabled', label: 'Accept applications', type: 'toggle' },
    ],
  },

  candidates: {
    collection: 'candidates', title: 'Candidates', singular: 'candidate', eyebrow: 'Recruitment',
    description: 'Structured profiles created from uploaded resumes. Open a candidate to see the profile, resume, applications and ATS results.',
    basePath: '/admin/candidates', editor: 'link', rowLink: (item) => `/admin/candidates/${item.id}`,
    search: (item) => [item.name, item.headline, item.location, item.skills.join(' ')].join(' '),
    filters: [{ key: 'extraction', label: 'Extraction', options: ['Complete', 'Needs review'] }],
    columns: [
      { key: 'name', label: 'Candidate', primary: true, sub: (item) => item.headline },
      { key: 'location', label: 'Location' },
      { key: 'experienceYears', label: 'Experience', value: (item) => `${item.experienceYears} yrs` },
      { key: 'skills', label: 'Skills', type: 'tags' },
      { key: 'extraction', label: 'Extraction', type: 'badge' },
      { key: 'applications', label: 'Applications', value: (item, state) => state.applications.filter((a) => a.candidateId === item.id).length },
    ],
  },

  applications: {
    collection: 'applications', title: 'Applications', singular: 'application', eyebrow: 'Recruitment',
    description: 'Every application, with its status, source and recruiter notes. Open a row to update it.',
    basePath: '/admin/applications', editor: 'drawer',
    drawerTitle: (item, state) => `${candidateName(item, state)} for ${jobTitle(item, state)}`,
    search: (item, state) => [candidateName(item, state), jobTitle(item, state), item.source].join(' '),
    filters: [
      { key: 'status', label: 'Status', options: APPLICATION_STATUSES },
      { key: 'source', label: 'Source', options: APPLICATION_SOURCES },
    ],
    columns: [
      { key: 'candidate', label: 'Candidate', primary: true, value: candidateName, sub: jobTitle },
      { key: 'status', label: 'Status', type: 'badge' },
      { key: 'source', label: 'Source' },
      { key: 'ats', label: 'ATS match', value: (item, state) => {
        const result = state.atsResults.find((r) => r.candidateId === item.candidateId && r.jobId === item.jobId);
        return result ? `${result.overall} / 100` : 'Not evaluated';
      } },
      { key: 'submittedAt', label: 'Submitted', type: 'date' },
    ],
    summary: (item, state) => [['Candidate', candidateName(item, state)], ['Job', jobTitle(item, state)], ['Submitted', formatDate(item.submittedAt)]],
    links: (item) => [
      { label: 'Candidate profile', to: `/admin/candidates/${item.candidateId}` },
      { label: 'ATS result', to: `/admin/ats/${item.candidateId}?job=${item.jobId}` },
    ],
    fields: [
      { key: 'status', label: 'Status', type: 'select', options: APPLICATION_STATUSES },
      { key: 'source', label: 'Source', type: 'select', options: APPLICATION_SOURCES },
      { key: 'recruiterNotes', label: 'Recruiter notes', type: 'textarea', rows: 6 },
    ],
  },

  requirements: {
    collection: 'requirements', title: 'Requirements', singular: 'requirement', eyebrow: 'Recruitment', idPrefix: 'req',
    description: 'Hiring requirements being worked on: the role, what it needs and how urgent it is.',
    basePath: '/admin/requirements', editor: 'drawer', canCreate: true, canDelete: true, titleKey: 'role',
    search: (item) => [item.role, item.location, item.skills.join(' ')].join(' '),
    filters: [
      { key: 'status', label: 'Status', options: REQUIREMENT_STATUSES },
      { key: 'priority', label: 'Priority', options: REQUIREMENT_PRIORITIES },
    ],
    columns: [
      { key: 'role', label: 'Role', primary: true, sub: (item) => item.location },
      { key: 'skills', label: 'Skills', type: 'tags' },
      { key: 'experience', label: 'Experience' },
      { key: 'openings', label: 'Openings' },
      { key: 'priority', label: 'Priority', type: 'badge' },
      { key: 'status', label: 'Status', type: 'badge' },
    ],
    blank: () => ({ role: '', skills: [], experience: '', education: '', location: '', priority: 'Medium', status: 'Open', openings: 1, notes: '', createdAt: today() }),
    fields: [
      { key: 'role', label: 'Role', required: true, wide: true },
      { key: 'skills', label: 'Skills', type: 'tags', wide: true },
      { key: 'experience', label: 'Experience' },
      { key: 'education', label: 'Education' },
      { key: 'location', label: 'Location' },
      { key: 'openings', label: 'Openings', type: 'number', step: 1 },
      { key: 'priority', label: 'Priority', type: 'select', options: REQUIREMENT_PRIORITIES },
      { key: 'status', label: 'Status', type: 'select', options: REQUIREMENT_STATUSES },
      { key: 'notes', label: 'Notes', type: 'textarea' },
    ],
  },

  enquiries: {
    collection: 'enquiries', title: 'Enquiries', singular: 'enquiry', eyebrow: 'Recruitment',
    description: 'Messages sent through the Contact page, by route: employer, candidate or general.',
    basePath: '/admin/enquiries', editor: 'drawer', canDelete: true, titleKey: 'subject',
    search: (item) => [item.name, item.email, item.subject, item.company].join(' '),
    filters: [
      { key: 'status', label: 'Status', options: ENQUIRY_STATUSES },
      { key: 'type', label: 'Route', options: ['employer', 'candidate', 'general'] },
    ],
    columns: [
      { key: 'name', label: 'From', primary: true, sub: (item) => item.email },
      { key: 'type', label: 'Route', type: 'badge' },
      { key: 'subject', label: 'Subject' },
      { key: 'status', label: 'Status', type: 'badge' },
      { key: 'receivedAt', label: 'Received', type: 'date' },
    ],
    summary: (item) => [['From', item.name], ['Email', item.email], ['Phone', item.phone || 'Not provided'], ['Company', item.company || 'Not provided'], ['Received', formatDate(item.receivedAt)]],
    fields: [
      { key: 'message', label: 'Message', type: 'readonly' },
      { key: 'status', label: 'Status', type: 'select', options: ENQUIRY_STATUSES },
      { key: 'internalNotes', label: 'Internal notes', type: 'textarea' },
    ],
  },

  insights: {
    collection: 'insights', title: 'Insights', singular: 'article', eyebrow: 'Website', idPrefix: 'article',
    description: 'Articles on the Insights pages. Drafts are never shown on the site.',
    basePath: '/admin/insights', editor: 'page', canCreate: true, canDelete: true, titleKey: 'title',
    publicPath: (item) => (item.status === 'published' && item.slug ? `/insights/${item.slug}` : null),
    search: (item) => [item.title, item.category, item.author, (item.tags || []).join(' ')].join(' '),
    filters: [
      { key: 'status', label: 'Status', options: ARTICLE_STATUSES },
      { key: 'category', label: 'Category', options: CATEGORIES },
    ],
    columns: [
      { key: 'title', label: 'Article', primary: true, sub: (item) => item.excerpt },
      { key: 'category', label: 'Category' },
      { key: 'author', label: 'Author' },
      { key: 'status', label: 'Status', type: 'badge' },
      { key: 'date', label: 'Publish date', type: 'date' },
    ],
    statusActions: CONTENT_STATUS_ACTIONS,
    blank: () => ({ title: '', slug: '', category: 'Semiconductor', tags: [], topics: ['SEMICONDUCTOR'], excerpt: '', image: '', alt: '', body: [], author: DEFAULT_AUTHOR, date: today(), readTime: '', status: 'draft', featured: false, seoTitle: '', seoDescription: '' }),
    fields: [
      { key: 'title', label: 'Title', required: true, wide: true },
      { key: 'slug', label: 'URL slug' },
      { key: 'category', label: 'Category', type: 'select', options: CATEGORIES },
      { key: 'tags', label: 'Tags', type: 'tags' },
      { key: 'topics', label: 'Filter chips', type: 'tags', hint: 'Shown as filters on the Insights page. The first one labels the article card.' },
      { key: 'excerpt', label: 'Excerpt', type: 'textarea', rows: 2 },
      { key: 'image', label: 'Cover image URL', wide: true },
      { key: 'alt', label: 'Cover image description', wide: true, hint: 'Read aloud by screen readers.' },
      { key: 'body', label: 'Body', type: 'body', hint: 'Leave a blank line between blocks. Start a line with "## " for a heading, "> " for a pull quote, "- " for list items.' },
      { key: 'author', label: 'Author' },
      { key: 'date', label: 'Publish date', type: 'date' },
      { key: 'readTime', label: 'Read time' },
      { key: 'featured', label: 'Feature on the Insights page', type: 'toggle' },
      { key: 'seoTitle', label: 'SEO title', wide: true },
      { key: 'seoDescription', label: 'SEO description', type: 'textarea', rows: 2 },
    ],
  },

  stories: {
    collection: 'stories', title: 'Stories', singular: 'story', eyebrow: 'Website', idPrefix: 'story',
    description: 'Client and candidate stories on the homepage. Publish only quotes you have permission to use.',
    basePath: '/admin/stories', editor: 'drawer', newAs: 'page', canCreate: true, canDelete: true, titleKey: 'name',
    search: (item) => [item.quote, item.name, item.role].join(' '),
    filters: [{ key: 'status', label: 'Status', options: CONTENT_STATUSES }],
    columns: [
      { key: 'quote', label: 'Quote', primary: true, clamp: true, sub: (item) => `${item.name}, ${item.role}` },
      { key: 'status', label: 'Status', type: 'badge' },
    ],
    statusActions: CONTENT_STATUS_ACTIONS,
    blank: () => ({ quote: '', name: '', role: '', photo: '', status: 'draft' }),
    fields: [
      { key: 'quote', label: 'Quote', type: 'textarea', rows: 5 },
      { key: 'name', label: 'Attribution', hint: 'A name or a job title.' },
      { key: 'role', label: 'Organisation or description' },
      { key: 'photo', label: 'Image URL', wide: true },
      { key: 'status', label: 'Status', type: 'select', options: CONTENT_STATUSES },
    ],
  },

  expertise: {
    collection: 'expertise', title: 'Expertise', singular: 'sector', eyebrow: 'Website', idPrefix: 'sector',
    description: 'The sectors shown across the site and on each sector page.',
    basePath: '/admin/expertise', editor: 'drawer', newAs: 'page', canCreate: true, titleKey: 'name',
    search: (item) => [item.name, item.slug, item.domains.join(' ')].join(' '),
    filters: [{ key: 'status', label: 'Status', options: CONTENT_STATUSES }],
    columns: [
      { key: 'name', label: 'Sector', primary: true, sub: (item) => `/expertise/${item.slug}` },
      { key: 'num', label: 'Order' },
      { key: 'domains', label: 'Capabilities', type: 'tags' },
      { key: 'status', label: 'Status', type: 'badge' },
    ],
    statusActions: CONTENT_STATUS_ACTIONS,
    blank: () => ({ name: '', shortName: '', slug: '', num: '', desc: '', image: '', alt: '', introduction: '', overview: '', domains: [], roles: [], hiringChallenges: [], relatedInsight: '', status: 'draft' }),
    fields: [
      { key: 'name', label: 'Name', required: true, wide: true },
      { key: 'shortName', label: 'Short name' },
      { key: 'slug', label: 'URL slug' },
      { key: 'num', label: 'Order' },
      { key: 'status', label: 'Status', type: 'select', options: CONTENT_STATUSES },
      { key: 'desc', label: 'Description', type: 'textarea', rows: 2 },
      { key: 'image', label: 'Hero visual URL', wide: true },
      { key: 'alt', label: 'Hero visual description', wide: true },
      { key: 'introduction', label: 'Introduction', type: 'textarea', rows: 2 },
      { key: 'overview', label: 'Content', type: 'textarea', rows: 6 },
      { key: 'domains', label: 'Capabilities', type: 'tags', wide: true },
      { key: 'roles', label: 'Roles', type: 'tags', wide: true },
      { key: 'hiringChallenges', label: 'Hiring challenges', type: 'lines', hint: 'One per line, as "Title: detail".' },
      { key: 'relatedInsight', label: 'Related insight', type: 'select', allowEmpty: true, wide: true, options: (state) => state.insights.map((a) => ({ value: a.slug, label: a.title })) },
    ],
  },

  services: {
    collection: 'services', title: 'Services', singular: 'service', eyebrow: 'Website', idPrefix: 'service',
    description: 'The service lines on the homepage and their pages under /employers.',
    basePath: '/admin/services', editor: 'drawer', canCreate: true, titleKey: 'name',
    search: (item) => [item.name, item.slug, item.description].join(' '),
    columns: [
      { key: 'name', label: 'Service', primary: true, sub: (item) => `/employers/${item.slug}` },
      { key: 'num', label: 'Order' },
      { key: 'ctaLabel', label: 'Call to action' },
      { key: 'status', label: 'Status', type: 'badge' },
    ],
    blank: () => ({ name: '', slug: '', num: '', icon: 'die', status: 'draft', description: '', headline: '', lead: '', fit: [], process: [], receive: [], ctaLabel: '', ctaTo: '/contact?type=employer' }),
    fields: [
      { key: 'name', label: 'Name', required: true },
      { key: 'slug', label: 'URL slug' },
      { key: 'num', label: 'Order' },
      { key: 'icon', label: 'Icon', type: 'select', options: SERVICE_ICONS },
      { key: 'status', label: 'Status', type: 'select', options: CONTENT_STATUSES },
      { key: 'description', label: 'Description', type: 'textarea', rows: 3, hint: 'Shown on the homepage service card.' },
      { key: 'headline', label: 'Page headline', wide: true },
      { key: 'lead', label: 'Page introduction', type: 'textarea', rows: 2 },
      { key: 'fit', label: 'When it fits', type: 'lines' },
      { key: 'process', label: 'How it runs', type: 'lines', hint: 'One step per line, as "Step: detail".' },
      { key: 'receive', label: 'What the client receives', type: 'lines' },
      { key: 'ctaLabel', label: 'Button label' },
      { key: 'ctaTo', label: 'Button link' },
    ],
  },

  locations: {
    collection: 'locations', title: 'Locations', singular: 'location', eyebrow: 'Website', idPrefix: 'location',
    description: 'Points on the engineering network map. An office is a confirmed ALLSEMIS office with an address. A network node is shown on the map and is never presented as an office.',
    basePath: '/admin/locations', editor: 'drawer', canCreate: true, canDelete: true, titleKey: 'city',
    search: (item) => [item.city, item.country, item.type].join(' '),
    filters: [{ key: 'type', label: 'Type', options: LOCATION_TYPES }],
    columns: [
      { key: 'city', label: 'City', primary: true, sub: (item) => item.country },
      { key: 'type', label: 'Type', type: 'badge' },
      { key: 'status', label: 'Status', type: 'badge' },
      { key: 'coordinates', label: 'Coordinates', value: (item) => `${Number(item.lat).toFixed(2)}, ${Number(item.lon).toFixed(2)}` },
      { key: 'active', label: 'On the map', type: 'badge', value: (item) => (item.active ? 'Shown' : 'Hidden') },
    ],
    blank: () => ({ city: '', country: '', region: '', type: 'network', status: 'listed', address: [], phone: '', email: '', lat: 0, lon: 0, description: '', labelSide: 'right', isHeadquarters: false, active: true }),
    fields: [
      { key: 'city', label: 'City', required: true },
      { key: 'country', label: 'Country' },
      { key: 'type', label: 'Type', type: 'select', options: LOCATION_TYPES, hint: 'Choose "office" only for a confirmed ALLSEMIS office.' },
      { key: 'status', label: 'Status', type: 'select', options: LOCATION_STATUSES },
      { key: 'lat', label: 'Latitude', type: 'number' },
      { key: 'lon', label: 'Longitude', type: 'number' },
      { key: 'address', label: 'Address', type: 'lines', rows: 3, hint: 'Offices only. Leave empty for a network node.' },
      { key: 'description', label: 'Description', type: 'textarea', rows: 2 },
      { key: 'labelSide', label: 'Map label side', type: 'select', options: ['right', 'left'] },
      { key: 'region', label: 'Region' },
      { key: 'isHeadquarters', label: 'Headquarters', type: 'toggle' },
      { key: 'active', label: 'Show on the map', type: 'toggle' },
    ],
  },
};
