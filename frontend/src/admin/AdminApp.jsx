import React, { useEffect } from 'react';
import { Routes, Route, useParams } from 'react-router-dom';
import { AdminStoreProvider } from './store.jsx';
import AdminLayout from './AdminLayout.jsx';
import Dashboard from './pages/Dashboard.jsx';
import ResourceList from './pages/ResourceList.jsx';
import ResourceEditor from './pages/ResourceEditor.jsx';
import CandidateDetail from './pages/CandidateDetail.jsx';
import AtsOverview from './pages/AtsOverview.jsx';
import AtsResult from './pages/AtsResult.jsx';
import Settings from './pages/Settings.jsx';
import { Panel, EmptyState, Button } from './components/ui.jsx';

/*
  AdminApp - the admin panel root, loaded lazily by App.jsx for any
  /admin route. It has its own layout and never renders the public
  Header or Footer.

  UI PHASE: every screen runs on in-memory sample data (see store.jsx)
  and there is no sign-in yet. Authentication is required before
  production deployment: do not expose /admin on a production domain
  until authentication and route protection are connected - the
  layout shows a "Sample data" marker on every screen for that reason.
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
    <AdminStoreProvider>
      <AdminLayout>
        <Routes>
          <Route path="/admin" element={<Dashboard />} />
          <Route path="/admin/jobs" element={<List resource="jobs" />} />
          <Route path="/admin/jobs/new" element={<Editor resource="jobs" />} />
          <Route path="/admin/jobs/:id" element={<Editor resource="jobs" />} />
          <Route path="/admin/candidates" element={<List resource="candidates" />} />
          <Route path="/admin/candidates/:id" element={<Candidate />} />
          <Route path="/admin/applications" element={<List resource="applications" />} />
          <Route path="/admin/requirements" element={<List resource="requirements" />} />
          <Route path="/admin/ats" element={<AtsOverview />} />
          <Route path="/admin/ats/:candidateId" element={<Ats />} />
          <Route path="/admin/enquiries" element={<List resource="enquiries" />} />
          <Route path="/admin/insights" element={<List resource="insights" />} />
          <Route path="/admin/insights/new" element={<Editor resource="insights" />} />
          <Route path="/admin/insights/:id" element={<Editor resource="insights" />} />
          <Route path="/admin/stories" element={<List resource="stories" />} />
          <Route path="/admin/stories/new" element={<Editor resource="stories" />} />
          <Route path="/admin/expertise" element={<List resource="expertise" />} />
          <Route path="/admin/expertise/new" element={<Editor resource="expertise" />} />
          <Route path="/admin/services" element={<List resource="services" />} />
          <Route path="/admin/locations" element={<List resource="locations" />} />
          <Route path="/admin/settings" element={<Settings />} />
          <Route path="/admin/*" element={<NotFound />} />
        </Routes>
      </AdminLayout>
    </AdminStoreProvider>
  );
}
