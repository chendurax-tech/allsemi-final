import React from 'react';

const SERVICES = [
  { num: '01', title: 'Permanent Staffing', body: 'Full-time semiconductor, chip design, automotive, and aerospace engineers, sourced, screened, and placed to stay and grow with the team.' },
  { num: '02', title: 'Project Staffing', body: 'Scale on demand with contract engineers for defined programs. VLSI design, verification, and embedded systems, placed exactly when the project needs them.' },
  { num: '03', title: 'RPO Solution', body: 'A dedicated hiring engine, embedded with your team. Full recruitment process outsourcing tuned to your talent acquisition needs.' },
];

export default function Services() {
  return (
    <section id="services" className="border-t border-line py-16 md:py-24 lg:py-32">
      <div className="max-w-7xl mx-auto px-5 md:px-10 mb-10 md:mb-14">
        <span className="block font-mono text-xs uppercase tracking-[0.22em] text-accent mb-4">
          02 / SERVICES
        </span>
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-accent mb-3">
          What we do
        </p>
        <h2 className="font-display font-semibold text-4xl md:text-5xl lg:text-6xl tracking-tight leading-tight">
          Staffing built for silicon.
        </h2>
        <span className="block mt-6 w-20 h-0.5 bg-gradient-to-r from-accent to-accent-2 shadow-[0_0_12px_rgba(167,139,250,0.5)]" />
      </div>

      <div className="max-w-7xl mx-auto px-5 md:px-10 grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
        {SERVICES.map(s => (
          <article key={s.num} className="border border-line p-8 hover:border-accent/50 hover:-translate-y-1 transition-all">
            <span className="font-mono text-xs tracking-widest text-accent">{s.num}</span>
            <h3 className="font-display font-semibold text-xl mt-4 mb-3 tracking-tight">{s.title}</h3>
            <p className="text-text-dim text-sm md:text-base leading-relaxed mb-6">{s.body}</p>
            <span className="text-accent text-sm">Learn more →</span>
          </article>
        ))}
      </div>
    </section>
  );
}