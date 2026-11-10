"use client";

import { useEffect, useState } from "react";

import { ARYA_SPEAK_ENDPOINT, aryaVoice, type VoiceSource } from "./voice";

type Availability = { server: boolean; providers: { openai: boolean; xai: boolean }; anthropic: { available: false; reason: string }; default: "openai" | "xai" | null };

const CHOICES: Array<{ id: VoiceSource; label: string; note: string }> = [
  { id: "device", label: "This device's voice", note: "Free and private. Works offline." },
  { id: "openai", label: "Natural voice", note: "A clear studio voice. Needs a connection." },
  { id: "xai", label: "Natural voice, second style", note: "Another studio voice. Needs a connection." },
];

/**
 * Lets the listener pick where Arya's voice comes from: their own device (no AI), or an AI voice service. AI choices are offered
 * only when the site has that service switched on. Only the voices switched on for this site are listed, in plain names, behind one small link so the page stays calm.
 * The choice is kept on this device only.
 */
export function VoiceSourcePicker({ className = "" }: { className?: string }) {
  const [available, setAvailable] = useState<Availability | null>(null);
  const [chosen, setChosen] = useState<VoiceSource>("auto");

  useEffect(() => {
    // Read the stored choice and the site's offer together, after the page has loaded, so server and browser render the same first.
    fetch(ARYA_SPEAK_ENDPOINT, { cache: "no-store" })
      .then((response) => (response.ok ? (response.json() as Promise<Availability>) : null))
      .catch(() => null)
      .then((offer) => {
        setChosen(aryaVoice.getSource());
        setAvailable(offer);
      });
  }, []);

  const enabled = (id: VoiceSource) => id === "device" || Boolean(available?.providers[id as "openai" | "xai"]);
  // "auto" is the site default; show the matching choice as selected.
  const shown: VoiceSource = chosen === "auto" ? (available?.default ?? "device") : chosen;

  return (
    <details className={className}>
      <summary className="cursor-pointer font-mono text-[10px] uppercase text-gold-light">Change Arya&apos;s voice</summary>
      <div className="mt-2 space-y-1.5">
        {CHOICES.filter((choice) => enabled(choice.id)).map((choice) => (
          <label key={choice.id} className="flex cursor-pointer items-start gap-2 text-sm">
            <input checked={shown === choice.id} className="mt-1" name="arya-voice-source" onChange={() => { setChosen(choice.id); aryaVoice.setSource(choice.id); }} type="radio" />
            <span><span className="font-semibold">{choice.label}</span><span className="block text-xs opacity-75">{choice.note}</span></span>
          </label>
        ))}
      </div>
    </details>
  );
}
