// Talent page content - structured, data-driven seed content, same
// discipline as employerContent.js. Roles below are explicitly labeled
// as representative/illustrative on the page - not live ALLSEMI
// vacancies - and carry no salary, company, location, or reference
// number, per the same rule already established for the Talent page
// in ALLSEMI-CONTENT-MASTER.md.

export const TALENT_HERO = {
  eyebrow: 'ENGINEERING TALENT / SIGNAL 01',
  headline: 'Your next move starts with the right signal.',
  sub: 'Specialist engineering roles across semiconductor, automotive, aerospace and the systems built around them.',
  image: 'https://images.pexels.com/photos/3862632/pexels-photo-3862632.jpeg?auto=compress&cs=tinysrgb&h=1000&w=1500',
  alt: 'Engineer working at a technical workstation surrounded by lab equipment',
};

export const CAREER_POSITIONING = {
  statement: 'Specialised careers need specialised conversations.',
  disciplines: ['DESIGN', 'VERIFICATION', 'PHYSICAL', 'DFT', 'EMBEDDED', 'AUTOMOTIVE', 'AEROSPACE', 'SYSTEMS'],
};

export const SPECIALISATION_MAP = [
  { discipline: 'SEMICONDUCTOR', nodes: ['RTL', 'DV', 'DFT', 'PD', 'PV', 'ANALOG'] },
  { discipline: 'AUTOMOTIVE', nodes: ['ADAS', 'EMBEDDED', 'SAFETY', 'POWER'] },
  { discipline: 'AEROSPACE', nodes: ['AVIONICS', 'COMMS', 'EMBEDDED'] },
  { discipline: 'AI / CLOUD', nodes: ['COMPUTE', 'INFRASTRUCTURE', 'PLATFORM'] },
];

// Representative seeded roles - the data model an admin-created live
// job would slot into later. No salary, company, location, or
// reference number is invented.
export const REPRESENTATIVE_ROLES = [
  { num: '01', title: 'Design Verification Engineer', tags: ['SystemVerilog', 'UVM', 'Assertions', 'Coverage'] },
  { num: '02', title: 'Physical Design Engineer', tags: ['PnR', 'STA', 'Timing Closure', 'Physical Implementation'] },
  { num: '03', title: 'DFT Engineer', tags: ['Scan', 'ATPG', 'MBIST', 'JTAG'] },
  { num: '04', title: 'RTL Design Engineer', tags: ['Verilog', 'SystemVerilog', 'RTL', 'SoC'] },
  { num: '05', title: 'ADAS Engineer', tags: ['ADAS', 'Embedded', 'Automotive Systems'] },
  { num: '06', title: 'Functional Safety Engineer', tags: ['ISO 26262', 'Safety Systems', 'Automotive'] },
];

export const TALENT_JOURNEY = [
  { num: '01', label: 'Understand', detail: 'Your technical background and career direction.' },
  { num: '02', label: 'Match', detail: 'Relevant engineering opportunities.' },
  { num: '03', label: 'Prepare', detail: 'Interview and role context.' },
  { num: '04', label: 'Move', detail: 'Support through the hiring process.' },
];

export const TALENT_CTA = {
  headline: 'Let the right opportunity find you.',
  button: 'Send Your Profile →',
};
