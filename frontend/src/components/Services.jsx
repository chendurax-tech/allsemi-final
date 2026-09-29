import React from 'react';
import { Link } from 'react-router-dom';
import { GlyphDie, GlyphLayers, GlyphPipeline, DimensionRule } from './EngineeringGlyphs.jsx';

/*
  No dedicated per-service routes exist in App.jsx (checked against the
  routing root before wiring these) - all three services route to the
  existing /employers page, per the task's preferred destinations.
*/
const SERVICES = [
  {
    num: '01',
    title: 'Permanent Staffing',
    body: 'Find the right full-time talent for your semiconductor, chip design, automotive, or aerospace teams. We source, screen, and place top engineers who stay and grow with your organization.',
    Glyph: GlyphDie,
    to: '/employers',
  },
  {
    num: '02',
    title: 'Project Staffing',
    body: 'Scale your team on-demand with highly skilled contract engineers for specific projects. From VLSI design to embedded systems, we provide experts exactly when you need them.',
    Glyph: GlyphLayers,
    to: '/employers',
  },
  {
    num: '03',
    title: 'RPO Solution',
    body: 'Outsource your entire recruitment process to Allsemis. Our Recruitment Process Outsourcing (RPO) solution delivers a dedicated hiring engine tailored to your talent acquisition needs.',
    Glyph: GlyphPipeline,
    to: '/employers',
  },
];

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