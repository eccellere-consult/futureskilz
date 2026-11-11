import { describe, expect, it } from "vitest";

import { forSpeech } from "./pronounce";

describe("forSpeech", () => {
  it("spells AI and other initialisms letter by letter", () => {
    expect(forSpeech("I am Arya, your AI teacher.")).toBe("I am Arya, your A I teacher.");
    expect(forSpeech("Track three KPIs with the CEO and HR.")).toBe("Track three K P Is with the C E O and H R.");
    expect(forSpeech("GenAI and A.I. tools")).toBe("Gen A I and A I tools");
  });
  it("leaves acronyms that are said as words, and ordinary capitals", () => {
    expect(forSpeech("Use SWOT, RACI and SMART goals. STOP and check. It is OK.")).toBe("Use SWOT, RACI and SMART goals. STOP and check. It is OK.");
    expect(forSpeech("PDCA")).toBe("P D C A");
  });
  it("says shorthand in full", () => {
    expect(forSpeech("Rework fell 12% vs last year, e.g. on Line 2.")).toBe("Rework fell 12 percent versus last year, for example, on Line 2.");
    expect(forSpeech("Cost: ₹96 lakh; R&D")).toBe("Cost: 96 lakh rupees; R and D");
    expect(forSpeech("Use 5W2H, then the 5 Whys.")).toBe("Use five W two H, then the five whys.");
  });
  it("reads the IT team as letters but leaves the word it alone", () => {
    expect(forSpeech("Ask the IT team if IT is ready.")).toBe("Ask the I T team if IT is ready.");
  });
});
