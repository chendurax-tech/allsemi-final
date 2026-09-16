import React from 'react';
import ChipSequence from './ChipSequence.jsx';

function ReactiveWords({ text, highlight }) {
  const parts = highlight ? text.split(highlight) : [text];

  return (
    <h2 className="reactive-title">
      {parts.map((part, pi) => (
        <React.Fragment key={pi}>
          {part.split(' ').map((word, wi) => (
            <span className="rword" key={`w-${pi}-${wi}`}>
              {Array.from(word).map((ch, ci) => (
                <span className="rchar" key={`c-${pi}-${wi}-${ci}`}>{ch}</span>
              ))}
              {wi < part.split(' ').length - 1 ? (
                <span className="rchar rspace">&nbsp;</span>
              ) : null}
            </span>
          ))}
          {pi < parts.length - 1 && (
            <span className="rword accent-word" key={`h-${pi}`}>
              {Array.from(highlight).map((ch, ci) => (
                <span className="rchar accent-char" key={`ac-${pi}-${ci}`}>{ch}</span>
              ))}
            </span>
          )}
        </React.Fragment>
      ))}
    </h2>
  );
}

export default function Connecting() {
  return (
    <section className="relative border-t border-line pt-10 md:pt-12 lg:pt-14 pb-16 md:pb-24 lg:pb-32">
      <div className="max-w-4xl mx-auto px-5 md:px-10 text-center">
        <ReactiveWords
          text="Connecting the minds behind modern silicon."
          highlight="silicon"
        />

        <div className="mt-8 md:mt-10 space-y-5 text-base md:text-lg text-text-dim leading-relaxed max-w-2xl mx-auto">
          <p className="reveal">
            Complex chips require specialized people. Allsemi partners with
            engineering teams across semiconductor design, automotive,
            aerospace, and industrial technology to place the architects,
            designers, and verification engineers who carry silicon from
            concept to tape-out.
          </p>
          <p className="reveal">
            Our focus stays simple: put the right engineer in front of the
            right team, quickly and without the noise.
          </p>
        </div>
      </div>

      <ChipSequence />
    </section>
  );
}