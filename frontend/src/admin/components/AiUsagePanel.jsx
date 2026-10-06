import React, { useCallback, useEffect, useState } from 'react';
import { aiApi } from '../../lib/api/admin.js';
import { Panel, Badge, Button, EmptyState, Notice, DefinitionList, cx } from './ui.jsx';
import { formatDateTime } from '../lib/format.js';

/*
  AiUsagePanel - the "AI usage" panel on the dashboard, for a role that
  may run the ATS.

  It reads GET /api/admin/ai/usage once when the dashboard opens, and
  again only when "Try again" is pressed after a failed read. That
  request adds up the server's own record of the AI requests it sent.
  It calls no AI provider and costs nothing, and this panel never
  starts an AI request of any kind.

  Every money figure here is an ESTIMATE that ALLSEMIS works out from
  token counts and a price per million tokens. It is not the OpenAI
  account balance, and it knows nothing about the same key being used
  anywhere else. The word "estimated" is printed beside each figure so
  that is never in doubt. Days and months are counted in UTC.

  The level (Healthy, Notice, Warning, Critical) is always printed as a
  word. The colour only repeats it.

  Hooks for automated checks: data-ai-usage="panel" on the root,
  data-ai-usage-level on the level, data-ai-usage-service on the
  service status.
*/

const termCls = 'font-mono text-[0.62rem] uppercase tracking-[0.14em] text-text-dim';
const isNumber = (value) => typeof value === 'number' && Number.isFinite(value);
const whole = (value) => (isNumber(value) ? Math.round(value).toLocaleString('en-GB') : '0');
const plural = (n, one, many) => `${whole(n)} ${n === 1 ? one : many}`;

// US dollars. A single request costs a fraction of a cent, so an
// amount under one dollar keeps up to four decimals ($0.0045, not
// $0.00) and at least two ($0.50).
export function formatUsd(value) {
  if (!isNumber(value)) return 'Not available';
  if (value === 0) return '$0.00';
  if (value > 0 && value < 1) {
    const fixed = value.toFixed(4);
    if (Number(fixed) === 0) return 'under $0.0001';
    return `$${fixed.replace(/0{1,2}$/, '')}`;
  }
  return `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const LEVELS = {
  healthy: { word: 'Healthy', tone: 'teal', bar: 'bg-turquoise' },
  notice: { word: 'Notice', tone: 'amber', bar: 'bg-[#e8b65a]' },
  warning: { word: 'Warning', tone: 'amber', bar: 'bg-[#e8b65a]' },
  critical: { word: 'Critical', tone: 'red', bar: 'bg-red-400' },
  none: { word: 'No budget set', tone: 'dim', bar: 'bg-[#5b9dff]' },
};

const SERVICE_STATES = {
  NOT_CONFIGURED: { word: 'Not configured', tone: 'amber' },
  QUOTA_EXCEEDED: { word: 'Quota exceeded', tone: 'red' },
  ATTENTION: { word: 'Needs attention', tone: 'amber' },
  AVAILABLE: { word: 'Available', tone: 'teal' },
  NOT_USED_YET: { word: 'Not used yet', tone: 'dim' },
};

const OPERATIONS = {
  CANDIDATE_COMPARISON: 'Comparison of one candidate with a job',
  JOB_REQUIREMENTS: 'Draft of a job requirement profile',
  CANDIDATE_RANKING: 'Comparison of several candidates for a job',
};

// Why a request failed, as the server filed it. No provider message is
// ever stored, so these few words are all there is to show.
const FAILURE_REASONS = {
  quota: 'quota or billing',
  rate_limit: 'the provider was busy',
  auth: 'the key was not accepted',
  model: 'the model was not accepted',
  bad_request: 'the request was not accepted',
  timeout: 'no answer in time',
  network: 'the provider was not reached',
  provider: 'the provider returned an error',
  invalid_response: 'the answer could not be used',
  refused: 'the model declined',
};

function levelNote(level, usage) {
  const { budget, service } = usage;
  const thresholds = budget.thresholds || {};
  if (service.state === 'QUOTA_EXCEEDED') return 'OpenAI refused the last request for a quota or billing reason. The level stays critical until a request works again.';
  if (level === 'none') return 'A level needs a monthly budget, and none is set on the server. Spend is still estimated below.';
  if (level === 'healthy') return `Estimated spend this month is below the notice threshold of ${thresholds.notice}% of the monthly budget.`;
  return `Estimated spend this month has reached the ${level} threshold of ${thresholds[level]}% of the monthly budget.`;
}

function Figure({ label, value, hint, note }) {
  const number = /^[\d$]/.test(String(value));
  return (
    <div className="min-w-0 border border-line px-3 py-3 sm:px-4">
      <dt className={cx(termCls, 'break-words')}>{label}</dt>
      <dd className="mt-2">
        <span className={cx('block break-words font-display font-semibold tabular-nums leading-tight', number ? 'text-2xl' : 'text-base')}>{value}</span>
        {note && <span className="mt-1 block font-mono text-[0.6rem] uppercase tracking-[0.12em] text-[#8ab8ff]">{note}</span>}
        {hint && <span className="mt-1.5 block break-words text-xs leading-relaxed text-text-dim">{hint}</span>}
      </dd>
    </div>
  );
}

function Budget({ usage, level }) {
  const { budget, pricing } = usage;
  const thresholds = budget.thresholds || {};
  if (!isNumber(budget.monthlyUsd)) {
    return (
      <div className="min-w-0" data-ai-usage-budget="none">
        <p className={termCls}>Monthly budget</p>
        <p className="mt-1.5 text-sm font-semibold">No monthly budget set</p>
        <p className="mt-1 break-words text-xs leading-relaxed text-text-dim">
          Setting AI_MONTHLY_BUDGET_USD on the server enables the Healthy, Notice, Warning and Critical levels. Spend is estimated either way.
        </p>
      </div>
    );
  }
  const percent = isNumber(budget.percentUsed) ? budget.percentUsed : 0;
  const filled = Math.max(0, Math.min(100, percent));
  const marks = ['notice', 'warning', 'critical'].filter((name) => isNumber(thresholds[name]) && thresholds[name] > 0 && thresholds[name] < 100);
  return (
    <div className="min-w-0" data-ai-usage-budget="set">
      <p className={termCls}>Monthly budget (UTC month)</p>
      <p className="mt-1.5 break-words text-sm">
        <span className="font-semibold tabular-nums">{percent}% of the {formatUsd(budget.monthlyUsd)} monthly budget</span>
        <span className="text-text-dim">, by estimated spend. Estimated remaining: {formatUsd(budget.remainingUsd)}.</span>
      </p>
      <div
        className="relative mt-3 h-2 w-full bg-line-strong"
        role="progressbar"
        aria-label="Estimated share of the monthly AI budget used"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={filled}
        aria-valuetext={`${percent}%, estimated`}
      >
        <div className={cx('h-full', LEVELS[level].bar)} style={{ width: `${filled}%` }} />
        {marks.map((name) => (
          <span key={name} className="absolute -top-1 h-4 w-px bg-text-dim" style={{ left: `${thresholds[name]}%` }} aria-hidden="true" />
        ))}
      </div>
      <p className="mt-2 break-words text-xs leading-relaxed text-text-dim">
        Thresholds: notice at {thresholds.notice}%, warning at {thresholds.warning}%, critical at {thresholds.critical}% of the budget.
        {!pricing.known && ' Only requests that could be priced count towards it.'}
      </p>
    </div>
  );
}

function LastRequest({ last }) {
  if (!last) return 'No AI request has been recorded yet.';
  const reason = FAILURE_REASONS[last.errorCategory];
  const tokens = isNumber(last.inputTokens) || isNumber(last.outputTokens);
  return (
    <span className="block" data-ai-usage-last={last.success ? 'succeeded' : 'failed'}>
      <span className="block">{formatDateTime(last.at)}</span>
      <span className="mt-1 block">{OPERATIONS[last.operation] || 'AI request'}{last.actorName ? `, started by ${last.actorName}` : ''}</span>
      <span className="mt-1.5 flex flex-wrap items-center gap-2">
        <Badge tone={last.success ? 'teal' : 'red'}>{last.success ? 'Succeeded' : 'Failed'}</Badge>
        {!last.success && reason && <span className="text-xs text-text-dim">Reason: {reason}.</span>}
      </span>
      {tokens && (
        <span className="mt-1.5 block text-xs text-text-dim">
          {whole(last.inputTokens)} input and {whole(last.outputTokens)} output tokens.
          {isNumber(last.estimatedCostUsd) ? ` Estimated cost ${formatUsd(last.estimatedCostUsd)}.` : ' Cost not estimated.'}
        </span>
      )}
    </span>
  );
}

function Usage({ usage: raw }) {
  // The server always sends every part. An answer that lacks one (an
  // older server, for example) must not take the dashboard down.
  const usage = { ...raw, service: raw.service || {}, today: raw.today || {}, month: raw.month || {}, budget: raw.budget || {}, pricing: raw.pricing || {} };
  const { service, today, month, budget, pricing } = usage;
  const level = LEVELS[budget.level] ? budget.level : 'none';
  const state = SERVICE_STATES[service.state] ? service.state : 'ATTENTION';
  const quota = state === 'QUOTA_EXCEEDED';
  const outcome = (period) => `${whole(period.succeeded)} succeeded, ${whole(period.failed)} failed`;
  const tokens = (period) => `${whole(period.inputTokens)} input and ${whole(period.outputTokens)} output tokens`;

  let price = 'Not known for this model';
  if (pricing.known) {
    const source = pricing.source === 'CONFIGURED' ? 'set on the server' : 'the list price for this model';
    price = `${formatUsd(pricing.inputPerMillionUsd)} per million input tokens and ${formatUsd(pricing.outputPerMillionUsd)} per million output tokens (${source}). Used for the estimate only.`;
  }

  return (
    <div className="space-y-5">
      {quota && (
        <div role="alert" data-ai-usage-alert="quota">
          <Notice tone="red">
            <span className="block font-semibold">AI requests are being refused: quota exceeded.</span>
            <span className="mt-1 block">{service.message}</span>
          </Notice>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="min-w-0" data-ai-usage-level={level}>
          <Notice tone={LEVELS[level].tone}>
            <span className="block font-mono text-[0.62rem] uppercase tracking-[0.14em]">Usage level</span>
            <span className="mt-1 block font-display text-lg font-semibold leading-tight">{LEVELS[level].word}</span>
            <span className="mt-1 block break-words">{levelNote(level, usage)}</span>
          </Notice>
        </div>

        <div className="min-w-0 border border-line px-3 py-2" data-ai-usage-service={state}>
          <p className={termCls}>AI service status</p>
          <p className="mt-1.5"><Badge tone={SERVICE_STATES[state].tone}>{SERVICE_STATES[state].word}</Badge></p>
          {state === 'NOT_CONFIGURED' && <p className="mt-2 text-sm font-semibold">AI is not configured on this server.</p>}
          {!quota && service.message && <p className="mt-2 break-words text-xs leading-relaxed text-text-dim">{service.message}</p>}
          <p className="mt-1.5 text-xs leading-relaxed text-text-dim">This describes the last request this server sent. It is not a live check.</p>
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <Figure label="AI requests today (UTC)" value={whole(today.requests)} hint={outcome(today)} />
        <Figure label="AI requests this month (UTC)" value={whole(month.requests)} hint={outcome(month)} />
        {pricing.known ? (
          <>
            <Figure label="Estimated AI spend today (UTC)" value={formatUsd(today.estimatedSpendUsd)} note="Estimated" hint={`${tokens(today)}.`} />
            <Figure label="Estimated AI spend this month (UTC)" value={formatUsd(month.estimatedSpendUsd)} note="Estimated" hint={`${tokens(month)}.`} />
          </>
        ) : (
          <>
            <Figure label="Tokens today (UTC)" value={whole((today.inputTokens || 0) + (today.outputTokens || 0))} hint={`${tokens(today)}. Spend is not estimated.`} />
            <Figure
              label="Tokens this month (UTC)"
              value={whole((month.inputTokens || 0) + (month.outputTokens || 0))}
              hint={`${tokens(month)}. Spend is not estimated.${month.estimatedSpendUsd > 0 ? ` Requests priced earlier this month: estimated ${formatUsd(month.estimatedSpendUsd)}.` : ''}`}
            />
          </>
        )}
      </dl>

      {!pricing.known && (
        <div data-ai-usage-pricing="unknown">
          <Notice tone="amber">
            Spend cannot be estimated for this model until OPENAI_INPUT_COST_PER_1M_TOKENS and OPENAI_OUTPUT_COST_PER_1M_TOKENS are both set on the server. Token counts are shown instead.
          </Notice>
        </div>
      )}
      {month.unpricedRequests > 0 && (
        <p className="break-words text-xs leading-relaxed text-[#e8b65a]" data-ai-usage-unpriced={month.unpricedRequests}>
          {plural(month.unpricedRequests, 'request', 'requests')} this month could not be priced and {month.unpricedRequests === 1 ? 'is' : 'are'} not in the estimated spend.
        </p>
      )}

      <Budget usage={usage} level={level} />

      <div className="border-t border-line pt-4">
        <DefinitionList
          items={[
            ['Current model', usage.model || 'Not set on the server'],
            ['Last AI request', <LastRequest key="last" last={usage.lastRequest} />],
            ['Price per million tokens', price],
            ['Figures read', formatDateTime(usage.generatedAt)],
          ]}
        />
      </div>

      <p className="border-t border-line pt-4 break-words text-xs leading-relaxed text-text-dim">
        The spend shown here is an internal estimate worked out by ALLSEMIS from token counts and the model's price. It is not the OpenAI account balance and does not include use of the key elsewhere. Days and months are counted in UTC. Opening this panel sends nothing to OpenAI.
      </p>
    </div>
  );
}

export default function AiUsagePanel() {
  const [load, setLoad] = useState({ status: 'loading', usage: null, message: '' });

  // Reads the figures. `alive` is false once the dashboard was left.
  const read = useCallback((alive = () => true) => {
    setLoad({ status: 'loading', usage: null, message: '' });
    aiApi.usage()
      .then((usage) => { if (alive()) setLoad({ status: 'ready', usage, message: '' }); })
      .catch((failure) => { if (alive()) setLoad({ status: 'error', usage: null, message: failure.message }); });
  }, []);

  useEffect(() => {
    let cancelled = false;
    read(() => !cancelled);
    return () => { cancelled = true; };
  }, [read]);

  return (
    <div data-ai-usage="panel" data-ai-usage-state={load.status}>
      <Panel title="AI usage" meta="Estimated by ALLSEMIS from its own record of AI requests. Days and months are UTC.">
        {load.status === 'loading' && <div role="status"><EmptyState title="Loading AI usage" /></div>}
        {load.status === 'error' && (
          <div className="space-y-3">
            <div role="alert"><Notice tone="red">The AI usage figures could not be loaded. {load.message}</Notice></div>
            <Button size="sm" onClick={() => read()}>Try again</Button>
          </div>
        )}
        {load.status === 'ready' && load.usage && <Usage usage={load.usage} />}
      </Panel>
    </div>
  );
}
