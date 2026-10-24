"use client";

import { ArrowRight, CheckCircle2, CircleDot, FolderOpen, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, type FormEvent } from "react";

import { STATUS_CHIP } from "@/components/strategy-hub/ConnectionsPanel";
import type { FillinStatus } from "@/lib/strategyFillinTypes";

interface Tool {
  id: string;
  name: string;
  stage: string;
  nature: string;
  does: string;
  when: string;
  upstream: string[];
  downstream: string[];
}
interface Catalogue {
  section: { name: string; tagline: string; stages: string[] };
  tools: Tool[];
  methodsToCome: number;
}
interface Problem { id: number; title: string; brief: string; status: string; toolsStarted: number }
interface Progress { status: FillinStatus; headline: string | null }

const BASE = "/problem-solving";

export default function ProblemSolvingOverview({ initialCaseId }: { initialCaseId: number | null }) {
  const router = useRouter();
  const [catalogue, setCatalogue] = useState<Catalogue | null>(null);
  const [loadError, setLoadError] = useState("");
  const [signedIn, setSignedIn] = useState<boolean | undefined>(undefined);
  const [problems, setProblems] = useState<Problem[] | null>(null);
  const [caseId, setCaseId] = useState<number | null>(initialCaseId);
  // Progress is kept with the problem it belongs to, so switching problems never shows the previous one's statuses.
  const [progressFor, setProgress] = useState<{ caseId: number; tools: Record<string, Progress> } | null>(null);
  const [title, setTitle] = useState("");
  const [brief, setBrief] = useState("");
  const [creating, setCreating] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [formError, setFormError] = useState("");

  useEffect(() => {
    fetch("/api/problem-solving/frameworks")
      .then(async (r) => ({ ok: r.ok, data: await r.json() }))
      .then(({ ok, data }) => (ok ? setCatalogue(data as Catalogue) : setLoadError(data.error ?? "The tools could not be loaded.")))
      .catch(() => setLoadError("The tools could not be loaded. Please refresh."));
    fetch("/api/auth/session", { cache: "no-store" })
      .then((r) => setSignedIn(r.ok))
      .catch(() => setSignedIn(false));
  }, []);

  const loadProblems = useCallback(async () => {
    const r = await fetch("/api/problem-solving/cases", { cache: "no-store" });
    if (!r.ok) { setProblems([]); return []; }
    const list = ((await r.json()).cases ?? []) as Problem[];
    setProblems(list);
    return list;
  }, []);

  useEffect(() => {
    if (!signedIn) return;
    // Started on the next tick (the pattern of use-learner-state.ts), so the effect itself sets no state.
    const timer = window.setTimeout(() => {
      void loadProblems().then((list) => {
        // Keep the problem in the address; otherwise pick up the most recent one.
        setCaseId((current) => (current && list.some((p) => p.id === current) ? current : list[0]?.id ?? null));
      });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [signedIn, loadProblems]);

  useEffect(() => {
    if (!caseId) return;
    router.replace(`${BASE}?case=${caseId}`, { scroll: false });
    let active = true;
    fetch(`/api/problem-solving/progress?caseId=${caseId}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { tools: {} }))
      .then((data) => { if (active) setProgress({ caseId, tools: data.tools ?? {} }); })
      .catch(() => undefined);
    return () => { active = false; };
  }, [caseId, router]);

  async function startProblem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (creating) return;
    setCreating(true);
    setFormError("");
    try {
      const r = await fetch("/api/problem-solving/cases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, brief }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) { setFormError(data.error ?? "The problem could not be saved."); return; }
      await loadProblems();
      setCaseId(data.case.id);
      setTitle("");
      setBrief("");
      setFormOpen(false);
    } catch {
      setFormError("Could not reach the server. Try again.");
    } finally {
      setCreating(false);
    }
  }

  const current = problems?.find((p) => p.id === caseId) ?? null;
  const progress: Record<string, Progress> = progressFor && progressFor.caseId === caseId ? progressFor.tools : {};
  const caseQuery = caseId ? `?case=${caseId}` : "";
  const nameOf = (id: string) => catalogue?.tools.find((t) => t.id === id)?.name ?? id;
  const firstTool = catalogue?.tools[0];

  return (
    <div className="mx-auto w-full max-w-7xl px-5 py-12 sm:px-8 sm:py-16">
      {/* Hero */}
      <section className="grid gap-8 border-t-2 border-gold bg-ink px-6 py-8 text-cream sm:p-10 lg:grid-cols-[1fr_20rem] lg:items-end">
        <div>
          <p className="font-mono text-[11px] uppercase text-gold-light">Practise real methods on a real problem</p>
          <h1 className="mt-4 max-w-3xl font-serif text-5xl leading-none font-light sm:text-6xl">{catalogue?.section.name ?? "Problem Solving"}</h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-cream/70">
            {catalogue?.section.tagline ?? "Work a business problem from definition to a one-page report, one proven method at a time."}
          </p>
        </div>
        {firstTool && (
          <div className="border-l-2 border-gold pl-5">
            <p className="text-sm leading-6 text-cream/70">New to these methods? See one worked through first: a fictional factory, a real method, nothing saved.</p>
            <Link className="primary-button mt-4" href={`${BASE}/${firstTool.id}?demo=1`}>
              See the worked example <ArrowRight aria-hidden="true" size={17} />
            </Link>
          </div>
        )}
      </section>

      {/* My problems */}
      <section aria-labelledby="problems-heading" className="mt-10 border-t-2 border-gold bg-surface p-5 shadow-[0_18px_48px_rgba(14,14,13,0.06)] sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <FolderOpen aria-hidden="true" className="text-gold" size={20} />
            <h2 className="font-serif text-3xl" id="problems-heading">My problems</h2>
          </div>
          {signedIn && (
            <button className="primary-button" onClick={() => setFormOpen((o) => !o)} type="button">
              <Plus aria-hidden="true" size={17} /> Start a new problem
            </button>
          )}
        </div>

        {signedIn === false && (
          <p className="mt-4 max-w-2xl text-sm leading-6 text-ink-mid">
            <Link className="font-semibold text-teal underline-offset-4 hover:underline" href={`/sign-in?next=${encodeURIComponent(BASE)}`}>Sign in</Link>{" "}
            to work one of your own problems through these methods. Your answers are saved as you type, and each method hands its conclusion to the next.
          </p>
        )}

        {signedIn && formOpen && (
          <form className="mt-6 grid gap-4 border-l-2 border-gold pl-5 lg:grid-cols-[1fr_1fr_auto] lg:items-end" onSubmit={(e) => void startProblem(e)}>
            <div>
              <label className="block font-mono text-[10px] uppercase text-ink-light" htmlFor="problem-title">The problem in a few words</label>
              <input autoFocus className="field-input" id="problem-title" maxLength={200} onChange={(e) => setTitle(e.target.value)} placeholder="Late deliveries to our largest customer" required value={title} />
            </div>
            <div>
              <label className="block font-mono text-[10px] uppercase text-ink-light" htmlFor="problem-brief">What is happening (optional)</label>
              <input className="field-input" id="problem-brief" maxLength={4000} onChange={(e) => setBrief(e.target.value)} placeholder="Since April, about one order in ten ships late" value={brief} />
            </div>
            <button className="primary-button" disabled={creating || title.trim().length < 3} type="submit">
              {creating ? "Saving…" : "Start"} <ArrowRight aria-hidden="true" size={17} />
            </button>
            {formError && <p className="text-xs text-crimson lg:col-span-3" role="alert">{formError}</p>}
          </form>
        )}

        {signedIn && problems && problems.length === 0 && !formOpen && (
          <p className="mt-4 text-sm leading-6 text-ink-mid">You have no problems here yet. Start one, or open the worked example to see how it goes.</p>
        )}

        {signedIn && problems && problems.length > 0 && (
          <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {problems.map((p) => {
              const selected = p.id === caseId;
              return (
                <li key={p.id}>
                  <button
                    aria-pressed={selected}
                    className={`w-full border px-4 py-3 text-left transition-colors ${selected ? "border-teal bg-teal text-white" : "border-border bg-cream text-ink hover:border-gold"}`}
                    onClick={() => setCaseId(p.id)}
                    type="button"
                  >
                    <span className="block text-sm font-semibold">{p.title}</span>
                    <span className={`mt-1 block text-xs ${selected ? "text-white/80" : "text-ink-light"}`}>
                      {p.toolsStarted === 0 ? "No method started yet" : `${p.toolsStarted} method${p.toolsStarted === 1 ? "" : "s"} started`}
                      {p.status === "solved" ? " · Solved" : ""}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* The methods, by stage */}
      <section aria-labelledby="methods-heading" className="mt-12">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="font-serif text-3xl" id="methods-heading">The methods{current ? <span className="text-ink-light"> · for “{current.title}”</span> : null}</h2>
          {catalogue && catalogue.methodsToCome > 0 && (
            <p className="font-mono text-[10px] uppercase text-ink-light">{catalogue.methodsToCome} more methods are on the way</p>
          )}
        </div>
        {loadError && <p className="mt-4 text-sm text-crimson" role="alert">{loadError}</p>}
        {!catalogue && !loadError && <p className="mt-4 text-sm text-ink-light">Loading the methods…</p>}

        {catalogue && (
          <div className="mt-6 space-y-8">
            {catalogue.section.stages.map((stage, index) => {
              const tools = catalogue.tools.filter((t) => t.stage === stage);
              if (tools.length === 0) return null;
              return (
                <div className="grid gap-4 lg:grid-cols-[12rem_1fr]" key={stage}>
                  <div>
                    <p className="font-mono text-[10px] uppercase text-gold">Stage {index + 1}</p>
                    <p className="mt-1 font-serif text-2xl">{stage}</p>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    {tools.map((t) => {
                      const p = progress[t.id];
                      const chip = p ? STATUS_CHIP[p.status] : null;
                      return (
                        <article className="flex flex-col border-t-2 border-gold bg-surface p-5 shadow-[0_18px_48px_rgba(14,14,13,0.05)]" key={t.id}>
                          <div className="flex items-start justify-between gap-3">
                            <h3 className="font-serif text-2xl">{t.name}</h3>
                            {chip
                              ? <span className={`shrink-0 rounded-[2px] border px-2 py-0.5 text-[11px] font-semibold ${chip.cls}`}>{chip.label}</span>
                              : caseId ? <span className="shrink-0 rounded-[2px] border border-border px-2 py-0.5 text-[11px] text-ink-light">Not started</span> : null}
                          </div>
                          <p className="mt-2 text-sm leading-6 text-ink-mid">{t.does}</p>
                          {p?.headline && (
                            <p className="mt-3 flex gap-2 text-xs leading-5 text-teal"><CheckCircle2 aria-hidden="true" className="mt-0.5 shrink-0" size={14} /> {p.headline}</p>
                          )}
                          {(t.upstream.length > 0 || t.downstream.length > 0) && (
                            <p className="mt-3 flex gap-2 text-xs leading-5 text-ink-light">
                              <CircleDot aria-hidden="true" className="mt-0.5 shrink-0" size={14} />
                              {t.upstream.length > 0 && <>Builds on {t.upstream.map(nameOf).join(", ")}. </>}
                              {t.downstream.length > 0 && <>Feeds {t.downstream.map(nameOf).join(", ")}.</>}
                            </p>
                          )}
                          <div className="mt-auto flex flex-wrap items-center gap-3 pt-5">
                            <Link className="primary-button" href={`${BASE}/${t.id}${caseQuery}`}>
                              {p ? "Continue" : "Open"} <ArrowRight aria-hidden="true" size={17} />
                            </Link>
                            <Link className="text-xs font-semibold text-teal underline-offset-4 hover:underline" href={`${BASE}/${t.id}?demo=1`}>Worked example</Link>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
