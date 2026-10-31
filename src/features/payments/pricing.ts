/** What a learner pays: the list price less a percentage-off code, in whole paise. */
export function applyDiscount(listMinor: number, percentOffBp: number): { listMinor: number; discountMinor: number; payMinor: number } {
  const off = Math.min(10000, Math.max(0, Math.round(percentOffBp)));
  const discountMinor = Math.floor((listMinor * off) / 10000);
  return { listMinor, discountMinor, payMinor: listMinor - discountMinor };
}

/** The gateway cannot take less than one rupee. A code that would take the price below that is refused, so nobody is charged nothing by accident. */
export const MIN_CHARGE_MINOR = 100;
