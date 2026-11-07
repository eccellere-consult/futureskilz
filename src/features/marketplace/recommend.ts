import type { SkillGap } from "../pathway/gaps";
import type { Listing } from "./listing";
import { rankScore } from "./quality";

/**
 * "For you": listings ranked by how much they would close the learner's biggest gaps, per minute, with the reason spelled out.
 * It uses the same gaps as the learner's pathway, so a recommendation can always be explained from the gap table.
 */
export type Recommendation = { listing: Listing; reasons: string[]; benefit: number };

export function recommendForGaps(listings: Listing[], gaps: SkillGap[], limit = 6): Recommendation[] {
  const open = gaps.filter((gap) => gap.status === "gap");
  const out: Recommendation[] = [];
  for (const listing of listings) {
    let benefit = 0;
    const reasons: Array<{ text: string; weight: number }> = [];
    for (const gap of open) {
      const hit = listing.skills.find((item) => item.skill === gap.skill);
      if (!hit) continue;
      const from = gap.current ?? 0;
      const lift = Math.min(hit.toLevel, gap.required) - from;
      if (lift <= 0) continue;
      const weight = lift * gap.priority;
      benefit += weight;
      reasons.push({ text: `Builds ${gap.name.toLowerCase()} from about ${from.toFixed(1)} toward ${Math.min(hit.toLevel, gap.required).toFixed(1)}`, weight });
    }
    if (benefit <= 0) continue;
    // Quality nudges, never decides: an unrated listing is not penalised.
    const quality = listing.quality.score === null ? 1 : 0.9 + 0.2 * (rankScore(listing.quality) / 100);
    out.push({ listing, reasons: reasons.sort((a, b) => b.weight - a.weight).slice(0, 2).map((item) => item.text), benefit: (benefit / Math.sqrt(Math.max(listing.minutes, 1))) * quality });
  }
  return out.sort((a, b) => b.benefit - a.benefit || a.listing.title.localeCompare(b.listing.title)).slice(0, limit);
}
