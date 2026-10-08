import React, { useEffect, useRef, useState } from 'react';
import { useSeo, fixedPageSeo } from '../lib/seo.js';
import { useSearchParams } from 'react-router-dom';
import {
  useInView, useRadialHighlight,
  TechnicalGrid, MeasurementLabel, LocationScan,
} from '../lib/motionPrimitives.jsx';
import { useSiteContact } from '../lib/usePublicData.js';
import RequirementForm from '../components/forms/RequirementForm.jsx';
import ApplicationForm from '../components/forms/ApplicationForm.jsx';
import EnquiryForm from '../components/forms/EnquiryForm.jsx';
import { TEXT_ACTION } from '../components/forms/FormStatus.jsx';

/*
  Contact - the dedicated, standalone contact experience. Per the
  current architecture, the landing page carries only the engineering-
  network/location visual and a single "Get in Touch" CTA; the full
  interactive contact experience - route selection, the forms, and the
  location details - lives only here.

  The signature interaction is SignalConnection: a small technical
  network (Employer / Candidate / General -> ALLSEMIS -> Enquiry) the
  visitor drives directly. Selecting a node sends a brief signal along
  its path, the heading transitions to route-specific copy, and the
  form below updates.

  Route is driven by ?type=employer|candidate|general (default:
  general), so CTAs elsewhere in the app can deep-link straight into
  the right experience without three separate page implementations.

  Each route has a real form that submits to the backend:
  - employer  -> RequirementForm (Hire Talent, POST /api/requirements)
  - candidate -> ApplicationForm (a general application, POST
                 /api/applications)
  - general   -> a question, "What are you looking to do?", that either
                 switches to one of the two routes above or reveals
                 EnquiryForm (POST /api/enquiries)
  The employer and candidate routes also offer the short enquiry form
  for someone who would sooner just send a message.

  Contact details (the info panel and the closing CTA) come from the
  site settings edited in the admin, through useSiteContact(), and
  from nowhere else: no contact detail is written in this file. While
  they load the info panel holds its rows open, so the page does not
  jump. A detail left empty in the admin is left out. If the settings
  cannot be loaded the panel says so in one line and the closing CTA
  is left out; the route selector and the forms do not depend on them.
*/

const ROUTES = [
  {
    key: 'employer',
    num: '01',
    label: 'Employer',
    sub: 'Building a technical team',
    heading: 'Build your engineering team.',
    intro: 'Tell us what you are building, where the technical requirement sits, and the kind of talent you need.',
  },
  {
    key: 'candidate',
    num: '02',
    label: 'Candidate',
    sub: 'Exploring your next role',
    heading: 'Find where your engineering fits.',
    intro: 'Tell us where your experience sits and the kind of engineering opportunity you are looking for.',
  },
  {
    key: 'general',
    num: '03',
    label: 'General',
    sub: 'Partnerships, press, anything else',
    heading: "Let's start a conversation.",
    intro: 'Tell us what you would like to talk about, and the right person will get back to you.',
  },
];

function normalizeType(raw) {
  return ROUTES.some(r => r.key === raw) ? raw : 'general';
}

export default function Contact() {
  const [searchParams, setSearchParams] = useSearchParams();
  const type = normalizeType(searchParams.get('type'));
  const contact = useSiteContact();

  useSeo(fixedPageSeo('/contact'));

  function selectType(key) {
    setSearchParams(key === 'general' ? {} : { type: key }, { replace: false });
  }

  return (
    <>
      <SignalConnection active={type} onSelect={selectType} />
      <ContactFormSection type={type} onSelectType={selectType} />
      <ContactInfoPanel contact={contact} />
      <ContactFinalCta contact={contact} />
    </>
  );
}

/* ============ THE SIGNAL CONNECTION ============
   The page's signature interaction: a small technical network
   (Employer / Candidate / General -> ALLSEMIS -> Enquiry) that the
   visitor drives directly. Selecting a node sends a brief signal
   along its path, the heading transitions to route-specific copy,
   and the form below updates - "connection established" is the
   feeling, not a looping animation.

   Desktop keeps the exact SVG network diagram, completely unchanged.
   Below md, it is replaced by MobileRouteSelector - a genuinely
   different, mobile-native composition (not the same diagram
   shrunk): a stacked list of full-width, comfortably tappable rows
   that still carries the same connected/technical visual language
   (a lit node per row, mono labels, an active-state glow, a closing
   "SYSTEM / ALLSEMIS -> ENQUIRY" line). The split is pure CSS
   (hidden md:block / md:hidden), not JS device detection. */
function SignalConnection({ active, onSelect }) {
  const [ref, inView] = useInView(0.01);
  const glowRef = useRadialHighlight();
  const [hovered, setHovered] = useState(null);
  const [signalTick, setSignalTick] = useState(0);
  const activeRoute = ROUTES.find(r => r.key === active);
  const prevActive = React.useRef(active);

  // Replay the signal-travel animation whenever the route actually changes.
  useEffect(() => {
    if (prevActive.current !== active) {
      prevActive.current = active;
      setSignalTick(t => t + 1);
    }
  }, [active]);

  const geo = DESKTOP_GEO;

  return (
    <section
      ref={(el) => { ref.current = el; }}
      className="relative border-b border-line pt-20 sm:pt-24 md:pt-32 pb-8 sm:pb-10 md:pb-14 overflow-hidden"
    >
      <TechnicalGrid className="opacity-[0.05]" />
      <div className="relative max-w-6xl mx-auto px-5 md:px-10">
        <MeasurementLabel className="block mb-4">CONTACT / 01 &middot; SIGNAL / {activeRoute.num}</MeasurementLabel>

        {/* Route-reactive heading - remounts on route change so the
            enter transition replays; a quick fade/rise/tracking
            settle rather than an instant swap. */}
        <h1
          key={active}
          className={`signal-heading-enter font-display font-bold text-[2.1rem] leading-[1.08] sm:text-5xl sm:leading-[1.02] md:text-6xl tracking-tight max-w-2xl ${
            inView ? '' : 'opacity-0'
          }`}
        >
          {activeRoute.heading}
        </h1>
        <p key={`${active}-sub`} className="signal-heading-enter-delay mt-4 sm:mt-5 max-w-lg text-base md:text-lg text-text-dim leading-relaxed">
          {activeRoute.intro}
        </p>

        {/* ---- desktop: the network diagram, unchanged ---- */}
        <div
          ref={glowRef}
          className="radial-highlight relative mt-12 md:mt-16 hidden md:block"
        >
          <svg
            viewBox={geo.viewBox}
            className="w-full h-auto"
            role="tablist"
            aria-label="Contact route"
            style={{ maxHeight: 320 }}
          >
            {/* base paths (quiet) */}
            {geo.nodes.map(n => (
              <path key={`base-${n.key}`} d={n.path} fill="none" stroke="rgba(237,239,240,0.09)" strokeWidth="1" />
            ))}
            <path d={geo.hubPath} fill="none" stroke="rgba(237,239,240,0.09)" strokeWidth="1" />

            {/* charged path for the active route (and hub->destination) */}
            {geo.nodes.map(n => n.key === active && (
              <path
                key={`charged-${n.key}`}
                d={n.path}
                fill="none"
                stroke="url(#signalGradient)"
                strokeWidth="1.4"
                className="signal-path-charged"
              />
            ))}
            <path d={geo.hubPath} fill="none" stroke="url(#signalGradient)" strokeWidth="1.4" className="signal-path-charged" />

            {/* traveling signal dots - remounted each time the route changes */}
            {geo.nodes.map(n => n.key === active && (
              <circle
                key={`sig-${n.key}-${signalTick}`}
                r="4"
                fill="var(--color-accent, #a78bfa)"
                className="signal-dot-play"
                style={{ offsetPath: `path('${n.path}')`, offsetRotate: '0deg', animationDelay: '0ms' }}
              />
            ))}
            <circle
              key={`sig-hub-${signalTick}`}
              r="4"
              fill="var(--color-accent-2, #c084fc)"
              className="signal-dot-play"
              style={{ offsetPath: `path('${geo.hubPath}')`, offsetRotate: '0deg', animationDelay: '650ms' }}
            />

            <defs>
              <linearGradient id="signalGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#a78bfa" />
                <stop offset="100%" stopColor="#c084fc" />
              </linearGradient>
            </defs>

            {/* route nodes */}
            {geo.nodes.map(n => {
              const route = ROUTES.find(r => r.key === n.key);
              const isActive = active === n.key;
              const isHovered = hovered === n.key;
              return (
                <g
                  key={n.key}
                  role="tab"
                  aria-selected={isActive}
                  id={`route-tab-${n.key}`}
                  aria-controls="contact-form-panel"
                  tabIndex={0}
                  onClick={() => onSelect(n.key)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(n.key); } }}
                  onMouseEnter={() => setHovered(n.key)}
                  onMouseLeave={() => setHovered(null)}
                  onFocus={() => setHovered(n.key)}
                  onBlur={() => setHovered(null)}
                  className="cursor-pointer focus-visible:outline-none"
                  style={{ transform: `translate(${n.x}px, ${n.y}px)` }}
                >
                  <rect x="-16" y="-30" width="150" height="70" fill="transparent" />
                  <circle
                    r={isActive ? 9 : isHovered ? 8 : 6}
                    fill={isActive ? '#a78bfa' : 'rgba(237,239,240,0.5)'}
                    className="transition-all duration-300 motion-reduce:transition-none"
                    style={{ filter: isActive ? 'drop-shadow(0 0 6px rgba(167,139,250,0.8))' : 'none' }}
                  />
                  {(isActive || isHovered) && (
                    <circle r={isActive ? 16 : 13} fill="none" stroke="#a78bfa" strokeWidth="1" opacity="0.35" />
                  )}
                  <text x={n.labelX} y={n.labelY} textAnchor={n.anchor} className="font-mono select-none" style={{ fontSize: '11px', letterSpacing: '0.05em', fill: isActive ? '#edeff0' : 'rgba(237,239,240,0.55)', fontWeight: isActive ? 700 : 400 }}>
                    {route.num} {route.label.toUpperCase()}
                  </text>
                  {(isActive || isHovered) && (
                    <text x={n.labelX} y={n.labelY + 15} textAnchor={n.anchor} className="font-mono select-none" style={{ fontSize: '9px', fill: 'rgba(167,139,250,0.75)' }}>
                      {isActive ? 'CONNECTION ESTABLISHED' : 'SELECT ROUTE'}
                    </text>
                  )}
                </g>
              );
            })}

            {/* hub */}
            <g style={{ transform: `translate(${geo.hub.x}px, ${geo.hub.y}px)` }}>
              <circle r="10" fill="none" stroke="#a78bfa" strokeWidth="1.4" />
              <circle r="3" fill="#a78bfa" />
              <text x={geo.hub.labelX} y={geo.hub.labelY} textAnchor={geo.hub.anchor} className="font-mono select-none" style={{ fontSize: '10px', letterSpacing: '0.08em', fill: 'rgba(237,239,240,0.7)' }}>
                SYSTEM / ALLSEMIS
              </text>
            </g>

            {/* destination */}
            <g style={{ transform: `translate(${geo.dest.x}px, ${geo.dest.y}px)` }}>
              <rect x="-6" y="-6" width="12" height="12" fill="none" stroke="rgba(167,139,250,0.6)" strokeWidth="1.2" />
              <text x={geo.dest.labelX} y={geo.dest.labelY} textAnchor={geo.dest.anchor} className="font-mono select-none" style={{ fontSize: '10px', letterSpacing: '0.08em', fill: 'rgba(237,239,240,0.55)' }}>
                INPUT / ENQUIRY
              </text>
            </g>
          </svg>
        </div>

        {/* ---- mobile: stacked, tappable route selector ---- */}
        <div className="md:hidden mt-8">
          <MobileRouteSelector active={active} onSelect={onSelect} />
        </div>
      </div>
    </section>
  );
}

// Desktop: horizontal network, three route nodes on the left feeding
// a central hub, which feeds the form below via a destination marker.
const DESKTOP_GEO = {
  viewBox: '0 0 1000 300',
  nodes: [
    { key: 'employer', x: 70, y: 60, labelX: 18, labelY: -18, anchor: 'start', path: 'M70,60 C 320,60 320,150 500,150' },
    { key: 'candidate', x: 70, y: 150, labelX: 18, labelY: -18, anchor: 'start', path: 'M70,150 L500,150' },
    { key: 'general', x: 70, y: 240, labelX: 18, labelY: 28, anchor: 'start', path: 'M70,240 C 320,240 320,150 500,150' },
  ],
  hub: { x: 500, y: 150, labelX: 0, labelY: -22, anchor: 'middle' },
  hubPath: 'M500,150 L900,150',
  dest: { x: 900, y: 150, labelX: 0, labelY: -18, anchor: 'middle' },
};

/* Mobile route selector - a stacked list, not the desktop diagram
   scaled down. Each row is a full-width button (min-height 56px, well
   over the ~44px comfortable touch-target minimum) carrying the same
   node/signal visual language as the desktop network: a ringed dot
   that lights up and glows when active, mono technical labels, and a
   closing line naming the same "SYSTEM / ALLSEMIS" hub the desktop
   diagram shows, so the underlying concept still reads as one
   connected system. */
function MobileRouteSelector({ active, onSelect }) {
  return (
    <div>
      <div role="tablist" aria-label="Contact route" className="flex flex-col gap-2.5">
        {ROUTES.map((route) => {
          const isActive = active === route.key;
          return (
            <button
              key={route.key}
              type="button"
              role="tab"
              aria-selected={isActive}
              id={`route-tab-${route.key}`}
              aria-controls="contact-form-panel"
              onClick={() => onSelect(route.key)}
              className={`relative flex min-h-[56px] items-center gap-4 border px-4 py-3.5 text-left transition-colors duration-300 motion-reduce:transition-none ${
                isActive ? 'border-accent bg-accent/[0.07]' : 'border-line-strong active:border-accent/50'
              }`}
            >
              <span className="relative flex h-8 w-8 shrink-0 items-center justify-center">
                <span className={`absolute inset-0 rounded-full border transition-colors ${isActive ? 'border-accent' : 'border-line-strong'}`} />
                <span
                  className={`h-2 w-2 rounded-full transition-all duration-300 motion-reduce:transition-none ${isActive ? 'bg-accent' : 'bg-text-faint'}`}
                  style={{ filter: isActive ? 'drop-shadow(0 0 5px rgba(167,139,250,0.85))' : 'none' }}
                />
              </span>
              <span className="min-w-0 flex-1">
                <span className={`block font-mono text-[0.66rem] uppercase tracking-[0.16em] ${isActive ? 'text-accent' : 'text-text-faint'}`}>
                  {route.num} {route.label}
                </span>
                <span className={`block mt-0.5 text-sm leading-snug ${isActive ? 'text-text' : 'text-text-dim'}`}>
                  {route.sub}
                </span>
              </span>
              <span
                className={`shrink-0 font-mono text-sm transition-opacity duration-300 ${isActive ? 'opacity-100 text-accent' : 'opacity-0'}`}
                aria-hidden="true"
              >
                &rarr;
              </span>
            </button>
          );
        })}
      </div>
      <div className="mt-4 flex items-center gap-3 px-1" aria-hidden="true">
        <span className="h-px flex-1 bg-line-strong" />
        <span className="font-mono text-[0.58rem] uppercase tracking-[0.16em] text-text-faint whitespace-nowrap">
          System / ALLSEMIS &rarr; Enquiry
        </span>
        <span className="h-px flex-1 bg-line-strong" />
      </div>
    </div>
  );
}

/* ============ FORMS ============
   One panel per route, remounted (keyed by type) when the route
   changes so it fades in, as before. The forms themselves live in
   components/forms/. */
function ContactFormSection({ type, onSelectType }) {
  const panelRef = useRef(null);
  // True when the route was changed from inside the panel (the
  // general route's question). The button that was pressed is gone
  // after the switch, so focus is moved to the new panel.
  const focusPanel = useRef(false);

  useEffect(() => {
    if (!focusPanel.current) return;
    focusPanel.current = false;
    panelRef.current?.focus({ preventScroll: true });
  }, [type]);

  function switchRoute(key) {
    focusPanel.current = true;
    onSelectType(key);
  }

  return (
    <section className="border-b border-line py-12 sm:py-16 md:py-24">
      <div className="max-w-3xl mx-auto px-5 md:px-10">
        <div
          key={type}
          ref={panelRef}
          id="contact-form-panel"
          role="tabpanel"
          tabIndex={-1}
          aria-labelledby={`route-tab-${type}`}
          className="contact-form-transition focus:outline-none"
        >
          {type === 'employer' && (
            <RoutePanel
              label="Hire Talent"
              title="Tell us about the requirement."
              intro="Three short sections: who you are, the role, and the details. A job description can be attached."
              backLabel="Back to the requirement form"
              messageIntro="Not ready to fill in a full requirement? Write to us here."
              enquiryType="HIRING"
            >
              {(onSentChange) => <RequirementForm onSentChange={onSentChange} />}
            </RoutePanel>
          )}
          {type === 'candidate' && (
            <RoutePanel
              label="Candidate Application"
              title="Send your profile."
              intro="Five short steps. Your resume is the only attachment needed, and you can review everything before sending."
              backLabel="Back to the application"
              messageIntro="Have a question before applying? Write to us here."
              enquiryType="CAREER"
            >
              {(onSentChange) => <ApplicationForm onSentChange={onSentChange} />}
            </RoutePanel>
          )}
          {type === 'general' && <GeneralPanel onSwitchRoute={switchRoute} />}
        </div>
      </div>
    </section>
  );
}

/* The employer and candidate panels: the route's own form, with the
   option to send a short message instead. Both forms stay mounted and
   the one not in use is hidden, so switching back and forth does not
   throw away what was typed. `children` is a function that receives
   onSentChange for the route's form: once either form has been
   accepted, the heading and the prompt above it are put away and only
   the confirmation is left. */
function RoutePanel({ label, title, intro, backLabel, messageIntro, enquiryType, children }) {
  const [asMessage, setAsMessage] = useState(false);
  const [sent, setSent] = useState(false);
  return (
    <>
      <MeasurementLabel className="block mb-4">{label}</MeasurementLabel>
      {!sent && (
        <>
          <h2 className="font-display font-semibold text-2xl md:text-3xl tracking-tight mb-3">
            {asMessage ? 'Send a message.' : title}
          </h2>
          <p className="text-text-dim text-base leading-relaxed mb-4 max-w-xl">{asMessage ? messageIntro : intro}</p>
          <button type="button" onClick={() => setAsMessage((value) => !value)} className={TEXT_ACTION}>
            {asMessage ? <>&larr; {backLabel}</> : <>Or just send a message &rarr;</>}
          </button>
        </>
      )}
      <div className={sent ? '' : 'mt-10'} hidden={asMessage}>{children(setSent)}</div>
      <div className={sent ? '' : 'mt-10'} hidden={!asMessage}><EnquiryForm type={enquiryType} onSentChange={setSent} /></div>
    </>
  );
}

/* The general route opens with a question. Two answers belong to the
   other routes and switch the page to them; the other two are enquiry
   types and reveal the enquiry form.

   The four answers are buttons, not a radio group: in a radio group
   the arrow keys select as they move, and here that would switch the
   whole page while someone was only looking through the options. */
const INTENTS = [
  { key: 'hire', label: 'Hire engineers', sub: 'Share a hiring requirement with us', route: 'employer' },
  { key: 'role', label: 'Find a role', sub: 'Apply with your profile and resume', route: 'candidate' },
  { key: 'partner', label: 'Partner with us', sub: 'Propose a partnership or collaboration', enquiryType: 'PARTNERSHIP' },
  { key: 'general', label: 'General enquiry', sub: 'Press, questions, anything else', enquiryType: 'GENERAL' },
];

function GeneralPanel({ onSwitchRoute }) {
  const [enquiryType, setEnquiryType] = useState(null);
  // Once the enquiry has been accepted the question is put away and
  // only the confirmation is left.
  const [sent, setSent] = useState(false);

  return (
    <>
      <MeasurementLabel className="block mb-4">General Enquiry</MeasurementLabel>
      {!sent && (
        <>
          <h2 id="contact-intent" className="font-display font-semibold text-2xl md:text-3xl tracking-tight mb-8">
            What are you looking to do?
          </h2>

          <div role="group" aria-labelledby="contact-intent" className="grid gap-2.5 sm:grid-cols-2">
            {INTENTS.map((intent) => {
              const isActive = Boolean(intent.enquiryType) && intent.enquiryType === enquiryType;
              return (
                <button
                  key={intent.key}
                  type="button"
                  aria-pressed={intent.enquiryType ? isActive : undefined}
                  onClick={() => (intent.route ? onSwitchRoute(intent.route) : setEnquiryType(intent.enquiryType))}
                  className={`group relative flex min-h-[64px] items-center gap-4 border px-4 py-3.5 text-left transition-colors duration-300 motion-reduce:transition-none focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-accent ${
                    isActive ? 'border-accent bg-accent/[0.07]' : 'border-line-strong hover:border-accent/50'
                  }`}
                >
                  <span className="relative flex h-8 w-8 shrink-0 items-center justify-center" aria-hidden="true">
                    <span className={`absolute inset-0 rounded-full border transition-colors ${isActive ? 'border-accent' : 'border-line-strong'}`} />
                    <span className={`h-2 w-2 rounded-full transition-colors duration-300 motion-reduce:transition-none ${isActive ? 'bg-accent' : 'bg-text-faint group-hover:bg-text-dim'}`} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={`block font-mono text-[0.66rem] uppercase tracking-[0.16em] ${isActive ? 'text-accent' : 'text-text'}`}>
                      {intent.label}
                    </span>
                    <span className="block mt-0.5 text-sm leading-snug text-text-dim">{intent.sub}</span>
                  </span>
                  {intent.route && (
                    <span className="shrink-0 font-mono text-sm text-text-dim transition-colors group-hover:text-accent" aria-hidden="true">&rarr;</span>
                  )}
                </button>
              );
            })}
          </div>

          <p className="sr-only" aria-live="polite">{enquiryType ? 'The enquiry form is shown below.' : ''}</p>
        </>
      )}

      {enquiryType && (
        <div className={sent ? '' : 'contact-form-transition mt-12'}>
          <EnquiryForm type={enquiryType} onSentChange={setSent} />
        </div>
      )}
    </>
  );
}

/* ============ CONTACT INFO PANEL ============
   `lines` is how many lines a row holds open while the details load. */
const phoneLink = (phone) => `tel:${phone.replace(/[\s-]/g, '')}`;

function ContactInfoPanel({ contact }) {
  const [ref, inView] = useInView(0.1);
  const glowRef = useRadialHighlight();
  const loading = contact.status === 'loading';
  const failed = contact.status === 'error';
  const rows = [
    { k: 'LOCATION', v: contact.address, lines: 2, scan: true },
    { k: 'PHONE', v: contact.phone ? [contact.phone] : [], lines: 1, link: phoneLink(contact.phone) },
    { k: 'EMAIL', v: contact.email ? [contact.email] : [], lines: 1, link: `mailto:${contact.email}` },
    { k: 'HOURS', v: contact.hours, lines: 2 },
  ].filter((row) => loading || row.v.length > 0);

  // Nothing saved at all: the section is left out.
  if (!loading && !failed && rows.length === 0) return null;

  return (
    <section ref={(el) => { ref.current = el; }} className="border-b border-line py-12 sm:py-16 md:py-24">
      <div className="max-w-4xl mx-auto px-5 md:px-10">
        <MeasurementLabel className="block mb-4">Reach Us Directly</MeasurementLabel>
        <h2 className="font-display font-semibold text-2xl md:text-3xl tracking-tight mb-8 md:mb-10">Contact information.</h2>

        <div ref={glowRef} className="radial-highlight relative border border-line-strong p-5 sm:p-6 md:p-10 overflow-hidden">
          <TechnicalGrid className="opacity-[0.04]" />
          {failed && <p role="alert" className="relative font-mono text-sm text-text-dim">Contact details could not be loaded.</p>}
          {loading && <span className="sr-only" role="status">Loading contact details</span>}
          <div className="relative grid sm:grid-cols-2 gap-6 sm:gap-8 md:gap-10">
            {rows.map((row, i) => (
              <div
                key={row.k}
                className={`relative transition-all duration-500 motion-reduce:transition-none ${
                  inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'
                } ${row.scan ? 'overflow-hidden' : ''}`}
                style={{ transitionDelay: `${i * 100}ms` }}
              >
                {row.scan && <LocationScan />}
                <div className="relative">
                  <span className="font-mono text-[0.62rem] uppercase tracking-[0.24em] text-accent">{row.k}</span>
                  <div className="font-mono text-sm leading-relaxed mt-2">
                    {loading && Array.from({ length: row.lines }, (_, j) => (
                      <p key={j} className="block" aria-hidden="true">
                        <span className="inline-block h-2.5 w-44 max-w-full bg-line animate-pulse motion-reduce:animate-none" />
                      </p>
                    ))}
                    {row.v.map((line, j) =>
                      row.link ? (
                        <a key={j} href={row.link} className="block hover:text-accent transition-colors">{line}</a>
                      ) : (
                        <p key={j} className="block text-text-dim">{line}</p>
                      )
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ============ FINAL CTA ============
   Landing no longer has an in-page enquiry anchor to send visitors
   back to, so this closing CTA offers the two direct channels instead
   (call / email) rather than a broken "back to landing" link. */
function ContactFinalCta({ contact }) {
  const loading = contact.status === 'loading';
  // No address to write to and no number to call: nothing to offer.
  if (!loading && !contact.email && !contact.phone) return null;
  const held = loading ? ' invisible' : '';
  return (
    <section className="py-14 sm:py-20 md:py-28 text-center">
      <div className="max-w-2xl mx-auto px-5 md:px-10">
        <h2 className="font-display font-bold text-[1.6rem] leading-tight sm:text-2xl md:text-4xl tracking-tight mb-4">
          Prefer the direct route?
        </h2>
        <p className="text-text-dim text-base mb-8 max-w-md mx-auto">
          {loading || (contact.email && contact.phone) ? 'Call or email us' : contact.email ? 'Email us' : 'Call us'} directly, any time.
        </p>
        <div className="flex flex-col sm:flex-row sm:flex-wrap justify-center gap-3 sm:gap-4">
          {(loading || contact.email) && (
          <a
            href={loading ? undefined : `mailto:${contact.email}`}
            aria-hidden={loading || undefined}
            className={`inline-flex justify-center items-center min-h-[48px] text-sm font-semibold px-6 py-3 bg-text text-bg hover:bg-accent transition-colors${held}`}
          >
            Email {contact.email}
          </a>
          )}
          {(loading || contact.phone) && (
          <a
            href={loading ? undefined : phoneLink(contact.phone)}
            aria-hidden={loading || undefined}
            className={`inline-flex justify-center items-center min-h-[48px] text-sm font-semibold px-6 py-3 border border-line-strong hover:border-accent transition-colors${held}`}
          >
            Call {contact.phone}
          </a>
          )}
        </div>
      </div>
    </section>
  );
}
