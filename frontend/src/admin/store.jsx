import React, { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { ADMIN_RESOURCES, atsApi } from '../lib/api/index.js';
import { useAuth } from './auth.jsx';

/*
  Admin store - the records every admin screen reads, held in memory
  and backed by the API. Nothing here is the source of truth: the
  database is. A browser reload reads everything again.

  state.<collection>   the records, as the API returned them
  status.<collection>  'loading' | 'ready' | 'error' | 'forbidden'
  errors.<collection>  the message to show when status is 'error'
  totals.<collection>  how many records the server holds (a list is
                       read in one request of at most 500)

  After sign-in every collection the role may read is loaded in
  parallel. A collection the role may not read is never requested: it
  stays empty and is marked 'forbidden'.

  upsert and remove send the change to the API, update the state from
  the server's answer and reject with the ApiError when the server
  refuses, so the calling screen can show the message.

  engine  what GET /api/admin/ats/engine reports: the rule-based engine
          and, under `ai`, whether the server has the AI comparison
          connected. { status, data, message }, read once after sign-in
          by a role that may read the ATS.
  aiRuns  the AI comparisons started in this session, by ATS result id:
          { status: 'running' | 'done' | 'failed', error }. It lives
          here, not in the result screen, so a comparison that is still
          running is shown as running when the screen is opened again.
          compareWithAi(resultId) is the only code that asks for an AI
          comparison, and only a button calls it: nothing in the admin
          starts one on load, on a timer or again after a failure.
*/

const AdminStoreContext = createContext(null);

// The permission needed to read each collection (see
// backend/src/routes/admin.routes.js).
const READ_PERMISSION = {
  jobs: 'jobs:read',
  candidates: 'candidates:read',
  applications: 'applications:read',
  requirements: 'requirements:read',
  referrals: 'referrals:read',
  enquiries: 'enquiries:read',
  atsResults: 'ats:read',
  insights: 'content:read',
  stories: 'content:read',
  expertise: 'content:read',
  services: 'content:read',
  locations: 'content:read',
};
const COLLECTIONS = Object.keys(READ_PERMISSION);

// The fields each backend validator accepts (backend/src/validators).
// Only these are ever sent; ids, timestamps and server-owned fields
// such as a job's publish date stay out of a request.
const CONTENT_MEDIA = ['url', 'publicId', 'width', 'height', 'format', 'alt'];
const WRITABLE = {
  jobs: ['title', 'slug', 'category', 'department', 'location', 'employmentType', 'experienceLevel', 'summary', 'description', 'responsibilities', 'requiredSkills', 'preferredSkills', 'keywords', 'status', 'featured', 'applicationEnabled'],
  candidates: ['name', 'phone', 'location', 'headline', 'domain', 'experienceYears', 'skills', 'summary', 'noticePeriod', 'expectedCompensation', 'profileUrl', 'preferredLocation', 'source', 'labels'],
  applications: ['source', 'recruiterNotes', 'labels'],
  requirements: ['contactName', 'company', 'email', 'phone', 'hiringType', 'domain', 'role', 'positions', 'location', 'workMode', 'description', 'skills', 'experience', 'priority', 'status', 'internalNotes'],
  referrals: ['status', 'candidateName', 'candidateEmail', 'candidatePhone', 'candidateRole', 'candidateProfileUrl', 'domain'],
  enquiries: ['status', 'type', 'internalNotes'],
  insights: ['title', 'slug', 'excerpt', 'category', 'tags', 'topics', 'image', 'body', 'author', 'date', 'readTime', 'featured', 'showOnLanding', 'landingOrder', 'status', 'seoTitle', 'seoDescription'],
  stories: ['quote', 'name', 'role', 'photo', 'order', 'showOnLanding', 'status'],
  expertise: ['num', 'name', 'shortName', 'slug', 'desc', 'image', 'introduction', 'overview', 'domains', 'roles', 'hiringChallenges', 'processFlow', 'relatedInsight', 'status'],
  services: ['num', 'name', 'slug', 'icon', 'description', 'headline', 'lead', 'fitTitle', 'fit', 'processTitle', 'process', 'receive', 'tagsTitle', 'tags', 'questions', 'ctaLabel', 'ctaTo', 'status'],
  locations: ['city', 'country', 'region', 'type', 'status', 'isHeadquarters', 'address', 'phone', 'email', 'hours', 'lat', 'lon', 'description', 'labelSide', 'labelRaise', 'active'],
};
const MEDIA_FIELDS = ['image', 'photo'];

const listers = { ...ADMIN_RESOURCES, atsResults: atsApi };

function emptyState() {
  const fill = (value) => Object.fromEntries(COLLECTIONS.map((name) => [name, value]));
  return { data: fill([]), status: fill('loading'), errors: fill(''), totals: fill(0) };
}

function reducer(state, action) {
  const set = (part, value) => ({ ...state[part], [action.collection]: value });
  switch (action.type) {
    case 'loading':
      return { ...state, status: set('status', 'loading'), errors: set('errors', '') };
    case 'loaded':
      return { ...state, data: set('data', action.items), totals: set('totals', action.total), status: set('status', 'ready'), errors: set('errors', '') };
    case 'failed':
      return { ...state, status: set('status', action.forbidden ? 'forbidden' : 'error'), errors: set('errors', action.message) };
    case 'put': {
      const list = state.data[action.collection];
      const exists = list.some((item) => item.id === action.item.id);
      const next = exists ? list.map((item) => (item.id === action.item.id ? action.item : item)) : [action.item, ...list];
      return { ...state, data: set('data', next) };
    }
    case 'drop':
      return { ...state, data: set('data', state.data[action.collection].filter((item) => !action.matches(item))) };
    default:
      return state;
  }
}

// An image is sent as the six fields the backend stores, nothing else.
const cleanMedia = (media) => Object.fromEntries(CONTENT_MEDIA.map((key) => [key, media?.[key] ?? (key === 'width' || key === 'height' ? null : '')]));

function payloadFor(collection, item, existing) {
  const payload = {};
  for (const key of WRITABLE[collection]) {
    if (!(key in item)) continue;
    const value = MEDIA_FIELDS.includes(key) ? cleanMedia(item[key]) : item[key];
    // An update sends only what changed, so an untouched field is
    // neither validated again nor written to the audit log.
    if (existing) {
      const before = MEDIA_FIELDS.includes(key) ? cleanMedia(existing[key]) : existing[key];
      if (JSON.stringify(before ?? null) === JSON.stringify(value ?? null)) continue;
    }
    payload[key] = value;
  }
  return payload;
}

export function AdminStoreProvider({ children }) {
  const { can } = useAuth();
  const [state, dispatch] = useReducer(reducer, undefined, emptyState);
  // The latest records and permission check, for the async calls below.
  const data = useRef(state.data);
  data.current = state.data;
  const allowed = useRef(can);
  allowed.current = can;

  const reload = useCallback(async (collection) => {
    if (!allowed.current(READ_PERMISSION[collection])) {
      dispatch({ type: 'failed', collection, forbidden: true, message: '' });
      return;
    }
    dispatch({ type: 'loading', collection });
    try {
      const { items, meta } = await listers[collection].list();
      dispatch({ type: 'loaded', collection, items, total: meta?.total ?? items.length });
    } catch (error) {
      dispatch({ type: 'failed', collection, forbidden: error.status === 403, message: error.message });
    }
  }, []);

  // The provider is mounted once per signed-in user (AdminApp keys it
  // by user id), so this runs once after sign-in.
  useEffect(() => {
    COLLECTIONS.forEach((collection) => { reload(collection); });
  }, [reload]);

  const [engine, setEngine] = useState({ status: 'loading', data: null, message: '' });
  const reloadEngine = useCallback(async () => {
    if (!allowed.current('ats:read')) {
      setEngine({ status: 'forbidden', data: null, message: '' });
      return;
    }
    setEngine({ status: 'loading', data: null, message: '' });
    try {
      setEngine({ status: 'ready', data: await atsApi.engine(), message: '' });
    } catch (error) {
      setEngine({ status: error.status === 403 ? 'forbidden' : 'error', data: null, message: error.message });
    }
  }, []);
  useEffect(() => { reloadEngine(); }, [reloadEngine]);

  const [aiRuns, setAiRuns] = useState({});
  // The ids with a request on its way, checked before the state has
  // had time to update, so a double click cannot send two.
  const aiInFlight = useRef(new Set());

  // Never rejects: the outcome is in aiRuns, where the screen reads it
  // whether or not it was open when the answer arrived.
  const compareWithAi = useCallback(async (resultId) => {
    if (aiInFlight.current.has(resultId)) return;
    aiInFlight.current.add(resultId);
    setAiRuns((runs) => ({ ...runs, [resultId]: { status: 'running', error: null } }));
    try {
      const fresh = await atsApi.compareWithAi(resultId);
      dispatch({ type: 'put', collection: 'atsResults', item: fresh });
      setAiRuns((runs) => ({ ...runs, [resultId]: { status: 'done', error: null } }));
    } catch (error) {
      setAiRuns((runs) => ({ ...runs, [resultId]: { status: 'failed', error } }));
      // The server says it has no AI connection after all: read its
      // status again so the screens stop offering the button.
      if (error.code === 'AI_NOT_CONFIGURED') reloadEngine();
    } finally {
      aiInFlight.current.delete(resultId);
    }
  }, [reloadEngine]);

  // Forgets a finished or failed run (never a running one), so its
  // message is not shown again on a later visit.
  const dismissAiRun = useCallback((resultId) => {
    setAiRuns((runs) => {
      if (!runs[resultId] || runs[resultId].status === 'running') return runs;
      const rest = { ...runs };
      delete rest[resultId];
      return rest;
    });
  }, []);

  // Places a record the server returned into the state. Used by the
  // actions that are more than a field edit (a note, a review, an
  // evaluation, a converted referral).
  const put = useCallback((collection, item) => dispatch({ type: 'put', collection, item }), []);

  // `base` is the record as the screen that edited it last read it. A
  // page that reads its own copy from the API passes it, so "what
  // changed" is judged against what the person saw, not against a list
  // that may be older.
  const upsert = useCallback(async (collection, item, base = null) => {
    const api = ADMIN_RESOURCES[collection];
    let saved;
    if (item.id) {
      const existing = base || data.current[collection].find((record) => record.id === item.id);
      const payload = payloadFor(collection, item, existing);
      if (existing && Object.keys(payload).length === 0) return existing;
      saved = await api.update(item.id, payload);
    } else {
      // The server assigns the id.
      saved = await api.create(payloadFor(collection, item, null));
    }
    dispatch({ type: 'put', collection, item: saved });
    return saved;
  }, []);

  const remove = useCallback(async (collection, id) => {
    await ADMIN_RESOURCES[collection].remove(id);
    dispatch({ type: 'drop', collection, matches: (item) => item.id === id });
    // The server removes what depends on the record. The same rows are
    // dropped here so the screens do not show them until the next load.
    if (collection === 'candidates') {
      dispatch({ type: 'drop', collection: 'applications', matches: (item) => item.candidateId === id });
      dispatch({ type: 'drop', collection: 'atsResults', matches: (item) => item.candidateId === id });
      reload('referrals');
    }
    if (collection === 'jobs') dispatch({ type: 'drop', collection: 'atsResults', matches: (item) => item.jobId === id });
  }, [reload]);

  const value = useMemo(() => ({
    state: state.data,
    status: state.status,
    errors: state.errors,
    totals: state.totals,
    reload,
    upsert,
    remove,
    put,
    engine,
    reloadEngine,
    aiRuns,
    compareWithAi,
    dismissAiRun,
  }), [state, reload, upsert, remove, put, engine, reloadEngine, aiRuns, compareWithAi, dismissAiRun]);

  return <AdminStoreContext.Provider value={value}>{children}</AdminStoreContext.Provider>;
}

export function useAdminStore() {
  return useContext(AdminStoreContext);
}
