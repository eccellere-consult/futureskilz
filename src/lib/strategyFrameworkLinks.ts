/**
 * strategyFrameworkLinks.ts — the golden thread as the catalogue declares it, made two-way.
 *
 * Each framework lists the tools that feed it (upstream) and the tools it feeds (downstream), authored independently, so the
 * two lists can disagree: Value Proposition Canvas says it feeds the Business Model Canvas, while the Business Model Canvas
 * never listed it as something it builds on. A link declared on either side is a link. This returns, for every framework,
 * both lists with the links from the other side folded in — pure, so the routes and the tests share it.
 */

export interface LinkRow { toolId: string; upstreamTools: string[]; downstreamTools: string[] }

export interface Links { upstream: string[]; downstream: string[] }

/** Own entries first, in their authored order; then the ones only the other side declared, in catalogue order. */
export function effectiveLinks(rows: readonly LinkRow[]): Map<string, Links> {
  const ids = new Set(rows.map((r) => r.toolId));
  const out = new Map<string, Links>();
  for (const r of rows) {
    const upstream = r.upstreamTools.filter((id) => ids.has(id) && id !== r.toolId);
    const downstream = r.downstreamTools.filter((id) => ids.has(id) && id !== r.toolId);
    for (const o of rows) {
      if (o.toolId === r.toolId) continue;
      if (o.downstreamTools.includes(r.toolId) && !upstream.includes(o.toolId)) upstream.push(o.toolId);
      if (o.upstreamTools.includes(r.toolId) && !downstream.includes(o.toolId)) downstream.push(o.toolId);
    }
    out.set(r.toolId, { upstream: [...new Set(upstream)], downstream: [...new Set(downstream)] });
  }
  return out;
}
