"use client";

import Link from "next/link";
import { useState } from "react";

import { estimateEarnings, shareSensitivity } from "../earnings/estimate";

const rupees = (minor: number): string => `₹${(minor / 100).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

function Field({ label, hint, value, onChange, suffix, prefix, min = 0, max }: { label: string; hint: string; value: number; onChange: (value: number) => void; suffix?: string; prefix?: string; min?: number; max?: number }) {
  const id = label.replace(/\W+/g, "-").toLowerCase();
  return (
    <div>
      <label className="font-mono text-[10px] uppercase text-ink-light" htmlFor={id}>{label}</label>
      <div className="mt-1 flex items-center gap-2">
        {prefix ? <span className="text-ink-mid">{prefix}</span> : null}
        <input className="field-input" id={id} inputMode="decimal" max={max} min={min} onChange={(event) => onChange(Number(event.target.value))} type="number" value={Number.isFinite(value) ? value : 0} />
        {suffix ? <span className="text-ink-mid">{suffix}</span> : null}
      </div>
      <p className="mt-1 text-xs leading-5 text-ink-light">{hint}</p>
    </div>
  );
}

/** A what-if for coaches. Every figure is an assumption they control; the real statement lives on their dashboard. */
export function EarningsCalculator() {
  const [learners, setLearners] = useState(500);
  const [perLearner, setPerLearner] = useState(300);
  const [poolPct, setPoolPct] = useState(40);
  const [sharePct, setSharePct] = useState(5);
  const input = { learnersPerMonth: learners, netPerLearnerMinor: Math.round(perLearner * 100), poolBp: Math.round(poolPct * 100), shareBp: Math.round(sharePct * 100) };
  const result = estimateEarnings(input);
  const rows = shareSensitivity(input, [100, 250, 500, 1000, 2000]);

  return (
    <div className="mx-auto w-full max-w-5xl px-5 py-10 sm:px-8 sm:py-14">
      <p className="font-mono text-[10px] uppercase text-gold">Coach tools</p>
      <h1 className="mt-2 font-display text-4xl font-semibold leading-tight sm:text-5xl">Earnings calculator</h1>
      <p className="mt-3 max-w-2xl text-lg leading-8 text-ink-mid">Try your own assumptions to see how earnings could work. This is a what-if, not a promise. Your real statements, built from how learners actually use your lessons, are on your <Link className="text-teal underline underline-offset-4" href="/contribute/dashboard">dashboard</Link>.</p>

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <section aria-label="Your assumptions" className="space-y-5 border border-border bg-surface p-5 sm:p-6">
          <h2 className="font-display text-2xl">Your assumptions</h2>
          <Field hint="How many different learners use FutureSkilz in a month." label="Learners per month" onChange={setLearners} value={learners} />
          <Field hint="What the platform keeps from one learner in a month, after refunds, fees and tax. Prices are not set yet, so this is yours to try." label="Net revenue per learner" onChange={setPerLearner} prefix="₹" value={perLearner} />
          <Field hint="The share of net revenue set aside for coaches. The business has not approved this number yet; the draft policy starts at 0%." label="Coach pool" max={100} onChange={setPoolPct} suffix="%" value={poolPct} />
          <Field hint="The part of all learning that your lessons account for: time spent, completions, use of materials and usefulness. It depends on how many lessons you have and how useful learners find them." label="Your part of all learning" max={100} onChange={setSharePct} suffix="%" value={sharePct} />
        </section>

        <section aria-label="What it could mean" className="border-t-2 border-gold bg-ink p-5 text-cream sm:p-6">
          <h2 className="font-display text-2xl">What it could mean</h2>
          <dl className="mt-4 grid grid-cols-2 gap-px border border-cream/15 bg-cream/15 text-sm">
            {[["Net revenue a month", result.monthlyNetMinor], ["Coach pool a month", result.monthlyPoolMinor], ["Yours, a month", result.monthlyYoursMinor], ["Yours, a year", result.yearlyYoursMinor]].map(([label, value], index) => (
              <div key={label as string} className={`p-4 ${index >= 2 ? "bg-purple" : "bg-ink"}`}>
                <dt className="font-mono text-[10px] uppercase text-gold-light">{label}</dt>
                <dd className={`mt-1 font-display ${index >= 2 ? "text-3xl" : "text-2xl"}`}>{rupees(value as number)}</dd>
              </div>
            ))}
          </dl>
          <h3 className="mt-6 font-mono text-[10px] uppercase text-gold-light">The same assumptions, with a different share of learning</h3>
          <table className="mt-2 w-full text-sm">
            <thead><tr className="text-left text-cream/60"><th className="py-1 font-normal">Your part of all learning</th><th className="py-1 text-right font-normal">Yours, a month</th></tr></thead>
            <tbody>{rows.map((row) => <tr key={row.shareBp} className="border-t border-cream/10"><td className="py-1.5">{row.shareBp / 100}%</td><td className="py-1.5 text-right">{rupees(row.monthlyYoursMinor)}</td></tr>)}</tbody>
          </table>
          <p className="mt-5 text-xs leading-5 text-cream/65">How it is worked out: net revenue, times the coach pool, times your part of all learning. Nothing is payable until the business approves a policy, and a coach is only paid for lessons that are live, with the share set by attribution. Amounts depend on use.</p>
        </section>
      </div>
    </div>
  );
}
