import React, { useCallback, useEffect, useState } from 'react';
import { jobsApi } from '../../lib/api/index.js';
import { useAdminStore } from '../store.jsx';
import { useAuth } from '../auth.jsx';
import { useNotify } from './Feedback.jsx';
import { Panel, Badge, Button, Notice, DefinitionList, EmptyState } from './ui.jsx';
import { label } from '../data/enums.js';
import { formatDate, formatDateTime } from '../lib/format.js';

/*
  The synchronisation from the official job source, on the Jobs page:
  the configured source, the recent runs with their counts, and "Sync
  now". The company's own postings are the source of truth; a synced
  job is created, updated and closed by the sync, never by hand.
*/

const STATUS_TONE = { SUCCEEDED: 'teal', PARTIAL: 'amber', FAILED: 'red', RUNNING: 'blue' };

export function JobSyncPanel() {
  const { reload } = useAdminStore();
  const { can } = useAuth();
  const notify = useNotify();
  const [view, setView] = useState({ status: 'loading', data: null, message: '' });
  const [running, setRunning] = useState(false);

  const load = useCallback(async () => {
    try {
      setView({ status: 'ready', data: await jobsApi.syncStatus(), message: '' });
    } catch (failure) {
      setView({ status: 'error', data: null, message: failure.message });
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  async function syncNow() {
    setRunning(true);
    try {
      const run = await jobsApi.syncNow();
      if (run.skipped) notify({ tone: 'info', message: run.reason });
      else if (run.status === 'FAILED') notify({ tone: 'error', message: `The sync could not read the source: ${run.failure} Nothing was changed.` });
      else notify({ tone: run.status === 'PARTIAL' ? 'info' : 'success', message: `Synced: ${run.counts.created} new, ${run.counts.updated} updated, ${run.counts.closed} closed, ${run.counts.unchanged} unchanged${run.counts.invalid ? `, ${run.counts.invalid} invalid` : ''}.` });
      reload('jobs');
      await load();
    } catch (failure) {
      notify({ tone: 'error', message: failure.message });
    }
    setRunning(false);
  }

  if (view.status === 'loading') return <Panel title="Job synchronisation"><div role="status"><EmptyState title="Loading the sync status" /></div></Panel>;
  if (view.status === 'error') return <Panel title="Job synchronisation"><div role="alert"><Notice tone="red">{view.message}</Notice></div></Panel>;
  const { source, runs } = view.data;
  const last = runs[0];

  return (
    <Panel
      title="Job synchronisation"
      meta="Jobs from the official company job source are created, updated and closed automatically."
      action={source.configured && can('jobs:write') ? <Button size="sm" onClick={syncNow} disabled={running} aria-busy={running}>{running ? 'Syncing' : 'Sync now'}</Button> : null}
    >
      {!source.configured ? (
        <Notice tone="blue">No official job source is configured, so every job here is entered by hand. To synchronise automatically, set JOB_SYNC_SOURCE_URL (and JOB_SYNC_SOURCE_TYPE) on the server: see backend/docs/JOB-SYNC.md.</Notice>
      ) : (
        <div className="space-y-4">
          <DefinitionList
            items={[
              ['Source', source.name],
              ['Address', <span key="url" className="break-all">{source.url}</span>],
              ['Schedule', source.everyMinutes ? `Every ${source.everyMinutes} minutes` : 'On demand or by an external scheduler'],
              ['Last run', last ? `${formatDateTime(last.startedAt)}, ${label(last.status)}` : 'Not run yet'],
            ]}
          />
          {last?.failure && <Notice tone="red">The last run could not read the source: {last.failure} Nothing was changed.</Notice>}
          {runs.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-xs">
                <thead>
                  <tr className="border-b border-line text-left font-mono uppercase tracking-[0.12em] text-text-dim">
                    <th scope="col" className="py-2 pr-3 font-medium">Run</th>
                    <th scope="col" className="py-2 pr-3 font-medium">Result</th>
                    <th scope="col" className="py-2 pr-3 font-medium">New</th>
                    <th scope="col" className="py-2 pr-3 font-medium">Updated</th>
                    <th scope="col" className="py-2 pr-3 font-medium">Closed</th>
                    <th scope="col" className="py-2 pr-3 font-medium">Unchanged</th>
                    <th scope="col" className="py-2 font-medium">Invalid</th>
                  </tr>
                </thead>
                <tbody>
                  {runs.slice(0, 8).map((run) => (
                    <tr key={run.id} className="border-b border-line last:border-0">
                      <td className="py-2 pr-3 whitespace-nowrap">{formatDate(run.startedAt)} <span className="text-text-dim">{label(run.trigger)}</span></td>
                      <td className="py-2 pr-3"><Badge tone={STATUS_TONE[run.status]}>{label(run.status)}</Badge></td>
                      <td className="py-2 pr-3 tabular-nums">{run.counts.created}</td>
                      <td className="py-2 pr-3 tabular-nums">{run.counts.updated}</td>
                      <td className="py-2 pr-3 tabular-nums">{run.counts.closed}</td>
                      <td className="py-2 pr-3 tabular-nums">{run.counts.unchanged}</td>
                      <td className="py-2 tabular-nums">{run.counts.invalid}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {last?.errors?.length > 0 && (
            <details>
              <summary className="cursor-pointer text-xs text-text-dim">{last.errors.length} {last.errors.length === 1 ? 'record' : 'records'} skipped in the last run</summary>
              <ul className="mt-2 space-y-1 text-xs text-text-dim">
                {last.errors.map((error, i) => <li key={i}>{error.sourceJobId ? `${error.sourceJobId}: ` : ''}{error.message}</li>)}
              </ul>
            </details>
          )}
          {(last?.notes || []).map((note) => <Notice key={note} tone="amber">{note}</Notice>)}
        </div>
      )}
    </Panel>
  );
}

const SYNC_TONE = { ACTIVE: 'teal', MISSING: 'amber', CLOSED: 'dim' };
const SYNC_WORD = { ACTIVE: 'On the source', MISSING: 'Missing from the source', CLOSED: 'Closed at the source' };

// The job's origin, on the job page.
export function JobSourcePanel({ job }) {
  if (!job) return null;
  const imported = Boolean(job.sourceJobId && job.source && job.source !== 'manual');
  if (!imported) {
    return (
      <Panel title="Official job" meta="Where this job comes from">
        <p className="text-sm text-text-dim">Entered in the ALLSEMIS admin. It is not linked to a company job source.</p>
      </Panel>
    );
  }
  return (
    <Panel title="Official job" meta="Imported from the company's job source, which is its source of truth">
      <DefinitionList
        items={[
          ['Source', job.source],
          ['Source job ID', job.sourceJobId],
          ['Official posting', job.sourceUrl ? <a key="u" href={job.sourceUrl} target="_blank" rel="noopener noreferrer" className="break-all text-accent hover:text-accent-2">{job.sourceUrl}</a> : 'Not given by the source'],
          ['Last synchronised', formatDateTime(job.lastSyncedAt)],
          ['Updated at the source', job.sourceUpdatedAt ? formatDateTime(job.sourceUpdatedAt) : 'Not stated'],
          ['Sync state', <Badge key="s" tone={SYNC_TONE[job.syncStatus] || 'dim'}>{SYNC_WORD[job.syncStatus] || 'Unknown'}{job.syncStatus === 'MISSING' ? ` (${job.missingCount}×)` : ''}</Badge>],
        ]}
      />
      <p className="mt-4 text-xs text-text-dim leading-relaxed">The title, description, skills, location, level and type come from the official posting and change only there; the next sync brings a change in. Status, featured and keywords are decided in ALLSEMIS.</p>
    </Panel>
  );
}
