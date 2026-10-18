import type { Metadata } from "next";

import { SiteHeader } from "@/components/site-header";
import { safeRedirectPath } from "@/server/auth/magic-link";
import { SignInForm } from "@/features/learner/sign-in-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function SignInPage({ searchParams }: PageProps<"/sign-in">) {
  const { next } = await searchParams;
  const redirectPath = safeRedirectPath(typeof next === "string" ? next : undefined);

  return (
    <main className="min-h-screen bg-cream text-ink">
      <SiteHeader />
      <div className="mx-auto grid w-full max-w-5xl gap-10 px-5 py-14 sm:px-8 sm:py-20 lg:grid-cols-[1fr_minmax(0,26rem)] lg:gap-20 lg:py-28">
        <div>
          <p className="font-mono text-[11px] uppercase text-gold">Welcome back</p>
          <h1 className="mt-4 font-serif text-5xl leading-none font-light sm:text-6xl">Pick up where you left off.</h1>
          <p className="mt-6 max-w-md text-base leading-7 text-ink-mid">
            Your profile, journey and evidence are saved to your account, so they follow you to any device.
          </p>
        </div>
        <section aria-label="Sign in" className="h-fit border-t-2 border-gold bg-surface p-6 shadow-[0_18px_48px_rgba(14,14,13,0.08)] sm:p-8">
          <SignInForm includeGuestProgress next={redirectPath} submitLabel="Email me a sign-in link" />
        </section>
      </div>
    </main>
  );
}
