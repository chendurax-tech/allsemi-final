import { useEffect, useState } from 'react';
import { publicApi } from './api/public.js';

/*
  usePublicData - the public pages' reads from the backend, as hooks.

  useJobs()        the published jobs (Talent page, related positions)
  useJob(slug)     one published job (job page)
  useStories()     the published stories, in the order set in the admin
  useInsights()    the published articles, newest first
  useInsight(slug) one published article with its body (article page)
  useSectors()     the published expertise sectors, in their order
  useServices()    the published services, in their order
  useLocations()   the locations shown on the network map
  useSiteContact() the contact details edited in Admin, Settings

  Each hook cancels its request when the component goes away or its
  input changes, so a slow answer can never be applied to a page that
  has moved on. Jobs, stories and articles have no bundled fallback on
  purpose: the backend returns published records only, and showing
  anything else could put an unpublished job, story or article in
  front of a visitor. The database is the only source.
*/

const cancelled = (error) => error?.name === 'AbortError';

// { status: 'loading' | 'ready' | 'error', jobs, reload }
export function useJobs() {
  const [state, setState] = useState({ status: 'loading', jobs: [] });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setState({ status: 'loading', jobs: [] });
    publicApi.jobs({ signal: controller.signal })
      .then((jobs) => setState({ status: 'ready', jobs: Array.isArray(jobs) ? jobs : [] }))
      .catch((error) => { if (!cancelled(error)) setState({ status: 'error', jobs: [] }); });
    return () => controller.abort();
  }, [attempt]);

  return { ...state, reload: () => setAttempt((count) => count + 1) };
}

// { status: 'loading' | 'ready' | 'missing' | 'error', job, reload }
// 'missing' is the backend's 404: no published job has this slug. A
// draft or archived job answers exactly like one that never existed.
export function useJob(slug) {
  const [state, setState] = useState({ status: 'loading', job: null, slug });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setState({ status: 'loading', job: null, slug });
    publicApi.job(slug, { signal: controller.signal })
      .then((job) => setState({ status: 'ready', job, slug }))
      .catch((error) => {
        if (!cancelled(error)) setState({ status: error?.status === 404 ? 'missing' : 'error', job: null, slug });
      });
    return () => controller.abort();
  }, [slug, attempt]);

  // The render straight after the slug changes still holds the last
  // job; report it as loading so the old position is never shown
  // under the new address.
  const current = state.slug === slug ? state : { status: 'loading', job: null };
  return { status: current.status, job: current.job, reload: () => setAttempt((count) => count + 1) };
}

// { status: 'loading' | 'ready' | 'error', stories }
// The backend returns published stories only, already in the order the
// admin gave them. Each is { id, quote, name, role, photo, alt }.
export function useStories() {
  const [state, setState] = useState({ status: 'loading', stories: [] });

  useEffect(() => {
    const controller = new AbortController();
    publicApi.stories({ signal: controller.signal })
      .then((stories) => setState({ status: 'ready', stories: (Array.isArray(stories) ? stories : []).filter((story) => story && story.quote) }))
      .catch((error) => { if (!cancelled(error)) setState({ status: 'error', stories: [] }); });
    return () => controller.abort();
  }, []);

  return state;
}

// An article as the pages use it. The backend already limits the
// fields to public ones; this only makes sure the lists the pages loop
// over are lists. An article saved without topics shows its category
// where a topic label goes. Topic labels are written in capitals
// everywhere on the site, however they were typed in the admin.
function article(raw) {
  const topics = Array.isArray(raw.topics) ? raw.topics.filter(Boolean).map((topic) => String(topic).toUpperCase()) : [];
  return {
    ...raw,
    topics: topics.length || !raw.category ? topics : [String(raw.category).toUpperCase()],
    body: Array.isArray(raw.body) ? raw.body : [],
  };
}

// { status: 'loading' | 'ready' | 'error', articles, reload }
// Published articles only, newest first (the backend's order). The
// list carries no article body.
export function useInsights() {
  const [state, setState] = useState({ status: 'loading', articles: [] });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setState({ status: 'loading', articles: [] });
    publicApi.insights({ signal: controller.signal })
      .then((articles) => {
        // An answer that is not a list is a fault, not "nothing published".
        if (!Array.isArray(articles)) throw new Error('Unexpected response');
        setState({ status: 'ready', articles: articles.filter((item) => item && item.slug).map(article) });
      })
      .catch((error) => { if (!cancelled(error)) setState({ status: 'error', articles: [] }); });
    return () => controller.abort();
  }, [attempt]);

  return { ...state, reload: () => setAttempt((count) => count + 1) };
}

// { status: 'loading' | 'ready' | 'missing' | 'error', article, reload }
// 'missing' is the backend's 404: no published article has this slug.
// A draft answers exactly like an article that never existed.
export function useInsight(slug) {
  const [state, setState] = useState({ status: 'loading', article: null, slug });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setState({ status: 'loading', article: null, slug });
    publicApi.insight(slug, { signal: controller.signal })
      .then((found) => setState({ status: 'ready', article: article(found), slug }))
      .catch((error) => {
        if (!cancelled(error)) setState({ status: error?.status === 404 ? 'missing' : 'error', article: null, slug });
      });
    return () => controller.abort();
  }, [slug, attempt]);

  // The render straight after the slug changes still holds the last
  // article; report it as loading so it is never shown under the new
  // address.
  const current = state.slug === slug ? state : { status: 'loading', article: null };
  return { status: current.status, article: current.article, reload: () => setAttempt((count) => count + 1) };
}

/*
  Sectors, services and locations are used by several components on one
  page (the header menu, a landing section, a form), so each list is
  requested once per page load and shared. A browser refresh reads it
  again, which is when an edit made in the admin appears.

  As with stories and articles there is no bundled copy of these
  records: the database is the only source, and the backend returns
  only what is published (for locations: what is switched on).
*/
const shared = new Map();
// Every mounted component that reads a list, so "Try again" in one of
// them refreshes all of them (the header menu as well as the page).
const readers = new Map();

function loadOnce(key, load) {
  if (!shared.has(key)) {
    // A failed request is forgotten, so the next component that asks
    // (or a retry) tries again.
    shared.set(key, load().catch((error) => { shared.delete(key); throw error; }));
  }
  return shared.get(key);
}

// { status: 'loading' | 'ready' | 'error', items, reload }
function useSharedList(key, load, shape) {
  const [state, setState] = useState({ status: 'loading', items: [] });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    loadOnce(key, load)
      .then((items) => {
        if (!Array.isArray(items)) throw new Error('Unexpected response');
        if (active) setState({ status: 'ready', items: items.filter(Boolean).map(shape) });
      })
      .catch(() => { if (active) setState({ status: 'error', items: [] }); });
    return () => { active = false; };
  }, [key, load, shape, attempt]);

  useEffect(() => {
    const again = () => { setState({ status: 'loading', items: [] }); setAttempt((count) => count + 1); };
    if (!readers.has(key)) readers.set(key, new Set());
    readers.get(key).add(again);
    return () => { readers.get(key)?.delete(again); };
  }, [key]);

  return { ...state, reload: () => { shared.delete(key); (readers.get(key) || []).forEach((again) => again()); } };
}

const list = (value) => (Array.isArray(value) ? value.filter((item) => item !== null && item !== undefined && item !== '') : []);

// "Title: detail" as the admin stores a line -> its two parts. Only the
// first ": " separates, so a detail may contain a colon of its own.
function titled(line) {
  const text = String(line ?? '');
  const at = text.indexOf(': ');
  return at === -1 ? [text.trim(), ''] : [text.slice(0, at).trim(), text.slice(at + 2).trim()];
}

/*
  A sector as the pages use it:
    id (the fixed sector key), num, name, shortName, slug, desc,
    image, alt, introduction, domainOverview, domains[], roles[],
    hiringChallenges[{ num, title, detail }], processFlow[],
    representativeSearches[{ ref, title, requirement, signals[] }],
    relatedInsight (an article slug, or '')
  The admin stores a hiring challenge as one "Title: detail" line.
*/
function sector(raw) {
  return {
    ...raw,
    domains: list(raw.domains),
    roles: list(raw.roles),
    processFlow: list(raw.processFlow),
    hiringChallenges: list(raw.hiringChallenges).map((line, index) => {
      const [title, detail] = titled(line);
      return { num: String(index + 1).padStart(2, '0'), title, detail };
    }),
    representativeSearches: list(raw.representativeSearches).map((search) => ({ ...search, signals: list(search.signals) })),
    relatedInsight: raw.relatedInsight || '',
  };
}

const loadSectors = () => publicApi.expertise();
// { status, sectors, reload }
export function useSectors() {
  const { status, items, reload } = useSharedList('expertise', loadSectors, sector);
  return { status, sectors: items, reload };
}

/*
  A service as the pages use it:
    id, num, slug, name, icon, description, cta { label, to },
    page { headline, lead, fitTitle, fit[], processTitle,
           process[{ label, detail }], receiveTitle, receive[],
           tagsTitle, tags[], questions[{ q, a }] }
  The admin stores a process step as "Step: detail" and a question as
  "Question | Answer", one per line.
*/
function service(raw) {
  const page = raw.page || {};
  return {
    ...raw,
    cta: { label: raw.cta?.label || '', to: raw.cta?.to || '' },
    page: {
      ...page,
      fit: list(page.fit),
      receive: list(page.receive),
      tags: list(page.tags),
      process: list(page.process).map((line) => {
        const [label, detail] = titled(line);
        return { label, detail };
      }),
      questions: list(page.questions).map((line) => {
        const text = String(line);
        const at = text.indexOf(' | ');
        return at === -1 ? { q: text.trim(), a: '' } : { q: text.slice(0, at).trim(), a: text.slice(at + 3).trim() };
      }),
    },
  };
}

const loadServices = () => publicApi.services();
// { status, services, reload }
export function useServices() {
  const { status, items, reload } = useSharedList('services', loadServices, service);
  return { status, services: items, reload };
}

/*
  A location as the map uses it:
    id, city, country, region, label, type ('office' | 'network'),
    status, isHeadquarters, address[], phone, email, hours[],
    coordinates [longitude, latitude], description,
    visual { labelSide, labelRaise? }, active
  The backend sends an address and contact details for an office only.
*/
function location(raw) {
  return {
    ...raw,
    address: list(raw.address),
    hours: list(raw.hours),
    coordinates: Array.isArray(raw.coordinates) ? raw.coordinates.map(Number) : [0, 0],
    visual: { labelSide: 'right', ...(raw.visual || {}) },
  };
}

const loadLocations = () => publicApi.locations();
// { status, locations, reload }
export function useLocations() {
  const { status, items, reload } = useSharedList('locations', loadLocations, location);
  return { status, locations: items, reload };
}

/*
  The contact details shown on the Contact page: the ones saved in the
  site settings (Admin, Settings, Contact), and nothing else. There is
  no bundled copy of them, so a visitor can never be shown a phone
  number or an address other than the saved one, not even while the
  request runs.

  { status: 'loading' | 'ready' | 'error', email, phone, address[], hours[] }
  The details are empty while loading and after a failure. A field left
  empty in the admin stays empty here, and the page leaves it out.
*/
const NO_CONTACT = { email: '', phone: '', address: [], hours: [] };

const cleanLine = (value) => (typeof value === 'string' ? value.trim() : '');
const cleanLines = (value) => (Array.isArray(value) ? value.map(cleanLine).filter(Boolean) : []);

export function useSiteContact() {
  const [state, setState] = useState({ status: 'loading', ...NO_CONTACT });

  useEffect(() => {
    const controller = new AbortController();
    // Only the request of the page that is still showing may answer.
    let current = true;
    publicApi.site({ signal: controller.signal })
      .then((site) => {
        const saved = site?.contact;
        // An answer without contact details is a fault, not "nothing saved".
        if (!saved || typeof saved !== 'object') throw new Error('Unexpected response');
        if (current) setState({
          status: 'ready',
          email: cleanLine(saved.email),
          phone: cleanLine(saved.phone),
          address: cleanLines(saved.address),
          hours: cleanLines(saved.hours),
        });
      })
      .catch((error) => { if (current && !cancelled(error)) setState({ status: 'error', ...NO_CONTACT }); });
    return () => { current = false; controller.abort(); };
  }, []);

  return state;
}
