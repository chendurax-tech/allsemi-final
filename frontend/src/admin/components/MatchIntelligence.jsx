import React, { useCallback, useEffect, useState } from 'react';
import { atsApi } from '../../lib/api/index.js';
import { Panel, Badge, Button, Chip, EmptyState, Notice, DefinitionList, cx } from './ui.jsx';
import { label } from '../data/enums.js';
import { formatDateTime } from '../lib/format.js';

/*
  MatchIntelligence - why a rule-based ATS result scored as it did, and
  where the candidate's skills fall short of the job.

  Everything shown here comes from GET /ats-results/:id/explanation,
  which the server lays out from the stored result (services/
  matchExplanation.js on the backend). This screen adds no reasons of
  its own: the wording of each part is the engine's, and a skill counts
  as mentioned in the resume only when the server says so, with the
  line it found. A mentioned skill is not added to the profile.
*/

const WEIGHT_SOURCE_NOTES = {
  BASELINE: 'The job had no requirement profile when this evaluation ran.',
  PROFILE: "The job's requirement profile was used, with the default weights of a profile.",
  JOB: "The job's requirement profile was used, with the weights saved for this job.",
};

const PART_STATUS_TONE = { pass: 'teal', review: 'amber', fail: 'red', info: 'blue', not_applicable: 'dim' };
const PART_STATUS_LABEL = { pass: 'Pass', review: 'Review', fail: 'Fail', info: 'Info', not_applicable: 'Not applicable' };

function WhyPanel({ explanation }) {
  return (
    <Panel title="Why this candidate matches" meta={`${explanation.totalScore} of 100, ${explanation.band}. Laid out from the rule-based result; no AI.`} pad={false}>
      <p className="border-b border-line px-4 py-3 text-xs leading-relaxed text-text-dim md:px-5" data-ats-weight-source={explanation.weightSource}>
        Weights used: <span className="font-semibold text-text">{explanation.weightSourceLabel}</span>. {WEIGHT_SOURCE_NOTES[explanation.weightSource] || ''}
      </p>
      {explanation.summary?.length > 0 && (
        <ul className="border-b border-line px-4 py-3 md:px-5 space-y-1">
          {explanation.summary.map((line) => <li key={line} className="text-sm">{line}</li>)}
        </ul>
      )}
      <ul className="divide-y divide-line">
        {explanation.parts.map((part) => {
          const scored = typeof part.score === 'number';
          return (
            <li key={part.key} className="px-4 py-3 md:px-5" data-part={part.key}>
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="min-w-0 flex-1 text-sm font-semibold">{part.label}</span>
                <Badge tone={PART_STATUS_TONE[part.status] || 'dim'}>{PART_STATUS_LABEL[part.status] || part.status}</Badge>
                <span className="font-mono text-[0.62rem] uppercase tracking-[0.14em] text-text-dim whitespace-nowrap">
                  {part.counted ? `Weight ${part.weight}, ${part.share}% of total` : scored ? 'Not counted for this job' : 'Not scored'}
                </span>
                <span className={cx('w-10 text-right font-display text-lg font-semibold tabular-nums', !part.counted && 'text-text-dim')}>{scored ? part.score : ''}</span>
              </div>
              <div className="mt-2 h-1 w-full bg-line-strong" aria-hidden="true">
                {part.counted && <div className="h-full bg-info" style={{ width: `${Math.max(0, Math.min(100, part.score))}%` }} />}
              </div>
              <p className="mt-2 text-sm text-text-dim break-words">{part.detail}</p>
              {part.counted && <p className="mt-1 font-mono text-[0.62rem] uppercase tracking-[0.12em] text-text-dim">Adds {part.contribution} points to the total</p>}
            </li>
          );
        })}
      </ul>
      {explanation.notes?.length > 0 && (
        <div className="border-t border-line px-4 py-3 md:px-5">
          <p className="font-mono text-[0.62rem] uppercase tracking-[0.14em] text-text-dim mb-2">Listed by the engine, not scored</p>
          <ul className="space-y-1">
            {explanation.notes.map((note) => (
              <li key={note.rule} className="text-sm text-text-dim break-words"><span className="font-semibold text-text">{note.rule}:</span> {note.detail}</li>
            ))}
          </ul>
        </div>
      )}
    </Panel>
  );
}

function MissingList({ items }) {
  if (!items.length) return <span className="text-sm text-text-dim">None</span>;
  return (
    <ul className="space-y-2">
      {items.map((item) => (
        <li key={item.skill} className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Chip tone="amber">{item.skill}</Chip>
            {item.status === 'MENTIONED_IN_RESUME' && <Badge tone="blue">{item.label}</Badge>}
          </div>
          {item.evidence && <p className="mt-1 text-xs text-text-dim break-words"><span className="font-mono uppercase tracking-[0.12em]">Resume line: </span>{item.evidence}</p>}
        </li>
      ))}
    </ul>
  );
}

function GapGroup({ title, matched, missing }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="min-w-0">
        <p className="font-mono text-[0.62rem] uppercase tracking-[0.14em] text-text-dim mb-2">{title}, matched ({matched.length})</p>
        <div className="flex flex-wrap gap-2">
          {matched.length ? matched.map((s) => <Chip key={s} tone="teal">{s}</Chip>) : <span className="text-sm text-text-dim">None</span>}
        </div>
      </div>
      <div className="min-w-0">
        <p className="font-mono text-[0.62rem] uppercase tracking-[0.14em] text-text-dim mb-2">{title}, missing ({missing.length})</p>
        <MissingList items={missing} />
      </div>
    </div>
  );
}

function SkillGapPanel({ explanation, skillGap }) {
  const { skills } = explanation;
  const groups = [
    ['Required skills', skills.required, skillGap.missingRequired],
    ['Preferred skills', skills.preferred, skillGap.missingPreferred],
    ['Tools', skills.tools, skillGap.missingTools],
  ].filter(([, set]) => set.applies);
  return (
    <Panel title="Skill gap" meta={`${skills.required.matched.length} of ${skills.required.total} required skills matched by name`}>
      <div className="space-y-5">
        {groups.length === 0 && <p className="text-sm text-text-dim">The job lists no skills or tools to compare.</p>}
        {groups.map(([title, set, missing], index) => (
          <div key={title} className={cx(index > 0 && 'border-t border-line pt-4')}>
            <GapGroup title={title} matched={set.matched} missing={missing} />
          </div>
        ))}
        <div className="border-t border-line pt-4 grid gap-4 sm:grid-cols-2">
          <div className="min-w-0">
            <p className="font-mono text-[0.62rem] uppercase tracking-[0.14em] text-text-dim mb-2">Extra skills in the profile</p>
            <div className="flex flex-wrap gap-2">
              {skillGap.additionalProfileSkills.length ? skillGap.additionalProfileSkills.map((s) => <Chip key={s} tone="blue">{s}</Chip>) : <span className="text-sm text-text-dim">None</span>}
            </div>
          </div>
          <div className="min-w-0">
            <p className="font-mono text-[0.62rem] uppercase tracking-[0.14em] text-text-dim mb-2">In the resume, not in the approved profile</p>
            <div className="flex flex-wrap gap-2">
              {skillGap.additionalResumeSkills.length ? skillGap.additionalResumeSkills.map((item) => <Chip key={item.skill}>{item.skill}</Chip>) : <span className="text-sm text-text-dim">None</span>}
            </div>
          </div>
        </div>
        <p className="border-t border-line pt-3 text-xs text-text-dim leading-relaxed">
          {skillGap.note}{' '}
          {skillGap.resume.checked
            ? `${skillGap.counts.mentionedInResume} missing ${skillGap.counts.mentionedInResume === 1 ? 'skill is' : 'skills are'} named in the resume.`
            : 'The resume was not checked: it has not been extracted, its draft was discarded, or your role cannot read resumes.'}
        </p>
      </div>
    </Panel>
  );
}

/*
  StaleReview - shown when the result changed after its review was
  saved (the server re-ran the rules after resume data was approved).
  The review is kept as it was; saving a new review in the existing
  review panel clears this.
*/
export function StaleReview({ result }) {
  if (!result.review?.stale) return null;
  return (
    <div role="status" className="space-y-3 border border-warn/45 bg-warn/10 px-4 py-3">
      <p className="text-sm font-semibold text-warn">ATS result changed after resume/profile update. Previous recruiter review is outdated.</p>
      <DefinitionList
        items={[
          ['Previous review', `${label(result.review.state)}${result.review.reviewerName ? `, by ${result.review.reviewerName}` : ''}${result.review.updatedAt ? `, ${formatDateTime(result.review.updatedAt)}` : ''}`],
          ['Score at review', result.review.scoreAtReview ?? 'Not recorded'],
          ['Current score', `${result.totalScore} (${result.band})`],
          ['Re-evaluated', formatDateTime(result.reevaluation?.at || result.review.staleSince)],
        ]}
      />
      <p className="text-xs text-text-dim">Save a new review in the recruiter review panel to replace it.</p>
    </div>
  );
}

export default function MatchIntelligence({ result }) {
  const [view, setView] = useState({ status: 'loading', data: null, message: '' });

  const load = useCallback(async () => {
    setView((current) => ({ ...current, status: 'loading', message: '' }));
    try {
      setView({ status: 'ready', data: await atsApi.explanation(result.id), message: '' });
    } catch (failure) {
      setView({ status: 'error', data: null, message: failure.message });
    }
  }, [result.id]);

  // Read again whenever the result is re-run.
  useEffect(() => { load(); }, [load, result.runAt]);

  if (view.status === 'loading' && !view.data) {
    return <Panel title="Why this candidate matches"><div role="status"><EmptyState title="Loading the explanation" /></div></Panel>;
  }
  if (view.status === 'error') {
    return (
      <Panel title="Why this candidate matches">
        <div role="alert"><Notice tone="red">{view.message}</Notice></div>
        <div className="mt-3"><Button size="sm" onClick={load}>Try again</Button></div>
      </Panel>
    );
  }
  const { explanation, skillGap } = view.data;
  return (
    <>
      <WhyPanel explanation={explanation} />
      <SkillGapPanel explanation={explanation} skillGap={skillGap} />
    </>
  );
}
