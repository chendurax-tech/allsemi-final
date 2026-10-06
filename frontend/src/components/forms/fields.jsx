import React, { useEffect, useRef, useState } from 'react';

/*
  Shared form fields - one visual system for the four public forms
  (Hire Talent, the candidate application, the enquiry, the referral).

  The look follows the forms the site already had: a mono uppercase
  micro-label, an underline input on the page background, thin lines
  and the accent colour for focus and selection. What is added is
  structure (numbered sections), a quiet focus marker (the underline
  draws in from the left; it appears at once under
  prefers-reduced-motion) and consistent error wiring.

  Every field takes `field`, the object useForm().field(name) returns:
  { id, name, value, error, onChange(value), onBlur() }. An invalid
  control carries aria-invalid, points at its message through
  aria-describedby and is marked data-invalid so the form can move
  focus to the first one.

  Accent colour: everything here uses the `accent` utilities, which
  read the --color-accent variable. FormAccent re-points that variable
  for its children, so the Refer page renders the same components in
  turquoise without a second set of classes.
*/

const TURQUOISE = { '--color-accent': '#2dd4bf', '--color-accent-2': '#14b8a6' };

export function FormAccent({ tone, children }) {
  return <div style={tone === 'turquoise' ? TURQUOISE : undefined}>{children}</div>;
}

const LABEL = 'block font-mono text-xs uppercase tracking-wider text-text-dim mb-2 transition-colors group-focus-within:text-text motion-reduce:transition-none';
const CONTROL = 'peer block w-full rounded-none bg-transparent border-b text-text text-base py-2 caret-accent [color-scheme:dark] focus:outline-none transition-colors placeholder:text-text-dim/60 autofill:shadow-[inset_0_0_0_1000px_#07070b] autofill:[-webkit-text-fill-color:#edeff0]';
const MARKER = 'pointer-events-none absolute left-0 bottom-0 h-px w-full origin-left scale-x-0 transition-transform duration-300 ease-out peer-focus:scale-x-100 motion-reduce:transition-none';
const FOCUS_RING = 'peer-focus-visible:outline peer-focus-visible:outline-1 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent';

const describedBy = (id, hint, error) => [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(' ') || undefined;

function LabelText({ label, required, optional }) {
  return (
    <>
      {label}
      {required && <span className="text-accent" aria-hidden="true"> *</span>}
      {optional && <span className="text-text-dim/70"> (optional)</span>}
    </>
  );
}

function Hint({ id, children }) {
  return <p id={`${id}-hint`} className="text-xs text-text-dim leading-relaxed mt-2">{children}</p>;
}

export function FieldError({ id, children }) {
  return <p id={`${id}-error`} className="font-mono text-xs text-red-400 leading-relaxed mt-2">! {children}</p>;
}

// The label, the control and its hint or error message.
function Frame({ field, label, required, optional, hint, className = '', children }) {
  return (
    <div className={`group min-w-0 ${className}`}>
      <label htmlFor={field.id} className={LABEL}>
        <LabelText label={label} required={required} optional={optional} />
      </label>
      <div className="relative">
        {children}
        <span className={`${MARKER} ${field.error ? 'bg-red-400' : 'bg-accent'}`} aria-hidden="true" />
      </div>
      {hint && !field.error && <Hint id={field.id}>{hint}</Hint>}
      {field.error && <FieldError id={field.id}>{field.error}</FieldError>}
    </div>
  );
}

// The attributes every native control shares.
function controlProps(field, { required, hint }) {
  return {
    id: field.id,
    name: field.name,
    onBlur: field.onBlur,
    'aria-required': required || undefined,
    'aria-invalid': field.error ? true : undefined,
    'aria-describedby': describedBy(field.id, hint && !field.error, field.error),
    'data-invalid': field.error ? 'true' : undefined,
  };
}

const lineColour = (field) => (field.error ? 'border-red-500' : 'border-line-strong');

/* ---------- section ---------- */

// A numbered group of fields: "01 CONTACT" and a thin rule, then the
// fields in two columns from the sm breakpoint up. A field that needs
// the full width takes className="sm:col-span-2". A stepped form
// passes headingRef so it can move focus to the heading of a new step.
export function FormSection({ num, title, headingRef, children }) {
  return (
    <section>
      <h3
        ref={headingRef}
        tabIndex={headingRef ? -1 : undefined}
        className="flex items-center gap-3 mb-7 font-mono text-[0.62rem] uppercase tracking-[0.2em] focus:outline-none"
      >
        <span className="text-accent">{num}</span>
        <span className="text-text">{title}</span>
        <span className="h-px flex-1 bg-line-strong" aria-hidden="true" />
      </h3>
      <div className="grid gap-x-8 gap-y-7 sm:grid-cols-2">{children}</div>
    </section>
  );
}

/* ---------- text, textarea, select ---------- */

export function TextField({ field, label, type = 'text', required = false, optional = false, hint, className, ...input }) {
  return (
    <Frame field={field} label={label} required={required} optional={optional} hint={hint} className={className}>
      <input
        {...input}
        {...controlProps(field, { required, hint })}
        type={type}
        value={field.value}
        onChange={(event) => field.onChange(event.target.value)}
        className={`${CONTROL} ${lineColour(field)}`}
      />
    </Frame>
  );
}

export function TextArea({ field, label, required = false, optional = false, hint, className, rows = 4, ...input }) {
  return (
    <Frame field={field} label={label} required={required} optional={optional} hint={hint} className={className}>
      <textarea
        {...input}
        {...controlProps(field, { required, hint })}
        rows={rows}
        value={field.value}
        onChange={(event) => field.onChange(event.target.value)}
        className={`${CONTROL} resize-none ${lineColour(field)}`}
      />
    </Frame>
  );
}

// options: an array of strings, used as both the value and the label.
export function SelectField({ field, label, options, placeholder = 'Select', required = false, optional = false, hint, className }) {
  return (
    <Frame field={field} label={label} required={required} optional={optional} hint={hint} className={className}>
      <select
        {...controlProps(field, { required, hint })}
        value={field.value}
        onChange={(event) => field.onChange(event.target.value)}
        className={`${CONTROL} appearance-none bg-bg pr-8 ${field.value ? '' : 'text-text-dim'} ${lineColour(field)}`}
      >
        <option value="">{placeholder}</option>
        {options.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
      <svg
        viewBox="0 0 12 12" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.4"
        className="pointer-events-none absolute right-1 top-1/2 -translate-y-1/2 text-text-dim" aria-hidden="true"
      >
        <path d="M2.5 4.5L6 8l3.5-3.5" />
      </svg>
    </Frame>
  );
}

/* ---------- choice chips ---------- */

/*
  A small enumeration shown as chips. Underneath it is a native radio
  group, so Tab enters it once and the arrow keys move the selection,
  as people expect of radios. An optional group can be cleared by
  activating the selected chip again.

  options: [{ value, label }]
*/
export function ChoiceGroup({ field, label, options, required = false, optional = false, hint, className = '' }) {
  return (
    <div className={`min-w-0 ${className}`}>
      <div
        role="radiogroup"
        aria-labelledby={`${field.id}-label`}
        aria-describedby={describedBy(field.id, hint && !field.error, field.error)}
        aria-required={required || undefined}
        aria-invalid={field.error ? true : undefined}
      >
        <span id={`${field.id}-label`} className="block font-mono text-xs uppercase tracking-wider text-text-dim mb-3">
          <LabelText label={label} required={required} optional={optional} />
        </span>
        <div className="flex flex-wrap gap-2">
          {options.map((option, index) => {
            const selected = field.value === option.value;
            return (
              <label key={option.value} className="relative cursor-pointer">
                <input
                  type="radio"
                  name={field.id}
                  value={option.value}
                  checked={selected}
                  onChange={() => field.onChange(option.value)}
                  onClick={() => { if (selected && !required) field.onChange(''); }}
                  onBlur={field.onBlur}
                  data-invalid={field.error && index === 0 ? 'true' : undefined}
                  className="peer sr-only"
                />
                <span
                  className={`inline-flex min-h-[40px] items-center gap-2.5 border px-3.5 py-2 font-mono text-xs uppercase tracking-wide transition-colors motion-reduce:transition-none ${FOCUS_RING} ${
                    selected ? 'border-accent bg-accent/10 text-text' : 'border-line text-text-dim hover:border-accent/50 hover:text-text'
                  }`}
                >
                  <span className={`h-1.5 w-1.5 shrink-0 transition-colors motion-reduce:transition-none ${selected ? 'bg-accent' : 'bg-text-faint'}`} aria-hidden="true" />
                  {option.label}
                </span>
              </label>
            );
          })}
        </div>
      </div>
      {hint && !field.error && <Hint id={field.id}>{hint}</Hint>}
      {field.error && <FieldError id={field.id}>{field.error}</FieldError>}
    </div>
  );
}

/* ---------- checkbox ---------- */

export function Checkbox({ field, required = false, children }) {
  const checked = field.value === true;
  const box = checked ? 'border-accent bg-accent/15 text-accent' : field.error ? 'border-red-500' : 'border-line-strong group-hover:border-accent/60';
  return (
    <div>
      <label className="group relative flex items-start gap-3 cursor-pointer text-sm text-text-dim leading-relaxed">
        <input
          {...controlProps(field, { required })}
          type="checkbox"
          checked={checked}
          onChange={(event) => field.onChange(event.target.checked)}
          className="peer sr-only"
        />
        <span className={`mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center border transition-colors motion-reduce:transition-none ${FOCUS_RING} ${box}`}>
          {checked && (
            <svg viewBox="0 0 12 12" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M2.5 6.5l2.5 2.5 4.5-5.5" />
            </svg>
          )}
        </span>
        <span>
          {children}
          {required && <span className="text-accent" aria-hidden="true"> *</span>}
        </span>
      </label>
      {field.error && <FieldError id={field.id}>{field.error}</FieldError>}
    </div>
  );
}

/* ---------- tags ---------- */

/*
  A list of short values (skills) typed one at a time: Enter or a
  comma adds the typed text as a tag, Backspace in the empty input
  removes the last tag, and each tag has its own remove button. Text
  still in the input when the field is left, or when the form is
  submitted from its button, becomes a tag too, so nothing typed is
  lost. field.value is an array of strings.
*/
export function TagInput({ field, label, optional = false, hint, placeholder, className = '', maxItems = 40, maxLength = 80 }) {
  const [draft, setDraft] = useState('');
  const inputRef = useRef(null);
  const tags = field.value;

  function add(raw) {
    const next = [...tags];
    for (const item of raw.split(/[,\n]/).map((part) => part.trim().slice(0, maxLength)).filter(Boolean)) {
      const known = next.some((tag) => tag.toLowerCase() === item.toLowerCase());
      if (!known && next.length < maxItems) next.push(item);
    }
    if (next.length !== tags.length) field.onChange(next);
    setDraft('');
  }

  function remove(tag) {
    field.onChange(tags.filter((item) => item !== tag));
    inputRef.current?.focus();
  }

  // The submit button does not take focus from this input when it is
  // pressed (see SubmitButton), so there is no blur to add the typed
  // text. The form's submit event adds it instead. The listener is on
  // the form element, so it runs before the form's own submit handler.
  useEffect(() => {
    const form = inputRef.current?.form;
    if (!form || !draft.trim()) return undefined;
    const addDraft = () => add(draft);
    form.addEventListener('submit', addDraft);
    return () => form.removeEventListener('submit', addDraft);
  });

  function onKeyDown(event) {
    if (event.key === 'Enter' || event.key === ',') {
      // Enter in the empty input is left alone, so it moves a stepped
      // form on like any other single-line field.
      if (draft.trim() || event.key === ',') event.preventDefault();
      if (draft.trim()) add(draft);
    } else if (event.key === 'Backspace' && draft === '' && tags.length > 0) {
      field.onChange(tags.slice(0, -1));
    }
  }

  return (
    <div className={`group min-w-0 ${className}`}>
      <label htmlFor={field.id} className={LABEL}>
        <LabelText label={label} optional={optional} />
      </label>
      {/* Clicking anywhere in the box puts the cursor in the input. */}
      <div
        className={`relative flex flex-wrap items-center gap-2 border-b py-1.5 cursor-text ${lineColour(field)}`}
        onClick={() => inputRef.current?.focus()}
      >
        {tags.map((tag) => (
          <span key={tag} className="inline-flex max-w-full items-center gap-1 border border-accent/40 py-1 pl-2.5 pr-1 font-mono text-xs uppercase tracking-wide text-text">
            <span className="truncate">{tag}</span>
            <button
              type="button"
              onClick={(event) => { event.stopPropagation(); remove(tag); }}
              aria-label={`Remove ${tag}`}
              className="flex h-5 w-5 shrink-0 items-center justify-center text-text-dim hover:text-accent focus-visible:outline focus-visible:outline-1 focus-visible:outline-accent"
            >
              <svg viewBox="0 0 10 10" width="8" height="8" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true"><path d="M1 1l8 8M9 1l-8 8" /></svg>
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          id={field.id}
          type="text"
          value={draft}
          maxLength={maxLength}
          placeholder={tags.length === 0 ? placeholder : undefined}
          autoComplete="off"
          enterKeyHint="done"
          aria-describedby={describedBy(field.id, hint, field.error)}
          aria-invalid={field.error ? true : undefined}
          data-invalid={field.error ? 'true' : undefined}
          onChange={(event) => (event.target.value.includes(',') ? add(event.target.value) : setDraft(event.target.value))}
          onKeyDown={onKeyDown}
          onBlur={() => { if (draft.trim()) add(draft); field.onBlur(); }}
          className="peer min-w-[9rem] flex-1 rounded-none bg-transparent py-1 text-base text-text caret-accent focus:outline-none placeholder:text-text-dim/60"
        />
        <span className={`${MARKER} ${field.error ? 'bg-red-400' : 'bg-accent'}`} aria-hidden="true" />
      </div>
      {hint && <Hint id={field.id}>{hint}</Hint>}
      {field.error && <FieldError id={field.id}>{field.error}</FieldError>}
    </div>
  );
}

/* ---------- honeypot ---------- */

/*
  The anti-spam field the backend's honeypot middleware reads. It is
  named "website", is hidden from sight and from assistive technology,
  cannot be reached with Tab and is never filled by the site. An
  automated form filler that completes it has its submission discarded
  by the server.
*/
export function Honeypot({ field }) {
  return (
    <div className="sr-only" aria-hidden="true">
      <label htmlFor={field.id}>Website</label>
      <input
        id={field.id}
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        value={field.value}
        onChange={(event) => field.onChange(event.target.value)}
      />
    </div>
  );
}
