import type { Metadata } from "next";

import { SiteHeader } from "@/components/site-header";
import { VerifySignIn } from "@/features/learner/verify-sign-in";

export const metadata: Metadata = {
  title: "Signing in",
  referrer: "no-referrer",
  robots: { index: false, follow: false },
};

export default function VerifyPage() {
  return (
    <main className="min-h-screen bg-cream text-ink">
      <SiteHeader />
      <VerifySignIn />
    </main>
  );
}
