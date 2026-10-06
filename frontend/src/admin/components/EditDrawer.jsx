import React, { useState } from 'react';
import { useAdminStore } from '../store.jsx';
import { RESOURCES } from '../data/resources.js';
import { Button, Drawer } from './ui.jsx';
import ResourceForm, { SaveError, missingRequired } from './ResourceForm.jsx';

/*
  EditDrawer - edits one record of a collection from its own page (the
  candidate and referral pages), using the field list the collection
  declares in data/resources.js. It saves with one request that carries
  only what changed, and shows a refusal from the server next to the
  field it belongs to.
*/
export default function EditDrawer({ collection, record, title, saveLabel, onClose, onSaved }) {
  const { state, upsert } = useAdminStore();
  const [draft, setDraft] = useState(record);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const { fields, singular } = RESOURCES[collection];

  async function save() {
    const missing = missingRequired(fields, draft);
    if (missing.length) {
      setError({ message: `Add ${missing.join(', ')} before saving.` });
      return;
    }
    setBusy(true);
    setError(null);
    try {
      onSaved(await upsert(collection, draft, record));
    } catch (failure) {
      setError(failure);
      setBusy(false);
    }
  }

  return (
    <Drawer
      title={title}
      onClose={onClose}
      footer={(
        <>
          <Button variant="primary" onClick={save} disabled={busy}>{busy ? 'Saving' : saveLabel}</Button>
          <Button onClick={onClose} disabled={busy}>Cancel</Button>
        </>
      )}
    >
      {error && <div className="mb-5"><SaveError error={error} fields={fields} /></div>}
      <ResourceForm fields={fields} value={draft} onChange={setDraft} state={state} idPrefix={singular} errors={error?.fields} />
    </Drawer>
  );
}
