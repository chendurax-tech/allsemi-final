import React from 'react';
import { Link } from 'react-router-dom';

export default function Insights() {
  return (
    <section id="insights" className="border-t border-line py-16 md:py-24 lg:py-32">
      <div className="max-w-7xl mx-auto px-5 md:px-10 mb-10 md:mb-14">
        <span className="block font-mono text-xs uppercase tracking-[0.22em] text-accent mb-4">
          04 / INSIGHTS
        </span>
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-accent mb-3">
          From the team
        </p>
        <h2 className="font-display font-semibold text-4xl md:text-5xl lg:text-6xl tracking-tight leading-tight">
          Insights.
        </h2>
        <span className="block mt-6 w-20 h-0.5 bg-gradient-to-r from-accent to-accent-2 shadow-[0_0_12px_rgba(167,139,250,0.5)]" />
      </div>

      <div className="max-w-7xl mx-auto px-5 md:px-10 grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-5">
        <Link to="/insights/semiconductor-engineering-talent-trends" className="relative border border-line overflow-hidden aspect-video lg:aspect-[4/5] lg:row-span-2 group">
          <img src="https://images.unsplash.com/photo-1782338938790-9a956490181d?auto=format&fit=crop&fm=jpg&q=80&w=1800" alt="" className="absolute inset-0 w-full h-full object-cover grayscale brightness-[0.55] transition-all duration-700 ease-out group-hover:grayscale-0 group-hover:brightness-90 group-hover:scale-105 motion-reduce:transition-none motion-reduce:group-hover:scale-100" />
          <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/30 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 p-6 z-10">
            <span className="font-mono text-xs uppercase tracking-widest text-accent">Semiconductor</span>
            <h4 className="font-display font-semibold text-xl mt-2 text-text">
              Hiring guides and market notes from the Allsemis team.
            </h4>
          </div>
        </Link>

        <Link to="/insights/automotive-engineering-talent" className="relative border border-line overflow-hidden aspect-video group">
          <img src="https://images.unsplash.com/photo-1768861812598-33dfaec89765?auto=format&fit=crop&fm=jpg&q=80&w=1400" alt="" className="absolute inset-0 w-full h-full object-cover grayscale brightness-[0.55] transition-all duration-700 ease-out group-hover:grayscale-0 group-hover:brightness-90 group-hover:scale-105 motion-reduce:transition-none motion-reduce:group-hover:scale-100" />
          <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/30 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 p-5 z-10">
            <span className="font-mono text-xs uppercase tracking-widest text-accent">Automotive</span>
            <h4 className="font-display font-semibold text-base mt-2 text-text-dim">
              ADAS, functional safety, and the people who build them.
            </h4>
          </div>
        </Link>

        <Link to="/insights/hiring-for-aerospace-systems" className="relative border border-line overflow-hidden aspect-video group">
          <img src="https://images.pexels.com/photos/7174676/pexels-photo-7174676.jpeg?auto=compress&dpr=1&h=750&w=1260" alt="" className="absolute inset-0 w-full h-full object-cover grayscale brightness-[0.55] transition-all duration-700 ease-out group-hover:grayscale-0 group-hover:brightness-90 group-hover:scale-105 motion-reduce:transition-none motion-reduce:group-hover:scale-100" />
          <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/30 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 p-5 z-10">
            <span className="font-mono text-xs uppercase tracking-widest text-accent">Aerospace</span>
            <h4 className="font-display font-semibold text-base mt-2 text-text-dim">
              Notes on hiring across VLSI, aerospace, and industrial teams.
            </h4>
          </div>
        </Link>
      </div>
    </section>
  );
}