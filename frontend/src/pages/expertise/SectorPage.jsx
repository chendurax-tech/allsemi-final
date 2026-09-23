import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { SECTORS } from '../../components/Expertise.jsx';
import { EXPERTISE_SLUGS } from '../../lib/expertiseRoutes.js';
import { DimensionRule } from '../../components/EngineeringGlyphs.jsx';
import { SECTOR_CONTENT } from './sectorContent.js';
import { SECTOR_VISUALS } from './sectorVisuals.jsx';
import { useInView, MeasurementLabel } from '../../lib/motionPrimitives.jsx';

/*
  SectorPage - the shared architecture for all 8 /expertise/:slug pages.
  One template, one design system (consistent numbering, eyebrow
  labels, section rhythm, typography scale), driven per-sector by:
  - SECTORS (existing, confirmed id/num/name/desc)
  - SECTOR_CONTENT (realistic, technically credible seed content -
    domains, roles, process flow, one representative search example
    per sector, explicitly labeled as illustrative)
  - SECTOR_VISUALS (one bespoke motif per sector, its own technical
    vocabulary, not a reused/recolored shape)

  This is how sectors stay visually distinctive from each other
  (different motif, different domains/roles/process-flow words) while
  sharing one disciplined, reviewable structure rather than 8 pages
  built independently from scratch.
*/

export default function SectorPage({ sectorId }) {
  const sector = SECTORS.find(s => s.id === sectorId);
  const content = SECTOR_CONTENT[sectorId];
  const Visual = SECTOR_VISUALS[sectorId];
  const heroRef = useRef(null);
  const heroImgRef = useRef(null);
  const [heroMounted, setHeroMounted] = useState(false);
  const [flowRef, flowInView] = useInView();

  useEffect(() => {
    document.title = `ALLSEMI | ${sector.name}`;
  }, [sector.name]);

  // Entrance for the oversized hero type - a single fade/rise on
  // mount, not looped, not scroll-triggered (the hero is already in
  // view at load).
  useEffect(() => {
    const id = requestAnimationFrame(() => setHeroMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  // Subtle cursor parallax on the hero image layer - same technique
  // already used on the landing page's ExpertiseBands and on the new
  // Expertise index panel: direct DOM manipulation, desktop-only,
  // skipped under prefers-reduced-motion.
  useEffect(() => {
    const hero = heroRef.current;
    const layer = heroImgRef.current;
    if (!hero || !layer) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const isDesktop = window.matchMedia('(min-width: 1024px)').matches;
    if (reduce || !isDesktop) return;
    function onMove(e) {
      const r = hero.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width - 0.5;
      const py = (e.clientY - r.top) / r.height - 0.5;
      layer.style.transform = `translate3d(${px * -10}px, ${py * -10}px, 0) scale(1.06)`;
    }
    function onLeave() { layer.style.transform = ''; }
    hero.addEventListener('mousemove', onMove);
    hero.addEventListener('mouseleave', onLeave);
    return () => {
      hero.removeEventListener('mousemove', onMove);
      hero.removeEventListener('mouseleave', onLeave);
    };
  }, []);

  const otherSectors = SECTORS.filter(s => s.id !== sectorId);

  return (
    <>
      {/* ============ 01. SECTOR HERO - image + oversized type, not a bordered box ============ */}
      <section
        ref={heroRef}
        className="relative border-b border-line pt-16 overflow-hidden h-[86vh] min-h-[520px] max-h-[880px] flex flex-col justify-end"
      >
        <div
          ref={heroImgRef}
          className="absolute inset-0 transition-transform duration-500 ease-out"
        >
          <img
            src={sector.image}
            alt={sector.alt}
            className="absolute inset-0 w-full h-full object-cover grayscale-[0.55] scale-105"
          />
        </div>
        {/* Duotone + fade-to-background scrim, so the photo reads as ALLSEMI's own language rather than a raw stock photo */}
        <div className="absolute inset-0 bg-accent-deep/25 mix-blend-color" />
        <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/55 to-bg/10" />
        <div className="absolute inset-0 bg-gradient-to-b from-bg/70 via-transparent to-transparent" />

        {/* Small technical annotation, corner-placed, not the dominant graphic */}
        <div className="absolute right-5 md:right-10 top-20 md:top-24 w-28 h-20 md:w-36 md:h-24 opacity-70 hidden sm:block">
          <Visual />
        </div>
        <div className="absolute right-5 md:right-10 top-[7.5rem] md:top-[8.5rem] hidden sm:flex items-center gap-2">
          <span className="h-px w-6 bg-accent/50" />
          <span className="font-mono text-[0.6rem] uppercase tracking-widest text-accent/70">Fig. {sector.num}</span>
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-5 md:px-10 pb-14 md:pb-20 w-full">
          <span
            className={`block font-mono text-xs uppercase tracking-[0.22em] text-accent mb-4 transition-all duration-700 motion-reduce:transition-none ${
              heroMounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'
            }`}
          >
            EXPERTISE / {sector.num}
          </span>
          <h1
            className={`font-display font-bold text-5xl sm:text-6xl md:text-7xl lg:text-8xl tracking-tight leading-[0.98] max-w-4xl transition-all duration-700 delay-100 motion-reduce:transition-none motion-reduce:delay-0 ${
              heroMounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
            }`}
          >
            {sector.name}.
          </h1>
          <DimensionRule className="mt-6" />
          <p
            className={`mt-6 max-w-lg text-base md:text-lg text-text-dim leading-relaxed transition-all duration-700 delay-200 motion-reduce:transition-none motion-reduce:delay-0 ${
              heroMounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'
            }`}
          >
            {sector.desc}
          </p>
          <div className="flex flex-wrap gap-3 mt-8">
            <Link to="/#enquiry" className="inline-flex text-sm font-semibold px-5 py-3 bg-text text-bg hover:bg-accent transition-colors">
              Hire for {sector.name}
            </Link>
            <Link to="/talent" className="inline-flex text-sm font-semibold px-5 py-3 border border-white/25 text-text hover:border-accent transition-colors">
              Find roles
            </Link>
          </div>
        </div>
      </section>

      {/* ============ 02. POSITIONING STATEMENT ============ */}
      <section className="border-b border-line py-16 md:py-20">
        <div className="max-w-3xl mx-auto px-5 md:px-10 text-center">
          <span className="block font-mono text-xs uppercase tracking-[0.2em] text-accent mb-4">Positioning</span>
          <p className="font-display font-medium text-xl md:text-3xl leading-snug text-text">
            {content.introduction}
          </p>
        </div>
      </section>

      {/* ============ 03. CAPABILITY / DOMAIN MAP - process flow draws in on scroll ============ */}
      <section ref={flowRef} className="border-b border-line py-16 md:py-24">
        <div className="max-w-7xl mx-auto px-5 md:px-10">
          <MeasurementLabel className="block mb-4">Capability Map</MeasurementLabel>
          <h2 className="font-display font-semibold text-3xl md:text-4xl tracking-tight mb-8">Domains we cover.</h2>
          <div className="flex flex-wrap gap-3">
            {content.domains.map((d, i) => (
              <span
                key={d}
                className={`font-mono text-xs uppercase tracking-wide text-text-dim border border-line px-3 py-2 hover:border-accent hover:text-accent transition-all duration-400 motion-reduce:transition-none ${
                  flowInView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
                }`}
                style={{ transitionDelay: `${i * 60}ms` }}
              >
                {d}
              </span>
            ))}
          </div>

          {content.processFlow && (
            <div className="mt-14 flex items-center gap-2 md:gap-4 overflow-x-auto">
              {content.processFlow.map((stage, i) => (
                <React.Fragment key={stage}>
                  <span
                    className={`font-mono text-[0.65rem] md:text-xs uppercase tracking-widest text-text-dim whitespace-nowrap border border-line px-3 py-2 transition-all duration-500 ${
                      flowInView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
                    }`}
                    style={{ transitionDelay: `${i * 120}ms` }}
                  >
                    {String(i + 1).padStart(2, '0')} {stage}
                  </span>
                  {i < content.processFlow.length - 1 && (
                    <span
                      className="h-px bg-gradient-to-r from-accent to-accent-2 shrink-0 transition-all ease-out"
                      style={{
                        width: flowInView ? '2.5rem' : '0px',
                        transitionDuration: '450ms',
                        transitionDelay: `${i * 120 + 200}ms`,
                      }}
                    />
                  )}
                </React.Fragment>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ============ 04. ROLES / TALENT INDEX ============ */}
      <section className="border-b border-line py-16 md:py-24">
        <div className="max-w-7xl mx-auto px-5 md:px-10">
          <MeasurementLabel className="block mb-4">Talent Index</MeasurementLabel>
          <h2 className="font-display font-semibold text-3xl md:text-4xl tracking-tight mb-8">Roles we recruit.</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {content.roles.map((r, i) => (
              <div
                key={r}
                className="group border border-line p-5 flex items-center gap-3 hover:border-accent/50 hover:-translate-y-1 transition-all duration-300 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
              >
                <span className="font-mono text-xs text-accent shrink-0 group-hover:text-accent-2 transition-colors">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span className="text-sm text-text">{r}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============ 05. HIRING AND TALENT NEEDS ============ */}
      <section className="border-b border-line py-16 md:py-20">
        <div className="max-w-3xl mx-auto px-5 md:px-10">
          <span className="block font-mono text-xs uppercase tracking-[0.22em] text-accent mb-4">Hiring Challenges</span>
          <p className="text-base md:text-lg text-text-dim leading-relaxed">
            {content.hiringChallenges}
          </p>
        </div>
      </section>

      {/* ============ 06. EDITORIAL / INSIGHT ============ */}
      <section className="border-b border-line py-16 md:py-20">
        <div className="max-w-3xl mx-auto px-5 md:px-10">
          <span className="block font-mono text-xs uppercase tracking-[0.22em] text-accent mb-4">From Insights</span>
          <p className="text-base text-text-dim leading-relaxed mb-4">
            Sector-specific hiring notes for {sector.name} are on their way.
          </p>
          <Link to="/insights" className="text-accent text-sm font-mono uppercase tracking-widest hover:text-accent-2 transition-colors">
            Visit Insights →
          </Link>
        </div>
      </section>

      {/* ============ 07. REPRESENTATIVE SEARCH ============ */}
      <section className="border-b border-line py-16 md:py-24">
        <div className="max-w-3xl mx-auto px-5 md:px-10">
          <MeasurementLabel className="block mb-6">Representative Search</MeasurementLabel>
          <div className="border border-line p-6 md:p-8">
            <span className="font-mono text-[0.65rem] uppercase tracking-widest text-accent">{content.representativeSearch.ref}</span>
            <span className="block font-mono text-[0.6rem] uppercase tracking-widest text-text-faint mt-1 mb-4">
              Representative Search Profile
            </span>
            <h3 className="font-display font-bold text-xl mb-3">{content.representativeSearch.title}</h3>
            <p className="text-text-dim text-sm mb-4">{content.representativeSearch.requirement}</p>
            <div className="flex flex-wrap gap-2">
              {content.representativeSearch.signals.map(sig => (
                <span key={sig} className="font-mono text-[0.65rem] text-text-dim border border-line px-2 py-1">
                  {sig}
                </span>
              ))}
            </div>
            <p className="text-text-faint text-xs mt-6 leading-relaxed">
              An illustrative technical profile built from real recruitment terminology, not a record of a specific placement.
            </p>
          </div>
        </div>
      </section>

      {/* ============ 08. FINAL CTA ============ */}
      <section className="py-16 md:py-24 text-center">
        <div className="max-w-2xl mx-auto px-5 md:px-10">
          <h2 className="font-display font-semibold text-2xl md:text-4xl tracking-tight mb-6">
            Hiring in {sector.name}?
          </h2>
          <Link to="/#enquiry" className="inline-flex text-sm font-semibold px-6 py-3 bg-text text-bg hover:bg-accent transition-colors">
            Get in Touch
          </Link>
        </div>
      </section>

      {/* Cross-links to the other 7 sectors */}
      <section className="border-t border-line py-12 md:py-16">
        <div className="max-w-7xl mx-auto px-5 md:px-10">
          <span className="block font-mono text-xs uppercase tracking-[0.22em] text-text-faint mb-5">Other sectors</span>
          <div className="flex flex-wrap gap-x-6 gap-y-3">
            {otherSectors.map(s => (
              <Link
                key={s.id}
                to={`/expertise/${EXPERTISE_SLUGS[s.id]}`}
                className="font-mono text-xs uppercase tracking-wide text-text-dim hover:text-accent transition-colors"
              >
                {s.num} {s.name}
              </Link>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
