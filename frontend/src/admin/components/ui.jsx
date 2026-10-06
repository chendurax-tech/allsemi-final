import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';

/*
  Admin UI kit. Same tokens as the public site (near-black base, lilac
  accent, turquoise) plus electric blue, used here with fixed meanings
  so colour carries information rather than decoration:
    lilac  primary action, selection, brand
    blue   system-produced data, in-progress states
    teal   confirmed, passed, published
    amber  needs a person's attention
    red    rejected, failed, destructive
*/

export function cx(...parts) {
  return parts.filter(Boolean).join(' ');
}

// One look for every labelled input, select and text area.
export const inputCls = 'w-full bg-bg border border-line-strong px-3 py-2 text-sm text-text placeholder:text-text-faint focus:outline-none focus:border-accent transition-colors disabled:opacity-60 disabled:cursor-not-allowed';
export const labelCls = 'block font-mono text-[0.65rem] uppercase tracking-[0.14em] text-text-dim mb-1.5';

const TONES = {
  teal: 'text-turquoise border-turquoise/40 bg-turquoise/10',
  blue: 'text-[#8ab8ff] border-[#5b9dff]/45 bg-[#5b9dff]/10',
  lilac: 'text-accent border-accent/45 bg-accent/10',
  amber: 'text-[#e8b65a] border-[#e8b65a]/45 bg-[#e8b65a]/10',
  red: 'text-red-400 border-red-400/45 bg-red-400/10',
  dim: 'text-text-dim border-line-strong bg-transparent',
};

// Badges take their colour from the text they show. The keys are the
// readable labels in lower case (see label() in data/enums.js).
const TONE_BY_VALUE = {
  published: 'teal', active: 'teal', shortlisted: 'teal', selected: 'teal', converted: 'teal', pass: 'teal',
  'strong match': 'teal', office: 'teal', shown: 'teal', advance: 'teal', enabled: 'teal', configured: 'teal',
  new: 'blue', interviewed: 'blue', 'in progress': 'blue', reviewing: 'blue', contacted: 'blue',
  listed: 'blue', network: 'blue', 'good match': 'blue', medium: 'blue', career: 'blue',
  draft: 'amber', pending: 'amber', hold: 'amber', review: 'amber', 'partial match': 'amber', planned: 'amber',
  'not evaluated': 'amber', 'temporary password': 'amber', 'not configured': 'amber',
  rejected: 'red', reject: 'red', fail: 'red', 'low match': 'red', disabled: 'red',
  archived: 'dim', closed: 'dim', inactive: 'dim', hidden: 'dim', low: 'dim', general: 'dim', other: 'dim',
  info: 'dim', 'not connected': 'dim', 'not enabled': 'dim',
  high: 'lilac', featured: 'lilac', hiring: 'lilac', partnership: 'lilac',
};

export function toneFor(value) {
  return TONE_BY_VALUE[String(value ?? '').toLowerCase()] || 'dim';
}

export function Badge({ children, tone }) {
  return (
    <span className={cx('inline-flex items-center border px-2 py-0.5 font-mono text-[0.62rem] uppercase tracking-[0.1em] whitespace-nowrap', TONES[tone || toneFor(children)])}>
      {children}
    </span>
  );
}

export function Chip({ children, tone = 'dim' }) {
  return (
    <span className={cx('inline-flex items-center border px-2 py-1 text-xs whitespace-nowrap', TONES[tone])}>
      {children}
    </span>
  );
}

const BUTTON_VARIANTS = {
  primary: 'bg-text text-bg hover:bg-accent border border-transparent',
  secondary: 'border border-line-strong text-text hover:border-accent hover:text-accent',
  ghost: 'border border-transparent text-text-dim hover:text-text',
  danger: 'border border-red-400/50 text-red-400 hover:bg-red-400/10',
};

export function Button({ to, variant = 'secondary', size = 'md', className, children, ...props }) {
  const cls = cx(
    'inline-flex items-center justify-center gap-2 font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg disabled:opacity-40 disabled:pointer-events-none',
    size === 'sm' ? 'text-xs px-3 py-1.5' : 'text-sm px-4 py-2',
    BUTTON_VARIANTS[variant],
    className,
  );
  if (to) return <Link to={to} className={cls} {...props}>{children}</Link>;
  return <button type="button" className={cls} {...props}>{children}</button>;
}

export function PageHeader({ eyebrow, title, description, actions }) {
  return (
    <header className="mb-6 md:mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div className="min-w-0">
        {eyebrow && <p className="font-mono text-[0.65rem] uppercase tracking-[0.2em] text-accent mb-2">{eyebrow}</p>}
        <h1 className="font-display font-semibold text-2xl md:text-3xl tracking-tight">{title}</h1>
        {description && <p className="mt-2 max-w-2xl text-sm text-text-dim leading-relaxed">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2 shrink-0">{actions}</div>}
    </header>
  );
}

export function Panel({ title, meta, action, children, className, pad = true }) {
  return (
    <section className={cx('border border-line bg-bg-raised/50 min-w-0', className)}>
      {(title || action) && (
        <header className="flex items-center justify-between gap-3 border-b border-line px-4 md:px-5 py-3">
          <div className="min-w-0">
            <h2 className="font-display font-semibold text-sm tracking-tight">{title}</h2>
            {meta && <p className="text-xs text-text-dim mt-0.5">{meta}</p>}
          </div>
          {action}
        </header>
      )}
      <div className={pad ? 'p-4 md:p-5' : ''}>{children}</div>
    </section>
  );
}

const STAT_BARS = { lilac: 'bg-accent', teal: 'bg-turquoise', blue: 'bg-[#5b9dff]', amber: 'bg-[#e8b65a]' };

export function StatCard({ label, value, hint, tone = 'lilac', to }) {
  const body = (
    <>
      <span className={cx('absolute left-0 top-0 h-full w-0.5', STAT_BARS[tone])} aria-hidden="true" />
      <p className="font-mono text-[0.65rem] uppercase tracking-[0.16em] text-text-dim">{label}</p>
      <p className="mt-2 font-display font-semibold text-3xl md:text-4xl tabular-nums leading-none">{value}</p>
      {hint && <p className="mt-2 text-xs text-text-dim">{hint}</p>}
    </>
  );
  const cls = 'relative block border border-line bg-bg-raised/50 px-4 py-4 md:px-5 transition-colors';
  return to
    ? <Link to={to} className={cx(cls, 'hover:border-accent/60 focus:outline-none focus-visible:border-accent')}>{body}</Link>
    : <div className={cls}>{body}</div>;
}

export function EmptyState({ title, children }) {
  return (
    <div className="px-5 py-10 text-center">
      <p className="font-display font-semibold text-base">{title}</p>
      {children && <p className="mt-1.5 text-sm text-text-dim max-w-md mx-auto">{children}</p>}
    </div>
  );
}

export function DataTable({ columns, rows, onRowClick, empty }) {
  if (!rows.length) return empty || <EmptyState title="Nothing to show">No records match the current filters.</EmptyState>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[680px] text-sm border-collapse">
        <thead>
          <tr className="border-b border-line text-left">
            {columns.map((col) => (
              <th key={col.key} scope="col" className="px-4 md:px-5 py-2.5 font-mono text-[0.62rem] uppercase tracking-[0.14em] text-text-dim font-medium whitespace-nowrap">
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.id}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              onKeyDown={onRowClick ? (e) => { if (e.key === 'Enter') onRowClick(row); } : undefined}
              tabIndex={onRowClick ? 0 : undefined}
              className={cx('border-b border-line last:border-0', onRowClick && 'cursor-pointer hover:bg-accent/[0.06] focus:outline-none focus-visible:bg-accent/[0.1]')}
            >
              {columns.map((col) => (
                <td key={col.key} className="px-4 md:px-5 py-3 align-top">{col.render(row)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Drawer({ title, onClose, footer, children }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-bg/80" onClick={onClose} aria-hidden="true" />
      <aside role="dialog" aria-modal="true" aria-label={title} className="relative flex h-full w-full max-w-xl flex-col border-l border-line-strong bg-bg">
        <header className="flex items-center justify-between gap-4 border-b border-line px-5 py-4">
          <h2 className="font-display font-semibold text-lg tracking-tight min-w-0 truncate">{title}</h2>
          <Button variant="ghost" size="sm" onClick={onClose}>Close</Button>
        </header>
        <div className="flex-1 overflow-y-auto px-5 py-5">{children}</div>
        {footer && <footer className="flex flex-wrap items-center gap-2 border-t border-line px-5 py-4">{footer}</footer>}
      </aside>
    </div>
  );
}

// The recurring "signal path" figure: stages joined by a trace. Used
// for the ATS pipeline (a real sequence) and the application pipeline.
// state: 'done' | 'current' | 'pending'. value replaces the step number
// when the stage carries a count.
export function StageTrace({ stages, columns = 'grid-cols-2 sm:grid-cols-4 lg:grid-cols-8' }) {
  return (
    <ol className={cx('grid gap-x-2 gap-y-6', columns)}>
      {stages.map((stage, i) => {
        const done = stage.state === 'done';
        const current = stage.state === 'current';
        return (
          <li key={stage.label} className="relative flex flex-col items-center text-center">
            {i < stages.length - 1 && (
              <span className={cx('absolute left-1/2 top-[18px] hidden h-px w-full lg:block', done ? 'bg-turquoise/50' : 'bg-line-strong')} aria-hidden="true" />
            )}
            <span
              className={cx(
                'relative z-10 flex h-9 w-9 items-center justify-center rounded-full border bg-bg font-mono text-xs tabular-nums',
                done && 'border-turquoise text-turquoise',
                current && 'border-[#e8b65a] text-[#e8b65a]',
                !done && !current && 'border-line-strong text-text-dim',
              )}
            >
              {stage.value ?? String(i + 1).padStart(2, '0')}
            </span>
            <span className="mt-2 text-xs font-semibold leading-tight">{stage.label}</span>
            {stage.sub && <span className="mt-0.5 text-[0.7rem] text-text-dim leading-snug max-w-[9rem]">{stage.sub}</span>}
          </li>
        );
      })}
    </ol>
  );
}

export function ScoreRing({ value, caption }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative h-36 w-36 shrink-0">
      <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90" aria-hidden="true">
        <defs>
          <linearGradient id="adminScoreRing" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#5b9dff" />
            <stop offset="100%" stopColor="#2dd4bf" />
          </linearGradient>
        </defs>
        <circle cx="60" cy="60" r={r} fill="none" stroke="rgba(237,239,240,0.09)" strokeWidth="6" />
        <circle cx="60" cy="60" r={r} fill="none" stroke="url(#adminScoreRing)" strokeWidth="6" strokeDasharray={`${(value / 100) * c} ${c}`} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display font-semibold text-4xl tabular-nums leading-none">{value}</span>
        <span className="mt-1 font-mono text-[0.6rem] uppercase tracking-[0.14em] text-text-dim">{caption}</span>
      </div>
    </div>
  );
}

export function DefinitionList({ items }) {
  return (
    <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
      {items.map(([term, detail]) => (
        <div key={term} className="min-w-0">
          <dt className="font-mono text-[0.62rem] uppercase tracking-[0.14em] text-text-dim">{term}</dt>
          <dd className="mt-1 text-sm break-words">{detail}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Notice({ tone = 'amber', children }) {
  return <p className={cx('border px-3 py-2 text-xs leading-relaxed', TONES[tone])}>{children}</p>;
}
