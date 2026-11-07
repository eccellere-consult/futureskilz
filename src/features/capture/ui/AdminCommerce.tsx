"use client";

import { useState } from "react";

import type { PayoutRow } from "@/server/payments/payout-service";
import type { PlanRow } from "@/server/payments/service";

import { formatMoney, messageOf, patch, post, shortDate, useRemote } from "./api";

type Overview = { mode: "off" | "test" | "razorpay"; razorpayKeys: boolean; webhookSecret: boolean; gstConfigured: boolean; gstRateBp: number; live: boolean; paidOrders: number; grossMinor: number; refundedMinor: number; webhooksReceived: number };

const PAYOUT_FILE = "/api/contribute/admin/payouts?format=csv";
const ok = (value: boolean) => (value ? "Set" : "Not set");

/** Connection status, the plans on sale, and coach payouts. Prices, GST details and keys are the business's own decisions. */
export function AdminCommerce() {
  const overview = useRemote<Overview>("/api/contribute/admin/payments-overview");
  const plansData = useRemote<{ plans: PlanRow[] }>("/api/contribute/admin/plans");
  const payoutData = useRemote<{ payouts: PayoutRow[] }>("/api/contribute/admin/payouts");
  const [form, setForm] = useState({ code: "", name: "", description: "", price: "", days: "30" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [refs, setRefs] = useState<Record<string, string>>({});

  const run = async (work: () => Promise<string | void>) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const done = await work();
      if (done) setNotice(done);
      overview.reload(); plansData.reload(); payoutData.reload();
    } catch (caught) {
      setError(messageOf(caught));
    } finally {
      setBusy(false);
    }
  };
  const o = overview.data;

  return (
    <div className="mx-auto w-full max-w-6xl px-5 pt-8 sm:px-8">
      <p className="font-mono text-[10px] uppercase text-gold">Admin</p>
      <h1 className="mt-1 font-display text-4xl font-semibold sm:text-5xl">Selling, invoicing and paying out</h1>
      {error ? <p className="mt-3 border-l-2 border-crimson bg-crimson/5 px-4 py-2 text-sm text-crimson" role="alert">{error}</p> : null}
      {notice ? <p className="mt-3 border-l-2 border-teal bg-teal/5 px-4 py-2 text-sm" role="status">{notice}</p> : null}

      <section aria-label="Connections" className="mt-6 grid gap-px border border-border bg-border md:grid-cols-2">
        <div className="bg-surface p-5">
          <p className="font-semibold">Razorpay (UPI, cards, EMI)</p>
          <p className="mt-1 inline-block bg-gold-pale px-2 py-0.5 font-mono text-[10px] uppercase">{o ? (o.mode === "razorpay" && o.razorpayKeys ? "Connected" : o.mode === "test" ? "Test mode" : "Not connected") : "…"}</p>
          {o ? <ul className="mt-2 space-y-0.5 text-xs text-ink-mid"><li>Mode: {o.mode}. Keys: {ok(o.razorpayKeys)}. Webhook secret: {ok(o.webhookSecret)}.</li><li>Webhook address to give Razorpay: <code>/api/payments/webhook</code> (events: payment.captured, payment.failed, refund.processed).</li><li>{o.paidOrders} paid orders · {formatMoney(o.grossMinor, "INR")} taken · {formatMoney(o.refundedMinor, "INR")} refunded · {o.webhooksReceived} notifications received.</li>{o.mode === "test" ? <li className="text-crimson">Test mode moves no money, and its receipts never count as revenue. Switch PAYMENTS_MODE to razorpay for real sales.</li> : null}</ul> : null}
        </div>
        <div className="bg-surface p-5">
          <p className="font-semibold">GST invoices</p>
          <p className="mt-1 inline-block bg-gold-pale px-2 py-0.5 font-mono text-[10px] uppercase">{o ? (o.gstConfigured ? "Configured" : "Needs details") : "…"}</p>
          {o ? <p className="mt-2 text-xs text-ink-mid">Rate {o.gstRateBp / 100}%. Needs the supplier name, GSTIN and state in the environment settings (GST_SUPPLIER_NAME, GST_SUPPLIER_GSTIN, GST_SUPPLIER_STATE). Have your chartered accountant check the invoice format, the rate and the place-of-supply rules before you rely on it for filing.</p> : null}
        </div>
      </section>

      <section aria-label="Plans" className="mt-10">
        <h2 className="font-display text-2xl">Plans</h2>
        <p className="mt-1 max-w-3xl text-sm text-ink-mid">A plan is a pass: one payment opens every Skill Shot for a number of days. Prices are what the learner pays, GST included. Nothing is locked, and nothing is sold, until a plan is on sale and Razorpay is connected. Prices of a plan that has been sold cannot change.</p>
        <div className="mt-3 grid gap-3 border border-border bg-surface p-4 sm:grid-cols-5">
          <label className="block text-xs"><span className="font-mono text-[10px] uppercase text-ink-light">Code</span><input className="field-input py-1.5! text-sm" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toLowerCase() })} /></label>
          <label className="block text-xs sm:col-span-2"><span className="font-mono text-[10px] uppercase text-ink-light">Name</span><input className="field-input py-1.5! text-sm" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
          <label className="block text-xs"><span className="font-mono text-[10px] uppercase text-ink-light">Price (INR, with GST)</span><input className="field-input py-1.5! text-sm" inputMode="decimal" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} /></label>
          <label className="block text-xs"><span className="font-mono text-[10px] uppercase text-ink-light">Days of access</span><input className="field-input py-1.5! text-sm" inputMode="numeric" value={form.days} onChange={(e) => setForm({ ...form, days: e.target.value })} /></label>
          <label className="block text-xs sm:col-span-4"><span className="font-mono text-[10px] uppercase text-ink-light">One line for learners</span><input className="field-input py-1.5! text-sm" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label>
          <div className="flex items-end"><button className="primary-button" disabled={busy || !form.code || !form.name || !form.price} onClick={() => void run(async () => { await post("/api/contribute/admin/plans", { code: form.code, name: form.name, description: form.description, amountMinor: Math.round(Number.parseFloat(form.price) * 100), durationDays: Number.parseInt(form.days, 10) || 0 }); setForm({ code: "", name: "", description: "", price: "", days: "30" }); return "Plan saved, switched off."; })} type="button">Save plan</button></div>
        </div>
        <ul className="mt-3 space-y-2">
          {(plansData.data?.plans ?? []).map((plan) => (
            <li key={plan.id} className="flex flex-wrap items-center justify-between gap-3 border border-border bg-surface p-3 text-sm">
              <span><strong>{plan.name}</strong> <span className="text-xs text-ink-light">{plan.code} · {formatMoney(plan.amountMinor, plan.currency)} · {plan.durationDays} days · {plan.active ? "on sale" : "off sale"}</span></span>
              <button className={plan.active ? "border border-border px-3 py-2" : "primary-button"} disabled={busy} onClick={() => void run(async () => { await patch(`/api/contribute/admin/plans/${plan.id}`, { active: !plan.active }); })} type="button">{plan.active ? "Take off sale" : "Put on sale"}</button>
            </li>
          ))}
        </ul>
      </section>

      <section aria-label="Payouts" className="mt-10">
        <h2 className="font-display text-2xl">Coach payouts</h2>
        <p className="mt-1 max-w-3xl text-sm text-ink-mid">Payouts are a manual bank transfer for now. Queue the final statements, download the file for your finance team, pay from your bank, then record each bank reference here. That marks the statement paid. Bank details are never stored in FutureSkilz.</p>
        <div className="mt-3 flex flex-wrap gap-3">
          <button className="primary-button" disabled={busy} onClick={() => void run(async () => { const r = await post<{ queued: number }>("/api/contribute/admin/payouts"); return `${r.queued} payout${r.queued === 1 ? "" : "s"} queued.`; })} type="button">Queue final statements</button>
          <a className="border border-border px-3 py-2 text-sm" download href={PAYOUT_FILE}>Download the file to pay from</a>
        </div>
        <ul className="mt-3 space-y-2">
          {(payoutData.data?.payouts ?? []).map((row) => (
            <li key={row.id} className="flex flex-wrap items-end justify-between gap-3 border border-border bg-surface p-3 text-sm">
              <span><strong>{row.coach}</strong> <span className="text-xs text-ink-light">{formatMoney(row.amountMinor, row.currency)} · {row.status}{row.paidAt ? ` ${shortDate(row.paidAt)} · ${row.reference}` : ""}</span></span>
              {row.status === "queued" ? (
                <span className="flex items-end gap-2"><label className="text-xs"><span className="font-mono text-[10px] uppercase text-ink-light">Bank reference</span><input className="field-input py-1.5! text-sm" value={refs[row.id] ?? ""} onChange={(e) => setRefs({ ...refs, [row.id]: e.target.value })} /></label><button className="primary-button" disabled={busy} onClick={() => void run(async () => { await patch(`/api/contribute/admin/payouts/${row.id}`, { reference: refs[row.id] ?? "" }); return "Marked paid."; })} type="button">Mark paid</button></span>
              ) : null}
            </li>
          ))}
          {payoutData.data && payoutData.data.payouts.length === 0 ? <li className="text-sm text-ink-light">No payouts yet. Finalise a statement first.</li> : null}
        </ul>
      </section>
    </div>
  );
}
