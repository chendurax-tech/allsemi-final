import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAdminStore } from '../store.jsx';
import {
  PageHeader, Panel, StageTrace, ScoreRing, Badge, Button, Chip, EmptyState, DefinitionList, Notice, cx,
} from '../components/ui.jsx';
import { ATS_STAGES } from '../data/atsStages.js';
import { REVIEW_STATES } from '../data/recruitment.js';
import { aiService } from '../lib/aiService.js';
import { formatDateTime } from '../lib/format.js';

/*
  AtsResult - one candidate's evaluation against one job.

  The screen follows the pipeline, not a single number: the stage trace
  first, then what the rule-based layer found, what the AI layer read,
  the evidence behind each claim, and finally the recruiter's review.
  The overall figure is labelled as decision support wherever it shows.
*/

const selectCls = 'w-full bg-bg border border-line-strong px-3 py-2 text-sm text-text focus:outline-none focus:border-accent';

function MarkedList({ items, tone, empty }) {
  if (!items.length) return <p className="text-sm text-text-dim">{empty}</p>;
  return (
    <ul className="space-y-2.5">
      {items.map((item) => (
        <li key={item} className="flex gap-3 text-sm leading-relaxed">
          <span className={cx('mt-2 h-1.5 w-1.5 shrink-0 rounded-full', tone === 'teal' ? 'bg-turquoise' : 'bg-[#e8b65a]')} aria-hidden="true" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function ReviewPanel({ result }) {
  const { upsert, log, user } = useAdminStore();
  const [reviewState, setReviewState] = useState(result.review.state);
  const [note, setNote] = useState(result.review.note || '');
  const [saved, setSaved] = useState(false);

  function save() {
    const at = new Date().toISOString();
    upsert('atsResults', {
      ...result,
      review: { state: reviewState, note, reviewer: user.name, updatedAt: at },
      history: [...result.history, { at, actor: user.name, action: `Recruiter review set to "${reviewState}"` }],
    });
    log({ action: `Recruiter review set to "${reviewState}"`, candidateId: result.candidateId, jobId: result.jobId });
    setSaved(true);
  }

  return (
    <Panel title="Recruiter review" meta="The decision belongs to a person">
      <div className="mb-4"><Badge>{result.review.state}</Badge></div>
      <label htmlFor="review-state" className="block font-mono text-[0.65rem] uppercase tracking-[0.14em] text-text-dim mb-1.5">Decision</label>
      <select id="review-state" value={reviewState} onChange={(e) => { setReviewState(e.target.value); setSaved(false); }} className={selectCls}>
        {REVIEW_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
      </select>
      <label htmlFor="review-note" className="mt-4 block font-mono text-[0.65rem] uppercase tracking-[0.14em] text-text-dim mb-1.5">Note</label>
      <textarea id="review-note" rows={4} value={note} onChange={(e) => { setNote(e.target.value); setSaved(false); }} className={cx(selectCls, 'resize-y leading-relaxed')} />
      <div className="mt-4 flex items-center gap-3">
        <Button variant="primary" onClick={save}>Save review</Button>
        {saved && <span className="text-xs text-turquoise" role="status">Saved review</span>}
      </div>
      {result.review.reviewer && (
        <p className="mt-4 text-xs text-text-dim">Last reviewed by {result.review.reviewer}, {formatDateTime(result.review.updatedAt)}</p>
      )}
    </Panel>
  );
}

export default function AtsResult({ candidateId }) {
  const { state } = useAdminStore();
  const [searchParams, setSearchParams] = useSearchParams();
  const [runMessage, setRunMessage] = useState('');

  const candidate = state.candidates.find((c) => c.id === candidateId);
  const results = state.atsResults.filter((r) => r.candidateId === candidateId);
  const result = results.find((r) => r.jobId === searchParams.get('job')) || results[0];
  const jobOf = (jobId) => state.jobs.find((j) => j.id === jobId)?.title || 'Removed job';

  if (!candidate) {
    return (
      <Panel>
        <EmptyState title="This candidate was not found">The profile may have been deleted in this session.</EmptyState>
        <div className="flex justify-center pb-4"><Button to="/admin/ats">Back to ATS results</Button></div>
      </Panel>
    );
  }

  if (!result) {
    const stages = ATS_STAGES.map((stage, i) => ({ ...stage, state: i < 3 ? 'done' : 'pending' }));
    return (
      <>
        <PageHeader eyebrow="Recruitment / ATS results" title={candidate.name} description="No evaluation has run for this candidate yet." actions={<Button variant="ghost" to="/admin/ats">Back to ATS results</Button>} />
        <Panel title="Where this candidate is in the pipeline">
          <StageTrace stages={stages} />
          <p className="mt-6 text-sm text-text-dim leading-relaxed">The resume has been extracted into a structured profile. An evaluation runs when the application is matched to a job.</p>
          <div className="mt-4"><Button to={`/admin/candidates/${candidateId}`}>Open candidate profile</Button></div>
        </Panel>
      </>
    );
  }

  const reviewed = result.review.state !== 'Pending review';
  const stages = ATS_STAGES.map((stage, i) => {
    if (i < ATS_STAGES.length - 1) return { ...stage, state: 'done' };
    return { ...stage, state: reviewed ? 'done' : 'current' };
  });

  async function runAgain() {
    setRunMessage('Requesting a new evaluation.');
    try {
      const response = await aiService.compareCandidateToJob(candidateId, result.jobId);
      setRunMessage(response.connected ? 'A new evaluation was requested.' : response.message);
    } catch (error) {
      setRunMessage(`The evaluation could not be requested. ${error.message}`);
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Recruitment / ATS results"
        title={candidate.name}
        description={`Evaluated against ${jobOf(result.jobId)} on ${formatDateTime(result.runAt)}.`}
        actions={(
          <>
            <Button variant="ghost" to="/admin/ats">Back to ATS results</Button>
            <Button to={`/admin/candidates/${candidateId}`}>Candidate profile</Button>
            <Button onClick={runAgain}>Run evaluation again</Button>
          </>
        )}
      />

      {runMessage && <div className="mb-5" role="status"><Notice tone="blue">{runMessage}</Notice></div>}

      {results.length > 1 && (
        <div className="mb-5 flex flex-wrap gap-2" role="tablist" aria-label="Evaluated jobs">
          {results.map((r) => (
            <button
              key={r.id}
              type="button"
              role="tab"
              aria-selected={r.id === result.id}
              onClick={() => setSearchParams({ job: r.jobId })}
              className={cx(
                'border px-3 py-2 text-sm transition-colors focus:outline-none focus-visible:border-accent',
                r.id === result.id ? 'border-accent bg-accent/10 text-text font-semibold' : 'border-line-strong text-text-dim hover:text-text',
              )}
            >
              {jobOf(r.jobId)} <span className="ml-2 tabular-nums text-text-dim">{r.overall}</span>
            </button>
          ))}
        </div>
      )}

      <Panel title="Pipeline" meta={reviewed ? 'All eight stages complete' : 'Seven stages complete. Waiting for a recruiter.'}>
        <StageTrace stages={stages} />
      </Panel>

      <div className="mt-6 grid items-start gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
        <div className="space-y-6 min-w-0">
          <Panel title="Overall match">
            <div className="flex flex-col items-center text-center">
              <ScoreRing value={result.overall} caption="of 100" />
              <div className="mt-4"><Badge>{result.band}</Badge></div>
              <p className="mt-4 text-xs text-text-dim leading-relaxed">
                Decision support only. This figure summarises the checks beside it and does not advance or reject anyone.
              </p>
            </div>
            <div className="mt-5 border-t border-line pt-4">
              <DefinitionList items={[['Evaluated', formatDateTime(result.runAt)], ['AI service', 'Not connected. Sample result.']]} />
            </div>
          </Panel>

          <ReviewPanel key={result.id} result={result} />
        </div>

        <div className="space-y-6 min-w-0">
          <Panel title="Required skills" meta={`${result.matchedSkills.length} of ${result.requiredSkills.length} matched by exact name`}>
            <p className="font-mono text-[0.62rem] uppercase tracking-[0.14em] text-text-dim mb-2">Matched</p>
            <div className="flex flex-wrap gap-2">
              {result.matchedSkills.length ? result.matchedSkills.map((s) => <Chip key={s} tone="teal">{s}</Chip>) : <span className="text-sm text-text-dim">None</span>}
            </div>
            <p className="mt-4 font-mono text-[0.62rem] uppercase tracking-[0.14em] text-text-dim mb-2">Missing</p>
            <div className="flex flex-wrap gap-2">
              {result.missingSkills.length ? result.missingSkills.map((s) => <Chip key={s} tone="amber">{s}</Chip>) : <span className="text-sm text-text-dim">None</span>}
            </div>
            <p className="mt-4 font-mono text-[0.62rem] uppercase tracking-[0.14em] text-text-dim mb-2">Preferred skills</p>
            <div className="flex flex-wrap gap-2">
              {result.preferredMatched.map((s) => <Chip key={s} tone="blue">{s}</Chip>)}
              {result.preferredMissing.map((s) => <Chip key={s}>{s} (not found)</Chip>)}
            </div>
          </Panel>

          <Panel title="Rule-based checks" meta="Deterministic. The same inputs always give the same result." pad={false}>
            <ul className="divide-y divide-line">
              {result.ruleChecks.map((check) => (
                <li key={check.rule} className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:gap-4 md:px-5">
                  <span className="w-48 shrink-0 text-sm font-semibold">{check.rule}</span>
                  <span className="flex-1 text-sm text-text-dim">{check.detail}</span>
                  <span><Badge>{check.result}</Badge></span>
                </li>
              ))}
            </ul>
          </Panel>

          <div className="grid gap-6 md:grid-cols-3">
            <Panel title="Relevant experience">
              <p className="text-sm leading-relaxed">{result.experienceSummary}</p>
              <p className="mt-2 text-xs text-text-dim">Role asks for {result.experienceRequired}</p>
              {result.experienceGaps.length > 0 && (
                <div className="mt-4 border-t border-line pt-3">
                  <p className="font-mono text-[0.62rem] uppercase tracking-[0.14em] text-text-dim mb-2">Experience gaps</p>
                  <MarkedList items={result.experienceGaps} tone="amber" />
                </div>
              )}
            </Panel>
            <Panel title="Education match">
              <Badge>{result.education.result}</Badge>
              <p className="mt-3 text-sm leading-relaxed">{result.education.note}</p>
            </Panel>
            <Panel title="Domain relevance">
              <Badge>{result.domain.level}</Badge>
              <p className="mt-3 text-sm leading-relaxed">{result.domain.note}</p>
            </Panel>
          </div>

          <Panel title="AI comparison and explanation" meta="Sample text standing in for the AI layer, which is not connected yet.">
            <p className="font-mono text-[0.62rem] uppercase tracking-[0.14em] text-[#8ab8ff] mb-2">Semantic reading</p>
            <p className="text-sm leading-relaxed">{result.semanticNote}</p>
            <p className="mt-5 font-mono text-[0.62rem] uppercase tracking-[0.14em] text-[#8ab8ff] mb-2">Match explanation</p>
            <p className="text-sm leading-relaxed">{result.explanation}</p>
          </Panel>

          <div className="grid gap-6 md:grid-cols-2">
            <Panel title="Strengths"><MarkedList items={result.strengths} tone="teal" empty="None identified." /></Panel>
            <Panel title="Potential gaps"><MarkedList items={result.potentialGaps} tone="amber" empty="None identified." /></Panel>
          </div>

          <Panel title="Evidence" meta="Where each claim comes from in the resume" pad={false}>
            <ul className="divide-y divide-line">
              {result.evidence.map((item) => (
                <li key={item.claim} className="px-4 py-4 md:px-5">
                  <p className="text-sm font-semibold">{item.claim}</p>
                  <blockquote className="mt-2 border-l-2 border-[#5b9dff]/60 pl-3 text-sm text-text-dim leading-relaxed">{item.excerpt}</blockquote>
                  <p className="mt-2 text-xs text-text-dim">{item.source}</p>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel title="History" meta="Every step is recorded for audit">
            <ol className="space-y-4">
              {result.history.map((entry, i) => (
                <li key={`${entry.at}-${i}`} className="border-l border-line-strong pl-4">
                  <p className="text-sm">{entry.action}</p>
                  <p className="mt-0.5 text-xs text-text-dim">{entry.actor}, {formatDateTime(entry.at)}</p>
                </li>
              ))}
            </ol>
          </Panel>
        </div>
      </div>
    </>
  );
}
