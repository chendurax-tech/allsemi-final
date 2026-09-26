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
        {/* Hidden clip-path defs: exact letterform geometry (derived from allsemi-mask.svg's
            1400x411.8421 viewBox, background rect excluded, coordinates normalized into
            objectBoundingBox space) used to hard-clip the video on mobile so it can never
            render outside the ALLSEMIS letters, regardless of raster mask edge rendering. */}
        <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true" focusable="false">
          <defs>
            <clipPath id="allsemiLettersClip" clipPathUnits="objectBoundingBox">
                <path d="M0.117877,0.872473L0.115107,0.737549L0.096647,0.737549L0.093544,0.872473L0.040188,0.872473L0.066513,0.121819L0.141107,0.121819L0.17062,0.872474L0.117877,0.872473Z M0.262376,0.872473L0.179385,0.872473L0.179385,0.121819L0.230994,0.121819L0.230994,0.72225L0.262376,0.72225L0.262376,0.872473Z M0.357871,0.872473L0.27488,0.872473L0.27488,0.121819L0.326489,0.121819L0.326489,0.72225L0.357871,0.72225L0.357871,0.872473Z M0.477332,0.798753Q0.472367,0.836775 0.458147,0.862505Q0.443925,0.888238 0.425048,0.888237Q0.40433,0.888237 0.389682,0.858564Q0.375032,0.828897 0.370498,0.782989Q0.365961,0.737085 0.365962,0.652701L0.365962,0.603556L0.413893,0.603556L0.413893,0.694894Q0.413893,0.737093 0.415916,0.749143Q0.417938,0.761204 0.423087,0.761198A0.008221,0.027948 0 0,0 0.430749,0.745897Q0.43326,0.730595 0.433262,0.700457Q0.433262,0.634159 0.428481,0.613754Q0.423577,0.593359 0.404331,0.545599Q0.385084,0.497383 0.378833,0.475588Q0.372581,0.453799 0.368474,0.415313Q0.364366,0.376833 0.364368,0.317018Q0.364368,0.230778 0.370191,0.190904Q0.376011,0.151032 0.389008,0.128543Q0.402,0.106058 0.42039,0.106055Q0.440493,0.106055 0.454653,0.130629Q0.468812,0.15521 0.473409,0.192526Q0.478006,0.229854 0.478006,0.319335L0.478006,0.349009L0.430075,0.349009L0.430075,0.29337Q0.430075,0.254423 0.428236,0.24376Q0.426397,0.233096 0.422107,0.233095A0.007644,0.025984 0 0,0 0.415058,0.247484Q0.412667,0.261871 0.412667,0.291096Q0.412667,0.328674 0.415355,0.347698Q0.41792,0.366725 0.429939,0.393593Q0.464399,0.470953 0.473348,0.52056Q0.482294,0.570178 0.482297,0.68052Q0.482297,0.76074 0.477332,0.798753Z M0.587967,0.872473L0.498478,0.872473L0.498478,0.121819L0.584535,0.121819L0.584535,0.272043L0.550087,0.272043L0.550087,0.414385L0.582328,0.414385L0.582328,0.557189L0.550087,0.557189L0.550087,0.722252L0.587967,0.722252L0.587967,0.872473Z M0.76204,0.872473L0.716927,0.872473L0.716866,0.365702L0.698907,0.872473L0.666912,0.872473L0.647972,0.377292L0.647912,0.872473L0.602799,0.872473L0.602799,0.121819L0.669579,0.121819Q0.672549,0.189521 0.675704,0.281403L0.683032,0.472341L0.694893,0.121819L0.76204,0.121819L0.76204,0.872473Z M0.834366,0.872473L0.782757,0.872473L0.782757,0.121819L0.834366,0.121819L0.834366,0.872473Z M0.963756,0.798753Q0.958792,0.836775 0.944571,0.862505Q0.930351,0.888235 0.911473,0.888237Q0.890755,0.888237 0.876107,0.858564Q0.861456,0.828897 0.856922,0.782989Q0.852385,0.737085 0.852386,0.652701L0.852386,0.603556L0.900317,0.603556L0.900317,0.694894Q0.900317,0.737093 0.90234,0.749143Q0.904363,0.761204 0.909511,0.761198A0.008222,0.02795 0 0,0 0.917173,0.745897Q0.919684,0.730595 0.919686,0.700457Q0.919686,0.634159 0.914905,0.613754Q0.910001,0.593359 0.890756,0.545599Q0.871509,0.497383 0.865258,0.475588Q0.859005,0.453799 0.854899,0.415313Q0.85079,0.376833 0.850792,0.317018Q0.850792,0.230778 0.856615,0.190904Q0.862436,0.151032 0.875432,0.128543Q0.888424,0.106058 0.906815,0.106055Q0.926918,0.106055 0.941077,0.130629Q0.955236,0.155211 0.959833,0.192527Q0.964431,0.229854 0.96443,0.319336L0.96443,0.34901L0.916499,0.34901L0.916499,0.29337Q0.916499,0.254423 0.91466,0.24376Q0.912821,0.233096 0.908531,0.233095A0.007644,0.025983 0 0,0 0.901482,0.247484Q0.899091,0.261871 0.899092,0.291096Q0.899092,0.328674 0.901778,0.347698Q0.904345,0.366725 0.916363,0.393593Q0.950823,0.470953 0.959772,0.52056Q0.968719,0.570178 0.96872,0.68052Q0.968721,0.76074 0.963756,0.798753Z M0.09599,0.604482L0.113755,0.604482Q0.109836,0.476949 0.105894,0.289198Q0.098008,0.504808 0.09599,0.604482Z" />
            </clipPath>
          </defs>
        </svg>

        <div className="relative w-[72%] mx-auto md:w-full overflow-hidden" style={{ aspectRatio: '1400 / 411.8421' }}>
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