/**
 * Fraud signals for the revenue pool. These are rules that raise a flag for a person to review; none of them removes money by
 * itself. A flag costs a lesson some trust while it is open, and only a human "confirmed" decision removes a learner's activity
 * from allocations. Each rule is deliberately simple and explainable, because a coach may be asked about the result.
 */
export type FraudEvent = { lessonId: string; learnerRef: string; type: "start" | "progress" | "complete" | "material_use" | "check_result" | "return"; seconds: number; occurredAt: string };
export type FraudRating = { lessonId: string; learnerRef: string; rating: number; occurredAt: string };
export type FraudLesson = { id: string; durationSeconds: number; authorLearnerRefs: string[] };
export type FraudReceipt = { externalRef: string; grossMinor: number; refundMinor: number; receivedAt: string };

export type Severity = "low" | "medium" | "high";
export type FraudFlagDraft = { subjectType: "learner" | "lesson" | "receipt"; subjectRef: string; rule: string; severity: Severity; windowKey: string; details: Record<string, unknown>; summary: string };

export const RULES: Record<string, { label: string; why: string }> = {
  self_use: { label: "Author's own activity", why: "The author completed their own lesson. It is recorded but should not earn." },
  speed_completion: { label: "Finished far faster than the lesson runs", why: "Repeated completions in under a quarter of the lesson's length suggest the lesson was skipped through." },
  completion_burst: { label: "Many completions in a short time", why: "More lessons finished in half an hour than a person can take in." },
  ratings_without_completion: { label: "Ratings from people who did not finish", why: "Several ratings came from learners with no completion. Ratings only count after finishing." },
  rating_burst: { label: "A burst of high ratings", why: "Many high ratings arrived within an hour, which is unusual for organic feedback." },
  refund_spike: { label: "High refund share", why: "A large share of receipts in the period was refunded." },
};

const minutes = (a: string, b: string): number => Math.abs(new Date(a).getTime() - new Date(b).getTime()) / 60_000;
const day = (iso: string): string => iso.slice(0, 10);

export function detectFraud(input: { events: FraudEvent[]; ratings: FraudRating[]; lessons: FraudLesson[]; receipts?: FraudReceipt[] }): FraudFlagDraft[] {
  const flags: FraudFlagDraft[] = [];
  const lessonOf = new Map(input.lessons.map((lesson) => [lesson.id, lesson]));

  // 1. The author using their own lesson.
  const selfSeen = new Set<string>();
  for (const event of input.events) {
    const lesson = lessonOf.get(event.lessonId);
    if (!lesson || event.type !== "complete" || !lesson.authorLearnerRefs.includes(event.learnerRef)) continue;
    const key = `${event.learnerRef}|${event.lessonId}`;
    if (selfSeen.has(key)) continue;
    selfSeen.add(key);
    flags.push({ subjectType: "learner", subjectRef: event.learnerRef, rule: "self_use", severity: "medium", windowKey: event.lessonId.slice(0, 36), details: { lessonId: event.lessonId }, summary: "An author completed their own lesson." });
  }

  // 2. Completions far faster than the lesson, by the same learner, at least three times.
  const progress = new Map<string, number>();
  for (const event of input.events) if (event.type === "progress") progress.set(`${event.learnerRef}|${event.lessonId}`, (progress.get(`${event.learnerRef}|${event.lessonId}`) ?? 0) + event.seconds);
  const fastBy = new Map<string, string[]>();
  for (const event of input.events) {
    const lesson = lessonOf.get(event.lessonId);
    if (!lesson || event.type !== "complete" || lesson.durationSeconds < 120) continue;
    if ((progress.get(`${event.learnerRef}|${event.lessonId}`) ?? 0) < lesson.durationSeconds * 0.25) fastBy.set(event.learnerRef, [...new Set([...(fastBy.get(event.learnerRef) ?? []), event.lessonId])]);
  }
  for (const [learnerRef, lessonIds] of fastBy) if (lessonIds.length >= 3) flags.push({ subjectType: "learner", subjectRef: learnerRef, rule: "speed_completion", severity: "medium", windowKey: "all", details: { lessons: lessonIds.length }, summary: `Finished ${lessonIds.length} lessons in under a quarter of their length.` });

  // 3. Many completions in a half hour.
  const completesBy = new Map<string, string[]>();
  for (const event of input.events) if (event.type === "complete") completesBy.set(event.learnerRef, [...(completesBy.get(event.learnerRef) ?? []), event.occurredAt]);
  for (const [learnerRef, times] of completesBy) {
    const sorted = [...times].sort();
    for (let i = 0; i + 7 < sorted.length; i += 1) {
      if (minutes(sorted[i], sorted[i + 7]) <= 30) { flags.push({ subjectType: "learner", subjectRef: learnerRef, rule: "completion_burst", severity: "high", windowKey: day(sorted[i]), details: { completions: 8, minutes: Math.round(minutes(sorted[i], sorted[i + 7])) }, summary: "Eight completions within half an hour." }); break; }
    }
  }

  // 4 and 5. Ratings: from people who did not finish, and bursts of high ratings.
  const completed = new Set(input.events.filter((event) => event.type === "complete").map((event) => `${event.learnerRef}|${event.lessonId}`));
  const byLesson = new Map<string, FraudRating[]>();
  for (const rating of input.ratings) byLesson.set(rating.lessonId, [...(byLesson.get(rating.lessonId) ?? []), rating]);
  for (const [lessonId, ratings] of byLesson) {
    const unfinished = ratings.filter((rating) => !completed.has(`${rating.learnerRef}|${lessonId}`));
    if (unfinished.length >= 5) flags.push({ subjectType: "lesson", subjectRef: lessonId, rule: "ratings_without_completion", severity: "medium", windowKey: "all", details: { ratings: unfinished.length }, summary: `${unfinished.length} ratings came from learners who never finished.` });
    const high = ratings.filter((rating) => rating.rating >= 4).map((rating) => rating.occurredAt).sort();
    for (let i = 0; i + 7 < high.length; i += 1) {
      if (minutes(high[i], high[i + 7]) <= 60) { flags.push({ subjectType: "lesson", subjectRef: lessonId, rule: "rating_burst", severity: "medium", windowKey: day(high[i]), details: { ratings: 8 }, summary: "Eight high ratings arrived within an hour." }); break; }
    }
  }

  // 6. Refund spike across receipts.
  const receipts = input.receipts ?? [];
  if (receipts.length >= 5) {
    const gross = receipts.reduce((s, r) => s + r.grossMinor, 0);
    const refunded = receipts.reduce((s, r) => s + r.refundMinor, 0);
    if (gross > 0 && refunded / gross > 0.3) flags.push({ subjectType: "receipt", subjectRef: "period", rule: "refund_spike", severity: "low", windowKey: day(receipts[0].receivedAt).slice(0, 7), details: { refundShare: Number((refunded / gross).toFixed(2)) }, summary: `${Math.round((refunded / gross) * 100)}% of receipts were refunded.` });
  }
  return flags;
}

/** Trust (0 to 1) for a lesson: lowered while flags are open, and sharply when confirmed. Several flags compound. */
export function lessonTrust(flags: Array<{ status: "open" | "confirmed" | "dismissed"; severity: Severity }>): number {
  let trust = 1;
  for (const flag of flags) {
    if (flag.status === "dismissed") continue;
    trust *= flag.status === "confirmed" ? 0.2 : flag.severity === "high" ? 0.4 : flag.severity === "medium" ? 0.7 : 0.9;
  }
  return Number(Math.max(0.05, trust).toFixed(3));
}
