import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { jobsApi } from '../../lib/api/index.js';
import { useAdminStore } from '../store.jsx';
import { useAuth } from '../auth.jsx';
import { Panel, Badge, Button, DataTable, EmptyState, Notice } from './ui.jsx';
import { label } from '../data/enums.js';
import { formatDate } from '../lib/format.js';

/*
  JobRanking - the candidates of one job in the order of their
  rule-based ATS score (GET /jobs/:id/ranking). The order is the
  server's: total score, then the required-skills score, then the
  candidate's name. Applications to the job without a result yet are
  listed apart, unranked. A row opens the candidate.

  The rows carry the candidate fields the recruiter screens already
  show; never a resume, a storage key or resume text.
*/
export default function JobRanking() {
  const { state } = useAdminStore();
  const { can } = useAuth();
  const navigate = useNavigate();
  const allowed = can('ats:read') && can('candidates:read');
  // Jobs that have something to rank: an evaluation or an application.
  const jobs = state.jobs.filter((job) => state.atsResults.some((r) => r.jobId === job.id) || state.applications.some((a) => a.jobId === job.id));
  const [jobId, setJobId] = useState('');
  const [view, setView] = useState({ status: 'idle', data: null, message: '' });
  const selected = jobId || jobs[0]?.id || '';

  const load = useCallback(async (id) => {
    if (!id) return;
    setView((current) => ({ ...current, status: 'loading', message: '' }));
    try {
      setView({ status: 'ready', data: await jobsApi.ranking(id), message: '' });
    } catch (failure) {
      setView({ status: 'error', data: null, message: failure.message });
    }
  }, []);

  useEffect(() => { if (allowed) load(selected); }, [allowed, load, selected]);

  if (!allowed) return null;

  let body;
  if (!selected) {
    body = <EmptyState title="No job to rank yet">A job appears here once someone has applied to it or been evaluated against it.</EmptyState>;
  } else if (view.status === 'error') {
    body = (
      <div role="alert" className="p-4 md:p-5">
        <Notice tone="red">{view.message}</Notice>
        <div className="mt-3"><Button size="sm" onClick={() => load(selected)}>Try again</Button></div>
      </div>
    );
  } else if (!view.data || (view.status === 'loading' && view.data.job.id !== selected)) {
    body = <div role="status"><EmptyState title="Loading the ranking" /></div>;
  } else {
    const { ranking, unranked } = view.data;
    body = (
      <>
        <p className="border-b border-line px-4 py-2 font-mono text-[0.62rem] uppercase tracking-[0.14em] text-text-dim md:px-5">Ranked candidates ({ranking.length})</p>
        <DataTable
          rows={ranking.map((row) => ({ ...row, id: row.resultId }))}
          onRowClick={(row) => navigate(`/admin/candidates/${row.candidate.id}`)}
          empty={<EmptyState title="No candidate has been evaluated for this job yet" />}
          columns={[
            { key: 'rank', label: 'Rank', render: (row) => <span className="font-display text-lg font-semibold tabular-nums">{row.rank}</span> },
            { key: 'candidate', label: 'Candidate', render: (row) => (
              <span className="block min-w-[11rem]">
                <span className="block font-semibold">{row.candidate.name}</span>
                <span className="block text-xs text-text-dim">{row.candidate.headline || 'No current role stated'}</span>
              </span>
            ) },
            { key: 'score', label: 'Score', render: (row) => <span className="font-display text-lg font-semibold tabular-nums">{row.totalScore}</span> },
            { key: 'band', label: 'Band', render: (row) => <Badge>{row.band}</Badge> },
            { key: 'required', label: 'Required skills', render: (row) => <span className="whitespace-nowrap tabular-nums text-text-dim">{row.requiredSkills ? `${row.matchedSkills} of ${row.requiredSkills}` : 'None listed'}</span> },
            { key: 'missing', label: 'Missing', render: (row) => <span className={`tabular-nums ${row.missingSkills ? 'text-warn' : 'text-text-dim'}`}>{row.missingSkills}</span> },
            { key: 'experience', label: 'Experience', render: (row) => <span className="whitespace-nowrap text-text-dim">{row.candidate.experienceYears === null || row.candidate.experienceYears === undefined ? 'Not stated' : `${row.candidate.experienceYears} years`}</span> },
            { key: 'review', label: 'Review', render: (row) => (
              <span className="flex flex-wrap items-center gap-1.5">
                <Badge>{label(row.review.state)}</Badge>
                {row.review.stale && <Badge tone="amber">Outdated</Badge>}
              </span>
            ) },
          ]}
        />
        <div className="border-t border-line">
          <p className="px-4 py-2 font-mono text-[0.62rem] uppercase tracking-[0.14em] text-text-dim md:px-5">Applications without ATS results ({unranked.length})</p>
          {unranked.length === 0 ? <p className="px-4 pb-4 text-sm text-text-dim md:px-5">None.</p> : (
            <ul className="divide-y divide-line">
              {unranked.map((row) => (
                <li key={row.candidate.id} className="flex flex-wrap items-center gap-3 px-4 py-3 md:px-5">
                  <Link to={`/admin/candidates/${row.candidate.id}`} className="text-sm font-semibold hover:text-accent transition-colors">{row.candidate.name}</Link>
                  <span className="text-xs text-text-dim">{row.application ? `Applied ${formatDate(row.application.submittedAt)}` : ''}</span>
                  <Badge>Not evaluated</Badge>
                </li>
              ))}
            </ul>
          )}
        </div>
      </>
    );
  }

  return (
    <Panel
      title="Candidate ranking by job"
      meta={view.data?.order || 'Rule-based score, highest first.'}
      pad={false}
      action={jobs.length > 0 && (
        <label className="flex items-center gap-2 text-xs text-text-dim">
          <span className="font-mono uppercase tracking-[0.12em]">Job</span>
          <select value={selected} onChange={(e) => setJobId(e.target.value)} className="max-w-[14rem] bg-bg border border-line-strong px-2 py-1.5 text-sm text-text focus:outline-none focus:border-accent">
            {jobs.map((job) => <option key={job.id} value={job.id}>{job.title}</option>)}
          </select>
        </label>
      )}
    >
      {body}
    </Panel>
  );
}
