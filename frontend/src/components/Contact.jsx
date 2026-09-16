import React from 'react';

export default function Contact() {
  return (
    <section id="contact" className="border-t border-line py-16 md:py-24">
      <div className="max-w-7xl mx-auto px-5 md:px-10 flex flex-col md:flex-row justify-between items-start md:items-end gap-8">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-accent mb-3">Contact</p>
          <h2 className="font-display font-semibold text-3xl md:text-4xl tracking-tight leading-tight max-w-md">
            Prefer to reach us directly?
          </h2>
        </div>
        <div className="max-w-md">
          <p className="text-text-dim text-base leading-relaxed mb-4">
            Use the enquiry form above and a member of the Allsemi team will get back to you within one business day.
          </p>
          <p className="text-text-dim text-base leading-relaxed">
            For urgent hiring needs, mention it in the form and we will prioritise your request.
          </p>
        </div>
      </div>
    </section>
  );
}