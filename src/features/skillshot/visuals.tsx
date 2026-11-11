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
    case "flow":
      return (
        <ol aria-label="Flow" className="flex flex-col items-stretch gap-1 sm:flex-row sm:items-center">
          {visual.items.map((item, index) => (
            <li key={item} className="flex flex-1 flex-col items-center gap-1 sm:flex-row">
              <span className="flex min-h-16 w-full flex-1 items-center justify-center border border-gold/60 bg-ink/60 p-3 text-center text-base leading-snug">{item}</span>
              {index < visual.items.length - 1 ? <span aria-hidden="true" className="text-2xl text-gold-light"><span className="sm:hidden">↓</span><span className="hidden sm:inline">→</span></span> : null}
            </li>
          ))}
        </ol>
      );
    case "cycle":
      return <CycleDiagram centre={visual.centre} items={visual.items} />;
    case "matrix":
      return (
        <figure aria-label={`${visual.yAxis} against ${visual.xAxis}`}>
          <div className="flex gap-2">
            <p className="flex items-center font-mono text-[10px] uppercase text-gold-light [writing-mode:vertical-rl] rotate-180">{visual.yAxis} →</p>
            <div className="grid flex-1 grid-cols-2 gap-1.5">
              {visual.cells.map((cell, index) => (
                <div key={cell.title} className={`min-h-24 border p-3 ${index === 1 ? "border-teal bg-teal/15" : "border-cream/20 bg-ink/50"}`}>
                  <p className="font-display text-lg leading-tight text-gold-light">{cell.title}</p>
                  <p className="mt-1 text-sm leading-5 text-cream/90">{cell.text}</p>
                </div>
              ))}
            </div>
          </div>
          <p className="mt-1 pl-6 text-center font-mono text-[10px] uppercase text-gold-light">{visual.xAxis} →</p>
        </figure>
      );
    case "bars": {
      const top = Math.max(...visual.bars.map((bar) => bar.value), 1);
      return (
        <figure className="border border-cream/20 bg-ink/50 p-4">
          <figcaption className="font-display text-xl">{visual.title}</figcaption>
          <ul className="mt-3 space-y-2">
            {visual.bars.map((bar) => (
              <li key={bar.label} className="grid grid-cols-[minmax(5rem,30%)_1fr_auto] items-center gap-3 text-sm">
                <span className="text-cream/85">{bar.label}</span>
                <span aria-hidden="true" className="h-4 bg-cream/10"><span className="block h-4 bg-gold" style={{ width: `${Math.max(2, (bar.value / top) * 100)}%` }} /></span>
                <span className="font-semibold tabular-nums">{bar.value.toLocaleString("en-IN")}{visual.unit ?? ""}</span>
              </li>
            ))}
          </ul>
        </figure>
      );
    }
    case "timeline":
      return (
        <ol aria-label="Timeline" className="relative ml-2 space-y-3 border-l-2 border-gold-light pl-5">
          {visual.items.map((item) => (
            <li key={`${item.when}-${item.what}`} className="relative">
              <span aria-hidden="true" className="absolute -left-[27px] top-1.5 size-3 rounded-full bg-gold" />
              <p className="font-mono text-[11px] uppercase text-gold-light">{item.when}</p>
              <p className="text-base leading-6">{item.what}</p>
            </li>
          ))}
        </ol>
      );
  }
}

/** Stages placed round a circle with arrows between them, so "it comes back round" is seen, not only said. */
function CycleDiagram({ items, centre }: { items: string[]; centre?: string }) {
  const size = 320;
  const middle = size / 2;
  const radius = 112;
  const at = (index: number, r = radius) => {
    const angle = (index / items.length) * Math.PI * 2 - Math.PI / 2;
    return { x: middle + Math.cos(angle) * r, y: middle + Math.sin(angle) * r };
  };
  return (
    <figure>
      <svg aria-hidden="true" className="mx-auto w-full max-w-sm" viewBox={`0 0 ${size} ${size}`}>
        <defs>
          <marker id="cycle-arrow" markerHeight="7" markerWidth="7" orient="auto" refX="6" refY="3.5"><path d="M0,0 L7,3.5 L0,7 z" fill="#d9b25a" /></marker>
        </defs>
        {items.map((item, index) => {
          const from = (index + 0.22) / items.length;
          const to = (index + 0.78) / items.length;
          const point = (share: number) => { const angle = share * Math.PI * 2 - Math.PI / 2; return `${middle + Math.cos(angle) * radius},${middle + Math.sin(angle) * radius}`; };
          return <path key={`arc-${item}`} d={`M${point(from)} A${radius},${radius} 0 0 1 ${point(to)}`} fill="none" markerEnd="url(#cycle-arrow)" stroke="#d9b25a" strokeWidth="2" />;
        })}
        {items.map((item, index) => {
          const spot = at(index);
          return (
            <g key={item}>
              <circle cx={spot.x} cy={spot.y} fill="#16130f" r="19" stroke="#d9b25a" strokeWidth="2" />
              <text dominantBaseline="central" fill="#f4ead2" fontSize="16" fontWeight="700" textAnchor="middle" x={spot.x} y={spot.y}>{index + 1}</text>
            </g>
          );
        })}
        {centre ? <text dominantBaseline="central" fill="#f4ead2" fontSize="15" textAnchor="middle" x={middle} y={middle}>{centre.length > 22 ? `${centre.slice(0, 21)}…` : centre}</text> : null}
      </svg>
      <figcaption>
        <ol className="mt-2 grid gap-1.5 text-base sm:grid-cols-2">
          {items.map((item, index) => <li key={item} className="flex gap-2"><span className="font-display text-gold-light">{index + 1}</span>{item}</li>)}
        </ol>
        <p className="mt-1 text-xs text-cream/60">Then back to 1.</p>
      </figcaption>
    </figure>
  );
}
