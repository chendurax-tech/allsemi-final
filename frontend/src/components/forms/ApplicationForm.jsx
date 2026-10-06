import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { formsApi } from '../../lib/api/public.js';
import { useForm } from './useForm.js';
import { required, email, phone, link, numberBetween, accepted, fileExtension, formatBytes } from './validation.js';
import { FormSection, TextField, TextArea, SelectField, TagInput, Checkbox, Honeypot } from './fields.jsx';
import { FileDropZone, UploadProgress } from './FileDropZone.jsx';
import { FormAlert, SubmitButton, SuccessPanel, TEXT_ACTION } from './FormStatus.jsx';
import { useDomainOptions } from './options.js';

/*
  ApplicationForm - the candidate application, in five steps:
  01 Profile, 02 Engineering, 03 Experience, 04 Resume, 05 Review.

  It is used in three places: the Contact page (?type=candidate), the
  Apply overlay on a job page and the general application overlay on
  the Talent page. With `job` it is an application for that position
  (its id is sent as jobId); without it, a general application. It
  sends to POST /api/applications through formsApi.submitApplication
  with the resume as `resume`.

  How the steps behave:
  - The whole application is one <form> and one useForm state, so
    answers are kept when moving between steps.
  - Next checks only the step being left. The step indicator can jump
    back freely, and forward only through steps that pass.
  - Enter in a single-line field is the form's implicit submit, which
    means Next on steps 01 to 04 and Send on step 05.
  - After a step change, focus goes to the new step's heading. If the
    final check or the server names a field on an earlier step, that
    step is shown and the field takes focus instead.

  props: job (a public job, optional), initialResume (a File already
  chosen elsewhere, optional), onClose (shown as the action after a
  successful submission inside an overlay), onSentChange (optional,
  see useForm).
*/

const INITIAL = {
  website: '',
  name: '',
  email: '',
  phone: '',
  location: '',
  domain: '',
  headline: '',
  skills: [],
  experienceYears: '',
  noticePeriod: '',
  expectedCompensation: '',
  profileUrl: '',
  preferredLocation: '',
  message: '',
  consent: false,
};

const SCHEMA = {
  name: { label: 'Name', rules: [required('Enter your name.')] },
  email: { label: 'Email', rules: [required('Enter your email address.'), email()] },
  phone: { label: 'Phone', rules: [phone()] },
  location: { label: 'Current location' },
  domain: { label: 'Engineering domain' },
  headline: { label: 'Current role' },
  skills: { label: 'Skills' },
  experienceYears: { label: 'Years of experience', rules: [numberBetween(0, 60)] },
  noticePeriod: { label: 'Notice period' },
  expectedCompensation: { label: 'Expected compensation' },
  profileUrl: { label: 'LinkedIn or portfolio', rules: [link()] },
  preferredLocation: { label: 'Preferred location' },
  message: { label: 'Anything else we should know' },
  consent: { label: 'Consent', rules: [accepted()] },
};

const FILE = { name: 'resume', label: 'Resume', required: 'Attach your resume as a PDF, DOC or DOCX file.' };

const STEPS = [
  { num: '01', title: 'Profile', fields: ['name', 'email', 'phone', 'location'] },
  { num: '02', title: 'Engineering', fields: ['domain', 'headline', 'skills'] },
  { num: '03', title: 'Experience', fields: ['experienceYears', 'noticePeriod', 'expectedCompensation', 'profileUrl', 'preferredLocation', 'message'] },
  { num: '04', title: 'Resume', fields: [FILE.name] },
  { num: '05', title: 'Review', fields: ['consent'] },
];
const RESUME_STEP = 3;
const LAST_STEP = STEPS.length - 1;

export default function ApplicationForm({ job = null, initialResume = null, onClose, onSentChange }) {
  const [step, setStep] = useState(0);
  const headingRef = useRef(null);
  // Set when a step is shown because one of its fields is invalid:
  // that field takes focus, not the step heading.
  const focusOnField = useRef(false);

  const form = useForm({
    initial: INITIAL,
    schema: SCHEMA,
    file: FILE,
    initialFile: initialResume,
    onSentChange,
    onInvalid: (names) => {
      const first = STEPS.findIndex((item) => item.fields.some((name) => names.includes(name)));
      if (first >= 0 && first !== step) {
        focusOnField.current = true;
        setStep(first);
      }
    },
  });
  const domainOptions = useDomainOptions(form.values.domain);

  const mounted = useRef(false);
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    const root = form.rootRef.current;
    // Bring the top of the form back into view when the step button
    // that was pressed sat below a long step (96px clears the site's
    // fixed header and the overlay's sticky title bar).
    if (root && (root.getBoundingClientRect().top < 96 || root.getBoundingClientRect().top > window.innerHeight / 2)) {
      root.scrollIntoView({ block: 'start' });
    }
    if (focusOnField.current) focusOnField.current = false;
    else headingRef.current?.focus({ preventScroll: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  const stepPasses = (index) => form.validate(
    STEPS[index].fields.filter((name) => name !== FILE.name),
    { withFile: index === RESUME_STEP },
  );

  // Back is always allowed. Forward stops at the first step that does
  // not pass, which then shows its errors.
  function goTo(target) {
    for (let index = step; index < target; index += 1) {
      if (!stepPasses(index)) return;
    }
    setStep(target);
  }

  function onSubmit(event) {
    event.preventDefault();
    if (step < LAST_STEP) {
      goTo(step + 1);
      return;
    }
    form.submit((options) => formsApi.submitApplication({ ...form.values, jobId: job ? job.id : '' }, form.file, options));
  }

  if (form.sent) {
    return (
      <SuccessPanel
        title="Application received."
        received={job ? `Your application for ${job.title} has been received.` : 'Your application has been received.'}
        email={form.values.email.trim()}
      >
        {onClose
          ? <button type="button" onClick={onClose} className={TEXT_ACTION}>Close</button>
          : <Link to="/talent" className={TEXT_ACTION}>See open positions &rarr;</Link>}
      </SuccessPanel>
    );
  }

  const current = STEPS[step];

  return (
    <form ref={form.rootRef} onSubmit={onSubmit} noValidate className="scroll-mt-24 md:scroll-mt-28">
      <Honeypot field={form.field('website')} />
      <StepIndicator step={step} onSelect={goTo} />
      {initialResume && form.file === initialResume && step === 0 && (
        <p className="mt-6 text-sm text-text-dim leading-relaxed">
          <span className="break-words text-text">{initialResume.name}</span> is attached as your resume. Add your details to send it.
        </p>
      )}

      <div className="mt-10">
        {step === 0 && (
          <FormSection num={current.num} title={current.title} headingRef={headingRef}>
            <TextField field={form.field('name')} label="Name" required autoComplete="name" maxLength={120} />
            <TextField field={form.field('email')} label="Email" type="email" required autoComplete="email" maxLength={254} />
            <TextField field={form.field('phone')} label="Phone" type="tel" autoComplete="tel" maxLength={25} />
            <TextField field={form.field('location')} label="Current location" autoComplete="address-level2" maxLength={120} placeholder="e.g. Bengaluru" />
          </FormSection>
        )}

        {step === 1 && (
          <FormSection num={current.num} title={current.title} headingRef={headingRef}>
            <SelectField field={form.field('domain')} label="Engineering domain" options={domainOptions} placeholder="Select a domain" />
            <TextField field={form.field('headline')} label="Current role" maxLength={160} placeholder="e.g. RTL Design Engineer" />
            <TagInput
              field={form.field('skills')}
              label="Skills"
              placeholder="e.g. SystemVerilog"
              hint="Press Enter or type a comma after each skill."
              className="sm:col-span-2"
            />
          </FormSection>
        )}

        {step === 2 && (
          <FormSection num={current.num} title={current.title} headingRef={headingRef}>
            <TextField field={form.field('experienceYears')} label="Years of experience" type="number" min={0} max={60} step="any" inputMode="decimal" />
            <TextField field={form.field('noticePeriod')} label="Notice period" maxLength={80} placeholder="e.g. 30 days" />
            <TextField field={form.field('expectedCompensation')} label="Expected compensation" optional maxLength={120} />
            <TextField field={form.field('profileUrl')} label="LinkedIn or portfolio" type="url" maxLength={300} placeholder="https://" autoComplete="url" />
            <TextField field={form.field('preferredLocation')} label="Preferred location" maxLength={120} className="sm:col-span-2" />
            <TextArea field={form.field('message')} label="Anything else we should know" maxLength={4000} className="sm:col-span-2" />
          </FormSection>
        )}

        {step === RESUME_STEP && (
          <FormSection num={current.num} title={current.title} headingRef={headingRef}>
            <FileDropZone field={form.fileField} label="Resume" required className="sm:col-span-2" />
          </FormSection>
        )}

        {step === LAST_STEP && (
          <FormSection num={current.num} title={current.title} headingRef={headingRef}>
            <Review form={form} job={job} onEdit={goTo} />
            <div className="sm:col-span-2">
              <Checkbox field={form.field('consent')} required>
                I agree to ALLSEMIS storing my details and resume to consider me for roles.
              </Checkbox>
            </div>
          </FormSection>
        )}
      </div>

      <div className="mt-10 space-y-6">
        {form.alert && <FormAlert alert={form.alert} />}
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
          {step > 0 ? (
            <button
              type="button"
              onClick={() => goTo(step - 1)}
              className="inline-flex min-h-[48px] w-full items-center justify-center border border-line-strong px-6 py-3 text-sm font-semibold transition-colors hover:border-accent sm:w-auto"
            >
              Back
            </button>
          ) : <span />}
          <SubmitButton sending={form.sending}>
            {step < LAST_STEP ? `Next: ${STEPS[step + 1].title}` : 'Send application'}
          </SubmitButton>
        </div>
      </div>
    </form>
  );
}

/*
  The step indicator: five numbered nodes on a line. The current
  step's name is always written out; from the sm breakpoint up every
  node carries its name. Each node is a button, so a visitor can go
  back to a step directly.
*/
function StepIndicator({ step, onSelect }) {
  return (
    <nav aria-label="Application steps">
      <ol className="flex items-start">
        {STEPS.map((item, index) => {
          const done = index < step;
          const active = index === step;
          return (
            <li key={item.num} className="relative min-w-0 flex-1 last:flex-none">
              {index < LAST_STEP && (
                <span className={`absolute left-8 right-0 top-4 h-px ${done ? 'bg-accent/60' : 'bg-line-strong'}`} aria-hidden="true" />
              )}
              <button
                type="button"
                onClick={() => onSelect(index)}
                aria-current={active ? 'step' : undefined}
                aria-label={`Step ${index + 1} of ${STEPS.length}: ${item.title}${done ? ', completed' : ''}`}
                className="group relative block text-left focus-visible:outline-none"
              >
                <span
                  className={`flex h-8 w-8 items-center justify-center rounded-full border bg-bg font-mono text-[0.65rem] transition-colors motion-reduce:transition-none group-focus-visible:outline group-focus-visible:outline-1 group-focus-visible:outline-offset-2 group-focus-visible:outline-accent ${
                    active ? 'border-accent bg-accent/15 text-text' : done ? 'border-accent/60 text-accent' : 'border-line-strong text-text-dim group-hover:border-accent/50'
                  }`}
                >
                  {item.num}
                </span>
                <span className={`mt-2.5 hidden pr-3 font-mono text-[0.62rem] uppercase tracking-[0.16em] sm:block ${active ? 'text-text' : 'text-text-dim'}`}>
                  {item.title}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
      <p className="mt-4 font-mono text-[0.62rem] uppercase tracking-[0.2em] text-text-dim sm:hidden">
        Step {step + 1} of {STEPS.length} / <span className="text-text">{STEPS[step].title}</span>
      </p>
    </nav>
  );
}

/* The read-only summary on the last step: every answer, grouped by
   the step it was given on, each group with a link back to it. */
function Review({ form, job, onEdit }) {
  const { values, file } = form;
  const groups = [
    [
      ['Name', values.name],
      ['Email', values.email],
      ['Phone', values.phone],
      ['Current location', values.location],
    ],
    [
      ['Engineering domain', values.domain],
      ['Current role', values.headline],
      ['Skills', values.skills.join(', ')],
    ],
    [
      ['Years of experience', values.experienceYears],
      ['Notice period', values.noticePeriod],
      ['Expected compensation', values.expectedCompensation],
      ['LinkedIn or portfolio', values.profileUrl],
      ['Preferred location', values.preferredLocation],
      ['Anything else we should know', values.message],
    ],
    [
      ['Resume', file ? `${file.name} (${fileExtension(file).toUpperCase()}, ${formatBytes(file.size)})` : ''],
    ],
  ];

  return (
    <div className="min-w-0 sm:col-span-2 border border-line-strong">
      {job && (
        <div className="border-b border-line px-4 py-4 sm:px-5">
          <span className="block font-mono text-[0.62rem] uppercase tracking-[0.2em] text-text-dim">Position</span>
          <p className="mt-1.5 font-display text-lg font-semibold">{job.title}</p>
        </div>
      )}
      {groups.map((rows, index) => (
        <div key={STEPS[index].num} className="border-b border-line px-4 py-4 last:border-b-0 sm:px-5">
          <div className="mb-3 flex items-center justify-between gap-4">
            <span className="font-mono text-[0.62rem] uppercase tracking-[0.2em] text-text">
              <span className="text-accent">{STEPS[index].num}</span> {STEPS[index].title}
            </span>
            <button type="button" onClick={() => onEdit(index)} aria-label={`Edit ${STEPS[index].title.toLowerCase()}`} className={TEXT_ACTION}>
              Edit
            </button>
          </div>
          {/* grid-cols-1 lets the single column on a phone shrink to the
              box, so a long link or address wraps instead of widening
              the page. */}
          <dl className="grid grid-cols-1 gap-x-6 gap-y-1 sm:grid-cols-[11rem_minmax(0,1fr)] sm:gap-y-2">
            {rows.map(([label, value]) => (
              <React.Fragment key={label}>
                <dt className="pt-0.5 font-mono text-[0.68rem] uppercase tracking-wider text-text-dim">{label}</dt>
                <dd className={`mb-2 whitespace-pre-line break-words text-sm sm:mb-0 ${value ? 'text-text' : 'text-text-dim/70'}`}>
                  {value || 'Not provided'}
                </dd>
              </React.Fragment>
            ))}
          </dl>
          {index === RESUME_STEP && form.fileField.progress !== null && (
            <UploadProgress value={form.fileField.progress} className="mt-3" />
          )}
        </div>
      ))}
    </div>
  );
}
