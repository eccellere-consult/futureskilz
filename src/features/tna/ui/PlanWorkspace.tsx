"use client";

import { ArrowDown, ArrowUp, Check, ChevronsLeft, ChevronsRight, Printer, Sparkles, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { api, messageOf, post, put } from "@/features/capture/ui/api";
import { skillTaxonomy } from "@/domain/skills/taxonomy";
import type { ProgramDetail } from "@/server/tna/service";

import { outlineText } from "../briefs";
import { depthOf, isLeaf, orderedNodes } from "../tree";
import { MAX_DEPTH, evidenceLabels, priorities, type Need, type TopicNode } from "../types";

const EVIDENCE_LABEL: Record<string, string> = { stated: "The client said so", inferred: "Worked out from facts", assumption: "An assumption to check" };
const PRIORITY_LABEL: Record<string, string> = { high: "High", medium: "Medium", low: "Low" };
const skillName = (slug: string) => skillTaxonomy.find((skill) => skill.slug === slug)?.name ?? slug;

type TreeBody = { action: string; [key: string]: unknown };

/**
 * One training plan from start to hand-off: confirm the learner needs, build and edit the topic tree, approve it, print the
 * outline. The AI only proposes. Every change is saved at once, and an approved plan goes back to draft when it is edited.
 */
export function PlanWorkspace({ id }: { id: string }) {
  const [plan, setPlan] = useState<ProgramDetail | null>(null);
  const [needs, setNeeds] = useState<Need[]>([]);
  const [dirty, setDirty] = useState(false);
  const dirtyRef = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    const loaded = await api<ProgramDetail>(`/api/contribute/tna/${id}`);
    setPlan(loaded);
    if (!dirtyRef.current) setNeeds(loaded.needs);
    return loaded;
  }, [id]);

  useEffect(() => {
    let active = true;
    api<ProgramDetail>(`/api/contribute/tna/${id}`)
      .then((loaded) => {
        if (!active) return;
        setPlan(loaded);
        setNeeds(loaded.needs);
      })
      .catch((caught) => {
        if (active) setError(messageOf(caught));
      });
    return () => {
      active = false;
    };
  }, [id]);

  const working = plan?.working ?? null;
  useEffect(() => {
    if (!working) return;
    const timer = setInterval(() => void load().catch(() => undefined), 3000);
    return () => clearInterval(timer);
  }, [working, load]);

  function changeNeeds(next: Need[]) {
    setNeeds(next);
    dirtyRef.current = true;
    setDirty(true);
  }

  async function saveNeeds() {
    await put(`/api/contribute/tna/${id}/needs`, { needs });
    dirtyRef.current = false;
    setDirty(false);
  }

  async function run<T>(action: () => Promise<T>, done?: string) {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await action();
      if (done) setMessage(done);
    } catch (caught) {
      setError(messageOf(caught));
    } finally {
      setBusy(false);
    }
  }

  const generate = (step: "needs" | "tree") =>
    run(async () => {
      if (dirtyRef.current) await saveNeeds();
      await post(`/api/contribute/tna/${id}/generate`, { step });
      await load();
    });

  const saveOnly = () => run(async () => { await saveNeeds(); await load(); }, "Saved.");

  const edit = (body: TreeBody) =>
    run(async () => {
      setPlan(await post<ProgramDetail>(`/api/contribute/tna/${id}/tree`, body));
    });

  const approve = () =>
    run(async () => {
      if (dirtyRef.current) await saveNeeds();
      setPlan(await post<ProgramDetail>(`/api/contribute/tna/${id}/approve`));
    }, "Approved. The outline and Skill Shot briefs are ready below.");

  async function downloadBriefs() {
    await run(async () => {
      const result = await api<{ briefs: unknown[] }>(`/api/contribute/tna/${id}/briefs`);
      const url = URL.createObjectURL(new Blob([JSON.stringify(result.briefs, null, 2)], { type: "application/json" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = "skill-shot-briefs.json";
      link.click();
      URL.revokeObjectURL(url);
    });
  }

  if (!plan) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        {error ? <p className="text-sm text-crimson" role="alert">{error}</p> : <p className="text-sm text-ink-mid">Loading…</p>}
        <p className="mt-4"><Link className="underline" href="/contribute/training-needs">Back to your plans</Link></p>
      </div>
    );
  }

  const live = needs.filter((need) => need.status !== "rejected");
  const confirmed = needs.filter((need) => need.status === "confirmed").length;
  const ordered = orderedNodes(plan.nodes);
  const blocks = plan.check.issues.filter((issue) => issue.severity === "block");
  const warns = plan.check.issues.filter((issue) => issue.severity === "warn");
  const titleOf = (nodeId?: string) => plan.nodes.find((node) => node.id === nodeId)?.title;
  const approved = plan.status === "approved";

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <div className="print:hidden">
        <p className="text-xs"><Link className="underline" href="/contribute/training-needs">All plans</Link></p>
        <h1 className="mt-2 font-display text-3xl">{plan.title}</h1>
        <p className="mt-2 text-sm text-ink-mid">For {plan.brief.audience.role} ({plan.brief.audience.language}). Goal: {plan.brief.goal}</p>
        <p className="mt-3 border-l-2 border-gold pl-3 text-xs leading-5 text-ink-mid">The needs and topics below are AI proposals, not findings. The checks run in code and find overlaps, gaps and oversize pieces; they cannot tell whether the content is right. You read, correct and approve.</p>
        {working ? <p className="mt-3 text-sm" role="status">The AI is working on the {working === "needs" ? "learner needs" : "topic tree"}. This takes up to a minute; the page updates by itself.</p> : null}
        {plan.notes.map((note) => <p className="mt-2 text-sm text-ink-mid" key={note}>{note}</p>)}
        {plan.source === "scaffold" && (plan.nodes.length || plan.needs.length) ? <p className="mt-2 text-sm text-ink-mid">The AI was not available, so this is a generic starting point, not tailored to your topic. Edit it freely.</p> : null}
        {error ? <p className="mt-3 text-sm text-crimson" role="alert">{error}</p> : null}
        {message ? <p className="mt-3 text-sm" role="status">{message}</p> : null}

        <section aria-label="Learner needs" className="mt-8">
          <h2 className="font-display text-xl">1. What the learners cannot yet do</h2>
          <p className="mt-1 text-xs text-ink-mid">Each need says what a learner cannot yet do, in terms you could watch. Confirm what is true, reject what is not, and reword anything.</p>
          {!needs.length ? (
            <p className="mt-3"><button className="primary-button" disabled={busy || Boolean(working)} onClick={() => void generate("needs")} type="button"><Sparkles aria-hidden="true" size={16} /> Propose the needs with AI</button></p>
          ) : (
            <ul className="mt-3 grid gap-3">
              {needs.map((need, index) => (
                <li className={`border bg-surface p-3 ${need.status === "rejected" ? "border-border opacity-60" : need.status === "confirmed" ? "border-teal" : "border-border"}`} key={need.id || `new-${index}`}>
                  <label className="block text-xs">
                    <span className="font-mono text-[10px] uppercase text-ink-light">Need {index + 1}</span>
                    <textarea className="field-input mt-1 min-h-16 text-sm" maxLength={300} onChange={(event) => changeNeeds(needs.map((item, at) => (at === index ? { ...item, statement: event.target.value } : item)))} value={need.statement} />
                  </label>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                    <select aria-label="Where this comes from" className="field-input w-auto py-1.5! text-xs" onChange={(event) => changeNeeds(needs.map((item, at) => (at === index ? { ...item, evidence: event.target.value as Need["evidence"] } : item)))} value={need.evidence}>
                      {evidenceLabels.map((label) => <option key={label} value={label}>{EVIDENCE_LABEL[label]}</option>)}
                    </select>
                    <select aria-label="Priority" className="field-input w-auto py-1.5! text-xs" onChange={(event) => changeNeeds(needs.map((item, at) => (at === index ? { ...item, priority: event.target.value as Need["priority"] } : item)))} value={need.priority}>
                      {priorities.map((label) => <option key={label} value={label}>{PRIORITY_LABEL[label]} priority</option>)}
                    </select>
                    <button aria-pressed={need.status === "confirmed"} className={`min-h-10 border px-3 ${need.status === "confirmed" ? "border-teal bg-teal/10" : "border-border"}`} onClick={() => changeNeeds(needs.map((item, at) => (at === index ? { ...item, status: item.status === "confirmed" ? "proposed" : "confirmed" } : item)))} type="button"><Check aria-hidden="true" className="mr-1 inline" size={14} />{need.status === "confirmed" ? "Confirmed" : "Confirm"}</button>
                    <button aria-pressed={need.status === "rejected"} className="min-h-10 border border-border px-3" onClick={() => changeNeeds(needs.map((item, at) => (at === index ? { ...item, status: item.status === "rejected" ? "proposed" : "rejected" } : item)))} type="button"><X aria-hidden="true" className="mr-1 inline" size={14} />{need.status === "rejected" ? "Rejected (undo)" : "Reject"}</button>
                    <button aria-label={`Remove need ${index + 1}`} className="min-h-10 border border-border px-3" onClick={() => changeNeeds(needs.filter((_, at) => at !== index))} type="button"><Trash2 aria-hidden="true" size={14} /></button>
                  </div>
                  {need.askClient ? <p className="mt-2 text-xs text-ink-mid">Ask the client: {need.askClient}</p> : null}
                </li>
              ))}
            </ul>
          )}
          {needs.length ? (
            <div className="mt-3 flex flex-wrap gap-2">
              <button className="min-h-12 border border-border px-4 text-sm" onClick={() => changeNeeds([...needs, { id: "", statement: "", evidence: "stated", priority: "medium", askClient: null, status: "confirmed" }])} type="button">Add a need</button>
              <button className="min-h-12 border border-border px-4 text-sm" disabled={busy || Boolean(working)} onClick={() => void generate("needs")} type="button"><Sparkles aria-hidden="true" className="mr-1 inline" size={14} />Propose more with AI</button>
              <button className="min-h-12 border border-border px-4 text-sm" disabled={busy || !dirty} onClick={() => void saveOnly()} type="button">{dirty ? "Save changes" : "Saved"}</button>
            </div>
          ) : null}
        </section>

        <section aria-label="Topic tree" className="mt-10">
          <h2 className="font-display text-xl">2. The topic, broken into small pieces</h2>
          <p className="mt-1 text-xs text-ink-mid">Modules, then topics, down to pieces about the size of one Skill Shot (5 to 10 minutes). Move, indent, rename, reject or add. {confirmed ? `${confirmed} need${confirmed === 1 ? "" : "s"} confirmed.` : "Confirm at least one need first."}</p>
          {!plan.nodes.length ? (
            <p className="mt-3"><button className="primary-button" disabled={busy || Boolean(working) || !live.length} onClick={() => void generate("tree")} type="button"><Sparkles aria-hidden="true" size={16} /> Break the topic down with AI</button></p>
          ) : (
            <>
              <ul className="mt-3 grid gap-2">
                {ordered.map((node) => (
                  <NodeRow busy={busy || Boolean(working)} depth={depthOf(plan.nodes, node.id)} key={node.id} leaf={isLeaf(plan.nodes, node.id)} node={node} onEdit={edit} />
                ))}
              </ul>
              <div className="mt-3 flex flex-wrap gap-2">
                <button className="min-h-12 border border-border px-4 text-sm" disabled={busy || Boolean(working)} onClick={() => { const title = window.prompt("Name of the new module"); if (title) void edit({ action: "add", parentId: null, title }); }} type="button">Add a module</button>
                <button className="min-h-12 border border-border px-4 text-sm" disabled={busy || Boolean(working)} onClick={() => { if (window.confirm("Replace the whole tree with a new AI proposal? Your edits to it will be lost.")) void generate("tree"); }} type="button">Start the tree again with AI</button>
              </div>
            </>
          )}
          {plan.nodes.length ? (
            <div aria-label="Checks" className="mt-4 text-sm">
              <p className="font-medium">Checks: {plan.check.leafCount} pieces, about {plan.check.totalMinutes} minutes in all.</p>
              {!plan.check.issues.length ? <p className="mt-1 text-xs text-ink-mid">No problems found. This is a structural check only.</p> : null}
              <ul className="mt-1 grid gap-1 text-xs">
                {blocks.map((issue, index) => <li className="text-crimson" key={`b${index}`}>Fix before approving: {issue.message}{titleOf(issue.nodeId) ? ` (${titleOf(issue.nodeId)})` : ""}</li>)}
                {warns.map((issue, index) => <li className="text-ink-mid" key={`w${index}`}>Worth a look: {issue.message}{titleOf(issue.nodeId) ? ` (${titleOf(issue.nodeId)})` : ""}</li>)}
              </ul>
            </div>
          ) : null}
        </section>

        {plan.nodes.length ? (
          <section aria-label="Approve" className="mt-10">
            <h2 className="font-display text-xl">3. Approve and hand over</h2>
            <p className="mt-1 text-xs text-ink-mid">Approving marks every topic you have not rejected as approved. Editing afterwards puts the plan back to draft. Nothing is published, and no Skill Shot is made yet.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button className="primary-button" disabled={busy || Boolean(working) || !plan.check.canApprove || approved} onClick={() => void approve()} type="button">{approved ? "Approved" : "Approve this plan"}</button>
              {approved ? <button className="min-h-12 border border-border px-4 text-sm" disabled={busy} onClick={() => void downloadBriefs()} type="button">Download the Skill Shot briefs</button> : null}
              <button className="min-h-12 border border-border px-4 text-sm" onClick={() => window.print()} type="button"><Printer aria-hidden="true" className="mr-1 inline" size={14} />Print the outline</button>
            </div>
          </section>
        ) : null}
      </div>

      {plan.nodes.length ? (
        <pre aria-label="Outline" className="mt-10 whitespace-pre-wrap border border-border bg-surface p-4 font-sans text-sm leading-6 print:mt-0 print:border-0 print:p-0">{outlineText(plan.title, plan.nodes, plan.needs)}</pre>
      ) : null}
    </div>
  );
}

function NodeRow({ node, depth, leaf, busy, onEdit }: { node: TopicNode; depth: number; leaf: boolean; busy: boolean; onEdit: (body: TreeBody) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(node.title);
  const [summary, setSummary] = useState(node.summary);
  const [minutes, setMinutes] = useState(node.minutes ? String(node.minutes) : "");
  const [hint, setHint] = useState(node.materialHint);
  const [skills, setSkills] = useState(node.skills);
  const rejected = node.status === "rejected";
  const small = "min-h-10 min-w-10 border border-border px-2";

  return (
    <li className={`border bg-surface p-3 ${rejected ? "border-border opacity-60" : "border-border"}`} style={{ marginLeft: `${Math.min(depth - 1, 3) * 1.25}rem` }}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className={`text-sm ${leaf ? "" : "font-semibold"}`}>{node.title}{node.minutes ? <span className="ml-2 text-xs font-normal text-ink-mid">{node.minutes} min</span> : null}{node.status === "approved" ? <span className="ml-2 text-xs font-normal text-teal">approved</span> : null}</p>
          {node.summary ? <p className="mt-1 text-xs text-ink-mid">{node.summary}</p> : null}
          {node.skills.length ? <p className="mt-1 text-xs text-ink-light">Skills: {node.skills.map(skillName).join(", ")}</p> : null}
        </div>
        <div className="flex flex-wrap gap-1">
          <button aria-label={`Move ${node.title} up`} className={small} disabled={busy} onClick={() => void onEdit({ action: "move", id: node.id, direction: -1 })} type="button"><ArrowUp aria-hidden="true" size={14} /></button>
          <button aria-label={`Move ${node.title} down`} className={small} disabled={busy} onClick={() => void onEdit({ action: "move", id: node.id, direction: 1 })} type="button"><ArrowDown aria-hidden="true" size={14} /></button>
          <button aria-label={`Make ${node.title} a sub-topic of the one above`} className={small} disabled={busy} onClick={() => void onEdit({ action: "indent", id: node.id })} type="button"><ChevronsRight aria-hidden="true" size={14} /></button>
          <button aria-label={`Move ${node.title} up a level`} className={small} disabled={busy} onClick={() => void onEdit({ action: "outdent", id: node.id })} type="button"><ChevronsLeft aria-hidden="true" size={14} /></button>
          <button className={`${small} text-xs`} disabled={busy} onClick={() => setOpen(!open)} type="button">{open ? "Close" : "Edit"}</button>
          <button className={`${small} text-xs`} disabled={busy} onClick={() => void onEdit({ action: "status", id: node.id, status: rejected ? "proposed" : "rejected" })} type="button">{rejected ? "Undo" : "Reject"}</button>
        </div>
      </div>
      {open ? (
        <div className="mt-3 grid gap-3 text-xs">
          <label className="block"><span className="font-mono text-[10px] uppercase text-ink-light">Name</span><input className="field-input mt-1 text-sm" maxLength={200} onChange={(event) => setTitle(event.target.value)} value={title} /></label>
          <label className="block"><span className="font-mono text-[10px] uppercase text-ink-light">In plain words</span><textarea className="field-input mt-1 min-h-16 text-sm" maxLength={600} onChange={(event) => setSummary(event.target.value)} value={summary} /></label>
          <label className="block"><span className="font-mono text-[10px] uppercase text-ink-light">Minutes</span><input className="field-input mt-1 text-sm" inputMode="numeric" onChange={(event) => setMinutes(event.target.value.replace(/\D/g, ""))} value={minutes} /></label>
          <label className="block"><span className="font-mono text-[10px] uppercase text-ink-light">Material to find (what files or notes would teach this)</span><input className="field-input mt-1 text-sm" maxLength={500} onChange={(event) => setHint(event.target.value)} value={hint} /></label>
          <div>
            <span className="font-mono text-[10px] uppercase text-ink-light">Skills (up to 4)</span>
            <div className="mt-1 flex flex-wrap gap-1">
              {skills.map((slug) => <button aria-label={`Remove ${skillName(slug)}`} className="min-h-9 border border-teal bg-teal/10 px-2" key={slug} onClick={() => setSkills(skills.filter((item) => item !== slug))} type="button">{skillName(slug)} ×</button>)}
            </div>
            {skills.length < 4 ? (
              <select aria-label="Add a skill" className="field-input mt-1 text-sm" onChange={(event) => { if (event.target.value) setSkills([...skills, event.target.value]); }} value="">
                <option value="">Add a skill…</option>
                {skillTaxonomy.filter((skill) => !skills.includes(skill.slug)).map((skill) => <option key={skill.slug} value={skill.slug}>{skill.name}</option>)}
              </select>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="primary-button" disabled={busy} onClick={() => { void onEdit({ action: "update", id: node.id, fields: { title, summary, materialHint: hint, skills, minutes: minutes ? Number(minutes) : null } }).then(() => setOpen(false)); }} type="button">Save this topic</button>
            {depth < MAX_DEPTH ?<button className="min-h-12 border border-border px-3" disabled={busy} onClick={() => { const name = window.prompt("Name of the new sub-topic"); if (name) void onEdit({ action: "add", parentId: node.id, title: name }); }} type="button">Add a sub-topic</button> : null}
            <button className="min-h-12 border border-border px-3" disabled={busy} onClick={() => { if (window.confirm(`Remove "${node.title}" and everything under it?`)) void onEdit({ action: "remove", id: node.id }); }} type="button">Remove</button>
          </div>
        </div>
      ) : null}
    </li>
  );
}
