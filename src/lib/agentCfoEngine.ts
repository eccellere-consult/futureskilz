/**
 * Adapter for the framework workspace engine (references/07 §2, adapter 4). Eccellere passes a company's latest Value Scan
 * (financial diagnostic) summary to the AI. FutureSkilz has no financial diagnostic, so there is never one to pass.
 */
export async function getLatestValueScanSummary(_email: string): Promise<string> {
  void _email;
  return "";
}
