import React, { useEffect, useState } from 'react';

export default function ScrollProgress() {
  const [pct, setPct] = useState(0);

  useEffect(function () {
    let raf = null;
    const onScroll = function () {
      if (raf) return;
      raf = requestAnimationFrame(function () {
        const h = document.documentElement;
        const max = h.scrollHeight - h.clientHeight;
        setPct(max > 0 ? (window.scrollY / max) * 100 : 0);
        raf = null;
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return function () { window.removeEventListener('scroll', onScroll); };
  }, []);

  return (
    <div
      aria-hidden="true"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        height: '2px',
        zIndex: 200,
        pointerEvents: 'none',
        background: 'rgba(167,139,250,.08)'
      }}
    >
      <div
        style={{
          height: '100%',
          width: pct + '%',
          background: 'linear-gradient(90deg, #7c3aed, #a78bfa 60%, #c084fc)',
          boxShadow: '0 0 12px rgba(167,139,250,.8)',
          transition: 'width .08s linear'
        }}
      />
    </div>
  );
}