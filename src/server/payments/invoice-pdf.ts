import { STATES } from "@/features/payments/gst";
import { collect, newDoc } from "@/server/book/pdf";
import type { invoices } from "@/server/db/schema";

const money = (minor: number, currency: string): string => {
  try { return new Intl.NumberFormat("en-IN", { style: "currency", currency }).format(minor / 100); } catch { return `${(minor / 100).toFixed(2)} ${currency}`; }
};
const stateName = (code: string): string => `${STATES.find((s) => s.code === code)?.name ?? code} (${code})`;

/** A GST tax invoice on A4. The supplier's details are the ones copied onto the invoice when it was issued. */
export async function renderInvoice(invoice: typeof invoices.$inferSelect): Promise<Buffer> {
  const doc = newDoc(595.28, 841.89);
  doc.addPage({ size: [595.28, 841.89], margin: 0 });
  const left = 50;
  const right = 545;
  const supplier = invoice.supplier as Record<string, string>;
  doc.font("display").fontSize(26).fillColor("#14213d").text("FutureSkilz.", left, 50);
  doc.font("sansBold").fontSize(11).fillColor("#b4532a").text("TAX INVOICE", left, 56, { width: right - left, align: "right", characterSpacing: 2 });
  doc.font("sans").fontSize(9).fillColor("#5b5b66").text(`Invoice no. ${invoice.number}`, left, 74, { width: right - left, align: "right" });
  doc.text(`Date ${invoice.issuedAt.toISOString().slice(0, 10)}`, left, 87, { width: right - left, align: "right" });

  let y = 120;
  const block = (title: string, lines: string[], x: number) => {
    doc.font("sansBold").fontSize(8).fillColor("#b4532a").text(title, x, y, { characterSpacing: 1.5 });
    doc.font("body").fontSize(10.5).fillColor("#1b1b1f").text(lines.filter(Boolean).join("\n"), x, y + 14, { width: 230, lineGap: 2 });
  };
  block("SUPPLIER", [supplier.name, supplier.address, supplier.gstin ? `GSTIN ${supplier.gstin}` : "GSTIN not on file", supplier.state ? `State ${stateName(supplier.state)}` : ""], left);
  block("BILLED TO", [invoice.customerName, invoice.customerEmail, invoice.customerGstin ? `GSTIN ${invoice.customerGstin}` : "Unregistered (individual)", `Place of supply ${stateName(invoice.customerState)}`], 315);

  y = 250;
  doc.rect(left, y, right - left, 22).fill("#f3ece0");
  doc.font("sansBold").fontSize(8.5).fillColor("#1b1b1f");
  doc.text("DESCRIPTION", left + 8, y + 7);
  doc.text("TAXABLE", 330, y + 7, { width: 70, align: "right" });
  doc.text("RATE", 405, y + 7, { width: 40, align: "right" });
  doc.text("TOTAL", 450, y + 7, { width: right - 450 - 8, align: "right" });
  y += 32;
  doc.font("body").fontSize(10.5).fillColor("#1b1b1f");
  doc.text(invoice.description, left + 8, y, { width: 270 });
  doc.text(money(invoice.taxableMinor, invoice.currency), 330, y, { width: 70, align: "right" });
  doc.text(`${invoice.rateBp / 100}%`, 405, y, { width: 40, align: "right" });
  doc.text(money(invoice.totalMinor, invoice.currency), 450, y, { width: right - 450 - 8, align: "right" });
  y += 50;
  const row = (label: string, value: number, strong = false) => {
    doc.font(strong ? "sansBold" : "sans").fontSize(strong ? 11 : 9.5).fillColor("#1b1b1f").text(label, 330, y, { width: 110 });
    doc.text(money(value, invoice.currency), 440, y, { width: right - 440, align: "right" });
    y += strong ? 22 : 17;
  };
  row("Taxable value", invoice.taxableMinor);
  if (invoice.igstMinor > 0) row(`IGST ${invoice.rateBp / 100}%`, invoice.igstMinor);
  else {
    row(`CGST ${invoice.rateBp / 200}%`, invoice.cgstMinor);
    row(`SGST ${invoice.rateBp / 200}%`, invoice.sgstMinor);
  }
  doc.moveTo(330, y).lineTo(right, y).lineWidth(0.8).strokeColor("#b4532a").stroke();
  y += 8;
  row("Total paid", invoice.totalMinor, true);
  doc.font("sans").fontSize(8.5).fillColor("#5b5b66").text("Prices include GST. This is a computer-generated invoice and needs no signature.", left, 770, { width: right - left });
  return collect(doc);
}
