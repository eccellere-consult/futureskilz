"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { messageOf, post, useRemote } from "./api";

type Preview = { pieces: Array<{ key: string; title: string; statements: number; draftId: string | null; draftStatus: string | null }>; leftOut: string[] };

/**
 * After the contributor has approved their knowledge, one click makes Skill Shot drafts from it. Each piece is a few confirmed
 * statements on one subject. The drafts go to an editor for review; nothing reaches a learner from here.
 */
export function SkillShotsFromReview({ projectId }: { projectId: string }) {
  const { data, error, reload } = useRemote<Preview>(`/api/contribute/projects/${projectId}/skill-shots`);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const waiting = Boolean(data?.pieces.some((piece) => piece.draftStatus === "designing"));

  useEffect(() => {
    if (!waiting) return;
    const timer = setInterval(reload, 5000);
    return () => clearInterval(timer);
  }, [waiting, reload]);

  const make = async () => {
    setBusy(true);
    setFailure(null);
    try {
      const result = await post<{ queued: number; alreadyStarted: number }>(`/api/contribute/projects/${projectId}/skill-shots`, {});
      setNotice(result.queued ? `${result.queued} Skill Shot draft${result.queued === 1 ? " is" : "s are"} being designed. This takes a minute or two.` : "Every piece already has a draft.");
      reload();
    } catch (caught) {
      setFailure(messageOf(caught));
    } finally {
      setBusy(false);
    }
  };

  const todo = data?.pieces.filter((piece) => !piece.draftId).length ?? 0;
  return (
    <section aria-label="Skill Shots" className="border border-border bg-surface p-5">
      <h2 className="font-display text-xl">Skill Shots</h2>
      <p className="mt-1 text-sm text-ink-mid">Short lessons made only from what you confirmed. An editor checks each one before any learner sees it.</p>
      {error ? <p role="alert" className="mt-3 text-sm text-crimson">{error}</p> : null}
      {failure ? <p role="alert" className="mt-3 text-sm text-crimson">{failure}</p> : null}
      {notice ? <p role="status" className="mt-3 text-sm text-teal">{notice}</p> : null}
      {data ? (
        data.pieces.length ? (
          <ul className="mt-3 space-y-2 text-sm">
            {data.pieces.map((piece) => (
              <li key={piece.key} className="flex flex-wrap items-baseline justify-between gap-2 border-t border-border pt-2">
                <span>{piece.title} <span className="text-ink-mid">({piece.statements} confirmed statements)</span></span>
                <span className="text-ink-mid">{piece.draftStatus === "designing" ? "Being designed…" : piece.draftStatus === "failed" ? "Could not be designed" : piece.draftId ? <Link className="underline underline-offset-4" href={`/contribute/skill-shots/${piece.draftId}`}>Draft ready</Link> : "Not made yet"}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-ink-mid">There is not enough confirmed knowledge yet to make a Skill Shot. Confirm more statements, then come back.</p>
        )
      ) : null}
      {data?.leftOut.length ? <details className="mt-3 text-sm text-ink-mid"><summary className="cursor-pointer">Left out ({data.leftOut.length})</summary><ul className="mt-2 list-disc pl-5">{data.leftOut.map((line) => <li key={line}>{line}</li>)}</ul></details> : null}
      {data?.pieces.length ? <button type="button" className="primary-button mt-3" disabled={busy || todo === 0} onClick={() => void make()}>{busy ? "Starting…" : todo === 0 ? "All pieces made" : `Make ${todo} Skill Shot${todo === 1 ? "" : "s"}`}</button> : null}
    </section>
  );
}
