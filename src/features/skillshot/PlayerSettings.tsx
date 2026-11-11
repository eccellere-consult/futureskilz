"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

import { VOICE_RATES, aryaVoice, describeVoices, type VoiceChoice } from "@/features/arya/voice";

const CAPTIONS_KEY = "fs-captions";

/** Whether captions show. On unless the learner turned them off; remembered on this device. */
const captionListeners = new Set<() => void>();
const subscribeCaptions = (listener: () => void) => {
  captionListeners.add(listener);
  return () => void captionListeners.delete(listener);
};
const readCaptions = (): boolean => {
  try {
    return window.localStorage.getItem(CAPTIONS_KEY) !== "0";
  } catch {
    return true; // storage can be blocked: captions stay on
  }
};

export function useCaptions(): [boolean, (value: boolean) => void] {
  const on = useSyncExternalStore(subscribeCaptions, readCaptions, () => true);
  const set = (value: boolean) => {
    try {
      window.localStorage.setItem(CAPTIONS_KEY, value ? "1" : "0");
    } catch {
      /* not worth surfacing */
    }
    captionListeners.forEach((listener) => listener());
  };
  return [on, set];
}

/**
 * How the lesson sounds and reads: which voice, how fast, captions or not. The voices are the ones on the learner's own device
 * (their browser brings Google's US and UK voices, their phone or computer brings its own), named by accent and by woman or man
 * where the voice's name says so. Choices are kept on this device and apply from the next sentence.
 */
export function PlayerSettings({ captions, onCaptions, onChange }: { captions: boolean; onCaptions: (value: boolean) => void; onChange?: () => void }) {
  // This panel opens only after a click, so it is safe to read the device here, on first draw.
  const [voices, setVoices] = useState<VoiceChoice[]>(() => ("speechSynthesis" in window ? describeVoices(window.speechSynthesis.getVoices()) : []));
  const [uri, setUri] = useState(() => aryaVoice.getVoiceURI());
  const [rate, setRate] = useState(() => aryaVoice.getRate());
  const [accent, setAccent] = useState("all");
  const [gender, setGender] = useState("all");

  useEffect(() => {
    if (!("speechSynthesis" in window)) return;
    // Some browsers fill the list a moment after the page opens.
    const load = () => setVoices(describeVoices(window.speechSynthesis.getVoices()));
    window.speechSynthesis.addEventListener("voiceschanged", load);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", load);
  }, []);

  const accents = [...new Set(voices.map((voice) => voice.accent))];
  const shown = voices.filter((voice) => (accent === "all" || voice.accent === accent) && (gender === "all" || voice.gender === gender));
  const field = "min-h-10 border border-cream/30 bg-ink px-2 text-sm text-cream";
  const label = "font-mono text-[10px] uppercase text-gold-light";

  return (
    <div className="flex flex-wrap items-end gap-x-5 gap-y-3 border-t border-cream/15 px-6 py-3 text-sm">
      <label className="flex flex-col gap-1">
        <span className={label}>Accent</span>
        <select className={field} onChange={(event) => setAccent(event.target.value)} value={accent}>
          <option value="all">Any accent</option>
          {accents.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
      </label>
      <label className="flex flex-col gap-1">
        <span className={label}>Voice type</span>
        <select className={field} onChange={(event) => setGender(event.target.value)} value={gender}>
          <option value="all">Any</option>
          <option value="Female">Female</option>
          <option value="Male">Male</option>
        </select>
      </label>
      <label className="flex min-w-0 flex-col gap-1">
        <span className={label}>Voice</span>
        <select
          className={`${field} max-w-64`}
          onChange={(event) => {
            setUri(event.target.value);
            aryaVoice.setVoiceURI(event.target.value);
            onChange?.();
          }}
          value={uri}
        >
          <option value="">Arya&apos;s usual voice</option>
          {shown.map((voice) => <option key={voice.uri} value={voice.uri}>{voice.label}</option>)}
        </select>
      </label>
      <div className="flex flex-col gap-1" role="group" aria-label="Speed">
        <span className={label}>Speed</span>
        <div className="flex">
          {VOICE_RATES.map((value) => (
            <button
              aria-pressed={rate === value}
              className={`min-h-10 border border-cream/30 px-3 text-sm ${rate === value ? "bg-gold font-bold text-ink" : "text-cream"}`}
              key={value}
              onClick={() => {
                setRate(value);
                aryaVoice.setRate(value);
              }}
              type="button"
            >
              {value}×
            </button>
          ))}
        </div>
      </div>
      <label className="flex min-h-10 items-center gap-2">
        <input checked={captions} onChange={(event) => onCaptions(event.target.checked)} type="checkbox" />
        <span>Captions</span>
      </label>
      {voices.length === 0 ? <p className="w-full text-xs text-cream/60">This device offers no extra voices here. Chrome on a computer brings Google&apos;s US and UK voices.</p> : null}
    </div>
  );
}
