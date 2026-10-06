import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  useInView, useParallax,
  TechnicalGrid, ScanLine, StaggerText, AnimatedUnderline, MeasurementLabel,
} from '../../lib/motionPrimitives.jsx';
import { hasTopic, leadArticle, topicChips } from '../../lib/insightsContent.js';
import { useInsights } from '../../lib/usePublicData.js';

/*
  InsightsIndex - the Insights page (route: /insights).

  The articles come from the backend (useInsights -> GET
  /api/public/insights): published articles only, newest first. There
  is no bundled list. The page hero, the editorial line and the closing
  block are part of the page and are always shown; the featured article,
  the topic chips and the article list wait for the articles, and say so
  plainly when there are none or when they could not be loaded.
*/

const INSIGHTS_HERO = {
  eyebrow: 'INSIGHTS / 01',
  headline: 'Signals from the engineering talent landscape.',
  sub: 'Editorial notes on hiring across semiconductor, automotive, aerospace and the systems built around them.',
  image: 'https://images.pexels.com/photos/4508751/pexels-photo-4508751.jpeg?auto=compress&cs=tinysrgb&h=1000&w=1500',
  alt: 'Modern data center corridor with server racks',
};

export default function InsightsIndex() {
  const [activeTopic, setActiveTopic] = useState(null);

  useEffect(() => {
    document.title = 'ALLSEMIS | Insights';
  }, []);

  const { status, articles, reload } = useInsights();
  const featured = leadArticle(articles);
  const rest = useMemo(() => (featured ? articles.filter(a => a.slug !== featured.slug) : []), [articles, featured]);
  const topics = useMemo(() => topicChips(articles), [articles]);
  const filtered = useMemo(
    () => (activeTopic ? rest.filter(a => hasTopic(a, activeTopic)) : rest),
    [activeTopic, rest]
  );

  return (
    <>
      <InsightsHero />
      {featured ? (
        <>
          <FeaturedInsight article={featured} />
          <TopicFilter topics={topics} active={activeTopic} onSelect={setActiveTopic} />
          <InsightStream articles={filtered} />
        </>
      ) : (
        <InsightsPending status={status} onRetry={reload} />
      )}
      <EditorialGraphic />
      <InsightsCta />
    </>
  );
}

// The space of the featured article and the list while the articles
// load, when none is published, or when they could not be loaded.
function InsightsPending({ status, onRetry }) {
  return (
    <section className="border-b border-line py-16 md:py-20">
      <div className="max-w-7xl mx-auto px-5 md:px-10">
        {status === 'loading' && (
          <div role="status">
            <span className="sr-only">Loading insights</span>
            <div className="animate-pulse motion-reduce:animate-none" aria-hidden="true">
              <div className="aspect-[16/9] md:aspect-[21/9] border border-line bg-bg-raised" />
              <div className="h-3 w-full max-w-2xl bg-line mt-10" />
              <div className="h-3 w-2/3 max-w-xl bg-line mt-4" />
            </div>
          </div>
        )}
        {status === 'ready' && <p className="text-text-dim text-sm py-12">No insights have been published yet.</p>}
        {status === 'error' && (
          <div role="alert" className="py-12">
            <p className="text-base md:text-lg text-text-dim leading-relaxed mb-6">The insights could not be loaded.</p>
            <button onClick={onRetry} className="font-mono text-xs uppercase tracking-widest text-accent hover:text-accent-2 transition-colors px-4 py-2 border border-accent/40">
              Try again
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

/* ============ HERO ============ */
function InsightsHero() {
  const [heroRef, heroLayerRef] = useParallax(12);
  const [mountRef, mounted] = useInView(0.01);
  return (
    <section
      ref={(el) => { heroRef.current = el; mountRef.current = el; }}
      className="relative h-[70vh] min-h-[460px] max-h-[760px] flex flex-col justify-end overflow-hidden border-b border-line"
    >
      <div ref={heroLayerRef} className="absolute inset-0 transition-transform duration-300 ease-out">
        <img src={INSIGHTS_HERO.image} alt={INSIGHTS_HERO.alt} className="absolute inset-0 w-full h-full object-cover grayscale-[0.55] scale-105" />
      </div>
      <div className="absolute inset-0 bg-accent-deep/25 mix-blend-color" />
      <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/55 to-bg/10" />
      <TechnicalGrid className="opacity-[0.05]" />
      <ScanLine inView={mounted} className="top-0" />
      <div className="absolute right-5 md:right-10 top-20 md:top-24 flex items-center gap-2">
        <span className="h-px w-6 bg-accent/50" />
        <MeasurementLabel>{INSIGHTS_HERO.eyebrow}</MeasurementLabel>
      </div>
      <div className="relative z-10 max-w-7xl mx-auto px-5 md:px-10 pb-14 md:pb-16 w-full">
        <h1 className="font-display font-bold text-4xl sm:text-5xl md:text-6xl tracking-tight leading-[1.02] max-w-3xl">
          <StaggerText text={INSIGHTS_HERO.headline} inView={mounted} delayStep={30} />
        </h1>
        <div className="mt-6"><AnimatedUnderline inView={mounted} /></div>
        <p className="mt-6 max-w-lg text-base md:text-lg text-text-dim leading-relaxed">{INSIGHTS_HERO.sub}</p>
      </div>
    </section>
  );
}

/* ============ FEATURED ============ */
function FeaturedInsight({ article }) {
  const [ref, inView] = useInView(0.2);
  return (
    <section ref={(el) => { ref.current = el; }} className="border-b border-line py-16 md:py-20">
      <div className="max-w-7xl mx-auto px-5 md:px-10">
        <MeasurementLabel className="block mb-6">Featured</MeasurementLabel>
        <Link
          to={`/insights/${article.slug}`}
          className={`group relative block aspect-[16/9] md:aspect-[21/9] overflow-hidden border border-line transition-all duration-700 motion-reduce:transition-none ${
            inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
          }`}
        >
          {article.image && <img
            src={article.image}
            alt={article.alt}
            className="absolute inset-0 w-full h-full object-cover grayscale transition-all duration-700 ease-out group-hover:grayscale-0 group-hover:scale-105"
          />}
          <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/50 to-bg/5 group-hover:via-bg/60 transition-all duration-500" />
          <div className="relative z-10 h-full flex flex-col justify-end p-6 md:p-10 max-w-2xl">
            <span className="font-mono text-xs text-accent tracking-widest">{article.topics[0]}</span>
            <h2 className="font-display font-bold text-2xl md:text-4xl mt-3 mb-3 leading-tight">{article.title}</h2>
            <p className="text-text-dim text-sm md:text-base leading-relaxed mb-4">{article.excerpt}</p>
            <div className="flex items-center gap-4 font-mono text-[0.65rem] uppercase tracking-widest text-text-faint">
              <span>{formatDate(article.date)}</span>
              <span>{article.readTime}</span>
              <span className="text-accent group-hover:translate-x-1 transition-transform inline-block">Read →</span>
            </div>
          </div>
        </Link>
      </div>
    </section>
  );
}

/* ============ TOPIC FILTER ============ */
function TopicFilter({ topics, active, onSelect }) {
  return (
    <section className="border-b border-line py-8">
      <div className="max-w-7xl mx-auto px-5 md:px-10">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => onSelect(null)}
            className={`font-mono text-xs uppercase tracking-wide px-3 py-2 border transition-colors ${
              active === null ? 'border-accent text-accent bg-accent/10' : 'border-line text-text-dim hover:border-accent/50'
            }`}
          >
            All
          </button>
          {topics.map(t => (
            <button
              key={t}
              onClick={() => onSelect(t === active ? null : t)}
              className={`font-mono text-xs uppercase tracking-wide px-3 py-2 border transition-colors ${
                active === t ? 'border-accent text-accent bg-accent/10' : 'border-line text-text-dim hover:border-accent/50'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ============ STREAM ============ */
function InsightStream({ articles }) {
  // Shown as soon as the list reaches the screen. The list grows with
  // every published article, so a share of its height can stop fitting
  // on a phone screen, and a list waiting for that share never appears.
  const [ref, inView] = useInView(0);
  return (
    <section ref={(el) => { ref.current = el; }} className="border-b border-line py-4 md:py-8">
      <div className="max-w-7xl mx-auto px-5 md:px-10">
        {articles.length === 0 && (
          <p className="text-text-dim text-sm py-12">No insights match this topic yet.</p>
        )}
        <div className="flex flex-col">
          {articles.map((a, i) => (
            <Link
              key={a.slug}
              to={`/insights/${a.slug}`}
              className={`group relative flex flex-col md:flex-row md:items-center gap-4 md:gap-8 py-6 md:py-7 border-b border-line transition-all duration-500 motion-reduce:transition-none hover:pl-3 ${
                inView ? 'opacity-100' : 'opacity-0'
              }`}
              style={{ transitionDelay: `${Math.min(i, 6) * 60}ms` }}
            >
              <span className="font-mono text-xs text-accent shrink-0 w-8 transition-transform group-hover:scale-110 origin-left">
                {String(i + 1).padStart(2, '0')}
              </span>

              <div className="relative w-full md:w-32 aspect-[16/10] shrink-0 overflow-hidden border border-line order-first md:order-none">
                {a.image && <img
                  src={a.image}
                  alt={a.alt}
                  loading="lazy"
                  className="absolute inset-0 w-full h-full object-cover grayscale transition-all duration-500 ease-out group-hover:grayscale-0 group-hover:scale-110"
                />}
              </div>

              <div className="flex-1 min-w-0">
                <span className="font-mono text-[0.65rem] uppercase tracking-widest text-accent/80">{a.topics[0]}</span>
                <h3 className="font-display font-semibold text-lg md:text-xl mt-1 group-hover:text-accent transition-colors">{a.title}</h3>
                <p className="text-text-dim text-sm mt-1 max-w-xl">{a.excerpt}</p>
              </div>

              <div className="flex md:flex-col gap-3 md:gap-1 shrink-0 font-mono text-[0.65rem] uppercase tracking-widest text-text-faint md:text-right">
                <span>{formatDate(a.date)}</span>
                <span>{a.readTime}</span>
              </div>

              <span className="absolute bottom-0 left-0 h-px bg-gradient-to-r from-accent to-accent-2 w-0 group-hover:w-full transition-all duration-500" />
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ============ EDITORIAL GRAPHIC ============ */
function EditorialGraphic() {
  const [ref, inView] = useInView(0.3);
  return (
    <section ref={(el) => { ref.current = el; }} className="relative border-b border-line py-20 md:py-28 overflow-hidden">
      <TechnicalGrid />
      <div className="relative max-w-3xl mx-auto px-5 md:px-10 text-center">
        <MeasurementLabel className="block mb-6">Editorial</MeasurementLabel>
        <p className={`font-display font-medium text-xl md:text-3xl leading-snug text-text transition-all duration-700 motion-reduce:transition-none ${
          inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
        }`}>
          Hiring notes written by people who understand the discipline, not just the job title.
        </p>
      </div>
    </section>
  );
}

/* ============ CTA ============ */
function InsightsCta() {
  const [ref, inView] = useInView(0.3);
  return (
    <section ref={(el) => { ref.current = el; }} className="py-24 md:py-32 text-center">
      <div className="max-w-2xl mx-auto px-5 md:px-10">
        <h2 className="font-display font-bold text-3xl md:text-5xl tracking-tight mb-8">
          <StaggerText text="Have a technical hiring challenge?" inView={inView} />
        </h2>
        <Link to="/contact" className="inline-flex text-sm font-semibold px-6 py-3 bg-text text-bg hover:bg-accent transition-colors">
          Get in Touch
        </Link>
      </div>
    </section>
  );
}

// An article saved without a date shows no date. The publish date is a
// calendar day (YYYY-MM-DD), so it is written as that day wherever the
// visitor is, not shifted into their time zone.
function formatDate(iso) {
  const d = new Date(iso);
  if (!iso || Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}
