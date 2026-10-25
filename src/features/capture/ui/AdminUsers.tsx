"use client";

import Link from "next/link";
import { useState } from "react";

import type { CreatedUser, ManagedUser } from "@/server/auth/user-admin-service";

import { messageOf, post, shortDate, useRemote } from "./api";

const ROLES = [["learner", "Learner"], ["contributor", "Coach"], ["editor", "Editor"], ["admin", "Admin"]] as const;
const PRESETS: Array<{ label: string; email: string; name: string; roles: string[] }> = [
  { label: "Learner", email: "test.learner@", name: "Test Learner", roles: ["learner"] },
  { label: "Coach", email: "test.coach@", name: "Test Coach", roles: ["learner", "contributor"] },
  { label: "Editor", email: "test.editor@", name: "Test Editor", roles: ["learner", "editor"] },
  { label: "Admin", email: "test.admin@", name: "Test Admin", roles: ["learner", "admin"] },
];

/** Admins create real accounts for each role, with a password shown once, and manage them afterwards. */
export function AdminUsers() {
  const [query, setQuery] = useState("");
  const list = useRemote<{ users: ManagedUser[] }>(`/api/contribute/admin/users?q=${encodeURIComponent(query)}`);
  const [form, setForm] = useState({ email: "", name: "", password: "", roles: ["learner"] as string[] });
  const [created, setCreated] = useState<Array<CreatedUser & { name: string }>>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (work: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await work();
      list.reload();
    } catch (caught) {
      setError(messageOf(caught));
    } finally {
      setBusy(false);
    }
  };

  const create = () =>
    run(async () => {
      const result = await post<{ created: CreatedUser }>("/api/contribute/admin/users", { email: form.email, name: form.name, password: form.password || undefined, roles: form.roles });
      setCreated((current) => [{ ...result.created, name: form.name || result.created.email }, ...current]);
      setForm({ email: "", name: "", password: "", roles: ["learner"] });
    });

  const toggle = (role: string) => setForm((f) => ({ ...f, roles: f.roles.includes(role) ? f.roles.filter((r) => r !== role) : [...f.roles, role] }));

  return (
    <div className="mx-auto w-full max-w-6xl px-5 py-8 sm:px-8 lg:py-12">
      <Link className="text-sm text-teal underline underline-offset-4" href="/contribute/admin">Earnings administration</Link>
      <p className="mt-3 font-mono text-[10px] uppercase text-ink-light">Admin · accounts</p>
      <h1 className="mt-1 font-display text-4xl font-semibold sm:text-5xl">People and passwords</h1>
      <p className="mt-2 max-w-3xl text-ink-mid">Create real accounts with a role and a password, for testing or for staff. Most people sign in with an emailed link and never need a password. A password is shown once when it is set; only a salted hash is kept.</p>
      {error ? <p className="mt-3 border-l-2 border-crimson bg-crimson/5 px-4 py-2 text-sm text-crimson" role="alert">{error}</p> : null}
      {list.error ? <p className="mt-3 text-sm text-crimson" role="alert">{list.error}</p> : null}

      {created.length ? (
        <section className="mt-6 border-l-2 border-gold bg-gold-pale p-4" aria-label="New credentials" role="status">
          <p className="font-semibold">Copy these now. They will not be shown again.</p>
          <ul className="mt-2 space-y-1 font-mono text-sm">
            {created.map((c) => <li key={c.id}>{c.name} · {c.email} · <span className="select-all font-semibold">{c.password}</span> · {c.roles.filter((r) => r !== "learner").join(", ") || "learner"}</li>)}
          </ul>
          <button className="mt-3 text-sm underline underline-offset-4" onClick={() => setCreated([])} type="button">I have saved them</button>
        </section>
      ) : null}

      <section className="mt-8 border border-ink bg-surface p-5" aria-label="Create an account">
        <h2 className="font-display text-2xl">Create an account</h2>
        <div className="mt-2 flex flex-wrap gap-2 text-xs">
          <span className="text-ink-light">Quick start:</span>
          {PRESETS.map((preset) => <button key={preset.label} className="border border-border px-2 py-1" onClick={() => setForm({ email: preset.email, name: preset.name, password: "", roles: preset.roles })} type="button">{preset.label}</button>)}
        </div>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <label className="block text-sm"><span className="font-mono text-[10px] uppercase text-ink-light">Email (use a real address you can read, or your own domain)</span><input className="field-input" inputMode="email" onChange={(e) => setForm({ ...form, email: e.target.value })} type="email" value={form.email} /></label>
          <label className="block text-sm"><span className="font-mono text-[10px] uppercase text-ink-light">Name</span><input className="field-input" onChange={(e) => setForm({ ...form, name: e.target.value })} value={form.name} /></label>
          <label className="block text-sm sm:col-span-2"><span className="font-mono text-[10px] uppercase text-ink-light">Password (leave empty to generate a strong one)</span><input autoComplete="new-password" className="field-input" onChange={(e) => setForm({ ...form, password: e.target.value })} type="text" value={form.password} /></label>
        </div>
        <fieldset className="mt-3 flex flex-wrap gap-4 text-sm"><legend className="mb-1 font-mono text-[10px] uppercase text-ink-light">Roles</legend>
          {ROLES.map(([id, label]) => <label key={id} className="flex items-center gap-1.5"><input checked={form.roles.includes(id)} disabled={id === "learner"} onChange={() => toggle(id)} type="checkbox" /> {label}</label>)}
        </fieldset>
        <button className="primary-button mt-4" disabled={busy || !form.email.includes("@")} onClick={() => void create()} type="button">{busy ? "Creating…" : "Create account"}</button>
      </section>

      <section className="mt-10" aria-label="Accounts">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="font-display text-2xl">Accounts</h2>
          <input aria-label="Search accounts" className="field-input max-w-xs py-1.5! text-sm" onChange={(e) => setQuery(e.target.value)} placeholder="Search by email or name" value={query} />
        </div>
        <div className="mt-3 overflow-x-auto border border-border bg-surface">
          <table className="w-full min-w-170 text-left text-sm">
            <thead className="border-b border-border font-mono text-[10px] uppercase text-ink-light"><tr><th className="p-3">Person</th><th className="p-3">Roles</th><th className="p-3">Password</th><th className="p-3">Status</th><th className="p-3">Actions</th></tr></thead>
            <tbody>
              {(list.data?.users ?? []).map((u) => (
                <tr key={u.id} className="border-b border-border last:border-0 align-top">
                  <td className="p-3"><span className="font-semibold">{u.name}</span><span className="block text-xs text-ink-light">{u.email} · {shortDate(u.createdAt)}</span></td>
                  <td className="p-3">{u.roles.filter((r) => r !== "learner").join(", ") || "learner"}</td>
                  <td className="p-3">{u.hasPassword ? (u.locked ? "Locked" : "Set") : "None (emailed link)"}</td>
                  <td className="p-3">{u.status}</td>
                  <td className="space-x-3 p-3 text-xs">
                    <button className="text-teal underline underline-offset-4" disabled={busy} onClick={() => void run(async () => { const r = await post<{ password: string }>(`/api/contribute/admin/users/${u.id}`, { action: "reset_password" }); setCreated((c) => [{ id: u.id, email: u.email, name: u.name, roles: u.roles, password: r.password }, ...c]); })} type="button">{u.hasPassword ? "Reset password" : "Set a password"}</button>
                    {u.status === "suspended"
                      ? <button className="text-teal underline underline-offset-4" disabled={busy} onClick={() => void run(async () => { await post(`/api/contribute/admin/users/${u.id}`, { action: "activate" }); })} type="button">Reactivate</button>
                      : <button className="text-crimson underline underline-offset-4" disabled={busy} onClick={() => void run(async () => { await post(`/api/contribute/admin/users/${u.id}`, { action: "suspend" }); })} type="button">Suspend</button>}
                    <select aria-label={`Roles for ${u.email}`} className="border border-border bg-cream px-1 py-0.5" disabled={busy} onChange={(e) => { const v = e.target.value; if (v) void run(async () => { await post(`/api/contribute/admin/users/${u.id}`, { action: "set_roles", roles: v.split(",") }); }); }} value="">
                      <option value="">Change roles…</option><option value="learner">Learner only</option><option value="learner,contributor">Learner + Coach</option><option value="learner,editor">Learner + Editor</option><option value="learner,contributor,editor">Coach + Editor</option><option value="learner,admin">Admin</option>
                    </select>
                  </td>
                </tr>
              ))}
              {list.data && list.data.users.length === 0 ? <tr><td className="p-3 text-ink-light" colSpan={5}>No accounts match.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
