import React, { createContext, useContext, useMemo, useReducer } from 'react';
import { buildSeed } from './data/seed.js';

/*
  Admin store - one in-memory state for every admin screen in the UI
  phase. Each collection maps to a future API resource; upsert/remove
  are the calls that will become requests. Nothing is persisted: a page
  reload returns to the seed.
*/

const AdminStoreContext = createContext(null);

function reducer(state, action) {
  switch (action.type) {
    case 'upsert': {
      const list = state[action.collection] || [];
      const exists = list.some((item) => item.id === action.item.id);
      const next = exists
        ? list.map((item) => (item.id === action.item.id ? { ...item, ...action.item } : item))
        : [action.item, ...list];
      return { ...state, [action.collection]: next };
    }
    case 'remove':
      return { ...state, [action.collection]: state[action.collection].filter((item) => item.id !== action.id) };
    case 'setSite':
      return { ...state, site: { ...state.site, [action.section]: action.value } };
    case 'log':
      return { ...state, activity: [action.entry, ...state.activity] };
    default:
      return state;
  }
}

export const MOCK_USER = { name: 'Sample admin', role: 'Admin' };

export function AdminStoreProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, undefined, buildSeed);

  const api = useMemo(() => ({
    state,
    user: MOCK_USER,
    upsert: (collection, item) => dispatch({ type: 'upsert', collection, item }),
    remove: (collection, id) => dispatch({ type: 'remove', collection, id }),
    setSite: (section, value) => dispatch({ type: 'setSite', section, value }),
    log: (entry) => dispatch({
      type: 'log',
      entry: { id: `act-${Date.now()}`, at: new Date().toISOString(), actor: MOCK_USER.name, ...entry },
    }),
  }), [state]);

  return <AdminStoreContext.Provider value={api}>{children}</AdminStoreContext.Provider>;
}

export function useAdminStore() {
  return useContext(AdminStoreContext);
}
