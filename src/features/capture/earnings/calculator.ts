import { WEIGHT_KEYS, type RevenuePolicy, type WeightKey } from "./policy";

/**
 * Turns receipts, learning events, ratings and lesson attribution into an auditable allocation, using a versioned policy.
 *
 * What it guarantees:
 * - Whole minor units only; every split uses largest-remainder rounding, so parts add up to the whole exactly.
 * - Repeated or inflated events are recorded but not counted beyond the policy caps.
 * - A rating changes an allocation only for learners who actually completed the lesson, and only after the policy's minimum
 *   number of ratings; ratings alone can never create earnings.
 * - A statement is `illustrative` and not payable unless the policy was approved.
 */

export type Receipt = {
  id: string;
  grossMinor: number;
  refundMinor: number;
  feeMinor: number;
  taxMinor: number;
  currency: string;
  receivedAt: string;
  status: "eligible" | "held" | "refunded" | "disputed";
};

export type LearningEvent = {
  id: string;
  lessonId: string;
  learnerRef: string;
  type: "start" | "progress" | "complete" | "material_use" | "check_result" | "return";
  /** Seconds of engagement for `progress` events. */
  seconds: number;
  /** For `check_result`: the learner's score from 0 to 100. */
  value?: number | null;
  occurredAt: string;
};

export type Rating = { lessonId: string; learnerRef: string; rating: number; occurredAt: string };

export type LessonInfo = {
  id: string;
  title: string;
  version: number;
  /** Who is credited for this lesson, in basis points adding up to 10000. */
  attribution: Array<{ contributorId: string; shareBp: number }>;
  /** Used only by the QVS formula. 0 to 1; missing means neutral (1). */
  quality?: number;
  /** 0 to 1: lowered by fraud flags still under review. Missing means 1. */
  trust?: number;
  /** Days since the lesson was last published or updated. */
  ageDays?: number;
};

export type LessonMetrics = {
  lessonId: string;
  title: string;
  consumptionSeconds: number;
  completions: number;
  materialUses: number;
  ratings: number;
  meanRating: number | null;
  usefulnessPoints: number;
  /** The seven QVS factors (0 to 1), present when the policy uses the QVS formula. */
  qvs?: { usage: number; depth: number; usefulness: number; quality: number; outcome: number; freshness: number; trust: number; raw: number };
  /** Share of each measure (0 to 1) and the combined score that sizes the allocation. */
  shares: Record<WeightKey, number>;
  score: number;
  allocationMinor: number;
};

export type ContributorLine = { lessonId: string; title: string; shareBp: number; lessonAllocationMinor: number; amountMinor: number };

export type ContributorStatement = {
  contributorId: string;
  totalMinor: number;
  payable: boolean;
  lines: ContributorLine[];
};

export type AllocationRun = {
  policyVersion: string;
  policyApproved: boolean;
  currency: string;
  period: { start: string; end: string };
  status: "illustrative" | "draft";
  inputs: {
    receiptsCounted: number;
    receiptsExcluded: number;
    grossMinor: number;
    refundMinor: number;
    feeMinor: number;
    taxMinor: number;
    eligibleNetMinor: number;
    poolMinor: number;
    eventsCounted: number;
    eventsNotCounted: number;
  };
  /** Weights actually applied after moving the weight of any measure with no activity onto the others. */
  appliedWeights: Record<WeightKey, number>;
  lessons: LessonMetrics[];
  contributors: ContributorStatement[];
  unallocatedMinor: number;
  payableAfter: string;
  notes: string[];
};

const inPeriod = (iso: string, start: string, end: string): boolean => iso >= start && iso < end;
const day = (iso: string): string => iso.slice(0, 10);

export function eligibleNet(receipt: Receipt, policy: RevenuePolicy): number {
  const gross = receipt.grossMinor;
  if (policy.receiptBasis === "gross") return gross;
  if (policy.receiptBasis === "net_of_refunds") return Math.max(0, gross - receipt.refundMinor);
  return Math.max(0, gross - receipt.refundMinor - receipt.feeMinor - receipt.taxMinor);
}

/** Splits `total` across `weights` so the parts are whole numbers that add up to `total` exactly (largest remainder). */
export function splitWhole(total: number, weights: number[]): number[] {
  const sum = weights.reduce((a, b) => a + b, 0);
  if (total <= 0 || sum <= 0) return weights.map(() => 0);
  const exact = weights.map((weight) => (total * weight) / sum);
  const floors = exact.map(Math.floor);
  let left = total - floors.reduce((a, b) => a + b, 0);
  const order = exact.map((value, index) => ({ index, remainder: value - Math.floor(value) })).sort((a, b) => b.remainder - a.remainder || a.index - b.index);
  for (const { index } of order) {
    if (left <= 0) break;
    floors[index] += 1;
    left -= 1;
  }
  return floors;
}

type Counted = { events: LearningEvent[]; notCounted: number };

/** Applies the policy's caps: at most N counted events per learner, lesson and day; progress seconds capped per day. */
export function countEvents(events: LearningEvent[], policy: RevenuePolicy, start: string, end: string): Counted {
  const counted: LearningEvent[] = [];
  let notCounted = 0;
  const perKey = new Map<string, number>();
  const seconds = new Map<string, number>();
  const sorted = [...events].filter((event) => inPeriod(event.occurredAt, start, end)).sort((a, b) => a.occurredAt.localeCompare(b.occurredAt) || a.id.localeCompare(b.id));
  const seenIds = new Set<string>();
  for (const event of sorted) {
    if (seenIds.has(event.id)) {
      notCounted += 1;
      continue;
    }
    seenIds.add(event.id);
    const key = `${event.learnerRef}|${event.lessonId}|${day(event.occurredAt)}`;
    const used = perKey.get(key) ?? 0;
    if (used >= policy.antiGaming.maxCountedEventsPerLearnerLessonDay && event.type !== "complete") {
      notCounted += 1;
      continue;
    }
    perKey.set(key, used + 1);
    if (event.type === "progress") {
      const already = seconds.get(key) ?? 0;
      const room = Math.max(0, policy.consumption.capSecondsPerLearnerLessonDay - already);
      const take = Math.min(room, Math.max(0, event.seconds));
      seconds.set(key, already + take);
      counted.push({ ...event, seconds: take });
    } else counted.push(event);
  }
  return { events: counted, notCounted };
}

export function calculateAllocations(input: {
  policy: RevenuePolicy;
  policyApproved: boolean;
  period: { start: string; end: string };
  receipts: Receipt[];
  events: LearningEvent[];
  ratings: Rating[];
  lessons: LessonInfo[];
  /** Learners whose activity is confirmed fraud: their events and ratings count for nothing. */
  excludedLearners?: string[];
}): AllocationRun {
  const { policy, period } = input;
  const excluded_ = new Set(input.excludedLearners ?? []);
  input = { ...input, events: input.events.filter((event) => !excluded_.has(event.learnerRef)), ratings: input.ratings.filter((rating) => !excluded_.has(rating.learnerRef)) };
  const notes: string[] = [];
  const receipts = input.receipts.filter((receipt) => receipt.status === "eligible" && receipt.currency.toUpperCase() === policy.currency && inPeriod(receipt.receivedAt, period.start, period.end));
  const excluded = input.receipts.length - receipts.length;
  const eligibleNetMinor = receipts.reduce((sum, receipt) => sum + eligibleNet(receipt, policy), 0);
  const poolMinor = Math.floor((eligibleNetMinor * policy.contributorPoolBp) / 10000);
  if (policy.contributorPoolBp === 0) notes.push("The policy sets the contributor pool to 0%, so no amount is allocated.");

  const { events, notCounted } = countEvents(input.events, policy, period.start, period.end);
  const lessonIds = new Set(input.lessons.map((lesson) => lesson.id));
  const metrics = new Map<string, { seconds: number; completers: Set<string>; materials: number }>();
  for (const lesson of input.lessons) metrics.set(lesson.id, { seconds: 0, completers: new Set(), materials: 0 });
  for (const event of events) {
    if (!lessonIds.has(event.lessonId)) continue;
    const m = metrics.get(event.lessonId)!;
    if (event.type === "progress") m.seconds += event.seconds;
    if (event.type === "complete") m.completers.add(event.learnerRef);
    if (event.type === "material_use") m.materials += 1;
  }

  const ratingsBy = new Map<string, Map<string, number>>();
  for (const rating of input.ratings) {
    if (!lessonIds.has(rating.lessonId) || !inPeriod(rating.occurredAt, period.start, period.end)) continue;
    if (rating.rating < 1 || rating.rating > 5) continue;
    const perLesson = ratingsBy.get(rating.lessonId) ?? new Map<string, number>();
    perLesson.set(rating.learnerRef, rating.rating); // one rating per learner and lesson: the latest counts
    ratingsBy.set(rating.lessonId, perLesson);
  }

  const rows: LessonMetrics[] = input.lessons.map((lesson) => {
    const m = metrics.get(lesson.id)!;
    const ratingValues = [...(ratingsBy.get(lesson.id)?.values() ?? [])];
    const n = ratingValues.length;
    const sum = ratingValues.reduce((a, b) => a + b, 0);
    const smoothed = (sum + policy.usefulness.priorWeight * policy.usefulness.priorMean) / (n + policy.usefulness.priorWeight || 1);
    const meanRating = n ? Number((sum / n).toFixed(2)) : null;
    const qualityScore = n >= policy.usefulness.minRatings ? (smoothed - 1) / 4 : 0;
    return {
      lessonId: lesson.id,
      title: lesson.title,
      consumptionSeconds: m.seconds,
      completions: m.completers.size,
      materialUses: m.materials,
      ratings: n,
      meanRating,
      // Ratings only scale completed learning: no completions means no usefulness points, whatever the rating.
      usefulnessPoints: m.completers.size * qualityScore,
      shares: { consumption: 0, completion: 0, materialUse: 0, usefulness: 0 },
      score: 0,
      allocationMinor: 0,
    };
  });

  const totals: Record<WeightKey, number> = {
    consumption: rows.reduce((s, r) => s + r.consumptionSeconds, 0),
    completion: rows.reduce((s, r) => s + r.completions, 0),
    materialUse: rows.reduce((s, r) => s + r.materialUses, 0),
    usefulness: rows.reduce((s, r) => s + r.usefulnessPoints, 0),
  };
  const valueOf = (row: LessonMetrics, key: WeightKey): number =>
    key === "consumption" ? row.consumptionSeconds : key === "completion" ? row.completions : key === "materialUse" ? row.materialUses : row.usefulnessPoints;

  // A measure nobody triggered cannot share anything out: its weight moves to the measures that did.
  const active = WEIGHT_KEYS.filter((key) => totals[key] > 0 && policy.weights[key] > 0);
  const activeTotal = active.reduce((sum, key) => sum + policy.weights[key], 0);
  const appliedWeights = { consumption: 0, completion: 0, materialUse: 0, usefulness: 0 } as Record<WeightKey, number>;
  for (const key of active) appliedWeights[key] = policy.weights[key] / activeTotal;
  if (active.length < WEIGHT_KEYS.filter((key) => policy.weights[key] > 0).length) notes.push("Some measures had no activity in the period; their weight was shared across the measures that did.");

  for (const row of rows) {
    for (const key of WEIGHT_KEYS) row.shares[key] = totals[key] > 0 ? valueOf(row, key) / totals[key] : 0;
    row.score = active.reduce((sum, key) => sum + appliedWeights[key] * row.shares[key], 0);
  }
  if (policy.formula === "qvs") {
    applyQvs(rows, input.lessons, events, policy);
    notes.push("Shares were sized by the Qualified Value Score (usage x depth x usefulness x quality x outcome x freshness x trust).");
  }

  const payoutPool = (policy.formula === "qvs" ? rows.some((row) => row.score > 0) : active.length > 0) ? poolMinor : 0;
  const allocations = splitWhole(payoutPool, rows.map((row) => Math.round(row.score * 1_000_000)));
  rows.forEach((row, index) => (row.allocationMinor = allocations[index]));
  const unallocatedMinor = poolMinor - allocations.reduce((a, b) => a + b, 0);
  if (active.length === 0 && poolMinor > 0) notes.push("No learning activity was counted in the period, so the pool was not allocated.");

  const byContributor = new Map<string, ContributorLine[]>();
  for (const row of rows) {
    const lesson = input.lessons.find((item) => item.id === row.lessonId)!;
    const parts = splitWhole(row.allocationMinor, lesson.attribution.map((a) => a.shareBp));
    lesson.attribution.forEach((a, index) => {
      const line: ContributorLine = { lessonId: lesson.id, title: lesson.title, shareBp: a.shareBp, lessonAllocationMinor: row.allocationMinor, amountMinor: parts[index] };
      byContributor.set(a.contributorId, [...(byContributor.get(a.contributorId) ?? []), line]);
    });
  }
  const contributors: ContributorStatement[] = [...byContributor.entries()]
    .map(([contributorId, lines]) => {
      const totalMinor = lines.reduce((sum, line) => sum + line.amountMinor, 0);
      return { contributorId, totalMinor, lines, payable: input.policyApproved && totalMinor >= policy.payout.minPayoutMinor && totalMinor > 0 };
    })
    .sort((a, b) => a.contributorId.localeCompare(b.contributorId));

  const payableAfter = new Date(new Date(period.end).getTime() + policy.payout.holdDays * 86_400_000).toISOString();
  if (!input.policyApproved) notes.push("Illustrative only: this policy has not been approved, so nothing here is payable.");

  return {
    policyVersion: policy.version,
    policyApproved: input.policyApproved,
    currency: policy.currency,
    period,
    status: input.policyApproved ? "draft" : "illustrative",
    inputs: {
      receiptsCounted: receipts.length,
      receiptsExcluded: excluded,
      grossMinor: receipts.reduce((s, r) => s + r.grossMinor, 0),
      refundMinor: receipts.reduce((s, r) => s + r.refundMinor, 0),
      feeMinor: receipts.reduce((s, r) => s + r.feeMinor, 0),
      taxMinor: receipts.reduce((s, r) => s + r.taxMinor, 0),
      eligibleNetMinor,
      poolMinor,
      eventsCounted: events.length,
      eventsNotCounted: notCounted,
    },
    appliedWeights,
    lessons: rows,
    contributors,
    unallocatedMinor,
    payableAfter,
    notes,
  };
}

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

/**
 * The Qualified Value Score. Each factor is 0 to 1 and the lesson's raw score is their product, so one weak factor pulls the
 * whole score down and no single measure can carry a lesson. Usage is the share of learners reached; depth blends finishing with
 * time spent; usefulness is the smoothed rating, applied only with enough ratings and only for learners who finished; outcome is
 * the pass rate on the check; freshness halves with the policy's half-life; quality and trust come from the checks the lesson
 * passed and from fraud flags under review. A factor with no evidence is neutral (1) except usage and depth, which need activity.
 * The row scores are shares of the raw total, so the pool still splits to whole minor units exactly.
 */
function applyQvs(rows: LessonMetrics[], lessons: LessonInfo[], events: LearningEvent[], policy: RevenuePolicy): void {
  const learnersBy = new Map<string, Set<string>>();
  const checks = new Map<string, number[]>();
  for (const event of events) {
    const set = learnersBy.get(event.lessonId) ?? new Set<string>();
    set.add(event.learnerRef);
    learnersBy.set(event.lessonId, set);
    if (event.type === "check_result" && typeof event.value === "number") checks.set(event.lessonId, [...(checks.get(event.lessonId) ?? []), event.value]);
  }
  const reached = rows.map((row) => learnersBy.get(row.lessonId)?.size ?? 0);
  const maxReached = Math.max(1, ...reached);
  const maxSeconds = Math.max(1, ...rows.map((row) => row.consumptionSeconds));
  const raws = rows.map((row, index) => {
    const lesson = lessons.find((item) => item.id === row.lessonId)!;
    const learners = reached[index];
    const usage = learners / maxReached;
    const finish = learners > 0 ? Math.min(1, row.completions / learners) : 0;
    const depth = 0.6 * finish + 0.4 * (row.consumptionSeconds / maxSeconds);
    const usefulness = row.ratings >= policy.usefulness.minRatings && row.completions > 0 ? clamp01(0.5 + 0.5 * ((row.usefulnessPoints / row.completions))) : 0.5;
    const passes = checks.get(row.lessonId) ?? [];
    const outcome = passes.length >= policy.usefulness.minRatings ? clamp01(passes.filter((value) => value >= 60).length / passes.length) : 0.7;
    const freshness = lesson.ageDays == null ? 1 : Math.pow(0.5, Math.max(0, lesson.ageDays) / policy.qvs.freshnessHalfLifeDays);
    const quality = clamp01(lesson.quality ?? 1);
    const trust = clamp01(lesson.trust ?? 1);
    const raw = usage * depth * usefulness * quality * outcome * freshness * trust;
    row.qvs = { usage, depth, usefulness, quality, outcome, freshness, trust, raw };
    return raw;
  });
  const total = raws.reduce((a, b) => a + b, 0);
  rows.forEach((row, index) => (row.score = total > 0 ? raws[index] / total : 0));
}

/** Stable JSON for hashing: keys sorted, so the same inputs always give the same fingerprint. */
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

export function formatMoney(minor: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-IN", { style: "currency", currency }).format(minor / 100);
  } catch {
    return `${(minor / 100).toFixed(2)} ${currency}`;
  }
}
