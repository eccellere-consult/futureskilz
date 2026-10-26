"use client";

import { Square, Volume2, VolumeX } from "lucide-react";
import { useEffect, useState, useSyncExternalStore } from "react";

import { useSpeechOutput } from "@/features/capture/ui/speech";

import { ArayaStage } from "./ArayaStage";
import { dayPartOf, type DayPart } from "./scripts";

const never = () => () => undefined;
/** The visitor's local part of day. The server render says "day" (neutral), so nothing mismatches. */
export function useDayPart(): DayPart {
  return dayPartOf(useSyncExternalStore(never, () => new Date().getHours(), () => -1));
}

type Props = {
  /** What Arya says. Always shown as text as well, so nothing depends on sound. */
  script: string;
  /** Change this to have her speak the new script on her own (only when the visitor has turned voice on). */
  autoKey?: string | number;
  language?: string;
  className?: string;
  stageClassName?: string;
  /** Hide the text under the figure (when the page already shows it). */
  quiet?: boolean;
};

/** Arya: a live 3D figure, what she is saying in words, and a button to hear it. Sound starts only when the visitor asks. */
export function AryaPanel({ script, autoKey, language = "en", className = "", stageClassName = "h-72", quiet = false }: Props) {
  const voice = useSpeechOutput(language);
  const { enabled, speak } = voice;
  const [bow, setBow] = useState(0);

  useEffect(() => {
    if (enabled && autoKey !== undefined) speak(script);
    // Speak when the page moves on (autoKey), not on every re-render of the same script.
  }, [autoKey, enabled]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className={className}>
      <ArayaStage className={stageClassName} greetNonce={bow} listening={false} speaking={voice.speaking} />
      {quiet ? null : <p aria-live="polite" className="mt-4 text-base leading-7 text-cream/85">{script}</p>}
      <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
        <button className="inline-flex min-h-11 items-center gap-2 border border-gold px-4 font-semibold text-gold-light hover:bg-gold/10" onClick={() => { if (voice.speaking) voice.cancel(); else { setBow((n) => n + 1); voice.speak(script); } }} type="button">
          {voice.speaking ? <><Square aria-hidden="true" size={15} /> Stop</> : <><Volume2 aria-hidden="true" size={16} /> Hear Arya</>}
        </button>
        <button aria-pressed={voice.enabled} className="inline-flex min-h-11 items-center gap-2 text-cream/70 underline underline-offset-4 hover:text-cream" onClick={() => voice.setEnabled(!voice.enabled)} type="button">
          {voice.enabled ? <Volume2 aria-hidden="true" size={15} /> : <VolumeX aria-hidden="true" size={15} />} Arya speaks on her own: {voice.enabled ? "on" : "off"}
        </button>
      </div>
    </div>
  );
}
