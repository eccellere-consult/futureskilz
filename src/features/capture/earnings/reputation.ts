/**
 * Coach reputation: a 0 to 100 view of how established and trusted a coach's work is, with the parts shown. It is built from
 * what learners did (finishing, ratings after finishing), what reviewers did (lessons published, checks passed) and what fraud
 * review found. It says "not yet rated" when there is too little behind it, and it never uses ratings alone: ratings are at most
 * 30 points. It is an input to discovery and to trust, not a verdict on a person.
 */
export type ReputationInputs = {
  lessonsPublished: number;
  learners: number;
  starts: number;
  completions: number;
  ratings: number;
  meanRating: number | null;
  /** 0 to 1: how well their lessons pass the checks they were published under. */
  contentQuality: number | null;
  tenureDays: number;
  flagsConfirmed: number;
  flagsOpen: number;
};

export type ReputationPart = { key: string; label: string; points: number; max: number; note: string };
export type Reputation = { score: number | null; tier: "new" | "rising" | "established" | "trusted"; parts: ReputationPart[]; note: string };

const clamp = (v: number, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));
const MIN_LEARNERS = 5;

export function coachReputation(i: ReputationInputs): Reputation {
  const enough = i.learners >= MIN_LEARNERS;
  const part = (key: string, label: string, value: number | null, max: number, note: string): ReputationPart => ({ key, label, points: value === null ? 0 : Math.round(value * max * 10) / 10, max, note });
  const parts: ReputationPart[] = [
    part("track", "Published work", clamp(i.lessonsPublished / 5), 20, `${i.lessonsPublished} published lesson${i.lessonsPublished === 1 ? "" : "s"}.`),
    part("quality", "Content checks", i.contentQuality, 20, i.contentQuality === null ? "Not checked yet." : "Share of checks their lessons passed."),
    part("finish", "Learners finish", enough && i.starts > 0 ? clamp(i.completions / i.starts) : null, 25, enough ? `${i.completions} of ${i.starts} started lessons finished.` : `Needs ${MIN_LEARNERS} learners (${i.learners} so far).`),
    part("rating", "Rated useful after finishing", enough && i.ratings >= MIN_LEARNERS && i.meanRating !== null ? clamp((i.meanRating - 1) / 4) : null, 30, i.ratings >= MIN_LEARNERS ? `${i.ratings} ratings, ${i.meanRating?.toFixed(1)} on average.` : `Needs ${MIN_LEARNERS} ratings (${i.ratings} so far).`),
    part("tenure", "Time on the platform", clamp(i.tenureDays / 180), 5, `${Math.round(i.tenureDays / 30)} months.`),
  ];
  const evidence = i.lessonsPublished > 0 && (enough || i.contentQuality !== null);
  if (!evidence) return { score: null, tier: "new", parts, note: "Not yet rated: there is not enough learner activity behind a score." };
  const used = parts.filter((p) => p.points > 0 || p.key === "track" || p.key === "tenure");
  const maxUsed = used.reduce((s, p) => s + p.max, 0) || 1;
  const earned = used.reduce((s, p) => s + p.points, 0);
  // Scale to the parts that have evidence, so a missing measure does not count as a bad one.
  let score = (earned / maxUsed) * 100;
  score -= i.flagsConfirmed * 25 + Math.min(i.flagsOpen, 3) * 5;
  score = Math.round(clamp(score, 0, 100));
  const tier = i.flagsConfirmed > 0 ? (score >= 60 ? "rising" : "new") : score >= 80 && enough && i.learners >= 50 ? "trusted" : score >= 60 ? "established" : score >= 35 ? "rising" : "new";
  const note = i.flagsConfirmed ? "Confirmed fraud findings lower this score." : i.flagsOpen ? "Some activity is under review, which lowers this score for now." : "";
  return { score, tier, parts, note };
}
