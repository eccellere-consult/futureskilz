"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";

import type { AryaState } from "./engine/arya-pose";

// The 3D engine loads only in the browser, and only when Arya is on the page.
const Arya3D = dynamic(() => import("./engine/arya-3d").then((m) => m.Arya3D), { ssr: false });

type Props = {
  speaking: boolean;
  listening: boolean;
  thinking?: boolean;
  /** `full` is head and shoulders; `compact` is a close crop of the face, for a small window. */
  variant?: "full" | "compact";
  /** Plays her bow once each time this number changes (a greeting). */
  greetNonce?: number;
  /** Shown under the figure. Always says she is an AI. */
  caption?: string | null;
  className?: string;
};

/** Arya, live: her photograph brought to life in 3D (or a 3D model, or the built-in figure). Stops drawing when off screen. */
export function ArayaStage({ speaking, listening, thinking = false, variant = "full", greetNonce, caption = "Arya · your AI guide", className = "" }: Props) {
  const box = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const element = box.current;
    if (!element || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { rootMargin: "120px" });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const state: AryaState = speaking ? "speaking" : listening ? "listening" : thinking ? "thinking" : "idle";

  return (
    <div ref={box} className={`relative isolate overflow-hidden bg-linear-to-b from-purple via-[#2a1a3a] to-ink ${className}`}>
      <div className="absolute inset-0">
        <Arya3D
          fallback={
            // eslint-disable-next-line @next/next/no-img-element
            <img alt="Arya, your AI guide" className="h-full w-full object-cover object-top" src="/avatars/arya.webp" />
          }
          greetNonce={greetNonce}
          paused={!visible}
          state={state}
          variant={variant}
        />
      </div>
      {caption ? <p className="pointer-events-none absolute inset-x-0 bottom-0 bg-linear-to-t from-ink/80 to-transparent pb-2 pt-6 text-center font-mono text-[10px] uppercase tracking-wide text-gold-light">{caption}</p> : null}
      <p className="sr-only" aria-live="polite">{speaking ? "Arya is speaking." : listening ? "The microphone is listening." : "Arya is waiting."}</p>
    </div>
  );
}
