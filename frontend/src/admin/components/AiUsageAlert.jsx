import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { aiApi } from '../../lib/api/admin.js';
import { useAuth } from '../auth.jsx';
import { Notice, cx } from './ui.jsx';

/*
  AiUsageAlert - the AI usage alert at the top of every admin screen,
  for a role that may start an AI request (ats:run).

  It reads GET /api/admin/ai/usage, the server's own estimate of what
  the AI requests sent from ALLSEMIS cost in the current usage period
  (this calendar month, UTC). When that estimate reaches one of the
  alert thresholds set on the server (AI_USAGE_NOTICE_USD,
  AI_USAGE_WARNING_USD, AI_USAGE_CRITICAL_USD), or OpenAI refused a
  request for a quota or billing reason, it says so here, so nobody has
  to open the dashboard to find out.

  The alert is information only. It never stops, delays or refuses an
  AI request: ALLSEMIS uses OpenAI pay-as-you-go and has no budget. It
  is an estimate, not the OpenAI account balance.

  One alert per level and period: the server gives each a key (the
  period and the level). A dismissed key stays dismissed in this
  browser for this user, so the same threshold does not come back with
  every request; a new level or a new period shows again. The figures
  are read when the admin opens, when the screen changes (at most once
  a minute) and every ten minutes. Reading them never contacts OpenAI.
*/

const REFRESH_MS = 10 * 60 * 1000;
const MIN_GAP_MS = 60 * 1000;
const TONES = { notice: 'blue', warning: 'amber', critical: 'red' };
const TITLES = { notice: 'AI usage notice', warning: 'AI usage warning', critical: 'AI usage critical' };

const storageKey = (userId) => `allsemis-ai-alert-dismissed:${userId || 'user'}`;
function readDismissed(userId) {
  try {
    return window.localStorage.getItem(storageKey(userId)) || '';
  } catch {
    return '';
  }
}
function writeDismissed(userId, key) {
  try {
    window.localStorage.setItem(storageKey(userId), key);
  } catch {
    // Storage blocked: dismissed for this visit only.
  }
}

const usd = (value) => (typeof value === 'number' && Number.isFinite(value)
  ? `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  : null);

export default function AiUsageAlert() {
  const { user, can } = useAuth();
  const { pathname } = useLocation();
  const allowed = can('ats:run');
  const [alert, setAlert] = useState(null);
  const [dismissed, setDismissed] = useState(() => readDismissed(user?.id));
  const lastRead = useRef(0);

  const read = useCallback(() => {
    if (!allowed) return;
    lastRead.current = Date.now();
    aiApi.usage()
      .then((usage) => setAlert(usage?.alert || null))
      // A failed read shows nothing here; the dashboard panel reports it.
      .catch(() => {});
  }, [allowed]);

  useEffect(() => {
    read();
    const timer = setInterval(read, REFRESH_MS);
    return () => clearInterval(timer);
  }, [read]);

  useEffect(() => {
    if (Date.now() - lastRead.current >= MIN_GAP_MS) read();
  }, [pathname, read]);

  if (!allowed || !alert || !alert.message || !TONES[alert.level] || alert.key === dismissed) return null;

  const dismiss = () => {
    writeDismissed(user?.id, alert.key);
    setDismissed(alert.key);
  };
  const threshold = alert.reason === 'threshold' ? usd(alert.thresholds?.[alert.level]) : null;
  const measured = usd(alert.measuredUsd);

  return (
    <div className="mb-6" data-ai-usage-alert={alert.level} role={alert.level === 'notice' ? 'status' : 'alert'}>
      <Notice tone={TONES[alert.level]}>
        <span className="flex flex-wrap items-start gap-x-4 gap-y-2">
          <span className="min-w-0 flex-1">
            <span className="block font-mono text-[0.62rem] uppercase tracking-[0.14em]">{TITLES[alert.level]}</span>
            <span className="mt-1 block text-sm font-semibold leading-snug">{alert.message}</span>
            {alert.reason === 'threshold' && (
              <span className="mt-1 block text-text-dim">
                Estimated usage {alert.period?.label || 'this calendar month (UTC)'}: {measured}
                {threshold ? `, alert threshold ${threshold}` : ''}. This is an estimate of requests sent from ALLSEMIS, not the OpenAI balance. AI keeps working.
              </span>
            )}
          </span>
          <button
            type="button"
            onClick={dismiss}
            className={cx('shrink-0 font-mono text-[0.62rem] uppercase tracking-[0.14em] text-text-dim transition-colors hover:text-text focus:outline-none focus-visible:text-accent')}
          >
            Dismiss
          </button>
        </span>
      </Notice>
    </div>
  );
}
