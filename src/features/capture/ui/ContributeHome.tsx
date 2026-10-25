"use client";

import { ArrowRight, BookOpenCheck, Mic, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { fetchSessionUser, type SessionUser } from "@/features/learner/store";
import { SignInForm } from "@/features/learner/sign-in-form";

import { CONSENT_LABELS, type ConsentPurpose } from "../gates";

import { api, messageOf, post, shortDate } from "./api";

type ProjectRow = { id: string; title: string; status: string; stage: string; updatedAt: string; facts: number; confirmed: number };

const STATUS: Record<string, string> = {
  interviewing: "In conversation",
  in_review: "Ready for your review",
  approved: "Approved",
  published: "Published",
  withdrawn: "Withdrawn",
};

const STEPS = [
  { icon: Mic, title: "Talk, in your own words", body: "A friendly AI companion asks one question at a time. Speak or type. Pause whenever you like and carry on another day." },
  { icon: BookOpenCheck, title: "Check what I heard", body: "Every statement is shown with the exact words it came from. Confirm, correct or reject each one." },
  { icon: ShieldCheck, title: "Decide what is shared", body: "Nothing is published without your approval. Sensitive details can be anonymised or kept private." },
];

const LANGUAGES: Array<[string, string]> = [["en", "English"], ["hi", "Hindi"], ["ta", "Tamil"], ["te", "Telugu"], ["bn", "Bengali"], ["mr", "Marathi"], ["gu", "Gujarati"], ["kn", "Kannada"], ["ml", "Malayalam"]];

export function ContributeHome() {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null | undefined>(undefined);
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [title, setTitle] = useState("");
  const [publicName, setPublicName] = useState("");
  const [language, setLanguage] = useState("en");
  const [consents, setConsents] = useState<Partial<Record<ConsentPurpose, boolean>>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetchSessionUser().then(async (sessionUser) => {
      if (!active) return;
      setUser(sessionUser);
      if (sessionUser) {
        const data = await api<{ projects: ProjectRow[] }>("/api/contribute/projects").catch(() => ({ projects: [] }));
        if (active) setProjects(data.projects);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  const ready = !!consents.recording && !!consents.transcription && !!consents.ai_processing;

  async function start() {
    setBusy(true);
    setError(null);
    try {
      const created = await post<{ projectId: string }>("/api/contribute/projects", { title: title || "My career", publicName, language, consents });
      router.push(`/contribute/${created.projectId}`);
    } catch (caught) {
      setError(messageOf(caught));
      setBusy(false);
    }
  }

  const check = (purpose: ConsentPurpose, note?: string) => (
    <label className="flex items-start gap-3 py-2 text-sm">
      <input checked={!!consents[purpose]} className="mt-1 h-4 w-4" onChange={(event) => setConsents((current) => ({ ...current, [purpose]: event.target.checked }))} type="checkbox" />
      <span><span className="font-semibold">{CONSENT_LABELS[purpose]}</span>{note ? <span className="block text-xs text-ink-light">{note}</span> : null}</span>
    </label>
  );

  return (
    <div className="mx-auto w-full max-w-5xl px-5 py-10 sm:px-8 sm:py-16">
      <p className="font-mono text-[10px] uppercase text-ink-light">Expert contributors</p>
      <h1 className="mt-2 max-w-3xl font-display text-4xl font-semibold leading-tight sm:text-6xl">Your experience deserves to be taught.</h1>
      <p className="mt-5 max-w-2xl text-lg leading-8 text-ink-mid">
        Tell the story of your career in conversation. FutureSkilz turns what you teach into short lessons for people entering the field, keeps your name on them, and shows you how they are used.
      </p>

      <ol className="mt-10 grid gap-px border border-border bg-border sm:grid-cols-3">
        {STEPS.map((step, index) => (
          <li key={step.title} className="bg-surface p-5">
            <step.icon aria-hidden="true" className="text-gold" size={22} />
            <p className="mt-3 font-mono text-[10px] uppercase text-ink-light">Step {index + 1}</p>
            <p className="mt-1 font-semibold">{step.title}</p>
            <p className="mt-2 text-sm leading-6 text-ink-mid">{step.body}</p>
          </li>
        ))}
      </ol>

      {user === undefined ? <p className="mt-10 text-sm text-ink-light" role="status">Loading…</p> : null}

      {user === null ? (
        <section className="mt-10 max-w-md border border-border bg-surface p-5" aria-label="Sign in">
          <h2 className="font-display text-2xl">Start by signing in</h2>
          <p className="mt-1 mb-4 text-sm text-ink-mid">We email you a one-tap link. No password, and no long form.</p>
          <SignInForm includeGuestProgress={false} next="/contribute" submitLabel="Email me a sign-in link" />
        </section>
      ) : null}

      {user ? (
        <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_1.1fr]">
          <section aria-label="My interviews">
            <h2 className="font-display text-2xl">Welcome, {user.displayName}</h2>
            {projects.length === 0 ? <p className="mt-2 text-sm text-ink-mid">You have no interviews yet. Start one on the right; it takes a minute to begin.</p> : null}
            <ul className="mt-3 divide-y divide-border border border-border bg-surface">
              {projects.map((project) => (
                <li key={project.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div>
                    <p className="font-semibold">{project.title}</p>
                    <p className="text-xs text-ink-light">{STATUS[project.status] ?? project.status} · {project.confirmed} of {project.facts} statements confirmed · updated {shortDate(project.updatedAt)}</p>
                  </div>
                  <div className="flex gap-3 text-sm">
                    {project.status === "interviewing" ? <Link className="primary-button min-h-10! px-3! py-2!" href={`/contribute/${project.id}`}>Continue <ArrowRight aria-hidden="true" size={14} /></Link> : null}
                    {project.status !== "withdrawn" ? <Link className="inline-flex min-h-10 items-center text-teal underline underline-offset-4" href={`/contribute/${project.id}/review`}>Review</Link> : null}
                  </div>
                </li>
              ))}
            </ul>
            <Link className="mt-4 inline-block text-sm text-teal underline underline-offset-4" href="/contribute/dashboard">Open my dashboard: lessons, usage and earnings</Link>
          </section>

          <section aria-label="Start an interview" className="border border-ink bg-surface p-5">
            <h2 className="font-display text-2xl">Start a new interview</h2>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <label className="block text-sm">
                <span className="font-mono text-[10px] uppercase text-ink-light">What should we call it?</span>
                <input className="field-input" onChange={(event) => setTitle(event.target.value)} placeholder="e.g. My career in production planning" value={title} />
              </label>
              <label className="block text-sm">
                <span className="font-mono text-[10px] uppercase text-ink-light">Name to show on your lessons</span>
                <input className="field-input" onChange={(event) => setPublicName(event.target.value)} placeholder={user.displayName} value={publicName} />
              </label>
              <label className="block text-sm sm:col-span-2">
                <span className="font-mono text-[10px] uppercase text-ink-light">Language you prefer to speak</span>
                <select className="field-input" onChange={(event) => setLanguage(event.target.value)} value={language}>
                  {LANGUAGES.map(([code, name]) => <option key={code} value={code}>{name}</option>)}
                </select>
              </label>
            </div>

            <fieldset className="mt-4 border-t border-border pt-3">
              <legend className="font-mono text-[10px] uppercase text-ink-light">In plain words, what you agree to</legend>
              <p className="mb-1 text-xs leading-5 text-ink-mid">To begin, we need the first three. You can say yes to the rest later, when you review. You can withdraw any of them at any time.</p>
              {check("recording", "Your voice or typing is saved as part of the record.")}
              {check("transcription", "Speech becomes text, which you can read and correct.")}
              {check("ai_processing", "An AI reads the transcript and proposes facts. It never decides what is true; you do.")}
              {check("content_generation", "Optional now: lessons can be drafted from what you approve.")}
              {check("publication", "Optional now: approved lessons can be shown under your name.")}
            </fieldset>

            {error ? <p className="mt-3 text-sm text-crimson" role="alert">{error}</p> : null}
            <button className="primary-button mt-4 w-full sm:w-auto" disabled={busy || !ready} onClick={() => void start()} type="button">
              {busy ? "Starting…" : "Meet my interview companion"} <ArrowRight aria-hidden="true" size={16} />
            </button>
            <p className="mt-3 text-xs leading-5 text-ink-light">The companion is an AI, not a person. Your voice and likeness are never cloned or synthesised without your separate, written consent.</p>
          </section>
        </div>
      ) : null}
    </div>
  );
}
