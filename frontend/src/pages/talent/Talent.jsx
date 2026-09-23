import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  useInView, useParallax,
  TechnicalGrid, ScanLine, StaggerText, AnimatedUnderline, MeasurementLabel,
} from '../../lib/motionPrimitives.jsx';
import {
  TALENT_HERO, CAREER_POSITIONING, SPECIALISATION_MAP, REPRESENTATIVE_ROLES,
  TALENT_JOURNEY, TALENT_CTA,
} from './talentContent.js';

export default function Talent() {
  useEffect(() => {
    document.title = 'ALLSEMI | Talent';
  }, []);

  return (
    <>
      <TalentHero />
      <CareerPositioning />
      <SpecialisationMap />
      <RepresentativeRoles />
      <HowWeWork />
      <CvCommunity />
      <TalentFinalCta />
    </>
  );
}

/* ============ HERO ============ */
function TalentHero() {
  const [heroRef, heroLayerRef] = useParallax(12);
  const [mountRef, mounted] = useInView(0.01);

  return (
    <section
      ref={(el) => { heroRef.current = el; mountRef.current = el; }}
      className="relative h-[88vh] min-h-[560px] max-h-[900px] flex flex-col justify-end overflow-hidden border-b border-line"
    >
      <div ref={heroLayerRef} className="absolute inset-0 transition-transform duration-300 ease-out">
        <img
          src={TALENT_HERO.image}
          alt={TALENT_HERO.alt}
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
        <MeasurementLabel>{TALENT_HERO.eyebrow}</MeasurementLabel>
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-5 md:px-10 pb-14 md:pb-20 w-full">
        <h1 className="font-display font-bold text-5xl sm:text-6xl md:text-7xl lg:text-8xl tracking-tight leading-[0.98] max-w-4xl">
          <StaggerText text={TALENT_HERO.headline} inView={mounted} />
        </h1>
        <div className="mt-6"><AnimatedUnderline inView={mounted} /></div>
        <p className="mt-6 max-w-lg text-base md:text-lg text-text-dim leading-relaxed">
          {TALENT_HERO.sub}
        </p>
        <div className="flex flex-wrap gap-3 mt-8">
          <a href="#cv-community" className="inline-flex text-sm font-semibold px-5 py-3 bg-text text-bg hover:bg-accent transition-colors">
            Send Your Profile
          </a>
          <a href="#roles" className="inline-flex text-sm font-semibold px-5 py-3 border border-white/25 text-text hover:border-accent transition-colors">
            See Roles
          </a>
        </div>
      </div>
    </section>
  );
}

/* ============ CAREER POSITIONING ============ */
function CareerPositioning() {
  const [ref, inView] = useInView(0.3);
  return (
    <section ref={(el) => { ref.current = el; }} className="border-b border-line py-24 md:py-32">
      <div className="max-w-4xl mx-auto px-5 md:px-10 text-center">
        <MeasurementLabel className="block mb-6">Career Positioning</MeasurementLabel>
        <h2 className="font-display font-bold text-3xl md:text-5xl lg:text-6xl tracking-tight leading-tight">
          <StaggerText text={CAREER_POSITIONING.statement} inView={inView} delayStep={60} />
        </h2>
        <div className="flex flex-wrap justify-center gap-x-4 gap-y-3 mt-12">
          {CAREER_POSITIONING.disciplines.map((d, i) => (
            <span
              key={d}
              className={`font-mono text-xs md:text-sm text-accent/80 border border-line px-3 py-1.5 transition-all duration-500 ease-out motion-reduce:transition-none ${
                inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'
              }`}
              style={{ transitionDelay: `${300 + i * 70}ms` }}
            >
              {d}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ============ SPECIALISATION MAP ============ */
function SpecialisationMap() {
  const [active, setActive] = useState(0);
  const [ref, inView] = useInView(0.2);
  const activeGroup = SPECIALISATION_MAP[active];

  return (
    <section ref={(el) => { ref.current = el; }} className="border-b border-line py-20 md:py-28">
      <div className="max-w-7xl mx-auto px-5 md:px-10">
        <MeasurementLabel className="block mb-4">Specialisation Map</MeasurementLabel>
        <h2 className="font-display font-semibold text-3xl md:text-4xl tracking-tight mb-12">Where you fit.</h2>

        {/* Desktop: hover-driven group selector + node field */}
        <div className="hidden md:grid grid-cols-[280px_1fr] gap-12 border border-line p-8 lg:p-12">
          <div className="flex flex-col gap-2">
            {SPECIALISATION_MAP.map((g, i) => (
              <button
                key={g.discipline}
                onMouseEnter={() => setActive(i)}
                onFocus={() => setActive(i)}
                className={`text-left font-display font-semibold tracking-tight py-3 border-b border-line last:border-b-0 transition-all duration-300 ${
                  active === i ? 'text-2xl text-text' : 'text-lg text-text-dim'
                }`}
              >
                {g.discipline}
              </button>
            ))}
          </div>
          <div className="relative min-h-[220px] flex flex-wrap content-center gap-3">
            {activeGroup.nodes.map((n, i) => (
              <span
                key={n}
                className="font-mono text-xs md:text-sm text-accent border border-accent/40 px-4 py-2 transition-all duration-300"
                style={{ transitionDelay: `${i * 60}ms` }}
              >
                {n}
              </span>
            ))}
          </div>
        </div>

        {/* Mobile: stacked, no hover - everything visible, no separate interaction model needed */}
        <div className="md:hidden flex flex-col gap-6">
          {SPECIALISATION_MAP.map((g, i) => (
            <div
              key={g.discipline}
              className={`border border-line p-5 transition-all duration-500 motion-reduce:transition-none ${
                inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
              }`}
              style={{ transitionDelay: `${i * 100}ms` }}
            >
              <h3 className="font-display font-semibold text-lg mb-3">{g.discipline}</h3>
              <div className="flex flex-wrap gap-2">
                {g.nodes.map(n => (
                  <span key={n} className="font-mono text-xs text-accent border border-accent/40 px-3 py-1.5">
                    {n}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ============ REPRESENTATIVE ROLES ============ */
function RepresentativeRoles() {
  const [ref, inView] = useInView(0.1);
  return (
    <section id="roles" ref={(el) => { ref.current = el; }} className="border-b border-line py-20 md:py-28">
      <div className="max-w-7xl mx-auto px-5 md:px-10">
        <MeasurementLabel className="block mb-4">Roles</MeasurementLabel>
        <h2 className="font-display font-semibold text-3xl md:text-4xl tracking-tight mb-2">Representative roles.</h2>
        <p className="text-text-dim text-sm mb-12 max-w-lg">
          Illustrative technical profiles, not live vacancies - the talent community below reaches the same team.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
          {REPRESENTATIVE_ROLES.map((r, i) => (
            <div
              key={r.num}
              className={`group border border-line p-6 hover:border-accent/50 hover:-translate-y-1 transition-all duration-500 motion-reduce:transition-none motion-reduce:hover:translate-y-0 ${
                inView ? 'opacity-100' : 'opacity-0'
              }`}
              style={{ transitionDelay: `${i * 80}ms` }}
            >
              <span className="font-mono text-xs text-accent">{r.num}</span>
              <h3 className="font-display font-semibold text-lg mt-2 mb-3">{r.title}</h3>
              <div className="flex flex-wrap gap-1.5">
                {r.tags.map(t => (
                  <span key={t} className="font-mono text-[0.62rem] uppercase tracking-wide text-text-dim border border-line px-2 py-1">
                    {t}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ============ HOW WE WORK WITH TALENT ============ */
function HowWeWork() {
  const [ref, inView] = useInView(0.2);
  return (
    <section ref={(el) => { ref.current = el; }} className="border-b border-line py-20 md:py-28">
      <div className="max-w-7xl mx-auto px-5 md:px-10">
        <MeasurementLabel className="block mb-4">How We Work With Talent</MeasurementLabel>
        <h2 className="font-display font-semibold text-3xl md:text-4xl tracking-tight mb-14">A four-stage journey.</h2>

        <div className="relative">
          <div className="absolute left-0 right-0 top-[15px] h-px bg-line hidden md:block" aria-hidden="true" />
          <div
            className="absolute left-0 top-[15px] h-px bg-gradient-to-r from-accent to-accent-2 transition-all ease-out motion-reduce:transition-none hidden md:block"
            style={{ width: inView ? '100%' : '0%', transitionDuration: '1200ms' }}
            aria-hidden="true"
          />
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 md:gap-6">
            {TALENT_JOURNEY.map((step) => (
              <div key={step.num} className="relative">
                <span className="relative z-10 block w-[31px] h-[31px] rounded-full border border-accent bg-bg flex items-center justify-center font-mono text-[0.65rem] text-accent mb-4">
                  {step.num}
                </span>
                <h3 className="font-display font-semibold text-lg">{step.label}</h3>
                <p className="text-text-dim text-sm mt-1.5 leading-relaxed">{step.detail}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ============ CV / TALENT COMMUNITY ============ */
function CvCommunity() {
  const [ref, inView] = useInView(0.2);
  const [dragOver, setDragOver] = useState(false);
  return (
    <section id="cv-community" ref={(el) => { ref.current = el; }} className="border-b border-line py-20 md:py-28">
      <div className="max-w-3xl mx-auto px-5 md:px-10 text-center">
        <MeasurementLabel className="block mb-4">Talent Community</MeasurementLabel>
        <h2 className="font-display font-semibold text-3xl md:text-4xl tracking-tight mb-4">Not seeing the right role?</h2>
        <p className="text-text-dim text-base mb-12 max-w-lg mx-auto">
          Send your profile anyway. We will reach out when a genuine match opens.
        </p>

        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); }}
          className={`relative border-2 border-dashed p-10 md:p-14 transition-colors duration-300 ${
            dragOver ? 'border-accent bg-accent/5' : 'border-line-strong'
          }`}
        >
          <svg
            viewBox="0 0 64 64" width="52" height="52" className="mx-auto mb-5 text-accent"
            fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true"
          >
            <rect x="16" y="8" width="32" height="44" rx="2" />
            <path d="M24 20h16M24 28h16M24 36h10" />
            <path
              className={inView ? 'cv-scan-line' : ''}
              d="M16 44h32" strokeOpacity="0.6"
            />
            <path d="M32 44v12m-6-6l6 6 6-6" strokeOpacity="0.8" />
          </svg>
          <p className="font-display font-semibold text-lg mb-1">Upload CV</p>
          <p className="text-text-dim text-sm mb-6">Drag and drop, or choose a file</p>
          <label className="inline-flex text-sm font-semibold px-5 py-3 bg-text text-bg hover:bg-accent transition-colors cursor-pointer">
            Choose File
            <input type="file" className="hidden" accept=".pdf,.doc,.docx" />
          </label>
        </div>

        <Link to="/#enquiry" className="inline-flex text-accent text-sm font-mono uppercase tracking-widest hover:text-accent-2 transition-colors mt-8">
          Or reach us directly →
        </Link>
      </div>
    </section>
  );
}

/* ============ FINAL CTA ============ */
function TalentFinalCta() {
  const [ref, inView] = useInView(0.3);
  return (
    <section ref={(el) => { ref.current = el; }} className="py-24 md:py-32 text-center">
      <div className="max-w-2xl mx-auto px-5 md:px-10">
        <h2 className="font-display font-bold text-3xl md:text-5xl tracking-tight mb-8">
          <StaggerText text={TALENT_CTA.headline} inView={inView} />
        </h2>
        <a href="#cv-community" className="inline-flex text-sm font-semibold px-6 py-3 bg-text text-bg hover:bg-accent transition-colors">
          {TALENT_CTA.button}
        </a>
      </div>
    </section>
  );
}
