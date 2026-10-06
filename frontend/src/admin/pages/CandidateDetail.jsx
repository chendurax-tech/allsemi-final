import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { candidatesApi } from '../../lib/api/index.js';
import { useAdminStore } from '../store.jsx';
import { useAuth } from '../auth.jsx';
import { label } from '../data/enums.js';
import { PageHeader, Panel, Badge, Button, Chip, EmptyState, DefinitionList, Notice } from '../components/ui.jsx';
import EditDrawer from '../components/EditDrawer.jsx';
import LabelPicker, { LabelChips } from '../components/LabelPicker.jsx';
import ApplicationActions from '../components/ApplicationActions.jsx';
import { useConfirm } from '../components/Feedback.jsx';
import DocumentButton from '../components/DocumentButton.jsx';
import Notes from '../components/Notes.jsx';
import { formatDate, formatDateTime, formatBytes } from '../lib/format.js';

/*
  CandidateDetail - one candidate: the profile the application form
  collected, the labels, recruiter notes, the resume, the applications
  (each with its shortlist action), the ATS results and the audit
  history of the record.

  A candidate has no status of their own. The one workflow step,
  shortlisting, belongs to an application and is done from the
  Applications panel. Labels are tags only.

  The screen reads its own copy from the API (the candidate with
  everything linked to it), because the history and the applications
  as the server has them are not part of the candidate list.

  The resume is a private document. "Open resume" asks the backend for
  a signed link each time; the backend only issues it to a role with
  resumes:read, records the access and lets the link expire.
*/

const stated = (value) => (value === '' || value === null || value === undefined ? 'Not stated' : value);

export default function CandidateDetail({ id }) {
  const { state, remove, put } = useAdminStore();
  const { can } = useAuth();
  const navigate = useNavigate();
  const ask = useConfirm();
  const [detail, setDetail] = useState(null);
  const [load, setLoad] = useState({ status: 'loading', message: '' });
  const [labelsBusy, setLabelsBusy] = useState(false);
  const [labelsNote, setLabelsNote] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [editing, setEditing] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);

  const read = useCallback(async () => {
    try {
      setDetail(await candidatesApi.detail(id));
      setLoad({ status: 'ready', message: '' });
    } catch (failure) {
      setLoad({ status: failure.status === 404 || failure.status === 400 ? 'missing' : 'error', message: failure.message });
    }
  }, [id]);

  useEffect(() => { read(); }, [read]);

  const back = <div className="flex justify-center pb-4"><Button to="/admin/candidates">Back to candidates</Button></div>;

  if (load.status === 'loading') {
    return <Panel><div role="status"><EmptyState title="Loading the candidate">Reading the profile from the database.</EmptyState></div></Panel>;
  }
  if (load.status === 'missing') {
    return <Panel><EmptyState title="This candidate was not found">The profile may have been deleted, or the address may be wrong.</EmptyState>{back}</Panel>;
  }
  if (load.status === 'error' && !detail) {
    return (
      <Panel>
        <div role="alert"><EmptyState title="The candidate could not be loaded">{load.message}</EmptyState></div>
        <div className="flex justify-center pb-4"><Button onClick={() => { setLoad({ status: 'loading', message: '' }); read(); }}>Try again</Button></div>
      </Panel>
    );
  }

  const { candidate, applications, atsResults, history } = detail;
  const canWrite = can('candidates:write');
  const jobOf = (jobId) => {
    if (!jobId) return 'General application';
    return state.jobs.find((j) => j.id === jobId)?.title || 'Removed job';
  };

  async function changeLabels(next) {
    setLabelsBusy(true);
    setLabelsNote(null);
    try {
      // The whole set is sent every time. The copy of this candidate in
      // the list may be older than this page, so it is not used to decide
      // whether anything changed.
      const saved = await candidatesApi.update(id, { labels: next });
      put('candidates', saved);
      setDetail((current) => ({ ...current, candidate: saved }));
      setLabelsNote({ tone: 'teal', text: 'Saved the labels.' });
      read(); // the change is now in the history
    } catch (failure) {
      setLabelsNote({ tone: 'red', text: failure.message });
    }
    setLabelsBusy(false);
  }

  async function addNote(text) {
    const saved = await candidatesApi.addNote(id, text);
    put('candidates', saved);
    setDetail((current) => ({ ...current, candidate: saved }));
    read();
  }

  // The access is audited, so the history is read again once the link
  // has been issued.
  async function openResume() {
    const link = await candidatesApi.resumeUrl(id);
    read();
    return link;
  }

  async function destroy() {
    const agreed = await ask({
      title: 'Delete candidate?',
      message: `This will permanently remove the candidate and related recruitment records: the profile of ${candidate.name}, every application, every ATS result and the stored resumes. This cannot be undone.`,
      confirmLabel: 'Delete',
      tone: 'danger',
    });
    if (!agreed) return;
    setDeleting(true);
    setDeleteError('');
    try {
      await remove('candidates', id);
      navigate('/admin/candidates', { state: { notice: 'Deleted candidate.' } });
    } catch (failure) {
      setDeleteError(failure.message);
      setDeleting(false);
    }
  }

  const profileUrl = /^https?:\/\//i.test(candidate.profileUrl || '') ? candidate.profileUrl : '';
  const hasYears = candidate.experienceYears !== null && candidate.experienceYears !== undefined;

  return (
    <>
      <PageHeader
        eyebrow="Recruitment / Candidates"
        title={candidate.name}
        description={[candidate.headline, candidate.location].filter(Boolean).join(', ')}
        actions={(
          <>
            <Button variant="ghost" to="/admin/candidates">Back to candidates</Button>
            {can('ats:read') && <Button variant="primary" to={`/admin/ats/${id}`}>Open ATS results</Button>}
          </>
        )}
      />

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-6 min-w-0">
          <Panel
            title="Profile"
            meta="The details given with the application or referral."
            action={canWrite ? <Button size="sm" className="shrink-0" onClick={() => { setProfileSaved(false); setEditing(true); }}>Edit profile</Button> : null}
          >
            {profileSaved && <div className="mb-5" role="status"><Notice tone="teal">Saved candidate.</Notice></div>}
            {candidate.summary && <p className="mb-5 whitespace-pre-line text-sm leading-relaxed">{candidate.summary}</p>}
            <DefinitionList
              items={[
                ['Current role', stated(candidate.headline)],
                ['Domain', stated(candidate.domain)],
                ['Experience', hasYears ? `${candidate.experienceYears} years` : 'Not stated'],
                ['Location', stated(candidate.location)],
                ['Preferred location', stated(candidate.preferredLocation)],
                ['Notice period', stated(candidate.noticePeriod)],
                ['Expected compensation', stated(candidate.expectedCompensation)],
                ['Profile link', profileUrl
                  ? <a key="link" href={profileUrl} target="_blank" rel="noopener noreferrer" className="text-accent hover:text-accent-2 transition-colors">{profileUrl}</a>
                  : stated(candidate.profileUrl)],
                ['Email', candidate.email],
                ['Phone', stated(candidate.phone)],
                ['Source', label(candidate.source)],
                ['Added', formatDate(candidate.createdAt)],
              ]}
            />
          </Panel>

          <Panel title="Skills" meta={`${candidate.skills.length} listed`}>
            {candidate.skills.length === 0 ? <p className="text-sm text-text-dim">No skills were listed.</p> : (
              <div className="flex flex-wrap gap-2">
                {candidate.skills.map((skill) => <Chip key={skill} tone="blue">{skill}</Chip>)}
              </div>
            )}
          </Panel>

          {(candidate.experience || []).length > 0 && (
            <Panel title="Work history">
              <ol className="space-y-5">
                {candidate.experience.map((role) => (
                  <li key={`${role.title}-${role.period}`} className="border-l border-line-strong pl-4">
                    <p className="text-sm font-semibold">{role.title}</p>
                    <p className="text-xs text-text-dim">{[role.employer, role.period].filter(Boolean).join(', ')}</p>
                    <ul className="mt-2 space-y-1">
                      {(role.highlights || []).map((h) => <li key={h} className="text-sm text-text-dim leading-relaxed">{h}</li>)}
                    </ul>
                  </li>
                ))}
              </ol>
            </Panel>
          )}

          {(candidate.education || []).length > 0 && (
            <Panel title="Education">
              <ul className="space-y-3">
                {candidate.education.map((e) => (
                  <li key={`${e.degree}-${e.year}`}>
                    <p className="text-sm font-semibold">{e.degree}</p>
                    <p className="text-xs text-text-dim">{[e.institution, e.year].filter(Boolean).join(', ')}</p>
                  </li>
                ))}
              </ul>
            </Panel>
          )}

          <Panel title="Notes" meta="Seen by the recruitment team only">
            <Notes id="candidate-note" notes={candidate.notes} canAdd={canWrite} onAdd={addNote} />
          </Panel>

          <Panel title="History" meta="Changes to this record and each time its resume was opened">
            {history.length === 0 ? <p className="text-sm text-text-dim">Nothing has been recorded for this candidate yet.</p> : (
              <ol className="space-y-4">
                {history.map((entry) => (
                  <li key={entry.id} className="border-l border-line-strong pl-4">
                    <p className="text-sm">{entry.summary || entry.action}</p>
                    <p className="mt-0.5 text-xs text-text-dim">{entry.actorName}, {formatDateTime(entry.at)}</p>
                  </li>
                ))}
              </ol>
            )}
          </Panel>
        </div>

        <div className="space-y-6 min-w-0">
          <Panel title="Labels">
            <LabelPicker id="candidate-labels" value={candidate.labels} disabled={!canWrite} busy={labelsBusy} onChange={changeLabels} />
            <p className="mt-3 text-xs text-text-dim leading-relaxed">
              {canWrite
                ? 'Saved as soon as you choose. Labels are tags for finding and filtering candidates. They change no status and send nothing. To move a candidate forward, shortlist an application below.'
                : 'Your role can view this candidate but cannot change the labels.'}
            </p>
            {labelsNote && <div className="mt-3" role={labelsNote.tone === 'red' ? 'alert' : 'status'}><Notice tone={labelsNote.tone}>{labelsNote.text}</Notice></div>}
          </Panel>

          <Panel title="Resume">
            {candidate.resume ? (
              <>
                <p className="break-all text-sm font-semibold">{candidate.resume.fileName}</p>
                <p className="mt-1 text-xs text-text-dim">{formatBytes(candidate.resume.size)}, uploaded {formatDateTime(candidate.resume.uploadedAt)}</p>
                {can('resumes:read') ? (
                  <>
                    <div className="mt-4"><DocumentButton label="Open resume" request={openResume} /></div>
                    <p className="mt-3 text-xs text-text-dim leading-relaxed">
                      Resumes are kept in private storage. Opening one creates a link that expires shortly afterwards, and each access is recorded in the history.
                    </p>
                  </>
                ) : <p className="mt-3 text-xs text-text-dim leading-relaxed">Your role cannot open resumes.</p>}
              </>
            ) : <p className="text-sm text-text-dim">No resume is stored for this candidate.</p>}
          </Panel>

          <Panel title="Applications" meta={`${applications.length} total`} pad={false}>
            {applications.length === 0 ? <EmptyState title="No applications" /> : (
              <ul className="divide-y divide-line">
                {applications.map((a) => (
                  <li key={a.id} className="px-4 py-4 md:px-5">
                    <p className="text-sm font-semibold">{jobOf(a.jobId)}</p>
                    <p className="mt-0.5 text-xs text-text-dim">{label(a.source)}, {formatDate(a.submittedAt)}</p>
                    {(a.labels || []).length > 0 && <div className="mt-2"><LabelChips value={a.labels} /></div>}
                    <div className="mt-3"><ApplicationActions item={a} onChanged={read} /></div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          {can('ats:read') && (
            <Panel title="ATS results" meta={`${atsResults.length} rule-based ${atsResults.length === 1 ? 'evaluation' : 'evaluations'}`} pad={false}>
              {atsResults.length === 0 ? <EmptyState title="Not evaluated yet">An evaluation compares this profile with the job of an application.</EmptyState> : (
                <ul className="divide-y divide-line">
                  {atsResults.map((r) => (
                    <li key={r.id}>
                      <Link to={`/admin/ats/${id}?job=${r.jobId}`} className="flex items-center gap-3 px-4 py-3 md:px-5 hover:bg-accent/[0.06] transition-colors">
                        <span className="font-display text-xl font-semibold tabular-nums w-9">{r.totalScore}</span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold">{jobOf(r.jobId)}</span>
                          <span className="block text-xs text-text-dim">Review: {label(r.review.state)}</span>
                        </span>
                        <Badge>{r.band}</Badge>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          )}

          {can('candidates:delete') && (
            <Panel title="Delete candidate">
              <Notice tone="red">Removes the profile, every application, every ATS result and the stored resumes for this person.</Notice>
              {deleteError && <div className="mt-3" role="alert"><Notice tone="red">{deleteError}</Notice></div>}
              <div className="mt-4"><Button variant="danger" onClick={destroy} disabled={deleting}>{deleting ? 'Deleting' : 'Delete candidate'}</Button></div>
            </Panel>
          )}
        </div>
      </div>

      {editing && (
        <EditDrawer
          collection="candidates"
          record={candidate}
          title={`Edit ${candidate.name}`}
          saveLabel="Save candidate"
          onClose={() => setEditing(false)}
          onSaved={(saved) => {
            setDetail((current) => ({ ...current, candidate: saved }));
            setEditing(false);
            setProfileSaved(true);
            read(); // the change is now in the history
          }}
        />
      )}
    </>
  );
}
