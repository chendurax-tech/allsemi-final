import React, { useCallback, useEffect, useState } from 'react';
import { settingsApi, usersApi, atsApi } from '../../lib/api/index.js';
import { useAuth } from '../auth.jsx';
import { ROLES, label } from '../data/enums.js';
import { PageHeader, Panel, Button, Badge, DefinitionList, EmptyState, Notice, cx, inputCls, labelCls } from '../components/ui.jsx';
import ResourceForm, { SaveError } from '../components/ResourceForm.jsx';
import { ATS_COMPONENTS } from '../data/atsStages.js';
import { formatDateTime } from '../lib/format.js';
import { useConfirm } from '../components/Feedback.jsx';

/*
  Settings - three tabs:
    Contact     the office contact details, read and saved through the
                API (saving needs settings:write).
    AI and ATS  what is actually running: the rule-based ATS with its
                weights, whether the server has the AI comparison
                connected (as the server reports it: status, model,
                whether a key is set, its reason) and which storage and
                email integrations the server has credentials for.
                Read only. Booleans and names only; no key or secret
                ever reaches the browser.
    Access      the role and permission table the server enforces, and
                for a role with users:manage, the user accounts.
*/

const TABS = ['Contact', 'AI and ATS', 'Access'];

const CONTACT_FIELDS = [
  { key: 'email', label: 'Email' },
  { key: 'phone', label: 'Phone' },
  { key: 'address', label: 'Address', type: 'lines', rows: 3 },
  { key: 'hours', label: 'Hours', type: 'lines', rows: 3 },
];

// Reads something from the API when a tab opens and reports where the
// request stands, so every tab shows the same loading and error states.
function useLoaded(request) {
  const [load, setLoad] = useState({ status: 'loading', data: null, message: '' });
  const read = useCallback(() => {
    setLoad((current) => ({ ...current, status: current.data ? 'ready' : 'loading' }));
    return request()
      .then((data) => setLoad({ status: 'ready', data, message: '' }))
      .catch((failure) => setLoad((current) => ({ ...current, status: 'error', message: failure.message })));
  }, [request]);
  useEffect(() => { read(); }, [read]);
  return [load, read, (data) => setLoad({ status: 'ready', data, message: '' })];
}

function LoadState({ load, retry, what }) {
  if (load.status === 'loading') return <Panel><div role="status"><EmptyState title={`Loading ${what}`} /></div></Panel>;
  return (
    <Panel>
      <div role="alert"><EmptyState title={`The ${what} could not be loaded`}>{load.message}</EmptyState></div>
      <div className="flex justify-center pb-4"><Button onClick={retry}>Try again</Button></div>
    </Panel>
  );
}

function ContactForm({ settings, onSaved }) {
  const { can } = useAuth();
  const [draft, setDraft] = useState(settings.contact);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(false);
  const canSave = can('settings:write');

  async function save() {
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const next = await settingsApi.saveContact(draft);
      setDraft(next.contact);
      onSaved(next);
      setSaved(true);
    } catch (failure) {
      setError(failure);
    }
    setBusy(false);
  }

  return (
    <Panel
      title="Contact"
      meta={settings.updatedByName ? `Last saved by ${settings.updatedByName}, ${formatDateTime(settings.updatedAt)}` : undefined}
      action={canSave ? <Button variant="primary" size="sm" onClick={save} disabled={busy}>{busy ? 'Saving' : 'Save contact'}</Button> : null}
    >
      <div className="mb-5 space-y-3">
        <Notice tone="blue">The ALLSEMIS office contact details. They are saved to the database and offered to the public site through the API.</Notice>
        {!canSave && <Notice tone="blue">Your role can view these details but cannot change them.</Notice>}
        {saved && <div role="status"><Notice tone="teal">Saved contact details.</Notice></div>}
        <SaveError error={error} fields={CONTACT_FIELDS} />
      </div>
      <ResourceForm fields={CONTACT_FIELDS} value={draft} onChange={(next) => { setDraft(next); setSaved(false); }} idPrefix="contact" errors={error?.fields} readOnly={!canSave} />
    </Panel>
  );
}

const configured = (value) => <Badge>{value ? 'Configured' : 'Not configured'}</Badge>;

function SystemTab({ settings }) {
  const { can } = useAuth();
  const readEngine = useCallback(() => (can('ats:read') ? atsApi.engine() : Promise.resolve(null)), [can]);
  const [engine, retry] = useLoaded(readEngine);
  const { system } = settings;
  const ai = system.ai || {};
  const developmentDrivers = [
    system.fileStorage !== 'b2' && `private documents: ${system.fileStorage}`,
    system.mediaStorage !== 'cloudinary' && `images: ${system.mediaStorage}`,
    system.email !== 'resend' && `email: ${system.email}`,
  ].filter(Boolean);

  return (
    <div className="space-y-6">
      {can('ats:read') && engine.status !== 'ready' && <LoadState load={engine} retry={retry} what="ATS engine details" />}
      {!can('ats:read') && (
        <Panel title="ATS">
          <p className="text-sm text-text-dim leading-relaxed">Evaluations use the rule-based ATS. Your role does not include the ATS, so its details are not shown.</p>
        </Panel>
      )}
      {engine.status === 'ready' && engine.data && (
        <Panel title="ATS" meta="Read only. Set in the server code.">
          <DefinitionList
            items={[
              ['Engine', <span key="engine" className="flex flex-wrap items-center gap-2">{engine.data.label}, version {engine.data.version} <Badge tone="teal">Active</Badge></span>],
              ['How it works', 'Fixed rules compare the candidate profile with the job. The same inputs always give the same score.'],
              ['Decision rule', 'A score supports a recruiter. It never changes the status of a candidate or an application.'],
            ]}
          />
          <p className="mt-6 font-mono text-[0.62rem] uppercase tracking-[0.14em] text-text-dim mb-2">Baseline weights, out of 100</p>
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {Object.entries(engine.data.weights).map(([name, weight]) => (
              <li key={name} className="flex items-baseline justify-between gap-3 border border-line px-3 py-2">
                <span className="text-sm">{ATS_COMPONENTS.find((part) => part.weight === name)?.label || name}</span>
                <span className="font-display text-lg font-semibold tabular-nums">{weight}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-text-dim leading-relaxed">The baseline is used for every job without a requirement profile. A job with a requirement profile is scored against that profile, with the job's own weights when it has them: the profile is edited on the job's page. A part the job gives nothing to compare for is left out, and the remaining weights are rescaled.</p>
        </Panel>
      )}

      <Panel title="AI comparison" meta="Read only. Reported by the server.">
        <DefinitionList
          items={[
            ['Status', <Badge key="status">{ai.available ? 'Enabled' : 'Not enabled'}</Badge>],
            ['OpenAI', <Badge key="openai" tone={ai.available ? 'teal' : 'dim'}>{ai.available ? 'Connected' : 'Not connected'}</Badge>],
            ...(ai.model ? [['Model', ai.model]] : []),
            ['API key on the server', ai.keyConfigured ? 'Set' : 'Not set'],
            ...(ai.reason ? [['Note', ai.reason]] : []),
            ['How it is used', 'The rule-based ATS always runs first. AI is never automatic. A recruiter can start three things, each by its own button: a comparison of one candidate with a job, a draft of a job\'s requirement profile, and a comparison of several candidates of one job. Every result is advice. AI shortlists and rejects nobody and changes no status.'],
            ['Usage', 'The estimated AI usage and spend are on the dashboard.'],
          ]}
        />
      </Panel>

      <Panel title="Integrations" meta="Which services the server has credentials for. No key or secret is sent to the browser.">
        <DefinitionList
          items={[
            ['Private documents: driver in use', system.fileStorage],
            ['Backblaze B2 credentials', configured(system.b2Configured)],
            ['Website images: driver in use', system.mediaStorage],
            ['Cloudinary credentials', configured(system.cloudinaryConfigured)],
            ['Email: driver in use', system.email],
            ['Resend credentials', configured(system.resendConfigured)],
            ['Email sender domain', system.emailSenderDomain ? `${system.emailSenderDomain}. Resend only sends from a domain that is verified in the Resend account.` : 'Not set'],
          ]}
        />
        {developmentDrivers.length > 0 && (
          <div className="mt-5">
            <Notice tone="amber">
              This server is running on development drivers ({developmentDrivers.join(', ')}). Before going live, private documents must use Backblaze B2, images must use Cloudinary and email must use Resend.
            </Notice>
          </div>
        )}
      </Panel>
    </div>
  );
}

const AREA_LABELS = {
  jobs: 'Jobs', candidates: 'Candidates', resumes: 'Resumes', applications: 'Applications', requirements: 'Hiring requirements',
  referrals: 'Referrals', enquiries: 'Enquiries', ats: 'ATS', content: 'Website content', media: 'Image uploads',
  settings: 'Settings', users: 'Users', audit: 'Audit log',
};
const ACTION_WORDS = { read: 'view', write: 'edit', publish: 'publish', delete: 'delete', run: 'run', review: 'review', upload: 'upload', manage: 'manage' };

// "jobs:read", "jobs:write" -> "View, edit" for the jobs row.
function actionsFor(permissions, area) {
  const words = permissions.filter((permission) => permission.startsWith(`${area}:`)).map((permission) => {
    const action = permission.split(':')[1];
    return ACTION_WORDS[action] || action;
  });
  if (words.length === 0) return '';
  const text = words.join(', ');
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function AccessMatrix() {
  const [access, retry] = useLoaded(settingsApi.access);
  if (access.status !== 'ready') return <LoadState load={access} retry={retry} what="access table" />;
  const roles = access.data;
  // The rows are whatever areas the server's permissions name, in the
  // order they first appear.
  const areas = [...new Set(roles.flatMap((entry) => entry.permissions.map((permission) => permission.split(':')[0])))];

  return (
    <Panel title="Access" meta="What each role can do, as the server enforces it." pad={false}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-line text-left">
              <th scope="col" className="px-4 md:px-5 py-2.5 font-mono text-[0.62rem] uppercase tracking-[0.14em] text-text-dim font-medium">Area</th>
              {roles.map((entry) => (
                <th key={entry.role} scope="col" className="px-4 md:px-5 py-2.5 font-mono text-[0.62rem] uppercase tracking-[0.14em] text-text-dim font-medium">{label(entry.role)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {areas.map((area) => (
              <tr key={area} className="border-b border-line last:border-0">
                <th scope="row" className="px-4 md:px-5 py-3 text-left font-semibold whitespace-nowrap">{AREA_LABELS[area] || area}</th>
                {roles.map((entry) => {
                  const actions = actionsFor(entry.permissions, area);
                  return <td key={entry.role} className={cx('px-4 md:px-5 py-3 align-top', !actions && 'text-text-dim')}>{actions || 'None'}</td>;
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="border-t border-line p-4 md:p-5">
        <Notice tone="blue">
          Sign-in is required for every admin screen, and the server checks the session and this table on every request. Sections and buttons a role cannot use are hidden here for convenience; hiding them is not the control.
        </Notice>
      </div>
    </Panel>
  );
}

// Shown once, straight after an account is created or reset. The value
// lives only in this component's memory and is gone when it is hidden
// or the page is left.
function OneTimePassword({ secret, onHide }) {
  const [copied, setCopied] = useState('');

  async function copy() {
    try {
      await navigator.clipboard.writeText(secret.password);
      setCopied('Copied.');
    } catch {
      setCopied('Copying is not available in this browser. Select the password and copy it by hand.');
    }
  }

  return (
    <div className="border border-warn/45 bg-warn/10 p-4" role="status">
      <p className="text-sm font-semibold">Temporary password for {secret.email}</p>
      <p className="mt-2 select-all break-all border border-line-strong bg-bg px-3 py-2 font-mono text-sm">{secret.password}</p>
      <p className="mt-2 text-xs leading-relaxed text-text-dim">
        Copy it now and give it to the person privately. It is shown once and cannot be retrieved later. They will be asked to choose their own password when they first sign in.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={copy}>Copy password</Button>
        <Button size="sm" variant="ghost" onClick={onHide}>I have copied it. Hide it.</Button>
        {copied && <span className="text-xs text-text-dim">{copied}</span>}
      </div>
    </div>
  );
}

function Users() {
  const ask = useConfirm();
  const { user: me } = useAuth();
  const [users, retry, setUsers] = useLoaded(usersApi.list);
  const [draft, setDraft] = useState({ name: '', email: '', role: 'RECRUITER' });
  const [busy, setBusy] = useState('');
  const [error, setError] = useState(null);
  const [secret, setSecret] = useState(null);
  const [notice, setNotice] = useState('');

  if (users.status !== 'ready' && !users.data) return <LoadState load={users} retry={retry} what="user accounts" />;
  const list = users.data;
  const replace = (updated) => setUsers(list.map((item) => (item.id === updated.id ? updated : item)));

  async function act(key, action, done) {
    setBusy(key);
    setError(null);
    setNotice('');
    try {
      await action();
      setNotice(done);
    } catch (failure) {
      setError(failure);
    }
    setBusy('');
  }

  const add = (event) => {
    event.preventDefault();
    act('add', async () => {
      const created = await usersApi.create({ name: draft.name.trim(), email: draft.email.trim(), role: draft.role });
      setUsers([...list, created.user]);
      setSecret({ email: created.user.email, password: created.temporaryPassword });
      setDraft({ name: '', email: '', role: 'RECRUITER' });
    }, 'Added the user.');
  };

  const update = (account, changes, done) => act(account.id, async () => replace(await usersApi.update(account.id, changes)), done);

  const reset = async (account) => {
    const agreed = await ask({
      title: 'Reset password?',
      message: `This resets the password of ${account.email}. They are signed out everywhere and must use the new temporary password.`,
      confirmLabel: 'Reset password',
      tone: 'danger',
    });
    if (!agreed) return;
    act(account.id, async () => {
      const result = await usersApi.resetPassword(account.id);
      replace(result.user);
      setSecret({ email: account.email, password: result.temporaryPassword });
    }, 'Reset the password.');
  };

  const fields = error?.fields || {};

  return (
    <Panel title="Users" meta="Accounts that can sign in to the admin" pad={false}>
      {(secret || error || notice) && (
        <div className="space-y-3 border-b border-line p-4 md:p-5">
          {secret && <OneTimePassword secret={secret} onHide={() => setSecret(null)} />}
          {error && <div role="alert"><Notice tone="red">{error.message}</Notice></div>}
          {notice && !error && <div role="status"><Notice tone="teal">{notice}</Notice></div>}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-line text-left">
              {['User', 'Role', 'Status', 'Last sign-in', 'Actions'].map((heading) => (
                <th key={heading} scope="col" className="px-4 md:px-5 py-2.5 font-mono text-[0.62rem] uppercase tracking-[0.14em] text-text-dim font-medium whitespace-nowrap">{heading}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {list.map((account) => {
              const self = account.id === me.id;
              const working = busy === account.id;
              return (
                <tr key={account.id} className="border-b border-line last:border-0">
                  <td className="px-4 md:px-5 py-3 align-top">
                    <span className="block font-semibold">{account.name}{self ? ' (you)' : ''}</span>
                    <span className="block text-xs text-text-dim">{account.email}</span>
                  </td>
                  <td className="px-4 md:px-5 py-3 align-top">
                    <label className="sr-only" htmlFor={`role-${account.id}`}>Role of {account.name}</label>
                    <select
                      id={`role-${account.id}`}
                      value={account.role}
                      disabled={self || working}
                      onChange={(e) => update(account, { role: e.target.value }, `Changed the role of ${account.email} to ${label(e.target.value)}. They have been signed out.`)}
                      className={cx(inputCls, 'min-w-[10rem]')}
                    >
                      {ROLES.map((role) => <option key={role} value={role}>{label(role)}</option>)}
                    </select>
                  </td>
                  <td className="px-4 md:px-5 py-3 align-top">
                    <span className="flex flex-col items-start gap-1.5">
                      <Badge>{account.active ? 'Enabled' : 'Disabled'}</Badge>
                      {account.mustChangePassword && <Badge>Temporary password</Badge>}
                    </span>
                  </td>
                  <td className="px-4 md:px-5 py-3 align-top whitespace-nowrap text-text-dim">{account.lastLoginAt ? formatDateTime(account.lastLoginAt) : 'Never'}</td>
                  <td className="px-4 md:px-5 py-3 align-top">
                    {self ? <span className="text-xs text-text-dim">Use "Change password" in the menu for your own account.</span> : (
                      <span className="flex flex-wrap gap-2">
                        <Button size="sm" disabled={working} onClick={() => update(account, { active: !account.active }, account.active ? `Disabled ${account.email}. They have been signed out.` : `Enabled ${account.email}.`)}>
                          {account.active ? 'Disable' : 'Enable'}
                        </Button>
                        <Button size="sm" disabled={working} onClick={() => reset(account)}>Reset password</Button>
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <form onSubmit={add} className="border-t border-line p-4 md:p-5" noValidate>
        <h3 className="font-display text-sm font-semibold tracking-tight">Add a user</h3>
        <p className="mt-1 text-xs text-text-dim leading-relaxed">The server creates a temporary password and shows it here once. The person chooses their own password at first sign-in.</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <div>
            <label htmlFor="user-name" className={labelCls}>Name</label>
            <input id="user-name" type="text" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} className={inputCls} />
            {fields.name && <p className="mt-1.5 text-xs text-red-400">{fields.name}</p>}
          </div>
          <div>
            <label htmlFor="user-email" className={labelCls}>Email</label>
            <input id="user-email" type="email" autoComplete="off" value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} className={inputCls} />
            {fields.email && <p className="mt-1.5 text-xs text-red-400">{fields.email}</p>}
          </div>
          <div>
            <label htmlFor="user-role" className={labelCls}>Role</label>
            <select id="user-role" value={draft.role} onChange={(e) => setDraft({ ...draft, role: e.target.value })} className={inputCls}>
              {ROLES.map((role) => <option key={role} value={role}>{label(role)}</option>)}
            </select>
          </div>
        </div>
        <div className="mt-4"><Button type="submit" variant="primary" disabled={busy === 'add'}>{busy === 'add' ? 'Adding' : 'Add user'}</Button></div>
      </form>
    </Panel>
  );
}

export default function Settings() {
  const { can } = useAuth();
  const [tab, setTab] = useState(TABS[0]);
  const [settings, retry, setSettings] = useLoaded(settingsApi.get);

  return (
    <>
      <PageHeader eyebrow="System" title="Settings" description="Office contact details, what the ATS and the integrations are running on, and who can do what." />

      <div className="mb-6 flex flex-wrap gap-2" role="tablist" aria-label="Settings sections">
        {TABS.map((name) => (
          <button
            key={name}
            type="button"
            role="tab"
            aria-selected={tab === name}
            onClick={() => setTab(name)}
            className={cx(
              'border px-3 py-2 text-sm transition-colors focus:outline-none focus-visible:border-accent',
              tab === name ? 'border-accent bg-accent/10 text-text font-semibold' : 'border-line-strong text-text-dim hover:text-text',
            )}
          >
            {name}
          </button>
        ))}
      </div>

      {tab !== 'Access' && !settings.data && <LoadState load={settings} retry={retry} what="settings" />}

      {tab === 'Contact' && settings.data && (
        <ContactForm settings={settings.data} onSaved={(next) => setSettings({ ...settings.data, ...next })} />
      )}

      {tab === 'AI and ATS' && settings.data && <SystemTab settings={settings.data} />}

      {tab === 'Access' && (
        <div className="space-y-6">
          <AccessMatrix />
          {can('users:manage') && <Users />}
        </div>
      )}
    </>
  );
}
