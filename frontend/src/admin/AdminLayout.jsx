import React, { useEffect, useState } from 'react';
import { NavLink, Link, useLocation } from 'react-router-dom';
import { useAdminStore } from './store.jsx';
import { cx, Button } from './components/ui.jsx';

const NAV = [
  { label: 'Overview', items: [{ to: '/admin', label: 'Dashboard', end: true }] },
  {
    label: 'Recruitment',
    items: [
      { to: '/admin/jobs', label: 'Jobs' },
      { to: '/admin/candidates', label: 'Candidates' },
      { to: '/admin/applications', label: 'Applications' },
      { to: '/admin/requirements', label: 'Requirements' },
      { to: '/admin/ats', label: 'ATS results' },
      { to: '/admin/enquiries', label: 'Enquiries' },
    ],
  },
  {
    label: 'Website',
    items: [
      { to: '/admin/insights', label: 'Insights' },
      { to: '/admin/stories', label: 'Stories' },
      { to: '/admin/expertise', label: 'Expertise' },
      { to: '/admin/services', label: 'Services' },
      { to: '/admin/locations', label: 'Locations' },
    ],
  },
  { label: 'System', items: [{ to: '/admin/settings', label: 'Settings' }] },
];

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
  return NAV.map((group) => (
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

function UserBlock() {
  const { user } = useAdminStore();
  return (
    <div className="border-t border-line px-5 py-4 shrink-0">
      <p className="text-sm font-semibold">{user.name}</p>
      <p className="mt-0.5 text-xs text-text-dim">{user.role}. Sign-in is not connected yet.</p>
    </div>
  );
}

export default function AdminLayout({ children }) {
  const { pathname } = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => { setMenuOpen(false); }, [pathname]);

  const crumbs = pathname.split('/').filter(Boolean).map((part) => part.replace(/-/g, ' '));

  return (
    <div className="bg-bg text-text font-body min-h-screen lg:grid lg:grid-cols-[232px_minmax(0,1fr)]">
      <aside className="hidden lg:flex sticky top-0 h-screen flex-col border-r border-line bg-bg-raised/60">
        <Brand />
        <nav aria-label="Admin sections" className="flex-1 overflow-y-auto px-2 py-5"><NavGroups /></nav>
        <UserBlock />
      </aside>

      <div className="flex min-h-screen min-w-0 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-line bg-bg/90 px-4 backdrop-blur md:px-8">
          <Button variant="secondary" size="sm" className="lg:hidden" onClick={() => setMenuOpen(true)} aria-expanded={menuOpen}>Menu</Button>
          <p className="min-w-0 truncate font-mono text-[0.68rem] uppercase tracking-[0.14em] text-text-dim">{crumbs.join(' / ')}</p>
          <div className="ml-auto flex shrink-0 items-center gap-3">
            <span className="hidden sm:inline-flex border border-[#e8b65a]/45 bg-[#e8b65a]/10 px-2 py-0.5 font-mono text-[0.6rem] uppercase tracking-[0.12em] text-[#e8b65a]">Sample data</span>
            <Link to="/" className="text-xs font-semibold text-text-dim hover:text-accent transition-colors">View site</Link>
          </div>
        </header>
        <main className="w-full max-w-[1400px] flex-1 px-4 py-6 md:px-8 md:py-8">{children}</main>
      </div>

      {menuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-bg/80" onClick={() => setMenuOpen(false)} aria-hidden="true" />
          <aside className="relative flex h-full w-[260px] max-w-[85vw] flex-col border-r border-line-strong bg-bg">
            <Brand />
            <nav aria-label="Admin sections" className="flex-1 overflow-y-auto px-2 py-5"><NavGroups onNavigate={() => setMenuOpen(false)} /></nav>
            <UserBlock />
          </aside>
        </div>
      )}
    </div>
  );
}
