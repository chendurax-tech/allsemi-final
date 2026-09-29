import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useInView, MeasurementLabel, prefersReducedMotion } from '../lib/motionPrimitives.jsx';
import { activeLocations, projectCoordinates } from '../lib/officeLocations.js';

const LOCATIONS = activeLocations();

/*
  OfficeNetwork - ALLSEMIS's own take on a "global office" section: a
  dotted world silhouette (land rendered as a scatter of small points,
  in the same visual register as a PCB's component grid, not a
  coastline-accurate map) with a set of dim, unlabeled "network node"
  points spread across it, thin circuit-style traces connecting a few
  of them, and Bengaluru rendered as the one bright, pulsing, labeled
  ACTIVE node.

  Content honesty: LOCATIONS (lib/officeLocations.js) is the only real,
  addressable ALLSEMIS office data this component ever renders as a
  location - today, just Bengaluru. NETWORK_NODES below are a fixed,
  intentionally unlabeled set of decorative points representing
  "the engineering network ALLSEMIS operates within," not real offices
  - they carry no city name, no address, and are not selectable, so
  nothing here can be mistaken for a claimed location.

  Desktop and mobile render the same dotted-world + node data through
  two differently-cropped views (see DESKTOP_VIEWBOX / MOBILE_VIEWBOX)
  rather than one map squeezed to fit - mobile crops to the
  Africa/Europe/Asia-Pacific band so Bengaluru and its nearest network
  neighbors stay legible instead of shrinking to illegible dots.
*/

const VIEWBOX_W = 1000;
const VIEWBOX_H = 460;
const DESKTOP_VIEWBOX = `0 0 ${VIEWBOX_W} ${VIEWBOX_H}`;
// A cropped window over the same coordinate space, centered on the
// Africa/Europe -> South Asia -> East Asia/Australia band so Bengaluru
// (which projects to roughly x=715, y=214) sits comfortably inside it.
const MOBILE_VIEWBOX = '420 30 480 400';

// Rough bounding boxes ([lonMin, lonMax, latMin, latMax]) per landmass,
// deliberately simplified (not a real coastline dataset) - just enough
// for a recognizable dotted-continent silhouette at this scale.
const LAND_BOXES = [
  [-168, -130, 55, 72],   // Alaska
  [-130, -60, 25, 60],    // Canada / continental US
  [-113, -85, 14, 25],    // Mexico / Central America
  [-82, -34, -56, 13],    // South America
  [-11, 40, 35, 71],      // Europe
  [-18, 52, -35, 37],     // Africa
  [26, 60, 12, 42],       // Middle East
  [60, 100, 5, 55],       // South / Central Asia
  [100, 150, 18, 55],     // East Asia
  [95, 140, -10, 20],     // Southeast Asia
  [113, 154, -44, -10],   // Australia
  [165, 179, -47, -34],   // New Zealand (rough)
];

function isLand(lon, lat) {
  return LAND_BOXES.some(([lo1, lo2, la1, la2]) => lon >= lo1 && lon <= lo2 && lat >= la1 && lat <= la2);
}

// Computed once at module load: a sparse dot for every ~7deg cell that
// falls on land, projected into the shared 1000x460 coordinate space.
const WORLD_DOTS = (() => {
  const dots = [];
  const step = 7;
  for (let lon = -180; lon < 180; lon += step) {
    for (let lat = -60; lat < 78; lat += step) {
      if (isLand(lon + step / 2, lat + step / 2)) {
        dots.push(projectCoordinates([lon + step / 2, lat + step / 2], VIEWBOX_W, VIEWBOX_H));
      }
    }
  }
  return dots;
})();

// Fixed, deliberately unlabeled decorative network points - visual
// texture representing "a wider engineering network," not real
// ALLSEMIS offices. No id here is ever rendered as a city name.
const NETWORK_NODES = [
  [-122.4, 37.8],  // N. America west
  [-74.0, 40.7],   // N. America east
  [-46.6, -23.5],  // South America
  [-0.1, 51.5],    // Europe west
  [13.4, 52.5],    // Europe central
  [55.3, 25.3],    // Middle East
  [103.8, 1.3],    // SE Asia
  [139.7, 35.7],   // East Asia
  [151.2, -33.9],  // Oceania
  [18.4, -33.9],   // Africa south
].map(([lon, lat]) => projectCoordinates([lon, lat], VIEWBOX_W, VIEWBOX_H));

// A handful of network points connected back toward Bengaluru with
// thin traces, to read as "part of a mesh," not just floating dots.
const TRACE_TARGETS = [6, 7, 5, 3]; // indices into NETWORK_NODES (SE Asia, E Asia, Middle East, Europe west)

/*
  All copy/CTA props default to the original, already-approved About-page
  wording - so <OfficeNetwork /> with no props (About.jsx) renders exactly
  as before. Landing.jsx passes its own eyebrow/heading/intro/cta so the
  same map + data + interaction is reused rather than rebuilt, per the
  "centralize, don't scatter" requirement.
*/
export default function OfficeNetwork({
  id,
  eyebrow = 'Global Network',
  heading = (
    <>One engineering <span className="gradient-text">network</span>, anchored in Bengaluru.</>
  ),
  intro = 'ALLSEMIS operates from Bengaluru today, built as part of a wider engineering network structured to extend into new regions as it grows.',
  cta = null, // { to, label }
}) {
  const [ref, inView] = useInView(0.15);
  const [activeId, setActiveId] = useState(LOCATIONS[0]?.id ?? null);
  const [hoveredId, setHoveredId] = useState(null);

  const active = LOCATIONS.find((l) => l.id === activeId) || LOCATIONS[0];

  return (
    <section
      id={id}
      ref={(el) => { ref.current = el; }}
      className="relative border-b border-line py-20 md:py-28 overflow-hidden"
    >
      <div className="max-w-7xl mx-auto px-5 md:px-10">
        <div className={`mb-10 md:mb-14 transition-opacity duration-700 motion-reduce:transition-none ${inView ? 'opacity-100' : 'opacity-0'}`}>
          <MeasurementLabel className="block mb-4">{eyebrow}</MeasurementLabel>
          <h2 className="font-display font-semibold text-3xl md:text-4xl tracking-tight max-w-2xl">
            {heading}
          </h2>
          <p className="mt-4 text-text-dim text-base md:text-lg max-w-xl leading-relaxed">
            {intro}
          </p>
        </div>

        <div className="grid lg:grid-cols-[1.5fr_1fr] gap-6 lg:gap-8 items-stretch">
          <NetworkMap
            locations={LOCATIONS}
            activeId={activeId}
            hoveredId={hoveredId}
            onSelect={setActiveId}
            onHover={setHoveredId}
            inView={inView}
          />
          <LocationPanel location={active} />
        </div>

        {cta && (
          <div className={`mt-10 md:mt-14 flex justify-center transition-opacity duration-700 motion-reduce:transition-none ${inView ? 'opacity-100' : 'opacity-0'}`}>
            <Link
              to={cta.to}
              className="group inline-flex items-center gap-3 border border-line hover:border-turquoise/60 bg-bg-raised/40 px-6 py-3.5 font-mono text-xs uppercase tracking-[0.2em] text-text transition-colors"
            >
              {cta.label}
              <span className="transition-transform duration-300 group-hover:translate-x-1" aria-hidden="true">&rarr;</span>
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}

/*
  useCursorFX - the desktop-only "engineering scan field" interaction.

  Pure refs + requestAnimationFrame: no React state is touched per
  mouse move, so hovering the network never causes a React re-render.
  All distance math happens in real screen pixels (converted to the
  SVG's user-unit space only at the moment a style is written), so
  the falloff radii and the ~8px node displacement the brief asks for
  read the same regardless of how large the network is rendered.

  Disabled entirely (every handler becomes a no-op) when the device
  has no fine pointer / hover capability, or under
  prefers-reduced-motion - same discipline as useParallax/
  useRadialHighlight in motionPrimitives.jsx: a cursor-driven effect
  simply does not exist for touch or reduced-motion, rather than
  existing in a degraded form.
*/
function useCursorFX() {
  const enabled =
    typeof window !== 'undefined' &&
    window.matchMedia('(hover: hover) and (pointer: fine)').matches &&
    !prefersReducedMotion();

  const svgRef = useRef(null);
  const wrapRef = useRef(null);
  const scannerRef = useRef(null);

  const dotEls = useRef([]);
  const dotAffected = useRef(new Set());
  const nodeEls = useRef([]);
  const locationRefs = useRef({}); // id -> { group, ring, x0, y0, leads: [], meshPaths: [] }

  const mouse = useRef({ active: false, clientX: 0, clientY: 0 });
  const rafRef = useRef(null);
  const runningRef = useRef(false);

  function resetDot(el) {
    if (!el) return;
    el.style.opacity = '';
    el.style.transform = '';
  }
  function resetNode(el) {
    if (!el) return;
    el.style.opacity = '';
    el.style.transform = '';
  }
  function resetLocation(refs) {
    if (!refs) return;
    if (refs.group) refs.group.style.transform = '';
    if (refs.boostRing) refs.boostRing.style.opacity = '0';
    if (refs.label) refs.label.style.transform = '';
    (refs.leads || []).forEach((p) => { if (p) p.style.opacity = ''; });
    (refs.meshPaths || []).forEach((p) => { if (p) { p.style.opacity = ''; p.style.strokeWidth = ''; } });
  }

  function tick() {
    const svg = svgRef.current;
    const wrap = wrapRef.current;
    if (!svg || !wrap) { runningRef.current = false; return; }

    const svgRect = svg.getBoundingClientRect();
    const wrapRect = wrap.getBoundingClientRect();
    const scaleX = VIEWBOX_W / svgRect.width || 1;
    const scaleY = VIEWBOX_H / svgRect.height || 1;
    const m = mouse.current;

    if (scannerRef.current) {
      if (m.active) {
        scannerRef.current.style.opacity = '1';
        scannerRef.current.style.transform = `translate(${m.clientX - wrapRect.left}px, ${m.clientY - wrapRect.top}px)`;
      } else {
        scannerRef.current.style.opacity = '0';
      }
    }

    // cursor position in the SVG's own user-unit space
    const cx = m.active ? (m.clientX - svgRect.left) * scaleX : -1e6;
    const cy = m.active ? (m.clientY - svgRect.top) * scaleY : -1e6;

    // background dot field - distance-based opacity/scale falloff;
    // only the (few) dots within range are ever written to, and any
    // dot that *was* affected last frame but no longer is gets reset
    // once, so this stays cheap regardless of the ~400 total dots.
    const near = new Set();
    if (m.active) {
      for (let i = 0; i < WORLD_DOTS.length; i++) {
        const [dx0, dy0] = WORLD_DOTS[i];
        const ddx = (dx0 - cx) / scaleX;
        const ddy = (dy0 - cy) / scaleY;
        if (Math.sqrt(ddx * ddx + ddy * ddy) < 150) near.add(i);
      }
    }
    near.forEach((i) => {
      const el = dotEls.current[i];
      if (!el) return;
      const [dx0, dy0] = WORLD_DOTS[i];
      const ddx = (dx0 - cx) / scaleX;
      const ddy = (dy0 - cy) / scaleY;
      const dist = Math.sqrt(ddx * ddx + ddy * ddy);
      const t = Math.max(0, 1 - dist / 150);
      el.style.opacity = String(0.22 + t * 0.62);
      el.style.transform = `scale(${1 + t * 1.3})`;
    });
    dotAffected.current.forEach((i) => { if (!near.has(i)) resetDot(dotEls.current[i]); });
    dotAffected.current = near;

    // decorative network nodes - subtle magnetic displacement (capped
    // ~8 screen px) plus a brightness lift, smoothed by the CSS
    // transition already on these elements (see className below).
    for (let i = 0; i < NETWORK_NODES.length; i++) {
      const el = nodeEls.current[i];
      if (!el) continue;
      if (!m.active) { resetNode(el); continue; }
      const [nx, ny] = NETWORK_NODES[i];
      const ddx = (nx - cx) / scaleX;
      const ddy = (ny - cy) / scaleY;
      const dist = Math.sqrt(ddx * ddx + ddy * ddy);
      const radius = 130;
      if (dist < radius && dist > 0.01) {
        const t = 1 - dist / radius;
        const maxOffsetPx = 8;
        const offXUser = (-ddx / dist) * t * maxOffsetPx * scaleX;
        const offYUser = (-ddy / dist) * t * maxOffsetPx * scaleY;
        el.style.transform = `translate(${offXUser}px, ${offYUser}px)`;
        el.style.opacity = String(0.4 + t * 0.5);
      } else {
        resetNode(el);
      }
    }

    // active location(s), e.g. Bengaluru - the primary node: a
    // slightly stronger displacement cap, brighter ring, illuminated
    // connecting traces, and a bolder label while the cursor is near.
    Object.values(locationRefs.current).forEach((refs) => {
      if (!refs || refs.x0 == null) return;
      if (!m.active) { resetLocation(refs); return; }
      const ddx = (refs.x0 - cx) / scaleX;
      const ddy = (refs.y0 - cy) / scaleY;
      const dist = Math.sqrt(ddx * ddx + ddy * ddy);
      const radius = 150;
      if (dist < radius && dist > 0.01) {
        const t = 1 - dist / radius;
        const maxOffsetPx = 6;
        const offXUser = (-ddx / dist) * t * maxOffsetPx * scaleX;
        const offYUser = (-ddy / dist) * t * maxOffsetPx * scaleY;
        if (refs.group) refs.group.style.transform = `translate(${offXUser}px, ${offYUser}px) scale(${1 + t * 0.12})`;
        if (refs.boostRing) refs.boostRing.style.opacity = String(t * 0.65);
        if (refs.label) refs.label.style.transform = `scale(${1 + t * 0.1})`;
        (refs.leads || []).forEach((p) => { if (p) p.style.opacity = String(0.4 + t * 0.6); });
        (refs.meshPaths || []).forEach((p) => { if (p) { p.style.opacity = String(0.14 + t * 0.56); p.style.strokeWidth = String(1 + t * 0.8); } });
      } else {
        resetLocation(refs);
      }
    });

    if (m.active) {
      rafRef.current = requestAnimationFrame(tick);
    } else {
      runningRef.current = false;
    }
  }

  function ensureLoop() {
    if (!enabled || runningRef.current) return;
    runningRef.current = true;
    rafRef.current = requestAnimationFrame(tick);
  }

  function handleMouseEnter(e) {
    if (!enabled) return;
    mouse.current = { active: true, clientX: e.clientX, clientY: e.clientY };
    ensureLoop();
  }
  function handleMouseMove(e) {
    if (!enabled) return;
    mouse.current.active = true;
    mouse.current.clientX = e.clientX;
    mouse.current.clientY = e.clientY;
    ensureLoop();
  }
  function handleMouseLeave() {
    if (!enabled) return;
    mouse.current.active = false;
    ensureLoop(); // one more tick resets everything, then the loop stops itself
  }

  useEffect(() => () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); }, []);

  return {
    enabled,
    svgRef,
    wrapRef,
    scannerRef,
    handleMouseEnter,
    handleMouseMove,
    handleMouseLeave,
    registerDot: (i, el) => { dotEls.current[i] = el; },
    registerNetworkNode: (i, el) => { nodeEls.current[i] = el; },
    registerLocation: (id, key, el) => {
      if (!locationRefs.current[id]) locationRefs.current[id] = {};
      locationRefs.current[id][key] = el;
    },
    registerLocationListItem: (id, key, index, el) => {
      if (!locationRefs.current[id]) locationRefs.current[id] = {};
      if (!locationRefs.current[id][key]) locationRefs.current[id][key] = [];
      locationRefs.current[id][key][index] = el;
    },
    setLocationOrigin: (id, x0, y0) => {
      if (!locationRefs.current[id]) locationRefs.current[id] = {};
      locationRefs.current[id].x0 = x0;
      locationRefs.current[id].y0 = y0;
    },
  };
}

// Cursor-reactive scan field: a small, quiet technical ring (not a
// spotlight) that follows the pointer while it's over the desktop
// network. Purely decorative/pointer-events-none - it never blocks
// the existing node hit-targets beneath it.
function CursorScanner({ fxRef }) {
  return (
    <div
      ref={fxRef}
      aria-hidden="true"
      className="pointer-events-none absolute left-0 top-0 opacity-0 transition-opacity duration-200 ease-out will-change-transform"
    >
      <svg width="130" height="130" viewBox="0 0 130 130" style={{ position: 'absolute', left: -65, top: -65 }}>
        <defs>
          <radialGradient id="scannerGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#a78bfa" stopOpacity="0.10" />
            <stop offset="65%" stopColor="#2dd4bf" stopOpacity="0.05" />
            <stop offset="100%" stopColor="#2dd4bf" stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle cx="65" cy="65" r="62" fill="url(#scannerGlow)" />
        <circle cx="65" cy="65" r="48" fill="none" stroke="rgba(167,139,250,0.32)" strokeWidth="1" />
        <path d="M65,8 v7 M65,115 v7 M8,65 h7 M115,65 h7" stroke="rgba(45,212,191,0.4)" strokeWidth="1" />
      </svg>
    </div>
  );
}

function MapDefs() {
  return (
    <defs>
      <radialGradient id="officeNodeGlow" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stopColor="#2dd4bf" stopOpacity="0.55" />
        <stop offset="100%" stopColor="#2dd4bf" stopOpacity="0" />
      </radialGradient>
    </defs>
  );
}

function MapContent({ locations, activeId, hoveredId, onSelect, onHover, inView, fx }) {
  return (
    <>
      <MapDefs />

      {/* dotted world silhouette - land only, sparse and subdued.
          fx (desktop only) registers each dot so the cursor-scan
          effect can brighten/scale the handful near the pointer
          without touching React state. */}
      <g className={`transition-opacity duration-1000 motion-reduce:transition-none ${inView ? 'opacity-100' : 'opacity-0'}`}>
        {WORLD_DOTS.map(([x, y], i) => (
          <circle
            key={i}
            cx={x} cy={y} r="1.4"
            fill="rgba(237,239,240,0.22)"
            className={fx ? 'transition-[opacity,transform] duration-200 ease-out' : undefined}
            style={fx ? { transformBox: 'fill-box', transformOrigin: 'center' } : undefined}
            ref={fx ? (el) => fx.registerDot(i, el) : undefined}
          />
        ))}
      </g>

      {/* decorative network traces - a mesh feel, not claiming offices */}
      <g className={`transition-opacity duration-1000 motion-reduce:transition-none ${inView ? 'opacity-100' : 'opacity-0'}`}>
        {(() => {
          const [bx, by] = projectCoordinates(locations[0].coordinates, VIEWBOX_W, VIEWBOX_H);
          if (fx) fx.setLocationOrigin(locations[0].id, bx, by);
          return TRACE_TARGETS.map((idx, i) => {
            const [nx, ny] = NETWORK_NODES[idx];
            const pathD = `M ${bx} ${by} L ${nx} ${ny}`;
            return (
              <React.Fragment key={idx}>
                <path
                  d={pathD}
                  fill="none"
                  stroke="rgba(167,139,250,0.14)"
                  strokeWidth="1"
                  strokeDasharray="3 4"
                  className={fx ? 'transition-[opacity,stroke-width] duration-200 ease-out' : undefined}
                  ref={fx ? (el) => fx.registerLocationListItem(locations[0].id, 'meshPaths', i, el) : undefined}
                />
                {/* One faint signal drifts along the first trace only -
                    ambient texture ("a signal is moving through the
                    network"), not a busy loop on every line. */}
                {i === 0 && inView && (
                  <circle
                    r="2.2"
                    fill="#a78bfa"
                    className="motion-reduce:hidden office-signal-travel"
                    style={{ offsetPath: `path('${pathD}')`, offsetRotate: '0deg' }}
                  />
                )}
              </React.Fragment>
            );
          });
        })()}
      </g>

      {/* decorative network nodes - dim, unlabeled, not selectable.
          fx gives each a subtle magnetic displacement toward the
          cursor (capped ~8px) plus a brightness lift when nearby. */}
      <g>
        {NETWORK_NODES.map(([x, y], i) => (
          <circle
            key={i}
            cx={x} cy={y} r="3"
            fill="rgba(45,212,191,0.4)"
            stroke="rgba(45,212,191,0.15)"
            strokeWidth="4"
            className={fx ? 'transition-[opacity,transform] duration-200 ease-out' : undefined}
            ref={fx ? (el) => fx.registerNetworkNode(i, el) : undefined}
          />
        ))}
      </g>

      {/* real ALLSEMIS location(s) */}
      {locations.map((loc) => {
        const [x, y] = projectCoordinates(loc.coordinates, VIEWBOX_W, VIEWBOX_H);
        const isActive = loc.id === activeId;
        const isHovered = loc.id === hoveredId;
        return (
          <g
            key={loc.id}
            className={fx ? 'transition-transform duration-200 ease-out' : undefined}
            style={fx ? { transformOrigin: `${x}px ${y}px` } : undefined}
            ref={fx ? (el) => fx.registerLocation(loc.id, 'group', el) : undefined}
          >
            <g className={`transition-opacity duration-700 motion-reduce:transition-none ${inView ? 'opacity-100' : 'opacity-0'}`}>
              <path
                d={`M ${x} ${y} L ${x + 55} ${y - 32} L ${x + 130} ${y - 32}`}
                fill="none" stroke="rgba(45,212,191,0.4)" strokeWidth="1.2"
                className={fx ? 'transition-opacity duration-200 ease-out' : undefined}
                ref={fx ? (el) => fx.registerLocationListItem(loc.id, 'leads', 0, el) : undefined}
              />
              <path
                d={`M ${x} ${y} L ${x - 48} ${y + 38} L ${x - 120} ${y + 38}`}
                fill="none" stroke="rgba(167,139,250,0.35)" strokeWidth="1.2"
                className={fx ? 'transition-opacity duration-200 ease-out' : undefined}
                ref={fx ? (el) => fx.registerLocationListItem(loc.id, 'leads', 1, el) : undefined}
              />
              <circle cx={x + 130} cy={y - 32} r="2.5" fill="#2dd4bf" opacity="0.6" />
              <circle cx={x - 120} cy={y + 38} r="2.5" fill="#a78bfa" opacity="0.5" />
            </g>

            {isActive && (
              <circle cx={x} cy={y} r="34" fill="url(#officeNodeGlow)" className="motion-reduce:hidden office-node-pulse" />
            )}
            {isActive && (
              <circle cx={x} cy={y} r="18" fill="none" stroke="#2dd4bf" strokeWidth="1" opacity="0.5" className="motion-reduce:hidden office-node-ring" />
            )}
            {/* fx-only boost ring: a second, non-animated ring the
                cursor effect can brighten directly. Kept separate from
                office-node-ring above because that ring's opacity is
                already driven by a looping CSS keyframe, which would
                otherwise fight a plain style.opacity write every frame. */}
            {fx && (
              <circle
                cx={x} cy={y} r="22" fill="none" stroke="#2dd4bf" strokeWidth="1.4" opacity="0"
                className="transition-opacity duration-200 ease-out"
                ref={(el) => fx.registerLocation(loc.id, 'boostRing', el)}
              />
            )}

            <circle
              cx={x} cy={y}
              r={isActive ? 8 : 5}
              fill={isActive ? '#2dd4bf' : '#edeff0'}
              stroke={isActive ? '#2dd4bf' : 'rgba(237,239,240,0.4)'}
              strokeWidth="1"
              className="transition-all duration-300"
            />
            {(isActive || isHovered) && (
              <circle cx={x} cy={y} r="14" fill="none" stroke="#2dd4bf" strokeWidth="1" opacity="0.6" />
            )}

            <circle
              cx={x} cy={y} r="26" fill="transparent"
              tabIndex={0}
              role="button"
              aria-label={`${loc.city}, ${loc.country} office`}
              aria-pressed={isActive}
              onMouseEnter={() => onHover(loc.id)}
              onMouseLeave={() => onHover(null)}
              onFocus={() => onHover(loc.id)}
              onBlur={() => onHover(null)}
              onClick={() => onSelect(loc.id)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(loc.id); } }}
              className="cursor-pointer outline-none"
            />
          </g>
        );
      })}
    </>
  );
}

function MapLabels({ locations, activeId, viewBox, fx }) {
  const [vx, vy, vw, vh] = viewBox.split(' ').map(Number);
  return (
    <>
      {locations.map((loc) => {
        const [px, py] = projectCoordinates(loc.coordinates, VIEWBOX_W, VIEWBOX_H);
        const x = ((px - vx) / vw) * 100;
        const y = ((py - vy) / vh) * 100;
        const isActive = loc.id === activeId;
        return (
          <div
            key={loc.id}
            aria-hidden="true"
            className="absolute pointer-events-none"
            style={{ left: `${x}%`, top: `${y}%`, transform: 'translate(24px, -34px)' }}
          >
            <div
              className={`bg-bg/70 backdrop-blur-[1px] px-1 -ml-1 rounded-sm${fx ? ' transition-transform duration-200 ease-out' : ''}`}
              ref={fx ? (el) => fx.registerLocation(loc.id, 'label', el) : undefined}
            >
              <span className={`block font-mono uppercase tracking-wide whitespace-nowrap transition-colors ${isActive ? 'text-turquoise' : 'text-text-dim'}`} style={{ fontSize: '12px', letterSpacing: '0.06em' }}>
                {loc.city}
              </span>
              {isActive && (
                <span className="block font-mono text-[0.58rem] uppercase tracking-[0.14em] text-text-faint whitespace-nowrap">
                  {loc.country} / {loc.isHeadquarters ? 'HQ' : 'Office'}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </>
  );
}

// Exported so EngineeringNetwork.jsx (the compact landing-page node
// visual) can reuse the exact same map rendering - one implementation
// of "the ALLSEMIS network map," not two drifting copies.
export function NetworkMap({ locations, activeId, hoveredId, onSelect, onHover, inView }) {
  // Desktop-only "engineering scan field" cursor interaction (see
  // useCursorFX above). fx.enabled is false on touch/coarse-pointer
  // devices and under prefers-reduced-motion, in which case the mouse
  // handlers and every fx.register* call below are no-ops and the
  // network renders exactly as it did before this pass.
  const fx = useCursorFX();
  const { wrapRef: fxWrapRef, svgRef: fxSvgRef, scannerRef: fxScannerRef, handleMouseEnter, handleMouseMove, handleMouseLeave, enabled: fxEnabled } = fx;
  const fxForChildren = fxEnabled ? fx : null;

  return (
    <div className="relative border border-line bg-bg-raised/40 overflow-hidden">
      {/* Desktop / tablet: full world, wide aspect */}
      <div
        ref={fxWrapRef}
        onMouseEnter={handleMouseEnter}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        className="hidden md:block relative aspect-[1000/460]"
      >
        <svg
          ref={fxSvgRef}
          viewBox={DESKTOP_VIEWBOX}
          className="absolute inset-0 w-full h-full"
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-label="ALLSEMIS global engineering network, Bengaluru active"
        >
          <MapContent locations={locations} activeId={activeId} hoveredId={hoveredId} onSelect={onSelect} onHover={onHover} inView={inView} fx={fxForChildren} />
        </svg>
        <MapLabels locations={locations} activeId={activeId} viewBox={DESKTOP_VIEWBOX} fx={fxForChildren} />
        {fxEnabled && <CursorScanner fxRef={fxScannerRef} />}
      </div>

      {/* Mobile: cropped to the EMEA -> South Asia -> APAC band, taller
          aspect ratio, so Bengaluru and its nearest network neighbors
          stay legible instead of shrinking with the whole world. */}
      <div className="md:hidden relative aspect-[4/5]">
        <svg viewBox={MOBILE_VIEWBOX} className="absolute inset-0 w-full h-full" preserveAspectRatio="xMidYMid slice" role="img" aria-label="ALLSEMIS global engineering network, Bengaluru active">
          <MapContent locations={locations} activeId={activeId} hoveredId={hoveredId} onSelect={onSelect} onHover={onHover} inView={inView} />
        </svg>
        <MapLabels locations={locations} activeId={activeId} viewBox={MOBILE_VIEWBOX} />
      </div>

      <div className="absolute left-4 bottom-4 flex items-center gap-2">
        <span className="h-1.5 w-1.5 rounded-full bg-turquoise motion-reduce:animate-none office-dot-blink" />
        <span className="font-mono text-[0.6rem] uppercase tracking-[0.2em] text-text-faint">
          Network / Active
        </span>
      </div>
    </div>
  );
}

function LocationPanel({ location }) {
  if (!location) return null;
  return (
    <div className="relative border border-line bg-bg-raised/40 p-6 md:p-8 flex flex-col justify-between">
      <div>
        <div className="flex items-center gap-2 mb-4">
          <span className="h-1.5 w-1.5 rounded-full bg-turquoise" />
          <span className="font-mono text-[0.62rem] uppercase tracking-[0.2em] text-turquoise">
            {location.region} / {location.isHeadquarters ? 'Headquarters' : 'Office'}
          </span>
        </div>
        <h3 className="font-display font-semibold text-2xl md:text-3xl tracking-tight mb-1">
          {location.city}
        </h3>
        <p className="text-text-dim text-sm mb-6">{location.country}</p>

        <dl className="space-y-4 text-sm">
          <div>
            <dt className="font-mono text-[0.6rem] uppercase tracking-widest text-text-faint mb-1">Address</dt>
            <dd className="text-text-dim leading-relaxed">
              {location.address.map((line) => <span key={line} className="block">{line}</span>)}
            </dd>
          </div>
          <div>
            <dt className="font-mono text-[0.6rem] uppercase tracking-widest text-text-faint mb-1">Phone</dt>
            <dd className="text-text-dim">{location.phone}</dd>
          </div>
          <div>
            <dt className="font-mono text-[0.6rem] uppercase tracking-widest text-text-faint mb-1">Email</dt>
            <dd className="text-text-dim">{location.email}</dd>
          </div>
          <div>
            <dt className="font-mono text-[0.6rem] uppercase tracking-widest text-text-faint mb-1">Hours</dt>
            <dd className="text-text-dim leading-relaxed">
              {location.hours.map((line) => <span key={line} className="block">{line}</span>)}
            </dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
