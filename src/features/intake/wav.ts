/** Cutting a long recording into parts the transcription service accepts (25 MB each), done in the person's browser. Pure functions. */

/** 16 kHz mono 16-bit is 32 KB a second, so 8 minutes is about 15 MB, comfortably inside the limit. */
export const PART_SECONDS = 8 * 60;
export const TARGET_RATE = 16_000;

export type PartRange = { startSample: number; endSample: number; offsetSeconds: number };

export function partRanges(totalSamples: number, rate = TARGET_RATE, partSeconds = PART_SECONDS): PartRange[] {
  const size = Math.max(1, Math.floor(rate * partSeconds));
  const ranges: PartRange[] = [];
  for (let start = 0; start < totalSamples; start += size) ranges.push({ startSample: start, endSample: Math.min(totalSamples, start + size), offsetSeconds: Math.round(start / rate) });
  return ranges;
}

/** A WAV file (16-bit PCM, mono) from samples in the range -1 to 1. */
export function encodeWav(samples: Float32Array, rate = TARGET_RATE): ArrayBuffer {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const text = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i += 1) view.setUint8(offset + i, value.charCodeAt(i));
  };
  text(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  text(8, "WAVE");
  text(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, rate, true);
  view.setUint32(28, rate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  text(36, "data");
  view.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i += 1) {
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(44 + i * 2, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true);
  }
  return buffer;
}

/** Averages the channels of a decoded recording into one. */
export function toMono(channels: Float32Array[]): Float32Array {
  if (channels.length === 1) return channels[0];
  const out = new Float32Array(channels[0].length);
  for (const channel of channels) for (let i = 0; i < out.length; i += 1) out[i] += channel[i] / channels.length;
  return out;
}
