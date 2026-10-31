/** GET — whether payments are connected and what has been taken. */
import type { NextRequest } from "next/server";

import { handle, json } from "@/server/capture/http";
import { paymentsOverview } from "@/server/payments/service";

export const dynamic = "force-dynamic";

export const GET = (request: NextRequest) => handle(request, async (user) => json(await paymentsOverview(user.id)));
