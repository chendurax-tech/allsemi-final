import React, { useState } from 'react';
import { useAdminStore } from '../store.jsx';
import { PageHeader, Panel, Button, Badge, DefinitionList, Notice, cx } from '../components/ui.jsx';
import ResourceForm from '../components/ResourceForm.jsx';

/*
  Settings - the office contact details plus read-only views of the AI
  configuration and the planned access roles.

  The homepage and about copy are not edited here. That content still
  lives in the admin store (data/siteContent.js, state.site.homepage and
  state.site.about); only its tabs were removed from this screen.
*/

const TABS = ['Contact', 'AI and ATS', 'Access'];

const CONTACT_FIELDS = [
  { key: 'email', label: 'Email' },
  { key: 'phone', label: 'Phone' },
  { key: 'address', label: 'Address', type: 'lines', rows: 3 },
  { key: 'hours', label: 'Hours', type: 'lines', rows: 3 },
];

const ROLES = [
  { role: 'Admin', recruitment: 'Full', resumes: 'View and delete', ats: 'Review', content: 'Edit and publish', settings: 'Full' },
  { role: 'Recruiter', recruitment: 'Full', resumes: 'View', ats: 'Review', content: 'None', settings: 'None' },
  { role: 'Content editor', recruitment: 'None', resumes: 'None', ats: 'None', content: 'Edit and publish', settings: 'None' },
];

function SiteForm({ section, title, fields, children }) {
  const { state, setSite } = useAdminStore();
  const [draft, setDraft] = useState(state.site[section]);
  const [saved, setSaved] = useState(false);

  return (
    <Panel
      title={title}
      action={(
        <span className="flex items-center gap-3">
          {saved && <span className="text-xs text-turquoise" role="status">Saved {title.toLowerCase()}</span>}
          <Button variant="primary" size="sm" onClick={() => { setSite(section, draft); setSaved(true); }}>Save {title.toLowerCase()}</Button>
        </span>
      )}
    >
      {children}
      <ResourceForm fields={fields} value={draft} onChange={(next) => { setDraft(next); setSaved(false); }} idPrefix={section} />
    </Panel>
  );
}

export default function Settings() {
  const [tab, setTab] = useState(TABS[0]);

  return (
    <>
      <PageHeader eyebrow="System" title="Settings" description="Office contact details, the AI configuration and who can do what." />

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

      {tab === 'Contact' && (
        <SiteForm section="contact" title="Contact" fields={CONTACT_FIELDS}>
          <div className="mb-5"><Notice tone="blue">These are the Bengaluru office details shown on the Contact page and the network map.</Notice></div>
        </SiteForm>
      )}

      {tab === 'AI and ATS' && (
        <Panel title="AI and ATS" meta="Read only. These values are set on the server.">
          <DefinitionList
            items={[
              ['Provider', 'OpenAI, called from the backend only'],
              ['Model', 'Read from backend configuration, so it can change without a code change'],
              ['API key', 'Held on the server. Never sent to the browser.'],
              ['Output format', 'Structured JSON, checked against a schema'],
              ['Connection', <Badge key="status" tone="amber">Not connected</Badge>],
              ['Decision rule', 'AI output supports a recruiter. It does not decide.'],
            ]}
          />
          <p className="mt-6 font-mono text-[0.62rem] uppercase tracking-[0.14em] text-text-dim mb-2">Backend functions</p>
          <ul className="grid gap-2 sm:grid-cols-2">
            {[
              ['extractResume', 'Reads a resume into a structured profile'],
              ['parseJobDescription', 'Reads a job into structured requirements'],
              ['compareCandidateToJob', 'Compares profile and requirements'],
              ['generateMatchExplanation', 'Writes the reasons with evidence'],
              ['answerChatbot', 'Answers candidate and client questions'],
            ].map(([name, purpose]) => (
              <li key={name} className="border border-line px-3 py-2">
                <code className="font-mono text-xs text-[#8ab8ff]">{name}</code>
                <p className="mt-1 text-xs text-text-dim">{purpose}</p>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      {tab === 'Access' && (
        <Panel title="Access" meta="Planned roles. Sign-in and permissions are connected with the backend." pad={false}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-line text-left">
                  {['Role', 'Recruitment', 'Resumes', 'ATS', 'Website content', 'Settings'].map((h) => (
                    <th key={h} scope="col" className="px-4 md:px-5 py-2.5 font-mono text-[0.62rem] uppercase tracking-[0.14em] text-text-dim font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ROLES.map((r) => (
                  <tr key={r.role} className="border-b border-line last:border-0">
                    <th scope="row" className="px-4 md:px-5 py-3 text-left font-semibold">{r.role}</th>
                    {[r.recruitment, r.resumes, r.ats, r.content, r.settings].map((cell, i) => (
                      <td key={i} className={cx('px-4 md:px-5 py-3', cell === 'None' ? 'text-text-dim' : '')}>{cell}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="border-t border-line p-4 md:p-5">
            <Notice tone="amber">Authentication is required before production deployment. This build has no sign-in, so keep the admin panel off a public domain.</Notice>
          </div>
        </Panel>
      )}
    </>
  );
}
