import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { atsApi } from '../../lib/api/index.js';
import { useAdminStore } from '../store.jsx';
import { useAuth } from '../auth.jsx';
import { PageHeader, Panel, StageTrace, Badge, Button, DataTable, EmptyState, Notice } from '../components/ui.jsx';
import { ATS_STAGES, ATS_STAGE_COLUMNS } from '../data/atsStages.js';
import { ATS_REVIEW_STATES, label } from '../data/enums.js';
import { formatDate } from '../lib/format.js';
import { AtsScopeNotice } from '../components/AiComparison.jsx';

/*
  AtsOverview - how a result is produced, every evaluation so far, and
  the applications still waiting for one.

  Every score and check listed here is rule based: deterministic
  checks of the candidate's profile against the job. Nothing on this
  screen is produced by an AI model. The optional AI comparison is
  started and read on the result screen only; the notice at the top
  says whether the server has it connected.
*/
export default function AtsOverview() {
  const { state, status, errors, reload, put } = useAdminStore();
  const { can } = useAuth();
  const navigate = useNavigate();
  const [review, setReview] = useState('');
  const [running, setRunning] = useState('');
  const [runError, setRunError] = useState('');
  const { atsResults, candidates, jobs, applications } = state;

  const nameOf = (id) => candidates.find((c) => c.id === id)?.name || 'Removed candidate';
  const jobOf = (id) => jobs.find((j) => j.id === id)?.title || 'Removed job';

  const rows = atsResults
    .filter((r) => !review || r.review.state === review)
    .sort((a, b) => (a.runAt < b.runAt ? 1 : -1));
  // A general application has no job to be compared with.
  const waiting = applications.filter((a) => a.jobId && !atsResults.some((r) => r.candidateId === a.candidateId && r.jobId === a.jobId));
  const stages = ATS_STAGES.map((stage, i) => ({ ...stage, state: i === ATS_STAGES.length - 1 ? 'current' : 'done' }));

  async function run(application) {
    setRunning(application.id);
    setRunError('');
    try {
      const result = await atsApi.run({ applicationId: application.id });
      put('atsResults', result);
      navigate(`/admin/ats/${result.candidateId}?job=${result.jobId}`);
    } catch (failure) {
      setRunError(failure.message);
      setRunning('');
    }
  }

  let evaluations;
  if (status.atsResults === 'loading') {
    evaluations = <div role="status"><EmptyState title="Loading evaluations">Reading the results from the database.</EmptyState></div>;
  } else if (status.atsResults === 'error') {
    evaluations = (
      <div role="alert">
        <EmptyState title="The evaluations could not be loaded">{errors.atsResults}</EmptyState>
        <div className="flex justify-center pb-6"><Button onClick={() => reload('atsResults')}>Try again</Button></div>
      </div>
    );
  } else {
    evaluations = (
      <DataTable
        rows={rows}
        onRowClick={(r) => navigate(`/admin/ats/${r.candidateId}?job=${r.jobId}`)}
        empty={atsResults.length === 0 ? <EmptyState title="No evaluations yet">A result appears here when an application is evaluated against its job.</EmptyState> : undefined}
        columns={[
          { key: 'candidate', label: 'Candidate', render: (r) => (
            <span className="block min-w-[11rem]">
              <span className="block font-semibold">{nameOf(r.candidateId)}</span>
              <span className="block text-xs text-text-dim">{jobOf(r.jobId)}</span>
            </span>
          ) },
          { key: 'total', label: 'Score', render: (r) => (
            <span className="flex items-center gap-3">
              <span className="font-display text-lg font-semibold tabular-nums w-8">{r.totalScore}</span>
              <Badge>{r.band}</Badge>
            </span>
          ) },
          { key: 'skills', label: 'Required skills', render: (r) => <span className="text-text-dim tabular-nums whitespace-nowrap">{r.matchedSkills.length} of {r.requiredSkills.length} matched</span> },
          { key: 'flags', label: 'Checks to look at', render: (r) => {
            const flags = r.checks.filter((c) => c.result === 'review' || c.result === 'fail').length;
            return <span className={`tabular-nums ${flags ? 'text-[#e8b65a]' : 'text-text-dim'}`}>{flags ? `${flags} to check` : 'None'}</span>;
          } },
          { key: 'review', label: 'Recruiter review', render: (r) => <Badge>{label(r.review.state)}</Badge> },
          { key: 'run', label: 'Evaluated', render: (r) => <span className="whitespace-nowrap text-text-dim">{formatDate(r.runAt)}</span> },
        ]}
      />
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="Recruitment / Rule-based ATS"
        title="ATS results"
        description="Each evaluation compares a candidate's profile with one job, using fixed rules. The same inputs always give the same score, and every score can be traced to the checks behind it."
      />

      <div className="mb-6">
        <AtsScopeNotice />
      </div>

      <Panel title="How a result is produced" meta="RULE-BASED ATS">
        <StageTrace stages={stages} columns={ATS_STAGE_COLUMNS} />
        <div className="mt-8 grid gap-5 border-t border-line pt-5 md:grid-cols-3">
          <div>
            <p className="text-sm font-semibold">The profile comes from the form</p>
            <p className="mt-1 text-sm text-text-dim leading-relaxed">Skills, experience, domain and location are what the candidate entered when applying. The resume file is stored privately for a recruiter to read.</p>
          </div>
          <div>
            <p className="text-sm font-semibold">Rules give the score</p>
            <p className="mt-1 text-sm text-text-dim leading-relaxed">Required and preferred skills are matched by name, experience by the job level, then domain, location and how complete the profile is. Each part has a fixed weight.</p>
          </div>
          <div>
            <p className="text-sm font-semibold">A recruiter decides</p>
            <p className="mt-1 text-sm text-text-dim leading-relaxed">Every result waits for a named person's review: advance, hold or reject, with a note.</p>
          </div>
        </div>
      </Panel>

      <Panel
        className="mt-6"
        title="Evaluations"
        meta={`${rows.length} shown`}
        pad={false}
        action={(
          <label className="flex items-center gap-2 text-xs text-text-dim">
            <span className="font-mono uppercase tracking-[0.12em]">Review</span>
            <select value={review} onChange={(e) => setReview(e.target.value)} className="bg-bg border border-line-strong px-2 py-1.5 text-sm text-text focus:outline-none focus:border-accent">
              <option value="">All</option>
              {ATS_REVIEW_STATES.map((s) => <option key={s} value={s}>{label(s)}</option>)}
            </select>
          </label>
        )}
      >
        {evaluations}
      </Panel>

      {can('applications:read') && (
        <Panel className="mt-6" title="Waiting for evaluation" meta="Applications for a job with no ATS result yet" pad={false}>
          {runError && <div className="border-b border-line p-4 md:p-5" role="alert"><Notice tone="red">{runError}</Notice></div>}
          {waiting.length === 0 ? <EmptyState title="Every application for a job has been evaluated" /> : (
            <ul className="divide-y divide-line">
              {waiting.map((a) => (
                <li key={a.id} className="flex flex-wrap items-center gap-3 px-4 py-3 md:px-5">
                  <div className="min-w-0 flex-1">
                    <Link to={`/admin/candidates/${a.candidateId}`} className="text-sm font-semibold hover:text-accent transition-colors">{nameOf(a.candidateId)}</Link>
                    <p className="text-xs text-text-dim">{jobOf(a.jobId)}, applied {formatDate(a.submittedAt)}</p>
                  </div>
                  <Badge>Not evaluated</Badge>
                  {can('ats:run') && (
                    <Button size="sm" onClick={() => run(a)} disabled={Boolean(running)}>{running === a.id ? 'Evaluating' : 'Run evaluation'}</Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Panel>
      )}
    </>
  );
}
