import React, { useState, useEffect, useMemo } from 'react';
import { useStories } from '../lib/usePublicData.js';

// The stories come from the backend (GET /api/public/stories): the
// published ones, in the order set in the admin. The section shows
// those the admin has left switched on for the landing page ("Show on
// landing page" in the story editor); a story that was never given a
// value is shown. It shows one story at a time, so it works for any
// number of them, and the markers wrap onto a second line when there
// are many. While the stories load the section keeps its frame, so
// the page does not jump. With no story to show, or when the API
// cannot be reached, the section is left out and the rest of the page
// is unaffected.

// Stands in for a quote of the usual length while the stories load. It
// is never shown or read out: it wraps as a quote does, so the loading
// state is as tall as a story at any screen width and the sections
// below do not move when the stories arrive.
const QUOTE_SPACE = Array.from({ length: 32 }, () => 'xxxxx').join(' ');

export default function Stories() {
  const { status, stories } = useStories();
  const ITEMS = useMemo(() => stories.filter((story) => story.showOnLanding !== false), [stories]);
  const [idx, setIdx] = useState(0);
  const count = ITEMS.length;
  useEffect(() => {
    if (count < 2) return undefined;
    const t = setInterval(() => setIdx(i => (i + 1) % count), 6000);
    return () => clearInterval(t);
  }, [count]);

  if (status !== 'loading' && count === 0) return null;
  const loading = status === 'loading';
  const item = loading ? null : ITEMS[idx % count];

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
        <div className="group relative overflow-hidden border border-line aspect-[4/3] lg:aspect-[5/6] bg-bg-raised">
          {item && item.photo && <img
            src={item.photo}
            alt={item.alt || ''}
            className="w-full h-full object-cover grayscale contrast-105 brightness-70 transition-all duration-700 ease-out group-hover:grayscale-0 group-hover:brightness-90 group-hover:scale-[1.03] motion-reduce:transition-none motion-reduce:group-hover:scale-100 max-md:!grayscale-0 max-md:!brightness-100 max-md:!contrast-100"
          />}
        </div>
        {/* Separate keys: React then replaces the loading frame instead of
            reusing its nodes for the story, which browsers count as a
            layout shift. */}
        {loading ? (
          <div key="loading" role="status" className="relative">
            <span className="sr-only">Loading stories</span>
            <div className="invisible" aria-hidden="true">
              <div className="font-display font-medium text-xl md:text-2xl lg:text-3xl leading-snug">{QUOTE_SPACE}</div>
              <div className="mt-7 flex flex-col gap-1">
                <span className="font-display font-semibold text-base">&nbsp;</span>
                <span className="text-sm">&nbsp;</span>
              </div>
              <div className="mt-8 h-0.5" />
            </div>
            <div className="absolute inset-x-0 top-0 animate-pulse motion-reduce:animate-none" aria-hidden="true">
              <div className="h-6 md:h-7 w-full bg-line-strong" />
              <div className="h-6 md:h-7 w-11/12 bg-line-strong mt-3" />
              <div className="h-6 md:h-7 w-2/3 bg-line-strong mt-3" />
              <div className="h-4 w-40 bg-line mt-9" />
              <div className="h-3 w-56 bg-line mt-3" />
            </div>
          </div>
        ) : (
        <div key="story">
          <blockquote className="font-display font-medium text-xl md:text-2xl lg:text-3xl leading-snug text-text-dim">
            {item.quote}
          </blockquote>
          <div className="mt-7 flex flex-col gap-1">
            <span className="font-display font-semibold text-base">{item.name}</span>
            <span className="text-sm text-text-faint">{item.role}</span>
          </div>
          <div className="mt-8 flex flex-wrap gap-2">
            {ITEMS.map((story, i) => (
              <button
                key={story.id || i}
                aria-label={`Story ${i + 1}`}
                onClick={() => setIdx(i)}
                className={`w-8 h-0.5 transition-colors ${i === idx % count ? 'bg-accent' : 'bg-line-strong'}`}
              />
            ))}
          </div>
        </div>
        )}
      </div>
    </section>
  );
}