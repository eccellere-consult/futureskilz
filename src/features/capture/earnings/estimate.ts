/**
 * A coach's what-if: not a statement. The platform has not approved a revenue formula, so every figure here comes from numbers the
 * coach types in. The shape follows the policy engine (a pool taken from net revenue, shared by each coach's part of all learning),
 * but the pool and share are assumptions, never promises. Money is whole minor units (paise).
 */

export type EstimateInput = {
  learnersPerMonth: number;
  /** Net revenue the platform keeps from one learner in a month, after refunds, fees and tax. */
  netPerLearnerMinor: number;
  /** Share of net revenue set aside for coaches, in basis points (1% = 100). */
  poolBp: number;
  /** The part of all learning on the platform that this coach's lessons account for, in basis points. */
  shareBp: number;
};

export type Estimate = { monthlyNetMinor: number; monthlyPoolMinor: number; monthlyYoursMinor: number; yearlyYoursMinor: number };

const whole = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, Number.isFinite(value) ? Math.floor(value) : min));

export function estimateEarnings(input: EstimateInput): Estimate {
  const learners = whole(input.learnersPerMonth, 0, 10_000_000);
  const perLearner = whole(input.netPerLearnerMinor, 0, 100_000_000);
  const pool = whole(input.poolBp, 0, 10_000);
  const share = whole(input.shareBp, 0, 10_000);
  const monthlyNetMinor = learners * perLearner;
  const monthlyPoolMinor = Math.floor((monthlyNetMinor * pool) / 10_000);
  const monthlyYoursMinor = Math.floor((monthlyPoolMinor * share) / 10_000);
  return { monthlyNetMinor, monthlyPoolMinor, monthlyYoursMinor, yearlyYoursMinor: monthlyYoursMinor * 12 };
}

/** What the same assumptions give at other shares of learning, so a coach sees how much depends on how their lessons are used. */
export function shareSensitivity(input: EstimateInput, sharesBp: number[]): Array<{ shareBp: number; monthlyYoursMinor: number }> {
  return sharesBp.map((shareBp) => ({ shareBp, monthlyYoursMinor: estimateEarnings({ ...input, shareBp }).monthlyYoursMinor }));
}
