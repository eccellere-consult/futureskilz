export default function Home() {
  return (
    <main className="flex min-h-screen flex-col bg-cream text-ink dark:bg-purple dark:text-cream">
      <nav className="sticky top-0 z-10 border-b bg-cream/95 backdrop-blur-xl dark:border-cream/15 dark:bg-purple/95">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-4 lg:px-8">
          <span className="font-serif text-2xl font-semibold">FutureSkilz<span className="text-gold">.</span></span>
          <span className="border border-teal/40 px-3 py-1 font-mono text-[11px] uppercase tracking-[0.15em] text-teal dark:text-gold-light">
            Release 0
          </span>
        </div>
      </nav>

      <section className="mx-auto grid w-full max-w-7xl flex-1 items-center gap-16 px-6 py-20 lg:grid-cols-12 lg:px-8 lg:py-30">
        <div className="lg:col-span-7">
          <p className="mb-6 text-[11px] font-medium uppercase tracking-[0.15em] text-gold">
            Capability operating system
          </p>
          <h1 className="max-w-4xl font-serif text-6xl leading-[0.98] font-light sm:text-7xl lg:text-[5.625rem]">
            Learning reimagined for the AI age.
          </h1>
          <p className="mt-8 max-w-2xl text-lg leading-8 font-light text-ink-mid dark:text-cream/75">
            The greenfield foundation is in place. Product workflows arrive only after the platform boundaries are testable.
          </p>
        </div>

        <aside className="border border-border border-t-2 border-t-gold bg-surface p-6 text-ink shadow-[0_12px_32px_rgba(14,14,13,0.07)] sm:p-10 lg:col-span-5">
          <p className="mb-8 text-[11px] font-medium uppercase tracking-[0.15em] text-gold">Foundation status</p>
          <dl className="divide-y divide-border">
            {[
              ["Experience", "Next.js · React · Tailwind"],
              ["Data", "MariaDB · mysql2 · Drizzle"],
              ["Intelligence", "Provider-neutral AI"],
              ["Channels", "Web primary · notifications"],
            ].map(([label, value]) => (
              <div className="grid grid-cols-[7rem_1fr] gap-4 py-4 first:pt-0 last:pb-0" key={label}>
                <dt className="text-sm text-ink-light">{label}</dt>
                <dd className="text-sm font-medium">{value}</dd>
              </div>
            ))}
          </dl>
        </aside>
      </section>

      <footer className="border-t px-6 py-6 text-center text-xs text-ink-light dark:border-cream/15 dark:text-cream/60">
        FutureSkilz · An Eccellere platform
      </footer>
    </main>
  );
}
