"use client";

import { ArrowRight, Clock3, Compass, Search } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import type { LearnerSnapshot } from "../learner/draft";
import { builtInAssets, KIND_LABEL, type LearningAsset } from "./assets";
import { estimateSkills, SOURCE_LABEL } from "./estimate";
import { computeGaps, weeklyBudgetMinutes, type Horizon, type SkillGap } from "./gaps";
import { planPathway } from "./journey";
import { getRole, TARGET_ROLES } from "./roles";
import { loadTargetRoleId, saveTargetRoleId } from "./store";

const STATUS: Record<SkillGap["status"], string> = { gap: "To build", "check-first": "Check first", met: "Looks met" };
const HORIZON_LABEL: Record<Horizon, string> = { "90-days": "90 days", "6-months": "6 months", "12-months": "12 months", exploring: "no fixed date" };

/**
 * Role, gaps, pathway. The answer comes first (what to do and how long it takes), then the evidence behind it.
 * Every number here rests on a short self-rating, and the page says so.
 */
export function PathwayView({ snapshot }: { snapshot: LearnerSnapshot }) {
  const [roleId, setRoleId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [coachAssets, setCoachAssets] = useState<LearningAsset[]>([]);

  useEffect(() => {
    let active = true;
    void fetch("/api/pathway/assets", { cache: "no-store" })
      .then((response) => (response.ok ? (response.json() as Promise<{ assets: LearningAsset[] }>) : { assets: [] }))
      .then(({ assets }) => active && setCoachAssets(assets))
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    void loadTargetRoleId().then((id) => {
      if (!active) return;
      setRoleId(id);
      setLoaded(true);
    });
    return () => {
      active = false;
    };
  }, []);

  const choose = async (id: string | null) => {
    setRoleId(id);
    setError(null);
    try {
      await saveTargetRoleId(id);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Your choice could not be saved.");
    }
  };

  const role = roleId ? getRole(roleId) : undefined;
  const horizon: Horizon = snapshot.draft.horizon || "6-months";
  const weekly = snapshot.draft.weeklyMinutes || 60;

  const plan = useMemo(() => {
    if (!role) return null;
    const estimates = estimateSkills(snapshot.scores);
    const gaps = computeGaps(role, estimates, horizon);
    return { gaps, pathway: planPathway(gaps, [...coachAssets, ...builtInAssets()], { budgetMinutes: weeklyBudgetMinutes(weekly, horizon) }) };
  }, [role, snapshot.scores, horizon, weekly, coachAssets]);

  if (!loaded) return <div className="mt-12 min-h-40" aria-label="Loading your target role" />;

  return (
    <section className="mt-12" aria-labelledby="target-role">
      <div className="flex items-center gap-3 text-teal"><Compass size={20} /><span className="font-mono text-[11px] uppercase">Where do you want to go?</span></div>
      <h2 className="mt-3 font-serif text-3xl" id="target-role">{role ? `Your target role: ${role.title}` : "Pick a role to see your gaps."}</h2>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-ink-light">
        {role ? role.summary : "Choose the role you are working toward. FutureSkilz compares it with what you told us and shows what to build first. You can change it at any time."}
      </p>
      {error ? <p className="mt-3 text-sm text-red-700" role="alert">{error}</p> : null}

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3" role="radiogroup" aria-label="Target role">
        {TARGET_ROLES.map((item) => {
          const selected = item.id === roleId;
          return (
            <button
              aria-checked={selected}
              className={`border p-4 text-left transition ${selected ? "border-teal bg-teal/10" : "border-border bg-white hover:border-gold"}`}
              key={item.id}
              onClick={() => void choose(selected ? null : item.id)}
              role="radio"
              type="button"
            >
              <span className="font-serif text-lg">{item.title}</span>
              <span className="mt-1 block text-xs leading-5 text-ink-light">{item.summary}</span>
            </button>
          );
        })}
      </div>

      {role && plan ? <Result gaps={plan.gaps} pathway={plan.pathway} horizon={horizon} weekly={weekly} /> : null}
    </section>
  );
}

function Result({ gaps, pathway, horizon, weekly }: { gaps: SkillGap[]; pathway: ReturnType<typeof planPathway>; horizon: Horizon; weekly: number }) {
  const toBuild = gaps.filter((gap) => gap.status === "gap");
  const check = gaps.filter((gap) => gap.status === "check-first");
  const met = gaps.filter((gap) => gap.status === "met");
  const first = pathway.steps[0];

  return (
    <div className="mt-12 space-y-12">
      <div className="border-l-2 border-gold bg-ink p-6 text-cream sm:p-8">
        <p className="font-mono text-[10px] uppercase text-gold-light">The answer</p>
        <p className="mt-3 font-serif text-2xl leading-snug sm:text-3xl">
          {toBuild.length > 0
            ? `${toBuild.length} skill${toBuild.length === 1 ? "" : "s"} to build${check.length ? `, ${check.length} to check first` : ""}. Start with ${first ? first.name.toLowerCase() : toBuild[0].name.toLowerCase()}.`
            : check.length > 0
              ? `Nothing measured is far from this role yet, and ${check.length} skill${check.length === 1 ? "" : "s"} need a quick check first.`
              : "Your answers already look close to what this role needs."}
        </p>
        <p className="mt-3 text-sm leading-6 text-cream/70">
          Planned for {HORIZON_LABEL[horizon]} at about {weekly} minutes a week. {pathway.steps.length > 0 ? `The steps below take about ${pathway.totalMinutes} minutes.` : ""}
        </p>
        <p className="mt-4 text-xs leading-5 text-cream/55">
          Based on a short self-rating, so treat it as a starting estimate. Completing lessons and showing your work makes it firmer.
        </p>
      </div>

      <section aria-labelledby="gap-table">
        <h3 className="font-serif text-2xl" id="gap-table">What the role needs, and where you are</h3>
        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[34rem] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-border font-mono text-[10px] uppercase text-ink-light">
                <th className="py-2 pr-4">Skill</th><th className="py-2 pr-4">Needed</th><th className="py-2 pr-4">Now</th><th className="py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {gaps.map((gap) => (
                <tr className="border-b border-border align-top" key={gap.skill}>
                  <td className="py-3 pr-4"><span className="font-medium">{gap.name}</span>{gap.criticality === 3 ? <span className="ml-2 font-mono text-[10px] uppercase text-gold">core</span> : null}</td>
                  <td className="py-3 pr-4">{gap.required.toFixed(1)}</td>
                  <td className="py-3 pr-4">{gap.current === null ? "–" : gap.current.toFixed(1)}<span className="block text-[11px] text-ink-light">{SOURCE_LABEL[gap.estimate.source]}</span></td>
                  <td className="py-3"><span className={gap.status === "gap" ? "text-gold" : gap.status === "met" ? "text-teal" : "text-ink-mid"}>{STATUS[gap.status]}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-ink-light">Scale 0 to 5. {met.length} skill{met.length === 1 ? "" : "s"} already look met.</p>
      </section>

      <section aria-labelledby="pathway-steps">
        <h3 className="font-serif text-2xl" id="pathway-steps">Your pathway</h3>
        {pathway.steps.length === 0 ? (
          <p className="mt-4 text-sm text-ink-light">No lessons are available for these gaps yet. The list below shows what is missing.</p>
        ) : (
          <ol className="mt-6 divide-y divide-border border-y border-border">
            {pathway.steps.map((step) => (
              <li className="grid gap-4 py-7 sm:grid-cols-[3rem_minmax(0,1fr)_auto]" key={step.asset.id}>
                <div className="flex h-10 w-10 items-center justify-center border border-gold font-mono text-xs text-gold">{step.order}</div>
                <div>
                  <p className="font-mono text-[10px] uppercase text-teal">{KIND_LABEL[step.asset.kind]} · builds {step.name.toLowerCase()} to level {step.targetLevel}</p>
                  <h4 className="mt-2 font-serif text-2xl">{step.asset.title}</h4>
                  {step.asset.attribution ? <p className="mt-1 text-xs text-ink-light">{step.asset.attribution}</p> : null}
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-light">{step.whyNow}</p>
                  <dl className="mt-3 grid max-w-2xl gap-2 text-sm leading-6">
                    <div><dt className="inline font-medium">Target behaviour: </dt><dd className="inline text-ink-light">{step.targetBehaviour}</dd></div>
                    <div><dt className="inline font-medium">Practice: </dt><dd className="inline text-ink-light">{step.practice}</dd></div>
                    <div><dt className="inline font-medium">Evidence: </dt><dd className="inline text-ink-light">{step.evidenceSignal}</dd></div>
                  </dl>
                </div>
                <div className="flex items-start justify-between gap-5 sm:justify-end">
                  <span className="flex items-center gap-2 text-xs text-ink-light"><Clock3 size={15} /> {step.minutes} min</span>
                  <Link className="primary-button" href={step.asset.href}>Open<ArrowRight size={17} /></Link>
                </div>
              </li>
            ))}
          </ol>
        )}
        {pathway.deferred.length > 0 ? (
          <p className="mt-4 text-sm text-ink-light">{pathway.deferred.length} more step{pathway.deferred.length === 1 ? "" : "s"} do not fit your time budget yet: {pathway.deferred.map((step) => step.asset.title).join(", ")}.</p>
        ) : null}
      </section>

      {check.length > 0 ? (
        <section aria-labelledby="check-first">
          <h3 className="flex items-center gap-2 font-serif text-2xl" id="check-first"><Search size={20} />Check first</h3>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-ink-light">Nothing yet shows where you stand on these, so we do not guess a gap. A short check or a lesson will tell us.</p>
          <ul className="mt-4 grid gap-2 text-sm sm:grid-cols-2">{check.map((gap) => <li className="border border-border bg-white p-3" key={gap.skill}>{gap.name}</li>)}</ul>
        </section>
      ) : null}

      {pathway.contentGaps.length > 0 ? (
        <section aria-labelledby="content-gaps">
          <h3 className="font-serif text-2xl" id="content-gaps">No lesson yet</h3>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-ink-light">These are real gaps with no lesson available today. Coaches can fill them, and they show what to commission next.</p>
          <ul className="mt-4 grid gap-2 text-sm sm:grid-cols-2">{pathway.contentGaps.map((gap) => <li className="border border-border bg-white p-3" key={gap.skill}>{gap.name} <span className="text-ink-light">· needs {gap.required.toFixed(1)}, now about {(gap.current ?? 0).toFixed(1)}</span></li>)}</ul>
        </section>
      ) : null}
    </div>
  );
}
