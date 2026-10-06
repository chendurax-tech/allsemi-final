// Page copy shared by every sector page. The sector records themselves
// (name, introduction, overview, domains, roles, hiring challenges,
// process flow, representative search profiles and the related
// article) are not kept here: they are edited in the admin and read
// from the backend (useSectors in lib/usePublicData.js).

// Shared 5-stage evaluation process - the search methodology itself is
// consistent across every sector (only the domain being searched
// changes), so this is defined once, here, rather than per sector.
export const SEARCH_EVALUATION = [
  { num: '01', label: 'Define the Requirement', detail: 'A precise technical brief, scoped to the actual discipline and seniority.' },
  { num: '02', label: 'Map the Talent', detail: 'Identify where genuinely relevant experience sits, not just adjacent titles.' },
  { num: '03', label: 'Assess Domain Experience', detail: 'A technical conversation, not a keyword match against a resume.' },
  { num: '04', label: 'Validate Technical Fit', detail: 'Confirm depth against the specific tools, standards, and systems the role needs.' },
  { num: '05', label: 'Present the Profile', detail: 'A shortlist built around genuine fit, ready for a technical interview.' },
];
