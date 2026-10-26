import "server-only";

import { eq } from "drizzle-orm";

import type { DiagnosticAnswer } from "@/features/diagnostic/engine";
import { createDatabase } from "@/server/db/client";
import { learnerDiagnostic } from "@/server/db/schema";

export async function loadDiagnostic(userId: string): Promise<{ answers: DiagnosticAnswer[]; completed: boolean }> {
  const [row] = await createDatabase().select().from(learnerDiagnostic).where(eq(learnerDiagnostic.userId, userId)).limit(1);
  return { answers: (row?.answers as unknown as DiagnosticAnswer[] | undefined) ?? [], completed: Boolean(row?.completedAt) };
}

export async function saveDiagnostic(userId: string, answers: DiagnosticAnswer[], complete: boolean): Promise<void> {
  const completedAt = complete ? new Date() : null;
  const values = { answers: answers as unknown as Array<Record<string, unknown>>, completedAt };
  await createDatabase().insert(learnerDiagnostic).values({ userId, ...values }).onDuplicateKeyUpdate({ set: values });
}
