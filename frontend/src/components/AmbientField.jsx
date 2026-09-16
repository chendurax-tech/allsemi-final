import React, { useEffect, useRef } from 'react';

export default function AmbientField() {
  const canvasRef = useRef(null);

  useEffect(function () {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) return;

    const ctx = canvas.getContext('2d');
    let w = 0, h = 0, dpr = Math.min(window.devicePixelRatio || 1, 2);
    let nodes = [], mouse = { x: -9999, y: -9999 };
    let raf = null, running = false;

    function build() {
      const rect = canvas.getBoundingClientRect();
      w = rect.width; h = rect.height;
      canvas.width = w * dpr; canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      nodes = [];
      const spacing = 90;
      const cols = Math.ceil(w / spacing) + 1;
      const rows = Math.ceil(h / spacing) + 1;
      for (let i = 0; i < cols; i++) {
        for (let j = 0; j < rows; j++) {
          nodes.push({
            bx: i * spacing,
            by: j * spacing,
            x: i * spacing,
            y: j * spacing,
            phase: Math.random() * Math.PI * 2
          });
        }
      }
    }

    function draw(t) {
      if (!running) return;
      ctx.clearRect(0, 0, w, h);
      const spacing = 90;
      const cols = Math.ceil(w / spacing) + 1;
      ctx.lineWidth = 1;

      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i];
        const dx = mouse.x - n.bx;
        const dy = mouse.y - n.by;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const inf = Math.max(0, 1 - dist / 240);
        const pull = inf * 22;

        n.x = n.bx + (dx / (dist || 1)) * pull;
        n.y = n.by + (dy / (dist || 1)) * pull;

        if ((i + 1) % cols !== 0) {
          const r = nodes[i + 1];
          if (r) {
            ctx.beginPath();
            ctx.moveTo(n.x, n.y);
            ctx.lineTo(r.x, r.y);
            ctx.strokeStyle = 'rgba(167,139,250,' + (0.04 + inf * 0.14) + ')';
            ctx.stroke();
          }
        }
        const below = nodes[i + cols];
        if (below) {
          ctx.beginPath();
          ctx.moveTo(n.x, n.y);
          ctx.lineTo(below.x, below.y);
          ctx.strokeStyle = 'rgba(167,139,250,' + (0.04 + inf * 0.14) + ')';
          ctx.stroke();
        }

        const alpha = 0.06 + inf * 0.5 + Math.sin(t / 1400 + n.phase) * 0.03;
        ctx.beginPath();
        ctx.arc(n.x, n.y, 1 + inf * 1.5, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(167,139,250,' + alpha + ')';
        ctx.fill();
      }
      raf = requestAnimationFrame(draw);
    }

    function start() { if (!running) { running = true; raf = requestAnimationFrame(draw); } }
    function stop() { running = false; if (raf) cancelAnimationFrame(raf); }

    function onMove(e) {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
    }

    build();
    const onResize = function () { build(); };
    window.addEventListener('resize', onResize, { passive: true });
    window.addEventListener('mousemove', onMove, { passive: true });
    start();

    const onVis = function () { document.hidden ? stop() : start(); };
    document.addEventListener('visibilitychange', onVis);

    return function () {
      stop();
      window.removeEventListener('resize', onResize);
      window.removeEventListener('mousemove', onMove);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{
        position: 'fixed',
        inset: 0,
        width: '100vw',
        height: '100vh',
        zIndex: 0,
        pointerEvents: 'none',
        opacity: 0.6
      }}
    />
  );
}