"use client";

import { ArrowRight, CheckCircle2, Download, FileUp, Mic, MicOff, Pause, Repeat2, SkipForward, Volume2, VolumeX } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useDayPart } from "@/features/arya/AryaPanel";
import { ArayaStage } from "@/features/arya/ArayaStage";
import { CoachIntro } from "@/features/arya/CoachIntro";
import { PlanEditor } from "@/features/arya/PlanEditor";
import { coachInterviewIntro, coachWelcomeBack, planAcknowledgement } from "@/features/arya/scripts";
import type { InterviewPlan } from "@/features/capture/types";
import type { InterviewView } from "@/server/capture/interview-service";

import { ApiError, api, messageOf, post } from "./api";
import { RoleEditor } from "./RoleEditor";
import { useSpeechInput, useSpeechOutput } from "./speech";
import { UploadPanel } from "./UploadPanel";

type TurnOutcome = { view: InterviewView; stale: boolean; finished: boolean };

const PHASE_STYLE: Record<string, string> = {
  done: "border-teal bg-teal/10 text-teal",
  current: "border-gold bg-gold-pale text-ink",
  partial: "border-gold/50 text-ink-mid",
  upcoming: "border-border text-ink-light",
  not_applicable: "border-border text-ink-light line-through",
};

export function InterviewStudio({ projectId }: { projectId: string }) {
  const [view, setView] = useState<InterviewView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState("");
  const [heard, setHeard] = useState<string[]>([]);
  const [summary, setSummary] = useState<string | null>(null);
  const [correction, setCorrection] = useState("");
  const [showTranscript, setShowTranscript] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [recapOpen, setRecapOpen] = useState(true);
  const [showPlan, setShowPlan] = useState(false);
  const spokenFor = useRef<string | null>(null);
  const dayPart = useDayPart();

  const language = view?.project.language ?? "en";
  const voiceIn = useSpeechInput(language, (text) => setDraft((current) => `${current}${current && !current.endsWith(" ") ? " " : ""}${text}`));
  const voiceOut = useSpeechOutput(language);

  // Opening the page begins or resumes a session; on a later day it starts with a recap.
  useEffect(() => {
    let active = true;
    post<InterviewView>(`/api/contribute/projects/${projectId}/open`)
      .then((opened) => active && setView(opened))
      .catch((caught) => active && setError(messageOf(caught)));
    return () => {
      active = false;
    };
  }, [projectId]);

  const prompt = view?.prompt ?? null;

  // Arya reads each new question aloud when the contributor turned that on.
  useEffect(() => {
    if (!prompt || view?.needsPlan || !voiceOut.enabled || spokenFor.current === prompt.id) return;
    spokenFor.current = prompt.id;
    voiceOut.speak([heard.join(" "), prompt.text].filter(Boolean).join(" "));
  }, [prompt, voiceOut, heard, view?.needsPlan]);

  const send = useCallback(
    async (body: Record<string, unknown>) => {
      if (!prompt || busy) return;
      setBusy(true);
      setError(null);
      voiceIn.stop();
      try {
        const outcome = await post<TurnOutcome>(`/api/contribute/projects/${projectId}/turn`, { promptId: prompt.id, ...body });
        setView(outcome.view);
        setHeard(outcome.view.heard);
        setRecapOpen(false);
        if (!outcome.stale) setDraft("");
        if (outcome.stale) setError("The question had already moved on, so I refreshed it.");
      } catch (caught) {
        setError(messageOf(caught));
      } finally {
        setBusy(false);
      }
    },
    [busy, projectId, prompt, voiceIn],
  );

  const answer = () => {
    const text = `${draft}${voiceIn.interim ? ` ${voiceIn.interim}` : ""}`.trim();
    if (!text) {
      setError("Say or type something first, or choose Skip.");
      return;
    }
    void send({ action: "answer", text, modality: voiceIn.supported && voiceIn.listening ? "voice" : "text" });
  };

  async function choosePlan(plan: InterviewPlan) {
    setBusy(true);
    setError(null);
    try {
      setView(await post<InterviewView>(`/api/contribute/projects/${projectId}/plan`, plan));
      setShowPlan(false);
      setHeard([planAcknowledgement(plan.mode)]);
    } catch (caught) {
      setError(messageOf(caught));
    } finally {
      setBusy(false);
    }
  }

  async function finishSession() {
    setBusy(true);
    setError(null);
    voiceIn.stop();
    voiceOut.cancel();
    try {
      const done = await post<{ summary: string; view: InterviewView }>(`/api/contribute/projects/${projectId}/finish`);
      setSummary(done.summary);
      setView(done.view);
    } catch (caught) {
      setError(messageOf(caught));
    } finally {
      setBusy(false);
    }
  }

  async function sendCorrection() {
    try {
      await post(`/api/contribute/projects/${projectId}/correction`, { text: correction });
      setCorrection("");
      setSummary((current) => `${current ?? ""} Thank you, I have added your correction to the record.`);
    } catch (caught) {
      setError(messageOf(caught));
    }
  }

  async function refresh() {
    try {
      setView(await api<InterviewView>(`/api/contribute/projects/${projectId}`));
    } catch (caught) {
      setError(messageOf(caught));
    }
  }

  const status = useMemo(() => {
    if (busy) return "Thinking…";
    if (voiceOut.speaking) return "Speaking…";
    if (voiceIn.listening) return "Listening…";
    return "Your turn";
  }, [busy, voiceIn.listening, voiceOut.speaking]);

  if (!view) {
    return (
      <div className="mx-auto max-w-3xl px-5 py-16 sm:px-8" role="status">
        {error ? <p className="border-l-2 border-crimson pl-4 text-sm text-crimson">{error}</p> : <p className="text-ink-light">Opening your interview…</p>}
        <Link className="mt-6 inline-block text-sm text-teal underline underline-offset-4" href="/contribute">Back to my interviews</Link>
      </div>
    );
  }

  const complete = view.project.stage === "complete";

  return (
    <div className="mx-auto w-full max-w-7xl px-5 py-6 sm:px-8 lg:py-10">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] uppercase text-ink-light">Session {view.project.sessionNumber} · {view.project.title}</p>
          <h1 className="font-display text-3xl font-semibold sm:text-4xl">Your conversation</h1>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <a className="inline-flex items-center gap-1.5 text-teal underline underline-offset-4" href={`/api/contribute/projects/${projectId}/transcript`}>
            <Download aria-hidden="true" size={14} /> Transcript (.txt)
          </a>
          <Link className="text-teal underline underline-offset-4" href={`/contribute/${projectId}/review`}>Review what I have said</Link>
          <Link className="text-ink-light underline underline-offset-4" href="/contribute/dashboard">Dashboard</Link>
        </div>
      </div>

      {view.recap && recapOpen ? (
        <section aria-label="Where we stopped" className="mb-5 border-l-2 border-gold bg-gold-pale px-4 py-3 text-sm" role="status">
          <p className="font-semibold">{`Welcome back${view.person ? `, ${view.person}` : ""}. Arya here.`}</p>
          <p className="mt-1 leading-6">{view.recap.line}</p>
          <div className="mt-2 flex gap-2">
            <button className="inline-flex min-h-9 items-center gap-1.5 border border-ink px-3 py-1.5 text-xs font-semibold" onClick={() => voiceOut.speak(coachWelcomeBack(dayPart, view.person, view.recap?.line))} type="button"><Volume2 aria-hidden="true" size={14} /> Hear Arya</button>
            <button className="primary-button min-h-9! px-3! py-1.5! text-xs" onClick={() => setRecapOpen(false)} type="button">Carry on where we stopped</button>
            <button className="text-xs underline underline-offset-4" onClick={() => setRecapOpen(false)} type="button">Choose another section below</button>
          </div>
        </section>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-4">
          {/* The call */}
          <section aria-label="Conversation" className="overflow-hidden border border-ink bg-ink text-cream">
            <div className="grid sm:grid-cols-[minmax(0,1fr)_14rem]">
              <ArayaStage className="min-h-72 sm:min-h-80" level={voiceOut.level} listening={voiceIn.listening} speaking={voiceOut.speaking} />
              <div className="flex flex-col justify-between border-t border-cream/15 p-4 sm:border-l sm:border-t-0">
                <div>
                  <p className="font-mono text-[10px] uppercase text-gold-light">You</p>
                  <div className={`mt-2 flex h-20 items-center justify-center border ${voiceIn.listening ? "border-gold" : "border-cream/20"}`}>
                    {voiceIn.listening ? <Mic aria-hidden="true" className="cx-listening text-gold-light" size={28} /> : <MicOff aria-hidden="true" className="text-cream/45" size={28} />}
                  </div>
                  <p className="mt-2 text-xs text-cream/75" aria-live="polite">
                    {voiceIn.listening ? "Microphone on. Speak naturally; pause whenever you like." : voiceIn.supported ? "Microphone off. Press Speak, or type below." : "Voice input is not available in this browser. Type your answer."}
                  </p>
                </div>
                <p className="mt-3 font-mono text-[10px] uppercase text-cream/60">{status}</p>
              </div>
            </div>
            <div className="border-t border-cream/15 bg-purple px-5 py-5" aria-live="polite">
              {complete ? (
                <div>
                  <p className="font-display text-2xl">Thank you. That is everything on my list.</p>
                  <p className="mt-2 text-sm text-cream/80">Next you review what I heard. Nothing is published until you confirm it.</p>
                  <Link className="primary-button mt-4" href={`/contribute/${projectId}/review`}>Review my knowledge <ArrowRight aria-hidden="true" size={16} /></Link>
                </div>
              ) : view.needsPlan ? (
                <div>
                  <p className="font-mono text-[10px] uppercase text-gold-light">Arya · your interviewer</p>
                  <p className="mt-2 font-display text-xl leading-snug sm:text-2xl">{coachInterviewIntro(dayPart, view.person)}</p>
                  <button className="mt-4 inline-flex min-h-11 items-center gap-2 border border-gold px-4 text-sm font-semibold text-gold-light hover:bg-gold/10" onClick={() => (voiceOut.speaking ? voiceOut.cancel() : voiceOut.speak(coachInterviewIntro(dayPart, view.person)))} type="button">
                    <Volume2 aria-hidden="true" size={16} /> {voiceOut.speaking ? "Stop" : "Hear Arya"}
                  </button>
                </div>
              ) : prompt ? (
                <>
                  <p className="font-mono text-[10px] uppercase text-gold-light">
                    {prompt.phaseLabel ?? "Question"}{prompt.roleLabel ? ` · ${prompt.roleLabel}` : ""}{prompt.kind === "followup" ? " · a quick follow-up" : ""}
                  </p>
                  {heard.length ? <p className="mt-2 text-sm italic text-gold-light">{heard.join(" ")}</p> : null}
                  <p className="mt-2 font-display text-2xl leading-snug sm:text-3xl">{prompt.text}</p>
                  <p className="mt-3 text-sm leading-6 text-cream/70"><span className="font-semibold text-cream/90">Why I ask:</span> {prompt.why}</p>
                </>
              ) : (
                <p className="text-sm text-cream/75">Getting the next question ready…</p>
              )}
            </div>
          </section>

          {error ? <p className="border-l-2 border-crimson bg-crimson/5 px-4 py-2 text-sm text-crimson" role="alert">{error}</p> : null}
          {voiceIn.problem ? <p className="border-l-2 border-gold px-4 py-2 text-sm text-ink-mid" role="status">{voiceIn.problem}</p> : null}

          {view.needsPlan && !complete ? <CoachIntro busy={busy} name={view.person} onChoose={(plan) => void choosePlan(plan)} /> : null}

          {showPlan && view.plan ? (
            <section aria-label="Change my plan" className="border border-border bg-surface p-4 sm:p-5">
              <h2 className="font-display text-xl">Change the plan</h2>
              <div className="mt-3"><PlanEditor busy={busy} initial={view.plan} mode={view.plan.mode === "self" ? "self" : "edit"} onCancel={() => setShowPlan(false)} onSave={(plan) => void choosePlan(plan)} /></div>
            </section>
          ) : null}

          {/* The answer */}
          {!complete && prompt && !view.needsPlan ? (
            <section aria-label="Your answer" className="border border-border bg-surface p-4 sm:p-5">
              {prompt.kind === "confirm_roles" ? (
                <RoleEditor
                  busy={busy}
                  projectId={projectId}
                  roles={view.roles}
                  flags={view.timeline.flags}
                  onChange={(next) => setView(next)}
                  onConfirm={() => void send({ action: "roles_confirmed" })}
                />
              ) : prompt.options.length > 0 ? (
                <div>
                  {prompt.kind === "confirm_known" ? <p className="mb-3 border-l-2 border-teal pl-3 text-sm text-ink-mid">{prompt.knownSummary}</p> : null}
                  <div className="flex flex-wrap gap-2">
                    {prompt.options.map((option) => (
                      <button key={option.id} className="primary-button" disabled={busy} onClick={() => void send({ action: "choice", optionId: option.id })} type="button">
                        {option.label}
                      </button>
                    ))}
                  </div>
                  {prompt.kind === "confirm_known" ? <p className="mt-2 text-xs text-ink-light">If it needs a correction, I will ask the question again and you can answer in your own words.</p> : null}
                </div>
              ) : (
                <div>
                  <label className="font-mono text-[10px] uppercase text-ink-light" htmlFor="answer">Your answer</label>
                  <textarea
                    className="field-input mt-1 min-h-32 resize-y"
                    disabled={busy}
                    id="answer"
                    onChange={(event) => setDraft(event.target.value)}
                    placeholder={voiceIn.supported ? "Press Speak and talk, or type here. You can edit before sending." : "Type your answer here."}
                    value={voiceIn.interim ? `${draft}${draft ? " " : ""}${voiceIn.interim}` : draft}
                  />
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {voiceIn.supported ? (
                      <button aria-pressed={voiceIn.listening} className={`inline-flex min-h-11 items-center gap-2 border px-4 text-sm font-semibold ${voiceIn.listening ? "border-gold bg-gold-pale" : "border-ink"}`} onClick={voiceIn.listening ? voiceIn.stop : voiceIn.start} type="button">
                        {voiceIn.listening ? <><Pause aria-hidden="true" size={16} /> Pause voice</> : <><Mic aria-hidden="true" size={16} /> Speak</>}
                      </button>
                    ) : null}
                    <button className="primary-button" disabled={busy || (!draft.trim() && !voiceIn.interim)} onClick={answer} type="button">
                      Send my answer <ArrowRight aria-hidden="true" size={16} />
                    </button>
                    <button className="inline-flex min-h-11 items-center gap-2 border border-border px-3 text-sm" onClick={() => { spokenFor.current = null; voiceOut.speak(prompt.text); }} type="button">
                      <Repeat2 aria-hidden="true" size={16} /> Repeat question
                    </button>
                  </div>
                  {prompt.controls.length ? (
                    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-sm">
                      {prompt.controls.includes("skip") ? <button className="inline-flex items-center gap-1.5 text-teal underline underline-offset-4" disabled={busy} onClick={() => void send({ action: "skip" })} type="button"><SkipForward aria-hidden="true" size={14} /> Skip for now</button> : null}
                      {prompt.controls.includes("unknown") ? <button className="text-teal underline underline-offset-4" disabled={busy} onClick={() => void send({ action: "unknown" })} type="button">I am not sure</button> : null}
                      {prompt.controls.includes("confidential") ? <button className="text-teal underline underline-offset-4" disabled={busy} onClick={() => void send({ action: "confidential" })} type="button">This is confidential</button> : null}
                      {prompt.controls.includes("revisit") ? <button className="text-teal underline underline-offset-4" disabled={busy} onClick={() => void send({ action: "revisit" })} type="button">Come back to this later</button> : null}
                    </div>
                  ) : null}
                </div>
              )}
            </section>
          ) : null}

          {/* Session controls */}
          <section aria-label="Session controls" className="flex flex-wrap items-center gap-3 border-t border-border pt-4 text-sm">
            <button className="inline-flex min-h-10 items-center gap-2 border border-ink px-4 font-semibold" disabled={busy} onClick={() => void finishSession()} type="button">
              <Pause aria-hidden="true" size={16} /> Finish for today
            </button>
            <button className="inline-flex min-h-10 items-center gap-2 border border-border px-3" onClick={() => setShowUpload((open) => !open)} type="button">
              <FileUp aria-hidden="true" size={16} /> Upload material
            </button>
            {voiceOut.supported ? (
              <button aria-pressed={voiceOut.enabled} className="inline-flex min-h-10 items-center gap-2 border border-border px-3" onClick={() => voiceOut.setEnabled(!voiceOut.enabled)} type="button">
                {voiceOut.enabled ? <Volume2 aria-hidden="true" size={16} /> : <VolumeX aria-hidden="true" size={16} />} Read questions aloud: {voiceOut.enabled ? "on" : "off"}
              </button>
            ) : null}
            <button className="text-teal underline underline-offset-4" onClick={() => setShowTranscript((open) => !open)} type="button">{showTranscript ? "Hide" : "Show"} captions and transcript</button>
          </section>

          {summary ? (
            <section aria-label="Session summary" className="border-l-2 border-teal bg-teal/5 p-4 text-sm" role="status">
              <p className="flex items-center gap-2 font-semibold"><CheckCircle2 aria-hidden="true" className="text-teal" size={18} /> Today&apos;s summary</p>
              <p className="mt-2 leading-6">{summary}</p>
              <label className="mt-3 block font-mono text-[10px] uppercase text-ink-light" htmlFor="correction">Is anything not accurate? Tell me and I will add it to the record.</label>
              <textarea className="field-input min-h-16" id="correction" onChange={(event) => setCorrection(event.target.value)} value={correction} />
              <div className="mt-2 flex flex-wrap gap-3">
                <button className="primary-button" disabled={correction.trim().length < 3} onClick={() => void sendCorrection()} type="button">Add correction</button>
                <Link className="inline-flex min-h-12 items-center text-sm text-teal underline underline-offset-4" href="/contribute/dashboard">That is accurate. See you next time.</Link>
              </div>
            </section>
          ) : null}

          {showUpload ? <UploadPanel onDone={() => void refresh()} projectId={projectId} roles={view.roles} /> : null}

          {showTranscript ? (
            <section aria-label="Transcript" className="max-h-96 overflow-y-auto border border-border bg-surface p-4 text-sm">
              {view.transcript.map((line) => (
                <p key={line.id} className={`mb-3 leading-6 ${line.speaker === "expert" ? "text-ink" : "text-ink-light"}`}>
                  <span className="font-mono text-[10px] uppercase">{line.speaker === "expert" ? "You" : "Arya (AI)"}</span>
                  <br />
                  {line.text}
                </p>
              ))}
            </section>
          ) : null}
        </div>

        {/* Side: progress by phase, not a percentage */}
        <aside aria-label="Progress" className="space-y-5">
          <section>
            <h2 className="font-mono text-[10px] uppercase text-ink-light">Where we are</h2>
            {view.activeRole ? <p className="mt-1 text-sm font-semibold">{view.activeRole.label}</p> : null}
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {view.progress.map((phase) => (
                <li key={phase.phase} className={`border px-2 py-1 text-xs ${PHASE_STYLE[phase.status]}`} title={phase.status.replace("_", " ")}>
                  {phase.label}
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs leading-5 text-ink-light">
              {view.stats.topicsCovered} topic{view.stats.topicsCovered === 1 ? "" : "s"} covered so far{view.openCount ? `, about ${view.openCount} still open` : ""}. There is no rush: you can stop whenever you like and pick up exactly here.
            </p>
          </section>

          {view.plan ? (
            <section>
              <h2 className="font-mono text-[10px] uppercase text-ink-light">Your plan</h2>
              <p className="mt-2 text-sm">{view.plan.mode === "arya" ? "Arya leads" : view.plan.mode === "edit" ? "Arya's plan, edited by you" : "Structured by you"}{view.plan.skipPhases.length ? ` · ${view.plan.skipPhases.length} optional part${view.plan.skipPhases.length === 1 ? "" : "s"} left out` : ""}{view.plan.topics.length ? ` · ${view.plan.topics.length} topic${view.plan.topics.length === 1 ? "" : "s"} of yours` : ""}</p>
              <button className="mt-1 text-xs text-teal underline underline-offset-4" onClick={() => setShowPlan((open) => !open)} type="button">{showPlan ? "Close" : "Change my plan"}</button>
            </section>
          ) : null}

          {view.roles.length > 0 ? (
            <section>
              <h2 className="font-mono text-[10px] uppercase text-ink-light">Your jobs</h2>
              <ul className="mt-2 divide-y divide-border border border-border bg-surface text-sm">
                {view.roles.map((role) => (
                  <li key={role.id} className="flex items-start justify-between gap-2 p-3">
                    <div>
                      <p className="font-semibold">{role.title || "Untitled"}</p>
                      <p className="text-xs text-ink-light">{role.company || "Employer not set"} · {role.years}</p>
                    </div>
                    {role.confirmed ? (
                      <button className="shrink-0 text-xs text-teal underline underline-offset-4" disabled={busy} onClick={async () => { setBusy(true); try { setView(await post<InterviewView>(`/api/contribute/projects/${projectId}/jump`, { roleId: role.id })); } catch (caught) { setError(messageOf(caught)); } finally { setBusy(false); } }} type="button">
                        Explore
                      </button>
                    ) : null}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section className="border border-border bg-surface p-3 text-xs leading-5 text-ink-mid">
            <p className="font-semibold text-ink">You are in control</p>
            <p className="mt-1">I am Arya, an AI and not a person. I record and transcribe only with your consent, never invent details about your career, and publish nothing until you have reviewed and approved it.</p>
          </section>
        </aside>
      </div>
    </div>
  );
}

export { ApiError };
