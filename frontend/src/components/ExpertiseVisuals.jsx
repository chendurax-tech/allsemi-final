import React from 'react';

/*
  Bespoke semiconductor/VLSI technical artwork for the Expertise cards.
  Hand-drawn vector compositions (no photography, no icon packs, no
  external images) in the site's existing violet-on-dark palette, styled
  as editorial technical art rather than as icons: wafer/die structures,
  layer stacks, signal routing, RF/orbital patterns, and package/BGA
  arrays, each with enough depth (gradients, opacity layering, fine
  tick/registration detail) to read as considered artwork rather than an
  enlarged pictogram.

  All five share one viewBox (480 x 640, matching the cards' 3:4 aspect)
  and one halo/gradient/opacity language so the set feels like a single
  system, not five unrelated icons.
*/

const HALO_STOPS = (
  <radialGradient id="visHalo" cx="50%" cy="42%" r="65%">
    <stop offset="0%" stopColor="#a78bfa" stopOpacity="0.22" />
    <stop offset="55%" stopColor="#7c3aed" stopOpacity="0.08" />
    <stop offset="100%" stopColor="#7c3aed" stopOpacity="0" />
  </radialGradient>
);

const commonProps = {
  viewBox: '0 0 480 640',
  preserveAspectRatio: 'xMidYMid slice',
  className: 'absolute inset-0 w-full h-full block',
  'aria-hidden': true,
  focusable: 'false',
};

/* ---------- 01 - Semiconductor Design: wafer map ---------- */
function WaferMap() {
  const cx = 240, cy = 300, r = 190;
  const rows = [];
  const cell = 17;
  const cols = Math.ceil((r * 2) / cell);
  for (let row = 0; row < cols; row++) {
    for (let col = 0; col < cols; col++) {
      const x = cx - r + col * cell;
      const y = cy - r + row * cell;
      const dx = x + cell / 2 - cx;
      const dy = y + cell / 2 - cy;
      if (Math.sqrt(dx * dx + dy * dy) > r - 6) continue;
      const bin = (row * 7 + col * 13) % 9;
      const op = bin === 0 ? 0.42 : bin < 3 ? 0.22 : bin < 6 ? 0.11 : 0.05;
      rows.push(
        <rect key={`${row}-${col}`} x={x + 0.6} y={y + 0.6} width={cell - 1.2} height={cell - 1.2}
          fill="#a78bfa" opacity={op} />
      );
    }
  }
  return (
    <svg {...commonProps}>
      <defs>
        {HALO_STOPS}
        <clipPath id="waferClip" clipPathUnits="userSpaceOnUse">
          <circle cx={cx} cy={cy} r={r - 4} />
        </clipPath>
      </defs>
      <rect width="480" height="640" fill="url(#visHalo)" />
      {[70, 130, 190].map(rr => (
        <circle key={rr} cx={cx} cy={cy} r={rr} fill="none" stroke="#a78bfa" strokeOpacity="0.14" strokeWidth="1" />
      ))}
      <g clipPath="url(#waferClip)">{rows}</g>
      <path
        d={`M ${cx - r} ${cy} A ${r} ${r} 0 1 0 ${cx + r} ${cy} A ${r} ${r} 0 1 0 ${cx - r} ${cy} M ${cx - 26} ${cy + r - 4} L ${cx + 26} ${cy + r - 4}`}
        fill="none" stroke="#c084fc" strokeOpacity="0.55" strokeWidth="1.25"
      />
      <path d={`M ${cx - 26} ${cy + r - 4} L ${cx - 18} ${cy + r + 12} L ${cx + 18} ${cy + r + 12} L ${cx + 26} ${cy + r - 4}`}
        fill="#0d0b14" stroke="#c084fc" strokeOpacity="0.55" strokeWidth="1.25" />
      {[[cx, cy - r], [cx + r, cy], [cx, cy + r], [cx - r, cy]].map(([x, y], i) => (
        <g key={i} stroke="#c084fc" strokeOpacity="0.45" strokeWidth="1">
          <line x1={x - 7} y1={y} x2={x + 7} y2={y} />
          <line x1={x} y1={y - 7} x2={x} y2={y + 7} />
        </g>
      ))}
    </svg>
  );
}

/* ---------- 02 - VLSI and Chip Design: layer-stack cross-section ---------- */
function LayerStack() {
  const layers = [
    { y: 130, w: 300, label: true },
    { y: 178, w: 260 },
    { y: 220, w: 320 },
    { y: 266, w: 240 },
    { y: 312, w: 300 },
    { y: 358, w: 220 },
    { y: 402, w: 340, label: true },
    { y: 452, w: 380 },
  ];
  const cx = 240;
  return (
    <svg {...commonProps}>
      <defs>{HALO_STOPS}</defs>
      <rect width="480" height="640" fill="url(#visHalo)" />
      {layers.map((l, i) => (
        <rect key={i} x={cx - l.w / 2} y={l.y} width={l.w} height="26"
          fill="#a78bfa" opacity={0.08 + (i % 3) * 0.07} stroke="#a78bfa" strokeOpacity="0.3" strokeWidth="1" />
      ))}
      {[-96, -34, 40, 118].map((dx, i) => (
        <line key={i} x1={cx + dx} y1={130} x2={cx + dx} y2={478} stroke="#c084fc" strokeOpacity="0.28" strokeWidth="1" strokeDasharray="1 5" />
      ))}
      <g stroke="#c084fc" strokeOpacity="0.55" strokeWidth="1">
        <line x1="70" y1="118" x2="70" y2="490" />
        <line x1="64" y1="118" x2="76" y2="118" />
        <line x1="64" y1="490" x2="76" y2="490" />
      </g>
      <text x="46" y="308" fill="#c084fc" fillOpacity="0.6" fontSize="10" fontFamily="monospace"
        transform="rotate(-90 46 308)" letterSpacing="2">STACK</text>
    </svg>
  );
}

/* ---------- 03 - Automotive: routed signal traces ---------- */
function SignalRouting() {
  const paths = [
    'M 60 500 H 150 V 420 H 230',
    'M 60 460 H 110 V 360 H 210 V 300 H 300',
    'M 60 560 H 190 V 500',
    'M 230 420 V 260 H 340 V 180',
    'M 300 300 H 380 V 200',
    'M 210 300 V 220 H 150 V 140',
  ];
  const vias = [
    [150, 500], [150, 420], [230, 420], [110, 460], [110, 360], [210, 360], [210, 300], [300, 300],
    [190, 560], [190, 500], [230, 260], [340, 260], [340, 180], [380, 300], [380, 200], [150, 220], [150, 140],
  ];
  return (
    <svg {...commonProps}>
      <defs>{HALO_STOPS}</defs>
      <rect width="480" height="640" fill="url(#visHalo)" />
      <g fill="none" strokeLinecap="square" strokeLinejoin="miter">
        {paths.map((d, i) => (
          <path key={i} d={d} stroke="#a78bfa" strokeOpacity={i === 3 ? 0.7 : 0.32} strokeWidth={i === 3 ? 1.6 : 1.1} />
        ))}
      </g>
      {vias.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="3" fill="#0d0b14" stroke="#c084fc" strokeOpacity="0.6" strokeWidth="1" />
      ))}
      <rect x="330" y="150" width="60" height="60" fill="none" stroke="#c084fc" strokeOpacity="0.5" strokeWidth="1.25" />
      <rect x="345" y="165" width="30" height="30" fill="#a78bfa" opacity="0.18" />
    </svg>
  );
}

/* ---------- 04 - Aerospace: RF / orbital pattern ---------- */
function OrbitalPattern() {
  const cx = 240, cy = 340;
  const rings = [60, 110, 160, 210];
  const ticks = Array.from({ length: 24 }, (_, i) => (i * 360) / 24);
  return (
    <svg {...commonProps}>
      <defs>{HALO_STOPS}</defs>
      <rect width="480" height="640" fill="url(#visHalo)" />
      {rings.map((r, i) => (
        <circle key={r} cx={cx} cy={cy} r={r} fill="none" stroke="#a78bfa" strokeOpacity={0.32 - i * 0.05} strokeWidth="1" />
      ))}
      {ticks.map((deg, i) => {
        const rad = (deg * Math.PI) / 180;
        const inner = 210, outer = i % 6 === 0 ? 224 : 216;
        return (
          <line key={i}
            x1={cx + Math.cos(rad) * inner} y1={cy + Math.sin(rad) * inner}
            x2={cx + Math.cos(rad) * outer} y2={cy + Math.sin(rad) * outer}
            stroke="#c084fc" strokeOpacity={i % 6 === 0 ? 0.6 : 0.3} strokeWidth="1" />
        );
      })}
      <path d={`M ${cx} ${cy - 210} A 210 210 0 0 1 ${cx + 210} ${cy}`} fill="none" stroke="#c084fc" strokeOpacity="0.55" strokeWidth="1.5" />
      <circle cx={cx} cy={cy} r="4" fill="#a78bfa" opacity="0.8" />
      <line x1={cx} y1={cy - 240} x2={cx} y2={cy + 240} stroke="#a78bfa" strokeOpacity="0.15" strokeWidth="1" />
      <line x1={cx - 240} y1={cy} x2={cx + 240} y2={cy} stroke="#a78bfa" strokeOpacity="0.15" strokeWidth="1" />
    </svg>
  );
}

/* ---------- 05 - Industrial Engineering: BGA / pin grid array ---------- */
function PinGridArray() {
  const cx = 240, cy = 330;
  const n = 11;
  const pitch = 30;
  const start = -((n - 1) * pitch) / 2;
  const dots = [];
  for (let row = 0; row < n; row++) {
    for (let col = 0; col < n; col++) {
      const x = cx + start + col * pitch;
      const y = cy + start + row * pitch;
      const edge = row === 0 || row === n - 1 || col === 0 || col === n - 1;
      const dx = col - (n - 1) / 2, dy = row - (n - 1) / 2;
      const d = Math.sqrt(dx * dx + dy * dy);
      const op = edge ? 0.55 : Math.max(0.06, 0.4 - d * 0.05);
      dots.push(<circle key={`${row}-${col}`} cx={x} cy={y} r={edge ? 3 : 2.2} fill="#a78bfa" opacity={op} />);
    }
  }
  return (
    <svg {...commonProps}>
      <defs>{HALO_STOPS}</defs>
      <rect width="480" height="640" fill="url(#visHalo)" />
      <rect x={cx + start - 14} y={cy + start - 14} width={(n - 1) * pitch + 28} height={(n - 1) * pitch + 28}
        fill="none" stroke="#c084fc" strokeOpacity="0.35" strokeWidth="1" />
      {dots}
      <g stroke="#c084fc" strokeOpacity="0.5" strokeWidth="1">
        <line x1={cx + start - 30} y1={cy + start - 30} x2={cx + start - 14} y2={cy + start - 14} />
        <line x1={cx - start + 30} y1={cy + start - 30} x2={cx - start + 14} y2={cy + start - 14} />
      </g>
    </svg>
  );
}

export const EXPERTISE_VISUALS = {
  '01': WaferMap,
  '02': LayerStack,
  '03': SignalRouting,
  '04': OrbitalPattern,
  '05': PinGridArray,
};
