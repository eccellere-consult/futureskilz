"use client";

import { useState } from "react";

import type { CampaignRow } from "@/server/capture/campaign-service";

import { messageOf, patch, post, shortDate, useRemote } from "./api";

const blank = { name: "", kind: "discount" as CampaignRow["kind"], code: "", percentOff: "10", extraFree: "1", startsAt: new Date().toISOString().slice(0, 10), endsAt: new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10), maxRedemptions: "" };

/** Promotions: discount codes, extra free access and featured placement. Each is counted, dated and can be paused. */
export function AdminCampaigns() {
  const { data, error, setError, reload } = useRemote<{ campaigns: CampaignRow[] }>("/api/contribute/admin/campaigns");
  const [form, setForm] = useState(blank);
  const [busy, setBusy] = useState(false);
  const run = async (work: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try { await work(); reload(); } catch (caught) { setError(messageOf(caught)); } finally { setBusy(false); }
  };
  const create = () => run(async () => {
    await post("/api/contribute/admin/campaigns", { name: form.name, kind: form.kind, code: form.kind === "discount" ? form.code : undefined, percentOffBp: form.kind === "discount" ? Math.round(Number.parseFloat(form.percentOff || "0") * 100) : 0, extraFreePerPillar: form.kind === "free_access" ? Number.parseInt(form.extraFree || "0", 10) : 0, startsAt: `${form.startsAt}T00:00:00Z`, endsAt: `${form.endsAt}T00:00:00Z`, maxRedemptions: form.maxRedemptions ? Number.parseInt(form.maxRedemptions, 10) : null });
    setForm(blank);
  });
  return (
    <section aria-label="Campaigns and promotions" className="mt-10">
      <h2 className="font-display text-2xl">Campaigns and promotions</h2>
      <p className="mt-1 max-w-3xl text-sm text-ink-mid">A discount code takes a percentage off at checkout. Free access gives learners extra free Skill Shots per pillar on top of the standard free ones. Featured placement is a label for the marketplace. Nothing is live until you activate it.</p>
      {error ? <p className="mt-3 border-l-2 border-crimson bg-crimson/5 px-4 py-2 text-sm text-crimson" role="alert">{error}</p> : null}
      <div className="mt-3 grid gap-3 border border-border bg-surface p-4 sm:grid-cols-2">
        <label className="block text-xs sm:col-span-2"><span className="font-mono text-[10px] uppercase text-ink-light">Name</span><input className="field-input py-1.5! text-sm" onChange={(e) => setForm({ ...form, name: e.target.value })} value={form.name} /></label>
        <label className="block text-xs"><span className="font-mono text-[10px] uppercase text-ink-light">Kind</span>
          <select className="field-input py-1.5! text-sm" onChange={(e) => setForm({ ...form, kind: e.target.value as CampaignRow["kind"] })} value={form.kind}><option value="discount">Discount code</option><option value="free_access">Extra free access</option><option value="featured">Featured placement</option></select></label>
        {form.kind === "discount" ? <><label className="block text-xs"><span className="font-mono text-[10px] uppercase text-ink-light">Code</span><input className="field-input py-1.5! text-sm" onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} value={form.code} /></label><label className="block text-xs"><span className="font-mono text-[10px] uppercase text-ink-light">Percent off</span><input className="field-input py-1.5! text-sm" inputMode="decimal" onChange={(e) => setForm({ ...form, percentOff: e.target.value })} value={form.percentOff} /></label></> : null}
        {form.kind === "free_access" ? <label className="block text-xs"><span className="font-mono text-[10px] uppercase text-ink-light">Extra free Skill Shots per pillar</span><input className="field-input py-1.5! text-sm" inputMode="numeric" onChange={(e) => setForm({ ...form, extraFree: e.target.value })} value={form.extraFree} /></label> : null}
        <label className="block text-xs"><span className="font-mono text-[10px] uppercase text-ink-light">Starts</span><input className="field-input py-1.5! text-sm" type="date" onChange={(e) => setForm({ ...form, startsAt: e.target.value })} value={form.startsAt} /></label>
        <label className="block text-xs"><span className="font-mono text-[10px] uppercase text-ink-light">Ends (not including)</span><input className="field-input py-1.5! text-sm" type="date" onChange={(e) => setForm({ ...form, endsAt: e.target.value })} value={form.endsAt} /></label>
        <label className="block text-xs"><span className="font-mono text-[10px] uppercase text-ink-light">Maximum uses (blank for no limit)</span><input className="field-input py-1.5! text-sm" inputMode="numeric" onChange={(e) => setForm({ ...form, maxRedemptions: e.target.value })} value={form.maxRedemptions} /></label>
        <div className="sm:col-span-2"><button className="primary-button" disabled={busy || form.name.trim().length < 3} onClick={() => void create()} type="button">Create as draft</button></div>
      </div>
      <ul className="mt-4 space-y-2">
        {(data?.campaigns ?? []).map((c) => (
          <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 border border-border bg-surface p-3 text-sm">
            <div><p className="font-semibold">{c.name} <span className="text-xs font-normal text-ink-light">{c.kind.replace("_", " ")}{c.code ? ` · ${c.code}` : ""}{c.kind === "discount" ? ` · ${c.percentOffBp / 100}% off` : ""}{c.kind === "free_access" ? ` · +${c.extraFreePerPillar} per pillar` : ""}</span></p>
              <p className="text-xs text-ink-light">{shortDate(c.startsAt)} to {shortDate(c.endsAt)} · {c.redemptions}{c.maxRedemptions ? ` of ${c.maxRedemptions}` : ""} used · {c.status}{c.live ? " (live now)" : ""}</p></div>
            <div className="flex gap-2">
              {c.status !== "active" && c.status !== "ended" ? <button className="primary-button" disabled={busy} onClick={() => void run(() => patch(`/api/contribute/admin/campaigns/${c.id}`, { status: "active" }))} type="button">Activate</button> : null}
              {c.status === "active" ? <button className="border border-border px-3 py-2" disabled={busy} onClick={() => void run(() => patch(`/api/contribute/admin/campaigns/${c.id}`, { status: "paused" }))} type="button">Pause</button> : null}
              {c.status !== "ended" ? <button className="border border-border px-3 py-2" disabled={busy} onClick={() => void run(() => patch(`/api/contribute/admin/campaigns/${c.id}`, { status: "ended" }))} type="button">End</button> : null}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
