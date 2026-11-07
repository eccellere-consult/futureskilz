import { NextResponse } from "next/server";

import { loadListings } from "@/server/marketplace/service";

export const dynamic = "force-dynamic";

/** Everything in the marketplace, for browsing and search. Public: published lessons and Skill Shots are already public. */
export async function GET() {
  const listings = await loadListings().catch(() => []);
  return NextResponse.json({ listings }, { headers: { "Cache-Control": "public, max-age=60" } });
}
