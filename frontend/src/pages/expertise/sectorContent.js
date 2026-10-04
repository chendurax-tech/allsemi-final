// Sector page content - realistic, technically credible, substantial
// seed content for all 8 Expertise sectors, in the client-approved
// order (see SECTORS in components/Expertise.jsx). Structured as plain
// data objects so an admin panel can later replace any field without
// touching JSX. Independently drafted from genuine engineering-
// recruitment terminology, not copied from any reference site.
//
// The content is industry-level: what the discipline covers, which
// roles exist in it and why they are hard to hire for. It names no
// clients, partnerships, placement numbers, success rates or awards.
// Representative search profiles are explicitly labeled on the page as
// illustrative - never presented as a record of an actual placement,
// client, or outcome. Their references follow the sector number
// (SEARCH / 2xx belongs to sector 02).

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

// Maps a sector to its most relevant existing Insights article (from
// lib/insightsContent.js - no duplicate article data here, just a
// reference by slug), so "From Insights" always links to a real,
// on-topic article rather than a placeholder. A sector with no entry
// has no on-topic article yet, and its page leaves the block out
// rather than link to something unrelated.
export const SECTOR_INSIGHT_SLUG = {
  semiconductor: 'semiconductor-engineering-talent-trends',
  mobility: 'automotive-engineering-talent',
  'ai-infrastructure': 'hiring-for-ai-infrastructure-teams',
  healthcare: 'medical-technology-hiring-landscape',
  'consumer-retail': 'precision-manufacturing-talent',
  'banking-fintech': 'engineering-talent-behind-modern-payments',
};

export const SECTOR_CONTENT = {
  // 01
  semiconductor: {
    introduction:
      'From architecture through verification to tape-out, semiconductor design is the sector ALLSEMIS was built around.',
    domainOverview:
      'Semiconductor design spans a chain of specialised disciplines, from RTL architecture through functional verification, design-for-test, physical implementation and final signoff, with analog and mixed-signal design and post-silicon validation alongside. Each stage carries its own tools, its own methodology, and its own narrow talent pool, which means a single generic "chip engineer" search rarely finds the right person. ALLSEMIS scopes every semiconductor search to the specific discipline, seniority and technology the role actually needs.',
    domains: ['VLSI & Chip Design', 'ASIC & SoC Design', 'RTL Design', 'Design Verification', 'Physical Design', 'DFT', 'Analog & Mixed-Signal', 'Physical Verification', 'Silicon Validation', 'Process & Fab Engineering'],
    roles: ['RTL Design Engineer', 'Design Verification Engineer', 'Physical Design Engineer', 'DFT Engineer', 'Physical Verification Engineer', 'ASIC Design Engineer', 'SoC Design Engineer', 'Analog / Mixed-Signal Engineer', 'Post-Silicon Validation Engineer'],
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
  // 02
  embedded: {
    introduction:
      'The firmware, embedded software and electronics engineering that turns a chip and a board into a working product.',
    domainOverview:
      'Embedded systems engineering sits where hardware and software meet. A microcontroller or processor only becomes a product once a board has been brought up, drivers written, an RTOS or embedded Linux configured, and the firmware validated against real hardware and real timing constraints. The work spans disciplines that are often grouped under one job title but call for different depth: bare-metal firmware, device drivers and board support, real-time software, electronics design, and the integration and validation effort that connects them. Strong embedded hiring starts with being exact about which of those a role needs.',
    domains: ['Embedded Firmware', 'Embedded Software', 'Microcontrollers & SoC Platforms', 'RTOS & Real-Time Systems', 'Embedded Linux', 'Device Drivers & BSP', 'Board Bring-Up', 'Hardware / Software Integration', 'Electronics & Hardware Design', 'Firmware Validation', 'IoT & Connected Devices'],
    roles: ['Embedded Firmware Engineer', 'Embedded Software Engineer', 'Embedded Linux Engineer', 'Device Driver / BSP Engineer', 'Hardware Design Engineer', 'Board Bring-Up Engineer', 'Firmware Validation Engineer', 'IoT Systems Engineer', 'Embedded Systems Architect'],
    hiringChallenges: [
      { num: '01', title: 'One Title, Many Jobs', detail: 'One title spans bare-metal firmware, RTOS, embedded Linux and drivers, and depth rarely transfers.' },
      { num: '02', title: 'Hardware Fluency', detail: 'Strong firmware engineers read schematics and debug at board level, which a software-only background lacks.' },
      { num: '03', title: 'Platform-Specific Experience', detail: 'Experience is often tied to one microcontroller family, processor architecture or RTOS, which narrows the realistic pool.' },
      { num: '04', title: 'Bring-Up and Integration Depth', detail: 'Bringing up a new board is learned on real programmes, and few engineers have done it more than a handful of times.' },
    ],
    processFlow: ['Board', 'Bring-Up', 'Firmware', 'Integration', 'Validation'],
    representativeSearches: [
      { ref: 'SEARCH / 201', title: 'Embedded Firmware', requirement: 'Bare-metal and RTOS firmware for a microcontroller-based product', signals: ['Embedded C', 'RTOS', 'ARM Cortex-M', 'SPI / I2C / UART', 'Low Power'] },
      { ref: 'SEARCH / 202', title: 'Embedded Linux & BSP', requirement: 'Board support and driver development on an embedded Linux platform', signals: ['Linux Kernel', 'Device Drivers', 'Device Tree', 'Yocto', 'U-Boot'] },
      { ref: 'SEARCH / 203', title: 'Hardware / Firmware Integration', requirement: 'Board bring-up and validation across hardware and firmware', signals: ['Board Bring-Up', 'Schematic Review', 'Oscilloscope / Logic Analyser', 'Firmware Validation'] },
    ],
  },
  // 03
  mobility: {
    introduction:
      'The electronics and software inside connected vehicles, and the wireless, RF and satellite systems that link them.',
    domainOverview:
      'Mobility and communications engineering overlap more than they ever have. A modern vehicle is a network of electronic control units, sensors and software that also has to stay connected, through telematics, cellular and short-range wireless, and increasingly satellite links. On the vehicle side, hiring is shaped by safety: driver-assistance and control software is developed under functional-safety processes that take years to learn. On the communications side, RF and wireless systems engineering draws on a small pool with deep signal-chain and protocol knowledge. Searches in this sector usually need both the core discipline and experience of the environment it is applied in.',
    domains: ['Automotive Electronics', 'ADAS & Assisted Driving', 'Vehicle Software', 'Functional Safety', 'Connected Mobility & Telematics', 'Wireless Systems', 'RF Engineering', 'Communications Systems', 'Satellite Communications', 'Mobility Platforms'],
    roles: ['ADAS Engineer', 'Automotive Embedded Software Engineer', 'Functional Safety Engineer', 'Vehicle Software Engineer', 'Telematics & Connectivity Engineer', 'RF Systems Engineer', 'Wireless Systems Engineer', 'Communications Systems Engineer', 'Systems Validation Engineer'],
    hiringChallenges: [
      { num: '01', title: 'Safety-Critical Process', detail: 'Safety-relevant vehicle roles need real ISO 26262 process exposure, not embedded skill alone.' },
      { num: '02', title: 'Cross-Disciplinary Systems', detail: 'ADAS, telematics and connectivity roles span hardware, embedded software, RF and systems at once.' },
      { num: '03', title: 'Small RF and Wireless Pool', detail: 'Deep RF, antenna and signal-chain experience is scarce, and rarely comes with vehicle programme experience as well.' },
      { num: '04', title: 'Long Qualification Cycles', detail: 'Automotive-grade and high-reliability programmes run for years, so relevant experience builds slowly.' },
    ],
    processFlow: ['Sensing', 'Compute', 'Control', 'Connectivity', 'Validation'],
    representativeSearches: [
      { ref: 'SEARCH / 301', title: 'ADAS Systems', requirement: 'Functional safety engineering for driver-assistance systems', signals: ['ISO 26262', 'AUTOSAR', 'Sensor Fusion', 'C / C++'] },
      { ref: 'SEARCH / 302', title: 'Vehicle Connectivity', requirement: 'Telematics and in-vehicle networking for a connected vehicle platform', signals: ['CAN / LIN', 'Automotive Ethernet', 'Telematics', 'Cellular / V2X', 'OTA Updates'] },
      { ref: 'SEARCH / 303', title: 'RF & Wireless Systems', requirement: 'RF system design and validation for wireless and satellite links', signals: ['RF Design', 'Link Budget', 'DSP', 'Antenna Systems', 'Test & Measurement'] },
    ],
  },
  // 04
  'ai-infrastructure': {
    introduction:
      'The compute, data and platform engineering that large-scale AI workloads depend on.',
    domainOverview:
      'AI infrastructure engineering sits at the intersection of distributed systems, cloud platforms and hardware-aware engineering. Building and operating the compute behind large-scale AI workloads demands people who understand failure modes that only appear at genuine scale, from GPU scheduling contention to network partitioning under load, along with the data platforms and MLOps tooling that move a model from training into reliable production. This is a distinct specialism from general cloud engineering, and ALLSEMIS treats it as its own search.',
    domains: ['AI Infrastructure', 'Cloud Engineering', 'Cloud Platforms', 'ML Infrastructure & MLOps', 'GPU Infrastructure', 'Distributed Systems', 'Data Platforms', 'Data Engineering', 'Platform Engineering', 'Site Reliability'],
    roles: ['AI Infrastructure Engineer', 'Cloud Engineer', 'ML Infrastructure / MLOps Engineer', 'Platform Engineer', 'Data Engineer', 'Data Platform Engineer', 'Distributed Systems Engineer', 'GPU / HPC Infrastructure Engineer', 'Site Reliability Engineer'],
    hiringChallenges: [
      { num: '01', title: 'Scale-Specific Experience', detail: 'Failure modes that only appear at genuine scale are rarely visible on a resume built for general cloud roles.' },
      { num: '02', title: 'Hardware/Software Overlap', detail: 'The strongest candidates are comfortable close to the hardware, not just at the platform layer above it.' },
      { num: '03', title: 'Intense Market Demand', detail: 'Demand for infrastructure-at-scale engineers currently outpaces the available senior pool industry-wide.' },
      { num: '04', title: 'Fast-Moving Stack', detail: 'Tooling and orchestration practices shift quickly, so relevant experience can go stale faster than in other disciplines.' },
    ],
    processFlow: ['Compute', 'Data', 'Orchestration', 'Deployment', 'Reliability'],
    representativeSearches: [
      { ref: 'SEARCH / 401', title: 'AI Infrastructure', requirement: 'Distributed systems capability for large-scale compute', signals: ['Kubernetes', 'Distributed Systems', 'GPU Scheduling', 'Networking'] },
      { ref: 'SEARCH / 402', title: 'ML Platform & MLOps', requirement: 'Platform reliability for production ML workloads', signals: ['Python', 'Terraform', 'Model Deployment', 'Monitoring', 'Incident Response'] },
      { ref: 'SEARCH / 403', title: 'Data Platform Engineering', requirement: 'Batch and streaming data platforms feeding analytics and ML', signals: ['Spark', 'Kafka', 'SQL', 'Workflow Orchestration', 'Data Modelling'] },
    ],
  },
  // 05
  healthcare: {
    introduction:
      'Engineering talent for medical devices and healthcare technology, where regulatory precision matters as much as technical skill.',
    domainOverview:
      'Medical technology hiring has a second axis that most other engineering searches do not: regulatory fluency. A candidate can be an excellent embedded, electronics or software engineer and still be a poor fit for a role that requires real, working familiarity with a standard like ISO 13485 or IEC 62304, or with an FDA 510(k) pathway. That holds across medical devices, diagnostic equipment and the clinical software platforms around them, where verification, validation and documentation are part of the engineering work itself. ALLSEMIS searches account for both the engineering depth and the regulatory context together.',
    domains: ['Medical Devices', 'Embedded Medical Systems', 'Medical Electronics', 'Diagnostic & Imaging Systems', 'Healthcare Software', 'Clinical Technology Platforms', 'Device Verification & Validation', 'Quality & Regulatory Engineering'],
    roles: ['Medical Device Engineer', 'Embedded Systems Engineer (Medical)', 'Medical Electronics Engineer', 'Diagnostic Systems Engineer', 'Imaging Systems Engineer', 'Healthcare Software Engineer', 'Clinical Systems Engineer', 'Verification & Validation Engineer', 'Regulatory & Quality Engineer'],
    hiringChallenges: [
      { num: '01', title: 'Regulatory Fluency Gap', detail: 'Regulatory process experience is often as scarce as the underlying engineering skill itself.' },
      { num: '02', title: 'On-the-Job Learning', detail: 'Regulatory fluency is usually learned inside a small number of companies that already operate under it.' },
      { num: '03', title: 'Late-Stage Discovery', detail: 'A search built purely around technical skill can miss the regulatory gap until very late in the process.' },
      { num: '04', title: 'Validation Discipline', detail: 'Design controls, traceability and formal validation are daily work here, and that experience is hard to judge from a resume.' },
    ],
    processFlow: ['Signal', 'Imaging', 'Diagnosis', 'Device'],
    representativeSearches: [
      { ref: 'SEARCH / 501', title: 'Diagnostic Systems', requirement: 'Embedded and signal-processing engineering for diagnostic imaging', signals: ['ISO 13485', 'Signal Processing', 'Embedded C', 'FDA 510(k)'] },
      { ref: 'SEARCH / 502', title: 'Medical Device Engineering', requirement: 'Regulated device development for a diagnostic hardware platform', signals: ['Design Controls', 'Verification & Validation', 'Regulatory Documentation'] },
      { ref: 'SEARCH / 503', title: 'Healthcare Software', requirement: 'Software engineering for a regulated clinical technology platform', signals: ['IEC 62304', 'HL7 / FHIR', 'Data Privacy', 'Software Validation'] },
    ],
  },
  // 06
  'consumer-retail': {
    introduction:
      'Product and platform engineering for connected consumer products, retail technology and digital commerce.',
    domainOverview:
      'Consumer and retail technology covers two kinds of engineering that increasingly depend on each other. One builds the product itself: connected devices and consumer electronics that have to be designed, manufactured and supported at volume. The other builds the systems that sell and move it: e-commerce platforms, store and point-of-sale technology, and the supply-chain software behind fulfilment. Both run on fast release cycles and are judged directly by customers, so the strongest engineers pair technical depth with a clear feel for product quality, scale and reliability at peak.',
    domains: ['Connected Consumer Products', 'Consumer Electronics', 'Product Engineering', 'Retail Technology', 'E-commerce Platforms', 'Digital Commerce', 'Supply-Chain Technology', 'Customer-Facing Applications'],
    roles: ['Product Engineer', 'Consumer Electronics Engineer', 'E-commerce Platform Engineer', 'Full-Stack Engineer', 'Mobile App Engineer', 'Retail Systems Engineer', 'Supply-Chain Systems Engineer', 'Quality Engineer', 'Technical Product Manager'],
    hiringChallenges: [
      { num: '01', title: 'Product and Platform Range', detail: 'Device engineering and commerce-platform engineering are different skill sets, and briefs here often ask for some of both.' },
      { num: '02', title: 'Peak-Scale Experience', detail: 'Systems that hold up through seasonal peaks need experience that ordinary web-scale work may not provide.' },
      { num: '03', title: 'Fast Release Cycles', detail: 'Consumer roadmaps move quickly, and not every background suits shipping at that pace without losing quality.' },
      { num: '04', title: 'Volume and Supply Constraints', detail: 'Consumer-scale manufacturing and fulfilment add constraints that a design-only or software-only background can miss.' },
    ],
    processFlow: ['Product', 'Supply', 'Commerce', 'Customer'],
    representativeSearches: [
      { ref: 'SEARCH / 601', title: 'Connected Product Engineering', requirement: 'Hardware and firmware product engineering for a connected consumer device', signals: ['Product Development', 'DFM', 'Bluetooth / Wi-Fi', 'Companion App Integration'] },
      { ref: 'SEARCH / 602', title: 'E-commerce Platform', requirement: 'Backend engineering for a high-traffic digital commerce platform', signals: ['Microservices', 'Catalogue & Checkout', 'Payments Integration', 'Peak Performance'] },
      { ref: 'SEARCH / 603', title: 'Supply-Chain Systems', requirement: 'Software engineering for inventory, order and fulfilment systems', signals: ['Order Management', 'Inventory Systems', 'Systems Integration', 'Data Pipelines'] },
    ],
  },
  // 07
  'business-finance': {
    introduction:
      'The enterprise software, business systems and data platforms that run commercial, finance and customer operations.',
    domainOverview:
      'Most organisations run on technology that never ships as a product in its own right: ERP and finance systems, CRM and customer platforms, internal data platforms, and the digital products that connect them to their customers. Engineering and product talent in this space works closer to the business than in most sectors, turning finance, operations and customer processes into systems that hold up at scale. The strongest candidates combine sound engineering with real understanding of the business function they serve. That is a different profile from the payments and banking infrastructure specialists covered under Banking, Finance & FinTech.',
    domains: ['Enterprise Technology', 'Enterprise Software', 'Business Systems (ERP / CRM)', 'Finance Systems & Platforms', 'Digital Products', 'Data Platforms & Analytics', 'Customer Technology', 'Business Operations Technology'],
    roles: ['Enterprise Software Engineer', 'Business Systems Analyst', 'ERP / CRM Engineer', 'Finance Systems Engineer', 'Data Engineer', 'Analytics Engineer', 'Customer Platform Engineer', 'Solutions Architect', 'Product Manager'],
    hiringChallenges: [
      { num: '01', title: 'Business Fluency', detail: 'Engineers who understand the business process behind a system are much scarcer than pure technologists.' },
      { num: '02', title: 'Platform-Specific Experience', detail: 'Experience is often tied to one enterprise platform or ecosystem, which narrows the realistic pool for a given role.' },
      { num: '03', title: 'Cross-Functional Demands', detail: 'Roles increasingly require comfort working between engineering, product, finance and commercial stakeholders.' },
      { num: '04', title: 'Legacy and Modern Together', detail: 'Established systems often run beside new cloud and data platforms, and roles need people effective in both.' },
    ],
    processFlow: ['Data', 'Decision', 'Operations', 'Growth'],
    representativeSearches: [
      { ref: 'SEARCH / 701', title: 'Enterprise Platforms', requirement: 'Engineering for core business and finance systems', signals: ['ERP', 'Systems Integration', 'APIs', 'Process Automation'] },
      { ref: 'SEARCH / 702', title: 'Data & Analytics', requirement: 'Data platform engineering for business reporting and decision support', signals: ['SQL', 'Data Modelling', 'ETL / ELT', 'BI & Reporting'] },
      { ref: 'SEARCH / 703', title: 'Digital Product', requirement: 'Product and engineering leadership for a customer-facing digital product', signals: ['Product Discovery', 'Roadmapping', 'Web & Mobile', 'Customer Analytics'] },
    ],
  },
  // 08
  'banking-fintech': {
    introduction:
      'Engineering talent behind banking technology, payments and financial infrastructure, not general finance hiring.',
    domainOverview:
      'Banking and fintech engineering sits at the intersection of distributed-systems depth and regulated financial infrastructure, a narrower combination than either skill alone. The strongest candidates are comfortable with high-throughput transaction processing, API security, and the operational rigour that regulated systems demand, across core and digital banking platforms, payments, and the risk, compliance and data systems behind them. None of that shows up clearly on a resume built for general backend roles.',
    domains: ['Banking Technology', 'Digital Banking', 'Payments Infrastructure', 'Transaction Systems', 'FinTech Products', 'Risk Technology', 'Compliance Technology', 'Financial Data Platforms', 'Security & Cryptography', 'API Platform Engineering'],
    roles: ['Payments Infrastructure Engineer', 'Core Banking Engineer', 'Digital Banking Engineer', 'Fintech Systems Engineer', 'Risk Technology Engineer', 'Compliance Technology Engineer', 'Financial Data Engineer', 'Security Engineer', 'API Platform Engineer'],
    hiringChallenges: [
      { num: '01', title: 'Regulated-Systems Experience', detail: 'Genuine familiarity with regulated financial infrastructure is scarce relative to general backend experience.' },
      { num: '02', title: 'High-Throughput Depth', detail: 'Transaction-scale systems experience is a distinct skill from typical web-scale backend engineering.' },
      { num: '03', title: 'Security Rigour', detail: 'API and data security requirements in fintech are stricter than most general engineering roles demand.' },
      { num: '04', title: 'Risk and Compliance Overlap', detail: 'Risk and compliance systems need engineers who can turn regulatory requirements into working controls.' },
    ],
    processFlow: ['Transaction', 'API', 'Risk', 'Settlement'],
    representativeSearches: [
      { ref: 'SEARCH / 801', title: 'Payments Infrastructure', requirement: 'High-throughput transaction processing systems', signals: ['Distributed Systems', 'API Design', 'Security', 'Event Streaming'] },
      { ref: 'SEARCH / 802', title: 'Fintech Security Engineering', requirement: 'Security engineering for regulated financial platforms', signals: ['Cryptography', 'Threat Modeling', 'Compliance Awareness'] },
      { ref: 'SEARCH / 803', title: 'Risk & Compliance Technology', requirement: 'Engineering for transaction monitoring and regulatory reporting systems', signals: ['Transaction Monitoring', 'Rules Engines', 'Regulatory Reporting', 'Data Lineage'] },
    ],
  },
};
