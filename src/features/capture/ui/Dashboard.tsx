"use client";

import Link from "next/link";
import { useState } from "react";

import type { contributorDashboard } from "@/server/capture/earnings-service";

import { formatDuration, formatMoney, messageOf, post, shortDate, useRemote } from "./api";

type DashboardData = Awaited<ReturnType<typeof contributorDashboard>>;

const PROJECT_STATUS: Record<string, string> = { interviewing: "In conversation", in_review: "Ready for your review", approved: "Approved, awaiting lessons", published: "Lessons live", withdrawn: "Withdrawn" };
const LESSON_STATUS: Record<string, string> = { draft: "Draft", in_review: "With an editor", awaiting_contributor: "Waiting for your approval", approved: "Approved, ready to publish", published: "Live", retired: "Retired" };
const STATEMENT_STATUS: Record<string, string> = { illustrative: "Preview only, not payable", draft: "Draft", final: "Final", disputed: "Under review", paid: "Paid", void: "Void" };

type StatementPayload = {
  policyVersion: string;
  policyApproved: boolean;
  notes: string[];
  inputs: { receiptsCounted: number; eligibleNetMinor: number; poolMinor: number; eventsCounted: number; eventsNotCounted: number };
  appliedWeights: Record<string, number>;
  payableAfter: string;
  contributor: { lines: Array<{ lessonId: string; title: string; shareBp: number; lessonAllocationMinor: number; amountMinor: number }> };
  lessons: Array<{ lessonId: string; consumptionSeconds: number; completions: number; materialUses: number; ratings: number; meanRating: number | null }>;
};

export function Dashboard() {
  const { data, error, setError, reload } = useRemote<DashboardData>("/api/contribute/dashboard");
  const approvals = useRemote<{ drafts: Array<{ id: string; title: string }> }>("/api/contribute/skill-shots/mine").data?.drafts ?? [];
  const [open, setOpen] = useState<string | null>(null);
  const [note, setNote] = useState("");

  if (!data) return <div className="mx-auto max-w-3xl px-5 py-16 sm:px-8" role="status">{error ? <p className="text-crimson">{error} <Link className="underline" href="/sign-in">Sign in</Link></p> : <p className="text-ink-light">Loading your dashboard…</p>}</div>;

  const totals = data.lessons.reduce((sum, lesson) => ({ completions: sum.completions + lesson.usage.completions, seconds: sum.seconds + lesson.usage.seconds }), { completions: 0, seconds: 0 });

  return (
    <div className="mx-auto w-full max-w-6xl px-5 py-8 sm:px-8 lg:py-12">
      <p className="font-mono text-[10px] uppercase text-ink-light">Contributor dashboard</p>
      <h1 className="mt-1 font-display text-4xl font-semibold sm:text-5xl">{data.contributor ? `${data.contributor.name}` : "Your contributions"}</h1>
      {error ? <p className="mt-3 text-sm text-crimson" role="alert">{error}</p> : null}

      <dl className="mt-6 grid grid-cols-2 gap-px border border-border bg-border sm:grid-cols-4">
        {[["Lessons credited", data.lessons.length], ["Live lessons", data.lessons.filter((l) => l.status === "published").length], ["Learners reached", data.learnersReached], ["Completions", totals.completions]].map(([label, value]) => (
          <div key={label as string} className="bg-surface p-4"><dt className="font-mono text-[10px] uppercase text-ink-light">{label}</dt><dd className="mt-1 font-display text-3xl">{value}</dd></div>
        ))}
      </dl>

      {approvals.length ? (
        <section className="mt-10 border-l-2 border-gold bg-gold-pale/40 p-4" aria-label="Skill Shots waiting for your approval">
          <h2 className="font-display text-2xl">Waiting for your approval</h2>
          <p className="mt-1 text-sm text-ink-mid">An editor redesigned your lesson as a Skill Shot taught by Arya. It is published only if you approve the wording.</p>
          <ul className="mt-3 divide-y divide-border border border-border bg-surface">
            {approvals.map((draft) => <li className="flex items-center justify-between gap-3 p-4 text-sm" key={draft.id}><span className="font-semibold">{draft.title}</span><Link className="text-teal underline underline-offset-4" href={`/contribute/skill-shots/${draft.id}`}>Review and approve</Link></li>)}
          </ul>
        </section>
      ) : null}

      <section className="mt-10" aria-label="Interviews">
        <h2 className="font-display text-2xl">My interviews</h2>
        {data.projects.length === 0 ? <p className="mt-2 text-sm text-ink-mid">You have not started one. <Link className="text-teal underline underline-offset-4" href="/contribute">Begin here.</Link></p> : null}
        <ul className="mt-3 divide-y divide-border border border-border bg-surface">
          {data.projects.map((project) => (
            <li key={project.id} className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
              <div><p className="font-semibold">{project.title}</p><p className="text-xs text-ink-light">{PROJECT_STATUS[project.status] ?? project.status} · updated {shortDate(project.updatedAt)}</p></div>
              <div className="flex gap-4">
                {project.status === "interviewing" ? <Link className="text-teal underline underline-offset-4" href={`/contribute/${project.id}`}>Continue the conversation</Link> : null}
                {project.status !== "withdrawn" ? <Link className="text-teal underline underline-offset-4" href={`/contribute/${project.id}/review`}>Review</Link> : null}
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-10" aria-label="Lessons">
        <h2 className="font-display text-2xl">My lessons and how they are used</h2>
        <p className="mt-1 text-sm text-ink-mid">Usage is recorded from the first view. It shows how learners use each lesson; it is not a promise of earnings.</p>
        {data.lessons.length === 0 ? <p className="mt-3 text-sm text-ink-light">No lessons yet. After you approve your knowledge, editors draft lessons and ask for your approval.</p> : null}
        {data.lessons.length ? (
          <div className="mt-3 overflow-x-auto border border-border bg-surface">
            <table className="w-full min-w-170 text-left text-sm">
              <thead className="border-b border-border font-mono text-[10px] uppercase text-ink-light"><tr><th className="p-3">Lesson</th><th className="p-3">Status</th><th className="p-3">Credit</th><th className="p-3">Learners</th><th className="p-3">Completed</th><th className="p-3">Time spent</th><th className="p-3">Materials used</th><th className="p-3">Usefulness</th></tr></thead>
              <tbody>
                {data.lessons.map((lesson) => (
                  <tr key={lesson.id} className="border-b border-border last:border-0">
                    <td className="p-3 font-semibold">{lesson.status === "published" ? <Link className="underline underline-offset-4" href={`/lessons/${lesson.slug}`}>{lesson.title}</Link> : <Link className="underline underline-offset-4" href={`/contribute/lessons/${lesson.id}`}>{lesson.title}</Link>}<span className="block text-xs font-normal text-ink-light">version {lesson.version}</span></td>
                    <td className="p-3">{LESSON_STATUS[lesson.status]}{lesson.status === "awaiting_contributor" ? <Link className="block text-xs text-teal underline" href={`/contribute/lessons/${lesson.id}`}>Review and approve</Link> : null}</td>
                    <td className="p-3">{(lesson.shareBp / 100).toFixed(0)}%</td>
                    <td className="p-3">{lesson.usage.learners}</td>
                    <td className="p-3">{lesson.usage.completions}</td>
                    <td className="p-3">{formatDuration(lesson.usage.seconds)}</td>
                    <td className="p-3">{lesson.usage.materialUses}</td>
                    <td className="p-3">{lesson.usage.meanRating ? `${lesson.usage.meanRating} / 5 (${lesson.usage.ratings})` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>

      <section className="mt-10" aria-label="Earnings">
        <h2 className="font-display text-2xl">Earnings statements</h2>
        {data.earningsPolicy ? (
          <p className="mt-1 text-sm text-ink-mid">Calculated under revenue-share policy <span className="font-semibold">{data.earningsPolicy.version}</span>, approved {shortDate(data.earningsPolicy.approvedAt)}. Every statement shows its inputs, formula version and the usage behind each line.</p>
        ) : (
          <p className="mt-2 border-l-2 border-gold bg-gold-pale px-4 py-3 text-sm">The revenue-share rules are still being finalised and approved. Until then nothing is payable, but every view, completion, use of materials and rating is already recorded against your lessons, so the approved rules can be applied to all of it, transparently.</p>
        )}
        {data.statements.length === 0 ? <p className="mt-3 text-sm text-ink-light">No statements yet.</p> : null}
        <ul className="mt-3 space-y-3">
          {data.statements.map((statement) => {
            const payload = statement.payload as unknown as StatementPayload;
            return (
              <li key={statement.id} className="border border-border bg-surface p-4 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p><span className="font-semibold">{shortDate(statement.periodStart)} to {shortDate(statement.periodEnd)}</span> · {STATEMENT_STATUS[statement.status]}</p>
                  <p className="font-display text-2xl">{formatMoney(statement.totalMinor, statement.currency)}</p>
                </div>
                <button aria-expanded={open === statement.id} className="mt-1 text-xs text-teal underline underline-offset-4" onClick={() => setOpen(open === statement.id ? null : statement.id)} type="button">{open === statement.id ? "Hide" : "Show"} how this was calculated</button>
                {open === statement.id ? (
                  <div className="mt-3 space-y-3 text-xs leading-5 text-ink-mid">
                    <p>Policy version <span className="font-semibold">{payload.policyVersion}</span> ({payload.policyApproved ? "approved" : "not approved"}). Eligible receipts: {payload.inputs.receiptsCounted}; amount after refunds, fees and tax: {formatMoney(payload.inputs.eligibleNetMinor, statement.currency)}; contributor pool: {formatMoney(payload.inputs.poolMinor, statement.currency)}. Learning events counted: {payload.inputs.eventsCounted} ({payload.inputs.eventsNotCounted} not counted: repeats beyond the daily cap or duplicates).</p>
                    <p>How the pool is shared across lessons: {Object.entries(payload.appliedWeights).filter(([, weight]) => weight > 0).map(([measure, weight]) => `${measure} ${(weight * 100).toFixed(0)}%`).join(", ") || "no measure had activity"}. Ratings only count for learners who completed the lesson.</p>
                    <table className="w-full text-left"><thead className="font-mono text-[10px] uppercase text-ink-light"><tr><th className="py-1">Lesson</th><th>Your credit</th><th>Lesson allocation</th><th>Your amount</th></tr></thead>
                      <tbody>{payload.contributor.lines.map((line) => <tr key={line.lessonId} className="border-t border-border"><td className="py-1">{line.title}</td><td>{(line.shareBp / 100).toFixed(0)}%</td><td>{formatMoney(line.lessonAllocationMinor, statement.currency)}</td><td>{formatMoney(line.amountMinor, statement.currency)}</td></tr>)}</tbody></table>
                    {payload.notes.map((n, i) => <p key={i}>• {n}</p>)}
                    <p>Earliest payment date if final: {shortDate(payload.payableAfter)}.</p>
                    {statement.disputeNote ? <p className="border-l-2 border-gold pl-3">Your question: {statement.disputeNote}</p> : null}
                    {(statement.status === "draft" || statement.status === "final") ? (
                      <div>
                        <label className="font-mono text-[10px] uppercase text-ink-light" htmlFor={`d-${statement.id}`}>Something looks wrong?</label>
                        <textarea className="field-input min-h-14" id={`d-${statement.id}`} onChange={(event) => setNote(event.target.value)} value={note} />
                        <button className="primary-button mt-1" disabled={note.trim().length < 10} onClick={async () => { try { await post(`/api/contribute/statements/${statement.id}/dispute`, { note }); setNote(""); reload(); } catch (caught) { setError(messageOf(caught)); } }} type="button">Raise a question</button>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
