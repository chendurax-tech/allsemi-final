import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { RESOURCES } from '../data/resources.js';
import { label } from '../data/enums.js';
import { useAdminStore } from '../store.jsx';
import { useAuth } from '../auth.jsx';
import { PageHeader, Panel, DataTable, Badge, Button, Drawer, DefinitionList, EmptyState, Notice, cx } from '../components/ui.jsx';
import ResourceForm, { SaveError, fieldsFor, missingRequired } from '../components/ResourceForm.jsx';
import DocumentButton from '../components/DocumentButton.jsx';
import { LabelChips } from '../components/LabelPicker.jsx';
import { formatDate } from '../lib/format.js';
import { useArrivalNotice } from '../lib/useArrivalNotice.js';

/*
  ResourceList - the list screen for every admin resource, rendered from
  its definition in data/resources.js: search, filters, table and, for
  drawer resources, an edit drawer.

  The records come from the store, which read them from the API. Saving
  and deleting are requests: the button shows that it is busy, and the
  server's answer (a saved record or a refusal) is what the screen then
  shows.

  Create, save and delete controls are hidden from a role that cannot
  use them. That is a convenience only: the server checks the
  permission on every request and refuses the call regardless of what
  this screen shows.
*/

function Cell({ col, item, state }) {
  const value = col.value ? col.value(item, state) : item[col.key];
  if (col.type === 'badge') return <Badge>{label(value)}</Badge>;
  if (col.type === 'date') return <span className="whitespace-nowrap text-text-dim">{formatDate(value)}</span>;
  if (col.type === 'labels') return <LabelChips value={value} />;
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
  if (value === '' || value == null) return <span className="text-text-dim">Not set</span>;
  return <span className="text-text-dim">{col.type === 'enum' ? label(value) : String(value)}</span>;
}

function DrawerEditor({ cfg, item, state, onClose, onDone }) {
  const { upsert, remove } = useAdminStore();
  const { can } = useAuth();
  const [draft, setDraft] = useState(item);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState(null);
  const isNew = !item.id;
  const canWrite = can(cfg.permissions.write);
  const fields = fieldsFor(cfg.fields, can);
  const title = isNew ? `New ${cfg.singular}` : (cfg.drawerTitle ? cfg.drawerTitle(item, state) : item[cfg.titleKey]);
  const links = !isNew && cfg.links ? cfg.links(item).filter((link) => can(link.permission)) : [];
  const documents = !isNew && cfg.documents ? cfg.documents(item).filter((doc) => can(doc.permission)) : [];

  async function save() {
    const missing = missingRequired(fields, draft);
    if (missing.length) {
      setError({ message: `Add ${missing.join(', ')} before saving.` });
      return;
    }
    setBusy('save');
    setError(null);
    try {
      await upsert(cfg.collection, draft);
      onDone(`Saved ${cfg.singular}.`);
    } catch (failure) {
      setError(failure);
      setBusy('');
    }
  }

  async function destroy() {
    if (!window.confirm(`Delete this ${cfg.singular}? This cannot be undone.`)) return;
    setBusy('delete');
    setError(null);
    try {
      await remove(cfg.collection, item.id);
      onDone(`Deleted ${cfg.singular}.`);
    } catch (failure) {
      setError(failure);
      setBusy('');
    }
  }

  return (
    <Drawer
      title={title}
      onClose={onClose}
      footer={(
        <>
          {canWrite && <Button variant="primary" onClick={save} disabled={Boolean(busy)}>{busy === 'save' ? 'Saving' : `Save ${cfg.singular}`}</Button>}
          <Button onClick={onClose} disabled={Boolean(busy)}>{canWrite ? 'Cancel' : 'Close'}</Button>
          {!isNew && cfg.canDelete && can(cfg.permissions.remove) && (
            <Button variant="danger" className="ml-auto" onClick={destroy} disabled={Boolean(busy)}>{busy === 'delete' ? 'Deleting' : `Delete ${cfg.singular}`}</Button>
          )}
        </>
      )}
    >
      {error && <div className="mb-5"><SaveError error={error} fields={fields} /></div>}
      {!canWrite && <div className="mb-5"><Notice tone="blue">Your role can view this {cfg.singular} but cannot change it.</Notice></div>}
      {!isNew && cfg.summary && <div className="mb-5 border-b border-line pb-5"><DefinitionList items={cfg.summary(item, state)} /></div>}
      {links.length > 0 && (
        <div className="mb-5 flex flex-wrap gap-2">
          {links.map((link) => <Button key={link.to} to={link.to} size="sm">{link.label}</Button>)}
        </div>
      )}
      {documents.map((doc) => (
        <div key={doc.label} className="mb-5 border-b border-line pb-5">
          <DocumentButton label={doc.label} request={doc.request} size="sm" />
          <p className="mt-2 text-xs text-text-dim leading-relaxed">{doc.note}</p>
        </div>
      ))}
      {!isNew && cfg.panel && <div className="mb-5 border-b border-line pb-5"><cfg.panel item={item} /></div>}
      <ResourceForm fields={fields} value={draft} onChange={setDraft} state={state} idPrefix={cfg.collection} errors={error?.fields} readOnly={!canWrite} saved={isNew ? null : item} />
    </Drawer>
  );
}

const selectCls = 'bg-bg border border-line-strong px-2 py-2 text-sm text-text focus:outline-none focus:border-accent max-w-[12rem]';

export default function ResourceList({ resource }) {
  const cfg = RESOURCES[resource];
  const { state, status, errors, totals, reload } = useAdminStore();
  const { can } = useAuth();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState({});
  const [sort, setSort] = useState(cfg.sorts ? cfg.sorts[0].value : '');
  const [editing, setEditing] = useState(null);
  const [notice, setNotice] = useArrivalNotice();
  const items = state[cfg.collection];
  const load = status[cfg.collection];

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matched = items.filter((item) => {
      if (q && !cfg.search(item, state).toLowerCase().includes(q)) return false;
      return (cfg.filters || []).every((f) => {
        const wanted = filters[f.key];
        if (!wanted) return true;
        return f.match ? f.match(item, wanted, state) : String(item[f.key] ?? '') === wanted;
      });
    });
    const order = (cfg.sorts || []).find((option) => option.value === sort);
    return order ? [...matched].sort(order.compare) : matched;
  }, [items, query, filters, sort, cfg, state]);

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

  const newOnPage = cfg.editor === 'page' || cfg.newAs === 'page';
  let newAction = null;
  if (cfg.canCreate && can(cfg.permissions.write)) {
    newAction = newOnPage
      ? <Button variant="primary" to={`${cfg.basePath}/new`}>New {cfg.singular}</Button>
      : <Button variant="primary" onClick={() => setEditing(cfg.blank())}>New {cfg.singular}</Button>;
  }

  const name = cfg.title.toLowerCase();
  let body;
  if (load === 'loading') {
    body = <div role="status"><EmptyState title={`Loading ${name}`}>Reading the records from the database.</EmptyState></div>;
  } else if (load === 'forbidden') {
    body = <EmptyState title="You do not have access to this section">Your role does not include {name}.</EmptyState>;
  } else if (load === 'error') {
    body = (
      <div role="alert">
        <EmptyState title={`The ${name} could not be loaded`}>{errors[cfg.collection]}</EmptyState>
        <div className="flex justify-center pb-6"><Button onClick={() => reload(cfg.collection)}>Try again</Button></div>
      </div>
    );
  } else {
    body = (
      <DataTable
        columns={columns}
        rows={rows}
        onRowClick={openRow}
        empty={items.length === 0
          ? <EmptyState title={`No ${name} yet`}>{newAction ? `Use "New ${cfg.singular}" to add the first one.` : 'Records appear here when they are received.'}</EmptyState>
          : undefined}
      />
    );
  }

  const total = totals[cfg.collection];

  return (
    <>
      <PageHeader eyebrow={cfg.eyebrow} title={cfg.title} description={cfg.description} actions={newAction} />

      {cfg.listNotice && <div className="mb-5"><Notice tone="blue">{cfg.listNotice}</Notice></div>}

      <Panel pad={false}>
        <div className="flex flex-col gap-3 border-b border-line px-4 py-3 md:flex-row md:flex-wrap md:items-center md:px-5">
          <label className="sr-only" htmlFor={`${resource}-search`}>Search {name}</label>
          <input
            id={`${resource}-search`}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Search ${name}`}
            className="w-full md:max-w-xs bg-bg border border-line-strong px-3 py-2 text-sm placeholder:text-text-faint focus:outline-none focus:border-accent"
          />
          {(cfg.filters || []).map((f) => {
            const options = (typeof f.options === 'function' ? f.options(state) : f.options)
              .map((option) => (typeof option === 'string' ? { value: option, label: label(option) } : option));
            return (
              <label key={f.key} className="flex items-center justify-between gap-2 text-xs text-text-dim">
                <span className="font-mono uppercase tracking-[0.12em]">{f.label}</span>
                <select
                  value={filters[f.key] || ''}
                  onChange={(e) => setFilters((prev) => ({ ...prev, [f.key]: e.target.value }))}
                  className={selectCls}
                >
                  <option value="">All</option>
                  {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </label>
            );
          })}
          {cfg.sorts && (
            <label className="flex items-center justify-between gap-2 text-xs text-text-dim">
              <span className="font-mono uppercase tracking-[0.12em]">Order</span>
              <select value={sort} onChange={(e) => setSort(e.target.value)} className={selectCls}>
                {cfg.sorts.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
          )}
          <p className="md:ml-auto text-xs text-text-dim tabular-nums" role="status">
            {notice ? `${notice} ` : ''}{rows.length} of {items.length}
            {total > items.length ? `. The first ${items.length} of ${total} records are loaded.` : ''}
          </p>
        </div>
        {body}
      </Panel>

      {editing && (
        <DrawerEditor
          key={editing.id || 'new'}
          cfg={cfg}
          item={editing}
          state={state}
          onClose={() => setEditing(null)}
          onDone={(message) => { setEditing(null); setNotice(message); }}
        />
      )}
    </>
  );
}
