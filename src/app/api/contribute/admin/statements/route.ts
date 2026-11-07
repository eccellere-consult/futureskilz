/** GET /api/contribute/admin/statements — every statement with the coach's name (admin). */
import type { NextRequest } from "next/server";

import { listStatements } from "@/server/capture/admin-overview-service";
import { handle, json } from "@/server/capture/http";

export const dynamic = "force-dynamic";

export const GET = (request: NextRequest) => handle(request, async (user) => json({ statements: await listStatements(user.id) }));
