import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { csvCell } from "./payout-service";

describe("payout file", () => {
  it("quotes commas and quotes", () => {
    expect(csvCell('Rao, "Asha"')).toBe('"Rao, ""Asha"""');
    expect(csvCell(1234.5)).toBe("1234.5");
  });
  it("defuses spreadsheet formulas in a coach's name", () => {
    expect(csvCell("=HYPERLINK(\"http://x\")")).toBe('"\'=HYPERLINK(""http://x"")"');
    expect(csvCell("+91 98")).toBe("'+91 98");
    expect(csvCell("@sum")).toBe("'@sum");
  });
});
