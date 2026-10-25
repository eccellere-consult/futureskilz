import Link from "next/link";

import { AccountMenu } from "./account-menu";

export function SiteHeader({ step }: { step?: string }) {
  return (
    <header className="border-b border-gold/30 bg-ink text-cream">
      <div className="mx-auto flex min-h-18 w-full max-w-7xl items-center justify-between px-5 sm:px-8">
        <Link className="font-serif text-2xl font-semibold text-gold-light" href="/">
          FutureSkilz<span className="text-cream">.</span>
        </Link>
        <div className="flex items-center gap-3">
          <span className="hidden text-sm text-cream/60 lg:inline">Your capability journey</span>
          <Link className="hidden text-sm text-cream/80 underline-offset-4 hover:text-gold-light hover:underline sm:inline" href="/problem-solving">
            Problem Solving
          </Link>
          <Link className="hidden text-sm text-cream/80 underline-offset-4 hover:text-gold-light hover:underline sm:inline" href="/lessons">
            Lessons
          </Link>
          <Link className="hidden text-sm text-cream/80 underline-offset-4 hover:text-gold-light hover:underline md:inline" href="/join?as=coach">
            Become a coach
          </Link>
          {step ? (
            <span className="border border-gold/45 px-3 py-1.5 font-mono text-[10px] uppercase text-gold-light">
              {step}
            </span>
          ) : null}
          <AccountMenu />
        </div>
      </div>
    </header>
  );
}