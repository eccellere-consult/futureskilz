/** /api/contribute/admin/receipts — learner receipts the pool is drawn from (admin). Amounts are whole minor units (paise or cents). */
import type { NextRequest } from "next/server";

import { listReceipts, recordReceipt, type ReceiptInput } from "@/server/capture/earnings-service";
import { body, handle, json } from "@/server/capture/http";

export const dynamic = "force-dynamic";

export const GET = (request: NextRequest) => handle(request, async (user) => json({ receipts: await listReceipts(user.id) }));

export const POST = (request: NextRequest) =>
  handle(request, async (user) => {
    await recordReceipt(user.id, await body<ReceiptInput>(request));
    return json({ saved: true }, 201);
  }, { write: true });
