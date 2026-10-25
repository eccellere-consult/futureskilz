/**
 * /api/demo/seed — POST { code, action: "seed" | "retire" }. Builds the sample learner, coach, editor and admin with one
 * finished example each, or retires the sample lessons so real learners never see them. Off unless DEMO_ACCESS_CODE is set.
 */
import { NextResponse } from "next/server";

import { checkCode, demoEnabled, demoSeeded } from "@/server/demo/access";
import { retireDemo, seedDemo } from "@/server/demo/seed";
import { clientIp, isSameOrigin, readJson } from "@/server/http/request";

export const dynamic = "force-dynamic";
export const maxDuration = 300;
const headers = { "Cache-Control": "no-store" };

let lastFailure: { at: string; message: string } | null = null;

export async function GET() {
  if (!demoEnabled()) return NextResponse.json({ enabled: false }, { headers });
  return NextResponse.json({ enabled: true, seeded: await demoSeeded().catch(() => false), lastFailure }, { headers });
}

export async function POST(request: Request) {
  if (!demoEnabled()) return NextResponse.json({ error: "Not found." }, { status: 404, headers });
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Request blocked." }, { status: 403, headers });
  const input = (await readJson(request, 2_000).catch(() => ({}))) as { code?: string; action?: string };
  if (!checkCode(String(input.code ?? ""), clientIp(request))) return NextResponse.json({ error: "That access code is not right." }, { status: 401, headers });
  try {
    if (input.action === "retire") return NextResponse.json({ retired: await retireDemo() }, { headers });
    return NextResponse.json(await seedDemo(), { headers });
  } catch (error) {
    lastFailure = { at: new Date().toISOString(), message: error instanceof Error ? error.message : String(error) };
    console.error("[demo/seed]", error instanceof Error ? (error.stack ?? error.message) : error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "The demo could not be set up." }, { status: 500, headers });
  }
}
