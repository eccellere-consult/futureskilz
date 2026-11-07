import type { Prompt } from "@/features/capture/types";

/**
 * What the demo coach "says". It is ordinary interview content (plant planning), written so every stage of the pipeline has
 * something real to work with: steps, a named tool, a measure with a definition, a sensitive detail, a story with a result.
 */
export const WALK =
  "I joined as a Graduate Engineer Trainee at Tata Motors, 1994-1998.\nThen Production Planning Manager at Mahindra Forgings (1999-2007).\nLater I worked as Plant Head with Bharat Components from 2008 to 2022.";

const A: Record<string, string> = {
  "a.teach": "I want newcomers to see that good planning is a habit of asking the right questions early. Machines and software matter less than knowing what the customer needs by when, and being honest about what the plant can really do.",
  "a.topics": "Production planning, shop-floor scheduling, working with sales and purchase, and how to lead a planning team.",
  "a.limits": "Please do not publish customer names, internal cost figures or anything about individual colleagues' performance.",
  "b.first_job": "I started in 1994 as a graduate engineer trainee at Tata Motors in Pune, in the automotive industry. I rotated through machining and assembly before I was posted to planning.",
  "b.prepare": "I studied mechanical engineering and did a vacation internship at a foundry. A senior planner in my first posting taught me how to read a production schedule, and that relationship helped me more than any textbook.",
  "b.day_one": "On day one I needed to know the product families, the takt time of each line and who to call when a machine stopped. I was surprised how much of planning is conversation with supervisors rather than calculation.",
  "c.title": "As Planning Manager I reported to the Plant Head and led a team of eight planners and schedulers. I owned the weekly production plan, material availability and the daily schedule for four lines.",
  "c.turning": "The turning point was in 2003 when we moved from a spreadsheet plan to SAP production planning. We cut late orders from about 14 percent to 5 percent within a year, and the result was that our biggest customer extended our contract.",
  "c.useful_today": "Learn to run a daily planning huddle. For example, a fifteen minute meeting each morning with maintenance, stores and the line supervisors prevented most surprises, and it still works in any plant today.",
  "d.explain": "Auto component manufacturing makes parts for vehicle makers to tight quality and delivery schedules. You earn money by delivering the right part at the right time, every time, at a cost the customer accepts.",
  "d.players": "Customers are the vehicle makers, suppliers are steel mills and tool rooms, competitors are other component makers, and regulators cover safety, emissions and labour law.",
  "d.value": "Value comes from on-time delivery and quality. Cost drivers are material, changeovers and scrap. For example, a ten minute changeover on a high volume line costs far more over a year than most people expect.",
  "e.structure": "The plant had planning, production, maintenance, quality, stores, purchase and finance. Planning decided what to make and when; production made it; maintenance kept machines ready; stores and purchase kept material available.",
  "e.flow": "First sales shared the customer forecast. Then planning checked capacity and material. Next we released the weekly plan to production. After that stores issued material, the line produced, quality inspected, and finally dispatch shipped to the customer.",
  "e.handoffs": "The riskiest handoff was between planning and stores. For example, when material was short and nobody told planning, a whole shift could be wasted. Rework usually came from late engineering changes.",
  "f.purpose": "The role existed to make sure the plant delivered what customers ordered, on time, with the least waste. Success was on-time delivery, schedule adherence and stable inventory.",
  "f.duties": "First I reviewed customer demand each Monday. Then I built the weekly plan with capacity and material checks. Every day I ran the planning huddle, adjusted the schedule and reported delays to the Plant Head.",
  "f.rhythm": "Each day started with the huddle at 8:30. Weekly we froze the plan on Thursday for the following week. Monthly we reviewed delivery performance with sales, and every quarter we did capacity planning for new orders.",
  "f.decisions": "I decided the daily sequence and small overtime within budget. Anything that changed a customer commitment or needed new capacity went to the Plant Head for approval. For example, accepting a rush order always needed approval.",
  "f.knowledge": "You need process knowledge of each line, a feel for material lead times and the judgement to say no to an unrealistic request. For example, knowing when a promise cannot be kept is more valuable than any formula.",
  "f.tools": "We used SAP for production planning and Excel for capacity analysis, with simple visual boards on the shop floor and a weekly planning template.",
  "f.excellent": "An excellent planner talks to the shop floor daily and plans for what can go wrong. For example, the best planner I knew kept a list of the five machines most likely to fail and always had a plan B for them.",
  "f.ramp": "After thirty days a newcomer should read the schedule and explain each line. After sixty days, run the daily huddle. After ninety days, build a weekly plan alone with a review.",
  "g.pick": "Weekly production planning and schedule freeze",
  "g.trigger": "The process starts every Monday when sales shares the updated customer forecast. Inputs are the forecast from sales, stock levels from stores, machine availability from maintenance and open orders from the last week, all taken from SAP.",
  "g.steps": "First, the planner reviews demand against the last four weeks. Second, they check capacity line by line in Excel. Third, they check material with stores in SAP. Fourth, they build the plan and sequence jobs to minimise changeovers. Fifth, the Plant Head reviews and approves it. Finally, on Thursday the plan is frozen and issued to production.",
  "g.quality": "A good plan is feasible, meets every customer date and has no material gaps. We checked it by walking through each line with the supervisors, and by confirming material availability before the freeze. For example, a plan that fails the material check is sent back the same day.",
  "g.exceptions": "Rush orders and machine breakdowns are the main exceptions. For a rush order we check capacity, then ask the Plant Head before accepting. A common mistake is changing the frozen plan without telling stores, which leaves the line waiting for material.",
  "g.example": "Once a major customer asked for a thirty percent increase in two weeks. First we checked spare capacity, then found a second shift on one line, then agreed material with purchase and finally committed. We delivered on time and the result was a repeat order.",
  "h.measured": "We measured on-time delivery to the customer, schedule adherence per line, inventory days and scrap. Each planner was measured on schedule adherence, the team on delivery, and the plant on all four.",
  "h.kpis": "On-time delivery matters most. It is the number of order lines delivered by the promised date divided by total order lines delivered, measured weekly. Our baseline was 86 percent and we reached 95 percent. Schedule adherence is jobs completed as planned divided by jobs planned.",
  "h.strong": "Strong performance meant a stable plan that did not change after the freeze, and very few emergency calls to the Plant Head. For example, in our best quarter we had only two unplanned changes.",
  "i.who": "The strongest planners walked the shop floor every day, kept simple notes of what usually breaks and told sales the truth early. For example, one planner always warned sales three days before a promise was at risk.",
  "j.manage": "I set weekly goals with each planner and met them one to one every fortnight. For example, I gave feedback right after a missed schedule, focusing on what we learned rather than who was at fault.",
  "j.first_manager": "Learn to listen before you decide. For example, a first-time manager should spend the first month understanding why the team works the way it does, before changing anything.",
  "k.success": "In 2003 we introduced SAP planning when the plant was struggling with late deliveries. First we mapped the real process, then trained the planners, then ran both systems in parallel for a month. My manager Rajesh Kumar backed the change on a confidential customer order, and the result was late deliveries falling from 14 to 5 percent and the customer renewing the contract.",
  "k.challenge": "In 2006 a steel supplier failed and we ran out of material for a key line. The cause was that we depended on one supplier. We responded by finding two alternates within a week, and afterwards we always kept a second source. The result was a two day stoppage instead of two weeks.",
  "k.share": "Anonymise the customer and the people, but the story itself can be shared.",
  "m.notice": "Experienced planners notice small signs early, like a supervisor stopping to answer the phone more often, which often means a machine problem. For example, a rising number of small stoppages usually comes before a big breakdown.",
  "m.warning": "Warning signs are repeated schedule changes, stores asking for urgent material, and supervisors saying the plan is unrealistic. When two of these happen in the same week, I would look at the plan again immediately.",
  "n.first": "I would teach reading the schedule first. Then the daily huddle, then how to check capacity and material, and only then building a plan.",
  "n.skills": "The five most important skills are reading a production schedule, checking capacity, checking material, communicating with the shop floor and judging what is realistic.",
  "n.mistakes": "Avoid accepting dates you cannot meet, changing a frozen plan without telling stores, and planning only from the system without walking the floor. For example, a planner who never visited the line missed a broken conveyor for a week.",
  "n.independent": "A competent planner can build a feasible weekly plan, explain each choice to the Plant Head and handle one rush order without help. They can first check capacity, then material, then sequence jobs.",
  "l.mentors": "Two people shaped me. My first planning mentor taught me to always walk the floor, and a Plant Head I worked for taught me to tell customers the truth early. For example, he once called a customer himself to say a date would slip, and the customer thanked him.",
  "m.wish": "I wish I had learned earlier that most delays are communication problems, not planning problems.",
  "o.journey": "I began in 1994 as a graduate engineer trainee and moved into planning, where I found my calling. I became a Planning Manager in 1999 and led the move to SAP planning. In 2008 I became a Plant Head and spent fourteen years running a plant. I learned that people and communication matter more than tools. I retired in 2022 and now want to teach what I learned.",
  "o.strengths": "Production planning, shop-floor scheduling, supplier risk, planning team leadership and introducing planning systems.",
  "o.teach": "I am willing to teach planning, scheduling and how to lead a planning team.",
  "o.materials": "I can share my planning template and a short note on the weekly planning process. I wrote both myself.",
  "o.missing": "Only that planning is a human job. Please make sure newcomers hear that.",
};

const FOLLOW: Record<string, string> = {
  metric: "On-time delivery is order lines delivered by the promised date divided by all lines delivered, reported weekly. The baseline was 86 percent and the result was 95 percent over two years.",
  tool_use: "The planners used SAP every day to check stock and open orders, and Excel to check capacity. It produced the weekly plan that the Plant Head approved.",
  example: "For example, once a planner spotted a missing casting two days early and moved the job, which saved a full shift.",
  steps: "First check demand, then capacity, then material, then sequence the jobs, and finally review with the supervisor.",
  outcome: "As a result late orders fell and the customer was happier, though we mostly saw it in fewer escalation calls.",
  number: "Roughly a hundred and twenty orders a week across four lines.",
  tool: "We used SAP and a planning template in Excel.",
  date: "Around 2003.",
};

export function answerFor(prompt: Pick<Prompt, "kind" | "questionKey" | "text">, followUpKind?: string): string {
  if (prompt.kind === "followup") return FOLLOW[followUpKind ?? ""] ?? FOLLOW.example;
  if (prompt.questionKey === "c.walk") return WALK;
  return (prompt.questionKey && A[prompt.questionKey]) || "That is covered in what I have already said, and I am happy to add more on another day.";
}

export function followUpKindOf(text: string): string {
  if (/defined/i.test(text)) return "metric";
  if (/How did you use/i.test(text)) return "tool_use";
  if (/example/i.test(text)) return "example";
  if (/in order|step by step/i.test(text)) return "steps";
  if (/What changed/i.test(text)) return "outcome";
  if (/numbers/i.test(text)) return "number";
  if (/Which tool/i.test(text)) return "tool";
  if (/when was that/i.test(text)) return "date";
  return "example";
}
