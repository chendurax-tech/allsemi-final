import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { RESOURCES } from '../data/resources.js';
import { useAdminStore } from '../store.jsx';
import { PageHeader, Panel, Badge, Button, EmptyState, DefinitionList, Notice } from '../components/ui.jsx';
import ResourceForm from '../components/ResourceForm.jsx';
import { formatDate, today } from '../lib/format.js';

/*
  ResourceEditor - the full-page create/edit screen for resources that
  have /new or /:id routes (jobs, insights, and new stories or sectors).
*/

function slugify(text) {
  return String(text || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

export default function ResourceEditor({ resource, id }) {
  const cfg = RESOURCES[resource];
  const { state, upsert, remove } = useAdminStore();
  const navigate = useNavigate();
  const existing = id ? state[cfg.collection].find((item) => String(item.id) === id) : null;
  const [draft, setDraft] = useState(() => existing || { ...cfg.blank(), id: `${cfg.idPrefix}-${Date.now()}` });
  const [notice, setNotice] = useState(null);
  const isNew = !id;

  if (id && !existing) {
    return (
      <Panel>
        <EmptyState title={`This ${cfg.singular} was not found`}>It may have been deleted in this session.</EmptyState>
        <div className="flex justify-center pb-4"><Button to={cfg.basePath}>Back to {cfg.title.toLowerCase()}</Button></div>
      </Panel>
    );
  }

  function save(next) {
    const missing = cfg.fields.filter((f) => f.required && !String(next[f.key] || '').trim());
    if (missing.length) {
      setNotice({ tone: 'red', text: `Add ${missing.map((f) => f.label.toLowerCase()).join(', ')} before saving.` });
      return;
    }
    const record = { ...next, updatedAt: today() };
    if ('slug' in record && !record.slug) record.slug = slugify(record[cfg.titleKey]);
    upsert(cfg.collection, record);
    setDraft(record);
    if (isNew) {
      navigate(cfg.editor === 'page' ? `${cfg.basePath}/${record.id}` : cfg.basePath, { replace: true });
    } else {
      setNotice({ tone: 'teal', text: `Saved ${cfg.singular}.` });
    }
  }

  function destroy() {
    if (!window.confirm(`Delete this ${cfg.singular}? This cannot be undone.`)) return;
    remove(cfg.collection, draft.id);
    navigate(cfg.basePath);
  }

  const publicPath = cfg.publicPath ? cfg.publicPath(draft) : null;
  const heading = isNew ? `New ${cfg.singular}` : (draft[cfg.titleKey] || `Untitled ${cfg.singular}`);

  return (
    <>
      <PageHeader
        eyebrow={`${cfg.eyebrow} / ${cfg.title}`}
        title={heading}
        actions={(
          <>
            <Button variant="ghost" to={cfg.basePath}>Back to {cfg.title.toLowerCase()}</Button>
            <Button variant="primary" onClick={() => save(draft)}>Save {cfg.singular}</Button>
          </>
        )}
      />

      {notice && <div className="mb-5" role="status"><Notice tone={notice.tone}>{notice.text}</Notice></div>}

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <Panel title="Details">
          <ResourceForm fields={cfg.fields} value={draft} onChange={setDraft} state={state} idPrefix={cfg.collection} />
        </Panel>

        <div className="space-y-6">
          {'status' in draft && (
            <Panel title="Status">
              <Badge>{draft.status}</Badge>
              <div className="mt-4 flex flex-col gap-2">
                {(cfg.statusActions || []).filter((a) => a.value !== draft.status).map((action) => (
                  <Button key={action.value} variant={action.value === 'published' ? 'primary' : 'secondary'} onClick={() => save({ ...draft, status: action.value })}>
                    {action.label}
                  </Button>
                ))}
              </div>
              <p className="mt-4 text-xs text-text-dim leading-relaxed">
                Only published records appear on the public site.
              </p>
            </Panel>
          )}

          <Panel title="Record">
            <DefinitionList
              items={[
                ['Record ID', draft.id],
                ['Last updated', isNew ? 'Not saved yet' : formatDate(draft.updatedAt)],
              ]}
            />
            {publicPath && (
              <p className="mt-4 text-sm">
                <Link to={publicPath} className="text-accent hover:text-accent-2 transition-colors">Open the public page</Link>
              </p>
            )}
          </Panel>

          {!isNew && cfg.canDelete && (
            <Panel title={`Delete ${cfg.singular}`}>
              <p className="mb-4 text-xs text-text-dim leading-relaxed">Removes this {cfg.singular} permanently.</p>
              <Button variant="danger" onClick={destroy}>Delete {cfg.singular}</Button>
            </Panel>
          )}
        </div>
      </div>
    </>
  );
}
