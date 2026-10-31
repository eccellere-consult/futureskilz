/**
 * Free-tier gating: the first N Skill Shots in each pillar are free for everyone; the rest need an active pass.
 * Nothing is locked until payments are live (a provider is connected and at least one plan is on sale), so the site never
 * locks learners out of content it cannot yet sell. "First" is the catalogue order, which an editor controls.
 */
export type CatalogItem = { slug: string; pillarId: string | null };

export const FREE_PER_PILLAR = 2;

export function freeSlugs(catalog: CatalogItem[], perPillar = FREE_PER_PILLAR): Set<string> {
  const taken = new Map<string, number>();
  const free = new Set<string>();
  for (const item of catalog) {
    const group = item.pillarId ?? "other";
    const used = taken.get(group) ?? 0;
    if (used < perPillar) free.add(item.slug);
    taken.set(group, used + 1);
  }
  return free;
}

export type Access = { allowed: boolean; reason: "not-enforced" | "free" | "pass" | "locked" | "unlisted" };

export function decideAccess(input: { slug: string; catalog: CatalogItem[]; perPillar?: number; hasPass: boolean; enforced: boolean }): Access {
  if (!input.enforced) return { allowed: true, reason: "not-enforced" };
  // A Skill Shot that is not in the catalogue (an unpublished draft, a typo) is not sold, so it is not hidden behind a price either.
  if (!input.catalog.some((item) => item.slug === input.slug)) return { allowed: true, reason: "unlisted" };
  if (freeSlugs(input.catalog, input.perPillar ?? FREE_PER_PILLAR).has(input.slug)) return { allowed: true, reason: "free" };
  return input.hasPass ? { allowed: true, reason: "pass" } : { allowed: false, reason: "locked" };
}
