"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { api, messageOf, shortDate, useRemote } from "./api";

type Draft = { id: string; slug: string; title: string; status: string; source?: string; passes: boolean; blockers: number; updatedAt: string; scrap?: boolean };

const GROUPS: Array<{ title: string; note: string; match: (draft: Draft) => boolean }> = [
  { title: "Being designed", note: "A minute or two each.", match: (draft) => draft.status === "designing" },
  { title: "Ready for you", note: "Passed its checks and approved. Only editors and admins can open these.", match: (draft) => draft.status === "approved" || draft.status === "published" },
  { title: "Needs a look", note: "Written by the AI, but its checks found points to fix. Open it to see them.", match: (draft) => (draft.status === "draft" || draft.status === "in_review") && !draft.scrap },
  { title: "Scrap", note: "Failed, or only an empty structure because the AI's reply could not be used. Safe to delete; the material can then be designed again.", match: (draft) => Boolean(draft.scrap) || draft.status === "failed" },
];

/** One screen for everything Autopilot made: what is still being designed, what is ready, what needs a look, and what failed. */
export function AutopilotResults() {
  const { data, error, reload } = useRemote<{ pilotOn: boolean; drafts: Draft[] }>("/api/contribute/autopilot");
  const working = Boolean(data?.drafts.some((draft) => draft.status === "designing"));
  useEffect(() => {
    if (!working) return;
    const timer = setInterval(reload, 5000);
    return () => clearInterval(timer);
  }, [working, reload]);

  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const remove = async (payload: { scrap: true } | { id: string }) => {
    setBusy(true);
    setFailure(null);
    try {
      const result = await api<{ removed: number }>("/api/contribute/autopilot", { method: "DELETE", body: JSON.stringify(payload) });
      setNotice(`${result.removed} deleted.`);
      reload();
    } catch (caught) {
      setFailure(messageOf(caught));
    } finally {
      setBusy(false);
    }
  };
  const scrapCount = data?.drafts.filter((draft) => draft.scrap || draft.status === "failed").length ?? 0;

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-6">
      <p className="font-mono text-[10px] uppercase text-ink-light">Pilot mode</p>
      <h1 className="mt-2 font-display text-3xl">What Autopilot made</h1>
      {error || failure ? <p role="alert" className="mt-4 text-sm text-crimson">{failure ?? error}</p> : null}
      {notice ? <p role="status" className="mt-4 text-sm text-teal">{notice}</p> : null}
      {scrapCount ? (
        <div className="mt-4 flex flex-wrap items-center gap-3 border-l-2 border-crimson bg-crimson/5 px-4 py-3 text-sm">
          <span>{scrapCount} scrap draft{scrapCount === 1 ? "" : "s"}: failed, or empty structures with placeholders.</span>
          <button className="primary-button min-h-10! px-3! py-2!" disabled={busy} onClick={() => void remove({ scrap: true })} type="button">Delete all scrap</button>
        </div>
      ) : null}
      {data && !data.pilotOn ? <p className="mt-4 border-l-2 border-gold pl-3 text-sm text-ink-mid">Pilot mode is off, so Autopilot is not running. An admin can turn it on from the Admin page.</p> : null}
      {data && data.drafts.length === 0 ? (
        <div className="mt-6 border border-border bg-surface p-5">
          <p className="text-sm text-ink-mid">Nothing yet. Drop in a document and Autopilot turns it into Skill Shots.</p>
          <Link className="primary-button mt-3" href="/contribute/from-source">Create from files</Link>
        </div>
      ) : null}
      {data ? GROUPS.map((group) => {
        const rows = data.drafts.filter(group.match);
        if (!rows.length) return null;
        return (
          <section key={group.title} aria-label={group.title} className="mt-8">
            <h2 className="font-display text-xl">{group.title} <span className="text-ink-mid">({rows.length})</span></h2>
            <p className="mt-1 text-xs text-ink-mid">{group.note}</p>
            <ul className="mt-3 divide-y divide-border border border-border bg-surface text-sm">
              {rows.map((draft) => (
                <li key={draft.id} className="flex flex-wrap items-baseline justify-between gap-2 p-3">
                  <Link className="font-semibold underline-offset-4 hover:underline" href={`/contribute/skill-shots/${draft.id}`}>{draft.title}</Link>
                  <span className="flex items-center gap-3 text-xs text-ink-mid">{draft.blockers ? `${draft.blockers} point${draft.blockers === 1 ? "" : "s"} to fix · ` : ""}{shortDate(draft.updatedAt)}{draft.status !== "published" && draft.status !== "designing" ? <button className="border border-border px-2 py-1" disabled={busy} onClick={() => void remove({ id: draft.id })} type="button">Delete</button> : null}</span>
                </li>
              ))}
            </ul>
          </section>
        );
      }) : null}
    </div>
  );
}
