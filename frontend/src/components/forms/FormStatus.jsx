import React, { useEffect, useRef } from 'react';
import { MeasurementLabel } from '../../lib/motionPrimitives.jsx';

/*
  The end of a form: the alert for a failed check or a failed send, the
  submit button with its busy state, and the panel that replaces the
  form once the server has accepted the submission.
*/

/*
  FormAlert - alert: { title, message, fields, notes } from useForm.
  role="alert" has it read out when it appears. The same panel serves
  a failed client check ("Check the form") and a server failure ("Not
  sent"), so a visitor always looks in one place.
*/
export function FormAlert({ alert }) {
  return (
    <div role="alert" className="border-l-2 border-red-500 bg-red-500/[0.06] px-4 py-3.5">
      <p className="mb-1.5 font-mono text-[0.62rem] uppercase tracking-[0.2em] text-red-400">{alert.title}</p>
      <p className="text-sm leading-relaxed text-text">{alert.message}</p>
      {alert.fields.length > 0 && (
        <p className="mt-1 text-sm leading-relaxed text-text-dim">Check: {alert.fields.join(', ')}.</p>
      )}
      {alert.notes.map((note) => (
        <p key={note} className="mt-1 text-sm leading-relaxed text-text-dim">{note}</p>
      ))}
    </div>
  );
}

// While sending, the button stays focusable (aria-disabled, not
// disabled) so a keyboard user does not lose their place; useForm
// ignores a second submit.
//
// Pressing it with the pointer does not take focus out of the field
// being typed in (the default action of mousedown is cancelled). If it
// did, that field would be checked on blur, its error line could
// appear and push this button down before the press was released, and
// the click would land beside the button and be lost. The click
// itself still submits the form, which checks every field.
export function SubmitButton({ sending, children }) {
  return (
    <button
      type="submit"
      onMouseDown={(event) => event.preventDefault()}
      aria-disabled={sending || undefined}
      aria-busy={sending || undefined}
      className={`w-full sm:w-auto inline-flex justify-center items-center gap-2.5 min-h-[48px] text-sm font-semibold px-6 py-3 bg-text text-bg transition-colors ${
        sending ? 'cursor-progress opacity-70' : 'hover:bg-accent'
      }`}
    >
      {sending && <span className="h-1.5 w-1.5 bg-bg animate-pulse motion-reduce:animate-none" aria-hidden="true" />}
      {sending ? 'Sending' : children}
    </button>
  );
}

/*
  SuccessPanel - shown in place of the form after a submission is
  accepted. It takes focus so the result is announced and so keyboard
  focus is not left on a button that no longer exists.

  It states only what is known at this point: the submission was
  received, and the backend sends a confirmation email to the address
  given. `email` is that address.
*/
export function SuccessPanel({ title, received, email, children }) {
  const ref = useRef(null);

  useEffect(() => {
    ref.current?.focus({ preventScroll: true });
    ref.current?.scrollIntoView({ block: 'center' });
  }, []);

  return (
    <div ref={ref} tabIndex={-1} role="status" className="py-6 focus:outline-none">
      <div className="mb-5 inline-flex h-14 w-14 items-center justify-center rounded-full border border-accent/40 bg-accent/10">
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-accent" aria-hidden="true">
          <path d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <MeasurementLabel className="block mb-2">Received</MeasurementLabel>
      <h3 className="font-display font-semibold text-2xl mb-3">{title}</h3>
      <p className="max-w-md leading-relaxed text-text-dim">
        {received} A confirmation email is on its way to <span className="break-words text-text">{email}</span>.
      </p>
      {children && <div className="mt-6">{children}</div>}
    </div>
  );
}

// The quiet text action used under a success message and for small
// secondary actions inside the forms.
export const TEXT_ACTION = 'font-mono text-xs uppercase tracking-widest text-accent hover:text-accent-2 transition-colors focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-4 focus-visible:outline-accent';
