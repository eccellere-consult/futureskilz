"use client";

import { ArrowLeft, ArrowRight, Check, MessageCircle, Sparkles } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { AryaPanel, useDayPart } from "@/features/arya/AryaPanel";
import { studentWelcome } from "@/features/arya/scripts";

import {
  availableDiscoverySkills,
  challengeOptions,
  focusOptions,
  horizonOptions,
  responsibilityOptions,
  skillFamilies,
  toggleSelection,
  weeklyOptions,
} from "./discovery-model";
import { emptyLearnerDraft, type LearnerDraft } from "./draft";
import { loadLearnerState, saveDraft, type SessionUser } from "./store";

const steps = ["Hello", "Work", "Direction", "Capabilities", "Skills", "Situation", "Outcome", "Rhythm", "Review"] as const;
const guideMessages = [
  "We’ll begin with you, not a job description.",
  "Context helps me avoid generic recommendations.",
  "A useful path starts with a clear destination.",
  "Choose the broad areas where progress would matter most.",
  "Now we can get specific without testing everything.",
  "A recent situation is stronger evidence than a self-rating.",
  "A visible outcome makes progress easier to measure.",
  "The best plan is one that fits your real week.",
  "Here is my working hypothesis. The baseline will test it.",
] as const;

export function OnboardingFlow() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const dayPart = useDayPart();
  const [draft, setDraft] = useState<LearnerDraft>(emptyLearnerDraft);
  const [account, setAccount] = useState<{ user: SessionUser; hasProfile: boolean } | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    // A signed-in learner edits their saved answers instead of starting from a blank page.
    void loadLearnerState()
      .then(({ snapshot, user }) => {
        if (!active || !user) return;
        setAccount({ user, hasProfile: Boolean(snapshot.scores) });
        if (snapshot.draft.goal) setDraft(snapshot.draft);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);
  const availableSkills = availableDiscoverySkills(draft.priorityFamilies);
  const canContinue = [
    draft.name.trim().length >= 2,
    draft.currentRole.trim().length >= 2 && Boolean(draft.responsibilityLevel),
    Boolean(draft.focus) && Boolean(draft.horizon),
    draft.priorityFamilies.length >= 1,
    draft.prioritySkills.length >= 2,
    Boolean(draft.challengeType) && draft.challenge.trim().length >= 12,
    draft.goal.trim().length >= 12,
    draft.weeklyMinutes > 0,
    true,
  ][step];

  function updateDraft<Key extends keyof LearnerDraft>(key: Key, value: LearnerDraft[Key]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function toggleFamily(familyId: LearnerDraft["priorityFamilies"][number]) {
    setDraft((current) => {
      const priorityFamilies = toggleSelection(current.priorityFamilies, familyId, 3);
      const allowedSkills = new Set(availableDiscoverySkills(priorityFamilies).map(({ slug }) => slug));
      return { ...current, priorityFamilies, prioritySkills: current.prioritySkills.filter((slug) => allowedSkills.has(slug)) };
    });
  }

  async function continueFlow() {
    if (!canContinue || saving) return;
    const isLastStep = step === steps.length - 1;
    setSaving(true);
    setSaveError(null);
    try {
      // Signed-in answers are saved on the last step; guests keep a browser copy at every step.
      if (!account || isLastStep) await saveDraft(draft);
    } catch (caught) {
      setSaveError(caught instanceof Error ? caught.message : "Your answers could not be saved.");
      setSaving(false);
      return;
    }
    setSaving(false);
    if (isLastStep) {
      router.push("/assessment");
      return;
    }
    setStep((current) => current + 1);
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,0.78fr)_minmax(30rem,1.22fr)] lg:gap-12 xl:gap-20">
      <aside className="h-fit border-t-2 border-gold bg-ink px-6 py-8 text-cream sm:p-10 lg:sticky lg:top-8 lg:p-12">
        <div className="flex items-center gap-3 text-gold-light"><MessageCircle aria-hidden="true" size={18} /><p className="font-mono text-[11px] uppercase">A conversation with Arya</p></div>
        <h1 className="mt-5 max-w-xl font-serif text-5xl leading-none font-light text-cream sm:text-6xl">Let’s work out where you are, together.</h1>
        <AryaPanel autoKey={step} className="mt-6 max-w-lg" script={step === 0 ? studentWelcome(dayPart) : guideMessages[step]} stageClassName="h-64" />
        <div className="mt-10 border-t border-cream/15 pt-6">
          <div className="flex items-center gap-3 text-sm text-gold-light"><Check aria-hidden="true" size={18} />About six minutes</div>
          <div className="mt-6 min-h-24 space-y-3 text-xs leading-5 text-cream/60">
            {draft.name ? <p><span className="text-cream">You:</span> {draft.name}{draft.currentRole ? ` · ${draft.currentRole}` : ""}</p> : null}
            {draft.priorityFamilies.length ? <p><span className="text-cream">Exploring:</span> {draft.priorityFamilies.length} capability areas</p> : null}
            {draft.prioritySkills.length ? <p><span className="text-cream">Signals:</span> {draft.prioritySkills.length} specific skills</p> : null}
          </div>
        </div>
      </aside>

      <section aria-labelledby="onboarding-question" className="border-t-2 border-gold bg-surface px-5 py-8 shadow-[0_18px_48px_rgba(14,14,13,0.08)] sm:px-10 sm:py-10">
        {account?.hasProfile ? (
          <div className="mb-8 flex flex-wrap items-center justify-between gap-3 border-l-2 border-teal bg-cream px-4 py-3 text-sm text-ink-mid">
            <p>Welcome back, {account.user.displayName}. Changing these answers updates your saved profile.</p>
            <Link className="inline-flex items-center gap-1 font-semibold text-teal underline-offset-4 hover:underline" href="/journey">Go to my journey <ArrowRight aria-hidden="true" size={15} /></Link>
          </div>
        ) : null}
        <Progress step={step} />
        <div className="mt-10 min-h-[26rem]">
          {step === 0 ? (
            <Question title="Hi, I’m Arya. What should I call you?" subtitle="I’ll use your answers to form a working hypothesis, not a permanent label.">
              <input autoFocus className="field-input" onChange={(event) => updateDraft("name", event.target.value)} onKeyDown={(event) => event.key === "Enter" && void continueFlow()} placeholder="Your first name" value={draft.name} />
            </Question>
          ) : null}
          {step === 1 ? (
            <Question title={`Good to meet you, ${draft.name}. What does your work look like today?`} subtitle="Your role gives context; your level of responsibility changes which behaviours matter most.">
              <input autoFocus className="field-input" onChange={(event) => updateDraft("currentRole", event.target.value)} placeholder="e.g. Operations manager, founder, analyst" value={draft.currentRole} />
              <ChoiceGrid className="mt-6">{responsibilityOptions.map((option) => <ChoiceButton key={option.value} label={option.label} selected={draft.responsibilityLevel === option.value} onClick={() => updateDraft("responsibilityLevel", option.value)} />)}</ChoiceGrid>
            </Question>
          ) : null}
          {step === 2 ? (
            <Question title="What change are you trying to create?" subtitle="Choose one primary outcome and the timeframe that makes it real.">
              <ChoiceGrid>{focusOptions.map((option) => <ChoiceButton {...option} key={option.value} selected={draft.focus === option.value} onClick={() => updateDraft("focus", option.value)} />)}</ChoiceGrid>
              <p className="mt-8 font-mono text-[10px] uppercase text-ink-light">When should this make a difference?</p>
              <ChoiceGrid className="mt-3">{horizonOptions.map((option) => <ChoiceButton {...option} key={option.value} selected={draft.horizon === option.value} onClick={() => updateDraft("horizon", option.value)} />)}</ChoiceGrid>
            </Question>
          ) : null}
          {step === 3 ? (
            <Question title="Where would stronger capability unlock the most value?" subtitle="Choose up to three. These six areas cover the complete current FutureSkilz skill system without overlap.">
              <ChoiceGrid>{skillFamilies.map((family) => <ChoiceButton detail={family.plainLanguage} key={family.id} label={family.name} selected={draft.priorityFamilies.includes(family.id)} onClick={() => toggleFamily(family.id)} />)}</ChoiceGrid>
              <SelectionHint count={draft.priorityFamilies.length} maximum={3} noun="areas" />
            </Question>
          ) : null}
          {step === 4 ? (
            <Question title="Which skills would make the biggest practical difference?" subtitle="Choose two to six. I’m only showing skills from the capability areas you selected.">
              <div className="space-y-7">
                {skillFamilies.filter((family) => draft.priorityFamilies.includes(family.id)).map((family) => (
                  <div key={family.id}>
                    <p className="font-mono text-[10px] uppercase text-gold">{family.name}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {availableSkills.filter((skill) => skill.familyId === family.id).map((skill) => {
                        const selected = draft.prioritySkills.includes(skill.slug);
                        return <button aria-pressed={selected} className={`border px-3 py-2 text-left text-xs transition-colors ${selected ? "border-ink bg-ink text-gold-light" : "border-border bg-cream text-ink hover:border-gold"}`} key={skill.slug} onClick={() => updateDraft("prioritySkills", toggleSelection(draft.prioritySkills, skill.slug, 6))} type="button">{skill.name}</button>;
                      })}
                    </div>
                  </div>
                ))}
              </div>
              <SelectionHint count={draft.prioritySkills.length} maximum={6} noun="skills" />
              {draft.prioritySkills.length ? (
                <div className="mt-7 border-t border-gold/40 pt-5">
                  <p className="font-mono text-[10px] uppercase text-ink-light">In plain language</p>
                  <div className="mt-3 space-y-4">
                    {availableSkills.filter(({ slug }) => draft.prioritySkills.includes(slug)).map((skill) => (
                      <div className="border-l-2 border-gold pl-4" key={skill.slug}>
                        <p className="text-sm font-semibold">{skill.name}</p>
                        <p className="mt-1 text-xs leading-5 text-ink-light">{skill.definition}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </Question>
          ) : null}
          {step === 5 ? (
            <Question title="Think of a recent moment when work felt harder than it should." subtitle="Choose the friction, then describe what happened. Observable situations are more useful than ratings.">
              <ChoiceGrid>{challengeOptions.map((option) => <ChoiceButton {...option} key={option.value} selected={draft.challengeType === option.value} onClick={() => updateDraft("challengeType", option.value)} />)}</ChoiceGrid>
              <textarea className="field-input mt-6 min-h-28 resize-none" onChange={(event) => updateDraft("challenge", event.target.value)} placeholder="What happened, what did you try, and where did progress stall?" value={draft.challenge} />
            </Question>
          ) : null}
          {step === 6 ? (
            <Question title="If this worked, what would be visibly different?" subtitle="Name an action, result or behaviour that another person could observe.">
              <textarea autoFocus className="field-input min-h-36 resize-none" onChange={(event) => updateDraft("goal", event.target.value)} placeholder="e.g. I can lead a cross-functional decision and gain clear commitment without escalating it..." value={draft.goal} />
            </Question>
          ) : null}
          {step === 7 ? (
            <Question title="What learning rhythm can survive a busy week?" subtitle="A smaller credible commitment is better than an ambitious plan that disappears after two weeks.">
              <ChoiceGrid>{weeklyOptions.map((option) => <ChoiceButton {...option} key={option.value} selected={draft.weeklyMinutes === option.value} onClick={() => updateDraft("weeklyMinutes", option.value)} />)}</ChoiceGrid>
            </Question>
          ) : null}
          {step === 8 ? <DiscoveryReview draft={draft} /> : null}
        </div>
        <div className="mt-8 flex items-center justify-between border-t border-border pt-6">
          <button aria-label="Previous question" className="icon-button" disabled={step === 0} onClick={() => setStep((current) => Math.max(0, current - 1))} title="Previous question" type="button"><ArrowLeft aria-hidden="true" size={19} /></button>
          <button className="primary-button" disabled={!canContinue || saving} onClick={() => void continueFlow()} type="button">{step === 8 ? "Test my baseline" : step === 7 ? "Review my direction" : "Continue"}<ArrowRight aria-hidden="true" size={18} /></button>
        </div>
        {saveError ? <p className="mt-3 text-right text-xs text-crimson" role="alert">{saveError}</p> : null}
      </section>
    </div>
  );
}

function Progress({ step }: { step: number }) {
  return <div className="flex items-center justify-between gap-5"><span className="font-mono text-[10px] uppercase text-ink-light">{String(step + 1).padStart(2, "0")} / {String(steps.length).padStart(2, "0")}</span><div className="flex flex-1 justify-end gap-1" aria-label={`Step ${step + 1} of ${steps.length}`}>{steps.map((label, index) => <span aria-label={label} className={`h-1 w-full max-w-8 ${index <= step ? "bg-gold" : "bg-border"}`} key={label} />)}</div></div>;
}

function Question({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return <div><h2 className="font-serif text-3xl leading-tight text-ink sm:text-4xl" id="onboarding-question">{title}</h2><p className="mt-3 max-w-3xl text-sm leading-6 text-ink-light">{subtitle}</p><div className="mt-8">{children}</div></div>;
}

function ChoiceGrid({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`grid gap-3 sm:grid-cols-2 ${className}`}>{children}</div>;
}

function ChoiceButton({ label, detail, selected, onClick }: { label: string; detail?: string; selected: boolean; onClick: () => void }) {
  return <button aria-pressed={selected} className={`min-h-20 border p-4 text-left transition-colors ${selected ? "border-ink bg-ink text-cream" : "border-border bg-cream text-ink hover:border-gold"}`} onClick={onClick} type="button"><span className="block text-sm font-semibold">{label}</span>{detail ? <span className={`mt-2 block text-xs leading-5 ${selected ? "text-cream/65" : "text-ink-light"}`}>{detail}</span> : null}</button>;
}

function SelectionHint({ count, maximum, noun }: { count: number; maximum: number; noun: string }) {
  return <p className="mt-4 font-mono text-[10px] uppercase text-ink-light">{count} {noun} selected · maximum {maximum}</p>;
}

function DiscoveryReview({ draft }: { draft: LearnerDraft }) {
  const focus = focusOptions.find(({ value }) => value === draft.focus)?.label;
  const horizon = horizonOptions.find(({ value }) => value === draft.horizon)?.label;
  const skills = availableDiscoverySkills(draft.priorityFamilies).filter(({ slug }) => draft.prioritySkills.includes(slug));
  return (
    <div>
      <div className="flex items-center gap-3 text-gold"><Sparkles aria-hidden="true" size={19} /><p className="font-mono text-[10px] uppercase">Arya’s working hypothesis</p></div>
      <h2 className="mt-4 font-serif text-4xl leading-tight text-ink" id="onboarding-question">Here’s what I heard, {draft.name}.</h2>
      <div className="mt-7 divide-y divide-border border-y border-border">
        <ReviewRow label="Direction" value={`${focus} · ${horizon}`} />
        <ReviewRow label="Priority skills" value={skills.map(({ name }) => name).join(", ")} />
        <ReviewRow label="Evidence" value={draft.challenge} />
        <ReviewRow label="Visible outcome" value={draft.goal} />
        <ReviewRow label="Available rhythm" value={`${draft.weeklyMinutes} minutes each week`} />
      </div>
      <div className="mt-7 border-l-2 border-gold pl-5"><p className="text-sm font-semibold">What this means</p><p className="mt-2 text-sm leading-6 text-ink-mid">Your answers tell us where to look. They do not yet prove proficiency. The short baseline will test five transferable behaviours, then work evidence will sharpen the diagnosis over time.</p></div>
    </div>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return <div className="grid gap-2 py-4 sm:grid-cols-[8rem_1fr]"><p className="font-mono text-[10px] uppercase text-ink-light">{label}</p><p className="text-sm leading-6 text-ink-mid">{value}</p></div>;
}