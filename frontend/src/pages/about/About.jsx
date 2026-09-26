import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  useInView, useParallax, useRadialHighlight,
  TechnicalGrid, ScanLine, StaggerText, AnimatedUnderline, MeasurementLabel,
} from '../../lib/motionPrimitives.jsx';
import ExpertiseBands from '../../components/ExpertiseBands.jsx';
import {
  ABOUT_HERO, POSITIONING, CONNECTS_NODES, HOW_WE_WORK, ENGINEERING_APPROACH, ABOUT_CTA,
} from './aboutContent.js';

export default function About() {
  useEffect(() => {
    document.title = 'ALLSEMIS | About';
  }, []);

  return (
    <>
      <AboutHero />
      <Positioning />
      <WhatAllsemiConnects />
      <DomainNetwork />
      <HowWeWork />
      <EngineeringApproach />
      <AboutFinalCta />
    </>
  );
}

/* ============ HERO ============ */
function AboutHero() {
  const [heroRef, heroLayerRef] = useParallax(12);
  const [mountRef, mounted] = useInView(0.01);

  return (
    <section
      ref={(el) => { heroRef.current = el; mountRef.current = el; }}
      className="relative h-[88vh] min-h-[560px] max-h-[900px] flex flex-col justify-end overflow-hidden border-b border-line"
    >
      <div ref={heroLayerRef} className="absolute inset-0 transition-transform duration-300 ease-out">
        <img
          src={ABOUT_HERO.image}
          alt={ABOUT_HERO.alt}
          className="absolute inset-0 w-full h-full object-cover grayscale-[0.55] scale-105"
        />
      </div>
      <div className="absolute inset-0 bg-accent-deep/25 mix-blend-color" />
      <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/55 to-bg/10" />
      <div className="absolute inset-0 bg-gradient-to-b from-bg/70 via-transparent to-transparent" />
      <TechnicalGrid className="opacity-[0.05]" />
      <ScanLine inView={mounted} className="top-0" />

      <div className="absolute right-5 md:right-10 top-20 md:top-24 flex items-center gap-2">
        <span className="h-px w-6 bg-accent/50" />
        <MeasurementLabel>{ABOUT_HERO.eyebrow}</MeasurementLabel>
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-5 md:px-10 pb-14 md:pb-20 w-full">
        <h1 className="font-display font-bold text-4xl sm:text-5xl md:text-6xl lg:text-7xl tracking-tight leading-[1.02] max-w-4xl">
          <StaggerText text={ABOUT_HERO.headline} inView={mounted} delayStep={30} />
        </h1>
        <div className="mt-6"><AnimatedUnderline inView={mounted} /></div>
        <p className="mt-6 max-w-lg text-base md:text-lg text-text-dim leading-relaxed">
          {ABOUT_HERO.sub}
        </p>
      </div>
    </section>
  );
}

/* ============ POSITIONING ============ */
function Positioning() {
  const [ref, inView] = useInView(0.3);
  return (
    <section ref={(el) => { ref.current = el; }} className="border-b border-line py-24 md:py-32">
      <div className="max-w-4xl mx-auto px-5 md:px-10 text-center">
        <MeasurementLabel className="block mb-6">Positioning</MeasurementLabel>
        <div className="flex flex-wrap justify-center gap-x-4 gap-y-3 mb-10">
          {POSITIONING.words.map((w, i) => (
            <React.Fragment key={w}>
              <span
                className={`font-display font-bold text-2xl md:text-4xl tracking-tight transition-all duration-500 ease-out motion-reduce:transition-none ${
                  inView ? 'opacity-100 translate-y-0 text-text' : 'opacity-0 translate-y-3 text-text'
                }`}
                style={{ transitionDelay: `${i * 120}ms` }}
              >
                {w}
              </span>
              {i < POSITIONING.words.length - 1 && (
                <span
                  className={`self-center h-px bg-gradient-to-r from-accent to-accent-2 transition-all duration-500 ${inView ? 'w-8 md:w-12 opacity-100' : 'w-0 opacity-0'}`}
                  style={{ transitionDelay: `${i * 120 + 80}ms` }}
                />
              )}
            </React.Fragment>
          ))}
        </div>
        <p className="text-base md:text-lg text-text-dim leading-relaxed max-w-2xl mx-auto">
          {POSITIONING.body}
        </p>
      </div>
    </section>
  );
}

/* ============ WHAT ALLSEMI CONNECTS ============ */
function WhatAllsemiConnects() {
  const [active, setActive] = useState(0);
  const [ref, inView] = useInView(0.2);
  const glowRef = useRadialHighlight();

  return (
    <section ref={(el) => { ref.current = el; }} className="relative border-b border-line py-20 md:py-28 overflow-hidden">
      <div ref={glowRef} className="radial-highlight absolute inset-0">
        <TechnicalGrid />
      </div>
      <div className="relative max-w-4xl mx-auto px-5 md:px-10">
        <MeasurementLabel className="block mb-4 text-center">What ALLSEMIS Connects</MeasurementLabel>
        <h2 className="font-display font-semibold text-3xl md:text-4xl tracking-tight mb-14 text-center">A small, direct ecosystem.</h2>

        <div className="flex flex-col items-center">
          {CONNECTS_NODES.map((n, i) => {
            const isActive = active === i;
            return (
              <React.Fragment key={n.id}>
                {i > 0 && (
                  <span
                    className={`w-px bg-gradient-to-b from-accent to-accent-2 transition-all duration-500 motion-reduce:transition-none ${
                      inView ? 'h-10 opacity-100' : 'h-0 opacity-0'
                    }`}
                    style={{ transitionDelay: `${i * 150}ms` }}
                  />
                )}
                <button
                  onMouseEnter={() => setActive(i)}
                  onFocus={() => setActive(i)}
                  className={`relative flex flex-col items-center gap-2 px-8 py-4 border transition-all duration-300 ${
                    isActive ? 'border-accent bg-white/[0.03]' : 'border-line'
                  }`}
                >
                  <span className={`font-display font-bold text-xl md:text-2xl transition-colors ${isActive ? 'text-accent' : 'text-text'}`}>
                    {n.label}
                  </span>
                  <span className={`text-text-dim text-sm max-w-xs text-center overflow-hidden transition-all duration-300 ${
                    isActive ? 'max-h-16 opacity-100 mt-1' : 'max-h-0 opacity-0'
                  }`}>
                    {n.detail}
                  </span>
                </button>
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ============ DOMAIN NETWORK ============ */
function DomainNetwork() {
  const [ref, inView] = useInView(0.05);

  return (
    <section ref={(el) => { ref.current = el; }} className="border-b border-line py-20 md:py-28">
      <div className={`max-w-7xl mx-auto px-5 md:px-10 mb-10 md:mb-12 transition-opacity duration-700 motion-reduce:transition-none ${inView ? 'opacity-100' : 'opacity-0'}`}>
        <MeasurementLabel className="block mb-4">Domain Network</MeasurementLabel>
        <h2 className="font-display font-semibold text-3xl md:text-4xl tracking-tight">Eight engineering domains.</h2>
      </div>

      {/* The same ExpertiseBands system used on the landing page and
          driving /expertise - reused here in embedded mode (its own
          internal state, a shorter canvas height, no duplicate
          "02 / EXPERTISE" heading) so About visually connects to the
          existing Expertise experience rather than a second,
          disconnected implementation. Hover-preview, click-to-navigate
          and the mobile snap sequence all work identically to the
          landing page. */}
      <ExpertiseBands embedded />
    </section>
  );
}

/* ============ HOW WE WORK ============ */
function HowWeWork() {
  const [ref, inView] = useInView(0.2);
  return (
    <section ref={(el) => { ref.current = el; }} className="border-b border-line py-20 md:py-28">
      <div className="max-w-4xl mx-auto px-5 md:px-10">
        <MeasurementLabel className="block mb-4">How We Work</MeasurementLabel>
        <h2 className="font-display font-semibold text-3xl md:text-4xl tracking-tight mb-14">A five-stage process.</h2>

        <div className="relative">
          <div className="absolute left-[15px] md:left-[19px] top-3 bottom-3 w-px bg-line" aria-hidden="true" />
          <div
            className="absolute left-[15px] md:left-[19px] top-3 w-px bg-gradient-to-b from-accent to-accent-2 transition-all ease-out motion-reduce:transition-none"
            style={{ height: inView ? 'calc(100% - 24px)' : '0%', transitionDuration: '1200ms' }}
            aria-hidden="true"
          />
          <div className="flex flex-col gap-9 md:gap-10">
            {HOW_WE_WORK.map((s, i) => (
              <div key={s.num} className="relative flex items-start gap-5 md:gap-6">
                <span
                  className={`relative z-10 shrink-0 w-8 h-8 md:w-10 md:h-10 rounded-full border flex items-center justify-center font-mono text-[0.65rem] transition-all duration-500 motion-reduce:transition-none ${
                    inView ? 'border-accent text-accent bg-bg' : 'border-line text-text-faint bg-bg'
                  }`}
                  style={{ transitionDelay: `${i * 150}ms` }}
                >
                  {s.num}
                </span>
                <div className="pt-1.5">
                  <h3 className="font-display font-semibold text-lg md:text-xl">{s.label}</h3>
                  <p className="text-text-dim text-sm mt-1 max-w-md">{s.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ============ ENGINEERING APPROACH ============ */
function EngineeringApproach() {
  const [ref, inView] = useInView(0.3);
  return (
    <section ref={(el) => { ref.current = el; }} className="relative border-b border-line py-24 md:py-32 overflow-hidden">
      <TechnicalGrid />
      <div className="relative max-w-4xl mx-auto px-5 md:px-10 text-center">
        <MeasurementLabel className="block mb-6">Engineering Approach</MeasurementLabel>
        <h2 className="font-display font-bold text-2xl md:text-4xl lg:text-5xl tracking-tight leading-tight">
          <StaggerText text={ENGINEERING_APPROACH.statement} inView={inView} delayStep={20} />
        </h2>
        <div className="flex flex-wrap justify-center gap-x-3 gap-y-3 mt-12">
          {ENGINEERING_APPROACH.terms.map((t, i) => (
            <span
              key={t}
              className={`font-mono text-xs md:text-sm text-accent/80 border border-line px-3 py-1.5 transition-all duration-500 ease-out motion-reduce:transition-none ${
                inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'
              }`}
              style={{ transitionDelay: `${400 + i * 60}ms` }}
            >
              {t}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ============ FINAL CTA (dual) ============ */
function AboutFinalCta() {
  const [ref, inView] = useInView(0.3);
  return (
    <section ref={(el) => { ref.current = el; }} className="py-24 md:py-32">
      <div className="max-w-5xl mx-auto px-5 md:px-10 grid sm:grid-cols-2 gap-8 text-center">
        <div className={`transition-all duration-700 motion-reduce:transition-none ${inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
          <h2 className="font-display font-bold text-2xl md:text-3xl tracking-tight mb-6">{ABOUT_CTA.employer.headline}</h2>
          <Link to={ABOUT_CTA.employer.to} className="inline-flex text-sm font-semibold px-6 py-3 bg-text text-bg hover:bg-accent transition-colors">
            {ABOUT_CTA.employer.button}
          </Link>
        </div>
        <div className={`transition-all duration-700 delay-150 motion-reduce:transition-none ${inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
          <h2 className="font-display font-bold text-2xl md:text-3xl tracking-tight mb-6">{ABOUT_CTA.talent.headline}</h2>
          <Link to={ABOUT_CTA.talent.to} className="inline-flex text-sm font-semibold px-6 py-3 border border-line-strong hover:border-accent transition-colors">
            {ABOUT_CTA.talent.button}
          </Link>
        </div>
      </div>
    </section>
  );
}
