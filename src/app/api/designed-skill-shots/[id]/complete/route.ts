import { NextResponse } from "next/server";
import { z } from "zod";

import { getDesignedSkillShot } from "@/features/skillshot";
import { gradeKnowledgeCheck } from "@/features/skillshot/grade";
import { isSameOrigin, readJson } from "@/server/http/request";
import { currentSession, learnerRepository, noStore, unauthorized } from "@/server/learning/service";

export const dynamic = "force-dynamic";

const requestSchema = z.object({ answers: z.record(z.string().max(60), z.string().max(60)) });

export async function POST(request: Request, { params }: RouteContext<"/api/designed-skill-shots/[id]/complete">) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Request blocked." }, { status: 403, headers: noStore });
  const session = await currentSession();
  if (!session) return unauthorized();

  const blueprint = getDesignedSkillShot((await params).id);
  if (!blueprint) return NextResponse.json({ error: "Skill Shot not found." }, { status: 404, headers: noStore });
  const parsed = requestSchema.safeParse(await readJson(request).catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Answer the questions first." }, { status: 400, headers: noStore });

  // The server grades the answers itself, so the browser can never award its own evidence.
  const result = gradeKnowledgeCheck(blueprint, parsed.data.answers);
  if (!result.passed) return NextResponse.json({ ...result, evidenceAdded: false, skills: [] }, { headers: noStore });
  const outcome = await learnerRepository().completeDesignedSkillShot(session.user.id, blueprint.meta.id, blueprint.meta.skillMap);
  return NextResponse.json({ ...result, ...outcome }, { headers: noStore });
}
