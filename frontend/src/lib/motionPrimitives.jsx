import React, { useEffect, useRef, useState } from 'react';

/*
  Shared, reusable visual/interaction primitives for Phase 4 and
  beyond, so new pages draw from one small library instead of each
  reinventing its own grid/scan-line/parallax logic. All motion here
  is restrained (instrumentation, not flashy web effects), desktop
  mouse-reactive pieces are gated to pointer-capable devices, and
  every animated piece resolves to its settled state immediately under
  prefers-reduced-motion.
*/

export function prefersReducedMotion() {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

// Toggles true once the referenced element scrolls into view (one-shot).
export function useInView(threshold = 0.3) {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (prefersReducedMotion()) { setInView(true); return; }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setInView(true);
            io.disconnect();
          }
        });
      },
      { threshold }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [threshold]);

  return [ref, inView];
}

// Subtle cursor parallax on a layer within a container - direct DOM
// manipulation (not React state) to stay cheap. Desktop-pointer-only,
// no-ops under prefers-reduced-motion.
export function useParallax(strength = 10) {
  const containerRef = useRef(null);
  const layerRef = useRef(null);

  useEffect(() => {
    const container = containerRef.current;
    const layer = layerRef.current;
    if (!container || !layer) return;
    if (prefersReducedMotion()) return;
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;

    function onMove(e) {
      const r = container.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width - 0.5;
      const py = (e.clientY - r.top) / r.height - 0.5;
      layer.style.transform = `translate3d(${px * -strength}px, ${py * -strength}px, 0)`;
    }
    function onLeave() { layer.style.transform = ''; }
    container.addEventListener('mousemove', onMove);
    container.addEventListener('mouseleave', onLeave);
    return () => {
      container.removeEventListener('mousemove', onMove);
      container.removeEventListener('mouseleave', onLeave);
    };
  }, [strength]);

  return [containerRef, layerRef];
}

// Cursor-reactive radial highlight - a soft glow that follows the
// pointer within a container. Desktop-pointer-only.
export function useRadialHighlight() {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (prefersReducedMotion()) return;
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    function onMove(e) {
      const r = el.getBoundingClientRect();
      el.style.setProperty('--mx', `${e.clientX - r.left}px`);
      el.style.setProperty('--my', `${e.clientY - r.top}px`);
      el.style.setProperty('--mo', '1');
    }
    function onLeave() { el.style.setProperty('--mo', '0'); }
    el.addEventListener('mousemove', onMove);
    el.addEventListener('mouseleave', onLeave);
    return () => {
      el.removeEventListener('mousemove', onMove);
      el.removeEventListener('mouseleave', onLeave);
    };
  }, []);
  return ref;
}

// A quiet technical grid background, low opacity, purely decorative.
export function TechnicalGrid({ className = '' }) {
  return (
    <div
      className={`absolute inset-0 pointer-events-none opacity-[0.07] ${className}`}
      style={{
        backgroundImage:
          'linear-gradient(rgba(167,139,250,.6) 1px, transparent 1px), linear-gradient(90deg, rgba(167,139,250,.6) 1px, transparent 1px)',
        backgroundSize: '42px 42px',
      }}
      aria-hidden="true"
    />
  );
}

// A single scan line sweeping once across a container when it enters
// view - a measurement pass, not a looping radar sweep.
export function ScanLine({ inView, className = '' }) {
  return (
    <div
      className={`absolute inset-x-0 h-px bg-gradient-to-r from-transparent via-accent/70 to-transparent pointer-events-none motion-reduce:hidden ${className} ${
        inView ? 'scan-line-play' : 'opacity-0'
      }`}
      aria-hidden="true"
    />
  );
}

// A small pulse that travels once along a horizontal line when it
// enters view - used on process-flow diagrams.
export function SignalPulse({ inView, className = '' }) {
  return (
    <span
      className={`absolute top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-accent shadow-[0_0_6px_rgba(167,139,250,0.8)] pointer-events-none motion-reduce:hidden ${className} ${
        inView ? 'signal-pulse-play' : 'opacity-0'
      }`}
      aria-hidden="true"
    />
  );
}

// Character/word stagger reveal for a short heading. Splits on
// whitespace (words, not characters, to keep the DOM light and avoid
// breaking ligatures); each word fades/rises in with a small delay
// offset. Renders fully visible immediately under reduced motion.
export function StaggerText({ text, inView, className = '', wordClassName = '', delayStep = 40 }) {
  const words = text.split(' ');
  const reduce = prefersReducedMotion();
  return (
    <span className={className}>
      {words.map((w, i) => (
        <span key={i} className="inline-block overflow-hidden align-bottom mr-[0.28em]">
          <span
            className={`inline-block transition-all duration-500 ease-out motion-reduce:transition-none ${wordClassName} ${
              inView || reduce ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-[110%]'
            }`}
            style={{ transitionDelay: reduce ? '0ms' : `${i * delayStep}ms` }}
          >
            {w}
          </span>
        </span>
      ))}
    </span>
  );
}

// A thin accent rule that draws in (width 0 -> full) once in view.
export function AnimatedUnderline({ inView, widthClass = 'w-20', className = '' }) {
  return (
    <span
      className={`block h-0.5 bg-gradient-to-r from-accent to-accent-2 transition-all duration-500 ease-out motion-reduce:transition-none ${className} ${
        inView ? widthClass : 'w-0'
      }`}
    />
  );
}

// Small coordinate/measurement label, the site's existing technical-
// annotation register (mono, uppercase, quiet).
export function MeasurementLabel({ children, className = '' }) {
  return (
    <span className={`font-mono text-[0.62rem] uppercase tracking-[0.2em] text-accent/70 ${className}`}>
      {children}
    </span>
  );
}
