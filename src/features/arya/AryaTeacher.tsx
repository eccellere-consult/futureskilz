"use client";

import { ChevronLeft, ChevronRight, Square, Volume2, VolumeX } from "lucide-react";
import { useEffect, useState } from "react";

import { useSpeechOutput } from "@/features/capture/ui/speech";

import { ArayaStage } from "./ArayaStage";

/** Arya in a small window in the corner of a slide: she is the teacher, and she says she is an AI. */
export function AryaTeacherWindow({ speaking, bow, className = "" }: { speaking: boolean; bow?: number; className?: string }) {
  return (
    <div aria-label="Arya, your AI teacher" className={`overflow-hidden border-2 border-gold shadow-[0_8px_28px_rgba(0,0,0,0.35)] ${className}`} role="group">
      <ArayaStage caption="Arya · AI teacher" className="h-full w-full" greetNonce={bow} listening={false} speaking={speaking} variant="compact" />
    </div>
  );
}

export type TeachingSlide = { id: string; kicker: string; title: string; body: string; narration: string };

/**
 * A short deck taught by Arya: one slide at a time with her in a small window, captions of what she says, and her voice when the
 * learner turns it on. Sound never starts on its own until the learner has asked for it.
 */
export function AryaSlideShow({ slides, onSlideChange }: { slides: TeachingSlide[]; onSlideChange?: (index: number) => void }) {
  const [index, setIndex] = useState(0);
  const [bow, setBow] = useState(0);
  const voice = useSpeechOutput("en");
  const { enabled, speak } = voice;
  const slide = slides[index];

  useEffect(() => {
    if (enabled) speak(slide.narration);
  }, [slide.narration, enabled]); // eslint-disable-line react-hooks/exhaustive-deps

  const go = (next: number) => {
    const clamped = Math.max(0, Math.min(slides.length - 1, next));
    setIndex(clamped);
    onSlideChange?.(clamped);
  };

  return (
    <section aria-label="Skill Shot with Arya" className="overflow-hidden border border-ink bg-linear-to-br from-purple to-ink text-cream">
      <div className="relative min-h-72 p-6 pr-32 sm:p-10 sm:pr-56">
        <p className="font-mono text-[10px] uppercase text-gold-light">{slide.kicker} · Slide {index + 1} of {slides.length}</p>
        <h2 className="mt-3 font-serif text-3xl leading-tight sm:text-5xl">{slide.title}</h2>
        <p className="mt-4 max-w-2xl text-lg leading-8 text-cream/85 sm:text-xl">{slide.body}</p>
        <AryaTeacherWindow bow={bow} className="absolute right-3 top-3 h-28 w-28 sm:right-5 sm:top-5 sm:h-44 sm:w-44" speaking={voice.speaking} />
      </div>
      <div className="border-t border-cream/15 bg-ink/90 px-6 py-4" aria-live="polite">
        <p className="font-mono text-[10px] uppercase text-gold-light">Arya says</p>
        <p className="mt-1 text-sm leading-6 text-cream/90">{slide.narration}</p>
      </div>
      <div className="flex flex-wrap items-center gap-3 border-t border-cream/15 px-6 py-3">
        <button aria-label="Previous slide" className="inline-flex size-10 items-center justify-center border border-cream/30 disabled:opacity-40" disabled={index === 0} onClick={() => go(index - 1)} type="button"><ChevronLeft aria-hidden="true" size={18} /></button>
        <div className="flex gap-1.5" role="group" aria-label="Slides">
          {slides.map((item, i) => <button key={item.id} aria-current={i === index} aria-label={`Slide ${i + 1}: ${item.title}`} className={`h-2.5 w-7 ${i === index ? "bg-gold" : "bg-cream/25"}`} onClick={() => go(i)} type="button" />)}
        </div>
        <button aria-label="Next slide" className="inline-flex size-10 items-center justify-center border border-cream/30 disabled:opacity-40" disabled={index === slides.length - 1} onClick={() => go(index + 1)} type="button"><ChevronRight aria-hidden="true" size={18} /></button>
        <button className="ml-auto inline-flex min-h-10 items-center gap-2 border border-gold px-3 text-sm font-semibold text-gold-light hover:bg-gold/10" onClick={() => { if (voice.speaking) voice.cancel(); else { setBow((n) => n + 1); voice.speak(slide.narration); } }} type="button">
          {voice.speaking ? <><Square aria-hidden="true" size={14} /> Stop</> : <><Volume2 aria-hidden="true" size={15} /> Hear Arya</>}
        </button>
        <button aria-pressed={voice.enabled} className="inline-flex min-h-10 items-center gap-2 text-sm text-cream/70 underline underline-offset-4" onClick={() => voice.setEnabled(!voice.enabled)} type="button">
          {voice.enabled ? <Volume2 aria-hidden="true" size={15} /> : <VolumeX aria-hidden="true" size={15} />} Arya teaches aloud: {voice.enabled ? "on" : "off"}
        </button>
      </div>
      <p className="border-t border-cream/10 px-6 py-2 text-[11px] leading-5 text-cream/55">Arya is an AI teacher and her voice is synthetic. The content is this Skill Shot&apos;s own.</p>
    </section>
  );
}
