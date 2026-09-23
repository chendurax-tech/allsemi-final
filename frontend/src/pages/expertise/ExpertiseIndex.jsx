import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { SECTORS } from '../../components/Expertise.jsx';
import { EXPERTISE_SLUGS } from '../../lib/expertiseRoutes.js';
import { SECTOR_VISUALS } from './sectorVisuals.jsx';

/*
  ExpertiseIndex - an editorial visual index, not 8 cards in a grid.

  Desktop: a large typographic list of the 8 sectors sits beside one
  shared image panel. Hovering a name reveals that sector's own image
  in the panel (grayscale -> color, subtle zoom) and activates its
  bespoke technical motif as a small overlay annotation; the hovered
  name itself scales up. Clicking navigates to the sector page - the
  same hover-to-preview / click-to-commit split already established
  for ExpertiseBands on the landing page, reused here deliberately so
  the two Expertise experiences feel like one system.

  Mobile: no hover, so every row carries its own small always-visible
  thumbnail instead of one shared reveal panel - a genuinely different
  composition, not the desktop layout compressed down.
*/
export default function ExpertiseIndex() {
  const [active, setActive] = useState(SECTORS[0].id);
  const panelRef = useRef(null);
  const imgLayerRef = useRef(null);

  useEffect(() => {
    document.title = 'ALLSEMI | Expertise';
  }, []);

  // Subtle cursor parallax on the desktop reveal panel - direct DOM
  // manipulation (not React state) to keep it cheap, desktop-only,
  // and skipped entirely under prefers-reduced-motion.
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
      layer.style.transform = `translate3d(${px * -8}px, ${py * -8}px, 0) scale(1.08)`;
    }
    function onLeave() { layer.style.transform = ''; }
    panel.addEventListener('mousemove', onMove);
    panel.addEventListener('mouseleave', onLeave);
    return () => {
      panel.removeEventListener('mousemove', onMove);
      panel.removeEventListener('mouseleave', onLeave);
    };
  }, []);

  const activeSector = SECTORS.find(s => s.id === active);
  const ActiveVisual = SECTOR_VISUALS[active];

  return (
    <>
      <section className="border-b border-line pt-24 md:pt-32 pb-10 md:pb-14">
        <div className="max-w-7xl mx-auto px-5 md:px-10">
          <span className="block font-mono text-xs uppercase tracking-[0.22em] text-accent mb-6">
            EXPERTISE
          </span>
          <h1 className="font-display font-bold text-4xl md:text-6xl tracking-tight leading-tight mb-6 max-w-2xl">
            Eight sectors. One standard.
          </h1>
          <p className="max-w-xl text-base md:text-lg text-text-dim leading-relaxed">
            The specialist domains ALLSEMI recruits across, from semiconductor
            design to the systems it ends up inside.
          </p>
        </div>
      </section>

      {/* ============ DESKTOP: typographic list + shared reveal panel ============ */}
      <section className="hidden lg:block pb-24">
        <div className="max-w-7xl mx-auto px-5 md:px-10 grid grid-cols-[1fr_1.1fr] gap-14 items-start">
          <div className="flex flex-col" onMouseLeave={() => {}}>
            {SECTORS.map(s => {
              const isActive = active === s.id;
              return (
                <Link
                  key={s.id}
                  to={`/expertise/${EXPERTISE_SLUGS[s.id]}`}
                  onMouseEnter={() => setActive(s.id)}
                  onFocus={() => setActive(s.id)}
                  className="group/row flex items-baseline gap-5 py-5 border-b border-line"
                >
                  <span className={`font-mono text-sm shrink-0 transition-colors duration-300 ${isActive ? 'text-accent' : 'text-text-faint'}`}>
                    {s.num}
                  </span>
                  <span className={`font-display font-semibold tracking-tight transition-all duration-300 ${
                    isActive ? 'text-4xl xl:text-5xl text-text' : 'text-2xl xl:text-3xl text-text-dim'
                  }`}>
                    {s.name}
                  </span>
                </Link>
              );
            })}
          </div>

          <div ref={panelRef} className="sticky top-28 relative aspect-[4/3] border border-line overflow-hidden">
            <div ref={imgLayerRef} className="absolute inset-0 transition-transform duration-500 ease-out">
              {SECTORS.map(s => (
                <img
                  key={s.id}
                  src={s.image}
                  alt={s.alt}
                  loading={s.num <= '02' ? 'eager' : 'lazy'}
                  className={`absolute inset-0 w-full h-full object-cover transition-all duration-700 ease-out ${
                    active === s.id ? 'opacity-100 grayscale-0 scale-105' : 'opacity-0 grayscale scale-100'
                  }`}
                />
              ))}
            </div>
            <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/20 to-transparent" />
            <div className="absolute right-4 bottom-4 w-28 h-20 opacity-80">
              <ActiveVisual />
            </div>
            <div className="absolute left-6 bottom-6 z-10">
              <span className="font-mono text-xs text-accent tracking-widest">{activeSector.num}</span>
              <p className="font-display font-semibold text-lg text-text mt-1">{activeSector.name}</p>
            </div>
          </div>
        </div>
      </section>

      {/* ============ MOBILE / TABLET: stacked rows, each with its own thumbnail ============ */}
      <section className="lg:hidden pb-16">
        <div className="max-w-7xl mx-auto px-5 md:px-10 flex flex-col">
          {SECTORS.map(s => {
            const Visual = SECTOR_VISUALS[s.id];
            return (
              <Link
                key={s.id}
                to={`/expertise/${EXPERTISE_SLUGS[s.id]}`}
                className="group flex items-center gap-4 py-5 border-b border-line"
              >
                <div className="relative w-20 h-20 md:w-24 md:h-24 shrink-0 border border-line overflow-hidden">
                  <img src={s.image} alt={s.alt} className="absolute inset-0 w-full h-full object-cover grayscale" loading={s.num <= '02' ? 'eager' : 'lazy'} />
                  <div className="absolute inset-0 bg-bg/40" />
                  <div className="absolute inset-0 opacity-60 mix-blend-screen">
                    <Visual />
                  </div>
                </div>
                <div className="min-w-0">
                  <span className="font-mono text-xs text-accent tracking-widest">{s.num}</span>
                  <h3 className="font-display font-semibold text-lg md:text-xl mt-1 group-hover:text-accent transition-colors">
                    {s.name}
                  </h3>
                </div>
              </Link>
            );
          })}
        </div>
      </section>
    </>
  );
}
