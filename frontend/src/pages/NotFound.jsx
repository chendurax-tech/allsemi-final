import React from 'react';
import { Link } from 'react-router-dom';
import { MeasurementLabel } from '../lib/motionPrimitives.jsx';
import { useSeo } from '../lib/seo.js';

/*
  NotFound - any address the site has no page for. Laid out like the
  not-found state of a sector or service page, with links back into the
  site. Search engines are asked not to index it.
*/
export default function NotFound() {
  useSeo({ title: 'ALLSEMIS | Page not found', description: 'This page does not exist. It may have been moved, or the address may be wrong.', robots: 'noindex' });

  return (
    <section className="relative border-b border-line pt-16 overflow-hidden h-[86vh] min-h-[520px] max-h-[880px] flex flex-col justify-end">
      <div className="relative z-10 max-w-7xl mx-auto px-5 md:px-10 pb-14 md:pb-20 w-full">
        <MeasurementLabel className="block mb-4">Not found</MeasurementLabel>
        <h1 className="font-display font-bold text-3xl sm:text-4xl md:text-5xl tracking-tight leading-[1.05]">This page does not exist.</h1>
        <p className="mt-5 max-w-2xl text-base md:text-lg text-text-dim leading-relaxed">
          It may have been moved, or the address may be wrong.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link to="/" className="inline-flex text-sm font-semibold px-6 py-3 bg-text text-bg hover:bg-accent transition-colors">
            Go to the home page
          </Link>
          <Link to="/talent" className="inline-flex text-sm font-semibold px-6 py-3 border border-line-strong hover:border-accent hover:text-accent transition-colors">
            Browse jobs
          </Link>
        </div>
      </div>
    </section>
  );
}
