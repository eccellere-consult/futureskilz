import type { Metadata } from "next";

import { SiteHeader } from "@/components/site-header";
import { PlanList } from "@/features/tna/ui/PlanList";

export const metadata: Metadata = {
  title: "Plan a training",
  description: "Start from a big topic, find what learners cannot yet do, and break the topic into Skill-Shot-sized pieces.",
};

export const dynamic = "force-dynamic";

export default function TrainingNeedsPage() {
  return (
    <main className="min-h-screen bg-cream text-ink">
      <SiteHeader step="Contribute" />
      <PlanList />
    </main>
  );
}
