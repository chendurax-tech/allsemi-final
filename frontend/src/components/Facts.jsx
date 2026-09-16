import React from 'react';

const REASONS = [
  {
    num: '01',
    title: 'Deep network',
    body: 'A deep network of semiconductor and VLSI chip design engineers.',
  },
  {
    num: '02',
    title: 'Domain expertise',
    body: 'Strong domain expertise across chip design, automotive, and aerospace.',
  },
  {
    num: '03',
    title: 'Safety-critical hiring',
    body: 'Proven hiring for safety-critical and specialized engineering roles.',
  },
  {
    num: '04',
    title: 'Rapid turnaround',
    body: 'Shortlists delivered within 48 to 72 hours.',
  },
  {
    num: '05',
    title: 'End-to-end managed',
    body: 'End-to-end managed staffing with dedicated account managers.',
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
          05 / WHY ALLSEMI
        </span>
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-accent mb-3">
          Why Allsemi
        </p>
        <h2 className="font-display font-semibold text-4xl md:text-5xl lg:text-6xl tracking-tight leading-tight">
          Your trusted staffing partner.
        </h2>
        <span className="block mt-6 w-20 h-0.5 bg-gradient-to-r from-accent to-accent-2 shadow-[0_0_12px_rgba(167,139,250,0.5)]" />
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
            <span className="font-mono text-xs tracking-widest text-accent">{r.num}</span>
            <h3 className="font-display font-semibold text-lg">{r.title}</h3>
            <p className="text-text-dim text-sm leading-relaxed">{r.body}</p>
          </article>
        ))}
      </div>

      <div className="max-w-7xl mx-auto px-5 md:px-10 mt-14 grid grid-cols-2 md:grid-cols-4 gap-4">
        {STATS.map(s => (
          <div key={s.label} className="border border-line p-6">
            <span className="block font-display font-bold text-4xl md:text-5xl text-accent leading-none">{s.value}</span>
            <span className="block mt-2 text-xs text-text-faint">{s.label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}