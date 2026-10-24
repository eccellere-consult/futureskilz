/**
 * strategyModels/structure.ts — the structure of a framework that has no model of its own (one an admin created, or one not
 * yet converted): a single section of long-text fields built from its catalogue fields. It lets the same form, template and AI
 * code serve every framework; only the ones with a model get a reference diagram, typed fields and a worked example.
 */
import type { FrameworkField } from '../strategyFrameworks';
import { long, section } from './build';
import type { Prefill, Structure } from './types';

/** "Buyer power" → "buyer_power". */
export const slug = (label: string): string => label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'field';

/** A catalogue field's `source` ("Business Context" / "Value Scan" / "Manual" / "upstream: …") as a prefill hint. */
function prefillFromSource(source: string): Prefill | undefined {
  if (source === 'Business Context') return 'business_context';
  if (source === 'Value Scan') return 'value_scan';
  return undefined;
}

export function genericStructure(fields: readonly FrameworkField[]): Structure {
  const used = new Set<string>();
  const parts = fields.map((f) => {
    const base = slug(f.label);
    let key = base;
    for (let i = 2; used.has(key); i += 1) key = `${base}_${i}`;
    used.add(key);
    const prefill = prefillFromSource(f.source);
    // `value` is the catalogue's illustrative example, never an answer.
    return long(key, f.label, '', f.value, prefill ? { prefill } : {});
  });
  return { sections: [section('guided', 'Guided fill-in', '', ...parts)], derived: [], outputs: [] };
}
