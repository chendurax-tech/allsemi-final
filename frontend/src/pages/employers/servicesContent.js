// Services content - the single source of truth for the three ALLSEMIS
// service lines: the landing page Services cards (components/Services.jsx),
// the service detail pages (/employers/:slug, ServicePage.jsx) and the
// admin Services screen all read from this file.
//
// name + description are the already-confirmed landing page copy, moved
// here unchanged. Everything under `page` is independently drafted
// service content: what the service is for, how it runs and what the
// client receives. No client names, placement counts, fees, timelines
// or guarantees are stated anywhere below. Structured as plain data so
// an admin panel can own every field later without touching JSX.

export const SERVICE_ICONS = ['die', 'layers', 'pipeline'];

export const SERVICES = [
  {
    id: 'permanent-staffing',
    num: '01',
    slug: 'permanent-staffing',
    name: 'Permanent Staffing',
    icon: 'die',
    status: 'published',
    description: 'Find the right full-time talent for your semiconductor, chip design, automotive, or aerospace teams. We source, screen, and place top engineers who stay and grow with your organization.',
    cta: { label: 'Start a Permanent Search', to: '/contact?type=employer' },
    page: {
      headline: 'Full-time engineers for the work that stays in-house.',
      lead: 'Permanent staffing for semiconductor, chip design, automotive and aerospace teams. We source, screen and place engineers who stay and grow with your organisation.',
      fitTitle: 'When a permanent hire is the right call.',
      fit: [
        'A core design, verification or embedded role that carries long-term product knowledge.',
        'A new team or function being built for a programme that will run for years.',
        'A senior or lead position where continuity matters as much as speed.',
        'A role that has stayed open too long through general channels.',
      ],
      processTitle: 'How a permanent search runs.',
      process: [
        { label: 'Brief', detail: 'A technical conversation about the role, the team around it and what a strong hire looks like.' },
        { label: 'Search', detail: 'Sourcing scoped to the exact discipline and seniority, including engineers who are not actively looking.' },
        { label: 'Technical screen', detail: 'Every candidate is assessed against the brief before a profile reaches you.' },
        { label: 'Shortlist', detail: 'A focused shortlist with notes on technical fit, not a stack of resumes.' },
        { label: 'Interview and offer', detail: 'Interviews coordinated end to end, with support through offer and joining.' },
      ],
      receive: [
        'A shortlist matched to the technical brief',
        'Screening notes for each candidate',
        'Interview scheduling and feedback handled for you',
        'Support through offer and joining',
        'A dedicated account manager throughout',
      ],
      tagsTitle: 'Disciplines we place',
      tags: ['RTL Design', 'Design Verification', 'Physical Design', 'DFT', 'Analog and Mixed-Signal', 'Embedded Software', 'ADAS and Functional Safety', 'Systems and RF'],
      questions: [
        { q: 'Which roles does this cover?', a: 'Engineering roles across the sectors ALLSEMIS works in, with semiconductor and chip design at the centre. The Expertise pages list the disciplines in each sector.' },
        { q: 'How are candidates screened?', a: 'Against the technical brief agreed with you at the start: skills, depth of experience and domain. The aim is that every profile you receive is worth an interview.' },
        { q: 'How are commercial terms set?', a: 'Terms are agreed per engagement. Send us the role and we will take it from there.' },
      ],
    },
  },
  {
    id: 'project-staffing',
    num: '02',
    slug: 'project-staffing',
    name: 'Project Staffing',
    icon: 'layers',
    status: 'published',
    description: 'Scale your team on-demand with highly skilled contract engineers for specific projects. From VLSI design to embedded systems, we provide experts exactly when you need them.',
    cta: { label: 'Staff a Project', to: '/contact?type=employer' },
    page: {
      headline: 'Contract engineers for defined programmes.',
      lead: 'Scale your team on demand with skilled contract engineers for specific projects. From VLSI design to embedded systems, experts exactly when you need them.',
      fitTitle: 'When project staffing fits.',
      fit: [
        'A tape-out, verification or bring-up phase that needs more hands than the permanent team has.',
        'A specialised skill needed for one phase of a programme, not for the long term.',
        'A deadline that cannot wait for a permanent hiring cycle.',
        'A project where headcount has to rise and fall with the workload.',
      ],
      processTitle: 'How a project engagement runs.',
      process: [
        { label: 'Scope', detail: 'Define the work, the skills, the duration and how the engineers will sit within your team.' },
        { label: 'Match', detail: 'Identify contract engineers whose recent work matches the scope.' },
        { label: 'Onboard', detail: 'Engineers start with the context they need to be useful from the first week.' },
        { label: 'Manage', detail: 'A dedicated account manager stays with the engagement and handles staffing matters as they come up.' },
        { label: 'Extend or close', detail: 'Extend, scale down or wrap up as the project requires.' },
      ],
      receive: [
        'Contract engineers matched to a defined scope',
        'End-to-end managed staffing',
        'A dedicated account manager',
        'Capacity that follows the project plan',
        'One point of contact when the scope changes',
      ],
      tagsTitle: 'Typical project skills',
      tags: ['VLSI Design', 'Verification', 'Physical Design', 'DFT', 'Embedded Systems', 'Test and Validation'],
      questions: [
        { q: 'How long does an engagement last?', a: 'It depends on the project. Duration is set in the scope and reviewed as the work progresses.' },
        { q: 'Can contract engineers work inside our team and tools?', a: 'Yes. The scope defines where the engineers work, which tools they use and who they report to on your side.' },
        { q: 'What happens if the scope changes?', a: 'Tell your account manager. The engagement is adjusted to match.' },
      ],
    },
  },
  {
    id: 'rpo',
    num: '03',
    slug: 'rpo',
    name: 'RPO Solution',
    icon: 'pipeline',
    status: 'published',
    description: 'Outsource your entire recruitment process to Allsemis. Our Recruitment Process Outsourcing (RPO) solution delivers a dedicated hiring engine tailored to your talent acquisition needs.',
    cta: { label: 'Discuss RPO', to: '/contact?type=employer' },
    page: {
      headline: 'A dedicated hiring engine, run for you.',
      lead: 'Recruitment Process Outsourcing hands the recruitment process itself to ALLSEMIS, shaped around your talent acquisition needs.',
      fitTitle: 'When RPO makes sense.',
      fit: [
        'Sustained hiring across many roles, not one or two openings.',
        'A new team, site or product line that needs a hiring function quickly.',
        'An internal talent team that is already at capacity.',
        'A need for one consistent process and one view of the pipeline.',
      ],
      processTitle: 'How an RPO engagement runs.',
      process: [
        { label: 'Discover', detail: 'Map current hiring: open roles, process, tools and where candidates are being lost.' },
        { label: 'Design', detail: 'Agree the scope, the process and how progress will be reported.' },
        { label: 'Embed', detail: 'A recruitment team is assigned and works to your process and standards.' },
        { label: 'Run', detail: 'Sourcing, screening, scheduling and offer management for the roles in scope.' },
        { label: 'Review', detail: 'Regular reviews of the pipeline and the process, with changes agreed together.' },
      ],
      receive: [
        'A recruitment team assigned to your hiring',
        'One process from requisition to offer',
        'Pipeline visibility across every role in scope',
        'Scope that covers all hiring or a defined part of it',
        'A dedicated account manager',
      ],
      tagsTitle: 'Ways to scope it',
      tags: ['Full hiring cycle', 'One function or business unit', 'A defined hiring project', 'Sourcing and screening only'],
      questions: [
        { q: 'How is RPO different from briefing an agency per role?', a: 'An agency fills individual roles. RPO takes on the recruitment process for the roles in scope, so the approach, the reporting and the candidate experience stay consistent.' },
        { q: 'Can we start small?', a: 'Yes. Scope can begin with one function or one hiring project and widen later.' },
        { q: 'Who makes the hiring decision?', a: 'You do. The RPO team runs the process. Your hiring managers decide who joins.' },
      ],
    },
  },
];

export function publishedServices() {
  return SERVICES.filter((s) => s.status === 'published');
}

export function getServiceBySlug(slug) {
  return publishedServices().find((s) => s.slug === slug);
}
