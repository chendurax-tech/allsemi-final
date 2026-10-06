import React from 'react';
import { RECRUITMENT_LABELS, label } from '../data/enums.js';
import { cx } from './ui.jsx';

/*
  LabelPicker - the labels on a candidate or an application:
  Interviewed, Rejected, Selected. Each is a toggle.

  A label is a tag for the recruitment team, used to find and filter
  records. It is not a stage: turning one on or off changes no status,
  sends no email and runs no evaluation. The one workflow step is
  shortlisting, which has its own control (see ShortlistPanel).

  `value` is the list of labels that are on. onChange receives the new
  list. With `disabled` the labels are shown but cannot be changed.
  With `busy` (a save is in progress) a press is ignored for a moment,
  but the buttons are not disabled: a disabled button drops the
  keyboard focus, and the label could then not be switched again.
*/
const ON = {
  INTERVIEWED: 'border-[#5b9dff]/60 bg-[#5b9dff]/15 text-[#8ab8ff]',
  REJECTED: 'border-red-400/60 bg-red-400/15 text-red-400',
  SELECTED: 'border-turquoise/60 bg-turquoise/15 text-turquoise',
};

export default function LabelPicker({ id, value, onChange, disabled = false, busy = false, labelledBy }) {
  const chosen = value || [];
  const toggle = (name) => onChange(RECRUITMENT_LABELS.filter((item) => (item === name ? !chosen.includes(item) : chosen.includes(item))));

  return (
    <div id={id} role="group" aria-label={labelledBy ? undefined : 'Labels'} aria-labelledby={labelledBy} className="flex flex-wrap gap-2">
      {RECRUITMENT_LABELS.map((name) => {
        const on = chosen.includes(name);
        return (
          <button
            key={name}
            type="button"
            aria-pressed={on}
            aria-disabled={busy || undefined}
            disabled={disabled}
            onClick={() => { if (!busy) toggle(name); }}
            className={cx(
              'inline-flex items-center gap-2 border px-3 py-1.5 text-xs font-semibold transition-colors focus:outline-none focus-visible:border-accent disabled:cursor-not-allowed disabled:opacity-60',
              busy && 'cursor-not-allowed opacity-60',
              on ? ON[name] : 'border-line-strong text-text-dim hover:border-accent hover:text-text',
            )}
          >
            <span aria-hidden="true" className={cx('h-1.5 w-1.5 rounded-full', on ? 'bg-current' : 'border border-current')} />
            {label(name)}
          </button>
        );
      })}
    </div>
  );
}

// The labels of a record as read-only chips, for lists.
export function LabelChips({ value }) {
  const chosen = RECRUITMENT_LABELS.filter((name) => (value || []).includes(name));
  if (chosen.length === 0) return <span className="text-text-dim">None</span>;
  return (
    <span className="flex flex-wrap gap-1.5">
      {chosen.map((name) => (
        <span key={name} className={cx('inline-flex items-center border px-2 py-0.5 text-xs whitespace-nowrap', ON[name])}>{label(name)}</span>
      ))}
    </span>
  );
}
