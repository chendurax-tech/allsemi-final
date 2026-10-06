import React, { useCallback, useEffect, useRef, useState } from 'react';
import { emailsApi } from '../../lib/api/admin.js';
import { useAuth } from '../auth.jsx';
import { Badge, Button, Notice } from './ui.jsx';
import { formatDateTime } from '../lib/format.js';
import { useConfirm, useNotify } from './Feedback.jsx';
import { failureReason, EMAIL_STATE_TONES, EMAIL_STATE_LABELS, EMAIL_SEND_FAILED } from '../lib/emailStates.js';

/*
  EmailHistory - the emails the server sent about one record: the
  notification to the ALLSEMIS team and the acknowledgement to the
  person who sent the form, and for an application also the emails a
  recruiter sent to the candidate.

  It reads the server's own record of them (GET /api/admin/emails).
  Each line says which email, whether it went out and when. An
  automatic email that was not sent can be sent again from here by a
  role that may change the record; the server refuses to send one a
  second time once the email service has accepted it. The shortlist,
  regret and selection emails are sent with their own buttons, not
  from this list.

  `entityType` is 'requirement', 'enquiry', 'referral' or
  'application'. `refreshKey` reads the list again when it changes.

  Hooks for automated checks: data-email-history="panel" on the root,
  data-email-entry="<template>" with data-email-state on each line.
*/

const NAMES = {
  newRequirementAdmin: 'Notification to the ALLSEMIS team',
  newApplicationAdmin: 'Notification to the ALLSEMIS team',
  newEnquiryAdmin: 'Notification to the ALLSEMIS team',
  newReferralAdmin: 'Notification to the ALLSEMIS team',
  requirementConfirmation: 'Acknowledgement to the company contact',
  applicationConfirmation: 'Receipt to the candidate',
  enquiryConfirmation: 'Acknowledgement to the person who enquired',
  referralConfirmation: 'Acknowledgement to the person who referred',
  shortlistNotification: 'Shortlist email to the candidate',
  regretNotification: 'Regret email to the candidate',
  selectionNotification: 'Selection email to the candidate',
};
const WRITE = { requirement: 'requirements:write', enquiry: 'enquiries:write', referral: 'referrals:write', application: 'applications:write' };

function detail(entry) {
  if (entry.status === 'SENT') return `Sent${entry.sentAt ? ` on ${formatDateTime(entry.sentAt)}` : ''}. It is not sent a second time.`;
  if (entry.status === 'FAILED') return `Not sent. ${failureReason(entry.failure?.category) || 'The email service did not accept it.'}`;
  if (entry.status === 'NOT_CONFIGURED') return 'Not sent. The email service is not connected yet.';
  if (entry.status === 'LOGGED') return 'Not sent. Email is in development mode, so the message was only written to the server log.';
  if (entry.status === 'CAPPED') return 'Not sent. This address had already received several acknowledgements within the hour, so this one was held back.';
  if (entry.status === 'SENDING') return 'Being sent.';
  return 'Not sent.';
}

export default function EmailHistory({ entityType, entityId, refreshKey }) {
  const { can } = useAuth();
  const ask = useConfirm();
  const notify = useNotify();
  const [load, setLoad] = useState({ status: 'loading', items: [], message: '' });
  const [busy, setBusy] = useState('');
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);

  const read = useCallback(() => {
    emailsApi.list(entityType, entityId)
      .then((items) => { if (alive.current) setLoad({ status: 'ready', items, message: '' }); })
      .catch((failure) => { if (alive.current) setLoad({ status: 'error', items: [], message: failure.message }); });
  }, [entityType, entityId]);

  useEffect(() => { read(); }, [read, refreshKey]);

  async function resend(entry) {
    const name = NAMES[entry.template] || 'This email';
    const agreed = await ask({
      title: 'Send this email again?',
      message: `${name} was not sent the first time. This sends the same email once more.`,
      confirmLabel: 'Send email',
    });
    if (!agreed) return;
    setBusy(entry.id);
    try {
      const updated = await emailsApi.resend(entry.id);
      if (alive.current) setLoad((current) => ({ ...current, items: current.items.map((item) => (item.id === updated.id ? updated : item)) }));
      if (updated.status === 'SENT') notify({ tone: 'success', message: 'Email sent successfully.' });
      else if (updated.status === 'FAILED') notify({ tone: 'error', message: EMAIL_SEND_FAILED });
      else notify({ tone: 'info', message: 'No email was sent. The list says why.' });
    } catch (failure) {
      notify({ tone: failure.status === 409 ? 'info' : 'error', message: failure.status === 409 ? failure.message : EMAIL_SEND_FAILED });
      read();
    }
    if (alive.current) setBusy('');
  }

  const canResend = can(WRITE[entityType] || '');

  return (
    <section aria-label="Emails" className="border border-line-strong p-4" data-email-history="panel">
      <h3 className="font-display text-sm font-semibold tracking-tight">Emails</h3>
      <p className="mt-2 text-xs leading-relaxed text-text-dim">What the server sent about this record. Each email is sent once.</p>

      {load.status === 'loading' && <p className="mt-3 text-xs text-text-dim" role="status">Reading the email record.</p>}
      {load.status === 'error' && <div className="mt-3" role="alert"><Notice tone="red">The email record could not be read. {load.message}</Notice></div>}
      {load.status === 'ready' && load.items.length === 0 && (
        <p className="mt-3 text-xs leading-relaxed text-text-dim" data-email-history="empty">No email is recorded for this record. Records from before the email record existed, and records added by staff, have none.</p>
      )}
      {load.items.length > 0 && (
        <ul className="mt-3 divide-y divide-line border-t border-line">
          {load.items.map((entry) => (
            <li key={entry.id} className="py-3" data-email-entry={entry.template} data-email-state={entry.status}>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <p className="min-w-0 flex-1 basis-48 break-words text-sm font-semibold">{NAMES[entry.template] || entry.template}</p>
                <Badge tone={EMAIL_STATE_TONES[entry.status] || 'dim'}>{EMAIL_STATE_LABELS[entry.status] || entry.status}</Badge>
              </div>
              <p className="mt-1 break-words text-xs leading-relaxed text-text-dim">
                {detail(entry)}
                {entry.status !== 'SENT' && entry.at ? ` Last tried ${formatDateTime(entry.at)}.` : ''}
              </p>
              {/* The email service's own sentence, which the server sends to a super admin only. */}
              {entry.failure?.message && <p className="mt-1 break-words text-xs leading-relaxed text-text-dim">The email service said: {entry.failure.message}</p>}
              {entry.canResend && canResend && (
                <div className="mt-2"><Button size="sm" onClick={() => resend(entry)} disabled={Boolean(busy)}>{busy === entry.id ? 'Sending' : 'Send again'}</Button></div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
