import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useInView, MeasurementLabel, TechnicalGrid, prefersReducedMotion } from '../lib/motionPrimitives.jsx';

/*
  RecruitmentActions - the three primary recruitment journeys (Hire
  Talent, Find Your Role, Refer A Talent), rebuilt as a signal-network
  diagram rather than three plain columns. Sits AFTER the landing page
  Hero, once the ALLSEMI mask and "Talent. Engineered." statement have
  had their moment: HERO -> RECRUITMENT NETWORK -> rest of the page.

  The visual is a small engineering schematic: the ALLSEMI mark sits as
  a single source node at the top, a stem drops to a shared bus, and
  the bus branches into the three pathways below it - one shared
  network, three ways to connect to it, rather than three unrelated
  buttons. By default all three read as one connected system (idle
  node glow, static traces). Hovering/focusing one pathway sends a
  small pulse travelling from the source node down into that pathway,
  brightens its node/title, reveals a line of supporting copy and a
  small identity graphic, and quiets the other two.

  Desktop/tablet: the branching diagram described above.
  Mobile: not a squeezed version of it - a single vertical signal
  chain (ALLSEMI -> node -> 01 -> node -> 02 -> node -> 03), each
  pathway a full-width tappable row.
*/

const ACTIONS = [
  {
    to: '/employers',
    num: '01',
    title: 'Hire Talent',
    copy: 'Build the engineering team behind your next tape-out.',
    color: 'accent',
  },
  {
    to: '/talent',
    num: '02',
    title: 'Find Your Role',
    copy: 'Find your next engineering opportunity in semiconductor and beyond.',
    color: 'turquoise',
  },
  {
    to: '/refer',
    num: '03',
    title: 'Refer A Talent',
    copy: 'Connect an engineer in your network to ALLSEMIS.',
    color: 'blend',
  },
];

const HEX = { accent: '#a78bfa', turquoise: '#2dd4bf', blend: '#c084fc' };
const TEXT_COLOR = {
  accent: 'group-hover:text-accent group-focus-visible:text-accent',
  turquoise: 'group-hover:text-turquoise group-focus-visible:text-turquoise',
  blend: 'group-hover:text-accent-2 group-focus-visible:text-accent-2',
};
const STATIC_COLOR = {
  accent: 'text-accent',
  turquoise: 'text-turquoise',
  blend: 'text-accent-2',
};
const SIGNAL_CLASS = ['signal-travel-0', 'signal-travel-1', 'signal-travel-2'];

function ActionArrow({ className = '' }) {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M5 12h13M13 6l6 6-6 6" />
    </svg>
  );
}

/* Small per-pathway identity graphics - decorative, hand-drawn to fit
   the site's own circuit/engineering register rather than stock icons. */
function HireGraphic({ className = '' }) {
  return (
    <svg viewBox="0 0 32 32" width="28" height="28" className={className} aria-hidden="true">
      <g fill="none" stroke="currentColor" strokeWidth="1.4">
        <path d="M16 9v7M16 16 9 21M16 16l7 5" strokeLinecap="round" />
        <circle cx="16" cy="6.5" r="2.5" />
        <circle cx="7" cy="24" r="2.5" />
        <circle cx="25" cy="24" r="2.5" />
      </g>
    </svg>
  );
}
function FindGraphic({ className = '' }) {
  return (
    <svg viewBox="0 0 32 32" width="28" height="28" className={className} aria-hidden="true">
      <g fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
        <path d="M6 25 13 17 18 21 26 10" />
        <path d="M20 10h6v6" />
        <circle cx="6" cy="25" r="1.6" fill="currentColor" stroke="none" />
      </g>
    </svg>
  );
}
function ReferGraphic({ className = '' }) {
  return (
    <svg viewBox="0 0 32 32" width="28" height="28" className={className} aria-hidden="true">
      <g fill="none" stroke="currentColor" strokeWidth="1.4">
        <circle cx="7" cy="16" r="3.2" />
        <circle cx="25" cy="16" r="3.2" />
        <path d="M10.2 16h8.6M15 12.8l3.8 3.2-3.8 3.2" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </svg>
  );
}
const GRAPHICS = [HireGraphic, FindGraphic, ReferGraphic];

export default function RecruitmentActions() {
  const [ref, inView] = useInView(0.15);
  const [active, setActive] = useState(null);
  const reduce = prefersReducedMotion();

  return (
    <section
      ref={(el) => { ref.current = el; }}
      aria-label="ALLSEMIS recruitment network"
      className="relative border-b border-line bg-bg-raised/40 py-14 md:py-20 overflow-hidden"
    >
      <TechnicalGrid className="opacity-[0.04]" />

      <div className={`relative max-w-5xl mx-auto px-5 md:px-10 text-center mb-8 md:mb-10 transition-opacity duration-700 motion-reduce:transition-none ${inView ? 'opacity-100' : 'opacity-0'}`}>
        <MeasurementLabel>ALLSEMI / Recruitment Network</MeasurementLabel>
        <h2 className="mt-3 font-display font-semibold text-2xl md:text-3xl tracking-tight">
          One network. Three ways in.
        </h2>
      </div>

      {/* Desktop / tablet: branching signal diagram */}
      <div className={`hidden md:block relative max-w-4xl mx-auto px-5 md:px-10 transition-opacity duration-700 delay-150 motion-reduce:transition-none ${inView ? 'opacity-100' : 'opacity-0'}`}>
        {/* Source node - the ALLSEMIS logo video, the brand anchor of the
            diagram. 84px (1.5x its earlier 56px); it is centred by the
            same flex column the stem below hangs from, so it stays on
            the network's vertical axis at any size. */}
        <div className="relative flex flex-col items-center">
          <div className="relative w-[84px] h-[84px] rounded-full border border-line-strong bg-bg overflow-hidden">
            <div className="absolute -inset-2 rounded-full bg-accent/20 signal-node-idle motion-reduce:hidden" aria-hidden="true" />
            <video
              className="absolute inset-0 w-full h-full object-cover motion-reduce:hidden"
              src="/allsemi-logo-signal.mp4"
              poster="/allsemi-logo-signal-poster.jpg"
              autoPlay
              muted
              loop
              playsInline
              aria-hidden="true"
            />
            <img
              src="/allsemi-logo-signal-poster.jpg"
              alt=""
              aria-hidden="true"
              className="hidden motion-reduce:block absolute inset-0 w-full h-full object-cover"
            />
          </div>
          <span className="mt-3 font-mono text-[0.6rem] uppercase tracking-[0.2em] text-text-faint">
            Allsemi Network
          </span>
        </div>

        {/* Connector zone: stem + bus + drops + traveling pulse */}
        <div className="relative h-16" aria-hidden="true">
          {/* stem from source down to bus */}
          <span className="absolute left-1/2 top-0 -translate-x-1/2 w-px h-1/2 bg-line-strong" />
          {/* bus spanning the three columns */}
          <span className="absolute left-[16.666%] right-[16.666%] top-1/2 h-px bg-line-strong" />
          {/* drops into each column */}
          <span className="absolute left-[16.666%] top-1/2 -translate-x-1/2 w-px h-1/2 bg-line-strong" />
          <span className="absolute left-1/2 top-1/2 -translate-x-1/2 w-px h-1/2 bg-line-strong" />
          <span className="absolute left-[83.333%] top-1/2 -translate-x-1/2 w-px h-1/2 bg-line-strong" />

          {active !== null && !reduce && (
            <span
              key={`pulse-${active}`}
              className={`absolute w-1.5 h-1.5 -ml-[3px] -mt-[3px] rounded-full shadow-[0_0_6px_currentColor] ${SIGNAL_CLASS[active]}`}
              style={{ color: HEX[ACTIONS[active].color] }}
            />
          )}
        </div>

        {/* Three pathways */}
        <div className="grid grid-cols-3">
          {ACTIONS.map((a, i) => {
            const isActive = active === i;
            const dimmed = active !== null && !isActive;
            const Graphic = GRAPHICS[i];
            return (
              <Link
                key={a.to}
                to={a.to}
                onMouseEnter={() => setActive(i)}
                onMouseLeave={() => setActive(null)}
                onFocus={() => setActive(i)}
                onBlur={() => setActive(null)}
                className={`group relative flex flex-col items-center text-center px-3 pt-1 pb-6 transition-opacity duration-300 ${dimmed ? 'opacity-40' : 'opacity-100'}`}
              >
                <span className="relative flex items-center justify-center w-4 h-4">
                  <span
                    className={`absolute inset-0 rounded-full signal-node-idle motion-reduce:hidden ${isActive ? '' : 'opacity-60'}`}
                    style={{ backgroundColor: `${HEX[a.color]}33` }}
                  />
                  <span
                    className="relative w-2 h-2 rounded-full border transition-all duration-300"
                    style={{
                      backgroundColor: isActive ? HEX[a.color] : 'transparent',
                      borderColor: HEX[a.color],
                      boxShadow: isActive ? `0 0 10px ${HEX[a.color]}` : 'none',
                    }}
                  />
                </span>

                <span className={`mt-3 font-mono text-[0.62rem] uppercase tracking-[0.2em] text-text-faint transition-colors ${TEXT_COLOR[a.color]}`}>
                  Network / {a.num}
                </span>

                <Graphic className={`mt-3 text-text-faint transition-colors ${TEXT_COLOR[a.color]}`} />

                <span className="mt-3 flex items-center gap-1.5">
                  <span className={`font-display font-semibold text-lg lg:text-xl tracking-tight text-text transition-colors ${TEXT_COLOR[a.color]}`}>
                    {a.title}
                  </span>
                  <ActionArrow
                    className={`text-text-faint -translate-x-1 opacity-0 group-hover:opacity-100 group-hover:translate-x-0 group-focus-visible:opacity-100 group-focus-visible:translate-x-0 transition-all duration-300 ${TEXT_COLOR[a.color]}`}
                  />
                </span>

                <span
                  className={`block mt-2 text-xs text-text-dim max-w-[15rem] overflow-hidden transition-all duration-300 ease-out ${
                    isActive ? 'max-h-10 opacity-100' : 'max-h-0 opacity-0'
                  }`}
                >
                  {a.copy}
                </span>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Mobile: vertical signal chain - its own composition, not a squeezed diagram */}
      <div className={`md:hidden relative max-w-md mx-auto px-5 transition-opacity duration-700 motion-reduce:transition-none ${inView ? 'opacity-100' : 'opacity-0'}`}>
        <div className="flex flex-col items-center">
          {/* 72px (1.5x its earlier 48px) */}
          <div className="relative w-[72px] h-[72px] rounded-full border border-line-strong bg-bg overflow-hidden">
            <video
              className="absolute inset-0 w-full h-full object-cover motion-reduce:hidden"
              src="/allsemi-logo-signal.mp4"
              poster="/allsemi-logo-signal-poster.jpg"
              autoPlay
              muted
              loop
              playsInline
              aria-hidden="true"
            />
            <img
              src="/allsemi-logo-signal-poster.jpg"
              alt=""
              aria-hidden="true"
              className="hidden motion-reduce:block absolute inset-0 w-full h-full object-cover"
            />
          </div>
          <span className="mt-3 font-mono text-[0.6rem] uppercase tracking-[0.2em] text-text-faint">
            Allsemi Network
          </span>
          <span className="w-px h-6 bg-line-strong mt-2" aria-hidden="true" />
        </div>

        {ACTIONS.map((a, i) => {
          const Graphic = GRAPHICS[i];
          return (
            <div key={a.to} className="flex flex-col items-center">
              <Link
                to={a.to}
                className="group w-full flex items-center gap-4 py-4 active:bg-bg-raised transition-colors"
              >
                <span className="relative shrink-0 flex items-center justify-center w-9 h-9 rounded-full border" style={{ borderColor: HEX[a.color] }}>
                  <Graphic className={STATIC_COLOR[a.color]} />
                </span>
                <span className="flex-1 min-w-0">
                  <span className="flex items-baseline gap-2">
                    <span className="font-mono text-[0.6rem] uppercase tracking-[0.2em] text-text-faint">{a.num}</span>
                    <span className={`font-display font-semibold text-base ${STATIC_COLOR[a.color]}`}>{a.title}</span>
                  </span>
                  <span className="block text-xs text-text-dim mt-0.5">{a.copy}</span>
                </span>
                <ActionArrow className="text-text-faint shrink-0 group-active:translate-x-0.5 transition-transform" />
              </Link>
              {i < ACTIONS.length - 1 && (
                <span className="w-px h-6 bg-line-strong" aria-hidden="true" />
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
