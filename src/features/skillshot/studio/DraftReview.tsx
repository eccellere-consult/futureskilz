"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { messageOf, patch, post, useRemote } from "../../capture/ui/api";
import { DesignedSkillShotPlayer } from "../DesignedSkillShotPlayer";
import type { DraftAction, DraftDetail } from "@/server/skillshots/service";

const STATUS: Record<string, string> = { designing: "Being designed…", failed: "Could not be designed", draft: "Draft", in_review: "In review", approved: "Approved, ready to publish", published: "Live", retired: "Retired" };
const LABEL: Record<DraftAction, { label: string; primary?: boolean }> = { submit: { label: "Send to review", primary: true }, approve: { label: "Approve", primary: true }, request_changes: { label: "Send back for changes" }, publish: { label: "Publish to learners", primary: true }, retire: { label: "Retire" } };
const ACTIONS: Record<string, DraftAction[]> = { draft: ["submit"], in_review: ["approve", "request_changes"], approved: ["publish", "request_changes"], published: ["retire"] };

/** One Skill Shot draft: what the agent reported, the automatic checks, a preview exactly as learners will see it, and the review steps. */
export function DraftReview({ id }: { id: string }) {
  const { data, error, reload, setError } = useRemote<DraftDetail>(`/api/contribute/skill-shots/${id}`);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [json, setJson] = useState<string | null>(null);

  useEffect(() => {
    if (data?.status !== "designing") return;
    const timer = window.setInterval(reload, 4000);
    return () => window.clearInterval(timer);
  }, [data?.status, reload]);

  const run = async (work: () => Promise<unknown>, done?: string) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await work();
      if (done) setNotice(done);
      reload();
    } catch (caught) {
      setError(messageOf(caught));
    } finally {
      setBusy(false);
    }
  };

  if (!data) return <div className="mx-auto max-w-3xl px-5 py-16" role="status">{error ? <p className="text-crimson">{error}</p> : <p className="text-ink-light">Loading…</p>}</div>;
  const actions = ACTIONS[data.status] ?? [];
  const editable = data.status === "draft" || data.status === "failed" || data.status === "in_review" || data.status === "approved";

  return (
    <div className="mx-auto w-full max-w-6xl px-5 py-8 sm:px-8">
      <Link className="text-sm text-teal underline underline-offset-4" href="/contribute/skill-shots">Skill Shot studio</Link>
      <p className="mt-3 font-mono text-[10px] uppercase text-ink-light">Skill Shot · {STATUS[data.status]} · {data.source === "ai" ? "AI draft" : "structure only"} · about {data.review.durationMinutes} min</p>
      <h1 className="font-display text-3xl font-semibold sm:text-4xl">{data.title}</h1>
      {error ? <p className="mt-3 border-l-2 border-crimson bg-crimson/5 px-4 py-2 text-sm text-crimson" role="alert">{error}</p> : null}
      {notice ? <p className="mt-3 border-l-2 border-teal bg-teal/5 px-4 py-2 text-sm" role="status">{notice}</p> : null}
      {data.status === "designing" ? <p className="mt-6 border-l-2 border-gold pl-4" role="status">The design agent is writing this draft. It can take a minute. This page updates by itself.</p> : null}

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div>
          {data.status !== "designing" ? <DesignedSkillShotPlayer blueprint={data.blueprint} preview /> : null}
        </div>
        <aside className="space-y-5">
          <section className="border border-ink bg-surface p-4" aria-label="Actions">
            <h2 className="font-display text-xl">What you can do</h2>
            {actions.length ? <div className="mt-3 flex flex-wrap gap-2">{actions.map((action) => <button className={LABEL[action].primary ? "primary-button min-h-10! px-3! py-2!" : "underline underline-offset-4"} disabled={busy} key={action} onClick={() => void run(() => post(`/api/contribute/skill-shots/${id}`, { action }), `${LABEL[action].label}: done.`)} type="button">{LABEL[action].label}</button>)}</div> : <p className="mt-2 text-sm text-ink-mid">Nothing to do right now.</p>}
          </section>

          {data.notes.length ? <section className="border border-border bg-surface p-4 text-sm" aria-label="Agent notes"><h2 className="font-display text-xl">From the design agent</h2><ul className="mt-2 list-disc space-y-1 pl-5 text-ink-mid">{data.notes.map((note) => <li key={note}>{note}</li>)}</ul></section> : null}

          <section className="border border-border bg-surface p-4 text-sm" aria-label="Checks">
            <h2 className="font-display text-xl">Automatic checks</h2>
            <p className="mt-1 text-ink-mid">{data.review.passes ? "All checks pass. A person still has to judge the teaching." : `${data.review.blockers.length} to fix before it can go to review.`}</p>
            {data.review.blockers.length ? <ul className="mt-2 list-disc space-y-1 pl-5">{data.review.blockers.slice(0, 8).map((note) => <li key={note}>{note}</li>)}</ul> : null}
            <ul className="mt-3 grid gap-1">{data.review.findings.map((finding) => <li className="flex justify-between gap-3" key={finding.criterion}><span>{finding.criterion}</span><span className={finding.score >= 4 ? "text-teal" : "text-crimson"}>{finding.score}/5</span></li>)}</ul>
          </section>

          {editable ? (
            <section className="border border-border bg-surface p-4 text-sm" aria-label="Edit">
              <h2 className="font-display text-xl">Edit the blueprint</h2>
              <p className="mt-1 text-ink-mid">Replace every [[placeholder]] and fix the points above. Saving re-runs the checks and returns the draft to Draft.</p>
              {json === null ? <button className="mt-3 underline underline-offset-4" onClick={() => setJson(JSON.stringify(data.blueprint, null, 2))} type="button">Open the blueprint</button> : (
                <>
                  <textarea aria-label="Blueprint JSON" className="mt-3 h-80 w-full border border-border bg-white p-2 font-mono text-xs" onChange={(event) => setJson(event.target.value)} spellCheck={false} value={json} />
                  <div className="mt-2 flex gap-3"><button className="primary-button min-h-10! px-3! py-2!" disabled={busy} onClick={() => void run(async () => { await patch(`/api/contribute/skill-shots/${id}`, { blueprint: JSON.parse(json) }); setJson(null); }, "Saved and checked again.")} type="button">Save</button><button className="underline underline-offset-4" onClick={() => setJson(null)} type="button">Cancel</button></div>
                </>
              )}
            </section>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
