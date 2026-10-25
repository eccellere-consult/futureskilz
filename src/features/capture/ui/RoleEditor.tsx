"use client";

import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";

import type { InterviewView } from "@/server/capture/interview-service";

import { api, messageOf, post } from "./api";

type Role = InterviewView["roles"][number];
type Flag = InterviewView["timeline"]["flags"][number];

type Draft = { id?: string; company: string; title: string; industry: string; startYear: string; endYear: string; ongoing: boolean; datesApproximate: boolean };

const toDraft = (role: Role): Draft => ({
  id: role.id,
  company: role.company,
  title: role.title,
  industry: role.industry,
  startYear: role.startYear?.toString() ?? "",
  endYear: role.endYear?.toString() ?? "",
  ongoing: role.ongoing,
  datesApproximate: role.datesApproximate,
});

const blank = (): Draft => ({ company: "", title: "", industry: "", startYear: "", endYear: "", ongoing: false, datesApproximate: false });

/** The draft timeline drawn from the career walk-through. The contributor fixes it once, before any deep dive. */
export function RoleEditor({ projectId, roles, flags, busy, onChange, onConfirm }: { projectId: string; roles: Role[]; flags: Flag[]; busy: boolean; onChange: (view: InterviewView) => void; onConfirm: () => void }) {
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [adding, setAdding] = useState<Draft | null>(null);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(draft: Draft) {
    setWorking(true);
    setError(null);
    try {
      const view = await post<InterviewView>(`/api/contribute/projects/${projectId}/roles`, {
        id: draft.id,
        company: draft.company,
        title: draft.title,
        industry: draft.industry,
        startYear: draft.startYear ? Number(draft.startYear) : null,
        endYear: draft.endYear ? Number(draft.endYear) : null,
        ongoing: draft.ongoing,
        datesApproximate: draft.datesApproximate,
      });
      onChange(view);
      if (draft.id) setDrafts((current) => { const next = { ...current }; delete next[draft.id!]; return next; });
      else setAdding(null);
    } catch (caught) {
      setError(messageOf(caught));
    } finally {
      setWorking(false);
    }
  }

  async function remove(roleId: string) {
    setWorking(true);
    setError(null);
    try {
      onChange(await api<InterviewView>(`/api/contribute/projects/${projectId}/roles?roleId=${roleId}`, { method: "DELETE" }));
    } catch (caught) {
      setError(messageOf(caught));
    } finally {
      setWorking(false);
    }
  }

  const rows = roles.map((role) => drafts[role.id] ?? toDraft(role));
  const dirty = Object.keys(drafts).length > 0 || !!adding;

  const field = (draft: Draft, key: keyof Draft, label: string, width = "") => (
    <label className={`block ${width}`}>
      <span className="font-mono text-[10px] uppercase text-ink-light">{label}</span>
      <input
        className="field-input py-1.5! text-sm"
        inputMode={key === "startYear" || key === "endYear" ? "numeric" : undefined}
        onChange={(event) => {
          const next = { ...draft, [key]: event.target.value } as Draft;
          if (draft.id) setDrafts((current) => ({ ...current, [draft.id!]: next }));
          else setAdding(next);
        }}
        value={String(draft[key] ?? "")}
      />
    </label>
  );

  const editRow = (draft: Draft, key: string) => (
    <li key={key} className="space-y-2 p-3">
      <div className="grid gap-3 sm:grid-cols-2">{field(draft, "title", "Title")}{field(draft, "company", "Employer")}</div>
      <div className="flex flex-wrap items-end gap-3">
        {field(draft, "startYear", "From (year)", "w-24")}
        {field(draft, "endYear", "To (year)", "w-24")}
        <label className="flex items-center gap-1.5 text-xs"><input checked={draft.ongoing} onChange={(event) => { const next = { ...draft, ongoing: event.target.checked }; if (draft.id) setDrafts((c) => ({ ...c, [draft.id!]: next })); else setAdding(next); }} type="checkbox" /> Still there</label>
        <label className="flex items-center gap-1.5 text-xs"><input checked={draft.datesApproximate} onChange={(event) => { const next = { ...draft, datesApproximate: event.target.checked }; if (draft.id) setDrafts((c) => ({ ...c, [draft.id!]: next })); else setAdding(next); }} type="checkbox" /> Dates are approximate</label>
        {draft.id && drafts[draft.id] ? <button className="text-xs font-semibold text-teal underline underline-offset-4" disabled={working} onClick={() => void save(draft)} type="button">Save change</button> : null}
        {!draft.id ? <button className="primary-button min-h-9! px-3! py-1.5! text-xs" disabled={working || (!draft.title && !draft.company)} onClick={() => void save(draft)} type="button">Add this job</button> : null}
        {draft.id ? <button aria-label={`Remove ${draft.title || "this job"}`} className="ml-auto text-ink-light hover:text-crimson" disabled={working} onClick={() => void remove(draft.id!)} title="Remove (only possible before answers are attached)" type="button"><Trash2 aria-hidden="true" size={16} /></button> : null}
      </div>
    </li>
  );

  return (
    <div>
      <h2 className="font-display text-2xl">Is this your career?</h2>
      <p className="mt-1 text-sm text-ink-mid">I drew this from what you told me. Approximate years are fine. Fix anything that is off and add what is missing.</p>
      {rows.length === 0 ? <p className="mt-3 text-sm text-ink-light">No jobs yet. Add each one below.</p> : null}
      <ul className="mt-3 divide-y divide-border border border-border">{rows.map((draft, index) => editRow(draft, draft.id ?? String(index)))}{adding ? editRow(adding, "new") : null}</ul>
      {flags.filter((flag) => flag.severity !== "approximate").length ? (
        <ul className="mt-3 space-y-1 border-l-2 border-gold pl-3 text-xs text-ink-mid" aria-label="Things to check">
          {flags.filter((flag) => flag.severity !== "approximate").map((flag, index) => <li key={index}>⚠ {flag.message}</li>)}
        </ul>
      ) : null}
      {error ? <p className="mt-2 text-sm text-crimson" role="alert">{error}</p> : null}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button className="inline-flex min-h-10 items-center gap-2 border border-ink px-3 text-sm" disabled={working || !!adding} onClick={() => setAdding(blank())} type="button"><Plus aria-hidden="true" size={16} /> Add a job</button>
        <button className="primary-button" disabled={busy || working || dirty || roles.some((role) => !role.title && !role.company)} onClick={onConfirm} type="button">
          {roles.length ? "This looks right" : "I have no jobs to add"}
        </button>
        {dirty ? <span className="text-xs text-ink-light">Save your changes first.</span> : null}
      </div>
    </div>
  );
}
