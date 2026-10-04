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

// Article data model (the shape the admin Insights CMS edits):
//   category        one of CATEGORIES - the article's primary category
//   tags            free-form keywords
//   title, slug, excerpt
//   image, alt      cover image and its alt text
//   body            typed blocks: p, h2, quote, list
//   author          byline
//   date            publish date (ISO)
//   status          'draft' | 'published' - drafts never reach the site
//   seoTitle, seoDescription  optional. The article page uses them for
//                   the document title and meta description, and falls
//                   back to the title and excerpt when they are empty.
//   topics          the public filter chips; topics[0] is the label
//                   shown on cards. Kept alongside category so the
//                   existing Insights pages work unchanged.
// Older seed articles carry only the original fields; normaliseArticle
// below fills the rest, so every article has the full shape.
export const CATEGORIES = ['Semiconductor', 'Automotive', 'AI & Cloud', 'Aerospace', 'FinTech', 'Healthcare', 'Talent', 'Hiring'];
export const ARTICLE_STATUSES = ['draft', 'published'];
export const DEFAULT_AUTHOR = 'ALLSEMIS Editorial';

const CATEGORY_BY_TOPIC = {
  SEMICONDUCTOR: 'Semiconductor',
  AUTOMOTIVE: 'Automotive',
  'AI & CLOUD': 'AI & Cloud',
  AEROSPACE: 'Aerospace',
  FINTECH: 'FinTech',
  HEALTHCARE: 'Healthcare',
  TALENT: 'Talent',
  HIRING: 'Hiring',
};

const p = (id) => `pexels-photo-${id}`;
const img = (id) => `https://images.pexels.com/photos/${id}/${p(id)}.jpeg?auto=compress&cs=tinysrgb&h=900&w=1400`;

const SEED_ARTICLES = [
  // ---- Semiconductor category: educational industry articles. They
  // explain how the work is done and how to hire for it. They state no
  // ALLSEMIS results, clients or statistics. Cover images reuse Pexels
  // URLs already in use elsewhere in this project.
  {
    slug: 'rtl-to-gdsii-the-flow-and-the-roles-behind-it',
    title: 'From RTL to GDSII: the flow and the roles behind it',
    excerpt: 'A plain walk through the digital implementation flow, and which engineering role owns each stage.',
    seoTitle: 'From RTL to GDSII: the flow and the roles behind it | ALLSEMIS Insights',
    seoDescription: 'A plain walk through the digital implementation flow, and which engineering role owns each stage.',
    category: 'Semiconductor',
    tags: ['RTL', 'Synthesis', 'Physical Design', 'Signoff'],
    topics: ['SEMICONDUCTOR', 'HIRING'],
    date: '2026-09-24',
    readTime: '7 min read',
    image: img(5554948),
    alt: 'Organized electronic circuit boards in a production setting',
    featured: false,
    body: [
      { type: 'p', text: 'A digital chip starts as a description of behaviour and ends as a set of geometric layers a foundry can manufacture. Between those two points sits a long chain of specialised work. Each link has its own tools, its own vocabulary and its own kind of engineer, which is why a hiring brief that says only "VLSI engineer" rarely lands on the right person.' },
      { type: 'h2', text: 'Specification and RTL' },
      { type: 'p', text: 'Architects turn product requirements into a micro-architecture: blocks, interfaces, clocking and power intent. RTL design engineers then describe that architecture in Verilog or SystemVerilog. Good RTL is not only functionally correct. It is written with synthesis, timing and testability in mind, because every later stage inherits its decisions.' },
      { type: 'h2', text: 'Verification runs alongside, not after' },
      { type: 'p', text: 'Design verification engineers build the testbenches, checkers and coverage models that prove the RTL does what the specification says. On most programmes this work starts as early as the design itself and continues until tape-out.' },
      { type: 'h2', text: 'Synthesis, DFT and physical implementation' },
      { type: 'list', items: ['Synthesis converts RTL into a gate-level netlist against a target library, guided by timing constraints.', 'Design-for-test engineers insert scan chains and memory test logic so that manufactured parts can be screened.', 'Physical design engineers floorplan the chip, place cells, build the clock tree and route the wires.', 'Static timing analysis and physical verification confirm the layout meets timing and foundry rules before signoff.'] },
      { type: 'quote', text: 'Every stage of the flow consumes the output of the one before it. That is why engineers who understand their neighbours in the flow are so valuable.' },
      { type: 'h2', text: 'What this means for a hiring brief' },
      { type: 'p', text: 'Name the stage. A brief that states where in the flow the role sits, which tools the team uses and what the handoffs look like will reach the right engineers faster than a general title ever will.' },
    ],
  },
  {
    slug: 'what-design-verification-engineers-actually-do',
    title: 'What design verification engineers actually do',
    excerpt: 'Verification is its own discipline with its own craft. Here is what the work involves day to day.',
    seoTitle: 'What design verification engineers actually do | ALLSEMIS Insights',
    seoDescription: 'Verification is its own discipline with its own craft. Here is what the work involves day to day.',
    category: 'Semiconductor',
    tags: ['Verification', 'UVM', 'SystemVerilog', 'Coverage'],
    topics: ['SEMICONDUCTOR', 'TALENT'],
    date: '2026-09-17',
    readTime: '6 min read',
    image: img(6636463),
    alt: 'Close-up of a microprocessor on a motherboard',
    featured: false,
    body: [
      { type: 'p', text: 'A silicon bug found after manufacture cannot be patched with a software update. Finding it beforehand is the job of design verification, and on a complex chip that job is at least as large as the design work itself.' },
      { type: 'h2', text: 'Planning before simulation' },
      { type: 'p', text: 'Verification starts with a plan: a list of every feature, mode and corner case the design must handle, each tied to a way of proving it. The plan is the contract. Everything that follows is measured against it.' },
      { type: 'h2', text: 'Building the environment' },
      { type: 'p', text: 'Most teams use SystemVerilog with the Universal Verification Methodology. A verification engineer builds reusable components that drive stimulus into the design, monitor what comes out and check it against a reference. Constrained-random stimulus explores combinations a person would not think to write by hand, and assertions watch for protocol violations as they happen.' },
      { type: 'h2', text: 'Closing coverage' },
      { type: 'list', items: ['Functional coverage shows which planned scenarios have actually been exercised.', 'Code coverage shows which parts of the RTL were never touched by any test.', 'Regression suites rerun the full test set as the design changes.', 'Debug, the least visible part of the work, is where much of the time goes.'] },
      { type: 'p', text: 'Formal verification and emulation extend the same goal with different techniques. Formal tools prove properties mathematically for suitable blocks, while emulation runs real software on the design long before silicon exists.' },
      { type: 'h2', text: 'Signals to look for when hiring' },
      { type: 'p', text: 'Strong verification engineers can explain how they decided a block was done, not only which tools they used. Ask about a bug they found late, how it escaped earlier tests, and what they changed afterwards.' },
    ],
  },
  {
    slug: 'design-for-test-explained-for-hiring-managers',
    title: 'Design for test, explained for hiring managers',
    excerpt: 'DFT is a small discipline with a large effect on yield and cost. A short primer on what the role covers.',
    seoTitle: 'Design for test, explained for hiring managers | ALLSEMIS Insights',
    seoDescription: 'DFT is a small discipline with a large effect on yield and cost. A short primer on what the role covers.',
    category: 'Semiconductor',
    tags: ['DFT', 'Scan', 'ATPG', 'MBIST'],
    topics: ['SEMICONDUCTOR', 'HIRING'],
    date: '2026-09-10',
    readTime: '5 min read',
    image: img(9242271),
    alt: 'Electronics engineer assembling a circuit board with precision',
    featured: false,
    body: [
      { type: 'p', text: 'No manufacturing process is perfect. Some fraction of every wafer will contain defective parts, and the only way to find them is to test each one. Design for test is the practice of building structures into the chip that make that testing possible, fast and thorough.' },
      { type: 'h2', text: 'The main techniques' },
      { type: 'list', items: ['Scan design links the flip-flops in a chip into shift chains, so internal state can be controlled and observed from the pins.', 'Automatic test pattern generation produces the patterns that expose manufacturing faults through those chains.', 'Memory built-in self-test adds logic that lets embedded memories test themselves.', 'Boundary scan, standardised as JTAG, gives access to the pins and to on-chip test and debug features.'] },
      { type: 'h2', text: 'Why it is a specialism' },
      { type: 'p', text: 'DFT engineers work at the junction of design, physical implementation and the test floor. They trade test coverage against area, power and test time, and they need to understand how their structures behave through synthesis and layout. Compression architectures, at-speed testing and low-power test all add depth.' },
      { type: 'quote', text: 'A DFT engineer is judged on parts that never reach a customer.' },
      { type: 'h2', text: 'Reading a DFT profile' },
      { type: 'p', text: 'Look for the full loop: architecture decisions, insertion, pattern generation, simulation of those patterns and support during silicon bring-up. Experience limited to running a tool flow is useful, but it is a different level from owning the test strategy for a chip.' },
    ],
  },
  {
    slug: 'timing-closure-and-the-physical-design-skill-set',
    title: 'Timing closure and the physical design skill set',
    excerpt: 'Why the last stretch before tape-out depends on a narrow and hard-won set of skills.',
    seoTitle: 'Timing closure and the physical design skill set | ALLSEMIS Insights',
    seoDescription: 'Why the last stretch before tape-out depends on a narrow and hard-won set of skills.',
    category: 'Semiconductor',
    tags: ['Physical Design', 'STA', 'Timing Closure', 'Place and Route'],
    topics: ['SEMICONDUCTOR', 'TALENT'],
    date: '2026-09-03',
    readTime: '6 min read',
    image: img(3862632),
    alt: 'Engineer working at a technical workstation surrounded by lab equipment',
    featured: false,
    body: [
      { type: 'p', text: 'Physical design turns a netlist into a layout. The work is often summarised as place and route, but the part that decides schedules is timing closure: getting every path in the design to meet its timing requirement across every operating condition the chip must support.' },
      { type: 'h2', text: 'What the work involves' },
      { type: 'list', items: ['Floorplanning decides where major blocks, memories and pins sit, which shapes everything after it.', 'Placement and clock tree synthesis position the cells and distribute the clock with controlled skew.', 'Routing connects the design while managing congestion and signal integrity.', 'Static timing analysis checks setup and hold across process, voltage and temperature corners.'] },
      { type: 'h2', text: 'Why closure is hard' },
      { type: 'p', text: 'Fixing one path can break another. Power, area, timing and routability pull against each other, and the engineer has to judge which change is worth its side effects. At advanced nodes, effects such as on-chip variation and crosstalk make that judgement harder.' },
      { type: 'p', text: 'This is experience that accumulates slowly. An engineer learns it by taking blocks, and eventually whole chips, through signoff.' },
      { type: 'h2', text: 'What to ask in an interview' },
      { type: 'p', text: 'Ask a candidate to describe the hardest timing problem they closed and how they found the cause. The answer shows whether they understand the design or only the tool.' },
    ],
  },
  {
    slug: 'writing-a-vlsi-job-description-engineers-respond-to',
    title: 'Writing a VLSI job description that engineers respond to',
    excerpt: 'Specific briefs attract specific people. A practical checklist for semiconductor hiring teams.',
    seoTitle: 'Writing a VLSI job description that engineers respond to | ALLSEMIS Insights',
    seoDescription: 'Specific briefs attract specific people. A practical checklist for semiconductor hiring teams.',
    category: 'Hiring',
    tags: ['Job Description', 'VLSI', 'Hiring Process'],
    topics: ['HIRING', 'SEMICONDUCTOR'],
    date: '2026-08-27',
    readTime: '5 min read',
    image: img(5554948),
    alt: 'Organized electronic circuit boards in a production setting',
    featured: false,
    body: [
      { type: 'p', text: 'Experienced chip engineers read job descriptions the way they read specifications. Vague ones get skipped. A brief that reads like it was written by someone who knows the work gets a reply.' },
      { type: 'h2', text: 'Be exact about the work' },
      { type: 'list', items: ['State where the role sits in the flow: architecture, RTL, verification, DFT, physical design or signoff.', 'Name the tools and methodologies the team actually uses.', 'Describe the scope: block level, subsystem or full chip.', 'Say what stage the programme is in, since joining at specification is different from joining before tape-out.'] },
      { type: 'h2', text: 'Separate required from preferred' },
      { type: 'p', text: 'A long list of required skills filters out good candidates who match most of it. Keep the required list to what the engineer must have on day one, and move the rest to preferred.' },
      { type: 'h2', text: 'Describe the team and the handoffs' },
      { type: 'p', text: 'Who does this engineer receive work from, and who do they hand it to? Engineers judge a role by its neighbours as much as by its title.' },
      { type: 'quote', text: 'The best briefs could only describe one job. If yours would fit ten different roles, it will attract none of the people you want.' },
      { type: 'p', text: 'A precise brief also makes screening fairer. When the requirements are explicit, every candidate is measured against the same list.' },
    ],
  },
  {
    slug: 'analog-and-mixed-signal-notes-on-a-small-talent-pool',
    title: 'Analog and mixed-signal: notes on a small talent pool',
    excerpt: 'Why analog design experience is scarce, and what a realistic search looks like.',
    seoTitle: 'Analog and mixed-signal: notes on a small talent pool | ALLSEMIS Insights',
    seoDescription: 'Why analog design experience is scarce, and what a realistic search looks like.',
    category: 'Semiconductor',
    tags: ['Analog', 'Mixed-Signal', 'Talent'],
    topics: ['SEMICONDUCTOR', 'TALENT'],
    date: '2026-10-01',
    readTime: '4 min read',
    image: img(3862632),
    alt: 'Engineer working at a technical workstation surrounded by lab equipment',
    featured: false,
    status: 'draft',
    body: [
      { type: 'p', text: 'Analog and mixed-signal design is learned slowly, through silicon results and years beside experienced designers. That apprenticeship model keeps the talent pool small in every market.' },
      { type: 'h2', text: 'What a realistic search looks like' },
      { type: 'p', text: 'Draft. Outline: circuit families and why they do not transfer cleanly, the role of layout, and how to read an analog profile.' },
    ],
  },
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

// Fills the full data model for any article that does not state a
// field itself. Explicit values on the article always win.
function normaliseArticle(article) {
  return {
    category: CATEGORY_BY_TOPIC[article.topics[0]] || 'Hiring',
    tags: [],
    author: DEFAULT_AUTHOR,
    status: 'published',
    seoTitle: '',
    seoDescription: '',
    ...article,
  };
}

// Every article, drafts included - what the admin Insights CMS lists.
export const ALL_ARTICLES = SEED_ARTICLES.map(normaliseArticle);

// Published articles only - what every public page reads. A draft can
// never appear on the site, be opened by slug, or be suggested as
// related reading.
export const ARTICLES = ALL_ARTICLES.filter((article) => article.status === 'published');

export function getArticlesByCategory(category) {
  return ARTICLES.filter((article) => article.category === category);
}

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
