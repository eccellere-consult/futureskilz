import { describe, expect, it } from "vitest";

import { readablePage } from "./html";
import { formatClock, isImageFile, isMediaFile, isVideoFile, piecesFromSegments, piecesFromText } from "./media";
import { encodeWav, partRanges, toMono } from "./wav";
import { pickTrack, segmentsFromJson3, videoInfo, youtubeId } from "./youtube";

describe("recordings as reviewable pieces", () => {
  it("shows a clock time", () => {
    expect(formatClock(192)).toBe("0:03:12");
    expect(formatClock(3725)).toBe("1:02:05");
    expect(formatClock(-4)).toBe("0:00:00");
  });
  it("groups spoken segments into pieces located by the time range, and shifts a part of a longer recording", () => {
    const segments = Array.from({ length: 12 }, (_, i) => ({ start: i * 60, end: i * 60 + 55, text: `${"We reviewed the plan and agreed the owner for each task. ".repeat(8)}` }));
    const pieces = piecesFromSegments(segments);
    expect(pieces.length).toBeGreaterThan(1);
    expect(pieces[0].locator.startsWith("recording 0:00:00-")).toBe(true);
    expect(pieces.every((piece) => piece.text.length <= 3600)).toBe(true);
    const shifted = piecesFromSegments([{ start: 5, end: 20, text: "Hello there everyone, welcome." }], { offsetSeconds: 480, label: "video" });
    expect(shifted[0].locator).toBe("video 0:08:05-0:08:20");
  });
  it("drops silence and cuts untimed text on sentences", () => {
    expect(piecesFromSegments([{ start: 0, end: 1, text: "   " }])).toEqual([]);
    const pieces = piecesFromText("A sentence about the weekly review. ".repeat(300));
    expect(pieces.length).toBeGreaterThan(1);
    expect(pieces[0].locator).toBe("recording, part 1");
    expect(piecesFromText("Short note about the plan.")[0].locator).toBe("recording");
  });
  it("knows which files are recordings and pictures", () => {
    expect(isMediaFile("Weekly Review.MP4")).toBe(true);
    expect(isVideoFile("talk.webm")).toBe(true);
    expect(isVideoFile("talk.mp3")).toBe(false);
    expect(isImageFile("scan.JPG")).toBe(true);
    expect(isMediaFile("notes.pdf")).toBe(false);
  });
});

describe("cutting a long recording in the browser", () => {
  it("plans parts of 8 minutes and places each in time", () => {
    const rate = 16000;
    const ranges = partRanges(rate * 60 * 20, rate);
    expect(ranges).toHaveLength(3);
    expect(ranges.map((range) => range.offsetSeconds)).toEqual([0, 480, 960]);
    expect(ranges[2].endSample).toBe(rate * 60 * 20);
  });
  it("writes a valid 16-bit mono WAV header and keeps each part inside 25 MB", () => {
    const wav = encodeWav(new Float32Array([0, 0.5, -0.5, 1, -1]), 16000);
    const view = new DataView(wav);
    expect(String.fromCharCode(view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3))).toBe("RIFF");
    expect(view.getUint32(24, true)).toBe(16000);
    expect(view.getUint16(22, true)).toBe(1);
    expect(view.getUint32(40, true)).toBe(10);
    expect(view.getInt16(44 + 6, true)).toBe(0x7fff);
    expect(view.getInt16(44 + 8, true)).toBe(-0x8000);
    expect(44 + 16000 * 480 * 2).toBeLessThan(25 * 1024 * 1024);
  });
  it("mixes channels to one", () => {
    expect(Array.from(toMono([new Float32Array([1, 0]), new Float32Array([0, 1])]))).toEqual([0.5, 0.5]);
  });
});

describe("YouTube captions", () => {
  it("finds the video id in every common address form, and rejects the rest", () => {
    for (const url of ["https://www.youtube.com/watch?v=dQw4w9WgXcQ", "https://youtu.be/dQw4w9WgXcQ?t=4", "https://m.youtube.com/watch?v=dQw4w9WgXcQ&list=x", "https://www.youtube.com/shorts/dQw4w9WgXcQ", "https://www.youtube.com/embed/dQw4w9WgXcQ"]) expect(youtubeId(url)).toBe("dQw4w9WgXcQ");
    for (const url of ["https://example.com/watch?v=dQw4w9WgXcQ", "https://www.youtube.com/watch?v=short", "not a url", "https://www.youtube.com/playlist?list=PL1"]) expect(youtubeId(url)).toBeNull();
  });
  const page = `<html><script>var ytInitialPlayerResponse = ${JSON.stringify({
    videoDetails: { title: "Weekly planning, a } tricky { title", author: "Asha Rao", lengthSeconds: "612", isLiveContent: false },
    captions: { playerCaptionsTracklistRenderer: { captionTracks: [
      { baseUrl: "https://www.youtube.com/api/timedtext?v=x&lang=en&kind=asr", languageCode: "en", kind: "asr", name: { simpleText: "English (auto-generated)" } },
      { baseUrl: "https://www.youtube.com/api/timedtext?v=x&lang=hi", languageCode: "hi", name: { simpleText: "Hindi" } },
      { baseUrl: "https://www.youtube.com/api/timedtext?v=x&lang=en", languageCode: "en", name: { runs: [{ text: "English" }] } },
    ] } },
  })};</script></html>`;
  it("reads the title, channel, length and caption tracks even when a title contains braces", () => {
    const info = videoInfo(page);
    expect(info?.title).toBe("Weekly planning, a } tricky { title");
    expect(info?.author).toBe("Asha Rao");
    expect(info?.lengthSeconds).toBe(612);
    expect(info?.tracks).toHaveLength(3);
  });
  it("prefers written captions in the asked language over automatic ones", () => {
    const info = videoInfo(page)!;
    expect(pickTrack(info.tracks, "en")).toMatchObject({ language: "en", auto: false });
    expect(pickTrack(info.tracks, "hi")?.language).toBe("hi");
    expect(pickTrack([])).toBeNull();
  });
  it("returns null for a page with no player data", () => {
    expect(videoInfo("<html>nothing</html>")).toBeNull();
  });
  it("turns caption events into timed segments", () => {
    const segments = segmentsFromJson3({ events: [{ tStartMs: 1500, dDurationMs: 2000, segs: [{ utf8: "Start with" }, { utf8: "\nthe list" }] }, { tStartMs: 4000, segs: [{ utf8: "\n" }] }] });
    expect(segments).toEqual([{ start: 1.5, end: 3.5, text: "Start with the list" }]);
  });
});

describe("web page text", () => {
  it("keeps the article and drops scripts and menus", () => {
    const page = readablePage("<html><head><title>Lean &amp; Mean</title></head><body><nav>Home About</nav><script>evil()</script><article><h1>Weekly review</h1><p>List the orders at risk.</p><ul><li>Check supplier slots</li><li>Move one order</li></ul></article><footer>Copyright</footer></body></html>");
    expect(page.title).toBe("Lean & Mean");
    expect(page.text).toContain("Weekly review");
    expect(page.text).toContain("- Check supplier slots");
    expect(page.text).not.toMatch(/evil|Home About|Copyright/);
  });
});
