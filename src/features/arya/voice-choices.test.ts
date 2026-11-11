import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { describeVoices } from "./voice";

const voice = (name: string, lang: string) => ({ voiceURI: name, name, lang });

describe("describeVoices", () => {
  const list = describeVoices([voice("Google UK English Male", "en-GB"), voice("Google UK English Female", "en-GB"), voice("Google US English", "en-US"), voice("Microsoft Heera - English (India)", "en-IN"), voice("Microsoft Ravi - English (India)", "en-IN"), voice("Microsoft David - English (United States)", "en-US"), voice("Google español", "es-ES"), voice("Google हिन्दी", "hi-IN")]);
  it("keeps English and Hindi voices only, Indian first, then US, then UK", () => {
    expect(list.some((item) => item.label.includes("español"))).toBe(false);
    expect(list.map((item) => item.accent).filter((accent, index, all) => all.indexOf(accent) === index)).toEqual(["Indian English", "US English", "UK English", "Hindi"]);
  });
  it("names the accent, woman or man, and the maker in plain words", () => {
    const find = (uri: string) => list.find((item) => item.uri === uri)!;
    expect(find("Google UK English Male")).toMatchObject({ accent: "UK English", gender: "Male" });
    expect(find("Google UK English Female")).toMatchObject({ accent: "UK English", gender: "Female" });
    expect(find("Google US English")).toMatchObject({ accent: "US English", gender: "Female" });
    expect(find("Microsoft Ravi - English (India)")).toMatchObject({ accent: "Indian English", gender: "Male" });
    expect(find("Microsoft David - English (United States)").label).toContain("Microsoft David");
  });
});
