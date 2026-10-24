'use client';

import { useEffect, useRef, useState } from 'react';
import type { Reference } from '@/lib/strategyModels/types';

/** The same drawing with its ids renamed, so two copies on one page never share an element id. */
const reId = (svg: string, prefix: string): string => svg.replace(/id="dg-/g, `id="${prefix}-`).replace(/#dg-/g, `#${prefix}-`).replace(/"dg-title dg-desc"/g, `"${prefix}-title ${prefix}-desc"`);

/**
 * The reference diagram of the industry-standard model, with who published it and how to read it. The drawing is static
 * markup from our own server (strategyModels/diagrams); "Enlarge" opens it full-screen.
 */
export default function ModelDiagramCard({ svg, reference, name }: { svg: string; reference: Reference; name: string }) {
  const [zoom, setZoom] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!zoom) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setZoom(false); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [zoom]);

  return (
    <section className="bg-white border border-eccellere-border rounded-[2px] p-6 md:p-8 mb-6" aria-label={`Reference model: ${name}`}>
      <div className="text-[11px] font-semibold tracking-[0.1em] uppercase text-eccellere-gold">Reference model</div>

      {/* The drawing gets the full width of the card, so its labels stay readable */}
      <figure className="m-0 mt-4">
        {/* Tapping the drawing enlarges it too — on a phone it is far too small to read in place */}
        <div
          role="button"
          tabIndex={0}
          aria-label={`Enlarge the ${name} diagram`}
          onClick={() => setZoom(true)}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setZoom(true); } }}
          className="cursor-zoom-in border border-eccellere-border bg-white [&>svg]:mx-auto [&>svg]:max-h-[640px] [&>svg]:max-w-[840px]"
          data-testid="model-diagram"
          dangerouslySetInnerHTML={{ __html: svg }}
        />
        <figcaption className="mt-2 flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
          <span className="min-w-[200px] flex-1 text-xs italic leading-relaxed text-eccellere-ink-light">{reference.caption}</span>
          <button type="button" onClick={() => setZoom(true)} className="rounded-[2px] border border-eccellere-gold px-3 py-1 text-xs font-semibold text-eccellere-gold transition-colors hover:bg-eccellere-gold hover:text-white">Enlarge ⤢</button>
        </figcaption>
      </figure>

      <div className="mt-6 grid grid-cols-1 gap-6 border-t border-eccellere-border pt-6 md:grid-cols-2 md:gap-10">
        <div>
          <h2 className="font-display m-0 text-2xl font-light text-eccellere-ink">About this model</h2>
          <p className="mt-3 mb-0 text-sm leading-relaxed text-eccellere-ink-mid">{reference.summary}</p>
          <p className="mt-3 mb-0 text-xs leading-relaxed text-eccellere-ink-light"><span className="font-semibold text-eccellere-ink">{reference.originator}</span> · {reference.year}</p>
        </div>
        <div>
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-eccellere-gold">How to read it</div>
          <ul className="m-0 list-disc space-y-1.5 pl-5">
            {reference.howToRead.map((h, i) => <li key={i} className="text-[13px] leading-relaxed text-eccellere-ink-mid">{h}</li>)}
          </ul>
        </div>
      </div>

      {zoom && (
        <div role="dialog" aria-modal="true" aria-label={`${name} — reference model, enlarged`} className="fixed inset-0 z-50 flex items-center justify-center bg-eccellere-ink/70 p-4" onClick={() => setZoom(false)}>
          <div className="relative max-h-full w-full max-w-5xl overflow-auto bg-white p-4 md:p-6" onClick={(e) => e.stopPropagation()}>
            <button ref={closeRef} type="button" onClick={() => setZoom(false)} className="absolute right-3 top-3 z-10 rounded-[2px] border border-eccellere-border bg-white px-3 py-1 text-xs font-semibold text-eccellere-ink hover:border-eccellere-gold">Close ✕</button>
            {/* On a narrow screen the drawing keeps a readable size and is panned sideways instead of shrunk */}
            <div className="min-w-[720px]" dangerouslySetInnerHTML={{ __html: reId(svg, 'dgz') }} />
            <p className="m-0 mt-3 text-xs italic text-eccellere-ink-light">{reference.caption}</p>
          </div>
        </div>
      )}
    </section>
  );
}
