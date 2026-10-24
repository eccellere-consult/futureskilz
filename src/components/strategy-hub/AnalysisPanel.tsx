'use client';

import type { ReactNode } from 'react';
import type { FillinStatus, StrategyActionable, StrategyAnalysis, StrategyRecommendation } from '@/lib/strategyFillinTypes';

const PRIORITY_STYLE: Record<string, string> = {
  High: 'bg-eccellere-error text-white border-eccellere-error',
  Medium: 'bg-eccellere-gold text-white border-eccellere-gold',
  Low: 'bg-eccellere-border text-eccellere-ink-mid border-eccellere-border',
};

interface AnalysisPanelProps {
  analysis: StrategyAnalysis | null;
  recommendations: StrategyRecommendation[];
  actionables: StrategyActionable[];
  status: FillinStatus;
  /** Number of answered parts: with none, there is nothing to analyse. */
  filledCount: number;
  loading: boolean;
  note: ReactNode;
  onAnalyze: () => void;
  /** Demo mode: the example analysis is shown, and nothing can be run. */
  readOnly?: boolean;
}

/**
 * The end output of a tool: the AI's written analysis of the answers, then the recommendations and actionables that follow.
 * Everything shown here was saved by the server when it was produced, and is what the tools downstream read as input.
 */
export default function AnalysisPanel({ analysis, recommendations, actionables, status, filledCount, loading, note, onAnalyze, readOnly }: AnalysisPanelProps) {
  const has = !!analysis || recommendations.length > 0;
  return (
    <section className="bg-white border border-eccellere-border rounded-[2px] p-6 md:p-8" aria-label="Analysis, recommendations and actionables">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
        <div className="text-[11px] font-semibold tracking-[0.1em] uppercase text-eccellere-gold">End output</div>
        {analysis && (
          <span className={`rounded-[2px] border px-2 py-0.5 text-[10px] font-bold uppercase ${status === 'stale' ? 'border-eccellere-error bg-white text-eccellere-error' : 'border-eccellere-teal bg-eccellere-cream text-eccellere-teal'}`}>
            {readOnly ? 'Worked example' : status === 'stale' ? 'Out of date — answers changed since' : 'Saved'}
          </span>
        )}
      </div>
      <h2 className="font-display text-2xl font-light text-eccellere-ink mb-4">Analysis, Recommendations &amp; Actionables</h2>

      {!readOnly && (
        <>
          <button
            onClick={onAnalyze}
            disabled={loading || filledCount === 0}
            className="w-full flex items-center justify-center bg-eccellere-ink hover:bg-eccellere-ink-mid disabled:opacity-60 text-white text-sm font-semibold py-3 rounded-[2px] transition-colors mb-2"
          >
            {loading ? 'Analysing…' : has ? 'Re-run the analysis' : 'Analyse & recommend'}
          </button>
          <div role="status" className="text-xs text-eccellere-ink-light mb-4 min-h-[1.2em]">
            {filledCount === 0 ? 'Fill in at least one part first — the analysis is grounded in your answers.' : note}
          </div>
        </>
      )}

      {analysis && (
        <div className="mb-6">
          {analysis.verdict && (
            <div className="border border-eccellere-gold-light bg-eccellere-gold-pale px-4 py-3 mb-4 rounded-[2px]">
              <div className="text-[10px] font-bold uppercase tracking-wider text-eccellere-gold mb-1">Verdict</div>
              <p className="m-0 text-sm font-semibold text-eccellere-ink">{analysis.verdict.label}</p>
              {analysis.verdict.rationale && <p className="m-0 mt-1 text-xs text-eccellere-ink-mid leading-relaxed">{analysis.verdict.rationale}</p>}
            </div>
          )}
          {analysis.summary && <p className="text-sm text-eccellere-ink-mid leading-relaxed mb-4">{analysis.summary}</p>}
          {analysis.findings.length > 0 && (
            <div className="mb-4">
              <div className="text-[11px] font-semibold tracking-[0.1em] uppercase text-eccellere-ink-light mb-2">What the answers show</div>
              <ul className="space-y-2.5">
                {analysis.findings.map((f, i) => (
                  <li key={i} className="text-sm text-eccellere-ink-mid leading-relaxed">
                    {f.title && <span className="font-semibold text-eccellere-ink">{f.title}. </span>}{f.detail}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {analysis.watchouts.length > 0 && (
            <div>
              <div className="text-[11px] font-semibold tracking-[0.1em] uppercase text-eccellere-ink-light mb-2">Watch-outs</div>
              <ul className="space-y-1.5 list-disc pl-5">
                {analysis.watchouts.map((w, i) => <li key={i} className="text-sm text-eccellere-ink-mid leading-relaxed">{w}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}

      {recommendations.length > 0 && (
        <div className="mb-6">
          <div className="text-[11px] font-semibold tracking-[0.1em] uppercase text-eccellere-ink-light mb-2">Recommendations</div>
          <ul className="space-y-2.5">
            {recommendations.map((r, i) => (
              <li key={i} className="flex gap-2.5 text-sm text-eccellere-ink-mid leading-relaxed">
                <span className="font-display text-eccellere-gold font-semibold flex-shrink-0">{i + 1}</span>
                <span>{r.text}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {actionables.length > 0 && (
        <div>
          <div className="text-[11px] font-semibold tracking-[0.1em] uppercase text-eccellere-ink-light mb-2">Actionables</div>
          <div className="space-y-2">
            {actionables.map((a, i) => (
              <div key={i} className="border border-eccellere-border rounded-[2px] p-3.5 flex flex-wrap items-start justify-between gap-2">
                <div className="flex-1 min-w-[200px]">
                  <p className="text-sm text-eccellere-ink font-medium leading-relaxed">{a.action}</p>
                  <p className="text-xs text-eccellere-ink-light mt-1">{a.owner} · {a.timeframe}</p>
                </div>
                <span className={`text-[10px] font-bold uppercase rounded-[2px] px-2 py-1 border flex-shrink-0 ${PRIORITY_STYLE[a.priority] ?? PRIORITY_STYLE.Medium}`}>{a.priority}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
