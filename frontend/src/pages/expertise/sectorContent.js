// Sector page content - realistic, technically credible seed content
// for all 8 Expertise sectors. Structured as plain data objects so an
// admin panel can later replace any field without touching JSX.
//
// This is independently-drafted content built from genuine
// semiconductor/engineering terminology (domains, role titles, process
// stages), not copied from Nexus or any other source. Representative
// search examples are explicitly labeled as illustrative on the page
// itself and never presented as a record of an actual ALLSEMI
// placement, client, or outcome.

export const SECTOR_CONTENT = {
  semiconductor: {
    introduction:
      'From architecture through verification to tape-out, semiconductor design is the sector ALLSEMI was built around.',
    domains: ['Analog & Mixed-Signal', 'Digital & ASIC Design', 'RTL', 'Verification', 'Physical Design', 'DFT', 'Physical Verification', 'Process & Fab Engineering'],
    roles: ['RTL Design Engineer', 'Design Verification Engineer', 'Physical Design Engineer', 'DFT Engineer', 'Physical Verification Engineer', 'ASIC Design Engineer', 'SoC Design Engineer', 'Analog / Mixed-Signal Engineer'],
    hiringChallenges:
      'A small, senior talent pool. Long, specialised ramp time. Most strong candidates are already employed and not actively job-searching.',
    processFlow: ['Wafer', 'RTL', 'Verification', 'Physical', 'Tape-out'],
    representativeSearch: {
      ref: 'SEARCH / 101',
      title: 'ASIC Design',
      requirement: 'Senior RTL / ASIC engineering capability',
      signals: ['SystemVerilog', 'AMBA', 'Synthesis', 'CDC', 'Low Power'],
    },
  },
  'ai-infrastructure': {
    introduction:
      'The systems, silicon and infrastructure engineering that large-scale AI compute depends on.',
    domains: ['AI Accelerator Architecture', 'Data Center Infrastructure', 'ML Systems Engineering', 'Compiler Engineering', 'Cloud Infrastructure Engineering'],
    roles: ['Infrastructure Engineer', 'ML Systems Engineer', 'Data Center Operations Engineer', 'AI Hardware Architect', 'Platform Engineer'],
    hiringChallenges:
      'Extremely high demand across the industry for a small pool of infrastructure-at-scale engineers.',
    processFlow: ['Compute', 'Data', 'Orchestration', 'Deployment'],
    representativeSearch: {
      ref: 'SEARCH / 102',
      title: 'AI Infrastructure',
      requirement: 'Distributed systems capability for large-scale compute',
      signals: ['Kubernetes', 'Distributed Systems', 'GPU Scheduling', 'Networking', 'Python'],
    },
  },
  automotive: {
    introduction:
      'The embedded and electronics engineering inside modern vehicles, from sensor to system.',
    domains: ['ADAS', 'Functional Safety', 'Embedded Software', 'Sensor Fusion', 'Power Electronics for EV'],
    roles: ['ADAS Engineer', 'Functional Safety Engineer', 'Embedded Software Engineer', 'Automotive Systems Engineer', 'Automotive Power Electronics Engineer'],
    hiringChallenges:
      'Safety-critical requirements narrow the qualified pool, and functional-safety experience is scarce relative to demand.',
    processFlow: ['Sensor', 'Fusion', 'Control', 'Validation'],
    representativeSearch: {
      ref: 'SEARCH / 103',
      title: 'ADAS Systems',
      requirement: 'Functional safety engineering for driver-assist systems',
      signals: ['ISO 26262', 'AUTOSAR', 'Sensor Fusion', 'C / C++', 'Embedded Linux'],
    },
  },
  aerospace: {
    introduction:
      'Precision hardware and systems engineering for aerospace, satellite and communications programs.',
    domains: ['RF & Microwave Engineering', 'Satellite Communications', 'Avionics', 'Embedded Systems', 'Precision Hardware Engineering'],
    roles: ['RF Engineer', 'Systems Engineer', 'Avionics Engineer', 'Embedded Systems Engineer', 'Hardware Engineer'],
    hiringChallenges:
      'A specialised, often security-cleared talent pool, with long qualification cycles for precision hardware roles.',
    processFlow: ['Signal', 'Communications', 'Navigation', 'Systems'],
    representativeSearch: {
      ref: 'SEARCH / 104',
      title: 'Avionics Systems',
      requirement: 'RF and systems engineering for airborne communications',
      signals: ['RF Design', 'DO-178C', 'Embedded C', 'Signal Processing', 'Hardware-in-the-Loop'],
    },
  },
  'business-finance': {
    introduction:
      'Commercial, operational and go-to-market talent for technology companies building consumer-facing products.',
    domains: ['Sales Engineering', 'Business Operations', 'Product Management', 'Go-to-Market Strategy'],
    roles: ['Account Manager', 'Business Operations Lead', 'Product Manager', 'Sales Engineer'],
    hiringChallenges:
      'Finding commercial talent that can genuinely speak to the underlying technology, not just the product surface.',
    processFlow: ['Data', 'Decision', 'Operations', 'Growth'],
    representativeSearch: {
      ref: 'SEARCH / 105',
      title: 'Product Operations',
      requirement: 'Commercial operations for a hardware-adjacent product line',
      signals: ['Product Analytics', 'Go-to-Market', 'Cross-functional Delivery', 'Roadmapping'],
    },
  },
  'banking-fintech': {
    introduction:
      'Engineering talent behind modern payment systems and financial infrastructure, not general finance hiring.',
    domains: ['Payments Infrastructure', 'Financial Systems Engineering', 'Security & Cryptography', 'API Platform Engineering'],
    roles: ['Payments Infrastructure Engineer', 'Fintech Systems Engineer', 'Security Engineer', 'API Platform Engineer'],
    hiringChallenges:
      'Candidates need both systems-engineering depth and familiarity with regulated financial infrastructure, a narrower intersection than either skill alone.',
    processFlow: ['Transaction', 'API', 'Risk', 'Settlement'],
    representativeSearch: {
      ref: 'SEARCH / 106',
      title: 'Payments Infrastructure',
      requirement: 'Systems engineering for high-throughput transaction processing',
      signals: ['Distributed Systems', 'API Design', 'Security', 'Go / Java', 'Event Streaming'],
    },
  },
  'consumer-retail': {
    introduction:
      'Precision manufacturing and product engineering talent for consumer goods and retail technology.',
    domains: ['Manufacturing Engineering', 'Consumer Electronics Product Engineering', 'Supply Chain Engineering', 'Quality Engineering'],
    roles: ['Manufacturing Engineer', 'Product Engineer', 'Quality Engineer', 'Supply Chain Engineer'],
    hiringChallenges:
      'Balancing production-floor engineering depth with product-development speed across a fast-moving consumer roadmap.',
    processFlow: ['Product', 'Supply', 'Commerce', 'Customer'],
    representativeSearch: {
      ref: 'SEARCH / 107',
      title: 'Product Engineering',
      requirement: 'Manufacturing and quality engineering for a consumer electronics line',
      signals: ['DFM', 'Six Sigma', 'Supply Chain', 'Product Lifecycle Management'],
    },
  },
  healthcare: {
    introduction:
      'Engineering talent for medical devices and diagnostic technology, where regulatory precision matters as much as technical skill.',
    domains: ['Medical Device Engineering', 'Diagnostic Equipment Engineering', 'Imaging Systems', 'Regulatory & Quality Engineering'],
    roles: ['Medical Device Engineer', 'Diagnostic Systems Engineer', 'Imaging Systems Engineer', 'Regulatory & Quality Engineer'],
    hiringChallenges:
      'Regulatory-standard familiarity (for example FDA or ISO 13485) is often as scarce as the underlying engineering skill itself.',
    processFlow: ['Signal', 'Imaging', 'Diagnosis', 'Device'],
    representativeSearch: {
      ref: 'SEARCH / 108',
      title: 'Diagnostic Systems',
      requirement: 'Embedded and signal-processing engineering for diagnostic imaging',
      signals: ['ISO 13485', 'Signal Processing', 'Embedded C', 'FDA 510(k)'],
    },
  },
};
