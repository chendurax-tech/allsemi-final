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

    const isMobile = () => window.matchMedia('(max-width: 767px)').matches;

    function step() {
      const card = track.querySelector('article');
      if (!card) return 300;
      const style = getComputedStyle(track);
      const gap = parseFloat(style.columnGap || style.gap || '20');
      return card.getBoundingClientRect().width + gap;
    }

    function advance() {
      if (!isMobile()) return;
      const s = step();
      const max = track.scrollWidth - track.clientWidth;
      if (track.scrollLeft >= max - 4) {
        track.scrollTo({ left: 0, behavior: 'smooth' });
      } else {
        track.scrollBy({ left: s, behavior: 'smooth' });
      }
    }

    function start() {
      stop();
      timerRef.current = setInterval(advance, 3000);
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

    const onTouch = () => pauseThenResume();
    const onWheel = () => pauseThenResume();

    track.addEventListener('touchstart', onTouch, { passive: true });
    track.addEventListener('wheel', onWheel, { passive: true });

    const mq = window.matchMedia('(max-width: 767px)');
    const onMq = () => { if (mq.matches) start(); else stop(); };
    mq.addEventListener('change', onMq);

    if (mq.matches) start();

    return () => {
      stop();
      clearTimeout(resumeRef.current);
      mq.removeEventListener('change', onMq);
      track.removeEventListener('touchstart', onTouch);
      track.removeEventListener('wheel', onWheel);
    };
  }, []);

  return (
    <section id="expertise" className="border-t border-line py-16 md:py-24 lg:py-32">
      <div className="max-w-7xl mx-auto px-5 md:px-10 mb-10 md:mb-14">
        <span className="block font-mono text-xs uppercase tracking-[0.22em] text-accent mb-4">
          01 / EXPERTISE
        </span>
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-accent mb-3">
          Where we work
        </p>
        <h2 className="kinetic-title font-display font-semibold text-4xl md:text-5xl lg:text-6xl tracking-tight leading-tight">
          Our expertise.
        </h2>
        <span className="block mt-6 w-20 h-0.5 bg-gradient-to-r from-accent to-accent-2 shadow-[0_0_12px_rgba(167,139,250,0.5)]" />
      </div>

      {/* Carousel — inside the same 7xl container as every other section */}
      <div className="max-w-7xl mx-auto px-5 md:px-10">
        <div
          ref={trackRef}
          className="flex gap-5 snap-x snap-mandatory overflow-x-auto scrollbar-hide scroll-smooth -mx-5 px-5 md:-mx-10 md:px-10"
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
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="absolute inset-x-0 bottom-0 p-6 z-10">
                <span className="font-mono text-xs text-accent tracking-widest">{c.num}</span>
                <h4 className="font-display font-semibold text-xl mt-2 mb-2">{c.title}</h4>
                <p className="text-text-dim text-sm leading-snug">{c.body}</p>
              </div>
              <div className="absolute bottom-0 left-0 h-0.5 bg-gradient-to-r from-accent to-accent-2 w-0 group-hover:w-full transition-all duration-500 z-20" />
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}