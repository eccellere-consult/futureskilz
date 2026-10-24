/**
 * strategyHubSkill.ts — per-framework editable "how the analysis is done"
 * methodology, reusing agentSkills.ts's admin-editable skill store (the
 * same mechanism Agent CFO's Value Scan already uses) rather than inventing
 * a second system. Slug convention: `strategy-hub-<toolId>` — one row per
 * framework once content exists for it, keeping every framework's
 * methodology independently editable without a 36-entry hardcoded list.
 *
 * No admin has to hand-author 36 skill docs from scratch: buildDefaultSkill
 * assembles a genuinely specific starting methodology straight from the
 * framework's own already-authored does/whenToUse/whenNotToUse/
 * evidenceRequirements/scoringGuidance/reportTemplate/fields — content that
 * already exists on the catalogue entry — so every framework has a real
 * default from day one, not a placeholder. This is load-bearing, not
 * decorative: getFrameworkSkill's output is what "Update with AI" and
 * "Generate Recommendations" actually send the model — editing it in the
 * tool page changes real behaviour.
 */

import { getAgentSkill, upsertAgentSkill } from './agentSkills';
import type { StrategyFrameworkRow } from './strategyFrameworks';
import { getModelDefinition } from './strategyModels/registry';
import { isTable } from './strategyModels/types';

/** FUTURESKILZ: a workspace tool's methodology is stored under `<section>-<toolId>`; the hub's own prefix stays the default. */
export function strategyHubSkillSlug(toolId: string, section = 'strategy-hub'): string {
  return `${section}-${toolId}`;
}

export function buildDefaultSkill(framework: StrategyFrameworkRow): string {
  const lines: string[] = [];
  lines.push(`# ${framework.name} — Analysis Methodology`);
  lines.push('');
  lines.push(`**Stage:** ${framework.layer}   **Nature:** ${framework.nature}`);
  lines.push('');
  lines.push('## What this framework does');
  lines.push(framework.does || '(not yet described on the catalogue entry)');
  lines.push('');
  lines.push('## When to use it');
  lines.push(framework.whenToUse || '(not yet described on the catalogue entry)');
  if (framework.whenNotToUse) {
    lines.push('');
    lines.push('## When NOT to use it');
    lines.push(framework.whenNotToUse);
  }
  if (framework.evidenceRequirements) {
    lines.push('');
    lines.push('## Evidence required');
    lines.push(framework.evidenceRequirements);
  }
  if (framework.scoringGuidance) {
    lines.push('');
    lines.push('## Scoring guidance');
    lines.push(framework.scoringGuidance);
  }
  lines.push('');
  lines.push('## How to fill in each field');
  lines.push(
    "Ground every field in real evidence — the client's Business Context, their latest Value Scan, or an uploaded document — before falling back to a well-reasoned, explicitly-labelled MSME-typical assumption. Never write a placeholder like \"TBD\" or \"N/A\". Be specific and detailed — there is no length limit, so a longer, well-evidenced answer always beats a short generic one."
  );
  const model = getModelDefinition(framework.toolId);
  if (model) {
    // A framework with a model is filled in element by element, as its originator defines them.
    lines.push(`Source of the model: ${model.reference.originator}, ${model.reference.year}. ${model.reference.summary}`);
    for (const sec of model.sections) {
      lines.push('');
      lines.push(`### ${sec.title}`);
      if (sec.summary) lines.push(sec.summary);
      for (const p of sec.parts) {
        lines.push(`- **${p.label}** — ${p.help}`);
        if (isTable(p)) {
          for (const c of p.columns.filter((x) => x.type !== 'computed')) lines.push(`  - ${c.header}: ${c.help}`);
          if (p.fixedRows) lines.push(`  - Rows (one each): ${p.fixedRows.join('; ')}`);
        }
      }
    }
    lines.push('');
    lines.push('## How to reach the verdict');
    lines.push(model.analysisGuide);
  } else if (framework.fields.length > 0) {
    lines.push('');
    framework.fields.forEach((f) => {
      lines.push(`- **${f.label}**${f.value ? ` — e.g. "${f.value}"` : ''}`);
    });
  }
  if (framework.reportTemplate) {
    lines.push('');
    lines.push('## How the completed output should read');
    lines.push(framework.reportTemplate);
  }
  lines.push('');
  lines.push('## Analysis, Recommendations & Actionables');
  lines.push('Once the fields above are filled in, produce:');
  lines.push(
    '1. **Analysis** — a plain-language summary of what the completed framework says, the framework\'s headline verdict (where it has one), 3-6 specific findings the answers reveal, and the assumptions or evidence gaps worth challenging. Where the client has saved work in the tools this one builds on, stay consistent with it.'
  );
  lines.push(
    '2. **Recommendations** — 3-6 specific, evidence-grounded strategic recommendations that follow directly from the analysis. Never generic advice ("improve marketing") — each recommendation must reference the actual field values it is grounded in.'
  );
  lines.push(
    '3. **Actionables** — 3-8 concrete next steps, each with a realistic owner (a role, e.g. "Finance Head", "Founder"), a specific timeframe (e.g. "Next 30 days", "This quarter"), and a priority (High/Medium/Low). These should be things a business could genuinely start this week, not vague aspirations.'
  );
  return lines.join('\n');
}

/** Read-only accessor any logged-in viewer can call — the methodology is
 * meant to be visible (builds trust in how the analysis was produced), only
 * editing is admin-gated (see saveFrameworkSkill). */
export async function getFrameworkSkill(framework: StrategyFrameworkRow): Promise<string> {
  return getAgentSkill(strategyHubSkillSlug(framework.toolId, framework.section), buildDefaultSkill(framework));
}

export async function saveFrameworkSkill(toolId: string, name: string, skillContent: string, section?: string): Promise<void> {
  await upsertAgentSkill(strategyHubSkillSlug(toolId, section), name, skillContent);
}
