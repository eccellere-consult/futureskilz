/** GET lists payouts (?format=csv gives the file the finance team pays from). POST queues payouts for final statements. */
import type { NextRequest } from "next/server";

import { download, handle, json } from "@/server/capture/http";
import { listPayouts, payoutsCsv, queuePayouts } from "@/server/payments/payout-service";

export const dynamic = "force-dynamic";

export const GET = (request: NextRequest) =>
  handle(request, async (user) => (new URL(request.url).searchParams.get("format") === "csv" ? download(await payoutsCsv(user.id), "coach-payouts.csv", "text/csv; charset=utf-8") : json({ payouts: await listPayouts(user.id) })));

export const POST = (request: NextRequest) => handle(request, async (user) => json(await queuePayouts(user.id)), { write: true });
