import { fetchSessionUser } from "../learner/store";
import type { DiagnosticAnswer } from "./engine";

const key = "futureskilz.diagnostic.v1";

/** Signed-in learners keep their answers on the account; guests keep them on this device and are told so. */
export async function loadDiagnosticAnswers(): Promise<{ answers: DiagnosticAnswer[]; completed: boolean }> {
  if (await fetchSessionUser()) {
    const response = await fetch("/api/diagnostic", { cache: "no-store" });
    return response.ok ? ((await response.json()) as { answers: DiagnosticAnswer[]; completed: boolean }) : { answers: [], completed: false };
  }
  try {
    const stored = JSON.parse(window.localStorage.getItem(key) ?? "null") as { answers?: DiagnosticAnswer[]; completed?: boolean } | null;
    return { answers: Array.isArray(stored?.answers) ? stored.answers : [], completed: Boolean(stored?.completed) };
  } catch {
    return { answers: [], completed: false };
  }
}

export async function saveDiagnosticAnswers(answers: DiagnosticAnswer[], complete: boolean): Promise<void> {
  if (await fetchSessionUser()) {
    const response = await fetch("/api/diagnostic", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ answers, complete }) });
    if (!response.ok) throw new Error("Your answers could not be saved. Please try again.");
    return;
  }
  try {
    window.localStorage.setItem(key, JSON.stringify({ answers, completed: complete }));
  } catch {
    /* A private window may refuse storage; the conversation still works for this visit. */
  }
}

export async function clearDiagnosticAnswers(): Promise<void> {
  await saveDiagnosticAnswers([], false);
}
