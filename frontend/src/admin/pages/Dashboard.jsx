import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { auditApi } from '../../lib/api/index.js';
import { useAdminStore } from '../store.jsx';
import { useAuth } from '../auth.jsx';
import { PageHeader, Panel, StatCard, StageTrace, Badge, Button, DataTable, EmptyState, Notice } from '../components/ui.jsx';
import { RECRUITMENT_LABELS, label } from '../data/enums.js';
import { formatDate, formatDateTime } from '../lib/format.js';
import AiUsagePanel from '../components/AiUsagePanel.jsx';

/*
  Dashboard - the overview for the signed-in role. Every card and panel
  is drawn only from data that role may read: a recruiter sees
  recruitment operations, a content manager sees the website content
  and no candidate data at all. The API would refuse the rest anyway;
  the store never asks for it.

  The application pipeline is drawn with the same signal-path figure
  the ATS screens use for their stages, so the admin panel has one
  recurring visual idea taken from the public site's network diagrams.

  A role that may run the ATS also sees "AI usage": how many AI
  requests the server sent today and this month and what they are
  estimated to have cost (components/AiUsagePanel.jsx). The panel reads
  the server's own record. The dashboard never starts an AI request.
*/

const PRIORITY_ORDER = { HIGH: 0, MEDIUM: 1, LOW: 2 };
const linkCls = 'text-text hover:text-accent transition-colors';
const count = (n, one, many) => `${n} ${n === 1 ? one : many}`;

// The audit log, newest first. Only a role with audit:read asks for it.
function Activity() {
  const [load, setLoad] = useState({ status: 'loading', items: [], message: '' });

  useEffect(() => {
    let cancelled = false;
    auditApi.list({ limit: 8 })
      .then(({ items }) => { if (!cancelled) setLoad({ status: 'ready', items, message: '' }); })
      .catch((failure) => { if (!cancelled) setLoad({ status: 'error', items: [], message: failure.message }); });
    return () => { cancelled = true; };
  }, []);

  return (
    <Panel title="Recent activity" meta="From the audit log" pad={false}>
      {load.status === 'loading' && <div role="status"><EmptyState title="Loading activity" /></div>}
      {load.status === 'error' && <div className="p-4 md:p-5" role="alert"><Notice tone="red">{load.message}</Notice></div>}
      {load.status === 'ready' && load.items.length === 0 && <EmptyState title="Nothing recorded yet" />}
      {load.items.length > 0 && (
        <ul className="divide-y divide-line">
          {load.items.map((entry) => (
            <li key={entry.id} className="px-4 py-3 md:px-5">
              <p className="text-sm leading-snug break-words">{entry.summary || entry.action}</p>
              <p className="mt-1 text-xs text-text-dim">{entry.actorName}, {formatDateTime(entry.at)}</p>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

export default function Dashboard() {
  const { state, status } = useAdminStore();
  const { can, user } = useAuth();
  const { jobs, candidates, applications, requirements, atsResults, insights, stories, expertise, services, locations } = state;

  const sees = {
    jobs: can('jobs:read'),
    candidates: can('candidates:read'),
    applications: can('applications:read'),
    requirements: can('requirements:read'),
    ats: can('ats:read'),
    content: can('content:read'),
    audit: can('audit:read'),
    aiUsage: can('ats:run'),
  };
  const recruitment = sees.applications || sees.candidates;

  const nameOf = (id) => candidates.find((c) => c.id === id)?.name || 'Removed candidate';
  const jobOf = (id) => (id ? jobs.find((j) => j.id === id)?.title || 'Removed job' : 'General application');

  const openJobs = jobs.filter((j) => j.status === 'published').length;
  const shortlisted = applications.filter((a) => a.status === 'SHORTLISTED').length;
  const pendingReview = atsResults.filter((r) => r.review.state === 'PENDING').length;
  const newApplications = applications.filter((a) => a.status === 'NEW').length;

  // The whole workflow: an application is New until a recruiter
  // shortlists it. The label counts beside it are tags, not stages.
  const pipeline = [
    { label: 'New', value: newApplications, sub: 'Waiting for a decision', state: newApplications > 0 ? 'current' : 'pending' },
    { label: 'Shortlisted', value: shortlisted, sub: 'Decided by a recruiter', state: shortlisted > 0 ? 'done' : 'pending' },
  ];
  const labelled = RECRUITMENT_LABELS.map((name) => ({ name, total: applications.filter((a) => (a.labels || []).includes(name)).length }));

  const recent = [...applications].sort((a, b) => (a.submittedAt < b.submittedAt ? 1 : -1)).slice(0, 6);
  const liveRequirements = requirements
    .filter((r) => r.status !== 'CLOSED')
    .sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]);

  const content = [
    sees.content && { label: 'Insights', to: '/admin/insights', items: insights },
    sees.content && { label: 'Stories', to: '/admin/stories', items: stories },
    sees.content && { label: 'Expertise sectors', to: '/admin/expertise', items: expertise },
    sees.content && { label: 'Services', to: '/admin/services', items: services },
    sees.jobs && { label: 'Jobs', to: '/admin/jobs', items: jobs },
  ].filter(Boolean).map((row) => ({
    ...row,
    published: row.items.filter((i) => i.status === 'published').length,
    drafts: row.items.filter((i) => i.status !== 'published').length,
  }));

  const offices = locations.filter((l) => l.type === 'office').length;
  const nodes = locations.filter((l) => l.type === 'network').length;
  const published = (items) => items.filter((i) => i.status === 'published').length;

  // What the header says depends on what the role works with.
  let description = `Signed in as ${user.name}.`;
  if (sees.ats && sees.applications) {
    description = `${count(pendingReview, 'ATS result is', 'ATS results are')} waiting for a recruiter review, and ${count(newApplications, 'application is', 'applications are')} still marked new.`;
  } else if (sees.content) {
    description = `${count(published(insights), 'article', 'articles')} and ${count(published(stories), 'story', 'stories')} are published. Drafts are never shown on the site.`;
  }

  const loading = Object.values(status).some((value) => value === 'loading');
  const failed = Object.entries(status).filter(([, value]) => value === 'error').map(([name]) => name);

  return (
    <>
      <PageHeader
        eyebrow="Overview"
        title={recruitment ? 'Recruitment operations' : 'Website content'}
        description={loading ? 'Reading the latest records from the database.' : description}
        actions={sees.ats ? <Button variant="primary" to="/admin/ats">Review ATS results</Button> : null}
      />

      {failed.length > 0 && (
        <div className="mb-6" role="alert">
          <Notice tone="red">Some records could not be loaded ({failed.join(', ')}), so the figures below are incomplete. Open the section and use "Try again".</Notice>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {sees.jobs && <StatCard label="Open jobs" value={openJobs} hint={`${jobs.length - openJobs} draft or archived`} tone="lilac" to="/admin/jobs" />}
        {sees.candidates && <StatCard label="Candidates" value={candidates.length} hint="Profiles on record" tone="blue" to="/admin/candidates" />}
        {sees.applications && <StatCard label="Applications" value={applications.length} hint={`${newApplications} new`} tone="blue" to="/admin/applications" />}
        {sees.applications && <StatCard label="Shortlisted" value={shortlisted} hint="Applications a recruiter shortlisted" tone="teal" to="/admin/applications" />}
        {!recruitment && sees.content && (
          <>
            <StatCard label="Published articles" value={published(insights)} hint={`${insights.length - published(insights)} in draft`} tone="blue" to="/admin/insights" />
            <StatCard label="Published stories" value={published(stories)} hint={`${stories.length - published(stories)} in draft`} tone="teal" to="/admin/stories" />
            <StatCard label="Expertise sectors" value={expertise.length} hint={`${published(expertise)} published`} tone="amber" to="/admin/expertise" />
          </>
        )}
      </div>

      {(sees.applications || sees.requirements) && (
        <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          {sees.applications && (
            <Panel title="Applications" meta="New, then shortlisted by a recruiter">
              <StageTrace stages={pipeline} columns="grid-cols-2" />
              <div className="mt-6 border-t border-line pt-4">
                <p className="font-mono text-[0.65rem] uppercase tracking-[0.14em] text-text-dim">Labels on applications</p>
                <ul className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-sm">
                  {labelled.map(({ name, total }) => <li key={name}><span className="font-semibold tabular-nums">{total}</span> <span className="text-text-dim">{label(name)}</span></li>)}
                </ul>
                <p className="mt-2 text-xs leading-relaxed text-text-dim">Labels are tags for filtering. They are not stages and change nothing.</p>
              </div>
            </Panel>
          )}

          {sees.requirements && (
            <Panel title="Recruitment requirements" meta={`${liveRequirements.length} not closed`} action={<Button size="sm" to="/admin/requirements">Open</Button>} pad={false}>
              {liveRequirements.length === 0 ? <EmptyState title="No open requirements" /> : (
                <ul className="divide-y divide-line">
                  {liveRequirements.map((r) => (
                    <li key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 md:px-5">
                      <div className="min-w-0 flex-1 basis-40">
                        <p className="truncate text-sm font-semibold">{r.role}</p>
                        <p className="truncate text-xs text-text-dim">{[count(r.positions, 'position', 'positions'), r.location].filter(Boolean).join(', ')}</p>
                      </div>
                      <Badge>{label(r.priority)}</Badge>
                      <Badge>{label(r.status)}</Badge>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          )}
        </div>
      )}

      {(sees.applications || sees.audit) && (
        <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          {sees.applications && (
            <Panel title="Recent applications" action={<Button size="sm" to="/admin/applications">All applications</Button>} pad={false}>
              <DataTable
                rows={recent}
                empty={<EmptyState title="No applications yet">Applications sent through the website appear here.</EmptyState>}
                columns={[
                  { key: 'candidate', label: 'Candidate', render: (a) => <Link to={`/admin/candidates/${a.candidateId}`} className={`font-semibold ${linkCls}`}>{nameOf(a.candidateId)}</Link> },
                  { key: 'job', label: 'Job', render: (a) => <span className="text-text-dim">{jobOf(a.jobId)}</span> },
                  { key: 'status', label: 'Status', render: (a) => <Badge>{label(a.status)}</Badge> },
                  { key: 'date', label: 'Submitted', render: (a) => <span className="whitespace-nowrap text-text-dim">{formatDate(a.submittedAt)}</span> },
                ]}
              />
            </Panel>
          )}

          {sees.audit && <Activity />}
        </div>
      )}

      {sees.aiUsage && (
        <div className="mt-6">
          <AiUsagePanel />
        </div>
      )}

      {sees.content && (
        <div className="mt-6 grid gap-6 xl:grid-cols-2">
          <Panel title="Website content" meta="What is published and what is still a draft" pad={false}>
            <ul className="divide-y divide-line">
              {content.map((row) => (
                <li key={row.label} className="flex items-center gap-4 px-4 py-3 md:px-5">
                  <Link to={row.to} className={`min-w-0 flex-1 truncate text-sm font-semibold ${linkCls}`}>{row.label}</Link>
                  <span className="text-xs text-text-dim tabular-nums">{row.published} published</span>
                  <span className={`w-20 text-right text-xs tabular-nums ${row.drafts ? 'text-[#e8b65a]' : 'text-text-dim'}`}>{row.drafts} not live</span>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel title="Engineering network" meta={`${count(offices, 'confirmed office', 'confirmed offices')}, ${count(nodes, 'network node', 'network nodes')}`} action={<Button size="sm" to="/admin/locations">Manage</Button>} pad={false}>
            <ul className="divide-y divide-line">
              {locations.map((l) => (
                <li key={l.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 md:px-5">
                  <span className={`h-2 w-2 shrink-0 rounded-full ${l.type === 'office' ? 'bg-turquoise' : 'bg-accent'}`} aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{l.city}</p>
                    <p className="text-xs text-text-dim">{l.country}</p>
                  </div>
                  <Badge>{l.type}</Badge>
                  <Badge>{l.active ? 'Shown' : 'Hidden'}</Badge>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      )}
    </>
  );
}
