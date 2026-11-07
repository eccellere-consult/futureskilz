/** The demo people. Their addresses end in a reserved ".test" domain, so no real mailbox can ever receive a sign-in link for them. */
export const DEMO_DOMAIN = "demo.futureskilz.test";

export type PersonaId = "learner" | "coach" | "editor" | "admin";

export const PERSONAS: Record<PersonaId, { id: PersonaId; email: string; name: string; roles: string[]; landing: string; summary: string }> = {
  learner: { id: "learner", email: `demo.learner@${DEMO_DOMAIN}`, name: "Meera Iyer (Demo Learner)", roles: [], landing: "/learn", summary: "A production planner early in their career: skills check, personal journey, a worked problem, lessons completed and rated." },
  coach: { id: "coach", email: `demo.coach@${DEMO_DOMAIN}`, name: "Asha Rao (Demo Coach)", roles: ["contributor"], landing: "/contribute/dashboard", summary: "A retired plant leader whose finished interview became approved, published lessons with usage and an earnings preview." },
  editor: { id: "editor", email: `demo.editor@${DEMO_DOMAIN}`, name: "Edith Nair (Demo Editor)", roles: ["editor"], landing: "/contribute/editor", summary: "Turns approved knowledge into lessons, reviews them and publishes after the coach approves." },
  admin: { id: "admin", email: `demo.admin@${DEMO_DOMAIN}`, name: "Adam Khan (Demo Admin)", roles: ["admin"], landing: "/admin", summary: "Owns the revenue-share policy, receipts, allocation runs and statements, and can credit multiple contributors." },
};

export const COACH2 = { email: `demo.coach2@${DEMO_DOMAIN}`, name: "Ravi Menon (Demo Co-author)" };

export const isDemoEmail = (email: string): boolean => email.toLowerCase().endsWith(`@${DEMO_DOMAIN}`);
