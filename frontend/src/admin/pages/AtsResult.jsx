import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { atsApi } from '../../lib/api/index.js';
import { useAdminStore } from '../store.jsx';
import { useAuth } from '../auth.jsx';
import {
  PageHeader, Panel, StageTrace, ScoreRing, Badge, Button, EmptyState, DefinitionList, Notice, cx, inputCls, labelCls,
} from '../components/ui.jsx';
import { ATS_STAGES, ATS_STAGE_COLUMNS } from '../data/atsStages.js';
import { ATS_REVIEW_STATES, label } from '../data/enums.js';
import { formatDate, formatDateTime } from '../lib/format.js';
import ShortlistPanel from '../components/ShortlistPanel.jsx';
import AiComparison, { AtsScopeNotice } from '../components/AiComparison.jsx';
import MatchIntelligence, { StaleReview } from '../components/MatchIntelligence.jsx';

/*
  AtsResult - one candidate's rule-based evaluation against one job.

  The screen follows the pipeline, not a single number: the stage trace
  first, then the score, "Why this candidate matches" (each weighted
  part, its share of the total and the engine's own wording), the skill
  gap, the checks behind each part, and the recruiter's review.

  Everything in those panels is what the rule-based engine stored; the
  explanation and the skill gap are laid out by the server from the
  stored result (components/MatchIntelligence.jsx), so this screen adds
  no reasons of its own. When the result changed after its review was
  saved (the server re-ran it after resume data was approved), the
  review is shown as outdated until a recruiter saves a new one.
  Running an evaluation or saving a review never changes an
  application. The decision to shortlist is a separate action a
  recruiter takes, offered beside the review.

  The AI comparison is a separate panel after all of that
  (components/AiComparison.jsx). It is advice a recruiter asks for with
  a button, it is never requested by this screen on its own, and none
  of its text or numbers are mixed into the rule-based panels.
*/

function ReviewPanel({ result }) {
  const { put } = useAdminStore();
  const { can } = useAuth();
  const [reviewState, setReviewState] = useState(result.review.state);
  const [note, setNote] = useState(result.review.note || '');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);
  const canReview = can('ats:review');

  async function save() {
    setBusy(true);
    setMessage(null);
    try {
      put('atsResults', await atsApi.review(result.id, reviewState, note));
      setMessage({ tone: 'teal', text: 'Saved review.' });
    } catch (failure) {
      setMessage({ tone: 'red', text: failure.fields?.note || failure.message });
    }
    setBusy(false);
  }

  return (
    <Panel title="Recruiter review" meta="The decision belongs to a person">
      <div className="mb-4"><Badge>{label(result.review.state)}</Badge></div>
      {result.review.stale && (
        <div className="mb-4" role="status"><Notice tone="amber">This review was saved before the result changed (score then: {result.review.scoreAtReview ?? 'not recorded'}, now: {result.totalScore}). Save a new review to replace it.</Notice></div>
      )}
      {canReview ? (
        <>
          <label htmlFor="review-state" className={labelCls}>Decision</label>
          <select id="review-state" value={reviewState} disabled={busy} onChange={(e) => { setReviewState(e.target.value); setMessage(null); }} className={inputCls}>
            {ATS_REVIEW_STATES.map((s) => <option key={s} value={s}>{label(s)}</option>)}
          </select>
          <label htmlFor="review-note" className={cx(labelCls, 'mt-4')}>Note</label>
          <textarea id="review-note" rows={4} value={note} maxLength={4000} disabled={busy} onChange={(e) => { setNote(e.target.value); setMessage(null); }} className={cx(inputCls, 'resize-y leading-relaxed')} />
          <div className="mt-4"><Button variant="primary" onClick={save} disabled={busy}>{busy ? 'Saving' : 'Save review'}</Button></div>
          {message && <div className="mt-3" role={message.tone === 'red' ? 'alert' : 'status'}><Notice tone={message.tone}>{message.text}</Notice></div>}
        </>
      ) : (
        <>
          {result.review.note && <p className="whitespace-pre-line text-sm leading-relaxed">{result.review.note}</p>}
          <p className="mt-3 text-xs text-text-dim leading-relaxed">Your role can read this review but cannot change it.</p>
        </>
      )}
      {result.review.reviewerName && (
        <p className="mt-4 text-xs text-text-dim">Last reviewed by {result.review.reviewerName}, {formatDateTime(result.review.updatedAt)}</p>
      )}
      <p className="mt-4 border-t border-line pt-4 text-xs text-text-dim leading-relaxed">
        A review is a note on this evaluation. It does not shortlist or reject anyone and sends nothing. Shortlisting the application is the separate step below.
      </p>
    </Panel>
  );
}

const isNumber = (value) => typeof value === 'number' && Number.isFinite(value);

export default function AtsResult({ candidateId }) {
  const { state, status, errors, reload, put } = useAdminStore();
  const { can } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [running, setRunning] = useState('');
  const [runNote, setRunNote] = useState(null);

  const back = <div className="flex justify-center pb-4"><Button to="/admin/ats">Back to ATS results</Button></div>;

  const pending = ['atsResults', 'candidates'].find((name) => status[name] === 'loading');
  const failed = ['atsResults', 'candidates'].find((name) => status[name] === 'error');
  if (pending) {
    return <Panel><div role="status"><EmptyState title="Loading the evaluation">Reading the result from the database.</EmptyState></div></Panel>;
  }
  if (failed) {
    return (
      <Panel>
        <div role="alert"><EmptyState title="The evaluation could not be loaded">{errors[failed]}</EmptyState></div>
        <div className="flex justify-center pb-4"><Button onClick={() => reload(failed)}>Try again</Button></div>
      </Panel>
    );
  }

  const candidate = state.candidates.find((c) => c.id === candidateId);
  const results = state.atsResults.filter((r) => r.candidateId === candidateId);
  const result = results.find((r) => r.jobId === searchParams.get('job')) || results[0];
  const jobOf = (jobId) => state.jobs.find((j) => j.id === jobId)?.title || 'Removed job';
  // The application this evaluation belongs to, when the role may read
  // applications. If the candidate applied to the job more than once,
  // the one the evaluation was run for.
  const application = result && can('applications:read')
    ? state.applications.find((a) => a.id === result.applicationId) || state.applications.find((a) => a.candidateId === candidateId && a.jobId === result.jobId)
    : null;

  if (!candidate) {
    return <Panel><EmptyState title="This candidate was not found">The profile may have been deleted, or the address may be wrong.</EmptyState>{back}</Panel>;
  }

  // target: { applicationId } or { candidateId, jobId }
  async function run(key, target) {
    setRunning(key);
    setRunNote(null);
    try {
      const fresh = await atsApi.run(target);
      put('atsResults', fresh);
      setSearchParams({ job: fresh.jobId }, { replace: true });
      setRunNote({ tone: 'teal', text: `Evaluation finished: ${fresh.totalScore} of 100. The recruiter review was kept as it was.` });
    } catch (failure) {
      setRunNote({ tone: 'red', text: failure.message });
    }
    setRunning('');
  }

  const scope = <AtsScopeNotice />;
  const runMessage = runNote && <div className="mb-5" role={runNote.tone === 'red' ? 'alert' : 'status'}><Notice tone={runNote.tone}>{runNote.text}</Notice></div>;

  if (!result) {
    const stages = ATS_STAGES.map((stage, i) => ({ ...stage, state: i < 2 ? 'done' : 'pending' }));
    const waiting = state.applications.filter((a) => a.candidateId === candidateId && a.jobId);
    return (
      <>
        <PageHeader eyebrow="Recruitment / Rule-based ATS" title={candidate.name} description="No evaluation has run for this candidate yet." actions={<Button variant="ghost" to="/admin/ats">Back to ATS results</Button>} />
        <div className="mb-5">{scope}</div>
        {runMessage}
        <Panel title="Where this candidate is in the pipeline" meta="RULE-BASED ATS">
          <StageTrace stages={stages} columns={ATS_STAGE_COLUMNS} />
          <p className="mt-6 text-sm text-text-dim leading-relaxed">The profile is on record. An evaluation compares it with the job of one application.</p>
          <div className="mt-4"><Button to={`/admin/candidates/${candidateId}`}>Open candidate profile</Button></div>
        </Panel>
        <Panel className="mt-6" title="Applications" meta="Run an evaluation against the job of an application" pad={false}>
          {waiting.length === 0 ? <EmptyState title="No application for a job">A general application has no job to be compared with.</EmptyState> : (
            <ul className="divide-y divide-line">
              {waiting.map((a) => (
                <li key={a.id} className="flex flex-wrap items-center gap-3 px-4 py-3 md:px-5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{jobOf(a.jobId)}</p>
                    <p className="text-xs text-text-dim">Applied {formatDate(a.submittedAt)}</p>
                  </div>
                  <Badge>Not evaluated</Badge>
                  {can('ats:run') && <Button size="sm" onClick={() => run(a.id, { applicationId: a.id })} disabled={Boolean(running)}>{running === a.id ? 'Evaluating' : 'Run evaluation'}</Button>}
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </>
    );
  }

  const reviewed = result.review.state !== 'PENDING';
  const stages = ATS_STAGES.map((stage, i) => {
    if (i < ATS_STAGES.length - 1) return { ...stage, state: 'done' };
    return { ...stage, state: reviewed ? 'done' : 'current' };
  });
  const checks = result.checks || [];

  return (
    <>
      <PageHeader
        eyebrow="Recruitment / Rule-based ATS"
        title={candidate.name}
        description={`Evaluated against ${jobOf(result.jobId)}.`}
        actions={(
          <>
            <Button variant="ghost" to="/admin/ats">Back to ATS results</Button>
            <Button to={`/admin/candidates/${candidateId}`}>Candidate profile</Button>
            {can('ats:run') && (
              <Button onClick={() => run('again', { candidateId, jobId: result.jobId })} disabled={Boolean(running)}>{running ? 'Evaluating' : 'Run evaluation again'}</Button>
            )}
          </>
        )}
      />

      <div className="mb-5">{scope}</div>
      {runMessage}
      {result.review.stale && <div className="mb-5"><StaleReview result={result} /></div>}

      {results.length > 1 && (
        <div className="mb-5 flex flex-wrap gap-2" role="tablist" aria-label="Evaluated jobs">
          {results.map((r) => (
            <button
              key={r.id}
              type="button"
              role="tab"
              aria-selected={r.id === result.id}
              onClick={() => { setSearchParams({ job: r.jobId }); setRunNote(null); }}
              className={cx(
                'border px-3 py-2 text-sm transition-colors focus:outline-none focus-visible:border-accent',
                r.id === result.id ? 'border-accent bg-accent/10 text-text font-semibold' : 'border-line-strong text-text-dim hover:text-text',
              )}
            >
              {jobOf(r.jobId)} <span className="ml-2 tabular-nums text-text-dim">{r.totalScore}</span>
            </button>
          ))}
        </div>
      )}

      <Panel title="Pipeline" meta={reviewed ? 'RULE-BASED ATS. Every stage is complete.' : 'RULE-BASED ATS. Scored and waiting for a recruiter.'}>
        <StageTrace stages={stages} columns={ATS_STAGE_COLUMNS} />
      </Panel>

      <div className="mt-6 grid items-start gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
        <div className="space-y-6 min-w-0">
          <Panel title="Total score">
            <div className="flex flex-col items-center text-center">
              <ScoreRing value={result.totalScore} caption="of 100" />
              <div className="mt-4"><Badge>{result.band}</Badge></div>
            </div>
            <div className="mt-5 border-t border-line pt-4">
              <DefinitionList
                items={[
                  ['Engine', `Rule based, version ${result.engineVersion}`],
                  ['Evaluated', formatDateTime(result.runAt)],
                  ['Run by', result.runByName || 'Not recorded'],
                ]}
              />
            </div>
          </Panel>

          <ReviewPanel key={result.id} result={result} />

          {application && (
            <Panel title="Application" meta={`Submitted ${formatDate(application.submittedAt)}`}>
              <ShortlistPanel key={application.id} item={application} />
            </Panel>
          )}
        </div>

        <div className="space-y-6 min-w-0">
          {/* Why it scored as it did, and the skill gaps: laid out by
              the server from this stored result. */}
          <MatchIntelligence result={result} />

          <Panel title="Rule-based checks" meta="Deterministic. The same inputs always give the same result." pad={false}>
            <ul className="divide-y divide-line">
              {checks.map((check) => {
                // A check without a score (education, certifications,
                // notice period and the like) is listed without one.
                let scoreNote = '';
                if (check.weight === 0) scoreNote = 'Not counted for this job';
                else if (isNumber(check.score) && isNumber(check.weight)) scoreNote = `Score ${check.score}, weight ${check.weight}`;
                return (
                  <li key={check.rule} className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:gap-4 md:px-5">
                    <span className="w-44 shrink-0">
                      <span className="block text-sm font-semibold">{check.rule}</span>
                      {scoreNote && <span className="mt-0.5 block font-mono text-[0.6rem] uppercase tracking-[0.12em] text-text-dim">{scoreNote}</span>}
                    </span>
                    <span className="min-w-0 flex-1 break-words text-sm text-text-dim">{check.detail || ''}</span>
                    <span><Badge>{check.result || 'info'}</Badge></span>
                  </li>
                );
              })}
            </ul>
          </Panel>

        </div>
      </div>

      <AiComparison key={result.id} result={result} />
    </>
  );
}
