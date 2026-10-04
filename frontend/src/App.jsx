import React, { useState, Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Header from './components/Header.jsx';
import Footer from './components/Footer.jsx';
import ScrollToTop from './components/ScrollToTop.jsx';
import Landing from './pages/Landing.jsx';
import Contact from './pages/Contact.jsx';
import Refer from './pages/Refer.jsx';
import Employers from './pages/employers/Employers.jsx';
import ServicePage from './pages/employers/ServicePage.jsx';
import { publishedServices } from './pages/employers/servicesContent.js';
import Talent from './pages/talent/Talent.jsx';
import JobDetail from './pages/talent/JobDetail.jsx';
import About from './pages/about/About.jsx';
import InsightsIndex from './pages/insights/InsightsIndex.jsx';
import InsightDetail from './pages/insights/InsightDetail.jsx';
import ExpertiseIndex from './pages/expertise/ExpertiseIndex.jsx';
import SectorPage from './pages/expertise/SectorPage.jsx';
import { SECTORS } from './components/Expertise.jsx';
import { EXPERTISE_SLUGS, EXPERTISE_LEGACY_SLUGS } from './lib/expertiseRoutes.js';

// The admin panel is loaded only when an /admin route is opened, so its
// code never weighs on the public site's bundle.
const AdminApp = lazy(() => import('./admin/AdminApp.jsx'));

/*
  App - the routing root.

  The landing page (Hero, RecruitmentActions, Connecting, Services,
  ExpertiseBands, Stories, Insights, Facts, and the closing engineering-
  network/location section) lives in pages/Landing.jsx so it can render
  at "/" instead of being the whole application. The detailed contact
  interaction lives only on pages/Contact.jsx ("/contact"). Header and
  Footer stay mounted across every route, exactly as before.

  As of Phase 5, every top-level route (Employers, Talent, Expertise +
  8 sectors, Insights + article detail, About) is a real, finished
  page. No ComingSoon placeholders remain.

  activeSector stays owned here so the landing page's ExpertiseBands
  keeps its own hover-preview state working exactly as before. Header
  no longer needs it: sector navigation (dropdown, mobile accordion,
  and clicking an ExpertiseBands column/slide) now always routes
  straight to that sector's own page rather than activating something
  in-page. pulseKey is kept (currently idle) purely so ExpertiseBands'
  prop contract doesn't need touching.

  /admin routes render the admin panel with its own chrome (no public
  Header/Footer). Every other route renders the public site exactly as
  before. The three service pages (/employers/:slug) are generated from
  servicesContent.js, the same way the sector routes are generated from
  SECTORS.
*/
export default function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <AppShell />
    </BrowserRouter>
  );
}

function AppShell() {
  const [activeSector, setActiveSector] = useState(SECTORS[0].id);
  const [pulseKey] = useState(null);
  const { pathname } = useLocation();

  if (pathname === '/admin' || pathname.startsWith('/admin/')) {
    return (
      <Suspense fallback={<div className="bg-bg min-h-screen" />}>
        <AdminApp />
      </Suspense>
    );
  }

  return (
      <div className="bg-bg text-text font-body min-h-screen">
        <Header />
        <main>
          <Routes>
            <Route
              path="/"
              element={<Landing activeSector={activeSector} setActiveSector={setActiveSector} pulseKey={pulseKey} />}
            />
            <Route path="/employers" element={<Employers />} />
            {publishedServices().map(s => (
              <Route
                key={s.slug}
                path={`/employers/${s.slug}`}
                element={<ServicePage slug={s.slug} />}
              />
            ))}
            <Route path="/talent" element={<Talent />} />
            <Route path="/talent/jobs/:slug" element={<JobDetail />} />
            <Route path="/expertise" element={<ExpertiseIndex />} />
            {SECTORS.map(s => (
              <Route
                key={s.id}
                path={`/expertise/${EXPERTISE_SLUGS[s.id]}`}
                element={<SectorPage sectorId={s.id} />}
              />
            ))}
            {/* Old sector URLs redirect to the page that now covers them. */}
            {Object.entries(EXPERTISE_LEGACY_SLUGS).map(([from, to]) => (
              <Route
                key={from}
                path={`/expertise/${from}`}
                element={<Navigate to={`/expertise/${to}`} replace />}
              />
            ))}
            <Route path="/insights" element={<InsightsIndex />} />
            <Route path="/insights/:slug" element={<InsightDetail />} />
            <Route path="/about" element={<About />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/refer" element={<Refer />} />
          </Routes>
        </main>
        <Footer />
      </div>
  );
}
