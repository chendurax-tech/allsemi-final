import React, { useEffect, useId, useRef, useState } from 'react';
import { useSeo, breadcrumbJsonLd, jobPostingJsonLd } from '../../lib/seo.js';
import { Link, useParams, useSearchParams, Navigate } from 'react-router-dom';
import {
  useInView, MeasurementLabel, TechnicalGrid,
} from '../../lib/motionPrimitives.jsx';
import { relatedJobs } from './jobsContent.js';
import { useJob, useJobs } from '../../lib/usePublicData.js';
import ApplicationForm from '../../components/forms/ApplicationForm.jsx';

/*
  JobDetail - one open position (route: /talent/jobs/:slug).

  The job is loaded from the backend by its slug (useJob -> GET
  /api/public/jobs/:slug), which answers only for published jobs. A
  slug with no published job behind it redirects to /talent. If the
  request itself fails the page says so and offers a retry. Related
  positions are picked from the published list (useJobs).

  Apply opens ApplyModal, the application overlay, for this job. When
  the job has applications switched off in the admin
  (applicationEnabled: false) the Apply buttons are replaced by a
  notice, matching the backend, which refuses such an application.
*/
export default function JobDetail() {
  const { slug } = useParams();
  const { status, job, reload } = useJob(slug);
  const { jobs } = useJobs();
  const [applyOpen, setApplyOpen] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();

  // The head of a published job, with JobPosting structured data when
  // its location names a place (see jobPostingJsonLd).
  useSeo(job ? {
    title: `${job.title}${job.location ? `, ${job.location}` : ''} | ALLSEMIS Jobs`,
    description: job.summary || `${job.title}: ${[job.employmentType, job.experienceLevel, job.location].filter(Boolean).join(', ')}. Apply with ALLSEMIS.`,
    path: `/talent/jobs/${job.slug}`,
    jsonLd: [
      breadcrumbJsonLd([{ name: 'Home', path: '/' }, { name: 'Talent', path: '/talent' }, { name: job.title, path: `/talent/jobs/${job.slug}` }]),
      jobPostingJsonLd(job),
    ],
  } : null);

  // "?apply=1" (the Apply link of the website assistant) opens the same
  // application overlay as the Apply Now button, once, for a job that
  // accepts applications. The parameter is then removed, so closing the
  // overlay or reloading does not open it again.
  useEffect(() => {
    if (!job || searchParams.get('apply') !== '1') return;
    if (job.applicationEnabled) setApplyOpen(true);
    const next = new URLSearchParams(searchParams);
    next.delete('apply');
    setSearchParams(next, { replace: true });
  }, [job, searchParams, setSearchParams]);

  if (status === 'missing') return <Navigate to="/talent" replace />;
  if (status !== 'ready') return <JobPending loading={status === 'loading'} onRetry={reload} />;

  const related = relatedJobs(jobs, job, 3);

  return (
    <>
      <JobHero job={job} onApply={() => setApplyOpen(true)} />
      <JobBody job={job} />
      {related.length > 0 && <RelatedJobs jobs={related} />}
      <JobDetailCta open={job.applicationEnabled} onApply={() => setApplyOpen(true)} />
      {applyOpen && <ApplyModal job={job} onClose={() => setApplyOpen(false)} />}
    </>
  );
}

const CLOSED_NOTICE = 'Applications are closed for this position.';

// The page while the job is loading, or when it could not be loaded.
// It keeps the hero's frame and the way back to the list.
function JobPending({ loading, onRetry }) {
  return (
    <section className="relative border-b border-line pt-24 md:pt-32 pb-14 md:pb-16 overflow-hidden min-h-[70vh]">
      <TechnicalGrid className="opacity-[0.05]" />
      <div className="relative max-w-4xl mx-auto px-5 md:px-10">
        <Link to="/talent" className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-accent hover:text-accent-2 transition-colors mb-6">
          ← All Positions
        </Link>
        {loading ? (
          <div role="status">
            <span className="sr-only">Loading position</span>
            <div className="animate-pulse motion-reduce:animate-none" aria-hidden="true">
              <div className="h-9 md:h-12 w-3/4 max-w-xl bg-line-strong" />
              <div className="h-2 w-64 max-w-full bg-line-strong mt-8" />
              <div className="h-3 w-full max-w-2xl bg-line mt-8" />
              <div className="h-3 w-2/3 max-w-xl bg-line mt-3" />
            </div>
          </div>
        ) : (
          <div role="alert">
            <p className="text-base md:text-lg text-text-dim leading-relaxed mb-6">This position could not be loaded.</p>
            <button onClick={onRetry} className="font-mono text-xs uppercase tracking-widest text-accent hover:text-accent-2 transition-colors px-4 py-2 border border-accent/40">
              Try again
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

function JobHero({ job, onApply }) {
  const [ref, inView] = useInView(0.01);
  return (
    <section ref={(el) => { ref.current = el; }} className="relative border-b border-line pt-24 md:pt-32 pb-14 md:pb-16 overflow-hidden">
      <TechnicalGrid className="opacity-[0.05]" />
      <div className="relative max-w-4xl mx-auto px-5 md:px-10">
        <Link to="/talent" className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-accent hover:text-accent-2 transition-colors mb-6">
          ← All Positions
        </Link>
        <h1
          className={`font-display font-bold text-3xl sm:text-4xl md:text-5xl tracking-tight leading-[1.05] transition-all duration-700 motion-reduce:transition-none ${
            inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          }`}
        >
          {job.title}
        </h1>
        <div className="flex flex-wrap gap-x-6 gap-y-2 mt-6 font-mono text-xs uppercase tracking-widest text-text-dim">
          <span>{job.category}</span>
          <span>{job.location}</span>
          <span>{job.employmentType}</span>
          <span>{job.experienceLevel}</span>
        </div>
        <p className="mt-6 max-w-2xl text-base md:text-lg text-text-dim leading-relaxed">{job.summary}</p>
        {job.applicationEnabled ? (
          <button
            onClick={onApply}
            className="inline-flex text-sm font-semibold px-6 py-3 bg-text text-bg hover:bg-accent transition-colors mt-8"
          >
            Apply Now
          </button>
        ) : (
          <p className="inline-block text-sm text-text-dim border border-dashed border-line-strong px-4 py-3 mt-8">{CLOSED_NOTICE}</p>
        )}
      </div>
    </section>
  );
}

function JobBody({ job }) {
  return (
    <section className="border-b border-line py-16 md:py-20">
      <div className="max-w-3xl mx-auto px-5 md:px-10">
        <p className="text-base md:text-lg text-text-dim leading-relaxed mb-10">{job.description}</p>

        <h2 className="font-display font-semibold text-2xl tracking-tight mb-5">Responsibilities</h2>
        <ul className="mb-10 space-y-3">
          {job.responsibilities.map((r, i) => (
            <li key={i} className="flex items-start gap-3 text-base text-text-dim leading-relaxed">
              <span className="mt-2.5 w-1.5 h-1.5 bg-accent shrink-0" />
              {r}
            </li>
          ))}
        </ul>

        <h2 className="font-display font-semibold text-2xl tracking-tight mb-5">Required Skills</h2>
        <div className="flex flex-wrap gap-2 mb-10">
          {job.requiredSkills.map(s => (
            <span key={s} className="font-mono text-xs uppercase tracking-wide text-text border border-accent/40 px-3 py-1.5">{s}</span>
          ))}
        </div>

        <h2 className="font-display font-semibold text-2xl tracking-tight mb-5">Preferred Skills</h2>
        <div className="flex flex-wrap gap-2 mb-10">
          {job.preferredSkills.map(s => (
            <span key={s} className="font-mono text-xs uppercase tracking-wide text-text-dim border border-line px-3 py-1.5">{s}</span>
          ))}
        </div>

        <h2 className="font-display font-semibold text-2xl tracking-tight mb-5">Candidate Profile</h2>
        <p className="text-base text-text-dim leading-relaxed">
          This position suits engineers who combine the required skills above with hands-on experience
          in {job.category.toLowerCase()} engineering. If that describes your background, apply with a current resume.
        </p>
      </div>
    </section>
  );
}

function RelatedJobs({ jobs }) {
  const [ref, inView] = useInView(0.1);
  return (
    <section ref={(el) => { ref.current = el; }} className="border-b border-line py-16 md:py-20">
      <div className="max-w-7xl mx-auto px-5 md:px-10">
        <MeasurementLabel className="block mb-4">Related Positions</MeasurementLabel>
        <h2 className="font-display font-semibold text-2xl md:text-3xl tracking-tight mb-8">Continue browsing.</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {jobs.map((j, i) => (
            <Link
              key={j.slug}
              to={`/talent/jobs/${j.slug}`}
              className={`group border border-line p-5 hover:border-accent/50 transition-all duration-400 motion-reduce:transition-none ${
                inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'
              }`}
              style={{ transitionDelay: `${i * 90}ms` }}
            >
              <span className="font-mono text-[0.65rem] text-accent tracking-widest">{j.category}</span>
              <h3 className="font-display font-semibold text-lg mt-1.5 group-hover:text-accent transition-colors">{j.title}</h3>
              <p className="text-text-dim text-xs mt-1">{j.location}</p>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

function JobDetailCta({ open, onApply }) {
  return (
    <section className="py-20 md:py-24 text-center">
      <div className="max-w-2xl mx-auto px-5 md:px-10">
        <h2 className="font-display font-bold text-2xl md:text-4xl tracking-tight mb-8">
          {open ? 'Ready to apply?' : CLOSED_NOTICE}
        </h2>
        <div className="flex flex-wrap justify-center gap-3">
          {open && (
            <button onClick={onApply} className="inline-flex text-sm font-semibold px-6 py-3 bg-text text-bg hover:bg-accent transition-colors">
              Apply Now
            </button>
          )}
          <Link to="/talent" className="inline-flex text-sm font-semibold px-6 py-3 border border-line-strong hover:border-accent transition-colors">
            See All Positions
          </Link>
        </div>
      </div>
    </section>
  );
}

/*
  ApplyModal - the application overlay, used here for a specific job
  and on the Talent page for a general application (no `job`).
  `initialResume` is a file the visitor already chose on the Talent
  page's CV drop area.

  It behaves as a modal dialog: focus moves into it when it opens and
  returns to the control that opened it when it closes, Tab stays
  inside it, Esc and the close button close it, and the page behind
  does not scroll. The backdrop does not close it, so a stray click
  beside a five-step form cannot throw the answers away.
*/
const FOCUSABLE = 'a[href], button:not([disabled]), textarea, select, input:not([tabindex="-1"]), [tabindex="0"]';

export function ApplyModal({ job = null, initialResume = null, onClose }) {
  const dialogRef = useRef(null);
  const titleId = useId();
  // The listener below is attached once; it reads the latest onClose here.
  const close = useRef(onClose);
  close.current = onClose;

  useEffect(() => {
    const dialog = dialogRef.current;
    const opener = document.activeElement;
    const pageOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialog.focus();

    function onKeyDown(event) {
      if (event.key === 'Escape') {
        close.current();
        return;
      }
      if (event.key !== 'Tab') return;
      const items = dialog.querySelectorAll(FOCUSABLE);
      const first = items[0];
      const last = items[items.length - 1];
      const inside = dialog.contains(document.activeElement);
      if (event.shiftKey && (!inside || document.activeElement === first || document.activeElement === dialog)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (!inside || document.activeElement === last)) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = pageOverflow;
      if (opener instanceof HTMLElement) opener.focus();
    };
  }, []);

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center sm:px-4 sm:py-[6vh]">
      <div className="absolute inset-0 bg-bg/90 backdrop-blur-sm" aria-hidden="true" />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="relative w-full max-w-2xl bg-bg border border-line-strong h-[100dvh] sm:h-auto sm:max-h-[88vh] overflow-y-auto overscroll-contain focus:outline-none"
      >
        <div className="sticky top-0 z-10 bg-bg border-b border-line px-5 sm:px-6 py-4 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <span className="font-mono text-[0.6rem] uppercase tracking-widest text-accent">
              {job ? 'Apply Now' : 'General Application'}
            </span>
            <h3 id={titleId} className="font-display font-semibold text-lg leading-snug">{job ? job.title : 'Submit your profile'}</h3>
          </div>
          <button onClick={onClose} aria-label="Close" className="shrink-0 text-text-dim hover:text-text text-2xl leading-none px-2">&times;</button>
        </div>

        <div className="px-5 py-6 sm:px-6 md:p-8">
          <ApplicationForm job={job} initialResume={initialResume} onClose={onClose} />
        </div>
      </div>
    </div>
  );
}
