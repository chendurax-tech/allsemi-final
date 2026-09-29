import React, { useState } from 'react';
import { useInView, MeasurementLabel } from '../lib/motionPrimitives.jsx';
import { activeLocations } from '../lib/officeLocations.js';
import { NetworkMap } from './OfficeNetwork.jsx';

/*
  EngineeringNetwork - a small, standalone location/network visual for
  the landing page: ALLSEMIS's node map with Bengaluru as the one
  bright, pulsing, labeled active node among many subdued decorative
  network points. It is a visual, not a section - no form, no route
  picker, no CTA - and it renders the exact same map as OfficeNetwork
  (About/Contact) via its exported <NetworkMap>, so there is one map
  implementation, not a second drifting copy.

  This is additive: it sits alongside the landing page's existing
  Enquiry section rather than replacing or absorbing it.
*/

const LOCATIONS = activeLocations();

export default function EngineeringNetwork() {
  const [ref, inView] = useInView(0.15);
  const [activeId, setActiveId] = useState(LOCATIONS[0]?.id ?? null);
  const [hoveredId, setHoveredId] = useState(null);

  return (
    <section
      ref={(el) => { ref.current = el; }}
      className="relative border-t border-line py-16 md:py-24 overflow-hidden"
    >
      <div className="max-w-4xl mx-auto px-5 md:px-10">
        <div className={`mb-8 md:mb-10 text-center transition-opacity duration-700 motion-reduce:transition-none ${inView ? 'opacity-100' : 'opacity-0'}`}>
          <MeasurementLabel className="block mb-4 text-center">Engineering Network</MeasurementLabel>
          <h2 className="font-display font-semibold text-2xl md:text-3xl tracking-tight">
            Bengaluru is our <span className="gradient-text">active node.</span>
          </h2>
        </div>

        <NetworkMap
          locations={LOCATIONS}
          activeId={activeId}
          hoveredId={hoveredId}
          onSelect={setActiveId}
          onHover={setHoveredId}
          inView={inView}
        />
      </div>
    </section>
  );
}
