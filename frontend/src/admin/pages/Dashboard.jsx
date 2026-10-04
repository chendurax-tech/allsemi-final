import React from 'react';
import { Link } from 'react-router-dom';
import { useAdminStore } from '../store.jsx';
import { PageHeader, Panel, StatCard, StageTrace, Badge, Button, DataTable } from '../components/ui.jsx';
import { APPLICATION_STATUSES } from '../data/recruitment.js';
import { formatDate, formatDateTime } from '../lib/format.js';

/*
  Dashboard - the recruitment operations overview. The application
  pipeline is drawn with the same signal-path figure the ATS screens use
  for their stages, so the admin panel has one recurring visual idea
  taken from the public site's network diagrams.
*/

const PRIORITY_ORDER = { High: 0, Medium: 1, Low: 2 };
const linkCls = 'text-text hover:text-accent transition-colors';

export default function Dashboard() {
  const { state } = useAdminStore();
  const { jobs, candidates, applications, requirements, atsResults, activity, insights, stories, expertise, services, locations } = state;

  const nameOf = (id) => candidates.find((c) => c.id === id)?.name || 'Removed candidate';
  const jobOf = (id) => jobs.find((j) => j.id === id)?.title || 'Removed job';

  const openJobs = jobs.filter((j) => j.status === 'published').length;
  const shortlisted = applications.filter((a) => a.status === 'Shortlisted').length;
  const pendingReview = atsResults.filter((r) => r.review.state === 'Pending review').length;
  const newApplications = applications.filter((a) => a.status === 'New').length;

  const pipeline = APPLICATION_STATUSES.map((status) => {
    const count = applications.filter((a) => a.status === status).length;
    return { label: status, value: count, state: count > 0 && status !== 'Rejected' ? 'done' : 'pending' };
  });

  const recent = [...applications].sort((a, b) => (a.submittedAt < b.submittedAt ? 1 : -1)).slice(0, 6);
  const liveRequirements = requirements
    .filter((r) => r.status !== 'Filled')
    .sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]);
  const atsActivity = activity.filter((entry) => entry.candidateId).slice(0, 6);

  const content = [
    { label: 'Insights', to: '/admin/insights', items: insights },
    { label: 'Stories', to: '/admin/stories', items: stories },
    { label: 'Expertise sectors', to: '/admin/expertise', items: expertise },
    { label: 'Services', to: '/admin/services', items: services },
    { label: 'Jobs', to: '/admin/jobs', items: jobs },
  ].map((row) => ({
    ...row,
    published: row.items.filter((i) => i.status === 'published').length,
    drafts: row.items.filter((i) => i.status !== 'published').length,
  }));

  const offices = locations.filter((l) => l.type === 'office').length;
  const nodes = locations.filter((l) => l.type === 'network').length;

  return (
    <>
      <PageHeader
        eyebrow="Overview"
        title="Recruitment operations"
        description={`${pendingReview} ATS ${pendingReview === 1 ? 'result is' : 'results are'} waiting for a recruiter review, and ${newApplications} new ${newApplications === 1 ? 'application has' : 'applications have'} not been opened.`}
        actions={<Button variant="primary" to="/admin/ats">Review ATS results</Button>}
      />

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard label="Open jobs" value={openJobs} hint={`${jobs.length - openJobs} draft or archived`} tone="lilac" to="/admin/jobs" />
        <StatCard label="Candidates" value={candidates.length} hint="Structured profiles" tone="blue" to="/admin/candidates" />
        <StatCard label="Applications" value={applications.length} hint={`${newApplications} new`} tone="blue" to="/admin/applications" />
        <StatCard label="Shortlisted" value={shortlisted} hint="Ready for client review" tone="teal" to="/admin/applications" />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Panel title="Application pipeline" meta="Applications at each stage right now">
          <StageTrace stages={pipeline} columns="grid-cols-3 lg:grid-cols-6" />
        </Panel>

        <Panel title="Recruitment requirements" meta={`${liveRequirements.length} active`} action={<Button size="sm" to="/admin/requirements">Open</Button>} pad={false}>
          <ul className="divide-y divide-line">
            {liveRequirements.map((r) => (
              <li key={r.id} className="flex items-center gap-3 px-4 py-3 md:px-5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{r.role}</p>
                  <p className="text-xs text-text-dim">{r.openings} {r.openings === 1 ? 'opening' : 'openings'}, {r.location}</p>
                </div>
                <Badge>{r.priority}</Badge>
                <Badge>{r.status}</Badge>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Panel title="Recent applications" action={<Button size="sm" to="/admin/applications">All applications</Button>} pad={false}>
          <DataTable
            rows={recent}
            columns={[
              { key: 'candidate', label: 'Candidate', render: (a) => <Link to={`/admin/candidates/${a.candidateId}`} className={`font-semibold ${linkCls}`}>{nameOf(a.candidateId)}</Link> },
              { key: 'job', label: 'Job', render: (a) => <span className="text-text-dim">{jobOf(a.jobId)}</span> },
              { key: 'status', label: 'Status', render: (a) => <Badge>{a.status}</Badge> },
              { key: 'date', label: 'Submitted', render: (a) => <span className="whitespace-nowrap text-text-dim">{formatDate(a.submittedAt)}</span> },
            ]}
          />
        </Panel>

        <Panel title="ATS activity" meta="Evaluations and recruiter reviews" pad={false}>
          <ul className="divide-y divide-line">
            {atsActivity.map((entry) => (
              <li key={entry.id} className="px-4 py-3 md:px-5">
                <p className="text-sm leading-snug">
                  <Link to={`/admin/ats/${entry.candidateId}?job=${entry.jobId}`} className={`font-semibold ${linkCls}`}>{nameOf(entry.candidateId)}</Link>
                  <span className="text-text-dim">: {entry.action}</span>
                </p>
                <p className="mt-1 text-xs text-text-dim">{entry.actor}, {formatDateTime(entry.at)}</p>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

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

        <Panel title="Engineering network" meta={`${offices} confirmed office, ${nodes} network nodes`} action={<Button size="sm" to="/admin/locations">Manage</Button>} pad={false}>
          <ul className="divide-y divide-line">
            {locations.map((l) => (
              <li key={l.id} className="flex items-center gap-3 px-4 py-3 md:px-5">
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
    </>
  );
}
