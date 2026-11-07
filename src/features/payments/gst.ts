/**
 * GST on a tax-inclusive price, and invoice numbering. Prices in FutureSkilz are what the learner pays, tax included, so the
 * taxable value is worked back from the price. Money is whole minor units (paise); the parts always add up to the price.
 *
 * This follows the usual rules for a registered supplier of online services to a consumer in India: CGST and SGST when the
 * supplier and the customer are in the same state, otherwise IGST. The rate, the supplier's state and GSTIN are configuration,
 * and the invoice format must be reviewed by the business's chartered accountant before it is used for filing.
 */
export const DEFAULT_GST_RATE_BP = 1800;

/** GST state and union territory codes. */
export const STATES: Array<{ code: string; name: string }> = [
  ["01", "Jammu and Kashmir"], ["02", "Himachal Pradesh"], ["03", "Punjab"], ["04", "Chandigarh"], ["05", "Uttarakhand"], ["06", "Haryana"], ["07", "Delhi"], ["08", "Rajasthan"], ["09", "Uttar Pradesh"], ["10", "Bihar"], ["11", "Sikkim"], ["12", "Arunachal Pradesh"], ["13", "Nagaland"], ["14", "Manipur"], ["15", "Mizoram"], ["16", "Tripura"], ["17", "Meghalaya"], ["18", "Assam"], ["19", "West Bengal"], ["20", "Jharkhand"], ["21", "Odisha"], ["22", "Chhattisgarh"], ["23", "Madhya Pradesh"], ["24", "Gujarat"], ["26", "Dadra and Nagar Haveli and Daman and Diu"], ["27", "Maharashtra"], ["29", "Karnataka"], ["30", "Goa"], ["31", "Lakshadweep"], ["32", "Kerala"], ["33", "Tamil Nadu"], ["34", "Puducherry"], ["35", "Andaman and Nicobar Islands"], ["36", "Telangana"], ["37", "Andhra Pradesh"], ["38", "Ladakh"],
].map(([code, name]) => ({ code, name }));

export const isStateCode = (code: string): boolean => STATES.some((state) => state.code === code);

export type TaxSplit = { rateBp: number; taxableMinor: number; cgstMinor: number; sgstMinor: number; igstMinor: number; taxMinor: number; totalMinor: number; intraState: boolean };

export function splitTaxInclusive(totalMinor: number, rateBp: number, supplierState: string, customerState: string): TaxSplit {
  if (!Number.isInteger(totalMinor) || totalMinor < 0) throw new Error("The amount must be a whole number of paise, zero or more.");
  const taxable = Math.round((totalMinor * 10000) / (10000 + rateBp));
  const tax = totalMinor - taxable;
  const intraState = supplierState !== "" && supplierState === customerState;
  const cgst = intraState ? Math.floor(tax / 2) : 0;
  const sgst = intraState ? tax - cgst : 0;
  return { rateBp, taxableMinor: taxable, cgstMinor: cgst, sgstMinor: sgst, igstMinor: intraState ? 0 : tax, taxMinor: tax, totalMinor, intraState };
}

/** The Indian financial year (April to March) of an instant, as "26-27". Uses India time, so a late-night 31 March sale is in the right year. */
export function financialYear(at: Date): string {
  const ist = new Date(at.getTime() + 5.5 * 3_600_000);
  const year = ist.getUTCMonth() >= 3 ? ist.getUTCFullYear() : ist.getUTCFullYear() - 1;
  return `${String(year % 100).padStart(2, "0")}-${String((year + 1) % 100).padStart(2, "0")}`;
}

/** Serial numbers are consecutive within a financial year and at most 16 characters, as GST invoice rules require: "FS/26-27/000001". */
export function invoiceNumber(fy: string, sequence: number, prefix = "FS"): string {
  return `${prefix}/${fy}/${String(sequence).padStart(6, "0")}`;
}

export const nextSequence = (numbers: string[], fy: string, prefix = "FS"): number => {
  const head = `${prefix}/${fy}/`;
  return numbers.reduce((max, value) => (value.startsWith(head) ? Math.max(max, Number.parseInt(value.slice(head.length), 10) || 0) : max), 0) + 1;
};
