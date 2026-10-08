import React, { useEffect, useState } from 'react';
import { NavLink, Link, useLocation } from 'react-router-dom';
import { useAuth } from './auth.jsx';
import { label } from './data/enums.js';
import { cx, Button, Drawer, Notice } from './components/ui.jsx';
import { PasswordForm } from './pages/Login.jsx';
import ThemeToggle from '../components/ThemeToggle.jsx';
import AiUsageAlert from './components/AiUsageAlert.jsx';

// Each section names the permission needed to read it. A section the
// signed-in role cannot read is left out of the navigation; opening its
// address directly shows the "no access" panel (see AdminApp.jsx), and
// the API refuses its data in any case.
const NAV = [
  { label: 'Overview', items: [{ to: '/admin', label: 'Dashboard', end: true }] },
  {
    label: 'Recruitment',
    items: [
      { to: '/admin/jobs', label: 'Jobs', need: 'jobs:read' },
      { to: '/admin/candidates', label: 'Candidates', need: 'candidates:read' },
      { to: '/admin/applications', label: 'Applications', need: 'applications:read' },
      { to: '/admin/requirements', label: 'Hiring Requirements', need: 'requirements:read' },
      { to: '/admin/referrals', label: 'Referrals', need: 'referrals:read' },
      { to: '/admin/ats', label: 'ATS results', need: 'ats:read' },
      { to: '/admin/enquiries', label: 'Enquiries', need: 'enquiries:read' },
    ],
  },
  {
    label: 'Website',
    items: [
      { to: '/admin/insights', label: 'Insights', need: 'content:read' },
      { to: '/admin/stories', label: 'Stories', need: 'content:read' },
      { to: '/admin/expertise', label: 'Expertise', need: 'content:read' },
      { to: '/admin/services', label: 'Services', need: 'content:read' },
      { to: '/admin/locations', label: 'Locations', need: 'content:read' },
    ],
  },
  { label: 'System', items: [{ to: '/admin/settings', label: 'Settings', need: 'settings:read' }] },
];

const CRUMB_NAMES = { requirements: 'hiring requirements' };

function Brand() {
  return (
    <Link to="/admin" className="flex items-center gap-2.5 px-5 h-14 border-b border-line shrink-0">
      <img src="/brand/allsemis-symbol-sm.png" alt="" aria-hidden="true" width={240} height={147} className="h-[18px] w-auto shrink-0" />
      <span className="font-display font-bold text-sm tracking-wide">ALLSEMIS</span>
      <span className="font-mono text-[0.6rem] uppercase tracking-[0.18em] text-accent">Admin</span>
    </Link>
  );
}

function NavGroups({ onNavigate }) {
  const { can } = useAuth();
  return NAV
    .map((group) => ({ ...group, items: group.items.filter((item) => !item.need || can(item.need)) }))
    .filter((group) => group.items.length > 0)
    .map((group) => (
      <div key={group.label} className="mb-5">
        <p className="px-3 mb-1.5 font-mono text-[0.6rem] uppercase tracking-[0.2em] text-text-dim">{group.label}</p>
        <ul>
          {group.items.map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                end={item.end}
                onClick={onNavigate}
                className={({ isActive }) => cx(
                  'block border-l-2 px-3 py-2 text-sm transition-colors focus:outline-none focus-visible:bg-accent/10',
                  isActive ? 'border-accent bg-accent/10 text-text font-semibold' : 'border-transparent text-text-dim hover:text-text hover:bg-accent/[0.05]',
                )}
              >
                {item.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </div>
    ));
}

const userActionCls = 'text-xs font-semibold text-text-dim transition-colors hover:text-accent focus:outline-none focus-visible:text-accent disabled:opacity-40';

function UserBlock({ onChangePassword }) {
  const { user, logout } = useAuth();
  const [leaving, setLeaving] = useState(false);
  return (
    <div className="border-t border-line px-5 py-4 shrink-0">
      <p className="truncate text-sm font-semibold">{user.name}</p>
      <p className="mt-0.5 truncate text-xs text-text-dim">{label(user.role)}</p>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
        <button type="button" onClick={onChangePassword} className={userActionCls}>Change password</button>
        <button type="button" disabled={leaving} onClick={() => { setLeaving(true); logout(); }} className={userActionCls}>{leaving ? 'Signing out' : 'Sign out'}</button>
      </div>
    </div>
  );
}

function PasswordDrawer({ onClose }) {
  const [changed, setChanged] = useState(false);
  return (
    <Drawer title="Change password" onClose={onClose}>
      {changed ? (
        <>
          <div role="status"><Notice tone="teal">Your password was changed. Every other device signed in to this account has been signed out.</Notice></div>
          <div className="mt-5"><Button onClick={onClose}>Close</Button></div>
        </>
      ) : (
        <>
          <p className="mb-5 text-sm text-text-dim leading-relaxed">You stay signed in here. Every other device signed in to this account is signed out.</p>
          <PasswordForm onDone={() => setChanged(true)} />
        </>
      )}
    </Drawer>
  );
}

export default function AdminLayout({ children }) {
  const { pathname } = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);

  useEffect(() => { setMenuOpen(false); }, [pathname]);

  // A record id in the address is shown as "record", not as the id, and
  // a section whose name differs from its address shows its name.
  const crumbs = pathname.split('/').filter(Boolean).map((part) => (/^[a-f0-9]{24}$/i.test(part) ? 'record' : CRUMB_NAMES[part] || part.replace(/-/g, ' ')));
  const openPassword = () => { setMenuOpen(false); setPasswordOpen(true); };

  return (
    <div className="bg-bg text-text font-body min-h-screen lg:grid lg:grid-cols-[232px_minmax(0,1fr)]">
      <aside className="hidden lg:flex sticky top-0 h-screen flex-col border-r border-line bg-bg-raised/60">
        <Brand />
        <nav aria-label="Admin sections" className="flex-1 overflow-y-auto px-2 py-5"><NavGroups /></nav>
        <UserBlock onChangePassword={openPassword} />
      </aside>

      <div className="flex min-h-screen min-w-0 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-line bg-bg/90 px-4 backdrop-blur md:px-8">
          <Button variant="secondary" size="sm" className="lg:hidden" onClick={() => setMenuOpen(true)} aria-expanded={menuOpen}>Menu</Button>
          <p className="min-w-0 truncate font-mono text-[0.68rem] uppercase tracking-[0.14em] text-text-dim">{crumbs.join(' / ')}</p>
          <div className="ml-auto flex shrink-0 items-center gap-3">
            <ThemeToggle />
            <Link to="/" className="text-xs font-semibold text-text-dim hover:text-accent transition-colors">View site</Link>
          </div>
        </header>
        <main className="w-full max-w-[1400px] flex-1 px-4 py-6 md:px-8 md:py-8"><AiUsageAlert />{children}</main>
      </div>

      {menuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-bg/80" onClick={() => setMenuOpen(false)} aria-hidden="true" />
          <aside className="relative flex h-full w-[260px] max-w-[85vw] flex-col border-r border-line-strong bg-bg">
            <Brand />
            <nav aria-label="Admin sections" className="flex-1 overflow-y-auto px-2 py-5"><NavGroups onNavigate={() => setMenuOpen(false)} /></nav>
            <UserBlock onChangePassword={openPassword} />
          </aside>
        </div>
      )}

      {passwordOpen && <PasswordDrawer onClose={() => setPasswordOpen(false)} />}
    </div>
  );
}
