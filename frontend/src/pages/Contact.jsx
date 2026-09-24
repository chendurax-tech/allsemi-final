import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  useInView, useRadialHighlight,
  TechnicalGrid, MeasurementLabel, LocationScan,
} from '../lib/motionPrimitives.jsx';
import { SECTORS } from '../components/Expertise.jsx';

/*
  Contact - a dedicated, standalone contact experience, distinct in
  composition from the landing page's Enquiry section (which stays
  completely untouched). Where Enquiry is editorial/immersive and
  lives inside the landing page's scroll, this page is interactive
  and information-rich: a route selector (Employer / Candidate /
  General) drives a dynamic form, backed by the same real ALLSEMI
  contact details and a restored technical scanning visual on the
  location panel.

  Route is driven by ?type=employer|candidate|general (default:
  general), so CTAs elsewhere in the app can deep-link straight into
  the right experience without three separate page implementations.
*/

const OFFICE = {
  address: ['No.73, Nallurahalli, Whitefield', 'Bangalore South, Karnataka 560066'],
  phone: '+91-70901-23400',
  email: 'sales@allsemi.com',
  hours: ['Mon-Fri, 9:00 AM - 6:30 PM IST', 'Mon-Fri, 8:30 PM - 6:00 AM EST'],
};

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

const HIRING_REQUIREMENTS = ['Permanent Staffing', 'Project Staffing', 'RPO', 'Specialised Search'];
const EXPERIENCE_LEVELS = ['Entry-Level', 'Mid-Level', 'Senior', 'Lead / Principal', 'Director+'];

function normalizeType(raw) {
  return ROUTES.some(r => r.key === raw) ? raw : 'general';
}

export default function Contact() {
  const [searchParams, setSearchParams] = useSearchParams();
  const type = normalizeType(searchParams.get('type'));

  useEffect(() => {
    document.title = 'ALLSEMI | Contact';
  }, []);

  function selectType(key) {
    setSearchParams(key === 'general' ? {} : { type: key }, { replace: false });
  }

  return (
    <>
      <SignalConnection active={type} onSelect={selectType} />
      <ContactFormSection type={type} />
      <ContactInfoPanel />
      <ContactFinalCta />
    </>
  );
}

/* ============ THE SIGNAL CONNECTION ============
   The page's signature interaction: a small technical network
   (Employer / Candidate / General -> ALLSEMI -> Enquiry) that the
   visitor drives directly. Selecting a node sends a brief signal
   along its path, the heading transitions to route-specific copy,
   and the form below updates - "connection established" is the
   feeling, not a looping animation. Desktop and mobile use genuinely
   different node geometry (horizontal vs vertical), not one layout
   scaled down. */
function SignalConnection({ active, onSelect }) {
  const [ref, inView] = useInView(0.01);
  const glowRef = useRadialHighlight();
  const [hovered, setHovered] = useState(null);
  const [isMobile, setIsMobile] = useState(false);
  const [signalTick, setSignalTick] = useState(0);
  const activeRoute = ROUTES.find(r => r.key === active);
  const prevActive = React.useRef(active);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  // Replay the signal-travel animation whenever the route actually changes.
  useEffect(() => {
    if (prevActive.current !== active) {
      prevActive.current = active;
      setSignalTick(t => t + 1);
    }
  }, [active]);

  const geo = isMobile ? MOBILE_GEO : DESKTOP_GEO;

  return (
    <section
      ref={(el) => { ref.current = el; }}
      className="relative border-b border-line pt-24 md:pt-32 pb-10 md:pb-14 overflow-hidden"
    >
      <TechnicalGrid className="opacity-[0.05]" />
      <div className="relative max-w-6xl mx-auto px-5 md:px-10">
        <MeasurementLabel className="block mb-4">CONTACT / 01 &middot; SIGNAL / {activeRoute.num}</MeasurementLabel>

        {/* Route-reactive heading - remounts on route change so the
            enter transition replays; a quick fade/rise/tracking
            settle rather than an instant swap. */}
        <h1
          key={active}
          className={`signal-heading-enter font-display font-bold text-4xl sm:text-5xl md:text-6xl tracking-tight leading-[1.02] max-w-2xl ${
            inView ? '' : 'opacity-0'
          }`}
        >
          {activeRoute.heading}
        </h1>
        <p key={`${active}-sub`} className="signal-heading-enter-delay mt-5 max-w-lg text-base md:text-lg text-text-dim leading-relaxed">
          {activeRoute.intro}
        </p>

        {/* ---- the network ---- */}
        <div
          ref={glowRef}
          className="radial-highlight relative mt-12 md:mt-16"
        >
          <svg
            viewBox={geo.viewBox}
            className="w-full h-auto"
            role="tablist"
            aria-label="Contact route"
            style={{ maxHeight: isMobile ? 'none' : 320 }}
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
                SYSTEM / ALLSEMI
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

// Mobile: vertical stack - a genuinely different composition, not the
// desktop network compressed.
const MOBILE_GEO = {
  viewBox: '0 0 320 700',
  nodes: [
    { key: 'employer', x: 160, y: 40, labelX: 16, labelY: 5, anchor: 'start', path: 'M160,40 C 260,150 260,280 160,360' },
    { key: 'candidate', x: 160, y: 180, labelX: 16, labelY: 5, anchor: 'start', path: 'M160,180 L160,360' },
    { key: 'general', x: 160, y: 300, labelX: 16, labelY: 5, anchor: 'start', path: 'M160,300 C 60,330 60,330 160,360' },
  ],
  hub: { x: 160, y: 380, labelX: 0, labelY: -26, anchor: 'middle' },
  hubPath: 'M160,380 L160,500',
  dest: { x: 160, y: 500, labelX: 0, labelY: 30, anchor: 'middle' },
};

/* ============ DYNAMIC FORM ============ */
function ContactFormSection({ type }) {
  const route = ROUTES.find(r => r.key === type);
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({});
  const [touched, setTouched] = useState({});

  useEffect(() => {
    setSubmitted(false);
    setForm({});
    setTouched({});
  }, [type]);

  function set(field, value) {
    setForm(f => ({ ...f, [field]: value }));
  }
  function markTouched(field) {
    setTouched(t => ({ ...t, [field]: true }));
  }

  const nameValid = (form.name || '').trim().length >= 2;
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email || '');
  const messageValid = (form.message || '').trim().length >= 2;
  const canSubmit = nameValid && emailValid && messageValid;

  function handleSubmit(e) {
    e.preventDefault();
    setTouched({ name: true, email: true, message: true });
    if (!canSubmit) return;
    // Frontend-only: structured payload ready for a future backend
    // endpoint. Nothing is sent or stored - see the note in the
    // success state below.
    const payload = {
      type,
      name: form.name || '',
      email: form.email || '',
      phone: form.phone || '',
      company: form.company || '',
      role: form.role || '',
      domain: form.domain || '',
      experience: form.experience || '',
      skills: form.skills || '',
      location: form.location || '',
      portfolio: form.portfolio || '',
      message: form.message || '',
      resume: form.resumeName || '',
    };
    // eslint-disable-next-line no-console
    console.log('Contact form payload (frontend-only, not submitted):', payload);
    setSubmitted(true);
  }

  return (
    <section className="border-b border-line py-16 md:py-24">
      <div className="max-w-3xl mx-auto px-5 md:px-10">
        <div
          key={type}
          id="contact-form-panel"
          role="tabpanel"
          aria-labelledby={`route-tab-${type}`}
          className="contact-form-transition"
        >
          {submitted ? (
            <SuccessState route={route} onReset={() => setSubmitted(false)} />
          ) : (
            <>
              <MeasurementLabel className="block mb-4">{route.label} Enquiry</MeasurementLabel>
              <p className="text-text-dim text-base md:text-lg leading-relaxed mb-10 max-w-xl">
                {route.intro}
              </p>

              <form onSubmit={handleSubmit} noValidate className="space-y-6">
                <Field label="Name" required>
                  <input
                    type="text"
                    value={form.name || ''}
                    onChange={e => set('name', e.target.value)}
                    onBlur={() => markTouched('name')}
                    autoComplete="name"
                    aria-required="true"
                    aria-invalid={touched.name && !nameValid}
                    className={inputClass(touched.name && !nameValid)}
                  />
                  {touched.name && !nameValid && <FieldError>Name is required.</FieldError>}
                </Field>

                <Field label={type === 'employer' ? 'Work Email' : 'Email'} required>
                  <input
                    type="email"
                    value={form.email || ''}
                    onChange={e => set('email', e.target.value)}
                    onBlur={() => markTouched('email')}
                    autoComplete="email"
                    aria-required="true"
                    aria-invalid={touched.email && !emailValid}
                    className={inputClass(touched.email && !emailValid)}
                  />
                  {touched.email && !emailValid && <FieldError>Enter a valid email address.</FieldError>}
                </Field>

                <Field label="Phone">
                  <input type="tel" value={form.phone || ''} onChange={e => set('phone', e.target.value)} autoComplete="tel" className={inputClass(false)} />
                </Field>

                {type === 'employer' && (
                  <>
                    <Field label="Company">
                      <input type="text" value={form.company || ''} onChange={e => set('company', e.target.value)} className={inputClass(false)} />
                    </Field>
                    <Field label="Role / Requirement">
                      <input type="text" value={form.role || ''} onChange={e => set('role', e.target.value)} placeholder="e.g. Senior RTL Design Engineer" className={inputClass(false)} />
                    </Field>
                    <Field label="Engineering Domain">
                      <select value={form.domain || ''} onChange={e => set('domain', e.target.value)} className={selectClass}>
                        <option value="">Select a domain</option>
                        {SECTORS.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                      </select>
                    </Field>
                    <Field label="Hiring Requirement">
                      <select value={form.experience || ''} onChange={e => set('experience', e.target.value)} className={selectClass}>
                        <option value="">Select a requirement</option>
                        {HIRING_REQUIREMENTS.map(h => <option key={h} value={h}>{h}</option>)}
                      </select>
                    </Field>
                  </>
                )}

                {type === 'candidate' && (
                  <>
                    <Field label="Current Role">
                      <input type="text" value={form.role || ''} onChange={e => set('role', e.target.value)} placeholder="e.g. RTL Design Engineer" className={inputClass(false)} />
                    </Field>
                    <Field label="Experience">
                      <select value={form.experience || ''} onChange={e => set('experience', e.target.value)} className={selectClass}>
                        <option value="">Select a level</option>
                        {EXPERIENCE_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
                      </select>
                    </Field>
                    <Field label="Engineering Domain">
                      <select value={form.domain || ''} onChange={e => set('domain', e.target.value)} className={selectClass}>
                        <option value="">Select a domain</option>
                        {SECTORS.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                      </select>
                    </Field>
                    <Field label="Skills">
                      <input type="text" value={form.skills || ''} onChange={e => set('skills', e.target.value)} placeholder="e.g. SystemVerilog, UVM, RTL" className={inputClass(false)} />
                    </Field>
                    <Field label="LinkedIn / Portfolio">
                      <input type="url" value={form.portfolio || ''} onChange={e => set('portfolio', e.target.value)} placeholder="https://" className={inputClass(false)} />
                    </Field>
                    <Field label="Preferred Location">
                      <input type="text" value={form.location || ''} onChange={e => set('location', e.target.value)} className={inputClass(false)} />
                    </Field>
                    <Field label="CV / Resume">
                      <input
                        type="file"
                        accept=".pdf,.doc,.docx"
                        onChange={e => set('resumeName', e.target.files?.[0]?.name || '')}
                        className="w-full text-sm text-text-dim file:mr-4 file:py-2 file:px-4 file:border file:border-line-strong file:bg-transparent file:text-text file:text-xs file:uppercase file:tracking-wide"
                      />
                    </Field>
                  </>
                )}

                {type === 'general' && (
                  <Field label="Subject">
                    <input type="text" value={form.role || ''} onChange={e => set('role', e.target.value)} className={inputClass(false)} />
                  </Field>
                )}

                <Field label="Message" required>
                  <textarea
                    rows={4}
                    value={form.message || ''}
                    onChange={e => set('message', e.target.value)}
                    onBlur={() => markTouched('message')}
                    aria-required="true"
                    aria-invalid={touched.message && !messageValid}
                    className={`${inputClass(touched.message && !messageValid)} resize-none`}
                  />
                  {touched.message && !messageValid && <FieldError>Tell us a little about what you need.</FieldError>}
                </Field>

                <p className="text-text-faint text-xs leading-relaxed border border-dashed border-line-strong px-3 py-2">
                  This form shows the intended contact experience. Backend submission is not yet connected.
                </p>

                <button type="submit" className="inline-flex text-sm font-semibold px-6 py-3 bg-text text-bg hover:bg-accent transition-colors">
                  Send {route.label} Enquiry
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

function Field({ label, required, children }) {
  return (
    <div>
      <label className="block font-mono text-xs uppercase tracking-wider text-text-dim mb-2">
        {label}{required && <span className="text-accent"> *</span>}
      </label>
      {children}
    </div>
  );
}
function FieldError({ children }) {
  return <p className="font-mono text-xs text-red-400 mt-2">! {children}</p>;
}
function inputClass(hasError) {
  return `w-full bg-transparent border-b text-text text-base py-2 focus:outline-none transition-colors ${
    hasError ? 'border-red-500' : 'border-line-strong focus:border-accent'
  }`;
}
const selectClass = 'w-full bg-bg border-b border-line-strong text-text text-base py-2 focus:outline-none focus:border-accent';

function SuccessState({ route, onReset }) {
  return (
    <div className="py-6">
      <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-accent/10 mb-5">
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-accent">
          <path d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <MeasurementLabel className="block mb-2">Received</MeasurementLabel>
      <h3 className="font-display font-semibold text-2xl mb-3">Thank you.</h3>
      <p className="text-text-dim mb-2 max-w-md">
        Your {route.label.toLowerCase()} enquiry has been prepared. This is the frontend experience only -
        submissions are not yet connected to a live backend or stored anywhere.
      </p>
      <button onClick={onReset} className="font-mono text-xs text-accent hover:text-accent-2 transition-colors uppercase tracking-widest mt-6">
        ← Submit another
      </button>
    </div>
  );
}

/* ============ CONTACT INFO PANEL ============ */
function ContactInfoPanel() {
  const [ref, inView] = useInView(0.1);
  const glowRef = useRadialHighlight();
  const rows = [
    { k: 'LOCATION', v: OFFICE.address, scan: true },
    { k: 'PHONE', v: [OFFICE.phone], link: `tel:${OFFICE.phone.replace(/[\s-]/g, '')}` },
    { k: 'EMAIL', v: [OFFICE.email], link: `mailto:${OFFICE.email}` },
    { k: 'HOURS', v: OFFICE.hours },
  ];

  return (
    <section ref={(el) => { ref.current = el; }} className="border-b border-line py-16 md:py-24">
      <div className="max-w-4xl mx-auto px-5 md:px-10">
        <MeasurementLabel className="block mb-4">Reach Us Directly</MeasurementLabel>
        <h2 className="font-display font-semibold text-2xl md:text-3xl tracking-tight mb-10">Contact information.</h2>

        <div ref={glowRef} className="radial-highlight relative border border-line-strong p-6 md:p-10 overflow-hidden">
          <TechnicalGrid className="opacity-[0.04]" />
          <div className="relative grid sm:grid-cols-2 gap-8 md:gap-10">
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

/* ============ FINAL CTA ============ */
function ContactFinalCta() {
  return (
    <section className="py-20 md:py-28 text-center">
      <div className="max-w-2xl mx-auto px-5 md:px-10">
        <h2 className="font-display font-bold text-2xl md:text-4xl tracking-tight mb-4">
          Prefer the direct route?
        </h2>
        <p className="text-text-dim text-base mb-8 max-w-md mx-auto">
          Reach us on the landing page's own enquiry section, or use the details above.
        </p>
        <Link to="/#enquiry" className="inline-flex text-sm font-semibold px-6 py-3 border border-line-strong hover:border-accent transition-colors">
          Open Landing Enquiry
        </Link>
      </div>
    </section>
  );
}
