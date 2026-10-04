import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAdminStore } from '../store.jsx';
import { PageHeader, Panel, StageTrace, Badge, DataTable, EmptyState } from '../components/ui.jsx';
import { ATS_STAGES } from '../data/atsStages.js';
import { REVIEW_STATES } from '../data/recruitment.js';
import { formatDate } from '../lib/format.js';

/*
  AtsOverview - how a result is produced, every evaluation so far, and
  the applications still waiting for one.
*/
export default function AtsOverview() {
  const { state } = useAdminStore();
  const navigate = useNavigate();
  const [review, setReview] = useState('');
  const { atsResults, candidates, jobs, applications } = state;

  const nameOf = (id) => candidates.find((c) => c.id === id)?.name || 'Removed candidate';
  const jobOf = (id) => jobs.find((j) => j.id === id)?.title || 'Removed job';

  const rows = atsResults
    .filter((r) => !review || r.review.state === review)
    .sort((a, b) => (a.runAt < b.runAt ? 1 : -1));
  const waiting = applications.filter((a) => !atsResults.some((r) => r.candidateId === a.candidateId && r.jobId === a.jobId));
  const stages = ATS_STAGES.map((stage, i) => ({ ...stage, state: i === ATS_STAGES.length - 1 ? 'current' : 'done' }));

  return (
    <>
      <PageHeader
        eyebrow="Recruitment"
        title="ATS results"
        description="Every evaluation runs the same eight stages. A match score supports a recruiter's decision. It never makes the decision. The results here are samples: the AI service is connected in the backend phase."
      />

      <Panel title="How a result is produced">
        <StageTrace stages={stages} />
        <div className="mt-8 grid gap-5 border-t border-line pt-5 md:grid-cols-3">
          <div>
            <p className="text-sm font-semibold">Rules run first</p>
            <p className="mt-1 text-sm text-text-dim leading-relaxed">Required skills, experience level and location are checked exactly, with the same result every time.</p>
          </div>
          <div>
            <p className="text-sm font-semibold">AI reads for meaning</p>
            <p className="mt-1 text-sm text-text-dim leading-relaxed">The comparison catches what exact matching misses, and explains each conclusion with evidence from the resume.</p>
          </div>
          <div>
            <p className="text-sm font-semibold">A recruiter decides</p>
            <p className="mt-1 text-sm text-text-dim leading-relaxed">No candidate is advanced or rejected by a score. Every result waits for a named person's review.</p>
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
              {REVIEW_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
        )}
      >
        <DataTable
          rows={rows}
          onRowClick={(r) => navigate(`/admin/ats/${r.candidateId}?job=${r.jobId}`)}
          columns={[
            { key: 'candidate', label: 'Candidate', render: (r) => (
              <span className="block min-w-[11rem]">
                <span className="block font-semibold">{nameOf(r.candidateId)}</span>
                <span className="block text-xs text-text-dim">{jobOf(r.jobId)}</span>
              </span>
            ) },
            { key: 'overall', label: 'Overall match', render: (r) => (
              <span className="flex items-center gap-3">
                <span className="font-display text-lg font-semibold tabular-nums w-8">{r.overall}</span>
                <Badge>{r.band}</Badge>
              </span>
            ) },
            { key: 'skills', label: 'Required skills', render: (r) => <span className="text-text-dim tabular-nums whitespace-nowrap">{r.matchedSkills.length} of {r.requiredSkills.length} matched</span> },
            { key: 'flags', label: 'Rule flags', render: (r) => {
              const flags = r.ruleChecks.filter((c) => c.result !== 'pass').length;
              return <span className={`tabular-nums ${flags ? 'text-[#e8b65a]' : 'text-text-dim'}`}>{flags ? `${flags} to check` : 'None'}</span>;
            } },
            { key: 'review', label: 'Recruiter review', render: (r) => <Badge>{r.review.state}</Badge> },
            { key: 'run', label: 'Evaluated', render: (r) => <span className="whitespace-nowrap text-text-dim">{formatDate(r.runAt)}</span> },
          ]}
        />
      </Panel>

      <Panel className="mt-6" title="Waiting for evaluation" meta="Applications with no ATS result yet" pad={false}>
        {waiting.length === 0 ? <EmptyState title="Every application has been evaluated" /> : (
          <ul className="divide-y divide-line">
            {waiting.map((a) => (
              <li key={a.id} className="flex items-center gap-3 px-4 py-3 md:px-5">
                <div className="min-w-0 flex-1">
                  <Link to={`/admin/candidates/${a.candidateId}`} className="text-sm font-semibold hover:text-accent transition-colors">{nameOf(a.candidateId)}</Link>
                  <p className="text-xs text-text-dim">{jobOf(a.jobId)}, applied {formatDate(a.submittedAt)}</p>
                </div>
                <Badge>Not evaluated</Badge>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </>
  );
}
