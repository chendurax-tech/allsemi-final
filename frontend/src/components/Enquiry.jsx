import React, { useState } from 'react';

export default function Enquiry() {
  const [step, setStep] = useState(0);

  return (
    <section id="enquiry" className="border-t border-line py-16 md:py-24 lg:py-32">
      <div className="max-w-7xl mx-auto px-5 md:px-10 mb-10 md:mb-14">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-accent mb-3">Get in touch</p>
        <h2 className="font-display font-semibold text-4xl md:text-5xl lg:text-6xl tracking-tight leading-tight">
          Hello. How can we help?
        </h2>
        <span className="block mt-6 w-20 h-0.5 bg-gradient-to-r from-accent to-accent-2 shadow-[0_0_12px_rgba(167,139,250,0.5)]" />
      </div>

      <div className="max-w-3xl mx-auto px-5 md:px-10">
        <div className="border border-line bg-bg-raised p-6 md:p-10 min-h-[320px]">
          {step === 0 && (
            <div className="space-y-4">
              <p className="text-text-dim text-sm mb-2">I'm looking to:</p>
              <button onClick={() => setStep(1)} className="w-full text-left border border-line-strong p-4 flex justify-between hover:border-accent hover:bg-accent/10 transition-colors">
                Hire talent <span className="text-accent">→</span>
              </button>
              <button onClick={() => setStep(1)} className="w-full text-left border border-line-strong p-4 flex justify-between hover:border-accent hover:bg-accent/10 transition-colors">
                Find my next role <span className="text-accent">→</span>
              </button>
              <button onClick={() => setStep(1)} className="w-full text-left border border-line-strong p-4 flex justify-between hover:border-accent hover:bg-accent/10 transition-colors">
                Make a general enquiry <span className="text-accent">→</span>
              </button>
            </div>
          )}

          {step === 1 && (
            <div>
              <p className="text-text-dim text-sm mb-4">My name is:</p>
              <label className="block text-xs text-text-faint mb-2">Full name</label>
              <input type="text" className="w-full bg-transparent border-b border-line-strong text-text py-2 focus:border-accent focus:outline-none" />
              <div className="flex justify-between mt-8">
                <button onClick={() => setStep(0)} className="text-sm text-text-faint hover:text-text-dim">← Back</button>
                <button onClick={() => setStep(2)} className="text-sm font-semibold px-5 py-3 bg-text text-bg hover:bg-accent transition-colors">Continue</button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div>
              <p className="text-text-dim text-sm mb-4">Reach me on:</p>
              <label className="block text-xs text-text-faint mb-2">Email</label>
              <input type="email" className="w-full bg-transparent border-b border-line-strong text-text py-2 focus:border-accent focus:outline-none mb-6" />
              <div className="flex justify-between mt-8">
                <button onClick={() => setStep(1)} className="text-sm text-text-faint hover:text-text-dim">← Back</button>
                <button onClick={() => setStep(3)} className="text-sm font-semibold px-5 py-3 bg-text text-bg hover:bg-accent transition-colors">Submit</button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="text-center py-8">
              <h3 className="font-display font-semibold text-2xl mb-3">Thank you.</h3>
              <p className="text-text-dim">We have received your enquiry and will be in touch.</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}