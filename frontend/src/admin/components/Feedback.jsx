import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Button, cx } from './ui.jsx';

/*
  Feedback - the admin's own confirmation dialog and notifications.
  Nothing in the admin uses the browser's own alert or confirm boxes.

  useConfirm() gives a function that asks a question in a dialog drawn
  in the admin's own style and resolves to true or false:

      const ask = useConfirm();
      if (!(await ask({ title: 'Delete candidate?', message: '...', confirmLabel: 'Delete', tone: 'danger' }))) return;

    title         the question, as the heading
    message       one or two sentences on what will happen
    confirmLabel  the word on the button that goes ahead
    cancelLabel   defaults to "Cancel"
    tone          'danger' for something that removes or cannot be
                  undone (the red button style the admin already has),
                  otherwise the primary button

  The dialog opens with the keyboard focus on Cancel, so a stray Enter
  never confirms. Escape cancels. A click outside the dialog does
  nothing, and the two buttons ignore a press in the first moment after
  the dialog opens: the second click of a double click on the button
  that opened it can therefore neither confirm nor dismiss it. Tab
  stays inside the dialog, and the focus returns to where it was when
  it closes.

  useNotify() gives a function that shows a short message at the top
  right of the admin, below the top bar, without stopping anything. It
  sits clear of the buttons at the bottom of a drawer:

      const notify = useNotify();
      notify({ tone: 'success', message: 'Shortlist email sent successfully.' });

    tone  'success', 'error' or 'info'
  A success or an information message goes away by itself after a few
  seconds. An error stays until it is dismissed. Every message has a
  Dismiss button. They are announced to a screen reader: errors at
  once, the others when it is next idle.

  Both come from <FeedbackProvider>, which AdminApp places around every
  signed-in screen.
*/

const ConfirmContext = createContext(null);
const NotifyContext = createContext(null);

const TONES = {
  success: { box: 'border-turquoise/50', mark: 'bg-turquoise', label: 'Success' },
  error: { box: 'border-red-400/60', mark: 'bg-red-400', label: 'Error' },
  info: { box: 'border-info/50', mark: 'bg-info', label: 'Information' },
};
const AUTO_DISMISS_MS = 7000;
// How long the dialog ignores its buttons after it opens (see above).
const SETTLE_MS = 350;
const MAX_SHOWN = 4;

function ConfirmDialog({ request, onAnswer }) {
  const box = useRef(null);
  const cancel = useRef(null);
  const openedAt = useRef(performance.now());
  const { title, message, confirmLabel = 'Confirm', cancelLabel = 'Cancel', tone = 'primary' } = request;
  const choose = (value) => { if (performance.now() - openedAt.current >= SETTLE_MS) onAnswer(value); };

  // Focus starts on Cancel and goes back to where it was afterwards.
  useEffect(() => {
    const before = document.activeElement;
    cancel.current?.focus();
    return () => { if (before && typeof before.focus === 'function') before.focus(); };
  }, []);

  useEffect(() => {
    const onKey = (event) => {
      if (event.key === 'Escape') {
        // Only this dialog closes: a drawer underneath stays open.
        event.stopImmediatePropagation();
        event.preventDefault();
        onAnswer(false);
        return;
      }
      if (event.key !== 'Tab') return;
      const buttons = [...(box.current?.querySelectorAll('button') || [])];
      if (buttons.length === 0) return;
      const first = buttons[0];
      const last = buttons[buttons.length - 1];
      if (!box.current.contains(document.activeElement)) {
        event.preventDefault();
        first.focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    // Capture, so it runs before a drawer's own Escape handler.
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [onAnswer]);

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 font-body text-text" data-confirm-dialog="open">
      <div className="absolute inset-0 bg-bg/80" aria-hidden="true" />
      <div
        ref={box}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="admin-confirm-title"
        aria-describedby="admin-confirm-message"
        className="relative w-full max-w-md border border-line-strong bg-bg"
      >
        <div className="border-b border-line px-5 py-4">
          <h2 id="admin-confirm-title" className="font-display text-lg font-semibold tracking-tight break-words">{title}</h2>
        </div>
        <p id="admin-confirm-message" className="px-5 py-5 text-sm leading-relaxed text-text-dim break-words">{message}</p>
        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line px-5 py-4">
          <Button ref={cancel} onClick={() => choose(false)} data-confirm="cancel">{cancelLabel}</Button>
          <Button variant={tone === 'danger' ? 'danger' : 'primary'} onClick={() => choose(true)} data-confirm="accept">{confirmLabel}</Button>
        </div>
      </div>
    </div>
  );
}

function Notification({ item, onDismiss }) {
  const tone = TONES[item.tone] || TONES.info;
  useEffect(() => {
    if (item.tone === 'error') return undefined;
    const timer = setTimeout(() => onDismiss(item.id), AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [item.id, item.tone, onDismiss]);

  return (
    <li className={cx('pointer-events-auto flex items-start gap-3 border bg-bg px-4 py-3', tone.box)} data-notification={item.tone}>
      <span className={cx('mt-[0.45em] h-2 w-2 shrink-0', tone.mark)} aria-hidden="true" />
      <p className="min-w-0 flex-1 text-sm leading-relaxed break-words">
        <span className="sr-only">{tone.label}: </span>
        {item.message}
      </p>
      <button
        type="button"
        onClick={() => onDismiss(item.id)}
        className="shrink-0 font-mono text-[0.62rem] uppercase tracking-[0.14em] text-text-dim transition-colors hover:text-text focus:outline-none focus-visible:text-accent"
      >
        Dismiss
      </button>
    </li>
  );
}

export function FeedbackProvider({ children }) {
  // The question being asked, with the function that settles it.
  const [request, setRequest] = useState(null);
  const settle = useRef(null);
  const [items, setItems] = useState([]);
  const nextId = useRef(1);

  const ask = useCallback((options) => new Promise((resolve) => {
    // A second question while one is open: the first is answered "no".
    if (settle.current) settle.current(false);
    settle.current = resolve;
    setRequest(typeof options === 'string' ? { title: options, message: '' } : options);
  }), []);

  const answer = useCallback((value) => {
    const resolve = settle.current;
    settle.current = null;
    setRequest(null);
    if (resolve) resolve(value);
  }, []);

  // Leaving the admin with a question open answers it "no".
  useEffect(() => () => { if (settle.current) settle.current(false); }, []);

  const dismiss = useCallback((id) => setItems((current) => current.filter((item) => item.id !== id)), []);
  const notify = useCallback((options) => {
    const item = typeof options === 'string' ? { message: options } : options;
    if (!item?.message) return;
    const id = nextId.current;
    nextId.current += 1;
    setItems((current) => [...current, { id, tone: TONES[item.tone] ? item.tone : 'info', message: String(item.message) }].slice(-MAX_SHOWN));
  }, []);

  const errors = items.filter((item) => item.tone === 'error');
  const others = items.filter((item) => item.tone !== 'error');
  const notifications = useMemo(() => notify, [notify]);

  return (
    <ConfirmContext.Provider value={ask}>
      <NotifyContext.Provider value={notifications}>
        {children}
        {/* Two live regions that are always in the page, so a screen
            reader hears a message arrive. Errors interrupt, the rest
            wait. They carry aria-live and no alert or status role, so
            an empty region is not itself announced as an alert. */}
        <div className="pointer-events-none fixed inset-x-0 top-16 z-[60] flex flex-col items-end gap-2 px-4 font-body text-text sm:left-auto sm:w-full sm:max-w-sm" data-notifications="region">
          <ul aria-live="assertive" aria-relevant="additions" aria-label="Errors" className="flex w-full flex-col gap-2">
            {errors.map((item) => <Notification key={item.id} item={item} onDismiss={dismiss} />)}
          </ul>
          <ul aria-live="polite" aria-relevant="additions" aria-label="Notifications" className="flex w-full flex-col gap-2">
            {others.map((item) => <Notification key={item.id} item={item} onDismiss={dismiss} />)}
          </ul>
        </div>
        {request && <ConfirmDialog request={request} onAnswer={answer} />}
      </NotifyContext.Provider>
    </ConfirmContext.Provider>
  );
}

// Outside the provider (a screen shown before sign-in) a question is
// answered "no" and a message is dropped: neither ever falls back to
// the browser's own dialogs.
const refuse = () => Promise.resolve(false);
const drop = () => {};

export const useConfirm = () => useContext(ConfirmContext) || refuse;
export const useNotify = () => useContext(NotifyContext) || drop;
