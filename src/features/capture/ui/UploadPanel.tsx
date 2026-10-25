"use client";

import { FileUp } from "lucide-react";
import { useRef, useState } from "react";

import type { InterviewView } from "@/server/capture/interview-service";

import { api, messageOf } from "./api";

type Result = { id: string; status: string; note: string | null; summary: string | null; factsAdded: number; rolesFound: number; duplicate: boolean };

/** Adds a document as evidence. The contributor says whether it is theirs to share before anything is used from it. */
export function UploadPanel({ projectId, roles, onDone }: { projectId: string; roles: InterviewView["roles"]; onDone: () => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [ownership, setOwnership] = useState("");
  const [roleId, setRoleId] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function upload() {
    const file = input.current?.files?.[0];
    if (!file) return setError("Choose a file first.");
    if (!ownership) return setError("Tell me whether this file is yours to share.");
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const form = new FormData();
      form.set("file", file);
      form.set("ownership", ownership);
      if (roleId) form.set("roleId", roleId);
      const outcome = await api<Result>(`/api/contribute/projects/${projectId}/uploads`, { method: "POST", body: form });
      setResult(outcome);
      if (input.current) input.current.value = "";
      onDone();
    } catch (caught) {
      setError(messageOf(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-label="Upload material" className="border border-border bg-surface p-4">
      <h2 className="flex items-center gap-2 font-display text-xl"><FileUp aria-hidden="true" size={18} /> Add something you already have</h2>
      <p className="mt-1 text-xs leading-5 text-ink-mid">A CV, process note, slide deck, spreadsheet or template. I read the text, keep the page or sheet it came from, and suggest facts for you to confirm. I treat it as information to read, never as instructions.</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="block text-xs">
          <span className="font-mono text-[10px] uppercase text-ink-light">File (PDF, Word, text, CSV or Excel, up to 5 MB)</span>
          <input accept=".pdf,.docx,.txt,.md,.csv,.xlsx,.xls" className="mt-1 block w-full text-sm" ref={input} type="file" />
        </label>
        <label className="block text-xs">
          <span className="font-mono text-[10px] uppercase text-ink-light">Is it yours to share?</span>
          <select className="field-input mt-1 py-1.5! text-sm" onChange={(event) => setOwnership(event.target.value)} value={ownership}>
            <option value="">Choose…</option>
            <option value="mine">I wrote it and own it</option>
            <option value="permission">I have permission to share it</option>
            <option value="third_party">It belongs to someone else (keep for reference only)</option>
          </select>
        </label>
        {roles.length ? (
          <label className="block text-xs">
            <span className="font-mono text-[10px] uppercase text-ink-light">Which job does it relate to? (optional)</span>
            <select className="field-input mt-1 py-1.5! text-sm" onChange={(event) => setRoleId(event.target.value)} value={roleId}>
              <option value="">Not specific</option>
              {roles.map((role) => <option key={role.id} value={role.id}>{[role.title, role.company].filter(Boolean).join(" at ") || "Unnamed job"}</option>)}
            </select>
          </label>
        ) : null}
      </div>
      <button className="primary-button mt-3" disabled={busy} onClick={() => void upload()} type="button">{busy ? "Reading…" : "Add this file"}</button>
      {error ? <p className="mt-2 text-sm text-crimson" role="alert">{error}</p> : null}
      {result ? (
        <p className="mt-3 border-l-2 border-teal pl-3 text-sm" role="status">
          {result.duplicate ? "You already added this file." : result.summary ?? result.note ?? "Added."}
          {result.status === "unsupported" || result.status === "failed" ? ` ${result.note ?? ""}` : ""}
        </p>
      ) : null}
    </section>
  );
}
