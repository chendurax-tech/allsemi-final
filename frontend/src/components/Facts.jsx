import React from 'react';
import { GlyphMesh, GlyphDie, GlyphVerify, GlyphTick, GlyphPipeline, DimensionRule } from './EngineeringGlyphs.jsx';

const REASONS = [
  {
    num: '01',
    title: 'Deep network',
    body: 'A deep network of semiconductor and VLSI chip design engineers.',
    Glyph: GlyphMesh,
  },
  {
    num: '02',
    title: 'Domain expertise',
    body: 'Strong domain expertise across chip design, automotive, and aerospace.',
    Glyph: GlyphDie,
  },
  {
    num: '03',
    title: 'Safety-critical hiring',
    body: 'Proven hiring for safety-critical and specialized engineering roles.',
    Glyph: GlyphVerify,
  },
  {
    num: '04',
    title: 'Rapid turnaround',
    body: 'Shortlists delivered within 48 to 72 hours.',
    Glyph: GlyphTick,
  },
  {
    num: '05',
    title: 'End-to-end managed',
    body: 'End-to-end managed staffing with dedicated account managers.',
    Glyph: GlyphPipeline,
  },
];

const STATS = [
  { value: '100+', label: 'Engineers placed' },
  { value: '10+', label: 'Clients served' },
  { value: '95%', label: 'Retention rate' },
  { value: '48h', label: 'Avg. shortlist time' },
];

export default function Facts() {
  return (
    <section id="facts" className="border-t border-line py-16 md:py-24 lg:py-32">
      <div className="max-w-7xl mx-auto px-5 md:px-10 mb-10 md:mb-14">
        <span className="block font-mono text-xs uppercase tracking-[0.22em] text-accent mb-4">
          05 / WHY ALLSEMIS
        </span>
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-accent mb-3">
          Why Allsemis
        </p>
        <h2 className="font-display font-semibold text-4xl md:text-5xl lg:text-6xl tracking-tight leading-tight">
          Your trusted staffing partner.
        </h2>
        <DimensionRule className="mt-6" />
      </div>

      <p className="max-w-3xl mx-auto px-5 md:px-10 text-base md:text-lg text-text-dim leading-relaxed mb-12 text-center">
        With deep domain expertise in semiconductor and advanced engineering
        sectors, we go beyond traditional recruiting. Our talent consultants
        understand the technology, making us uniquely effective at placing
        the right people faster.
      </p>

      <div className="max-w-7xl mx-auto px-5 md:px-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
        {REASONS.map(r => (
          <article key={r.num} className="border border-line p-7 md:p-8 min-h-[170px] flex flex-col gap-3 hover:border-accent/50 hover:-translate-y-1 transition-all">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs tracking-widest text-accent">{r.num}</span>
              <r.Glyph className="text-accent/60" />
            </div>
            <h3 className="font-display font-semibold text-lg">{r.title}</h3>
            <p className="text-text-dim text-sm leading-relaxed">{r.body}</p>
          </article>
        ))}
      </div>

      <div className="max-w-7xl mx-auto px-5 md:px-10 mt-14">
        <div className="grid grid-cols-2 md:grid-cols-4 border border-line divide-x divide-y md:divide-y-0 divide-line">
          {STATS.map(s => (
            <div key={s.label} className="p-6">
              <span className="block font-display font-bold text-4xl md:text-5xl text-accent leading-none">{s.value}</span>
              <span className="block mt-2 font-mono text-[0.65rem] uppercase tracking-widest text-text-faint">{s.label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}