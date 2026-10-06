import React, { useState, useRef, useEffect, useLayoutEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useInView, MeasurementLabel, prefersReducedMotion } from '../lib/motionPrimitives.jsx';
import { projectCoordinates } from '../lib/officeLocations.js';
import { useLocations } from '../lib/usePublicData.js';
import { buildDotField } from '../lib/worldLand.js';

// The locations come from the backend (useLocations -> GET
// /api/public/locations): the ones switched on in the admin, oldest
// first. Every one is a selectable node on the map: a confirmed office
// or a named engineering-network node (type: 'network'). A network node
// is never presented as an office - it has no address, phone, email or
// hours, and the panel shows only its city, country and "Engineering
// Network / Network node".
const isNetworkNode = (location) => location.type === 'network';

// The hub of the map and the node selected by default: the headquarters
// office, else the first office, else the first location.
function pickHub(locations) {
  return locations.find((l) => !isNetworkNode(l) && l.isHeadquarters) || locations.find((l) => !isNetworkNode(l)) || locations[0] || null;
}

/*
  OfficeNetwork - ALLSEMIS's own take on a "global office" section: the
  engineering-network dot field, arranged so the dots themselves form
  the world's continents (land rendered as a scatter of small points,
  in the same visual register as a PCB's component grid - never a
  drawn coastline or a filled shape), with dim, unlabeled "network
  node" points spread across it, thin circuit-style traces, and the
  named ALLSEMIS locations placed at their real coordinates.

  The headquarters office is the hub and the default selected node:
  bright teal, pulsing, labeled. Network nodes use the same node
  language, smaller and quieter. Selecting any node makes it the active
  one and updates the location panel.

  While the locations load the section keeps its frame, so the page
  does not jump. With no location switched on, or when the API cannot
  be reached, the section is left out and the rest of the page is
  unaffected.

  Content honesty: the locations from the backend are the only named
  location data this component renders. NETWORK_NODES below are a
  fixed, intentionally unlabeled set of decorative points representing
  "the engineering network ALLSEMIS operates within," not offices -
  they carry no city name, no address, and are not selectable, so
  nothing here can be mistaken for a claimed location.

  Desktop and mobile render the same land, nodes and routes through two
  views (DESKTOP_VIEW / MOBILE_VIEW) rather than one map squeezed to
  fit. Mobile uses its own crop and projection - North America through
  to India - so San Diego, Bengaluru and Bhubaneswar all stay visible
  in a portrait frame, with their labels moved into the free space
  around the dot field. A location outside that crop is drawn at the
  nearest edge of it on mobile, so it stays in the frame and can still
  be selected.

  Two named nodes can be close together (Bengaluru and Bhubaneswar are
  about 1,150 km apart, a few pixels on a world map). Three things keep
  them individually selectable, on both views:
  - separateNodes() draws a node that is too close to another slightly
    further out along its true bearing (the data keeps the real
    coordinates; the office never moves);
  - every node has an invisible hit area larger than its visible dot,
    and where two hit areas would overlap they are split along the
    midline between the nodes, so neither can swallow the other;
  - each label sits on its own side with its own short leader trace,
    and is itself a click / tap target;
  - on desktop raiseLabels() checks the labels' real boxes and lifts a
    network label that would touch or crowd another label or node, so
    the labels stay apart whatever label hints are saved.
*/

const VIEWBOX_W = 1000;
const VIEWBOX_H = 460;

// Fixed, deliberately unlabeled decorative network points - visual
// texture representing "a wider engineering network," not real
// ALLSEMIS offices. No entry here is ever rendered as a city name.
const DECOR_NODE_COORDS = [
  [-74.0, 40.7],   // N. America east
  [-46.6, -23.5],  // South America
  [-0.1, 51.5],    // Europe west
  [13.4, 52.5],    // Europe central
  [55.3, 25.3],    // Middle East
  [103.8, 1.3],    // SE Asia
  [139.7, 35.7],   // East Asia
  [151.2, -33.9],  // Oceania
  [18.4, -33.9],   // Africa south
];

// A handful of network points connected back toward Bengaluru with
// thin traces, to read as "part of a mesh," not just floating dots.
const TRACE_TARGETS = [5, 6, 4, 2]; // indices into DECOR_NODE_COORDS (SE Asia, E Asia, Middle East, Europe west)

const fmt = (n) => Number(n.toFixed(1));
const toPath = (points) => points.map(([x, y], i) => `${i ? 'L' : 'M'} ${fmt(x)} ${fmt(y)}`).join(' ');

// Signal routes between the named locations, drawn like board traces:
// straight runs joined by 45-degree bends, never a curved map route.
// Every route runs from a node to the hub.
// A long route leaves along the node's own latitude, steps across to
// the hub's latitude in one 45-degree run placed `bendAt` of the way
// along (over the Atlantic for San Diego), and arrives level with the
// hub - so it never cuts through the labels above the hub.
function longRoute(a, b, bendAt) {
  const dir = Math.sign(b[0] - a[0]) || 1;
  const x1 = a[0] + (b[0] - a[0]) * bendAt;
  return [a, [x1, a[1]], [x1 + dir * Math.abs(b[1] - a[1]), b[1]], b];
}
function shortRoute(a, b, chamfer) {
  const sx = Math.sign(b[0] - a[0]) || 1;
  const sy = Math.sign(b[1] - a[1]) || 1;
  return [a, [b[0] - sx * chamfer, a[1]], [b[0], a[1] + sy * chamfer], b];
}

// Display positions for the named nodes. Each starts at its real
// projected coordinates; two that land closer than `minGap` view units
// are drawn apart along the line between them, so the bearing (and so
// "Bhubaneswar is north-east of Bengaluru") is preserved. The office
// stays exactly where it is and the network node takes the offset.
function separateNodes(locations, hub, place, minGap) {
  const points = {};
  locations.forEach((loc) => { points[loc.id] = place(loc.coordinates); });
  locations.forEach((a, i) => {
    locations.slice(i + 1).forEach((b) => {
      const pa = points[a.id];
      const pb = points[b.id];
      const d = Math.hypot(pb[0] - pa[0], pb[1] - pa[1]);
      if (d >= minGap) return;
      // two locations on the same spot are drawn apart on a diagonal
      const ux = d ? (pb[0] - pa[0]) / d : Math.SQRT1_2;
      const uy = d ? (pb[1] - pa[1]) / d : -Math.SQRT1_2;
      const push = minGap - d;
      const shareA = a.id === hub.id ? 0 : b.id === hub.id ? 1 : 0.5;
      points[a.id] = [pa[0] - ux * push * shareA, pa[1] - uy * push * shareA];
      points[b.id] = [pb[0] + ux * push * (1 - shareA), pb[1] + uy * push * (1 - shareA)];
    });
  });
  return points;
}

// The invisible hit area for one node: a circle of `radius` view units
// around it, cut back to the midline wherever a neighbour's circle
// would overlap. Two close nodes therefore get two half-discs that
// meet between them, and a click or tap always goes to the nearer one.
function hitArea(center, radius, neighbours) {
  let poly = Array.from({ length: 32 }, (_, i) => {
    const a = (i / 32) * Math.PI * 2;
    return [center[0] + Math.cos(a) * radius, center[1] + Math.sin(a) * radius];
  });
  neighbours.forEach((n) => {
    const d = Math.hypot(n.point[0] - center[0], n.point[1] - center[1]);
    if (d === 0 || d >= radius + n.radius) return;
    const nx = (n.point[0] - center[0]) / d;
    const ny = (n.point[1] - center[1]) / d;
    const side = (p) => (p[0] - center[0]) * nx + (p[1] - center[1]) * ny - d / 2;
    const next = [];
    poly.forEach((p, i) => {
      const q = poly[(i + 1) % poly.length];
      const sp = side(p);
      const sq = side(q);
      if (sp <= 0) next.push(p);
      if ((sp < 0 && sq > 0) || (sp > 0 && sq < 0)) {
        const t = sp / (sp - sq);
        next.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]);
      }
    });
    poly = next;
  });
  return `${toPath(poly)} Z`;
}

/*
  buildBase - the part of one composition that does not depend on the
  locations, computed once at module load: the land dots (from
  lib/worldLand.js), the hairline links between some of them and the
  decorative nodes, all projected into that view's own coordinate
  space. `place` is the projection used for the named locations; it
  defaults to `project`.
*/
function buildBase({ width, height, project, place = project, step, crop, mobile = false, bendAt, chamfer, minGap, hitRadius }) {
  const field = buildDotField({ step, ...crop });
  return {
    width,
    height,
    mobile,
    project,
    place,
    bendAt,
    chamfer,
    minGap,
    hitRadius,
    viewBox: `0 0 ${width} ${height}`,
    // [x, y, edge, bright] - arrays, so the cursor effect can read x/y
    // by index without allocating.
    dots: field.dots.map((d) => { const [x, y] = project([d.lon, d.lat]); return [fmt(x), fmt(y), d.edge, d.bright]; }),
    linksPath: field.links.map(([lonA, latA, lonB, latB]) => toPath([project([lonA, latA]), project([lonB, latB])])).join(' '),
    decor: DECOR_NODE_COORDS.map((coords) => project(coords)),
  };
}

/*
  placeLocations - a composition with the loaded locations on it: the
  named nodes' display positions and hit areas, and the signal routes
  to the hub. Computed when the locations arrive (see NetworkMap).
*/
function placeLocations(base, locations, hub) {
  const { bendAt, chamfer, minGap, hitRadius } = base;
  const placed = separateNodes(locations, hub, base.place, minGap);
  const radiusOf = (loc) => (isNetworkNode(loc) ? hitRadius.network : hitRadius.office);
  const hits = {};
  locations.forEach((loc) => {
    hits[loc.id] = hitArea(
      placed[loc.id],
      radiusOf(loc),
      locations.filter((other) => other.id !== loc.id).map((other) => ({ point: placed[other.id], radius: radiusOf(other) })),
    );
  });
  const routes = locations.filter((l) => l.id !== hub.id).map((loc) => {
    const a = placed[loc.id];
    const b = placed[hub.id];
    const points = Math.abs(loc.coordinates[0] - hub.coordinates[0]) > 30 ? longRoute(a, b, bendAt) : shortRoute(a, b, chamfer);
    return { id: loc.id, points, toHub: toPath(points), fromHub: toPath([...points].reverse()) };
  });
  return { ...base, hub, points: placed, hits, routes };
}

const DESKTOP_VIEW = buildBase({
  width: VIEWBOX_W,
  height: VIEWBOX_H,
  project: (coords) => projectCoordinates(coords, VIEWBOX_W, VIEWBOX_H),
  step: 3.5,
  crop: {},
  bendAt: 0.39,
  chamfer: 4,
  // view units; the map is ~0.55-0.7 px per unit on desktop
  minGap: 42,
  hitRadius: { office: 30, network: 26 },
});

// Mobile: a portrait composition. The crop runs from western North
// America to just past India, latitude is stretched a little so the
// continents fill the taller frame, and the dot field sits as a band
// with room above and below it for the location labels.
const MOBILE_W = 400;
const MOBILE_H = 500;
const MOBILE_CROP = { lonMin: -134, lonMax: 108, latMin: -48, latMax: 74 };
const MOBILE_BAND_TOP = 104;
const MOBILE_LAT_SCALE = 2.25;
const MOBILE_LABEL_BASE = 90; // network labels sit above the band, their bottom edge here
const MOBILE_LABEL_STACK = 2; // how many network labels fit above the band at one side

const projectMobile = ([lon, lat]) => [
  ((lon - MOBILE_CROP.lonMin) / (MOBILE_CROP.lonMax - MOBILE_CROP.lonMin)) * MOBILE_W,
  MOBILE_BAND_TOP + (MOBILE_CROP.latMax - lat) * MOBILE_LAT_SCALE,
];
// A named location outside the mobile crop is held just inside the edge
// of the dot field, so its node is never drawn off the frame.
const MOBILE_EDGE = 14;
const within = (value, min, max) => Math.min(Math.max(value, min), max);
const placeMobile = (coords) => {
  const [x, y] = projectMobile(coords);
  return [
    within(x, MOBILE_EDGE, MOBILE_W - MOBILE_EDGE),
    within(y, MOBILE_BAND_TOP + MOBILE_EDGE, MOBILE_BAND_TOP + (MOBILE_CROP.latMax - MOBILE_CROP.latMin) * MOBILE_LAT_SCALE - MOBILE_EDGE),
  ];
};

const MOBILE_VIEW = buildBase({
  width: MOBILE_W,
  height: MOBILE_H,
  project: projectMobile,
  place: placeMobile,
  step: 4,
  crop: MOBILE_CROP,
  mobile: true,
  bendAt: 0.39,
  chamfer: 3,
  // view units; the map is ~0.7-0.94 px per unit on phones, so these
  // give each node a tap target of roughly 44px and up
  minGap: 34,
  hitRadius: { office: 32, network: 32 },
});

// Where an office's label sits on desktop: at the end of its teal lead,
// below and to the right of the node (view units from the node), which
// leaves the space above and to the right free for a neighbour's.
const OFFICE_LABEL = { dx: 40, dy: 30 };
// Two offices can be close together on the map (Bengaluru and
// Bhubaneswar). The hub office keeps OFFICE_LABEL; every other office
// has its label above its node instead of below it, a little higher
// and closer in so that it also fits the narrowest desktop frame, and
// its lead lines go upward the same way. Two offices therefore never
// share a label position, whichever of them is selected.
const OTHER_OFFICE_LABEL = { dx: 26, dy: -46 };
const officeLabel = (loc, hub) => (loc.id === hub.id ? OFFICE_LABEL : OTHER_OFFICE_LABEL);
// Mobile: only the hub office is labelled just below its node. Every
// other node, network or office, is labelled in the strip above the dot
// field, at the end of a trace up from the node.
const labelledAbove = (loc, hub) => isNetworkNode(loc) || loc.id !== hub.id;

// Where a network label sits on desktop, in pixels from its node: beside
// it and just above its centre (see MapLabels).
const NETWORK_LABEL = { side: 12, up: 6 };
// The clear space kept between a desktop label and another label or
// another node, in pixels. Generous on purpose: the real web fonts can
// set a label a little wider than a fallback font does.
const LABEL_CLEAR = { x: 10, y: 32 };
// A label that has to move is lifted at least this far, so the elbow
// trace back to its node is long enough to read.
const LABEL_MIN_RAISE = 12;
// A lifted label stays this far inside the top of the map frame.
const LABEL_FRAME_PAD = 4;
// How much room a node takes up, in view units: the pulsing ring drawn
// around it while it is selected (see MapContent).
const NODE_REACH = { office: 18, network: 14 };

/*
  raiseLabels - keeps the desktop labels apart. The saved hints
  (visual.labelSide, visual.labelRaise) are the starting position of a
  network label; this works out how much further each one has to be
  lifted so that its box keeps LABEL_CLEAR away from every office label,
  every network label placed before it and every other node.

  It works on real sizes: `frame` is the map frame's size and `sizes`
  the measured size of each label, both in pixels. The office label does
  not move (it stays at the end of its teal lead) and a network label
  only ever goes straight up, with its elbow trace following it, so the
  result depends on nothing but those sizes and the order of the
  locations. Returns { [id]: extra pixels of raise }.
*/
function raiseLabels(view, locations, frame, sizes) {
  const sx = frame.width / view.width;
  const sy = frame.height / view.height;
  const at = (loc) => [view.points[loc.id][0] * sx, view.points[loc.id][1] * sy];
  const obstacles = [];
  locations.forEach((loc) => {
    const [nx, ny] = at(loc);
    const reach = (isNetworkNode(loc) ? NODE_REACH.network : NODE_REACH.office) * sx;
    obstacles.push({ id: loc.id, left: nx - reach, right: nx + reach, top: ny - reach, bottom: ny + reach });
    if (isNetworkNode(loc)) return;
    // the office label: 7px past the end of its lead, centred on it
    const { width, height } = sizes[loc.id];
    const offset = officeLabel(loc, view.hub);
    const left = nx + offset.dx * sx + 7;
    const top = ny + offset.dy * sy - height / 2;
    obstacles.push({ id: loc.id, left, right: left + width, top, bottom: top + height });
  });
  const crowds = (a, b) => (
    a.left < b.right + LABEL_CLEAR.x && b.left < a.right + LABEL_CLEAR.x
    && a.top < b.bottom + LABEL_CLEAR.y && b.top < a.bottom + LABEL_CLEAR.y
  );
  const lifts = {};
  locations.filter(isNetworkNode).forEach((loc) => {
    const [nx, ny] = at(loc);
    const { width, height } = sizes[loc.id];
    const hint = loc.visual?.labelRaise || 0;
    const left = loc.visual?.labelSide === 'left' ? nx - NETWORK_LABEL.side - width : nx + NETWORK_LABEL.side;
    const boxAt = (raise) => {
      const bottom = ny - NETWORK_LABEL.up - raise;
      return { id: loc.id, left, right: left + width, top: bottom - height, bottom };
    };
    const highest = Math.max(hint, Math.floor(ny - NETWORK_LABEL.up - height - LABEL_FRAME_PAD));
    let raise = hint;
    // each pass clears the first thing in the way by going above it
    for (let pass = 0; pass <= obstacles.length && raise < highest; pass++) {
      const box = boxAt(raise);
      const inTheWay = obstacles.find((o) => o.id !== loc.id && crowds(box, o));
      if (!inTheWay) break;
      const clear = Math.ceil(ny - NETWORK_LABEL.up - (inTheWay.top - LABEL_CLEAR.y));
      raise = Math.min(highest, Math.max(clear, LABEL_MIN_RAISE));
    }
    if (raise > hint) lifts[loc.id] = raise - hint;
    obstacles.push(boxAt(raise));
  });
  return lifts;
}

// The cursor effect below runs on the desktop view only.
const WORLD_DOTS = DESKTOP_VIEW.dots;
const NETWORK_NODES = DESKTOP_VIEW.decor;

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
  const { status, locations } = useLocations();
  const [selectedId, setSelectedId] = useState(null);
  const [hoveredId, setHoveredId] = useState(null);

  // Until a node is chosen the hub is the selected one.
  const active = locations.find((l) => l.id === selectedId) || pickHub(locations);
  const activeId = active?.id ?? null;
  const loading = status === 'loading';

  if (!loading && locations.length === 0) return null;

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

        {loading ? <NetworkLoading /> : (
        <div className="grid lg:grid-cols-[1.5fr_1fr] gap-6 lg:gap-8 items-stretch">
          <NetworkMap
            locations={locations}
            activeId={activeId}
            hoveredId={hoveredId}
            onSelect={setSelectedId}
            onHover={setHoveredId}
            inView={inView}
          />
          <LocationPanel location={active} locations={locations} />
        </div>
        )}

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

// Stands in for an office's details while the locations load. It is
// never shown or read out: it gives the panel the height an office with
// a two-line address and two lines of hours has, so the sections below
// do not move when the locations arrive.
const SPACE = '\u00a0';
const PANEL_SPACE = { id: 'loading', type: 'office', city: SPACE, country: SPACE, region: SPACE, address: [SPACE, SPACE], phone: SPACE, email: SPACE, hours: [SPACE, SPACE] };

// The map's and the panel's frames, held while the locations load.
function NetworkLoading() {
  return (
    <div role="status" className="relative grid lg:grid-cols-[1.5fr_1fr] gap-6 lg:gap-8 items-stretch">
      <span className="sr-only">Loading locations</span>
      <div className="border border-line bg-bg-raised/40 animate-pulse motion-reduce:animate-none md:flex md:flex-col md:justify-center" aria-hidden="true">
        <div className="hidden md:block aspect-[1000/460]" />
        <div className="md:hidden aspect-[4/5]" />
      </div>
      <LocationPanel location={PANEL_SPACE} locations={[PANEL_SPACE]} loading />
    </div>
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
    // once, so this stays cheap regardless of the total dot count.
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

    // named locations (the offices and the network nodes): a slightly
    // stronger displacement cap, brighter ring, illuminated connecting
    // traces, and a bolder label while the cursor is near.
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
      <radialGradient id="networkNodeGlow" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stopColor="#a78bfa" stopOpacity="0.5" />
        <stop offset="100%" stopColor="#a78bfa" stopOpacity="0" />
      </radialGradient>
    </defs>
  );
}

const TEAL = '#2dd4bf';
const LILAC = '#a78bfa';

function MapContent({ view, locations, activeId, hoveredId, onSelect, onHover, inView, fx }) {
  const HUB = view.hub;
  const [bx, by] = view.points[HUB.id];
  const hubActive = activeId === HUB.id;
  const fade = `transition-opacity duration-1000 motion-reduce:transition-none ${inView ? 'opacity-100' : 'opacity-0'}`;

  return (
    <>
      <MapDefs />

      {/* the engineering-network dot field, arranged as the world's
          land: interior dots stay subtle, dots on a coast are slightly
          more defined, and a sparse fixed set is a little stronger.
          There is no drawn coastline - the continents exist only as
          this arrangement. fx (desktop only) registers each dot so the
          cursor-scan effect can reach the ones near the pointer without
          touching React state. */}
      <g className={fade}>
        <path d={view.linksPath} fill="none" stroke="rgba(167,139,250,0.2)" strokeWidth="0.8" />
        {view.dots.map(([x, y, edge, bright], i) => (
          <circle
            key={i}
            cx={x} cy={y}
            r={bright ? 2.2 : edge ? 1.7 : 1.5}
            fill={bright ? 'rgba(237,239,240,0.7)' : edge ? 'rgba(237,239,240,0.42)' : 'rgba(237,239,240,0.22)'}
            className={fx ? 'transition-[opacity,transform] duration-200 ease-out' : undefined}
            style={fx ? { transformBox: 'fill-box', transformOrigin: 'center' } : undefined}
            ref={fx ? (el) => fx.registerDot(i, el) : undefined}
          />
        ))}
      </g>

      {/* decorative network traces - a mesh feel, not claiming offices */}
      <g className={fade}>
        {TRACE_TARGETS.map((idx, i) => {
          const [nx, ny] = view.decor[idx];
          const pathD = `M ${fmt(bx)} ${fmt(by)} L ${fmt(nx)} ${fmt(ny)}`;
          return (
            <React.Fragment key={idx}>
              <path
                d={pathD}
                fill="none"
                stroke="rgba(167,139,250,0.14)"
                strokeWidth="1"
                strokeDasharray="3 4"
                className={fx ? 'transition-[opacity,stroke-width] duration-200 ease-out' : undefined}
                ref={fx ? (el) => fx.registerLocationListItem(HUB.id, 'meshPaths', i, el) : undefined}
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
        })}
      </g>

      {/* signal routes between the named locations - board-style traces
          with 45-degree bends. The selected node's route brightens and
          one pulse travels along it toward that node; with Bengaluru
          selected, each route carries a pulse in toward the hub. */}
      <g className={fade}>
        {view.routes.map((route, i) => {
          const selected = route.id === activeId;
          const strokeOpacity = selected ? 0.85 : hubActive ? 0.42 : 0.2;
          const showPulse = inView && (selected || hubActive);
          return (
            <React.Fragment key={route.id}>
              <path
                d={route.toHub}
                fill="none"
                stroke={LILAC}
                strokeOpacity={strokeOpacity}
                strokeWidth={selected ? 1.3 : 1}
                strokeLinejoin="round"
                className="transition-[stroke-opacity] duration-300 motion-reduce:transition-none"
              />
              {route.points.slice(1, -1).map(([px, py], bend) => (
                <circle key={bend} cx={fmt(px)} cy={fmt(py)} r="1.5" fill={LILAC} opacity={strokeOpacity} />
              ))}
              {showPulse && (
                <circle
                  key={`${route.id}-${activeId}`}
                  r="2.2"
                  fill={selected ? LILAC : TEAL}
                  className="motion-reduce:hidden office-signal-travel"
                  style={{
                    offsetPath: `path('${selected ? route.fromHub : route.toHub}')`,
                    offsetRotate: '0deg',
                    animationDelay: `${i * 1.4}s`,
                  }}
                />
              )}
            </React.Fragment>
          );
        })}
      </g>

      {/* decorative network nodes - dim, unlabeled, not selectable.
          fx gives each a subtle magnetic displacement toward the
          cursor (capped ~8px) plus a brightness lift when nearby. */}
      <g>
        {view.decor.map(([x, y], i) => (
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

      {/* named ALLSEMIS locations, at their real coordinates. The
          office keeps its teal treatment; a network node uses the same
          node language in lilac, smaller and quieter. The office is
          drawn first so a nearby network node is never hidden by the
          office's glow. Hit areas are a separate layer at the end. */}
      {[...locations].sort((a, b) => Number(isNetworkNode(a)) - Number(isNetworkNode(b))).map((loc) => {
        const [x, y] = view.points[loc.id];
        const network = isNetworkNode(loc);
        const color = network ? LILAC : TEAL;
        const isActive = loc.id === activeId;
        const isHovered = loc.id === hoveredId;
        const hoverOnly = isHovered && !isActive;
        // where this node's label goes (see officeLabel, labelledAbove)
        const lead = officeLabel(loc, HUB);
        const turn = Math.sign(lead.dy);
        // the teal lead: straight first when the label is further away
        // than its 45-degree run reaches, then the run, then 10 across
        const run = lead.dx - 10;
        const straight = Math.abs(lead.dy) - run;
        const above = labelledAbove(loc, HUB);
        if (fx) fx.setLocationOrigin(loc.id, x, y);
        // office / network sizes: core, steady ring, pulsing ring, glow, cursor boost ring
        const size = network
          ? { core: isActive ? 5.5 : isHovered ? 4.4 : 3.2, ring: 10.5, pulse: 14, glow: 25, boost: 16 }
          : { core: isActive ? 8 : isHovered ? 6.2 : 5, ring: 14, pulse: 18, glow: 34, boost: 22 };
        return (
          <g
            key={loc.id}
            className={fx ? 'transition-transform duration-200 ease-out' : undefined}
            style={fx ? { transformOrigin: `${x}px ${y}px` } : undefined}
            ref={fx ? (el) => fx.registerLocation(loc.id, 'group', el) : undefined}
          >
            {/* an office's two lead lines (desktop composition) */}
            {!network && !view.mobile && (
              <g className={`transition-opacity duration-700 motion-reduce:transition-none ${inView ? 'opacity-100' : 'opacity-0'}`}>
                <path
                  d={`M ${x} ${y}${straight > 0 ? ` V ${y + straight * turn}` : ''} L ${x + run} ${y + lead.dy} L ${x + lead.dx} ${y + lead.dy}`}
                  fill="none" stroke="rgba(45,212,191,0.4)" strokeWidth="1.2"
                  className={fx ? 'transition-opacity duration-200 ease-out' : undefined}
                  ref={fx ? (el) => fx.registerLocationListItem(loc.id, 'leads', 0, el) : undefined}
                />
                <path
                  d={`M ${x} ${y} L ${x - 48} ${y + 38 * turn} L ${x - 120} ${y + 38 * turn}`}
                  fill="none" stroke="rgba(167,139,250,0.35)" strokeWidth="1.2"
                  className={fx ? 'transition-opacity duration-200 ease-out' : undefined}
                  ref={fx ? (el) => fx.registerLocationListItem(loc.id, 'leads', 1, el) : undefined}
                />
                <circle cx={x + lead.dx} cy={y + lead.dy} r="2.5" fill="#2dd4bf" opacity="0.6" />
                <circle cx={x - 120} cy={y + 38 * turn} r="2.5" fill="#a78bfa" opacity="0.5" />
              </g>
            )}

            {/* mobile composition: a short trace from the node to its
                label, which sits in the free space around the dot field */}
            {view.mobile && (
              <g className={`transition-opacity duration-700 motion-reduce:transition-none ${inView ? 'opacity-100' : 'opacity-0'}`}>
                <path
                  d={above ? `M ${fmt(x)} ${fmt(y - 9)} V ${MOBILE_LABEL_BASE + 8}` : `M ${fmt(x)} ${fmt(y + 20)} V ${fmt(y + 30)}`}
                  fill="none" stroke={color} strokeOpacity={isActive ? 0.6 : 0.3} strokeWidth="1"
                />
                <circle cx={fmt(x)} cy={above ? MOBILE_LABEL_BASE + 8 : fmt(y + 30)} r="1.8" fill={color} opacity={isActive ? 0.8 : 0.45} />
              </g>
            )}

            {isActive && (
              <circle cx={x} cy={y} r={size.glow} fill={network ? 'url(#networkNodeGlow)' : 'url(#officeNodeGlow)'} className="motion-reduce:hidden office-node-pulse" />
            )}
            {isActive && (
              <circle cx={x} cy={y} r={size.pulse} fill="none" stroke={color} strokeWidth="1" opacity="0.5" className="motion-reduce:hidden office-node-ring" />
            )}
            {/* a quiet, slow halo on an unselected network node, so it
                reads as a live node and not as one more dot */}
            {network && !isActive && (
              <circle
                cx={x} cy={y} r="7" fill="none" stroke={LILAC} strokeWidth="1"
                className="signal-node-idle"
                style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
              />
            )}
            {/* fx-only boost ring: a second, non-animated ring the
                cursor effect can brighten directly. Kept separate from
                office-node-ring above because that ring's opacity is
                already driven by a looping CSS keyframe, which would
                otherwise fight a plain style.opacity write every frame.
                While one node is hovered, its neighbours' boost rings
                are dropped, so only the node a click would select
                lights up. */}
            {fx && (!hoveredId || isHovered) && (
              <circle
                cx={x} cy={y} r={size.boost} fill="none" stroke={color} strokeWidth="1.4" opacity="0"
                className="transition-opacity duration-200 ease-out"
                ref={(el) => fx.registerLocation(loc.id, 'boostRing', el)}
              />
            )}

            <circle
              cx={x} cy={y}
              r={size.core}
              fill={color}
              fillOpacity={isActive || isHovered || network ? 1 : 0.6}
              stroke={color}
              strokeOpacity={isActive || isHovered || network ? 1 : 0.6}
              strokeWidth="1"
              className="transition-all duration-300"
            />
            {/* selected: the steady ring. Hovered or focused (and not
                selected): a brighter, heavier ring with a faint fill,
                so it is obvious which of two close nodes a click will
                select before it is made. */}
            {(isActive || isHovered) && (
              <circle
                cx={x} cy={y} r={size.ring}
                fill={hoverOnly ? color : 'none'}
                fillOpacity={hoverOnly ? 0.16 : undefined}
                stroke={color}
                strokeWidth={hoverOnly ? 1.6 : 1}
                opacity={hoverOnly ? 0.95 : 0.6}
              />
            )}
          </g>
        );
      })}

      {/* hit areas - one invisible target per named node, larger than
          the visible dot and drawn above every node, so a node's glow
          or ring can never take a click meant for its neighbour. Where
          two would overlap they are already split along the midline
          (see hitArea above). On mobile the trace from a network node
          up to its label is tappable too. */}
      <g>
        {view.mobile && locations.filter((loc) => labelledAbove(loc, HUB)).map((loc) => {
          const [x, y] = view.points[loc.id];
          return (
            <path
              key={loc.id}
              d={`M ${fmt(x)} ${fmt(y - 9)} V ${MOBILE_LABEL_BASE + 8}`}
              fill="none" stroke="transparent" strokeWidth="30" pointerEvents="stroke"
              aria-hidden="true"
              onClick={() => onSelect(loc.id)}
            />
          );
        })}
        {locations.map((loc) => {
          const network = isNetworkNode(loc);
          return (
            <path
              key={loc.id}
              d={view.hits[loc.id]}
              fill="transparent"
              tabIndex={0}
              role="button"
              aria-label={`${loc.city}, ${loc.country} ${network ? 'network node' : 'office'}`}
              aria-pressed={loc.id === activeId}
              onMouseEnter={() => onHover(loc.id)}
              onMouseLeave={() => onHover(null)}
              onFocus={() => onHover(loc.id)}
              onBlur={() => onHover(null)}
              onClick={() => onSelect(loc.id)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(loc.id); } }}
              className="cursor-pointer outline-none"
            />
          );
        })}
      </g>
    </>
  );
}

function MapLabels({ view, locations, activeId, hoveredId, onSelect, onHover, fx }) {
  // Desktop: the labels are measured where they are drawn, and a
  // network label that would touch or crowd another label or node is
  // lifted clear of it (see raiseLabels). `lifts` holds that extra
  // raise for each label. It is worked out again when the map frame or
  // a label changes size (a resize, the web fonts arriving), and before
  // the browser paints, so a label is never seen in the wrong place.
  // The map frame is the element the labels are positioned in.
  const labelEls = useRef({});
  const [lifts, setLifts] = useState({});
  useLayoutEffect(() => {
    const labels = locations.map((loc) => labelEls.current[loc.id]).filter(Boolean);
    const frame = labels[0]?.closest('[data-map-frame]');
    if (view.mobile || !frame) return undefined;
    const measure = () => {
      const size = { width: frame.clientWidth, height: frame.clientHeight };
      const sizes = {};
      locations.forEach((loc) => {
        const el = labelEls.current[loc.id];
        if (el && el.offsetWidth) sizes[loc.id] = { width: el.offsetWidth, height: el.offsetHeight };
      });
      // nothing to measure while this composition is not on screen
      if (!size.width || locations.some((loc) => !sizes[loc.id])) return;
      const next = raiseLabels(view, locations, size, sizes);
      setLifts((prev) => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next));
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(measure);
    observer.observe(frame);
    labels.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [view, locations]);
  // Mobile: the network labels share the strip above the dot field,
  // one stack at each side of it. A stack holds two labels; with more
  // nodes than that on one side, the selected node's label takes the
  // second place and the rest are left to their nodes.
  const stacks = { left: [], right: [] };
  if (view.mobile) {
    locations.filter((loc) => labelledAbove(loc, view.hub)).forEach((loc) => stacks[view.points[loc.id][0] > view.width / 2 ? 'right' : 'left'].push(loc.id));
    Object.values(stacks).forEach((ids) => {
      const at = ids.indexOf(activeId);
      if (at >= MOBILE_LABEL_STACK) ids.splice(MOBILE_LABEL_STACK - 1, 0, ...ids.splice(at, 1));
    });
  }
  return (
    <>
      {locations.map((loc) => {
        const [px, py] = view.points[loc.id];
        const network = isNetworkNode(loc);
        const isActive = loc.id === activeId;
        const isHovered = loc.id === hoveredId;
        const cityColor = isActive ? (network ? 'text-accent' : 'text-turquoise') : isHovered ? 'text-text' : 'text-text-dim';
        const text = (
          <>
            <span className={`block font-mono uppercase whitespace-nowrap transition-colors ${cityColor}`} style={{ fontSize: network ? '11px' : '12px', letterSpacing: '0.06em' }}>
              {loc.city}
            </span>
            <span className={`block font-mono uppercase whitespace-nowrap transition-colors ${isHovered && !isActive ? 'text-text-dim' : 'text-text-faint'} ${view.mobile ? 'tracking-[0.1em]' : 'tracking-[0.14em]'} ${view.mobile && network ? 'text-[0.5rem]' : network ? 'text-[0.55rem]' : 'text-[0.58rem]'}`}>
              {loc.country} / {network ? 'Network' : loc.isHeadquarters ? 'HQ' : 'Office'}
            </span>
          </>
        );

        // Mobile: labels sit clear of the dot field - network nodes
        // above it, the office just below its node - and are tappable,
        // since two nodes in India are close together at this size.
        // The nodes in the SVG remain the keyboard/screen-reader
        // controls, so these duplicates are hidden from both.
        if (view.mobile) {
          const alignRight = px > view.width / 2;
          const above = labelledAbove(loc, view.hub);
          const place = above ? stacks[alignRight ? 'right' : 'left'].indexOf(loc.id) : 0;
          if (place >= MOBILE_LABEL_STACK) return null;
          return (
            <button
              key={loc.id}
              type="button"
              tabIndex={-1}
              aria-hidden="true"
              onClick={() => onSelect(loc.id)}
              className={`absolute px-1.5 py-1.5 bg-bg/70 rounded-sm ${alignRight ? 'text-right' : 'text-left'}`}
              style={{
                [alignRight ? 'right' : 'left']: '6px',
                top: `${((above ? MOBILE_LABEL_BASE : py + 30) / view.height) * 100}%`,
                transform: above ? `translateY(-${(place + 1) * 100}%)` : undefined,
              }}
            >
              {text}
            </button>
          );
        }

        const x = (px / view.width) * 100;
        const y = (py / view.height) * 100;
        const box = `bg-bg/70 backdrop-blur-[1px] px-1 rounded-sm${fx ? ' transition-transform duration-200 ease-out' : ''}`;
        const labelRef = fx ? (el) => fx.registerLocation(loc.id, 'label', el) : undefined;
        // Desktop labels select their node on click and share its hover
        // state. The nodes in the SVG remain the keyboard and
        // screen-reader controls, so these are hidden from both.
        const labelButton = (extra = '') => ({
          type: 'button',
          tabIndex: -1,
          onClick: () => onSelect(loc.id),
          onMouseEnter: () => onHover(loc.id),
          onMouseLeave: () => onHover(null),
          className: `block text-left cursor-pointer ${extra}`,
        });

        // The office label sits at the end of the office's teal lead,
        // below and to the right of the node, clear of any network
        // node to its north-east.
        if (!network) {
          const offset = officeLabel(loc, view.hub);
          return (
            <div
              key={loc.id}
              ref={(el) => { labelEls.current[loc.id] = el; }}
              aria-hidden="true"
              className="absolute"
              style={{
                left: `${((px + offset.dx) / view.width) * 100}%`,
                top: `${((py + offset.dy) / view.height) * 100}%`,
                transform: 'translate(7px, -50%)',
              }}
            >
              <button {...labelButton()}>
                <div className={box} ref={labelRef}>{text}</div>
              </button>
            </div>
          );
        }

        // A network label sits beside its node, on the side set in the
        // location data. `labelRaise` lifts it away from a neighbouring
        // node (it goes up and to the side, an office's label down
        // and to the right) and adds a short elbow trace back to
        // the node, so the pairing stays obvious. The saved raise is
        // the starting point: a label that would still touch or crowd
        // another label or node is lifted further (`lifts`), and its
        // elbow trace grows with it.
        const onLeft = loc.visual?.labelSide === 'left';
        const raise = (loc.visual?.labelRaise || 0) + (lifts[loc.id] || 0);
        return (
          <div
            key={loc.id}
            aria-hidden="true"
            className="absolute pointer-events-none"
            style={{ left: `${x}%`, top: `${y}%` }}
          >
            {raise > 0 && (
              <>
                <span className="absolute w-px bg-accent/50" style={{ left: 0, bottom: 9, height: raise + 4 }} />
                <span className="absolute h-px bg-accent/50" style={{ [onLeft ? 'right' : 'left']: 0, bottom: raise + 13, width: 10 }} />
              </>
            )}
            <div
              ref={(el) => { labelEls.current[loc.id] = el; }}
              className="absolute pointer-events-auto"
              style={{ [onLeft ? 'right' : 'left']: NETWORK_LABEL.side, bottom: NETWORK_LABEL.up + raise }}
            >
              <button {...labelButton()}>
                <div className={`${box} ${onLeft ? 'text-right' : ''}`} ref={labelRef}>{text}</div>
              </button>
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
  // The two compositions with these locations placed on them.
  const views = useMemo(() => {
    const hub = pickHub(locations);
    return hub ? { desktop: placeLocations(DESKTOP_VIEW, locations, hub), mobile: placeLocations(MOBILE_VIEW, locations, hub) } : null;
  }, [locations]);
  // Desktop-only "engineering scan field" cursor interaction (see
  // useCursorFX above). fx.enabled is false on touch/coarse-pointer
  // devices and under prefers-reduced-motion, in which case the mouse
  // handlers and every fx.register* call below are no-ops and the
  // network renders exactly as it did before this pass.
  const fx = useCursorFX();
  const { wrapRef: fxWrapRef, svgRef: fxSvgRef, scannerRef: fxScannerRef, handleMouseEnter, handleMouseMove, handleMouseLeave, enabled: fxEnabled } = fx;
  const fxForChildren = fxEnabled ? fx : null;
  const active = locations.find((l) => l.id === activeId);
  const mapLabel = `ALLSEMIS global engineering network${active ? `, ${active.city} selected` : ''}`;

  if (!views) return null;

  return (
    <div className="relative border border-line bg-bg-raised/40 overflow-hidden md:flex md:flex-col md:justify-center">
      {/* Desktop / tablet: full world, wide aspect. The frame stretches
          to the location panel's height, so the dot field is centred
          in it instead of sitting against the top edge. */}
      <div
        ref={fxWrapRef}
        onMouseEnter={handleMouseEnter}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        className="hidden md:block relative aspect-[1000/460]"
        data-map-frame
      >
        <svg
          ref={fxSvgRef}
          viewBox={DESKTOP_VIEW.viewBox}
          className="absolute inset-0 w-full h-full"
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-label={mapLabel}
        >
          <MapContent view={views.desktop} locations={locations} activeId={activeId} hoveredId={hoveredId} onSelect={onSelect} onHover={onHover} inView={inView} fx={fxForChildren} />
        </svg>
        <MapLabels view={views.desktop} locations={locations} activeId={activeId} hoveredId={hoveredId} onSelect={onSelect} onHover={onHover} fx={fxForChildren} />
        {fxEnabled && <CursorScanner fxRef={fxScannerRef} />}
      </div>

      {/* Mobile: the same world-node field in a portrait composition -
          North America through to India - in the same taller frame. */}
      <div className="md:hidden relative aspect-[4/5]">
        <svg viewBox={MOBILE_VIEW.viewBox} className="absolute inset-0 w-full h-full" preserveAspectRatio="xMidYMid meet" role="img" aria-label={mapLabel}>
          <MapContent view={views.mobile} locations={locations} activeId={activeId} hoveredId={hoveredId} onSelect={onSelect} onHover={onHover} inView={inView} />
        </svg>
        <MapLabels view={views.mobile} locations={locations} activeId={activeId} hoveredId={hoveredId} onSelect={onSelect} onHover={onHover} />
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

// The panel follows the selected node. An office shows the details
// saved for it (a detail left empty in the admin is left out). A
// network node shows only what is known about it - city, country,
// "Engineering Network" and "Network node" - and never an address,
// phone number, email or hours.
//
// Every location's content is laid in the same grid cell and only the
// selected one is visible, so the panel keeps the height of its tallest
// entry: selecting a node never makes the section jump.
function LocationPanel({ location, locations, loading = false }) {
  if (!location) return null;
  const rowLabel = 'font-mono text-[0.6rem] uppercase tracking-widest text-text-faint mb-1';
  return (
    <div className="relative border border-line bg-bg-raised/40 p-6 md:p-8 grid" aria-live="polite">
      {locations.map((loc) => {
        const network = isNetworkNode(loc);
        const selected = !loading && loc.id === location.id;
        return (
          <div key={loc.id} className={`col-start-1 row-start-1 ${selected ? '' : 'invisible'}`} aria-hidden={!selected}>
            <div className="flex items-center gap-2 mb-4">
              <span className={`h-1.5 w-1.5 rounded-full ${network ? 'bg-accent' : 'bg-turquoise'}`} />
              <span className={`font-mono text-[0.62rem] uppercase tracking-[0.2em] ${network ? 'text-accent' : 'text-turquoise'}`}>
                {network ? 'Engineering Network' : `${loc.region} / ${loc.isHeadquarters ? 'Headquarters' : 'Office'}`}
              </span>
            </div>
            <h3 className="font-display font-semibold text-2xl md:text-3xl tracking-tight mb-1">
              {loc.city}
            </h3>
            <p className="text-text-dim text-sm mb-6">{loc.country}</p>

            {network ? (
              <dl className="space-y-4 text-sm">
                <div>
                  <dt className={rowLabel}>Type</dt>
                  <dd className="text-text-dim">Network node</dd>
                </div>
              </dl>
            ) : (
              <dl className="space-y-4 text-sm">
                {loc.address.length > 0 && (
                <div>
                  <dt className={rowLabel}>Address</dt>
                  <dd className="text-text-dim leading-relaxed">
                    {loc.address.map((line, i) => <span key={i} className="block">{line}</span>)}
                  </dd>
                </div>
                )}
                {loc.phone && (
                <div>
                  <dt className={rowLabel}>Phone</dt>
                  <dd className="text-text-dim">{loc.phone}</dd>
                </div>
                )}
                {loc.email && (
                <div>
                  <dt className={rowLabel}>Email</dt>
                  <dd className="text-text-dim">{loc.email}</dd>
                </div>
                )}
                {loc.hours.length > 0 && (
                <div>
                  <dt className={rowLabel}>Hours</dt>
                  <dd className="text-text-dim leading-relaxed">
                    {loc.hours.map((line, i) => <span key={i} className="block">{line}</span>)}
                  </dd>
                </div>
                )}
              </dl>
            )}
          </div>
        );
      })}
    </div>
  );
}
