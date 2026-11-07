"use client";

import { Lock } from "lucide-react";
import { useState } from "react";

import { OPTIONAL_PHASES, PLAN_PHASES, planFromSelection, planMinutes } from "@/features/capture/plan";
import type { InterviewPlan, PhaseId, PlanMode } from "@/features/capture/types";

type Props = {
  /** `edit` starts from Arya's full plan; `self` starts empty so the expert builds their own. */
  mode: Exclude<PlanMode, "arya">;
  initial?: InterviewPlan | null;
  busy?: boolean;
  onSave: (plan: InterviewPlan) => void;
  onCancel?: () => void;
};

/** Arya's high-level plan, in plain words: required parts are held in place; every other part can be switched on or off. */
export function PlanEditor({ mode, initial, busy = false, onSave, onCancel }: Props) {
  const [selected, setSelected] = useState<PhaseId[]>(() => (initial ? OPTIONAL_PHASES.filter((phase) => !initial.skipPhases.includes(phase)) : mode === "edit" ? OPTIONAL_PHASES : []));
  const [topics, setTopics] = useState(() => (initial?.topics ?? []).join("\n"));
  const plan = planFromSelection(mode, selected, topics.split("\n"));
  const minutes = planMinutes(plan.skipPhases);
  const toggle = (phase: PhaseId) => setSelected((current) => (current.includes(phase) ? current.filter((item) => item !== phase) : [...current, phase]));

  return (
    <div>
      <p className="text-sm leading-6 text-ink-mid">
        {mode === "edit" ? "This is the plan I would follow for each job you explore. Switch off anything you would rather skip." : "Start from nothing: tick the parts you want, and add your own topics. The parts marked with a lock are always included, so the conversation hangs together."}
      </p>
      <ol className="mt-4 divide-y divide-border border border-border bg-surface">
        {PLAN_PHASES.map((item, index) => {
          const on = item.required || selected.includes(item.phase);
          return (
            <li key={item.phase} className={`flex items-start gap-3 p-3 ${on ? "" : "opacity-55"}`}>
              <span className="mt-0.5 w-5 shrink-0 text-right font-mono text-[10px] text-ink-light">{index + 1}</span>
              {item.required ? (
                <Lock aria-label="Always included" className="mt-1 shrink-0 text-gold" size={16} />
              ) : (
                <input aria-label={`Include: ${item.label}`} checked={on} className="mt-1 size-4 shrink-0 accent-[var(--color-teal)]" onChange={() => toggle(item.phase)} type="checkbox" />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{item.label}</p>
                <p className="text-xs leading-5 text-ink-mid">{item.purpose}</p>
              </div>
              <span className="shrink-0 font-mono text-[10px] text-ink-light">~{item.minutes} min</span>
            </li>
          );
        })}
      </ol>
      <label className="mt-4 block font-mono text-[10px] uppercase text-ink-light" htmlFor="plan-topics">Anything you definitely want to cover? One topic per line (optional)</label>
      <textarea className="field-input mt-1 min-h-24" id="plan-topics" maxLength={1500} onChange={(event) => setTopics(event.target.value)} placeholder={"e.g. Handling supplier delays\nRunning a daily huddle"} value={topics} />
      <p className="mt-3 text-xs leading-5 text-ink-light">About {minutes} minutes for the first job you explore, then less for each one after, because the career-wide parts are not repeated. This is an estimate, and you can stop whenever you like.</p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button className="primary-button" disabled={busy} onClick={() => onSave(plan)} type="button">{busy ? "Saving…" : "Use this plan"}</button>
        {onCancel ? <button className="text-sm text-teal underline underline-offset-4" onClick={onCancel} type="button">Back</button> : null}
      </div>
    </div>
  );
}
