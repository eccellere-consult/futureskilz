import "server-only";

import { type ConsentPurpose, type ConsentState } from "@/features/capture/gates";
import { newInterviewState } from "@/features/capture/planner";
import { kcConsents, kcContributors, kcProjects, userRoles, users } from "@/server/db/schema";
import { eq } from "drizzle-orm";

import { TERMS_VERSION } from "./interview-service";
import { CaptureError, audit, database, newUuid } from "./shared";
import { addUpload, type UploadMeta, type UploadResult } from "./upload-service";

/** Consent purposes a project built from a document can record. Recording and transcription do not apply: nobody is recorded. */
const SOURCE_PURPOSES: ConsentPurpose[] = ["ai_processing", "content_generation", "publication", "avatar_voice"];

export const MIN_PASTED_CHARS = 200;
export const MAX_PASTED_CHARS = 200_000;

export type CreateSourceInput = { title: string; language: string; publicName?: string; consents: ConsentState };

/** Starts a project from a document or text instead of an interview. The contributor must agree to AI reading first. */
export async function createSourceProject(userId: string, input: CreateSourceInput): Promise<{ projectId: string }> {
  const db = await database();
  const title = input.title.trim().slice(0, 200) || "My source material";
  if (!input.consents.ai_processing) throw new CaptureError(400, "To start, please agree to AI reading of your material. You can decide about lessons and publication later.");

  return db.transaction(async (tx) => {
    const [user] = await tx.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!user) throw new CaptureError(401, "Please sign in first.");
    await tx.insert(userRoles).values({ userId, role: "contributor" }).onDuplicateKeyUpdate({ set: { role: "contributor" } });
    await tx
      .insert(kcContributors)
      .values({ userId, publicName: (input.publicName?.trim() || user.displayName).slice(0, 160), language: input.language })
      .onDuplicateKeyUpdate({ set: { language: input.language, ...(input.publicName?.trim() ? { publicName: input.publicName.trim().slice(0, 160) } : {}) } });

    const projectId = newUuid();
    const state = { ...newInterviewState(), stage: "complete" as const };
    await tx.insert(kcProjects).values({ id: projectId, contributorId: userId, title, kind: "source", status: "interviewing", language: input.language, state: state as unknown as Record<string, unknown> });
    for (const purpose of SOURCE_PURPOSES) {
      if (input.consents[purpose] === undefined) continue;
      await tx.insert(kcConsents).values({ contributorId: userId, projectId, purpose, granted: !!input.consents[purpose], termsVersion: TERMS_VERSION });
    }
    await audit(tx, userId, "project.create", "project", projectId, { kind: "source", termsVersion: TERMS_VERSION });
    return { projectId };
  });
}

/** Only web addresses are kept as a citation; the address is never fetched here. */
export function cleanSourceUrl(value: string | undefined | null): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("scheme");
    return url.toString().slice(0, 500);
  } catch {
    throw new CaptureError(400, "That web address does not look right. Start it with https://");
  }
}

/** Pasted text becomes a source like a small document: same reading, same locators, same rights checks. */
export async function addPastedSource(
  userId: string,
  projectId: string,
  input: { title: string; text: string; url?: string | null },
  meta: Pick<UploadMeta, "ownership" | "intendedUse" | "attested">,
): Promise<UploadResult> {
  const text = input.text.replace(/\u0000/g, "").trim();
  if (text.length < MIN_PASTED_CHARS) throw new CaptureError(400, `Please paste at least ${MIN_PASTED_CHARS} characters, enough to teach from.`);
  if (text.length > MAX_PASTED_CHARS) throw new CaptureError(413, `That text is longer than ${MAX_PASTED_CHARS.toLocaleString("en-IN")} characters. Split it into two pastes.`);
  const url = cleanSourceUrl(input.url);
  const title = input.title.trim().slice(0, 120).replace(/[\\/]/g, "-") || "Pasted text";
  return addUpload(userId, projectId, { name: `${title}.txt`, type: "text/pasted", bytes: Buffer.from(text, "utf8") }, { ...meta, sourceKind: url ? "link_text" : "pasted", sourceUrl: url });
}
