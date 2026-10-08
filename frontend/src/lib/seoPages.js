/*
  The search and share text of each public page: its title, its meta
  description and where it sits in the breadcrumb trail.

  Read in two places: by lib/seo.js in the browser (each page sets its
  own head with useSeo), and by the build (vite.config.js), which
  writes each of these pages a copy of index.html whose <head> already
  holds its own title, description, canonical address and sharing
  tags, for crawlers and link previews that do not run JavaScript.

  Plain data only: no browser API and no JSX, so the build can import
  it. The sector and service pages are listed by their current slugs;
  a sector or service added or renamed in the admin still gets its
  title and description from its own record in the browser.

  Written for people first: what the page is, in the words a
  semiconductor or VLSI engineer, or an engineering hiring manager,
  would search with. No keyword lists.
*/

// The public address of the site, without a trailing slash. Set
// VITE_SITE_URL at build time when the site moves to its own domain.
export const DEFAULT_SITE_URL = 'https://allsemi.vercel.app';
export const SITE_NAME = 'ALLSEMIS';
export const DEFAULT_IMAGE = '/og-image.png';
export const DEFAULT_IMAGE_ALT = 'ALLSEMIS - semiconductor and VLSI engineering recruitment';
export const ORGANIZATION_DESCRIPTION = 'ALLSEMIS is a semiconductor and VLSI engineering recruitment company. It helps chip design, embedded systems and electronics teams hire engineers, and helps engineers find their next role.';

const HOME = { name: 'Home', path: '/' };
const EMPLOYERS = { name: 'Employers', path: '/employers' };
const EXPERTISE = { name: 'Expertise', path: '/expertise' };
const TALENT = { name: 'Talent', path: '/talent' };
const INSIGHTS = { name: 'Insights', path: '/insights' };

export const PAGE_SEO = {
  '/': {
    title: 'ALLSEMIS | Semiconductor & VLSI Engineering Recruitment',
    description: 'ALLSEMIS is a semiconductor and VLSI engineering recruitment company, connecting chip design, embedded and electronics teams with the engineers they need to hire.',
    trail: [],
  },
  '/employers': {
    title: 'Semiconductor & Engineering Staffing for Employers | ALLSEMIS',
    description: 'Hire semiconductor, VLSI and embedded engineers with ALLSEMIS: permanent engineering hiring, project staffing and recruitment process outsourcing (RPO).',
    trail: [HOME, EMPLOYERS],
  },
  '/employers/permanent-staffing': {
    title: 'Permanent Semiconductor & Engineering Hiring | ALLSEMIS',
    description: 'Permanent staffing for semiconductor, chip design, automotive and aerospace teams. ALLSEMIS sources, screens and places full-time engineers who stay and grow.',
    trail: [HOME, EMPLOYERS, { name: 'Permanent Staffing', path: '/employers/permanent-staffing' }],
  },
  '/employers/project-staffing': {
    title: 'Project Staffing for VLSI & Embedded Engineering | ALLSEMIS',
    description: 'Project staffing with skilled contract engineers, from VLSI design to embedded systems. ALLSEMIS scales your engineering team for the length of a project.',
    trail: [HOME, EMPLOYERS, { name: 'Project Staffing', path: '/employers/project-staffing' }],
  },
  '/employers/rpo': {
    title: 'RPO for Semiconductor & Engineering Recruitment | ALLSEMIS',
    description: 'Recruitment process outsourcing (RPO) for semiconductor and engineering hiring: a dedicated ALLSEMIS hiring engine for your technical talent acquisition.',
    trail: [HOME, EMPLOYERS, { name: 'RPO Solution', path: '/employers/rpo' }],
  },
  '/talent': {
    title: 'Semiconductor & VLSI Jobs | Engineering Careers | ALLSEMIS',
    description: 'Semiconductor, VLSI, embedded systems and electronics engineering jobs. Browse open roles, apply online and find your next engineering career with ALLSEMIS.',
    trail: [HOME, TALENT],
  },
  '/expertise': {
    title: 'Engineering Recruitment by Sector | ALLSEMIS Expertise',
    description: 'The sectors ALLSEMIS recruits engineers for: semiconductor and chip engineering, embedded systems, mobility and communications, AI infrastructure and more.',
    trail: [HOME, EXPERTISE],
  },
  '/expertise/semiconductor-chip-engineering': {
    title: 'Semiconductor & VLSI Engineering Recruitment | ALLSEMIS',
    description: 'Semiconductor recruitment for chip and IC design: RTL, design verification, physical design, DFT, ASIC, SoC and analog engineers. Hire VLSI talent with ALLSEMIS.',
    trail: [HOME, EXPERTISE, { name: 'Semiconductor & Chip Engineering', path: '/expertise/semiconductor-chip-engineering' }],
  },
  '/expertise/embedded-systems-electronics': {
    title: 'Embedded Systems & Electronics Recruitment | ALLSEMIS',
    description: 'Embedded systems and electronics engineering recruitment: firmware, embedded Linux, device driver and BSP, hardware design and board bring-up engineers.',
    trail: [HOME, EXPERTISE, { name: 'Embedded Systems & Electronics', path: '/expertise/embedded-systems-electronics' }],
  },
  '/expertise/mobility-communications': {
    title: 'Automotive, RF & Communications Engineering Recruitment | ALLSEMIS',
    description: 'Mobility and communications recruitment: ADAS, automotive embedded software, functional safety, telematics, RF and wireless systems engineers.',
    trail: [HOME, EXPERTISE, { name: 'Mobility & Communications', path: '/expertise/mobility-communications' }],
  },
  '/expertise/ai-infrastructure-cloud': {
    title: 'AI Infrastructure & Cloud Engineering Recruitment | ALLSEMIS',
    description: 'AI infrastructure and cloud recruitment: ML infrastructure and MLOps, platform, data, distributed systems, GPU and HPC infrastructure and SRE engineers.',
    trail: [HOME, EXPERTISE, { name: 'AI Infrastructure & Cloud', path: '/expertise/ai-infrastructure-cloud' }],
  },
  '/expertise/healthcare-medical-technology': {
    title: 'Medical Technology Engineering Recruitment | ALLSEMIS',
    description: 'Healthcare and medical technology recruitment: medical device, medical electronics, imaging and diagnostic systems, verification and validation engineers.',
    trail: [HOME, EXPERTISE, { name: 'Healthcare & Medical Technology', path: '/expertise/healthcare-medical-technology' }],
  },
  '/expertise/consumer-goods-retail': {
    title: 'Consumer Electronics & Retail Tech Recruitment | ALLSEMIS',
    description: 'Consumer goods and retail recruitment: product, consumer electronics, e-commerce platform, mobile app, retail and supply-chain systems engineers.',
    trail: [HOME, EXPERTISE, { name: 'Consumer Goods & Retail', path: '/expertise/consumer-goods-retail' }],
  },
  '/expertise/business-finance-consumer': {
    title: 'Enterprise Software & Business Systems Recruitment | ALLSEMIS',
    description: 'Business, finance and consumer recruitment: enterprise software, ERP and CRM, finance systems, data and analytics engineers and solutions architects.',
    trail: [HOME, EXPERTISE, { name: 'Business, Finance & Consumer', path: '/expertise/business-finance-consumer' }],
  },
  '/expertise/banking-finance-fintech': {
    title: 'Banking & FinTech Engineering Recruitment | ALLSEMIS',
    description: 'Banking, finance and fintech recruitment: payments infrastructure, core and digital banking, risk and compliance technology and API platform engineers.',
    trail: [HOME, EXPERTISE, { name: 'Banking, Finance & FinTech', path: '/expertise/banking-finance-fintech' }],
  },
  '/insights': {
    title: 'Semiconductor & Engineering Hiring Insights | ALLSEMIS',
    description: 'Insights on semiconductor and engineering hiring: the VLSI and embedded talent market, roles, skills and recruitment from the ALLSEMIS team.',
    trail: [HOME, INSIGHTS],
  },
  '/about': {
    title: 'About ALLSEMIS | Semiconductor & Engineering Recruitment',
    description: 'ALLSEMIS is a specialist staffing partner for semiconductor, VLSI and advanced engineering talent, connecting engineers with the teams shaping what comes next.',
    trail: [HOME, { name: 'About', path: '/about' }],
  },
  '/contact': {
    title: 'Contact ALLSEMIS | Hire Engineers or Find Your Next Role',
    description: 'Contact ALLSEMIS to hire semiconductor, VLSI and embedded engineers, to discuss a role, or for any other question about engineering recruitment.',
    trail: [HOME, { name: 'Contact', path: '/contact' }],
  },
  '/refer': {
    title: 'Refer Semiconductor & VLSI Engineers | ALLSEMIS Referrals',
    description: 'Know a semiconductor, VLSI, hardware or engineering specialist you would vouch for? Refer them to ALLSEMIS for semiconductor and engineering roles.',
    trail: [HOME, { name: 'Refer Talent', path: '/refer' }],
  },
};

// The paths of PAGE_SEO, for the build.
export const SEO_PATHS = Object.keys(PAGE_SEO);

// ---- Structured data (schema.org JSON-LD), shared with the build ----

// The clean public address of a path: no trailing slash, no query.
export function absoluteFrom(siteUrl, pathOrUrl = '/') {
  const value = String(pathOrUrl || '/');
  if (/^https?:\/\//i.test(value)) return value;
  const path = value.startsWith('/') ? value : `/${value}`;
  const clean = path === '/' ? '/' : path.replace(/\/+$/, '');
  return `${siteUrl}${clean}`;
}

export function organizationData(siteUrl) {
  return {
    '@type': 'Organization',
    '@id': `${siteUrl}/#organization`,
    name: SITE_NAME,
    url: `${siteUrl}/`,
    logo: absoluteFrom(siteUrl, '/icons/favicon-512.png'),
    description: ORGANIZATION_DESCRIPTION,
  };
}

export function websiteData(siteUrl) {
  return { '@type': 'WebSite', '@id': `${siteUrl}/#website`, name: SITE_NAME, url: `${siteUrl}/`, publisher: { '@id': `${siteUrl}/#organization` } };
}

export function breadcrumbData(siteUrl, trail) {
  if (!Array.isArray(trail) || trail.length < 2) return null;
  return {
    '@type': 'BreadcrumbList',
    itemListElement: trail.map((step, i) => ({ '@type': 'ListItem', position: i + 1, name: step.name, item: absoluteFrom(siteUrl, step.path) })),
  };
}

// The structured data of a fixed page: the organisation and the site on
// the home page, the breadcrumb trail on every other page.
export function fixedPageData(siteUrl, path) {
  const page = PAGE_SEO[path] || PAGE_SEO['/'];
  return path === '/' ? [organizationData(siteUrl), websiteData(siteUrl)] : [breadcrumbData(siteUrl, page.trail)].filter(Boolean);
}
