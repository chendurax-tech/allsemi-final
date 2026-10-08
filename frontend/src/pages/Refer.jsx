import React from 'react';
import { useSeo, fixedPageSeo } from '../lib/seo.js';
import {
  useInView, TechnicalGrid, StaggerText, AnimatedUnderline, MeasurementLabel,
} from '../lib/motionPrimitives.jsx';
import {
  REFER_INTRO, REFER_HOW_IT_WORKS, REFERRABLE_ROLES,
  REFERRER_FIELDS, CANDIDATE_FIELDS, FIT_FIELD, CONSENT_FIELD,
} from './referContent.js';
import { formsApi } from '../lib/api/public.js';
import { useForm } from '../components/forms/useForm.js';
import { required, email, phone, link, accepted } from '../components/forms/validation.js';
import {
  FormAccent, FormSection, TextField, TextArea, SelectField, Checkbox, Honeypot,
} from '../components/forms/fields.jsx';
import { FileDropZone } from '../components/forms/FileDropZone.jsx';
import { FormAlert, SubmitButton, SuccessPanel, TEXT_ACTION } from '../components/forms/FormStatus.jsx';
import { useDomainOptions } from '../components/forms/options.js';

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

  The referral form submits to the backend (POST /api/referrals,
  through formsApi.submitReferral) with an optional resume. It is built
  from the shared form components in components/forms/, rendered in
  this page's turquoise accent, and its fields are defined in
  referContent.js under the names the backend accepts.
*/
export default function Refer() {
  useSeo(fixedPageSeo('/refer'));

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

/* ============ REFERRAL FORM ============
   The schema and the starting values are derived from the field
   definitions in referContent.js: a required field gets its "required"
   rule, and email, phone and link fields get the matching format
   check. The resume is a file, so it is handled by the drop zone and
   is not part of the text values. */
const FORMAT_RULES = { email: [email()], tel: [phone()], url: [link()] };
const TEXT_FIELDS = [...REFERRER_FIELDS, ...CANDIDATE_FIELDS, FIT_FIELD].filter((f) => f.type !== 'file');

const SCHEMA = {
  ...Object.fromEntries(TEXT_FIELDS.map((f) => [f.id, {
    label: f.label,
    rules: [...(f.required ? [required(f.required)] : []), ...(FORMAT_RULES[f.type] || [])],
  }])),
  [CONSENT_FIELD.id]: { label: 'Consent', rules: [accepted()] },
};

const INITIAL = {
  website: '',
  ...Object.fromEntries(TEXT_FIELDS.map((f) => [f.id, ''])),
  [CONSENT_FIELD.id]: false,
};

const FILE = { name: 'resume', label: 'Resume' };

function ReferralForm() {
  const form = useForm({ initial: INITIAL, schema: SCHEMA, file: FILE });

  function onSubmit(e) {
    e.preventDefault();
    form.submit((options) => formsApi.submitReferral(form.values, form.file, options));
  }

  return (
    <section className="py-20 md:py-28">
      <div className="max-w-2xl mx-auto px-5 md:px-10">
        <MeasurementLabel className="block mb-4">REFER / 04 · REFERRAL FORM</MeasurementLabel>
        <h2 className="font-display font-semibold text-3xl md:text-4xl tracking-tight mb-4">Tell us who we should know.</h2>
        {!form.sent && (
          <p className="text-text-dim mb-12 leading-relaxed">
            A few details from you, a few about the candidate, and one line on why you rate them.
          </p>
        )}

        <FormAccent tone="turquoise">
          {form.sent ? (
            <SuccessPanel
              title="Referral received."
              received={`Your referral of ${form.values.candidateName.trim()} has been received.`}
              email={form.values.referrerEmail.trim()}
            >
              <button type="button" onClick={form.reset} className={TEXT_ACTION}>&larr; Refer someone else</button>
            </SuccessPanel>
          ) : (
            <form ref={form.rootRef} onSubmit={onSubmit} className="space-y-12" noValidate>
              <Honeypot field={form.field('website')} />

              <FormSection num="01" title="Your details">
                {REFERRER_FIELDS.map((f) => <ReferField key={f.id} def={f} form={form} />)}
              </FormSection>

              <FormSection num="02" title="Candidate details">
                {CANDIDATE_FIELDS.map((f) => <ReferField key={f.id} def={f} form={form} />)}
              </FormSection>

              <FormSection num="03" title="Why this person">
                <ReferField def={FIT_FIELD} form={form} />
              </FormSection>

              <div className="space-y-6">
                <Checkbox field={form.field(CONSENT_FIELD.id)} required>{CONSENT_FIELD.label}</Checkbox>
                {form.alert && <FormAlert alert={form.alert} />}
                <SubmitButton sending={form.sending}>Submit referral</SubmitButton>
              </div>
            </form>
          )}
        </FormAccent>
      </div>
    </section>
  );
}

// Maps one field definition from referContent.js to its shared input.
function ReferField({ def, form }) {
  const className = def.wide ? 'sm:col-span-2' : undefined;
  if (def.type === 'file') {
    return <FileDropZone field={form.fileField} label={def.label} optional className={className} />;
  }
  const field = form.field(def.id);
  if (def.type === 'select') {
    return <DomainField field={field} def={def} className={className} />;
  }
  if (def.type === 'textarea') {
    return <TextArea field={field} label={def.label} required={Boolean(def.required)} maxLength={def.maxLength} className={className} />;
  }
  return (
    <TextField
      field={field}
      label={def.label}
      type={def.type}
      required={Boolean(def.required)}
      maxLength={def.maxLength}
      autoComplete={def.autoComplete}
      placeholder={def.placeholder}
      className={className}
    />
  );
}

// The "Engineering domain" select: its choices are the published
// sectors, read from the backend.
function DomainField({ field, def, className }) {
  const options = useDomainOptions(field.value);
  return <SelectField field={field} label={def.label} options={options} placeholder={def.placeholder} className={className} />;
}
