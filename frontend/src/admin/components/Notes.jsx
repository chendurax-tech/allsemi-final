import React, { useState } from 'react';
import { Button, Notice, cx, inputCls, labelCls } from './ui.jsx';
import { formatDateTime } from '../lib/format.js';

/*
  Notes - the dated notes kept on a candidate or a referral, newest
  first, with a box to add one. A note is added by its own request and
  cannot be edited or removed afterwards, so the list is a record of
  what was written and by whom.

  onAdd(text) sends the note and resolves when the server has stored
  it. canAdd is false for a role that may read but not write.
*/
export default function Notes({ id, notes, canAdd, onAdd }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const ordered = [...(notes || [])].reverse();

  async function add(event) {
    event.preventDefault();
    if (!text.trim() || busy) return;
    setBusy(true);
    setError('');
    try {
      await onAdd(text.trim());
      setText('');
    } catch (failure) {
      setError(failure.fields?.text || failure.message);
    }
    setBusy(false);
  }

  return (
    <>
      {ordered.length === 0 ? <p className="text-sm text-text-dim">No notes yet.</p> : (
        <ol className="space-y-4">
          {ordered.map((note, i) => (
            <li key={`${note.at}-${i}`} className="border-l border-line-strong pl-4">
              <p className="whitespace-pre-line break-words text-sm leading-relaxed">{note.text}</p>
              <p className="mt-1 text-xs text-text-dim">{note.authorName || 'Unknown author'}, {formatDateTime(note.at)}</p>
            </li>
          ))}
        </ol>
      )}
      {canAdd && (
        <form onSubmit={add} className="mt-5 border-t border-line pt-4">
          <label htmlFor={id} className={labelCls}>Add a note</label>
          <textarea id={id} rows={3} value={text} maxLength={4000} onChange={(e) => setText(e.target.value)} className={cx(inputCls, 'resize-y leading-relaxed')} />
          {error && <div className="mt-3" role="alert"><Notice tone="red">{error}</Notice></div>}
          <div className="mt-3"><Button type="submit" disabled={busy || !text.trim()}>{busy ? 'Adding' : 'Add note'}</Button></div>
        </form>
      )}
    </>
  );
}
