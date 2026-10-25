/** POST /api/contribute/admin/policies/[id]/approve — the business approves a policy version. Approved versions are never edited. */
import type { NextRequest } from "next/server";

import { approvePolicy } from "@/server/capture/earnings-service";
import { handle, json } from "@/server/capture/http";

export const dynamic = "force-dynamic";

export const POST = (request: NextRequest, { params }: RouteContext<"/api/contribute/admin/policies/[id]/approve">) =>
  handle(request, async (user) => json({ policy: await approvePolicy(user.id, (await params).id) }), { write: true });
