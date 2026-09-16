import { useEffect } from 'react';

export function useReveal() {
  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const targets = document.querySelectorAll('.reveal, .kinetic-title');

    if (reduce) {
      targets.forEach(el => el.classList.add('in', 'is-visible'));
      return;
    }

    const io = new IntersectionObserver(
      entries => {
        entries.forEach(e => {
          if (e.isIntersecting) {
            e.target.classList.add('in', 'is-visible');
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.15, rootMargin: '0px 0px -8% 0px' }
    );

    targets.forEach(el => io.observe(el));
    return () => io.disconnect();
  }, []);
}

export function useReactiveLetters() {
  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) return;

    const titles = document.querySelectorAll('.reactive-title');
    const cleanups = [];

    titles.forEach(el => {
      const chars = Array.from(el.querySelectorAll('.rchar'));
      if (!chars.length) return;

      // ---- Desktop: cursor-reactive ----
      let mx = -9999;
      let my = -9999;
      let raf = null;
      let active = false;

      const applyInfluence = (x, y, isActive) => {
        const r = el.getBoundingClientRect();
        for (let i = 0; i < chars.length; i++) {
          const c = chars[i];
          const cr = c.getBoundingClientRect();
          const cx = cr.left - r.left + cr.width / 2;
          const cy = cr.top - r.top + cr.height / 2;
          const dx = x - cx;
          const dy = y - cy;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const influence = isActive ? Math.max(0, 1 - dist / 220) : 0;
          const lift = influence * -14;
          const scale = 1 + influence * 0.16;
          const isAccent = c.classList.contains('accent-char');

          c.style.transform = `translateY(${lift}px) scale(${scale})`;

          if (influence > 0.05) {
            c.style.textShadow = `0 0 ${12 * influence}px rgba(167,139,250,${influence * 0.8})`;
            if (!isAccent) c.style.color = `rgba(255,255,255,${0.85 + influence * 0.15})`;
          } else {
            c.style.textShadow = '';
            if (!isAccent) c.style.color = '';
          }
        }
      };

      const onMove = e => {
        const r = el.getBoundingClientRect();
        mx = e.clientX - r.left;
        my = e.clientY - r.top;
        active = true;
        if (!raf) raf = requestAnimationFrame(() => { raf = null; applyInfluence(mx, my, active); });
      };
      const onLeave = () => {
        active = false;
        if (!raf) raf = requestAnimationFrame(() => { raf = null; applyInfluence(mx, my, false); });
      };

      el.addEventListener('mousemove', onMove);
      el.addEventListener('mouseleave', onLeave);

      // ---- Mobile: wave animation when scrolled into view ----
      const isTouch = window.matchMedia('(hover: none)').matches || 'ontouchstart' in window;
      let waveIO = null;
      let touchIO = null;

      if (isTouch) {
        waveIO = new IntersectionObserver(entries => {
          entries.forEach(entry => {
            if (!entry.isIntersecting) return;
            // Stagger letters left-to-right
            chars.forEach((c, i) => {
              const delay = i * 22;
              setTimeout(() => {
                c.style.transform = 'translateY(-10px) scale(1.1)';
                c.style.textShadow = '0 0 14px rgba(167,139,250,0.7)';
                setTimeout(() => {
                  c.style.transform = '';
                  c.style.textShadow = '';
                }, 400);
              }, delay);
            });
            waveIO.unobserve(el);
          });
        }, { threshold: 0.4 });
        waveIO.observe(el);

        // Tap anywhere on the title to ripple the effect
        const onTouchStart = e => {
          const t = e.touches[0];
          if (!t) return;
          const r = el.getBoundingClientRect();
          applyInfluence(t.clientX - r.left, t.clientY - r.top, true);
          setTimeout(() => {
            applyInfluence(t.clientX - r.left, t.clientY - r.top, false);
          }, 500);
        };
        el.addEventListener('touchstart', onTouchStart, { passive: true });
        cleanups.push(() => el.removeEventListener('touchstart', onTouchStart));
      }

      cleanups.push(() => {
        el.removeEventListener('mousemove', onMove);
        el.removeEventListener('mouseleave', onLeave);
        if (raf) cancelAnimationFrame(raf);
        if (waveIO) waveIO.disconnect();
        if (touchIO) touchIO.disconnect();
      });
    });

    return () => cleanups.forEach(fn => fn());
  }, []);
}