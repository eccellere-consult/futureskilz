/**
 * The FutureSkilz Quality Score, for discovery. It combines the signals there are, says which it used, and does not lean on star
 * ratings alone: usefulness is at most 30%. A signal with too little behind it is not used, so a new lesson is shown as
 * "not yet rated", not as a low score. Weights are configurable; these follow the Master Build's illustrative weighting.
 */
export type QualityKey = "usefulness" | "contentQuality" | "outcome" | "completion" | "credibility" | "freshness";

export type QualityConfig = { weights: Record<QualityKey, number>; /** The most a complaint adjustment can take off, in points. */ complaintPenalty: number; /** Learners needed before a learner signal counts. */ minSample: number };

export const DEFAULT_QUALITY: QualityConfig = {
  weights: { usefulness: 30, contentQuality: 20, outcome: 15, completion: 10, credibility: 10, freshness: 10 },
  complaintPenalty: 5,
  minSample: 5,
};

export type QualityInputs = {
  /** Learners who rated; the share who said it was useful, or the mean rating (1 to 5) when "useful" was not asked. */
  usefulness?: { n: number; usefulShare?: number | null; meanRating?: number | null } | null;
  /** 0 to 1: how well the lesson passes the automatic and human checks it was published under. */
  contentQuality?: number | null;
  /** Learners who passed a check after the lesson, and how many of them did. */
  outcome?: { n: number; passRate: number } | null;
  completion?: { starts: number; completions: number } | null;
  /** 0 to 1: how established the author is (reviewed, approved, other published work). */
  credibility?: number | null;
  /** Days since it was last published or updated. */
  ageDays?: number | null;
  /** Feedback held or removed by moderation, out of all feedback. */
  complaints?: { flagged: number; total: number } | null;
  /** Learners who have used it, for how firmly to speak. */
  learners?: number;
};

export type QualityPart = { key: QualityKey; label: string; value: number | null; weight: number; used: boolean; note: string };
export type QualityResult = {
  /** 0 to 100, or null when there is nothing to base one on yet. */
  score: number | null;
  confidence: "not-rated" | "early" | "building" | "established";
  parts: QualityPart[];
  note: string;
};

const LABEL: Record<QualityKey, string> = { usefulness: "Learners found it useful", contentQuality: "Content checks", outcome: "Learners passed the check afterwards", completion: "Learners finished it", credibility: "Author's standing", freshness: "Up to date" };
const clamp = (value: number) => Math.max(0, Math.min(1, value));

export function qualityScore(inputs: QualityInputs, config: QualityConfig = DEFAULT_QUALITY): QualityResult {
  const { minSample } = config;
  const raw: Record<QualityKey, { value: number | null; note: string }> = {
    usefulness: (() => {
      const u = inputs.usefulness;
      if (!u || u.n < minSample) return { value: null, note: `Needs ${minSample} learners to rate it (${u?.n ?? 0} so far).` };
      const value = u.usefulShare != null ? u.usefulShare : u.meanRating != null ? (u.meanRating - 1) / 4 : null;
      return { value: value === null ? null : clamp(value), note: `${u.n} learners rated it.` };
    })(),
    contentQuality: inputs.contentQuality == null ? { value: null, note: "Not checked yet." } : { value: clamp(inputs.contentQuality), note: "Passed the checks it was published under." },
    outcome: !inputs.outcome || inputs.outcome.n < minSample ? { value: null, note: `Needs ${minSample} learners to take the check.` } : { value: clamp(inputs.outcome.passRate), note: `${inputs.outcome.n} learners took the check.` },
    completion: !inputs.completion || inputs.completion.starts < minSample ? { value: null, note: `Needs ${minSample} learners to start it.` } : { value: clamp(inputs.completion.completions / inputs.completion.starts), note: `${inputs.completion.completions} of ${inputs.completion.starts} finished.` },
    credibility: inputs.credibility == null ? { value: null, note: "No author history yet." } : { value: clamp(inputs.credibility), note: "From the author's reviewed and approved work." },
    freshness: inputs.ageDays == null ? { value: null, note: "No date." } : { value: inputs.ageDays <= 90 ? 1 : clamp(1 - (inputs.ageDays - 90) / 640 * 0.8), note: inputs.ageDays <= 90 ? "Updated in the last three months." : `Last updated ${Math.round(inputs.ageDays / 30)} months ago.` },
  };
  const parts: QualityPart[] = (Object.keys(raw) as QualityKey[]).map((key) => ({ key, label: LABEL[key], value: raw[key].value, weight: config.weights[key], used: raw[key].value !== null, note: raw[key].note }));
  const used = parts.filter((part) => part.used);
  const learners = inputs.learners ?? 0;
  // Freshness alone says nothing about quality: a score needs at least one real signal about the content or the learners.
  const informative = used.filter((part) => part.key !== "freshness");
  if (informative.length === 0) return { score: null, confidence: "not-rated", parts, note: "Not yet rated. Quality shows once learners and checks have something to say." };
  const total = used.reduce((sum, part) => sum + part.weight, 0);
  let score = (used.reduce((sum, part) => sum + part.weight * (part.value as number), 0) / total) * 100;
  const complaints = inputs.complaints;
  if (complaints && complaints.total > 0) score -= Math.min(1, (complaints.flagged / Math.max(complaints.total, 10)) * 5) * config.complaintPenalty;
  score = Math.max(0, Math.min(100, Math.round(score)));
  const confidence = learners >= 30 ? "established" : learners >= minSample ? "building" : "early";
  return { score, confidence, parts, note: `Based on ${used.length} signal${used.length === 1 ? "" : "s"}. ${confidence === "early" ? "Early: few learners so far." : confidence === "building" ? "Building as more learners use it." : "Established."}` };
}

const CONFIDENCE_WEIGHT: Record<QualityResult["confidence"], number> = { "not-rated": 0, early: 0.5, building: 0.8, established: 1 };

/**
 * The number used to put listings in order. A score with little behind it is pulled toward the middle, so one good signal on a
 * lesson nobody has used cannot outrank a lesson learners have rated well. Not rated sorts last and is never treated as bad.
 */
export function rankScore(quality: QualityResult): number {
  if (quality.score === null) return -1;
  const weight = CONFIDENCE_WEIGHT[quality.confidence];
  return quality.score * weight + 50 * (1 - weight);
}
