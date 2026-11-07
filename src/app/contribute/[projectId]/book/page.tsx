import type { Metadata } from "next";

import { SiteHeader } from "@/components/site-header";
import { BookWorkspace } from "@/features/book/ui/BookWorkspace";

export const metadata: Metadata = { title: "My book" };

export const dynamic = "force-dynamic";

export default async function BookPage({ params }: PageProps<"/contribute/[projectId]/book">) {
  const { projectId } = await params;
  return (
    <main className="min-h-screen bg-cream text-ink">
      <SiteHeader step="Book" />
      <BookWorkspace projectId={projectId} />
    </main>
  );
}
