import { JOB_CATEGORIES, JOB_LOCATIONS } from '../../pages/talent/jobsContent.js';
import { CATEGORIES, DEFAULT_AUTHOR } from '../../lib/insightsContent.js';
import { SERVICE_ICONS } from '../../pages/employers/servicesContent.js';
import { applicationsApi, requirementsApi, enquiriesApi } from '../../lib/api/index.js';
import ShortlistPanel from '../components/ShortlistPanel.jsx';
import {
  APPLICATION_STATUSES, APPLICATION_SOURCES, RECRUITMENT_LABELS, REQUIREMENT_PRIORITIES, REQUIREMENT_STATUSES, HIRING_TYPES,
  WORK_MODES, REFERRAL_STATUSES, ENQUIRY_STATUSES, ENQUIRY_TYPES, JOB_STATUSES, CONTENT_STATUSES, EMPLOYMENT_TYPES,
  EXPERIENCE_LEVELS, LOCATION_TYPES, LOCATION_STATUSES,
} from './enums.js';
import { formatDate, today } from '../lib/format.js';

/*
  Resource definitions - one entry per admin list. Each entry declares
  the collection it reads, its table columns, its filters and its edit
  fields. ResourceList, ResourceEditor and ResourceForm render every
  screen from these definitions, so adding a field to a resource is a
  change here, not a new component.

  Every field key is a field of the backend model, and every editable
  one is accepted by the backend validator for that resource.

  editor: 'page'   rows open /<base>/:id, new records at /<base>/new
          'drawer' rows open an edit drawer on the list
          'link'   rows open a custom page (rowLink)
  newAs:  'page' where a drawer resource still has a /new route

  permissions: what the signed-in role needs to read, change, publish
  or delete the resource. The screens use it to hide what a role
  cannot use. The server checks the same permission on every request.

  A filter compares item[key] with the chosen value unless it gives
  its own match(item, value, state). Filter and select options may be
  a function of the loaded data.

  panel: a component shown in the edit drawer above the form, for an
  action that is more than a field edit (the shortlist action).

  Recruitment has one workflow step. An application is New until it is
  shortlisted, through ShortlistPanel and nothing else. Interviewed,
  Rejected and Selected are labels: tags that can be put on a candidate
  or an application and filtered by, with no effect on anything.
*/

const candidateName = (item, state) => state.candidates.find((c) => c.id === item.candidateId)?.name || 'Removed candidate';
const jobTitle = (item, state) => {
  if (!item.jobId) return 'General application';
  return state.jobs.find((j) => j.id === item.jobId)?.title || 'Removed job';
};
const CONTENT_STATUS_ACTIONS = [{ label: 'Publish', value: 'published' }, { label: 'Move to draft', value: 'draft' }];
const CONTENT_PERMISSIONS = { read: 'content:read', write: 'content:write', publish: 'content:publish', remove: 'content:delete' };
const emptyMedia = () => ({ url: '', publicId: '', width: null, height: null, format: '', alt: '' });

// The values a collection actually holds for a free-text field, for use
// as filter options.
const valuesOf = (collection, key) => (state) => [...new Set(state[collection].map((item) => item[key]).filter(Boolean))].sort();

const EXPERIENCE_BANDS = [
  { value: 'under-3', label: 'Under 3 years', test: (years) => years < 3 },
  { value: '3-5', label: '3 to 5 years', test: (years) => years >= 3 && years < 6 },
  { value: '6-9', label: '6 to 9 years', test: (years) => years >= 6 && years < 10 },
  { value: '10-plus', label: '10 years or more', test: (years) => years >= 10 },
  { value: 'not-stated', label: 'Not stated', test: () => false },
];
const LABEL_FILTER = { key: 'labels', label: 'Label', options: RECRUITMENT_LABELS, match: (item, value) => (item.labels || []).includes(value) };
const LABEL_HINT = 'Tags for your own reference and for filtering. A label does not change the status, send an email or run an evaluation.';
const shortlistedCount = (item, state) => state.applications.filter((a) => a.candidateId === item.id && a.status === 'SHORTLISTED').length;
const hasYears = (item) => item.experienceYears !== null && item.experienceYears !== undefined;
const newestFirst = (key) => (a, b) => String(b[key] || '').localeCompare(String(a[key] || ''));
const oldestFirst = (key) => (a, b) => String(a[key] || '').localeCompare(String(b[key] || ''));

export const RESOURCES = {
  jobs: {
    collection: 'jobs', title: 'Jobs', singular: 'job', eyebrow: 'Recruitment',
    description: 'Roles shown on the Talent page. Published jobs are public. Drafts and archived jobs are not.',
    basePath: '/admin/jobs', editor: 'page', canCreate: true, canDelete: true, titleKey: 'title',
    permissions: { read: 'jobs:read', write: 'jobs:write', publish: 'jobs:publish', remove: 'jobs:delete' },
    publicPath: (item) => (item.status === 'published' && item.slug ? `/talent/jobs/${item.slug}` : null),
    search: (item) => [item.title, item.category, item.location, item.department].join(' '),
    filters: [
      { key: 'status', label: 'Status', options: JOB_STATUSES },
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
    deleteNote: 'A job that has applications cannot be deleted. Archive it instead, so its applications keep their job.',
    blank: () => ({ title: '', slug: '', category: 'Semiconductor', department: '', location: 'Bangalore, IN', employmentType: 'Full-time', experienceLevel: 'Mid-Senior', summary: '', description: '', responsibilities: [], requiredSkills: [], preferredSkills: [], keywords: [], status: 'draft', featured: false, applicationEnabled: true }),
    fields: [
      { key: 'title', label: 'Job title', required: true, wide: true },
      { key: 'slug', label: 'URL slug', hint: 'Used in the job page address. Leave empty to create it from the title.' },
      { key: 'department', label: 'Department' },
      { key: 'category', label: 'Category', type: 'select', options: JOB_CATEGORIES },
      { key: 'location', label: 'Location', type: 'select', options: JOB_LOCATIONS },
      { key: 'employmentType', label: 'Employment type', type: 'select', options: EMPLOYMENT_TYPES },
      { key: 'experienceLevel', label: 'Experience', type: 'select', options: EXPERIENCE_LEVELS },
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
    description: 'People who applied through the website or were added from a referral. Open a candidate to see the profile, resume, applications, ATS results and labels, and to shortlist an application.',
    basePath: '/admin/candidates', editor: 'link', rowLink: (item) => `/admin/candidates/${item.id}`,
    permissions: { read: 'candidates:read', write: 'candidates:write', remove: 'candidates:delete' },
    search: (item) => [item.name, item.email, item.headline, item.domain, item.location, (item.skills || []).join(' ')].join(' '),
    filters: [
      {
        key: 'shortlisted', label: 'Shortlisted', options: [{ value: 'yes', label: 'Shortlisted' }, { value: 'no', label: 'Not shortlisted' }],
        match: (item, value, state) => (shortlistedCount(item, state) > 0) === (value === 'yes'),
      },
      LABEL_FILTER,
      { key: 'domain', label: 'Domain', options: valuesOf('candidates', 'domain') },
      { key: 'source', label: 'Source', options: APPLICATION_SOURCES },
      { key: 'location', label: 'Location', options: valuesOf('candidates', 'location') },
      {
        key: 'experience', label: 'Experience', options: EXPERIENCE_BANDS.map(({ value, label }) => ({ value, label })),
        match: (item, value) => (value === 'not-stated' ? !hasYears(item) : hasYears(item) && EXPERIENCE_BANDS.find((band) => band.value === value).test(item.experienceYears)),
      },
    ],
    columns: [
      { key: 'name', label: 'Candidate', primary: true, sub: (item) => item.headline },
      { key: 'location', label: 'Location' },
      { key: 'experienceYears', label: 'Experience', value: (item) => (hasYears(item) ? `${item.experienceYears} yrs` : 'Not stated') },
      { key: 'skills', label: 'Skills', type: 'tags' },
      { key: 'labels', label: 'Labels', type: 'labels' },
      { key: 'source', label: 'Source', type: 'enum' },
      {
        key: 'applications', label: 'Applications', value: (item, state) => {
          const total = state.applications.filter((a) => a.candidateId === item.id).length;
          const shortlisted = shortlistedCount(item, state);
          return shortlisted ? `${total}, ${shortlisted} shortlisted` : String(total);
        },
      },
    ],
    // Edited in a drawer on the candidate page. The email identifies
    // the candidate and the labels have their own control there, so
    // neither is listed here. A candidate has no status: the status
    // belongs to each application.
    fields: [
      { key: 'name', label: 'Name', required: true, wide: true },
      { key: 'headline', label: 'Current role' },
      { key: 'domain', label: 'Domain' },
      { key: 'experienceYears', label: 'Experience in years', type: 'number' },
      { key: 'phone', label: 'Phone' },
      { key: 'location', label: 'Location' },
      { key: 'preferredLocation', label: 'Preferred location' },
      { key: 'noticePeriod', label: 'Notice period' },
      { key: 'expectedCompensation', label: 'Expected compensation' },
      { key: 'profileUrl', label: 'Profile link', wide: true, hint: 'A full link starting with https://.' },
      { key: 'source', label: 'Source', type: 'select', options: APPLICATION_SOURCES },
      { key: 'skills', label: 'Skills', type: 'tags', wide: true },
      { key: 'summary', label: 'Summary', type: 'textarea', rows: 5 },
    ],
  },

  applications: {
    collection: 'applications', title: 'Applications', singular: 'application', eyebrow: 'Recruitment',
    description: 'Every application. An application is New until you shortlist it, which emails the candidate. Open a row to review it, shortlist it, label it or add notes.',
    basePath: '/admin/applications', editor: 'drawer',
    permissions: { read: 'applications:read', write: 'applications:write' },
    drawerTitle: (item, state) => `${candidateName(item, state)} for ${jobTitle(item, state)}`,
    search: (item, state) => [candidateName(item, state), jobTitle(item, state), item.source].join(' '),
    panel: ShortlistPanel,
    filters: [
      { key: 'status', label: 'Status', options: APPLICATION_STATUSES },
      LABEL_FILTER,
      { key: 'source', label: 'Source', options: APPLICATION_SOURCES },
      { key: 'jobId', label: 'Job', options: (state) => state.jobs.map((job) => ({ value: job.id, label: job.title })) },
    ],
    sorts: [
      { value: 'newest', label: 'Newest first', compare: newestFirst('submittedAt') },
      { value: 'oldest', label: 'Oldest first', compare: oldestFirst('submittedAt') },
    ],
    columns: [
      { key: 'candidate', label: 'Candidate', primary: true, value: candidateName, sub: jobTitle },
      { key: 'status', label: 'Status', type: 'badge' },
      { key: 'labels', label: 'Labels', type: 'labels' },
      { key: 'source', label: 'Source', type: 'enum' },
      { key: 'ats', label: 'ATS score', value: (item, state) => {
        const result = state.atsResults.find((r) => r.candidateId === item.candidateId && r.jobId === item.jobId);
        return result ? `${result.totalScore} / 100` : 'Not evaluated';
      } },
      { key: 'submittedAt', label: 'Submitted', type: 'date' },
    ],
    // The second group is what was typed into the form for this
    // application. A later application from the same email does not
    // change the candidate profile, so the two can differ.
    summary: (item, state) => {
      const sent = item.submittedProfile;
      const rows = [['Candidate', candidateName(item, state)], ['Job', jobTitle(item, state)], ['Submitted', formatDate(item.submittedAt)]];
      if (!sent) return rows;
      return [
        ...rows,
        ['Name on the form', sent.name || 'Not stated'],
        ['Role on the form', sent.headline || 'Not stated'],
        ['Experience on the form', sent.experienceYears === null || sent.experienceYears === undefined ? 'Not stated' : `${sent.experienceYears} yrs`],
        ['Skills on the form', (sent.skills || []).join(', ') || 'Not stated'],
        ['Phone on the form', sent.phone || 'Not stated'],
      ];
    },
    links: (item) => [
      { label: 'Candidate profile', to: `/admin/candidates/${item.candidateId}`, permission: 'candidates:read' },
      ...(item.jobId ? [{ label: 'ATS result', to: `/admin/ats/${item.candidateId}?job=${item.jobId}`, permission: 'ats:read' }] : []),
    ],
    documents: (item) => (item.resume ? [{
      label: 'Open resume', permission: 'resumes:read', request: () => applicationsApi.resumeUrl(item.id),
      note: `${item.resume.fileName}, the resume sent with this application. The link expires shortly after it is issued and each access is recorded.`,
    }] : []),
    fields: [
      { key: 'message', label: 'Message from the candidate', type: 'readonly' },
      { key: 'labels', label: 'Labels', type: 'labels', hint: LABEL_HINT },
      { key: 'source', label: 'Source', type: 'select', options: APPLICATION_SOURCES },
      { key: 'recruiterNotes', label: 'Recruiter notes', type: 'textarea', rows: 6 },
    ],
  },

  requirements: {
    collection: 'requirements', title: 'Requirements', singular: 'requirement', eyebrow: 'Recruitment',
    description: 'Hiring requirements sent through the Hire Talent form or entered here: who is hiring, the role, what it needs and how urgent it is.',
    basePath: '/admin/requirements', editor: 'drawer', canCreate: true, canDelete: true, titleKey: 'role',
    permissions: { read: 'requirements:read', write: 'requirements:write', remove: 'requirements:delete' },
    search: (item) => [item.role, item.company, item.contactName, item.email, item.location, item.domain, (item.skills || []).join(' ')].join(' '),
    filters: [
      { key: 'status', label: 'Status', options: REQUIREMENT_STATUSES },
      { key: 'hiringType', label: 'Hiring type', options: HIRING_TYPES },
      { key: 'domain', label: 'Domain', options: valuesOf('requirements', 'domain') },
      { key: 'priority', label: 'Priority', options: REQUIREMENT_PRIORITIES },
    ],
    columns: [
      { key: 'role', label: 'Role', primary: true, sub: (item) => item.company || 'Company not provided' },
      { key: 'hiringType', label: 'Hiring type' },
      { key: 'positions', label: 'Positions' },
      { key: 'priority', label: 'Priority', type: 'badge' },
      { key: 'status', label: 'Status', type: 'badge' },
      { key: 'createdAt', label: 'Created', type: 'date' },
    ],
    summary: (item) => [
      ['Company', item.company || 'Not provided'],
      ['Contact', item.contactName || 'Not provided'],
      ['Created', formatDate(item.createdAt)],
      ['Entered through', item.source === 'ADMIN' ? 'The admin panel' : 'The Hire Talent form'],
    ],
    documents: (item) => (item.attachment ? [{
      label: 'Open attachment', permission: 'requirements:read', request: () => requirementsApi.attachmentUrl(item.id),
      note: `${item.attachment.fileName}. The link expires shortly after it is issued and each access is recorded.`,
    }] : []),
    blank: () => ({ contactName: '', company: '', email: '', phone: '', hiringType: '', domain: '', role: '', positions: 1, location: '', workMode: '', description: '', skills: [], experience: '', priority: 'MEDIUM', status: 'NEW', internalNotes: '' }),
    fields: [
      { key: 'role', label: 'Role', required: true, wide: true },
      { key: 'company', label: 'Company' },
      { key: 'contactName', label: 'Contact name' },
      { key: 'email', label: 'Email' },
      { key: 'phone', label: 'Phone' },
      { key: 'hiringType', label: 'Hiring type', type: 'select', options: HIRING_TYPES, allowEmpty: true, emptyLabel: 'Not set' },
      { key: 'domain', label: 'Domain' },
      { key: 'positions', label: 'Positions', type: 'number', step: 1 },
      { key: 'location', label: 'Location' },
      { key: 'workMode', label: 'Work mode', type: 'select', options: WORK_MODES, allowEmpty: true, emptyLabel: 'Not set' },
      { key: 'experience', label: 'Experience' },
      { key: 'description', label: 'Description', type: 'textarea', rows: 4 },
      { key: 'skills', label: 'Skills', type: 'tags', wide: true },
      { key: 'priority', label: 'Priority', type: 'select', options: REQUIREMENT_PRIORITIES },
      { key: 'status', label: 'Status', type: 'select', options: REQUIREMENT_STATUSES },
      { key: 'internalNotes', label: 'Internal notes', type: 'textarea', hint: 'Seen by the recruitment team only.' },
    ],
  },

  referrals: {
    collection: 'referrals', title: 'Referrals', singular: 'referral', eyebrow: 'Recruitment',
    description: 'People recommended through the Refer page. Open a referral to review it, add notes or convert it to a candidate.',
    basePath: '/admin/referrals', editor: 'link', rowLink: (item) => `/admin/referrals/${item.id}`,
    permissions: { read: 'referrals:read', write: 'referrals:write', remove: 'referrals:delete' },
    search: (item) => [item.candidateName, item.candidateEmail, item.candidateRole, item.referrerName, item.referrerEmail, item.domain].join(' '),
    filters: [
      { key: 'status', label: 'Status', options: REFERRAL_STATUSES },
      { key: 'domain', label: 'Domain', options: valuesOf('referrals', 'domain') },
    ],
    columns: [
      { key: 'candidateName', label: 'Referred person', primary: true, sub: (item) => item.candidateRole },
      { key: 'referrerName', label: 'Referred by' },
      { key: 'domain', label: 'Domain' },
      { key: 'status', label: 'Status', type: 'badge' },
      { key: 'createdAt', label: 'Received', type: 'date' },
    ],
    // What the referrer entered about the person, corrected in a drawer
    // on the referral page. The email is needed before a referral can
    // be converted. The status has its own control.
    fields: [
      { key: 'candidateName', label: 'Name', required: true, wide: true },
      { key: 'candidateEmail', label: 'Email', hint: 'Needed to convert this referral to a candidate.' },
      { key: 'candidatePhone', label: 'Phone' },
      { key: 'candidateRole', label: 'Current role' },
      { key: 'domain', label: 'Domain' },
      { key: 'candidateProfileUrl', label: 'Profile link', wide: true, hint: 'A full link starting with https://.' },
    ],
  },

  enquiries: {
    collection: 'enquiries', title: 'Enquiries', singular: 'enquiry', eyebrow: 'Recruitment',
    description: 'Messages sent through the Contact page, by type: hiring, career, partnership, general or other.',
    basePath: '/admin/enquiries', editor: 'drawer', canDelete: true, titleKey: 'subject',
    permissions: { read: 'enquiries:read', write: 'enquiries:write', remove: 'enquiries:delete' },
    drawerTitle: (item) => item.subject || `Enquiry from ${item.name}`,
    search: (item) => [item.name, item.email, item.subject, item.company, item.message].join(' '),
    filters: [
      { key: 'status', label: 'Status', options: ENQUIRY_STATUSES },
      { key: 'type', label: 'Type', options: ENQUIRY_TYPES },
    ],
    columns: [
      { key: 'name', label: 'From', primary: true, sub: (item) => item.email },
      { key: 'type', label: 'Type', type: 'badge' },
      { key: 'subject', label: 'Subject' },
      { key: 'status', label: 'Status', type: 'badge' },
      { key: 'createdAt', label: 'Received', type: 'date' },
    ],
    summary: (item) => [['From', item.name], ['Email', item.email], ['Phone', item.phone || 'Not provided'], ['Company', item.company || 'Not provided'], ['Received', formatDate(item.createdAt)]],
    documents: (item) => (item.attachment ? [{
      label: 'Open attachment', permission: 'enquiries:read', request: () => enquiriesApi.attachmentUrl(item.id),
      note: `${item.attachment.fileName}. The link expires shortly after it is issued and each access is recorded.`,
    }] : []),
    fields: [
      { key: 'message', label: 'Message', type: 'readonly' },
      { key: 'type', label: 'Type', type: 'select', options: ENQUIRY_TYPES },
      { key: 'status', label: 'Status', type: 'select', options: ENQUIRY_STATUSES },
      { key: 'internalNotes', label: 'Internal notes', type: 'textarea' },
    ],
  },

  insights: {
    collection: 'insights', title: 'Insights', singular: 'article', eyebrow: 'Website',
    description: 'Articles on the Insights pages and the landing page. The public site shows the published ones, read from this database. The landing page shows the published articles switched on for it, in the landing page order. Drafts are never shown.',
    basePath: '/admin/insights', editor: 'page', canCreate: true, canDelete: true, titleKey: 'title',
    permissions: CONTENT_PERMISSIONS,
    // The public article page exists for a published article only.
    publicPath: (item) => (item.status === 'published' && item.slug ? `/insights/${item.slug}` : null),
    search: (item) => [item.title, item.category, item.author, (item.tags || []).join(' ')].join(' '),
    filters: [
      { key: 'status', label: 'Status', options: CONTENT_STATUSES },
      { key: 'category', label: 'Category', options: CATEGORIES },
    ],
    columns: [
      { key: 'title', label: 'Article', primary: true, sub: (item) => item.excerpt },
      { key: 'category', label: 'Category' },
      { key: 'author', label: 'Author' },
      { key: 'status', label: 'Status', type: 'badge' },
      { key: 'showOnLanding', label: 'Landing page', value: (item) => (item.showOnLanding ? `Shown, order ${item.landingOrder || 0}` : 'Hidden') },
      { key: 'date', label: 'Publish date', type: 'date' },
    ],
    statusActions: CONTENT_STATUS_ACTIONS,
    blank: () => ({ title: '', slug: '', category: 'Semiconductor', tags: [], topics: ['SEMICONDUCTOR'], excerpt: '', image: emptyMedia(), body: [], author: DEFAULT_AUTHOR, date: today(), readTime: '', status: 'draft', featured: false, showOnLanding: false, landingOrder: 0, seoTitle: '', seoDescription: '' }),
    fields: [
      { key: 'title', label: 'Title', required: true, wide: true },
      { key: 'slug', label: 'URL slug', hint: 'Leave empty to create it from the title.' },
      { key: 'category', label: 'Category', type: 'select', options: CATEGORIES },
      { key: 'tags', label: 'Tags', type: 'tags' },
      { key: 'topics', label: 'Filter chips', type: 'tags', hint: 'Shown as filters on the Insights page. The first one labels the article card.' },
      { key: 'excerpt', label: 'Excerpt', type: 'textarea', rows: 2 },
      { key: 'image', label: 'Cover image', type: 'media' },
      { key: 'body', label: 'Body', type: 'body', hint: 'Leave a blank line between blocks. Start a line with "## " for a heading, "> " for a pull quote, "- " for list items.' },
      { key: 'author', label: 'Author' },
      { key: 'date', label: 'Publish date', type: 'date' },
      { key: 'readTime', label: 'Read time' },
      { key: 'featured', label: 'Featured', type: 'toggle', hint: 'The newest featured article leads the Insights page.' },
      { key: 'showOnLanding', label: 'Show on landing page', type: 'toggle', hint: 'Adds this article to the Insights section of the landing page. Only published articles are shown there.' },
      { key: 'landingOrder', label: 'Landing page order', type: 'number', step: 1, hint: 'Lower numbers come first (0 to 999). The first article is the large card. Articles with the same number are ordered newest first.' },
      { key: 'seoTitle', label: 'SEO title', wide: true },
      { key: 'seoDescription', label: 'SEO description', type: 'textarea', rows: 2 },
    ],
  },

  stories: {
    collection: 'stories', title: 'Stories', singular: 'story', eyebrow: 'Website',
    description: 'Client and candidate stories on the landing page. It shows the published stories that are switched on for it, in the order set here, read from this database. Publish only quotes you have permission to use.',
    basePath: '/admin/stories', editor: 'drawer', newAs: 'page', canCreate: true, canDelete: true, titleKey: 'name',
    permissions: CONTENT_PERMISSIONS,
    search: (item) => [item.quote, item.name, item.role].join(' '),
    filters: [{ key: 'status', label: 'Status', options: CONTENT_STATUSES }],
    columns: [
      { key: 'quote', label: 'Quote', primary: true, clamp: true, sub: (item) => [item.name, item.role].filter(Boolean).join(', ') },
      { key: 'order', label: 'Order' },
      { key: 'status', label: 'Status', type: 'badge' },
      { key: 'showOnLanding', label: 'Landing page', type: 'badge', value: (item) => (item.showOnLanding === false ? 'Hidden' : 'Shown') },
    ],
    statusActions: CONTENT_STATUS_ACTIONS,
    blank: () => ({ quote: '', name: '', role: '', photo: emptyMedia(), order: 0, showOnLanding: true, status: 'draft' }),
    fields: [
      { key: 'quote', label: 'Quote', type: 'textarea', rows: 5, required: true },
      { key: 'name', label: 'Attribution', hint: 'A name or a job title.' },
      { key: 'role', label: 'Organisation or description' },
      { key: 'photo', label: 'Image', type: 'media' },
      { key: 'showOnLanding', label: 'Show on landing page', type: 'toggle', hint: 'Switch off to keep a published story off the landing page.' },
      { key: 'order', label: 'Landing page order', type: 'number', step: 1, hint: 'Lower numbers are shown first.' },
      { key: 'status', label: 'Status', type: 'select', options: CONTENT_STATUSES, permission: 'content:publish' },
    ],
  },

  expertise: {
    collection: 'expertise', title: 'Expertise', singular: 'sector', eyebrow: 'Website',
    description: 'The sectors shown across the site and on each sector page.',
    basePath: '/admin/expertise', editor: 'drawer', newAs: 'page', canCreate: true, titleKey: 'name',
    permissions: CONTENT_PERMISSIONS,
    search: (item) => [item.name, item.slug, item.key, (item.domains || []).join(' ')].join(' '),
    filters: [{ key: 'status', label: 'Status', options: CONTENT_STATUSES }],
    columns: [
      { key: 'name', label: 'Sector', primary: true, sub: (item) => `/expertise/${item.slug}` },
      { key: 'num', label: 'Order' },
      { key: 'domains', label: 'Capabilities', type: 'tags' },
      { key: 'status', label: 'Status', type: 'badge' },
    ],
    statusActions: CONTENT_STATUS_ACTIONS,
    blank: () => ({ name: '', shortName: '', slug: '', num: '', desc: '', image: emptyMedia(), introduction: '', overview: '', domains: [], roles: [], hiringChallenges: [], processFlow: [], relatedInsight: '', status: 'draft' }),
    fields: [
      { key: 'name', label: 'Name', required: true, wide: true },
      { key: 'key', label: 'Sector key', type: 'readonly', show: (item) => Boolean(item.id), hint: 'Set when the sector is created and never changed. The site refers to the sector by this key.' },
      { key: 'shortName', label: 'Short name' },
      { key: 'slug', label: 'URL slug', hint: 'Leave empty to create it from the name.' },
      { key: 'num', label: 'Order' },
      { key: 'status', label: 'Status', type: 'select', options: CONTENT_STATUSES, permission: 'content:publish' },
      { key: 'desc', label: 'Description', type: 'textarea', rows: 2 },
      { key: 'image', label: 'Hero visual', type: 'media' },
      { key: 'introduction', label: 'Introduction', type: 'textarea', rows: 2 },
      { key: 'overview', label: 'Content', type: 'textarea', rows: 6 },
      { key: 'domains', label: 'Capabilities', type: 'tags', wide: true },
      { key: 'roles', label: 'Roles', type: 'tags', wide: true },
      { key: 'hiringChallenges', label: 'Hiring challenges', type: 'lines', hint: 'One per line, as "Title: detail".' },
      { key: 'processFlow', label: 'Process flow', type: 'tags', wide: true, hint: 'The short steps drawn across the sector page, in order.' },
      { key: 'relatedInsight', label: 'Related insight', type: 'select', allowEmpty: true, wide: true, options: (state) => state.insights.map((a) => ({ value: a.slug, label: a.title })) },
    ],
  },

  services: {
    collection: 'services', title: 'Services', singular: 'service', eyebrow: 'Website',
    description: 'The service lines on the homepage and their pages under /employers. The public site shows the published ones, read from this database.',
    basePath: '/admin/services', editor: 'drawer', canCreate: true, titleKey: 'name',
    permissions: CONTENT_PERMISSIONS,
    search: (item) => [item.name, item.slug, item.description].join(' '),
    columns: [
      { key: 'name', label: 'Service', primary: true, sub: (item) => `/employers/${item.slug}` },
      { key: 'num', label: 'Order' },
      { key: 'ctaLabel', label: 'Call to action' },
      { key: 'status', label: 'Status', type: 'badge' },
    ],
    blank: () => ({ name: '', slug: '', num: '', icon: 'die', status: 'draft', description: '', headline: '', lead: '', fitTitle: '', fit: [], processTitle: '', process: [], receive: [], tagsTitle: '', tags: [], questions: [], ctaLabel: '', ctaTo: '/contact?type=employer' }),
    fields: [
      { key: 'name', label: 'Name', required: true },
      { key: 'slug', label: 'URL slug', hint: 'Leave empty to create it from the name.' },
      { key: 'num', label: 'Order' },
      { key: 'icon', label: 'Icon', type: 'select', options: SERVICE_ICONS },
      { key: 'status', label: 'Status', type: 'select', options: CONTENT_STATUSES, permission: 'content:publish' },
      { key: 'description', label: 'Description', type: 'textarea', rows: 3, hint: 'Shown on the homepage service card.' },
      { key: 'headline', label: 'Page headline', wide: true },
      { key: 'lead', label: 'Page introduction', type: 'textarea', rows: 2 },
      { key: 'fitTitle', label: 'When it fits: heading', wide: true },
      { key: 'fit', label: 'When it fits', type: 'lines' },
      { key: 'processTitle', label: 'How it runs: heading', wide: true },
      { key: 'process', label: 'How it runs', type: 'lines', hint: 'One step per line, as "Step: detail".' },
      { key: 'receive', label: 'What the client receives', type: 'lines' },
      { key: 'tagsTitle', label: 'Tags: heading', wide: true },
      { key: 'tags', label: 'Tags', type: 'tags', wide: true },
      { key: 'questions', label: 'Questions and answers', type: 'lines', hint: 'One per line, as "Question | Answer".' },
      { key: 'ctaLabel', label: 'Button label' },
      { key: 'ctaTo', label: 'Button link', hint: 'A path on this site, starting with "/".' },
    ],
  },

  locations: {
    collection: 'locations', title: 'Locations', singular: 'location', eyebrow: 'Website',
    description: 'Points on the engineering network map. An office is a confirmed ALLSEMIS office with an address. A network node is shown on the map and is never presented as an office.',
    basePath: '/admin/locations', editor: 'drawer', canCreate: true, canDelete: true, titleKey: 'city',
    permissions: CONTENT_PERMISSIONS,
    search: (item) => [item.city, item.country, item.type].join(' '),
    filters: [{ key: 'type', label: 'Type', options: LOCATION_TYPES }],
    columns: [
      { key: 'city', label: 'City', primary: true, sub: (item) => item.country },
      { key: 'type', label: 'Type', type: 'badge' },
      { key: 'status', label: 'Status', type: 'badge' },
      { key: 'coordinates', label: 'Coordinates', value: (item) => `${Number(item.lat).toFixed(2)}, ${Number(item.lon).toFixed(2)}` },
      { key: 'active', label: 'On the map', type: 'badge', value: (item) => (item.active ? 'Shown' : 'Hidden') },
    ],
    blank: () => ({ city: '', country: '', region: '', type: 'network', status: 'listed', address: [], phone: '', email: '', hours: [], lat: 0, lon: 0, description: '', labelSide: 'right', labelRaise: 0, isHeadquarters: false, active: true }),
    fields: [
      { key: 'city', label: 'City', required: true },
      { key: 'country', label: 'Country' },
      { key: 'type', label: 'Type', type: 'select', options: LOCATION_TYPES, hint: 'Choose "office" only for a confirmed ALLSEMIS office.' },
      { key: 'status', label: 'Status', type: 'select', options: LOCATION_STATUSES },
      { key: 'lat', label: 'Latitude', type: 'number' },
      { key: 'lon', label: 'Longitude', type: 'number' },
      { key: 'address', label: 'Address', type: 'lines', rows: 3, hint: 'Offices only. The server clears the address and contact details of a network node.' },
      { key: 'phone', label: 'Phone', hint: 'Offices only.' },
      { key: 'email', label: 'Email', hint: 'Offices only.' },
      { key: 'hours', label: 'Hours', type: 'lines', rows: 2, hint: 'Offices only. One line each.' },
      { key: 'description', label: 'Description', type: 'textarea', rows: 2 },
      { key: 'labelSide', label: 'Map label side', type: 'select', options: ['right', 'left'] },
      { key: 'labelRaise', label: 'Map label lift', type: 'number', step: 1, hint: 'Pixels (0 to 80) to lift the label clear of a neighbouring one.' },
      { key: 'region', label: 'Region' },
      { key: 'isHeadquarters', label: 'Headquarters', type: 'toggle' },
      { key: 'active', label: 'Show on the map', type: 'toggle' },
    ],
  },
};
