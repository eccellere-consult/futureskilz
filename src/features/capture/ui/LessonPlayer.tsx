"use client";

import { ChevronLeft, ChevronRight, Download, Star, Volume2, VolumeX } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { AryaTeacherWindow } from "@/features/arya/AryaTeacher";

import type { LessonSpec } from "../lessons";

import { formatDuration, messageOf, post } from "./api";
import { useSpeechOutput } from "./speech";

function learnerKey(): string {
  try {
    const existing = window.localStorage.getItem("fs-learner-key");
    if (existing) return existing;
    const fresh = crypto.randomUUID();
    window.localStorage.setItem("fs-learner-key", fresh);
    return fresh;
  } catch {
    return `session-${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`.padEnd(24, "0");
  }
}

const SCENE_TONE: Record<string, string> = {
  title: "from-purple to-ink text-cream",
  concept: "from-surface to-gold-pale text-ink",
  steps: "from-surface to-gold-pale text-ink",
  example: "from-surface to-teal/10 text-ink",
  caution: "from-surface to-crimson/10 text-ink",
  check: "from-gold-pale to-surface text-ink",
  summary: "from-purple to-ink text-cream",
};

/**
 * A micro-lesson as short scenes with captions and an optional standard synthetic voice. In `preview` mode (editors, the
 * contributor reviewing their lesson) nothing is recorded. For learners every start, minute of engagement, material use and
 * completion is recorded so usage and attribution are measurable from the first view.
 */
export function LessonPlayer({ spec, slug, credits, preview = false }: { spec: LessonSpec; slug?: string; credits?: Array<{ name: string; creditedAs: string }>; preview?: boolean }) {
  const [index, setIndex] = useState(0);
  const [reflection, setReflection] = useState("");
  const [done, setDone] = useState(false);
  const [rating, setRating] = useState(0);
  const [useful, setUseful] = useState<boolean | null>(null);
  const [comment, setComment] = useState("");
  const [thanks, setThanks] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState(false);
  const [bow, setBow] = useState(0);
  const voice = useSpeechOutput("en");
  const [seen, setSeen] = useState<number[]>([0]);
  const key = useRef<string>("");
  const tracking = !preview && !!slug;

  const send = useCallback(
    (type: string, extra: Record<string, unknown> = {}) => {
      if (!tracking) return;
      void post(`/api/lessons/${slug}/events`, { type, learnerKey: key.current, ...extra }).catch(() => undefined);
    },
    [slug, tracking],
  );

  useEffect(() => {
    if (!tracking) return;
    key.current = learnerKey();
    let returning = false;
    try {
      returning = window.localStorage.getItem(`fs-seen-${slug}`) === "1";
      window.localStorage.setItem(`fs-seen-${slug}`, "1");
    } catch {
      /* storage can be blocked */
    }
    send(returning ? "return" : "start");
    if (returning) send("start");
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") send("progress", { seconds: 15, eventKey: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}` });
    }, 15000);
    return () => window.clearInterval(timer);
  }, [send, slug, tracking]);

  const scene = spec.scenes[index];
  const caption = spec.narration[scene.narrationIndex] ?? "";
  const last = index === spec.scenes.length - 1;
  const allSeen = seen.length >= spec.scenes.length;

  useEffect(() => {
    if (voice.enabled) voice.speak(caption);
  }, [caption, index]); // eslint-disable-line react-hooks/exhaustive-deps

  const go = (next: number) => {
    const clamped = Math.max(0, Math.min(spec.scenes.length - 1, next));
    setSeen((current) => (current.includes(clamped) ? current : [...current, clamped]));
    setIndex(clamped);
  };

  const notesText = useMemo(
    () => [spec.title, "", `Objective: ${spec.objective}`, "", ...spec.narration, "", `Check yourself: ${spec.check.prompt}`, spec.check.demonstration ?? "", "", `Shared by ${spec.attribution}.`].join("\n"),
    [spec],
  );

  async function finish() {
    setDone(true);
    send("complete");
    send("check_result", { value: reflection.trim().split(/\s+/).filter(Boolean).length });
  }

  async function submitRating() {
    if (!tracking || rating < 1) return;
    try {
      await post(`/api/lessons/${slug}/feedback`, { rating, useful: useful ?? undefined, comment, learnerKey: key.current });
      setThanks("Thank you. Your rating helps improve this lesson. It is one input among several, so it never decides on its own what anyone earns.");
    } catch (caught) {
      setError(messageOf(caught));
    }
  }

  return (
    <article className="mx-auto w-full max-w-4xl px-5 py-8 sm:px-8 sm:py-12">
      <p className="font-mono text-[10px] uppercase text-ink-light">{spec.stage} · {spec.proficiency} · {formatDuration(spec.durationSeconds)}</p>
      <h1 className="mt-1 font-display text-3xl font-semibold leading-tight sm:text-5xl">{spec.title}</h1>
      <p className="mt-3 max-w-2xl text-base leading-7 text-ink-mid"><span className="font-semibold text-ink">By the end you can:</span> {spec.objective.charAt(0).toLowerCase() + spec.objective.slice(1)}</p>
      {spec.prerequisites.length ? <p className="mt-1 text-xs text-ink-light">Helpful first: {spec.prerequisites.join("; ")}</p> : null}

      <section aria-label="Lesson" className={`mt-6 overflow-hidden border border-ink bg-linear-to-br ${SCENE_TONE[scene.kind] ?? "from-surface to-surface"}`}>
        <div className="relative min-h-64 p-6 pr-32 sm:p-10 sm:pr-56">
          <AryaTeacherWindow bow={bow} className="absolute right-3 top-3 h-28 w-28 sm:right-5 sm:top-5 sm:h-44 sm:w-44" speaking={voice.speaking} />
          <p className="font-mono text-[10px] uppercase opacity-70">Scene {index + 1} of {spec.scenes.length} · {scene.title}</p>
          <ul className="mt-4 space-y-3">
            {scene.onScreen.map((line, i) => (
              <li key={i} className={scene.kind === "title" ? "font-display text-3xl leading-snug sm:text-4xl" : scene.kind === "steps" ? "flex gap-3 text-xl leading-snug" : "font-display text-2xl leading-snug sm:text-3xl"}>
                {scene.kind === "steps" ? <span className="font-mono text-sm text-gold">{i + 1}</span> : null}
                <span>{line}</span>
              </li>
            ))}
          </ul>
          {scene.kind === "check" ? (
            <div className="mt-5">
              <label className="font-mono text-[10px] uppercase opacity-70" htmlFor="reflect">Your answer (kept private to you)</label>
              <textarea className="field-input min-h-24" id="reflect" onChange={(event) => setReflection(event.target.value)} value={reflection} />
              <p className="mt-1 text-xs opacity-70">{spec.check.guidance}</p>
              {spec.check.demonstration ? <p className="mt-1 text-xs opacity-70">{spec.check.demonstration}</p> : null}
            </div>
          ) : null}
        </div>
        <div className="border-t border-current/15 bg-ink/90 px-6 py-4 text-cream" aria-live="polite">
          <p className="font-mono text-[10px] uppercase text-gold-light">Arya says</p>
          <p className="mt-1 text-sm leading-6">{caption}</p>
        </div>
      </section>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button aria-label="Previous scene" className="icon-button" disabled={index === 0} onClick={() => go(index - 1)} type="button"><ChevronLeft aria-hidden="true" size={18} /></button>
        <div className="flex gap-1.5" role="group" aria-label="Scenes">
          {spec.scenes.map((s, i) => <button key={s.id} aria-current={i === index} aria-label={`Scene ${i + 1}: ${s.title}`} className={`h-2.5 w-8 ${i === index ? "bg-gold" : seen.includes(i) ? "bg-ink/50" : "bg-border"}`} onClick={() => go(i)} type="button" />)}
        </div>
        <button aria-label="Next scene" className="icon-button" disabled={last} onClick={() => go(index + 1)} type="button"><ChevronRight aria-hidden="true" size={18} /></button>
        <button className="ml-auto inline-flex min-h-10 items-center gap-2 border border-gold px-3 text-sm font-semibold" onClick={() => { if (voice.speaking) voice.cancel(); else { setBow((n) => n + 1); voice.speak(caption); } }} type="button">
          <Volume2 aria-hidden="true" size={16} /> {voice.speaking ? "Stop" : "Hear Arya"}
        </button>
        {voice.supported ? (
          <button aria-pressed={voice.enabled} className="inline-flex min-h-10 items-center gap-2 border border-border px-3 text-sm" onClick={() => voice.setEnabled(!voice.enabled)} type="button">
            {voice.enabled ? <Volume2 aria-hidden="true" size={16} /> : <VolumeX aria-hidden="true" size={16} />} Arya teaches aloud: {voice.enabled ? "on" : "off"}
          </button>
        ) : null}
      </div>
      <p className="mt-2 text-xs text-ink-light">Arya, an AI teacher, presents this lesson in a synthetic voice. The words are {spec.attribution}&apos;s own; the voice is not theirs.</p>

      {last && !done ? (
        <div className="mt-6 border border-border bg-surface p-4">
          <p className="text-sm">Finishing a lesson shows you have seen it, not that you can do it. Use the check above, and try it on a real task.</p>
          <button className="primary-button mt-3" disabled={!allSeen || (reflection.trim().length < 10 && !preview)} onClick={() => void finish()} type="button">
            {preview ? "End of preview" : "I have done the check"}
          </button>
          {!allSeen ? <p className="mt-2 text-xs text-ink-light">Look through every scene first.</p> : reflection.trim().length < 10 && !preview ? <p className="mt-2 text-xs text-ink-light">Write at least a sentence in the check.</p> : null}
        </div>
      ) : null}

      {done && !preview ? (
        <section aria-label="How useful was this?" className="mt-6 border border-teal bg-teal/5 p-4">
          <p className="font-semibold">Nicely done. How useful was this lesson?</p>
          <div className="mt-2 flex gap-1" role="radiogroup" aria-label="Rating from 1 to 5">
            {[1, 2, 3, 4, 5].map((value) => (
              <button key={value} aria-checked={rating === value} aria-label={`${value} out of 5`} className="p-1" onClick={() => setRating(value)} role="radio" type="button">
                <Star aria-hidden="true" className={value <= rating ? "fill-gold text-gold" : "text-ink-light"} size={26} />
              </button>
            ))}
          </div>
          <div className="mt-2 flex gap-4 text-sm"><label><input checked={useful === true} onChange={() => setUseful(true)} type="radio" name="useful" /> I can use this at work</label><label><input checked={useful === false} onChange={() => setUseful(false)} type="radio" name="useful" /> Not yet</label></div>
          <textarea aria-label="Optional comment" className="field-input mt-2 min-h-16" maxLength={600} onChange={(event) => setComment(event.target.value)} placeholder="Anything to improve? (optional)" value={comment} />
          <button className="primary-button mt-2" disabled={rating < 1} onClick={() => void submitRating()} type="button">Send my rating</button>
          {thanks ? <p className="mt-2 text-sm" role="status">{thanks}</p> : null}
          {error ? <p className="mt-2 text-sm text-crimson" role="alert">{error}</p> : null}
        </section>
      ) : null}

      <section className="mt-8 border-t border-border pt-4 text-sm">
        <button aria-expanded={notes} className="text-teal underline underline-offset-4" onClick={() => { setNotes((open) => !open); if (!notes) send("material_use", { eventKey: `notes-${new Date().toISOString().slice(0, 10)}` }); }} type="button">{notes ? "Hide" : "Show"} the full lesson notes</button>
        {notes ? (
          <div className="mt-3 border border-border bg-surface p-4">
            {spec.narration.map((paragraph, i) => <p key={i} className="mb-3 leading-6">{paragraph}</p>)}
            <button className="inline-flex items-center gap-2 text-sm text-teal underline underline-offset-4" onClick={() => {
              send("material_use", { eventKey: `download-${new Date().toISOString().slice(0, 10)}` });
              const url = URL.createObjectURL(new Blob([notesText], { type: "text/plain" }));
              const link = document.createElement("a");
              link.href = url;
              link.download = `${spec.title.replace(/[^A-Za-z0-9]+/g, "-").toLowerCase()}-notes.txt`;
              link.click();
              URL.revokeObjectURL(url);
            }} type="button"><Download aria-hidden="true" size={14} /> Download these notes</button>
          </div>
        ) : null}
        <p className="mt-4 text-xs leading-5 text-ink-light">
          Shared by {credits && credits.length ? credits.map((credit) => credit.name).join(" and ") : spec.attribution}. Their own words, from a conversation they reviewed and approved. {spec.refs.length ? `Sources: ${spec.refs.slice(0, 6).join(", ")}.` : ""}
        </p>
      </section>
    </article>
  );
}
