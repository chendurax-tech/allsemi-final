import React from 'react';

export default function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="border-t border-line py-16 md:py-24">
      <div className="max-w-7xl mx-auto px-5 md:px-10 flex flex-col items-center gap-8">
        <a href="#top" className="flex items-center gap-3 font-display font-bold text-xl tracking-wider text-accent">
          <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true">
            <rect x="7" y="7" width="10" height="10" rx="2" fill="none" stroke="currentColor" strokeWidth="1.6"/>
            <g stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
              <path d="M10 7 V4.2 M14 7 V4.2"/>
              <path d="M10 17 V19.8 M14 17 V19.8"/>
              <path d="M7 10 H4.2 M7 14 H4.2"/>
              <path d="M17 10 H19.8 M17 14 H19.8"/>
            </g>
          </svg>
          <span className="text-text">ALLSEMI</span>
        </a>

        <nav className="flex flex-wrap justify-center gap-x-8 gap-y-3">
          {['Our Story.', 'Search Jobs.', 'Hiring.', 'Join Us.', 'Insights.', 'Contact Us.'].map(l => (
            <a key={l} href="#" className="text-text-dim text-sm hover:text-accent transition-colors">{l}</a>
          ))}
        </nav>

        <div className="pt-6 border-t border-line w-full max-w-2xl flex flex-col md:flex-row justify-center items-center gap-3 md:gap-10">
          <span className="text-xs text-text-faint">© {year} Allsemi</span>
          <a href="#" className="text-xs text-text-faint hover:text-text-dim">Privacy Policy.</a>
        </div>
      </div>
    </footer>
  );
}