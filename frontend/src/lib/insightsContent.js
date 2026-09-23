// Insights content - structured, data-driven seed articles so an admin
// panel can later replace any field without touching JSX. These are
// independently-written editorial pieces built from genuine
// engineering-recruitment topics, explicitly seed content rather than
// verified Allsemi research. No statistics, client outcomes, or
// candidate results are invented anywhere below - where a number would
// normally appear, the text stays qualitative instead.
//
// Images reuse the same, already-verified Pexels URLs used elsewhere
// in this project (SECTORS in components/Expertise.jsx), one per
// article, no repeats - the same reliable source already proven to
// work in this codebase rather than newly-sourced, unverified URLs.

export const TOPICS = ['SEMICONDUCTOR', 'AUTOMOTIVE', 'AI & CLOUD', 'AEROSPACE', 'FINTECH', 'HEALTHCARE', 'TALENT', 'HIRING'];

const p = (id) => `pexels-photo-${id}`;
const img = (id) => `https://images.pexels.com/photos/${id}/${p(id)}.jpeg?auto=compress&cs=tinysrgb&h=900&w=1400`;

export const ARTICLES = [
  {
    slug: 'semiconductor-engineering-talent-trends',
    title: 'Semiconductor engineering talent trends',
    excerpt: 'What is actually changing in how semiconductor teams hire, and what is not.',
    topics: ['SEMICONDUCTOR', 'TALENT'],
    date: '2026-08-14',
    readTime: '6 min read',
    image: img(6636463),
    alt: 'Close-up of a microprocessor on a motherboard',
    featured: true,
    body: [
      { type: 'p', text: 'Semiconductor hiring has always been a specialist exercise, but the shape of that specialism keeps shifting. The roles that were hardest to fill five years ago are not always the roles that are hardest to fill today, even as the underlying discipline, RTL through tape-out, stays fundamentally the same.' },
      { type: 'h2', text: 'The pool has not grown as fast as demand' },
      { type: 'p', text: 'The number of engineers with genuine, hands-on RTL, verification, or physical design experience grows slowly, because the ramp time for these disciplines is measured in years, not months. Demand, meanwhile, moves in step with every new programme a semiconductor or systems company starts. That mismatch is the single biggest constant in this market.' },
      { type: 'quote', text: 'Most strong semiconductor candidates are already employed. The search is rarely about finding people who are looking. It is about finding people who are right, and giving them a reason to have the conversation.' },
      { type: 'h2', text: 'Where the pressure shows up first' },
      { type: 'list', items: ['Verification capacity, as design complexity grows faster than verification headcount', 'Physical design and DFT, where deep tool experience narrows the pool quickly', 'Analog and mixed-signal, a discipline with a naturally smaller talent base'] },
      { type: 'p', text: 'None of this means the market is impossible to hire into. It means the search has to be scoped correctly from the start, to the actual discipline, the actual tools, and the actual seniority the role needs, rather than a broad "semiconductor engineer" brief that tries to cover all of it at once.' },
    ],
  },
  {
    slug: 'hiring-for-ai-infrastructure-teams',
    title: 'Hiring for AI infrastructure teams',
    excerpt: 'The systems and infrastructure engineering behind large-scale compute is its own specialism.',
    topics: ['AI & CLOUD', 'HIRING'],
    date: '2026-07-29',
    readTime: '4 min read',
    image: img(4508751),
    alt: 'Modern data center corridor with server racks',
    featured: false,
    body: [
      { type: 'p', text: 'AI infrastructure hiring sits at an unusual intersection: it needs people who understand distributed systems at genuine scale, and people who understand the hardware those systems ultimately run on. Very few candidates are strong in both, which is exactly why this search needs to be treated as its own discipline rather than folded into general software hiring.' },
      { type: 'h2', text: 'What actually differentiates a strong candidate' },
      { type: 'p', text: 'Experience with the everyday tools of cloud infrastructure is common. Experience with the failure modes that only appear at scale, network partitioning, GPU scheduling contention, thermal and power constraints on dense compute, is far rarer, and is usually the real signal worth screening for.' },
      { type: 'list', items: ['Distributed systems design under real failure conditions', 'GPU scheduling and orchestration at scale', 'Comfort operating close to the hardware, not just the platform above it'] },
    ],
  },
  {
    slug: 'automotive-engineering-talent',
    title: 'Automotive engineering talent',
    excerpt: 'Safety-critical requirements change what a strong automotive hire actually looks like.',
    topics: ['AUTOMOTIVE', 'TALENT'],
    date: '2026-07-10',
    readTime: '5 min read',
    image: img(6870298),
    alt: 'Mechanic examining a car engine under an open hood',
    featured: false,
    body: [
      { type: 'p', text: 'Automotive engineering hiring is shaped by one thing more than any other: the vehicle has to be safe, and that requirement runs through every layer of the hiring bar, not just the roles with "safety" in the title.' },
      { type: 'h2', text: 'Functional safety changes the screen, not just the role' },
      { type: 'p', text: 'A candidate can be an excellent embedded engineer and still not be the right fit for an ADAS programme, if they have never worked under a functional-safety process like ISO 26262. That is not a small gap. It changes how someone approaches design, testing, and documentation from day one.' },
      { type: 'list', items: ['ADAS and sensor fusion experience', 'Genuine functional-safety process exposure, not just awareness of the standard', 'Embedded software discipline suited to safety-critical systems'] },
    ],
  },
  {
    slug: 'hiring-for-aerospace-systems',
    title: 'Hiring for aerospace and communications systems',
    excerpt: 'Precision hardware roles come with long qualification cycles and a small, specialised pool.',
    topics: ['AEROSPACE', 'HIRING'],
    date: '2026-06-22',
    readTime: '4 min read',
    image: img(6325002),
    alt: 'Satellite antenna structure',
    featured: false,
    body: [
      { type: 'p', text: 'Aerospace and communications hiring rarely moves quickly, and that is by design, not by accident. The qualification cycle for precision hardware and RF engineering roles reflects how much is genuinely at stake in the systems being built.' },
      { type: 'h2', text: 'A smaller pool, and a slower, more deliberate search' },
      { type: 'p', text: 'RF and avionics engineering draw from a smaller talent base than most other disciplines on this list, and candidates in this space are often already deep into long programmes of their own. A search here has to account for both realities from the outset.' },
    ],
  },
  {
    slug: 'commercial-talent-for-technical-products',
    title: 'Commercial talent for technical products',
    excerpt: 'The best commercial hires for hardware-adjacent products can actually speak to the technology.',
    topics: ['TALENT', 'HIRING'],
    date: '2026-06-05',
    readTime: '4 min read',
    image: img(260929),
    alt: 'Modern boardroom conference table',
    featured: false,
    body: [
      { type: 'p', text: 'Commercial and operational roles around a technical product are often treated as generic hires. They rarely should be. A sales engineer, account manager, or product manager who can genuinely follow the underlying technology closes a different kind of trust with technical buyers than one who cannot.' },
      { type: 'list', items: ['Genuine technical fluency, not just familiarity with the product deck', 'Comfort in a room with engineers, not just with buyers', 'A track record in commercial roles adjacent to complex technical products'] },
    ],
  },
  {
    slug: 'engineering-talent-behind-modern-payments',
    title: 'Engineering talent behind modern payments',
    excerpt: 'Payments infrastructure hiring sits at the intersection of systems engineering and regulated finance.',
    topics: ['FINTECH', 'HIRING'],
    date: '2026-05-18',
    readTime: '5 min read',
    image: img(2988232),
    alt: 'Close-up of a card payment being processed at a terminal',
    featured: false,
    body: [
      { type: 'p', text: 'Payments infrastructure engineering is not general finance hiring, and treating it that way is the most common mistake in this search. The strongest candidates combine genuine distributed-systems depth with real familiarity with regulated financial infrastructure, a narrower intersection than either skill alone.' },
      { type: 'h2', text: 'What the screen actually needs to test for' },
      { type: 'p', text: 'High-throughput transaction processing, API design under real security constraints, and comfort with the operational rigour that regulated systems demand. None of that shows up clearly on a resume built for general backend engineering roles.' },
    ],
  },
  {
    slug: 'precision-manufacturing-talent',
    title: 'Precision manufacturing and product engineering talent',
    excerpt: 'Balancing production-floor depth with the speed a consumer roadmap demands.',
    topics: ['TALENT', 'HIRING'],
    date: '2026-05-02',
    readTime: '4 min read',
    image: img(5554948),
    alt: 'Organized electronic circuit boards in a production setting',
    featured: false,
    body: [
      { type: 'p', text: 'Consumer electronics and retail technology teams need engineers who are equally comfortable on the production floor and inside a fast-moving product roadmap. That combination is less common than it sounds, and it is usually the deciding factor in a strong hire.' },
      { type: 'list', items: ['Manufacturing and DFM experience, not just design experience', 'Quality engineering discipline suited to consumer-scale production', 'Comfort operating at the pace a consumer roadmap actually requires'] },
    ],
  },
  {
    slug: 'medical-technology-hiring-landscape',
    title: 'The medical technology hiring landscape',
    excerpt: 'Regulatory fluency is often as scarce as the underlying engineering skill itself.',
    topics: ['HEALTHCARE', 'HIRING'],
    date: '2026-04-11',
    readTime: '5 min read',
    image: img(35444722),
    alt: 'Laboratory technician handling cell culture equipment',
    featured: false,
    body: [
      { type: 'p', text: 'Medical device and diagnostic engineering hiring has a second axis that most other engineering searches do not: regulatory fluency. A candidate can be an excellent embedded or signal-processing engineer and still be a poor fit for a role that requires real, working familiarity with a standard like ISO 13485 or an FDA 510(k) pathway.' },
      { type: 'h2', text: 'Why this narrows the pool further than it first appears' },
      { type: 'p', text: 'Regulatory process experience is usually learned on the job, inside a small number of companies that operate under it. That makes it genuinely scarce, and it means a search built purely around technical skill will miss the gap until very late in the process.' },
    ],
  },
];

export function getArticleBySlug(slug) {
  return ARTICLES.find(a => a.slug === slug);
}

export function getRelatedArticles(slug, count = 3) {
  const current = getArticleBySlug(slug);
  if (!current) return ARTICLES.slice(0, count);
  const scored = ARTICLES
    .filter(a => a.slug !== slug)
    .map(a => ({ a, score: a.topics.filter(t => current.topics.includes(t)).length }))
    .sort((x, y) => y.score - x.score);
  return scored.slice(0, count).map(s => s.a);
}
