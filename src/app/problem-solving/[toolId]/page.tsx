import type { Metadata } from "next";

import { publishedTool } from "@/lib/problemSolving/server";

import ProblemSolvingToolClient from "./ProblemSolvingToolClient";

// Per-person and auth-aware: rendered per request, never prerendered.
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/problem-solving/[toolId]">): Promise<Metadata> {
  const { toolId } = await params;
  const tool = await publishedTool(toolId).catch(() => null);
  return { title: tool ? `${tool.name} · Problem Solving` : "Problem Solving" };
}

export default async function ProblemSolvingToolPage({ params, searchParams }: PageProps<"/problem-solving/[toolId]">) {
  const { toolId } = await params;
  const { demo, case: caseParam } = await searchParams;
  // ?demo=1 is the worked example: a fictional company's completed tool, read-only, nothing saved. ?case=<id> is the
  // learner's own problem the page saves to (checked on the server on every request). The key makes moving between the
  // example, the real tool and another problem a fresh page, so answers can never carry over from one to another.
  const isDemo = demo === "1";
  const caseId = typeof caseParam === "string" && /^[0-9]+$/.test(caseParam) ? Number(caseParam) : null;
  return (
    <ProblemSolvingToolClient
      caseId={isDemo ? null : caseId}
      demo={isDemo}
      key={`${toolId}:${isDemo ? "demo" : caseId ?? "none"}`}
      toolId={toolId}
    />
  );
}
