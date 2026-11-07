import type { Metadata } from "next";

import { SiteHeader } from "@/components/site-header";
import { PlanWorkspace } from "@/features/tna/ui/PlanWorkspace";

export const metadata: Metadata = { title: "Training plan" };

export const dynamic = "force-dynamic";

export default async function TrainingPlanPage({ params }: PageProps<"/contribute/training-needs/[id]">) {
  const { id } = await params;
  return (
    <main className="min-h-screen bg-cream text-ink">
      <SiteHeader step="Contribute" />
      <PlanWorkspace id={id} />
    </main>
  );
}
