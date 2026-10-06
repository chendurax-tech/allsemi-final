import React from 'react';
import { Link } from 'react-router-dom';
import { useInsights } from '../lib/usePublicData.js';
import { landingArticles } from '../lib/insightsContent.js';

/*
  The Insights section of the landing page. It shows the published
  articles the admin has switched on for the landing page ("Show on
  landing page" in the article editor), in the landing page order set
  there. The list comes from the backend (GET /api/public/insights) and
  landingArticles() picks and orders them. Nothing is chosen here.

  The layout follows the number of articles chosen:
    1        one wide card;
    2        two equal cards side by side;
    3        the lead card on the left and two cards stacked on the
             right, which share the lead card's height;
    4 or more  the same three, then the rest in a grid below whose last
             row is always filled. On a phone the rest is a row that is
             swiped sideways, so a long selection does not make the page
             long.

  Each card shows the article's own topic, title and cover image and
  links to its page. While the list loads the three frames are held so
  the page does not jump. With no article chosen, or when the API cannot
  be reached, the section is left out and the rest of the page is
  unaffected.
*/
const FRAME = 'relative border border-line overflow-hidden';
const SHAPE = {
  // one article
  single: 'aspect-video lg:aspect-[21/9]',
  // two articles
  pair: 'aspect-video lg:aspect-[4/3]',
  // three or more: the lead card, and the two beside it. On desktop the
  // two take the height of their grid row, so together they are exactly
  // as tall as the lead card with the grid's own gap between them.
  lead: 'aspect-video lg:aspect-[4/5] lg:row-span-2',
  side: 'aspect-video lg:aspect-auto lg:h-full',
  // the fourth article onwards
  more: 'shrink-0 w-[82vw] snap-center aspect-video md:w-auto md:aspect-auto md:h-64 lg:h-72',
};
const GRID = {
  1: 'grid grid-cols-1 gap-5',
  2: 'grid grid-cols-1 md:grid-cols-2 gap-5',
  3: 'grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] lg:grid-rows-2 gap-5',
};

// How wide a card of the lower grid is, so that every row is filled.
// Tablet: two to a row, and a last odd card takes the whole row.
// Desktop: three to a row (two of the six columns each); a remainder of
// two shares the last row, and a remainder of one is avoided by ending
// on two rows of two. A single card takes the whole row.
function moreSpan(index, count) {
  const tablet = count % 2 === 1 && index === count - 1 ? 'md:col-span-2' : 'md:col-span-1';
  const left = count % 3;
  let desktop = 'lg:col-span-2';
  if (count === 1) desktop = 'lg:col-span-6';
  else if (left === 1 && index >= count - 4) desktop = 'lg:col-span-3';
  else if (left === 2 && index >= count - 2) desktop = 'lg:col-span-3';
  return `${tablet} ${desktop}`;
}

function Card({ article, shape, strong = false, className = '' }) {
  return (
    <Link to={`/insights/${article.slug}`} className={`${FRAME} ${SHAPE[shape]} ${className} group`}>
      {article.image && <img src={article.image} alt={article.alt || ''} className="absolute inset-0 w-full h-full object-cover grayscale brightness-[0.55] transition-all duration-700 ease-out group-hover:grayscale-0 group-hover:brightness-90 group-hover:scale-105 motion-reduce:transition-none motion-reduce:group-hover:scale-100 max-md:!grayscale-0 max-md:!brightness-100" />}
      <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/30 to-transparent" />
      <div className={`absolute inset-x-0 bottom-0 ${strong ? 'p-6' : 'p-5'} z-10`}>
        <span className="font-mono text-xs uppercase tracking-widest text-accent">{article.topics[0]}</span>
        <h4 className={`font-display font-semibold mt-2 ${strong ? 'text-xl text-text' : 'text-base text-text-dim'}`}>
          {article.title}
        </h4>
      </div>
    </Link>
  );
}

export default function Insights() {
  const { status, articles } = useInsights();
  const loading = status === 'loading';
  const cards = landingArticles(articles);
  if (!loading && cards.length === 0) return null;

  // The first three make up the main composition; any others follow.
  const main = cards.slice(0, 3);
  const more = cards.slice(3);
  const shapeOf = (index) => {
    if (main.length === 1) return 'single';
    if (main.length === 2) return 'pair';
    return index === 0 ? 'lead' : 'side';
  };

  return (
    <section id="insights" className="border-t border-line py-16 md:py-24 lg:py-32">
      <div className="max-w-7xl mx-auto px-5 md:px-10 mb-10 md:mb-14">
        <span className="block font-mono text-xs uppercase tracking-[0.22em] text-accent mb-4">
          04 / INSIGHTS
        </span>
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-accent mb-3">
          From the team
        </p>
        <h2 className="font-display font-semibold text-4xl md:text-5xl lg:text-6xl tracking-tight leading-tight">
          Insights.
        </h2>
        <span className="block mt-6 w-20 h-0.5 bg-gradient-to-r from-accent to-accent-2 shadow-[0_0_12px_rgba(167,139,250,0.5)]" />
      </div>

      <div className={`max-w-7xl mx-auto px-5 md:px-10 ${GRID[loading ? 3 : main.length]}`}>
        {loading
          ? [0, 1, 2].map((i) => <div key={i} className={`${FRAME} ${SHAPE[i === 0 ? 'lead' : 'side']} bg-bg-raised animate-pulse motion-reduce:animate-none`} aria-hidden="true" />)
          : main.map((article, i) => <Card key={article.slug} article={article} shape={shapeOf(i)} strong={main.length < 3 || i === 0} />)}
        {loading && <span className="sr-only" role="status">Loading insights</span>}
      </div>

      {more.length > 0 && (
        <div className="max-w-7xl mx-auto px-5 md:px-10 mt-5">
          <div className="-mx-5 px-5 pb-3 flex gap-4 overflow-x-auto snap-x snap-mandatory scrollbar-hide md:mx-0 md:px-0 md:pb-0 md:grid md:grid-cols-2 lg:grid-cols-6 md:gap-5 md:overflow-visible md:snap-none">
            {more.map((article, i) => <Card key={article.slug} article={article} shape="more" className={moreSpan(i, more.length)} />)}
          </div>
        </div>
      )}
    </section>
  );
}
