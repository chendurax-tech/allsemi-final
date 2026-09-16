import React, { useEffect, useRef } from 'react';

const TOTAL_FRAMES = 50;
const FRAME_BASE = '/chip-frames/';
const framePath = n => `${FRAME_BASE}frame_${String(n).padStart(3, '0')}.png`;

export default function ChipSequence() {
  const trackRef = useRef(null);
  const canvasRef = useRef(null);
  const barRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const track = trackRef.current;
    if (!canvas || !track) return;

    const ctx = canvas.getContext('2d', { alpha: true });
    const images = new Array(TOTAL_FRAMES);
    let firstReady = false;
    let dpr = Math.min(window.devicePixelRatio || 1, 2);

    function resize() {
      const w = Math.max(1, canvas.clientWidth);
      const h = Math.max(1, canvas.clientHeight);
      canvas.width = w * dpr;
      canvas.height = h * dpr;
    }

    function drawFallback() {
      resize();
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      const cx = w / 2;
      const cy = h / 2;
      const size = Math.min(w, h) * 0.55;

      ctx.strokeStyle = 'rgba(167,139,250,0.4)';
      ctx.lineWidth = 1;
      ctx.strokeRect(cx - size / 2, cy - size / 2, size, size);
      ctx.strokeStyle = 'rgba(167,139,250,0.2)';
      ctx.strokeRect(cx - size * 0.4, cy - size * 0.4, size * 0.8, size * 0.8);
      ctx.fillStyle = 'rgba(167,139,250,0.15)';
      ctx.fillRect(cx - size * 0.3, cy - size * 0.3, size * 0.6, size * 0.6);
    }

    function draw(frameNum) {
      let idx = Math.max(1, Math.min(TOTAL_FRAMES, frameNum));
      while (idx > 1) {
        const im = images[idx - 1];
        if (im && im.complete && im.naturalWidth > 0) break;
        idx--;
      }
      const img = images[idx - 1];
      if (!img || !img.complete || !img.naturalWidth) {
        drawFallback();
        return;
      }
      resize();
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      const scale = Math.min(w / img.naturalWidth, h / img.naturalHeight) * 0.98;
      const dw = img.naturalWidth * scale;
      const dh = img.naturalHeight * scale;
      ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
    }

    function progress() {
      const r = track.getBoundingClientRect();
      const travel = Math.max(1, r.height - window.innerHeight);
      const p = Math.max(0, Math.min(1, -r.top / travel));
      if (barRef.current) barRef.current.style.width = `${p * 100}%`;
      if (firstReady) draw(Math.round(p * (TOTAL_FRAMES - 1)) + 1);
      else drawFallback();
    }

    const first = new Image();
    first.onload = () => {
      images[0] = first;
      firstReady = true;
      draw(1);
      progress();
    };
    first.onerror = () => drawFallback();
    first.src = framePath(1);
    images[0] = first;

    for (let i = 2; i <= TOTAL_FRAMES; i++) {
      const img = new Image();
      img.onload = (n => () => {
        images[n - 1] = img;
      })(i);
      img.src = framePath(i);
      images[i - 1] = img;
    }

    let tick = false;
    const onScroll = () => {
      if (tick) return;
      tick = true;
      requestAnimationFrame(() => {
        progress();
        tick = false;
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener(
      'resize',
      () => {
        dpr = Math.min(window.devicePixelRatio || 1, 2);
        resize();
        progress();
      },
      { passive: true }
    );
    progress();

    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div
      ref={trackRef}
      className="relative h-[140vh] md:h-[170vh] lg:h-[190vh] mt-20 md:mt-28"
    >
      <div className="sticky top-0 h-[85vh] md:h-[80vh] lg:h-[78vh] flex items-center overflow-hidden">
        <div className="max-w-7xl mx-auto w-full px-5 md:px-10 grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-10 lg:gap-16 items-center">
          {/* Left copy */}
          <div className="relative">
            <span className="block font-mono text-[0.7rem] uppercase tracking-[0.22em] text-accent mb-4">
              Assembled to die revealed
            </span>
            <p className="text-text-dim leading-relaxed max-w-xs">
              The same chip carries the engineering complexity behind every
              Allsemi placement. Scroll to see it come apart.
            </p>
            <span className="block mt-6 h-px w-16 bg-gradient-to-r from-accent to-transparent" />
          </div>

          {/* Chip panel */}
          <div className="relative">
            {/* Halo behind */}
            <div
              className="absolute inset-0 -z-10 blur-3xl"
              style={{
                background:
                  'radial-gradient(ellipse 55% 50% at 50% 55%, rgba(167,139,250,.35), transparent 70%), radial-gradient(ellipse 40% 40% at 50% 60%, rgba(124,58,237,.28), transparent 75%)',
              }}
              aria-hidden="true"
            />

            {/* Framed panel */}
            <div className="relative border border-line/60 rounded-sm bg-gradient-to-b from-white/[0.02] to-transparent overflow-hidden">
              {/* Grid background */}
              <div
                className="absolute inset-0 opacity-40 pointer-events-none"
                style={{
                  backgroundImage:
                    'linear-gradient(rgba(167,139,250,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(167,139,250,0.08) 1px, transparent 1px)',
                  backgroundSize: '48px 48px',
                  maskImage:
                    'radial-gradient(ellipse 60% 60% at 50% 50%, black 30%, transparent 80%)',
                  WebkitMaskImage:
                    'radial-gradient(ellipse 60% 60% at 50% 50%, black 30%, transparent 80%)',
                }}
                aria-hidden="true"
              />

              {/* Corner traces */}
              <span className="absolute top-0 left-0 w-8 h-8 border-l-2 border-t-2 border-accent/60" />
              <span className="absolute top-0 right-0 w-8 h-8 border-r-2 border-t-2 border-accent/60" />
              <span className="absolute bottom-0 left-0 w-8 h-8 border-l-2 border-b-2 border-accent/60" />
              <span className="absolute bottom-0 right-0 w-8 h-8 border-r-2 border-b-2 border-accent/60" />

              {/* Animated scan line */}
              <span className="absolute inset-x-0 h-px bg-gradient-to-r from-transparent via-accent to-transparent top-0 animate-scan" />

              {/* Canvas */}
              <div className="relative aspect-[16/10]">
                <canvas
                  ref={canvasRef}
                  className="w-full h-full block"
                />
              </div>

              {/* Progress bar */}
              <div className="relative h-px bg-line">
                <i
                  ref={barRef}
                  className="absolute left-0 top-0 h-full bg-gradient-to-r from-accent to-accent-2"
                  style={{ width: 0 }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}