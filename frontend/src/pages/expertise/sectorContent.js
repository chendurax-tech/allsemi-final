// Sector page content - realistic, technically credible, substantial
// seed content for all 8 Expertise sectors. Structured as plain data
// objects so an admin panel can later replace any field without
// touching JSX. Independently drafted from genuine engineering-
// recruitment terminology, not copied from any reference site.
// Representative search profiles are explicitly labeled on the page as
// illustrative - never presented as a record of an actual placement,
// client, or outcome.

// Shared 5-stage evaluation process - the search methodology itself is
// consistent across every sector (only the domain being searched
// changes), so this is defined once rather than duplicated 8 times.
export const SEARCH_EVALUATION = [
  { num: '01', label: 'Define the Requirement', detail: 'A precise technical brief, scoped to the actual discipline and seniority.' },
  { num: '02', label: 'Map the Talent', detail: 'Identify where genuinely relevant experience sits, not just adjacent titles.' },
  { num: '03', label: 'Assess Domain Experience', detail: 'A technical conversation, not a keyword match against a resume.' },
  { num: '04', label: 'Validate Technical Fit', detail: 'Confirm depth against the specific tools, standards, and systems the role needs.' },
  { num: '05', label: 'Present the Profile', detail: 'A shortlist built around genuine fit, ready for a technical interview.' },
];

// Maps each sector to its most relevant existing Insights article
// (from lib/insightsContent.js - no duplicate article data here, just
// a reference by slug), so "From Insights" always links to a real,
// on-topic article rather than a placeholder.
export const SECTOR_INSIGHT_SLUG = {
  semiconductor: 'semiconductor-engineering-talent-trends',
  'ai-infrastructure': 'hiring-for-ai-infrastructure-teams',
  automotive: 'automotive-engineering-talent',
  aerospace: 'hiring-for-aerospace-systems',
  'business-finance': 'commercial-talent-for-technical-products',
  'banking-fintech': 'engineering-talent-behind-modern-payments',
  'consumer-retail': 'precision-manufacturing-talent',
  healthcare: 'medical-technology-hiring-landscape',
};

export const SECTOR_CONTENT = {
  semiconductor: {
    introduction:
      'From architecture through verification to tape-out, semiconductor design is the sector ALLSEMIS was built around.',
    domainOverview:
      'Semiconductor design spans a chain of specialised disciplines, from RTL architecture through functional verification, design-for-test, physical implementation and final signoff. Each stage carries its own tools, its own methodology, and its own narrow talent pool, which means a single generic "chip engineer" search rarely finds the right person. ALLSEMIS scopes every semiconductor search to the specific discipline, seniority and technology the role actually needs.',
    domains: ['Analog & Mixed-Signal', 'Digital & ASIC Design', 'RTL', 'Verification', 'Physical Design', 'DFT', 'Physical Verification', 'Process & Fab Engineering'],
    roles: ['RTL Design Engineer', 'Design Verification Engineer', 'Physical Design Engineer', 'DFT Engineer', 'Physical Verification Engineer', 'ASIC Design Engineer', 'SoC Design Engineer', 'Analog / Mixed-Signal Engineer'],
    hiringChallenges: [
      { num: '01', title: 'Narrow Senior Pool', detail: 'Genuine hands-on RTL, verification, or physical design depth takes years to build, so the senior pool grows slowly relative to demand.' },
      { num: '02', title: 'Tool-Specific Depth', detail: 'Strong candidates are often deep in one specific EDA toolchain, which narrows the realistic search radius for a given role.' },
      { num: '03', title: 'Passive Candidates', detail: 'Most strong semiconductor engineers are already employed and not actively job-searching.' },
      { num: '04', title: 'Discipline Overlap', detail: 'Roles can blur across RTL, verification, and physical design, so an imprecise brief attracts the wrong shortlist.' },
    ],
    processFlow: ['Wafer', 'RTL', 'Verification', 'Physical', 'Tape-out'],
    representativeSearches: [
      { ref: 'SEARCH / 101', title: 'ASIC Design', requirement: 'Senior RTL / ASIC engineering capability', signals: ['SystemVerilog', 'AMBA', 'Synthesis', 'CDC', 'Low Power'] },
      { ref: 'SEARCH / 102', title: 'Design Verification', requirement: 'UVM verification across block and SoC level', signals: ['SystemVerilog', 'UVM', 'Coverage', 'Assertions', 'VCS / Xcelium / Questa'] },
      { ref: 'SEARCH / 103', title: 'Physical Design', requirement: 'Place-and-route and timing closure through tape-out', signals: ['PnR', 'STA', 'Timing Closure', 'Innovus / ICC2'] },
    ],
  },
  'ai-infrastructure': {
    introduction:
      'The systems, silicon and infrastructure engineering that large-scale AI compute depends on.',
    domainOverview:
      'AI infrastructure engineering sits at the intersection of distributed systems and hardware-aware engineering. Building and operating the compute behind large-scale AI workloads demands people who understand failure modes that only appear at genuine scale, from GPU scheduling contention to network partitioning under load. This is a distinct specialism from general cloud engineering, and ALLSEMIS treats it as its own search.',
    domains: ['AI Accelerator Architecture', 'Data Center Infrastructure', 'ML Systems Engineering', 'Compiler Engineering', 'Cloud Infrastructure Engineering'],
    roles: ['Infrastructure Engineer', 'ML Systems Engineer', 'Data Center Operations Engineer', 'AI Hardware Architect', 'Platform Engineer'],
    hiringChallenges: [
      { num: '01', title: 'Scale-Specific Experience', detail: 'Failure modes that only appear at genuine scale are rarely visible on a resume built for general cloud roles.' },
      { num: '02', title: 'Hardware/Software Overlap', detail: 'The strongest candidates are comfortable close to the hardware, not just at the platform layer above it.' },
      { num: '03', title: 'Intense Market Demand', detail: 'Demand for infrastructure-at-scale engineers currently outpaces the available senior pool industry-wide.' },
      { num: '04', title: 'Fast-Moving Stack', detail: 'Tooling and orchestration practices shift quickly, so relevant experience can go stale faster than in other disciplines.' },
    ],
    processFlow: ['Compute', 'Data', 'Orchestration', 'Deployment'],
    representativeSearches: [
      { ref: 'SEARCH / 201', title: 'AI Infrastructure', requirement: 'Distributed systems capability for large-scale compute', signals: ['Kubernetes', 'Distributed Systems', 'GPU Scheduling', 'Networking'] },
      { ref: 'SEARCH / 202', title: 'ML Platform Engineering', requirement: 'Platform reliability for production ML workloads', signals: ['Python', 'Terraform', 'Monitoring', 'Incident Response'] },
    ],
  },
  automotive: {
    introduction:
      'The embedded and electronics engineering inside modern vehicles, from sensor to system.',
    domainOverview:
      'Automotive engineering hiring is shaped by one requirement above all others: the vehicle has to be safe, and that requirement runs through every layer of the hiring bar, not just roles with "safety" in the title. From ADAS and sensor fusion through embedded control software and power electronics, ALLSEMIS searches for engineers who combine core technical depth with genuine safety-critical process experience.',
    domains: ['ADAS', 'Functional Safety', 'Embedded Software', 'Sensor Fusion', 'Power Electronics for EV'],
    roles: ['ADAS Engineer', 'Functional Safety Engineer', 'Embedded Software Engineer', 'Automotive Systems Engineer', 'Automotive Power Electronics Engineer', 'Sensor Fusion Engineer'],
    hiringChallenges: [
      { num: '01', title: 'Safety-Critical Process', detail: 'A strong embedded engineer without genuine ISO 26262 process exposure is often not the right fit for a safety-relevant role.' },
      { num: '02', title: 'Cross-Disciplinary Roles', detail: 'ADAS and sensor fusion roles sit across hardware, embedded software, and systems engineering at once.' },
      { num: '03', title: 'Narrow Safety Pool', detail: 'Genuine functional-safety process experience is scarce relative to the number of safety-relevant programmes now underway.' },
      { num: '04', title: 'Long Ramp Time', detail: 'Automotive-grade software and hardware development cycles mean relevant experience takes longer to accumulate.' },
    ],
    processFlow: ['Sensor', 'Fusion', 'Control', 'Validation'],
    representativeSearches: [
      { ref: 'SEARCH / 301', title: 'ADAS Systems', requirement: 'Functional safety engineering for driver-assist systems', signals: ['ISO 26262', 'AUTOSAR', 'Sensor Fusion', 'C / C++'] },
      { ref: 'SEARCH / 302', title: 'Embedded Software', requirement: 'Automotive-grade embedded control software', signals: ['Embedded C', 'RTOS', 'CAN/LIN', 'AUTOSAR'] },
    ],
  },
  aerospace: {
    introduction:
      'Precision hardware and systems engineering for aerospace, satellite and communications programs.',
    domainOverview:
      'Aerospace and communications engineering demands specialised expertise across avionics, RF systems, embedded platforms and high-reliability communications. Talent searches often span hardware, firmware and systems disciplines where domain experience matters alongside core engineering capability, and where qualification cycles reflect how much is genuinely at stake in the systems being built.',
    domains: ['RF & Microwave Engineering', 'Satellite Communications', 'Avionics', 'Embedded Systems', 'Precision Hardware Engineering'],
    roles: ['Avionics Systems Engineer', 'RF Systems Engineer', 'Embedded Software Engineer', 'Signal Processing Engineer', 'Communications Systems Engineer', 'Systems Validation Engineer'],
    hiringChallenges: [
      { num: '01', title: 'Specialised Experience', detail: 'Candidates often need a combination of systems knowledge and domain-specific aerospace or communications experience.' },
      { num: '02', title: 'High-Reliability Environments', detail: 'Engineering teams can require experience with rigorous validation, documentation and reliability processes.' },
      { num: '03', title: 'Cross-Disciplinary Systems', detail: 'Roles can sit across hardware, firmware, RF and systems engineering at once.' },
      { num: '04', title: 'Limited Specialist Pools', detail: 'Certain combinations of technical and domain experience can narrow the available candidate pool significantly.' },
    ],
    processFlow: ['Signal', 'Communications', 'Navigation', 'Systems'],
    representativeSearches: [
      { ref: 'SEARCH / 401', title: 'Avionics Systems Engineer', requirement: 'RF systems, embedded C, communications, system integration', signals: ['RF Design', 'Embedded C', 'DO-178C', 'Systems Integration'] },
      { ref: 'SEARCH / 402', title: 'Signal Processing Engineer', requirement: 'DSP algorithm development for RF signal chains', signals: ['DSP', 'MATLAB / Python', 'RF Signal Chains', 'Algorithm Development'] },
      { ref: 'SEARCH / 403', title: 'Embedded Communications Engineer', requirement: 'Real-time embedded systems for communications hardware', signals: ['Embedded C/C++', 'Protocols', 'Real-Time Systems', 'Hardware Integration'] },
    ],
  },
  'business-finance': {
    introduction:
      'Commercial and operational talent for technology companies building consumer-facing products.',
    domainOverview:
      'Commercial and operational roles around a technical product are often treated as generic hires, and they rarely should be. The strongest candidates in this space combine genuine business judgement with real fluency in the underlying technology, which changes how they operate in a room with engineers and technical buyers. ALLSEMIS searches for commercial talent that can follow the product at a technical level, not just present it.',
    domains: ['Sales Engineering', 'Business Operations', 'Product Management', 'Go-to-Market Strategy'],
    roles: ['Account Manager', 'Business Operations Lead', 'Product Manager', 'Sales Engineer'],
    hiringChallenges: [
      { num: '01', title: 'Technical Fluency Gap', detail: 'Many strong commercial candidates cannot genuinely follow the underlying technology, which limits credibility with technical buyers.' },
      { num: '02', title: 'Cross-Functional Demands', detail: 'Roles increasingly require comfort operating between engineering, product and commercial stakeholders.' },
      { num: '03', title: 'Pace Mismatch', detail: 'Consumer and hardware-adjacent roadmaps move quickly, and not every commercial background is suited to that pace.' },
    ],
    processFlow: ['Data', 'Decision', 'Operations', 'Growth'],
    representativeSearches: [
      { ref: 'SEARCH / 501', title: 'Product Operations', requirement: 'Commercial operations for a hardware-adjacent product line', signals: ['Product Analytics', 'Go-to-Market', 'Cross-functional Delivery'] },
      { ref: 'SEARCH / 502', title: 'Technical Sales Engineering', requirement: 'Pre-sales engineering for a technical product suite', signals: ['Solution Design', 'Technical Presentations', 'Customer Discovery'] },
    ],
  },
  'banking-fintech': {
    introduction:
      'Engineering talent behind modern payment and financial infrastructure, not general finance hiring.',
    domainOverview:
      'Payments infrastructure and fintech engineering sit at the intersection of distributed-systems depth and regulated financial infrastructure, a narrower combination than either skill alone. The strongest candidates need to be comfortable with high-throughput transaction processing, API security, and the operational rigour that regulated systems demand, none of which shows up clearly on a resume built for general backend roles.',
    domains: ['Payments Infrastructure', 'Financial Systems Engineering', 'Security & Cryptography', 'API Platform Engineering'],
    roles: ['Payments Infrastructure Engineer', 'Fintech Systems Engineer', 'Security Engineer', 'API Platform Engineer'],
    hiringChallenges: [
      { num: '01', title: 'Regulated-Systems Experience', detail: 'Genuine familiarity with regulated financial infrastructure is scarce relative to general backend experience.' },
      { num: '02', title: 'High-Throughput Depth', detail: 'Transaction-scale systems experience is a distinct skill from typical web-scale backend engineering.' },
      { num: '03', title: 'Security Rigour', detail: 'API and data security requirements in fintech are stricter than most general engineering roles demand.' },
    ],
    processFlow: ['Transaction', 'API', 'Risk', 'Settlement'],
    representativeSearches: [
      { ref: 'SEARCH / 601', title: 'Payments Infrastructure', requirement: 'High-throughput transaction processing systems', signals: ['Distributed Systems', 'API Design', 'Security', 'Event Streaming'] },
      { ref: 'SEARCH / 602', title: 'Fintech Security Engineering', requirement: 'Security engineering for regulated financial platforms', signals: ['Cryptography', 'Threat Modeling', 'Compliance Awareness'] },
    ],
  },
  'consumer-retail': {
    introduction:
      'Precision manufacturing and product engineering talent for consumer goods and retail technology.',
    domainOverview:
      'Consumer electronics and retail technology teams need engineers who are equally comfortable on the production floor and inside a fast-moving product roadmap. That combination, manufacturing depth paired with product-development speed, is less common than it sounds, and it is usually the deciding factor between an adequate hire and a genuinely strong one.',
    domains: ['Manufacturing Engineering', 'Consumer Electronics Product Engineering', 'Supply Chain Engineering', 'Quality Engineering'],
    roles: ['Manufacturing Engineer', 'Product Engineer', 'Quality Engineer', 'Supply Chain Engineer'],
    hiringChallenges: [
      { num: '01', title: 'Floor-to-Roadmap Range', detail: 'Few candidates are equally strong in production-floor engineering and fast-moving product development.' },
      { num: '02', title: 'DFM Depth', detail: 'Genuine design-for-manufacture experience is distinct from, and rarer than, general product design experience.' },
      { num: '03', title: 'Supply Chain Complexity', detail: 'Consumer-scale supply chains introduce engineering constraints that a purely design-focused background will miss.' },
    ],
    processFlow: ['Product', 'Supply', 'Commerce', 'Customer'],
    representativeSearches: [
      { ref: 'SEARCH / 701', title: 'Product Engineering', requirement: 'Manufacturing and quality engineering for a consumer electronics line', signals: ['DFM', 'Six Sigma', 'Supply Chain', 'PLM'] },
      { ref: 'SEARCH / 702', title: 'Quality Engineering', requirement: 'Quality systems for consumer-scale production', signals: ['Quality Systems', 'Statistical Process Control', 'Supplier Audits'] },
    ],
  },
  healthcare: {
    introduction:
      'Engineering talent for medical devices and diagnostic technology, where regulatory precision matters as much as technical skill.',
    domainOverview:
      'Medical device and diagnostic engineering hiring has a second axis that most other engineering searches do not: regulatory fluency. A candidate can be an excellent embedded or signal-processing engineer and still be a poor fit for a role that requires real, working familiarity with a standard like ISO 13485 or an FDA 510(k) pathway. ALLSEMIS searches account for both the engineering depth and the regulatory context together.',
    domains: ['Medical Device Engineering', 'Diagnostic Equipment Engineering', 'Imaging Systems', 'Regulatory & Quality Engineering'],
    roles: ['Medical Device Engineer', 'Diagnostic Systems Engineer', 'Imaging Systems Engineer', 'Regulatory & Quality Engineer'],
    hiringChallenges: [
      { num: '01', title: 'Regulatory Fluency Gap', detail: 'Regulatory process experience is often as scarce as the underlying engineering skill itself.' },
      { num: '02', title: 'On-the-Job Learning', detail: 'Regulatory fluency is usually learned inside a small number of companies that already operate under it.' },
      { num: '03', title: 'Late-Stage Discovery', detail: 'A search built purely around technical skill can miss the regulatory gap until very late in the process.' },
    ],
    processFlow: ['Signal', 'Imaging', 'Diagnosis', 'Device'],
    representativeSearches: [
      { ref: 'SEARCH / 801', title: 'Diagnostic Systems', requirement: 'Embedded and signal-processing engineering for diagnostic imaging', signals: ['ISO 13485', 'Signal Processing', 'Embedded C', 'FDA 510(k)'] },
      { ref: 'SEARCH / 802', title: 'Medical Device Engineering', requirement: 'Regulated device development for a diagnostic hardware platform', signals: ['Design Controls', 'Verification & Validation', 'Regulatory Documentation'] },
    ],
  },
};
