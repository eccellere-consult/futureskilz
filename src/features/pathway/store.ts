import { fetchSessionUser } from "../learner/store";
import { getRole } from "./roles";

const key = "futureskilz.target-role.v1";

/** Signed-in learners keep the choice on their account; guests keep it on this device. */
export async function loadTargetRoleId(): Promise<string | null> {
  if (await fetchSessionUser()) {
    const response = await fetch("/api/pathway/target-role", { cache: "no-store" });
    if (!response.ok) return null;
    const { roleId } = (await response.json()) as { roleId: string | null };
    return roleId && getRole(roleId) ? roleId : null;
  }
  try {
    const stored = window.localStorage.getItem(key);
    return stored && getRole(stored) ? stored : null;
  } catch {
    return null;
  }
}

export async function saveTargetRoleId(roleId: string | null): Promise<void> {
  if (await fetchSessionUser()) {
    const response = await fetch("/api/pathway/target-role", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ roleId }) });
    if (!response.ok) throw new Error("Your target role could not be saved. Please try again.");
    return;
  }
  try {
    if (roleId) window.localStorage.setItem(key, roleId);
    else window.localStorage.removeItem(key);
  } catch {
    /* A private window may refuse storage; the choice then lasts for this visit only. */
  }
}
