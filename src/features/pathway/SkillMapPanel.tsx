"use client";

import { useMemo, useState } from "react";

import { skillTaxonomy } from "../../domain/skills/taxonomy";
import type { LessonSpec } from "../capture/lessons";
import { patch } from "../capture/ui/api";
import { suggestSkills, type LessonSkillMap, type MappedSkill } from "./skill-map";

const LEVELS = [1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5];
const nameOf = new Map(skillTaxonomy.map((skill) => [skill.slug, skill.name]));

/**
 * An editor confirms which capabilities a lesson builds and how far it takes a learner. The rules propose; a person decides.
 * Until it is confirmed, the lesson stays out of learners' pathways, and the panel says so.
 */
export function SkillMapPanel({ lessonId, spec, disabled, onSaved }: { lessonId: string; spec: LessonSpec & { skillMap?: LessonSkillMap }; disabled: boolean; onSaved: () => void }) {
  const suggestions = useMemo(() => suggestSkills(spec, 6), [spec]);
  const stored = spec.skillMap;
  const [chosen, setChosen] = useState<MappedSkill[]>(() => (stored?.skills.length ? stored.skills : suggestions.map(({ skill, toLevel }) => ({ skill, toLevel }))));
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const confirmed = stored?.status === "confirmed";
  const reasons = new Map(suggestions.map((item) => [item.skill, item.hits]));
  const available = skillTaxonomy.filter((skill) => !chosen.some((item) => item.skill === skill.slug));

  const save = async () => {
    setSaving(true);
    setMessage(null);
    try {
      await patch(`/api/contribute/lessons/${lessonId}`, { skills: chosen });
      setMessage("Confirmed. Learners with a matching gap can now be offered this lesson.");
      onSaved();
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "The skills could not be saved.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="border border-border bg-surface p-4 text-sm" aria-label="Skills this lesson builds">
      <h2 className="font-display text-xl">Skills this lesson builds</h2>
      <p className="mt-1 text-ink-mid">
        {confirmed ? "Confirmed by an editor. Learners can be offered this lesson for these skills." : "Suggested from the lesson text. Until an editor confirms, this lesson is not offered in learners' pathways."}
      </p>
      <ul className="mt-3 space-y-2">
        {chosen.map((item) => (
          <li className="flex flex-wrap items-center gap-2" key={item.skill}>
            <span className="min-w-0 flex-1">
              <span className="font-medium">{nameOf.get(item.skill) ?? item.skill}</span>
              {reasons.get(item.skill) ? <span className="block text-xs text-ink-light">Found: {reasons.get(item.skill)!.slice(0, 3).join(", ")}</span> : null}
            </span>
            <label className="text-xs text-ink-light">
              Up to level{" "}
              <select className="border border-border bg-white px-1 py-1" disabled={disabled} onChange={(event) => setChosen((list) => list.map((entry) => (entry.skill === item.skill ? { ...entry, toLevel: Number(event.target.value) } : entry)))} value={item.toLevel}>
                {LEVELS.map((level) => <option key={level} value={level}>{level}</option>)}
              </select>
            </label>
            <button className="text-xs underline underline-offset-4" disabled={disabled} onClick={() => setChosen((list) => list.filter((entry) => entry.skill !== item.skill))} type="button">Remove</button>
          </li>
        ))}
      </ul>
      {chosen.length === 0 ? <p className="mt-2 text-ink-light">No skills chosen yet.</p> : null}
      {chosen.length < 6 ? (
        <label className="mt-3 block text-xs text-ink-light">
          Add a skill{" "}
          <select className="border border-border bg-white px-1 py-1" disabled={disabled} onChange={(event) => { if (event.target.value) setChosen((list) => [...list, { skill: event.target.value, toLevel: 2.5 }]); }} value="">
            <option value="">Choose…</option>
            {available.map((skill) => <option key={skill.slug} value={skill.slug}>{skill.name}</option>)}
          </select>
        </label>
      ) : null}
      <div className="mt-4 flex items-center gap-3">
        <button className="primary-button min-h-10! px-3! py-2!" disabled={disabled || saving || chosen.length === 0} onClick={() => void save()} type="button">{confirmed ? "Update skills" : "Confirm skills"}</button>
        {message ? <span role="status">{message}</span> : null}
      </div>
    </section>
  );
}
