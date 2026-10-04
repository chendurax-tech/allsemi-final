import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAdminStore } from '../store.jsx';
import { PageHeader, Panel, Badge, Button, Chip, EmptyState, DefinitionList, Notice } from '../components/ui.jsx';
import { formatDate, formatDateTime } from '../lib/format.js';

/*
  CandidateDetail - the structured candidate profile produced by resume
  extraction, with the resume record, applications and ATS results
  beside it. Deleting a candidate removes the profile and everything
  linked to it.
*/
export default function CandidateDetail({ id }) {
  const { state, remove } = useAdminStore();
  const navigate = useNavigate();
  const candidate = state.candidates.find((c) => c.id === id);

  if (!candidate) {
    return (
      <Panel>
        <EmptyState title="This candidate was not found">The profile may have been deleted in this session.</EmptyState>
        <div className="flex justify-center pb-4"><Button to="/admin/candidates">Back to candidates</Button></div>
      </Panel>
    );
  }

  const applications = state.applications.filter((a) => a.candidateId === id);
  const results = state.atsResults.filter((r) => r.candidateId === id);
  const jobOf = (jobId) => state.jobs.find((j) => j.id === jobId)?.title || 'Removed job';

  function destroy() {
    if (!window.confirm(`Delete ${candidate.name}? The profile, resume, applications and ATS results are removed. This cannot be undone.`)) return;
    applications.forEach((a) => remove('applications', a.id));
    results.forEach((r) => remove('atsResults', r.id));
    remove('candidates', id);
    navigate('/admin/candidates');
  }

  return (
    <>
      <PageHeader
        eyebrow="Recruitment / Candidates"
        title={candidate.name}
        description={`${candidate.headline}, ${candidate.location}`}
        actions={(
          <>
            <Button variant="ghost" to="/admin/candidates">Back to candidates</Button>
            <Button variant="primary" to={`/admin/ats/${id}`}>Open ATS results</Button>
          </>
        )}
      />

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-6 min-w-0">
          <Panel title="Structured profile" meta="Created by resume extraction. Check it against the resume before relying on it.">
            <p className="mb-5 text-sm leading-relaxed">{candidate.summary}</p>
            <DefinitionList
              items={[
                ['Experience', `${candidate.experienceYears} years`],
                ['Location', candidate.location],
                ['Email', candidate.email],
                ['Phone', candidate.phone],
                ['Source', candidate.source],
                ['Added', formatDate(candidate.createdAt)],
              ]}
            />
          </Panel>

          <Panel title="Skills" meta={`${candidate.skills.length} extracted`}>
            <div className="flex flex-wrap gap-2">
              {candidate.skills.map((skill) => <Chip key={skill} tone="blue">{skill}</Chip>)}
            </div>
          </Panel>

          <Panel title="Experience">
            <ol className="space-y-5">
              {candidate.experience.map((role) => (
                <li key={role.title + role.period} className="border-l border-line-strong pl-4">
                  <p className="text-sm font-semibold">{role.title}</p>
                  <p className="text-xs text-text-dim">{role.employer}, {role.period}</p>
                  <ul className="mt-2 space-y-1">
                    {role.highlights.map((h) => <li key={h} className="text-sm text-text-dim leading-relaxed">{h}</li>)}
                  </ul>
                </li>
              ))}
            </ol>
          </Panel>

          <Panel title="Education">
            <ul className="space-y-3">
              {candidate.education.map((e) => (
                <li key={e.degree}>
                  <p className="text-sm font-semibold">{e.degree}</p>
                  <p className="text-xs text-text-dim">{e.institution}, {e.year}</p>
                </li>
              ))}
            </ul>
          </Panel>
        </div>

        <div className="space-y-6 min-w-0">
          <Panel title="Resume">
            <p className="break-all text-sm font-semibold">{candidate.resume.fileName}</p>
            <p className="mt-1 text-xs text-text-dim">{candidate.resume.pages} pages, uploaded {formatDateTime(candidate.resume.uploadedAt)}</p>
            <div className="mt-3"><Badge>{candidate.resume.extraction}</Badge></div>
            <div className="mt-4"><Button disabled>Open resume</Button></div>
            <p className="mt-3 text-xs text-text-dim leading-relaxed">
              Resumes are kept in private storage and each access is recorded. Opening files becomes available when the backend is connected.
            </p>
          </Panel>

          <Panel title="Applications" meta={`${applications.length} total`} pad={false}>
            {applications.length === 0 ? <EmptyState title="No applications" /> : (
              <ul className="divide-y divide-line">
                {applications.map((a) => (
                  <li key={a.id} className="flex items-center gap-3 px-4 py-3 md:px-5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{jobOf(a.jobId)}</p>
                      <p className="text-xs text-text-dim">{a.source}, {formatDate(a.submittedAt)}</p>
                    </div>
                    <Badge>{a.status}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="ATS results" meta={`${results.length} evaluations`} pad={false}>
            {results.length === 0 ? <EmptyState title="Not evaluated yet">An evaluation runs when an application is matched to a job.</EmptyState> : (
              <ul className="divide-y divide-line">
                {results.map((r) => (
                  <li key={r.id}>
                    <Link to={`/admin/ats/${id}?job=${r.jobId}`} className="flex items-center gap-3 px-4 py-3 md:px-5 hover:bg-accent/[0.06] transition-colors">
                      <span className="font-display text-xl font-semibold tabular-nums w-9">{r.overall}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold">{jobOf(r.jobId)}</span>
                        <span className="block text-xs text-text-dim">{r.review.state}</span>
                      </span>
                      <Badge>{r.band}</Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Delete candidate">
            <Notice tone="red">Removes the profile, the resume, every application and every ATS result for this person.</Notice>
            <div className="mt-4"><Button variant="danger" onClick={destroy}>Delete candidate</Button></div>
          </Panel>
        </div>
      </div>
    </>
  );
}
