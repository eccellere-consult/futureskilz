/** GET — a GST invoice as a PDF, for its buyer or an admin. */
import type { NextRequest } from "next/server";

import { handle } from "@/server/capture/http";
import { renderInvoice } from "@/server/payments/invoice-pdf";
import { invoiceFor } from "@/server/payments/service";

export const dynamic = "force-dynamic";

export const GET = (request: NextRequest, { params }: RouteContext<"/api/payments/invoices/[id]">) =>
  handle(request, async (user) => {
    const invoice = await invoiceFor(user.id, (await params).id);
    const pdf = await renderInvoice(invoice);
    return new Response(new Uint8Array(pdf), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${invoice.number.replaceAll("/", "-")}.pdf"`, "Cache-Control": "no-store" } });
  });
