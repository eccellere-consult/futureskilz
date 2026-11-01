"use client";

import { useEffect, useState } from "react";

import { ARYA_SPEAK_ENDPOINT, aryaVoice, type VoiceSource } from "./voice";

type Availability = { server: boolean; providers: { openai: boolean; xai: boolean }; anthropic: { available: false; reason: string }; default: "openai" | "xai" | null };

const CHOICES: Array<{ id: VoiceSource; label: string; note: string }> = [
  { id: "device", label: "My phone or device (no AI)", note: "Uses your device's own voice. Free, private, works offline." },
  { id: "openai", label: "OpenAI voice (AI)", note: "A natural studio voice from the OpenAI API." },
  { id: "xai", label: "Grok voice (AI)", note: "A studio voice from the xAI Grok API." },
];

/**
 * Lets the listener pick where Arya's voice comes from: their own device (no AI), or an AI voice service. AI choices are offered
 * only when the site has that service switched on. Anthropic is shown as unavailable, with the reason, because it has no voice API.
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
    <fieldset className={className}>
      <legend className="font-mono text-[10px] uppercase text-gold-light">Arya&apos;s voice</legend>
      <div className="mt-2 space-y-1.5">
        {CHOICES.map((choice) => {
          const on = enabled(choice.id);
          return (
            <label key={choice.id} className={`flex cursor-pointer items-start gap-2 text-sm ${on ? "" : "cursor-not-allowed opacity-50"}`}>
              <input checked={shown === choice.id} className="mt-1" disabled={!on} name="arya-voice-source" onChange={() => { setChosen(choice.id); aryaVoice.setSource(choice.id); }} type="radio" />
              <span><span className="font-semibold">{choice.label}</span><span className="block text-xs opacity-75">{on ? choice.note : "Not switched on for this site."}</span></span>
            </label>
          );
        })}
        <label className="flex cursor-not-allowed items-start gap-2 text-sm opacity-50">
          <input className="mt-1" disabled name="arya-voice-source" type="radio" />
          <span><span className="font-semibold">Anthropic voice</span><span className="block text-xs opacity-75">{available?.anthropic.reason ?? "Anthropic has no voice (text-to-speech) API, so it cannot be a voice."}</span></span>
        </label>
      </div>
    </fieldset>
  );
}
