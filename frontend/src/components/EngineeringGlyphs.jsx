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

/* Network / mesh with a lit center hub - Deep network. The outer
   nodes read as engineers, the center hub as ALLSEMIS routing between
   them - a talent network, not a decorative constellation. */
export function GlyphMesh(props) {
  return (
    <svg {...base} {...props}>
      <path d="M16 16 16 7 M16 16 7 20 M16 16 25 20 M16 16 16 26" />
      <circle cx="16" cy="16" r="2.4" fill="currentColor" stroke="none" />
      <circle cx="16" cy="7" r="1.8" />
      <circle cx="7" cy="20" r="1.8" />
      <circle cx="25" cy="20" r="1.8" />
      <circle cx="16" cy="26" r="1.8" />
    </svg>
  );
}

/* Precision inspection frame - Safety-critical hiring. Corner
   brackets with measurement ticks (a calibrated instrument's
   viewfinder) around a confirm mark - reads as verification/
   validation, deliberately not a shield or a plain checkmark. */
export function GlyphVerify(props) {
  return (
    <svg {...base} {...props}>
      <path d="M9 6H6.5a1.5 1.5 0 00-1.5 1.5V10 M23 6h2.5A1.5 1.5 0 0127 7.5V10 M9 26H6.5A1.5 1.5 0 015 24.5V22 M23 26h2.5a1.5 1.5 0 001.5-1.5V22" />
      <path d="M6 15.3h1.6 M26 15.3h-1.6 M15.3 6v1.6 M15.3 26v-1.6" opacity="0.55" strokeWidth="1.1" />
      <path d="M11 16.2l3.2 3.2 6.8-7" />
    </svg>
  );
}

/* Chip die with an internal circuit grid - Domain expertise. A more
   sophisticated read than a bare package outline: the die actually
   has structure inside it. */
export function GlyphChipGrid(props) {
  return (
    <svg {...base} {...props}>
      <rect x="9" y="9" width="14" height="14" rx="1.2" />
      <path d="M12 9V5.5 M18 9V5.5 M12 23v3.5 M18 23v3.5 M9 12H5.5 M9 18H5.5 M23 12h3.5 M23 18h3.5" />
      <path d="M13.2 9v14 M18.8 9v14 M9 13.2h14 M9 18.8h14" opacity="0.45" strokeWidth="1" />
    </svg>
  );
}

/* Rising signal edge with forward motion ticks - Rapid turnaround.
   An oscilloscope-style pulse reading left to right, deliberately not
   a clock face, so "fast" reads as a signal/cycle, not elapsed time. */
export function GlyphSignal(props) {
  return (
    <svg {...base} {...props}>
      <path d="M4.5 20.5h4l3-11 4 17 3-13.5 3 7.5h5.5" />
      <path d="M24 8l3.6-1.2M24 11l3.6-1.2M24 14l3.6-1.2" opacity="0.6" strokeWidth="1.2" />
    </svg>
  );
}

/* End-to-end path with start/end caps - End-to-end managed. Distinct
   from the plain three-node pipeline used elsewhere (Services'
   "RPO Solution"): explicit bracket caps at both ends make the
   "start to finish, fully managed" idea legible on its own. */
export function GlyphFlow(props) {
  return (
    <svg {...base} {...props}>
      <path d="M5 11v-3a1.5 1.5 0 011.5-1.5H9 M5 21v3a1.5 1.5 0 001.5 1.5H9 M27 11v-3a1.5 1.5 0 00-1.5-1.5H23 M27 21v3a1.5 1.5 0 01-1.5 1.5H23" opacity="0.7" />
      <circle cx="7" cy="16" r="2.1" />
      <circle cx="16" cy="16" r="2.1" />
      <circle cx="25" cy="16" r="2.1" />
      <path d="M9.1 16h4.8 M18.1 16h4.8" />
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

