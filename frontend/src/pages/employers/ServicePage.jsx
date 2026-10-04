import React, { useEffect } from 'react';
import { Link, Navigate } from 'react-router-dom';
import {
  useInView, TechnicalGrid, StaggerText, AnimatedUnderline, MeasurementLabel,
} from '../../lib/motionPrimitives.jsx';
import { GlyphDie, GlyphLayers, GlyphPipeline, DimensionRule } from '../../components/EngineeringGlyphs.jsx';
import { publishedServices, getServiceBySlug } from './servicesContent.js';

/*
  ServicePage - the shared template behind the three service
  destinations (/employers/permanent-staffing, /employers/project-staffing,
  /employers/rpo). One template, one design system, driven per service by
  servicesContent.js - the same pattern SectorPage uses for the eight
  Expertise sectors, so the service pages read as part of the existing
  site rather than a second visual language.

  Each page answers four questions specific to that service: when it
  fits, how it runs, what the client receives, and the questions an
  employer usually asks first. It is deliberately not a copy of the
  Employers page, which stays the overview of all hiring.
*/

const GLYPHS = { die: GlyphDie, layers: GlyphLayers, pipeline: GlyphPipeline };

export default function ServicePage({ slug }) {
  const service = getServiceBySlug(slug);
  const [heroRef, mounted] = useInView(0.01);
  const [processRef, processInView] = useInView(0.2);

  useEffect(() => {
    if (service) document.title = `ALLSEMIS | ${service.name}`;
  }, [service]);

  if (!service) return <Navigate to="/employers" replace />;

  const { page } = service;
  const Glyph = GLYPHS[service.icon] || GlyphDie;
  const others = publishedServices().filter((s) => s.slug !== service.slug);

  return (
    <>
      {/* ============ HERO ============ */}
      <section
        ref={(el) => { heroRef.current = el; }}
        className="relative border-b border-line pt-32 md:pt-44 pb-16 md:pb-24 overflow-hidden"
      >
        <TechnicalGrid className="opacity-[0.05]" />
        <div className="relative max-w-7xl mx-auto px-5 md:px-10">
          <Link to="/employers" className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-accent hover:text-accent-2 transition-colors mb-8">
            <span aria-hidden="true">&larr;</span> Employers
          </Link>
          <div className="flex items-center gap-3 mb-6">
            <Glyph className="text-accent" />
            <MeasurementLabel>Service / {service.num} &middot; {service.name}</MeasurementLabel>
          </div>
          <h1 className="font-display font-bold text-4xl sm:text-5xl md:text-6xl lg:text-7xl tracking-tight leading-[1.02] max-w-4xl">
            <StaggerText text={page.headline} inView={mounted} />
          </h1>
          <div className="mt-6"><AnimatedUnderline inView={mounted} /></div>
          <p className="mt-6 max-w-2xl text-base md:text-lg text-text-dim leading-relaxed">{page.lead}</p>
          <div className="flex flex-wrap gap-3 mt-8">
            <Link to={service.cta.to} className="inline-flex text-sm font-semibold px-5 py-3 bg-text text-bg hover:bg-accent transition-colors">
              {service.cta.label}
            </Link>
            <Link to="/expertise" className="inline-flex text-sm font-semibold px-5 py-3 border border-white/25 text-text hover:border-accent transition-colors">
              Explore Sectors
            </Link>
          </div>
        </div>
      </section>

      {/* ============ WHEN IT FITS ============ */}
      <section className="border-b border-line py-20 md:py-28">
        <div className="max-w-7xl mx-auto px-5 md:px-10 grid lg:grid-cols-[1fr_1.4fr] gap-10 lg:gap-20">
          <div>
            <MeasurementLabel className="block mb-4">When It Fits</MeasurementLabel>
            <h2 className="font-display font-semibold text-3xl md:text-4xl tracking-tight">{page.fitTitle}</h2>
            <DimensionRule className="mt-6" />
          </div>
          <ul className="divide-y divide-line border-y border-line">
            {page.fit.map((item) => (
              <li key={item} className="flex gap-4 py-5">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-turquoise" aria-hidden="true" />
                <span className="text-base md:text-lg text-text-dim leading-relaxed">{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ============ HOW IT RUNS ============ */}
      <section ref={(el) => { processRef.current = el; }} className="border-b border-line py-20 md:py-28">
        <div className="max-w-7xl mx-auto px-5 md:px-10">
          <MeasurementLabel className="block mb-4">How It Runs</MeasurementLabel>
          <h2 className="font-display font-semibold text-3xl md:text-4xl tracking-tight mb-14">{page.processTitle}</h2>
          <ol className="grid sm:grid-cols-2 lg:grid-cols-5 gap-x-6 gap-y-10">
            {page.process.map((step, i) => (
              <li
                key={step.label}
                className={`relative transition-all duration-500 motion-reduce:transition-none ${processInView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'}`}
                style={{ transitionDelay: `${i * 90}ms` }}
              >
                <span className="flex w-[31px] h-[31px] items-center justify-center rounded-full border border-accent bg-bg font-mono text-[0.65rem] text-accent mb-4">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <h3 className="font-display font-semibold text-lg tracking-tight mb-2">{step.label}</h3>
                <p className="text-sm text-text-dim leading-relaxed">{step.detail}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ============ WHAT YOU RECEIVE ============ */}
      <section className="border-b border-line py-20 md:py-28">
        <div className="max-w-7xl mx-auto px-5 md:px-10 grid lg:grid-cols-2 gap-12 lg:gap-20">
          <div>
            <MeasurementLabel className="block mb-4">What You Receive</MeasurementLabel>
            <ul className="mt-6 space-y-4">
              {page.receive.map((item, i) => (
                <li key={item} className="flex items-baseline gap-4 border-b border-line pb-4">
                  <span className="font-mono text-xs text-accent">{String(i + 1).padStart(2, '0')}</span>
                  <span className="font-display font-medium text-lg md:text-xl tracking-tight">{item}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <MeasurementLabel className="block mb-4">{page.tagsTitle}</MeasurementLabel>
            <div className="mt-6 flex flex-wrap gap-2">
              {page.tags.map((tag) => (
                <span key={tag} className="font-mono text-xs uppercase tracking-wide px-3 py-2 border border-line-strong text-text-dim">
                  {tag}
                </span>
              ))}
            </div>
            <p className="mt-8 text-sm text-text-dim leading-relaxed max-w-md">
              {service.description}
            </p>
          </div>
        </div>
      </section>

      {/* ============ QUESTIONS ============ */}
      <section className="border-b border-line py-20 md:py-28">
        <div className="max-w-4xl mx-auto px-5 md:px-10">
          <MeasurementLabel className="block mb-4">Questions</MeasurementLabel>
          <h2 className="font-display font-semibold text-3xl md:text-4xl tracking-tight mb-10">Asked before a first call.</h2>
          <dl className="divide-y divide-line border-y border-line">
            {page.questions.map((item) => (
              <div key={item.q} className="py-6 grid md:grid-cols-[1fr_1.4fr] gap-3 md:gap-10">
                <dt className="font-display font-semibold text-lg tracking-tight">{item.q}</dt>
                <dd className="text-text-dim leading-relaxed">{item.a}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* ============ OTHER SERVICES ============ */}
      <section className="border-b border-line py-16 md:py-20">
        <div className="max-w-7xl mx-auto px-5 md:px-10">
          <MeasurementLabel className="block mb-6">Other Services</MeasurementLabel>
          <div className="grid md:grid-cols-2 gap-6">
            {others.map((s) => {
              const OtherGlyph = GLYPHS[s.icon] || GlyphDie;
              return (
                <Link key={s.slug} to={`/employers/${s.slug}`} className="group block border border-line p-6 md:p-8 hover:border-accent/50 transition-colors">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs tracking-widest text-accent">{s.num}</span>
                    <OtherGlyph className="text-accent/60" />
                  </div>
                  <h3 className="font-display font-semibold text-xl mt-4 mb-2 tracking-tight group-hover:text-accent transition-colors">{s.name}</h3>
                  <p className="text-text-dim text-sm leading-relaxed">{s.page.lead}</p>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* ============ FINAL CTA ============ */}
      <section className="py-24 md:py-32 text-center">
        <div className="max-w-2xl mx-auto px-5 md:px-10">
          <h2 className="font-display font-bold text-3xl md:text-5xl tracking-tight mb-8">Tell us what you need to hire.</h2>
          <Link to={service.cta.to} className="inline-flex text-sm font-semibold px-6 py-3 bg-text text-bg hover:bg-accent transition-colors">
            {service.cta.label}
          </Link>
        </div>
      </section>
    </>
  );
}
