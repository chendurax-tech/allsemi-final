import React, { useState } from 'react';
import { Button, Notice } from './ui.jsx';

/*
  DocumentButton - opens a private document (a resume or an attachment).

  A private document has no permanent address. The button asks the
  backend for a signed link, which the backend only issues to a role
  that may read the document, records in the audit log, and lets
  expire after a short time. The link is then opened in a new tab.

  The tab is opened during the click and pointed at the link when it
  arrives: a tab opened later, after the request, is what popup
  blockers stop. If the browser blocks it anyway, the link is shown
  for the person to open themselves.

  request: () => Promise<{ url, expiresIn, fileName }>
*/
export default function DocumentButton({ label, request, size = 'md', variant = 'secondary' }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [fallback, setFallback] = useState(null);

  async function open() {
    setBusy(true);
    setError('');
    setFallback(null);
    const tab = window.open('', '_blank');
    try {
      const link = await request();
      if (tab) {
        tab.opener = null;
        tab.location.replace(link.url);
      } else {
        setFallback(link);
      }
    } catch (failure) {
      if (tab) tab.close();
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <Button size={size} variant={variant} onClick={open} disabled={busy}>{busy ? 'Requesting the link' : label}</Button>
      {error && <div className="mt-3" role="alert"><Notice tone="red">{error}</Notice></div>}
      {fallback && (
        <div className="mt-3" role="status">
          <Notice tone="blue">
            Your browser blocked the new tab.{' '}
            <a href={fallback.url} target="_blank" rel="noopener noreferrer" className="font-semibold underline">Open {fallback.fileName || 'the document'}</a>
            {fallback.expiresIn ? ` within ${fallback.expiresIn} seconds, before the link expires.` : ' before the link expires.'}
          </Notice>
        </div>
      )}
    </div>
  );
}
