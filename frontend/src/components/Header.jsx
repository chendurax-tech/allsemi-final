import React, { useState } from 'react';

export default function Header() {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <>
      <header className="fixed top-0 inset-x-0 z-50 bg-bg/80 backdrop-blur-md border-b border-line">
        <div className="max-w-7xl mx-auto px-5 md:px-10 h-16 md:h-20 flex items-center justify-between gap-4">
          <a href="#top" className="flex items-center gap-2 font-display font-bold text-lg shrink-0">
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
          </a>

          <nav className="hidden lg:flex items-center gap-1 flex-1 justify-center">
            <a href="#enquiry" className="font-mono text-xs text-text-dim px-3 py-2 rounded-lg hover:text-text hover:bg-accent/10 transition-colors">Hire Talent</a>
            <a href="#enquiry" className="font-mono text-xs text-text-dim px-3 py-2 rounded-lg hover:text-text hover:bg-accent/10 transition-colors">Search Jobs</a>
            <a href="#expertise" className="font-mono text-xs text-text-dim px-3 py-2 rounded-lg hover:text-text hover:bg-accent/10 transition-colors">Specialisms</a>
            <a href="#insights" className="font-mono text-xs text-text-dim px-3 py-2 rounded-lg hover:text-text hover:bg-accent/10 transition-colors">Insights</a>
            <a href="#enquiry" className="font-mono text-xs text-text-dim px-3 py-2 rounded-lg hover:text-text hover:bg-accent/10 transition-colors">Contact</a>
          </nav>

          <div className="flex items-center gap-3 shrink-0">
            <a href="#enquiry" className="hidden lg:inline-flex text-sm font-semibold px-4 py-2 border border-line-strong hover:border-accent transition-colors">Search Jobs</a>
            <a href="#enquiry" className="hidden lg:inline-flex text-sm font-semibold px-4 py-2 bg-text text-bg hover:bg-accent transition-colors">Hire Talent</a>
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
        <a href="#enquiry" onClick={close} className="py-3 border-b border-line text-base">Hire Talent</a>
        <a href="#enquiry" onClick={close} className="py-3 border-b border-line text-base">Search Jobs</a>
        <a href="#expertise" onClick={close} className="py-3 border-b border-line text-base">Specialisms</a>
        <a href="#insights" onClick={close} className="py-3 border-b border-line text-base">Insights</a>
        <a href="#enquiry" onClick={close} className="py-3 border-b border-line text-base">Contact</a>
        <a href="#enquiry" onClick={close} className="mt-4 text-center text-sm font-semibold py-3 bg-text text-bg">Hire Talent</a>
      </div>
    </>
  );
}