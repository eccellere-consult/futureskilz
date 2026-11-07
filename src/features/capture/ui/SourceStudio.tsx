"use client";

import { FileText, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";

import { ATTESTATION_TEXT } from "../rights";

import { api, messageOf, post } from "./api";

type Result = { id: string; status: string; note: string | null; summary: string | null; factsAdded: number; duplicate: boolean };
type Added = { name: string; result: Result };

const OWNERSHIP = [
  ["mine", "I wrote it and own it"],
  ["permission", "I have permission to use it"],
  ["third_party", "It belongs to someone else (reference only; lessons must not copy it)"],
] as const;

/**
 * One page for "I already have something to teach from": name it, add one or more documents or pasted text, say whose
 * they are, tick the statement, then go on to review. Every point read from the material is confirmed by the person.
 */
export function SourceStudio({ existingProjectId }: { existingProjectId: string | null }) {
  const [projectId, setProjectId] = useState<string | null>(existingProjectId);
  const [title, setTitle] = useState("");
  const [aiOk, setAiOk] = useState(false);
  const [mode, setMode] = useState<"file" | "paste">("file");
  const [pasteTitle, setPasteTitle] = useState("");
  const [pasted, setPasted] = useState("");
  const [url, setUrl] = useState("");
  const [ownership, setOwnership] = useState("");
  const [attested, setAttested] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState<Added[]>([]);
  const fileInput = useRef<HTMLInputElement>(null);
  const folderInput = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<string | null>(null);

  async function start() {
    if (!aiOk) return setError("Please tick the box to let AI read your material.");
    setBusy(true);
    setError(null);
    try {
      const created = await post<{ projectId: string }>("/api/contribute/projects", { kind: "source", title: title || "My source material", consents: { ai_processing: true, content_generation: true, publication: true } });
      setProjectId(created.projectId);
    } catch (caught) {
      setError(messageOf(caught));
    } finally {
      setBusy(false);
    }
  }

  const SUPPORTED = [".pdf", ".docx", ".txt", ".md", ".csv", ".xlsx", ".xls"];
  const MAX_FILES = 100;

  async function add() {
    if (!projectId) return;
    if (!ownership) return setError("Say whether this material is yours, shared with permission, or belongs to someone else.");
    if (!attested) return setError("Please tick the box confirming you may use this material.");
    setBusy(true);
    setError(null);
    try {
      let result: Result;
      let name: string;
      if (mode === "file") {
        const chosen = [...(fileInput.current?.files ?? []), ...(folderInput.current?.files ?? [])];
        const supported = chosen.filter((file) => SUPPORTED.some((ext) => file.name.toLowerCase().endsWith(ext)));
        const skipped = chosen.length - supported.length;
        if (!supported.length) throw new Error(chosen.length ? "None of those files are a type I can read (PDF, Word, text, CSV or Excel)." : "Choose one or more files, or a folder, first.");
        const batch = supported.slice(0, MAX_FILES);
        const notes: string[] = [];
        if (skipped) notes.push(`${skipped} file${skipped === 1 ? "" : "s"} of another type ${skipped === 1 ? "was" : "were"} left out.`);
        if (supported.length > batch.length) notes.push(`Only the first ${MAX_FILES} files were added; add the rest in another round.`);
        for (const [index, file] of batch.entries()) {
          setProgress(`Reading file ${index + 1} of ${batch.length}: ${file.name}`);
          const label = (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name;
          try {
            const form = new FormData();
            form.set("file", file);
            form.set("ownership", ownership);
            form.set("attested", "true");
            const one = await api<Result>(`/api/contribute/projects/${projectId}/uploads`, { method: "POST", body: form });
            setAdded((list) => [...list, { name: label, result: one }]);
          } catch (caught) {
            setAdded((list) => [...list, { name: label, result: { id: "", status: "failed", note: messageOf(caught), summary: null, factsAdded: 0, duplicate: false } }]);
          }
        }
        if (fileInput.current) fileInput.current.value = "";
        if (folderInput.current) folderInput.current.value = "";
        setProgress(null);
        if (notes.length) setError(notes.join(" "));
        return;
      } else {
        result = await post<Result>(`/api/contribute/projects/${projectId}/paste`, { title: pasteTitle, text: pasted, url, ownership, attested: true });
        name = pasteTitle || "Pasted text";
        setPasted("");
        setUrl("");
        setPasteTitle("");
      }
      setAdded((list) => [...list, { name, result }]);
    } catch (caught) {
      setError(messageOf(caught));
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="font-display text-3xl">Start from a document or text</h1>
      <p className="mt-2 text-sm leading-6 text-ink-mid">Add a document or paste your notes. I read it, propose the points worth teaching with the exact words they came from, and you confirm, correct or reject each one. Nothing is shared until you approve it, and lessons are written in your own words, not copied.</p>

      {!projectId ? (
        <section aria-label="Start" className="mt-6 border border-border bg-surface p-4">
          <label className="block text-sm">
            <span className="font-mono text-[10px] uppercase text-ink-light">What is this about?</span>
            <input className="field-input mt-1" maxLength={200} onChange={(event) => setTitle(event.target.value)} placeholder="For example: Supplier audit checklist" value={title} />
          </label>
          <label className="mt-3 flex items-start gap-2 text-sm">
            <input checked={aiOk} className="mt-1" onChange={(event) => setAiOk(event.target.checked)} type="checkbox" />
            <span>I agree that AI may read my material and propose points for me to review.</span>
          </label>
          <button className="primary-button mt-4" disabled={busy} onClick={() => void start()} type="button">{busy ? "Starting…" : "Continue"}</button>
        </section>
      ) : (
        <section aria-label="Add material" className="mt-6 border border-border bg-surface p-4">
          <h2 className="flex items-center gap-2 font-display text-xl"><FileText aria-hidden="true" size={18} /> Add your material</h2>
          <div className="mt-3 flex gap-2 text-sm" role="tablist">
            {(["file", "paste"] as const).map((item) => (
              <button aria-selected={mode === item} className={`min-h-10 border px-3 ${mode === item ? "border-teal bg-teal/10" : "border-border"}`} key={item} onClick={() => setMode(item)} role="tab" type="button">{item === "file" ? "A document" : "Paste text"}</button>
            ))}
          </div>
          {mode === "file" ? (
            <div className="mt-3 grid gap-3 text-xs">
              <label className="block">
                <span className="font-mono text-[10px] uppercase text-ink-light">Files: PDF, Word, text, CSV or Excel, up to 25 MB each. Pick as many as you like.</span>
                <input accept=".pdf,.docx,.txt,.md,.csv,.xlsx,.xls" className="mt-1 block w-full text-sm" multiple ref={fileInput} type="file" />
              </label>
              <label className="block">
                <span className="font-mono text-[10px] uppercase text-ink-light">Or a whole folder (every readable file inside it, including sub-folders, up to 100 at a time)</span>
                <input className="mt-1 block w-full text-sm" ref={folderInput} type="file" {...({ webkitdirectory: "", directory: "", multiple: true } as object)} />
              </label>
            </div>
          ) : (
            <div className="mt-3 grid gap-3">
              <label className="block text-xs">
                <span className="font-mono text-[10px] uppercase text-ink-light">Title</span>
                <input className="field-input mt-1" maxLength={120} onChange={(event) => setPasteTitle(event.target.value)} value={pasteTitle} />
              </label>
              <label className="block text-xs">
                <span className="font-mono text-[10px] uppercase text-ink-light">Where it came from (optional web address, kept as a citation, not opened)</span>
                <input className="field-input mt-1" inputMode="url" onChange={(event) => setUrl(event.target.value)} placeholder="https://" value={url} />
              </label>
              <label className="block text-xs">
                <span className="font-mono text-[10px] uppercase text-ink-light">The text (at least 200 characters)</span>
                <textarea className="field-input mt-1 min-h-48" onChange={(event) => setPasted(event.target.value)} value={pasted} />
              </label>
            </div>
          )}
          <label className="mt-3 block text-xs">
            <span className="font-mono text-[10px] uppercase text-ink-light">Whose is it?</span>
            <select className="field-input mt-1 py-1.5! text-sm" onChange={(event) => setOwnership(event.target.value)} value={ownership}>
              <option value="">Choose…</option>
              {OWNERSHIP.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label className="mt-3 flex items-start gap-2 text-sm">
            <input checked={attested} className="mt-1" onChange={(event) => setAttested(event.target.checked)} type="checkbox" />
            <span><ShieldCheck aria-hidden="true" className="mr-1 inline" size={14} />{ATTESTATION_TEXT}</span>
          </label>
          <button className="primary-button mt-4" disabled={busy} onClick={() => void add()} type="button">{busy ? "Reading…" : mode === "file" ? "Read these files" : "Read this"}</button>
        </section>
      )}

      {progress ? <p className="mt-3 text-sm" role="status">{progress}</p> : null}
      {error ? <p className="mt-3 text-sm text-crimson" role="alert">{error}</p> : null}
      {added.length ? (
        <ul aria-label="Added so far" className="mt-4 grid gap-2">
          {added.map((item, index) => (
            <li className="border-l-2 border-teal pl-3 text-sm" key={index} role="status">
              <strong>{item.name}</strong>: {item.result.duplicate ? "you already added this." : item.result.summary ?? item.result.note ?? "Added."}
            </li>
          ))}
        </ul>
      ) : null}
      {projectId && added.length ? (
        <p className="mt-6">
          <Link className="primary-button" href={`/contribute/${projectId}/review`}>Review what I found</Link>
        </p>
      ) : null}
      <p className="mt-6 text-xs text-ink-light">The checks for copied passages and unsafe advice are automatic and can miss things. They are not legal advice, and an editor still reads every lesson.</p>
    </div>
  );
}
