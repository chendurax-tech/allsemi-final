import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  useInView, useParallax, useRadialHighlight,
  TechnicalGrid, ScanLine, SignalPulse, StaggerText, AnimatedUnderline, MeasurementLabel,
} from '../../lib/motionPrimitives.jsx';
import {
  EMPLOYER_HERO, HIRING_PROBLEM, TALENT_ENGINE_STAGES, RECRUITMENT_SOLUTIONS,
  TECHNICAL_SPECIALISATION, DELIVERY_FLOW, REPRESENTATIVE_SEARCHES, EMPLOYER_CTA,
} from './employerContent.js';

export default function Employers() {
  useEffect(() => {
    document.title = 'ALLSEMIS | Employers';
  }, []);

  return (
    <>
      <EmployerHero />
      <HiringProblem />
      <TalentEngine />
      <RecruitmentSolutions />
      <TechnicalSpecialisation />
      <DeliveryFlow />
      <VisualProof />
      <EmployerFinalCta />
    </>
  );
}

/* ============ HERO ============ */
function EmployerHero() {
  const [heroRef, heroLayerRef] = useParallax(12);
  const [mountRef, mounted] = useInView(0.01);

  return (
    <section
      ref={(el) => { heroRef.current = el; mountRef.current = el; }}
      className="relative h-[88vh] min-h-[560px] max-h-[900px] flex flex-col justify-end overflow-hidden border-b border-line"
    >
      <div ref={heroLayerRef} className="absolute inset-0 transition-transform duration-300 ease-out">
        <img
          src={EMPLOYER_HERO.image}
          alt={EMPLOYER_HERO.alt}
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
        <MeasurementLabel>{EMPLOYER_HERO.eyebrow}</MeasurementLabel>
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-5 md:px-10 pb-14 md:pb-20 w-full">
        <h1 className="font-display font-bold text-5xl sm:text-6xl md:text-7xl lg:text-8xl tracking-tight leading-[0.98] max-w-4xl">
          <StaggerText text={EMPLOYER_HERO.headline} inView={mounted} />
        </h1>
        <div className="mt-6"><AnimatedUnderline inView={mounted} /></div>
        <p className="mt-6 max-w-lg text-base md:text-lg text-text-dim leading-relaxed">
          {EMPLOYER_HERO.sub}
        </p>
        <div className="flex flex-wrap gap-3 mt-8">
          <Link to="/contact?type=employer" className="inline-flex text-sm font-semibold px-5 py-3 bg-text text-bg hover:bg-accent transition-colors">
            Start a Search
          </Link>
          <Link to="/expertise" className="inline-flex text-sm font-semibold px-5 py-3 border border-white/25 text-text hover:border-accent transition-colors">
            Explore Sectors
          </Link>
        </div>
      </div>
    </section>
  );
}

/* ============ HIRING PROBLEM ============ */
function HiringProblem() {
  const [ref, inView] = useInView(0.3);
  const glowRef = useRadialHighlight();

  return (
    <section ref={(el) => { ref.current = el; }} className="relative border-b border-line py-24 md:py-32 overflow-hidden">
      <div ref={glowRef} className="radial-highlight absolute inset-0">
        <TechnicalGrid />
      </div>
      <div className="relative max-w-4xl mx-auto px-5 md:px-10 text-center">
        <MeasurementLabel className="block mb-6">Hiring Problem</MeasurementLabel>
        <h2 className="font-display font-bold text-3xl md:text-5xl lg:text-6xl tracking-tight leading-tight">
          <StaggerText text={HIRING_PROBLEM.statement} inView={inView} wordClassName="" delayStep={60} />
        </h2>
        <div className="flex flex-wrap justify-center gap-x-4 gap-y-3 mt-12">
          {HIRING_PROBLEM.keywords.map((k, i) => (
            <span
              key={k}
              className={`font-mono text-xs md:text-sm text-accent/80 border border-line px-3 py-1.5 transition-all duration-500 ease-out motion-reduce:transition-none ${
                inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'
              }`}
              style={{ transitionDelay: `${300 + i * 70}ms` }}
            >
              {k}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ============ TALENT ENGINE ============ */
function TalentEngine() {
  const [ref, inView] = useInView(0.2);
  return (
    <section ref={(el) => { ref.current = el; }} className="border-b border-line py-20 md:py-28">
      <div className="max-w-4xl mx-auto px-5 md:px-10">
        <MeasurementLabel className="block mb-4">Talent Engine</MeasurementLabel>
        <h2 className="font-display font-semibold text-3xl md:text-4xl tracking-tight mb-14">How ALLSEMIS works.</h2>

        <div className="relative">
          <div className="absolute left-[15px] md:left-[19px] top-3 bottom-3 w-px bg-line" aria-hidden="true" />
          <div
            className="absolute left-[15px] md:left-[19px] top-3 w-px bg-gradient-to-b from-accent to-accent-2 transition-all ease-out motion-reduce:transition-none"
            style={{ height: inView ? 'calc(100% - 24px)' : '0%', transitionDuration: '1200ms' }}
            aria-hidden="true"
          />
          <div className="flex flex-col gap-9 md:gap-10">
            {TALENT_ENGINE_STAGES.map((s, i) => (
              <div key={s.num} className="group relative flex items-start gap-5 md:gap-6 pl-0">
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
                  <p className="text-text-dim text-sm mt-1 max-w-md opacity-0 max-h-0 overflow-hidden group-hover:opacity-100 group-hover:max-h-20 transition-all duration-300">
                    {s.detail}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ============ RECRUITMENT SOLUTIONS ============ */
function RecruitmentSolutions() {
  const [ref, inView] = useInView(0.1);
  return (
    <section ref={(el) => { ref.current = el; }} className="border-b border-line py-20 md:py-28">
      <div className="max-w-7xl mx-auto px-5 md:px-10">
        <MeasurementLabel className="block mb-4">Recruitment Solutions</MeasurementLabel>
        <h2 className="font-display font-semibold text-3xl md:text-4xl tracking-tight mb-12">Engagement models.</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-6">
          {RECRUITMENT_SOLUTIONS.map((s, i) => (
            <div
              key={s.num}
              className={`group relative aspect-[16/10] overflow-hidden border border-line transition-all duration-700 motion-reduce:transition-none ${
                inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
              }`}
              style={{ transitionDelay: `${i * 120}ms` }}
            >
              <img
                src={s.image}
                alt={s.alt}
                className="absolute inset-0 w-full h-full object-cover grayscale transition-all duration-700 ease-out group-hover:grayscale-0 group-hover:scale-105"
                loading={i < 2 ? 'eager' : 'lazy'}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/45 to-bg/5 group-hover:via-bg/55 transition-all duration-500" />
              <div className="relative z-10 h-full flex flex-col justify-end p-6 md:p-8">
                <span className="font-mono text-xs text-accent tracking-widest">{s.num}</span>
                <h3 className="font-display font-bold text-2xl md:text-3xl mt-2 mb-2">{s.title}</h3>
                <p className="text-text-dim text-sm md:text-base leading-relaxed max-w-sm">{s.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ============ TECHNICAL SPECIALISATION ============ */
function TechnicalSpecialisation() {
  const [active, setActive] = React.useState(0);
  const [ref, inView] = useInView(0.2);
  return (
    <section ref={(el) => { ref.current = el; }} className="border-b border-line py-20 md:py-28">
      <div className="max-w-7xl mx-auto px-5 md:px-10">
        <MeasurementLabel className="block mb-4">Technical Specialisation</MeasurementLabel>
        <h2 className="font-display font-semibold text-3xl md:text-4xl tracking-tight mb-12">Capability field.</h2>

        <div className="flex flex-col border border-line">
          {TECHNICAL_SPECIALISATION.map((d, i) => {
            const isActive = active === i;
            return (
              <button
                key={d.discipline}
                onMouseEnter={() => setActive(i)}
                onFocus={() => setActive(i)}
                className={`text-left border-b border-line last:border-b-0 px-5 md:px-8 transition-all duration-400 motion-reduce:transition-none ${
                  isActive ? 'py-8 md:py-10 bg-white/[0.02]' : 'py-5'
                } ${inView ? 'opacity-100' : 'opacity-0'}`}
                style={{ transitionDelay: inView ? `${i * 90}ms` : '0ms' }}
              >
                <div className="flex items-baseline gap-4">
                  <span className={`font-mono text-xs shrink-0 transition-colors ${isActive ? 'text-accent' : 'text-text-faint'}`}>
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <span className={`font-display font-semibold tracking-tight transition-all duration-300 ${
                    isActive ? 'text-2xl md:text-3xl text-text' : 'text-lg md:text-xl text-text-dim'
                  }`}>
                    {d.discipline}
                  </span>
                </div>
                <div className={`flex flex-wrap gap-2 overflow-hidden transition-all duration-400 ${isActive ? 'max-h-20 mt-4 opacity-100' : 'max-h-0 opacity-0'}`}>
                  {d.tags.map(t => (
                    <span key={t} className="font-mono text-[0.65rem] uppercase tracking-wide text-text-dim border border-line px-2.5 py-1">
                      {t}
                    </span>
                  ))}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ============ SEARCH / DELIVERY FLOW ============ */
function DeliveryFlow() {
  const [ref, inView] = useInView(0.2);
  return (
    <section ref={(el) => { ref.current = el; }} className="border-b border-line py-20 md:py-28">
      <div className="max-w-7xl mx-auto px-5 md:px-10">
        <MeasurementLabel className="block mb-4">Search &amp; Delivery</MeasurementLabel>
        <h2 className="font-display font-semibold text-3xl md:text-4xl tracking-tight mb-14">How a search moves.</h2>

        {/* sm+ : grid, always exactly fills its container - no scroll container, cannot overflow */}
        <div className="hidden sm:block relative">
          <div className="absolute left-0 right-0 top-[15px] h-px bg-line" aria-hidden="true" />
          <div
            className="absolute left-0 top-[15px] h-px bg-gradient-to-r from-accent to-accent-2 transition-all ease-out motion-reduce:transition-none"
            style={{ width: inView ? '100%' : '0%', transitionDuration: '1400ms' }}
            aria-hidden="true"
          />
          <SignalPulse inView={inView} className="left-0" />
          <div className="grid grid-cols-5 gap-4 lg:gap-6">
            {DELIVERY_FLOW.map((step) => (
              <div key={step.num} className="relative">
                <span className="relative z-10 block w-[31px] h-[31px] rounded-full border border-accent bg-bg flex items-center justify-center font-mono text-[0.65rem] text-accent mb-4">
                  {step.num}
                </span>
                <h3 className="font-display font-semibold text-base lg:text-lg">{step.label}</h3>
                <p className="text-text-dim text-xs lg:text-sm mt-1.5 leading-relaxed">{step.detail}</p>
              </div>
            ))}
          </div>
        </div>

        {/* <sm : a genuinely different, stacked vertical treatment - not the desktop layout compressed */}
        <div className="sm:hidden relative">
          <div className="absolute left-[15px] top-3 bottom-3 w-px bg-line" aria-hidden="true" />
          <div
            className="absolute left-[15px] top-3 w-px bg-gradient-to-b from-accent to-accent-2 transition-all ease-out motion-reduce:transition-none"
            style={{ height: inView ? 'calc(100% - 24px)' : '0%', transitionDuration: '1200ms' }}
            aria-hidden="true"
          />
          <div className="flex flex-col gap-8">
            {DELIVERY_FLOW.map((step) => (
              <div key={step.num} className="relative flex items-start gap-5">
                <span className="relative z-10 shrink-0 w-8 h-8 rounded-full border border-accent bg-bg flex items-center justify-center font-mono text-[0.65rem] text-accent">
                  {step.num}
                </span>
                <div className="pt-1">
                  <h3 className="font-display font-semibold text-base">{step.label}</h3>
                  <p className="text-text-dim text-sm mt-1 leading-relaxed">{step.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ============ VISUAL PROOF ============ */
function VisualProof() {
  const [ref, inView] = useInView(0.1);
  return (
    <section ref={(el) => { ref.current = el; }} className="border-b border-line py-20 md:py-28">
      <div className="max-w-7xl mx-auto px-5 md:px-10">
        <MeasurementLabel className="block mb-4">Visual Proof</MeasurementLabel>
        <h2 className="font-display font-semibold text-3xl md:text-4xl tracking-tight mb-2">Representative searches.</h2>
        <p className="text-text-dim text-sm mb-12 max-w-lg">
          Illustrative technical profiles, built from real recruitment terminology - not a record of specific placements.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 md:gap-6">
          {REPRESENTATIVE_SEARCHES.map((s, i) => (
            <div
              key={s.ref}
              className={`border border-line p-6 md:p-7 transition-all duration-600 motion-reduce:transition-none ${
                inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-5'
              }`}
              style={{ transitionDelay: `${i * 120}ms` }}
            >
              <span className="font-mono text-[0.65rem] uppercase tracking-widest text-accent">{s.ref}</span>
              <span className="block font-mono text-[0.6rem] uppercase tracking-widest text-text-faint mt-1 mb-4">
                Representative Search Profile
              </span>
              <h3 className="font-display font-bold text-xl mb-3">{s.title}</h3>
              <p className="text-text-dim text-sm mb-4">{s.requirement}</p>
              <div className="flex flex-wrap gap-2">
                {s.signals.map(sig => (
                  <span key={sig} className="font-mono text-[0.65rem] text-text-dim border border-line px-2 py-1">
                    {sig}
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

/* ============ FINAL CTA ============ */
function EmployerFinalCta() {
  const [ref, inView] = useInView(0.3);
  return (
    <section ref={(el) => { ref.current = el; }} className="py-24 md:py-32 text-center">
      <div className="max-w-2xl mx-auto px-5 md:px-10">
        <h2 className="font-display font-bold text-3xl md:text-5xl tracking-tight mb-8">
          <StaggerText text={EMPLOYER_CTA.headline} inView={inView} />
        </h2>
        <Link to="/contact?type=employer" className="inline-flex text-sm font-semibold px-6 py-3 bg-text text-bg hover:bg-accent transition-colors">
          {EMPLOYER_CTA.button}
        </Link>
      </div>
    </section>
  );
}
