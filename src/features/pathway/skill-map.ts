import { skillTaxonomy } from "../../domain/skills/taxonomy";

/**
 * Which Skill Graph capabilities a coach's lesson builds. Rules suggest, a person confirms: a suggestion is an inference from
 * the words in the lesson, so a learner's pathway only uses a map an editor has confirmed.
 */
export type MappedSkill = { skill: string; toLevel: number };
export type LessonSkillMap = { status: "suggested" | "confirmed"; skills: MappedSkill[]; confirmedAt?: string };
export type Suggestion = MappedSkill & { name: string; hits: string[]; strength: "strong" | "possible" };

type MappableLesson = {
  title?: string;
  objective?: string;
  coreConcept?: string;
  narration?: string[];
  proficiency?: string;
  skillMap?: LessonSkillMap;
};

const known = new Set(skillTaxonomy.map((skill) => skill.slug));
const names = new Map(skillTaxonomy.map((skill) => [skill.slug, skill.name]));

/** Words and phrases that point at a capability. Plain stems, matched at word starts, so "negotiat" catches negotiating. */
export const RULES: Record<string, string[]> = {
  "analytical-thinking": ["analys", "analyz", "root cause", "break down", "pattern", "trend", "variance", "metric"],
  "critical-thinking": ["assumption", "evidence", "challenge", "question the", "bias", "validate", "verify", "test the claim"],
  "creative-thinking": ["creative", "brainstorm", "new idea", "alternative", "innovat", "reframe"],
  "strategic-thinking": ["strategy", "strategic", "long-term", "competitive", "positioning", "roadmap"],
  "systems-thinking": ["system", "dependency", "dependencies", "feedback loop", "end to end", "ripple", "knock-on"],
  "problem-solving": ["problem", "root cause", "five whys", "diagnos", "troubleshoot", "fix the cause", "defect"],
  "decision-making": ["decision", "decide", "trade-off", "tradeoff", "option", "criteria", "prioriti"],
  judgment: ["judgment", "judgement", "call it", "experience tells", "when to escalate", "gut", "weigh"],
  curiosity: ["curious", "ask why", "explore", "wonder"],
  "learning-agility": ["learn quickly", "new to", "pick up", "ramp up", "adapt what you know"],
  communication: ["communicat", "explain", "message", "brief", "write", "present", "tell the", "handover"],
  "executive-communication": ["executive", "board", "senior leader", "one page", "one-page", "summary for leadership"],
  collaboration: ["collaborat", "work together", "cross-functional", "teamwork", "hand off", "handoff", "shared goal"],
  leadership: ["lead the", "leading", "leader", "team lead", "direct report", "set direction", "delegat"],
  influence: ["influenc", "persuad", "buy-in", "win support", "without authority", "stakeholder support"],
  negotiation: ["negotiat", "concession", "bargain", "counter-offer", "terms with"],
  empathy: ["empath", "understand how they feel", "their perspective", "customer's perspective"],
  "active-listening": ["listen", "paraphras", "clarifying question", "hear what"],
  "conflict-management": ["conflict", "disagree", "dispute", "tension", "escalation between"],
  coaching: ["coach", "mentor", "feedback to", "develop your team", "guide a junior"],
  "stakeholder-management": ["stakeholder", "sponsor", "expectation", "keep informed", "alignment with"],
  "self-awareness": ["self-aware", "know your", "blind spot", "reflect on your"],
  resilience: ["resilien", "setback", "recover", "pressure", "bounce back"],
  adaptability: ["adapt", "change of plan", "re-plan", "replan", "unexpected", "disruption", "when plans change"],
  "growth-mindset": ["growth mindset", "keep learning", "learn from mistakes"],
  motivation: ["motivat", "stay engaged", "drive yourself"],
  "emotional-regulation": ["stay calm", "emotion", "composure", "react"],
  "personal-effectiveness": ["time management", "focus", "personal productivity", "manage your time", "habit"],
  "executive-presence": ["presence", "command the room", "credib"],
  "ai-literacy": ["what ai", "how ai", "ai can", "ai cannot", "language model", "machine learning", "limitations of ai"],
  "generative-ai": ["generative", "chatgpt", "copilot", "gen ai", "genai", "llm"],
  prompting: ["prompt", "instruction to the model", "few-shot", "system message"],
  "ai-collaboration": ["with an ai", "ai assistant", "ai teammate", "human in the loop", "human-in-the-loop"],
  "ai-assisted-research": ["ai research", "research with ai", "summaris", "summariz", "literature"],
  "ai-assisted-analysis": ["ai analysis", "analyse with ai", "analyze with ai", "ai to analy"],
  "ai-assisted-decision-making": ["ai decision", "decide with ai", "ai-assisted decision", "ai recommend"],
  "agentic-ai": ["agent", "agentic", "autonomous workflow", "tool use", "multi-step ai"],
  "ai-ethics": ["ethic", "fairness", "bias in ai", "responsible ai", "harm"],
  "ai-governance": ["governance", "ai policy", "model risk", "ai register", "oversight of ai"],
  "data-literacy": ["data", "chart", "dashboard", "statistic", "sample size", "average", "baseline figure", "measure"],
  "digital-literacy": ["digital", "software", "spreadsheet", "online tool", "app"],
  "technology-literacy": ["technology", "system integration", "api", "platform", "erp", "mes"],
  "cybersecurity-awareness": ["security", "phishing", "password", "breach", "confidential"],
  automation: ["automat", "script", "macro", "workflow tool", "robotic"],
  strategy: ["business strategy", "market position", "value proposition", "business case"],
  finance: ["budget", "cost", "margin", "cash flow", "p&l", "invoice", "roi"],
  marketing: ["marketing", "campaign", "brand", "customer segment", "funnel", "lead generation"],
  operations: ["operations", "production", "schedule", "throughput", "capacity", "supply", "inventory", "shift", "plant", "logistics", "quality"],
  "product-management": ["product", "feature", "user need", "backlog", "release", "roadmap"],
  "project-management": ["project", "milestone", "deliverable", "scope", "timeline", "risk register", "status report"],
};

/** The level a lesson can take someone to, from how advanced the coach marked it. */
export const levelForProficiency = (proficiency: string | undefined): number =>
  ({ foundational: 1.5, working: 2.5, proficient: 3.5, expert: 4.5 })[proficiency ?? ""] ?? 2;

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function suggestSkills(lesson: MappableLesson, limit = 5): Suggestion[] {
  const text = [lesson.title, lesson.objective, lesson.coreConcept, ...(lesson.narration ?? [])].filter(Boolean).join(" ").toLowerCase();
  if (!text.trim()) return [];
  const titleText = [lesson.title, lesson.objective].filter(Boolean).join(" ").toLowerCase();
  const toLevel = levelForProficiency(lesson.proficiency);
  const scored: Array<Suggestion & { score: number }> = [];
  for (const [skill, stems] of Object.entries(RULES)) {
    if (!known.has(skill)) continue;
    const hits: string[] = [];
    let score = 0;
    for (const stem of stems) {
      const pattern = new RegExp(`(?:^|[^a-z0-9])${escape(stem)}`, "g");
      const count = text.match(pattern)?.length ?? 0;
      if (count === 0) continue;
      hits.push(stem);
      score += Math.min(count, 3) + (new RegExp(`(?:^|[^a-z0-9])${escape(stem)}`).test(titleText) ? 3 : 0);
    }
    if (score >= 2) scored.push({ skill, name: names.get(skill) ?? skill, toLevel, hits, strength: score >= 5 || hits.length >= 2 ? "strong" : "possible", score });
  }
  return scored.sort((a, b) => b.score - a.score || a.skill.localeCompare(b.skill)).slice(0, limit).map((item) => ({ skill: item.skill, name: item.name, toLevel: item.toLevel, hits: item.hits, strength: item.strength }));
}

/** Cleans what an editor submits: known skills only, levels clamped to 0.5–5 in steps of 0.5, no duplicates, at most six. */
export function cleanSkillMap(input: unknown): MappedSkill[] {
  if (!Array.isArray(input)) return [];
  const seen = new Set<string>();
  const out: MappedSkill[] = [];
  for (const item of input) {
    if (!item || typeof item !== "object") continue;
    const { skill, toLevel } = item as { skill?: unknown; toLevel?: unknown };
    if (typeof skill !== "string" || !known.has(skill) || seen.has(skill) || typeof toLevel !== "number" || !Number.isFinite(toLevel)) continue;
    seen.add(skill);
    out.push({ skill, toLevel: Math.min(5, Math.max(0.5, Math.round(toLevel * 2) / 2)) });
    if (out.length === 6) break;
  }
  return out;
}

/** Skills a learner's pathway may rely on: only those an editor confirmed. */
export const confirmedSkills = (lesson: MappableLesson): MappedSkill[] => (lesson.skillMap?.status === "confirmed" ? lesson.skillMap.skills : []);
