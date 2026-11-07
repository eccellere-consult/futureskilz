import type { SkillShotBrief } from "./scaffold";

/**
 * Content wave 1: the twelve Skill Shots chosen from the largest unmet demand across the seeded roles (skills that many roles
 * need at a useful level and that no lesson yet builds). Each brief names the capability, the level it can reach, and a few
 * plainly stated method notes. The notes are well-known methods in neutral words; none states a fact about a real organisation,
 * person or figure, so the design agent writes illustrative cases and labels them. A person reviews every draft before learners see it.
 */
const base = { proficiency: "foundational" as const, contributor: "FutureSkilz Learning Design", sourceKind: "method" as const };

export const WAVE_ONE: SkillShotBrief[] = [
  {
    ...base,
    topic: "Re-plan the day when a line goes down",
    skills: [{ skill: "operations", toLevel: 2.5 }, { skill: "adaptability", toLevel: 2 }],
    audience: "Shift leads and planners who must keep orders moving when something fails",
    role: "Production planner",
    industry: "Manufacturing",
    sourceNotes: "Method: when a machine or line stops, (1) list the orders affected and their due dates, (2) rank them by customer impact and due date, (3) check the capacity that is left, on other lines and in overtime, (4) decide what moves, what waits and what is split, (5) tell everyone who is affected, with the new time, before they have to ask. Common errors: promising a date before checking capacity, re-planning in your head, and telling only some of the people affected. Use an illustrative case.",
  },
  {
    ...base,
    topic: "Set direction for a small team in one conversation",
    skills: [{ skill: "leadership", toLevel: 2.5 }, { skill: "communication", toLevel: 2 }],
    audience: "First-time team leaders who hand out work and get something different back",
    role: "First-time team leader",
    sourceNotes: "Method: a clear direction conversation covers four things: why the work matters, what done looks like (an observable result, a date and a quality bar), the limits (time, budget, what must not change), and what support and check-ins the person can expect. End by asking the person to say it back in their own words. Common errors: describing the task but not the result, assuming silence means agreement, and checking only at the end. Use an illustrative case.",
  },
  {
    ...base,
    topic: "Coach with questions, not answers",
    skills: [{ skill: "coaching", toLevel: 2.5 }, { skill: "active-listening", toLevel: 2 }],
    audience: "Managers and senior colleagues who want people to solve more problems themselves",
    sourceNotes: "Method: the GROW conversation. Goal: what do you want out of this? Reality: what is happening now, and what have you tried? Options: what could you do, and what else? Will: what will you do, by when, and what might get in the way? The coach asks, listens and resists giving the answer. Common errors: asking leading questions that hide advice, filling silence too soon, and ending without a committed next step. Use an illustrative case.",
  },
  {
    ...base,
    topic: "Decide what to build first: value, effort and evidence",
    skills: [{ skill: "product-management", toLevel: 2.5 }, { skill: "decision-making", toLevel: 2.5 }],
    audience: "Product and project people who have more good ideas than capacity",
    role: "Product manager",
    sourceNotes: "Method: score each option on value (how many people, how much it matters to them), effort (the time and people it needs) and evidence (how sure you are, from what you have seen or measured). Rank by value and evidence divided by effort, then look at the top three with judgement, because a score is an aid and not an answer. State what you are not doing and why. Common errors: scoring with no evidence, letting the loudest voice win, and never saying no. Use an illustrative case.",
  },
  {
    ...base,
    topic: "Handle a disagreement before it becomes a conflict",
    skills: [{ skill: "conflict-management", toLevel: 2.5 }, { skill: "empathy", toLevel: 2 }],
    audience: "Team members and leaders who avoid hard conversations until they get worse",
    sourceNotes: "Method: separate the person from the problem; ask about interests (what each person needs) and not only positions (what each person demands); list options that serve both sets of interests; agree a fair test for choosing. Start with the facts and the effect, not the blame. Common errors: arguing about who is right, bringing up old issues, and settling with no agreed next step. Use an illustrative case.",
  },
  {
    ...base,
    topic: "Listen to understand before you respond",
    skills: [{ skill: "active-listening", toLevel: 2.5 }, { skill: "empathy", toLevel: 2.5 }],
    audience: "Anyone who works with customers, colleagues or teams and wants fewer misunderstandings",
    sourceNotes: "Method: give full attention; let the person finish; paraphrase what you heard in your own words and check it; ask one open clarifying question; reflect the feeling as well as the facts; only then respond. Common errors: planning your reply while the other person talks, fixing too early, and agreeing when you only understood part. Use an illustrative case.",
  },
  {
    ...base,
    topic: "Turn a goal into three strategic choices",
    skills: [{ skill: "strategic-thinking", toLevel: 2.5 }, { skill: "decision-making", toLevel: 2 }],
    audience: "Managers who have a goal and a long list of activities but no clear choices",
    sourceNotes: "Method: state the goal as a result with a date. Name the two or three choices that most decide whether it is reached (for example which customers, which offer, which way of working). For each choice, write the options, the trade-off, and what you will stop doing. Test the choices against the resources you really have. Common errors: a list of tasks mistaken for a strategy, choices that need no trade-off, and no decision on what to stop. Use an illustrative case.",
  },
  {
    ...base,
    topic: "Analyse a spreadsheet with an AI assistant, and check its work",
    skills: [{ skill: "ai-assisted-analysis", toLevel: 2.5 }, { skill: "data-literacy", toLevel: 2 }],
    audience: "Working professionals who use AI on numbers and need to trust the result",
    sourceNotes: "Method: say what question you want answered; give the assistant the data and ask it to show how it got the answer; then check it yourself: recompute one total by hand, check the row count, look at a few rows, ask what it assumed, and ask for the formula so you can rerun it. Never paste in data you are not allowed to share. A person stays accountable for the answer. Common errors: trusting a confident answer, no check on totals, and sharing sensitive data. Use an illustrative case.",
  },
  {
    ...base,
    topic: "What AI can and cannot do: a plain guide for decision-makers",
    skills: [{ skill: "ai-literacy", toLevel: 2.5 }, { skill: "generative-ai", toLevel: 2 }],
    audience: "Managers and leaders who decide where AI is used in their work",
    sourceNotes: "Plain-language points: a generative AI model predicts likely text from patterns in what it was trained on. It is strong at drafting, summarising, rewording, brainstorming and spotting patterns in text. It is weak at facts it was not given, exact arithmetic, knowing when it is wrong, and anything recent unless it is given the source. It can sound sure when it is wrong. Good practice: give it the material, ask for sources, check what matters, and keep a person responsible for the decision. Use an illustrative case.",
  },
  {
    ...base,
    topic: "Hand over work so nothing falls through",
    skills: [{ skill: "collaboration", toLevel: 2.5 }, { skill: "communication", toLevel: 2 }],
    audience: "Shift, project and cross-team workers who pass work to someone else",
    sourceNotes: "Method: the SBAR handover. Situation: what is happening now. Background: what led to it and what has been done. Assessment: what you think the state and the risks are. Recommendation: what you suggest happens next and who owns it. Confirm the receiver can say it back. Common errors: handing over the task but not the risk, assuming they already know, and no named owner. Use an illustrative case.",
  },
  {
    ...base,
    topic: "Plan a small project on one page",
    skills: [{ skill: "project-management", toLevel: 2.5 }, { skill: "stakeholder-management", toLevel: 2 }],
    audience: "People asked to deliver a small piece of work with others, with no project training",
    role: "Project manager",
    sourceNotes: "Method: one page with the goal and why it matters; what is in scope and what is out; the main steps with dates and an owner for each; the three biggest risks with a first response; who needs to be kept informed and how. Review it with the people who must act on it. Common errors: no named owner, dates that nobody agreed, and a plan that is never updated. Use an illustrative case.",
  },
  {
    ...base,
    topic: "Use AI responsibly: five questions before you rely on it",
    skills: [{ skill: "ai-ethics", toLevel: 2.5 }, { skill: "ai-governance", toLevel: 2 }],
    audience: "Anyone who uses AI at work and wants to avoid harm, leaks and embarrassment",
    sourceNotes: "Method: before relying on an AI output, ask five questions. Am I allowed to use this data here? Who could be harmed or left out if this is wrong or biased? Can I check or explain the result? Who is accountable for the decision? Does a person review it before it affects anyone? If any answer is no or unsure, stop, reduce the risk or escalate. Follow your organisation's policy, and say clearly where AI helped. Common errors: pasting confidential data, treating AI output as fact, and no named owner. Use an illustrative case.",
  },
];
