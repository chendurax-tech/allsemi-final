import React, { useEffect, useState } from 'react';
import {
  useInView, TechnicalGrid, StaggerText, AnimatedUnderline, MeasurementLabel,
} from '../lib/motionPrimitives.jsx';
import {
  REFER_INTRO, REFER_HOW_IT_WORKS, REFERRABLE_ROLES,
  REFERRER_FIELDS, CANDIDATE_FIELDS, FIT_FIELD, CONSENT_FIELD,
} from './referContent.js';

/*
  Refer - a dedicated ALLSEMIS referral journey (route: /refer),
  reachable from the header's compact Hire Talent / Find a Job /
  Refer Talent action cluster (components/Header.jsx) and from the
  mobile menu's equivalent.

  Concept, information architecture and form fields are loosely
  modelled on the idea of a semiconductor recruiter's referral page
  (per this phase's brief), but every word, every visual treatment and
  the entire "Signal"-style network language below is ALLSEMIS's own -
  no Nexus text, layout, rewards or branding were carried over.

  This is a frontend-only experience: submitting the form simulates a
  successful referral locally (see handleSubmit below) rather than
  calling a real API. The field list, validation and submit contract
  are structured so wiring a real endpoint later is a matter of
  replacing that one function, not rebuilding the page.
*/
export default function Refer() {
  useEffect(() => {
    document.title = 'ALLSEMIS | Refer Talent';
  }, []);

  return (
    <>
      <ReferHero />
      <HowItWorks />
      <WhoToRefer />
      <ReferralForm />
    </>
  );
}

/* ============ HERO / INTRO ============ */
function ReferHero() {
  const [ref, inView] = useInView(0.2);
  return (
    <section
      ref={(el) => { ref.current = el; }}
      className="relative border-b border-line pt-32 md:pt-40 pb-20 md:pb-28 overflow-hidden"
    >
      <TechnicalGrid className="opacity-[0.05]" />
      <div className="relative max-w-4xl mx-auto px-5 md:px-10">
        <MeasurementLabel className="block mb-5">{REFER_INTRO.eyebrow}</MeasurementLabel>
        <h1 className="font-display font-bold text-4xl sm:text-5xl md:text-6xl tracking-tight leading-[1.05] max-w-3xl">
          <StaggerText text={REFER_INTRO.headline} inView={inView} delayStep={30} />
        </h1>
        <div className="mt-6"><AnimatedUnderline inView={inView} /></div>
        <p className="mt-6 max-w-xl text-base md:text-lg text-text-dim leading-relaxed">
          {REFER_INTRO.body}
        </p>
      </div>
    </section>
  );
}

/* ============ HOW IT WORKS ============ */
function HowItWorks() {
  const [ref, inView] = useInView(0.2);
  return (
    <section ref={(el) => { ref.current = el; }} className="border-b border-line py-20 md:py-28">
      <div className="max-w-4xl mx-auto px-5 md:px-10">
        <MeasurementLabel className="block mb-4">REFER / 02 · HOW IT WORKS</MeasurementLabel>
        <h2 className="font-display font-semibold text-3xl md:text-4xl tracking-tight mb-14">A short, direct process.</h2>

        <div className="relative">
          <div className="absolute left-[15px] md:left-[19px] top-3 bottom-3 w-px bg-line" aria-hidden="true" />
          <div
            className="absolute left-[15px] md:left-[19px] top-3 w-px bg-gradient-to-b from-accent to-turquoise transition-all ease-out motion-reduce:transition-none"
            style={{ height: inView ? 'calc(100% - 24px)' : '0%', transitionDuration: '1200ms' }}
            aria-hidden="true"
          />
          <div className="flex flex-col gap-9 md:gap-10">
            {REFER_HOW_IT_WORKS.map((s, i) => (
              <div key={s.num} className="relative flex items-start gap-5 md:gap-6">
                <span
                  className={`relative z-10 shrink-0 w-8 h-8 md:w-10 md:h-10 rounded-full border flex items-center justify-center font-mono text-[0.65rem] transition-all duration-500 motion-reduce:transition-none ${
                    inView ? 'border-turquoise text-turquoise bg-bg' : 'border-line text-text-faint bg-bg'
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

/* ============ WHO CAN YOU REFER ============ */
function WhoToRefer() {
  const [ref, inView] = useInView(0.2);
  return (
    <section ref={(el) => { ref.current = el; }} className="relative border-b border-line py-20 md:py-28 overflow-hidden">
      <div className="relative max-w-4xl mx-auto px-5 md:px-10">
        <MeasurementLabel className="block mb-4">REFER / 03 · WHO CAN YOU REFER</MeasurementLabel>
        <h2 className="font-display font-semibold text-3xl md:text-4xl tracking-tight mb-12 max-w-2xl">
          Engineering talent across the roles we specialise in.
        </h2>
        <div className="flex flex-wrap gap-3">
          {REFERRABLE_ROLES.map((role, i) => (
            <span
              key={role}
              className={`font-mono text-xs md:text-sm text-text-dim border border-line px-3.5 py-2 transition-all duration-500 ease-out motion-reduce:transition-none hover:border-turquoise hover:text-turquoise ${
                inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'
              }`}
              style={{ transitionDelay: `${i * 60}ms` }}
            >
              {role}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ============ REFERRAL FORM ============ */
function ReferralForm() {
  const [ref, inView] = useInView(0.1);
  const [values, setValues] = useState({});
  const [resumeName, setResumeName] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const allFields = [...REFERRER_FIELDS, ...CANDIDATE_FIELDS, FIT_FIELD];

  function setField(id, val) {
    setValues((v) => ({ ...v, [id]: val }));
  }

  // Frontend-only submit: validates required fields locally and shows
  // a success state. There is no production backend/API for referral
  // submissions yet - wiring one later means replacing the body of
  // this function with a real request, not restructuring the form.
  function handleSubmit(e) {
    e.preventDefault();
    const missing = allFields.filter((f) => f.required && !String(values[f.id] || '').trim());
    if (missing.length || !values.consent) {
      setError('Please fill in the required fields and confirm consent before submitting.');
      return;
    }
    setError('');
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <section ref={(el) => { ref.current = el; }} className="py-24 md:py-32">
        <div className="max-w-2xl mx-auto px-5 md:px-10 text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-turquoise/10 border border-turquoise/40 mb-6">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#2dd4bf" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6L9 17l-5-5" />
            </svg>
          </div>
          <h2 className="font-display font-semibold text-2xl md:text-3xl tracking-tight mb-3">Referral received.</h2>
          <p className="text-text-dim leading-relaxed">
            Thank you for referring someone you rate. Our team will review the profile and reach out to the candidate directly if it looks like a genuine fit.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section ref={(el) => { ref.current = el; }} className="py-20 md:py-28">
      <div className="max-w-2xl mx-auto px-5 md:px-10">
        <MeasurementLabel className="block mb-4">REFER / 04 · REFERRAL FORM</MeasurementLabel>
        <h2 className="font-display font-semibold text-3xl md:text-4xl tracking-tight mb-4">Tell us who we should know.</h2>
        <p className="text-text-dim mb-12 leading-relaxed">
          A few details from you, a few about the candidate, and one line on why you rate them.
        </p>

        <form onSubmit={handleSubmit} className="space-y-10" noValidate>
          <FormGroup title="Your details">
            {REFERRER_FIELDS.map((f) => (
              <FormField key={f.id} field={f} value={values[f.id]} onChange={(v) => setField(f.id, v)} />
            ))}
          </FormGroup>

          <FormGroup title="Candidate details">
            {CANDIDATE_FIELDS.map((f) => (
              f.type === 'file' ? (
                <div key={f.id}>
                  <label htmlFor={f.id} className="block font-mono text-xs uppercase tracking-widest text-text-faint mb-2">
                    {f.label}
                  </label>
                  <input
                    id={f.id}
                    type="file"
                    accept=".pdf,.doc,.docx"
                    onChange={(e) => { setResumeName(e.target.files?.[0]?.name || ''); setField(f.id, e.target.files?.[0]?.name || ''); }}
                    className="block w-full text-sm text-text-dim file:mr-4 file:py-2 file:px-4 file:border file:border-line file:bg-transparent file:text-text-dim file:font-mono file:text-xs file:uppercase hover:file:border-turquoise hover:file:text-turquoise file:cursor-pointer cursor-pointer"
                  />
                  {resumeName && <p className="mt-1.5 text-xs text-text-faint">Selected: {resumeName}</p>}
                </div>
              ) : (
                <FormField key={f.id} field={f} value={values[f.id]} onChange={(v) => setField(f.id, v)} />
              )
            ))}
          </FormGroup>

          <FormGroup title="Why this person">
            <FormField field={FIT_FIELD} value={values[FIT_FIELD.id]} onChange={(v) => setField(FIT_FIELD.id, v)} />
          </FormGroup>

          <label className="flex items-start gap-3 text-sm text-text-dim leading-relaxed cursor-pointer">
            <input
              type="checkbox"
              checked={!!values.consent}
              onChange={(e) => setField('consent', e.target.checked)}
              className="mt-1 accent-turquoise"
            />
            {CONSENT_FIELD.label}
          </label>

          {error && <p className="text-sm text-accent-2">{error}</p>}

          <button
            type="submit"
            className="w-full sm:w-auto inline-flex justify-center text-sm font-semibold px-8 py-3.5 bg-text text-bg hover:bg-turquoise transition-colors"
          >
            Submit referral
          </button>
        </form>
      </div>
    </section>
  );
}

function FormGroup({ title, children }) {
  return (
    <fieldset className="space-y-5">
      <legend className="font-mono text-[0.62rem] uppercase tracking-[0.2em] text-accent/70 mb-1">{title}</legend>
      {children}
    </fieldset>
  );
}

function FormField({ field, value, onChange }) {
  const base = 'w-full bg-transparent border-b border-line focus:border-turquoise outline-none py-2.5 text-sm transition-colors placeholder:text-text-faint';
  return (
    <div>
      <label htmlFor={field.id} className="block font-mono text-xs uppercase tracking-widest text-text-faint mb-2">
        {field.label} {field.required && <span className="text-accent-2">*</span>}
      </label>
      {field.type === 'textarea' ? (
        <textarea
          id={field.id}
          rows={4}
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          className={`${base} resize-none`}
        />
      ) : (
        <input
          id={field.id}
          type={field.type}
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          className={base}
        />
      )}
    </div>
  );
}
