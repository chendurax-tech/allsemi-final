import React, { useState, useEffect, useLayoutEffect, Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Header from './components/Header.jsx';
import Footer from './components/Footer.jsx';
import ScrollToTop from './components/ScrollToTop.jsx';
import Landing from './pages/Landing.jsx';
import NotFound from './pages/NotFound.jsx';
import { EXPERTISE_LEGACY_SLUGS } from './lib/expertiseRoutes.js';
import { syncThemeArea } from './lib/theme.js';

// The admin panel is loaded only when an /admin route is opened, so its
// code never weighs on the public site's bundle.
const AdminApp = lazy(() => import('./admin/AdminApp.jsx'));

// The landing page is in the first download. Every other page is its
// own file, fetched when it is opened, and fetched ahead in the
// background once the first page has loaded (prefetchPages), so moving
// between pages does not wait for the network.
const PAGES = {
  Contact: () => import('./pages/Contact.jsx'),
  Refer: () => import('./pages/Refer.jsx'),
  Employers: () => import('./pages/employers/Employers.jsx'),
  ServicePage: () => import('./pages/employers/ServicePage.jsx'),
  Talent: () => import('./pages/talent/Talent.jsx'),
  JobDetail: () => import('./pages/talent/JobDetail.jsx'),
  About: () => import('./pages/about/About.jsx'),
  InsightsIndex: () => import('./pages/insights/InsightsIndex.jsx'),
  InsightDetail: () => import('./pages/insights/InsightDetail.jsx'),
  ExpertiseIndex: () => import('./pages/expertise/ExpertiseIndex.jsx'),
  SectorPage: () => import('./pages/expertise/SectorPage.jsx'),
};
const Contact = lazy(PAGES.Contact);
const Refer = lazy(PAGES.Refer);
const Employers = lazy(PAGES.Employers);
const ServicePage = lazy(PAGES.ServicePage);
const Talent = lazy(PAGES.Talent);
const JobDetail = lazy(PAGES.JobDetail);
const About = lazy(PAGES.About);
const InsightsIndex = lazy(PAGES.InsightsIndex);
const InsightDetail = lazy(PAGES.InsightDetail);
const ExpertiseIndex = lazy(PAGES.ExpertiseIndex);
const SectorPage = lazy(PAGES.SectorPage);
// The website assistant is not needed for the first paint.
const ChatWidget = lazy(() => import('./components/chat/ChatWidget.jsx'));

function whenIdle(task) {
  if (typeof window.requestIdleCallback === 'function') return window.requestIdleCallback(task, { timeout: 4000 });
  return window.setTimeout(task, 2500);
}

// After the page has loaded and the browser is idle: the other pages.
// Not on a connection that asks to save data.
let prefetched = false;
function prefetchPages() {
  if (prefetched || (navigator.connection && navigator.connection.saveData)) return;
  prefetched = true;
  const start = () => whenIdle(() => Object.values(PAGES).forEach((load) => load().catch(() => {})));
  if (document.readyState === 'complete') start();
  else window.addEventListener('load', start, { once: true });
}

// What a page shows for the moment its file is on the way: the space
// of a page, in the page colour, so the footer does not jump up.
const PAGE_PENDING = <div className="min-h-screen" aria-busy="true" />;

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
  before.

  Service pages (/employers/:slug) and sector pages (/expertise/:slug)
  are matched by slug. Each page looks its record up in the published
  list the backend returns, so a slug changed in the admin works at
  once and an unpublished or unknown slug shows the page's own
  not-found state. activeSector starts empty and is set by
  ExpertiseBands once the sectors have loaded.
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
  const [activeSector, setActiveSector] = useState(null);
  const [pulseKey] = useState(null);
  const { pathname } = useLocation();
  const isAdmin = pathname === '/admin' || pathname.startsWith('/admin/');

  // The admin keeps its own light/dark choice; the public site is always dark.
  useLayoutEffect(() => syncThemeArea(isAdmin), [isAdmin]);

  useEffect(() => {
    if (!isAdmin) prefetchPages();
  }, [isAdmin]);

  if (isAdmin) {
    return (
      <Suspense fallback={<div className="bg-bg min-h-screen" />}>
        <AdminApp />
      </Suspense>
    );
  }

  return (
      <div className="bg-bg text-text font-body min-h-screen">
        <Header />
        {/* At least a screen tall, so while a page is still loading its
            content the footer stays below the fold and does not jump
            down when the content arrives. */}
        <main className="min-h-screen">
          <Suspense fallback={PAGE_PENDING}>
          <Routes>
            <Route
              path="/"
              element={<Landing activeSector={activeSector} setActiveSector={setActiveSector} pulseKey={pulseKey} />}
            />
            <Route path="/employers" element={<Employers />} />
            <Route path="/employers/:slug" element={<ServicePage />} />
            <Route path="/talent" element={<Talent />} />
            <Route path="/talent/jobs/:slug" element={<JobDetail />} />
            <Route path="/expertise" element={<ExpertiseIndex />} />
            {/* Old sector URLs redirect to the page that now covers them.
                They are listed before the :slug route's turn comes
                because a fixed path always wins over a parameter. */}
            {Object.entries(EXPERTISE_LEGACY_SLUGS).map(([from, to]) => (
              <Route
                key={from}
                path={`/expertise/${from}`}
                element={<Navigate to={`/expertise/${to}`} replace />}
              />
            ))}
            <Route path="/expertise/:slug" element={<SectorPage />} />
            <Route path="/insights" element={<InsightsIndex />} />
            <Route path="/insights/:slug" element={<InsightDetail />} />
            <Route path="/about" element={<About />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/refer" element={<Refer />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
          </Suspense>
        </main>
        <Footer />
        {/* The website assistant: public pages only, never the admin. */}
        <Suspense fallback={null}><ChatWidget /></Suspense>
      </div>
  );
}
