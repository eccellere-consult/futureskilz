import type { Expectation, FactCategory, PhaseId, Scope } from "./types";

/**
 * The question library from the platform specification (phases A to O). It is a library, not a script: the planner chooses
 * from it using what the expert has already said, what is still missing and how much time is left.
 *
 * - `tier: core` questions make the shortest credible route. `deep` questions run only when the expert chooses to go deeper.
 * - `expects` are the signals a good answer usually carries. Missing ones become the next follow-up, so the companion asks
 *   for an example only when no example was given.
 * - `confirmable` questions can be replaced by "I already have this, is it right?" when an upload or earlier answer covers them.
 */
export type QuestionDef = {
  key: string;
  phase: PhaseId;
  scope: Scope;
  tier: "core" | "deep";
  text: string;
  why: string;
  produces: FactCategory[];
  minWords: number;
  expects: Expectation[];
  weight: number;
  needs?: string[];
  confirmable?: FactCategory;
  /** Words that, when they appear in the expert's stated focus, raise this question's priority. */
  focus?: string[];
};

export const PHASE_LABELS: Record<PhaseId, string> = {
  A: "Welcome and goals",
  B: "How your career began",
  C: "Your career timeline",
  D: "Industry and business",
  E: "Organisation and work flow",
  F: "Your role",
  G: "Processes and how-to",
  H: "Performance and KPIs",
  I: "High performers",
  J: "People and teamwork",
  K: "Stories and turning points",
  L: "Leaders and mentors",
  M: "Judgement and tacit knowledge",
  N: "Training a newcomer",
  O: "Career summary",
};

/** Phase order inside one role. Project-level phases (A, B, C, L, O) are handled by the planner around it. */
export const ROLE_PHASE_ORDER: PhaseId[] = ["C", "D", "E", "F", "G", "H", "K", "M", "I", "J", "N"];

const q = (def: QuestionDef): QuestionDef => def;

export const QUESTION_BANK: QuestionDef[] = [
  // Phase A — welcome, goals, boundaries (consent itself is recorded at registration, not asked again here)
  q({ key: "a.teach", phase: "A", scope: "project", tier: "core", weight: 10, minWords: 12, expects: [], produces: ["permission", "training"],
    text: "What would you like future professionals to learn from your experience?",
    why: "Your answer sets the direction. It tells me which parts of your career to explore in depth." }),
  q({ key: "a.topics", phase: "A", scope: "project", tier: "core", weight: 9, minWords: 6, expects: [], produces: ["permission", "skill"],
    text: "Which industries, functions or topics would you most enjoy talking about?",
    why: "I will spend your time where you have the most to give and the most energy." }),
  q({ key: "a.limits", phase: "A", scope: "project", tier: "core", weight: 9, minWords: 1, expects: [], produces: ["permission"],
    text: "Is there anything you do not want recorded or published, such as client names, internal figures or personal matters?",
    why: "You stay in control. I will mark these limits and keep anything sensitive out of published lessons." }),

  // Phase B — career origin
  q({ key: "b.first_job", phase: "B", scope: "project", tier: "core", weight: 8, minWords: 20, expects: ["date"], produces: ["career"],
    text: "When did you begin working, and what was your first job? Please include the employer, place and industry if you remember them.",
    why: "Your first job anchors the timeline. Approximate years are fine." }),
  q({ key: "b.prepare", phase: "B", scope: "project", tier: "core", weight: 7, minWords: 25, expects: ["example"], produces: ["training", "skill"], needs: ["b.first_job"],
    text: "How did you get that job, and how did you prepare for it? Think about education, training, practical exposure and people who helped.",
    why: "Newcomers can copy a preparation route that worked." }),
  q({ key: "b.day_one", phase: "B", scope: "project", tier: "core", weight: 7, minWords: 25, expects: ["example"], produces: ["skill", "tacit"], needs: ["b.first_job"],
    text: "What did you need to know on day one, and what surprised you most in the first months?",
    why: "This is the gap between what is taught and what the work demands." }),
  q({ key: "b.on_the_job", phase: "B", scope: "project", tier: "deep", weight: 4, minWords: 20, expects: ["example"], produces: ["skill", "tacit"], needs: ["b.first_job"],
    text: "Which skills did you learn on the job rather than in formal education?",
    why: "Skills learned on the job are the ones courses rarely cover." }),
  q({ key: "b.advice", phase: "B", scope: "project", tier: "deep", weight: 4, minWords: 15, expects: [], produces: ["tacit", "training"], needs: ["b.first_job"],
    text: "What advice would have helped you at that stage?",
    why: "It points to what a newcomer needs most." }),

  // Phase C — one career walk-through, then per-role basics
  q({ key: "c.walk", phase: "C", scope: "project", tier: "core", weight: 10, minWords: 30, expects: ["date"], produces: ["career"], needs: ["b.first_job"],
    text: "Please walk me through your career in order, from your first job to your last. For each job, give the employer, your title and the years, as closely as you remember.",
    why: "I will turn this into a draft timeline for you to correct. Then we can choose which jobs to explore." }),
  q({ key: "c.title", phase: "C", scope: "role", tier: "core", weight: 6, minWords: 12, expects: [], produces: ["career", "role"], confirmable: "role",
    text: "In this role, who did you report to, how big was your team and what did you own?",
    why: "Reporting lines and scope show what the role really covered." }),
  q({ key: "c.turning", phase: "C", scope: "role", tier: "core", weight: 7, minWords: 25, expects: ["example", "outcome"], produces: ["case", "career"],
    text: "What were the most important achievements or turning points in this role?",
    why: "Turning points are where the best lessons usually sit." }),
  q({ key: "c.useful_today", phase: "C", scope: "role", tier: "core", weight: 8, minWords: 20, expects: ["example"], produces: ["training", "tacit"],
    text: "Which experience from this role would be most useful to someone entering the profession today?",
    why: "This tells me which parts of the role are worth turning into lessons." }),
  q({ key: "c.transition", phase: "C", scope: "role", tier: "deep", weight: 3, minWords: 15, expects: [], produces: ["career"],
    text: "Why did you join this role, and why did you move on from it?",
    why: "Transitions show how careers actually progress." }),
  q({ key: "c.expertise_change", phase: "C", scope: "role", tier: "deep", weight: 4, minWords: 20, expects: ["example"], produces: ["skill"],
    text: "How did your expertise change during this period?",
    why: "It shows which skills grew and how." }),

  // Phase D — industry and business context
  q({ key: "d.explain", phase: "D", scope: "role", tier: "core", weight: 8, minWords: 30, expects: [], produces: ["industry"], focus: ["industry"],
    text: "How would you explain this industry to a newcomer?",
    why: "A clear industry picture is the first lesson any newcomer needs." }),
  q({ key: "d.players", phase: "D", scope: "role", tier: "core", weight: 7, minWords: 25, expects: [], produces: ["industry"], needs: ["d.explain"],
    text: "Who are the customers, suppliers, competitors and regulators in this industry?",
    why: "Knowing who matters helps newcomers read the business." }),
  q({ key: "d.value", phase: "D", scope: "role", tier: "core", weight: 8, minWords: 30, expects: ["example"], produces: ["industry"], needs: ["d.explain"],
    text: "What creates value here, and what drives cost, quality, delivery, risk and profit?",
    why: "Value and cost drivers explain why decisions get made the way they do." }),
  q({ key: "d.change", phase: "D", scope: "role", tier: "deep", weight: 4, minWords: 25, expects: ["example"], produces: ["industry"],
    text: "What market, technology, policy or customer changes affected the work?",
    why: "Change is what makes older knowledge useful or out of date." }),
  q({ key: "d.winners", phase: "D", scope: "role", tier: "deep", weight: 4, minWords: 25, expects: ["example"], produces: ["industry", "practice"],
    text: "What set high-performing companies apart in this industry?",
    why: "It points to practices worth teaching." }),
  q({ key: "d.terms", phase: "D", scope: "role", tier: "deep", weight: 4, minWords: 15, expects: [], produces: ["industry", "training"],
    text: "Which industry terms, standards or operating limits should a newcomer understand early?",
    why: "Shared vocabulary saves a newcomer months." }),

  // Phase E — organisation, functions, work flow
  q({ key: "e.structure", phase: "E", scope: "role", tier: "core", weight: 8, minWords: 30, expects: [], produces: ["function"],
    text: "How was the company organised, and what was each main function responsible for?",
    why: "A map of functions shows where a role fits." }),
  q({ key: "e.flow", phase: "E", scope: "role", tier: "core", weight: 9, minWords: 40, expects: ["steps"], produces: ["process", "function"], needs: ["e.structure"],
    text: "How did work flow from a customer need through planning, doing the work, delivery and support?",
    why: "The end-to-end flow is the backbone of a learning path." }),
  q({ key: "e.handoffs", phase: "E", scope: "role", tier: "core", weight: 7, minWords: 25, expects: ["example"], produces: ["process", "mistake"], needs: ["e.flow"],
    text: "Where were the key handoffs and decision points, and where did delays, errors or rework usually occur?",
    why: "Handoffs are where most things go wrong, so they teach the most." }),
  q({ key: "e.measures", phase: "E", scope: "role", tier: "deep", weight: 5, minWords: 25, expects: ["number", "tool"], produces: ["kpi"], needs: ["e.structure"],
    text: "What measures or scorecards did each function use?",
    why: "Function measures show what each team was held to." }),
  q({ key: "e.collab", phase: "E", scope: "role", tier: "deep", weight: 5, minWords: 25, expects: ["example"], produces: ["leadership", "practice"], needs: ["e.structure"],
    text: "How did functions work together when their priorities differed?",
    why: "Cross-functional judgement is hard to learn from books." }),

  // Phase F — the role itself
  q({ key: "f.purpose", phase: "F", scope: "role", tier: "core", weight: 9, minWords: 25, expects: [], produces: ["role"],
    text: "What was this role for, and how was success defined?",
    why: "Purpose and success measures anchor everything else about the role." }),
  q({ key: "f.duties", phase: "F", scope: "role", tier: "core", weight: 8, minWords: 35, expects: ["steps"], produces: ["role", "function"], needs: ["f.purpose"],
    text: "What were your main responsibilities and recurring activities?",
    why: "Recurring work is the first thing a newcomer must learn to do." }),
  q({ key: "f.rhythm", phase: "F", scope: "role", tier: "core", weight: 7, minWords: 35, expects: ["steps"], produces: ["role"], needs: ["f.duties"],
    text: "Walk me through a typical day, week and month, and any major planning cycle.",
    why: "A work rhythm helps a newcomer plan their first weeks." }),
  q({ key: "f.decisions", phase: "F", scope: "role", tier: "core", weight: 8, minWords: 30, expects: ["example"], produces: ["role", "tacit"], needs: ["f.duties"],
    text: "Which decisions did you make yourself, and which needed approval?",
    why: "Decision rights show how much independence the role carried." }),
  q({ key: "f.knowledge", phase: "F", scope: "role", tier: "core", weight: 8, minWords: 30, expects: ["example"], produces: ["skill"], needs: ["f.duties"],
    text: "Which knowledge, technical skills and business judgement were essential in this role?",
    why: "These become the skills in the learning path." }),
  q({ key: "f.tools", phase: "F", scope: "role", tier: "core", weight: 8, minWords: 20, expects: ["tool"], produces: ["tool"], confirmable: "tool", focus: ["tool", "system", "software"],
    text: "Which tools, systems, methods, frameworks or templates did you use?",
    why: "Tool knowledge is often the quickest win for a new joiner." }),
  q({ key: "f.information", phase: "F", scope: "role", tier: "deep", weight: 4, minWords: 20, expects: ["tool"], produces: ["process", "tool"], needs: ["f.duties"],
    text: "What information did you use, and what did you produce for others?",
    why: "Inputs and outputs show how the role connects to the rest of the business." }),
  q({ key: "f.failure", phase: "F", scope: "role", tier: "deep", weight: 5, minWords: 25, expects: ["example"], produces: ["mistake", "practice"], needs: ["f.duties"],
    text: "What commonly went wrong in this role, and how did you prevent it?",
    why: "Failure modes are the most practical thing to teach." }),
  q({ key: "f.excellent", phase: "F", scope: "role", tier: "core", weight: 9, minWords: 30, expects: ["example"], produces: ["practice", "tacit"], needs: ["f.duties"],
    text: "What separated an adequate performer from an excellent one in this role?",
    why: "This is the heart of expert knowledge: what good looks like." }),
  q({ key: "f.ramp", phase: "F", scope: "role", tier: "core", weight: 7, minWords: 25, expects: ["steps"], produces: ["training", "skill"], needs: ["f.duties"],
    text: "What should a newcomer be able to do on their own after 30, 60 and 90 days?",
    why: "This turns your experience into a realistic readiness path." }),

  // Phase G — process and how-to, one process at a time
  q({ key: "g.pick", phase: "G", scope: "process", tier: "core", weight: 9, minWords: 8, expects: [], produces: ["process"], needs: ["f.duties"],
    text: "Which process or task in this role would you most like to teach? Name it in a few words.",
    why: "We go step by step through one process at a time so each lesson stays focused." }),
  q({ key: "g.trigger", phase: "G", scope: "process", tier: "core", weight: 8, minWords: 25, expects: ["tool"], produces: ["process"], needs: ["g.pick"],
    text: "What starts this process, and what inputs does it need? Where do those inputs come from?",
    why: "Triggers and inputs tell a newcomer when and how to begin." }),
  q({ key: "g.steps", phase: "G", scope: "process", tier: "core", weight: 10, minWords: 50, expects: ["steps"], produces: ["practice", "process"], needs: ["g.trigger"],
    text: "Walk me through the steps in order. Who does each step, and what rules guide the decisions?",
    why: "An ordered sequence with owners is what makes a how-to usable." }),
  q({ key: "g.tools", phase: "G", scope: "process", tier: "deep", weight: 5, minWords: 20, expects: ["tool"], produces: ["tool"], needs: ["g.steps"],
    text: "Which tools, templates, data and systems are used along the way?",
    why: "It lets me link each step to the right tool." }),
  q({ key: "g.quality", phase: "G", scope: "process", tier: "core", weight: 8, minWords: 25, expects: ["example"], produces: ["practice", "kpi"], needs: ["g.steps"],
    text: "What does a good result look like, and what checks make sure of it?",
    why: "Quality checks are how a newcomer knows they did it right." }),
  q({ key: "g.signals", phase: "G", scope: "process", tier: "deep", weight: 5, minWords: 20, expects: ["number"], produces: ["kpi"], needs: ["g.steps"],
    text: "Which measures or warning signals show whether this process is healthy?",
    why: "Warning signals let a newcomer catch problems early." }),
  q({ key: "g.exceptions", phase: "G", scope: "process", tier: "core", weight: 8, minWords: 30, expects: ["example"], produces: ["mistake", "practice"], needs: ["g.steps"],
    text: "What exceptions come up, how do you handle them, and what mistakes are most common?",
    why: "Exceptions and mistakes are where judgement is learned." }),
  q({ key: "g.example", phase: "G", scope: "process", tier: "core", weight: 8, minWords: 50, expects: ["example", "outcome"], produces: ["case"], needs: ["g.steps"],
    text: "Can you describe one real example of this process from start to finish?",
    why: "A real example makes the steps memorable." }),

  // Phase H — performance and KPIs
  q({ key: "h.measured", phase: "H", scope: "role", tier: "core", weight: 8, minWords: 30, expects: ["number"], produces: ["kpi"],
    text: "How was performance measured for you, your team, your function and the company?",
    why: "Measures show what the organisation really valued." }),
  q({ key: "h.kpis", phase: "H", scope: "role", tier: "core", weight: 10, minWords: 40, expects: ["number", "tool"], produces: ["kpi"], needs: ["h.measured"],
    text: "Which KPIs mattered most, and why? If you can, say how each was defined and calculated.",
    why: "I will record definitions only as you give them. I will not invent targets." }),
  q({ key: "h.cadence", phase: "H", scope: "role", tier: "deep", weight: 4, minWords: 20, expects: [], produces: ["kpi"], needs: ["h.kpis"],
    text: "How often were they reported, and who acted on them?",
    why: "A measure only matters if someone acts on it." }),
  q({ key: "h.leading", phase: "H", scope: "role", tier: "deep", weight: 4, minWords: 20, expects: ["example"], produces: ["kpi"], needs: ["h.kpis"],
    text: "Which measures were early warnings, and which only confirmed results afterwards?",
    why: "Leading and lagging measures are used very differently." }),
  q({ key: "h.tradeoffs", phase: "H", scope: "role", tier: "deep", weight: 5, minWords: 25, expects: ["example"], produces: ["kpi", "tacit"], needs: ["h.kpis"],
    text: "What trade-offs existed between cost, quality, speed, service, safety and people?",
    why: "Trade-offs are where judgement shows." }),
  q({ key: "h.gaming", phase: "H", scope: "role", tier: "deep", weight: 5, minWords: 20, expects: ["example"], produces: ["kpi", "mistake"], needs: ["h.kpis"],
    text: "Which measures were easy to game or misread?",
    why: "Knowing how a measure misleads protects newcomers." }),
  q({ key: "h.strong", phase: "H", scope: "role", tier: "core", weight: 6, minWords: 25, expects: ["example", "outcome"], produces: ["practice", "kpi"], needs: ["h.measured"],
    text: "What did strong performance look like in practice?",
    why: "It makes the measures concrete." }),

  // Phase I — high performers and peers
  q({ key: "i.who", phase: "I", scope: "role", tier: "core", weight: 6, minWords: 25, expects: ["example"], produces: ["practice", "tacit"],
    text: "Think of the strongest performers you worked with, without naming them. What did they consistently do differently?",
    why: "Habits of high performers can be practised. I use roles, not names, unless you want otherwise." }),
  q({ key: "i.judgement", phase: "I", scope: "role", tier: "deep", weight: 4, minWords: 25, expects: ["example"], produces: ["tacit", "skill"], needs: ["i.who"],
    text: "How did they prioritise, solve problems and decide when information was incomplete?",
    why: "This is the judgement newcomers most need to see." }),
  q({ key: "i.practice", phase: "I", scope: "role", tier: "deep", weight: 4, minWords: 20, expects: ["steps"], produces: ["training", "skill"], needs: ["i.who"],
    text: "What could a newcomer practise to build those capabilities?",
    why: "It turns observation into practice." }),

  // Phase J — people and teams (asked only when the expert led people in the role)
  q({ key: "j.manage", phase: "J", scope: "role", tier: "core", weight: 6, minWords: 30, expects: ["example"], produces: ["leadership"],
    text: "How did you organise, develop and review your people? Think of goals, feedback and performance reviews.",
    why: "People practices are lessons for first-time managers." }),
  q({ key: "j.conflict", phase: "J", scope: "role", tier: "deep", weight: 4, minWords: 25, expects: ["example", "outcome"], produces: ["leadership", "case"], needs: ["j.manage"],
    text: "How did you handle conflict, resistance or underperformance?",
    why: "These are the situations managers worry about most." }),
  q({ key: "j.first_manager", phase: "J", scope: "role", tier: "core", weight: 6, minWords: 20, expects: ["example"], produces: ["leadership", "training"], needs: ["j.manage"],
    text: "What should a first-time manager learn before leading a team?",
    why: "It is advice you would give in person." }),

  // Phase K — stories
  q({ key: "k.success", phase: "K", scope: "role", tier: "core", weight: 9, minWords: 60, expects: ["example", "outcome"], produces: ["case"],
    text: "Tell me about an important success. What was the situation, what did you do and what changed?",
    why: "Stories carry lessons the way checklists cannot." }),
  q({ key: "k.challenge", phase: "K", scope: "role", tier: "core", weight: 9, minWords: 60, expects: ["example", "outcome"], produces: ["case", "mistake"],
    text: "Tell me about a difficult challenge or failure. What caused it, and how did you respond?",
    why: "Honest failures teach more than successes." }),
  q({ key: "k.options", phase: "K", scope: "role", tier: "deep", weight: 4, minWords: 25, expects: ["example"], produces: ["case", "tacit"], needs: ["k.success"],
    text: "What options did you consider, and why did you choose the one you chose?",
    why: "The choice and the reasons are the lesson." }),
  q({ key: "k.evidence", phase: "K", scope: "role", tier: "deep", weight: 4, minWords: 20, expects: ["number", "outcome"], produces: ["case", "kpi"], needs: ["k.success"],
    text: "What evidence showed whether it worked?",
    why: "I separate measured results from recollection." }),
  q({ key: "k.different", phase: "K", scope: "role", tier: "deep", weight: 4, minWords: 20, expects: [], produces: ["tacit", "case"], needs: ["k.success"],
    text: "What would you do differently today?",
    why: "Hindsight is the part newcomers cannot get elsewhere." }),
  q({ key: "k.share", phase: "K", scope: "role", tier: "core", weight: 7, minWords: 1, expects: [], produces: ["permission"], needs: ["k.success"],
    text: "Can these stories be shared publicly, or should any company or person be anonymised?",
    why: "I will not publish a story until you have decided." }),

  // Phase L — leaders and mentors (whole career)
  q({ key: "l.mentors", phase: "L", scope: "project", tier: "core", weight: 6, minWords: 30, expects: ["example"], produces: ["leadership", "tacit"],
    text: "Which leaders or mentors influenced you most, and what did you learn from how they thought and acted?",
    why: "Mentors shape judgement. Their principles are worth passing on." }),
  q({ key: "l.principle", phase: "L", scope: "project", tier: "deep", weight: 4, minWords: 20, expects: ["example"], produces: ["leadership"], needs: ["l.mentors"],
    text: "Is there a principle you adopted from them, and how did your own approach evolve?",
    why: "It shows how professional philosophy develops." }),

  // Phase M — tacit knowledge and judgement
  q({ key: "m.notice", phase: "M", scope: "role", tier: "core", weight: 9, minWords: 30, expects: ["example"], produces: ["tacit"],
    text: "What do experienced people notice that beginners tend to miss?",
    why: "Noticing is the core of expertise, and it is rarely written down." }),
  q({ key: "m.warning", phase: "M", scope: "role", tier: "core", weight: 8, minWords: 25, expects: ["example"], produces: ["tacit", "mistake"],
    text: "Which warning signs tell you a process, project or team is going off track?",
    why: "Warning signs let a newcomer act early." }),
  q({ key: "m.judgement", phase: "M", scope: "role", tier: "deep", weight: 5, minWords: 25, expects: ["example"], produces: ["tacit"], needs: ["m.notice"],
    text: "Which decisions depend on judgement rather than a written rule? Which shortcuts are safe and which are dangerous?",
    why: "Judgement calls are the hardest to teach and the most valuable." }),
  q({ key: "m.myths", phase: "M", scope: "role", tier: "deep", weight: 4, minWords: 20, expects: [], produces: ["tacit", "mistake"], needs: ["m.notice"],
    text: "Which common beliefs should newcomers unlearn?",
    why: "Unlearning saves time." }),
  q({ key: "m.wish", phase: "M", scope: "project", tier: "core", weight: 6, minWords: 15, expects: [], produces: ["tacit"],
    text: "What do you wish you had known ten years earlier?",
    why: "It is often the most honest advice." }),

  // Phase N — role-specific close-out
  q({ key: "n.first", phase: "N", scope: "role", tier: "core", weight: 8, minWords: 25, expects: ["steps"], produces: ["training"],
    text: "If you trained a new joiner for this role, what would you teach first?",
    why: "This sets the order of the learning path." }),
  q({ key: "n.skills", phase: "N", scope: "role", tier: "core", weight: 9, minWords: 20, expects: [], produces: ["skill"],
    text: "What are the five most important skills for this role?",
    why: "These become the skills in the matrix." }),
  q({ key: "n.mistakes", phase: "N", scope: "role", tier: "core", weight: 7, minWords: 20, expects: ["example"], produces: ["mistake"],
    text: "What mistakes should a newcomer avoid?",
    why: "Each becomes a caution in a lesson." }),
  q({ key: "n.independent", phase: "N", scope: "role", tier: "core", weight: 7, minWords: 25, expects: ["steps"], produces: ["skill", "training"],
    text: "What would a competent, independent performer be able to demonstrate?",
    why: "It defines the check for readiness, which is stronger than finishing a lesson." }),
  q({ key: "n.resources", phase: "N", scope: "role", tier: "deep", weight: 3, minWords: 10, expects: [], produces: ["training"],
    text: "Which books, standards, templates or training would you recommend?",
    why: "It lets me point learners to good resources." }),

  // Phase O — career synthesis (project-level, last)
  // The book questions: story, setback, method, big idea, title. They shape the interview into a book and a training video.
  q({ key: "o.book_moment", phase: "O", scope: "project", tier: "core", weight: 8, minWords: 40, expects: [], produces: ["tacit"],
    text: "Think of one moment in your career that you would open a book with. Where were you, who was there, and what happened?",
    why: "Good books start inside a real scene. Yours becomes the opening of the story." }),
  q({ key: "o.book_mistake", phase: "O", scope: "project", tier: "core", weight: 8, minWords: 40, expects: [], produces: ["tacit"],
    text: "What setback or mistake taught you the most? What happened, what did it cost, and what do you do differently now?",
    why: "Readers trust a lesson that cost something. This becomes a turning point in the book." }),
  q({ key: "o.book_method", phase: "O", scope: "project", tier: "core", weight: 8, minWords: 30, expects: [], produces: ["tacit", "process"],
    text: "Is there a way of working or a rule of thumb you rely on? Describe it in three to five steps, and give it a name if you can.",
    why: "A named method is something a reader can remember and use." }),
  q({ key: "o.book_idea", phase: "O", scope: "project", tier: "core", weight: 7, minWords: 12, expects: [], produces: ["tacit"],
    text: "If a reader remembers only one idea from you, what should it be? Say it in one or two sentences.",
    why: "A book is strongest when it has one big idea. This is yours." }),
  q({ key: "o.book_title", phase: "O", scope: "project", tier: "core", weight: 5, minWords: 1, expects: [], produces: ["tacit"],
    text: "If this were a book, what would you call it, and who is it for?",
    why: "The title and the reader decide how the book is written." }),
  q({ key: "o.journey", phase: "O", scope: "project", tier: "core", weight: 9, minWords: 60, expects: [], produces: ["career"],
    text: "In five to ten sentences, how would you describe your whole career journey?",
    why: "Your own summary becomes the story at the top of your profile." }),
  q({ key: "o.strengths", phase: "O", scope: "project", tier: "core", weight: 9, minWords: 15, expects: [], produces: ["skill"],
    text: "Which three to five areas best represent your strongest expertise?",
    why: "These are the areas I will build learning paths around." }),
  q({ key: "o.teach", phase: "O", scope: "project", tier: "core", weight: 7, minWords: 10, expects: [], produces: ["permission", "training"],
    text: "Which subjects are you willing to teach, mentor or demonstrate?",
    why: "It sets the scope of what is published under your name." }),
  q({ key: "o.materials", phase: "O", scope: "project", tier: "core", weight: 6, minWords: 6, expects: [], produces: ["permission"],
    text: "Which supporting materials can you share, and do you own or have permission to share them?",
    why: "I only use material you have the right to share." }),
  q({ key: "o.missing", phase: "O", scope: "project", tier: "core", weight: 5, minWords: 1, expects: [], produces: ["tacit"],
    text: "Is there anything important I have not asked?",
    why: "You know what matters better than any question list." }),
];

const BY_KEY = new Map(QUESTION_BANK.map((question) => [question.key, question]));

export function getQuestion(key: string): QuestionDef | undefined {
  return BY_KEY.get(key);
}

export function questionsFor(scope: Scope, tier?: "core" | "deep"): QuestionDef[] {
  return QUESTION_BANK.filter((question) => question.scope === scope && (!tier || question.tier === tier));
}

/** Short names for the knowledge a question captures; used as fact titles and headings in `skill.md`. */
const LABELS: Record<string, string> = {
  "a.teach": "What the contributor wants learners to take away",
  "a.topics": "Topics the contributor most wants to teach",
  "a.limits": "Limits on what may be recorded or published",
  "b.first_job": "First job and start of career",
  "b.prepare": "How the contributor got and prepared for the first job",
  "b.day_one": "What a newcomer needs on day one",
  "b.on_the_job": "Skills learned on the job",
  "b.advice": "Advice for the early career",
  "c.walk": "Career walk-through",
  "c.title": "Reporting line, team size and scope",
  "c.turning": "Achievements and turning points",
  "c.useful_today": "Experience most useful to a newcomer today",
  "c.transition": "Why the contributor joined and moved on",
  "c.expertise_change": "How expertise changed in this role",
  "d.explain": "The industry explained to a newcomer",
  "d.players": "Customers, suppliers, competitors and regulators",
  "d.value": "Value, cost, quality and risk drivers",
  "d.change": "Market, technology and policy change",
  "d.winners": "What sets high-performing companies apart",
  "d.terms": "Industry terms, standards and operating limits",
  "e.structure": "Organisation and functions",
  "e.flow": "End-to-end work flow",
  "e.handoffs": "Handoffs, decision points and rework",
  "e.measures": "Function measures and scorecards",
  "e.collab": "Working across functions",
  "f.purpose": "Role purpose and definition of success",
  "f.duties": "Responsibilities and recurring activities",
  "f.rhythm": "Day, week and month rhythm",
  "f.decisions": "Decision rights and approvals",
  "f.knowledge": "Essential knowledge and judgement",
  "f.tools": "Tools, systems, methods and templates",
  "f.information": "Information used and produced",
  "f.failure": "Common failure modes and prevention",
  "f.excellent": "Adequate versus excellent performance",
  "f.ramp": "30, 60 and 90 day readiness",
  "g.pick": "Process chosen for teaching",
  "g.trigger": "Trigger and inputs",
  "g.steps": "Steps, owners and decision rules",
  "g.tools": "Tools and templates used in the process",
  "g.quality": "Good output and quality checks",
  "g.signals": "Measures and warning signals",
  "g.exceptions": "Exceptions and common mistakes",
  "g.example": "Worked example",
  "h.measured": "How performance was measured",
  "h.kpis": "KPIs and their definitions",
  "h.cadence": "Reporting cadence and ownership",
  "h.leading": "Leading and lagging measures",
  "h.tradeoffs": "Trade-offs between cost, quality, speed and people",
  "h.gaming": "Measures that mislead",
  "h.strong": "What strong performance looks like",
  "i.who": "What high performers do differently",
  "i.judgement": "How high performers decide",
  "i.practice": "How to build the same capabilities",
  "j.manage": "Managing and developing people",
  "j.conflict": "Conflict, resistance and underperformance",
  "j.first_manager": "Advice for a first-time manager",
  "k.success": "Success story",
  "k.challenge": "Challenge or failure story",
  "k.options": "Options considered",
  "k.evidence": "Evidence of results",
  "k.different": "What the contributor would do differently",
  "k.share": "Permission to share the stories",
  "l.mentors": "Leaders and mentors",
  "l.principle": "Principles adopted",
  "m.notice": "What experts notice that beginners miss",
  "m.warning": "Warning signs",
  "m.judgement": "Judgement calls and safe shortcuts",
  "m.myths": "Beliefs to unlearn",
  "m.wish": "What the contributor wishes they had known",
  "n.first": "What to teach a new joiner first",
  "n.skills": "The most important skills",
  "n.mistakes": "Mistakes to avoid",
  "n.independent": "What an independent performer can demonstrate",
  "n.resources": "Recommended resources",
  "o.journey": "Career journey in the contributor's words",
  "o.strengths": "Strongest areas of expertise",
  "o.teach": "Subjects the contributor will teach",
  "o.materials": "Supporting materials and rights",
  "o.missing": "Anything else the contributor wants to add",
};

export function labelOf(questionKey: string): string {
  return LABELS[questionKey] ?? getQuestion(questionKey)?.text ?? questionKey;
}
