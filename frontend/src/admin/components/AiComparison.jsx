import React, { useEffect } from 'react';
import { useAdminStore } from '../store.jsx';
import { useAuth } from '../auth.jsx';
import { Panel, Button, Notice, cx } from './ui.jsx';
import { formatDateTime } from '../lib/format.js';

/*
  AiComparison - the optional second opinion on one ATS result.

  The order is fixed: the rule-based ATS runs first, a recruiter then
  presses "Compare with AI", the ALLSEMIS backend asks OpenAI to compare
  the candidate with the job, and the recruiter reads the answer and
  decides. Nothing here shortlists, rejects or changes a score.

  The request is sent by the button's click handler and by nothing
  else. No effect, page load, tab focus or route change asks for a
  comparison, and a failed one is not tried again by itself. The
  browser talks to the ALLSEMIS backend only: the provider key stays on
  the server.

  What the model wrote is untrusted text. It is rendered as plain text
  nodes: never as HTML, and a web address in it is not made a link.

  AtsScopeNotice is the one sentence at the top of the ATS screens that
  says whether the server has the AI comparison connected.
*/

const SCORE_RULE = "A score supports a recruiter's decision and never changes the status of a candidate or an application.";

export function AtsScopeNotice() {
  const { engine } = useAdminStore();
  const ai = engine.status === 'ready' ? engine.data?.ai : null;
  let lead = '';
  if (ai) {
    lead = ai.available
      ? 'AI comparison is enabled on this server. It runs only when a recruiter starts it on an evaluation, after the rule-based ATS, and its result is advice. '
      : 'AI comparison is not enabled on this server. ';
  }
  return <Notice tone="blue">{lead}{SCORE_RULE}</Notice>;
}

// The sentence to show when the server gave none (a proxy or a rate
// limiter can answer without the API's own error body).
const FALLBACK_BY_CODE = {
  AI_NOT_CONFIGURED: 'AI comparison is not connected on this server.',
  AI_FAILED: 'The AI service could not be reached or did not answer. Nothing was changed. Try again in a moment.',
  AI_INVALID_RESPONSE: 'The AI service gave an answer that could not be used. Nothing was saved. Try again.',
  AI_IN_PROGRESS: 'A comparison for this evaluation is already running. Wait for it to finish.',
};
const FALLBACK_BY_STATUS = {
  403: 'Your role cannot start an AI comparison.',
  404: 'This evaluation was not found. It may have been removed.',
  409: FALLBACK_BY_CODE.AI_IN_PROGRESS,
  429: 'Too many AI comparisons were started in a short time. Wait a minute and try again.',
  502: 'The AI service did not give a usable answer. Nothing was changed. Try again in a moment.',
  503: FALLBACK_BY_CODE.AI_NOT_CONFIGURED,
};
const FALLBACK = 'The AI comparison did not finish. Nothing was changed. Try again.';
// What the API client puts in place of a missing message or code.
const CLIENT_PLACEHOLDER = 'The request could not be completed. Please try again.';

function failureText(error) {
  if (!error) return FALLBACK;
  // The server could not be reached at all: the client's own sentence.
  if (error.code === 'NETWORK_ERROR') return error.message || FALLBACK;
  const fromServer = error.code !== 'REQUEST_FAILED' && error.message && error.message !== CLIENT_PLACEHOLDER;
  if (fromServer) return error.message;
  return FALLBACK_BY_CODE[error.code] || FALLBACK_BY_STATUS[error.status] || FALLBACK;
}

const text = (value) => (typeof value === 'string' ? value.trim() : '');
const list = (value) => (Array.isArray(value) ? value.map(text).filter(Boolean) : []);

const termCls = 'font-mono text-[0.62rem] uppercase tracking-[0.14em] text-text-dim';
const quiet = <span className="text-text-dim">None listed</span>;

function Field({ term, wide, children }) {
  return (
    <div className={cx('min-w-0', wide && 'sm:col-span-2')}>
      <dt className={termCls}>{term}</dt>
      <dd className="mt-1.5 text-sm leading-relaxed break-words">{children}</dd>
    </div>
  );
}

function Prose({ value }) {
  const body = text(value);
  if (!body) return <span className="text-text-dim">Not given</span>;
  return <span className="whitespace-pre-line">{body}</span>;
}

function Items({ value }) {
  const items = list(value);
  if (items.length === 0) return quiet;
  return (
    <ul className="space-y-1.5">
      {items.map((item, index) => (
        // The model may repeat a line, so the position is the key.
        <li key={index} className="flex gap-2.5">
          <span className="mt-[0.6em] h-1 w-1 shrink-0 bg-text-faint" aria-hidden="true" />
          <span className="min-w-0 break-words">{item}</span>
        </li>
      ))}
    </ul>
  );
}

function Comparison({ comparison }) {
  const match = Number.isFinite(comparison.overallMatch) ? Math.max(0, Math.min(100, Math.round(comparison.overallMatch))) : null;
  return (
    <div className="mt-5 border-t border-line pt-5" data-ai-comparison="result">
      <dl className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2">
        {/* Not a ring and not the blue of the rule-based score: the two
            numbers must never be taken for one another. */}
        <div className="min-w-0 self-start border border-accent/45 bg-accent/[0.06] px-4 py-4">
          <dt className="font-mono text-[0.62rem] uppercase tracking-[0.14em] text-accent">AI estimate of the overall match</dt>
          <dd className="mt-2">
            {match === null ? <span className="text-sm text-text-dim">Not given</span> : (
              <span className="flex items-baseline gap-2">
                <span className="font-display text-4xl font-semibold tabular-nums leading-none">{match}</span>
                <span className="font-mono text-[0.6rem] uppercase tracking-[0.14em] text-text-dim">of 100, estimated by the model</span>
              </span>
            )}
            <span className="mt-3 block text-xs leading-relaxed text-text-dim">This is the model's opinion. It is not the rule-based score and does not change it.</span>
          </dd>
        </div>
        <Field term="Summary"><Prose value={comparison.summary} /></Field>
        <Field term="Matched skills"><Items value={comparison.matchedSkills} /></Field>
        <Field term="Missing skills"><Items value={comparison.missingSkills} /></Field>
        <Field term="Relevant experience"><Prose value={comparison.relevantExperience} /></Field>
        <Field term="Experience gaps"><Items value={comparison.experienceGaps} /></Field>
        <Field term="Qualification assessment" wide><Prose value={comparison.qualificationAssessment} /></Field>
        <Field term="Strengths"><Items value={comparison.strengths} /></Field>
        <Field term="Concerns"><Items value={comparison.concerns} /></Field>
        <Field term="AI recommendation" wide><Prose value={comparison.recommendation} /></Field>
      </dl>
      <p className="mt-5 break-words text-xs text-text-dim">
        Model: {text(comparison.model) || 'not recorded'}. Compared by {text(comparison.comparedByName) || 'a user who was not recorded'}, {formatDateTime(comparison.comparedAt)}.
      </p>
      <p className="mt-4 border-t border-line pt-4 text-xs leading-relaxed text-text-dim">
        This is advice from an AI model and it can be wrong. It changes no score, review or application, and it shortlists nobody. Shortlisting remains the recruiter's decision.
      </p>
    </div>
  );
}

export default function AiComparison({ result }) {
  const { engine, reloadEngine, aiRuns, compareWithAi, dismissAiRun } = useAdminStore();
  const { can } = useAuth();
  const resultId = result.id;

  // Leaving the result forgets a finished or failed run's message. It
  // does not stop a running comparison and it requests nothing.
  useEffect(() => () => dismissAiRun(resultId), [resultId, dismissAiRun]);

  const ai = engine.status === 'ready' ? engine.data?.ai : null;
  const available = Boolean(ai?.available);
  const canRun = can('ats:run');
  // A result read before the server knew the field has none.
  const comparison = result.aiComparison || null;
  const run = aiRuns[resultId] || null;
  const running = run?.status === 'running';

  let lead;
  if (engine.status === 'loading') {
    lead = <p className="text-sm text-text-dim" role="status">Checking whether AI comparison is connected on this server.</p>;
  } else if (engine.status !== 'ready' || !ai) {
    lead = (
      <div className="space-y-3">
        <div role="alert"><Notice tone="red">Whether AI comparison is connected could not be read from the server.{engine.message ? ` ${engine.message}` : ''}</Notice></div>
        <Button size="sm" onClick={reloadEngine}>Check again</Button>
      </div>
    );
  } else if (!available) {
    lead = <p className="text-sm leading-relaxed text-text-dim break-words">AI comparison is not connected on this server. {text(ai.reason)}</p>;
  } else {
    lead = (
      <>
        <p className="max-w-3xl text-sm leading-relaxed text-text-dim">
          Compare with AI sends this job and the candidate's stated skills and experience to OpenAI and asks how well they match. Contact details are not sent. The answer is advice only: the rule-based result stays as it is, nobody is shortlisted, and the recruiter decides.
        </p>
        {canRun ? (
          <div className="mt-4">
            <Button variant={comparison ? 'secondary' : 'primary'} onClick={() => compareWithAi(resultId)} disabled={running} aria-describedby="ai-comparison-progress">
              {running ? 'Comparing with AI' : comparison ? 'Compare again' : 'Compare with AI'}
            </Button>
          </div>
        ) : (
          <p className="mt-3 text-xs leading-relaxed text-text-dim">Your role can read an AI comparison but cannot start one.</p>
        )}
      </>
    );
  }

  return (
    <Panel className="mt-6" title="AI comparison" meta={available ? 'Advice for the recruiter. Started by hand, never automatically.' : undefined}>
      {lead}

      {/* Always in the page, so a screen reader hears it change. */}
      <div id="ai-comparison-progress" role="status" aria-live="polite" className={cx((running || run?.status === 'done') && 'mt-4')}>
        {running && (
          <Notice tone="blue">
            Comparing with AI. This can take up to a minute, and you can keep working on this page.{comparison ? ' The comparison below is the earlier one until the new one arrives.' : ''}
          </Notice>
        )}
        {run?.status === 'done' && <Notice tone="teal">AI comparison finished. Nothing else was changed.</Notice>}
      </div>
      {run?.status === 'failed' && (
        <div className="mt-4" role="alert">
          <Notice tone="red">{failureText(run.error)}{comparison ? ' The earlier comparison is still shown below.' : ''}</Notice>
        </div>
      )}

      {comparison ? <Comparison comparison={comparison} /> : (
        available && !running && <p className="mt-4 text-sm text-text-dim">No AI comparison has been run for this evaluation.</p>
      )}
    </Panel>
  );
}
