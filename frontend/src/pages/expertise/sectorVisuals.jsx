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

/* 02 - Embedded Systems & Electronics: a microcontroller on its board,
   with pins, traces out to peripherals and a debug header */
export function EmbeddedVisual() {
  const pins = [0, 1, 2, 3, 4, 5];
  return (
    <svg {...wrap}>
      <defs>{HALO('h2')}</defs>
      <rect width="480" height="320" fill="url(#h2)" />
      <rect x="64" y="46" width="352" height="228" fill="none" stroke="#a78bfa" strokeOpacity="0.2" strokeWidth="1" />
      {/* traces from the microcontroller to its peripherals */}
      <g fill="none" stroke="#a78bfa" strokeOpacity="0.35" strokeWidth="1">
        <path d="M 182 130 H 150 V 96 H 132" />
        <path d="M 182 190 H 150 V 224 H 132" />
        <path d="M 298 130 H 330 V 96 H 348" />
        <path d="M 298 170 H 348" />
        <path d="M 298 190 H 330 V 224 H 348" />
        <path d="M 240 218 V 246" />
      </g>
      {/* peripherals: sensor, power, radio, memory, connector */}
      {[[96, 84, 36, 24], [96, 212, 36, 24], [348, 84, 36, 24], [348, 158, 36, 24], [348, 212, 36, 24]].map(([x, y, w, h]) => (
        <rect key={`${x}-${y}`} x={x} y={y} width={w} height={h} fill="#0d0b14" stroke="#a78bfa" strokeOpacity="0.5" strokeWidth="1" />
      ))}
      {/* microcontroller package and pins */}
      {pins.map((i) => (
        <g key={i} stroke="#c084fc" strokeOpacity="0.45" strokeWidth="1">
          <line x1={200 + i * 16} y1="102" x2={200 + i * 16} y2="110" />
          <line x1={200 + i * 16} y1="210" x2={200 + i * 16} y2="218" />
          <line x1="182" y1={120 + i * 16} x2="190" y2={120 + i * 16} />
          <line x1="290" y1={120 + i * 16} x2="298" y2={120 + i * 16} />
        </g>
      ))}
      <rect x="190" y="110" width="100" height="100" fill="#0d0b14" stroke="#c084fc" strokeOpacity="0.55" strokeWidth="1.25" />
      <rect x="214" y="134" width="52" height="52" fill="#a78bfa" fillOpacity="0.12" stroke="#a78bfa" strokeOpacity="0.3" strokeWidth="1" />
      <circle cx="200" cy="120" r="2.5" fill="#a78bfa" opacity="0.8" />
      {/* debug header */}
      {[208, 224, 240, 256, 272].map((x) => (
        <circle key={x} cx={x} cy="252" r="3" fill="#0d0b14" stroke="#c084fc" strokeOpacity="0.5" strokeWidth="1" />
      ))}
    </svg>
  );
}

/* 03 - Mobility & Communications: an in-vehicle network (ECUs and
   sensors on a bus) with a wireless link out to a remote node */
export function MobilityVisual() {
  const ax = 372, ay = 110; // antenna
  const sx = 118, sy = 62;  // remote node (satellite / base station)
  const toward = Math.atan2(sy - ay, sx - ax);
  const arc = (r) => {
    const a0 = toward - 0.6;
    const a1 = toward + 0.6;
    return `M ${(ax + Math.cos(a0) * r).toFixed(1)} ${(ay + Math.sin(a0) * r).toFixed(1)} A ${r} ${r} 0 0 1 ${(ax + Math.cos(a1) * r).toFixed(1)} ${(ay + Math.sin(a1) * r).toFixed(1)}`;
  };
  return (
    <svg {...wrap}>
      <defs>{HALO('h3')}</defs>
      <rect width="480" height="320" fill="url(#h3)" />
      {/* vehicle bus with ECUs and sensors */}
      <line x1="60" y1="220" x2={ax} y2="220" stroke="#c084fc" strokeOpacity="0.5" strokeWidth="1.5" />
      {[96, 168, 240, 312].map((x, i) => (
        <g key={x}>
          <line x1={x} y1="220" x2={x} y2={i % 2 === 0 ? 190 : 250} stroke="#a78bfa" strokeOpacity="0.35" strokeWidth="1" />
          <rect x={x - 18} y={i % 2 === 0 ? 166 : 250} width="36" height="24" fill="#0d0b14" stroke="#a78bfa" strokeOpacity="0.5" strokeWidth="1" />
        </g>
      ))}
      <circle cx="60" cy="220" r="3" fill="#a78bfa" />
      {/* telematics unit and antenna */}
      <line x1={ax} y1="220" x2={ax} y2={ay} stroke="#c084fc" strokeOpacity="0.5" strokeWidth="1.5" />
      <rect x={ax - 16} y="208" width="32" height="24" fill="#0d0b14" stroke="#c084fc" strokeOpacity="0.55" strokeWidth="1.25" />
      <circle cx={ax} cy={ay} r="4" fill="#a78bfa" />
      {/* the link: radiating arcs toward the remote node */}
      {[30, 56, 82].map((r, i) => (
        <path key={r} d={arc(r)} fill="none" stroke="#c084fc" strokeOpacity={0.55 - i * 0.13} strokeWidth="1.25" />
      ))}
      <line x1={ax} y1={ay} x2={sx} y2={sy} stroke="#a78bfa" strokeOpacity="0.3" strokeWidth="1" strokeDasharray="2 6" />
      <g stroke="#c084fc" strokeOpacity="0.55" strokeWidth="1">
        <rect x={sx - 9} y={sy - 7} width="18" height="14" fill="#0d0b14" />
        <rect x={sx - 31} y={sy - 4} width="18" height="8" fill="#a78bfa" fillOpacity="0.14" />
        <rect x={sx + 13} y={sy - 4} width="18" height="8" fill="#a78bfa" fillOpacity="0.14" />
      </g>
    </svg>
  );
}

/* 04 - AI Infrastructure & Cloud: distributed compute topology */
export function AiCloudVisual() {
  const nodes = [[240, 60], [120, 130], [360, 130], [80, 220], [200, 220], [280, 220], [400, 220], [240, 280]];
  const edges = [[0, 1], [0, 2], [1, 3], [1, 4], [2, 5], [2, 6], [4, 7], [5, 7], [1, 4], [2, 5]];
  return (
    <svg {...wrap}>
      <defs>{HALO('h4')}</defs>
      <rect width="480" height="320" fill="url(#h4)" />
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

/* 05 - Healthcare & Medical Technology: diagnostic waveform */
export function HealthcareVisual() {
  const path = 'M 60 170 H 150 L 170 130 L 190 210 L 210 100 L 230 170 H 420';
  return (
    <svg {...wrap}>
      <defs>{HALO('h5')}</defs>
      <rect width="480" height="320" fill="url(#h5)" />
      <line x1="60" y1="170" x2="420" y2="170" stroke="#a78bfa" strokeOpacity="0.15" strokeWidth="1" />
      <path d={path} fill="none" stroke="#c084fc" strokeOpacity="0.6" strokeWidth="1.5" strokeLinejoin="round" />
      <circle cx="210" cy="100" r="3" fill="#a78bfa" />
      <rect x="330" y="90" width="70" height="90" fill="none" stroke="#a78bfa" strokeOpacity="0.35" strokeWidth="1" />
      <line x1="345" y1="110" x2="385" y2="110" stroke="#a78bfa" strokeOpacity="0.3" strokeWidth="1" />
      <line x1="345" y1="130" x2="385" y2="130" stroke="#a78bfa" strokeOpacity="0.3" strokeWidth="1" />
    </svg>
  );
}

/* 06 - Consumer Goods & Retail: product-to-customer pipeline */
export function RetailVisual() {
  const stages = [
    { x: 70, label: 'Product' }, { x: 180, label: 'Supply' },
    { x: 290, label: 'Commerce' }, { x: 400, label: 'Customer' },
  ];
  return (
    <svg {...wrap}>
      <defs>{HALO('h6')}</defs>
      <rect width="480" height="320" fill="url(#h6)" />
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

/* 07 - Business, Finance & Consumer: branching decision network */
export function BusinessVisual() {
  const nodes = [[240, 50], [140, 130], [340, 130], [90, 210], [190, 210], [290, 210], [390, 210]];
  const edges = [[0, 1], [0, 2], [1, 3], [1, 4], [2, 5], [2, 6]];
  return (
    <svg {...wrap}>
      <defs>{HALO('h7')}</defs>
      <rect width="480" height="320" fill="url(#h7)" />
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

/* 08 - Banking, Finance & FinTech: transaction / ledger flow */
export function BankingVisual() {
  const xs = [70, 150, 230, 310, 390];
  return (
    <svg {...wrap}>
      <defs>{HALO('h8')}</defs>
      <rect width="480" height="320" fill="url(#h8)" />
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

export const SECTOR_VISUALS = {
  semiconductor: SemiconductorVisual,
  embedded: EmbeddedVisual,
  mobility: MobilityVisual,
  'ai-infrastructure': AiCloudVisual,
  healthcare: HealthcareVisual,
  'consumer-retail': RetailVisual,
  'business-finance': BusinessVisual,
  'banking-fintech': BankingVisual,
};

// The motif for a sector, by the sector's fixed id, or null. The
// sectors themselves come from the backend; a sector created in the
// admin has no motif drawn for it, and the pages then show none.
export function sectorVisual(id) {
  return Object.hasOwn(SECTOR_VISUALS, id) ? SECTOR_VISUALS[id] : null;
}
