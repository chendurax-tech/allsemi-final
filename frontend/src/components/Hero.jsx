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
      {/* Masked title — poster shows instantly, video fades in */}
      <div className="relative w-full max-w-6xl mx-auto">
        <div className="relative w-[72%] mx-auto md:w-full overflow-hidden" style={{ aspectRatio: '1400 / 400' }}>
          {/* Poster sits beneath — visible until the video is ready */}
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
            className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ${
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