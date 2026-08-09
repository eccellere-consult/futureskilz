import Link from "next/link";

export function SiteHeader({ step }: { step?: string }) {
  return (
    <header className="border-b border-border bg-cream/95 backdrop-blur-xl">
      <div className="mx-auto flex min-h-18 w-full max-w-7xl items-center justify-between px-5 sm:px-8">
        <Link className="font-serif text-2xl font-semibold text-ink" href="/">
          FutureSkilz<span className="text-gold">.</span>
        </Link>
        <div className="flex items-center gap-3">
          <span className="hidden text-sm text-ink-light sm:inline">Your capability journey</span>
          {step ? (
            <span className="border border-teal/35 px-3 py-1.5 font-mono text-[10px] uppercase text-teal">
              {step}
            </span>
          ) : null}
        </div>
      </div>
    </header>
  );
}