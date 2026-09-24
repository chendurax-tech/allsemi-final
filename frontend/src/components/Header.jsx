import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { SECTORS } from './Expertise.jsx';
import { EXPERTISE_SLUGS } from '../lib/expertiseRoutes.js';

export default function Header() {
  const [open, setOpen] = useState(false);
  const [expOpen, setExpOpen] = useState(false);
  const [mobileExpOpen, setMobileExpOpen] = useState(false);
  const close = () => setOpen(false);
  const hoverTimer = useRef(null);
  const navRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();
  const onLanding = location.pathname === '/';

  useEffect(() => {
    function onDocClick(e) {
      if (navRef.current && !navRef.current.contains(e.target)) setExpOpen(false);
    }
    function onKey(e) {
      if (e.key === 'Escape') setExpOpen(false);
    }
    document.addEventListener('click', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('click', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  function openOnHover() {
    clearTimeout(hoverTimer.current);
    hoverTimer.current = setTimeout(() => setExpOpen(true), 150);
  }
  function closeOnLeave() {
    clearTimeout(hoverTimer.current);
    hoverTimer.current = setTimeout(() => setExpOpen(false), 150);
  }

  // Main "Expertise" nav label: on the landing page it scrolls to the
  // existing #expertise section (ExpertiseBands is already there - no
  // reason to navigate away). On any other page it behaves as a normal
  // link to the /expertise index.
  function handleExpertiseLabelClick(e) {
    if (onLanding) {
      e.preventDefault();
      const section = document.getElementById('expertise');
      if (section) section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    setExpOpen(false);
  }

  // Individual sectors, from either the desktop dropdown or the mobile
  // accordion, always navigate straight to that sector's own page -
  // the pages now exist, so there is no reason to stay in-page here.
  function selectSector(id, closeMobile) {
    setExpOpen(false);
    if (closeMobile) { setMobileExpOpen(false); close(); }
    navigate(`/expertise/${EXPERTISE_SLUGS[id]}`);
  }

  const navLinkClass = 'font-mono text-xs text-text-dim px-3 py-2 rounded-lg hover:text-text hover:bg-accent/10 transition-colors';

  return (
    <>
      <header className="fixed top-0 inset-x-0 z-50 bg-bg/80 backdrop-blur-md border-b border-line">
        <div className="max-w-7xl mx-auto px-5 md:px-10 h-16 md:h-20 flex items-center justify-between gap-4">
          <Link to="/" className="flex items-center gap-2 font-display font-bold text-lg shrink-0">
            <svg viewBox="0 0 24 24" width="22" height="22" className="text-accent" aria-hidden="true">
              <rect x="7" y="7" width="10" height="10" rx="2" fill="none" stroke="currentColor" strokeWidth="1.6"/>
              <g stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
                <path d="M10 7 V4.2 M14 7 V4.2"/>
                <path d="M10 17 V19.8 M14 17 V19.8"/>
                <path d="M7 10 H4.2 M7 14 H4.2"/>
                <path d="M17 10 H19.8 M17 14 H19.8"/>
              </g>
            </svg>
            <span>ALLSEMI</span>
          </Link>

          <nav ref={navRef} className="hidden lg:flex items-center gap-1 flex-1 justify-center">
            <Link to="/employers" className={navLinkClass}>Employers</Link>
            <Link to="/talent" className={navLinkClass}>Talent</Link>

            <div
              className="relative flex items-center"
              onMouseEnter={openOnHover}
              onMouseLeave={closeOnLeave}
            >
              <Link to="/expertise" onClick={handleExpertiseLabelClick} className={navLinkClass}>Expertise</Link>
              <button
                type="button"
                aria-haspopup="true"
                aria-expanded={expOpen}
                aria-label="Toggle Expertise sectors"
                onClick={() => setExpOpen(v => !v)}
                className="p-2 -ml-1 rounded-lg hover:text-text hover:bg-accent/10 transition-colors text-text-dim"
              >
                <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                  className={`transition-transform duration-200 ${expOpen ? 'rotate-180' : ''}`}>
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </button>

              <div
                className={`absolute top-full left-1/2 -translate-x-1/2 mt-2 w-[420px] bg-bg/95 backdrop-blur-md border border-line shadow-2xl transition-all duration-200 origin-top ${
                  expOpen ? 'opacity-100 scale-100 pointer-events-auto' : 'opacity-0 scale-95 pointer-events-none'
                }`}
              >
                <div className="grid grid-cols-2 gap-x-4 p-4">
                  {SECTORS.map(s => (
                    <button
                      key={s.id}
                      onClick={() => selectSector(s.id)}
                      className="text-left font-mono text-[0.7rem] uppercase tracking-wide text-text-dim hover:text-accent px-2 py-2.5 transition-colors leading-snug"
                    >
                      <span className="text-accent mr-1.5">{s.num}</span>{s.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <Link to="/insights" className={navLinkClass}>Insights</Link>
            <Link to="/about" className={navLinkClass}>About ALLSEMI</Link>
          </nav>

          <div className="flex items-center gap-3 shrink-0">
            <Link to="/contact" className="hidden lg:inline-flex text-sm font-semibold px-4 py-2 bg-text text-bg hover:bg-accent transition-colors">Get in Touch</Link>
            <button
              className="lg:hidden w-9 h-9 relative"
              aria-label="Toggle menu"
              aria-expanded={open}
              onClick={() => setOpen(!open)}
            >
              <span className={`absolute left-2 right-2 h-px bg-current transition-transform ${open ? 'top-1/2 rotate-45' : 'top-3'}`} />
              <span className={`absolute left-2 right-2 top-1/2 h-px bg-current transition-opacity ${open ? 'opacity-0' : 'opacity-100'}`} />
              <span className={`absolute left-2 right-2 h-px bg-current transition-transform ${open ? 'top-1/2 -rotate-45' : 'bottom-3'}`} />
            </button>
          </div>
        </div>
      </header>

      <div className={`fixed top-16 md:top-20 inset-x-0 bottom-0 z-40 bg-bg border-t border-line px-5 py-4 flex-col gap-1 overflow-y-auto ${open ? 'flex lg:hidden' : 'hidden'}`}>
        <Link to="/employers" onClick={close} className="py-3 border-b border-line text-base">Employers</Link>
        <Link to="/talent" onClick={close} className="py-3 border-b border-line text-base">Talent</Link>

        <div className="border-b border-line">
          <div className="w-full flex items-center justify-between py-3 text-base">
            <Link
              to="/expertise"
              onClick={(e) => { handleExpertiseLabelClick(e); if (onLanding) close(); }}
              className="flex-1 text-left"
            >
              Expertise
            </Link>
            <button
              type="button"
              onClick={() => setMobileExpOpen(v => !v)}
              aria-expanded={mobileExpOpen}
              aria-label="Toggle Expertise sectors"
              className="p-2 -mr-2"
            >
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                className={`transition-transform duration-200 ${mobileExpOpen ? 'rotate-180' : ''}`}>
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>
          </div>
          <div className={`overflow-hidden transition-all duration-300 ${mobileExpOpen ? 'max-h-[480px] pb-3' : 'max-h-0'}`}>
            {SECTORS.map(s => (
              <button
                key={s.id}
                onClick={() => selectSector(s.id, true)}
                className="block w-full text-left font-mono text-xs uppercase tracking-wide text-text-dim py-2.5 pl-3 border-l border-line"
              >
                <span className="text-accent mr-1.5">{s.num}</span>{s.name}
              </button>
            ))}
          </div>
        </div>

        <Link to="/insights" onClick={close} className="py-3 border-b border-line text-base">Insights</Link>
        <Link to="/about" onClick={close} className="py-3 border-b border-line text-base">About ALLSEMI</Link>
        <Link to="/contact" onClick={close} className="mt-4 text-center text-sm font-semibold py-3 bg-text text-bg">Get in Touch</Link>
      </div>
    </>
  );
}
