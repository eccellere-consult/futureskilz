import { skillFamilies, skillTaxonomy } from "../../domain/skills/taxonomy";
import type { AssetKind } from "../pathway/assets";
import { getRole } from "../pathway/roles";
import type { Level, Listing } from "./listing";
import { rankScore } from "./quality";

export type SortKey = "relevance" | "useful" | "quality" | "new" | "short";
export type Filters = { query?: string; family?: string; role?: string; industry?: string; level?: Level; kind?: AssetKind; maxMinutes?: number };

const names = new Map(skillTaxonomy.map((skill) => [skill.slug, skill.name]));
const STOP = new Set("the a an and or of to in on for with from by is are how what why do you your i my".split(" "));
export const words = (text: string): string[] => (text.toLowerCase().match(/[a-z][a-z0-9'-]*/g) ?? []).filter((word) => !STOP.has(word));

const family = (id: string) => skillFamilies.find((item) => item.id === id)?.name ?? id;

/** How well a listing matches a query: titles and skills count most, and a word matches by its start, so "negotiat" finds negotiation. */
export function relevance(listing: Listing, query: string): number {
  const asked = words(query);
  if (asked.length === 0) return 0;
  const fields: Array<[number, string[]]> = [
    [3, words(listing.title)],
    [2.5, listing.skills.flatMap((item) => words(names.get(item.skill) ?? ""))],
    [1.5, words(listing.summary)],
    [1, [...words(listing.roleLabel), ...words(listing.industry), ...words(listing.creator.name), ...listing.families.flatMap((id) => words(family(id))), ...listing.roles.flatMap((id) => words(getRole(id)?.title ?? ""))]],
  ];
  let score = 0;
  let matched = 0;
  for (const word of asked) {
    let best = 0;
    for (const [weight, bag] of fields) if (bag.some((candidate) => candidate === word || (word.length >= 4 && candidate.startsWith(word)))) best = Math.max(best, weight);
    if (best > 0) matched += 1;
    score += best;
  }
  // Every word of the query should find something; a listing that matches only some of them ranks below one that matches all.
  return matched === asked.length ? score : matched > 0 ? score * 0.4 : 0;
}

export function matches(listing: Listing, filters: Filters): boolean {
  if (filters.family && !listing.families.includes(filters.family)) return false;
  if (filters.role && !listing.roles.includes(filters.role)) return false;
  if (filters.industry && listing.industry.toLowerCase() !== filters.industry.toLowerCase()) return false;
  if (filters.level && listing.level !== filters.level) return false;
  if (filters.kind && listing.kind !== filters.kind) return false;
  if (filters.maxMinutes && listing.minutes > filters.maxMinutes) return false;
  return true;
}

const usefulness = (listing: Listing): number => {
  const part = listing.quality.parts.find((item) => item.key === "usefulness");
  return part?.used ? (part.value as number) : -1;
};

export function searchListings(listings: Listing[], filters: Filters = {}, sort: SortKey = "relevance"): Listing[] {
  const query = filters.query?.trim() ?? "";
  const scored = listings.filter((listing) => matches(listing, filters)).map((listing) => ({ listing, score: query ? relevance(listing, query) : 0 })).filter((item) => !query || item.score > 0);
  const quality = (listing: Listing) => rankScore(listing.quality);
  const order: Record<SortKey, (a: (typeof scored)[number], b: (typeof scored)[number]) => number> = {
    relevance: (a, b) => b.score - a.score || quality(b.listing) - quality(a.listing),
    // "Most useful" only ranks what learners have actually rated; unrated listings follow.
    useful: (a, b) => usefulness(b.listing) - usefulness(a.listing) || quality(b.listing) - quality(a.listing),
    quality: (a, b) => quality(b.listing) - quality(a.listing) || b.score - a.score,
    new: (a, b) => b.listing.updatedAt.localeCompare(a.listing.updatedAt),
    short: (a, b) => a.listing.minutes - b.listing.minutes,
  };
  return scored.sort((a, b) => order[sort](a, b) || a.listing.title.localeCompare(b.listing.title)).map((item) => item.listing);
}

export type Facets = { families: Array<{ id: string; name: string; count: number }>; roles: Array<{ id: string; name: string; count: number }>; industries: Array<{ name: string; count: number }>; levels: Array<{ id: Level; count: number }>; kinds: Array<{ id: AssetKind; count: number }> };

/** What there is to browse by, counted over the listings that match the search words (so the counts make sense next to the results). */
export function facetsOf(listings: Listing[], query = ""): Facets {
  const pool = query.trim() ? listings.filter((listing) => relevance(listing, query) > 0) : listings;
  const tally = <T,>(pick: (listing: Listing) => T[]): Map<T, number> => {
    const out = new Map<T, number>();
    for (const listing of pool) for (const key of new Set(pick(listing))) out.set(key, (out.get(key) ?? 0) + 1);
    return out;
  };
  const sorted = <T,>(map: Map<T, number>) => [...map].sort((a, b) => b[1] - a[1]);
  return {
    families: sorted(tally((l) => l.families)).map(([id, count]) => ({ id, name: family(id), count })),
    roles: sorted(tally((l) => l.roles)).map(([id, count]) => ({ id, name: getRole(id)?.title ?? id, count })),
    industries: sorted(tally((l) => (l.industry ? [l.industry] : []))).map(([name, count]) => ({ name, count })),
    levels: sorted(tally((l) => [l.level])).map(([id, count]) => ({ id, count })),
    kinds: sorted(tally((l) => [l.kind])).map(([id, count]) => ({ id, count })),
  };
}
