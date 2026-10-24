/**
 * Builds the files the Problem Solving browser journey uploads (references/08 §3 step 10), the way a person would make them:
 *   • a blank 5 Whys template with two answers typed into it (as if filled in Excel), saved as a plain template;
 *   • a one-page PDF that states the problem, for the "any other document" path (read by the fake AI).
 * Run: npx tsx e2e/make-kit-fixtures.ts <output folder>
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import * as XLSX from "xlsx";

import { getModelDefinition } from "../src/lib/strategyModels/registry";
import { strategyKit } from "../src/lib/strategyModels/kit";
import { kitBytes } from "../src/lib/templateKit/workbook";

async function main() {
  const out = process.argv[2];
  if (!out) throw new Error("Give the output folder.");
  mkdirSync(out, { recursive: true });

  const def = getModelDefinition("five-whys");
  if (!def) throw new Error("five-whys is not registered.");
  const kit = strategyKit({ toolId: "five-whys", name: "5 Whys", originator: def.reference.originator, structure: def, brand: { product: "FutureSkilz", section: "Problem Solving" } });

  // The blank template, then two answers typed into it the way a person would.
  const workbook = XLSX.read(await kitBytes(kit.def, null), { type: "array" });
  let typed = 0;
  for (const name of workbook.SheetNames) {
    const sheet = workbook.Sheets[name];
    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "" });
    const header = (rows[0] ?? []).map((c) => String(c).trim().toLowerCase());
    const fieldCol = header.indexOf("field"), valueCol = header.indexOf("value");
    if (fieldCol >= 0 && valueCol >= 0) {
      rows.forEach((row, r) => {
        const label = String(row[fieldCol] ?? "").trim();
        const value = label === "The root cause" ? "Delivery dates are never re-planned when a customer changes an order." : null;
        if (value) { sheet[XLSX.utils.encode_cell({ r, c: valueCol })] = { t: "s", v: value }; typed += 1; }
      });
    }
    const whyCol = header.indexOf("why"), answerCol = header.indexOf("because…");
    if (whyCol >= 0 && answerCol >= 0) {
      rows.forEach((row, r) => {
        if (String(row[whyCol] ?? "").trim() === "Why 1") { sheet[XLSX.utils.encode_cell({ r, c: answerCol })] = { t: "s", v: "Orders changed after release are shipped on the original date." }; typed += 1; }
      });
    }
  }
  if (typed !== 2) throw new Error(`Expected to type 2 answers, typed ${typed}. Sheets: ${workbook.SheetNames.join(", ")}`);
  writeFileSync(path.join(out, "FutureSkilz-5-Whys-Template-filled.xlsx"), XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }));

  // A small, valid one-page PDF with the problem as text.
  const text = "Root cause: delivery dates are not re-planned when an order changes.";
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    null,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  const stream = `BT /F1 14 Tf 72 760 Td (${text}) Tj ET`;
  objects[3] = `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`;
  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((body, i) => { offsets.push(pdf.length); pdf += `${i + 1} 0 obj\n${body}\nendobj\n`; });
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("")}`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  writeFileSync(path.join(out, "problem-note.pdf"), pdf, "latin1");
  console.log(`Wrote the filled template (${typed} answers typed) and problem-note.pdf to ${out}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
