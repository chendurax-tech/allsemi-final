import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { chatApi } from '../../lib/api/index.js';

/*
  ChatWidget - "ALLSEMI Assistant", the floating assistant of the public
  website.

  A round launcher sits at the bottom right; it opens a compact panel
  above it. The panel is not modal: the page stays usable behind it,
  the keyboard is never trapped, Escape closes it and gives the focus
  back to the launcher.

  Every answer comes from the backend (POST /api/public/chat), which is
  rule-based (no AI service): it reads the published jobs and the
  official ALLSEMIS information and returns the reply with job cards and
  links. Nothing about jobs or the
  company is written here: the quick actions only send questions. The
  reply is shown as plain text, never as HTML.

  The conversation lives in this browser tab only (sessionStorage),
  so it survives moving between pages and is gone when the tab closes.
  The jobs last shown are sent with each message so a follow-up ("the
  second one") can be understood.
*/

const STORE_KEY = 'allsemi-assistant-v1';
const MAX_KEPT = 40;
const MAX_LENGTH = 1000;

const WELCOME = 'Hi! I’m the ALLSEMI Assistant. I can help you explore current openings, understand job requirements, learn about ALLSEMI, and understand how to apply.';

const QUICK_ACTIONS = [
  { label: 'Current Openings', message: 'What jobs are currently available?' },
  { label: 'Engineering Jobs', message: 'Show me the current engineering jobs' },
  { label: 'About ALLSEMI', message: 'What is ALLSEMI?' },
  { label: 'How to Apply', message: 'How do I apply?' },
  { label: 'Contact ALLSEMI', message: 'How can I contact ALLSEMI?' },
];

function loadSaved() {
  try {
    const saved = JSON.parse(window.sessionStorage.getItem(STORE_KEY) || 'null');
    if (saved && Array.isArray(saved.messages)) return saved;
  } catch {
    // Storage blocked or unreadable: start fresh.
  }
  return null;
}

function save(state) {
  try {
    window.sessionStorage.setItem(STORE_KEY, JSON.stringify({ messages: state.messages.slice(-MAX_KEPT), context: state.context }));
  } catch {
    // Not kept: the conversation still works in this page.
  }
}

let nextId = Date.now();
const newId = () => String(nextId++);

// --------------------------------------------------------------- display

// The reply as paragraphs and "- " lists. Text only.
function ReplyText({ text }) {
  const blocks = [];
  let list = null;
  for (const line of String(text || '').split('\n')) {
    const item = /^\s*[-•]\s+(.*)$/.exec(line);
    if (item) {
      if (!list) { list = []; blocks.push({ list }); }
      list.push(item[1]);
    } else {
      list = null;
      if (line.trim()) blocks.push({ text: line.trim() });
    }
  }
  return (
    <div className="space-y-2">
      {blocks.map((block, index) => (block.list
        ? <ul key={index} className="list-disc space-y-1 pl-4 marker:text-accent">{block.list.map((entry, i) => <li key={i}>{entry}</li>)}</ul>
        : <p key={index}>{block.text}</p>))}
    </div>
  );
}

const linkCls = 'inline-flex items-center justify-center min-h-[36px] px-3 py-1.5 text-xs font-semibold border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent';

function JobCard({ job, onNavigate }) {
  const meta = [job.location, job.experienceLevel, job.employmentType].filter(Boolean).join(' · ');
  return (
    <li className="border border-line-strong bg-bg/60 p-3">
      <p className="font-display font-semibold text-sm text-text leading-snug">{job.title}</p>
      {meta && <p className="mt-0.5 font-mono text-[0.62rem] uppercase tracking-[0.12em] text-text-dim">{meta}</p>}
      {job.summary && <p className="mt-2 text-xs leading-relaxed text-text-dim">{job.summary}</p>}
      {job.skills.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="Skills">
          {job.skills.map((skill) => <li key={skill} className="border border-line px-1.5 py-0.5 text-[0.65rem] text-text-dim">{skill}</li>)}
        </ul>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        <Link to={job.url} onClick={onNavigate} className={`${linkCls} border-line-strong text-text hover:border-accent hover:text-accent`}>
          View Job<span className="sr-only">: {job.title}</span>
        </Link>
        {job.applyUrl
          ? <Link to={job.applyUrl} onClick={onNavigate} className={`${linkCls} border-transparent bg-text text-bg hover:bg-accent`}>Apply<span className="sr-only"> for {job.title}</span></Link>
          : <span className="self-center text-[0.7rem] text-text-faint">Applications closed</span>}
      </div>
    </li>
  );
}

function AssistantMessage({ message, onNavigate }) {
  const answer = message.answer || {};
  const cardIds = new Set((answer.jobs || []).map((job) => job.id));
  const actions = (answer.actions || []).filter((action) => !(action.jobId && cardIds.has(action.jobId)));
  return (
    <div className="space-y-3">
      <ReplyText text={message.text} />
      {(answer.jobs || []).length > 0 && (
        <ul className="space-y-2" aria-label={`${answer.jobs.length} ${answer.jobs.length === 1 ? 'position' : 'positions'}`}>
          {answer.jobs.map((job) => <JobCard key={job.id} job={job} onNavigate={onNavigate} />)}
        </ul>
      )}
      {actions.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {actions.map((action) => (
            <Link key={`${action.type}-${action.href}`} to={action.href} onClick={onNavigate} className={`${linkCls} border-accent/40 text-accent hover:border-accent hover:bg-accent/10`}>
              {action.label}
            </Link>
          ))}
        </div>
      )}
      {(answer.sources || []).length > 0 && (
        <p className="font-mono text-[0.6rem] uppercase tracking-[0.12em] text-text-faint">
          Source: {answer.sources.map((source) => source.title).join(', ')}
        </p>
      )}
    </div>
  );
}

function ChatIcon() {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8a2.5 2.5 0 0 1-2.5 2.5H10l-4.5 4v-4h0A1.5 1.5 0 0 1 4 14.5z" />
      <path d="M8.5 8.5h7M8.5 11.5h4.5" />
    </svg>
  );
}

// ------------------------------------------------------------ the widget

export default function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState(() => loadSaved()?.messages || []);
  const [context, setContext] = useState(() => loadSaved()?.context || { jobIds: [], focusJobId: '' });
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState(null);
  const launcher = useRef(null);
  const input = useRef(null);
  const end = useRef(null);
  const panel = useRef(null);
  const panelId = useId();
  const titleId = useId();
  const inputId = useId();

  useEffect(() => { save({ messages, context }); }, [messages, context]);

  // The newest message in view, and the focus in the box, when it opens
  // or a message arrives.
  useEffect(() => {
    if (open) end.current?.scrollIntoView({ block: 'end' });
  }, [open, messages, busy, failure]);
  useEffect(() => {
    if (open) input.current?.focus();
  }, [open]);

  const close = useCallback(() => {
    setOpen(false);
    launcher.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    // Only when the focus is in the assistant: Escape in another dialog
    // (the application form) is that dialog's.
    const onKey = (event) => {
      const inside = panel.current?.contains(document.activeElement) || launcher.current === document.activeElement;
      if (event.key === 'Escape' && inside) close();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, close]);

  // On a phone the panel covers the page: close it when a link in it is
  // followed, so the page it opens is visible.
  const onNavigate = useCallback(() => {
    if (window.matchMedia && window.matchMedia('(max-width: 639px)').matches) setOpen(false);
  }, []);

  async function send(text, { retry = false } = {}) {
    const message = text.trim().slice(0, MAX_LENGTH);
    if (!message || busy) return;
    if (!retry) setMessages((current) => [...current, { id: newId(), role: 'user', text: message, at: Date.now() }]);
    setDraft('');
    setFailure(null);
    setBusy(true);
    try {
      const answer = await chatApi.send({ message, context });
      setMessages((current) => [...current, {
        id: newId(), role: 'assistant', text: answer.reply, at: Date.now(),
        answer: { jobs: answer.jobs || [], actions: answer.actions || [], sources: answer.sources || [], answerType: answer.answerType, intent: answer.intent },
      }]);
      if (answer.context) setContext(answer.context);
    } catch (error) {
      setFailure({ text: message, message: error?.status === 429 ? error.message : 'I’m having trouble reaching the assistant right now. You can still browse the current openings directly.' });
    }
    setBusy(false);
    input.current?.focus();
  }

  function onKeyDown(event) {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      send(draft);
    }
  }

  function restart() {
    setMessages([]);
    setContext({ jobIds: [], focusJobId: '' });
    setFailure(null);
    input.current?.focus();
  }

  const started = messages.some((item) => item.role === 'user');
  const remaining = MAX_LENGTH - draft.length;

  return (
    <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-[35] flex flex-col items-end gap-3 pointer-events-none" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      {open && (
        <section
          ref={panel}
          id={panelId}
          role="dialog"
          aria-modal="false"
          aria-labelledby={titleId}
          className="pointer-events-auto flex w-[calc(100vw-2rem)] sm:w-[400px] max-h-[min(640px,calc(100dvh-10rem))] sm:max-h-[min(640px,calc(100dvh-11.5rem))] flex-col border border-line-strong bg-bg-raised shadow-[0_24px_60px_-20px_rgba(124,58,237,0.45)]"
        >
          <header className="flex items-start gap-3 border-b border-line px-4 py-3">
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-accent/50 bg-accent/10 text-accent" aria-hidden="true"><ChatIcon /></span>
            <div className="min-w-0 flex-1">
              <h2 id={titleId} className="font-display font-semibold text-sm text-text leading-tight">ALLSEMI Assistant</h2>
              <p className="font-mono text-[0.6rem] uppercase tracking-[0.14em] text-text-dim">Company &amp; Recruitment Assistant</p>
            </div>
            {started && (
              <button type="button" onClick={restart} disabled={busy} className="px-2 py-1 text-[0.7rem] text-text-dim hover:text-text focus:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-40">
                New chat
              </button>
            )}
            <button type="button" onClick={close} aria-label="Close ALLSEMI Assistant" className="flex h-8 w-8 items-center justify-center text-text-dim hover:text-text focus:outline-none focus-visible:ring-2 focus-visible:ring-accent">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
            </button>
          </header>

          <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-4" role="log" aria-live="polite" aria-relevant="additions" aria-label="Conversation">
            <div className="space-y-4 text-sm leading-relaxed text-text">
              <div className="max-w-[92%]">
                <p className="sr-only">ALLSEMI Assistant:</p>
                <p className="border border-line bg-bg/50 px-3 py-2.5">{WELCOME}</p>
              </div>
              {!started && (
                <div className="flex flex-wrap gap-2" aria-label="Suggested questions">
                  {QUICK_ACTIONS.map((action) => (
                    <button key={action.label} type="button" onClick={() => send(action.message)} disabled={busy} className="border border-accent/40 px-3 py-1.5 text-xs font-semibold text-accent hover:border-accent hover:bg-accent/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-40">
                      {action.label}
                    </button>
                  ))}
                </div>
              )}
              {messages.map((item) => (item.role === 'user' ? (
                <div key={item.id} className="ml-auto max-w-[85%]">
                  <p className="sr-only">You:</p>
                  <p className="whitespace-pre-line bg-accent/15 border border-accent/30 px-3 py-2.5 text-text">{item.text}</p>
                </div>
              ) : (
                <div key={item.id} className="max-w-[94%]">
                  <p className="sr-only">ALLSEMI Assistant:</p>
                  <div className="border border-line bg-bg/50 px-3 py-2.5"><AssistantMessage message={item} onNavigate={onNavigate} /></div>
                </div>
              )))}
              {busy && (
                <div role="status" className="flex items-center gap-2 text-xs text-text-dim">
                  <span className="flex gap-1" aria-hidden="true">
                    <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
                    <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse [animation-delay:150ms]" />
                    <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse [animation-delay:300ms]" />
                  </span>
                  ALLSEMI Assistant is typing…
                </div>
              )}
              {failure && (
                <div role="alert" className="border border-red-400/45 bg-red-400/10 px-3 py-2.5 text-xs leading-relaxed text-text">
                  <p>{failure.message}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button type="button" onClick={() => send(failure.text, { retry: true })} className={`${linkCls} border-line-strong text-text hover:border-accent hover:text-accent`}>Try again</button>
                    <Link to="/talent" onClick={onNavigate} className={`${linkCls} border-accent/40 text-accent hover:border-accent`}>Browse openings</Link>
                  </div>
                </div>
              )}
              <div ref={end} />
            </div>
          </div>

          <form className="border-t border-line p-3" onSubmit={(event) => { event.preventDefault(); send(draft); }}>
            <label htmlFor={inputId} className="sr-only">Message ALLSEMI Assistant</label>
            <div className="flex items-end gap-2">
              <textarea
                id={inputId}
                ref={input}
                rows={1}
                value={draft}
                maxLength={MAX_LENGTH}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={onKeyDown}
                placeholder="Ask about jobs, requirements or ALLSEMI…"
                className="max-h-32 min-h-[42px] flex-1 resize-none border border-line-strong bg-bg px-3 py-2.5 text-sm text-text placeholder:text-text-faint focus:outline-none focus:border-accent"
              />
              <button type="submit" disabled={busy || !draft.trim()} aria-label="Send message" className="flex h-[42px] w-[42px] shrink-0 items-center justify-center bg-text text-bg hover:bg-accent transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-40 disabled:pointer-events-none">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
              </button>
            </div>
            <p className="mt-1.5 flex justify-between gap-2 text-[0.62rem] text-text-faint">
              <span>Enter to send · Shift+Enter for a new line</span>
              {remaining < 200 && <span aria-live="polite">{remaining} characters left</span>}
            </p>
          </form>
        </section>
      )}

      <button
        ref={launcher}
        type="button"
        onClick={() => (open ? close() : setOpen(true))}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-label={open ? 'Close ALLSEMI Assistant' : 'Open ALLSEMI Assistant'}
        className="pointer-events-auto flex h-14 w-14 items-center justify-center rounded-full border border-accent/60 bg-bg-raised text-accent shadow-[0_10px_30px_-8px_rgba(124,58,237,0.6)] transition-colors hover:bg-accent hover:text-bg focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
      >
        {open
          ? <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
          : <ChatIcon />}
      </button>
    </div>
  );
}
