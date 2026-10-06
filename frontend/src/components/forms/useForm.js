import { useEffect, useId, useRef, useState } from 'react';
import { checkDocument, describeFailure, FILE_ERROR_CODES } from './validation.js';

/*
  useForm - the state behind each public form (Hire Talent, the
  candidate application, the enquiry and the referral).

  It owns the values, which fields have been visited, the attached
  document, the submission in flight and what went wrong, so the four
  forms behave the same way:

  - A field shows its error after it has been left (blur) or after a
    submit attempt, never while it is first being typed into.
  - A failed check lists the fields in an alert and moves focus to the
    first invalid control (found in document order through the
    data-invalid attribute the field components set).
  - A server validation error is shown beside the field it names. A
    server answer about the document is shown on the drop zone.
  - The upload reports progress (0 to 1) and is cancelled if the form
    goes away while it is running.

  schema: { fieldName: { label, rules: [rule, ...] } } - see
          validation.js for the rules. Every field the form sends is
          listed, so a server message can always be matched to a label.
  file:   { name, label, required } - `required` is the message shown
          when the document is missing; leave it out when the document
          is optional.
  onInvalid(names): called with the invalid field names (the document
          counts under file.name) in the same update that moves focus,
          so a stepped form can first show the step they are on.
  onSentChange(sent): called when the form is accepted (true) and when
          it is reset for another submission (false), so the page
          around it can put away its own "fill this in" prompt.
*/
/*
  A browser scrolls a newly focused field into the window, but it does
  nothing for a field that is already inside the window and covered by
  the site's fixed header or by the application overlay's title bar,
  which is where the first field of a short form sits on a phone once
  its button has been pressed. So after focus has moved, a field (with
  its label, about 32px above it) that is under one of those bars, or
  below the bottom edge, is brought to the middle of the window.
*/
const BAR_HEIGHT = 96;

function reveal(control) {
  const box = (control.closest('label') || control).getBoundingClientRect();
  const overlay = control.closest('[role="dialog"]');
  const clearTop = (overlay ? Math.max(0, overlay.getBoundingClientRect().top) : 0) + BAR_HEIGHT + 32;
  if (box.top < clearTop || box.bottom > window.innerHeight - 16) control.scrollIntoView({ block: 'center' });
}

export function useForm({ initial, schema, file: fileSpec = null, initialFile = null, onInvalid, onSentChange }) {
  const uid = useId();
  const rootRef = useRef(null);
  const request = useRef(null);
  const [values, setValues] = useState(initial);
  const [touched, setTouched] = useState({});
  const [serverErrors, setServerErrors] = useState({});
  const [file, setFile] = useState(initialFile);
  const [fileError, setFileError] = useState('');
  const [status, setStatus] = useState('idle'); // idle | sending | sent
  const [progress, setProgress] = useState(null);
  const [alert, setAlert] = useState(null);
  const [focusTick, setFocusTick] = useState(0);

  useEffect(() => () => request.current?.abort(), []);

  const sent = status === 'sent';
  useEffect(() => {
    if (onSentChange) onSentChange(sent);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sent]);

  // Runs after the render that marked the fields invalid.
  useEffect(() => {
    if (focusTick === 0) return;
    const target = rootRef.current?.querySelector('[data-invalid="true"]');
    if (!target) return;
    target.focus();
    reveal(target);
  }, [focusTick]);

  const labelOf = (name) => schema[name]?.label || (fileSpec?.name === name ? fileSpec.label : name);

  function ruleError(name) {
    for (const rule of schema[name]?.rules || []) {
      const message = rule(values[name], values);
      if (message) return message;
    }
    return '';
  }

  function set(name, value) {
    setValues((current) => ({ ...current, [name]: value }));
    // The server's message was about the old value.
    setServerErrors((current) => {
      if (!current[name]) return current;
      const rest = { ...current };
      delete rest[name];
      return rest;
    });
  }

  function field(name) {
    return {
      id: `${uid}-${name}`,
      name,
      value: values[name],
      error: serverErrors[name] || (touched[name] ? ruleError(name) : ''),
      onChange: (value) => set(name, value),
      onBlur: () => setTouched((current) => (current[name] ? current : { ...current, [name]: true })),
    };
  }

  // A refused file is not attached, and a file already attached stays.
  function chooseFile(next) {
    if (!next) {
      setFile(null);
      setFileError('');
      return;
    }
    const problem = checkDocument(next);
    if (problem) {
      setFileError(`"${next.name}" was not attached. ${problem}`);
      return;
    }
    setFile(next);
    setFileError('');
  }

  function report(names, title, message, notes = []) {
    setAlert({ title, message, fields: names.map(labelOf), notes });
    if (names.length === 0) return;
    if (onInvalid) onInvalid(names);
    setFocusTick((tick) => tick + 1);
  }

  /*
    validate(names, { withFile }) -> true when everything named passes.
    Called with no arguments it checks the whole form; a stepped form
    passes the fields of the step being left.
  */
  function validate(names = Object.keys(schema), { withFile = true } = {}) {
    const invalid = names.filter((name) => ruleError(name));
    const missingFile = Boolean(withFile && fileSpec?.required && !file);
    setTouched((current) => ({ ...current, ...Object.fromEntries(names.map((name) => [name, true])) }));
    if (missingFile) {
      setFileError(fileSpec.required);
      invalid.push(fileSpec.name);
    }
    if (invalid.length === 0) {
      setAlert(null);
      return true;
    }
    report(invalid, 'Check the form', invalid.length === 1 ? 'One field needs attention.' : `${invalid.length} fields need attention.`);
    return false;
  }

  /*
    submit(send) - validates, then calls send({ onProgress, signal }),
    which returns the request promise from lib/api.
  */
  async function submit(send) {
    if (status === 'sending' || !validate()) return;
    const controller = new AbortController();
    request.current = controller;
    setServerErrors({});
    setStatus('sending');
    setProgress(0);
    try {
      await send({ onProgress: setProgress, signal: controller.signal });
      setStatus('sent');
    } catch (error) {
      if (error?.name === 'AbortError') return;
      setStatus('idle');
      setProgress(null);
      const messages = error?.fields || {};
      const known = Object.keys(messages).filter((name) => schema[name]);
      setServerErrors(Object.fromEntries(known.map((name) => [name, messages[name]])));
      const invalid = [...known];
      if (fileSpec && FILE_ERROR_CODES.includes(error?.code)) {
        setFileError(error.message || describeFailure(error));
        invalid.push(fileSpec.name);
      }
      // A message about something that is not a field on screen is
      // still shown, in the panel.
      const notes = Object.keys(messages).filter((name) => !schema[name]).map((name) => messages[name]);
      report(invalid, 'Not sent', describeFailure(error), notes);
    }
  }

  function reset() {
    setValues(initial);
    setTouched({});
    setServerErrors({});
    setFile(null);
    setFileError('');
    setStatus('idle');
    setProgress(null);
    setAlert(null);
  }

  return {
    rootRef,
    values,
    field,
    file,
    fileField: {
      id: `${uid}-file`,
      file,
      error: fileError,
      onSelect: chooseFile,
      progress: status === 'sending' && file ? progress : null,
    },
    validate,
    submit,
    reset,
    alert,
    sending: status === 'sending',
    sent,
  };
}
