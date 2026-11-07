import type { Visual } from "./types";

/** The picture beside Arya. Each one is built to be read at a glance, in reading order, with no meaning carried by colour alone. */
export function SceneVisual({ visual }: { visual: Visual }) {
  switch (visual.type) {
    case "case-card":
      return (
        <div className="border border-gold/50 bg-ink/60 p-5">
          {visual.label ? <p className="inline-block bg-gold-pale px-2 py-0.5 font-mono text-[10px] uppercase text-ink">{visual.label}</p> : null}
          <p className="mt-2 font-display text-2xl">{visual.heading}</p>
          <ul className="mt-3 space-y-2 text-base text-cream/90">{visual.facts.map((fact) => <li key={fact} className="flex gap-2"><span aria-hidden="true" className="text-gold-light">•</span>{fact}</li>)}</ul>
        </div>
      );
    case "compare":
      return (
        <table className="w-full border border-cream/20 text-left text-base">
          <caption className="sr-only">{visual.leftTitle} compared with {visual.rightTitle}</caption>
          <thead><tr className="bg-cream/10 font-mono text-[11px] uppercase text-gold-light"><th className="p-3 font-normal">&nbsp;</th><th className="p-3 font-normal">{visual.leftTitle}</th><th className="p-3 font-normal">{visual.rightTitle}</th></tr></thead>
          <tbody>{visual.rows.map(([label, left, right]) => <tr key={label} className="border-t border-cream/15"><th className="p-3 font-normal text-cream/65" scope="row">{label}</th><td className="p-3">{left}</td><td className="p-3">{right}</td></tr>)}</tbody>
        </table>
      );
    case "steps":
      return (
        <ol className="space-y-2">{visual.items.map((item, index) => <li key={item} className="flex items-start gap-3 border border-cream/15 bg-ink/50 p-3"><span className="font-display text-2xl text-gold-light">{index + 1}</span><span className="pt-1 text-base leading-6">{item}</span></li>)}</ol>
      );
    case "why-chain":
      return (
        <div>
          <p className="border border-gold/50 bg-gold/10 p-3 text-base"><span className="font-mono text-[10px] uppercase text-gold-light">Problem</span><br />{visual.problem}</p>
          <ol className="mt-2 space-y-2">{visual.links.map((link, index) => <li key={link.why} className="border-l-2 border-gold-light bg-ink/50 p-3 text-sm leading-6"><span className="font-semibold text-gold-light">{index + 1}. {link.why}</span><br />{link.because}</li>)}</ol>
          {visual.root ? <p className="mt-2 border border-teal bg-teal/15 p-3 text-base font-semibold">{visual.root}</p> : null}
        </div>
      );
    case "checklist":
      return (
        <div className="border border-cream/20 p-4"><p className="font-display text-xl">{visual.title}</p><ul className="mt-2 space-y-1.5 text-base">{visual.items.map((item) => <li key={item} className="flex gap-2"><span aria-hidden="true">☐</span>{item}</li>)}</ul></div>
      );
    case "takeaways":
      return <ol className="space-y-2">{visual.items.map((item, index) => <li key={item} className="flex items-start gap-3 border border-cream/15 bg-ink/50 p-3 text-base leading-6"><span className="font-display text-2xl text-gold-light">{index + 1}</span><span className="pt-0.5">{item}</span></li>)}</ol>;
  }
}
