import type { DraftNode, NeedsDraft, ProgramBrief, TreeDraft } from "./types";

/**
 * The starting structure used when no AI is available. It is generic on purpose: it only sets out the standard shape of a
 * training (why, core methods, practice on the job) for the person to fill in. It is labelled as a scaffold wherever shown.
 */
export function scaffoldNeeds(brief: ProgramBrief): NeedsDraft {
  const who = brief.audience.role;
  const topic = brief.topic;
  return {
    needs: [
      { statement: `${who} can explain in plain words what ${topic} means for their daily work.`, evidence: "assumption", priority: "high", askClient: "What do these learners get wrong or avoid today?" },
      { statement: `${who} can apply the core method of ${topic} to a real case from their own job.`, evidence: "inferred", priority: "high", askClient: "Which real case would show the method working?" },
      { statement: `${who} can spot the most common mistakes in ${topic} and correct them.`, evidence: "assumption", priority: "medium", askClient: "Which mistakes cost the most today?" },
      { statement: `${who} can decide what to do next on the job and show the result.`, evidence: "inferred", priority: "medium", askClient: null },
    ],
  };
}

export function scaffoldTree(brief: ProgramBrief, needIds: string[]): TreeDraft {
  const [n1, n2, n3, n4] = [needIds[0], needIds[1], needIds[2], needIds[3]].map((id) => (id ? [id] : []));
  const leaf = (title: string, summary: string, skills: string[], needs: string[], minutes = 8): DraftNode => ({ title, summary, skills, needIds: needs, minutes });
  const topic = brief.topic;
  return {
    modules: [
      {
        title: `Why ${topic} matters`,
        summary: "Set the purpose and the words used.",
        children: [
          leaf(`What ${topic} is, in plain words`, "Explain the idea simply, with one example from the learners' own work.", ["analytical-thinking"], n1),
          leaf("Where it goes wrong today", "Show the cost of the current way of working, from a real or illustrative case.", ["critical-thinking"], n3),
        ],
      },
      {
        title: "The core method",
        summary: "Teach the method step by step.",
        children: [
          leaf("The method in five steps", "Walk through the steps on one worked case.", ["problem-solving"], n2),
          leaf("Choosing between options", "Practise one decision with explained trade-offs.", ["decision-making"], n2),
        ],
      },
      {
        title: "Using it on the job",
        summary: "Move from learning to doing.",
        children: [
          leaf("A first job-based task", "Give each learner one task for this week with a clear check.", ["problem-solving"], n4),
          leaf("Explaining the result to others", "Teach the learner to present what they did and found.", ["communication"], n4),
        ],
      },
    ],
  };
}
