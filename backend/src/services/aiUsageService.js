import { env } from '../config/env.js';
import { AiUsage } from '../models/index.js';
import { AI_OPERATIONS, AI_ERROR_CATEGORIES, MODEL_LIST_PRICES } from '../config/constants.js';
import { logger } from '../utils/logger.js';

/*
  The AI usage ledger and the figures the dashboard shows from it.

  Every request this server sends to OpenAI is written down once, by
  recordAiUsage(), from the one place that sends them
  (services/aiService.js). usageSummary() adds the entries up.

  THIS IS AN ESTIMATE KEPT BY ALLSEMIS. The spend is worked out from
  the token counts OpenAI returned with each answer and a price per
  million tokens. It is not read from OpenAI's billing, it is not the
  prepaid balance, and it does not see requests made with the same key
  from anywhere else. No OpenAI administrator key is used or needed.

  Nothing here calls OpenAI. Opening the dashboard costs nothing.
*/

const MILLION = 1_000_000;
const tokens = (value) => (typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.round(value) : null);
// Six decimal places: a single request is a fraction of a cent.
const money = (value) => Math.round(value * MILLION) / MILLION;

/*
  priceFor - the price used for one model, in US dollars per million
  tokens: { input, output, source } or null when none is known.
    CONFIGURED  both OPENAI_*_COST_PER_1M_TOKENS variables are set
    LIST        the list price this code knows for the model
*/
export function priceFor(model, settings = env.aiUsage) {
  if (settings.inputCostPerMillion !== null && settings.outputCostPerMillion !== null) {
    return { input: settings.inputCostPerMillion, output: settings.outputCostPerMillion, source: 'CONFIGURED' };
  }
  const name = String(model || '').toLowerCase();
  for (const [known, price] of Object.entries(MODEL_LIST_PRICES)) {
    if (name === known || name.startsWith(`${known}-20`)) return { ...price, source: 'LIST' };
  }
  return null;
}

/*
  estimateCostUsd - the estimated cost of one request, or null when it
  cannot be estimated (no token counts, or no price for the model).
  Cached input tokens are counted at the full input price, so the
  estimate errs on the high side.
*/
export function estimateCostUsd({ model, inputTokens, outputTokens }, settings = env.aiUsage) {
  const input = tokens(inputTokens);
  const output = tokens(outputTokens);
  if (input === null && output === null) return null;
  const price = priceFor(model, settings);
  if (!price) return null;
  return money(((input ?? 0) * price.input + (output ?? 0) * price.output) / MILLION);
}

const objectId = (value) => (value && /^[a-f0-9]{24}$/i.test(String(value)) ? String(value) : null);

/*
  recordAiUsage - writes one ledger entry. It takes a fixed set of
  fields and nothing else, so no prompt, answer or candidate content
  can reach the ledger even if a caller passed one by mistake. It never
  throws: a ledger that cannot be written must not fail the request it
  describes.
*/
export async function recordAiUsage(entry) {
  try {
    const inputTokens = tokens(entry.inputTokens);
    const outputTokens = tokens(entry.outputTokens);
    const model = typeof entry.model === 'string' && /^[\w.:/-]{1,100}$/.test(entry.model) ? entry.model : '';
    const success = entry.success === true;
    await AiUsage.create({
      at: new Date(),
      operation: AI_OPERATIONS.includes(entry.operation) ? entry.operation : AI_OPERATIONS[0],
      aiModel: model,
      success,
      errorCategory: !success && AI_ERROR_CATEGORIES.includes(entry.errorCategory) ? entry.errorCategory : (success ? '' : 'provider'),
      httpStatus: Number.isInteger(entry.httpStatus) ? entry.httpStatus : null,
      inputTokens,
      outputTokens,
      estimatedCostUsd: estimateCostUsd({ model, inputTokens, outputTokens }),
      durationMs: tokens(entry.durationMs),
      jobId: objectId(entry.jobId),
      candidateId: objectId(entry.candidateId),
      applicationId: objectId(entry.applicationId),
      atsResultId: objectId(entry.atsResultId),
      candidateCount: tokens(entry.candidateCount),
      actorId: objectId(entry.actorId),
      actorName: typeof entry.actorName === 'string' ? entry.actorName.slice(0, 120) : '',
    });
  } catch (error) {
    logger.error('ai.usage_not_recorded', { errorName: error?.name });
  }
}

/*
  usageLevel - the alert level an estimated spend (US dollars) has
  reached: 'critical', 'warning', 'notice' or 'normal'. At or above a
  threshold counts as reaching it; a threshold that is not set (null)
  is never reached. The level only decides what the admin panel says.
  It never limits, delays or refuses an AI request.
*/
export function usageLevel(spendUsd, thresholds = env.aiUsage.alertThresholds) {
  if (typeof spendUsd !== 'number' || !Number.isFinite(spendUsd)) return 'normal';
  for (const level of ['critical', 'warning', 'notice']) {
    const threshold = thresholds[level];
    if (typeof threshold === 'number' && threshold > 0 && spendUsd >= threshold) return level;
  }
  return 'normal';
}

const LEVEL_LABELS = { normal: 'Normal', notice: 'Notice', warning: 'Warning', critical: 'Critical' };
const PERIOD_LABEL = 'this calendar month (UTC)';
const ALERT_MESSAGES = {
  notice: 'AI usage notice: estimated ALLSEMIS AI usage has reached the configured notice threshold.',
  warning: 'AI usage warning: estimated AI usage is high. Check the OpenAI account and add credits if needed.',
  critical: 'AI usage critical: estimated AI usage has reached the configured critical threshold. Check the OpenAI account and add credits if needed.',
};

function totals(entries) {
  const out = { requests: entries.length, succeeded: 0, failed: 0, inputTokens: 0, outputTokens: 0, estimatedSpendUsd: 0, unpricedRequests: 0 };
  for (const entry of entries) {
    if (entry.success) out.succeeded += 1;
    else out.failed += 1;
    out.inputTokens += entry.inputTokens || 0;
    out.outputTokens += entry.outputTokens || 0;
    if (typeof entry.estimatedCostUsd === 'number') out.estimatedSpendUsd += entry.estimatedCostUsd;
    // A request that used tokens but could not be priced.
    else if (entry.inputTokens !== null || entry.outputTokens !== null) out.unpricedRequests += 1;
  }
  out.estimatedSpendUsd = money(out.estimatedSpendUsd);
  return out;
}

const FAILURE_MESSAGES = {
  quota: 'OpenAI refused the last request because the account has no credit left, has reached its spend limit or has no active billing. AI features will keep failing until that is fixed on the OpenAI account. Nothing in recruitment was changed.',
  auth: 'OpenAI did not accept this server\'s key on the last request. Check OPENAI_API_KEY on the server.',
  model: 'OpenAI did not accept the configured model on the last request. Check OPENAI_MODEL on the server.',
  rate_limit: 'OpenAI was busy on the last request. Try again in a few minutes.',
  timeout: 'OpenAI did not answer in time on the last request.',
  network: 'OpenAI could not be reached on the last request.',
  bad_request: 'OpenAI did not accept the last request.',
  provider: 'OpenAI returned an error on the last request.',
  invalid_response: 'The last answer could not be used and nothing was saved.',
  refused: 'The model declined the last request and nothing was saved.',
};

/*
  usageSummary - what the admin dashboard shows. Days and months are
  counted in UTC, as OpenAI's own usage is.

  `service.state`:
    NOT_CONFIGURED   the key or the model is not set
    QUOTA_EXCEEDED   the latest quota or billing refusal has not been
                     followed by a request that worked
    ATTENTION        the last request failed for another reason
    AVAILABLE        the last request worked
    NOT_USED_YET     configured, and nothing has been sent yet
  It describes the last request this server made. It is not a live
  check: reading this never contacts OpenAI.
*/
export async function usageSummary({ now = new Date(), configured, model } = {}) {
  const settings = env.aiUsage;
  const dayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));

  const fields = 'at success errorCategory inputTokens outputTokens estimatedCostUsd';
  const [monthEntries, last, lastSuccess, lastQuota] = await Promise.all([
    AiUsage.find({ at: { $gte: monthStart, $lt: monthEnd } }).select(fields).lean(),
    AiUsage.findOne({}).sort({ at: -1 }),
    AiUsage.findOne({ success: true }).sort({ at: -1 }).select('at'),
    AiUsage.findOne({ success: false, errorCategory: 'quota' }).sort({ at: -1 }).select('at'),
  ]);
  const month = totals(monthEntries);
  const today = totals(monthEntries.filter((entry) => entry.at >= dayStart));

  const quotaExceeded = Boolean(lastQuota && (!lastSuccess || lastSuccess.at < lastQuota.at));
  let state = 'AVAILABLE';
  let message = 'The last AI request worked.';
  if (!configured) {
    state = 'NOT_CONFIGURED';
    message = 'AI is not set up on this server: OPENAI_API_KEY and OPENAI_MODEL are both needed.';
  } else if (quotaExceeded) {
    state = 'QUOTA_EXCEEDED';
    message = FAILURE_MESSAGES.quota;
  } else if (!last) {
    state = 'NOT_USED_YET';
    message = 'AI is set up. No request has been sent yet.';
  } else if (!last.success) {
    state = 'ATTENTION';
    message = FAILURE_MESSAGES[last.errorCategory] || FAILURE_MESSAGES.provider;
  }

  const thresholds = { ...settings.alertThresholds };
  const thresholdLevel = usageLevel(month.estimatedSpendUsd, thresholds);
  // A quota or billing refusal from OpenAI is critical whatever the
  // estimate says: the estimate only knows about requests made from
  // here. It is OpenAI refusing, not ALLSEMIS.
  const level = quotaExceeded ? 'critical' : thresholdLevel;
  const price = priceFor(model, settings);
  let alertMessage = null;
  if (quotaExceeded) alertMessage = `AI usage critical: ${FAILURE_MESSAGES.quota} Check the OpenAI account and add credits if needed.`;
  else if (level !== 'normal') alertMessage = ALERT_MESSAGES[level];

  return {
    // Said in the data as well as on the page: these are estimates.
    estimated: true,
    currency: 'USD',
    timeZone: 'UTC',
    generatedAt: now,
    model: model || null,
    service: { state, message, quotaExceeded },
    today: { ...today, from: dayStart },
    month: { ...month, from: monthStart, to: monthEnd },
    // The AI usage alert. Informational only: AI requests are never
    // limited by it. `key` is the same for as long as the level and the
    // period stay the same, so the admin panel shows one alert per
    // level reached in a period, however many requests follow.
    alert: {
      level,
      levelLabel: LEVEL_LABELS[level],
      reason: quotaExceeded ? 'quota' : (level === 'normal' ? null : 'threshold'),
      message: alertMessage,
      thresholdsSet: Object.values(thresholds).some((value) => value !== null),
      thresholds,
      measuredUsd: month.estimatedSpendUsd,
      period: { label: PERIOD_LABEL, from: monthStart, to: monthEnd },
      key: `${monthStart.toISOString().slice(0, 7)}:${level}${quotaExceeded ? ':quota' : ''}`,
    },
    pricing: price
      ? { known: true, source: price.source, inputPerMillionUsd: price.input, outputPerMillionUsd: price.output }
      : { known: false, source: null, inputPerMillionUsd: null, outputPerMillionUsd: null },
    lastRequest: last ? last.toJSON() : null,
  };
}
