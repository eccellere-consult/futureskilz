import "server-only";

import { eq } from "drizzle-orm";

import { QUESTION_BANK } from "@/features/capture/question-bank";
import { skillShots } from "@/features/journey/model";
import { draftPolicyTemplate } from "@/features/capture/earnings/policy";
import { slugifySkill } from "@/domain/skills/taxonomy";
import { kcContributors, kcLessons, kcProjects, userRoles, users } from "@/server/db/schema";
import { aiSwitch } from "@/server/capture/extract-ai";
import { createCase, listCases } from "@/lib/workspaceCases";
import { learnerRepository } from "@/server/learning/service";
import { SECTION } from "@/lib/problemSolving/seed";
import * as earnings from "@/server/capture/earnings-service";
import * as interview from "@/server/capture/interview-service";
import * as learner from "@/server/capture/learner-service";
import * as lessons from "@/server/capture/lesson-service";
import * as review from "@/server/capture/review-service";
import { database, newUuid } from "@/server/capture/shared";
import { setPassword } from "@/server/auth/password-service";
import { getServerEnvironment } from "@/server/env";
import * as uploads from "@/server/capture/upload-service";

import { answerFor, followUpKindOf } from "./answers";
import { COACH2, PERSONAS, type PersonaId } from "./personas";

export type SeedReport = {
  seeded: boolean;
  steps: string[];
  people: Array<{ persona: PersonaId; email: string; name: string }>;
  projectId: string | null;
  lessons: Array<{ id: string; title: string; status: string }>;
};

async function ensureUser(email: string, name: string, roles: string[]): Promise<string> {
  const db = await database();
  const [existing] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  const id = existing?.id ?? newUuid();
  if (!existing) await db.insert(users).values({ id, email, displayName: name, status: "active" });
  else await db.update(users).set({ displayName: name, status: "active" }).where(eq(users.id, id));
  for (const role of roles) await db.insert(userRoles).values({ userId: id, role }).onDuplicateKeyUpdate({ set: { role } });
  return id;
}

/** Sample content must never be offered to real learners after the demo: this retires every demo lesson and closes the demo interviews. */
export async function retireDemo(): Promise<number> {
  const db = await database();
  const coach = await db.select({ id: users.id }).from(users).where(eq(users.email, PERSONAS.coach.email)).limit(1);
  if (!coach[0]) return 0;
  const projects = await db.select().from(kcProjects).where(eq(kcProjects.contributorId, coach[0].id));
  for (const project of projects) if (project.status !== "withdrawn") await review.withdrawProject(coach[0].id, project.id, "Demo data retired");
  return projects.length;
}

const OPTION_PREFERENCE = ["anonymize", "accurate", "yes", "next", "no"];

type Ctx = { db: Awaited<ReturnType<typeof database>>; learnerId: string; coachId: string; editorId: string; adminId: string; coach2Id: string; projectId: string };
export type SeedStage = "people" | "interview" | "review" | "lessons" | "usage" | "finance";
export type SeedStep = { stage: SeedStage; index?: number };
export type SeedProgress = { steps: string[]; next: SeedStep | null; report?: SeedReport };

const STAGE_ORDER: SeedStage[] = ["people", "interview", "review", "lessons", "usage", "finance"];

async function context(): Promise<Ctx> {
  const db = await database();
  const idOf = async (email: string) => (await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1))[0]?.id ?? "";
  const coachId = await idOf(PERSONAS.coach.email);
  const projects = coachId ? await db.select().from(kcProjects).where(eq(kcProjects.contributorId, coachId)) : [];
  const live = projects.filter((project) => project.status !== "withdrawn" && project.title.startsWith("DEMO"));
  return {
    db, coachId, learnerId: await idOf(PERSONAS.learner.email), editorId: await idOf(PERSONAS.editor.email), adminId: await idOf(PERSONAS.admin.email),
    coach2Id: await idOf(COACH2.email), projectId: live[live.length - 1]?.id ?? "",
  };
}

/**
 * Builds one finished example for every kind of person, using the real services (the same code a live user triggers), so
 * the demo cannot drift from the product. Safe to run again: an existing demo interview is retired and a fresh one is made.
 * It runs in short stages (the website host cuts off a single long request), each of which can be called on its own.
 */
export async function seedDemoStep(step: SeedStep): Promise<SeedProgress> {
  const steps: string[] = [];
  const log = (line: string) => steps.push(line);
  aiSwitch.off = true;
  try {
    let next: SeedStep | null = null;
    if (step.stage === "people") await stagePeople(log);
    else {
      const c = await context();
      if (!c.coachId || (step.stage !== "interview" && !c.projectId)) throw new Error("Run the earlier demo steps first.");
      if (step.stage === "interview") await stageInterview(c, log);
      else if (step.stage === "review") await stageReview(c, log);
      else if (step.stage === "lessons") await stageLessons(c, log);
      else if (step.stage === "usage") {
        const count = await stageUsage(c, step.index ?? 0, log);
        if ((step.index ?? 0) + 1 < count) next = { stage: "usage", index: (step.index ?? 0) + 1 };
      } else await stageFinance(c, log);
    }
    if (!next) {
      const after = STAGE_ORDER[STAGE_ORDER.indexOf(step.stage) + 1];
      next = after ? { stage: after } : null;
    }
    return { steps, next };
  } finally {
    aiSwitch.off = false;
  }
}

/** Everything in one call: used by tests and by anything that is not behind a request time limit. */
export async function seedDemo(): Promise<SeedReport> {
  const steps: string[] = [];
  let step: SeedStep | null = { stage: "people" };
  while (step) {
    const progress: SeedProgress = await seedDemoStep(step);
    steps.push(...progress.steps);
    step = progress.next;
  }
  return seedReport(steps);
}

export async function seedReport(steps: string[]): Promise<SeedReport> {
  const c = await context();
  const finalLessons = c.projectId ? await c.db.select({ id: kcLessons.id, title: kcLessons.title, status: kcLessons.status }).from(kcLessons).where(eq(kcLessons.projectId, c.projectId)) : [];
  return {
    seeded: true,
    steps,
    people: (Object.keys(PERSONAS) as PersonaId[]).map((persona) => ({ persona, email: PERSONAS[persona].email, name: PERSONAS[persona].name })),
    projectId: c.projectId || null,
    lessons: finalLessons,
  };
}

async function stagePeople(log: (line: string) => void): Promise<void> {
  const db = await database();
    const learnerId = await ensureUser(PERSONAS.learner.email, PERSONAS.learner.name, []);
    const coachId = await ensureUser(PERSONAS.coach.email, PERSONAS.coach.name, ["contributor"]);
    const editorId = await ensureUser(PERSONAS.editor.email, PERSONAS.editor.name, ["editor"]);
    const adminId = await ensureUser(PERSONAS.admin.email, PERSONAS.admin.name, ["admin"]);
    const coach2Id = await ensureUser(COACH2.email, COACH2.name, ["contributor"]);
    await db.insert(kcContributors).values({ userId: coach2Id, publicName: COACH2.name }).onDuplicateKeyUpdate({ set: { publicName: COACH2.name } });
    // The shared demo password (DEMO_ACCESS_CODE) also works on the normal "Email and password" sign-in for the four demo people.
    const sharedPassword = getServerEnvironment().DEMO_ACCESS_CODE;
    if (sharedPassword) for (const id of [learnerId, coachId, editorId, adminId]) await setPassword(id, sharedPassword, null);
    log(`Created the demo learner, coach, editor, admin and a co-author${sharedPassword ? "; the four can sign in with email and the shared password" : ""}.`);

  await retireDemo();

    const first = skillShots[0];
    const second = skillShots[1];
    await learnerRepository().importSnapshot(learnerId, {
      draft: {
        name: "Meera", currentRole: "Production Planner", responsibilityLevel: "individual", focus: "career", horizon: "6-months",
        priorityFamilies: ["human-intelligence"], prioritySkills: [slugifySkill("Problem solving"), slugifySkill("Decision making")],
        challengeType: "execution", challenge: "My weekly plan keeps changing after it is frozen and I do not know how to push back.",
        goal: "Become a confident planner who can run the daily huddle and build the weekly plan alone.", weeklyMinutes: 60,
      },
      answers: { "digital-fluency": 2, "critical-thinking": 1, creativity: 2, "human-skills": 3, "adaptive-leadership": 1 },
      skillShotResults: [
        { slug: first.slug, practice: "Decision: whether to accept a rush order. Constraints: spare capacity, material in stock, the frozen plan, approval from the Plant Head.", checkInAnswer: first.checkIn.correctIndex, completedAt: new Date().toISOString() },
        { slug: second.slug, practice: "Observation: three schedule changes this week. Interpretation: sales sends late forecasts. Test: compare forecast dates with change dates for a month.", checkInAnswer: second.checkIn.correctIndex, completedAt: new Date().toISOString() },
      ],
    });
    if ((await listCases(learnerId, SECTION)).length === 0) {
      await createCase(learnerId, SECTION, "Late changes to the frozen weekly plan", "The weekly plan is frozen every Thursday, but in the last two months about one plan in three was changed afterwards. Stores and the line supervisors are frustrated. I want to describe the problem properly and find the cause before suggesting a fix.");
    }
    log("Learner: profile, skills check, two Skill Shots and a Problem Solving case saved.");

}

async function stageInterview({ coachId }: Ctx, log: (line: string) => void): Promise<void> {
    const { projectId } = await interview.createProject(coachId, {
      title: "DEMO: My career in production planning", language: "en", publicName: "Asha Rao",
      consents: { recording: true, transcription: true, ai_processing: true, content_generation: true, publication: true },
    });
    let view = await interview.getView(coachId, projectId);
    for (let turn = 0; turn < 250 && view.project.stage !== "complete"; turn += 1) {
      const prompt = view.prompt;
      if (!prompt) break;
      let body: Parameters<typeof interview.submitTurn>[2];
      if (prompt.kind === "confirm_roles") body = { promptId: prompt.id, action: "roles_confirmed" };
      else if (prompt.options.length) {
        const ids = prompt.options.map((option) => option.id);
        let pick = OPTION_PREFERENCE.map((id) => ids.find((value) => value === id)).find(Boolean) ?? ids[0];
        // One job is explored in depth; the others stay on the timeline for another day, as a real contributor might.
        if (prompt.text.startsWith("Which job would you like to explore")) pick = view.roles.find((role) => role.title === "Production Planning Manager")?.id ?? ids[0];
        if (prompt.text.includes("go deeper here")) pick = ids.includes("summary") ? "summary" : "next";
        body = { promptId: prompt.id, action: "choice", optionId: pick };
      } else {
        const text = answerFor({ kind: prompt.kind, questionKey: undefined, text: prompt.text }, prompt.kind === "followup" ? followUpKindOf(prompt.text) : undefined);
        const key = prompt.kind === "question" ? matchQuestionKey(view.prompt?.text ?? "") : undefined;
        body = { promptId: prompt.id, action: "answer", text: key ? answerFor({ kind: "question", questionKey: key, text: prompt.text }) : text };
      }
      view = (await interview.submitTurn(coachId, projectId, body)).view;
    }
    log(`Coach: interview completed (${view.stats.topicsCovered} topics, ${view.roles.length} jobs on the timeline).`);

    // A pause and resume on another day, recorded in the transcript.
    await interview.finishSession(coachId, projectId).catch(() => undefined);
    await interview.openInterview(coachId, projectId).catch(() => undefined);

    const cv = Buffer.from("Curriculum vitae: Asha Rao\n\nProduction Planning Manager at Mahindra Forgings, 1999-2007\nTools: SAP, Excel, Kaizen. Cut late orders by 9% through weekly planning discipline.\nPlant Head at Bharat Components, 2008-2022");
    const upload = await uploads.addUpload(coachId, projectId, { name: "asha-rao-cv.txt", type: "text/plain", bytes: cv }, { ownership: "mine" });
    log(`Coach: uploaded a CV (${upload.factsAdded} suggested statements, ${upload.rolesFound} job hint).`);

}

async function stageReview({ coachId, projectId }: Ctx, log: (line: string) => void): Promise<void> {
    let reviewView = await review.getReview(coachId, projectId);
    for (const fact of reviewView.facts) {
      if (fact.permission === "anonymize" && !fact.anonymizedStatement && fact.reviewStatus !== "rejected") {
        await review.reviewFact(coachId, projectId, fact.id, { action: "confirm", permission: "anonymize", anonymizedStatement: "A senior leader backed the change on an important customer order, and the customer was kept." });
      }
    }
    const kpi = reviewView.facts.find((fact) => fact.category === "kpi" && fact.details && "definition" in fact.details && fact.kind === "direct_statement" && fact.reviewStatus !== "rejected");
    if (kpi) await review.reviewFact(coachId, projectId, kpi.id, { action: "details", details: { definition: "Order lines delivered by the promised date divided by all lines delivered", baseline: "86%", target: "95%", period: "weekly", result: "95% after two years" } });
    const target = reviewView.facts.find((fact) => fact.category === "practice" && fact.reviewStatus === "proposed" && fact.sensitivity === "none");
    if (target) await review.reviewFact(coachId, projectId, target.id, { action: "correct", statement: `${target.statement} I would add: always tell stores before touching a frozen plan.` });
    await review.confirmAllPlain(coachId, projectId);
    reviewView = await review.getReview(coachId, projectId);
    for (const fact of reviewView.facts) {
      if (fact.reviewStatus === "proposed" || fact.reviewStatus === "needs_confirmation") {
        const stub = fact.confidence === "low" || fact.kind === "ai_synthesis";
        await review.reviewFact(coachId, projectId, fact.id, stub ? { action: "reject" } : { action: "confirm", permission: fact.sensitivity === "none" ? "public" : "private" }).catch(() => undefined);
      }
    }
    await review.generateDraft(coachId, projectId);
    const approval = await review.approvePackage(coachId, projectId);
    if (!approval.approved) throw new Error(`Demo approval blocked: ${approval.gates.filter((g) => g.blocking && !g.passed).map((g) => g.label).join("; ")}`);
    log("Coach: reviewed, corrected and approved the knowledge package (skill.md, follow-ups, source map).");

}

async function stageLessons({ coachId, editorId, adminId, coach2Id, projectId }: Ctx, log: (line: string) => void): Promise<void> {
    const made = await lessons.generateLessons(editorId, projectId);
    log(`Editor: drafted ${made.created} lessons from the approved package.`);
    const drafted = await lessons.listLessonsForUser(editorId, { projectId });
    const publishable = drafted.filter((lesson) => lesson.issues.length === 0);
    for (const [index, lesson] of publishable.entries()) {
      await lessons.lessonAction(editorId, lesson.id, "submit");
      if (index === publishable.length - 1 && publishable.length > 2) continue; // left "with an editor" to show the queue
      await lessons.lessonAction(editorId, lesson.id, "editor_approve");
      if (index === publishable.length - 2 && publishable.length > 2) continue; // left for the coach to approve
      await lessons.lessonAction(coachId, lesson.id, "contributor_approve");
      await lessons.lessonAction(editorId, lesson.id, "publish");
    }
    const primary = publishable[0];
    if (primary) await lessons.setAttribution(adminId, primary.id, [{ contributorId: coachId, shareBp: 6000 }, { contributorId: coach2Id, shareBp: 4000, creditedAs: "co-author" }]);
    log("Editor and coach: lessons reviewed and published; one waits for the coach, one for editor review; one lesson credits two contributors 60/40.");

}

/** One lesson per call; returns how many published lessons there are so the caller knows when to stop. */
async function stageUsage({ learnerId, editorId, projectId }: Ctx, lessonIndex: number, log: (line: string) => void): Promise<number> {
    const published = (await lessons.listLessonsForUser(editorId, { projectId })).filter((lesson) => lesson.status === "published");
    const crowd = Array.from({ length: 7 }, (_, i) => `demo-learner-key-${String(i).padStart(2, "0")}-abcdefgh`);
    for (const [index, lesson] of published.entries()) {
      if (index !== lessonIndex) continue;
      const people = [{ userId: learnerId }, ...crowd.map((anonymousKey) => ({ anonymousKey }))];
      for (const [personIndex, identity] of people.entries()) {
        if ((personIndex + index) % 5 === 4) continue; // not everyone finishes
        await learner.recordEvent({ slug: lesson.slug, type: "start", identity });
        for (let tick = 0; tick < 3 + (personIndex % 3); tick += 1) await learner.recordEvent({ slug: lesson.slug, type: "progress", seconds: 60, eventKey: `demo-${tick}`, identity });
        if ((personIndex + index) % 3 !== 2) {
          await learner.recordEvent({ slug: lesson.slug, type: "complete", identity });
          if (personIndex % 2 === 0) await learner.recordEvent({ slug: lesson.slug, type: "material_use", eventKey: "demo-notes", identity });
          await learner.recordFeedback({ slug: lesson.slug, rating: 3 + ((personIndex + index) % 3), useful: personIndex % 4 !== 3, comment: personIndex === 0 ? "Clear and practical. The daily huddle idea is something I can use on Monday." : undefined, identity });
        }
      }
    }
    if (published[lessonIndex]) log(`Learners: demo learner and 7 others used lesson ${lessonIndex + 1} of ${published.length}; progress, completions, material use and ratings recorded.`);
    return published.length;

}

async function stageFinance({ adminId }: Ctx, log: (line: string) => void): Promise<void> {
    const template = draftPolicyTemplate();
    const policy = await earnings.saveDraftPolicy(adminId, { ...template, version: "demo-2026.1", contributorPoolBp: 4000, notes: "DEMO ONLY. Illustrative numbers. Approve a real policy before any payment." });
    for (const [i, gross] of [1_200_000, 850_000, 640_000].entries()) {
      await earnings.recordReceipt(adminId, { externalRef: `demo-receipt-${i + 1}`, grossMinor: gross, feeMinor: Math.round(gross * 0.02), taxMinor: Math.round(gross * 0.15), currency: "INR", receivedAt: new Date().toISOString() });
    }
    const run = await earnings.runAllocation(adminId, { policyId: policy.id, periodStart: new Date(Date.now() - 30 * 86_400_000).toISOString(), periodEnd: new Date(Date.now() + 86_400_000).toISOString() });
    log(`Admin: saved a demo policy, recorded receipts and ran an allocation (${run.run.status}; pool ${run.run.inputs.poolMinor / 100} INR). Approve the policy to see a payable statement.`);

}

/** The interview prompt text carries the question; map it back to the library key so the right sample answer is used. */
function matchQuestionKey(text: string): string | undefined {
  const sorted = [...QUESTION_BANK].sort((a, b) => b.text.length - a.text.length);
  return sorted.find((question) => text.includes(question.text))?.key;
}
