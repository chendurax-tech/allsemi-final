import React, { useEffect, useState } from 'react';
import { Link, useParams, Navigate } from 'react-router-dom';
import {
  useInView, MeasurementLabel, TechnicalGrid,
} from '../../lib/motionPrimitives.jsx';
import { getJobBySlug, getRelatedJobs } from './jobsContent.js';

export default function JobDetail() {
  const { slug } = useParams();
  const job = getJobBySlug(slug);
  const [applyOpen, setApplyOpen] = useState(false);

  useEffect(() => {
    if (job) document.title = `ALLSEMIS | ${job.title}`;
  }, [job]);

  if (!job) return <Navigate to="/talent" replace />;

  const related = getRelatedJobs(slug, 3);

  return (
    <>
      <JobHero job={job} onApply={() => setApplyOpen(true)} />
      <JobBody job={job} />
      {related.length > 0 && <RelatedJobs jobs={related} />}
      <JobDetailCta onApply={() => setApplyOpen(true)} />
      {applyOpen && <ApplyModal job={job} onClose={() => setApplyOpen(false)} />}
    </>
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
        <span className="inline-block font-mono text-[0.6rem] uppercase tracking-widest text-accent border border-dashed border-line-strong px-2 py-1 mb-4">
          Representative Open Position
        </span>
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
        <button
          onClick={onApply}
          className="inline-flex text-sm font-semibold px-6 py-3 bg-text text-bg hover:bg-accent transition-colors mt-8"
        >
          Apply Now
        </button>
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
          A strong fit for this representative profile combines the required skills above with genuine hands-on
          experience in {job.category.toLowerCase()} engineering, and comfort working directly with technical
          stakeholders throughout the search process.
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

function JobDetailCta({ onApply }) {
  return (
    <section className="py-20 md:py-24 text-center">
      <div className="max-w-2xl mx-auto px-5 md:px-10">
        <h2 className="font-display font-bold text-2xl md:text-4xl tracking-tight mb-8">Ready to apply?</h2>
        <div className="flex flex-wrap justify-center gap-3">
          <button onClick={onApply} className="inline-flex text-sm font-semibold px-6 py-3 bg-text text-bg hover:bg-accent transition-colors">
            Apply Now
          </button>
          <Link to="/talent" className="inline-flex text-sm font-semibold px-6 py-3 border border-line-strong hover:border-accent transition-colors">
            See All Positions
          </Link>
        </div>
      </div>
    </section>
  );
}

export function ApplyModal({ job, onClose, general = false }) {
  const [submitted, setSubmitted] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');

  function submit(e) {
    e.preventDefault();
    setSubmitted(true);
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 md:p-8">
      <div className="absolute inset-0 bg-bg/90 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-bg border border-line-strong max-h-[88vh] overflow-y-auto">
        <div className="sticky top-0 bg-bg border-b border-line px-6 py-4 flex items-center justify-between">
          <div>
            <span className="font-mono text-[0.6rem] uppercase tracking-widest text-accent">
              {general ? 'General Application' : 'Apply Now'}
            </span>
            <h3 className="font-display font-semibold text-lg">{general ? 'Submit your profile' : job.title}</h3>
          </div>
          <button onClick={onClose} aria-label="Close" className="text-text-dim hover:text-text text-2xl leading-none px-2">&times;</button>
        </div>

        {submitted ? (
          <div className="p-6 md:p-8 text-center">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-accent/10 mb-5">
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-accent">
                <path d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="font-mono text-xs uppercase tracking-widest text-accent mb-2">Received</p>
            <h4 className="font-display font-semibold text-xl mb-2">Thank you.</h4>
            <p className="text-text-dim text-sm">
              This is the frontend application experience. Submissions are not yet connected to a live backend.
            </p>
          </div>
        ) : (
          <form onSubmit={submit} className="p-6 md:p-8 space-y-5">
            <p className="text-text-faint text-xs leading-relaxed border border-dashed border-line-strong px-3 py-2">
              This form shows the intended application experience. Backend submission is not yet connected.
            </p>
            <div>
              <label className="block font-mono text-xs uppercase tracking-wider text-text-dim mb-2">Name</label>
              <input required value={name} onChange={e => setName(e.target.value)} className="w-full bg-transparent border-b border-line-strong py-2 focus:outline-none focus:border-accent" />
            </div>
            <div>
              <label className="block font-mono text-xs uppercase tracking-wider text-text-dim mb-2">Email</label>
              <input required type="email" value={email} onChange={e => setEmail(e.target.value)} className="w-full bg-transparent border-b border-line-strong py-2 focus:outline-none focus:border-accent" />
            </div>
            <div>
              <label className="block font-mono text-xs uppercase tracking-wider text-text-dim mb-2">Phone</label>
              <input className="w-full bg-transparent border-b border-line-strong py-2 focus:outline-none focus:border-accent" />
            </div>
            <div>
              <label className="block font-mono text-xs uppercase tracking-wider text-text-dim mb-2">LinkedIn / Portfolio</label>
              <input className="w-full bg-transparent border-b border-line-strong py-2 focus:outline-none focus:border-accent" />
            </div>
            <div>
              <label className="block font-mono text-xs uppercase tracking-wider text-text-dim mb-2">Relevant experience</label>
              <textarea rows={3} className="w-full bg-transparent border-b border-line-strong py-2 focus:outline-none focus:border-accent resize-none" />
            </div>
            <div>
              <label className="block font-mono text-xs uppercase tracking-wider text-text-dim mb-2">CV / Resume</label>
              <input type="file" accept=".pdf,.doc,.docx" className="w-full text-sm text-text-dim" />
            </div>
            <div>
              <label className="block font-mono text-xs uppercase tracking-wider text-text-dim mb-2">Message</label>
              <textarea rows={3} className="w-full bg-transparent border-b border-line-strong py-2 focus:outline-none focus:border-accent resize-none" />
            </div>
            <button type="submit" className="w-full text-sm font-semibold px-6 py-3 bg-text text-bg hover:bg-accent transition-colors">
              Submit Application
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
