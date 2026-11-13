"use client";

import { PART_SECONDS, TARGET_RATE, encodeWav, partRanges, toMono } from "@/features/intake/wav";

export type RecordingPart = { blob: Blob; name: string; offsetSeconds: number; label: string };

/** The longest file this browser will try to open. Decoding holds the whole recording in memory. */
export const MAX_BROWSER_DECODE_BYTES = 300 * 1024 * 1024;

/**
 * Cuts a long audio or video file into parts of about 8 minutes, as 16 kHz mono WAV, inside this browser tab, because the
 * transcription service takes at most 25 MB at a time and the website's server has no audio tools. Only the sound is kept.
 */
export async function splitRecording(file: File, onStatus: (message: string) => void): Promise<RecordingPart[]> {
  if (file.size > MAX_BROWSER_DECODE_BYTES) throw new Error("This file is over 300 MB, which is too large to open in a browser tab. Save its sound as a smaller audio file (mp3 or m4a) and add that.");
  const Context = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Context) throw new Error("This browser cannot open recordings. Try another browser, or save the sound as an audio file under 25 MB.");
  onStatus("Opening the recording in your browser…");
  const context = new Context({ sampleRate: TARGET_RATE });
  try {
    let decoded: AudioBuffer;
    try {
      decoded = await context.decodeAudioData(await file.arrayBuffer());
    } catch {
      throw new Error("This browser could not read the sound in that file (the format may not be supported). Save it as an mp3 or m4a and add that.");
    }
    const mono = toMono(Array.from({ length: decoded.numberOfChannels }, (_, i) => decoded.getChannelData(i)));
    const ranges = partRanges(mono.length, decoded.sampleRate, PART_SECONDS);
    const base = file.name.replace(/\.[^.]+$/, "");
    return ranges.map((range, index) => ({
      blob: new Blob([encodeWav(mono.subarray(range.startSample, range.endSample), decoded.sampleRate)], { type: "audio/wav" }),
      name: `${base} (part ${index + 1} of ${ranges.length}).wav`,
      offsetSeconds: range.offsetSeconds,
      label: `part ${index + 1} of ${ranges.length}`,
    }));
  } finally {
    void context.close();
  }
}
