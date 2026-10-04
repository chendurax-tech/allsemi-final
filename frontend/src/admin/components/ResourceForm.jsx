import React, { useState } from 'react';
import { cx } from './ui.jsx';

/*
  ResourceForm - renders an edit form from a list of field definitions
  (see data/resources.js). One form component serves every content and
  recruitment resource, in a drawer or on a full page.

  Field types: text, textarea, number, date, select, toggle, tags
  (comma separated), lines (one per line), body (article blocks) and
  readonly.
*/

const inputCls = 'w-full bg-bg border border-line-strong px-3 py-2 text-sm text-text placeholder:text-text-faint focus:outline-none focus:border-accent transition-colors';
const labelCls = 'block font-mono text-[0.65rem] uppercase tracking-[0.14em] text-text-dim mb-1.5';

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
function ParsedField({ id, initial, parse, onChange, rows, placeholder }) {
  const [text, setText] = useState(initial);
  const handle = (e) => { setText(e.target.value); onChange(parse(e.target.value)); };
  if (rows) {
    return <textarea id={id} rows={rows} value={text} placeholder={placeholder} onChange={handle} className={cx(inputCls, 'resize-y leading-relaxed')} />;
  }
  return <input id={id} type="text" value={text} placeholder={placeholder} onChange={handle} className={inputCls} />;
}

const splitComma = (text) => text.split(',').map((part) => part.trim()).filter(Boolean);
const splitLines = (text) => text.split('\n').map((part) => part.trim()).filter(Boolean);
const WIDE = ['textarea', 'lines', 'body', 'readonly'];

export default function ResourceForm({ fields, value, onChange, state, idPrefix = 'field' }) {
  const set = (key, next) => onChange({ ...value, [key]: next });

  return (
    <div className="grid gap-x-5 gap-y-5 sm:grid-cols-2">
      {fields.map((field) => {
        const id = `${idPrefix}-${field.key}`;
        const current = value[field.key];
        let control;

        if (field.type === 'toggle') {
          control = (
            <label htmlFor={id} className="flex cursor-pointer items-center gap-3 border border-line-strong px-3 py-2">
              <input id={id} type="checkbox" checked={!!current} onChange={(e) => set(field.key, e.target.checked)} className="h-4 w-4 accent-[#a78bfa]" />
              <span className="text-sm">{field.label}</span>
            </label>
          );
        } else if (field.type === 'select') {
          const options = typeof field.options === 'function' ? field.options(state) : field.options;
          control = (
            <select id={id} value={current ?? ''} onChange={(e) => set(field.key, e.target.value)} className={inputCls}>
              {field.allowEmpty && <option value="">None</option>}
              {options.map((option) => {
                const opt = typeof option === 'string' ? { value: option, label: option } : option;
                return <option key={opt.value} value={opt.value}>{opt.label}</option>;
              })}
            </select>
          );
        } else if (field.type === 'textarea') {
          control = <textarea id={id} rows={field.rows || 4} value={current ?? ''} onChange={(e) => set(field.key, e.target.value)} className={cx(inputCls, 'resize-y leading-relaxed')} />;
        } else if (field.type === 'tags') {
          control = <ParsedField id={id} initial={(current || []).join(', ')} parse={splitComma} onChange={(next) => set(field.key, next)} placeholder="Separate with commas" />;
        } else if (field.type === 'lines') {
          control = <ParsedField id={id} rows={field.rows || 5} initial={(current || []).join('\n')} parse={splitLines} onChange={(next) => set(field.key, next)} placeholder="One per line" />;
        } else if (field.type === 'body') {
          control = <ParsedField id={id} rows={16} initial={blocksToText(current)} parse={textToBlocks} onChange={(next) => set(field.key, next)} />;
        } else if (field.type === 'readonly') {
          control = <p id={id} className="whitespace-pre-line border border-line bg-bg-raised/50 px-3 py-2 text-sm">{current || 'Not provided'}</p>;
        } else if (field.type === 'number') {
          control = <input id={id} type="number" step={field.step || 'any'} value={current ?? ''} onChange={(e) => set(field.key, e.target.value === '' ? '' : Number(e.target.value))} className={inputCls} />;
        } else {
          control = <input id={id} type={field.type === 'date' ? 'date' : 'text'} value={current ?? ''} onChange={(e) => set(field.key, e.target.value)} className={inputCls} />;
        }

        const wide = field.wide || WIDE.includes(field.type);
        return (
          <div key={field.key} className={wide ? 'sm:col-span-2' : ''}>
            {field.type !== 'toggle' && (
              <label htmlFor={id} className={labelCls}>
                {field.label}{field.required && <span className="text-accent"> *</span>}
              </label>
            )}
            {control}
            {field.hint && <p className="mt-1.5 text-xs text-text-dim leading-relaxed">{field.hint}</p>}
          </div>
        );
      })}
    </div>
  );
}
