// Stories content - the single source of truth for the client and
// candidate stories on the landing page (components/Stories.jsx) and
// the admin Stories screen. The three entries are the stories already
// on the site, moved here unchanged. `status` is the publishing state:
// only 'published' stories are shown.
//
// Publish a story only with the permission of the person quoted.

export const STORIES = [
  {
    id: 'story-01',
    quote: 'Allsemis helped us close five senior RTL Design and Verification engineers within three weeks - roles that had been open for over two months. Their deep understanding of VLSI talent is unmatched.',
    name: 'VP Engineering',
    role: 'Leading chip design firm',
    photo: 'https://images.pexels.com/photos/9242271/pexels-photo-9242271.jpeg?auto=compress&dpr=1&h=750&w=1260',
    status: 'published',
  },
  {
    id: 'story-02',
    quote: 'We needed ADAS and functional safety engineers fast. Allsemis delivered pre-screened, interview-ready candidates in under a week. The quality and speed were exceptional.',
    name: 'Head of Talent Acquisition',
    role: 'Tier 1 automotive OEM',
    photo: 'https://images.pexels.com/photos/29475974/pexels-photo-29475974/free-photo-of-futuristic-car-dashboard-with-electronic-gadgets.jpeg?auto=compress&dpr=1&h=750&w=1260',
    status: 'published',
  },
  {
    id: 'story-03',
    quote: 'The shortlist arrived within 48 hours. Every candidate understood our process node, our EDA stack, and our roadmap - a rare combination.',
    name: 'Director of Silicon',
    role: 'Fabless semiconductor company',
    photo: 'https://images.pexels.com/photos/6755086/pexels-photo-6755086.jpeg?auto=compress&dpr=1&h=750&w=1260',
    status: 'published',
  },
];

export function publishedStories() {
  return STORIES.filter((story) => story.status === 'published');
}
