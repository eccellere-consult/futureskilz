/**
 * What Arya says. Plain, formal and warm; always says she is an AI; never claims to have done anything she has not.
 * Pure text, so it is tested and can be reused by any channel (web today, WhatsApp later).
 */

export type DayPart = "morning" | "afternoon" | "evening" | "day";

/** `hour` is the visitor's local hour; -1 (server render, or unknown) gives a neutral greeting. */
export function dayPartOf(hour: number): DayPart {
  if (hour < 0 || hour > 23) return "day";
  return hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening";
}

/** Namaste, then the time of day. `respect` adds "ji" after the name, as one would to a senior professional. */
export function greeting(part: DayPart, name?: string, respect = false): string {
  const first = name?.trim().split(/\s+/)[0];
  const who = first ? `, ${first}${respect ? " ji" : ""}` : "";
  return part === "day" ? `Namaste${who}.` : `Namaste${who}. Good ${part}.`;
}

export const ARYA_IS_AI = "I am an AI, not a person.";

export function studentWelcome(part: DayPart): string {
  return [
    `${greeting(part)} Welcome to FutureSkilz. My name is Arya, and I will be your career counsellor today.`,
    `${ARYA_IS_AI} I am here to listen carefully and guide you.`,
    "In about six minutes I will ask a few simple questions about your work and where you want to go. Your answers shape a short, personal learning path.",
    "There are no right or wrong answers, and you can change anything at any time. Shall we begin?",
  ].join(" ");
}

export function coachWelcome(part: DayPart): string {
  return [
    `${greeting(part)} Welcome to FutureSkilz. My name is Arya, and I help experienced professionals share what their careers have taught them.`,
    `${ARYA_IS_AI}`,
    "Here is how it works. First, you register. Next, I interview you, by voice or by typing, over as many days as you like. Then you review everything I heard, and nothing is shared until you approve it. Finally, your lessons carry your name, and you can see how they are used.",
    "Would you like to register now?",
  ].join(" ");
}

export function coachInterviewIntro(part: DayPart, name?: string): string {
  return [
    `${greeting(part, name, true)} I am Arya, and I will be your interviewer.`,
    `${ARYA_IS_AI} I record and transcribe only with the consent you gave, I will never invent anything about your career, and nothing is published until you have reviewed and approved it.`,
    "Before we begin, how would you like to shape our conversation? I can lead, using a plan I have prepared. You can pick from my plan and edit it. Or you can structure the interview yourself.",
  ].join(" ");
}

export function coachWelcomeBack(part: DayPart, name?: string, recap?: string): string {
  return [`${greeting(part, name, true)} Welcome back. I am Arya.`, recap ?? "We can carry on exactly where we stopped.", "Nothing you told me before needs repeating."].join(" ");
}

export function planAcknowledgement(mode: "arya" | "edit" | "self"): string {
  if (mode === "arya") return "Thank you. I will lead, and you can pause, skip or change direction at any point.";
  if (mode === "edit") return "Thank you. I have your edited plan, and I will follow it. You can change it later from the side of this page.";
  return "Thank you. I will follow the structure you chose, and I will cover everything you listed.";
}

/** The deeper diagnostic: recent situations, not ratings, one at a time. */
export function diagnosticWelcome(part: DayPart, name?: string): string {
  return [
    `${greeting(part, name)} I am Arya. ${ARYA_IS_AI}`,
    "I would like to understand how you work, so I will ask about recent situations, one at a time. Please choose what you actually did, not what you think you should have done.",
    "If you have not been in a situation recently, say so. That is a good answer, and I will not guess. It takes about five minutes.",
  ].join(" ");
}

export function diagnosticClose(): string {
  return "Thank you. Here is what I heard, what it may mean, and how far to trust it. Nothing here is a verdict. It is where we start.";
}
