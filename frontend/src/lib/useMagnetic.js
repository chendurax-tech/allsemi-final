import { useEffect } from 'react';

export function useMagnetic(selector, strength = 0.25) {
  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) return;
    const els = document.querySelectorAll(selector);
    const cleanups = [];

    els.forEach(el => {
      let tx = 0, ty = 0, cx = 0, cy = 0, raf = null;

      const onMove = (e) => {
        const r = el.getBoundingClientRect();
        const mx = e.clientX - (r.left + r.width / 2);
        const my = e.clientY - (r.top + r.height / 2);
        tx = mx * strength;
        ty = my * strength;
        if (!raf) raf = requestAnimationFrame(loop);
      };
      const onLeave = () => {
        tx = 0; ty = 0;
        if (!raf) raf = requestAnimationFrame(loop);
      };
      const loop = () => {
        cx += (tx - cx) * 0.14;
        cy += (ty - cy) * 0.14;
        el.style.transform = `translate(${cx}px, ${cy}px)`;
        if (Math.abs(tx - cx) > 0.3 || Math.abs(ty - cy) > 0.3) {
          raf = requestAnimationFrame(loop);
        } else {
          raf = null;
        }
      };

      el.addEventListener('mousemove', onMove);
      el.addEventListener('mouseleave', onLeave);
      cleanups.push(() => {
        el.removeEventListener('mousemove', onMove);
        el.removeEventListener('mouseleave', onLeave);
        el.style.transform = '';
      });
    });

    return () => cleanups.forEach(fn => fn());
  }, [selector, strength]);
}