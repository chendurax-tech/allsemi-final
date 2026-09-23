import React, { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import Hero from '../components/Hero.jsx';
import Connecting from '../components/Connecting.jsx';
import Services from '../components/Services.jsx';
import ExpertiseBands from '../components/ExpertiseBands.jsx';
import Stories from '../components/Stories.jsx';
import Insights from '../components/Insights.jsx';
import Facts from '../components/Facts.jsx';
import Enquiry from '../components/Enquiry.jsx';
import { useReveal, useReactiveLetters } from '../lib/useReveal.js';

/*
  Landing - the existing, already-approved single-page experience,
  unchanged in content, layout, animation or visual design. Moved into
  its own route component so it renders at "/" instead of being the
  entire application.

  useReveal/useReactiveLetters are called HERE rather than at the
  application root: both hooks query the DOM once on mount for
  landing-page-only classes (.reveal, .reactive-title). Now that the
  app has routes, this component mounts and unmounts as the visitor
  navigates to and from "/", so the hooks need to live where they will
  correctly re-run on every mount - this is the one adjustment routing
  made necessary; the hooks' own implementation is untouched.

  The hash-scroll effect below is the other routing-era adjustment:
  React Router changes the URL hash on navigation but does not scroll
  to it the way a full page load does. Every "Get in Touch" link in
  the app now points at "/#enquiry" (the canonical, single enquiry
  section - no more separate /contact page), so this scrolls there
  whenever the hash is present, whether arriving fresh from another
  page or already on "/".
*/
export default function Landing({ activeSector, setActiveSector, pulseKey }) {
  useReveal();
  useReactiveLetters();
  const location = useLocation();

  useEffect(() => {
    document.title = 'ALLSEMI | Talent. Engineered.';
  }, []);

  useEffect(() => {
    if (location.hash !== '#enquiry') return;
    let cancelled = false;
    function scrollToEnquiry() {
      if (cancelled) return;
      const el = document.getElementById('enquiry');
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    // A fresh mount of Landing (arriving from another page) still has
    // images, the Hero video, and ChipSequence's layout settling, which
    // can shift the page height right after the first scroll fires. One
    // immediate attempt plus a corrective follow-up after things settle
    // covers both that case and the already-on-"/" case (which needs no
    // correction, so the second call is a no-op there).
    scrollToEnquiry();
    const settle = setTimeout(scrollToEnquiry, 400);
    return () => { cancelled = true; clearTimeout(settle); };
  }, [location.hash]);

  return (
    <>
      <Hero />
      <Connecting />
      <Services />
      <ExpertiseBands activeSector={activeSector} setActiveSector={setActiveSector} pulseKey={pulseKey} />
      <Stories />
      <Insights />
      <Facts />
      <Enquiry />
    </>
  );
}
