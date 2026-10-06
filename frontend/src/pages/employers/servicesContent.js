// Services content helpers.
//
// The service records themselves (names, descriptions, page copy, order,
// publish state) live in the database and are edited in Admin, Services.
// The public site reads them through useServices() in
// lib/usePublicData.js (GET /api/public/services). Nothing below is a
// copy of those records.
//
// What stays in the frontend:
//   SERVICE_ICONS          the icon names the admin offers, each drawn by
//                          a glyph component (components/Services.jsx and
//                          ServicePage.jsx hold the name -> glyph map).
//   SERVICE_PAGE_DEFAULTS  see below.

export const SERVICE_ICONS = ['die', 'layers', 'pipeline'];

// A default for databases seeded before these three page blocks were
// stored: the tags heading, the tags and the questions of the three
// original services, with the approved text. It is used only for a
// field the database returns empty, so a value saved in the admin
// always wins. A service with another slug has no default.
export const SERVICE_PAGE_DEFAULTS = {
  'permanent-staffing': {
    tagsTitle: 'Disciplines we place',
    tags: ['RTL Design', 'Design Verification', 'Physical Design', 'DFT', 'Analog and Mixed-Signal', 'Embedded Software', 'ADAS and Functional Safety', 'Systems and RF'],
    questions: [
      { q: 'Which roles does this cover?', a: 'Engineering roles across the sectors ALLSEMIS works in, with semiconductor and chip design at the centre. The Expertise pages list the disciplines in each sector.' },
      { q: 'How are candidates screened?', a: 'Against the technical brief agreed with you at the start: skills, depth of experience and domain. The aim is that every profile you receive is worth an interview.' },
      { q: 'How are commercial terms set?', a: 'Terms are agreed per engagement. Send us the role and we will take it from there.' },
    ],
  },
  'project-staffing': {
    tagsTitle: 'Typical project skills',
    tags: ['VLSI Design', 'Verification', 'Physical Design', 'DFT', 'Embedded Systems', 'Test and Validation'],
    questions: [
      { q: 'How long does an engagement last?', a: 'It depends on the project. Duration is set in the scope and reviewed as the work progresses.' },
      { q: 'Can contract engineers work inside our team and tools?', a: 'Yes. The scope defines where the engineers work, which tools they use and who they report to on your side.' },
      { q: 'What happens if the scope changes?', a: 'Tell your account manager. The engagement is adjusted to match.' },
    ],
  },
  rpo: {
    tagsTitle: 'Ways to scope it',
    tags: ['Full hiring cycle', 'One function or business unit', 'A defined hiring project', 'Sourcing and screening only'],
    questions: [
      { q: 'How is RPO different from briefing an agency per role?', a: 'An agency fills individual roles. RPO takes on the recruitment process for the roles in scope, so the approach, the reporting and the candidate experience stay consistent.' },
      { q: 'Can we start small?', a: 'Yes. Scope can begin with one function or one hiring project and widen later.' },
      { q: 'Who makes the hiring decision?', a: 'You do. The RPO team runs the process. Your hiring managers decide who joins.' },
    ],
  },
};

// A service from useServices() with the defaults above filled in where
// the database has nothing for that field.
export function withPageDefaults(service) {
  const defaults = Object.hasOwn(SERVICE_PAGE_DEFAULTS, service.slug) ? SERVICE_PAGE_DEFAULTS[service.slug] : null;
  if (!defaults) return service;
  const { page } = service;
  return {
    ...service,
    page: {
      ...page,
      tagsTitle: page.tagsTitle || defaults.tagsTitle,
      tags: page.tags.length ? page.tags : defaults.tags,
      questions: page.questions.length ? page.questions : defaults.questions,
    },
  };
}
