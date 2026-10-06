import React from 'react';
import { Link } from 'react-router-dom';
import { GlyphDie, GlyphLayers, GlyphPipeline, DimensionRule } from './EngineeringGlyphs.jsx';

import { useServices } from '../lib/usePublicData.js';

/*
  The service cards come from the backend (GET /api/public/services):
  the published services, in the order set in the admin. Each card
  links to its page under /employers/:slug. The section heading and the
  glyph mapping live here, because a heading is part of the page and a
  glyph is a component, not content.

  While the services load the section keeps its frame, so the page does
  not jump. With no published service, or when the API cannot be
  reached, the section is left out and the rest of the page is
  unaffected.
*/
const GLYPHS = { die: GlyphDie, layers: GlyphLayers, pipeline: GlyphPipeline };
// An icon name this build does not know is drawn with the first glyph.
const glyphFor = (icon) => (Object.hasOwn(GLYPHS, icon) ? GLYPHS[icon] : GlyphDie);

// Stands in for a description of the usual length while the services
// load. It is never shown or read out: it wraps as a description does,
// so a loading card is as tall as a real one at any screen width.
const BODY_SPACE = Array.from({ length: 30 }, () => 'xxxxx').join(' ');

const CARD = 'border border-line p-8';

// Three services sit three across, as designed. Two or four sit two
// across, so no row is left with a single card or an empty column.
const columns = (count) => (count === 2 || count === 4 ? 'md:grid-cols-2' : 'md:grid-cols-3');

function LoadingCard() {
  return (
    <div className={`${CARD} relative`} aria-hidden="true">
      <div className="invisible">
        <div className="flex items-center justify-between">
          <span className="font-mono text-xs tracking-widest">00</span>
          <GlyphDie />
        </div>
        <div className="font-display font-semibold text-xl mt-4 mb-3 tracking-tight">&nbsp;</div>
        <p className="text-sm md:text-base leading-relaxed mb-6">{BODY_SPACE}</p>
        <span className="text-sm inline-flex">&nbsp;</span>
      </div>
      <div className="absolute inset-8 animate-pulse motion-reduce:animate-none">
        <div className="h-3 w-8 bg-line-strong" />
        <div className="h-5 w-2/3 bg-line-strong mt-9" />
        <div className="h-3 w-full bg-line mt-6" />
        <div className="h-3 w-11/12 bg-line mt-3" />
        <div className="h-3 w-3/4 bg-line mt-3" />
      </div>
    </div>
  );
}

export default function Services() {
  const { status, services } = useServices();
  const loading = status === 'loading';
  if (!loading && services.length === 0) return null;

  return (
    <section id="services" className="border-t border-line py-16 md:py-24 lg:py-32">
      <div className="max-w-7xl mx-auto px-5 md:px-10 mb-10 md:mb-14">
        <span className="block font-mono text-xs uppercase tracking-[0.22em] text-accent mb-4">
          01 / SERVICES
        </span>
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-accent mb-3">
          What we do
        </p>
        <h2 className="font-display font-semibold text-4xl md:text-5xl lg:text-6xl tracking-tight leading-tight">
          Staffing built for silicon.
        </h2>
        <DimensionRule className="mt-6" />
      </div>

      <div className={`max-w-7xl mx-auto px-5 md:px-10 grid grid-cols-1 ${columns(loading ? 3 : services.length)} gap-6 lg:gap-8`}>
        {loading && <span className="sr-only" role="status">Loading services</span>}
        {loading && [0, 1, 2].map((i) => <LoadingCard key={i} />)}
        {!loading && services.map((s) => {
          const Glyph = glyphFor(s.icon);
          return (
            <article key={s.id || s.slug} className={`${CARD} hover:border-accent/50 hover:-translate-y-1 transition-all`}>
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs tracking-widest text-accent">{s.num}</span>
                <Glyph className="text-accent/60" />
              </div>
              <h3 className="font-display font-semibold text-xl mt-4 mb-3 tracking-tight">{s.name}</h3>
              <p className="text-text-dim text-sm md:text-base leading-relaxed mb-6">{s.description}</p>
              <Link
                to={`/employers/${s.slug}`}
                className="text-accent text-sm inline-flex items-center rounded-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
              >
                Learn more →
              </Link>
            </article>
          );
        })}
      </div>
    </section>
  );
}