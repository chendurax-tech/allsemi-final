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
    label: 'Employer',
    sub: 'Building a technical team',
    intro: 'Tell us what you are building, where the technical requirement sits, and the kind of talent you need.',
  },
  {
    key: 'candidate',
    label: 'Candidate',
    sub: 'Exploring your next role',
    intro: 'Tell us where your experience sits and the kind of engineering opportunity you are looking for.',
  },
  {
    key: 'general',
    label: 'General',
    sub: 'Partnerships, press, anything else',
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
      <ContactHero />
      <RouteSelector active={type} onSelect={selectType} />
      <ContactFormSection type={type} />
      <ContactInfoPanel />
      <ContactFinalCta />
    </>
  );
}

/* ============ HERO ============ */
function ContactHero() {
  const [ref, inView] = useInView(0.01);
  return (
    <section ref={(el) => { ref.current = el; }} className="relative border-b border-line pt-24 md:pt-32 pb-14 md:pb-16 overflow-hidden">
      <TechnicalGrid className="opacity-[0.05]" />
      <div className="relative max-w-4xl mx-auto px-5 md:px-10">
        <MeasurementLabel className="block mb-4">CONTACT / 01</MeasurementLabel>
        <h1
          className={`font-display font-bold text-4xl sm:text-5xl md:text-6xl tracking-tight leading-[1.02] transition-all duration-700 motion-reduce:transition-none ${
            inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          }`}
        >
          How can we help you?
        </h1>
        <p className="mt-5 max-w-lg text-base md:text-lg text-text-dim leading-relaxed">
          Choose the route that fits, and the form adapts to what we need to know.
        </p>
      </div>
    </section>
  );
}

/* ============ ROUTE SELECTOR ============ */
function RouteSelector({ active, onSelect }) {
  const [ref, inView] = useInView(0.2);
  const activeIndex = ROUTES.findIndex(r => r.key === active);

  return (
    <section ref={(el) => { ref.current = el; }} className="border-b border-line py-12 md:py-16">
      <div className="max-w-4xl mx-auto px-5 md:px-10">
        <div
          role="tablist"
          aria-label="Contact route"
          className="flex flex-col md:flex-row md:items-stretch border border-line"
        >
          {ROUTES.map((r, i) => {
            const isActive = active === r.key;
            return (
              <React.Fragment key={r.key}>
                <button
                  role="tab"
                  aria-selected={isActive}
                  id={`route-tab-${r.key}`}
                  aria-controls="contact-form-panel"
                  onClick={() => onSelect(r.key)}
                  className={`group flex-1 text-left px-5 py-6 md:py-8 transition-all duration-400 motion-reduce:transition-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent focus-visible:-outline-offset-2 ${
                    isActive ? 'bg-white/[0.03]' : 'hover:bg-white/[0.015]'
                  } ${inView ? 'opacity-100' : 'opacity-0'}`}
                  style={{ transitionDelay: `${i * 90}ms` }}
                >
                  <span className={`block w-2 h-2 rounded-full mb-4 transition-all duration-300 ${
                    isActive ? 'bg-accent shadow-[0_0_8px_rgba(167,139,250,0.8)]' : 'bg-text-faint'
                  }`} />
                  <span className={`block font-display font-bold text-xl md:text-2xl tracking-tight transition-colors ${
                    isActive ? 'text-text' : 'text-text-dim group-hover:text-text'
                  }`}>
                    {r.label}
                  </span>
                  <span className="block text-text-faint text-xs mt-1.5">{r.sub}</span>
                </button>
                {i < ROUTES.length - 1 && <span className="hidden md:block w-px bg-line" />}
              </React.Fragment>
            );
          })}
        </div>
        {/* Active-route line, echoing the site's signal-line language */}
        <div className="relative h-0.5 mt-0 bg-line">
          <span
            className="absolute top-0 h-0.5 bg-gradient-to-r from-accent to-accent-2 transition-all duration-400 ease-out motion-reduce:transition-none"
            style={{ width: `${100 / ROUTES.length}%`, left: `${(100 / ROUTES.length) * activeIndex}%` }}
          />
        </div>
      </div>
    </section>
  );
}

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
