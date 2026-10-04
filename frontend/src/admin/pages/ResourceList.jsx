import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { RESOURCES } from '../data/resources.js';
import { useAdminStore } from '../store.jsx';
import { PageHeader, Panel, DataTable, Badge, Button, Drawer, DefinitionList, cx } from '../components/ui.jsx';
import ResourceForm from '../components/ResourceForm.jsx';
import { formatDate, today } from '../lib/format.js';

/*
  ResourceList - the list screen for every admin resource, rendered from
  its definition in data/resources.js: search, filters, table and, for
  drawer resources, an edit drawer.
*/

function Cell({ col, item, state }) {
  const value = col.value ? col.value(item, state) : item[col.key];
  if (col.type === 'badge') return <Badge>{String(value)}</Badge>;
  if (col.type === 'date') return <span className="whitespace-nowrap text-text-dim">{formatDate(value)}</span>;
  if (col.type === 'tags') {
    const list = value || [];
    return (
      <span className="flex max-w-xs flex-wrap gap-1.5">
        {list.slice(0, 3).map((tag) => (
          <span key={tag} className="whitespace-nowrap border border-line-strong px-1.5 py-0.5 text-xs text-text-dim">{tag}</span>
        ))}
        {list.length > 3 && <span className="py-0.5 text-xs text-text-dim">+{list.length - 3}</span>}
      </span>
    );
  }
  if (col.primary) {
    const sub = col.sub ? col.sub(item, state) : null;
    return (
      <span className="block min-w-[12rem] max-w-md">
        <span className={cx('block text-text', col.clamp ? 'line-clamp-2' : 'font-semibold')}>{value}</span>
        {sub && <span className="mt-0.5 block text-xs text-text-dim line-clamp-1">{sub}</span>}
      </span>
    );
  }
  return <span className="text-text-dim">{value === '' || value == null ? 'Not set' : String(value)}</span>;
}

function DrawerEditor({ cfg, item, state, onClose, onSave, onDelete }) {
  const [draft, setDraft] = useState(item);
  const title = item.isNew ? `New ${cfg.singular}` : (cfg.drawerTitle ? cfg.drawerTitle(item, state) : item[cfg.titleKey]);
  const links = !item.isNew && cfg.links ? cfg.links(item) : [];

  return (
    <Drawer
      title={title}
      onClose={onClose}
      footer={(
        <>
          <Button variant="primary" onClick={() => onSave(draft)}>Save {cfg.singular}</Button>
          <Button onClick={onClose}>Cancel</Button>
          {!item.isNew && cfg.canDelete && (
            <Button variant="danger" className="ml-auto" onClick={() => onDelete(item)}>Delete {cfg.singular}</Button>
          )}
        </>
      )}
    >
      {!item.isNew && cfg.summary && <div className="mb-5 border-b border-line pb-5"><DefinitionList items={cfg.summary(item, state)} /></div>}
      {links.length > 0 && (
        <div className="mb-5 flex flex-wrap gap-2">
          {links.map((link) => <Button key={link.to} to={link.to} size="sm">{link.label}</Button>)}
        </div>
      )}
      <ResourceForm fields={cfg.fields} value={draft} onChange={setDraft} state={state} idPrefix={cfg.collection} />
    </Drawer>
  );
}

export default function ResourceList({ resource }) {
  const cfg = RESOURCES[resource];
  const { state, upsert, remove } = useAdminStore();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState({});
  const [editing, setEditing] = useState(null);
  const [notice, setNotice] = useState('');
  const items = state[cfg.collection];

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((item) => {
      if (q && !cfg.search(item, state).toLowerCase().includes(q)) return false;
      return (cfg.filters || []).every((f) => !filters[f.key] || String(item[f.key]) === filters[f.key]);
    });
  }, [items, query, filters, cfg, state]);

  const columns = cfg.columns.map((col) => ({
    key: col.key,
    label: col.label,
    render: (item) => <Cell col={col} item={item} state={state} />,
  }));

  function openRow(item) {
    if (cfg.editor === 'page') navigate(`${cfg.basePath}/${item.id}`);
    else if (cfg.editor === 'link') navigate(cfg.rowLink(item));
    else setEditing(item);
  }

  function save(draft) {
    const record = { ...draft, updatedAt: today() };
    delete record.isNew;
    upsert(cfg.collection, record);
    setEditing(null);
    setNotice(`Saved ${cfg.singular}.`);
  }

  function destroy(item) {
    if (!window.confirm(`Delete this ${cfg.singular}? This cannot be undone.`)) return;
    remove(cfg.collection, item.id);
    setEditing(null);
    setNotice(`Deleted ${cfg.singular}.`);
  }

  const newOnPage = cfg.editor === 'page' || cfg.newAs === 'page';
  let newAction = null;
  if (cfg.canCreate) {
    newAction = newOnPage
      ? <Button variant="primary" to={`${cfg.basePath}/new`}>New {cfg.singular}</Button>
      : <Button variant="primary" onClick={() => setEditing({ ...cfg.blank(), id: `${cfg.idPrefix}-${Date.now()}`, isNew: true })}>New {cfg.singular}</Button>;
  }

  return (
    <>
      <PageHeader eyebrow={cfg.eyebrow} title={cfg.title} description={cfg.description} actions={newAction} />

      <Panel pad={false}>
        <div className="flex flex-col gap-3 border-b border-line px-4 py-3 md:flex-row md:items-center md:px-5">
          <label className="sr-only" htmlFor={`${resource}-search`}>Search {cfg.title.toLowerCase()}</label>
          <input
            id={`${resource}-search`}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Search ${cfg.title.toLowerCase()}`}
            className="w-full md:max-w-xs bg-bg border border-line-strong px-3 py-2 text-sm placeholder:text-text-faint focus:outline-none focus:border-accent"
          />
          {(cfg.filters || []).map((f) => (
            <label key={f.key} className="flex items-center gap-2 text-xs text-text-dim">
              <span className="font-mono uppercase tracking-[0.12em]">{f.label}</span>
              <select
                value={filters[f.key] || ''}
                onChange={(e) => setFilters((prev) => ({ ...prev, [f.key]: e.target.value }))}
                className="bg-bg border border-line-strong px-2 py-2 text-sm text-text focus:outline-none focus:border-accent"
              >
                <option value="">All</option>
                {f.options.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </label>
          ))}
          <p className="md:ml-auto text-xs text-text-dim tabular-nums" role="status">
            {notice ? `${notice} ` : ''}{rows.length} of {items.length}
          </p>
        </div>
        <DataTable columns={columns} rows={rows} onRowClick={openRow} />
      </Panel>

      {editing && (
        <DrawerEditor
          key={editing.id}
          cfg={cfg}
          item={editing}
          state={state}
          onClose={() => setEditing(null)}
          onSave={save}
          onDelete={destroy}
        />
      )}
    </>
  );
}
