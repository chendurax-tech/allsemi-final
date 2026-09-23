import React, { useState, useRef, useEffect } from 'react';

const PATHS = {
  hire: {
    label: 'Hire talent',
    code: 'RCT-01',
    nameLabel: 'Your name',
    emailLabel: 'Work email',
    extraLabel: 'Company',
    extraPlaceholder: 'e.g. Acme Semiconductors',
    extraType: 'text',
  },
  role: {
    label: 'Find my next role',
    code: 'RCT-02',
    nameLabel: 'Your name',
    emailLabel: 'Your email',
    extraLabel: 'Current role or background',
    extraPlaceholder: 'e.g. Senior RTL Design Engineer',
    extraType: 'text',
  },
  general: {
    label: 'General enquiry',
    code: 'RCT-03',
    nameLabel: 'Your name',
    emailLabel: 'Your email',
    extraLabel: 'Message',
    extraPlaceholder: 'How can we help?',
    extraType: 'textarea',
  },
};

const OFFICE = {
  address: ['No.73, Nallurahalli, Whitefield', 'Bangalore South, Karnataka 560066'],
  phone: '+91-70901-23400',
  email: 'sales@allsemi.com',
  hours: ['Mon-Fri, 9:00 AM - 6:30 PM IST', 'Mon-Fri, 8:30 PM - 6:00 AM EST'],
};

// Types out a string character-by-character when scrolled into view
function Typewriter({ text, className = '' }) {
  const ref = useRef(null);
  const [shown, setShown] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) { setShown(text); setDone(true); return; }

    const io = new IntersectionObserver(
      entries => {
        entries.forEach(e => {
          if (!e.isIntersecting) return;
          io.disconnect();
          let i = 0;
          const id = setInterval(() => {
            i++;
            setShown(text.slice(0, i));
            if (i >= text.length) { clearInterval(id); setDone(true); }
          }, 55);
        });
      },
      { threshold: 0.5 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [text]);

  return (
    <span ref={ref} className={className}>
      {shown}
      {!done && <span className="type-cursor">▌</span>}
    </span>
  );
}

// Reveals children letter-by-letter on scroll into view
function ScrollReveal({ children, delay = 0, className = '' }) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) { setVisible(true); return; }
    const io = new IntersectionObserver(
      entries => {
        entries.forEach(e => {
          if (e.isIntersecting) {
            setTimeout(() => setVisible(true), delay);
            io.disconnect();
          }
        });
      },
      { threshold: 0.3 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [delay]);

  return (
    <div
      ref={ref}
      className={`scroll-reveal ${visible ? 'in' : ''} ${className}`}
    >
      {children}
    </div>
  );
}

export default function Enquiry() {
  const [step, setStep] = useState(0);
  const [path, setPath] = useState('general');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [extra, setExtra] = useState('');
  const [touched, setTouched] = useState({ name: false, email: false });
  const [dir, setDir] = useState(1);
  const [submitted, setSubmitted] = useState(false);

  const config = PATHS[path];
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const nameValid = name.trim().length >= 2;
  const extraValid = extra.trim().length >= 2;

  function goTo(next) {
    setDir(next > step ? 1 : -1);
    setStep(next);
  }
  function choosePath(p) { setPath(p); setDir(1); setStep(1); }
  function reset() {
    setSubmitted(false);
    setDir(-1);
    setStep(0);
    setPath('general');
    setName(''); setEmail(''); setExtra('');
    setTouched({ name: false, email: false });
  }
  function submit() {
    setSubmitted(true);
    setTimeout(() => { setStep(3); }, 1400);
  }

  const steps = ['Route', 'Identity', 'Contact'];

  return (
    <section id="enquiry" className="enquiry-shell border-t border-line py-16 md:py-24 lg:py-32">
      {/* HEADER */}
      <div className="max-w-6xl mx-auto px-5 md:px-10 mb-10 md:mb-14">
        <div className="flex items-center gap-3 mb-4">
          <span className="node-dot" />
          <span className="font-mono text-[0.68rem] uppercase tracking-[0.24em] text-accent">
            GET IN TOUCH · 06
          </span>
        </div>
        <h2 className="font-display font-bold text-3xl md:text-5xl lg:text-6xl tracking-tight leading-tight max-w-4xl">
          Together we can shape the future of{' '}
          <span className="shimmer-text">innovation.</span>
        </h2>
      </div>

      <div className="max-w-6xl mx-auto px-5 md:px-10">
        <div className="signal-panel grid grid-cols-1 md:grid-cols-[1.4fr_1fr] overflow-hidden">

          {/* ==============================
              LEFT - the form, framed as a signal packet
              ============================== */}
          <div className="relative p-6 md:p-10 lg:p-12 bg-text text-bg overflow-hidden">
            {/* Trace marker top-left corner */}
            <span className="corner-mark corner-tl" />
            <span className="corner-mark corner-br" />

            <div className="mb-8">
              <Typewriter
                text="> Hello."
                className="block font-mono text-2xl md:text-3xl text-accent-deep"
              />
              <h3 className="font-display font-semibold text-2xl md:text-3xl lg:text-4xl mt-3 text-bg">
                How can we help you?
              </h3>
            </div>

            {/* Step indicators as circuit nodes */}
            <div className="flex items-center gap-0 mb-8">
              {steps.map((label, i) => {
                const idx = i + 1;
                const active = step >= idx && step < 3;
                return (
                  <React.Fragment key={label}>
                    <div className="flex items-center gap-2">
                      <span className={`node-indicator ${active ? 'active' : ''} ${step === idx ? 'current' : ''}`} />
                      <span className={`font-mono text-[0.65rem] uppercase tracking-widest transition-colors ${
                        step >= idx ? 'text-bg' : 'text-bg/40'
                      }`}>
                        {label}
                      </span>
                    </div>
                    {i < steps.length - 1 && (
                      <span className={`trace-line flex-1 mx-3 ${step > idx ? 'charged' : ''}`} />
                    )}
                  </React.Fragment>
                );
              })}
            </div>

            {/* Step content */}
            <div className="relative overflow-hidden">
              <div key={step} className={`step-slide ${dir > 0 ? 'slide-in-right' : 'slide-in-left'}`}>

                {step === 0 && (
                  <div className="space-y-3">
                    <p className="font-mono text-xs uppercase tracking-widest text-bg/50 mb-4">
                      &gt; Select route
                    </p>
                    {[
                      { key: 'hire', title: 'Hire talent', sub: 'Permanent, contract, or RPO solutions' },
                      { key: 'role', title: 'Find my next role', sub: 'Semiconductor, chip design, or engineering' },
                      { key: 'general', title: 'General enquiry', sub: 'Partnerships, press, or anything else' },
                    ].map(opt => (
                      <button
                        key={opt.key}
                        onClick={() => choosePath(opt.key)}
                        className="path-option w-full text-left border border-black/15 p-4 flex justify-between items-center gap-4 group"
                      >
                        <span>
                          <span className="block font-display font-semibold text-bg">{opt.title}</span>
                          <span className="block text-bg/55 text-sm mt-1">{opt.sub}</span>
                        </span>
                        <span className="font-mono text-xs text-accent-deep opacity-0 group-hover:opacity-100 transition-opacity">
                          {PATHS[opt.key].code} →
                        </span>
                      </button>
                    ))}
                  </div>
                )}

                {step === 1 && (
                  <div>
                    <p className="font-mono text-xs uppercase tracking-widest text-bg/50 mb-6">
                      &gt; {config.code} · Identity
                    </p>
                    <label htmlFor="eqName" className="block font-mono text-xs uppercase tracking-wider text-bg/50 mb-2">
                      {config.nameLabel}
                    </label>
                    <input
                      id="eqName"
                      type="text"
                      value={name}
                      onChange={e => setName(e.target.value)}
                      onBlur={() => setTouched(t => ({ ...t, name: true }))}
                      autoComplete="name"
                      className={`w-full bg-transparent border-b text-bg text-lg py-2 focus:outline-none transition-colors ${
                        touched.name && !nameValid ? 'border-red-500' : 'border-black/20 focus:border-accent-deep'
                      }`}
                    />
                    {touched.name && !nameValid && (
                      <p className="font-mono text-xs text-red-600 mt-2">! Name required</p>
                    )}
                    <div className="flex justify-between items-center mt-10">
                      <button onClick={() => goTo(0)} className="font-mono text-xs text-bg/60 hover:text-bg transition-colors">
                        &lt; Back
                      </button>
                      <button
                        onClick={() => goTo(2)}
                        disabled={!nameValid}
                        className="press-scale font-mono text-xs uppercase tracking-widest font-semibold px-6 py-3 bg-bg text-text hover:bg-accent-deep hover:text-bg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        Next →
                      </button>
                    </div>
                  </div>
                )}

                {step === 2 && (
                  <div>
                    <p className="font-mono text-xs uppercase tracking-widest text-bg/50 mb-6">
                      &gt; {config.code} · Contact
                    </p>

                    <label htmlFor="eqEmail" className="block font-mono text-xs uppercase tracking-wider text-bg/50 mb-2">
                      {config.emailLabel}
                    </label>
                    <input
                      id="eqEmail"
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      onBlur={() => setTouched(t => ({ ...t, email: true }))}
                      autoComplete="email"
                      className={`w-full bg-transparent border-b text-bg text-lg py-2 focus:outline-none transition-colors mb-6 ${
                        touched.email && !emailValid ? 'border-red-500' : 'border-black/20 focus:border-accent-deep'
                      }`}
                    />
                    {touched.email && !emailValid && (
                      <p className="font-mono text-xs text-red-600 -mt-4 mb-4">! Email invalid</p>
                    )}

                    <label htmlFor="eqExtra" className="block font-mono text-xs uppercase tracking-wider text-bg/50 mb-2">
                      {config.extraLabel}
                    </label>
                    {config.extraType === 'textarea' ? (
                      <textarea
                        id="eqExtra"
                        value={extra}
                        onChange={e => setExtra(e.target.value)}
                        placeholder={config.extraPlaceholder}
                        rows={3}
                        className="w-full bg-transparent border-b border-black/20 text-bg py-2 focus:border-accent-deep focus:outline-none resize-none"
                      />
                    ) : (
                      <input
                        id="eqExtra"
                        type="text"
                        value={extra}
                        onChange={e => setExtra(e.target.value)}
                        placeholder={config.extraPlaceholder}
                        className="w-full bg-transparent border-b border-black/20 text-bg py-2 focus:border-accent-deep focus:outline-none"
                      />
                    )}

                    <div className="flex justify-between items-center mt-10">
                      <button onClick={() => goTo(1)} className="font-mono text-xs text-bg/60 hover:text-bg transition-colors">
                        &lt; Back
                      </button>
                      <button
                        onClick={submit}
                        disabled={!emailValid || !extraValid || submitted}
                        className="press-scale font-mono text-xs uppercase tracking-widest font-semibold px-6 py-3 bg-bg text-text hover:bg-accent-deep hover:text-bg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        {submitted ? 'Sending…' : 'Send →'}
                      </button>
                    </div>
                  </div>
                )}

                {step === 3 && (
                  <div className="py-6">
                    <div className="success-pop inline-flex items-center justify-center w-14 h-14 rounded-full bg-accent-deep/10 mb-5">
                      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-accent-deep">
                        <path d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <p className="font-mono text-xs uppercase tracking-widest text-accent-deep mb-3">
                      &gt; Received.
                    </p>
                    <h3 className="font-display font-semibold text-2xl mb-3 text-bg">Thank you.</h3>
                    <p className="text-bg/70 mb-8">
                      We'll be in touch within one business day.
                    </p>
                    <button onClick={reset} className="font-mono text-xs text-bg/60 hover:text-accent-deep transition-colors uppercase tracking-widest">
                      &lt; Submit another
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ==============================
              RIGHT - contact / spec readout
              ============================== */}
          <div className="relative bg-[#0b0818] text-text p-6 md:p-10 lg:p-12 flex flex-col justify-between min-h-[560px] overflow-hidden datacenter-panel">

            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-10">
                <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true" className="text-accent">
                  <rect x="7" y="7" width="10" height="10" rx="2" fill="none" stroke="currentColor" strokeWidth="1.6"/>
                  <g stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
                    <path d="M10 7 V4.2 M14 7 V4.2"/>
                    <path d="M10 17 V19.8 M14 17 V19.8"/>
                    <path d="M7 10 H4.2 M7 14 H4.2"/>
                    <path d="M17 10 H19.8 M17 14 H19.8"/>
                  </g>
                </svg>
                <div>
                  <div className="font-display font-bold text-lg tracking-widest">ALLSEMI</div>
                  <div className="font-mono text-[0.6rem] uppercase tracking-[0.24em] text-accent/70 mt-0.5">
                    Talent · Engineered
                  </div>
                </div>
              </div>

              <div className="space-y-7">
                {[
                  { k: 'LOCATION', v: OFFICE.address },
                  { k: 'PHONE', v: [OFFICE.phone], link: `tel:${OFFICE.phone.replace(/[\s-]/g, '')}` },
                  { k: 'EMAIL', v: [OFFICE.email], link: `mailto:${OFFICE.email}` },
                  { k: 'HOURS', v: OFFICE.hours },
                ].map(row => (
                  <ScrollReveal key={row.k} className="dc-row">
                    <div className="flex gap-4 items-start">
                      <span className="font-mono text-[0.62rem] uppercase tracking-[0.24em] text-accent w-20 pt-1 shrink-0">
                        {row.k}
                      </span>
                      <div className="font-mono text-sm leading-relaxed">
                        {row.v.map((line, i) =>
                          row.link ? (
                            <a key={i} href={row.link} className="block hover:text-accent transition-colors">
                              {line}
                            </a>
                          ) : (
                            <p key={i} className="block">{line}</p>
                          )
                        )}
                      </div>
                    </div>
                  </ScrollReveal>
                ))}
              </div>
            </div>

            {/* Status footer */}
            <ScrollReveal className="relative z-10 mt-10" delay={300}>
              <div className="flex items-center justify-between border-t border-line pt-5">
                <div className="flex items-center gap-2">
                  <span className="status-dot" />
                  <span className="font-mono text-[0.62rem] uppercase tracking-[0.2em] text-text-faint">
                    Online
                  </span>
                </div>
                <div className="flex gap-3">
                  <a href="#" aria-label="LinkedIn" className="dc-social">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                      <path d="M4.98 3.5a2.5 2.5 0 100 5 2.5 2.5 0 000-5zM3 9h4v12H3zM10 9h3.8v1.7h.1c.5-.9 1.7-1.8 3.5-1.8 3.7 0 4.4 2.4 4.4 5.5V21h-4v-5.6c0-1.3 0-3-1.8-3s-2.1 1.4-2.1 2.9V21h-4z"/>
                    </svg>
                  </a>
                  <a href="#" aria-label="X" className="dc-social">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                      <path d="M18.9 3H22l-7.3 8.4L22.6 21h-6.8l-5-6.5L5 21H2l7.8-8.9L1.6 3h6.9l4.6 6z"/>
                    </svg>
                  </a>
                </div>
              </div>
            </ScrollReveal>
          </div>

        </div>
      </div>
    </section>
  );
}