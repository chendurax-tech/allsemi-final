import React, { useEffect, useRef, useState } from 'react';
import { jobsApi } from '../../lib/api/index.js';
import { useAdminStore } from '../store.jsx';
import { useAuth } from '../auth.jsx';
import { Panel, Badge, Button, Notice, DefinitionList, cx, inputCls, labelCls } from './ui.jsx';
import ResourceForm, { SaveError } from './ResourceForm.jsx';
import { WORK_MODES } from '../data/enums.js';
import { WEIGHT_SOURCE_LABELS } from '../data/atsStages.js';
import { formatDateTime } from '../lib/format.js';
import { aiFailureText, aiFailureCode } from '../lib/aiErrors.js';
import { useConfirm } from './Feedback.jsx';

/*
  RequirementProfile - the optional requirement profile of one job, on
  the job's edit screen.

  A profile is a structured list of what the job asks for. It is for
  staff: the public site never receives it. With a profile, the
  rule-based ATS scores candidates against it, with the default weights
  of a profile or with weights saved for this job. Without one, the
  baseline weights are used, exactly as before. The AI comparison is
  sent the profile as well.

  Four actions, each a request that only its own button sends:
    Save requirement profile   stores what is in the form
    Remove profile             takes the profile off the job
    Draft with AI              asks the ALLSEMIS backend for a draft made
                               from the job as it is saved. The draft
                               FILLS THE FORM AND IS NOT SAVED: a
                               recruiter reads it, corrects it and
                               presses Save, or does not.
    Run the rules again        rule based only, no AI: re-runs the rules
                               for the evaluations this job already has

  Nothing here asks for an AI draft on load, in an effect or again
  after a failure. Saving or removing a profile changes no evaluation
  that exists: those keep their scores until the rules are run again.

  What a draft holds was written by a model and is untrusted text. It
  is put into form fields and shown as plain text, never as HTML.

  Hooks for automated checks: data-requirement-profile="panel" on the
  root ("unsaved" on the note shown for a job that is not saved yet).
*/

const LIST_KEYS = ['requiredSkills', 'preferredSkills', 'tools', 'domains', 'education', 'certifications', 'responsibilities', 'niceToHave', 'constraints'];
const TEXT_KEYS = ['requiredExperience', 'preferredExperience', 'seniority', 'location'];
const YEAR_KEYS = ['minYears', 'preferredYears'];
const MAX_YEARS = 50;

// Every field of a profile, drawn by the same form component as the
// job itself. The hints say what the rule-based ATS does with a field.
const FIELDS = [
  { key: 'requiredSkills', label: 'Required technical skills', type: 'tags', wide: true, hint: "Matched by name against the skills a candidate states. Left empty, the job's own required skills are used." },
  { key: 'preferredSkills', label: 'Preferred technical skills', type: 'tags', wide: true, hint: "Left empty, the job's own preferred skills are used." },
  { key: 'tools', label: 'Tools and technologies', type: 'tags', wide: true, hint: 'Scored as a part of their own, matched by name against the candidate\'s skills.' },
  { key: 'domains', label: 'Domains', type: 'tags', wide: true, hint: "Count for domain relevance, next to the job's category." },
  { key: 'requiredExperience', label: 'Required experience', type: 'textarea', rows: 2, hint: 'In words. The rules score the minimum years below.' },
  { key: 'minYears', label: 'Minimum years of experience', type: 'number', hint: 'Replaces the years set for the job level. Leave empty to keep the job level.' },
  { key: 'preferredYears', label: 'Preferred years of experience', type: 'number', hint: 'Listed for the recruiter. Not scored.' },
  { key: 'preferredExperience', label: 'Preferred experience', type: 'textarea', rows: 2 },
  { key: 'seniority', label: 'Seniority' },
  { key: 'location', label: 'Location', hint: "Left empty, the job's own location is used." },
  { key: 'workArrangement', label: 'Work arrangement', type: 'select', options: WORK_MODES, allowEmpty: true, emptyLabel: 'Not stated', hint: 'A hybrid or remote role passes the location rule.' },
  { key: 'education', label: 'Education', type: 'lines', rows: 3, hint: 'Listed as a check for the recruiter. Not scored.' },
  { key: 'certifications', label: 'Certifications', type: 'lines', rows: 3, hint: 'Listed as a check for the recruiter. Not scored.' },
  { key: 'responsibilities', label: 'Key responsibilities', type: 'lines', rows: 4 },
  { key: 'niceToHave', label: 'Nice to have', type: 'lines', rows: 3 },
  { key: 'constraints', label: 'Other constraints', type: 'lines', rows: 3, hint: 'Responsibilities, nice to have and other constraints are not scored by the rules. The AI comparison reads them.' },
];

// The parts of the rule-based score a job can weight, in the order the
// engine applies them (ATS_WEIGHT_KEYS in the backend constants).
const WEIGHT_FIELDS = [
  ['skills', 'Required skills'],
  ['experience', 'Experience'],
  ['preferredSkills', 'Preferred skills'],
  ['tools', 'Tools and technologies'],
  ['domain', 'Domain relevance'],
  ['location', 'Location'],
  ['completeness', 'Profile completeness'],
];
// The default weights of a profile, as the backend holds them
// (PROFILE_DEFAULT_WEIGHTS in services/atsService.js). Used only until
// the server's own copy has been read.
const PROFILE_DEFAULT_WEIGHTS = { skills: 40, experience: 20, preferredSkills: 10, tools: 10, domain: 10, location: 5, completeness: 5 };

const SOURCE_LABELS = {
  MANUAL: 'Typed by a recruiter',
  AI_REVIEWED: 'Drafted by AI, reviewed and saved by a recruiter',
};

const isNumber = (value) => typeof value === 'number' && Number.isFinite(value);
const cleanList = (value) => (Array.isArray(value) ? value.filter((item) => typeof item === 'string' && item.trim()).map((item) => item.trim()) : []);

// The form's own copy of a profile (a saved one or a draft): lists,
// texts, and '' for a number that is not set.
function formFrom(source) {
  const form = {};
  for (const key of LIST_KEYS) form[key] = cleanList(source?.[key]);
  for (const key of TEXT_KEYS) form[key] = typeof source?.[key] === 'string' ? source[key] : '';
  for (const key of YEAR_KEYS) form[key] = isNumber(source?.[key]) ? source[key] : '';
  form.workArrangement = WORK_MODES.includes(source?.workArrangement) ? source.workArrangement : '';
  return form;
}

const hasContent = (form) => LIST_KEYS.some((key) => form[key].length > 0)
  || TEXT_KEYS.some((key) => form[key].trim() !== '')
  || YEAR_KEYS.some((key) => form[key] !== '')
  || form.workArrangement !== '';

// Weights are kept as the text in their inputs, so a box can be empty
// while it is being typed in. An empty box counts as 0.
function weightText(own, defaults) {
  return Object.fromEntries(WEIGHT_FIELDS.map(([key]) => {
    if (own) return [key, String(isNumber(own[key]) ? own[key] : 0)];
    return [key, String(isNumber(defaults[key]) ? defaults[key] : 0)];
  }));
}

// { weights } as whole numbers, or { error } with the sentence to show.
function readWeights(text) {
  const weights = {};
  for (const [key, name] of WEIGHT_FIELDS) {
    const raw = String(text[key] ?? '').trim();
    const value = raw === '' ? 0 : Number(raw);
    if (!Number.isInteger(value) || value < 0 || value > 100) return { error: `${name}: enter a whole number from 0 to 100.` };
    weights[key] = value;
  }
  if (Object.values(weights).every((value) => value === 0)) return { error: 'Give at least one part a weight above 0. With every weight at 0 nothing could be scored.' };
  return { weights };
}

const weightSourceOf = (profile) => {
  if (!profile) return 'BASELINE';
  return profile.weights ? 'JOB' : 'PROFILE';
};

function Editor({ job }) {
  const { state, status, engine, reloadEngine, put, reload } = useAdminStore();
  const { can } = useAuth();
  const ask = useConfirm();
  const profile = job.requirementProfile || null;
  const canWrite = can('jobs:write');
  const canRun = can('ats:run');

  const [scoring, setScoring] = useState(null);
  const defaults = engine.data?.profileWeights || scoring?.profileDefaults || PROFILE_DEFAULT_WEIGHTS;

  const [form, setForm] = useState(() => formFrom(profile));
  const [ownWeights, setOwnWeights] = useState(Boolean(profile?.weights));
  const [weights, setWeights] = useState(() => weightText(profile?.weights || null, defaults));
  // The form component keeps what is typed in a list field as text.
  // A new key makes it read the lists again after they were replaced.
  const [formKey, setFormKey] = useState(0);
  // '' or the action in progress: 'save', 'remove', 'draft', 'rerun'.
  const [busy, setBusy] = useState('');
  // { from: the action that failed, failure: the ApiError or { message } }
  const [error, setError] = useState(null);
  // 'saved' or 'removed' after a successful request.
  const [done, setDone] = useState('');
  const [rerun, setRerun] = useState(null);
  // Set while the form holds an AI draft that has not been saved:
  // { model, uncertainties, weights (the draft suggested some) }.
  const [draft, setDraft] = useState(null);

  // Checked before the state has had time to update, so a double click
  // cannot send two requests.
  const pending = useRef(false);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);
  // The job as the store holds it now, for the answer of a request.
  const latest = useRef(job);
  latest.current = job;

  const working = Boolean(busy);
  const locked = !canWrite || working;

  function begin(action) {
    pending.current = true;
    setBusy(action);
    setError(null);
  }
  function end() {
    pending.current = false;
    if (alive.current) setBusy('');
  }

  // Puts a saved profile (or none) into the form.
  function show(next) {
    setForm(formFrom(next));
    setOwnWeights(Boolean(next?.weights));
    setWeights(weightText(next?.weights || null, defaults));
    setFormKey((key) => key + 1);
  }

  async function save() {
    if (pending.current) return;
    setDone('');
    setRerun(null);
    for (const key of YEAR_KEYS) {
      const value = form[key];
      if (value !== '' && (!isNumber(value) || value < 0 || value > MAX_YEARS)) {
        setError({ from: 'save', failure: { message: `${FIELDS.find((field) => field.key === key).label}: enter a number from 0 to ${MAX_YEARS}, or leave it empty.` } });
        return;
      }
    }
    let chosen = null;
    if (ownWeights) {
      const read = readWeights(weights);
      if (read.error) {
        setError({ from: 'save', failure: { message: read.error } });
        return;
      }
      chosen = read.weights;
    }
    if (!hasContent(form) && !chosen) {
      setError({ from: 'save', failure: { message: "There is nothing to save yet. Fill in at least one field, or turn on this job's own weights." } });
      return;
    }

    begin('save');
    try {
      const answer = await jobsApi.saveRequirementProfile(job.id, {
        ...form,
        minYears: form.minYears === '' ? null : form.minYears,
        preferredYears: form.preferredYears === '' ? null : form.preferredYears,
        // null means the default weights of a profile.
        weights: chosen,
        fromAiDraft: Boolean(draft),
        ...(draft && draft.model ? { aiModel: draft.model } : {}),
      });
      put('jobs', { ...latest.current, requirementProfile: answer.requirementProfile });
      if (alive.current) {
        show(answer.requirementProfile);
        setScoring(answer.scoring || null);
        setDraft(null);
        setDone('saved');
      }
    } catch (failure) {
      if (alive.current) setError({ from: 'save', failure });
    }
    end();
  }

  async function removeProfile() {
    if (pending.current) return;
    const agreed = await ask({
      title: 'Remove requirement profile?',
      message: 'The rule-based ATS goes back to the baseline weights for this job. This cannot be undone.',
      confirmLabel: 'Remove',
      tone: 'danger',
    });
    if (!agreed) return;
    setDone('');
    setRerun(null);
    begin('remove');
    try {
      const answer = await jobsApi.removeRequirementProfile(job.id);
      put('jobs', { ...latest.current, requirementProfile: null });
      if (alive.current) {
        show(null);
        setScoring(answer.scoring || null);
        setDraft(null);
        setDone('removed');
      }
    } catch (failure) {
      if (alive.current) setError({ from: 'remove', failure });
    }
    end();
  }

  // Sent by the "Draft with AI" button and by nothing else. The draft
  // goes into the form. It is not saved here and the server stored
  // nothing either.
  async function draftWithAi() {
    if (pending.current) return;
    if (hasContent(form)) {
      const agreed = await ask({
        title: 'Replace the form with an AI draft?',
        message: 'What you typed in the form is lost. The saved profile stays as it is until you press Save.',
        confirmLabel: 'Replace',
      });
      if (!agreed) return;
    }
    setDone('');
    setRerun(null);
    begin('draft');
    try {
      const answer = await jobsApi.draftRequirementProfile(job.id);
      if (alive.current) {
        const drafted = answer.draft || {};
        const suggested = drafted.weights && typeof drafted.weights === 'object' ? drafted.weights : null;
        setForm(formFrom(drafted));
        // Suggested weights are part of the draft. Without any, the
        // weights are left as they were.
        if (suggested) {
          setOwnWeights(true);
          setWeights(weightText(suggested, defaults));
        }
        setFormKey((key) => key + 1);
        setDraft({ model: typeof answer.model === 'string' ? answer.model : '', uncertainties: cleanList(drafted.uncertainties), weights: Boolean(suggested) });
      }
    } catch (failure) {
      if (alive.current) setError({ from: 'draft', failure });
      // The server says it has no AI connection after all: read its
      // status again so the button is no longer offered.
      if (failure.code === 'AI_NOT_CONFIGURED') reloadEngine();
    }
    end();
  }

  // Rule based only. No AI is asked anything.
  async function runRulesAgain() {
    if (pending.current) return;
    setRerun(null);
    begin('rerun');
    try {
      const outcome = await jobsApi.reevaluate(job.id);
      // The scores changed on the server: read the evaluations again.
      reload('atsResults');
      const evaluated = isNumber(outcome?.evaluated) ? outcome.evaluated : 0;
      const skipped = isNumber(outcome?.total) ? Math.max(0, outcome.total - evaluated) : 0;
      if (alive.current) {
        setRerun({
          tone: 'teal',
          text: `${evaluated} ${evaluated === 1 ? 'evaluation' : 'evaluations'} updated.${skipped ? ` ${skipped} could not be run again because the candidate is no longer on record.` : ''} This was the rule-based ATS only: no AI was used, and no review, label or application was changed.`,
        });
      }
    } catch (failure) {
      if (alive.current) setRerun({ tone: 'red', text: failure.message });
    }
    end();
  }

  const editForm = (next) => { setForm(next); setDone(''); };
  const editWeight = (key, value) => { setWeights((current) => ({ ...current, [key]: value })); setDone(''); };
  const toggleOwnWeights = (on) => {
    setOwnWeights(on);
    setDone('');
    // Turning it on starts from the weights the job would have anyway.
    if (on && !profile?.weights && !draft?.weights) setWeights(weightText(null, defaults));
  };

  const shownWeights = ownWeights ? weights : weightText(null, defaults);
  const total = WEIGHT_FIELDS.reduce((sum, [key]) => {
    const value = Number(String(shownWeights[key] ?? '').trim() || 0);
    return sum + (Number.isFinite(value) ? value : 0);
  }, 0);

  const ai = engine.status === 'ready' ? engine.data?.ai : null;
  const evaluations = status.atsResults === 'ready' ? state.atsResults.filter((result) => result.jobId === job.id).length : null;
  const source = weightSourceOf(profile);

  // "Draft with AI" needs the right to change the job and to run the
  // ATS, and a server that has AI connected.
  let drafting = null;
  if (canWrite && canRun) {
    if (ai?.available) {
      drafting = (
        <div data-requirement-draft="available">
          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={draftWithAi} disabled={working} aria-describedby="requirement-profile-progress">{busy === 'draft' ? 'Drafting with AI' : 'Draft with AI'}</Button>
            <p className="min-w-0 flex-1 basis-56 text-xs leading-relaxed text-text-dim">
              Sends this job as it is saved (no candidate data) to OpenAI once and fills the form below with a draft. Nothing is saved until you press Save.
            </p>
          </div>
        </div>
      );
    } else if (ai) {
      drafting = <p className="break-words text-xs leading-relaxed text-text-dim" data-requirement-draft="unavailable">Draft with AI is not available on this server. {typeof ai.reason === 'string' ? ai.reason : ''}</p>;
    } else if (engine.status === 'loading') {
      drafting = <p className="text-xs text-text-dim" role="status">Checking whether AI is connected on this server.</p>;
    } else {
      drafting = (
        <div className="space-y-3" data-requirement-draft="unknown">
          <div role="alert"><Notice tone="red">Whether AI is connected could not be read from the server, so Draft with AI is not offered.{engine.message ? ` ${engine.message}` : ''}</Notice></div>
          <Button size="sm" onClick={reloadEngine}>Check again</Button>
        </div>
      );
    }
  }

  return (
    <Panel title="Requirement profile" meta="Optional. For staff only: it is never shown on the public site.">
      <p className="max-w-3xl text-sm leading-relaxed text-text-dim">
        A requirement profile is an optional structured list of what this job asks for. With one, the rule-based ATS scores candidates against it with this job's own weights. Without one, the baseline weights are used. The AI comparison also uses it.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-2" data-requirement-profile-state={profile ? 'saved' : 'none'}>
        <Badge tone={profile ? 'teal' : 'dim'}>{profile ? 'Profile saved' : 'No profile'}</Badge>
        <span className="text-xs text-text-dim" data-requirement-weight-source={source}>Rule-based weights for this job now: <span className="font-semibold text-text">{WEIGHT_SOURCE_LABELS[source]}</span></span>
      </div>

      {profile && (
        <div className="mt-4 border-t border-line pt-4" data-requirement-profile="saved-by">
          <DefinitionList
            items={[
              ['Source', `${SOURCE_LABELS[profile.source] || SOURCE_LABELS.MANUAL}${profile.source === 'AI_REVIEWED' && profile.model ? ` (model: ${profile.model})` : ''}`],
              ['Saved by', profile.savedByName || 'Not recorded'],
              ['Saved', profile.savedAt ? formatDateTime(profile.savedAt) : 'Not recorded'],
            ]}
          />
        </div>
      )}

      {!canWrite && (
        <div className="mt-4">
          <Notice tone="blue">
            {profile ? 'Your role can view this requirement profile but cannot change it.' : 'This job has no requirement profile. Your role can view one but cannot add it.'}
          </Notice>
        </div>
      )}

      {drafting && <div className="mt-5 border-t border-line pt-5">{drafting}</div>}

      {/* Always in the page, so a screen reader hears it change. */}
      <div id="requirement-profile-progress" role="status" aria-live="polite" className={cx(busy === 'draft' && 'mt-4')}>
        {busy === 'draft' && <Notice tone="blue">Drafting with AI. This can take up to a minute. The form is filled when the draft arrives, and nothing is saved.</Notice>}
      </div>
      {error?.from === 'draft' && (
        <div className="mt-4" role="alert" data-ai-error={aiFailureCode(error.failure)}>
          <Notice tone="red">{aiFailureText(error.failure)}</Notice>
        </div>
      )}
      {draft && (
        <div className="mt-4" role="status" data-requirement-draft="filled">
          <Notice tone="amber">
            <span className="block font-semibold">AI draft, not saved. Read it, correct it and press Save.</span>
            {draft.weights && <span className="mt-1 block">The draft also suggests weights, so "Use this job's own weights" is now on. Turn it off to keep the default weights.</span>}
            {draft.uncertainties.length > 0 && (
              <span className="mt-2 block" data-requirement-draft="uncertainties">
                <span className="block">What the AI found unclear in the job description:</span>
                {draft.uncertainties.map((item, index) => (
                  // The model may repeat a line, so the position is the key.
                  <span key={index} className="mt-1 flex gap-2">
                    <span className="mt-[0.6em] h-1 w-1 shrink-0 bg-current" aria-hidden="true" />
                    <span className="min-w-0 break-words">{item}</span>
                  </span>
                ))}
              </span>
            )}
          </Notice>
        </div>
      )}

      {(canWrite || profile) && (
        <>
          <div className="mt-5 border-t border-line pt-5">
            <ResourceForm
              key={formKey}
              fields={FIELDS}
              value={form}
              onChange={editForm}
              state={state}
              idPrefix="requirement-profile"
              errors={error?.from === 'save' ? error.failure.fields : undefined}
              readOnly={locked}
            />
          </div>

          <fieldset className="mt-6 min-w-0 border-t border-line pt-5" data-requirement-weights={ownWeights ? 'own' : 'default'}>
            <legend className="float-left mb-3 w-full font-display text-sm font-semibold tracking-tight">Weights of the rule-based score</legend>
            <label htmlFor="requirement-profile-own-weights" className={cx('clear-both flex items-center gap-3 border border-line-strong px-3 py-2 sm:max-w-sm', locked ? 'opacity-60' : 'cursor-pointer')}>
              <input id="requirement-profile-own-weights" type="checkbox" checked={ownWeights} disabled={locked} onChange={(e) => toggleOwnWeights(e.target.checked)} className="h-4 w-4 accent-accent" />
              <span className="text-sm">Use this job's own weights</span>
            </label>
            <p className="mt-2 text-xs leading-relaxed text-text-dim">
              {ownWeights
                ? 'These weights are saved with the profile and used for this job only.'
                : 'Off: the default weights of a requirement profile are used. They are shown below and cannot be changed here.'}
            </p>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-7">
              {WEIGHT_FIELDS.map(([key, name]) => (
                <div key={key} className="flex min-w-0 flex-col">
                  {/* "weight" is read out with the name: the job form above has fields with the same names. */}
                  <label htmlFor={`requirement-profile-weight-${key}`} className={cx(labelCls, 'break-words')}>{name}<span className="sr-only"> weight</span></label>
                  <input
                    id={`requirement-profile-weight-${key}`}
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={100}
                    step={1}
                    value={shownWeights[key]}
                    disabled={locked || !ownWeights}
                    onChange={(e) => editWeight(key, e.target.value)}
                    className={cx(inputCls, 'mt-auto tabular-nums')}
                  />
                </div>
              ))}
            </div>
            <p className="mt-3 break-words text-xs leading-relaxed text-text-dim">
              <span className="font-semibold text-text" data-requirement-weights-total={total}>Total: {total}.</span> Only the proportions matter: the weights do not have to add up to 100. A weight of 0 leaves that part out of the score for this job.
            </p>
          </fieldset>
        </>
      )}

      {canWrite && (
        <div className="mt-6 border-t border-line pt-5">
          {draft && <p className="mb-3 text-xs leading-relaxed text-warn">The form holds an AI draft that is not saved yet.</p>}
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="primary" onClick={save} disabled={working}>{busy === 'save' ? 'Saving' : 'Save requirement profile'}</Button>
            {profile && <Button variant="danger" onClick={removeProfile} disabled={working}>{busy === 'remove' ? 'Removing' : 'Remove profile'}</Button>}
          </div>
        </div>
      )}

      {(error?.from === 'save' || error?.from === 'remove') && (
        <div className="mt-4" data-requirement-profile="error"><SaveError error={error.failure} fields={FIELDS} /></div>
      )}

      {done && (
        <div className="mt-4 space-y-3" data-requirement-profile={done}>
          <div role="status">
            <Notice tone="teal">
              {done === 'saved' ? 'Saved the requirement profile.' : 'Removed the requirement profile. This job is scored with the baseline weights again.'}
              {' '}Existing evaluations of this job keep their scores until the rules are run again.
              {evaluations !== null && ` This job has ${evaluations} ${evaluations === 1 ? 'evaluation' : 'evaluations'}.`}
            </Notice>
          </div>
          {canRun && (
            <div className="flex flex-wrap items-center gap-3">
              <Button onClick={runRulesAgain} disabled={working}>{busy === 'rerun' ? 'Running the rules' : 'Run the rules again for this job'}</Button>
              <p className="min-w-0 flex-1 basis-56 text-xs leading-relaxed text-text-dim">Rule based only. No AI is used, and no review, label or application is changed.</p>
            </div>
          )}
        </div>
      )}
      {rerun && (
        <div className="mt-3" role={rerun.tone === 'red' ? 'alert' : 'status'} data-requirement-rerun={rerun.tone === 'red' ? 'failed' : 'done'}>
          <Notice tone={rerun.tone}>{rerun.text}</Notice>
        </div>
      )}
    </Panel>
  );
}

// `job` is the saved job from the store, or null for a job that has
// not been saved yet: a profile belongs to a job the server knows.
export default function RequirementProfile({ job }) {
  if (!job) {
    return (
      <div data-requirement-profile="unsaved">
        <Panel title="Requirement profile" meta="Optional">
          <p className="text-sm leading-relaxed text-text-dim">A requirement profile can be added after the job is saved.</p>
        </Panel>
      </div>
    );
  }
  return (
    <div data-requirement-profile="panel">
      <Editor job={job} />
    </div>
  );
}
