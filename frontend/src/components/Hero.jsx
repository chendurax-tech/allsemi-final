import React, { useRef, useEffect, useState } from 'react';

export default function Hero() {
  const videoRef = useRef(null);
  const [videoReady, setVideoReady] = useState(false);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = true;

    const tryPlay = () => {
      v.play().catch(() => {});
    };

    if (v.readyState >= 2) {
      setVideoReady(true);
      tryPlay();
    } else {
      const onCanPlay = () => {
        setVideoReady(true);
        tryPlay();
      };
      v.addEventListener('canplay', onCanPlay);
      v.addEventListener('loadeddata', onCanPlay);
      return () => {
        v.removeEventListener('canplay', onCanPlay);
        v.removeEventListener('loadeddata', onCanPlay);
      };
    }
  }, []);

  return (
    <section
      id="heroSection"
      className="relative min-h-[85svh] md:min-h-screen flex flex-col justify-center px-5 md:px-10 pt-24 md:pt-32 pb-10 md:pb-14 overflow-hidden"
    >
      {/* Masked title - poster shows instantly, video fades in */}
      <div className="relative w-full max-w-6xl mx-auto">
        {/* Hidden clip-path defs: exact letterform geometry (derived from allsemi-mask.svg,
            background rect excluded) used to hard-clip the video on mobile so it can never
            render outside the ALLSEMI letters, regardless of raster mask edge rendering. */}
        <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true" focusable="false">
          <defs>
            <clipPath id="allsemiLettersClip" clipPathUnits="objectBoundingBox">
                <path d="M 0.134771 0.875575 l -0.003014 -0.13575 h -0.020071 l -0.003379 0.13575 H 0.050293 L 0.078921 0.12025 H 0.16 L 0.192143 0.875575 Z m 0.157143 0 H 0.20165 V 0.12025 h 0.056121 V 0.724425 h 0.034121 Z m 0.103843 0 H 0.305493 V 0.12025 h 0.056121 V 0.724425 H 0.395714 Z m 0.1299 -0.074175 q -0.0054 0.03825 -0.020864 0.06415 T 0.468786 0.89145 q -0.022529 0 -0.038457 -0.029875 t -0.020864 -0.07605 q -0.004929 -0.04615 -0.004929 -0.1311 V 0.605 h 0.052143 v 0.091925 q 0 0.0425 0.0022 0.054575 c 0.001471 0.0081 0.004064 0.012125 0.0078 0.012125 s 0.006507 -0.005125 0.008329 -0.015375 0.002736 -0.025525 0.002736 -0.045725 q 0 -0.066725 -0.0052 -0.08725 -0.005336 -0.020525 -0.026257 -0.068575 -0.020936 -0.048525 -0.027729 -0.07045 t -0.011264 -0.06065 q -0.004464 -0.038725 -0.004464 -0.098925 0 -0.086775 0.006329 -0.1269 t 0.020464 -0.06275 q 0.014136 -0.0225 0.034129 -0.0225 0.021857 0 0.037257 0.024725 t 0.020393 0.0623 q 0.005 0.0375 0.005 0.1275 v 0.02985 H 0.474286 V 0.292875 q 0 -0.039225 -0.002 -0.05 t -0.006664 -0.010725 a 0.008479 0.029675 0 0 0 -0.007664 0.014475 q -0.002607 0.014475 -0.0026 0.043875 0 0.0378 0.002921 0.05695 0.002786 0.019175 0.015857 0.046175 0.037471 0.07785 0.0472 0.127775 T 0.531036 0.6825 Q 0.531036 0.763175 0.525636 0.8014 Z m 0.1203 0.074175 H 0.548629 V 0.12025 h 0.093571 v 0.15115 H 0.60475 v 0.143225 h 0.035057 v 0.1437 H 0.60475 v 0.1661 h 0.041186 Z m 0.189286 0 h -0.049057 l -0.000064 -0.51 -0.019529 0.51 h -0.034793 L 0.711186 0.3773 l -0.000064 0.498275 H 0.662064 V 0.12025 h 0.072614 q 0.003236 0.0681 0.006664 0.160575 L 0.749286 0.47295 0.762207 0.12025 h 0.073014 Z m 0.078643 0 h -0.056114 V 0.12025 h 0.056114 Z" />
                <path d="M 0.110971 0.605925 h 0.019286 q -0.004286 -0.128325 -0.008571 -0.31725 Q 0.113164 0.505625 0.110971 0.605925 Z" />
            </clipPath>
          </defs>
        </svg>

        <div className="relative w-[72%] mx-auto md:w-full overflow-hidden" style={{ aspectRatio: '1400 / 400' }}>
          {/* Poster sits beneath - visible until the video is ready */}
          <img
            src="/allsemi-mask.svg"
            alt=""
            aria-hidden="true"
            className="absolute inset-0 w-full h-full block pointer-events-none z-10"
          />

          <video
            ref={videoRef}
            autoPlay
            loop
            muted
            playsInline
            preload="auto"
            poster="/allsemi-mask.svg"
            className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 hero-video-letters-clip ${
              videoReady ? 'opacity-100' : 'opacity-0'
            }`}
          >
            <source src="/hero-loop.mp4" type="video/mp4" />
          </video>

          {/* Mask on top of video, letters are the cutout */}
          <img
            src="/allsemi-mask.svg"
            alt=""
            aria-hidden="true"
            className="absolute inset-0 w-full h-full block pointer-events-none z-20"
          />
        </div>
      </div>

      <div className="relative z-10 max-w-7xl mx-auto w-full text-center mt-8 md:mt-12">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-accent mb-5">
          Talent. Engineered.
        </p>
        <p className="text-base md:text-lg text-text-dim max-w-2xl mx-auto leading-relaxed">
          We connect the engineers behind modern silicon, from architecture
          to tape-out, with the semiconductor, automotive, aerospace, and
          industrial teams building what is next.
        </p>
        <div className="mt-8 md:mt-10 flex flex-wrap gap-3 justify-center">
          <a href="#enquiry" className="text-sm font-semibold px-5 py-3 bg-text text-bg hover:bg-accent transition-colors">
            Hire Talent
          </a>
          <a href="#enquiry" className="text-sm font-semibold px-5 py-3 border border-line-strong hover:border-accent transition-colors">
            Search Jobs
          </a>
        </div>
      </div>
    </section>
  );
}