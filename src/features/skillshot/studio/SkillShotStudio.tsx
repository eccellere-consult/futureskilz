"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { skillTaxonomy } from "../../../domain/skills/taxonomy";
import { messageOf, post, useRemote } from "../../capture/ui/api";
import type { DraftSummary } from "@/server/skillshots/service";

const STATUS: Record<string, string> = { designing: "Being designed…", failed: "Could not be designed", draft: "Draft", in_review: "In review", approved: "Approved", published: "Live", retired: "Retired" };

/**
 * Editors brief the Instructional Design Agent and see every Skill Shot draft. The agent works from the notes written here, so
 * the more real the notes (steps, an example, numbers with their source), the less it has to invent, and it is told not to invent.
 */
export function SkillShotStudio() {
  const { data, error, reload, setError } = useRemote<{ drafts: DraftSummary[] }>("/api/contribute/skill-shots");
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ topic: "", skill: "problem-solving", toLevel: 2.5, audience: "", proficiency: "foundational", role: "", industry: "", sourceKind: "illustrative", contributor: "FutureSkilz Learning Design", sourceNotes: "" });
  const designing = data?.drafts.some((draft) => draft.status === "designing") ?? false;

  useEffect(() => {
    if (!designing) return;
    const timer = window.setInterval(reload, 5000);
    return () => window.clearInterval(timer);
  }, [designing, reload]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await post("/api/contribute/skill-shots", { topic: form.topic, skills: [{ skill: form.skill, toLevel: form.toLevel }], audience: form.audience, proficiency: form.proficiency, role: form.role || undefined, industry: form.industry || undefined, sourceKind: form.sourceKind, contributor: form.contributor, sourceNotes: form.sourceNotes });
      setForm((value) => ({ ...value, topic: "", sourceNotes: "" }));
      reload();
    } catch (caught) {
      setError(messageOf(caught));
    } finally {
      setBusy(false);
    }
  };
  const set = (key: keyof typeof form) => (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setForm((value) => ({ ...value, [key]: key === "toLevel" ? Number(event.target.value) : event.target.value }));
  const field = "mt-1 w-full border border-border bg-white px-3 py-2 text-sm";

  return (
    <div className="mx-auto w-full max-w-5xl px-5 py-10 sm:px-8">
      <p className="font-mono text-[10px] uppercase text-ink-light">Skill Shot studio</p>
      <h1 className="mt-1 font-display text-4xl font-semibold">Design a Skill Shot</h1>
      <p className="mt-3 max-w-3xl text-ink-mid">Give the design agent one capability and what you know. It drafts a 5 to 10 minute lesson taught by Arya, then checks the draft against the quality rubric. Every draft needs a person to review it before a learner sees it, because the checks cover structure, not teaching quality.</p>
      {error ? <p className="mt-4 border-l-2 border-crimson bg-crimson/5 px-4 py-2 text-sm text-crimson" role="alert">{error}</p> : null}

      <form className="mt-8 grid gap-4 border border-border bg-surface p-5 sm:grid-cols-2" onSubmit={submit}>
        <label className="text-sm sm:col-span-2">Topic, as a learner would say it<input className={field} maxLength={160} minLength={4} onChange={set("topic")} placeholder="Find the cause, not just the symptom" required value={form.topic} /></label>
        <label className="text-sm">Capability it builds
          <select className={field} onChange={set("skill")} value={form.skill}>{skillTaxonomy.map((skill) => <option key={skill.slug} value={skill.slug}>{skill.name}</option>)}</select>
        </label>
        <label className="text-sm">Takes a learner up to level
          <select className={field} onChange={set("toLevel")} value={form.toLevel}>{[1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5].map((level) => <option key={level} value={level}>{level} of 5</option>)}</select>
        </label>
        <label className="text-sm sm:col-span-2">Who it is for<input className={field} maxLength={300} minLength={4} onChange={set("audience")} placeholder="Team leads who fix problems that keep coming back" required value={form.audience} /></label>
        <label className="text-sm">Learner level
          <select className={field} onChange={set("proficiency")} value={form.proficiency}><option value="foundational">Foundational</option><option value="working">Working professional</option><option value="advanced">Advanced</option></select>
        </label>
        <label className="text-sm">Where the knowledge comes from
          <select className={field} onChange={set("sourceKind")} value={form.sourceKind}><option value="illustrative">Illustrative (made up for teaching)</option><option value="method">A published method</option><option value="expert-interview">An expert interview</option><option value="document">A document</option></select>
        </label>
        <label className="text-sm">Role (optional)<input className={field} maxLength={160} onChange={set("role")} value={form.role} /></label>
        <label className="text-sm">Industry (optional)<input className={field} maxLength={120} onChange={set("industry")} value={form.industry} /></label>
        <label className="text-sm sm:col-span-2">Credit line<input className={field} maxLength={200} minLength={2} onChange={set("contributor")} required value={form.contributor} /></label>
        <label className="text-sm sm:col-span-2">What you know: steps, an example, figures with their source
          <textarea className={`${field} min-h-36`} maxLength={8000} onChange={set("sourceNotes")} placeholder="Leave empty for a clearly labelled illustrative case. The agent uses only these notes for facts about real organisations, people or numbers." value={form.sourceNotes} />
        </label>
        <div className="sm:col-span-2"><button className="primary-button" disabled={busy} type="submit">{busy ? "Starting…" : "Design this Skill Shot"}</button></div>
      </form>

      <h2 className="mt-12 font-display text-2xl">Drafts and published Skill Shots</h2>
      {!data ? <p className="mt-3 text-ink-light" role="status">Loading…</p> : data.drafts.length === 0 ? <p className="mt-3 text-ink-mid">Nothing designed yet.</p> : (
        <ul className="mt-4 divide-y divide-border border border-border bg-surface">
          {data.drafts.map((draft) => (
            <li key={draft.id}>
              <Link className="flex flex-wrap items-center justify-between gap-3 p-4 hover:bg-gold-pale" href={`/contribute/skill-shots/${draft.id}`}>
                <span><span className="block font-semibold">{draft.title}</span><span className="block font-mono text-[10px] uppercase text-ink-light">{STATUS[draft.status]} · {draft.source === "ai" ? "AI draft" : "structure only"}</span></span>
                <span className={`text-sm ${draft.passes ? "text-teal" : "text-ink-mid"}`}>{draft.status === "designing" ? "" : draft.passes ? "Checks pass" : `${draft.blockers} to fix`}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
