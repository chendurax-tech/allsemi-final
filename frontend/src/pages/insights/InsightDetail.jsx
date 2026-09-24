import React, { useEffect, useState } from 'react';
import { Link, useParams, Navigate } from 'react-router-dom';
import {
  useInView, useParallax,
  TechnicalGrid, ScanLine, MeasurementLabel, SignalPulse,
} from '../../lib/motionPrimitives.jsx';
import { getArticleBySlug, getRelatedArticles } from '../../lib/insightsContent.js';

// A thin reading-progress bar fixed beneath the header, filling as the
// visitor scrolls through the article body. Pure CSS width driven by a
// scroll listener - no layout thrash, no dependency, reads instantly
// under reduced motion since it has no animation of its own to skip.
function ReadingProgress() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    function onScroll() {
      const doc = document.documentElement;
      const scrollable = doc.scrollHeight - doc.clientHeight;
      const pct = scrollable > 0 ? Math.min(100, Math.max(0, (doc.scrollTop / scrollable) * 100)) : 0;
      setProgress(pct);
    }
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div className="fixed top-16 md:top-20 left-0 right-0 h-0.5 bg-line z-40 pointer-events-none">
      <div className="h-full bg-gradient-to-r from-accent to-accent-2" style={{ width: `${progress}%` }} />
    </div>
  );
}

export default function InsightDetail() {
  const { slug } = useParams();
  const article = getArticleBySlug(slug);

  useEffect(() => {
    if (article) document.title = `ALLSEMI | ${article.title}`;
  }, [article]);

  if (!article) return <Navigate to="/insights" replace />;

  const related = getRelatedArticles(slug, 3);

  return (
    <>
      <ReadingProgress />
      <ArticleHero article={article} />
      <ArticleBody article={article} />
      <InlineVisual article={article} />
      {related.length > 0 && <RelatedInsights articles={related} />}
      <ArticleCta />
    </>
  );
}

/* ============ ARTICLE HERO ============ */
function ArticleHero({ article }) {
  const [heroRef, heroLayerRef] = useParallax(10);
  const [mountRef, mounted] = useInView(0.01);

  return (
    <section
      ref={(el) => { heroRef.current = el; mountRef.current = el; }}
      className="relative h-[70vh] min-h-[460px] max-h-[760px] flex flex-col justify-end overflow-hidden border-b border-line"
    >
      <div ref={heroLayerRef} className="absolute inset-0 transition-transform duration-300 ease-out">
        <img src={article.image} alt={article.alt} className="absolute inset-0 w-full h-full object-cover grayscale-[0.45] scale-105" />
      </div>
      <div className="absolute inset-0 bg-accent-deep/20 mix-blend-color" />
      <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/60 to-bg/15" />
      <TechnicalGrid className="opacity-[0.05]" />
      <ScanLine inView={mounted} className="top-0" />

      <div className="relative z-10 max-w-4xl mx-auto px-5 md:px-10 pb-14 md:pb-16 w-full">
        <Link to="/insights" className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-accent hover:text-accent-2 transition-colors mb-6">
          ← All Insights
        </Link>
        <div className="flex items-center gap-3 mb-4">
          {article.topics.map(t => (
            <span key={t} className="font-mono text-xs text-accent tracking-widest">{t}</span>
          ))}
        </div>
        <h1
          className={`font-display font-bold text-3xl sm:text-4xl md:text-5xl lg:text-6xl tracking-tight leading-[1.05] transition-all duration-700 motion-reduce:transition-none ${
            mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          }`}
        >
          {article.title}
        </h1>
        <p className="mt-5 max-w-2xl text-base md:text-lg text-text-dim leading-relaxed">{article.excerpt}</p>
        <div className="flex items-center gap-5 mt-6 font-mono text-[0.65rem] uppercase tracking-widest text-text-faint">
          <span>{formatDate(article.date)}</span>
          <span>{article.readTime}</span>
        </div>
      </div>
    </section>
  );
}

/* ============ ARTICLE BODY ============ */
function ArticleBody({ article }) {
  return (
    <section className="border-b border-line py-16 md:py-20">
      <div className="max-w-3xl mx-auto px-5 md:px-10">
        {article.body.map((block, i) => {
          if (block.type === 'h2') {
            return (
              <h2 key={i} className="font-display font-semibold text-2xl md:text-3xl tracking-tight mt-12 mb-5 first:mt-0">
                {block.text}
              </h2>
            );
          }
          if (block.type === 'p') {
            return (
              <p key={i} className="text-base md:text-lg text-text-dim leading-relaxed mb-6">
                {block.text}
              </p>
            );
          }
          if (block.type === 'quote') {
            return (
              <blockquote key={i} className="border-l-2 border-accent pl-6 md:pl-8 my-10">
                <p className="font-display font-medium text-xl md:text-2xl leading-snug text-text">{block.text}</p>
              </blockquote>
            );
          }
          if (block.type === 'list') {
            return (
              <ul key={i} className="mb-8 space-y-3">
                {block.items.map((item, j) => (
                  <li key={j} className="flex items-start gap-3 text-base md:text-lg text-text-dim leading-relaxed">
                    <span className="mt-2.5 w-1.5 h-1.5 bg-accent shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            );
          }
          return null;
        })}
      </div>
    </section>
  );
}

/* ============ INLINE VISUAL ============ */
function InlineVisual({ article }) {
  const [ref, inView] = useInView(0.4);
  return (
    <section ref={(el) => { ref.current = el; }} className="border-b border-line py-16 md:py-20">
      <div className="max-w-3xl mx-auto px-5 md:px-10">
        <div className="relative border border-line p-8 md:p-12 overflow-hidden">
          <TechnicalGrid />
          <div className="relative">
            <div className="relative h-px bg-line mb-8">
              <SignalPulse inView={inView} className="left-0" />
            </div>
            <MeasurementLabel className="block mb-2">Discipline</MeasurementLabel>
            <p className="font-mono text-xs uppercase tracking-widest text-accent">{article.topics.join(' / ')}</p>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ============ RELATED ============ */
function RelatedInsights({ articles }) {
  const [ref, inView] = useInView(0.1);
  return (
    <section ref={(el) => { ref.current = el; }} className="border-b border-line py-20 md:py-24">
      <div className="max-w-7xl mx-auto px-5 md:px-10">
        <MeasurementLabel className="block mb-4">Related Insights</MeasurementLabel>
        <h2 className="font-display font-semibold text-2xl md:text-3xl tracking-tight mb-10">Continue reading.</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 md:gap-6">
          {articles.map((a, i) => (
            <Link
              key={a.slug}
              to={`/insights/${a.slug}`}
              className={`group relative aspect-[4/3] overflow-hidden border border-line transition-all duration-500 motion-reduce:transition-none ${
                inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
              }`}
              style={{ transitionDelay: `${i * 100}ms` }}
            >
              <img src={a.image} alt={a.alt} loading="lazy" className="absolute inset-0 w-full h-full object-cover grayscale transition-all duration-500 group-hover:grayscale-0 group-hover:scale-105" />
              <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/40 to-bg/5" />
              <div className="relative z-10 h-full flex flex-col justify-end p-5">
                <span className="font-mono text-[0.65rem] text-accent tracking-widest">{a.topics[0]}</span>
                <h3 className="font-display font-semibold text-base md:text-lg mt-1.5 leading-tight">{a.title}</h3>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ============ CTA ============ */
function ArticleCta() {
  return (
    <section className="py-20 md:py-28 text-center">
      <div className="max-w-2xl mx-auto px-5 md:px-10">
        <h2 className="font-display font-bold text-2xl md:text-4xl tracking-tight mb-8">
          Looking for your next engineering opportunity?
        </h2>
        <div className="flex flex-wrap justify-center gap-3">
          <Link to="/contact" className="inline-flex text-sm font-semibold px-6 py-3 bg-text text-bg hover:bg-accent transition-colors">
            Get in Touch
          </Link>
          <Link to="/talent" className="inline-flex text-sm font-semibold px-6 py-3 border border-line-strong hover:border-accent transition-colors">
            See Roles
          </Link>
        </div>
      </div>
    </section>
  );
}

function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
