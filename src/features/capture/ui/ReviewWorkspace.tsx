"use client";

import { CreateFromInterview } from "@/features/book/ui/BookWorkspace";
import { AlertTriangle, CheckCircle2, ChevronDown, Download, FileText, Quote, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useCallback, useMemo, useState } from "react";

import type { ReviewFact, ReviewView } from "@/server/capture/review-service";

import { CONSENT_LABELS, type ConsentPurpose, type Gate } from "../gates";
import { SECTIONS } from "../knowledge-package";

import { ApiError, messageOf, patch, post, put, shortDate, useRemote } from "./api";

const KIND_LABEL: Record<string, string> = {
  direct_statement: "Your words",
  source_fact: "From your document",
  ai_synthesis: "AI interpretation: please check",
  editorial: "Editor's note",
};

const STATUS_LABEL: Record<string, { text: string; tone: string }> = {
  proposed: { text: "Not yet reviewed", tone: "border-border text-ink-mid" },
  needs_confirmation: { text: "Needs your confirmation", tone: "border-gold text-ink" },
  confirmed: { text: "Confirmed", tone: "border-teal bg-teal/10 text-teal" },
  corrected: { text: "Corrected by you", tone: "border-teal bg-teal/10 text-teal" },
  rejected: { text: "Rejected", tone: "border-crimson/40 text-crimson" },
};

const DETAIL_FIELDS: Record<string, string[]> = {
  kpi: ["definition", "baseline", "target", "period", "result"],
  tool: ["usage"],
};

type Filter = "attention" | "all" | "confirmed" | "sensitive";

export function ReviewWorkspace({ projectId }: { projectId: string }) {
  const { data, error, setError, reload: load } = useRemote<ReviewView>(`/api/contribute/projects/${projectId}/review`);
  const [notice, setNotice] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("attention");
  const [busy, setBusy] = useState(false);
  const [blocked, setBlocked] = useState<Gate[] | null>(null);

  const run = useCallback(
    async (work: () => Promise<unknown>, done?: string) => {
      setBusy(true);
      setError(null);
      setNotice(null);
      try {
        await work();
        if (done) setNotice(done);
        load();
      } catch (caught) {
        if (caught instanceof ApiError && Array.isArray(caught.body.gates)) setBlocked(caught.body.gates as Gate[]);
        setError(messageOf(caught));
      } finally {
        setBusy(false);
      }
    },
    [load, setError],
  );

  const visible = useMemo(() => {
    if (!data) return [];
    return data.facts.filter((fact) => {
      if (fact.reviewStatus === "rejected") return filter === "all";
      if (filter === "attention") return fact.reviewStatus === "proposed" || fact.reviewStatus === "needs_confirmation";
      if (filter === "confirmed") return fact.reviewStatus === "confirmed" || fact.reviewStatus === "corrected";
      if (filter === "sensitive") return fact.sensitivity !== "none";
      return true;
    });
  }, [data, filter]);

  if (!data) {
    return <div className="mx-auto max-w-3xl px-5 py-16 sm:px-8" role="status">{error ? <p className="text-crimson">{error}</p> : <p className="text-ink-light">Loading your review…</p>}</div>;
  }

  const gates = (blocked ?? data.gates).filter((gate) => gate.id !== "approval");
  const blockers = gates.filter((gate) => gate.blocking && !gate.passed);
  const approved = data.documents.find((doc) => doc.kind === "skill_md" && doc.status === "approved");
  const withdrawn = data.project.status === "withdrawn";

  return (
    <div className="mx-auto w-full max-w-6xl px-5 py-8 sm:px-8 lg:py-12">
      <p className="font-mono text-[10px] uppercase text-ink-light">Your review · {data.project.title}</p>
      <h1 className="mt-1 font-display text-4xl font-semibold sm:text-5xl">Check what I heard</h1>
      <p className="mt-3 max-w-3xl text-lg leading-8 text-ink-mid">
        Everything below comes from your own words or your documents. Confirm what is right, correct what is off, reject what you did not mean. Only what you confirm and allow can ever become a lesson.
      </p>

      {error ? <p className="mt-4 border-l-2 border-crimson bg-crimson/5 px-4 py-2 text-sm text-crimson" role="alert">{error}</p> : null}
      {notice ? <p className="mt-4 border-l-2 border-teal bg-teal/5 px-4 py-2 text-sm" role="status">{notice}</p> : null}
      {withdrawn ? <p className="mt-4 border-l-2 border-crimson px-4 py-2 text-sm">This interview was withdrawn. Its lessons were retired.</p> : null}
      {data.changedSinceApproval ? (
        <p className="mt-4 flex gap-2 border-l-2 border-gold bg-gold-pale px-4 py-2 text-sm" role="status">
          <AlertTriangle aria-hidden="true" className="mt-0.5 shrink-0" size={16} /> You changed statements after approving. Approve again when you are happy; lessons are only built from an approved version.
        </p>
      ) : null}

      {!withdrawn ? (
        <section aria-label="Create from this interview" className="mt-8">
          {approved && !data.changedSinceApproval ? <CreateFromInterview projectId={projectId} /> : <p className="border border-border bg-surface p-4 text-sm text-ink-mid">When you have checked everything below and approved it, Arya can turn it into training lessons and a book, whenever you ask.</p>}
        </section>
      ) : null}

      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-8">
          {/* Statements */}
          <section aria-label="Statements">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-display text-2xl">Statements ({data.stats.confirmed} confirmed of {data.stats.total - data.stats.rejected})</h2>
              <div className="flex flex-wrap gap-1.5 text-xs" role="tablist" aria-label="Filter statements">
                {([["attention", `Needs me (${data.stats.needsAttention})`], ["confirmed", "Confirmed"], ["sensitive", "Sensitive"], ["all", "All"]] as Array<[Filter, string]>).map(([id, label]) => (
                  <button key={id} aria-selected={filter === id} className={`border px-3 py-1.5 ${filter === id ? "border-ink bg-ink text-cream" : "border-border"}`} onClick={() => setFilter(id)} role="tab" type="button">{label}</button>
                ))}
              </div>
            </div>
            {data.stats.needsAttention > 0 ? (
              <button className="mt-3 inline-flex min-h-10 items-center gap-2 border border-teal px-3 text-sm text-teal" disabled={busy} onClick={() => void run(async () => { const result = await post<{ confirmed: number; skipped: number }>(`/api/contribute/projects/${projectId}/facts`); setNotice(`Confirmed ${result.confirmed} plain statements. ${result.skipped ? `${result.skipped} need your own decision (sensitive or AI-interpreted).` : ""}`); })} type="button">
                <CheckCircle2 aria-hidden="true" size={16} /> Confirm every plain statement at once
              </button>
            ) : null}

            {visible.length === 0 ? <p className="mt-6 text-sm text-ink-light">Nothing here. {filter === "attention" ? "You have reviewed everything." : "Try another filter."}</p> : null}
            {SECTIONS.map((section) => {
              const items = visible.filter((fact) => fact.section === section.id);
              if (items.length === 0) return null;
              return (
                <details key={section.id} className="mt-4 border-t border-border pt-3" open={items.length <= 6}>
                  <summary className="cursor-pointer font-mono text-[11px] uppercase text-ink-mid">{section.number}. {section.title} ({items.length})</summary>
                  <ul className="mt-2 space-y-3">
                    {items.slice(0, 15).map((fact) => (
                      <FactCard key={`${fact.id}-${fact.version}`} busy={busy} fact={fact} onPatch={(body, done) => run(() => patch(`/api/contribute/projects/${projectId}/facts/${fact.id}`, body), done)} />
                    ))}
                  </ul>
                  {items.length > 15 ? <p className="mt-2 text-xs text-ink-light">Showing the first 15 of {items.length}. Review these, and the rest appear.</p> : null}
                </details>
              );
            })}
          </section>

          {/* Timeline */}
          <section aria-label="Career timeline">
            <h2 className="font-display text-2xl">Your career timeline</h2>
            <div className="mt-3 overflow-x-auto border border-border bg-surface">
              <table className="w-full min-w-120 text-left text-sm">
                <thead className="border-b border-border font-mono text-[10px] uppercase text-ink-light"><tr><th className="p-3">Years</th><th className="p-3">Title</th><th className="p-3">Employer</th><th className="p-3">Confirmed</th></tr></thead>
                <tbody>
                  {data.roles.map((role) => (
                    <tr key={role.id} className="border-b border-border last:border-0">
                      <td className="p-3">{role.datesApproximate ? "c. " : ""}{role.startYear ?? "?"}–{role.ongoing ? "present" : (role.endYear ?? "?")}</td>
                      <td className="p-3 font-semibold">{role.title || "—"}</td>
                      <td className="p-3">{role.company || "—"}</td>
                      <td className="p-3">{role.confirmed ? "Yes" : "Not yet"}</td>
                    </tr>
                  ))}
                  {data.roles.length === 0 ? <tr><td className="p-3 text-ink-light" colSpan={4}>No jobs recorded.</td></tr> : null}
                </tbody>
              </table>
            </div>
            {data.timeline.flags.length ? (
              <ul className="mt-3 space-y-1 border-l-2 border-gold pl-3 text-sm text-ink-mid">
                {data.timeline.flags.map((flag, index) => <li key={index}>{flag.severity === "approximate" ? "≈" : "⚠"} {flag.message}</li>)}
              </ul>
            ) : <p className="mt-3 text-sm text-ink-light">No date conflicts found.</p>}
            <Link className="mt-3 inline-block text-sm text-teal underline underline-offset-4" href={`/contribute/${projectId}`}>Add or correct a job in the conversation</Link>
          </section>
        </div>

        {/* Publication panel */}
        <aside className="space-y-6 lg:sticky lg:top-4 lg:self-start" aria-label="Publication">
          <section className="border border-ink bg-surface p-4">
            <h2 className="flex items-center gap-2 font-display text-xl"><ShieldCheck aria-hidden="true" size={18} /> Before anything is published</h2>
            <ul className="mt-3 space-y-2 text-sm">
              {gates.map((gate) => (
                <li key={gate.id} className="flex gap-2">
                  <span aria-hidden="true" className={gate.passed ? "text-teal" : gate.blocking ? "text-crimson" : "text-gold"}>{gate.passed ? "✓" : gate.blocking ? "✕" : "•"}</span>
                  <span><span className="font-semibold">{gate.label}.</span> <span className="text-ink-mid">{gate.detail}</span></span>
                </li>
              ))}
            </ul>

            <fieldset className="mt-4 border-t border-border pt-3">
              <legend className="font-mono text-[10px] uppercase text-ink-light">My consent</legend>
              {(["content_generation", "publication"] as ConsentPurpose[]).map((purpose) => (
                <label key={purpose} className="flex items-start gap-2 py-1.5 text-xs">
                  <input checked={!!data.consents[purpose]} className="mt-0.5" disabled={busy} onChange={(event) => void run(() => put("/api/contribute/consents", { projectId, consents: { [purpose]: event.target.checked } }))} type="checkbox" />
                  <span>{CONSENT_LABELS[purpose]}</span>
                </label>
              ))}
            </fieldset>

            <button className="primary-button mt-4 w-full" disabled={busy || withdrawn} onClick={() => void run(async () => { setBlocked(null); await post(`/api/contribute/projects/${projectId}/approve`); }, "Approved. Editors can now turn this into lessons, and you will approve each lesson before it is published.")} type="button">
              Approve for publication
            </button>
            {blockers.length ? <p className="mt-2 text-xs text-crimson">{blockers.length} thing{blockers.length === 1 ? "" : "s"} to settle first. Approval will tell you exactly what.</p> : <p className="mt-2 text-xs text-teal">Ready to approve.</p>}
            {approved ? <p className="mt-2 text-xs text-ink-mid">Approved version {approved.version} on {shortDate(approved.approvedAt)}.{data.lessonsCount ? ` ${data.lessonsCount} lesson${data.lessonsCount === 1 ? "" : "s"} drafted.` : ""}</p> : null}
          </section>

          <section className="border border-border bg-surface p-4 text-sm" aria-label="Documents">
            <h2 className="flex items-center gap-2 font-display text-xl"><FileText aria-hidden="true" size={18} /> Documents</h2>
            <button className="mt-3 inline-flex min-h-10 items-center border border-ink px-3 text-sm font-semibold" disabled={busy} onClick={() => void run(() => post(`/api/contribute/projects/${projectId}/documents`), "A fresh draft was generated.")} type="button">Refresh my draft skill.md</button>
            <ul className="mt-3 space-y-1.5 text-xs">
              {[
                ["skill_md", "Draft skill.md (readable Markdown)"],
                ["follow_up_questions", "What is still missing (follow-up questions)"],
                ["source_map", "Source map (every claim to its source, CSV)"],
                ["knowledge_package", "Structured knowledge package (JSON)"],
              ].map(([kind, label]) => (
                <li key={kind}><a className="inline-flex items-center gap-1.5 text-teal underline underline-offset-4" href={`/api/contribute/projects/${projectId}/documents/${kind}`}><Download aria-hidden="true" size={13} /> {label}</a></li>
              ))}
              {approved ? <li><a className="inline-flex items-center gap-1.5 text-teal underline underline-offset-4" href={`/api/contribute/projects/${projectId}/documents/skill_md?approved=1`}><Download aria-hidden="true" size={13} /> Approved skill.md (what lessons are built from)</a></li> : null}
              <li><a className="inline-flex items-center gap-1.5 text-teal underline underline-offset-4" href={`/api/contribute/projects/${projectId}/transcript`}><Download aria-hidden="true" size={13} /> Full transcript (.txt)</a></li>
            </ul>
            {data.documents.length ? (
              <details className="mt-3 text-xs"><summary className="cursor-pointer text-ink-light">Version history</summary>
                <ul className="mt-2 space-y-1">{data.documents.filter((doc) => doc.kind === "skill_md").map((doc) => <li key={doc.id}>v{doc.version} · {doc.mode} · {doc.status}{doc.stale ? " · out of date" : ""} · {shortDate(doc.createdAt)}</li>)}</ul>
              </details>
            ) : null}
          </section>

          <section className="border border-border bg-surface p-4 text-sm" aria-label="Uploads">
            <h2 className="font-display text-xl">Your documents</h2>
            {data.uploads.length === 0 ? <p className="mt-2 text-xs text-ink-light">None added. You can upload one in the conversation.</p> : null}
            <ul className="mt-2 space-y-2 text-xs">
              {data.uploads.map((upload) => (
                <li key={upload.id}>
                  <p className="font-semibold">{upload.filename}</p>
                  <p className="text-ink-light">{upload.extractionStatus}{upload.note ? ` · ${upload.note}` : ""}</p>
                  {upload.summary ? <p className="text-ink-mid">{upload.summary}</p> : null}
                  <label className="mt-1 block">Rights:{" "}
                    <select className="border border-border bg-cream px-1 py-0.5" disabled={busy} onChange={(event) => void run(() => patch(`/api/contribute/projects/${projectId}/uploads`, { uploadId: upload.id, ownership: event.target.value }))} value={upload.ownership}>
                      <option value="unknown">Not confirmed</option><option value="mine">Mine</option><option value="permission">I have permission</option><option value="third_party">Someone else&apos;s</option>
                    </select>
                  </label>
                </li>
              ))}
            </ul>
          </section>

          {!withdrawn ? (
            <button className="text-xs text-ink-light underline underline-offset-4" disabled={busy} onClick={() => { const reason = window.prompt("Withdraw everything and retire your lessons? Tell us why (optional), then press OK."); if (reason !== null) void run(() => post(`/api/contribute/projects/${projectId}/withdraw`, { reason }), "Withdrawn. Your lessons were retired.") }} type="button">Withdraw my knowledge and retire my lessons</button>
          ) : null}
        </aside>
      </div>
    </div>
  );
}

function FactCard({ fact, busy, onPatch }: { fact: ReviewFact; busy: boolean; onPatch: (body: Record<string, unknown>, done?: string) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"correct" | "details" | null>(null);
  const [text, setText] = useState(fact.statement);
  const [permission, setPermission] = useState<string>(fact.permission !== "unset" ? fact.permission : fact.sensitivity === "none" ? "public" : "");
  const [anonymous, setAnonymous] = useState(fact.anonymizedStatement ?? "");
  const detailKeys = DETAIL_FIELDS[fact.category]?.filter((key) => fact.details && key in fact.details) ?? [];
  const [details, setDetails] = useState<Record<string, string>>(Object.fromEntries(detailKeys.map((key) => [key, String(fact.details?.[key] ?? "")])));
  const status = STATUS_LABEL[fact.reviewStatus];
  const rejected = fact.reviewStatus === "rejected";
  const sharing = { permission: permission || undefined, anonymizedStatement: permission === "anonymize" ? anonymous : undefined };

  return (
    <li className={`border bg-surface p-4 ${rejected ? "border-border opacity-60" : "border-border"}`}>
      <div className="flex flex-wrap items-center gap-2 text-[11px]">
        <span className={`border px-2 py-0.5 ${status.tone}`}>{status.text}</span>
        <span className="border border-border px-2 py-0.5 text-ink-mid">{KIND_LABEL[fact.kind]}</span>
        {fact.confidence === "low" ? <span className="border border-border px-2 py-0.5 text-ink-mid">Low confidence</span> : null}
        {fact.sensitivity !== "none" ? <span className="border border-gold px-2 py-0.5">May be sensitive</span> : null}
        {fact.machineExtracted && fact.kind !== "direct_statement" ? <span className="text-ink-light">suggested by the system</span> : null}
      </div>
      <p className="mt-2 font-semibold">{fact.title}</p>
      <p className="mt-1 whitespace-pre-line text-sm leading-6">{fact.statement.length > 700 && !open ? `${fact.statement.slice(0, 700)}…` : fact.statement}</p>
      {fact.permission === "anonymize" && fact.anonymizedStatement ? <p className="mt-2 border-l-2 border-teal pl-3 text-sm"><span className="text-xs text-ink-light">Shared anonymised as:</span> {fact.anonymizedStatement}</p> : null}
      {detailKeys.length ? (
        <p className="mt-2 text-xs text-ink-mid">
          {detailKeys.map((key) => `${key}: ${fact.details?.[key] ? String(fact.details[key]) : "not stated"}`).join(" · ")}
        </p>
      ) : null}

      <button aria-expanded={open} className="mt-2 inline-flex items-center gap-1 text-xs text-teal underline underline-offset-4" onClick={() => setOpen((value) => !value)} type="button">
        <Quote aria-hidden="true" size={12} /> Where this came from <ChevronDown aria-hidden="true" className={open ? "rotate-180" : ""} size={12} />
      </button>
      {open ? (
        <ul className="mt-2 space-y-2 border-l-2 border-border pl-3 text-xs text-ink-mid">
          {fact.sourceDetails.map((source, index) => (
            <li key={index}>
              <span className="font-mono text-[10px] uppercase text-ink-light">{source.ref} · {source.origin === "upload" ? `your document${source.locator ? `, ${source.locator}` : ""}` : source.origin === "correction" ? "your correction" : source.speaker === "expert" ? "you said" : "companion"}{source.at ? ` · ${shortDate(source.at)}` : ""}</span>
              <br />
              “{source.quote.length > 500 ? `${source.quote.slice(0, 500)}…` : source.quote}”
            </li>
          ))}
        </ul>
      ) : null}

      {!rejected ? (
        <div className="mt-3 border-t border-border pt-3">
          {mode === "correct" ? (
            <div>
              <label className="font-mono text-[10px] uppercase text-ink-light" htmlFor={`c-${fact.id}`}>Say it the way you mean it</label>
              <textarea className="field-input min-h-24" id={`c-${fact.id}`} onChange={(event) => setText(event.target.value)} value={text} />
            </div>
          ) : null}
          {mode === "details" ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {detailKeys.map((key) => (
                <label key={key} className="block text-xs"><span className="font-mono text-[10px] uppercase text-ink-light">{key}</span>
                  <input className="field-input py-1.5! text-sm" onChange={(event) => setDetails((current) => ({ ...current, [key]: event.target.value }))} placeholder="Leave blank if you are not sure" value={details[key] ?? ""} />
                </label>
              ))}
            </div>
          ) : null}

          <div className="mt-2 flex flex-wrap items-end gap-3">
            <label className="block text-xs"><span className="font-mono text-[10px] uppercase text-ink-light">Sharing</span><br />
              <select className="border border-border bg-cream px-2 py-1.5 text-sm" onChange={(event) => setPermission(event.target.value)} value={permission}>
                {fact.sensitivity !== "none" || fact.permission === "unset" ? <option value="">Choose…</option> : null}
                <option value="public">Can be shared</option><option value="anonymize">Share anonymised</option><option value="private">Keep private</option>
              </select>
            </label>
            {permission === "anonymize" ? (
              <label className="block min-w-60 flex-1 text-xs"><span className="font-mono text-[10px] uppercase text-ink-light">Wording to share (no names or identifying details)</span>
                <input className="field-input py-1.5! text-sm" onChange={(event) => setAnonymous(event.target.value)} value={anonymous} />
              </label>
            ) : null}
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            {mode === "correct" ? (
              <>
                <button className="primary-button min-h-10! px-3! py-2!" disabled={busy || text.trim().length < 3} onClick={() => void onPatch({ action: "correct", statement: text, ...sharing }, "Correction saved. Your original words are kept in the record.")} type="button">Save my correction</button>
                <button className="text-sm underline underline-offset-4" onClick={() => setMode(null)} type="button">Cancel</button>
              </>
            ) : mode === "details" ? (
              <>
                <button className="primary-button min-h-10! px-3! py-2!" disabled={busy} onClick={() => void onPatch({ action: "details", details }, "Details saved. Confirm the statement when you are happy with it.")} type="button">Save details</button>
                <button className="text-sm underline underline-offset-4" onClick={() => setMode(null)} type="button">Cancel</button>
              </>
            ) : (
              <>
                {fact.reviewStatus === "confirmed" || fact.reviewStatus === "corrected" ? (
                  <button className="min-h-10 border border-border px-3 text-sm" disabled={busy || !permission} onClick={() => void onPatch({ action: "permission", ...{ permission: permission || "private", anonymizedStatement: sharing.anonymizedStatement } })} type="button">Update sharing</button>
                ) : (
                  <button className="primary-button min-h-10! px-3! py-2!" disabled={busy} onClick={() => void onPatch({ action: "confirm", ...sharing })} type="button">That is right</button>
                )}
                <button className="min-h-10 border border-ink px-3 text-sm" onClick={() => { setText(fact.statement); setMode("correct"); }} type="button">Correct it</button>
                {detailKeys.length ? <button className="min-h-10 border border-border px-3 text-sm" onClick={() => setMode("details")} type="button">Add what I know</button> : null}
                <button className="min-h-10 px-3 text-sm text-crimson underline underline-offset-4" disabled={busy} onClick={() => void onPatch({ action: "reject" })} type="button">I did not mean this</button>
              </>
            )}
          </div>
        </div>
      ) : (
        <button className="mt-3 text-sm text-teal underline underline-offset-4" disabled={busy} onClick={() => void onPatch({ action: "reopen" })} type="button">Bring it back for review</button>
      )}
    </li>
  );
}
