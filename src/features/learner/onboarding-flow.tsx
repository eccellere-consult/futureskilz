"use client";

import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  emptyLearnerDraft,
  saveLearnerSnapshot,
  type LearnerDraft,
} from "./draft";

const focusOptions: Array<{ value: LearnerDraft["focus"]; label: string; detail: string }> = [
  { value: "career", label: "Grow my career", detail: "Move forward or prepare for a new role" },
  { value: "leadership", label: "Lead with confidence", detail: "Help people perform and navigate change" },
  { value: "business", label: "Build my business", detail: "Make stronger decisions and create momentum" },
  { value: "ai", label: "Work better with AI", detail: "Use AI practically, responsibly, and effectively" },
];

const steps = ["Name", "Role", "Focus", "Challenge", "Goal"] as const;

export function OnboardingFlow() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<LearnerDraft>(emptyLearnerDraft);

  const canContinue = [
    draft.name.trim().length >= 2,
    draft.currentRole.trim().length >= 2,
    Boolean(draft.focus),
    draft.challenge.trim().length >= 8,
    draft.goal.trim().length >= 8,
  ][step];

  function updateDraft<Key extends keyof LearnerDraft>(key: Key, value: LearnerDraft[Key]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function continueFlow() {
    if (!canContinue) return;

    saveLearnerSnapshot({ draft });

    if (step === steps.length - 1) {
      router.push("/assessment");
      return;
    }

    setStep((current) => current + 1);
  }

  return (
    <div className="grid gap-12 lg:grid-cols-[minmax(0,0.8fr)_minmax(28rem,1.2fr)] lg:gap-20">
      <div className="border-t-2 border-gold bg-ink px-6 py-8 text-cream sm:p-10 lg:p-12">
        <p className="font-mono text-[11px] uppercase text-gold-light">Meet Arya, your learning guide</p>
        <h1 className="mt-5 max-w-xl font-serif text-5xl leading-none font-light text-cream sm:text-6xl">
          Start with where you are now.
        </h1>
        <p className="mt-6 max-w-lg text-base leading-7 text-cream/65">
          Five short prompts shape your first capability snapshot. No generic course catalogue, just a useful next step.
        </p>
        <div className="mt-10 flex items-center gap-3 text-sm text-gold-light">
          <Check aria-hidden="true" size={18} />
          About four minutes
        </div>
      </div>

      <section aria-labelledby="onboarding-question" className="border-t-2 border-gold bg-surface px-5 py-8 shadow-[0_18px_48px_rgba(14,14,13,0.08)] sm:px-10 sm:py-10">
        <div className="flex items-center justify-between gap-5">
          <span className="font-mono text-[10px] uppercase text-ink-light">
            {String(step + 1).padStart(2, "0")} / {String(steps.length).padStart(2, "0")}
          </span>
          <div className="flex flex-1 justify-end gap-1" aria-label={`Step ${step + 1} of ${steps.length}`}>
            {steps.map((label, index) => (
              <span
                aria-label={label}
                className={`h-1 w-full max-w-10 ${index <= step ? "bg-gold" : "bg-border"}`}
                key={label}
              />
            ))}
          </div>
        </div>

        <div className="mt-10 min-h-[20rem]">
          {step === 0 ? (
            <Question title="What should I call you?" subtitle="Let’s make this journey feel like yours.">
              <input
                autoFocus
                className="field-input"
                onChange={(event) => updateDraft("name", event.target.value)}
                onKeyDown={(event) => event.key === "Enter" && continueFlow()}
                placeholder="Your first name"
                value={draft.name}
              />
            </Question>
          ) : null}

          {step === 1 ? (
            <Question title={`Good to meet you, ${draft.name}. What do you do today?`} subtitle="Use the role that best describes your current work.">
              <input
                autoFocus
                className="field-input"
                onChange={(event) => updateDraft("currentRole", event.target.value)}
                onKeyDown={(event) => event.key === "Enter" && continueFlow()}
                placeholder="e.g. Operations manager, founder, analyst"
                value={draft.currentRole}
              />
            </Question>
          ) : null}

          {step === 2 ? (
            <Question title="What are you most focused on right now?" subtitle="Choose the outcome that matters most in the next few months.">
              <div className="grid gap-3 sm:grid-cols-2">
                {focusOptions.map((option) => {
                  const selected = draft.focus === option.value;
                  return (
                    <button
                      className={`min-h-28 border p-4 text-left transition-colors ${selected ? "border-teal bg-teal text-white" : "border-border bg-cream text-ink hover:border-gold"}`}
                      key={option.value}
                      onClick={() => updateDraft("focus", option.value)}
                      type="button"
                    >
                      <span className="block text-sm font-semibold">{option.label}</span>
                      <span className={`mt-2 block text-xs leading-5 ${selected ? "text-white/75" : "text-ink-light"}`}>{option.detail}</span>
                    </button>
                  );
                })}
              </div>
            </Question>
          ) : null}

          {step === 3 ? (
            <Question title="What feels hardest in your work today?" subtitle="A real situation gives us a better starting point than a job title.">
              <textarea
                autoFocus
                className="field-input min-h-36 resize-none"
                onChange={(event) => updateDraft("challenge", event.target.value)}
                placeholder="e.g. I have good ideas but struggle to get other teams on board..."
                value={draft.challenge}
              />
            </Question>
          ) : null}

          {step === 4 ? (
            <Question title="What would meaningful progress look like?" subtitle="Write one outcome you would be proud to reach.">
              <textarea
                autoFocus
                className="field-input min-h-36 resize-none"
                onChange={(event) => updateDraft("goal", event.target.value)}
                placeholder="e.g. Lead a cross-functional project confidently within three months..."
                value={draft.goal}
              />
            </Question>
          ) : null}
        </div>

        <div className="mt-8 flex items-center justify-between border-t border-border pt-6">
          <button
            aria-label="Previous question"
            className="icon-button"
            disabled={step === 0}
            onClick={() => setStep((current) => Math.max(0, current - 1))}
            title="Previous question"
            type="button"
          >
            <ArrowLeft aria-hidden="true" size={19} />
          </button>
          <button className="primary-button" disabled={!canContinue} onClick={continueFlow} type="button">
            {step === steps.length - 1 ? "Build my snapshot" : "Continue"}
            <ArrowRight aria-hidden="true" size={18} />
          </button>
        </div>
      </section>
    </div>
  );
}

function Question({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="font-serif text-3xl leading-tight text-ink sm:text-4xl" id="onboarding-question">{title}</h2>
      <p className="mt-3 text-sm leading-6 text-ink-light">{subtitle}</p>
      <div className="mt-8">{children}</div>
    </div>
  );
}