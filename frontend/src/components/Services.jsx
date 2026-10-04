import React from 'react';
import { Link } from 'react-router-dom';
import { GlyphDie, GlyphLayers, GlyphPipeline, DimensionRule } from './EngineeringGlyphs.jsx';

import { publishedServices } from '../pages/employers/servicesContent.js';

/*
  Service names, descriptions and destinations come from
  pages/employers/servicesContent.js - the single source of truth shared
  with the service detail pages and the admin Services screen. Each card
  routes to its own page under /employers/:slug. Only the glyph mapping
  lives here, because a glyph is a component, not content.
*/
const GLYPHS = { die: GlyphDie, layers: GlyphLayers, pipeline: GlyphPipeline };

const SERVICES = publishedServices().map((s) => ({
  num: s.num,
  title: s.name,
  body: s.description,
  Glyph: GLYPHS[s.icon] || GlyphDie,
  to: `/employers/${s.slug}`,
}));

export default function Services() {
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

      <div className="max-w-7xl mx-auto px-5 md:px-10 grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
        {SERVICES.map(s => (
          <article key={s.num} className="border border-line p-8 hover:border-accent/50 hover:-translate-y-1 transition-all">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs tracking-widest text-accent">{s.num}</span>
              <s.Glyph className="text-accent/60" />
            </div>
            <h3 className="font-display font-semibold text-xl mt-4 mb-3 tracking-tight">{s.title}</h3>
            <p className="text-text-dim text-sm md:text-base leading-relaxed mb-6">{s.body}</p>
            <Link
              to={s.to}
              className="text-accent text-sm inline-flex items-center rounded-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
            >
              Learn more →
            </Link>
          </article>
        ))}
      </div>
    </section>
  );
}