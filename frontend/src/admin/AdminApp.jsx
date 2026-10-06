import React, { useEffect } from 'react';
import { Routes, Route, useParams } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth.jsx';
import { AdminStoreProvider } from './store.jsx';
import { label } from './data/enums.js';
import AdminLayout from './AdminLayout.jsx';
import Login, { ChangePassword } from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import ResourceList from './pages/ResourceList.jsx';
import ResourceEditor from './pages/ResourceEditor.jsx';
import CandidateDetail from './pages/CandidateDetail.jsx';
import ReferralDetail from './pages/ReferralDetail.jsx';
import AtsOverview from './pages/AtsOverview.jsx';
import AtsResult from './pages/AtsResult.jsx';
import Settings from './pages/Settings.jsx';
import { Panel, EmptyState, Button } from './components/ui.jsx';

/*
  AdminApp - the admin panel root, loaded lazily by App.jsx for any
  /admin route. It has its own layout and never renders the public
  Header or Footer.

  Nothing in the admin is shown without a signed-in session:
    checking    the backend is asked whether a session exists
    signed out  the sign-in screen, at whatever /admin address was opened
    signed in   with a temporary password: the change-password screen
                otherwise: the admin, with its data read from the API

  Every screen reads and writes through the backend API (see
  store.jsx). Each route names the permission it needs; a role without
  it sees a "no access" panel instead of the screen. That panel and the
  hidden navigation are conveniences: the backend checks the session
  and the permission on every request and is the actual control.

  The panel also asks search engines not to index it.
*/

// Each wrapper keys its page by resource or URL parameter, so moving
// between two routes that share a component starts from clean state.
function List({ resource }) {
  return <ResourceList key={resource} resource={resource} />;
}
function Editor({ resource }) {
  const { id } = useParams();
  return <ResourceEditor key={`${resource}-${id || 'new'}`} resource={resource} id={id} />;
}
function Candidate() {
  const { id } = useParams();
  return <CandidateDetail key={id} id={id} />;
}
function Referral() {
  const { id } = useParams();
  return <ReferralDetail key={id} id={id} />;
}
function Ats() {
  const { candidateId } = useParams();
  return <AtsResult key={candidateId} candidateId={candidateId} />;
}
function NotFound() {
  return (
    <Panel>
      <EmptyState title="This admin page does not exist">Check the address, or go back to the dashboard.</EmptyState>
      <div className="flex justify-center pb-4"><Button to="/admin">Open the dashboard</Button></div>
    </Panel>
  );
}

// Shows a screen only to a role that holds the permission it needs.
function Guard({ need, children }) {
  const { can, user } = useAuth();
  if (can(need)) return children;
  return (
    <Panel>
      <EmptyState title="You do not have access to this section">
        Your role ({label(user.role)}) does not include it. If you need it, ask a super admin to change your role.
      </EmptyState>
      <div className="flex justify-center pb-4"><Button to="/admin">Open the dashboard</Button></div>
    </Panel>
  );
}

const guarded = (need, element) => <Guard need={need}>{element}</Guard>;

function Gate() {
  const { status, user } = useAuth();

  if (status === 'checking') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg font-body text-text" role="status">
        <p className="font-mono text-[0.68rem] uppercase tracking-[0.14em] text-text-dim">Checking your session</p>
      </div>
    );
  }
  if (status === 'signedOut') return <Login />;
  if (user.mustChangePassword) return <ChangePassword />;

  // Keyed by user, so signing in as someone else starts from an empty
  // store and reads only what that role may read.
  return (
    <AdminStoreProvider key={user.id}>
      <AdminLayout>
        <Routes>
          <Route path="/admin" element={<Dashboard />} />
          <Route path="/admin/jobs" element={guarded('jobs:read', <List resource="jobs" />)} />
          <Route path="/admin/jobs/new" element={guarded('jobs:write', <Editor resource="jobs" />)} />
          <Route path="/admin/jobs/:id" element={guarded('jobs:read', <Editor resource="jobs" />)} />
          <Route path="/admin/candidates" element={guarded('candidates:read', <List resource="candidates" />)} />
          <Route path="/admin/candidates/:id" element={guarded('candidates:read', <Candidate />)} />
          <Route path="/admin/applications" element={guarded('applications:read', <List resource="applications" />)} />
          <Route path="/admin/requirements" element={guarded('requirements:read', <List resource="requirements" />)} />
          <Route path="/admin/referrals" element={guarded('referrals:read', <List resource="referrals" />)} />
          <Route path="/admin/referrals/:id" element={guarded('referrals:read', <Referral />)} />
          <Route path="/admin/ats" element={guarded('ats:read', <AtsOverview />)} />
          <Route path="/admin/ats/:candidateId" element={guarded('ats:read', <Ats />)} />
          <Route path="/admin/enquiries" element={guarded('enquiries:read', <List resource="enquiries" />)} />
          <Route path="/admin/insights" element={guarded('content:read', <List resource="insights" />)} />
          <Route path="/admin/insights/new" element={guarded('content:write', <Editor resource="insights" />)} />
          <Route path="/admin/insights/:id" element={guarded('content:read', <Editor resource="insights" />)} />
          <Route path="/admin/stories" element={guarded('content:read', <List resource="stories" />)} />
          <Route path="/admin/stories/new" element={guarded('content:write', <Editor resource="stories" />)} />
          <Route path="/admin/expertise" element={guarded('content:read', <List resource="expertise" />)} />
          <Route path="/admin/expertise/new" element={guarded('content:write', <Editor resource="expertise" />)} />
          <Route path="/admin/services" element={guarded('content:read', <List resource="services" />)} />
          <Route path="/admin/locations" element={guarded('content:read', <List resource="locations" />)} />
          <Route path="/admin/settings" element={guarded('settings:read', <Settings />)} />
          <Route path="/admin/*" element={<NotFound />} />
        </Routes>
      </AdminLayout>
    </AdminStoreProvider>
  );
}

export default function AdminApp() {
  useEffect(() => {
    const previousTitle = document.title;
    document.title = 'ALLSEMIS Admin';
    const robots = document.createElement('meta');
    robots.name = 'robots';
    robots.content = 'noindex, nofollow';
    document.head.appendChild(robots);
    return () => {
      document.title = previousTitle;
      robots.remove();
    };
  }, []);

  return (
    <AuthProvider>
      <Gate />
    </AuthProvider>
  );
}
