// Employers page content - structured, data-driven seed content so an
// admin panel can later replace any section without touching JSX.
//
// Everything here is either already-confirmed ALLSEMI fact (the three
// service names, the Bangalore contact details used elsewhere in the
// app), independently-drafted realistic recruitment content built from
// genuine semiconductor/engineering terminology, or explicitly labeled
// as representative/illustrative rather than a specific ALLSEMI claim.
// No client names, placement counts, revenue, retention figures,
// guarantees, or awards are invented anywhere below.

export const EMPLOYER_HERO = {
  eyebrow: 'TALENT SYSTEM / 01',
  headline: 'Build the team behind the technology.',
  sub: 'Specialist engineering talent across semiconductor, automotive, aerospace and the systems built around them.',
  image: 'https://images.pexels.com/photos/9242271/pexels-photo-9242271.jpeg?auto=compress&cs=tinysrgb&h=1000&w=1500',
  alt: 'Electronics engineer assembling a circuit board with precision',
};

export const HIRING_PROBLEM = {
  statement: 'Specialised engineering roles require specialised search.',
  keywords: ['RTL', 'DFT', 'UVM', 'STA', 'ASIC', 'SOC', 'ADAS', 'FUNCTIONAL SAFETY', 'EMBEDDED'],
};

export const TALENT_ENGINE_STAGES = [
  { num: '01', label: 'Requirement', detail: 'A precise technical brief, not a generic job description.' },
  { num: '02', label: 'Domain Search', detail: 'Sourcing scoped to the exact discipline, not a broad keyword match.' },
  { num: '03', label: 'Technical Screen', detail: 'A conversation with someone who understands the role.' },
  { num: '04', label: 'Shortlist', detail: 'Candidates who match the brief, not just the title.' },
  { num: '05', label: 'Interview', detail: 'Coordinated end to end, with technical context carried through.' },
  { num: '06', label: 'Offer', detail: 'Supported to close, not just to introduce.' },
];

export const RECRUITMENT_SOLUTIONS = [
  {
    num: '01',
    title: 'Permanent Staffing',
    description: 'Full-time engineering talent for specialised technical teams.',
    image: 'https://images.pexels.com/photos/6636463/pexels-photo-6636463.jpeg?auto=compress&cs=tinysrgb&h=900&w=1400',
    alt: 'Close-up of a microprocessor on a motherboard',
  },
  {
    num: '02',
    title: 'Project Staffing',
    description: 'Flexible engineering capacity for defined technical programmes.',
    image: 'https://images.pexels.com/photos/5554948/pexels-photo-5554948.jpeg?auto=compress&cs=tinysrgb&h=900&w=1400',
    alt: 'Organized electronic circuit boards in a production setting',
  },
  {
    num: '03',
    title: 'RPO',
    description: 'A dedicated recruitment engine for scaling hiring operations.',
    image: 'https://images.pexels.com/photos/4508751/pexels-photo-4508751.jpeg?auto=compress&cs=tinysrgb&h=900&w=1400',
    alt: 'Modern data center corridor with server racks',
  },
  {
    num: '04',
    title: 'Specialised Search',
    description: 'Focused search for difficult technical and leadership requirements.',
    image: 'https://images.pexels.com/photos/6325002/pexels-photo-6325002.jpeg?auto=compress&cs=tinysrgb&h=900&w=1400',
    alt: 'Satellite antenna structure',
  },
];

export const TECHNICAL_SPECIALISATION = [
  { discipline: 'SEMICONDUCTOR', tags: ['RTL', 'VERIFICATION', 'DFT', 'PHYSICAL DESIGN'] },
  { discipline: 'AUTOMOTIVE', tags: ['ADAS', 'EMBEDDED', 'FUNCTIONAL SAFETY', 'POWER ELECTRONICS'] },
  { discipline: 'AEROSPACE', tags: ['AVIONICS', 'COMMUNICATIONS', 'EMBEDDED SYSTEMS'] },
  { discipline: 'AI / CLOUD', tags: ['COMPUTE', 'INFRASTRUCTURE', 'PLATFORM ENGINEERING'] },
];

export const DELIVERY_FLOW = [
  { num: '01', label: 'Discover', detail: 'Understand the role, the team, and what "right" actually looks like.' },
  { num: '02', label: 'Map', detail: 'Identify where the relevant talent actually sits.' },
  { num: '03', label: 'Screen', detail: 'Technical conversations before a candidate ever reaches you.' },
  { num: '04', label: 'Present', detail: 'A shortlist built around fit, not volume.' },
  { num: '05', label: 'Close', detail: 'Supported through offer and start.' },
];

// Representative examples of the KIND of search ALLSEMI runs, built
// from genuine technical terminology. These are explicitly labeled as
// representative on the page itself - not a claim that ALLSEMI filled
// these specific roles for a specific client.
export const REPRESENTATIVE_SEARCHES = [
  {
    ref: 'SEARCH / 001',
    title: 'ASIC Design',
    requirement: 'Senior RTL / ASIC engineering capability',
    signals: ['SystemVerilog', 'AMBA', 'Synthesis', 'CDC', 'Low Power'],
  },
  {
    ref: 'SEARCH / 002',
    title: 'Design Verification',
    requirement: 'Verification engineering across block and SoC level',
    signals: ['SystemVerilog', 'UVM', 'Coverage', 'Assertions', 'VCS / Xcelium / Questa'],
  },
  {
    ref: 'SEARCH / 003',
    title: 'Physical Verification',
    requirement: 'Sign-off physical verification capability',
    signals: ['DRC', 'LVS', 'ERC', 'PERC', 'Calibre', 'Tcl / Python'],
  },
];

export const EMPLOYER_CTA = {
  headline: "Tell us what you're building.",
  button: 'Start a Search →',
};
