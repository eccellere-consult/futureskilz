"use client";

import Link from "next/link";
import { useState } from "react";

import { shortDate, useRemote } from "../capture/ui/api";
import type { LogRow } from "@/server/coach/service";

const FLAG: Record<string, string> = { crisis: "Held back: safety", injection: "Held back: tried to change the rules", redacted: "Personal details removed" };

/** Editors read what learners asked Arya and what she said, to check that she is safe and useful. Flagged exchanges first if asked. */
export function CoachLog() {
  const [flagged, setFlagged] = useState(false);
  const { data, error } = useRemote<{ rows: LogRow[] }>(`/api/coach/log${flagged ? "?flagged=1" : ""}`);
  return (
    <div className="mx-auto w-full max-w-5xl px-5 py-10 sm:px-8">
      <Link className="text-sm text-teal underline underline-offset-4" href="/contribute/skill-shots">Skill Shot studio</Link>
      <h1 className="mt-3 font-display text-4xl font-semibold">Conversations with Arya</h1>
      <p className="mt-3 max-w-3xl text-ink-mid">What signed-in learners asked Arya inside a Skill Shot, and what she answered. Use it to check safety and quality. A flag shows where a safety rule acted. Learners can delete their own conversations.</p>
      <label className="mt-5 flex items-center gap-2 text-sm"><input checked={flagged} onChange={(event) => setFlagged(event.target.checked)} type="checkbox" />Only flagged</label>
      {error ? <p className="mt-4 text-crimson" role="alert">{error}</p> : null}
      {!data ? <p className="mt-6 text-ink-light" role="status">Loading…</p> : data.rows.length === 0 ? <p className="mt-6 text-ink-mid">Nothing yet.</p> : (
        <ul className="mt-6 divide-y divide-border border border-border bg-surface">
          {data.rows.map((row) => (
            <li className="p-4 text-sm" key={row.id}>
              <p className="font-mono text-[10px] uppercase text-ink-light">{shortDate(row.createdAt)} · {row.skillShotId} · {row.kind} · {row.source}{row.flag ? ` · ${FLAG[row.flag] ?? row.flag}` : ""}</p>
              <p className="mt-2"><span className="font-semibold">Learner:</span> {row.message}</p>
              <p className="mt-1 text-ink-mid"><span className="font-semibold text-ink">Arya:</span> {row.reply}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
