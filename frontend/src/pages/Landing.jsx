import React, { useEffect } from 'react';
import Hero from '../components/Hero.jsx';
import RecruitmentActions from '../components/RecruitmentActions.jsx';
import Connecting from '../components/Connecting.jsx';
import Services from '../components/Services.jsx';
import ExpertiseBands from '../components/ExpertiseBands.jsx';
import Stories from '../components/Stories.jsx';
import Insights from '../components/Insights.jsx';
import Facts from '../components/Facts.jsx';
import OfficeNetwork from '../components/OfficeNetwork.jsx';
import { useReveal, useReactiveLetters } from '../lib/useReveal.js';

/*
  Landing - the existing, already-approved single-page experience.
  Moved into its own route component so it renders at "/" instead of
  being the entire application.

  useReveal/useReactiveLetters are called HERE rather than at the
  application root: both hooks query the DOM once on mount for
  landing-page-only classes (.reveal, .reactive-title). Now that the
  app has routes, this component mounts and unmounts as the visitor
  navigates to and from "/", so the hooks need to live where they will
  correctly re-run on every mount - this is the one adjustment routing
  made necessary; the hooks' own implementation is untouched.

  FINAL architecture (per the latest brief): the landing page closes
  with ONLY the engineering-network/location visual (OfficeNetwork,
  the same map/data implementation shared with About and Contact, with
  landing-specific copy) and a single "Get in Touch" CTA to /contact.
  It does NOT contain the detailed "how can we help you" interaction -
  that lives only on /contact now. The previous large Enquiry component
  has been removed from the landing page entirely (it was only ever
  used here, so it was safe to delete outright rather than leave
  orphaned).
*/
export default function Landing({ activeSector, setActiveSector, pulseKey }) {
  useReveal();
  useReactiveLetters();

  useEffect(() => {
    document.title = 'ALLSEMIS | Talent. Engineered.';
  }, []);

  return (
    <>
      <Hero />
      <RecruitmentActions />
      <Connecting />
      <Services />
      <ExpertiseBands activeSector={activeSector} setActiveSector={setActiveSector} pulseKey={pulseKey} />
      <Stories />
      <Insights />
      <Facts />
      <OfficeNetwork
        id="location"
        eyebrow="Engineering Network"
        heading={<>Bengaluru is our <span className="gradient-text">active node.</span></>}
        intro="ALLSEMIS operates from Bengaluru today, built as part of a wider engineering network structured to extend into new regions as it grows."
        cta={{ to: '/contact', label: 'Get in Touch' }}
      />
    </>
  );
}
