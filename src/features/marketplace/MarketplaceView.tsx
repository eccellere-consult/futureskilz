"use client";

import { ArrowRight, Clock3, Search } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { useLearnerState } from "../learner/use-learner-state";
import { KIND_LABEL, type AssetKind } from "../pathway/assets";
import { computeGaps, type Horizon } from "../pathway/gaps";
import { getRole } from "../pathway/roles";
import { loadTargetRoleId } from "../pathway/store";
import { useLearnerEstimates } from "../pathway/use-estimates";
import { LEVEL_LABEL, type Level, type Listing } from "./listing";
import { recommendForGaps } from "./recommend";
import { facetsOf, searchListings, type Filters, type SortKey } from "./search";

const SORTS: Array<[SortKey, string]> = [["relevance", "Best match"], ["useful", "Most useful"], ["quality", "Highest quality"], ["new", "New and updated"], ["short", "Shortest"]];
const CONFIDENCE: Record<string, string> = { "not-rated": "Not yet rated", early: "Early: few learners so far", building: "Building as more learners use it", established: "Established" };

/**
 * Find more to learn from. A learner's own path stays the main route; this is where they look further, by search, by skill area, by
 * role, by industry, by level, or by what would close their biggest gaps. Quality is shown with what is behind it, never as a bare
 * star rating, and a lesson nobody has used yet is "not yet rated", not low.
 */
export function MarketplaceView({ listings, initialQuery = "" }: { listings: Listing[]; initialQuery?: string }) {
  const [query, setQuery] = useState(initialQuery);
  const [filters, setFilters] = useState<Omit<Filters, "query">>({});
  const [sort, setSort] = useState<SortKey>("relevance");

  const results = useMemo(() => searchListings(listings, { ...filters, query }, query ? sort : sort === "relevance" ? "quality" : sort), [listings, filters, query, sort]);
  const facets = useMemo(() => facetsOf(listings, query), [listings, query]);
  const set = <K extends keyof Omit<Filters, "query">>(key: K, value: Filters[K] | undefined) => setFilters((current) => ({ ...current, [key]: current[key] === value ? undefined : value }));
  const active = Object.values(filters).filter(Boolean).length;

  return (
    <div className="mx-auto w-full max-w-7xl px-5 py-10 sm:px-8 sm:py-14">
      <p className="font-mono text-[10px] uppercase text-teal">Marketplace</p>
      <h1 className="mt-2 font-serif text-4xl leading-tight sm:text-5xl">Find more to learn from.</h1>
      <p className="mt-3 max-w-3xl text-lg leading-8 text-ink-mid">Lessons from people who have done the work, and Skill Shots taught by Arya. Your own path comes first; this is for looking further.</p>

      <form className="mt-6 flex max-w-2xl gap-2" onSubmit={(event) => event.preventDefault()} role="search">
        <label className="sr-only" htmlFor="market-query">Search the marketplace</label>
        <input className="min-h-12 flex-1 border border-border bg-white px-4" id="market-query" maxLength={80} onChange={(event) => setQuery(event.target.value)} placeholder="A skill, a role, an industry, a topic" type="search" value={query} />
        <span className="flex min-h-12 w-12 items-center justify-center bg-ink text-cream"><Search aria-hidden="true" size={18} /></span>
      </form>

      <ForYou listings={listings} />

      <div className="mt-10 grid gap-8 lg:grid-cols-[16rem_minmax(0,1fr)]">
        <aside aria-label="Browse by" className="space-y-6 text-sm">
          <details className="lg:hidden"><summary className="cursor-pointer font-semibold">Filters{active ? ` (${active})` : ""}</summary></details>
          <div className="hidden space-y-6 lg:block">
            <Facet title="Skill area" items={facets.families.map((f) => ({ key: f.id, label: f.name, count: f.count }))} value={filters.family} onPick={(key) => set("family", key)} />
            <Facet title="Role" items={facets.roles.slice(0, 8).map((f) => ({ key: f.id, label: f.name, count: f.count }))} value={filters.role} onPick={(key) => set("role", key)} />
            <Facet title="Industry" items={facets.industries.map((f) => ({ key: f.name, label: f.name, count: f.count }))} value={filters.industry} onPick={(key) => set("industry", key)} />
            <Facet title="Level" items={facets.levels.map((f) => ({ key: f.id, label: LEVEL_LABEL[f.id], count: f.count }))} value={filters.level} onPick={(key) => set("level", key as Level)} />
            <Facet title="Kind" items={facets.kinds.map((f) => ({ key: f.id, label: KIND_LABEL[f.id], count: f.count }))} value={filters.kind} onPick={(key) => set("kind", key as AssetKind)} />
            <Facet title="Time" items={[{ key: "10", label: "10 minutes or less", count: listings.filter((l) => l.minutes <= 10).length }]} value={filters.maxMinutes ? String(filters.maxMinutes) : undefined} onPick={(key) => set("maxMinutes", key ? Number(key) : undefined)} />
          </div>
        </aside>

        <section aria-label="Results">
          <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
            <p aria-live="polite" role="status">{results.length} result{results.length === 1 ? "" : "s"}{query ? ` for “${query}”` : ""}</p>
            <label>Sort by <select className="ml-1 min-h-10 border border-border bg-white px-2" onChange={(event) => setSort(event.target.value as SortKey)} value={sort}>{SORTS.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
          </div>
          {results.length === 0 ? <p className="mt-6 border-l-2 border-gold pl-4 text-ink-mid">Nothing matches yet. Try fewer filters or other words. New lessons arrive as coaches publish them.</p> : null}
          <ul className="mt-4 space-y-4">{results.map((listing) => <li key={listing.id}><Card listing={listing} /></li>)}</ul>
        </section>
      </div>
    </div>
  );
}

function Facet({ title, items, value, onPick }: { title: string; items: Array<{ key: string; label: string; count: number }>; value: string | number | undefined; onPick: (key: string | undefined) => void }) {
  if (items.length === 0) return null;
  return (
    <div>
      <p className="font-mono text-[10px] uppercase text-ink-light">{title}</p>
      <ul className="mt-2 space-y-1">
        {items.map((item) => (
          <li key={item.key}><button aria-pressed={String(value) === item.key} className={`flex w-full justify-between gap-2 px-2 py-1 text-left ${String(value) === item.key ? "bg-ink text-cream" : "hover:bg-gold-pale"}`} onClick={() => onPick(item.key)} type="button"><span>{item.label}</span><span className="opacity-60">{item.count}</span></button></li>
        ))}
      </ul>
    </div>
  );
}

function Card({ listing }: { listing: Listing }) {
  const { quality } = listing;
  return (
    <article className="border border-border bg-surface p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] uppercase text-teal">{KIND_LABEL[listing.kind]} · {LEVEL_LABEL[listing.level]}</p>
          <h2 className="mt-1 font-serif text-2xl leading-tight"><Link className="hover:underline" href={listing.href}>{listing.title}</Link></h2>
          <p className="mt-1 text-sm text-ink-light">By {listing.creator.profileId ? <Link className="underline underline-offset-4" href={`/coaches/${listing.creator.profileId}`}>{listing.creator.name}</Link> : listing.creator.name}{listing.industry ? ` · ${listing.industry}` : ""}{listing.roleLabel ? ` · ${listing.roleLabel}` : ""}</p>
        </div>
        <div className="text-right text-sm">
          <p className="flex items-center justify-end gap-1 text-ink-light"><Clock3 aria-hidden="true" size={14} />{listing.minutes} min</p>
          <p className="mt-1 font-semibold">{quality.score === null ? "Not yet rated" : `Quality ${quality.score}`}</p>
        </div>
      </div>
      <p className="mt-3 max-w-3xl text-sm leading-6 text-ink-mid">{listing.summary}</p>
      {listing.skills.length ? <ul className="mt-3 flex flex-wrap gap-2 text-xs">{listing.skills.slice(0, 4).map((item) => <li className="border border-border bg-cream px-2 py-1" key={item.skill}>{item.skill.replaceAll("-", " ")} <span className="text-ink-light">to {item.toLevel}</span></li>)}</ul> : <p className="mt-3 text-xs text-ink-light">Skills not mapped yet.</p>}
      {listing.roles.length ? <p className="mt-2 text-xs text-ink-light">Useful for: {listing.roles.slice(0, 3).map((id) => getRole(id)?.title).filter(Boolean).join(", ")}</p> : null}
      <details className="mt-3 text-xs">
        <summary className="cursor-pointer text-ink-light">{CONFIDENCE[quality.confidence]}{listing.learners ? ` · ${listing.learners} learner${listing.learners === 1 ? "" : "s"}` : ""} · what is behind the score</summary>
        <ul className="mt-2 space-y-1">{quality.parts.map((part) => <li className={part.used ? "" : "text-ink-light"} key={part.key}>{part.used ? "● " : "○ "}{part.label}: {part.used ? `${Math.round((part.value ?? 0) * 100)}%` : "not used yet"} <span className="text-ink-light">({part.note})</span></li>)}</ul>
        <p className="mt-2 text-ink-light">{quality.note} The score is not a star rating, and it is never the only reason a lesson is shown.</p>
      </details>
      <Link className="primary-button mt-4" href={listing.href}>Open<ArrowRight size={17} /></Link>
    </article>
  );
}

/** Listings that would close this learner's biggest gaps, for the role they are working toward. Nothing is shown without a role and a first snapshot. */
function ForYou({ listings }: { listings: Listing[] }) {
  const { state } = useLearnerState();
  const snapshot = state?.snapshot;
  const [roleId, setRoleId] = useState<string | null>(null);
  useEffect(() => {
    void loadTargetRoleId().then(setRoleId);
  }, []);
  if (!snapshot?.scores) return null;
  return <ForYouInner listings={listings} roleId={roleId} snapshot={snapshot} />;
}

function ForYouInner({ listings, roleId, snapshot }: { listings: Listing[]; roleId: string | null; snapshot: NonNullable<ReturnType<typeof useLearnerState>["state"]>["snapshot"] }) {
  const estimates = useLearnerEstimates(snapshot);
  const role = roleId ? getRole(roleId) : undefined;
  const picks = useMemo(() => (role ? recommendForGaps(listings, computeGaps(role, estimates, (snapshot.draft.horizon || "6-months") as Horizon), 3) : []), [role, estimates, listings, snapshot.draft.horizon]);
  if (!role) return <p className="mt-6 text-sm text-ink-mid"><Link className="text-teal underline underline-offset-4" href="/explore">Choose a target role</Link> and the marketplace will suggest what closes your biggest gaps.</p>;
  if (picks.length === 0) return <p className="mt-6 text-sm text-ink-mid">Nothing here yet closes a gap for {role.title}. Your own path on <Link className="text-teal underline underline-offset-4" href="/journey">My roadmap</Link> shows what to do first.</p>;
  return (
    <section aria-label="For you" className="mt-8 border-l-2 border-gold bg-gold-pale/50 p-5">
      <p className="font-mono text-[10px] uppercase text-ink-light">For you, working toward {role.title}</p>
      <ul className="mt-3 grid gap-4 md:grid-cols-3">
        {picks.map(({ listing, reasons }) => (
          <li className="border border-border bg-surface p-4 text-sm" key={listing.id}>
            <Link className="font-serif text-lg underline-offset-4 hover:underline" href={listing.href}>{listing.title}</Link>
            <p className="mt-1 text-xs text-ink-light">{KIND_LABEL[listing.kind]} · {listing.minutes} min</p>
            <ul className="mt-2 space-y-1 text-ink-mid">{reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul>
          </li>
        ))}
      </ul>
    </section>
  );
}
