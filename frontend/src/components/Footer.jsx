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
          {[
            { label: 'Hire Talent.', href: '#enquiry' },
            { label: 'Search Jobs.', href: '#enquiry' },
            { label: 'Specialisms.', href: '#expertise' },
            { label: 'Insights.', href: '#insights' },
            { label: 'Contact Us.', href: '#enquiry' },
          ].map(l => (
            <a key={l.label} href={l.href} className="text-text-dim text-sm hover:text-accent transition-colors">
              {l.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-6">
          <a
            href="#"
            aria-label="LinkedIn"
            className="text-text-dim hover:text-accent transition-colors"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M4.98 3.5a2.5 2.5 0 100 5 2.5 2.5 0 000-5zM3 9h4v12H3zM10 9h3.8v1.7h.1c.5-.9 1.7-1.8 3.5-1.8 3.7 0 4.4 2.4 4.4 5.5V21h-4v-5.6c0-1.3 0-3-1.8-3s-2.1 1.4-2.1 2.9V21h-4z"/>
            </svg>
          </a>
          <a
            href="#"
            aria-label="X"
            className="text-text-dim hover:text-accent transition-colors"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M18.9 3H22l-7.3 8.4L22.6 21h-6.8l-5-6.5L5 21H2l7.8-8.9L1.6 3h6.9l4.6 6z"/>
            </svg>
          </a>
        </div>

        <div className="pt-6 border-t border-line w-full max-w-2xl flex flex-col md:flex-row justify-center items-center gap-3 md:gap-10">
          <span className="text-xs text-text-faint">© {year} Allsemi</span>
          <a href="#" className="text-xs text-text-faint hover:text-text-dim">Privacy Policy.</a>
        </div>
      </div>
    </footer>
  );
}