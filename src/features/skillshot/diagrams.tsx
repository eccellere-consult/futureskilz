/**
 * Drawn diagrams for the slide's picture: shapes built from the lesson's own words, so the idea is seen and not only read.
 * Every shape carries its text as real text (it wraps, scales and is read by screen readers), meaning is never carried by
 * colour alone, and each one folds down to a phone's width without sideways scrolling.
 */

const HEX = "polygon(50% 0, 100% 25%, 100% 75%, 50% 100%, 0 75%, 0 25%)";

function HexTile({ text, centre = false, number }: { text: string; centre?: boolean; number?: number }) {
  return (
    <div className="aspect-[0.866] w-[31%] max-w-36 shrink-0" style={{ filter: "drop-shadow(0 0 0.5px rgba(217,178,90,0.9))" }}>
      <div className={`flex h-full w-full flex-col items-center justify-center px-[12%] text-center ${centre ? "bg-gold text-ink" : "bg-[#241d2e] text-cream"}`} style={{ clipPath: HEX }}>
        {number ? <span className="font-display text-base leading-none text-gold-light">{number}</span> : null}
        <span className={`leading-tight ${centre ? "text-sm font-bold sm:text-base" : "text-[11px] sm:text-sm"}`}>{text}</span>
      </div>
    </div>
  );
}

/** A honeycomb: the central idea in the middle, the parts that make it up around it. */
export function HexagonDiagram({ centre, items }: { centre: string; items: string[] }) {
  // Clockwise from the top left, so the numbers read round the centre: top row, right, bottom row, left.
  // Three or four parts sit above and below the centre; five or six also take the two sides.
  const sides = items.length >= 5;
  const top = items.slice(0, 2);
  const right = sides ? items[2] : undefined;
  const bottom = (sides ? [items[4], items[3]] : [items[3], items[2]]).filter(Boolean) as string[];
  const left = sides ? items[5] : undefined;
  const numberOf = (text: string) => items.indexOf(text) + 1;
  const row = "flex justify-center gap-[2%]";
  return (
    <figure aria-label={`${centre}: ${items.join(", ")}`}>
      <div className="mx-auto w-full max-w-md">
        <div className={row}>{top.map((item) => <HexTile key={item} number={numberOf(item)} text={item} />)}</div>
        <div className={`${row} -mt-[8.4%]`}>
          {left ? <HexTile number={numberOf(left)} text={left} /> : sides ? <div className="w-[31%] max-w-36 shrink-0" /> : null}
          <HexTile centre text={centre} />
          {right ? <HexTile number={numberOf(right)} text={right} /> : null}
        </div>
        {bottom.length ? <div className={`${row} -mt-[8.4%]`}>{bottom.map((item) => <HexTile key={item} number={numberOf(item)} text={item} />)}</div> : null}
      </div>
    </figure>
  );
}

/** A road from now to the goal: phases in order, each with when it happens and what it delivers, ending at a flag. */
export function RoadmapDiagram({ phases }: { phases: Array<{ when: string; title: string; text?: string }> }) {
  return (
    <figure aria-label="Roadmap">
      <div className="relative">
        {/* The road: upright beside the stops on a phone, running left to right with an arrowhead on a wider screen. */}
        <div aria-hidden="true" className="absolute bottom-3 left-[14px] top-3 w-1 bg-gold/60 sm:hidden" />
        <div aria-hidden="true" className="absolute left-4 right-4 top-[13px] hidden h-1.5 bg-gold/70 sm:block"><span className="absolute -right-3 -top-[7px] text-base leading-none text-gold">▶</span></div>
        <ol className="relative grid gap-y-5 sm:gap-x-3" style={{ gridTemplateColumns: `repeat(${phases.length}, minmax(0, 1fr))` }}>
          {phases.map((phase, index) => (
            <li key={`${phase.when}-${phase.title}`} className="col-span-full flex gap-3 sm:col-span-1 sm:block">
              <span className={`flex size-8 shrink-0 items-center justify-center rounded-full border-2 border-gold font-display text-base sm:mx-auto ${index === phases.length - 1 ? "bg-gold text-ink" : "bg-ink text-gold-light"}`}>{index === phases.length - 1 ? "⚑" : index + 1}</span>
              <div className="min-w-0 sm:mt-2 sm:border sm:border-cream/20 sm:bg-ink/50 sm:p-3 sm:text-center">
                <p className="font-mono text-[10px] uppercase text-gold-light">{phase.when}</p>
                <p className="font-display text-lg leading-tight">{phase.title}</p>
                {phase.text ? <p className="mt-1 text-sm leading-5 text-cream/85">{phase.text}</p> : null}
              </div>
            </li>
          ))}
        </ol>
      </div>
    </figure>
  );
}

/** Slices of a triangle. `widen` true is a pyramid (narrow at the top), false a funnel (wide at the top). */
function Slices({ rows, widen }: { rows: Array<{ label: string; side?: string }>; widen: boolean }) {
  const count = rows.length;
  return (
    <ol className="space-y-1">
      {rows.map((row, index) => {
        // Half-widths of the slice's top and bottom edges, as a share of the shape's full width. The narrow end is cut flat, so its number has room.
        const tip = 0.16;
        const topHalf = 50 * Math.max(tip, widen ? index / count : 1 - index / count);
        const bottomHalf = 50 * Math.max(tip, widen ? (index + 1) / count : 1 - (index + 1) / count);
        const strong = widen ? index === 0 : index === count - 1;
        return (
          <li key={row.label} className="grid grid-cols-[minmax(0,44%)_minmax(0,1fr)] items-center gap-3">
            <div className={`flex h-14 items-center justify-center font-display text-lg ${strong ? "bg-gold text-ink" : "bg-[#3a2f4a] text-gold-light"}`} style={{ clipPath: `polygon(${50 - topHalf}% 0, ${50 + topHalf}% 0, ${50 + bottomHalf}% 100%, ${50 - bottomHalf}% 100%)` }}>{index + 1}</div>
            <p className="text-base leading-snug">{row.label}{row.side ? <span className="ml-2 font-semibold tabular-nums text-gold-light">{row.side}</span> : null}</p>
          </li>
        );
      })}
    </ol>
  );
}

/** Levels that build on one another: the top is what everything below supports. */
export function PyramidDiagram({ levels }: { levels: string[] }) {
  return <figure aria-label={`Pyramid, top to base: ${levels.join("; ")}`}><Slices rows={levels.map((label) => ({ label }))} widen /></figure>;
}

/** Stages that narrow: many go in at the top, few come out at the bottom. */
export function FunnelDiagram({ stages }: { stages: Array<{ label: string; value?: string }> }) {
  return <figure aria-label={`Funnel: ${stages.map((stage) => `${stage.label}${stage.value ? ` ${stage.value}` : ""}`).join("; ")}`}><Slices rows={stages.map((stage) => ({ label: stage.label, side: stage.value }))} widen={false} /></figure>;
}

/** The classic two-by-two: two axes with arrows, four named boxes, the one to aim for (top right) picked out. */
export function MatrixDiagram({ xAxis, yAxis, cells }: { xAxis: string; yAxis: string; cells: Array<{ title: string; text: string }> }) {
  return (
    <figure aria-label={`${yAxis} against ${xAxis}`}>
      <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-2">
        <div className="flex flex-col items-center justify-between py-1 font-mono text-[10px] uppercase text-gold-light">
          <span>High</span>
          <span className="rotate-180 font-semibold [writing-mode:vertical-rl]">{yAxis}</span>
          <span>Low</span>
        </div>
        <div className="relative border-b-2 border-l-2 border-gold/80">
          <span aria-hidden="true" className="absolute -left-[7px] -top-3 text-xs leading-none text-gold">▲</span>
          <span aria-hidden="true" className="absolute -bottom-[7px] -right-3 text-xs leading-none text-gold">▶</span>
          <div className="grid grid-cols-2 gap-1.5 p-1.5">
            {cells.map((cell, index) => (
              <div key={cell.title} className={`min-h-24 p-3 ${index === 1 ? "border-2 border-gold bg-gold/20" : "border border-cream/20 bg-ink/50"}`}>
                <p className="font-display text-lg leading-tight text-gold-light">{cell.title}{index === 1 ? <span className="ml-1 align-middle text-xs" aria-label="aim here">★</span> : null}</p>
                <p className="mt-1 text-sm leading-5 text-cream/90">{cell.text}</p>
              </div>
            ))}
          </div>
        </div>
        <span />
        <div className="mt-1 flex justify-between font-mono text-[10px] uppercase text-gold-light"><span>Low</span><span className="font-semibold">{xAxis}</span><span>High</span></div>
      </div>
    </figure>
  );
}
