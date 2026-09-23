import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { SECTORS } from './Expertise.jsx';
import { EXPERTISE_SLUGS } from '../lib/expertiseRoutes.js';

/*
  ExpertiseBands - horizontal 8-column industry canvas.

  Desktop (md+, >=768px): one continuous flex row, fixed height. Sector
  01 is expanded (40% width) on first render by default; hovering a
  column transfers the expansion to it while the other 7 share the
  remaining 60% (~8.57% each) - width transitions only, no vertical
  movement, no card styling, no rail, no panel. The active state
  persists after the pointer leaves the canvas and transfers smoothly
  when a different column is hovered - this is deliberately not an
  accordion. The md breakpoint (not lg) is used because the canvas
  still reads cleanly with real available width down to 768px; below
  that, text would start to cramp, so mobile takes over there instead.

  Mobile (<768px): a horizontal snap-scroll sequence of dominant,
  purpose-built slides (82vw each, so neighbors peek at the edges) -
  normal scrolling, no scroll-jacking. Whichever slide is centered
  becomes active via IntersectionObserver, driving the same
  grayscale -> color reveal. This is a distinct mobile presentation,
  not the desktop columns compressed down.

  Independent file, reusing only the SECTORS data from Expertise.jsx
  (which remains completely untouched as the shipped fallback).
*/

// Desktop column gap (px). 7 gaps between 8 columns; column widths are
// computed as a percentage of (100% - total gap width), so the gaps
// are never additive on top of the row's own width - the row always
// sums to exactly 100% of its container, active state or not.
const GAP_PX = 6;
const GAP_COUNT = 7;

const ART = {
  semiconductor: { position: '50% 45%' },
  'ai-infrastructure': { position: '30% 50%' },
  automotive: { position: '50% 60%' },
  aerospace: { position: '50% 30%' },
  'business-finance': { position: '50% 40%' },
  'banking-fintech': { position: '65% 50%' },
  'consumer-retail': { position: '50% 55%' },
  healthcare: { position: '40% 45%' },
};

function ExploreMark({ className = '' }) {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M5 12h13M13 6l6 6-6 6" />
    </svg>
  );
}

// Extremely restrained inspection/measurement detail, semiconductor
// column only. Low opacity, no glow, no HUD styling.
function InspectionDetail() {
  return (
    <svg
      viewBox="0 0 260 60"
      className="absolute left-4 top-16 w-[170px] h-auto pointer-events-none opacity-0 expertise-band-detail-in"
      aria-hidden="true"
    >
      <line x1="0" y1="30" x2="260" y2="30" stroke="#e9d9ff" strokeOpacity="0.35" strokeWidth="1" />
      <line x1="0" y1="22" x2="0" y2="38" stroke="#e9d9ff" strokeOpacity="0.45" strokeWidth="1" />
      <line x1="260" y1="22" x2="260" y2="38" stroke="#e9d9ff" strokeOpacity="0.45" strokeWidth="1" />
      <text x="0" y="14" fill="#e9d9ff" fillOpacity="0.4" fontSize="8" fontFamily="monospace" letterSpacing="1.5">
        DIE INSPECTION
      </text>
    </svg>
  );
}

export default function ExpertiseBands({ activeSector: activeSectorProp, setActiveSector: setActiveSectorProp, pulseKey, embedded = false, heightClass } = {}) {
  const [internalActive, setInternalActive] = useState(SECTORS[0].id);
  const [pulsingId, setPulsingId] = useState(null);
  const isControlled = activeSectorProp !== undefined && setActiveSectorProp !== undefined;
  const activeId = isControlled ? activeSectorProp : internalActive;
  const setActiveId = isControlled ? setActiveSectorProp : setInternalActive;
  const navigate = useNavigate();
  const canvasHeight = heightClass || (embedded ? 'h-[420px] md:h-[460px]' : 'h-[520px]');

  const pulseTimeout = useRef(null);
  const mobileTrackRef = useRef(null);
  const slideRefs = useRef({});

  function activate(id) {
    setActiveId(id);
  }

  // Clicking (not hovering) commits to that sector's dedicated page.
  // Hover/activate above is unchanged - it only ever previews/expands
  // the column. This is the one addition needed to fix "clicking a
  // band does nothing".
  function goToSector(id) {
    navigate(`/expertise/${EXPERTISE_SLUGS[id]}`);
  }

  // A dropdown selection (pulseKey change) scrolls the matching mobile
  // slide into view and pulses the matching desktop column.
  useEffect(() => {
    if (pulseKey === undefined || pulseKey === null) return;
    setPulsingId(activeId);
    const mobileSlide = slideRefs.current[activeId];
    if (mobileSlide) mobileSlide.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
    clearTimeout(pulseTimeout.current);
    pulseTimeout.current = setTimeout(() => setPulsingId(null), 1100);
    return () => clearTimeout(pulseTimeout.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pulseKey]);

  // Mobile: whichever slide is most centered in the scroll track
  // becomes active, via IntersectionObserver (no scroll-jacking, just
  // reading normal scroll position).
  useEffect(() => {
    const track = mobileTrackRef.current;
    if (!track) return;
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter(e => e.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible[0]) {
          const id = visible[0].target.getAttribute('data-sector-id');
          setActiveId(id);
        }
      },
      { root: track, threshold: [0.5, 0.6, 0.7, 0.8] }
    );
    Object.values(slideRefs.current).forEach(el => el && io.observe(el));
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const canvas = (
    <>
      {/* ============ DESKTOP: one continuous 8-column row ============ */}
      <div className="hidden md:block max-w-7xl mx-auto px-5 md:px-10">
        <div className={`flex gap-1.5 ${canvasHeight} border border-line overflow-hidden`}>
          {SECTORS.map((s) => {
            const isActive = activeId === s.id;
            const widthPct = isActive ? 40 : 60 / 7;
            const showLabel = widthPct >= 11;
            const art = ART[s.id] || { position: '50% 50%' };
            return (
              <div
                key={s.id}
                role="button"
                tabIndex={0}
                aria-pressed={isActive}
                onMouseEnter={() => activate(s.id)}
                onFocus={() => activate(s.id)}
                onClick={() => goToSector(s.id)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); goToSector(s.id); } }}
                style={{ width: `calc((100% - ${GAP_PX * GAP_COUNT}px) * ${widthPct / 100})` }}
                className="group/col relative h-full overflow-hidden cursor-pointer transition-[width] duration-500 ease-[cubic-bezier(.16,.8,.24,1)]"
              >
                <img
                  src={s.image}
                  alt={s.alt}
                  loading={s.num <= '02' ? 'eager' : 'lazy'}
                  style={{ objectPosition: art.position }}
                  className={`absolute inset-0 w-full h-full object-cover transition-all duration-700 ease-out ${
                    isActive ? 'grayscale-0 scale-105' : 'grayscale scale-100'
                  }`}
                />

                <div className={`absolute inset-0 transition-opacity duration-500 ${
                  isActive
                    ? 'bg-gradient-to-t from-bg via-bg/55 to-bg/10'
                    : 'bg-gradient-to-t from-bg/90 via-bg/25 to-bg/10'
                }`} />

                <div className="relative z-10 h-full flex flex-col justify-between p-4 md:p-5">
                  <span className={`font-mono text-accent transition-all duration-500 ${isActive ? 'text-sm' : 'text-xs'}`}>
                    {s.num}
                  </span>

                  <div>
                    {!isActive && showLabel && (
                      <span className="block font-mono text-[0.65rem] uppercase tracking-wide text-text-dim">
                        {s.shortName}
                      </span>
                    )}

                    {isActive && (
                      <>
                        <h3 className="font-display font-bold text-2xl xl:text-3xl leading-tight mb-2">
                          {s.name}
                        </h3>
                        <p className="text-text-dim text-sm leading-relaxed mb-3 max-w-xs">
                          {s.desc}
                        </p>
                        <span className="inline-flex items-center gap-1.5 text-accent text-xs font-mono uppercase tracking-widest">
                          Explore
                          <ExploreMark className="transition-transform duration-300 group-hover/col:translate-x-1" />
                        </span>
                        <span
                          key={`${s.id}-rule`}
                          className="block mt-3 h-0.5 w-16 bg-gradient-to-r from-accent to-accent-2 expertise-band-rule-in"
                        />
                      </>
                    )}
                  </div>
                </div>

                {s.id === 'semiconductor' && isActive && <InspectionDetail />}

                {pulsingId === s.id && (
                  <span key={pulseKey} className="absolute inset-0 pointer-events-none expertise-band-pulse" />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ============ MOBILE: dominant-slide sequence ============ */}
      <div className="md:hidden max-w-7xl mx-auto px-5">
        <div
          ref={mobileTrackRef}
          className="-mx-5 px-5 flex gap-4 overflow-x-auto snap-x snap-mandatory scrollbar-hide pb-3"
        >
          {SECTORS.map((s) => {
            const isActive = activeId === s.id;
            const art = ART[s.id] || { position: '50% 50%' };
            return (
              <div
                key={s.id}
                ref={(el) => { slideRefs.current[s.id] = el; }}
                data-sector-id={s.id}
                role="button"
                tabIndex={0}
                aria-pressed={isActive}
                onClick={() => goToSector(s.id)}
                className="relative shrink-0 w-[82vw] aspect-[3/4] snap-center overflow-hidden cursor-pointer"
              >
                <img
                  src={s.image}
                  alt={s.alt}
                  loading={s.num <= '02' ? 'eager' : 'lazy'}
                  style={{ objectPosition: art.position }}
                  className={`absolute inset-0 w-full h-full object-cover transition-all duration-700 ease-out ${
                    isActive ? 'grayscale-0 scale-105' : 'grayscale scale-100'
                  }`}
                />
                <div className={`absolute inset-0 transition-opacity duration-500 ${
                  isActive
                    ? 'bg-gradient-to-t from-bg via-bg/60 to-bg/10'
                    : 'bg-gradient-to-t from-bg/95 via-bg/35 to-bg/15'
                }`} />

                <div className="relative z-10 h-full flex flex-col justify-between p-6">
                  <span className={`font-mono text-accent transition-all duration-500 ${isActive ? 'text-base' : 'text-sm'}`}>
                    {s.num}
                  </span>

                  <div className={`transition-all duration-500 ${
                    isActive ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 pointer-events-none'
                  }`}>
                    <h3 className="font-display font-bold text-3xl leading-tight mb-3">
                      {s.name}
                    </h3>
                    <p className="text-text-dim text-base leading-relaxed mb-4 max-w-xs">
                      {s.desc}
                    </p>
                    <span className="inline-flex items-center gap-2 text-accent text-sm font-mono uppercase tracking-widest">
                      Explore
                      <ExploreMark />
                    </span>
                    <span
                      key={isActive ? `${s.id}-on` : `${s.id}-off`}
                      className={`block mt-3 h-0.5 bg-gradient-to-r from-accent to-accent-2 ${
                        isActive ? 'w-16 expertise-band-rule-in' : 'w-0'
                      }`}
                    />
                  </div>
                </div>

                {s.id === 'semiconductor' && isActive && <InspectionDetail />}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );

  if (embedded) {
    return canvas;
  }

  return (
    <section id="expertise" className="border-t border-line py-16 md:py-24 lg:py-32">
      <div className="max-w-7xl mx-auto px-5 md:px-10 mb-10 md:mb-14">
        <span className="block font-mono text-xs uppercase tracking-[0.22em] text-accent mb-4">
          02 / EXPERTISE
        </span>
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-accent mb-3">
          Where we work
        </p>
        <h2 className="font-display font-semibold text-4xl md:text-5xl lg:text-6xl tracking-tight leading-tight">
          Our expertise.
        </h2>
        <span className="block mt-6 w-20 h-0.5 bg-gradient-to-r from-accent to-accent-2 shadow-[0_0_12px_rgba(167,139,250,0.5)]" />
      </div>
      {canvas}
    </section>
  );
}
