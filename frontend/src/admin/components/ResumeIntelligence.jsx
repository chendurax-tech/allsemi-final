import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { resumeApi } from '../../lib/api/index.js';
import { useAuth } from '../auth.jsx';
import { useConfirm, useNotify } from './Feedback.jsx';
import { Panel, Badge, Button, Chip, EmptyState, Notice, cx, inputCls, labelCls } from './ui.jsx';
import { label } from '../data/enums.js';
import { formatDate, formatDateTime } from '../lib/format.js';

/*
  ResumeIntelligence - reading a candidate's resume into a draft, and
  approving chosen fields of it into the profile.

  The server reads the resume with local libraries and fixed rules (no
  AI) and stores a DRAFT. Nothing in a draft is trusted: it is shown
  beside the current profile, labelled as a draft, and only the fields
  a recruiter ticks are sent for approval, with the recruiter's edits.
  Nothing is ticked to begin with and nothing is ever approved
  automatically. After an approval the server runs the rule-based ATS
  again, and this panel says how that went.

  The resume text itself is never shown or requested: only the values
  read from it and, for checking them, the line each came from.
*/

const FIELDS = [
  { key: 'name', label: 'Name', kind: 'text', max: 120 },
  { key: 'phone', label: 'Phone', kind: 'text', max: 40 },
  { key: 'location', label: 'Location', kind: 'text', max: 120 },
  { key: 'headline', label: 'Current role', kind: 'text', max: 160 },
  { key: 'experienceYears', label: 'Experience in years', kind: 'number' },
  { key: 'skills', label: 'Skills', kind: 'skills', list: true },
  { key: 'experience', label: 'Work history', kind: 'experience', list: true },
  { key: 'education', label: 'Education', kind: 'education', list: true },
  { key: 'certifications', label: 'Certifications', kind: 'lines', list: true },
  { key: 'projects', label: 'Projects', kind: 'projects', list: true },
];

// The readable name of a field, for the record lines and warnings.
const FIELD_LABELS = { ...Object.fromEntries(FIELDS.map((field) => [field.key, field.label])), email: 'Email' };
const fieldName = (key) => FIELD_LABELS[key] || label(key);

const CONFIDENCE_TONE = { high: 'teal', medium: 'blue', low: 'amber' };
const STATUS_TONE = { PENDING: 'blue', EXTRACTED: 'amber', FAILED: 'red', NO_TEXT: 'amber', APPROVED: 'teal', DISCARDED: 'dim' };
const ATS_TONE = { UPDATED: 'teal', NONE: 'blue', PARTIAL: 'amber', FAILED: 'red' };

const lines = (items) => (items || []).join('\n');
const commas = (items) => (items || []).join(', ');
const splitLines = (text) => String(text || '').split('\n').map((item) => item.trim()).filter(Boolean);
const splitCommas = (text) => String(text || '').split(',').map((item) => item.trim()).filter(Boolean);

// The draft's values as the editors hold them (text for the inputs).
function formFrom(draft) {
  const d = draft || {};
  return {
    name: d.name || '',
    phone: d.phone || '',
    location: d.location || '',
    headline: d.headline || '',
    experienceYears: d.experienceYears === null || d.experienceYears === undefined ? '' : String(d.experienceYears),
    skills: commas(d.skills),
    certifications: lines(d.certifications),
    experience: (d.experience || []).map((e) => ({ title: e.title || '', employer: e.employer || '', period: e.period || '', highlights: lines(e.highlights) })),
    education: (d.education || []).map((e) => ({ degree: e.degree || '', institution: e.institution || '', year: e.year || '' })),
    projects: (d.projects || []).map((p) => ({
      name: p.name || '', period: p.period || '', role: p.role || '', description: p.description || '', technologies: commas(p.technologies), highlights: lines(p.highlights),
    })),
  };
}

// An editor's value in the shape the approval route takes.
function payloadOf(key, value) {
  switch (key) {
    case 'experienceYears': {
      const text = String(value).trim();
      return text === '' ? null : Number(text);
    }
    case 'skills': return splitCommas(value);
    case 'certifications': return splitLines(value);
    case 'experience': return value.map((e) => ({ title: e.title.trim(), employer: e.employer.trim(), period: e.period.trim(), highlights: splitLines(e.highlights) }));
    case 'education': return value.map((e) => ({ degree: e.degree.trim(), institution: e.institution.trim(), year: e.year.trim() }));
    case 'projects': return value.map((p) => ({
      name: p.name.trim(), period: p.period.trim(), role: p.role.trim(), description: p.description.trim(), technologies: splitCommas(p.technologies), highlights: splitLines(p.highlights),
    }));
    default: return String(value).trim();
  }
}

const isEmptyValue = (value) => value === '' || value === null || (Array.isArray(value) && value.length === 0);

// ------------------------------------------------------------ display

function CurrentValue({ field, candidate }) {
  const value = candidate[field.key];
  const none = <span className="text-sm text-text-dim">Not stated</span>;
  switch (field.kind) {
    case 'skills':
      return value?.length ? <div className="flex flex-wrap gap-1.5">{value.map((s) => <Chip key={s} tone="blue">{s}</Chip>)}</div> : none;
    case 'lines':
      return value?.length ? <ul className="space-y-1 text-sm">{value.map((item) => <li key={item}>{item}</li>)}</ul> : none;
    case 'experience':
      return value?.length ? <ul className="space-y-1 text-sm">{value.map((e, i) => <li key={i}>{[e.title, e.employer, e.period].filter(Boolean).join(', ')}</li>)}</ul> : none;
    case 'education':
      return value?.length ? <ul className="space-y-1 text-sm">{value.map((e, i) => <li key={i}>{[e.degree, e.institution, e.year].filter(Boolean).join(', ')}</li>)}</ul> : none;
    case 'projects':
      return value?.length ? <ul className="space-y-1 text-sm">{value.map((p, i) => <li key={i}>{p.name}</li>)}</ul> : none;
    case 'number':
      return value === null || value === undefined ? none : <span className="text-sm">{value} years</span>;
    default:
      return value ? <span className="text-sm break-words">{value}</span> : none;
  }
}

// ------------------------------------------------------------ editors

function EntryList({ id, entries, onChange, blank, render, noun }) {
  const update = (index, patch) => onChange(entries.map((entry, i) => (i === index ? { ...entry, ...patch } : entry)));
  return (
    <div className="space-y-3">
      {entries.length === 0 && <p className="text-sm text-text-dim">Nothing was read. Add one if the resume has it.</p>}
      {entries.map((entry, index) => (
        <fieldset key={index} className="border border-line p-3">
          <legend className="px-1 font-mono text-[0.6rem] uppercase tracking-[0.14em] text-text-dim">{noun} {index + 1}</legend>
          {render(entry, (patch) => update(index, patch), `${id}-${index}`)}
          <div className="mt-2 text-right">
            <Button variant="ghost" size="sm" onClick={() => onChange(entries.filter((_, i) => i !== index))}>Remove {noun.toLowerCase()}</Button>
          </div>
        </fieldset>
      ))}
      <Button size="sm" onClick={() => onChange([...entries, blank])}>Add {noun.toLowerCase()}</Button>
    </div>
  );
}

function Input({ id, label: text, value, onChange, ...props }) {
  return (
    <div className="min-w-0">
      <label htmlFor={id} className={labelCls}>{text}</label>
      <input id={id} value={value} onChange={(e) => onChange(e.target.value)} className={inputCls} {...props} />
    </div>
  );
}

function TextArea({ id, label: text, value, onChange, rows = 3, hint }) {
  return (
    <div className="min-w-0">
      <label htmlFor={id} className={labelCls}>{text}</label>
      <textarea id={id} rows={rows} value={value} onChange={(e) => onChange(e.target.value)} className={cx(inputCls, 'resize-y leading-relaxed')} />
      {hint && <p className="mt-1 text-[0.7rem] text-text-dim">{hint}</p>}
    </div>
  );
}

function Editor({ field, value, onChange, disabled }) {
  const id = `ri-${field.key}`;
  if (disabled) return null;
  switch (field.kind) {
    case 'number':
      return <Input id={id} label="Draft value" type="number" min="0" max="60" step="0.1" value={value} onChange={onChange} />;
    case 'skills':
      return (
        <>
          <TextArea id={id} label="Draft value" value={value} onChange={onChange} hint="Separate skills with commas. Names are matched to the skill list when approved." />
          {splitCommas(value).length > 0 && <div className="mt-2 flex flex-wrap gap-1.5">{splitCommas(value).map((s) => <Chip key={s}>{s}</Chip>)}</div>}
        </>
      );
    case 'lines':
      return <TextArea id={id} label="Draft value" value={value} onChange={onChange} hint="One per line." />;
    case 'experience':
      return (
        <EntryList
          id={id} entries={value} onChange={onChange} noun="Job" blank={{ title: '', employer: '', period: '', highlights: '' }}
          render={(entry, set, key) => (
            <div className="grid gap-3 sm:grid-cols-3">
              <Input id={`${key}-title`} label="Role" value={entry.title} onChange={(v) => set({ title: v })} maxLength={160} />
              <Input id={`${key}-employer`} label="Employer" value={entry.employer} onChange={(v) => set({ employer: v })} maxLength={160} />
              <Input id={`${key}-period`} label="Period" value={entry.period} onChange={(v) => set({ period: v })} maxLength={80} />
              <div className="sm:col-span-3"><TextArea id={`${key}-highlights`} label="Highlights" value={entry.highlights} onChange={(v) => set({ highlights: v })} hint="One per line, at most eight." /></div>
            </div>
          )}
        />
      );
    case 'education':
      return (
        <EntryList
          id={id} entries={value} onChange={onChange} noun="Entry" blank={{ degree: '', institution: '', year: '' }}
          render={(entry, set, key) => (
            <div className="grid gap-3 sm:grid-cols-3">
              <Input id={`${key}-degree`} label="Degree" value={entry.degree} onChange={(v) => set({ degree: v })} maxLength={160} />
              <Input id={`${key}-institution`} label="Institution" value={entry.institution} onChange={(v) => set({ institution: v })} maxLength={160} />
              <Input id={`${key}-year`} label="Year" value={entry.year} onChange={(v) => set({ year: v })} maxLength={20} />
            </div>
          )}
        />
      );
    case 'projects':
      return (
        <EntryList
          id={id} entries={value} onChange={onChange} noun="Project" blank={{ name: '', period: '', role: '', description: '', technologies: '', highlights: '' }}
          render={(entry, set, key) => (
            <div className="grid gap-3 sm:grid-cols-3">
              <Input id={`${key}-name`} label="Name" value={entry.name} onChange={(v) => set({ name: v })} maxLength={160} />
              <Input id={`${key}-period`} label="Period" value={entry.period} onChange={(v) => set({ period: v })} maxLength={80} />
              <Input id={`${key}-role`} label="Role" value={entry.role} onChange={(v) => set({ role: v })} maxLength={160} />
              <div className="sm:col-span-3"><TextArea id={`${key}-description`} label="Description" value={entry.description} onChange={(v) => set({ description: v })} rows={2} /></div>
              <div className="sm:col-span-3"><Input id={`${key}-technologies`} label="Technologies (comma separated)" value={entry.technologies} onChange={(v) => set({ technologies: v })} /></div>
              <div className="sm:col-span-3"><TextArea id={`${key}-highlights`} label="Highlights" value={entry.highlights} onChange={(v) => set({ highlights: v })} rows={2} hint="One per line." /></div>
            </div>
          )}
        />
      );
    default:
      return <Input id={id} label="Draft value" value={value} onChange={onChange} maxLength={field.max} />;
  }
}

// ------------------------------------------------------------ the review

function FieldRow({ field, draft, candidate, form, setForm, chosen, toggle, mode, setMode, canWrite }) {
  const confidence = draft.confidence?.[field.key] || null;
  const evidence = draft.evidence?.[field.key] || [];
  const edited = JSON.stringify(payloadOf(field.key, form[field.key])) !== JSON.stringify(payloadOf(field.key, formFrom(draft.draft)[field.key]));
  const empty = isEmptyValue(payloadOf(field.key, form[field.key]));
  const checkboxId = `ri-choose-${field.key}`;
  return (
    <li className={cx('border p-4', chosen ? 'border-accent/60 bg-accent/[0.04]' : 'border-line')}>
      <div className="flex flex-wrap items-center gap-3">
        {canWrite && (
          <input
            id={checkboxId} type="checkbox" checked={chosen} onChange={toggle}
            className="h-4 w-4 accent-[#b9a7ff]" aria-describedby={`${checkboxId}-state`}
          />
        )}
        <label htmlFor={checkboxId} className="text-sm font-semibold">{field.label}</label>
        <Badge tone={CONFIDENCE_TONE[confidence] || 'dim'}>{confidence ? `${confidence} confidence` : 'Not read'}</Badge>
        {edited && <Badge tone="lilac">Edited</Badge>}
        <span id={`${checkboxId}-state`} className="sr-only">{chosen ? 'Will be applied' : 'Will not be applied'}</span>
        {canWrite && field.list && chosen && (
          <label className="ml-auto flex items-center gap-2 text-xs text-text-dim">
            <span className="font-mono uppercase tracking-[0.12em]">Apply as</span>
            <select value={mode} onChange={(e) => setMode(e.target.value)} className="bg-bg border border-line-strong px-2 py-1 text-xs text-text focus:outline-none focus:border-accent">
              <option value="replace">Replace current</option>
              <option value="append">Add to current</option>
            </select>
          </label>
        )}
      </div>
      <div className="mt-3 grid gap-4 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <div className="min-w-0">
          <p className={labelCls}>Current profile</p>
          <CurrentValue field={field} candidate={candidate} />
        </div>
        <div className="min-w-0">
          {canWrite ? (
            <Editor field={field} value={form[field.key]} onChange={(value) => setForm((current) => ({ ...current, [field.key]: value }))} />
          ) : (
            <>
              <p className={labelCls}>Draft value</p>
              <CurrentValue field={field} candidate={draft.draft} />
            </>
          )}
          {chosen && empty && !field.list && <p className="mt-2 text-xs text-warn">Nothing to apply: the draft value is empty. Type a value or untick this field.</p>}
        </div>
      </div>
      {evidence.length > 0 && (
        <p className="mt-3 border-t border-line pt-2 text-xs text-text-dim break-words">
          <span className="font-mono uppercase tracking-[0.12em]">Read from: </span>{evidence[0]}
        </p>
      )}
    </li>
  );
}

function AtsOutcome({ outcome, jobOf }) {
  if (!outcome) return null;
  const tone = ATS_TONE[outcome.status] || 'dim';
  const text = outcome.message || {
    UPDATED: 'The ATS evaluation was run again with the approved profile.',
    NONE: 'The candidate has no job to be evaluated against, so the ATS was not run.',
    PARTIAL: 'The ATS evaluation could not be run again for every job. Run it again from the ATS screen.',
    FAILED: 'The ATS evaluation could not be run again. Run it again from the ATS screen.',
  }[outcome.status];
  return (
    <div className="space-y-2" role={tone === 'red' ? 'alert' : 'status'}>
      <Notice tone={tone}>ATS re-evaluation: {label(outcome.status)}. {text}</Notice>
      {(outcome.results || []).length > 0 && (
        <ul className="space-y-1 text-xs text-text-dim">
          {outcome.results.map((r) => (
            <li key={r.resultId}>
              {jobOf(r.jobId)}: {r.previousTotalScore === null ? 'new result' : `${r.previousTotalScore} to`} <span className="font-semibold text-text">{r.totalScore}</span> of 100{r.changed ? '' : ' (unchanged)'}
              {r.reviewStale && <span className="text-warn">. The earlier recruiter review is now outdated.</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function DraftReview({ draft, candidate, canWrite, onDone }) {
  const notify = useNotify();
  const ask = useConfirm();
  const initial = useMemo(() => formFrom(draft.draft), [draft]);
  const [form, setForm] = useState(initial);
  const [chosen, setChosen] = useState({});
  const [modes, setModes] = useState({});
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState('');
  const [problem, setProblem] = useState(null);

  const selected = FIELDS.filter((field) => chosen[field.key]).map((field) => field.key);
  const withValue = FIELDS.filter((field) => !isEmptyValue(payloadOf(field.key, form[field.key]))).map((field) => field.key);
  const counts = Object.values(draft.confidence || {}).reduce((sum, level) => ({ ...sum, [level || 'none']: (sum[level || 'none'] || 0) + 1 }), {});

  async function approve() {
    setBusy('approve');
    setProblem(null);
    const values = {};
    for (const key of selected) {
      const value = payloadOf(key, form[key]);
      if (JSON.stringify(value) !== JSON.stringify(payloadOf(key, initial[key]))) values[key] = value;
    }
    const append = selected.filter((key) => FIELDS.find((f) => f.key === key).list && modes[key] === 'append');
    try {
      const result = await resumeApi.approve(draft.id, { fields: selected, values, append, note });
      notify({ tone: result.ats?.status === 'FAILED' || result.ats?.status === 'PARTIAL' ? 'error' : 'success', message: `Applied ${selected.length} ${selected.length === 1 ? 'field' : 'fields'} to the profile. ${result.ats?.message || ''}` });
      await onDone({ ats: result.ats });
    } catch (failure) {
      setProblem({ message: failure.message, details: failure.details || [] });
    }
    setBusy('');
  }

  async function discard() {
    const agreed = await ask({
      title: 'Discard this draft?',
      message: 'Nothing from it will be applied, and the text read from the resume is deleted. The candidate profile is not changed. You can read the resume again later.',
      confirmLabel: 'Discard draft',
      tone: 'danger',
    });
    if (!agreed) return;
    setBusy('discard');
    setProblem(null);
    try {
      await resumeApi.discard(draft.id);
      notify({ tone: 'info', message: 'Discarded the draft. The profile was not changed.' });
      await onDone({});
    } catch (failure) {
      setProblem({ message: failure.message, details: failure.details || [] });
    }
    setBusy('');
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-xs text-text-dim">
        <span className="font-mono uppercase tracking-[0.12em]">Confidence</span>
        {['high', 'medium', 'low'].map((level) => (counts[level] ? <Badge key={level} tone={CONFIDENCE_TONE[level]}>{counts[level]} {level}</Badge> : null))}
        {counts.none ? <Badge tone="dim">{counts.none} not read</Badge> : null}
        {draft.draft?.email && <span className="ml-auto">Email on the resume: {draft.draft.email} (never applied: the email identifies the candidate)</span>}
      </div>

      {canWrite && (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => setChosen(Object.fromEntries(withValue.map((key) => [key, true])))}>Select every field with a value</Button>
          <Button size="sm" variant="ghost" onClick={() => setChosen({})}>Clear selection</Button>
          <Button size="sm" variant="ghost" onClick={() => { setForm(initial); setProblem(null); }}>Undo my edits</Button>
        </div>
      )}

      <ul className="space-y-3">
        {FIELDS.map((field) => (
          <FieldRow
            key={field.key}
            field={field}
            draft={draft}
            candidate={candidate}
            form={form}
            setForm={setForm}
            chosen={Boolean(chosen[field.key])}
            toggle={() => setChosen((current) => ({ ...current, [field.key]: !current[field.key] }))}
            mode={modes[field.key] || 'replace'}
            setMode={(mode) => setModes((current) => ({ ...current, [field.key]: mode }))}
            canWrite={canWrite}
          />
        ))}
      </ul>

      {canWrite ? (
        <div className="border-t border-line pt-4 space-y-3">
          <TextArea id="ri-note" label="Note for the record (optional)" value={note} onChange={setNote} rows={2} />
          {problem && (
            <div role="alert" className="space-y-1">
              <Notice tone="red">{problem.message}</Notice>
              {problem.details.length > 0 && (
                <ul className="list-disc pl-5 text-xs text-red-400">
                  {problem.details.map((detail, i) => <li key={i}>{detail.field ? `${detail.field.replace(/^values\./, '')}: ` : ''}{detail.message}</li>)}
                </ul>
              )}
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="primary" onClick={approve} disabled={Boolean(busy) || selected.length === 0}>
              {busy === 'approve' ? 'Applying' : `Approve ${selected.length} selected ${selected.length === 1 ? 'field' : 'fields'}`}
            </Button>
            <Button variant="danger" onClick={discard} disabled={Boolean(busy)}>{busy === 'discard' ? 'Discarding' : 'Discard draft'}</Button>
            <span className="text-xs text-text-dim">Only the ticked fields are written to the profile. The ATS is then run again.</span>
          </div>
        </div>
      ) : <Notice tone="blue">Your role can read this draft but cannot approve or discard it.</Notice>}
    </div>
  );
}

// ------------------------------------------------------------ the panel

export default function ResumeIntelligence({ candidate, applications, jobOf, onApproved }) {
  const { can } = useAuth();
  const notify = useNotify();
  const canRead = can('candidates:read') && can('resumes:read');
  const canWrite = can('candidates:write') && can('resumes:read');
  const [drafts, setDrafts] = useState([]);
  const [load, setLoad] = useState({ status: 'loading', message: '' });
  const [extracting, setExtracting] = useState(false);
  const [lastAts, setLastAts] = useState(null);
  const withResume = applications.filter((a) => a.resume);
  const [applicationId, setApplicationId] = useState(withResume[0]?.id || '');

  const read = useCallback(async () => {
    try {
      setDrafts(await resumeApi.list(candidate.id));
      setLoad({ status: 'ready', message: '' });
    } catch (failure) {
      setLoad({ status: 'error', message: failure.message });
    }
  }, [candidate.id]);

  useEffect(() => { if (canRead) read(); }, [canRead, read]);

  if (!canRead) return null;

  async function extract() {
    if (!applicationId || extracting) return;
    setExtracting(true);
    setLastAts(null);
    try {
      const draft = await resumeApi.extract(applicationId);
      if (draft.status === 'EXTRACTED') notify({ tone: 'success', message: 'Resume read. Review the draft: nothing is applied until you approve it.' });
      else notify({ tone: draft.status === 'FAILED' ? 'error' : 'info', message: draft.warnings?.[0]?.message || `Resume extraction ended as ${label(draft.status)}.` });
      await read();
    } catch (failure) {
      notify({ tone: 'error', message: failure.message });
    }
    setExtracting(false);
  }

  async function done({ ats }) {
    if (ats) setLastAts(ats);
    await Promise.all([read(), onApproved()]);
  }

  const latest = drafts[0] || null;
  const earlier = drafts.slice(1);
  const applicationLabel = (a) => `${jobOf(a.jobId)}, ${formatDate(a.submittedAt)} (${a.resume.fileName})`;

  const extractControl = canWrite && withResume.length > 0 && (
    <div className="flex flex-wrap items-end gap-2">
      {withResume.length > 1 && (
        <div className="min-w-[14rem] flex-1">
          <label htmlFor="ri-application" className={labelCls}>Resume of the application</label>
          <select id="ri-application" value={applicationId} onChange={(e) => setApplicationId(e.target.value)} disabled={extracting} className={inputCls}>
            {withResume.map((a) => <option key={a.id} value={a.id}>{applicationLabel(a)}</option>)}
          </select>
        </div>
      )}
      <Button variant={latest ? 'secondary' : 'primary'} onClick={extract} disabled={extracting || !applicationId} aria-busy={extracting}>
        {extracting ? 'Reading the resume' : latest ? 'Extract resume again' : 'Extract resume'}
      </Button>
    </div>
  );

  let body;
  if (load.status === 'loading') {
    body = <div role="status"><EmptyState title="Loading resume drafts" /></div>;
  } else if (load.status === 'error') {
    body = (
      <div role="alert">
        <Notice tone="red">{load.message}</Notice>
        <div className="mt-3"><Button size="sm" onClick={() => { setLoad({ status: 'loading', message: '' }); read(); }}>Try again</Button></div>
      </div>
    );
  } else if (!latest) {
    body = (
      <div className="space-y-4">
        <p className="text-sm text-text-dim">This resume has not been analysed yet. Reading it suggests profile values from the resume, as a draft for you to check. Nothing changes until you approve chosen fields.</p>
        {withResume.length === 0 && <Notice tone="blue">None of this candidate's applications carries a resume to read.</Notice>}
        {extractControl}
      </div>
    );
  } else {
    const isDraft = latest.status === 'EXTRACTED';
    body = (
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={STATUS_TONE[latest.status]}>{label(latest.status)}</Badge>
          {isDraft && <Badge tone="red">Draft — not trusted</Badge>}
          <span className="text-xs text-text-dim">
            {latest.resume?.fileName ? `${latest.resume.fileName}, ` : ''}read by {latest.extractedByName || 'a recruiter'}, {formatDateTime(latest.createdAt)}
            {latest.extraction?.type ? `. ${latest.extraction.type.toUpperCase()}${latest.extraction.pages ? `, ${latest.extraction.pages} ${latest.extraction.pages === 1 ? 'page' : 'pages'}` : ''}` : ''}
          </span>
        </div>

        {latest.extraction?.truncated && <Notice tone="amber">The resume is long: only the first part of it was read.</Notice>}
        {(latest.warnings || []).length > 0 && (
          <div>
            <p className={labelCls}>{latest.warnings.length} {latest.warnings.length === 1 ? 'thing' : 'things'} to check</p>
            <ul className="space-y-1 text-xs text-text-dim">
              {latest.warnings.map((warning, i) => <li key={i}><span className="text-warn">{warning.field ? `${fieldName(warning.field)}: ` : ''}</span>{warning.message}</li>)}
            </ul>
          </div>
        )}

        {latest.status === 'APPROVED' && (
          <div className="space-y-2">
            <Notice tone="teal">
              Approved by {latest.reviewedByName}, {formatDateTime(latest.reviewedAt)}. Applied: {latest.appliedFields.map(fieldName).join(', ')}{latest.editedFields?.length ? ` (edited: ${latest.editedFields.map(fieldName).join(', ')})` : ''}.
            </Notice>
            <AtsOutcome outcome={lastAts || latest.atsReevaluation} jobOf={jobOf} />
          </div>
        )}
        {latest.status === 'DISCARDED' && <Notice tone="blue">Discarded by {latest.reviewedByName}, {formatDateTime(latest.reviewedAt)}. Nothing was applied.</Notice>}
        {latest.status === 'PENDING' && <Notice tone="blue">This resume is still being read. Refresh in a moment.</Notice>}

        {isDraft && <DraftReview key={latest.id} draft={latest} candidate={candidate} canWrite={canWrite} onDone={done} />}
        {['FAILED', 'NO_TEXT'].includes(latest.status) && canWrite && (
          <DiscardOnly draft={latest} onDone={done} />
        )}

        {!isDraft && extractControl}

        {earlier.length > 0 && (
          <details className="border-t border-line pt-3">
            <summary className="cursor-pointer text-xs text-text-dim">Earlier drafts ({earlier.length})</summary>
            <ul className="mt-2 space-y-1 text-xs text-text-dim">
              {earlier.map((d) => <li key={d.id}><Badge tone={STATUS_TONE[d.status]}>{label(d.status)}</Badge> {formatDateTime(d.createdAt)}, {d.extractedByName}</li>)}
            </ul>
          </details>
        )}
      </div>
    );
  }

  return (
    <Panel title="Resume Intelligence" meta="Read by fixed rules on the server, no AI. A draft until a recruiter approves it.">
      {body}
    </Panel>
  );
}

// A draft with nothing to apply can still be cleared away.
function DiscardOnly({ draft, onDone }) {
  const ask = useConfirm();
  const notify = useNotify();
  const [busy, setBusy] = useState(false);
  async function discard() {
    const agreed = await ask({ title: 'Discard this draft?', message: 'The record of this attempt is kept as discarded. The candidate profile is not changed.', confirmLabel: 'Discard draft', tone: 'danger' });
    if (!agreed) return;
    setBusy(true);
    try {
      await resumeApi.discard(draft.id);
      await onDone({});
    } catch (failure) {
      notify({ tone: 'error', message: failure.message });
    }
    setBusy(false);
  }
  return <Button variant="danger" size="sm" onClick={discard} disabled={busy}>{busy ? 'Discarding' : 'Discard draft'}</Button>;
}
