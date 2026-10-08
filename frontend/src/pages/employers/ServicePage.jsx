import React from 'react';
import { useSeo, breadcrumbJsonLd } from '../../lib/seo.js';
import { PAGE_SEO } from '../../lib/seoPages.js';
import { Link, useParams } from 'react-router-dom';
import {
  useInView, TechnicalGrid, StaggerText, AnimatedUnderline, MeasurementLabel,
} from '../../lib/motionPrimitives.jsx';
import { GlyphDie, GlyphLayers, GlyphPipeline, DimensionRule } from '../../components/EngineeringGlyphs.jsx';
import { useServices } from '../../lib/usePublicData.js';
import { withPageDefaults } from './servicesContent.js';

/*
  ServicePage - the shared template behind the service pages (route:
  /employers/:slug). One template, one design system, the same pattern
  SectorPage uses for the Expertise sectors, so the service pages read
  as part of the existing site rather than a second visual language.

  The services come from the backend (useServices -> GET
  /api/public/services): published services only, in the order set in
  the admin. The page shows the one whose slug is in the address, and
  lists the others under "Other Services". A slug with no published
  service behind it (never existed, still a draft, or unpublished since)
  shows the not-found state. If the request itself fails the page says
  so and offers a retry. The section labels and the fixed headings are
  part of the page, not of a service.

  Each page answers four questions specific to that service: when it
  fits, how it runs, what the client receives, and the questions an
  employer usually asks first. It is deliberately not a copy of the
  Employers page, which stays the overview of all hiring.
*/

const GLYPHS = { die: GlyphDie, layers: GlyphLayers, pipeline: GlyphPipeline };
// An icon name this build does not know is drawn with the first glyph.
const glyphFor = (icon) => (Object.hasOwn(GLYPHS, icon) ? GLYPHS[icon] : GlyphDie);

export default function ServicePage() {
  const { slug } = useParams();
  const { status, services, reload } = useServices();

  if (status !== 'ready') return <ServicePending loading={status === 'loading'} onRetry={reload} />;

  const found = services.find((s) => s.slug === slug);
  if (!found) return <ServiceNotFound />;

  // Keyed by slug: going from one service to another starts the page
  // again, as it does between any two pages.
  return (
    <ServiceView
      key={found.slug}
      service={withPageDefaults(found)}
      others={services.filter((s) => s.slug !== found.slug)}
    />
  );
}

// The frame the service hero has, for the states below: the same grid
// and way back to the Employers page.
function ServiceFrame({ children }) {
  return (
    <section className="relative min-h-[70vh] border-b border-line pt-32 md:pt-44 pb-16 md:pb-24 overflow-hidden">
      <TechnicalGrid className="opacity-[0.05]" />
      <div className="relative max-w-7xl mx-auto px-5 md:px-10">
        <Link to="/employers" className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-accent hover:text-accent-2 transition-colors mb-8">
          <span aria-hidden="true">&larr;</span> Employers
        </Link>
        {children}
      </div>
    </section>
  );
}

// The page while the services are loading, or when they could not be
// loaded.
function ServicePending({ loading, onRetry }) {
  return (
    <ServiceFrame>
      {loading ? (
        <div role="status">
          <span className="sr-only">Loading service</span>
          <div className="animate-pulse motion-reduce:animate-none" aria-hidden="true">
            <div className="h-2 w-48 bg-line-strong mt-3" />
            <div className="h-10 md:h-14 w-3/4 max-w-3xl bg-line-strong mt-9" />
            <div className="h-10 md:h-14 w-1/2 max-w-xl bg-line-strong mt-3" />
            <div className="h-3 w-full max-w-2xl bg-line mt-12" />
            <div className="h-3 w-2/3 max-w-xl bg-line mt-3" />
          </div>
        </div>
      ) : (
        <div role="alert">
          <p className="text-base md:text-lg text-text-dim leading-relaxed mb-6">This service could not be loaded.</p>
          <button onClick={onRetry} className="font-mono text-xs uppercase tracking-widest text-accent hover:text-accent-2 transition-colors px-4 py-2 border border-accent/40">
            Try again
          </button>
        </div>
      )}
    </ServiceFrame>
  );
}

// No published service has this address. Search engines are asked not
// to index the page while this state is shown.
function ServiceNotFound() {
  useSeo({ title: 'ALLSEMIS | Service not found', description: 'This service is not available. It may have been moved or unpublished, or the address may be wrong.', robots: 'noindex' });

  return (
    <ServiceFrame>
      <MeasurementLabel className="block mb-4">Not found</MeasurementLabel>
      <h1 className="font-display font-bold text-3xl sm:text-4xl md:text-5xl tracking-tight leading-[1.05]">This service is not available.</h1>
      <p className="mt-5 max-w-2xl text-base md:text-lg text-text-dim leading-relaxed">
        It may have been moved or unpublished, or the address may be wrong.
      </p>
      <div className="mt-8">
        <Link to="/employers" className="inline-flex text-sm font-semibold px-6 py-3 bg-text text-bg hover:bg-accent transition-colors">
          Back to Employers
        </Link>
      </div>
    </ServiceFrame>
  );
}

function ServiceView({ service, others }) {
  const [heroRef, mounted] = useInView(0.01);
  const [processRef, processInView] = useInView(0.2);

  // The services listed in seoPages.js have their own search text; one
  // added in the admin uses its own name and description. The
  // breadcrumb always shows the service's current name.
  const path = `/employers/${service.slug}`;
  const known = PAGE_SEO[path];
  useSeo({
    title: known ? known.title : `${service.name} | Engineering Recruitment | ALLSEMIS`,
    description: known ? known.description : (service.description || service.page?.lead || `${service.name} from ALLSEMIS.`),
    path,
    jsonLd: [breadcrumbJsonLd([{ name: 'Home', path: '/' }, { name: 'Employers', path: '/employers' }, { name: service.name, path }])],
  });

  const { page } = service;
  const Glyph = glyphFor(service.icon);
  const hasCta = Boolean(service.cta.label && service.cta.to);

  return (
    <>
      {/* ============ HERO ============ */}
      <section
        ref={(el) => { heroRef.current = el; }}
        className="relative border-b border-line pt-32 md:pt-44 pb-16 md:pb-24 overflow-hidden"
      >
        <TechnicalGrid className="opacity-[0.05]" />
        <div className="relative max-w-7xl mx-auto px-5 md:px-10">
          <Link to="/employers" className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-accent hover:text-accent-2 transition-colors mb-8">
            <span aria-hidden="true">&larr;</span> Employers
          </Link>
          <div className="flex items-center gap-3 mb-6">
            <Glyph className="text-accent" />
            <MeasurementLabel>Service / {service.num} &middot; {service.name}</MeasurementLabel>
          </div>
          <h1 className="font-display font-bold text-4xl sm:text-5xl md:text-6xl lg:text-7xl tracking-tight leading-[1.02] max-w-4xl">
            <StaggerText text={page.headline} inView={mounted} />
          </h1>
          <div className="mt-6"><AnimatedUnderline inView={mounted} /></div>
          <p className="mt-6 max-w-2xl text-base md:text-lg text-text-dim leading-relaxed">{page.lead}</p>
          <div className="flex flex-wrap gap-3 mt-8">
            {hasCta && (
              <Link to={service.cta.to} className="inline-flex text-sm font-semibold px-5 py-3 bg-text text-bg hover:bg-accent transition-colors">
                {service.cta.label}
              </Link>
            )}
            <Link to="/expertise" className="inline-flex text-sm font-semibold px-5 py-3 border border-white/25 text-text hover:border-accent transition-colors">
              Explore Sectors
            </Link>
          </div>
        </div>
      </section>

      {/* ============ WHEN IT FITS ============ */}
      <section className="border-b border-line py-20 md:py-28">
        <div className="max-w-7xl mx-auto px-5 md:px-10 grid lg:grid-cols-[1fr_1.4fr] gap-10 lg:gap-20">
          <div>
            <MeasurementLabel className="block mb-4">When It Fits</MeasurementLabel>
            <h2 className="font-display font-semibold text-3xl md:text-4xl tracking-tight">{page.fitTitle}</h2>
            <DimensionRule className="mt-6" />
          </div>
          <ul className="divide-y divide-line border-y border-line">
            {page.fit.map((item, i) => (
              <li key={i} className="flex gap-4 py-5">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-turquoise" aria-hidden="true" />
                <span className="text-base md:text-lg text-text-dim leading-relaxed">{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ============ HOW IT RUNS ============ */}
      <section ref={(el) => { processRef.current = el; }} className="border-b border-line py-20 md:py-28">
        <div className="max-w-7xl mx-auto px-5 md:px-10">
          <MeasurementLabel className="block mb-4">How It Runs</MeasurementLabel>
          <h2 className="font-display font-semibold text-3xl md:text-4xl tracking-tight mb-14">{page.processTitle}</h2>
          <ol className="grid sm:grid-cols-2 lg:grid-cols-5 gap-x-6 gap-y-10">
            {page.process.map((step, i) => (
              <li
                key={i}
                className={`relative transition-all duration-500 motion-reduce:transition-none ${processInView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'}`}
                style={{ transitionDelay: `${i * 90}ms` }}
              >
                <span className="flex w-[31px] h-[31px] items-center justify-center rounded-full border border-accent bg-bg font-mono text-[0.65rem] text-accent mb-4">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <h3 className="font-display font-semibold text-lg tracking-tight mb-2">{step.label}</h3>
                <p className="text-sm text-text-dim leading-relaxed">{step.detail}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ============ WHAT YOU RECEIVE ============ */}
      <section className="border-b border-line py-20 md:py-28">
        <div className="max-w-7xl mx-auto px-5 md:px-10 grid lg:grid-cols-2 gap-12 lg:gap-20">
          <div>
            <MeasurementLabel className="block mb-4">What You Receive</MeasurementLabel>
            <ul className="mt-6 space-y-4">
              {page.receive.map((item, i) => (
                <li key={i} className="flex items-baseline gap-4 border-b border-line pb-4">
                  <span className="font-mono text-xs text-accent">{String(i + 1).padStart(2, '0')}</span>
                  <span className="font-display font-medium text-lg md:text-xl tracking-tight">{item}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            {/* A service without tags has no tags block. */}
            {page.tags.length > 0 && (
              <>
                <MeasurementLabel className="block mb-4">{page.tagsTitle}</MeasurementLabel>
                <div className="mt-6 flex flex-wrap gap-2">
                  {page.tags.map((tag, i) => (
                    <span key={i} className="font-mono text-xs uppercase tracking-wide px-3 py-2 border border-line-strong text-text-dim">
                      {tag}
                    </span>
                  ))}
                </div>
              </>
            )}
            <p className={`${page.tags.length > 0 ? 'mt-8 ' : ''}text-sm text-text-dim leading-relaxed max-w-md`}>
              {service.description}
            </p>
          </div>
        </div>
      </section>

      {/* ============ QUESTIONS ============ */}
      {page.questions.length > 0 && (
      <section className="border-b border-line py-20 md:py-28">
        <div className="max-w-4xl mx-auto px-5 md:px-10">
          <MeasurementLabel className="block mb-4">Questions</MeasurementLabel>
          <h2 className="font-display font-semibold text-3xl md:text-4xl tracking-tight mb-10">Asked before a first call.</h2>
          <dl className="divide-y divide-line border-y border-line">
            {page.questions.map((item, i) => (
              <div key={i} className="py-6 grid md:grid-cols-[1fr_1.4fr] gap-3 md:gap-10">
                <dt className="font-display font-semibold text-lg tracking-tight">{item.q}</dt>
                <dd className="text-text-dim leading-relaxed">{item.a}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>
      )}

      {/* ============ OTHER SERVICES ============ */}
      {others.length > 0 && (
      <section className="border-b border-line py-16 md:py-20">
        <div className="max-w-7xl mx-auto px-5 md:px-10">
          <MeasurementLabel className="block mb-6">Other Services</MeasurementLabel>
          <div className="grid md:grid-cols-2 gap-6">
            {others.map((s) => {
              const OtherGlyph = glyphFor(s.icon);
              return (
                <Link key={s.id || s.slug} to={`/employers/${s.slug}`} className="group block border border-line p-6 md:p-8 hover:border-accent/50 transition-colors">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs tracking-widest text-accent">{s.num}</span>
                    <OtherGlyph className="text-accent/60" />
                  </div>
                  <h3 className="font-display font-semibold text-xl mt-4 mb-2 tracking-tight group-hover:text-accent transition-colors">{s.name}</h3>
                  <p className="text-text-dim text-sm leading-relaxed">{s.page.lead}</p>
                </Link>
              );
            })}
          </div>
        </div>
      </section>
      )}

      {/* ============ FINAL CTA ============ */}
      <section className="py-24 md:py-32 text-center">
        <div className="max-w-2xl mx-auto px-5 md:px-10">
          <h2 className="font-display font-bold text-3xl md:text-5xl tracking-tight mb-8">Tell us what you need to hire.</h2>
          {hasCta && (
            <Link to={service.cta.to} className="inline-flex text-sm font-semibold px-6 py-3 bg-text text-bg hover:bg-accent transition-colors">
              {service.cta.label}
            </Link>
          )}
        </div>
      </section>
    </>
  );
}
