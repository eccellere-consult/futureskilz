import type { Metadata } from "next";

import { SiteHeader } from "@/components/site-header";
import { OnboardingFlow } from "@/features/learner/onboarding-flow";
import { GurukulBand, HomeHero, ValuePillars } from "@/features/marketing/value-props";
import { ProductTour } from "@/features/preview/product-tour";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "FutureSkilz: learn from the best, teach what you know",
  description:
    "Guided, practical learning from experienced professionals. Learn any time, anywhere; teach and earn from your experience from home; and pass knowledge from one generation to the next, the gurukul way.",
  keywords: ["online learning India", "learn from experts", "guided learning path", "knowledge transfer", "expert coaching", "career skills", "gurukul", "AI career counsellor"],
};

export default function Home() {
  return (
    <main className="min-h-screen bg-cream text-ink">
      <SiteHeader step="Discover · 01" />
      <HomeHero />
      <div className="mx-auto w-full max-w-7xl scroll-mt-4 px-5 py-12 sm:px-8 sm:py-18 lg:py-24" id="start">
        <OnboardingFlow />
      </div>
      <ValuePillars />
      <GurukulBand />
      <ProductTour />
    </main>
  );
}
