import React, { useEffect, useRef, useState } from 'react';

const TOTAL_FRAMES = 50;
const FRAME_BASE = '/chip-frames/';
const framePath = n => `${FRAME_BASE}frame_${String(n).padStart(3, '0')}.png`;

export default function ChipSequence() {
  const trackRef = useRef(null);
  const chipRef = useRef(null);   // chip canvas
  const fogRef = useRef(null);    // fog canvas
  const barRef = useRef(null);
  const [shouldLoad, setShouldLoad] = useState(false);
  const [frameIdx, setFrameIdx] = useState(1);
  const [stage, setStage] = useState('assembled');

  // Lazy load trigger
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const io = new IntersectionObserver(
      entries => {
        entries.forEach(e => {
          if (e.isIntersecting) { setShouldLoad(true); io.disconnect(); }
        });
      },
      { rootMargin: '400px 0px' }
    );
    io.observe(track);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!shouldLoad) return;
    const chip = chipRef.current;
    const fog = fogRef.current;
    const track = trackRef.current;
    if (!chip || !fog || !track) return;

    const chipCtx = chip.getContext('2d', { alpha: true });
    const fogCtx = fog.getContext('2d', { alpha: true });
    const images = new Array(TOTAL_FRAMES);
    let firstReady = false;
    let dpr = Math.min(window.devicePixelRatio || 1, 2);
    let progressValue = 0;
    let fogParticles = [];

    function makeFog(w, h) {
      const count = 30;
      const arr = [];
      for (let i = 0; i < count; i++) {
        arr.push({
          bx: (Math.random() - 0.5) * w * 0.75,
          by: (Math.random() - 0.5) * h * 0.6,
          r: 50 + Math.random() * 110,
          phase: Math.random() * Math.PI * 2,
          speed: 0.5 + Math.random() * 0.9,
          driftX: (Math.random() - 0.5) * 40,
          driftY: -30 - Math.random() * 50,
          hue: Math.random() > 0.7 ? 'a' : 'b',  // 'a' = light violet, 'b' = deep violet
        });
      }
      return arr;
    }

    function resize() {
      const w = Math.max(1, chip.clientWidth);
      const h = Math.max(1, chip.clientHeight);
      for (const cv of [chip, fog]) {
        cv.width = w * dpr;
        cv.height = h * dpr;
      }
      if (fogParticles.length === 0) fogParticles = makeFog(w, h);
    }

    function drawFallback() {
      resize();
      const w = chip.clientWidth;
      const h = chip.clientHeight;
      chipCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
      chipCtx.clearRect(0, 0, w, h);
      const cx = w / 2, cy = h / 2;
      const size = Math.min(w, h) * 0.5;
      chipCtx.strokeStyle = 'rgba(167,139,250,0.35)';
      chipCtx.lineWidth = 1;
      chipCtx.strokeRect(cx - size / 2, cy - size / 2, size, size);
    }

    // Fog presence curve: 0 → 1 → 0 across the scroll
    function fogIntensity(p) {
      if (p < 0.10) return 0;
      if (p < 0.50) return (p - 0.10) / 0.40;
      if (p < 0.85) return 1;
      if (p < 1.00) return 1 - (p - 0.85) / 0.15;
      return 0;
    }

    function drawFog(w, h, t) {
      const intensity = fogIntensity(progressValue);
      fogCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
      fogCtx.clearRect(0, 0, w, h);
      if (intensity <= 0.01) return;

      const cx = w / 2;
      const cy = h / 2;

      fogCtx.save();
      fogCtx.globalCompositeOperation = 'screen'; // additive glow blend

     for (let i = 0; i < fogParticles.length; i++) {
  const f = fogParticles[i];
  const local = 0.7 + Math.sin(t * 0.001 * f.speed + f.phase) * 0.3;

  // Much lower alpha - fog should hint at depth, not paint the chip over
  const a = intensity * local * 0.08;

  // Keep particles well outside the chip - push them outward from centre
  const px = cx + f.bx * 1.15 + f.driftX * intensity * 0.4 * Math.sin(t * 0.0004 + f.phase);
  const py = cy + f.by * 1.1 + f.driftY * intensity * 0.4 + Math.sin(t * 0.0006 + f.phase) * 6;

  const grad = fogCtx.createRadialGradient(px, py, 0, px, py, f.r);
  if (f.hue === 'a') {
    grad.addColorStop(0, `rgba(199,178,255,${a})`);
    grad.addColorStop(0.55, `rgba(167,139,250,${a * 0.5})`);
    grad.addColorStop(1, 'rgba(124,58,237,0)');
  } else {
    grad.addColorStop(0, `rgba(167,139,250,${a})`);
    grad.addColorStop(0.6, `rgba(124,58,237,${a * 0.4})`);
    grad.addColorStop(1, 'rgba(76,29,149,0)');
  }
  fogCtx.fillStyle = grad;
  fogCtx.beginPath();
  fogCtx.arc(px, py, f.r, 0, Math.PI * 2);
  fogCtx.fill();
}

      fogCtx.restore();
    }

    function drawChip(frameNum) {
      let idx = Math.max(1, Math.min(TOTAL_FRAMES, frameNum));
      while (idx > 1) {
        const im = images[idx - 1];
        if (im && im.complete && im.naturalWidth > 0) break;
        idx--;
      }
      const img = images[idx - 1];

      resize();
      const w = chip.clientWidth;
      const h = chip.clientHeight;
      chipCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
      chipCtx.clearRect(0, 0, w, h);

      if (!img || !img.complete || !img.naturalWidth) {
        drawFallback();
        return;
      }
      const scale = Math.min(w / img.naturalWidth, h / img.naturalHeight) * 0.98;
      const dw = img.naturalWidth * scale;
      const dh = img.naturalHeight * scale;
      chipCtx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
    }

    function updateStage(p) {
      if (p < 0.15) setStage('assembled');
      else if (p < 0.55) setStage('exploding');
      else if (p < 0.9) setStage('die revealed');
      else setStage('reassembled');
    }

    let raf = null;
    function tickLoop(t) {
      raf = requestAnimationFrame(tickLoop);
      const w = fog.clientWidth;
      const h = fog.clientHeight;
      drawFog(w, h, t);
      // chip is drawn only when frameIdx changes (below); fog every frame
      if (!firstReady) drawChip(1);
    }

    function progress() {
      const r = track.getBoundingClientRect();
      const travel = Math.max(1, r.height - window.innerHeight);
      const p = Math.max(0, Math.min(1, -r.top / travel));
      progressValue = p;
      if (barRef.current) barRef.current.style.width = `${p * 100}%`;
      const idx = Math.round(p * (TOTAL_FRAMES - 1)) + 1;
      setFrameIdx(idx);
      updateStage(p);
      if (firstReady) drawChip(idx);
    }

    const first = new Image();
    first.onload = () => {
      images[0] = first;
      firstReady = true;
      progress();
      if (!raf) raf = requestAnimationFrame(tickLoop);
      for (let i = 2; i <= TOTAL_FRAMES; i++) {
        const img = new Image();
        img.onload = (n => () => { images[n - 1] = img; })(i);
        img.src = framePath(i);
        images[i - 1] = img;
      }
    };
    first.onerror = () => {
      drawFallback();
      if (!raf) raf = requestAnimationFrame(tickLoop);
    };
    first.src = framePath(1);
    images[0] = first;

    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => { progress(); ticking = false; });
    };
    const onResize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      fogParticles = makeFog(chip.clientWidth, chip.clientHeight);
      resize();
      progress();
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize, { passive: true });
    progress();

    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onResize);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [shouldLoad]);

  return (
    <div
      ref={trackRef}
      className="relative h-[145vh] md:h-[170vh] lg:h-[195vh] mt-16 md:mt-24 lg:mt-12"
    >
      <div className="sticky top-0 h-[78vh] md:h-[80vh] lg:h-[75vh] flex items-center overflow-hidden">
        <div className="max-w-7xl mx-auto w-full px-5 md:px-10 grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-10 lg:gap-20 items-center">

          {/* LEFT - copy + live status readout */}
          <div>
            <span className="block font-mono text-[0.7rem] uppercase tracking-[0.22em] text-accent mb-4">
              Assembled to die revealed
            </span>
            <p className="text-text-dim leading-relaxed max-w-xs mb-8">
              The same chip carries the engineering complexity behind every
              Allsemi placement. Scroll to see it come apart.
            </p>

            <div className="border-l border-accent/40 pl-5">
              <span className="block font-mono text-[0.62rem] uppercase tracking-[0.24em] text-accent mb-2">
                Status
              </span>
              <div className="flex items-baseline gap-3">
                <span className="font-display font-semibold text-xl text-text">
                  {stage}
                </span>
                <span className="font-mono text-xs text-text-faint">
                  {String(frameIdx).padStart(2, '0')} / {TOTAL_FRAMES}
                </span>
              </div>
            </div>
          </div>

          {/* RIGHT - layered canvases */}
          <div className="relative">
            {/* Halo */}
            <div
              className="absolute inset-0 -z-10 blur-3xl pointer-events-none"
              style={{
                background:
                  'radial-gradient(ellipse 55% 55% at 50% 55%, rgba(167,139,250,.30), transparent 72%)',
              }}
              aria-hidden="true"
            />

            <div
              className="relative w-full"
              style={{
                aspectRatio: '16/10',
                maskImage:
                  'radial-gradient(ellipse 72% 68% at 50% 50%, black 52%, transparent 100%)',
                WebkitMaskImage:
                  'radial-gradient(ellipse 72% 68% at 50% 50%, black 52%, transparent 100%)',
              }}
            >
              {/* Fog canvas - BEHIND the chip. NOT duotoned, so it stays violet */}
              <canvas
                ref={fogRef}
                className="absolute inset-0 w-full h-full block"
                aria-hidden="true"
              />

              {/* Chip canvas - with duotone filter */}
              <canvas
                ref={chipRef}
                className="relative w-full h-full block chip-duotone"
              />
            </div>

            {/* Baseline trace */}
            <div className="relative h-px mt-4">
              <div
                className="absolute inset-x-0 h-px"
                style={{
                  background:
                    'linear-gradient(90deg, transparent, rgba(167,139,250,.4) 20%, rgba(167,139,250,.4) 80%, transparent)',
                }}
              />
              <i
                ref={barRef}
                className="absolute left-0 top-0 h-full"
                style={{
                  background:
                    'linear-gradient(90deg, var(--accent, #a78bfa), var(--accent-2, #c084fc))',
                  boxShadow: '0 0 12px rgba(167,139,250,.6)',
                  width: 0,
                }}
              />
            </div>

            <span
              className="absolute left-0 -bottom-1 w-1.5 h-1.5 rounded-full bg-accent"
              style={{ boxShadow: '0 0 8px rgba(167,139,250,.9)' }}
              aria-hidden="true"
            />
            <span
              className="absolute right-0 -bottom-1 w-1.5 h-1.5 rounded-full bg-accent"
              style={{ boxShadow: '0 0 8px rgba(167,139,250,.9)' }}
              aria-hidden="true"
            />
          </div>

        </div>
      </div>
    </div>
  );
}