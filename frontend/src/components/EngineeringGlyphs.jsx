import React from 'react';

/*
  Small, single-weight line glyphs shared by the Services and Facts
  cards. Same stroke language as the header/footer chip-outline mark
  (rounded, ~1.6 stroke weight, currentColor) so these read as part of
  the existing icon system rather than a new one. Kept deliberately
  small and quiet - secondary to the card's own typography.
*/

const base = {
  viewBox: '0 0 32 32',
  width: 26,
  height: 26,
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
  focusable: 'false',
};

/* Die / package outline with corner leads - Permanent Staffing, Domain expertise */
export function GlyphDie(props) {
  return (
    <svg {...base} {...props}>
      <rect x="9" y="9" width="14" height="14" rx="1.2" />
      <path d="M12 9V5.5 M18 9V5.5 M12 23v3.5 M18 23v3.5 M9 12H5.5 M9 18H5.5 M23 12h3.5 M23 18h3.5" />
    </svg>
  );
}

/* Layer stack - Project Staffing */
export function GlyphLayers(props) {
  return (
    <svg {...base} {...props}>
      <rect x="6" y="7" width="16" height="4.2" opacity="0.9" />
      <rect x="9" y="13.9" width="16" height="4.2" opacity="0.6" />
      <rect x="6" y="20.8" width="16" height="4.2" opacity="0.9" />
    </svg>
  );
}

/* Three-stage pipeline - RPO Solution, End-to-end managed */
export function GlyphPipeline(props) {
  return (
    <svg {...base} {...props}>
      <circle cx="6.5" cy="16" r="2.3" />
      <circle cx="16" cy="16" r="2.3" />
      <circle cx="25.5" cy="16" r="2.3" />
      <path d="M8.8 16H13.7 M18.3 16H23.2" />
    </svg>
  );
}

/* Network / mesh - Deep network */
export function GlyphMesh(props) {
  return (
    <svg {...base} {...props}>
      <circle cx="16" cy="7" r="1.8" />
      <circle cx="7" cy="20" r="1.8" />
      <circle cx="25" cy="20" r="1.8" />
      <circle cx="16" cy="26" r="1.8" />
      <path d="M16 8.8 8.3 18.7 M16 8.8 23.7 18.7 M8.7 21.4 15 25 M23.3 21.4 17 25" />
    </svg>
  );
}

/* Verification mark in bracket - Safety-critical hiring */
export function GlyphVerify(props) {
  return (
    <svg {...base} {...props}>
      <path d="M9 6H6.5a1.5 1.5 0 00-1.5 1.5V10 M23 6h2.5A1.5 1.5 0 0127 7.5V10 M9 26H6.5A1.5 1.5 0 015 24.5V22 M23 26h2.5a1.5 1.5 0 001.5-1.5V22" />
      <path d="M11 16.2l3.2 3.2 6.8-7" />
    </svg>
  );
}

/* Dimension-line style rule, used under a section heading as a quiet
   alternative to the plain gradient bar so section headers don't all
   read as one repeated template. */
export function DimensionRule({ className = '' }) {
  return (
    <svg
      viewBox="0 0 88 12"
      width="88"
      height="12"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <line x1="1" y1="6" x2="87" y2="6" stroke="url(#dimGrad)" strokeWidth="1.25" />
      <line x1="1" y1="1.5" x2="1" y2="10.5" stroke="var(--color-accent, #a78bfa)" strokeWidth="1.25" />
      <line x1="87" y1="1.5" x2="87" y2="10.5" stroke="var(--color-accent-2, #c084fc)" strokeWidth="1.25" />
      <circle cx="44" cy="6" r="1.6" fill="var(--color-accent, #a78bfa)" />
      <defs>
        <linearGradient id="dimGrad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="var(--color-accent, #a78bfa)" />
          <stop offset="100%" stopColor="var(--color-accent-2, #c084fc)" />
        </linearGradient>
      </defs>
    </svg>
  );
}

/* Radial tick countdown - Rapid turnaround */
export function GlyphTick(props) {
  return (
    <svg {...base} {...props}>
      <circle cx="16" cy="16" r="10" />
      <path d="M16 16 16 9.5 M16 16 21 19" />
      {Array.from({ length: 12 }, (_, i) => {
        const a = (i * 30 * Math.PI) / 180;
        const r1 = 10, r2 = i % 3 === 0 ? 8 : 8.8;
        const x1 = 16 + Math.sin(a) * r1, y1 = 16 - Math.cos(a) * r1;
        const x2 = 16 + Math.sin(a) * r2, y2 = 16 - Math.cos(a) * r2;
        return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} strokeWidth="1" opacity={i % 3 === 0 ? 0.9 : 0.4} />;
      })}
    </svg>
  );
}
