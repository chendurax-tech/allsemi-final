import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';

/*
  ComingSoon - a shared, restrained placeholder for routes whose real
  pages have not been built yet (Employers, Talent, Expertise index
  and sector pages, Insights index and article template, About).

  This exists purely so the routes listed in ALLSEMI-CONTENT-MASTER.md
  resolve to a real, styled page instead of a 404, per Phase 2 scope
  ("wire the routes into the routing architecture, but do not build
  the pages yet"). No section-specific content is invented here.
*/
export default function ComingSoon({ label, title }) {
  useEffect(() => {
    document.title = `ALLSEMI | ${title}`;
  }, [title]);

  return (
    <section className="min-h-[70vh] flex flex-col justify-center border-b border-line pt-24 md:pt-32 pb-20">
      <div className="max-w-4xl mx-auto px-5 md:px-10">
        <span className="block font-mono text-xs uppercase tracking-[0.22em] text-accent mb-6">
          {label}
        </span>
        <h1 className="font-display font-bold text-4xl md:text-6xl tracking-tight leading-tight mb-6">
          {title}.
        </h1>
        <p className="max-w-xl text-base md:text-lg text-text-dim leading-relaxed mb-10">
          This page is on its way. In the meantime, get in touch and we will
          point you in the right direction.
        </p>
        <Link
          to="/#enquiry"
          className="inline-flex text-sm font-semibold px-5 py-3 bg-text text-bg hover:bg-accent transition-colors"
        >
          Get in Touch
        </Link>
      </div>
    </section>
  );
}
