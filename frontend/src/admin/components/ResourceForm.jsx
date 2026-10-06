import React, { useState } from 'react';
import { cx, inputCls, labelCls, Notice } from './ui.jsx';
import MediaUploader from './MediaUploader.jsx';
import LabelPicker from './LabelPicker.jsx';
import { label as enumLabel } from '../data/enums.js';

/*
  ResourceForm - renders an edit form from a list of field definitions
  (see data/resources.js). One form component serves every content and
  recruitment resource, in a drawer or on a full page.

  Field types: text, textarea, number, date, select, toggle, tags
  (comma separated), lines (one per line), body (article blocks), media
  (an image, see MediaUploader), labels (see LabelPicker) and readonly.

  A select shows the readable label of an enum value and stores the
  value itself. `errors` holds the messages the server returned for
  individual fields; each is shown under its field. `readOnly` shows
  the record to a role that may view it but not change it. `saved` is
  the record as the database has it, which the image field needs.
*/

// Article body: typed blocks <-> a plain text box. A blank line starts a
// new block. "## " is a heading, "> " a pull quote, "- " a list item.
export function blocksToText(blocks = []) {
  return blocks.map((block) => {
    if (block.type === 'h2') return `## ${block.text}`;
    if (block.type === 'quote') return `> ${block.text}`;
    if (block.type === 'list') return block.items.map((item) => `- ${item}`).join('\n');
    return block.text;
  }).join('\n\n');
}

export function textToBlocks(text) {
  return text.split(/\n\s*\n/).map((chunk) => chunk.trim()).filter(Boolean).map((chunk) => {
    if (chunk.startsWith('## ')) return { type: 'h2', text: chunk.slice(3).trim() };
    if (chunk.startsWith('> ')) return { type: 'quote', text: chunk.slice(2).trim() };
    const lines = chunk.split('\n').map((line) => line.trim());
    if (lines.every((line) => line.startsWith('- '))) return { type: 'list', items: lines.map((line) => line.slice(2).trim()) };
    return { type: 'p', text: lines.join(' ') };
  });
}

// Keeps what the editor is typing as text, and reports the parsed value
// upward. Re-deriving the text from the parsed value on every keystroke
// would swallow the comma or line break being typed.
function ParsedField({ id, initial, parse, onChange, rows, placeholder, disabled }) {
  const [text, setText] = useState(initial);
  const handle = (e) => { setText(e.target.value); onChange(parse(e.target.value)); };
  if (rows) {
    return <textarea id={id} rows={rows} value={text} placeholder={placeholder} onChange={handle} disabled={disabled} className={cx(inputCls, 'resize-y leading-relaxed')} />;
  }
  return <input id={id} type="text" value={text} placeholder={placeholder} onChange={handle} disabled={disabled} className={inputCls} />;
}

const splitComma = (text) => text.split(',').map((part) => part.trim()).filter(Boolean);
const splitLines = (text) => text.split('\n').map((part) => part.trim()).filter(Boolean);
const WIDE = ['textarea', 'lines', 'body', 'readonly', 'media', 'labels'];

// A server message names a field by its path ("image.url"). The form
// shows it under the field the path starts with.
function messageFor(errors, key) {
  if (!errors) return '';
  const match = Object.keys(errors).find((path) => path === key || path.startsWith(`${key}.`));
  return match ? errors[match] : '';
}

// The message for a failed save. Field messages are shown under their
// fields by the form; one that belongs to no visible field is added
// here so it is never lost.
export function SaveError({ error, fields = [] }) {
  if (!error) return null;
  const placed = (path) => fields.some((field) => path === field.key || path.startsWith(`${field.key}.`));
  const extra = Object.entries(error.fields || {}).filter(([path]) => !placed(path));
  return (
    <div role="alert">
      <Notice tone="red">
        {error.message}
        {extra.map(([path, message]) => <span key={path} className="block">{path}: {message}</span>)}
      </Notice>
    </div>
  );
}

// The fields of a resource as one role sees them: a field that needs a
// permission the role does not hold is shown but cannot be changed.
export function fieldsFor(fields, can) {
  return fields.map((field) => (field.permission && !can(field.permission) ? { ...field, locked: true } : field));
}

// The required fields that are still empty, by label.
export function missingRequired(fields, value) {
  return fields.filter((field) => field.required && !String(value[field.key] ?? '').trim()).map((field) => field.label.toLowerCase());
}

export default function ResourceForm({ fields, value, onChange, state, idPrefix = 'field', errors, readOnly = false, saved = null }) {
  const set = (key, next) => onChange({ ...value, [key]: next });

  return (
    <div className="grid gap-x-5 gap-y-5 sm:grid-cols-2">
      {fields.filter((field) => !field.show || field.show(value)).map((field) => {
        const id = `${idPrefix}-${field.key}`;
        const current = value[field.key];
        const disabled = readOnly || field.locked === true;
        let control;

        if (field.type === 'toggle') {
          control = (
            <label htmlFor={id} className={cx('flex items-center gap-3 border border-line-strong px-3 py-2', disabled ? 'opacity-60' : 'cursor-pointer')}>
              <input id={id} type="checkbox" checked={!!current} disabled={disabled} onChange={(e) => set(field.key, e.target.checked)} className="h-4 w-4 accent-[#a78bfa]" />
              <span className="text-sm">{field.label}</span>
            </label>
          );
        } else if (field.type === 'select') {
          const listed = (typeof field.options === 'function' ? field.options(state) : field.options)
            .map((option) => (typeof option === 'string' ? { value: option, label: enumLabel(option) } : option));
          // A stored value that is no longer in the list is still shown,
          // so opening a record never silently changes it.
          const known = current === undefined || current === null || current === '' || listed.some((option) => option.value === current);
          const options = known ? listed : [{ value: current, label: enumLabel(current) }, ...listed];
          control = (
            <select id={id} value={current ?? ''} disabled={disabled} onChange={(e) => set(field.key, e.target.value)} className={inputCls}>
              {field.allowEmpty && <option value="">{field.emptyLabel || 'None'}</option>}
              {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          );
        } else if (field.type === 'labels') {
          control = <LabelPicker id={id} labelledBy={`${id}-label`} value={current} disabled={disabled} onChange={(next) => set(field.key, next)} />;
        } else if (field.type === 'media') {
          control = <MediaUploader id={id} value={current} saved={saved ? saved[field.key] : null} disabled={disabled} onChange={(next) => set(field.key, next)} />;
        } else if (field.type === 'textarea') {
          control = <textarea id={id} rows={field.rows || 4} value={current ?? ''} disabled={disabled} onChange={(e) => set(field.key, e.target.value)} className={cx(inputCls, 'resize-y leading-relaxed')} />;
        } else if (field.type === 'tags') {
          control = <ParsedField id={id} initial={(current || []).join(', ')} parse={splitComma} disabled={disabled} onChange={(next) => set(field.key, next)} placeholder="Separate with commas" />;
        } else if (field.type === 'lines') {
          control = <ParsedField id={id} rows={field.rows || 5} initial={(current || []).join('\n')} parse={splitLines} disabled={disabled} onChange={(next) => set(field.key, next)} placeholder="One per line" />;
        } else if (field.type === 'body') {
          control = <ParsedField id={id} rows={16} initial={blocksToText(current)} parse={textToBlocks} disabled={disabled} onChange={(next) => set(field.key, next)} />;
        } else if (field.type === 'readonly') {
          control = <p id={id} className="whitespace-pre-line break-words border border-line bg-bg-raised/50 px-3 py-2 text-sm">{current || 'Not provided'}</p>;
        } else if (field.type === 'number') {
          control = <input id={id} type="number" step={field.step || 'any'} value={current ?? ''} disabled={disabled} onChange={(e) => set(field.key, e.target.value === '' ? '' : Number(e.target.value))} className={inputCls} />;
        } else {
          control = <input id={id} type={field.type === 'date' ? 'date' : 'text'} value={current ?? ''} disabled={disabled} onChange={(e) => set(field.key, e.target.value)} className={inputCls} />;
        }

        const wide = field.wide || WIDE.includes(field.type);
        const message = messageFor(errors, field.key);
        return (
          <div key={field.key} className={wide ? 'sm:col-span-2' : ''}>
            {field.type === 'labels' && <span id={`${id}-label`} className={labelCls}>{field.label}</span>}
            {field.type !== 'toggle' && field.type !== 'labels' && (
              <label htmlFor={id} className={labelCls}>
                {field.label}{field.required && <span className="text-accent"> *</span>}
              </label>
            )}
            {control}
            {message && <p className="mt-1.5 text-xs text-red-400" role="alert">{message}</p>}
            {field.hint && <p className="mt-1.5 text-xs text-text-dim leading-relaxed">{field.hint}</p>}
          </div>
        );
      })}
    </div>
  );
}
