"use client";

import { useEffect, useRef, useState } from "react";

import type { Drive } from "./arya-scene";

type Props = {
  speaking: boolean;
  listening: boolean;
  /** 0..1 now: how loud the voice is, read every frame. */
  level: () => number;
  /** Shown under the figure. Always says she is an AI. */
  caption?: string;
  className?: string;
};

function webglAvailable(): boolean {
  try {
    const probe = document.createElement("canvas");
    return !!(probe.getContext("webgl2") || probe.getContext("webgl"));
  } catch {
    return false;
  }
}

/** Arya, live in 3D. Falls back to a still portrait where the browser has no WebGL. */
export function ArayaStage({ speaking, listening, level, caption = "Arya · your AI guide", className = "" }: Props) {
  const canvas = useRef<HTMLCanvasElement | null>(null);
  const live = useRef({ speaking, listening, level });
  const [state, setState] = useState<"loading" | "ready" | "fallback">("loading");

  useEffect(() => {
    live.current = { speaking, listening, level };
  }, [speaking, listening, level]);

  useEffect(() => {
    const element = canvas.current;
    if (!element) return;
    let active = true;
    let dispose: (() => void) | null = null;
    let observer: ResizeObserver | null = null;
    const drive: Drive = { level: () => live.current.level(), listening: () => live.current.listening, speaking: () => live.current.speaking };

    (async () => {
      if (!webglAvailable()) {
        if (active) setState("fallback");
        return;
      }
      try {
        const { modelAvailable, createModelArya } = await import("./arya-model");
        // Best available look: a commissioned 3D model, then the supplied portrait, then the built-in 3D figure.
        const portrait = (await modelAvailable()) ? null : await (await import("./arya-portrait")).portraitUrl();
        const scene = (await modelAvailable())
          ? await createModelArya(element, drive)
          : portrait
            ? await (await import("./arya-portrait")).createPortraitArya(element, drive, portrait)
            : (await import("./arya-scene")).createProceduralArya(element, drive);
        if (!active) {
          scene.dispose();
          return;
        }
        dispose = scene.dispose;
        observer = new ResizeObserver(() => scene.resize());
        observer.observe(element);
        setState("ready");
      } catch {
        if (active) setState("fallback");
      }
    })();

    return () => {
      active = false;
      observer?.disconnect();
      dispose?.();
    };
  }, []);

  return (
    <div className={`relative isolate overflow-hidden bg-linear-to-b from-purple via-[#2a1a3a] to-ink ${className}`}>
      <div aria-hidden="true" className="absolute inset-0 -z-10 bg-[radial-gradient(60%_50%_at_50%_38%,rgba(212,174,106,0.28),transparent_70%)]" />
      {state === "fallback" ? (
        <div className="flex h-full min-h-56 flex-col items-center justify-center text-center text-cream/80">
          <p className="font-display text-5xl text-gold-light">A</p>
          <p className="mt-2 px-4 text-xs">Arya is shown here when your browser supports 3D. You can still read and hear everything she says.</p>
        </div>
      ) : (
        <canvas ref={canvas} aria-hidden="true" className={`block h-full min-h-56 w-full transition-opacity duration-700 ${state === "ready" ? "opacity-100" : "opacity-0"}`} />
      )}
      <p className="absolute inset-x-0 bottom-2 text-center font-mono text-[10px] uppercase tracking-wide text-gold-light">{caption}</p>
      <p className="sr-only" aria-live="polite">{speaking ? "Arya is speaking." : listening ? "The microphone is listening." : "Waiting for you."}</p>
    </div>
  );
}
