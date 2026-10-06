import React, { useEffect, useRef, useState } from 'react';
import { applicationsApi } from '../../lib/api/index.js';
import { useAdminStore } from '../store.jsx';
import { useAuth } from '../auth.jsx';
import { Badge, Button, Notice } from './ui.jsx';
import { formatDateTime } from '../lib/format.js';
import { useConfirm, useNotify } from './Feedback.jsx';
import { failureReason, EMAIL_SEND_FAILED } from '../lib/emailStates.js';

/*
  ShortlistPanel - the one workflow action on an application.

  An application is New until a recruiter shortlists it. Shortlisting
  is done by the server in one step: it checks the permission, sets the
  status, records who did it and sends the candidate an email. It
  cannot be done twice, and the candidate receives at most one email
  per application.

  What the panel shows afterwards is what the server reported about the
  email. While the email service is not connected the application is
  still shortlisted, the panel says plainly that no email went out, and
  the email can be sent from here later.

  Shortlisting asks first, in the admin's own confirmation dialog, and
  the result is also announced in a notification (components/Feedback.jsx).
  The browser's own alert and confirm boxes are not used.

  `item` is the application. onChanged(application) is called with the
  record as the server returned it.
*/

// What each state of the shortlist email means for the recruiter.
const EMAIL = {
  SENT: { tone: 'teal', text: (at) => `The candidate was emailed${at ? ` on ${formatDateTime(at)}` : ''}.` },
  LOGGED: { tone: 'amber', text: () => 'No email was sent. Email is in development mode, so the message was only written to the server log.' },
  NOT_CONFIGURED: { tone: 'amber', text: () => 'No email was sent. The email service is not connected yet.' },
  FAILED: { tone: 'red', text: (_at, failure) => `The email could not be sent. ${failureReason(failure) || 'The email service did not accept it.'}` },
  SENDING: { tone: 'amber', text: () => 'The email is being sent.' },
  NOT_SENT: { tone: 'amber', text: () => 'No shortlist email has been sent for this application.' },
};

export default function ShortlistPanel({ item, onChanged }) {
  const { put } = useAdminStore();
  const { can } = useAuth();
  const ask = useConfirm();
  const notify = useNotify();
  const [application, setApplication] = useState(item);
  const [busy, setBusy] = useState('');
  const [note, setNote] = useState('');
  // The button that was pressed is replaced by the result, so keyboard
  // focus is moved to the panel, where the result is.
  const panel = useRef(null);

  // A different record, or the same record read again from the server.
  useEffect(() => { setApplication(item); }, [item]);

  const allowed = can('applications:shortlist');
  const shortlisted = application.status === 'SHORTLISTED';
  const emailState = application.shortlist?.email?.status || 'NOT_SENT';
  const email = EMAIL[emailState] || EMAIL.NOT_SENT;

  function accept(updated) {
    setApplication(updated);
    put('applications', updated);
    if (onChanged) onChanged(updated);
  }

  // On success the panel itself shows the result: the status and what
  // happened to the email. Only a refusal needs a message of its own.
  async function run(kind, request) {
    setBusy(kind);
    setNote('');
    try {
      const result = await request();
      accept(result.application);
      panel.current?.focus({ preventScroll: true });
      announce(kind, result.application);
    } catch (failure) {
      // Refused because someone else did it first: show what the server holds.
      if (failure.status === 409) {
        try { accept(await applicationsApi.get(application.id)); } catch { /* the message below still explains */ }
        notify({ tone: 'info', message: /already shortlisted/i.test(failure.message) ? 'Candidate is already shortlisted.' : failure.message });
      } else {
        notify({ tone: 'error', message: kind === 'email' ? EMAIL_SEND_FAILED : 'The application could not be shortlisted. Nothing was changed.' });
      }
      setNote(failure.message);
    }
    setBusy('');
  }

  // The outcome as a notification. The panel keeps the detail.
  function announce(kind, updated) {
    const state = updated.shortlist?.email?.status;
    const done = kind === 'shortlist' ? 'Shortlisted. ' : '';
    if (state === 'SENT') notify({ tone: 'success', message: `${done}Shortlist email sent successfully.` });
    else if (state === 'FAILED') notify({ tone: 'error', message: kind === 'shortlist' ? `Shortlisted. ${EMAIL_SEND_FAILED}` : EMAIL_SEND_FAILED });
    else notify({ tone: 'info', message: `${done}No shortlist email was sent. The panel says why.` });
  }

  async function shortlist() {
    const agreed = await ask({
      title: 'Shortlist candidate?',
      message: 'The candidate will be notified by email. This action cannot be undone from here.',
      confirmLabel: 'Shortlist',
    });
    if (!agreed) return;
    run('shortlist', () => applicationsApi.shortlist(application.id));
  }

  const sendEmail = () => run('email', () => applicationsApi.shortlistEmail(application.id));

  return (
    <section ref={panel} tabIndex={-1} aria-label="Shortlist" className="border border-line-strong p-4 focus:outline-none">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <h3 className="font-display text-sm font-semibold tracking-tight">Shortlist</h3>
        <Badge>{shortlisted ? 'Shortlisted' : 'New'}</Badge>
      </div>

      {!shortlisted && (
        <>
          <p className="mt-2 text-xs leading-relaxed text-text-dim">
            Shortlisting is the one step in this workflow. It records your decision and emails the candidate. Labels do not do this.
          </p>
          {allowed
            ? <div className="mt-3"><Button variant="primary" size="sm" onClick={shortlist} disabled={Boolean(busy)}>{busy === 'shortlist' ? 'Shortlisting' : 'Shortlist'}</Button></div>
            : <p className="mt-2 text-xs leading-relaxed text-text-dim">Your role cannot shortlist applications.</p>}
        </>
      )}

      {shortlisted && (
        <>
          <p className="mt-2 text-xs leading-relaxed text-text-dim">
            {application.shortlist?.at
              ? `Shortlisted by ${application.shortlist.byName || 'a recruiter'} on ${formatDateTime(application.shortlist.at)}.`
              : 'Shortlisted before shortlist emails existed.'}
          </p>
          <div className="mt-3" role="status"><Notice tone={email.tone}>{email.text(application.shortlist?.email?.at, application.shortlist?.email?.failure)}</Notice></div>
          {allowed && emailState !== 'SENT' && emailState !== 'SENDING' && (
            <div className="mt-3">
              <Button size="sm" onClick={sendEmail} disabled={Boolean(busy)}>{busy === 'email' ? 'Sending' : 'Send shortlist email'}</Button>
              <p className="mt-2 text-xs leading-relaxed text-text-dim">The candidate receives this email once. After it has been sent it cannot be sent again.</p>
            </div>
          )}
        </>
      )}

      {note && <div className="mt-3" role="alert"><Notice tone="red">{note}</Notice></div>}
    </section>
  );
}
