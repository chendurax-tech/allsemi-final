import React, { useEffect, useRef, useState } from 'react';
import { useSeo, breadcrumbJsonLd } from '../../lib/seo.js';
import { PAGE_SEO } from '../../lib/seoPages.js';
import { Link, useParams } from 'react-router-dom';
import { DimensionRule } from '../../components/EngineeringGlyphs.jsx';
import { SEARCH_EVALUATION } from './sectorContent.js';
import { sectorVisual } from './sectorVisuals.jsx';
import { useInView, MeasurementLabel } from '../../lib/motionPrimitives.jsx';
import { useInsights, useSectors } from '../../lib/usePublicData.js';

/*
  SectorPage - the shared architecture for every /expertise/:slug page.
  One template, one design system (consistent numbering, eyebrow
  labels, section rhythm, typography scale), driven per sector by:
  - the sector record from the backend (useSectors): its number, name,
    description, photograph, introduction, overview, domains, roles,
    hiring challenges, process flow, representative search profiles
    (explicitly labeled as illustrative) and related article
  - sectorVisuals.jsx (one bespoke motif per sector, its own technical
    vocabulary, not a reused/recolored shape), by the sector's fixed id

  This is how sectors stay visually distinctive from each other
  (different motif, different domains/roles/process-flow words) while
  sharing one disciplined, reviewable structure.

  The sector is found by the slug in the address among the published
  sectors. A slug with no published sector behind it (never existed,
  still a draft, unpublished or renamed since) shows the not-found
  state. If the sectors could not be loaded the page says so and offers
  a retry. A part of the page with nothing to show (a sector saved
  without roles, for instance) is left out.
*/

export default function SectorPage() {
  const { slug } = useParams();
  const { status, sectors, reload } = useSectors();
  const sector = sectors.find((item) => item.slug === slug);

  if (sector) return <SectorView sector={sector} sectors={sectors} />;
  if (status === 'ready') return <SectorNotFound />;
  return <SectorPending loading={status === 'loading'} onRetry={reload} />;
}

// The frame the sector hero has, for the states below: the same height,
// so the page does not jump when the sector arrives.
function SectorFrame({ children }) {
  return (
    <section className="relative border-b border-line pt-16 overflow-hidden h-[86vh] min-h-[520px] max-h-[880px] flex flex-col justify-end">
      <div className="relative z-10 max-w-7xl mx-auto px-5 md:px-10 pb-14 md:pb-20 w-full">
        {children}
      </div>
    </section>
  );
}

// The page while the sectors are loading, or when they could not be loaded.
function SectorPending({ loading, onRetry }) {
  return (
    <SectorFrame>
      {loading ? (
        <div role="status">
          <span className="sr-only">Loading sector</span>
          <div className="animate-pulse motion-reduce:animate-none" aria-hidden="true">
            <div className="h-2 w-40 bg-line-strong" />
            <div className="h-12 md:h-20 w-3/4 max-w-3xl bg-line-strong mt-6" />
            <div className="h-3 w-full max-w-lg bg-line mt-10" />
            <div className="h-3 w-2/3 max-w-md bg-line mt-3" />
          </div>
        </div>
      ) : (
        <div role="alert">
          <Link to="/expertise" className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-accent hover:text-accent-2 transition-colors mb-6">
            ← All sectors
          </Link>
          <p className="text-base md:text-lg text-text-dim leading-relaxed mb-6">This sector could not be loaded.</p>
          <button onClick={onRetry} className="font-mono text-xs uppercase tracking-widest text-accent hover:text-accent-2 transition-colors px-4 py-2 border border-accent/40">
            Try again
          </button>
        </div>
      )}
    </SectorFrame>
  );
}

// No published sector has this address. Search engines are asked not to
// index the page while this state is shown.
function SectorNotFound() {
  useSeo({ title: 'ALLSEMIS | Sector not found', description: 'This sector is not available. It may have been moved or unpublished, or the address may be wrong.', robots: 'noindex' });

  return (
    <SectorFrame>
      <Link to="/expertise" className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-accent hover:text-accent-2 transition-colors mb-6">
        ← All sectors
      </Link>
      <MeasurementLabel className="block mb-4">Not found</MeasurementLabel>
      <h1 className="font-display font-bold text-3xl sm:text-4xl md:text-5xl tracking-tight leading-[1.05]">This sector is not available.</h1>
      <p className="mt-5 max-w-2xl text-base md:text-lg text-text-dim leading-relaxed">
        It may have been moved or unpublished, or the address may be wrong.
      </p>
      <div className="mt-8">
        <Link to="/expertise" className="inline-flex text-sm font-semibold px-6 py-3 bg-text text-bg hover:bg-accent transition-colors">
          Browse all sectors
        </Link>
      </div>
    </SectorFrame>
  );
}

function SectorView({ sector, sectors }) {
  const Visual = sectorVisual(sector.id);
  const heroRef = useRef(null);
  const heroImgRef = useRef(null);
  const [heroMounted, setHeroMounted] = useState(false);

  // The sectors listed in seoPages.js have their own search text; one
  // added in the admin uses its own name and description. The
  // breadcrumb always shows the sector's current name.
  const path = `/expertise/${sector.slug}`;
  const known = PAGE_SEO[path];
  useSeo({
    title: known ? known.title : `${sector.name} Recruitment | ALLSEMIS`,
    description: known ? known.description : (sector.desc || sector.introduction || `ALLSEMIS recruits engineers for ${sector.name}.`),
    path,
    jsonLd: [breadcrumbJsonLd([{ name: 'Home', path: '/' }, { name: 'Expertise', path: '/expertise' }, { name: sector.name, path }])],
  });

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

  const otherSectors = sectors.filter(s => s.id !== sector.id);
  const hasPositioning = Boolean(sector.introduction || sector.domainOverview);
  const hasCapabilities = sector.domains.length > 0 || sector.processFlow.length > 0;

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
          {sector.image && <img fetchPriority="high"
            src={sector.image}
            alt={sector.alt}
            className="absolute inset-0 w-full h-full object-cover grayscale-[0.55] scale-105"
          />}
        </div>
        {/* Duotone + fade-to-background scrim, so the photo reads as ALLSEMIS' own language rather than a raw stock photo */}
        <div className="absolute inset-0 bg-accent-deep/25 mix-blend-color" />
        <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/55 to-bg/10" />
        <div className="absolute inset-0 bg-gradient-to-b from-bg/70 via-transparent to-transparent" />

        {/* Small technical annotation, corner-placed, not the dominant graphic.
            A sector with no motif drawn for it has no figure and no caption. */}
        {Visual && (
          <>
            <div className="absolute right-5 md:right-10 top-20 md:top-24 w-28 h-20 md:w-36 md:h-24 opacity-70 hidden sm:block">
              <Visual />
            </div>
            <div className="absolute right-5 md:right-10 top-[7.5rem] md:top-[8.5rem] hidden sm:flex items-center gap-2">
              <span className="h-px w-6 bg-accent/50" />
              <span className="font-mono text-[0.6rem] uppercase tracking-widest text-accent/70">Fig. {sector.num}</span>
            </div>
          </>
        )}

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
            <Link to="/contact?type=employer" className="inline-flex text-sm font-semibold px-5 py-3 bg-text text-bg hover:bg-accent transition-colors">
              Hire for {sector.name}
            </Link>
            <Link to="/talent" className="inline-flex text-sm font-semibold px-5 py-3 border border-white/25 text-text hover:border-accent transition-colors">
              Find roles
            </Link>
          </div>
        </div>
      </section>

      {/* ============ 02. POSITIONING STATEMENT ============ */}
      {hasPositioning && (
      <section className="border-b border-line py-16 md:py-20">
        <div className="max-w-3xl mx-auto px-5 md:px-10 text-center">
          <span className="block font-mono text-xs uppercase tracking-[0.2em] text-accent mb-4">Positioning</span>
          {sector.introduction && (
          <p className="font-display font-medium text-xl md:text-3xl leading-snug text-text mb-8">
            {sector.introduction}
          </p>
          )}
          {sector.domainOverview && (
          <p className="text-base text-text-dim leading-relaxed text-left md:text-center max-w-2xl mx-auto">
            {sector.domainOverview}
          </p>
          )}
        </div>
      </section>
      )}

      {/* ============ 03. CAPABILITY / DOMAIN MAP - process flow draws in on scroll ============ */}
      {hasCapabilities && <CapabilitySection sector={sector} />}

      {/* ============ 04. ROLES / TALENT INDEX ============ */}
      {sector.roles.length > 0 && (
      <section className="border-b border-line py-16 md:py-24">
        <div className="max-w-7xl mx-auto px-5 md:px-10">
          <MeasurementLabel className="block mb-4">Talent Index</MeasurementLabel>
          <h2 className="font-display font-semibold text-3xl md:text-4xl tracking-tight mb-8">Roles we recruit.</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {sector.roles.map((r, i) => (
              <div
                key={`${i}-${r}`}
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
      )}

      {/* ============ 05. HIRING CHALLENGES ============ */}
      {sector.hiringChallenges.length > 0 && <ChallengesSection challenges={sector.hiringChallenges} />}

      {/* ============ 06. TALENT SEARCH / EVALUATION ============ */}
      <EvaluationSection />

      {/* ============ 07. REPRESENTATIVE SEARCH PROFILES ============ */}
      {sector.representativeSearches.length > 0 && (
      <section className="border-b border-line py-16 md:py-24">
        <div className="max-w-7xl mx-auto px-5 md:px-10">
          <MeasurementLabel className="block mb-4">Representative Search</MeasurementLabel>
          <h2 className="font-display font-semibold text-3xl md:text-4xl tracking-tight mb-10">Search profiles.</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 md:gap-6">
            {sector.representativeSearches.map((s, i) => (
              <div key={`${i}-${s.ref}`} className="border border-line p-6 md:p-7">
                <span className="font-mono text-[0.65rem] uppercase tracking-widest text-accent">{s.ref}</span>
                <span className="block font-mono text-[0.6rem] uppercase tracking-widest text-text-faint mt-1 mb-4">
                  Representative Search Profile
                </span>
                <h3 className="font-display font-bold text-xl mb-3">{s.title}</h3>
                <p className="text-text-dim text-sm mb-4">{s.requirement}</p>
                <div className="flex flex-wrap gap-2">
                  {s.signals.map((sig, n) => (
                    <span key={`${n}-${sig}`} className="font-mono text-[0.65rem] text-text-dim border border-line px-2 py-1">
                      {sig}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <p className="text-text-faint text-xs mt-6 leading-relaxed max-w-2xl">
            Illustrative technical profiles built from real recruitment terminology, not a record of specific placements.
          </p>
        </div>
      </section>
      )}

      {/* ============ 08. FROM INSIGHTS ============ */}
      <InsightsSection slug={sector.relatedInsight} />

      {/* ============ 09. FINAL CTA ============ */}
      <section className="py-16 md:py-24 text-center">
        <div className="max-w-2xl mx-auto px-5 md:px-10">
          <h2 className="font-display font-semibold text-2xl md:text-4xl tracking-tight mb-6">
            Hiring in {sector.name}?
          </h2>
          <Link to="/contact?type=employer" className="inline-flex text-sm font-semibold px-6 py-3 bg-text text-bg hover:bg-accent transition-colors">
            Get in Touch
          </Link>
        </div>
      </section>

      {/* Cross-links to the other sectors */}
      {otherSectors.length > 0 && (
      <section className="border-t border-line py-12 md:py-16">
        <div className="max-w-7xl mx-auto px-5 md:px-10">
          <span className="block font-mono text-xs uppercase tracking-[0.22em] text-text-faint mb-5">Other sectors</span>
          <div className="flex flex-wrap gap-x-6 gap-y-3">
            {otherSectors.map(s => (
              <Link
                key={s.id}
                to={`/expertise/${s.slug}`}
                className="font-mono text-xs uppercase tracking-wide text-text-dim hover:text-accent transition-colors"
              >
                {s.num} {s.name}
              </Link>
            ))}
          </div>
        </div>
      </section>
      )}
    </>
  );
}

/* ---------- Capability map: domains, then the process flow that draws in on scroll ---------- */
function CapabilitySection({ sector }) {
  const [flowRef, flowInView] = useInView();
  return (
    <section ref={flowRef} className="border-b border-line py-16 md:py-24">
      <div className="max-w-7xl mx-auto px-5 md:px-10">
        <MeasurementLabel className="block mb-4">Capability Map</MeasurementLabel>
        {sector.domains.length > 0 && <h2 className="font-display font-semibold text-3xl md:text-4xl tracking-tight mb-8">Domains we cover.</h2>}
        <div className="flex flex-wrap gap-3">
          {sector.domains.map((d, i) => (
            <span
              key={`${i}-${d}`}
              className={`font-mono text-xs uppercase tracking-wide text-text-dim border border-line px-3 py-2 hover:border-accent hover:text-accent transition-all duration-400 motion-reduce:transition-none ${
                flowInView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
              }`}
              style={{ transitionDelay: `${i * 60}ms` }}
            >
              {d}
            </span>
          ))}
        </div>

        {sector.processFlow.length > 0 && (
          <div className={`${sector.domains.length > 0 ? 'mt-14' : 'mt-4'} flex items-center gap-2 md:gap-4 overflow-x-auto`}>
            {sector.processFlow.map((stage, i) => (
              <React.Fragment key={`${i}-${stage}`}>
                <span
                  className={`font-mono text-[0.65rem] md:text-xs uppercase tracking-widest text-text-dim whitespace-nowrap border border-line px-3 py-2 transition-all duration-500 ${
                    flowInView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
                  }`}
                  style={{ transitionDelay: `${i * 120}ms` }}
                >
                  {String(i + 1).padStart(2, '0')} {stage}
                </span>
                {i < sector.processFlow.length - 1 && (
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
  );
}

/* ---------- Hiring Challenges: interactive editorial cards ---------- */
function ChallengesSection({ challenges }) {
  const [chosen, setActive] = useState(0);
  // Another sector may have fewer challenges than the one just left.
  const active = chosen < challenges.length ? chosen : 0;
  const [ref, inView] = useInView(0.15);
  return (
    <section ref={(el) => { ref.current = el; }} className="border-b border-line py-16 md:py-24">
      <div className="max-w-7xl mx-auto px-5 md:px-10">
        <MeasurementLabel className="block mb-4">Hiring Challenges</MeasurementLabel>
        <h2 className="font-display font-semibold text-3xl md:text-4xl tracking-tight mb-10">What makes this search hard.</h2>
        <div className="flex flex-col border border-line">
          {challenges.map((c, i) => {
            const isActive = active === i;
            return (
              <button
                key={c.num}
                onMouseEnter={() => setActive(i)}
                onFocus={() => setActive(i)}
                className={`text-left border-b border-line last:border-b-0 px-5 md:px-8 transition-all duration-400 motion-reduce:transition-none ${
                  isActive ? 'py-7 md:py-8 bg-white/[0.02]' : 'py-4'
                } ${inView ? 'opacity-100' : 'opacity-0'}`}
                style={{ transitionDelay: inView ? `${i * 90}ms` : '0ms' }}
              >
                <div className="flex items-baseline gap-4">
                  <span className={`font-mono text-xs shrink-0 transition-colors ${isActive ? 'text-accent' : 'text-text-faint'}`}>{c.num}</span>
                  <span className={`font-display font-semibold tracking-tight transition-all duration-300 ${isActive ? 'text-xl md:text-2xl text-text' : 'text-base md:text-lg text-text-dim'}`}>
                    {c.title}
                  </span>
                </div>
                <p className={`text-text-dim text-sm leading-relaxed overflow-hidden transition-all duration-400 ${isActive ? 'max-h-24 mt-3 ml-9 opacity-100' : 'max-h-0 opacity-0'}`}>
                  {c.detail}
                </p>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ---------- Talent Search / Evaluation: shared 5-stage process ---------- */
function EvaluationSection() {
  const [ref, inView] = useInView(0.2);
  return (
    <section ref={(el) => { ref.current = el; }} className="border-b border-line py-16 md:py-24">
      <div className="max-w-4xl mx-auto px-5 md:px-10">
        <MeasurementLabel className="block mb-4">Talent Search / Evaluation</MeasurementLabel>
        <h2 className="font-display font-semibold text-3xl md:text-4xl tracking-tight mb-12">How we evaluate fit.</h2>
        <div className="relative">
          <div className="absolute left-[15px] top-3 bottom-3 w-px bg-line" aria-hidden="true" />
          <div
            className="absolute left-[15px] top-3 w-px bg-gradient-to-b from-accent to-accent-2 transition-all ease-out motion-reduce:transition-none"
            style={{ height: inView ? 'calc(100% - 24px)' : '0%', transitionDuration: '1200ms' }}
            aria-hidden="true"
          />
          <div className="flex flex-col gap-8">
            {SEARCH_EVALUATION.map((s, i) => (
              <div key={s.num} className="relative flex items-start gap-5">
                <span
                  className={`relative z-10 shrink-0 w-8 h-8 rounded-full border flex items-center justify-center font-mono text-[0.65rem] transition-all duration-500 motion-reduce:transition-none ${
                    inView ? 'border-accent text-accent bg-bg' : 'border-line text-text-faint bg-bg'
                  }`}
                  style={{ transitionDelay: `${i * 140}ms` }}
                >
                  {s.num}
                </span>
                <div className="pt-1">
                  <h3 className="font-display font-semibold text-base md:text-lg">{s.label}</h3>
                  <p className="text-text-dim text-sm mt-1 leading-relaxed">{s.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------- From Insights: a genuinely linked, sector-relevant article ---------- */
// Which article is the sector's own choice (Related insight, in the
// admin); a sector with none has no card. The article is read from the
// published list the backend returns, so the card appears only while
// that article is published.
function InsightsSection({ slug }) {
  const { articles } = useInsights();
  const article = slug ? articles.find((item) => item.slug === slug) : null;
  if (!article) return null;
  return (
    <section className="border-b border-line py-16 md:py-20">
      <div className="max-w-3xl mx-auto px-5 md:px-10">
        <MeasurementLabel className="block mb-6">From Insights</MeasurementLabel>
        <Link to={`/insights/${article.slug}`} className="group block border border-line p-6 md:p-8 hover:border-accent/50 transition-colors duration-300">
          <span className="font-mono text-xs text-accent tracking-widest">{article.topics[0]}</span>
          <h3 className="font-display font-bold text-xl md:text-2xl mt-2 mb-3 group-hover:text-accent transition-colors">{article.title}</h3>
          <p className="text-text-dim text-sm mb-4">{article.excerpt}</p>
          <div className="flex items-center gap-4 font-mono text-[0.65rem] uppercase tracking-widest text-text-faint">
            <span>{article.readTime}</span>
            <span className="text-accent group-hover:translate-x-1 transition-transform inline-block">View Insight →</span>
          </div>
        </Link>
      </div>
    </section>
  );
}
