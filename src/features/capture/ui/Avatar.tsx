/** The interview companion. Clearly an AI: it says so on the tile, and it is a drawn figure, not a likeness of any person. */
export function Avatar({ speaking, listening }: { speaking: boolean; listening: boolean }) {
  return (
    <div className="relative flex h-full min-h-56 w-full flex-col items-center justify-center bg-linear-to-b from-purple to-ink">
      <svg aria-hidden="true" className={`h-40 w-40 sm:h-52 sm:w-52 ${speaking ? "cx-speaking" : ""}`} viewBox="0 0 200 200">
        <circle cx="100" cy="100" r="92" fill="none" stroke="#b8913a" strokeWidth="2" opacity={listening ? 1 : 0.55} className={listening ? "cx-listening" : ""} />
        <circle cx="100" cy="100" r="80" fill="#1a1428" stroke="#d4ae6a" strokeWidth="1" />
        <path d="M44 168c8-30 32-46 56-46s48 16 56 46" fill="#3a3935" />
        <circle cx="100" cy="86" r="34" fill="#f5edd8" />
        <path d="M66 82c2-22 18-34 34-34s32 12 34 34c-8-10-20-16-34-16s-26 6-34 16z" fill="#3a3935" />
        <circle cx="87" cy="88" r="3.4" fill="#0e0e0d" className="cx-blink" />
        <circle cx="113" cy="88" r="3.4" fill="#0e0e0d" className="cx-blink" />
        <rect x="88" y="104" width="24" height="3" rx="1.5" fill="#b8913a" className="cx-mouth" />
      </svg>
      <p className="mt-2 font-mono text-[10px] uppercase tracking-wide text-gold-light">Arya · AI interviewer</p>
      <p className="sr-only" aria-live="polite">{speaking ? "The companion is speaking." : listening ? "The microphone is listening." : "Waiting for your answer."}</p>
    </div>
  );
}
