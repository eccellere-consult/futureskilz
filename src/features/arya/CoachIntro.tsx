"use client";

import { Compass, Pencil, Sparkles } from "lucide-react";
import { useState } from "react";

import { ARYA_PLAN } from "@/features/capture/plan";
import type { InterviewPlan } from "@/features/capture/types";

import { PlanEditor } from "./PlanEditor";

type Choice = "arya" | "edit" | "self";

const OPTIONS: Array<{ id: Choice; icon: typeof Sparkles; title: string; body: string; badge?: string }> = [
  { id: "arya", icon: Sparkles, title: "Arya leads", body: "I follow my prepared plan and adapt as you speak. The quickest way to begin.", badge: "Recommended" },
  { id: "edit", icon: Pencil, title: "Pick and edit Arya's plan", body: "See my plan at a high level, switch parts off, and add topics you care about." },
  { id: "self", icon: Compass, title: "I will structure it myself", body: "Choose only the parts you want and add your own topics. I keep to your structure." },
];

/** Arya's first words to a coach, and the choice of how to shape the interview. Shown until a choice is made. */
export function CoachIntro({ busy, onChoose, name }: { busy: boolean; onChoose: (plan: InterviewPlan) => void; name?: string }) {
  const [choice, setChoice] = useState<Choice | null>(null);
  return (
    <section aria-label="How would you like to shape our conversation?" className="border border-border bg-surface p-4 sm:p-6">
      <p className="font-mono text-[10px] uppercase text-gold">Before we begin{name ? `, ${name}` : ""}</p>
      <h2 className="mt-1 font-display text-2xl">How would you like to shape our conversation?</h2>
      {choice === null ? (
        <div className="mt-4 grid gap-3 md:grid-cols-3" role="radiogroup" aria-label="Interview structure">
          {OPTIONS.map((option) => (
            <button key={option.id} aria-checked={false} className="flex flex-col border border-border p-4 text-left transition-colors hover:border-gold hover:bg-gold-pale disabled:opacity-50" disabled={busy} onClick={() => (option.id === "arya" ? onChoose(ARYA_PLAN) : setChoice(option.id))} role="radio" type="button">
              <option.icon aria-hidden="true" className="text-gold" size={22} />
              <span className="mt-2 font-serif text-xl">{option.title}</span>
              {option.badge ? <span className="mt-1 w-fit bg-teal/10 px-2 py-0.5 font-mono text-[10px] uppercase text-teal">{option.badge}</span> : null}
              <span className="mt-2 text-sm leading-6 text-ink-mid">{option.body}</span>
            </button>
          ))}
        </div>
      ) : (
        <div className="mt-4">
          <PlanEditor busy={busy} mode={choice === "self" ? "self" : "edit"} onCancel={() => setChoice(null)} onSave={onChoose} />
        </div>
      )}
      <p className="mt-4 text-xs leading-5 text-ink-light">You can change this later from the side of the interview page. Nothing you say is published until you review and approve it.</p>
    </section>
  );
}
