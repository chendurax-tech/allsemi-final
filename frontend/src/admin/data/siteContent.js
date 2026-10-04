import { LOCATIONS } from '../../lib/officeLocations.js';

// Editable website content for the admin "Settings > Website content"
// screens. In this UI phase these values MIRROR the copy currently
// hard-coded in the approved public components (Hero.jsx,
// RecruitmentActions.jsx, Facts.jsx, aboutContent.js) so
// the admin shows the real site. Editing them here does not yet change
// the public site: that link is made when the backend is connected and
// those components are switched to read from the content API.
//
// Multi-part items are stored one per line with " | " between parts,
// so a non-technical editor can change them in a plain text box.

const office = LOCATIONS[0];

export const SITE_CONTENT = {
  homepage: {
    heroEyebrow: 'Talent. Engineered.',
    heroSupporting: 'We connect the engineers behind modern silicon, from architecture to tape-out, with the semiconductor, automotive, aerospace, and industrial teams building what is next.',
    actionsHeading: 'One network. Three ways in.',
    actions: [
      'Hire Talent | Build the engineering team behind your next tape-out. | /employers',
      'Find Your Role | Find your next engineering opportunity in semiconductor and beyond. | /talent',
      'Refer A Talent | Connect an engineer in your network to ALLSEMIS. | /refer',
    ],
    whyHeading: 'Your trusted staffing partner.',
    whyIntro: 'With deep domain expertise in semiconductor and advanced engineering sectors, we go beyond traditional recruiting. Our talent consultants understand the technology, making us uniquely effective at placing the right people faster.',
    reasons: [
      'Deep network | A deep network of semiconductor and VLSI chip design engineers.',
      'Domain expertise | Strong domain expertise across chip design, automotive, and aerospace.',
      'Safety-critical hiring | Proven hiring for safety-critical and specialized engineering roles.',
      'Rapid turnaround | Shortlists delivered within 48 to 72 hours.',
      'End-to-end managed | End-to-end managed staffing with dedicated account managers.',
    ],
    stats: [
      '100+ | Engineers placed',
      '10+ | Clients served',
      '95% | Retention rate',
      '48h | Avg. shortlist time',
    ],
    showServices: true,
    showStories: true,
    showInsights: true,
    showLocations: true,
  },
  about: {
    headline: 'Connecting specialised talent with the technology shaping what comes next.',
    sub: 'ALLSEMIS is a specialist staffing partner for semiconductor, VLSI, and advanced engineering talent.',
    positioning: 'We connect the engineers behind modern silicon, from architecture to tape-out, with the semiconductor, automotive, aerospace and industrial teams building what is next.',
    approach: 'We go beyond traditional recruiting because we understand the technology, not just the job title.',
  },
  contact: {
    email: office.email,
    phone: office.phone,
    address: office.address,
    hours: office.hours,
  },
};

// Stories are read from the public site's own module, so the admin
// and the landing page share one list.
export { STORIES } from '../../lib/storiesContent.js';
