import { SiteHeader } from "@/components/site-header";
import { OnboardingFlow } from "@/features/learner/onboarding-flow";

export const dynamic = "force-dynamic";

export default function Home() {
  return (
    <main className="min-h-screen bg-cream text-ink">
      <SiteHeader step="Discover · 01" />
      <div className="mx-auto w-full max-w-7xl px-5 py-12 sm:px-8 sm:py-18 lg:py-24">
        <OnboardingFlow />
      </div>
    </main>
  );
}
