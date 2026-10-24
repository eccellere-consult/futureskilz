'use client';

import Link from 'next/link';
import type { FillinStatus } from '@/lib/strategyFillinTypes';
import type { ConnectedTool } from '@/lib/strategyHubConnections';

export const STATUS_CHIP: Record<FillinStatus, { label: string; cls: string }> = {
  not_started: { label: 'Not started', cls: 'border-eccellere-border bg-white text-eccellere-ink-light' },
  in_progress: { label: 'Filled in', cls: 'border-eccellere-gold-light bg-eccellere-gold-pale text-eccellere-gold' },
  analysed: { label: 'Analysed', cls: 'border-eccellere-teal bg-eccellere-cream text-eccellere-teal' },
  stale: { label: 'Out of date', cls: 'border-eccellere-error bg-white text-eccellere-error' },
};

interface Props {
  /** The tool ids on each side, with names — always known, even for a signed-out visitor. */
  upstream: { id: string; name: string }[];
  downstream: { id: string; name: string }[];
  /** The signed-in client's (or the worked example's) saved work in those tools, when there is any. */
  connections: { upstream: ConnectedTool[]; downstream: ConnectedTool[] } | null;
  /** Explains the thread to someone who can save work. */
  explain: boolean;
  /** Keep the worked example going when following a link. */
  query?: string;
  /** FUTURESKILZ: where the section's tool pages live; the Strategy Hub when absent. */
  basePath?: string;
  /** Wording for the status chips in the worked example. */
  sample?: boolean;
}

function List({ items, found, tone, query, sample, basePath }: { items: { id: string; name: string }[]; found: ConnectedTool[] | undefined; tone: 'up' | 'down'; query: string; sample?: boolean; basePath: string }) {
  return (
    <div className="flex flex-col gap-3">
      {items.map(({ id, name }) => {
        const c = found?.find((x) => x.toolId === id);
        return (
          <div key={id}>
            <div className="flex items-center justify-between gap-2">
              <Link href={`${basePath}/${id}${query}`} className={`text-sm font-semibold hover:underline ${tone === 'up' ? 'text-eccellere-teal' : 'text-eccellere-gold'}`}>{name}</Link>
              {c && <span className={`flex-shrink-0 rounded-[2px] border px-1.5 py-0.5 text-[10px] font-bold uppercase ${STATUS_CHIP[c.status].cls}`}>{sample ? 'Worked example' : STATUS_CHIP[c.status].label}</span>}
            </div>
            {c?.headline && <p className="m-0 mt-0.5 text-xs text-eccellere-ink-light leading-snug">{c.headline}</p>}
          </div>
        );
      })}
    </div>
  );
}

/**
 * The golden thread of a tool: what it builds on, what it feeds, and where the client (or the worked example) stands in each.
 * Laid out as a band across the page — what comes before on the left, what comes after on the right — so the form below keeps
 * the full width its tables need.
 */
export default function ConnectionsPanel({ upstream, downstream, connections, explain, query = '', sample, basePath = '/strategy-hub' }: Props) {
  if (upstream.length === 0 && downstream.length === 0) return null;
  const both = upstream.length > 0 && downstream.length > 0;
  return (
    <section className="bg-white border border-eccellere-border rounded-[2px] p-6 md:p-8" aria-label="Golden thread">
      <div className="text-[11px] font-semibold tracking-[0.1em] uppercase text-eccellere-gold mb-2">Golden thread</div>
      {explain && (
        <p className="text-xs text-eccellere-ink-light leading-relaxed mb-4 max-w-2xl">
          What you save here is used as input when you fill in or analyse the tools it feeds — and what you saved in the tools it builds on is used here.
        </p>
      )}
      <div className={`grid grid-cols-1 gap-6 ${both ? 'md:grid-cols-2 md:gap-10' : ''}`}>
        {upstream.length > 0 && (
          <div>
            <p className="text-xs text-eccellere-ink-light mb-2">Builds on ←</p>
            <List items={upstream} found={connections?.upstream} tone="up" query={query} sample={sample} basePath={basePath} />
          </div>
        )}
        {downstream.length > 0 && (
          <div className={both ? 'md:border-l md:border-eccellere-border md:pl-10' : ''}>
            <p className="text-xs text-eccellere-ink-light mb-2">Feeds into →</p>
            <List items={downstream} found={connections?.downstream} tone="down" query={query} sample={sample} basePath={basePath} />
          </div>
        )}
      </div>
    </section>
  );
}
