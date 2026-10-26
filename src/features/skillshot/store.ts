import { fetchSessionUser } from "../learner/store";

const key = "futureskilz.designed-passed.v1";

export type DesignedOutcome = { passed: boolean; evidenceAdded: boolean; skills: string[] };

/** A signed-in learner's pass is graded and recorded by the server. A guest's stays on this device and is labelled that way. */
export async function completeDesigned(id: string, answers: Record<string, string>, passedHere: boolean): Promise<DesignedOutcome> {
  if (await fetchSessionUser()) {
    const response = await fetch(`/api/designed-skill-shots/${encodeURIComponent(id)}/complete`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ answers }) });
    if (!response.ok) throw new Error("Your result could not be saved. Please try again.");
    const body = (await response.json()) as { passed: boolean; evidenceAdded: boolean; skills: string[] };
    return body;
  }
  if (passedHere) {
    try {
      const list = loadGuestPassed();
      if (!list.includes(id)) window.localStorage.setItem(key, JSON.stringify([...list, id]));
    } catch {
      /* storage can be blocked */
    }
  }
  return { passed: passedHere, evidenceAdded: false, skills: [] };
}

export function loadGuestPassed(): string[] {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(key) ?? "[]") as unknown;
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}
