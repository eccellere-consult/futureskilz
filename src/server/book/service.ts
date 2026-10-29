import "server-only";

import { and, asc, eq } from "drizzle-orm";

import { getQuestion } from "@/features/capture/question-bank";
import { MIN_WORDS_FOR_BOOK, bookSchema, wordCount, type Book, type SourceAnswer } from "@/features/book/types";
import { DatabaseAgentRunRecorder } from "@/server/agents/database-recorder";
import { createBookWriterAgent, createChapterWriterAgent } from "@/server/agents/book-writer";
import { AgentRunner } from "@/server/agents/runner";
import { CaptureError, audit, database, newUuid, requireProject } from "@/server/capture/shared";
import { createDatabase } from "@/server/db/client";
import { bookProjects, kcSegments, users } from "@/server/db/schema";
import { getServerEnvironment } from "@/server/env";
import { createProviders } from "@/server/providers";

import { generateCoverArt } from "./cover-art";
import { renderCover, renderInterior, type CoverArt } from "./pdf";

export type BookStatus = { id: string; status: "writing" | "ready" | "failed" | "approved"; step: string; source: string; pageCount: number | null; hasArt: boolean; error: string | null; approvedAt: string | null; book: Book | null };
export type BookFile = "interior" | "cover" | "manuscript";

/** What the author said, with the question that drew it out, in the order it was said. */
export async function gatherAnswers(projectId: string): Promise<{ answers: SourceAnswer[]; words: number }> {
  const db = await database();
  const rows = await db.select().from(kcSegments).where(eq(kcSegments.projectId, projectId)).orderBy(asc(kcSegments.seq));
  const answers: SourceAnswer[] = [];
  let lastQuestion = "";
  for (const row of rows) {
    if (row.speaker === "companion") { lastQuestion = row.text.replace(/\s+/g, " ").slice(0, 300); continue; }
    if (row.source !== "interview" || !row.questionKey) continue;
    const def = getQuestion(row.questionKey);
    answers.push({ key: row.questionKey, phase: def?.phase ?? "O", question: lastQuestion || def?.text || "", answer: row.text });
  }
  return { answers, words: answers.reduce((n, item) => n + wordCount(item.answer), 0) };
}

const toStatus = (row: typeof bookProjects.$inferSelect): BookStatus => ({ id: row.id, status: row.status, step: row.step, source: row.source, pageCount: row.pageCount, hasArt: Boolean(row.coverArt), error: row.error, approvedAt: row.approvedAt ? row.approvedAt.toISOString() : null, book: (row.book as unknown as Book | null) ?? null });

export async function getBookStatus(userId: string, projectId: string): Promise<BookStatus | null> {
  const db = await database();
  await requireProject(db, userId, projectId, { staff: true });
  const [row] = await db.select().from(bookProjects).where(eq(bookProjects.projectId, projectId)).limit(1);
  return row ? toStatus(row) : null;
}

/** Starts writing. The host cuts off long requests, so this returns at once and the screen polls for the finished book. */
export async function startBook(userId: string, projectId: string): Promise<BookStatus> {
  const db = await database();
  const project = await requireProject(db, userId, projectId, { staff: true });
  const [existing] = await db.select().from(bookProjects).where(eq(bookProjects.projectId, projectId)).limit(1);
  if (existing?.status === "writing" && Date.now() - existing.updatedAt.getTime() < 10 * 60_000) return toStatus(existing);
  const { words } = await gatherAnswers(projectId);
  if (words < MIN_WORDS_FOR_BOOK) throw new CaptureError(409, `A book needs more of the interview first: about ${MIN_WORDS_FOR_BOOK} words of answers, and there are ${words} so far.`);
  const id = existing?.id ?? newUuid();
  const values = { status: "writing" as const, step: "Reading the interview", error: null, approvedAt: null };
  if (existing) await db.update(bookProjects).set(values).where(eq(bookProjects.id, id));
  else await db.insert(bookProjects).values({ id, projectId, contributorId: project.contributorId, ...values });
  await audit(db, userId, "book.start", "book_project", id);
  void writeBook(id, projectId, userId);
  const [row] = await db.select().from(bookProjects).where(eq(bookProjects.id, id));
  return toStatus(row);
}

async function setStep(id: string, step: string) {
  await (await database()).update(bookProjects).set({ step }).where(eq(bookProjects.id, id)).catch(() => undefined);
}

async function writeBook(id: string, projectId: string, userId: string): Promise<void> {
  const db = await database();
  try {
    const { answers } = await gatherAnswers(projectId);
    const [author] = await db.select({ name: users.displayName }).from(users).where(eq(users.id, (await requireProject(db, userId, projectId, { staff: true })).contributorId)).limit(1);
    await setStep(id, "Shaping the chapters");
    const { ai } = createProviders();
    const runner = new AgentRunner(new DatabaseAgentRunRecorder(createDatabase(), ai));
    const result = await runner.run(createBookWriterAgent(ai), { author: author?.name ?? "The Author", answers }, { userId });
    const book = bookSchema.parse(result.book);
    await setStep(id, "Painting the cover");
    const art = await generateCoverArt(book, getServerEnvironment().OPENAI_API_KEY);
    await setStep(id, "Laying out the pages");
    const interior = await renderInterior(book);
    const cover = await renderCover(book, interior.pages, art ? { data: art, kind: "png" } : null);
    await db.update(bookProjects).set({ status: "ready", step: "Ready to read", book: book as unknown as Record<string, unknown>, source: result.source, pageCount: interior.pages, interiorPdf: interior.pdf.toString("base64"), coverPdf: cover.toString("base64"), coverArt: art ? art.toString("base64") : null, error: result.notes.join(" ") || null }).where(eq(bookProjects.id, id));
  } catch (error) {
    console.error("[book]", error instanceof Error ? error.message : error);
    await db.update(bookProjects).set({ status: "failed", step: "", error: "The book could not be finished. Try again in a minute." }).where(eq(bookProjects.id, id)).catch(() => undefined);
  }
}

/**
 * On request: the writer rewrites one chapter, following an instruction ("make it shorter", "open with the plant fire",
 * "more practical"). The author, an editor or an admin can ask. The chapter is rewritten from the interview answers, not from the
 * old text alone, so nothing is invented. An approval is withdrawn, because the words changed.
 */
export async function requestChapter(userId: string, projectId: string, number: number, instruction: string): Promise<BookStatus> {
  const db = await database();
  await requireProject(db, userId, projectId, { staff: true });
  const [row] = await db.select().from(bookProjects).where(eq(bookProjects.projectId, projectId)).limit(1);
  if (!row?.book || row.status === "writing") throw new CaptureError(409, "Write the book first, and wait for it to finish.");
  const book = row.book as unknown as Book;
  if (!book.chapters.some((chapter) => chapter.number === number)) throw new CaptureError(404, "That chapter was not found.");
  const clean = instruction.replace(/\s+/g, " ").trim().slice(0, 600);
  if (clean.length < 4) throw new CaptureError(400, "Tell the writer what you want changed, in a few words.");
  const { ai } = createProviders();
  if (ai.name === "deterministic") throw new CaptureError(409, "The writer needs the AI service, which is not set up on this site.");
  await db.update(bookProjects).set({ status: "writing", step: `Rewriting chapter ${number}` }).where(eq(bookProjects.id, row.id));
  await audit(db, userId, "book.chapter.request", "book_project", row.id, { chapter: number, instruction: clean });
  void rewriteChapter(row.id, projectId, userId, number, clean);
  const [fresh] = await db.select().from(bookProjects).where(eq(bookProjects.id, row.id));
  return toStatus(fresh);
}

async function rewriteChapter(id: string, projectId: string, userId: string, number: number, instruction: string): Promise<void> {
  const db = await database();
  const [row] = await db.select().from(bookProjects).where(eq(bookProjects.id, id)).limit(1);
  const previous = row?.status === "writing" && row.book ? (row.book as unknown as Book) : null;
  try {
    if (!previous) throw new Error("book missing");
    const { answers } = await gatherAnswers(projectId);
    const { ai } = createProviders();
    const runner = new AgentRunner(new DatabaseAgentRunRecorder(createDatabase(), ai));
    const result = await runner.run(createChapterWriterAgent(ai), { author: previous.author, answers, book: previous, number, instruction }, { userId });
    const next = bookSchema.parse({ ...previous, chapters: previous.chapters.map((chapter) => (chapter.number === number ? result.chapter : chapter)), generatedAt: new Date().toISOString() });
    const art: CoverArt = row.coverArt ? { data: Buffer.from(row.coverArt, "base64"), kind: "png" } : null;
    await setStep(id, "Laying out the pages");
    const interior = await renderInterior(next);
    const cover = await renderCover(next, interior.pages, art);
    await db.update(bookProjects).set({ status: "ready", step: "Ready to read", book: next as unknown as Record<string, unknown>, pageCount: interior.pages, interiorPdf: interior.pdf.toString("base64"), coverPdf: cover.toString("base64"), approvedAt: null, error: result.note }).where(eq(bookProjects.id, id));
  } catch (error) {
    console.error("[book chapter]", error instanceof Error ? error.message : error);
    // The book is unchanged; put it back so it can be read and downloaded.
    await db.update(bookProjects).set({ status: "ready", step: "Ready to read", error: "The chapter could not be rewritten, so the book is unchanged. Try again in a minute." }).where(eq(bookProjects.id, id)).catch(() => undefined);
  }
}

/** The author's own edits to the front of the book, then the PDFs are laid out again. */
export async function editBook(userId: string, projectId: string, patch: { title?: string; subtitle?: string; dedication?: string }): Promise<BookStatus> {
  const db = await database();
  await requireProject(db, userId, projectId, { staff: true });
  const [row] = await db.select().from(bookProjects).where(eq(bookProjects.projectId, projectId)).limit(1);
  if (!row?.book || row.status === "writing") throw new CaptureError(409, "There is no finished book to change yet.");
  const clean = (value: string | undefined, max: number) => (typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, max) : undefined);
  const next = bookSchema.parse({ ...(row.book as unknown as Book), ...(clean(patch.title, 120) ? { title: clean(patch.title, 120) } : {}), ...(clean(patch.subtitle, 200) ? { subtitle: clean(patch.subtitle, 200) } : {}), ...(patch.dedication !== undefined ? { dedication: clean(patch.dedication, 240) ?? "" } : {}) });
  const art: CoverArt = row.coverArt ? { data: Buffer.from(row.coverArt, "base64"), kind: "png" } : null;
  const interior = await renderInterior(next);
  const cover = await renderCover(next, interior.pages, art);
  await db.update(bookProjects).set({ book: next as unknown as Record<string, unknown>, pageCount: interior.pages, interiorPdf: interior.pdf.toString("base64"), coverPdf: cover.toString("base64"), status: "ready", approvedAt: null }).where(eq(bookProjects.id, row.id));
  await audit(db, userId, "book.edit", "book_project", row.id);
  const [fresh] = await db.select().from(bookProjects).where(eq(bookProjects.id, row.id));
  return toStatus(fresh);
}

/** The author's approval: the book may now be shared, published and used for training. Editing the book withdraws it. */
export async function approveBook(userId: string, projectId: string): Promise<BookStatus> {
  const db = await database();
  await requireProject(db, userId, projectId);
  const [row] = await db.select().from(bookProjects).where(and(eq(bookProjects.projectId, projectId), eq(bookProjects.status, "ready"))).limit(1);
  if (!row) throw new CaptureError(409, "Read the finished book first, then approve it.");
  await db.update(bookProjects).set({ status: "approved", approvedAt: new Date() }).where(eq(bookProjects.id, row.id));
  await audit(db, userId, "book.approve", "book_project", row.id);
  const [fresh] = await db.select().from(bookProjects).where(eq(bookProjects.id, row.id));
  return toStatus(fresh);
}

/** Plain-text manuscript, for editing in any word processor. */
export function manuscriptText(book: Book): string {
  const lines: string[] = [book.title, book.subtitle, `by ${book.author}`, "", book.dedication, "", `# ${book.introduction.title}`];
  const writeSections = (sections: Book["introduction"]["sections"]) => { for (const s of sections) { if (s.heading) lines.push("", `## ${s.heading}`); for (const p of s.paragraphs) lines.push("", p); if (s.pullQuote) lines.push("", `> ${s.pullQuote}`); } };
  writeSections(book.introduction.sections);
  for (const chapter of book.chapters) {
    lines.push("", `# Chapter ${chapter.number}: ${chapter.title}`, chapter.subtitle ?? "");
    writeSections(chapter.sections);
    lines.push("", "Key takeaways:", ...chapter.takeaways.map((t) => `- ${t}`), "", `Try this week: ${chapter.tryThis}`);
  }
  lines.push("", `# ${book.conclusion.title}`);
  writeSections(book.conclusion.sections);
  lines.push("", "# About the Author", ...book.aboutAuthor.flatMap((p) => ["", p]), "", "---", book.disclosure, "", "KDP details", `Description: ${book.kdp.description}`, `Keywords: ${book.kdp.keywords.join("; ")}`, `Categories: ${book.kdp.categories.join("; ")}`);
  return lines.join("\n");
}

export async function bookFile(userId: string, projectId: string, kind: BookFile): Promise<{ body: Buffer; type: string; name: string }> {
  const db = await database();
  await requireProject(db, userId, projectId, { staff: true });
  const [row] = await db.select().from(bookProjects).where(eq(bookProjects.projectId, projectId)).limit(1);
  if (!row?.book || row.status === "writing" || row.status === "failed") throw new CaptureError(404, "The book is not ready yet.");
  const book = row.book as unknown as Book;
  const stem = book.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "book";
  if (kind === "manuscript") return { body: Buffer.from(manuscriptText(book), "utf8"), type: "text/plain; charset=utf-8", name: `${stem}-manuscript.txt` };
  const data = kind === "cover" ? row.coverPdf : row.interiorPdf;
  if (!data) throw new CaptureError(404, "That file is not ready yet.");
  return { body: Buffer.from(data, "base64"), type: "application/pdf", name: `${stem}-${kind}.pdf` };
}
