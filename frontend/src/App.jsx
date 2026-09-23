import React, { useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Header from './components/Header.jsx';
import Footer from './components/Footer.jsx';
import Landing from './pages/Landing.jsx';
import Contact from './pages/Contact.jsx';
import Employers from './pages/employers/Employers.jsx';
import Talent from './pages/talent/Talent.jsx';
import About from './pages/about/About.jsx';
import InsightsIndex from './pages/insights/InsightsIndex.jsx';
import InsightDetail from './pages/insights/InsightDetail.jsx';
import ExpertiseIndex from './pages/expertise/ExpertiseIndex.jsx';
import SectorPage from './pages/expertise/SectorPage.jsx';
import { SECTORS } from './components/Expertise.jsx';
import { EXPERTISE_SLUGS } from './lib/expertiseRoutes.js';

/*
  App - the routing root.

  The existing landing page (Hero, Connecting, Services, ExpertiseBands,
  Stories, Insights, Facts, Enquiry) is completely unchanged in content
  and design; it has only been moved into pages/Landing.jsx so it can
  render at "/" instead of being the whole application. Header and
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
*/
export default function App() {
  const [activeSector, setActiveSector] = useState(SECTORS[0].id);
  const [pulseKey] = useState(null);

  return (
    <BrowserRouter>
      <div className="bg-bg text-text font-body min-h-screen">
        <Header />
        <main>
          <Routes>
            <Route
              path="/"
              element={<Landing activeSector={activeSector} setActiveSector={setActiveSector} pulseKey={pulseKey} />}
            />
            <Route path="/employers" element={<Employers />} />
            <Route path="/talent" element={<Talent />} />
            <Route path="/expertise" element={<ExpertiseIndex />} />
            {SECTORS.map(s => (
              <Route
                key={s.id}
                path={`/expertise/${EXPERTISE_SLUGS[s.id]}`}
                element={<SectorPage sectorId={s.id} />}
              />
            ))}
            <Route path="/insights" element={<InsightsIndex />} />
            <Route path="/insights/:slug" element={<InsightDetail />} />
            <Route path="/about" element={<About />} />
            <Route path="/contact" element={<Contact />} />
          </Routes>
        </main>
        <Footer />
      </div>
    </BrowserRouter>
  );
}
