/** GET /api/contribute/staff/projects — approved interviews that editors can turn into lessons. */
import type { NextRequest } from "next/server";

import { handle, json } from "@/server/capture/http";
import { listApprovedProjects } from "@/server/capture/lesson-service";

export const dynamic = "force-dynamic";

export const GET = (request: NextRequest) => handle(request, async (user) => json({ projects: await listApprovedProjects(user.id) }));
