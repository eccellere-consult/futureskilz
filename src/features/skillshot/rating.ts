/** What is shown for a Skill Shot's star ratings: how many learners rated it and the average, to one decimal place. */
export type RatingSummary = { count: number; average: number | null };

export function summariseRatings(count: number, total: number): RatingSummary {
  const safe = Number.isFinite(count) && count > 0 ? Math.floor(count) : 0;
  return { count: safe, average: safe ? Math.round((total / safe) * 10) / 10 : null };
}

/** "4.5 out of 5 from 12 ratings", or nothing when no one has rated yet. An average is never shown without its count. */
export function ratingLabel(summary: RatingSummary | null | undefined): string | null {
  if (!summary?.count || summary.average === null) return null;
  return `${summary.average.toFixed(1)} out of 5 from ${summary.count} rating${summary.count === 1 ? "" : "s"}`;
}

export const STAR_WORDS = ["", "Not useful", "A little useful", "Useful", "Very useful", "Excellent"] as const;
