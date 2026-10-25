/** GET /api/contribute/lessons — lessons the signed-in person may work on: all for staff, their own for a contributor. */
import type { NextRequest } from "next/server";

import { handle, json } from "@/server/capture/http";
import { listLessonsForUser } from "@/server/capture/lesson-service";

export const dynamic = "force-dynamic";

export const GET = (request: NextRequest) => handle(request, async (user) => json({ lessons: await listLessonsForUser(user.id) }));
