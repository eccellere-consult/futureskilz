"use client";

import { BookOpen, CheckCircle2, Download, Loader2, Mail } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { ApiError, messageOf, patch, post, put, useRemote } from "@/features/capture/ui/api";
import type { BookStatus } from "@/server/book/service";

type Payload = { book: BookStatus | null };

const FILES = [
  { kind: "interior", label: "Book interior (PDF)", note: "6 x 9 inch pages for KDP print." },
  { kind: "cover", label: "Full cover (PDF)", note: "Front, spine and back, with bleed." },
  { kind: "manuscript", label: "Manuscript (text)", note: "To edit in any word processor, with the KDP details." },
] as const;

/**
 * The book, as a panel that sits right where the interview is: at the end of the interview for the author, and on the review
 * screen and the editor desk for editors and admins. It is not a separate section to find.
 */
export function BookPanel({ projectId }: { projectId: string }) {
  const base = `/api/contribute/projects/${projectId}/book`;
  const { data, error, setError, reload } = useRemote<Payload>(base);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [ask, setAsk] = useState<{ chapter: number; instruction: string } | null>(null);
  const [form, setForm] = useState<{ title: string; subtitle: string; dedication: string } | null>(null);
  const book = data?.book ?? null;
  const writing = book?.status === "writing";

  useEffect(() => {
    if (!writing) return;
    const timer = setInterval(reload, 4000);
    return () => clearInterval(timer);
  }, [writing, reload]);

  const run = useCallback(async (work: () => Promise<unknown>, done?: string) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await work();
      if (done) setNotice(done);
      reload();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : messageOf(caught));
    } finally {
      setBusy(false);
    }
  }, [reload, setError]);

  const text = book?.book ?? null;
  const words = text ? [...text.introduction.sections, ...text.chapters.flatMap((c) => c.sections), ...text.conclusion.sections].reduce((n, s) => n + s.paragraphs.join(" ").split(/\s+/).length, 0) : 0;

  return (
    <div>
      <h2 className="font-display text-xl">The book</h2>
      <p className="mt-2 text-ink-mid">Arya shapes the approved interview into a short book of three to five chapters, in your own voice, with a cover and a back cover. You read it, change what you like, and approve it. The same chapters can then become training videos.</p>
      {error ? <p role="alert" className="mt-4 border border-crimson/40 p-3 text-sm text-crimson">{error}</p> : null}
      {notice ? <p role="status" className="mt-4 border border-teal p-3 text-sm text-teal">{notice}</p> : null}

      {!book || book.status === "failed" ? (
        <section className="mt-6 border border-border bg-surface p-5">
          <h2 className="font-display text-xl">What happens</h2>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-ink-mid">
            <li>Arya groups your answers into chapters and writes them up with the craft of good business books: a scene, a lesson, a method, something to try.</li>
            <li>An AI paints the front cover. The pages are laid out for a 6 x 9 inch paperback.</li>
            <li>You read the book. Nothing is shared until you approve it.</li>
          </ol>
          <p className="mt-3 text-sm text-ink-mid">Your stories are used as you told them. They are not fact-checked line by line, so the book says so on its copyright page.</p>
          {book?.status === "failed" && book.error ? <p className="mt-3 text-sm text-crimson">{book.error}</p> : null}
          <button type="button" className="primary-button mt-4" disabled={busy} onClick={() => run(() => post(base))}>{busy ? "Starting…" : "Write my book"}</button>
        </section>
      ) : null}

      {writing ? (
        <section className="mt-6 flex items-center gap-3 border border-border bg-surface p-5" aria-live="polite">
          <Loader2 className="animate-spin text-teal" aria-hidden="true" size={20} />
          <div><p className="font-semibold">{book.step || "Working"}…</p><p className="text-sm text-ink-mid">This takes a few minutes. You can leave this page and come back.</p></div>
        </section>
      ) : null}

      {book && text && (book.status === "ready" || book.status === "approved") ? (
        <>
          <section className="mt-6 border border-border bg-surface p-5">
            <div className="flex items-start gap-3"><BookOpen aria-hidden="true" className="mt-1 text-teal" size={22} />
              <div>
                <h2 className="font-display text-2xl">{text.title}</h2>
                <p className="text-ink-mid">{text.subtitle}</p>
                <p className="mt-1 text-xs text-ink-light">By {text.author} · {text.chapters.length} chapters · about {words.toLocaleString("en-IN")} words · {book.pageCount} pages · {book.source === "ai" ? "written with AI" : "your own words, tidied"}</p>
              </div>
            </div>
            <ol className="mt-4 space-y-3 text-sm">
              {text.chapters.map((chapter) => (
                <li key={chapter.number} className="border-t border-border pt-3">
                  <p className="font-semibold">Chapter {chapter.number}. {chapter.title}</p>
                  <p className="text-ink-mid">{chapter.sections[0]?.paragraphs[0]?.slice(0, 260)}…</p>
                  {ask?.chapter === chapter.number ? (
                    <div className="mt-2 space-y-2">
                      <label className="block"><span className="text-xs font-semibold">What should the writer change?</span>
                        <input className="mt-1 w-full border border-border bg-cream p-2" value={ask.instruction} maxLength={600} placeholder="For example: open with the night shift story, and make it shorter" onChange={(event) => setAsk({ ...ask, instruction: event.target.value })} />
                      </label>
                      <button type="button" className="primary-button" disabled={busy || ask.instruction.trim().length < 4} onClick={() => run(async () => { await post(base, ask); setAsk(null); }, "The writer is on it. This takes a minute or two.")}>Ask the writer</button>
                      <button type="button" className="ml-3 text-teal underline underline-offset-4" onClick={() => setAsk(null)}>Cancel</button>
                    </div>
                  ) : <button type="button" className="mt-1 text-teal underline underline-offset-4" onClick={() => setAsk({ chapter: chapter.number, instruction: "" })}>Ask the writer to rewrite this chapter</button>}
                </li>
              ))}
            </ol>
            {book.error ? <p className="mt-3 text-xs text-ink-light">Notes: {book.error}</p> : null}
          </section>

          <section className="mt-6 border border-border bg-surface p-5">
            <h2 className="font-display text-xl">Download</h2>
            <ul className="mt-2 space-y-2 text-sm">
              {FILES.map((file) => (
                <li key={file.kind}><a className="inline-flex items-center gap-2 text-teal underline underline-offset-4" href={`${base}/file?kind=${file.kind}`}><Download aria-hidden="true" size={15} />{file.label}</a> <span className="text-ink-light">{file.note}</span></li>
              ))}
            </ul>
            <button type="button" className="mt-3 inline-flex items-center gap-2 border border-border px-3 py-2 text-sm" disabled={busy} onClick={() => run(async () => { const sent = await post<{ sentTo: string }>(`${base}/email`); setNotice(`Sent to ${sent.sentTo} as two PDFs.`); })}><Mail aria-hidden="true" size={15} />Email the PDFs to the author</button>
            <p className="mt-3 text-xs text-ink-light">Publishing on KDP: upload the interior and the full cover, and say that the book was made with AI help when KDP asks. The description, keywords and categories are at the end of the manuscript file.</p>
          </section>

          <section className="mt-6 border border-border bg-surface p-5">
            <h2 className="font-display text-xl">Make it yours</h2>
            <p className="mt-1 text-sm text-ink-mid">Change the title, subtitle or dedication. The pages are laid out again. Editing withdraws an approval.</p>
            {form ? (
              <div className="mt-3 space-y-3 text-sm">
                {(["title", "subtitle", "dedication"] as const).map((field) => (
                  <label key={field} className="block"><span className="font-semibold capitalize">{field}</span>
                    <input className="mt-1 w-full border border-border bg-cream p-2" value={form[field]} maxLength={field === "title" ? 120 : 240} onChange={(event) => setForm({ ...form, [field]: event.target.value })} />
                  </label>
                ))}
                <button type="button" className="primary-button" disabled={busy} onClick={() => run(async () => { await patch(base, form); setForm(null); }, "Saved. The pages are laid out again.")}>{busy ? "Saving…" : "Save changes"}</button>
              </div>
            ) : <button type="button" className="mt-3 text-teal underline underline-offset-4" onClick={() => setForm({ title: text.title, subtitle: text.subtitle, dedication: text.dedication })}>Edit title and dedication</button>}
          </section>

          <section className="mt-6 border border-border bg-surface p-5">
            <h2 className="font-display text-xl">Approve and share</h2>
            {book.status === "approved" ? (
              <p className="mt-2 flex items-center gap-2 text-sm text-teal"><CheckCircle2 aria-hidden="true" size={18} />You approved this book. You can share the files above, and editors can turn the chapters into training.</p>
            ) : (
              <>
                <p className="mt-2 text-sm text-ink-mid">Read the book first. When you approve it, you confirm it tells your story as you want it told, and that it may be shared and used for training under your name.</p>
                <button type="button" className="primary-button mt-3" disabled={busy} onClick={() => run(() => put(base, {}), "Approved. Thank you.")}>I have read it and I approve</button>
              </>
            )}
            <button type="button" className="mt-3 block text-sm text-teal underline underline-offset-4" disabled={busy} onClick={() => run(() => post(base), "Writing a fresh version.")}>Write it again from my interview</button>
          </section>
        </>
      ) : null}
    </div>
  );
}

/** The same panel as its own page, for links that already point at it. */
export function BookWorkspace({ projectId }: { projectId: string }) {
  return <div className="mx-auto max-w-3xl px-5 py-10"><CreateFromInterview projectId={projectId} /></div>;
}

type LessonResult = { created: number; updated: number; unchanged: number; skipped: Array<{ topic: string; reason: string }> };

/**
 * What the approved interview becomes, on demand: training lessons that go to the learning workflow, and a book. Both are made
 * from the same checked content. Shown to the author, editors and admins once the author has approved the interview.
 */
export function CreateFromInterview({ projectId }: { projectId: string }) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<LessonResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const makeTraining = async () => {
    setBusy(true);
    setError(null);
    try {
      setResult(await post<LessonResult>(`/api/contribute/projects/${projectId}/lessons`));
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : messageOf(caught));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="space-y-6">
      <section aria-label="Training" className="border border-border bg-surface p-5">
        <h2 className="font-display text-xl">Training content</h2>
        <p className="mt-1 text-sm text-ink-mid">Arya turns the approved interview into lessons. Each lesson is approved by the author and an editor, then joins the learning workflow for learners.</p>
        {error ? <p role="alert" className="mt-3 text-sm text-crimson">{error}</p> : null}
        {result ? <p role="status" className="mt-3 text-sm text-teal">{result.created + result.updated} lesson draft{result.created + result.updated === 1 ? "" : "s"} ready{result.unchanged ? `, ${result.unchanged} unchanged` : ""}. They are waiting for approval in <Link className="underline underline-offset-4" href="/contribute/dashboard">the dashboard</Link>.</p> : null}
        <button type="button" className="primary-button mt-3" disabled={busy} onClick={() => void makeTraining()}>{busy ? "Creating…" : result ? "Refresh the lessons" : "Create training content"}</button>
      </section>
      <section aria-label="Book" className="border border-border bg-surface p-5"><BookPanel projectId={projectId} /></section>
    </div>
  );
}
