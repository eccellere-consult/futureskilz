"use client";

import Link from "next/link";
import { useEffect } from "react";

import { shortDate, useRemote } from "./api";

type Draft = { id: string; slug: string; title: string; status: string; passes: boolean; blockers: number; updatedAt: string };

const GROUPS: Array<{ title: string; note: string; match: (draft: Draft) => boolean }> = [
  { title: "Being designed", note: "A minute or two each.", match: (draft) => draft.status === "designing" },
  { title: "Ready for you", note: "Passed its checks and approved. Only editors and admins can open these.", match: (draft) => draft.status === "approved" || draft.status === "published" },
  { title: "Needs a look", note: "Made, but its checks found points to fix. Open it to see them.", match: (draft) => draft.status === "draft" || draft.status === "in_review" },
  { title: "Could not be made", note: "Run Autopilot again on the project and these are tried again.", match: (draft) => draft.status === "failed" },
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

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-6">
      <p className="font-mono text-[10px] uppercase text-ink-light">Pilot mode</p>
      <h1 className="mt-2 font-display text-3xl">What Autopilot made</h1>
      {error ? <p role="alert" className="mt-4 text-sm text-crimson">{error}</p> : null}
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
                  <span className="text-xs text-ink-mid">{draft.blockers ? `${draft.blockers} point${draft.blockers === 1 ? "" : "s"} to fix · ` : ""}{shortDate(draft.updatedAt)}</span>
                </li>
              ))}
            </ul>
          </section>
        );
      }) : null}
    </div>
  );
}
