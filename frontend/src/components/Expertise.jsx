import React, { useEffect, useRef } from 'react';

const CARDS = [
  { num: '01', title: 'Semiconductor Design', body: 'Architecture through tape-out, across advanced process nodes.',
    img: 'https://images.pexels.com/photos/6755086/pexels-photo-6755086.jpeg?auto=compress&dpr=1&h=750&w=1260',
    alt: 'Microchip and circuit board' },
  { num: '02', title: 'VLSI and Chip Design', body: 'The engineers who take a design from concept to working silicon.',
    img: 'https://images.pexels.com/photos/6477199/pexels-photo-6477199.jpeg?auto=compress&dpr=1&h=750&w=1260',
    alt: 'Microchip circuit board close-up' },
  { num: '03', title: 'Automotive', body: 'Engineering talent for the electronics inside modern vehicles.',
    img: 'https://images.pexels.com/photos/29475974/pexels-photo-29475974/free-photo-of-futuristic-car-dashboard-with-electronic-gadgets.jpeg?auto=compress&dpr=1&h=750&w=1260',
    alt: 'Automotive dashboard electronics' },
  { num: '04', title: 'Aerospace', body: 'Specialized hiring for aerospace engineering programs.',
    img: 'https://images.pexels.com/photos/35425768/pexels-photo-35425768/free-photo-of-close-up-of-aircraft-jet-engine-on-tarmac.jpeg?auto=compress&dpr=1&h=750&w=1260',
    alt: 'Aircraft jet engine' },
  { num: '05', title: 'Industrial Engineering', body: 'Talent for the industrial systems built on custom silicon.',
    img: 'https://images.pexels.com/photos/32845679/pexels-photo-32845679/free-photo-of-industrial-engineers-operating-cnc-machinery.jpeg?auto=compress&dpr=1&h=750&w=1260',
    alt: 'Industrial CNC machinery' },
];

export default function Expertise() {
  const trackRef = useRef(null);
  const timerRef = useRef(null);
  const resumeRef = useRef(null);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) return;

    function step() {
      const card = track.querySelector('article');
      if (!card) return 300;
      const style = getComputedStyle(track);
      const gap = parseFloat(style.columnGap || style.gap || '20');
      return card.getBoundingClientRect().width + gap;
    }

    function advance(dir) {
      const s = step() * (dir || 1);
      const max = track.scrollWidth - track.clientWidth;
      if (track.scrollLeft >= max - 4 && dir > 0) {
        track.scrollTo({ left: 0, behavior: 'smooth' });
      } else if (track.scrollLeft <= 4 && dir < 0) {
        track.scrollTo({ left: max, behavior: 'smooth' });
      } else {
        track.scrollBy({ left: s, behavior: 'smooth' });
      }
    }

    function start() {
      stop();
      timerRef.current = setInterval(() => advance(1), 3500);
    }
    function stop() {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
    }
    function pauseThenResume() {
      stop();
      clearTimeout(resumeRef.current);
      resumeRef.current = setTimeout(start, 5000);
    }

    // Buttons
    const prevBtn = document.getElementById('exp-prev');
    const nextBtn = document.getElementById('exp-next');
    const onPrev = () => { advance(-1); pauseThenResume(); };
    const onNext = () => { advance(1); pauseThenResume(); };
    if (prevBtn) prevBtn.addEventListener('click', onPrev);
    if (nextBtn) nextBtn.addEventListener('click', onNext);

    // Pause on interaction
    const onTouch = () => pauseThenResume();
    const onWheel = () => pauseThenResume();
    const onEnter = () => stop();
    const onLeave = () => start();

    track.addEventListener('touchstart', onTouch, { passive: true });
    track.addEventListener('wheel', onWheel, { passive: true });
    track.addEventListener('mouseenter', onEnter);
    track.addEventListener('mouseleave', onLeave);

    start();

    return () => {
      stop();
      clearTimeout(resumeRef.current);
      if (prevBtn) prevBtn.removeEventListener('click', onPrev);
      if (nextBtn) nextBtn.removeEventListener('click', onNext);
      track.removeEventListener('touchstart', onTouch);
      track.removeEventListener('wheel', onWheel);
      track.removeEventListener('mouseenter', onEnter);
      track.removeEventListener('mouseleave', onLeave);
    };
  }, []);

  return (
    <section id="expertise" className="border-t border-line py-16 md:py-24 lg:py-32">
      {/* Head */}
      <div className="max-w-7xl mx-auto px-5 md:px-10 mb-10 md:mb-14">
        <span className="block font-mono text-xs uppercase tracking-[0.22em] text-accent mb-4">
          01 / EXPERTISE
        </span>
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-accent mb-3">
          Where we work
        </p>
        <h2 className="font-display font-semibold text-4xl md:text-5xl lg:text-6xl tracking-tight leading-tight">
          Our expertise.
        </h2>
        <span className="block mt-6 w-20 h-0.5 bg-gradient-to-r from-accent to-accent-2 shadow-[0_0_12px_rgba(167,139,250,0.5)]" />
      </div>

      {/* Carousel + custom nav buttons */}
      <div className="relative max-w-7xl mx-auto">
        {/* Prev button */}
        <button
          id="exp-prev"
          aria-label="Previous"
          className="group hidden md:flex absolute left-2 lg:left-4 top-1/2 -translate-y-1/2 z-20 w-12 h-12 lg:w-14 lg:h-14 items-center justify-center rounded-full border border-accent/30 bg-bg/80 backdrop-blur-md text-accent transition-all duration-300 hover:border-accent hover:bg-accent/10 hover:scale-110"
        >
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
          {/* corner accents */}
          <span className="pointer-events-none absolute -top-px -left-px w-2 h-2 border-l border-t border-accent opacity-0 group-hover:opacity-100 transition-opacity" />
          <span className="pointer-events-none absolute -bottom-px -right-px w-2 h-2 border-r border-b border-accent opacity-0 group-hover:opacity-100 transition-opacity" />
        </button>

        {/* Next button */}
        <button
          id="exp-next"
          aria-label="Next"
          className="group hidden md:flex absolute right-2 lg:right-4 top-1/2 -translate-y-1/2 z-20 w-12 h-12 lg:w-14 lg:h-14 items-center justify-center rounded-full border border-accent/30 bg-bg/80 backdrop-blur-md text-accent transition-all duration-300 hover:border-accent hover:bg-accent/10 hover:scale-110"
        >
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 6l6 6-6 6" />
          </svg>
          <span className="pointer-events-none absolute -top-px -right-px w-2 h-2 border-r border-t border-accent opacity-0 group-hover:opacity-100 transition-opacity" />
          <span className="pointer-events-none absolute -bottom-px -left-px w-2 h-2 border-l border-b border-accent opacity-0 group-hover:opacity-100 transition-opacity" />
        </button>

        {/* Track */}
        <div className="max-w-7xl mx-auto px-5 md:px-10">
          <div
            ref={trackRef}
            className="flex gap-5 snap-x snap-mandatory overflow-x-auto scrollbar-hide scroll-smooth"
          >
            {CARDS.map(c => (
              <article
                key={c.num}
                className="relative shrink-0 w-[78vw] sm:w-[56vw] md:w-[46vw] lg:w-[calc((100%-40px)/3)] aspect-[3/4] snap-start border border-line overflow-hidden group"
              >
                <img
                  src={c.img}
                  alt={c.alt}
                  className="absolute inset-0 w-full h-full object-cover grayscale brightness-[0.55] group-hover:scale-105 group-hover:brightness-[0.7] transition-all duration-700"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/20 to-transparent" />

                {/* Scan line on hover */}
                <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

                <div className="absolute inset-x-0 bottom-0 p-6 z-10">
                  <span className="font-mono text-xs text-accent tracking-widest">{c.num}</span>
                  <h4 className="font-display font-semibold text-xl mt-2 mb-2">{c.title}</h4>
                  <p className="text-text-dim text-sm leading-snug">{c.body}</p>
                </div>

                {/* Bottom accent line grows on hover */}
                <div className="absolute bottom-0 left-0 h-0.5 bg-gradient-to-r from-accent to-accent-2 w-0 group-hover:w-full transition-all duration-500 z-20" />
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}