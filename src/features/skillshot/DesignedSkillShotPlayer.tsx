"use client";

import { Check, ChevronLeft, ChevronRight, Play, Square, Volume2, VolumeX, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { AryaTeacherWindow } from "@/features/arya/AryaTeacher";
import { AryaCoachPanel } from "@/features/coach/AryaCoachPanel";
import { PracticeNote } from "@/features/coach/PracticeNote";
import { useSpeechOutput } from "@/features/capture/ui/speech";
import { fetchSessionUser } from "@/features/learner/store";

import { WORDS_PER_MINUTE, clock, sceneSeconds, timeline, totalSeconds, wordCount } from "./duration";
import type { Blueprint, ChoiceOption, Scene } from "./types";
import { gradeKnowledgeCheck } from "./grade";
import { completeDesigned } from "./store";
import { SceneVisual } from "./visuals";

const sleep = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms));

/** Keeps a learner's answers on this device so a reload does not lose them. The account records only a passed check, graded on the server. */
function remember(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage can be blocked */
  }
}

/**
 * A designed Skill Shot taught by Arya: scene by scene, with her in a small window, concise visuals, captions, a decision for the
 * learner with a thinking pause, a short knowledge check and a task for work. Sound starts only when the learner asks.
 */
export function DesignedSkillShotPlayer({ blueprint, preview = false }: { blueprint: Blueprint; preview?: boolean }) {
  const { meta, design, scenes } = blueprint;
  const voice = useSpeechOutput("en");
  const [index, setIndex] = useState(0);
  const [bow, setBow] = useState(0);
  const [playing, setPlaying] = useState(false);
  /** Decisions and check questions the learner has answered, so Arya knows what she may explain. */
  const [answered, setAnswered] = useState<string[]>([]);
  const markAnswered = (id: string) => setAnswered((list) => (list.includes(id) ? list : [...list, id]));
  const run = useRef(0);
  const times = timeline(blueprint);
  const scene = scenes[index];

  useEffect(() => () => void (run.current += 1), []);

  async function say(text: string) {
    const started = Date.now();
    await voice.speak(text);
    // If no voice could play, wait about as long as it would have taken to say, so a lesson never rushes past.
    const should = (wordCount(text) / WORDS_PER_MINUTE) * 60_000;
    const left = should - (Date.now() - started);
    if (left > 400) await sleep(Math.min(left, 20_000));
  }

  async function playFrom(start: number) {
    const mine = ++run.current;
    setPlaying(true);
    setBow((n) => n + 1);
    for (let k = start; k < scenes.length; k += 1) {
      if (run.current !== mine) return;
      setIndex(k);
      await say(scenes[k].narration);
      if (run.current !== mine) return;
      if (scenes[k].interaction) break; // the learner decides before the lesson goes on
      if (scenes[k].pauseSeconds) await sleep(scenes[k].pauseSeconds * 1000);
    }
    if (run.current === mine) setPlaying(false);
  }

  function stop() {
    run.current += 1;
    voice.cancel();
    setPlaying(false);
  }

  function go(next: number) {
    stop();
    setIndex(Math.max(0, Math.min(scenes.length - 1, next)));
  }

  async function choose(option: ChoiceOption) {
    if (!scene.interaction) return;
    markAnswered(scene.id);
    const correct = option.id === scene.interaction.correctId;
    const spoken = `${correct ? "Yes. " : "Not quite. "}${option.feedback}${correct ? "" : ` ${scene.interaction.rationale}`}`;
    const resume = playing;
    const mine = ++run.current;
    await say(spoken);
    if (resume && run.current === mine && index < scenes.length - 1) void playFrom(index + 1);
  }

  const last = index === scenes.length - 1;
  const mins = totalSeconds(blueprint) / 60;

  return (
    <div className="mx-auto w-full max-w-5xl px-5 py-8 sm:px-8 sm:py-12">
      <p className="font-mono text-[10px] uppercase text-gold">Skill Shot · {meta.domain} · {meta.proficiency}</p>
      <h1 className="mt-2 font-display text-4xl font-semibold leading-tight sm:text-5xl">{meta.title}</h1>
      <p className="mt-3 max-w-3xl text-lg leading-8 text-ink-mid"><span className="font-semibold text-ink">By the end you can:</span> {design.learningObjective.charAt(0).toLowerCase() + design.learningObjective.slice(1)}</p>
      <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-light">
        <span>About {Math.round(mins)} minutes with Arya</span>
        <span>Prerequisite: {meta.prerequisites[0]}</span>
        <span className="bg-gold-pale px-2 py-0.5 font-mono text-[10px] uppercase text-ink">Draft: awaiting human review</span>
      </p>

      <section aria-label="Skill Shot with Arya" className="mt-6 overflow-hidden border border-ink bg-linear-to-br from-purple to-ink text-cream">
        <div className="relative min-h-80 p-6 pr-32 sm:p-8 sm:pr-56">
          <AryaTeacherWindow bow={bow} className="absolute right-3 top-3 h-28 w-28 sm:right-5 sm:top-5 sm:h-44 sm:w-44" speaking={voice.speaking} />
          <p className="font-mono text-[10px] uppercase text-gold-light">Scene {index + 1} of {scenes.length} · {clock(times[index].start)} to {clock(times[index].end)}</p>
          <h2 className="mt-2 font-serif text-3xl leading-tight sm:text-4xl">{scene.title}</h2>
          {scene.visual ? (
            <div className="mt-4 max-w-2xl"><SceneVisual visual={scene.visual} /></div>
          ) : (
            <ul className="mt-4 space-y-2 text-xl leading-snug">{scene.onScreen.map((line) => <li key={line}>{line}</li>)}</ul>
          )}
        </div>

        {scene.interaction ? <InteractionPanel key={scene.id} interaction={scene.interaction} onChoose={(option) => void choose(option)} /> : null}

        <div aria-live="polite" className="border-t border-cream/15 bg-ink/90 px-6 py-4">
          <p className="font-mono text-[10px] uppercase text-gold-light">Arya says (captions)</p>
          <p className="mt-1 text-sm leading-6 text-cream/90">{scene.narration}</p>
        </div>

        <div className="flex flex-wrap items-center gap-3 border-t border-cream/15 px-6 py-3">
          <button aria-label="Previous scene" className="inline-flex size-10 items-center justify-center border border-cream/30 disabled:opacity-40" disabled={index === 0} onClick={() => go(index - 1)} type="button"><ChevronLeft aria-hidden="true" size={18} /></button>
          <div className="flex gap-1.5" role="group" aria-label="Scenes">
            {scenes.map((item, i) => <button key={item.id} aria-current={i === index} aria-label={`Scene ${i + 1}: ${item.title}, ${clock(times[i].start)}`} className={`h-2.5 w-7 ${i === index ? "bg-gold" : i < index ? "bg-cream/50" : "bg-cream/25"}`} onClick={() => go(i)} type="button" />)}
          </div>
          <button aria-label="Next scene" className="inline-flex size-10 items-center justify-center border border-cream/30 disabled:opacity-40" disabled={last} onClick={() => go(index + 1)} type="button"><ChevronRight aria-hidden="true" size={18} /></button>
          {playing ? (
            <button className="ml-auto inline-flex min-h-10 items-center gap-2 border border-gold px-3 text-sm font-semibold text-gold-light" onClick={stop} type="button"><Square aria-hidden="true" size={14} /> Stop</button>
          ) : (
            <button className="ml-auto inline-flex min-h-10 items-center gap-2 bg-gold px-4 text-sm font-bold text-ink hover:bg-gold-light" onClick={() => void playFrom(index)} type="button"><Play aria-hidden="true" size={14} /> {index === 0 ? "Play with Arya" : "Play from here"}</button>
          )}
          <button aria-pressed={voice.enabled} className="inline-flex min-h-10 items-center gap-2 text-sm text-cream/70 underline underline-offset-4" onClick={() => voice.setEnabled(!voice.enabled)} type="button">
            {voice.enabled ? <Volume2 aria-hidden="true" size={15} /> : <VolumeX aria-hidden="true" size={15} />} Sound: {voice.enabled ? "on" : "off"}
          </button>
        </div>
        <p className="border-t border-cream/10 px-6 py-2 text-[11px] leading-5 text-cream/60">{blueprint.disclosure}</p>
      </section>

      {preview ? (
        <p className="mt-10 border-l-2 border-gold bg-gold-pale/50 p-4 text-sm text-ink-mid">Preview: Arya&apos;s coaching and practice feedback switch on when this Skill Shot is published, so there is nothing to ask here yet.</p>
      ) : (
        <AryaCoachPanel answered={answered} blueprint={blueprint} sceneId={scene.id} />
      )}

      <KnowledgeCheck blueprint={blueprint} onAnswered={markAnswered} preview={preview} />

      <section aria-label="Your task at work" className="mt-10 border-l-2 border-gold bg-gold-pale p-5">
        <p className="font-mono text-[10px] uppercase text-ink-light">Take it to work</p>
        <p className="mt-2 text-base leading-7">{design.workplaceTransferTask}</p>
      </section>

      {preview ? null : <PracticeNote blueprint={blueprint} />}

      <section aria-label="Key takeaways and common mistakes" className="mt-10 grid gap-6 md:grid-cols-2">
        <div className="border border-border bg-surface p-5"><h2 className="font-display text-2xl">Remember</h2><ul className="mt-3 space-y-2 text-sm leading-6">{design.summaryTakeaways.map((item) => <li key={item} className="flex gap-2"><Check aria-hidden="true" className="mt-1 shrink-0 text-teal" size={14} />{item}</li>)}</ul></div>
        <div className="border border-border bg-surface p-5"><h2 className="font-display text-2xl">Watch out for</h2><ul className="mt-3 space-y-2 text-sm leading-6">{design.commonMistakes.map((item) => <li key={item} className="flex gap-2"><X aria-hidden="true" className="mt-1 shrink-0 text-crimson" size={14} />{item}</li>)}</ul><p className="mt-3 text-xs leading-5 text-ink-light">Limits: {design.limitationsAndCaveats[0]}</p></div>
      </section>

      <section aria-label="Where this fits" className="mt-10 border border-border bg-surface p-5">
        <h2 className="font-display text-2xl">Where this fits</h2>
        <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-3">
          <div><dt className="font-mono text-[10px] uppercase text-ink-light">Skill set</dt><dd className="mt-1">{blueprint.learningPath.skillSet}</dd></div>
          <div><dt className="font-mono text-[10px] uppercase text-ink-light">Capability module</dt><dd className="mt-1">{blueprint.learningPath.capabilityModule}</dd></div>
          <div><dt className="font-mono text-[10px] uppercase text-ink-light">Learning path</dt><dd className="mt-1">{blueprint.learningPath.rolePath}</dd></div>
        </dl>
        <p className="mt-3 text-xs leading-5 text-ink-mid">{blueprint.learningPath.position}</p>
        <h3 className="mt-5 font-mono text-[10px] uppercase text-ink-light">Next</h3>
        <ul className="mt-2 space-y-2 text-sm">{design.nextLearningRecommendation.map((item) => <li key={item.label}>{item.href ? <Link className="text-teal underline underline-offset-4" href={item.href}>{item.label}</Link> : item.label}<span className="block text-xs text-ink-light">{item.why}</span></li>)}</ul>
      </section>

      <details className="mt-8 border-t border-border pt-4 text-sm">
        <summary className="cursor-pointer text-teal underline underline-offset-4">Full transcript and sources</summary>
        <div className="mt-3 space-y-3">{scenes.map((item, i) => <div key={item.id}><p className="font-mono text-[10px] uppercase text-ink-light">{i + 1}. {item.title} · {sceneSeconds(item)}s</p><p className="mt-1 leading-6">{item.narration}</p></div>)}</div>
        <h3 className="mt-5 font-mono text-[10px] uppercase text-ink-light">Sources</h3>
        <ul className="mt-2 space-y-1 text-xs leading-5 text-ink-mid">{blueprint.sources.map((source) => <li key={source.id}><span className="font-semibold">{source.id}</span> · {source.label}</li>)}</ul>
        <p className="mt-3 text-xs leading-5 text-ink-light">Attribution: {meta.contributorAttribution}. Version {meta.version}.</p>
      </details>
    </div>
  );
}

/** One decision, with a thinking pause first. It starts afresh for each scene (the parent keys it by scene). */
function InteractionPanel({ interaction, onChoose }: { interaction: NonNullable<Scene["interaction"]>; onChoose: (option: ChoiceOption) => void }) {
  const [picked, setPicked] = useState<string | null>(null);
  const [think, setThink] = useState<number>(interaction.thinkSeconds);
  useEffect(() => {
    if (think <= 0) return;
    const timer = window.setTimeout(() => setThink((current) => current - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [think]);
  const onSkip = () => setThink(0);
  const waiting = think > 0 && !picked;
  return (
    <div className="border-t border-cream/15 bg-cream p-5 text-ink sm:p-6">
      <p className="font-mono text-[10px] uppercase text-teal">Your turn{interaction.context ? ` · ${interaction.context}` : ""}</p>
      <p className="mt-2 text-lg leading-7">{interaction.prompt}</p>
      {waiting ? <p className="mt-3 text-sm text-ink-mid" role="status">Think first: <span className="font-semibold">{think}s</span> <button className="ml-2 text-teal underline underline-offset-4" onClick={onSkip} type="button">I am ready</button></p> : null}
      <div className="mt-4 grid gap-2">
        {interaction.options.map((option) => {
          const chosen = picked === option.id;
          const right = option.id === interaction.correctId;
          return (
            <button key={option.id} aria-pressed={chosen} className={`border px-4 py-3 text-left text-sm leading-6 disabled:cursor-not-allowed ${picked ? (right ? "border-teal bg-teal/10" : chosen ? "border-crimson bg-crimson/5" : "border-border opacity-60") : "border-border bg-surface hover:border-gold disabled:opacity-60"}`} disabled={waiting || !!picked} onClick={() => { setPicked(option.id); onChoose(option); }} type="button">
              {option.text}
              {picked && (chosen || right) ? <span className={`mt-1 block text-xs ${right ? "text-teal" : "text-crimson"}`}>{right ? "Best answer. " : "Not quite. "}{option.feedback}</span> : null}
            </button>
          );
        })}
      </div>
      {picked ? <p className="mt-3 text-sm leading-6 text-ink-mid" role="status">{interaction.rationale}</p> : null}
    </div>
  );
}

function KnowledgeCheck({ blueprint, preview, onAnswered }: { blueprint: Blueprint; preview: boolean; onAnswered: (id: string) => void }) {
  const key = `fs-skillshot-${blueprint.meta.id}`;
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const score = blueprint.knowledgeCheck.filter((question) => answers[question.id] === question.correctId).length;
  const done = Object.keys(answers).length === blueprint.knowledgeCheck.length;
  const [saved, setSaved] = useState<{ signedIn: boolean; evidenceAdded: boolean; skills: string[] } | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  function answer(id: string, optionId: string) {
    if (answers[id]) return;
    const next = { ...answers, [id]: optionId };
    setAnswers(next);
    onAnswered(id);
    if (preview) return; // an editor trying a draft records nothing
    remember(key, { answers: next, at: new Date().toISOString() });
    if (Object.keys(next).length === blueprint.knowledgeCheck.length) {
      const passed = gradeKnowledgeCheck(blueprint, next).passed;
      void fetchSessionUser()
        .then((user) => completeDesigned(blueprint.meta.id, next, passed).then((outcome) => setSaved({ signedIn: Boolean(user), evidenceAdded: outcome.evidenceAdded, skills: outcome.skills })))
        .catch((caught: unknown) => setSaveError(caught instanceof Error ? caught.message : "Your result could not be saved."));
    }
  }

  return (
    <section aria-label="Check yourself" className="mt-10 border border-border p-5 sm:p-6">
      <p className="font-mono text-[10px] uppercase text-teal">Check yourself</p>
      <h2 className="mt-1 font-display text-3xl">Three quick questions</h2>
      <div className="mt-5 space-y-6">
        {blueprint.knowledgeCheck.map((question, index) => (
          <div key={question.id}>
            <p className="font-semibold">{index + 1}. {question.prompt}</p>
            <div className="mt-2 grid gap-2">
              {question.options.map((option) => {
                const chosen = answers[question.id] === option.id;
                const right = option.id === question.correctId;
                const shown = !!answers[question.id];
                return (
                  <button key={option.id} aria-pressed={chosen} className={`border px-4 py-3 text-left text-sm leading-6 ${shown ? (right ? "border-teal bg-teal/10" : chosen ? "border-crimson bg-crimson/5" : "border-border opacity-60") : "border-border bg-surface hover:border-gold"}`} disabled={shown} onClick={() => answer(question.id, option.id)} type="button">
                    {option.text}
                    {shown && (chosen || right) ? <span className={`mt-1 block text-xs ${right ? "text-teal" : "text-crimson"}`}>{option.feedback}</span> : null}
                  </button>
                );
              })}
            </div>
            {answers[question.id] ? <p className="mt-2 text-xs leading-5 text-ink-mid">{question.why}</p> : null}
          </div>
        ))}
      </div>
      {done ? <p className="mt-5 border-l-2 border-teal pl-3 text-sm" role="status">You answered {score} of {blueprint.knowledgeCheck.length} correctly. Finishing shows what you understood, not what you can do: use the task below on a real problem. {preview ? "Preview only: nothing is recorded." : saved?.signedIn ? (saved.evidenceAdded ? "This is recorded on your profile as evidence, so your skill levels and pathway now reflect it." : score >= 2 ? "Your profile already has this evidence." : "Not enough correct answers to count as evidence yet. Replay the scenes and try again later.") : "Sign in to record this on your profile; for now it stays on this device."}</p> : null}
      {saveError ? <p className="mt-2 text-sm text-crimson" role="alert">{saveError}</p> : null}
    </section>
  );
}
