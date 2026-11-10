import type { SectionId } from "../capture/knowledge-package";

/**
 * The framework lens: for a piece of confirmed knowledge, the proven method that fits it best, so a Skill Shot rests on a real,
 * named way of working instead of a loose summary. Chosen in code from what the piece is about and the words in it; the design
 * agent is told to use the method only where the statements really fit it, and to add no facts to make it fit.
 */
export type Framework = { id: string; name: string; useWhen: string; steps: string[]; sections: SectionId[]; words: string[] };

export const FRAMEWORKS: Framework[] = [
  { id: "five-whys", name: "5 Whys", useWhen: "a problem keeps coming back and the cause is not yet known", steps: ["State the problem as seen", "Ask why it happened", "Ask why again for each answer, about five times", "Stop at a cause you can check and fix", "Act on that cause"], sections: ["mistakes"], words: ["cause", "why", "repeat", "recurring", "root", "defect", "failure", "again"] },
  { id: "pdca", name: "PDCA (Plan, Do, Check, Act)", useWhen: "an improvement is tried, measured and then made standard", steps: ["Plan the change and the result expected", "Do it on a small scale", "Check what actually happened", "Act: make it standard or try again"], sections: ["practices"], words: ["improve", "trial", "pilot", "standard", "review", "continuous", "measure"] },
  { id: "sipoc", name: "SIPOC (Supplier, Input, Process, Output, Customer)", useWhen: "a process must be understood end to end before changing it", steps: ["Name the process and where it starts and ends", "List the outputs and who receives them", "List the inputs and who supplies them", "Write the five to seven main steps"], sections: ["processes", "functions"], words: ["process", "handover", "input", "output", "supplier", "customer", "flow", "step"] },
  { id: "five-w-two-h", name: "5W2H", useWhen: "a task or a problem must be stated completely and clearly", steps: ["What", "Why", "Where", "When", "Who", "How", "How much"], sections: ["howto"], words: ["who", "when", "where", "how much", "plan", "checklist", "instruction"] },
  { id: "raci", name: "RACI", useWhen: "work crosses people or teams and it must be clear who does what", steps: ["List the tasks", "Name who is Responsible for each", "Name the one person Accountable", "Name who is Consulted", "Name who is Informed"], sections: ["roles"], words: ["responsible", "accountable", "owner", "team", "approve", "sign-off", "escalat"] },
  { id: "smart", name: "SMART measures", useWhen: "a target or measure must be clear enough to check", steps: ["Specific", "Measurable", "Achievable", "Relevant", "Time-bound"], sections: ["kpis"], words: ["target", "kpi", "measure", "metric", "goal", "percent", "%"] },
  { id: "pareto", name: "Pareto (80/20)", useWhen: "there are many causes or items and effort must go to the few that matter most", steps: ["List the causes or items", "Count or cost each", "Sort from largest to smallest", "Act on the few that make up most of the total"], sections: ["factors"], words: ["most", "top", "majority", "priorit", "few", "biggest", "80"] },
  { id: "swot", name: "SWOT", useWhen: "a business or a choice is weighed from inside and outside", steps: ["Strengths", "Weaknesses", "Opportunities", "Threats", "Decide what to use, fix, take and guard against"], sections: ["industry"], words: ["strength", "weakness", "opportunit", "threat", "competitor", "market"] },
  { id: "star", name: "STAR (Situation, Task, Action, Result)", useWhen: "a real case is told so that others can learn from it", steps: ["Situation: what was going on", "Task: what had to be achieved", "Action: what was done and why", "Result: what happened and what was learnt"], sections: ["cases", "leadership"], words: ["case", "situation", "result", "story", "happened", "learnt", "decided"] },
  { id: "skill-will", name: "Skill and Will", useWhen: "deciding how to guide a person: direct, coach, support or delegate", steps: ["Judge the person's skill for this task", "Judge their will for it", "Low skill, high will: guide", "High skill, low will: motivate", "Low on both: direct", "High on both: delegate"], sections: ["skills", "training"], words: ["coach", "train", "motivat", "delegate", "mentor", "new joiner", "capab"] },
  // The rest of the twelve Problem Solving methods of the Framework Workspace skill (5W2H, Pareto, 5 Whys and PDCA are above).
  { id: "copq", name: "Cost of Poor Quality", useWhen: "the money lost to rework, scrap, returns and checking must be made visible", steps: ["List what is spent on prevention", "List what is spent on checking (appraisal)", "List the cost of failures found inside", "List the cost of failures the customer found", "Compare the total with revenue and act on the biggest group"], sections: [], words: ["rework", "scrap", "warranty", "returns", "cost of quality", "rejection", "waste"] },
  { id: "is-is-not", name: "Is / Is-Not analysis", useWhen: "a problem shows up in some places or times and not in others, and that difference can point to the cause", steps: ["Say what, where, when and how much the problem IS", "Say what, where, when and how much it IS NOT, though it could be", "Name what is different about the IS", "Name what changed, with its date"], sections: [], words: ["only on", "only in", "since", "except", "but not", "difference", "changed"] },
  { id: "affinity", name: "Affinity diagram", useWhen: "many loose ideas or observations must be sorted into a few clear groups", steps: ["Write each idea on its own note", "Move notes that belong together side by side, without talking it through first", "Name each group", "Look at which group is largest and what is missing"], sections: [], words: ["ideas", "brainstorm", "themes", "group", "sort", "feedback", "voice of"] },
  { id: "fishbone", name: "Fishbone (cause and effect)", useWhen: "a problem could have many kinds of cause and all of them should be looked at before choosing", steps: ["Write the effect at the head", "Draw six bones: Machine, Method, Material, Manpower, Measurement, Environment", "Put each possible cause on its bone", "Mark the most likely, then check them with facts"], sections: [], words: ["machine", "method", "material", "manpower", "measurement", "environment", "possible causes"] },
  { id: "impact-effort", name: "Impact-Effort matrix", useWhen: "there are several possible fixes and the easy, valuable ones should come first", steps: ["List the possible fixes", "Score each for impact and for effort", "Do the quick wins first", "Plan the major projects", "Fit in the small ones and avoid the rest"], sections: [], words: ["quick win", "effort", "impact", "priorit", "low-hanging", "which first"] },
  { id: "pugh", name: "Pugh matrix", useWhen: "a few options must be compared fairly against the same criteria", steps: ["Choose the baseline option", "List the criteria and weight them", "Mark each option better, same or worse than the baseline on each criterion", "Add the weighted scores", "Choose, and say why if the choice is not the top score"], sections: [], words: ["option", "alternative", "compare", "criteria", "choose between", "trade-off", "vendor"] },
  { id: "fmea-lite", name: "FMEA (lite)", useWhen: "the ways something could fail should be found and dealt with before they happen", steps: ["List how it could fail", "Rate how bad each failure is", "Rate how often it could happen", "Rate how hard it is to notice", "Multiply the three and act on the highest first"], sections: [], words: ["risk", "could fail", "failure mode", "severity", "prevent", "what could go wrong", "safety"] },
  { id: "a3", name: "A3 report", useWhen: "a whole problem and its solution must be told on one page", steps: ["Background", "Current condition", "Goal", "Root cause analysis", "Countermeasures", "Implementation plan", "Follow-up"], sections: [], words: ["report", "one page", "summary", "countermeasure", "follow-up", "review meeting"] },
];

/** The best-fitting framework for a piece, or null when nothing fits well enough to be worth naming. */
export function pickFramework(section: SectionId, text: string): Framework | null {
  const lower = text.toLowerCase();
  let best: { framework: Framework; score: number } | null = null;
  for (const framework of FRAMEWORKS) {
    const score = (framework.sections.includes(section) ? 3 : 0) + framework.words.filter((word) => lower.includes(word)).length;
    if (!best || score > best.score) best = { framework, score };
  }
  return best && best.score >= 3 ? best.framework : null;
}

/** The instruction given to the design agent. The method shapes the lesson; the statements stay the only source of facts. */
export function frameworkNote(framework: Framework): string {
  return `Suggested method: ${framework.name}, used when ${framework.useWhen}. Its steps: ${framework.steps.join("; ")}. Shape the lesson around this method ONLY where the confirmed statements fit it; name the method once in plain words; add no fact to make it fit. If it does not fit, ignore it.`;
}
