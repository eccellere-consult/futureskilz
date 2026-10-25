"use client";

import Link from "next/link";
import { useState } from "react";

import type { AllocationRun } from "../earnings/calculator";
import type { RevenuePolicy } from "../earnings/policy";
import type { PolicyRecord } from "@/server/capture/earnings-service";

import { formatMoney, messageOf, post, shortDate, useRemote } from "./api";

type Receipt = { id: string; externalRef: string; grossMinor: number; refundMinor: number; feeMinor: number; taxMinor: number; currency: string; status: string; receivedAt: string };
type RunResult = { run: AllocationRun; statements: Array<{ id: string; contributorId: string; status: string; totalMinor: number }>; inputsHash: string };

const minor = (value: string): number => Math.round(Number.parseFloat(value || "0") * 100);
const pct = (bp: number): string => String(bp / 100);
const bp = (value: string): number => Math.round(Number.parseFloat(value || "0") * 100);

/** The business sets, approves and applies the revenue-share policy here. Nothing is hard-coded: every number is a decision. */
export function AdminEarnings() {
  const policyData = useRemote<{ policies: PolicyRecord[]; template: RevenuePolicy }>("/api/contribute/admin/policies");
  const receiptData = useRemote<{ receipts: Receipt[] }>("/api/contribute/admin/receipts");
  const policies = policyData.data?.policies ?? null;
  const template = policyData.data?.template ?? null;
  const receipts = receiptData.data?.receipts ?? [];
  const [edited, setForm] = useState<RevenuePolicy | null>(null);
  const form = edited ?? template;
  const [actionError, setError] = useState<string | null>(null);
  const error = actionError ?? policyData.error ?? receiptData.error;
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [receipt, setReceipt] = useState({ externalRef: "", gross: "", refund: "0", fee: "0", tax: "0", date: new Date().toISOString().slice(0, 10) });
  const [chosen, setPeriod] = useState(() => ({ policyId: "", start: new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10), end: new Date(Date.now() + 86_400_000).toISOString().slice(0, 10) }));
  const period = { ...chosen, policyId: chosen.policyId || policies?.[0]?.id || "" };
  const [result, setResult] = useState<RunResult | null>(null);

  const run = async (work: () => Promise<unknown>, done?: string) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await work();
      if (done) setNotice(done);
      policyData.reload();
      receiptData.reload();
    } catch (caught) {
      setError(messageOf(caught));
    } finally {
      setBusy(false);
    }
  };

  if (!policies || !template || !form) return <div className="mx-auto max-w-3xl px-5 py-16 sm:px-8" role="status">{error ? <p className="text-crimson">{error}</p> : <p className="text-ink-light">Loading…</p>}</div>;

  const set = <K extends keyof RevenuePolicy>(key: K, value: RevenuePolicy[K]) => setForm({ ...form, [key]: value });
  const weightTotal = Object.values(form.weights).reduce((a, b) => a + b, 0);
  const num = (label: string, value: number, onChange: (v: number) => void, suffix = "") => (
    <label className="block text-xs"><span className="font-mono text-[10px] uppercase text-ink-light">{label}</span>
      <span className="flex items-center gap-1"><input className="field-input py-1.5! text-sm" inputMode="decimal" onChange={(event) => onChange(Number.parseFloat(event.target.value) || 0)} value={value} />{suffix}</span>
    </label>
  );

  return (
    <div className="mx-auto w-full max-w-6xl px-5 py-8 sm:px-8 lg:py-12">
      <Link className="text-sm text-teal underline underline-offset-4" href="/contribute/admin/users">Accounts and passwords</Link>
      <p className="mt-3 font-mono text-[10px] uppercase text-ink-light">Admin · earnings</p>
      <h1 className="mt-1 font-display text-4xl font-semibold sm:text-5xl">Revenue sharing, on approved rules</h1>
      <p className="mt-2 max-w-3xl text-ink-mid">The platform ships no formula. You set a policy, approve it, and apply it to a period. An unapproved policy only produces a preview that cannot be paid. Ratings can carry at most 30% of the weight and only count for learners who completed a lesson.</p>
      {error ? <p className="mt-3 border-l-2 border-crimson bg-crimson/5 px-4 py-2 text-sm text-crimson" role="alert">{error}</p> : null}
      {notice ? <p className="mt-3 border-l-2 border-teal bg-teal/5 px-4 py-2 text-sm" role="status">{notice}</p> : null}

      <section className="mt-8 grid gap-6 lg:grid-cols-2" aria-label="Policies">
        <div>
          <h2 className="font-display text-2xl">Policy versions</h2>
          {policies.length === 0 ? <p className="mt-2 text-sm text-ink-light">None yet. Draft one on the right.</p> : null}
          <ul className="mt-3 space-y-3">
            {policies.map((policy) => (
              <li key={policy.id} className="border border-border bg-surface p-4 text-sm">
                <p className="font-semibold">{policy.definition.version} · <span className={policy.status === "approved" ? "text-teal" : ""}>{policy.status}</span></p>
                <p className="text-xs text-ink-mid">Pool {pct(policy.definition.contributorPoolBp)}% of {policy.definition.receiptBasis.replace(/_/g, " ")} · consumption {pct(policy.definition.weights.consumption)}%, completion {pct(policy.definition.weights.completion)}%, materials {pct(policy.definition.weights.materialUse)}%, usefulness {pct(policy.definition.weights.usefulness)}% · hold {policy.definition.payout.holdDays} days</p>
                {policy.status === "approved" ? <p className="text-xs text-ink-light">Approved {shortDate(policy.approvedAt)}. Frozen: change it by saving a new version.</p> : (
                  <div className="mt-2 flex gap-3">
                    <button className="primary-button min-h-9! px-3! py-1.5! text-xs" disabled={busy} onClick={() => void run(() => post(`/api/contribute/admin/policies/${policy.id}/approve`), "Policy approved.")} type="button">Approve this version</button>
                    <button className="text-xs underline underline-offset-4" onClick={() => setForm(policy.definition)} type="button">Edit</button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>

        <div className="border border-border bg-surface p-4" aria-label="Draft a policy">
          <h2 className="font-display text-2xl">Draft a policy</h2>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <label className="block text-xs"><span className="font-mono text-[10px] uppercase text-ink-light">Version name</span><input className="field-input py-1.5! text-sm" onChange={(event) => set("version", event.target.value)} value={form.version} /></label>
            <label className="block text-xs"><span className="font-mono text-[10px] uppercase text-ink-light">Currency</span><input className="field-input py-1.5! text-sm" maxLength={3} onChange={(event) => set("currency", event.target.value.toUpperCase())} value={form.currency} /></label>
            <label className="col-span-2 block text-xs"><span className="font-mono text-[10px] uppercase text-ink-light">Which receipts count</span>
              <select className="field-input py-1.5! text-sm" onChange={(event) => set("receiptBasis", event.target.value as RevenuePolicy["receiptBasis"])} value={form.receiptBasis}>
                <option value="gross">Gross receipts</option><option value="net_of_refunds">After refunds</option><option value="net_of_refunds_fees_tax">After refunds, fees and tax</option>
              </select></label>
            {num("Share of receipts to the contributor pool", form.contributorPoolBp / 100, (v) => set("contributorPoolBp", bp(String(v))), "%")}
            {num("Minimum payout", form.payout.minPayoutMinor / 100, (v) => set("payout", { ...form.payout, minPayoutMinor: minor(String(v)) }), form.currency)}
          </div>
          <p className="mt-4 font-mono text-[10px] uppercase text-ink-light">How the pool is shared across lessons (must total 100%; now {weightTotal / 100}%)</p>
          <div className="mt-1 grid grid-cols-2 gap-3">
            {num("Time spent", form.weights.consumption / 100, (v) => set("weights", { ...form.weights, consumption: bp(String(v)) }), "%")}
            {num("Completions", form.weights.completion / 100, (v) => set("weights", { ...form.weights, completion: bp(String(v)) }), "%")}
            {num("Use of materials", form.weights.materialUse / 100, (v) => set("weights", { ...form.weights, materialUse: bp(String(v)) }), "%")}
            {num("Usefulness ratings (max 30%)", form.weights.usefulness / 100, (v) => set("weights", { ...form.weights, usefulness: bp(String(v)) }), "%")}
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            {num("Ratings needed before they count", form.usefulness.minRatings, (v) => set("usefulness", { ...form.usefulness, minRatings: Math.max(1, Math.round(v)) }))}
            {num("Daily cap per learner and lesson (minutes)", form.consumption.capSecondsPerLearnerLessonDay / 60, (v) => set("consumption", { capSecondsPerLearnerLessonDay: Math.max(60, Math.round(v * 60)) }))}
            {num("Counted events per learner, lesson and day", form.antiGaming.maxCountedEventsPerLearnerLessonDay, (v) => set("antiGaming", { maxCountedEventsPerLearnerLessonDay: Math.max(1, Math.round(v)) }))}
            {num("Hold before payment (days)", form.payout.holdDays, (v) => set("payout", { ...form.payout, holdDays: Math.max(0, Math.round(v)) }))}
            {num("Dispute window (days)", form.payout.disputeWindowDays, (v) => set("payout", { ...form.payout, disputeWindowDays: Math.max(0, Math.round(v)) }))}
          </div>
          <div className="mt-4 flex gap-3">
            <button className="primary-button" disabled={busy} onClick={() => void run(() => post("/api/contribute/admin/policies", form), "Draft saved.")} type="button">Save draft</button>
            <button className="text-sm underline underline-offset-4" onClick={() => setForm(template)} type="button">Reset to template</button>
          </div>
          <p className="mt-2 text-xs text-ink-light">Taxes, payout timing and dispute rules need legal and tax advice before approval.</p>
        </div>
      </section>

      <section className="mt-10 grid gap-6 lg:grid-cols-2" aria-label="Receipts and runs">
        <div className="border border-border bg-surface p-4">
          <h2 className="font-display text-2xl">Learner receipts</h2>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <label className="col-span-2 block text-xs"><span className="font-mono text-[10px] uppercase text-ink-light">Reference (unique)</span><input className="field-input py-1.5! text-sm" onChange={(event) => setReceipt({ ...receipt, externalRef: event.target.value })} value={receipt.externalRef} /></label>
            {([["gross", "Gross amount"], ["refund", "Refunded"], ["fee", "Platform / gateway fees"], ["tax", "Tax"]] as const).map(([key, label]) => (
              <label key={key} className="block text-xs"><span className="font-mono text-[10px] uppercase text-ink-light">{label} ({form.currency})</span><input className="field-input py-1.5! text-sm" inputMode="decimal" onChange={(event) => setReceipt({ ...receipt, [key]: event.target.value })} value={receipt[key]} /></label>
            ))}
            <label className="block text-xs"><span className="font-mono text-[10px] uppercase text-ink-light">Received on</span><input className="field-input py-1.5! text-sm" onChange={(event) => setReceipt({ ...receipt, date: event.target.value })} type="date" value={receipt.date} /></label>
          </div>
          <button className="primary-button mt-3" disabled={busy || !receipt.externalRef || !receipt.gross} onClick={() => void run(() => post("/api/contribute/admin/receipts", { externalRef: receipt.externalRef, grossMinor: minor(receipt.gross), refundMinor: minor(receipt.refund), feeMinor: minor(receipt.fee), taxMinor: minor(receipt.tax), currency: form.currency, receivedAt: new Date(`${receipt.date}T00:00:00Z`).toISOString() }), "Receipt recorded.")} type="button">Record receipt</button>
          <ul className="mt-3 max-h-48 space-y-1 overflow-y-auto text-xs">{receipts.map((r) => <li key={r.id}>{shortDate(r.receivedAt)} · {r.externalRef} · {formatMoney(r.grossMinor, r.currency)} · {r.status}</li>)}</ul>
        </div>

        <div className="border border-ink bg-surface p-4">
          <h2 className="font-display text-2xl">Apply a policy to a period</h2>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <label className="col-span-2 block text-xs"><span className="font-mono text-[10px] uppercase text-ink-light">Policy</span>
              <select className="field-input py-1.5! text-sm" onChange={(event) => setPeriod({ ...period, policyId: event.target.value })} value={period.policyId}>
                {policies.map((p) => <option key={p.id} value={p.id}>{p.definition.version} ({p.status})</option>)}
              </select></label>
            <label className="block text-xs"><span className="font-mono text-[10px] uppercase text-ink-light">From</span><input className="field-input py-1.5! text-sm" onChange={(event) => setPeriod({ ...period, start: event.target.value })} type="date" value={period.start} /></label>
            <label className="block text-xs"><span className="font-mono text-[10px] uppercase text-ink-light">Up to (not including)</span><input className="field-input py-1.5! text-sm" onChange={(event) => setPeriod({ ...period, end: event.target.value })} type="date" value={period.end} /></label>
          </div>
          <button className="primary-button mt-3" disabled={busy || !period.policyId} onClick={() => void run(async () => setResult(await post<RunResult>("/api/contribute/admin/allocations", { policyId: period.policyId, periodStart: `${period.start}T00:00:00Z`, periodEnd: `${period.end}T00:00:00Z` })))} type="button">Calculate</button>
        </div>
      </section>

      {result ? (
        <section className="mt-10" aria-label="Result">
          <h2 className="font-display text-2xl">Result · policy {result.run.policyVersion}</h2>
          {result.run.status === "illustrative" ? <p className="mt-2 border-l-2 border-gold bg-gold-pale px-4 py-2 text-sm">Preview only. This policy is not approved, so nothing here is payable or can be finalised.</p> : null}
          <p className="mt-2 text-sm text-ink-mid">Receipts counted {result.run.inputs.receiptsCounted} ({result.run.inputs.receiptsExcluded} excluded) · eligible net {formatMoney(result.run.inputs.eligibleNetMinor, result.run.currency)} · pool {formatMoney(result.run.inputs.poolMinor, result.run.currency)} · events counted {result.run.inputs.eventsCounted} ({result.run.inputs.eventsNotCounted} not counted) · unallocated {formatMoney(result.run.unallocatedMinor, result.run.currency)} · fingerprint {result.inputsHash.slice(0, 12)}</p>
          {result.run.notes.map((n, i) => <p key={i} className="text-xs text-ink-light">• {n}</p>)}
          <div className="mt-3 overflow-x-auto border border-border bg-surface">
            <table className="w-full min-w-170 text-left text-sm">
              <thead className="border-b border-border font-mono text-[10px] uppercase text-ink-light"><tr><th className="p-3">Lesson</th><th className="p-3">Time</th><th className="p-3">Completions</th><th className="p-3">Materials</th><th className="p-3">Ratings</th><th className="p-3">Score</th><th className="p-3">Allocation</th></tr></thead>
              <tbody>{result.run.lessons.map((l) => <tr key={l.lessonId} className="border-b border-border last:border-0"><td className="p-3">{l.title}</td><td className="p-3">{Math.round(l.consumptionSeconds / 60)} min</td><td className="p-3">{l.completions}</td><td className="p-3">{l.materialUses}</td><td className="p-3">{l.meanRating ?? "—"} ({l.ratings})</td><td className="p-3">{(l.score * 100).toFixed(1)}%</td><td className="p-3">{formatMoney(l.allocationMinor, result.run.currency)}</td></tr>)}</tbody>
            </table>
          </div>
          <ul className="mt-3 space-y-2 text-sm">
            {result.statements.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center gap-3 border border-border bg-surface p-3"><span className="font-mono text-xs">{s.contributorId.slice(0, 8)}</span><span>{formatMoney(s.totalMinor, result.run.currency)}</span><span className="text-xs text-ink-light">{s.status}</span>
                {s.status === "draft" ? <button className="primary-button min-h-9! px-3! py-1.5! text-xs" disabled={busy} onClick={() => void run(() => post(`/api/contribute/admin/statements/${s.id}`, { action: "final" }), "Statement finalised.")} type="button">Finalise</button> : null}
                {s.status === "final" ? <button className="min-h-9 border border-ink px-3 text-xs" disabled={busy} onClick={() => void run(() => post(`/api/contribute/admin/statements/${s.id}`, { action: "paid" }), "Marked paid.")} type="button">Mark paid</button> : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
