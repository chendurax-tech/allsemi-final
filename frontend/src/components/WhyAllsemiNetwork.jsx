import React, { useState } from 'react';
import { useInView, MeasurementLabel, TechnicalGrid, prefersReducedMotion } from '../lib/motionPrimitives.jsx';

/*
  WhyAllsemiNetwork - "THE ENGINEERING TALENT NETWORK": the WHY ALLSEMIS
  section's five capabilities rendered as floating nodes on a signal
  network fanning out from a central ALLSEMIS hub, not as bordered
  cards or a grid. There is no rectangle anywhere around a capability -
  the network geometry (SVG traces/markers) and typography are the
  entire structure.

  Reuses the site's existing hub/node/signal-path visual language
  instead of inventing a new one: the same signal-node-idle keyframe
  used by OfficeNetwork's active-node ring, the same restrained
  "hover charges the path, a dot travels once" interaction already
  established by Contact.jsx's SignalConnection network, and the same
  MeasurementLabel / TechnicalGrid primitives used across the site.

  Desktop draws an SVG network (hub + 5 curved traces of varying
  length/angle + node markers) with an HTML overlay for the per-node
  number/title/description so that text can wrap naturally and stays
  in the accessibility tree at all times - hover/focus only changes
  emphasis (brighter path, brighter text), it never hides content.

  Mobile does not scale the desktop diagram down. It renders a
  dedicated vertical composition: the ALLSEMIS hub at the top of a
  single spine, the five capabilities stacked as nodes along it, each
  with its description shown directly underneath (no hover needed on
  a touch device).
*/

const VIEWBOX = '0 0 1000 640';
const HUB = { x: 500, y: 320 };

// An asymmetric fan of 5 cubic-curve traces from the hub, each a
// different length and angle so the composition reads as composed
// rather than a symmetric star.
const DESKTOP_NODES = [
  { x: 150, y: 120, path: 'M500,320 C 260,320 260,120 150,120', side: 'left' },
  { x: 590, y: 68, path: 'M500,320 C 540,320 540,68 590,68', side: 'right' },
  { x: 790, y: 260, path: 'M500,320 C 660,320 660,260 790,260', side: 'right' },
  { x: 220, y: 540, path: 'M500,320 C 320,320 320,540 220,540', side: 'left' },
  { x: 700, y: 560, path: 'M500,320 C 600,320 600,560 700,560', side: 'right' },
];

export default function WhyAllsemiNetwork({ reasons }) {
  const [ref, inView] = useInView(0.15);
  const [hoveredKey, setHoveredKey] = useState(null);
  const reduce = prefersReducedMotion();

  return (
    <div ref={(el) => { ref.current = el; }} className="relative">
      {/* ---------- desktop: the network ---------- */}
      <div className="hidden md:block relative mt-6">
        <div className="relative aspect-[1000/640] border border-line bg-bg-raised/20 overflow-hidden">
          <TechnicalGrid className="opacity-[0.05]" />
          <svg
            viewBox={VIEWBOX}
            className="absolute inset-0 w-full h-full"
            role="img"
            aria-label="ALLSEMIS engineering talent network: a central ALLSEMIS node connected to five capabilities"
          >
            <defs>
              <linearGradient id="whyGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#a78bfa" />
                <stop offset="100%" stopColor="#c084fc" />
              </linearGradient>
              <radialGradient id="whyHubGlow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#a78bfa" stopOpacity="0.32" />
                <stop offset="100%" stopColor="#a78bfa" stopOpacity="0" />
              </radialGradient>
            </defs>

            {/* quiet base traces, always visible so the network reads
                even before scroll-reveal finishes */}
            {DESKTOP_NODES.map((n, i) => (
              <path key={`base-${i}`} d={n.path} fill="none" stroke="rgba(237,239,240,0.1)" strokeWidth="1" />
            ))}

            {/* charged traces: fade in progressively on scroll (staggered
                by index - "draw outward" as a sequence), brighten on
                hover, quiet down when a sibling trace is hovered */}
            {DESKTOP_NODES.map((n, i) => {
              const reason = reasons[i];
              const isHovered = hoveredKey === reason.num;
              return (
                <path
                  key={`charged-${i}`}
                  d={n.path}
                  fill="none"
                  stroke="url(#whyGrad)"
                  strokeWidth={isHovered ? 2 : 1.3}
                  className="transition-all duration-500 motion-reduce:transition-none"
                  style={{
                    opacity: inView ? (isHovered ? 1 : hoveredKey ? 0.15 : 0.55) : 0,
                    transitionDelay: inView && !reduce ? `${260 + i * 150}ms` : '0ms',
                  }}
                />
              );
            })}

            {/* one-shot travelling signal per trace, staggered - plays
                once when the network first enters view, establishing
                "the hub is connected to every capability" */}
            {inView && DESKTOP_NODES.map((n, i) => (
              <circle
                key={`sig-${i}`}
                r="3.2"
                fill="var(--color-accent, #a78bfa)"
                className="signal-dot-play motion-reduce:hidden"
                style={{ offsetPath: `path('${n.path}')`, offsetRotate: '0deg', animationDelay: `${1000 + i * 170}ms` }}
              />
            ))}

            {/* node markers - a small open square (a die/package corner,
                not a card) at each capability's junction point */}
            {DESKTOP_NODES.map((n, i) => {
              const reason = reasons[i];
              const isHovered = hoveredKey === reason.num;
              return (
                <g
                  key={`marker-${i}`}
                  className="transition-opacity duration-500 motion-reduce:transition-none"
                  style={{ transform: `translate(${n.x}px, ${n.y}px)`, opacity: inView ? 1 : 0, transitionDelay: inView && !reduce ? `${340 + i * 150}ms` : '0ms' }}
                >
                  <rect
                    x="-6" y="-6" width="12" height="12"
                    fill="none"
                    stroke={isHovered ? '#a78bfa' : 'rgba(237,239,240,0.45)'}
                    strokeWidth="1.3"
                    className="transition-colors duration-300"
                  />
                  <circle
                    r={isHovered ? 3 : 2}
                    fill={isHovered ? '#a78bfa' : 'rgba(237,239,240,0.55)'}
                    className="transition-all duration-300"
                    style={{ filter: isHovered ? 'drop-shadow(0 0 5px rgba(167,139,250,0.85))' : 'none' }}
                  />
                </g>
              );
            })}

            {/* hub - concentric rings + core + short measurement ticks,
                established first (no reveal delay) so it reads as the
                network's anchor */}
            <g
              className="transition-all duration-500 motion-reduce:transition-none"
              style={{ transform: `translate(${HUB.x}px, ${HUB.y}px)`, opacity: inView ? 1 : 0 }}
            >
              <circle r="46" fill="url(#whyHubGlow)" />
              <circle r="30" fill="none" stroke="rgba(167,139,250,0.4)" strokeWidth="1" />
              <circle
                r="20" fill="none" stroke="#a78bfa" strokeWidth="1.3"
                className="signal-node-idle motion-reduce:animate-none"
                style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
              />
              <circle r="3.5" fill="#a78bfa" />
              <path d="M0,-38 v-8 M0,38 v8 M-38,0 h-8 M38,0 h8" stroke="rgba(167,139,250,0.5)" strokeWidth="1" />
            </g>
          </svg>

          {/* hub label */}
          <div
            className="absolute font-display font-bold text-sm tracking-tight text-text text-center transition-opacity duration-500 motion-reduce:transition-none"
            style={{ left: `${(HUB.x / 1000) * 100}%`, top: `${(HUB.y / 640) * 100}%`, transform: 'translate(-50%, 34px)', opacity: inView ? 1 : 0 }}
          >
            ALLSEMIS
            <span className="block font-mono text-[0.56rem] font-normal uppercase tracking-[0.16em] text-text-faint mt-0.5">
              System / Core
            </span>
          </div>

          {/* HTML overlay per node - number/glyph/title always visible,
              description present at all times (dimmer by default,
              brighter on hover/focus) so nothing is hidden from
              assistive tech or keyboard users. */}
          {DESKTOP_NODES.map((n, i) => {
            const reason = reasons[i];
            const isHovered = hoveredKey === reason.num;
            const alignRight = n.side === 'left';
            return (
              <button
                type="button"
                key={reason.num}
                className={`absolute max-w-[190px] text-left bg-transparent rounded-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 transition-opacity duration-700 motion-reduce:transition-none ${
                  inView ? 'opacity-100' : 'opacity-0'
                }`}
                style={{
                  left: `${(n.x / 1000) * 100}%`,
                  top: `${(n.y / 640) * 100}%`,
                  transform: alignRight ? 'translate(-106%, -50%)' : 'translate(10%, -50%)',
                  textAlign: alignRight ? 'right' : 'left',
                  transitionDelay: inView && !reduce ? `${460 + i * 140}ms` : '0ms',
                }}
                onMouseEnter={() => setHoveredKey(reason.num)}
                onMouseLeave={() => setHoveredKey(null)}
                onFocus={() => setHoveredKey(reason.num)}
                onBlur={() => setHoveredKey(null)}
              >
                <span className={`flex items-center gap-2 ${alignRight ? 'flex-row-reverse' : ''}`}>
                  <reason.Glyph
                    width={16}
                    height={16}
                    className={`shrink-0 transition-colors duration-300 ${isHovered ? 'text-accent' : 'text-accent/50'}`}
                  />
                  <span className={`font-mono text-[0.6rem] tracking-widest transition-colors duration-300 ${isHovered ? 'text-accent' : 'text-text-faint'}`}>
                    {reason.num}
                  </span>
                </span>
                <span className={`block mt-1 font-display font-semibold text-sm leading-snug transition-colors duration-300 ${isHovered ? 'text-text' : 'text-text-dim'}`}>
                  {reason.title}
                </span>
                <span className={`block mt-1 text-xs leading-relaxed transition-colors duration-300 ${isHovered ? 'text-text-dim' : 'text-text-faint'}`}>
                  {reason.body}
                </span>
              </button>
            );
          })}

          <div className="absolute left-4 bottom-4 flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-accent motion-reduce:animate-none office-dot-blink" />
            <MeasurementLabel>Network / Active</MeasurementLabel>
          </div>
        </div>
      </div>

      {/* ---------- mobile: vertical signal route ---------- */}
      <div className="md:hidden relative mt-6">
        <div className="relative">
          <span
            aria-hidden="true"
            className={`absolute left-[23px] top-6 bottom-6 w-px bg-gradient-to-b from-accent/60 via-line-strong to-line-strong origin-top transition-transform duration-[1200ms] motion-reduce:transition-none ${
              inView ? 'scale-y-100' : 'scale-y-0'
            }`}
          />
          {inView && (
            <span
              aria-hidden="true"
              className="absolute left-[19px] top-6 w-2 h-2 rounded-full bg-accent motion-reduce:hidden why-mobile-signal-drop"
              style={{ filter: 'drop-shadow(0 0 5px rgba(167,139,250,0.85))' }}
            />
          )}

          <div className="relative flex items-center gap-4 pb-6">
            <span className="relative z-10 shrink-0 w-12 h-12 flex items-center justify-center">
              <span className="absolute inset-1 rounded-full border border-accent/40" />
              <span className="absolute inset-2 rounded-full border border-accent signal-node-idle motion-reduce:animate-none" />
              <span className="h-2 w-2 rounded-full bg-accent" style={{ filter: 'drop-shadow(0 0 5px rgba(167,139,250,0.85))' }} />
            </span>
            <div>
              <span className="font-display font-bold text-base tracking-tight">ALLSEMIS</span>
              <span className="block font-mono text-[0.58rem] uppercase tracking-[0.16em] text-text-faint mt-0.5">
                System / Core
              </span>
            </div>
          </div>

          {reasons.map((r, i) => (
            <div
              key={r.num}
              className={`relative flex gap-4 pb-8 last:pb-0 transition-all duration-500 motion-reduce:transition-none ${
                inView ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-2'
              }`}
              style={{ transitionDelay: inView && !reduce ? `${280 + i * 160}ms` : '0ms' }}
            >
              <span className="relative z-10 shrink-0 w-12 h-12 flex items-start justify-center pt-1">
                <span className="relative flex h-4 w-4 items-center justify-center">
                  <span className="absolute inset-0 rounded-full border border-accent/50" />
                  <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                </span>
              </span>
              <div className="min-w-0 flex-1 pt-0.5">
                <span className="flex items-center gap-2">
                  <r.Glyph width={16} height={16} className="shrink-0 text-accent/70" />
                  <span className="font-mono text-[0.6rem] tracking-widest text-accent">{r.num}</span>
                </span>
                <h3 className="font-display font-semibold text-base mt-1">{r.title}</h3>
                <p className="text-text-dim text-sm leading-relaxed mt-1">{r.body}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
