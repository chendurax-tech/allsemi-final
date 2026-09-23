import React, { useState, useRef, useEffect } from 'react';

/*
  Expertise - editorial exploration system for the 8 sectors ALLSEMI
  covers. Desktop: an index rail (numbers + names) beside one large
  active image panel; hovering a rail row previews that sector in the
  panel (grayscale -> color, subtle zoom), clicking commits it. Mobile:
  a horizontal snap tab strip above the same panel, tap commits.

  Images are real color photographs; the default grayscale look is a
  CSS filter (Tailwind's `grayscale`), not a pre-desaturated source, so
  the same file smoothly transitions to full color on activation.

  NOTE: these image URLs are placeholders for evaluating the layout and
  interaction, not final licensed assets - see SECTORS below. Each
  sector's `image` field is the only thing that needs to change to swap
  in real photography later.
*/

export const SECTORS = [
  {
    id: 'semiconductor',
    num: '01',
    name: 'Semiconductor & Chip Engineering',
    shortName: 'Semiconductor',
    desc: 'RTL to tape-out - the engineers who design and verify modern silicon.',
    image: 'https://images.pexels.com/photos/6636463/pexels-photo-6636463.jpeg?auto=compress&cs=tinysrgb&h=900&w=1400',
    alt: 'Close-up of a microprocessor on a motherboard',
  },
  {
    id: 'ai-infrastructure',
    num: '02',
    name: 'AI Infrastructure & Cloud',
    shortName: 'AI & Cloud',
    desc: 'The infrastructure and systems engineering behind large-scale compute.',
    image: 'https://images.pexels.com/photos/4508751/pexels-photo-4508751.jpeg?auto=compress&cs=tinysrgb&h=900&w=1400',
    alt: 'Modern data center corridor with server racks',
  },
  {
    id: 'automotive',
    num: '03',
    name: 'Automotive & Mobility',
    shortName: 'Automotive',
    desc: 'Electronics and embedded engineering for the vehicles being built today.',
    image: 'https://images.pexels.com/photos/6870298/pexels-photo-6870298.jpeg?auto=compress&cs=tinysrgb&h=900&w=1400',
    alt: 'Mechanic examining a car engine under an open hood',
  },
  {
    id: 'aerospace',
    num: '04',
    name: 'Aerospace & Communications',
    shortName: 'Aerospace',
    desc: 'Precision hardware and systems engineering for aerospace and comms.',
    image: 'https://images.pexels.com/photos/6325002/pexels-photo-6325002.jpeg?auto=compress&cs=tinysrgb&h=900&w=1400',
    alt: 'Satellite antenna structure',
  },
  {
    id: 'business-finance',
    num: '05',
    name: 'Business, Finance & Consumer',
    shortName: 'Business',
    desc: 'Commercial and operational talent across consumer-facing technology.',
    image: 'https://images.pexels.com/photos/260929/pexels-photo-260929.jpeg?auto=compress&cs=tinysrgb&h=900&w=1400',
    alt: 'Modern boardroom conference table',
  },
  {
    id: 'banking-fintech',
    num: '06',
    name: 'Banking, Finance & FinTech',
    shortName: 'Banking',
    desc: 'Engineering talent behind modern payment and financial infrastructure.',
    image: 'https://images.pexels.com/photos/2988232/pexels-photo-2988232.jpeg?auto=compress&cs=tinysrgb&h=900&w=1400',
    alt: 'Close-up of a card payment being processed at a terminal',
  },
  {
    id: 'consumer-retail',
    num: '07',
    name: 'Consumer Goods & Retail',
    shortName: 'Retail',
    desc: 'Precision manufacturing and engineering talent for consumer products.',
    image: 'https://images.pexels.com/photos/5554948/pexels-photo-5554948.jpeg?auto=compress&cs=tinysrgb&h=900&w=1400',
    alt: 'Organized electronic circuit boards in a production setting',
  },
  {
    id: 'healthcare',
    num: '08',
    name: 'Healthcare & Medical Technology',
    shortName: 'Healthcare',
    desc: 'Engineering talent for medical devices and diagnostic technology.',
    image: 'https://images.pexels.com/photos/35444722/pexels-photo-35444722.jpeg?auto=compress&cs=tinysrgb&h=900&w=1400',
    alt: 'Laboratory technician handling cell culture equipment',
  },
];

function ExploreArrow({ className = '' }) {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M5 12h13M13 6l6 6-6 6" />
    </svg>
  );
}

export default function Expertise({ activeSector, setActiveSector, pulseKey }) {
  const [hovered, setHovered] = useState(null);
  const [pulsingId, setPulsingId] = useState(null);
  const panelRef = useRef(null);
  const imgLayerRef = useRef(null);
  const pulseTimeout = useRef(null);
  const railRefs = useRef({});

  const shownId = hovered || activeSector;
  const shownSector = SECTORS.find(s => s.id === shownId) || SECTORS[0];

  const commit = (id) => {
    setActiveSector(id);
    setHovered(null);
  };

  useEffect(() => {
    if (pulseKey === undefined || pulseKey === null) return;
    setPulsingId(activeSector);
    const el = railRefs.current[activeSector];
    if (el) el.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
    clearTimeout(pulseTimeout.current);
    pulseTimeout.current = setTimeout(() => setPulsingId(null), 1100);
    return () => clearTimeout(pulseTimeout.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pulseKey]);

  useEffect(() => {
    const panel = panelRef.current;
    const layer = imgLayerRef.current;
    if (!panel || !layer) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const isDesktop = window.matchMedia('(min-width: 1024px)').matches;
    if (reduce || !isDesktop) return;

    function onMove(e) {
      const r = panel.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width - 0.5;
      const py = (e.clientY - r.top) / r.height - 0.5;
      layer.style.transform = `translate3d(${px * -6}px, ${py * -6}px, 0) scale(1.06)`;
    }
    function onLeave() {
      layer.style.transform = '';
    }
    panel.addEventListener('mousemove', onMove);
    panel.addEventListener('mouseleave', onLeave);
    return () => {
      panel.removeEventListener('mousemove', onMove);
      panel.removeEventListener('mouseleave', onLeave);
    };
  }, []);

  return (
    <section id="expertise" className="border-t border-line py-16 md:py-24 lg:py-32">
      <div className="max-w-7xl mx-auto px-5 md:px-10 mb-10 md:mb-14">
        <span className="block font-mono text-xs uppercase tracking-[0.22em] text-accent mb-4">
          02 / EXPERTISE
        </span>
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-accent mb-3">
          Where we work
        </p>
        <h2 className="font-display font-semibold text-4xl md:text-5xl lg:text-6xl tracking-tight leading-tight">
          Our expertise.
        </h2>
        <span className="block mt-6 w-20 h-0.5 bg-gradient-to-r from-accent to-accent-2 shadow-[0_0_12px_rgba(167,139,250,0.5)]" />
      </div>

      <div className="max-w-7xl mx-auto px-5 md:px-10">
        <div className="lg:hidden -mx-5 px-5 flex gap-2 overflow-x-auto scrollbar-hide pb-4 mb-5 snap-x snap-mandatory">
          {SECTORS.map(s => (
            <button
              key={s.id}
              onClick={() => commit(s.id)}
              aria-pressed={activeSector === s.id}
              className={`shrink-0 snap-start px-4 py-2.5 border text-xs font-mono whitespace-nowrap transition-colors ${
                activeSector === s.id
                  ? 'border-accent text-text bg-accent/10'
                  : 'border-line text-text-dim'
              }`}
            >
              <span className="text-accent mr-1.5">{s.num}</span>{s.shortName}
            </button>
          ))}
        </div>

        <div className="grid lg:grid-cols-[300px_1fr] gap-8 lg:gap-12 items-start">
          <div className="hidden lg:flex flex-col" onMouseLeave={() => setHovered(null)}>
            {SECTORS.map(s => {
              const isActive = activeSector === s.id;
              const isPulsing = pulsingId === s.id;
              return (
                <button
                  key={s.id}
                  ref={el => { railRefs.current[s.id] = el; }}
                  onMouseEnter={() => setHovered(s.id)}
                  onFocus={() => setHovered(s.id)}
                  onClick={() => commit(s.id)}
                  className={`text-left py-4 border-b border-line pl-4 -ml-px border-l-2 transition-colors duration-300 ${
                    isActive ? 'border-l-accent' : 'border-l-transparent hover:border-l-accent/40'
                  } ${isPulsing ? 'expertise-rail-pulse' : ''}`}
                >
                  <span className="font-mono text-xs text-accent">{s.num}</span>
                  <div className={`font-display font-semibold leading-snug mt-1 transition-colors duration-300 ${
                    isActive ? 'text-text' : 'text-text-dim'
                  }`}>
                    {s.name}
                  </div>
                </button>
              );
            })}
          </div>

          <div
            ref={panelRef}
            className="group relative w-full aspect-[4/3] lg:aspect-[16/10] overflow-hidden border border-line"
          >
            <div ref={imgLayerRef} className="absolute inset-0 transition-transform duration-500 ease-out">
              {SECTORS.map(s => (
                <img
                  key={s.id}
                  src={s.image}
                  alt={s.alt}
                  loading={s.num <= '02' ? 'eager' : 'lazy'}
                  className={`absolute inset-0 w-full h-full object-cover transition-all duration-700 ease-out ${
                    shownId === s.id
                      ? 'opacity-100 grayscale-0 scale-105'
                      : 'opacity-0 grayscale scale-100 pointer-events-none'
                  }`}
                />
              ))}
            </div>

            <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/15 to-transparent" />

            <div className="absolute inset-x-0 bottom-0 p-6 md:p-8 lg:p-10 z-10">
              <span className="font-mono text-xs text-accent tracking-widest">{shownSector.num}</span>
              <h3 className="font-display font-bold text-2xl md:text-3xl mt-2 mb-2">{shownSector.name}</h3>
              <p className="text-text-dim text-sm md:text-base max-w-lg leading-relaxed">{shownSector.desc}</p>
              <span className="inline-flex items-center gap-1.5 mt-4 text-accent text-xs font-mono uppercase tracking-widest">
                Explore
                <ExploreArrow className="transition-transform duration-300 group-hover:translate-x-1" />
              </span>
              <span
                key={shownId}
                className="block mt-3 h-0.5 w-20 bg-gradient-to-r from-accent to-accent-2 expertise-rule-draw"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
