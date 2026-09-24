// About page content - structured, data-driven, reusing the existing
// SECTORS data (Domain Network) rather than duplicating it. Positioning
// wording is independently drafted, consistent with the confirmed
// landing-page voice already established in Hero.jsx and Connecting.jsx
// ("Talent. Engineered.", "put the right engineer in front of the
// right team"). No founders, history, statistics, or claims are
// invented - see ALLSEMI-CONTENT-MASTER.md Section 05 for what remains
// genuinely unconfirmed.

export const ABOUT_HERO = {
  eyebrow: 'ABOUT / 01',
  headline: 'Connecting specialised talent with the technology shaping what comes next.',
  sub: 'ALLSEMI is a specialist staffing partner for semiconductor, VLSI, and advanced engineering talent.',
  image: 'https://images.pexels.com/photos/9242271/pexels-photo-9242271.jpeg?auto=compress&cs=tinysrgb&h=1000&w=1500',
  alt: 'Electronics engineer assembling a circuit board with precision',
};

export const POSITIONING = {
  statement: 'Talent. Technology. Expertise. Opportunity.',
  words: ['TALENT', 'TECHNOLOGY', 'EXPERTISE', 'OPPORTUNITY'],
  body: 'We connect the engineers behind modern silicon, from architecture to tape-out, with the semiconductor, automotive, aerospace and industrial teams building what is next.',
};

export const CONNECTS_NODES = [
  { id: 'talent', label: 'Talent', detail: 'Specialist engineers, from individual contributor to senior technical leadership.' },
  { id: 'expertise', label: 'Expertise', detail: 'Eight engineering domains, each covered by people who understand the discipline.' },
  { id: 'technology', label: 'Technology', detail: 'The systems being built today, across silicon and the products it powers.' },
  { id: 'employers', label: 'Employers', detail: 'Teams that need the right engineer, quickly, without the noise.' },
];

export const HOW_WE_WORK = [
  { num: '01', label: 'Understand', detail: 'The technical background, or the technical requirement, in real depth.' },
  { num: '02', label: 'Search', detail: 'Scoped to the exact discipline, not a broad keyword match.' },
  { num: '03', label: 'Connect', detail: 'A conversation between people who both understand the work.' },
  { num: '04', label: 'Align', detail: 'Fit confirmed on both sides before anything moves forward.' },
  { num: '05', label: 'Move', detail: 'Supported through to offer, or through to a genuine next step.' },
];

export const ENGINEERING_APPROACH = {
  statement: 'We go beyond traditional recruiting because we understand the technology, not just the job title.',
  terms: ['RTL', 'VERIFICATION', 'DFT', 'PHYSICAL DESIGN', 'EMBEDDED', 'ADAS', 'CLOUD', 'FINTECH', 'MEDTECH'],
};

export const ABOUT_CTA = {
  employer: { headline: 'Building a team?', button: 'Start a Search', to: '/contact?type=employer' },
  talent: { headline: 'Exploring your next move?', button: 'Send Your Profile', to: '/contact?type=candidate' },
};
