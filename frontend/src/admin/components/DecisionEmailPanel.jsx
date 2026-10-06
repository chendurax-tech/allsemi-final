import React, { useEffect, useRef, useState } from 'react';
import { applicationsApi } from '../../lib/api/index.js';
import { useAdminStore } from '../store.jsx';
import { useAuth } from '../auth.jsx';
import { Badge, Button, Notice } from './ui.jsx';
import { formatDateTime } from '../lib/format.js';
import { useConfirm, useNotify } from './Feedback.jsx';
import { failureReason, EMAIL_SEND_FAILED } from '../lib/emailStates.js';

/*
  DecisionEmailPanel - the regret email and the selection email of one
  application.

  Rejected and Selected are labels: tags a recruiter adds after
  reviewing the candidate. A label sends nothing and changes no status.
  When the recruiter also wants the candidate told, they press "Send
  regret email" or "Send selection email" here. That press, confirmed
  in the admin's own dialog, is the only thing that sends either email.

  A button is offered only for an application that carries the label
  (as it is saved on the server). Each email goes out at most once per
  application: after the email service has accepted it the panel shows
  when it was sent and offers nothing more. When sending fails the
  label stays, the panel says why, and the email can be sent again.

  `item` is the application. onChanged(application) is called with the
  record as the server returned it.

  Hooks for automated checks: data-decision-emails="panel" on the root,
  data-decision-email="regret|selection" with data-email-state on each.
*/

const KINDS = [
  {
    kind: 'regret',
    label: 'REJECTED',
    labelName: 'Rejected',
    title: 'Regret email',
    button: 'Send regret email',
    confirmTitle: 'Send regret email?',
    confirmMessage: 'This will send an unsuccessful application email to the candidate.',
    sent: 'Regret email sent successfully.',
    request: (id) => applicationsApi.regretEmail(id),
  },
  {
    kind: 'selection',
    label: 'SELECTED',
    labelName: 'Selected',
    title: 'Selection email',
    button: 'Send selection email',
    confirmTitle: 'Send selection email?',
    confirmMessage: 'This will send the selection/next-steps email to the candidate.',
    sent: 'Selection email sent successfully.',
    request: (id) => applicationsApi.selectionEmail(id),
  },
];

// What each state means for the recruiter.
function describe(config, email) {
  switch (email.status) {
    case 'SENT':
      return { tone: 'teal', text: `The candidate was emailed${email.sentAt ? ` on ${formatDateTime(email.sentAt)}` : ''}${email.byName ? ` by ${email.byName}` : ''}. It is not sent a second time.` };
    case 'LOGGED':
      return { tone: 'amber', text: 'No email was sent. Email is in development mode, so the message was only written to the server log.' };
    case 'NOT_CONFIGURED':
      return { tone: 'amber', text: 'No email was sent. The email service is not connected yet.' };
    case 'FAILED':
      return { tone: 'red', text: `The email could not be sent. ${failureReason(email.failure) || 'The email service did not accept it.'}` };
    case 'SENDING':
      return { tone: 'amber', text: 'The email is being sent.' };
    default:
      return { tone: 'amber', text: `No ${config.title.toLowerCase()} has been sent for this application.` };
  }
}

export default function DecisionEmailPanel({ item, onChanged }) {
  const { put } = useAdminStore();
  const { can } = useAuth();
  const ask = useConfirm();
  const notify = useNotify();
  const [application, setApplication] = useState(item);
  const [busy, setBusy] = useState('');
  // { kind, text }: a refusal from the server, shown next to its email.
  const [note, setNote] = useState(null);
  const panel = useRef(null);

  // A different record, or the same record read again from the server.
  useEffect(() => { setApplication(item); }, [item]);

  const allowed = can('applications:shortlist');
  const labels = application.labels || [];
  const both = labels.includes('REJECTED') && labels.includes('SELECTED');
  const emails = application.decisionEmails || {};

  // Shown for a label that is on, and for an email that was sent or
  // tried before (so its record stays visible if the label is removed).
  const shown = KINDS.filter((config) => labels.includes(config.label) || (emails[config.kind]?.attempts || 0) > 0 || emails[config.kind]?.status === 'SENT');

  function accept(updated) {
    setApplication(updated);
    put('applications', updated);
    if (onChanged) onChanged(updated);
  }

  async function send(config) {
    const agreed = await ask({ title: config.confirmTitle, message: config.confirmMessage, confirmLabel: 'Send email' });
    if (!agreed) return;
    setBusy(config.kind);
    setNote(null);
    try {
      const result = await config.request(application.id);
      accept(result.application);
      panel.current?.focus({ preventScroll: true });
      const state = result.application.decisionEmails?.[config.kind]?.status;
      if (state === 'SENT') notify({ tone: 'success', message: config.sent });
      else if (state === 'FAILED') notify({ tone: 'error', message: EMAIL_SEND_FAILED });
      else notify({ tone: 'info', message: `No ${config.title.toLowerCase()} was sent. The panel says why.` });
    } catch (failure) {
      // Refused because it was already sent or the label changed: show
      // what the server holds now.
      if (failure.status === 409) {
        try { accept(await applicationsApi.get(application.id)); } catch { /* the message below still explains */ }
        notify({ tone: 'info', message: failure.message });
      } else {
        notify({ tone: 'error', message: EMAIL_SEND_FAILED });
      }
      setNote({ kind: config.kind, text: failure.message });
    }
    setBusy('');
  }

  return (
    <section ref={panel} tabIndex={-1} aria-label="Candidate emails" className="border border-line-strong p-4 focus:outline-none" data-decision-emails="panel">
      <h3 className="font-display text-sm font-semibold tracking-tight">Regret and selection emails</h3>
      <p className="mt-2 text-xs leading-relaxed text-text-dim">
        A label never emails the candidate. After the Rejected or the Selected label has been added and saved, the matching email can be sent from here, once. It changes no status.
      </p>

      {shown.length === 0 && (
        <p className="mt-3 text-xs leading-relaxed text-text-dim" data-decision-emails="none">This application carries neither label, so there is no email to send.</p>
      )}

      {both && (
        <div className="mt-3" role="status"><Notice tone="amber">This application carries both the Rejected and the Selected label. Remove one of them before emailing the candidate.</Notice></div>
      )}

      {shown.map((config) => {
        const email = emails[config.kind] || { status: 'NOT_SENT' };
        const state = email.status || 'NOT_SENT';
        const told = describe(config, email);
        const hasLabel = labels.includes(config.label);
        const canSend = allowed && hasLabel && !both && state !== 'SENT' && state !== 'SENDING';
        return (
          <div key={config.kind} className="mt-4 border-t border-line pt-4" data-decision-email={config.kind} data-email-state={state}>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <h4 className="text-sm font-semibold">{config.title}</h4>
              <Badge tone={state === 'SENT' ? 'teal' : 'dim'}>{state === 'SENT' ? 'Sent' : 'Not sent'}</Badge>
            </div>
            <div className="mt-3" role="status"><Notice tone={told.tone}>{told.text}</Notice></div>
            {!hasLabel && state !== 'SENT' && (
              <p className="mt-2 text-xs leading-relaxed text-text-dim">The {config.labelName} label is no longer on this application, so this email cannot be sent.</p>
            )}
            {canSend && (
              <div className="mt-3">
                <Button size="sm" onClick={() => send(config)} disabled={Boolean(busy)}>{busy === config.kind ? 'Sending' : config.button}</Button>
                <p className="mt-2 text-xs leading-relaxed text-text-dim">The candidate receives this email once. After it has been sent it cannot be sent again.</p>
              </div>
            )}
            {!allowed && hasLabel && state !== 'SENT' && <p className="mt-2 text-xs leading-relaxed text-text-dim">Your role cannot email candidates.</p>}
            {note?.kind === config.kind && <div className="mt-3" role="alert"><Notice tone="red">{note.text}</Notice></div>}
          </div>
        );
      })}
    </section>
  );
}
