import { describe, expect, it } from "vitest";

import { decideAccess, freeSlugs, type CatalogItem } from "./access";
import { financialYear, invoiceNumber, nextSequence, splitTaxInclusive } from "./gst";
import { applyDiscount } from "./pricing";

describe("GST on a tax-inclusive price", () => {
  it("splits into CGST and SGST in the same state and IGST otherwise, always adding up to the price", () => {
    const same = splitTaxInclusive(59900, 1800, "29", "29");
    expect(same).toMatchObject({ intraState: true, igstMinor: 0, taxableMinor: 50763 });
    expect(same.cgstMinor + same.sgstMinor).toBe(same.taxMinor);
    expect(same.taxableMinor + same.taxMinor).toBe(59900);
    const other = splitTaxInclusive(59900, 1800, "29", "27");
    expect(other).toMatchObject({ intraState: false, cgstMinor: 0, sgstMinor: 0, igstMinor: other.taxMinor });
  });
  it("holds for odd amounts and a zero rate", () => {
    for (const total of [1, 99, 100, 12345, 99999]) {
      const s = splitTaxInclusive(total, 1800, "29", "29");
      expect(s.taxableMinor + s.cgstMinor + s.sgstMinor + s.igstMinor).toBe(total);
    }
    expect(splitTaxInclusive(1000, 0, "29", "27").taxMinor).toBe(0);
  });
  it("treats an unknown supplier state as inter-state rather than guessing", () => {
    expect(splitTaxInclusive(1000, 1800, "", "29").intraState).toBe(false);
  });
});

describe("invoice numbers", () => {
  it("follow the April to March year in India time", () => {
    expect(financialYear(new Date("2026-04-01T00:00:00+05:30"))).toBe("26-27");
    expect(financialYear(new Date("2026-03-31T23:59:00+05:30"))).toBe("25-26");
    expect(financialYear(new Date("2026-03-31T19:00:00Z"))).toBe("26-27"); // 00:30 IST on 1 April
  });
  it("are consecutive within a year, restart in a new one, and fit in 16 characters", () => {
    expect(nextSequence([], "26-27")).toBe(1);
    expect(nextSequence(["FS/26-27/000001", "FS/26-27/000007", "FS/25-26/000099"], "26-27")).toBe(8);
    expect(invoiceNumber("26-27", 42)).toBe("FS/26-27/000042");
    expect(invoiceNumber("26-27", 999999).length).toBeLessThanOrEqual(16);
  });
});

describe("discounts", () => {
  it("round down the discount so the learner never pays less than the code says", () => {
    expect(applyDiscount(59900, 1500)).toEqual({ listMinor: 59900, discountMinor: 8985, payMinor: 50915 });
    expect(applyDiscount(999, 3333).discountMinor).toBe(332);
    expect(applyDiscount(1000, 0).payMinor).toBe(1000);
    expect(applyDiscount(1000, 99999).payMinor).toBe(0);
  });
});

describe("free tier", () => {
  const catalog: CatalogItem[] = [
    { slug: "a1", pillarId: "digital" }, { slug: "a2", pillarId: "digital" }, { slug: "a3", pillarId: "digital" },
    { slug: "b1", pillarId: "thinking" }, { slug: "b2", pillarId: "thinking" }, { slug: "b3", pillarId: "thinking" }, { slug: "b4", pillarId: "thinking" },
    { slug: "x1", pillarId: null }, { slug: "x2", pillarId: null }, { slug: "x3", pillarId: null },
  ];
  it("makes the first two in each pillar free", () => {
    expect([...freeSlugs(catalog)].sort()).toEqual(["a1", "a2", "b1", "b2", "x1", "x2"]);
    expect(freeSlugs(catalog, 3).has("a3")).toBe(true);
  });
  it("locks nothing until payments are live", () => {
    expect(decideAccess({ slug: "a3", catalog, hasPass: false, enforced: false })).toEqual({ allowed: true, reason: "not-enforced" });
  });
  it("locks the rest until there is a pass, and a pass opens everything", () => {
    expect(decideAccess({ slug: "a1", catalog, hasPass: false, enforced: true }).reason).toBe("free");
    expect(decideAccess({ slug: "a3", catalog, hasPass: false, enforced: true })).toEqual({ allowed: false, reason: "locked" });
    expect(decideAccess({ slug: "a3", catalog, hasPass: true, enforced: true })).toEqual({ allowed: true, reason: "pass" });
  });
  it("does not hide something that is not in the catalogue", () => {
    expect(decideAccess({ slug: "draft", catalog, hasPass: false, enforced: true }).reason).toBe("unlisted");
  });
});
