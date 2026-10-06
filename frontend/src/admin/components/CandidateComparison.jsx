import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { jobsApi } from '../../lib/api/index.js';
import { useAdminStore } from '../store.jsx';
import { useAuth } from '../auth.jsx';
import { Panel, Badge, Button, Notice, EmptyState, cx, inputCls, labelCls } from './ui.jsx';
import { Items } from './AiComparison.jsx';
import { formatDateTime } from '../lib/format.js';
import { aiFailureText, aiFailureCode } from '../lib/aiErrors.js';

/*
  CandidateComparison - the optional AI comparison of several candidates
  of one job, on the ATS results screen.

  A recruiter chooses a job, ticks two to five of its evaluated
  candidates and presses "Compare candidates with AI". The ALLSEMIS
  backend then sends ONE request to the AI provider, with the job (and
  its requirement profile, when it has one) and the candidates under
  the labels "Candidate A", "Candidate B" and so on. Names, email
  addresses, phone numbers and links are not sent. The browser never
  calls an AI provider and holds no key.

  The answer is advice. It changes no application, no candidate, no
  label, no shortlist, no review and no rule-based score, and it
  rejects nobody. The recruiter decides.

  What is requested, and when:
    choosing a job     GET the comparison stored for that job. This
                       reads what the server already has and asks no
                       model anything.
    the button         POST the comparison. Nothing else sends it: not
                       an effect, not a retry after a failure.

  What the model wrote is untrusted text and is shown as plain text.

  Hooks for automated checks: data-candidate-comparison="panel" on the
  root and "result" on a comparison that is shown.
*/

const MIN = 2;
const MAX = 5;

const text = (value) => (typeof value === 'string' ? value.trim() : '');
const termCls = 'font-mono text-[0.62rem] uppercase tracking-[0.14em] text-text-dim';
const linkCls = 'text-text hover:text-accent transition-colors';

function Part({ term, children }) {
  return (
    <div className="min-w-0">
      <dt className={termCls}>{term}</dt>
      <dd className="mt-1.5 text-sm leading-relaxed break-words">{children}</dd>
    </div>
  );
}

function Result({ comparison }) {
  const candidates = Array.isArray(comparison.candidates) ? comparison.candidates : [];
  const requirements = (Array.isArray(comparison.requirements) ? comparison.requirements : [])
    .map((item) => ({ requirement: text(item?.requirement), comparison: text(item?.comparison) }))
    .filter((item) => item.requirement || item.comparison);
  const fit = (value) => (Number.isFinite(value) ? Math.max(0, Math.min(100, Math.round(value))) : null);

  return (
    <div data-candidate-comparison="result">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="lilac">AI comparison, advisory</Badge>
        <span className="text-xs text-text-dim">
          {comparison.comparedByName ? `Asked for by ${comparison.comparedByName}` : 'Asked for by a recruiter'}
          {comparison.comparedAt ? `, ${formatDateTime(comparison.comparedAt)}` : ''}
          {comparison.model ? `. Model: ${comparison.model}` : ''}
        </span>
      </div>
      <p className="mt-2 text-xs leading-relaxed text-text-dim" data-candidate-comparison="basis">
        {comparison.usedRequirementProfile
          ? "Every candidate was compared against this job's requirement profile."
          : 'This job had no requirement profile, so every candidate was compared against the job description and its skill lists.'}
      </p>

      <dl className="mt-5 space-y-5">
        <Part term="Summary"><span className="whitespace-pre-line">{text(comparison.summary) || 'Not given'}</span></Part>
      </dl>

      <ul className="mt-5 grid gap-4 lg:grid-cols-2">
        {candidates.map((entry) => {
          const score = fit(entry.overallFit);
          return (
            <li key={entry.resultId || entry.label} className="min-w-0 border border-line p-4" data-compared-candidate={entry.label}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className={termCls}>{entry.label}</p>
                  <p className="mt-1 break-words text-sm font-semibold">
                    {entry.candidateId
                      ? <Link to={`/admin/candidates/${entry.candidateId}`} className={linkCls}>{entry.candidateName || 'Candidate'}</Link>
                      : (entry.candidateName || 'Candidate')}
                  </p>
                </div>
                <div className="text-right">
                  <p className={termCls}>Overall fit</p>
                  <p className="font-display text-2xl font-semibold tabular-nums">{score === null ? 'Not given' : <>{score}<span className="text-sm text-text-dim"> / 100</span></>}</p>
                </div>
              </div>
              <dl className="mt-4 space-y-4">
                <Part term="How this candidate compares"><span className="whitespace-pre-line">{text(entry.standing) || 'Not given'}</span></Part>
                <Part term="Strengths"><Items value={entry.strengths} /></Part>
                <Part term="Gaps"><Items value={entry.gaps} /></Part>
                <Part term="Transferable skills"><Items value={entry.transferableSkills} /></Part>
                <Part term="Where the AI is uncertain"><Items value={entry.uncertainties} /></Part>
              </dl>
            </li>
          );
        })}
      </ul>

      {requirements.length > 0 && (
        <div className="mt-6 border-t border-line pt-5" data-candidate-comparison="requirements">
          <p className={termCls}>Requirement by requirement</p>
          <ul className="mt-3 space-y-3">
            {requirements.map((item, index) => (
              // The model may repeat a line, so the position is the key.
              <li key={index} className="border-l border-line-strong pl-3 text-sm leading-relaxed">
                <span className="block break-words font-semibold">{item.requirement || 'Requirement not named'}</span>
                <span className="mt-0.5 block break-words text-text-dim">{item.comparison || 'Not given'}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <dl className="mt-6 border-t border-line pt-5">
        <Part term="Points to weigh"><Items value={comparison.considerations} /></Part>
      </dl>
    </div>
  );
}

export default function CandidateComparison() {
  const { state, status, engine, reloadEngine } = useAdminStore();
  const { can } = useAuth();
  const { atsResults, candidates, jobs } = state;
  const canRun = can('ats:run');

  const [jobId, setJobId] = useState('');
  const [chosen, setChosen] = useState([]);
  // The comparison stored for the chosen job: { status, data, message }.
  const [stored, setStored] = useState({ status: 'idle', data: null, message: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  // Checked before the state has had time to update, so a double click
  // cannot send two requests.
  const pending = useRef(false);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);

  // Jobs with at least two evaluated candidates: fewer cannot be compared.
  const countByJob = new Map();
  for (const result of atsResults) countByJob.set(result.jobId, (countByJob.get(result.jobId) || 0) + 1);
  const comparable = jobs.filter((job) => (countByJob.get(job.id) || 0) >= MIN).sort((a, b) => a.title.localeCompare(b.title));
  const job = comparable.find((item) => item.id === jobId) || null;
  const results = job ? atsResults.filter((result) => result.jobId === job.id).sort((a, b) => b.totalScore - a.totalScore) : [];
  const nameOf = (id) => candidates.find((candidate) => candidate.id === id)?.name || 'Removed candidate';
  // A tick only counts while its result is still there.
  const picked = chosen.filter((id) => results.some((result) => result.id === id));

  // Reads the comparison the server already holds for the chosen job.
  // This is a plain read: it sends nothing to an AI provider.
  useEffect(() => {
    if (!jobId) {
      setStored({ status: 'idle', data: null, message: '' });
      return undefined;
    }
    let cancelled = false;
    setStored({ status: 'loading', data: null, message: '' });
    jobsApi.candidateComparison(jobId)
      .then((comparison) => { if (!cancelled) setStored({ status: 'ready', data: comparison || null, message: '' }); })
      .catch((failure) => { if (!cancelled) setStored({ status: 'error', data: null, message: failure.message }); });
    return () => { cancelled = true; };
  }, [jobId]);

  function chooseJob(next) {
    setJobId(next);
    setChosen([]);
    setError(null);
  }

  function toggle(id) {
    setError(null);
    setChosen((current) => {
      if (current.includes(id)) return current.filter((item) => item !== id);
      return current.length >= MAX ? current : [...current, id];
    });
  }

  // Sent by the button and by nothing else.
  async function compare() {
    if (pending.current || !job || picked.length < MIN || picked.length > MAX) return;
    pending.current = true;
    setBusy(true);
    setError(null);
    try {
      const comparison = await jobsApi.compareCandidates(job.id, picked);
      if (alive.current) setStored({ status: 'ready', data: comparison || null, message: '' });
    } catch (failure) {
      if (alive.current) setError(failure);
      // The server says it has no AI connection after all: read its
      // status again so the button is no longer offered.
      if (failure.code === 'AI_NOT_CONFIGURED') reloadEngine();
    }
    pending.current = false;
    if (alive.current) setBusy(false);
  }

  const ai = engine.status === 'ready' ? engine.data?.ai : null;
  const loading = status.atsResults === 'loading' || status.jobs === 'loading';
  const full = picked.length >= MAX;

  // Why the button is or is not offered.
  let action = null;
  if (!canRun) {
    action = <p className="text-xs leading-relaxed text-text-dim" data-candidate-comparison="read-only">Your role can read a comparison but cannot start one.</p>;
  } else if (ai?.available) {
    action = (
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="primary" onClick={compare} disabled={busy || picked.length < MIN} aria-describedby="candidate-comparison-progress">
          {busy ? 'Comparing with AI' : 'Compare candidates with AI'}
        </Button>
        <p className="min-w-0 flex-1 basis-56 text-xs leading-relaxed text-text-dim" data-candidate-comparison="count">
          {picked.length} of {results.length} chosen. Choose {MIN} to {MAX}. One request is sent when you press the button, and it replaces the comparison stored for this job.
        </p>
      </div>
    );
  } else if (ai) {
    action = <p className="break-words text-xs leading-relaxed text-text-dim" data-candidate-comparison="unavailable">Comparing candidates with AI is not available on this server. {typeof ai.reason === 'string' ? ai.reason : ''}</p>;
  } else if (engine.status === 'loading') {
    action = <p className="text-xs text-text-dim" role="status">Checking whether AI is connected on this server.</p>;
  } else {
    action = (
      <div className="space-y-3" data-candidate-comparison="unknown">
        <div role="alert"><Notice tone="red">Whether AI is connected could not be read from the server, so the comparison is not offered.{engine.message ? ` ${engine.message}` : ''}</Notice></div>
        <Button size="sm" onClick={reloadEngine}>Check again</Button>
      </div>
    );
  }

  return (
    <div data-candidate-comparison="panel">
      <Panel title="Compare candidates" meta="Optional AI comparison of several candidates of one job. Advisory.">
        <p className="max-w-3xl text-sm leading-relaxed text-text-dim">
          Choose a job and two to five of its evaluated candidates. The AI compares them with each other against the same requirements of that job. It is advice: the AI changes no status, shortlists nobody and rejects nobody. The recruiter decides. Names and contact details are not sent to the model: candidates are sent as "Candidate A", "Candidate B" and so on.
        </p>

        {loading && <div className="mt-4" role="status"><EmptyState title="Loading evaluations" /></div>}

        {!loading && comparable.length === 0 && (
          <div className="mt-4" data-candidate-comparison="empty">
            <EmptyState title="No job has two evaluated candidates yet">A comparison needs at least two candidates evaluated for the same job.</EmptyState>
          </div>
        )}

        {!loading && comparable.length > 0 && (
          <>
            <div className="mt-5 max-w-xl">
              <label htmlFor="candidate-comparison-job" className={labelCls}>Job</label>
              <select id="candidate-comparison-job" value={job ? job.id : ''} onChange={(e) => chooseJob(e.target.value)} disabled={busy} className={inputCls}>
                <option value="">Choose a job</option>
                {comparable.map((item) => <option key={item.id} value={item.id}>{item.title} ({countByJob.get(item.id)} evaluated)</option>)}
              </select>
            </div>

            {job && (
              <>
                <fieldset className="mt-5 min-w-0" disabled={busy || !canRun}>
                  <legend className={labelCls}>Evaluated candidates of this job</legend>
                  <ul className="divide-y divide-line border border-line">
                    {results.map((result) => {
                      const id = `candidate-comparison-${result.id}`;
                      const ticked = picked.includes(result.id);
                      const aiFit = Number.isFinite(result.aiComparison?.overallMatch) ? result.aiComparison.overallMatch : null;
                      return (
                        <li key={result.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-2.5">
                          <input id={id} type="checkbox" checked={ticked} disabled={!canRun || busy || (full && !ticked)} onChange={() => toggle(result.id)} className="h-4 w-4 shrink-0 accent-[#a78bfa]" />
                          <label htmlFor={id} className={cx('min-w-0 flex-1 basis-40 break-words text-sm font-semibold', canRun && !busy && 'cursor-pointer')}>{nameOf(result.candidateId)}</label>
                          <span className="text-xs tabular-nums text-text-dim">Rule-based score {result.totalScore}</span>
                          <span className="text-xs tabular-nums text-text-dim">{aiFit === null ? 'No AI comparison yet' : `AI fit ${aiFit}`}</span>
                        </li>
                      );
                    })}
                  </ul>
                  {full && <p className="mt-2 text-xs text-text-dim">{MAX} candidates are chosen, which is the most one comparison takes.</p>}
                </fieldset>

                <div className="mt-5">{action}</div>

                {/* Always in the page, so a screen reader hears it change. */}
                <div id="candidate-comparison-progress" role="status" aria-live="polite" className={cx(busy && 'mt-4')}>
                  {busy && <Notice tone="blue">Comparing with AI. This can take up to a minute. Nothing is changed while it runs.</Notice>}
                </div>
                {error && (
                  <div className="mt-4" role="alert" data-ai-error={aiFailureCode(error)}>
                    <Notice tone="red">{aiFailureText(error)}</Notice>
                  </div>
                )}

                <div className="mt-6 border-t border-line pt-5">
                  {stored.status === 'loading' && <div role="status"><EmptyState title="Reading the stored comparison" /></div>}
                  {stored.status === 'error' && <div role="alert"><Notice tone="red">The stored comparison could not be read. {stored.message}</Notice></div>}
                  {stored.status === 'ready' && !stored.data && (
                    <div data-candidate-comparison="none">
                      <EmptyState title="No comparison stored for this job">Nothing has been sent to the AI for this job's candidates as a group.</EmptyState>
                    </div>
                  )}
                  {stored.status === 'ready' && stored.data && <Result comparison={stored.data} />}
                </div>
              </>
            )}
          </>
        )}
      </Panel>
    </div>
  );
}
