import React from 'react';

/*
  One bespoke, restrained line-art motif per sector, each drawn from
  that sector's own technical vocabulary rather than a shared generic
  icon. Same visual system throughout (thin single-weight strokes,
  violet accent, soft halo glow, no fills beyond low-opacity accents)
  so all 8 read as one family, while the actual composition differs
  meaningfully sector to sector - not a reused shape recolored.
*/

const HALO = (id) => (
  <radialGradient id={id} cx="50%" cy="40%" r="70%">
    <stop offset="0%" stopColor="#a78bfa" stopOpacity="0.20" />
    <stop offset="55%" stopColor="#7c3aed" stopOpacity="0.07" />
    <stop offset="100%" stopColor="#7c3aed" stopOpacity="0" />
  </radialGradient>
);

const wrap = { viewBox: '0 0 480 320', className: 'w-full h-full', 'aria-hidden': true, focusable: 'false' };

/* 01 - Semiconductor: die grid over a layer-stack cross-section */
export function SemiconductorVisual() {
  const rows = [];
  for (let r = 0; r < 6; r++) {
    for (let c = 0; c < 10; c++) {
      rows.push(<rect key={`${r}-${c}`} x={120 + c * 24} y={40 + r * 20} width="20" height="16" fill="#a78bfa" opacity={(r + c) % 3 === 0 ? 0.28 : 0.1} />);
    }
  }
  return (
    <svg {...wrap}>
      <defs>{HALO('h1')}</defs>
      <rect width="480" height="320" fill="url(#h1)" />
      {rows}
      <rect x="118" y="38" width="242" height="124" fill="none" stroke="#c084fc" strokeOpacity="0.4" strokeWidth="1" />
      {[190, 230, 270].map((y, i) => (
        <rect key={i} x="90" y={y} width={260 - i * 30} height="14" fill="#a78bfa" opacity={0.1 + i * 0.05} stroke="#a78bfa" strokeOpacity="0.3" strokeWidth="1" />
      ))}
      <line x1="70" y1="184" x2="70" y2="290" stroke="#c084fc" strokeOpacity="0.4" strokeWidth="1" />
      <line x1="64" y1="184" x2="76" y2="184" stroke="#c084fc" strokeOpacity="0.4" strokeWidth="1" />
      <line x1="64" y1="290" x2="76" y2="290" stroke="#c084fc" strokeOpacity="0.4" strokeWidth="1" />
    </svg>
  );
}

/* 02 - AI Infrastructure: distributed compute topology */
export function AiCloudVisual() {
  const nodes = [[240, 60], [120, 130], [360, 130], [80, 220], [200, 220], [280, 220], [400, 220], [240, 280]];
  const edges = [[0, 1], [0, 2], [1, 3], [1, 4], [2, 5], [2, 6], [4, 7], [5, 7], [1, 4], [2, 5]];
  return (
    <svg {...wrap}>
      <defs>{HALO('h2')}</defs>
      <rect width="480" height="320" fill="url(#h2)" />
      {edges.map(([a, b], i) => (
        <line key={i} x1={nodes[a][0]} y1={nodes[a][1]} x2={nodes[b][0]} y2={nodes[b][1]} stroke="#a78bfa" strokeOpacity="0.3" strokeWidth="1" />
      ))}
      {nodes.map(([x, y], i) => (
        <g key={i}>
          <circle cx={x} cy={y} r={i === 0 ? 10 : 6} fill="#0d0b14" stroke="#c084fc" strokeOpacity="0.55" strokeWidth="1.25" />
          <circle cx={x} cy={y} r={i === 0 ? 3 : 2} fill="#a78bfa" opacity="0.7" />
        </g>
      ))}
    </svg>
  );
}

/* 03 - Automotive: ECU / sensor bus network */
export function AutomotiveVisual() {
  return (
    <svg {...wrap}>
      <defs>{HALO('h3')}</defs>
      <rect width="480" height="320" fill="url(#h3)" />
      <line x1="60" y1="160" x2="420" y2="160" stroke="#c084fc" strokeOpacity="0.5" strokeWidth="1.5" />
      {[
        { x: 90, label: 'S1' }, { x: 170, label: 'ECU' }, { x: 250, label: 'S2' },
        { x: 330, label: 'ECU' }, { x: 400, label: 'S3' },
      ].map((n, i) => (
        <g key={i}>
          <line x1={n.x} y1="160" x2={n.x} y2={i % 2 === 0 ? 100 : 220} stroke="#a78bfa" strokeOpacity="0.35" strokeWidth="1" />
          <rect x={n.x - 18} y={i % 2 === 0 ? 80 : 220} width="36" height="24" fill="#0d0b14" stroke="#a78bfa" strokeOpacity="0.5" strokeWidth="1" />
        </g>
      ))}
      <circle cx="60" cy="160" r="3" fill="#a78bfa" />
      <circle cx="420" cy="160" r="3" fill="#a78bfa" />
    </svg>
  );
}

/* 04 - Aerospace: orbital / signal path pattern */
export function AerospaceVisual() {
  const cx = 240, cy = 170;
  return (
    <svg {...wrap}>
      <defs>{HALO('h4')}</defs>
      <rect width="480" height="320" fill="url(#h4)" />
      {[50, 90, 130].map((r, i) => (
        <circle key={r} cx={cx} cy={cy} r={r} fill="none" stroke="#a78bfa" strokeOpacity={0.3 - i * 0.05} strokeWidth="1" />
      ))}
      <path d={`M ${cx} ${cy - 130} A 130 130 0 0 1 ${cx + 130} ${cy}`} fill="none" stroke="#c084fc" strokeOpacity="0.55" strokeWidth="1.5" />
      <circle cx={cx + 130} cy={cy} r="4" fill="#a78bfa" />
      <circle cx={cx} cy={cy} r="3" fill="#a78bfa" opacity="0.8" />
      {Array.from({ length: 16 }, (_, i) => {
        const deg = (i * 360) / 16;
        const rad = (deg * Math.PI) / 180;
        return <line key={i} x1={cx + Math.cos(rad) * 130} y1={cy + Math.sin(rad) * 130} x2={cx + Math.cos(rad) * 138} y2={cy + Math.sin(rad) * 138} stroke="#c084fc" strokeOpacity="0.3" strokeWidth="1" />;
      })}
    </svg>
  );
}

/* 05 - Business, Finance & Consumer: branching decision network */
export function BusinessVisual() {
  const nodes = [[240, 50], [140, 130], [340, 130], [90, 210], [190, 210], [290, 210], [390, 210]];
  const edges = [[0, 1], [0, 2], [1, 3], [1, 4], [2, 5], [2, 6]];
  return (
    <svg {...wrap}>
      <defs>{HALO('h5')}</defs>
      <rect width="480" height="320" fill="url(#h5)" />
      {edges.map(([a, b], i) => (
        <line key={i} x1={nodes[a][0]} y1={nodes[a][1]} x2={nodes[b][0]} y2={nodes[b][1]} stroke="#a78bfa" strokeOpacity="0.35" strokeWidth="1" />
      ))}
      {nodes.map(([x, y], i) => (
        <rect key={i} x={x - 14} y={y - 10} width="28" height="20" fill="#0d0b14" stroke="#c084fc" strokeOpacity="0.5" strokeWidth="1" />
      ))}
      <line x1="60" y1="260" x2="420" y2="260" stroke="#a78bfa" strokeOpacity="0.2" strokeWidth="1" strokeDasharray="1 5" />
    </svg>
  );
}

/* 06 - Banking, Finance & FinTech: transaction / ledger flow */
export function BankingVisual() {
  const xs = [70, 150, 230, 310, 390];
  return (
    <svg {...wrap}>
      <defs>{HALO('h6')}</defs>
      <rect width="480" height="320" fill="url(#h6)" />
      <line x1={xs[0]} y1="160" x2={xs[4]} y2="160" stroke="#a78bfa" strokeOpacity="0.35" strokeWidth="1" />
      {xs.map((x, i) => (
        <g key={i}>
          <rect x={x - 20} y="140" width="40" height="40" fill="#0d0b14" stroke="#c084fc" strokeOpacity="0.5" strokeWidth="1" />
          {i === 2 && (
            <g stroke="#c084fc" strokeOpacity="0.6" strokeWidth="1.25">
              <rect x={x - 8} y={158} width="16" height="12" fill="none" />
              <path d={`M ${x - 5} 158 v-5 a5 5 0 0 1 10 0 v5`} fill="none" />
            </g>
          )}
        </g>
      ))}
    </svg>
  );
}

/* 07 - Consumer Goods & Retail: linear supply-chain pipeline */
export function RetailVisual() {
  const stages = [
    { x: 70, label: 'Design' }, { x: 180, label: 'Build' },
    { x: 290, label: 'QA' }, { x: 400, label: 'Ship' },
  ];
  return (
    <svg {...wrap}>
      <defs>{HALO('h7')}</defs>
      <rect width="480" height="320" fill="url(#h7)" />
      <line x1="70" y1="170" x2="400" y2="170" stroke="#a78bfa" strokeOpacity="0.35" strokeWidth="1" />
      {stages.map((s, i) => (
        <g key={i}>
          <rect x={s.x - 22} y="150" width="44" height="40" fill="#0d0b14" stroke="#c084fc" strokeOpacity="0.5" strokeWidth="1" />
          {i < stages.length - 1 && (
            <path d={`M ${s.x + 22} 170 l 8 -5 v10 z`} fill="#a78bfa" opacity="0.5" />
          )}
        </g>
      ))}
      {[210, 250].map((y, i) => (
        <circle key={i} cx="240" cy={y} r="1.5" fill="#a78bfa" opacity="0.3" />
      ))}
    </svg>
  );
}

/* 08 - Healthcare & Medical Technology: diagnostic waveform */
export function HealthcareVisual() {
  const path = 'M 60 170 H 150 L 170 130 L 190 210 L 210 100 L 230 170 H 420';
  return (
    <svg {...wrap}>
      <defs>{HALO('h8')}</defs>
      <rect width="480" height="320" fill="url(#h8)" />
      <line x1="60" y1="170" x2="420" y2="170" stroke="#a78bfa" strokeOpacity="0.15" strokeWidth="1" />
      <path d={path} fill="none" stroke="#c084fc" strokeOpacity="0.6" strokeWidth="1.5" strokeLinejoin="round" />
      <circle cx="210" cy="100" r="3" fill="#a78bfa" />
      <rect x="330" y="90" width="70" height="90" fill="none" stroke="#a78bfa" strokeOpacity="0.35" strokeWidth="1" />
      <line x1="345" y1="110" x2="385" y2="110" stroke="#a78bfa" strokeOpacity="0.3" strokeWidth="1" />
      <line x1="345" y1="130" x2="385" y2="130" stroke="#a78bfa" strokeOpacity="0.3" strokeWidth="1" />
    </svg>
  );
}

export const SECTOR_VISUALS = {
  semiconductor: SemiconductorVisual,
  'ai-infrastructure': AiCloudVisual,
  automotive: AutomotiveVisual,
  aerospace: AerospaceVisual,
  'business-finance': BusinessVisual,
  'banking-fintech': BankingVisual,
  'consumer-retail': RetailVisual,
  healthcare: HealthcareVisual,
};
