import React, { useState, useRef, useEffect } from 'react';
import { useSeo, fixedPageSeo } from '../../lib/seo.js';
import { Link } from 'react-router-dom';
import { sectorVisual } from './sectorVisuals.jsx';
import { useSectors } from '../../lib/usePublicData.js';

/*
  ExpertiseIndex - an editorial visual index, not cards in a grid.

  The sectors are the published ones, read from the backend
  (useSectors), in the order set in the admin. While they load the list
  keeps its place; the page says so plainly when none is published or
  when they could not be loaded.

  Desktop: a large typographic list of the sectors sits beside one
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
  const { status, sectors, reload } = useSectors();
  const [active, setActive] = useState(null);
  const panelRef = useRef(null);
  const imgLayerRef = useRef(null);

  useSeo(fixedPageSeo('/expertise'));

  // Subtle cursor parallax on the desktop reveal panel - direct DOM
  // manipulation (not React state) to keep it cheap, desktop-only,
  // and skipped entirely under prefers-reduced-motion. The panel is on
  // the page once the sectors have loaded.
  const hasSectors = sectors.length > 0;
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
  }, [hasSectors]);

  // Until a name is hovered the first sector is the one shown.
  const activeSector = sectors.find(s => s.id === active) || sectors[0];
  const ActiveVisual = activeSector ? sectorVisual(activeSector.id) : null;

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
            The specialist domains ALLSEMIS recruits across, from semiconductor
            design to the systems it ends up inside.
          </p>
        </div>
      </section>

      {!hasSectors && <SectorsPending status={status} onRetry={reload} />}

      {/* ============ DESKTOP: typographic list + shared reveal panel ============ */}
      {hasSectors && (<>
      <section className="hidden lg:block pb-24">
        <div className="max-w-7xl mx-auto px-5 md:px-10 grid grid-cols-[1fr_1.1fr] gap-14 items-start">
          <div className="flex flex-col" onMouseLeave={() => {}}>
            {sectors.map(s => {
              const isActive = activeSector.id === s.id;
              return (
                <Link
                  key={s.id}
                  to={`/expertise/${s.slug}`}
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
              {sectors.map((s, index) => s.image && (
                <img
                  key={s.id}
                  src={s.image}
                  alt={s.alt}
                  loading={index < 2 ? 'eager' : 'lazy'}
                  className={`absolute inset-0 w-full h-full object-cover transition-all duration-700 ease-out ${
                    activeSector.id === s.id ? 'opacity-100 grayscale-0 scale-105' : 'opacity-0 grayscale scale-100'
                  }`}
                />
              ))}
            </div>
            <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/20 to-transparent" />
            <div className="absolute right-4 bottom-4 w-28 h-20 opacity-80">
              {ActiveVisual && <ActiveVisual />}
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
          {sectors.map((s, index) => {
            const Visual = sectorVisual(s.id);
            return (
              <Link
                key={s.id}
                to={`/expertise/${s.slug}`}
                className="group flex items-center gap-4 py-5 border-b border-line"
              >
                <div className="relative w-20 h-20 md:w-24 md:h-24 shrink-0 border border-line overflow-hidden">
                  {s.image && <img src={s.image} alt={s.alt} className="absolute inset-0 w-full h-full object-cover grayscale" loading={index < 2 ? 'eager' : 'lazy'} />}
                  <div className="absolute inset-0 bg-bg/40" />
                  <div className="absolute inset-0 opacity-60 mix-blend-screen">
                    {Visual && <Visual />}
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
      </>)}
    </>
  );
}

// The space of the list while the sectors load, when none is published,
// or when they could not be loaded. The loading placeholder follows the
// two layouts (rows with a thumbnail; on desktop rows beside the panel)
// at their sizes, so the page keeps its height when the sectors arrive.
function SectorsPending({ status, onRetry }) {
  return (
    <section className="pb-16 lg:pb-24">
      <div className="max-w-7xl mx-auto px-5 md:px-10">
        {status === 'loading' && (
          <div role="status">
            <span className="sr-only">Loading sectors</span>
            <div className="animate-pulse motion-reduce:animate-none lg:grid lg:grid-cols-[1fr_1.1fr] lg:gap-14 lg:items-start" aria-hidden="true">
              <div className="flex flex-col">
                {[0, 1, 2, 3, 4, 5, 6, 7].map((row) => (
                  <div key={row} className="flex items-center gap-4 lg:gap-5 py-5 border-b border-line">
                    <div className="lg:hidden w-20 h-20 md:w-24 md:h-24 shrink-0 border border-line bg-bg-raised" />
                    <div className="hidden lg:block h-3 w-6 shrink-0 bg-line" />
                    <div className={`h-5 w-2/3 max-w-md bg-line-strong ${row === 0 ? 'lg:h-20 xl:h-24' : 'lg:h-8 xl:h-9'}`} />
                  </div>
                ))}
              </div>
              <div className="hidden lg:block aspect-[4/3] border border-line bg-bg-raised" />
            </div>
          </div>
        )}
        {status === 'ready' && <p className="text-text-dim text-sm py-12">No sectors have been published yet.</p>}
        {status === 'error' && (
          <div role="alert" className="py-12">
            <p className="text-base md:text-lg text-text-dim leading-relaxed mb-6">The sectors could not be loaded.</p>
            <button onClick={onRetry} className="font-mono text-xs uppercase tracking-widest text-accent hover:text-accent-2 transition-colors px-4 py-2 border border-accent/40">
              Try again
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
