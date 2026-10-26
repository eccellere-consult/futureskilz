import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";

import { SiteHeader } from "@/components/site-header";
import { PassportDocument } from "@/features/passport/PassportDocument";
import { resolveShare } from "@/server/passport/service";

export const dynamic = "force-dynamic";
// A shared passport is for the person who was given the link, not for search engines.
export const metadata: Metadata = { title: "Skill Passport", robots: { index: false, follow: false, nocache: true }, referrer: "no-referrer" };

export default async function SharedPassportPage({ params }: PageProps<"/p/[token]">) {
  const { token } = await params;
  const forwarded = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const shared = await resolveShare(token, forwarded).catch(() => null);
  if (!shared) notFound();
  return (
    <main className="min-h-screen bg-cream text-ink">
      <SiteHeader step="Passport" />
      <div className="px-5 py-10 sm:px-8"><PassportDocument passport={shared.passport} sharedUntil={shared.expiresAt} /></div>
    </main>
  );
}
