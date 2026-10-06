import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { RESOURCES } from '../data/resources.js';
import { label } from '../data/enums.js';
import { useAdminStore } from '../store.jsx';
import { useAuth } from '../auth.jsx';
import { PageHeader, Panel, Badge, Button, EmptyState, DefinitionList, Notice } from '../components/ui.jsx';
import ResourceForm, { SaveError, fieldsFor, missingRequired } from '../components/ResourceForm.jsx';
import { formatDateTime } from '../lib/format.js';
import { useArrivalNotice } from '../lib/useArrivalNotice.js';
import RequirementProfile from '../components/RequirementProfile.jsx';
import { useConfirm } from '../components/Feedback.jsx';

/*
  ResourceEditor - the full-page create/edit screen for resources that
  have /new or /:id routes (jobs, insights, and new stories or sectors).

  A new record is sent without an id: the server assigns it, and the
  screen moves to the address of the record the server returned. Save,
  publish and delete are requests, so their buttons show a busy state
  and the server's refusal (a validation message, a missing permission,
  a job that still has applications) is shown as it was returned.

  Controls a role cannot use are hidden. The server enforces the same
  permissions on every request regardless of what is shown here.

  A job also shows its requirement profile below the form
  (components/RequirementProfile.jsx). No other resource has one.
*/

function EditorForm({ cfg, existing }) {
  const { state, upsert, remove } = useAdminStore();
  const { can } = useAuth();
  const ask = useConfirm();
  const navigate = useNavigate();
  const [draft, setDraft] = useState(() => existing || cfg.blank());
  const [busy, setBusy] = useState('');
  const [error, setError] = useState(null);
  const [notice, setNotice] = useArrivalNotice();
  const isNew = !existing;
  const canWrite = can(cfg.permissions.write);
  const canPublish = can(cfg.permissions.publish);
  const fields = fieldsFor(cfg.fields, can);

  // kind names the button that is busy: 'save' or a status value.
  async function save(next, kind, done) {
    const missing = missingRequired(fields, next);
    if (missing.length) {
      setNotice('');
      setError({ message: `Add ${missing.join(', ')} before saving.` });
      return;
    }
    setBusy(kind);
    setError(null);
    setNotice('');
    try {
      const saved = await upsert(cfg.collection, next);
      if (isNew) {
        navigate(cfg.editor === 'page' ? `${cfg.basePath}/${saved.id}` : cfg.basePath, { replace: true, state: { notice: done } });
        return;
      }
      setDraft(saved);
      setNotice(done);
    } catch (failure) {
      setError(failure);
    }
    setBusy('');
  }

  async function destroy() {
    const agreed = await ask({
      title: `Delete ${cfg.singular}?`,
      message: `This will permanently remove this ${cfg.singular}. This cannot be undone.`,
      confirmLabel: 'Delete',
      tone: 'danger',
    });
    if (!agreed) return;
    setBusy('delete');
    setError(null);
    setNotice('');
    try {
      await remove(cfg.collection, existing.id);
      navigate(cfg.basePath, { state: { notice: `Deleted ${cfg.singular}.` } });
    } catch (failure) {
      setError(failure);
      setBusy('');
    }
  }

  // Moving a record to or from "published" needs the publish
  // permission. Any other status change needs only the right to edit.
  const statusActions = (cfg.statusActions || []).filter((action) => {
    if (action.value === draft.status) return false;
    const touchesPublished = action.value === 'published' || draft.status === 'published';
    return canWrite && (!touchesPublished || canPublish);
  });

  const publicPath = cfg.publicPath && existing ? cfg.publicPath(existing) : null;
  const heading = isNew ? `New ${cfg.singular}` : (draft[cfg.titleKey] || `Untitled ${cfg.singular}`);
  const working = Boolean(busy);

  return (
    <>
      <PageHeader
        eyebrow={`${cfg.eyebrow} / ${cfg.title}`}
        title={heading}
        actions={(
          <>
            <Button variant="ghost" to={cfg.basePath}>Back to {cfg.title.toLowerCase()}</Button>
            {canWrite && <Button variant="primary" onClick={() => save(draft, 'save', `Saved ${cfg.singular}.`)} disabled={working}>{busy === 'save' ? 'Saving' : `Save ${cfg.singular}`}</Button>}
          </>
        )}
      />

      {error && <div className="mb-5"><SaveError error={error} fields={fields} /></div>}
      {notice && <div className="mb-5" role="status"><Notice tone="teal">{notice}</Notice></div>}
      {!canWrite && <div className="mb-5"><Notice tone="blue">Your role can view this {cfg.singular} but cannot change it.</Notice></div>}
      {cfg.listNotice && <div className="mb-5"><Notice tone="blue">{cfg.listNotice}</Notice></div>}

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <Panel title="Details">
          <ResourceForm fields={fields} value={draft} onChange={setDraft} state={state} idPrefix={cfg.collection} errors={error?.fields} readOnly={!canWrite} saved={existing} />
        </Panel>

        <div className="space-y-6">
          {'status' in draft && (
            <Panel title="Status">
              <Badge>{label(draft.status)}</Badge>
              {statusActions.length > 0 && (
                <div className="mt-4 flex flex-col gap-2">
                  {statusActions.map((action) => (
                    <Button key={action.value} variant={action.value === 'published' ? 'primary' : 'secondary'} disabled={working} onClick={() => save({ ...draft, status: action.value }, action.value, `Saved. The ${cfg.singular} is now ${action.value}.`)}>
                      {busy === action.value ? 'Saving' : action.label}
                    </Button>
                  ))}
                </div>
              )}
              <p className="mt-4 text-xs text-text-dim leading-relaxed">
                {cfg.listNotice ? 'Only published records are offered to the public site through the API.' : 'Only published records appear on the public site.'}
              </p>
            </Panel>
          )}

          <Panel title="Record">
            <DefinitionList
              items={[
                ['Record ID', isNew ? 'Assigned when saved' : existing.id],
                ['Last updated', isNew ? 'Not saved yet' : formatDateTime(draft.updatedAt)],
              ]}
            />
            {publicPath && (
              <p className="mt-4 text-sm">
                <Link to={publicPath} className="text-accent hover:text-accent-2 transition-colors">Open the public page</Link>
              </p>
            )}
          </Panel>

          {!isNew && cfg.canDelete && can(cfg.permissions.remove) && (
            <Panel title={`Delete ${cfg.singular}`}>
              <p className="mb-4 text-xs text-text-dim leading-relaxed">Removes this {cfg.singular} permanently. {cfg.deleteNote || ''}</p>
              <Button variant="danger" onClick={destroy} disabled={working}>{busy === 'delete' ? 'Deleting' : `Delete ${cfg.singular}`}</Button>
            </Panel>
          )}
        </div>
      </div>

      {/* Jobs only: the optional requirement profile. It has its own
          save button and its own requests, apart from the form above. */}
      {cfg.collection === 'jobs' && (
        <div className="mt-6">
          <RequirementProfile job={existing} />
        </div>
      )}
    </>
  );
}

export default function ResourceEditor({ resource, id }) {
  const cfg = RESOURCES[resource];
  const { state, status, errors, reload } = useAdminStore();
  const load = status[cfg.collection];
  const back = <div className="flex justify-center pb-4"><Button to={cfg.basePath}>Back to {cfg.title.toLowerCase()}</Button></div>;

  // A new record needs nothing from the database. An existing one is
  // shown once the collection has been read.
  if (!id) return <EditorForm cfg={cfg} existing={null} />;

  if (load === 'loading') {
    return <Panel><div role="status"><EmptyState title={`Loading the ${cfg.singular}`}>Reading the record from the database.</EmptyState></div></Panel>;
  }
  if (load === 'error') {
    return (
      <Panel>
        <div role="alert"><EmptyState title={`The ${cfg.singular} could not be loaded`}>{errors[cfg.collection]}</EmptyState></div>
        <div className="flex justify-center pb-4"><Button onClick={() => reload(cfg.collection)}>Try again</Button></div>
      </Panel>
    );
  }

  const existing = state[cfg.collection].find((item) => item.id === id);
  if (!existing) {
    return (
      <Panel>
        <EmptyState title={`This ${cfg.singular} was not found`}>It may have been deleted, or the address may be wrong.</EmptyState>
        {back}
      </Panel>
    );
  }
  return <EditorForm key={existing.id} cfg={cfg} existing={existing} />;
}
