/**
 * agentSkills.ts — admin-editable agent skill (methodology) content.
 *
 * Per the Agent Builder Architecture pattern (src/skills/ai-first-platform-intelligence.md,
 * Check 6): every agent's skill/methodology should be editable by an admin
 * from one page, not hardcoded in TypeScript — unless a specific part is
 * tightly coupled to a TS interface the engine parses (output schema/rules
 * stay in code; the actual expertise/methodology moves here).
 *
 * Bundled TS constants (e.g. financialStatementAnalyserPrompt.ts) are kept
 * as the seed value and fallback default — if no DB row exists yet, or the
 * row is empty, callers fall back to the bundled constant. Once an admin
 * edits it via /admin/agent-skills, the DB row becomes the live source.
 *
 * Storing this in MySQL (read at request time) is NOT the same risk as the
 * fs.readFileSync()-of-a-loose-file problem that motivated bundling the
 * skill as a TS constant in the first place — that was about the
 * standalone build's file tracing, which doesn't apply to a database read.
 */

import pool from './mysql';
import { ensureDatabaseSchema } from '../server/db/ensure-schema';

export interface AgentSkill {
  agentSlug: string;
  name: string;
  skillContent: string;
  updatedAt: string | null;
}

// FUTURESKILZ: the agent_skills table is created by the site's self-setup (src/server/db/ensure-schema.ts).
export async function ensureAgentSkillsTable(): Promise<void> {
  await ensureDatabaseSchema();
}

export async function getAgentSkill(agentSlug: string, fallback: string): Promise<string> {
  await ensureAgentSkillsTable();
  const [rows] = (await pool.query(
    'SELECT skill_content FROM agent_skills WHERE agent_slug = ? LIMIT 1',
    [agentSlug]
  )) as [{ skill_content: string | null }[], unknown];
  const content = rows[0]?.skill_content;
  return content && content.trim().length > 0 ? content : fallback;
}

/** Idempotent — only seeds if the row doesn't already exist (won't clobber an admin's edits on restart). */
export async function seedAgentSkillIfMissing(agentSlug: string, name: string, defaultContent: string): Promise<void> {
  await ensureAgentSkillsTable();
  await pool.query(
    `INSERT INTO agent_skills (agent_slug, name, skill_content) VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE agent_slug = agent_slug`, // no-op update — INSERT IGNORE-equivalent that still works with UNIQUE
    [agentSlug, name, defaultContent]
  );
}

export async function upsertAgentSkill(agentSlug: string, name: string, skillContent: string): Promise<AgentSkill> {
  await ensureAgentSkillsTable();
  await pool.query(
    `INSERT INTO agent_skills (agent_slug, name, skill_content) VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE name = VALUES(name), skill_content = VALUES(skill_content), updated_at = CURRENT_TIMESTAMP`,
    [agentSlug, name, skillContent]
  );
  const [rows] = (await pool.query(
    'SELECT agent_slug, name, skill_content, updated_at FROM agent_skills WHERE agent_slug = ? LIMIT 1',
    [agentSlug]
  )) as [Record<string, unknown>[], unknown];
  const row = rows[0];
  return {
    agentSlug: String(row.agent_slug),
    name: String(row.name),
    skillContent: String(row.skill_content ?? ''),
    updatedAt: row.updated_at ? String(row.updated_at) : null,
  };
}

export async function listAgentSkills(): Promise<AgentSkill[]> {
  await ensureAgentSkillsTable();
  const [rows] = (await pool.query(
    'SELECT agent_slug, name, skill_content, updated_at FROM agent_skills ORDER BY name ASC'
  )) as [Record<string, unknown>[], unknown];
  return rows.map((row) => ({
    agentSlug: String(row.agent_slug),
    name: String(row.name),
    skillContent: String(row.skill_content ?? ''),
    updatedAt: row.updated_at ? String(row.updated_at) : null,
  }));
}
