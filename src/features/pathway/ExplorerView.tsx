"use client";

import { ArrowRight, Compass } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import type { LearnerSnapshot } from "../learner/draft";
import { BAND_LABEL, rankRoles, suggestRoleForTitle, type RoleView } from "./explorer";
import { getRole, TARGET_ROLES } from "./roles";
import { loadTargetRoleId, saveTargetRoleId } from "./store";
import { useLearnerEstimates } from "./use-estimates";

const BAND_TONE: Record<string, string> = { "too-little-evidence": "text-ink-mid", early: "text-ink-mid", building: "text-gold", close: "text-teal", "ready-to-try": "text-teal" };
const NEAR = 0.4;

/**
 * Career Explorer. Starts from what the learner can do now, ranks the seeded roles by how much of what each asks for they already
 * show, and for each role says what carries over and what is missing. A job title is only a hypothesis, so the starting role is
 * suggested and can be changed. Readiness is shown beside how much of it has been checked, never as a verdict.
 */
export function ExplorerView({ snapshot }: { snapshot: LearnerSnapshot }) {
  const estimates = useLearnerEstimates(snapshot);
  const suggestion = useMemo(() => suggestRoleForTitle(snapshot.draft.currentRole), [snapshot.draft.currentRole]);
  const [fromId, setFromId] = useState<string>(suggestion?.id ?? "");
  const [targetId, setTargetId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void loadTargetRoleId().then(setTargetId);
  }, []);

  const from = fromId ? getRole(fromId) : undefined;
  const ranked = useMemo(() => rankRoles(estimates, from), [estimates, from]);

  const makeTarget = async (id: string) => {
    setError(null);
    try {
      await saveTargetRoleId(id);
      setTargetId(id);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Your choice could not be saved.");
    }
  };

  return (
    <div className="mx-auto w-full max-w-5xl px-5 py-10 sm:px-8 sm:py-14">
      <div className="flex items-center gap-3 text-teal"><Compass size={20} /><span className="font-mono text-[11px] uppercase">Career Explorer</span></div>
      <h1 className="mt-3 font-serif text-4xl leading-tight sm:text-5xl">Where could your skills take you?</h1>
      <p className="mt-3 max-w-3xl text-lg leading-8 text-ink-mid">Roles, nearest first, by how much of what each one asks for you already show. Most of this rests on your own descriptions, so each role also says how much of it has been checked.</p>

      <div className="mt-6 flex flex-wrap items-center gap-3 border border-border bg-surface p-4 text-sm">
        <label htmlFor="from-role" className="font-semibold">Where I am now</label>
        <select className="min-h-10 border border-border bg-white px-2" id="from-role" onChange={(event) => setFromId(event.target.value)} value={fromId}>
          <option value="">Not sure, or something else</option>
          {TARGET_ROLES.map((role) => <option key={role.id} value={role.id}>{role.title}</option>)}
        </select>
        {snapshot.draft.currentRole ? <span className="text-ink-light">You told us: “{snapshot.draft.currentRole}”. {suggestion ? `That looks like ${suggestion.title}, which you can change.` : "None of the roles here matches closely, so nearness to your role is not shown."}</span> : null}
      </div>
      {error ? <p className="mt-3 text-sm text-crimson" role="alert">{error}</p> : null}

      <ol className="mt-8 space-y-5">
        {ranked.map((view, index) => (
          <RoleCard index={index + 1} isTarget={targetId === view.role.id} key={view.role.id} onTarget={() => void makeTarget(view.role.id)} view={view} />
        ))}
      </ol>

      <p className="mt-8 max-w-3xl text-xs leading-5 text-ink-light">Roles and the skills each asks for are starting hypotheses, not validated job standards. A role that looks far away may still suit you, and one that looks close may not. Completing lessons and showing your work makes these figures firmer.</p>
    </div>
  );
}

function RoleCard({ view, index, isTarget, onTarget }: { view: RoleView; index: number; isTarget: boolean; onTarget: () => void }) {
  const { readiness } = view;
  const near = view.closeness !== null && view.closeness < 1 && view.closeness >= NEAR;
  return (
    <li className={`border bg-surface p-5 sm:p-6 ${isTarget ? "border-teal" : "border-border"}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] uppercase text-ink-light">{index}. {near ? "Close to your current role" : view.closeness === 1 ? "Your current role" : "Role"}</p>
          <h2 className="mt-1 font-serif text-2xl">{view.role.title}</h2>
          <p className="mt-1 max-w-xl text-sm leading-6 text-ink-light">{view.role.summary}</p>
        </div>
        <div className="text-right">
          <p className={`font-mono text-[11px] uppercase ${BAND_TONE[readiness.band]}`}>{BAND_LABEL[readiness.band]}</p>
          <p className="mt-1 text-2xl font-serif">{Math.round(readiness.score * 100)}%</p>
        </div>
      </div>

      <div aria-hidden="true" className="mt-4 h-2 bg-border"><div className="h-2 bg-gold" style={{ width: `${Math.round(readiness.score * 100)}%` }} /></div>
      <p className="mt-2 text-xs text-ink-light">Checked: {Math.round(readiness.checkedShare * 100)}% of what this role asks for has any estimate · {Math.round(readiness.evidencedShare * 100)}% rests on situations you described or lessons you completed.</p>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <p className="font-mono text-[10px] uppercase text-teal">Carries over</p>
          {view.carriesOver.length ? <ul className="mt-1 flex flex-wrap gap-2 text-sm">{view.carriesOver.slice(0, 4).map((skill) => <li className="border border-border bg-cream px-2 py-1" key={skill.skill}>{skill.name} <span className="text-ink-light">{skill.current?.toFixed(1)}/{skill.required.toFixed(1)}</span></li>)}</ul> : <p className="mt-1 text-sm text-ink-light">Nothing yet at the level this role needs.</p>}
        </div>
        <div>
          <p className="font-mono text-[10px] uppercase text-gold">Missing or unchecked</p>
          <ul className="mt-1 flex flex-wrap gap-2 text-sm">{view.missing.slice(0, 4).map((skill) => <li className="border border-border bg-cream px-2 py-1" key={skill.skill}>{skill.name} <span className="text-ink-light">{skill.current === null ? "not checked" : `${skill.current.toFixed(1)}/${skill.required.toFixed(1)}`}</span></li>)}</ul>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-4">
        {isTarget ? <Link className="primary-button" href="/journey">See my path for this role<ArrowRight size={17} /></Link> : <button className="primary-button" onClick={onTarget} type="button">Make this my target role</button>}
        {isTarget ? <span className="text-sm text-teal" role="status">This is your target role.</span> : null}
      </div>
    </li>
  );
}
