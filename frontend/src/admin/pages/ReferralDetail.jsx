import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { referralsApi } from '../../lib/api/index.js';
import { useAdminStore } from '../store.jsx';
import { useAuth } from '../auth.jsx';
import { REFERRAL_STATUSES, label } from '../data/enums.js';
import { PageHeader, Panel, Badge, Button, EmptyState, DefinitionList, Notice, inputCls, labelCls } from '../components/ui.jsx';
import DocumentButton from '../components/DocumentButton.jsx';
import Notes from '../components/Notes.jsx';
import EditDrawer from '../components/EditDrawer.jsx';
import { formatDateTime, formatBytes } from '../lib/format.js';

/*
  ReferralDetail - one referral from the Refer page: who referred whom,
  what they said, the status, recruiter notes, the resume if one was
  sent, and the conversion into a candidate record.

  The details the referrer entered about the person can be corrected
  in a drawer; the email in particular is needed before converting.

  Converting creates the candidate, or links the candidate that already
  uses that email (filling only what is empty on it), and marks the
  referral CONVERTED. A new candidate takes the resume; a candidate who
  already has one keeps their own. It is the only way a referral
  reaches that status, so CONVERTED is not offered in the status list.
*/

const stated = (value) => (value === '' || value === null || value === undefined ? 'Not provided' : value);
const OPEN_STATUSES = REFERRAL_STATUSES.filter((status) => status !== 'CONVERTED');

export default function ReferralDetail({ id }) {
  const { state, status, errors, reload, upsert, remove, put } = useAdminStore();
  const { can } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState('');
  const [note, setNote] = useState(null);
  const [editing, setEditing] = useState(false);

  const back = <div className="flex justify-center pb-4"><Button to="/admin/referrals">Back to referrals</Button></div>;

  if (status.referrals === 'loading') {
    return <Panel><div role="status"><EmptyState title="Loading the referral">Reading the record from the database.</EmptyState></div></Panel>;
  }
  if (status.referrals === 'error') {
    return (
      <Panel>
        <div role="alert"><EmptyState title="The referral could not be loaded">{errors.referrals}</EmptyState></div>
        <div className="flex justify-center pb-4"><Button onClick={() => reload('referrals')}>Try again</Button></div>
      </Panel>
    );
  }

  const referral = state.referrals.find((item) => item.id === id);
  if (!referral) {
    return <Panel><EmptyState title="This referral was not found">It may have been deleted, or the address may be wrong.</EmptyState>{back}</Panel>;
  }

  const canWrite = can('referrals:write');
  const canConvert = canWrite && can('candidates:write');
  const converted = referral.status === 'CONVERTED' || Boolean(referral.candidateId);
  const profileUrl = /^https?:\/\//i.test(referral.candidateProfileUrl || '') ? referral.candidateProfileUrl : '';
  const working = Boolean(busy);

  async function run(kind, action, done) {
    setBusy(kind);
    setNote(null);
    try {
      const text = await action();
      setNote({ tone: 'teal', text: text || done });
    } catch (failure) {
      setNote({ tone: 'red', text: failure.message });
    }
    setBusy('');
  }

  const changeStatus = (next) => run('status', async () => {
    const saved = await upsert('referrals', { id, status: next });
    return `Saved. The status is now ${label(saved.status)}.`;
  });

  const convert = () => run('convert', async () => {
    let result;
    try {
      result = await referralsApi.convert(id);
    } catch (failure) {
      // Refused because it was converted elsewhere in the meantime: the
      // referral is read again so this screen shows what the server holds.
      if (failure.status === 409) reload('referrals');
      throw failure;
    }
    put('referrals', result.referral);
    if (can('candidates:read')) put('candidates', result.candidate);
  }, 'Converted. This referral is now linked to a candidate record.');

  async function addNote(text) {
    put('referrals', await referralsApi.addNote(id, text));
  }

  async function destroy() {
    if (!window.confirm(`Delete the referral of ${referral.candidateName}? This cannot be undone.`)) return;
    setBusy('delete');
    setNote(null);
    try {
      await remove('referrals', id);
      navigate('/admin/referrals', { state: { notice: 'Deleted referral.' } });
    } catch (failure) {
      setNote({ tone: 'red', text: failure.message });
      setBusy('');
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Recruitment / Referrals"
        title={referral.candidateName}
        description={`Referred by ${referral.referrerName} on ${formatDateTime(referral.createdAt)}.`}
        actions={<Button variant="ghost" to="/admin/referrals">Back to referrals</Button>}
      />

      {note && <div className="mb-5" role={note.tone === 'red' ? 'alert' : 'status'}><Notice tone={note.tone}>{note.text}</Notice></div>}

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-6 min-w-0">
          <Panel
            title="Referred person"
            action={canWrite && !converted ? <Button size="sm" className="shrink-0" onClick={() => { setNote(null); setEditing(true); }}>Edit details</Button> : null}
          >
            <DefinitionList
              items={[
                ['Name', referral.candidateName],
                ['Role', stated(referral.candidateRole)],
                ['Domain', stated(referral.domain)],
                ['Email', stated(referral.candidateEmail)],
                ['Phone', stated(referral.candidatePhone)],
                ['Profile link', profileUrl
                  ? <a key="link" href={profileUrl} target="_blank" rel="noopener noreferrer" className="text-accent hover:text-accent-2 transition-colors">{profileUrl}</a>
                  : stated(referral.candidateProfileUrl)],
              ]}
            />
          </Panel>

          <Panel title="Referred by">
            <DefinitionList
              items={[
                ['Name', referral.referrerName],
                ['Relationship', stated(referral.relationship)],
                ['Email', referral.referrerEmail],
                ['Phone', stated(referral.referrerPhone)],
              ]}
            />
          </Panel>

          <Panel title="Message" meta="What the referrer wrote">
            <p className="whitespace-pre-line break-words text-sm leading-relaxed">{referral.message || 'No message was sent.'}</p>
          </Panel>

          <Panel title="Notes" meta="Seen by the recruitment team only">
            <Notes id="referral-note" notes={referral.notes} canAdd={canWrite} onAdd={addNote} />
          </Panel>
        </div>

        <div className="space-y-6 min-w-0">
          <Panel title="Status">
            <div className="mb-4"><Badge>{label(referral.status)}</Badge></div>
            {converted && <p className="text-xs text-text-dim leading-relaxed">A converted referral keeps this status.</p>}
            {!converted && canWrite && (
              <>
                <label htmlFor="referral-status" className={labelCls}>Change status</label>
                <select id="referral-status" value={referral.status} disabled={working} onChange={(e) => changeStatus(e.target.value)} className={inputCls}>
                  {OPEN_STATUSES.map((value) => <option key={value} value={value}>{label(value)}</option>)}
                </select>
                <p className="mt-2 text-xs text-text-dim leading-relaxed">Saved as soon as you choose.</p>
              </>
            )}
            {!converted && !canWrite && <p className="text-xs text-text-dim leading-relaxed">Your role can view this referral but cannot change it.</p>}
          </Panel>

          <Panel title="Candidate record">
            {converted && referral.candidateId && (
              <>
                <p className="text-sm leading-relaxed">This referral was converted. The candidate record holds the profile.</p>
                {can('candidates:read') && <div className="mt-4"><Button variant="primary" to={`/admin/candidates/${referral.candidateId}`}>Open the candidate</Button></div>}
              </>
            )}
            {converted && !referral.candidateId && (
              <p className="text-sm text-text-dim leading-relaxed">This referral was converted and its candidate record has since been deleted.</p>
            )}
            {!converted && canConvert && (
              <>
                <p className="text-sm text-text-dim leading-relaxed">
                  Converting creates a candidate from this referral, or links the candidate that already uses this email. A new candidate takes the resume; an existing candidate keeps their own.
                </p>
                {!referral.candidateEmail && (
                  <div className="mt-3"><Notice tone="amber">This referral has no email for the referred person, so it cannot be converted yet. Add it with "Edit details".</Notice></div>
                )}
                <div className="mt-4"><Button variant="primary" onClick={convert} disabled={working || !referral.candidateEmail}>{busy === 'convert' ? 'Converting' : 'Convert to candidate'}</Button></div>
              </>
            )}
            {!converted && !canConvert && <p className="text-sm text-text-dim leading-relaxed">Not converted. Your role cannot convert referrals.</p>}
          </Panel>

          <Panel title="Resume">
            {referral.resume ? (
              <>
                <p className="break-all text-sm font-semibold">{referral.resume.fileName}</p>
                <p className="mt-1 text-xs text-text-dim">{formatBytes(referral.resume.size)}, uploaded {formatDateTime(referral.resume.uploadedAt)}</p>
                {can('resumes:read') ? (
                  <>
                    <div className="mt-4"><DocumentButton label="Open resume" request={() => referralsApi.resumeUrl(id)} /></div>
                    <p className="mt-3 text-xs text-text-dim leading-relaxed">The link expires shortly after it is issued and each access is recorded.</p>
                  </>
                ) : <p className="mt-3 text-xs text-text-dim leading-relaxed">Your role cannot open resumes.</p>}
              </>
            ) : <p className="text-sm text-text-dim">No resume was sent with this referral.</p>}
          </Panel>

          {can('referrals:delete') && (
            <Panel title="Delete referral">
              <p className="mb-4 text-xs text-text-dim leading-relaxed">Removes this referral permanently. A candidate created from it is not affected.</p>
              <Button variant="danger" onClick={destroy} disabled={working}>{busy === 'delete' ? 'Deleting' : 'Delete referral'}</Button>
            </Panel>
          )}
        </div>
      </div>

      {editing && (
        <EditDrawer
          collection="referrals"
          record={referral}
          title={`Edit ${referral.candidateName}`}
          saveLabel="Save details"
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            setNote({ tone: 'teal', text: 'Saved the details.' });
          }}
        />
      )}
    </>
  );
}
