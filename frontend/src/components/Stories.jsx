import React, { useState, useEffect } from 'react';
const ITEMS = [
  {
    quote: 'Allsemi helped us close five senior RTL Design and Verification engineers within three weeks - roles that had been open for over two months. Their deep understanding of VLSI talent is unmatched.',
    name: 'VP Engineering',
    role: 'Leading chip design firm',
    photo: 'https://images.pexels.com/photos/9242271/pexels-photo-9242271.jpeg?auto=compress&dpr=1&h=750&w=1260',
  },
  {
    quote: 'We needed ADAS and functional safety engineers fast. Allsemi delivered pre-screened, interview-ready candidates in under a week. The quality and speed were exceptional.',
    name: 'Head of Talent Acquisition',
    role: 'Tier 1 automotive OEM',
    photo: 'https://images.pexels.com/photos/29475974/pexels-photo-29475974/free-photo-of-futuristic-car-dashboard-with-electronic-gadgets.jpeg?auto=compress&dpr=1&h=750&w=1260',
  },
  {
    quote: 'The shortlist arrived within 48 hours. Every candidate understood our process node, our EDA stack, and our roadmap - a rare combination.',
    name: 'Director of Silicon',
    role: 'Fabless semiconductor company',
    photo: 'https://images.pexels.com/photos/6755086/pexels-photo-6755086.jpeg?auto=compress&dpr=1&h=750&w=1260',
  },
];

export default function Stories() {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setIdx(i => (i + 1) % ITEMS.length), 6000);
    return () => clearInterval(t);
  }, []);
  const item = ITEMS[idx];

  return (
    <section id="stories" className="border-t border-line py-16 md:py-24 lg:py-32">
      <div className="max-w-7xl mx-auto px-5 md:px-10 mb-10 md:mb-14">
        <span className="block font-mono text-xs uppercase tracking-[0.22em] text-accent mb-4">
          03 / STORIES
        </span>
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-accent mb-3">
          Client and candidate stories
        </p>
        <h2 className="font-display font-semibold text-4xl md:text-5xl lg:text-6xl tracking-tight leading-tight">
          Stories.
        </h2>
        <span className="block mt-6 w-20 h-0.5 bg-gradient-to-r from-accent to-accent-2 shadow-[0_0_12px_rgba(167,139,250,0.5)]" />
      </div>

      <div className="max-w-7xl mx-auto px-5 md:px-10 grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-14 items-center">
        <div className="relative overflow-hidden border border-line aspect-[4/3] lg:aspect-[5/6] bg-bg-raised">
          <img src={item.photo} alt="" className="w-full h-full object-cover grayscale contrast-105 brightness-70" />
        </div>
        <div>
          <blockquote className="font-display font-medium text-xl md:text-2xl lg:text-3xl leading-snug text-text-dim">
            {item.quote}
          </blockquote>
          <div className="mt-7 flex flex-col gap-1">
            <span className="font-display font-semibold text-base">{item.name}</span>
            <span className="text-sm text-text-faint">{item.role}</span>
          </div>
          <div className="mt-8 flex gap-2">
            {ITEMS.map((_, i) => (
              <button
                key={i}
                aria-label={`Story ${i + 1}`}
                onClick={() => setIdx(i)}
                className={`w-8 h-0.5 transition-colors ${i === idx ? 'bg-accent' : 'bg-line-strong'}`}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}