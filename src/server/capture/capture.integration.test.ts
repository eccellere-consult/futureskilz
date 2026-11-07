/**
 * End-to-end test of the capture workflow against a real MariaDB: interview, resume, upload, review, approval, lessons,
 * learner events and the earnings ledger. It is skipped unless CAPTURE_INTEGRATION=1 (it needs the MYSQL_* settings of
 * .env.local and an empty-ish database), so `npm test` stays fast and CI stays database-free. Run it with:
 *
 *   npm run test:integration
 */
import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const enabled = process.env.CAPTURE_INTEGRATION === "1";

const LONG =
  "In that role we planned production with SAP every morning. First we checked demand, then we scheduled the lines, then we released orders and finally reviewed the schedule. For example, once we cut changeover time by 20 percent and the result was fewer late orders.";

describe.skipIf(!enabled)("expert capture, end to end", () => {
  let contributor = "";
  let editor = "";
  let admin = "";
  let stranger = "";
  let projectId = "";

  // Loaded lazily so a skipped run never touches the database.
  let svc: typeof import("./interview-service");
  let review: typeof import("./review-service");
  let uploads: typeof import("./upload-service");
  let lessons: typeof import("./lesson-service");
  let learner: typeof import("./learner-service");
  let earnings: typeof import("./earnings-service");
  let transcript: typeof import("./transcript-service");
  let shared: typeof import("./shared");
  let schema: typeof import("@/server/db/schema");

  beforeAll(async () => {
    svc = await import("./interview-service");
    review = await import("./review-service");
    uploads = await import("./upload-service");
    lessons = await import("./lesson-service");
    learner = await import("./learner-service");
    earnings = await import("./earnings-service");
    transcript = await import("./transcript-service");
    shared = await import("./shared");
    schema = await import("@/server/db/schema");
    const db = await shared.database();
    const make = async (name: string, roles: string[]) => {
      const id = randomUUID();
      await db.insert(schema.users).values({ id, email: `${name}-${id.slice(0, 6)}@example.test`, displayName: name });
      for (const role of roles) await db.insert(schema.userRoles).values({ userId: id, role });
      return id;
    };
    contributor = await make("Asha Rao", []);
    editor = await make("Edith Editor", ["editor"]);
    admin = await make("Adam Admin", ["admin"]);
    stranger = await make("Sam Stranger", []);
  });

  const answerFor = (view: Awaited<ReturnType<typeof svc.getView>>) => {
    const prompt = view.prompt!;
    if (prompt.kind === "confirm_roles") return { action: "roles_confirmed" as const };
    if (prompt.kind === "confirm_known") return { action: "choice" as const, optionId: "accurate" };
    if (prompt.kind === "summary_check") return { action: "choice" as const, optionId: "yes" };
    if (prompt.kind === "choice" || (prompt.kind === "followup" && prompt.options.length)) {
      const ids = prompt.options.map((option) => option.id);
      const pick = ids.includes("anonymize") ? "anonymize" : ids.includes("next") ? "next" : ids.includes("no") ? "no" : ids.includes("yes") ? "yes" : ids[0];
      return { action: "choice" as const, optionId: pick };
    }
    if (prompt.text.startsWith("Please walk me through your career"))
      return { action: "answer" as const, text: "I joined as a Graduate Trainee at Tata Steel, 1996-1999.\nThen Planning Manager at Acme Steel (2000-2008).\nLater I worked as Plant Head with Bharat Forge from about 2009 to present." };
    if (prompt.text.includes("important success")) return { action: "answer" as const, text: `${LONG} My manager Rajesh Kumar backed the change on a confidential client order, and we kept the buyer after a tense month.` };
    if (prompt.kind === "followup") return { action: "answer" as const, text: "Scrap rate is scrapped units over total units, reported monthly; the baseline was 6 percent and the result was 4.9 percent." };
    return { action: "answer" as const, text: LONG };
  };

  it("registers consent and starts with one clear question, not a form", async () => {
    await expect(svc.createProject(contributor, { title: "Planning", language: "en", consents: { recording: true } })).rejects.toThrow(/agree to recording/);
    const { projectId: id } = await svc.createProject(contributor, { title: "Production planning career", language: "en", publicName: "Asha Rao", consents: { recording: true, transcription: true, ai_processing: true } });
    projectId = id;
    const view = await svc.getView(contributor, projectId);
    expect(view.prompt?.kind).toBe("question");
    expect(view.prompt?.text).toMatch(/future professionals/);
    expect(view.transcript[0].text).toMatch(/Arya, an AI interviewer, not a person/);
    expect(view.needsPlan).toBe(true);
    expect(view.person.length).toBeGreaterThan(0);
  });

  it("lets the contributor choose how the interview is shaped, and only the owner", async () => {
    await expect(svc.setInterviewPlan(editor, projectId, { mode: "arya", skipPhases: [], topics: [] })).rejects.toThrow(/not found/);
    await expect(svc.setInterviewPlan(contributor, projectId, { mode: "nonsense" })).rejects.toThrow(/could not be read/);
    const view = await svc.setInterviewPlan(contributor, projectId, { mode: "arya", skipPhases: ["A", "O"], topics: [] });
    expect(view.needsPlan).toBe(false);
    expect(view.plan).toEqual({ mode: "arya", skipPhases: [], topics: [] });
  });

  it("keeps another contributor out of the interview", async () => {
    await expect(svc.getView(editor, projectId)).rejects.toThrow(/not found/);
  });

  it("ignores a stale or repeated submission instead of recording it twice", async () => {
    const view = await svc.getView(contributor, projectId);
    const first = await svc.submitTurn(contributor, projectId, { promptId: view.prompt!.id, action: "answer", text: "I want them to learn how plants really run, from planning to the shop floor, and why people matter most." });
    expect(first.stale).toBe(false);
    const again = await svc.submitTurn(contributor, projectId, { promptId: view.prompt!.id, action: "answer", text: "duplicate" });
    expect(again.stale).toBe(true);
  });

  it("pauses mid-interview, and resumes on another day with a recap and the same question — nothing repeated", async () => {
    let view = await svc.getView(contributor, projectId);
    for (let i = 0; i < 6; i += 1) {
      const answer = answerFor(view);
      view = (await svc.submitTurn(contributor, projectId, { promptId: view.prompt!.id, ...answer })).view;
    }
    const pending = view.prompt!;
    const finished = await svc.finishSession(contributor, projectId);
    expect(finished.summary).toMatch(/answered/);

    const resumed = await svc.openInterview(contributor, projectId);
    expect(resumed.project.sessionNumber).toBe(2);
    expect(resumed.recap?.line).toMatch(/Last time we covered/);
    expect(resumed.prompt?.id).toBe(pending.id);
    expect(resumed.prompt?.text).toBe(pending.text);
  });

  it("drafts the career timeline from the walk-through and explores jobs in turn, never asking a question twice", async () => {
    let view = await svc.getView(contributor, projectId);
    const asked: string[] = [];
    for (let i = 0; i < 400 && view.project.stage !== "complete"; i += 1) {
      const prompt = view.prompt!;
      if (prompt.kind === "confirm_roles") {
        expect(view.roles.length).toBe(3);
        expect(view.roles.map((role) => role.title)).toEqual(expect.arrayContaining(["Graduate Trainee", "Planning Manager", "Plant Head"]));
        expect(view.roles.every((role) => !role.confirmed)).toBe(true);
      }
      if (prompt.kind === "question") asked.push(`${prompt.text}|${prompt.roleLabel}`);
      view = (await svc.submitTurn(contributor, projectId, { promptId: prompt.id, ...answerFor(view) })).view;
      if (view.project.stage === "complete") break;
    }
    expect(view.project.status).toBe("in_review");
    expect(new Set(asked).size).toBe(asked.length);
    expect(view.roles.every((role) => role.confirmed)).toBe(true);
    expect(view.timeline.flags.filter((flag) => flag.severity === "conflict")).toEqual([]);
  }, 120_000);

  it("keeps the transcript verbatim, in sessions, and exports it as text", async () => {
    const { text, filename } = await transcript.exportTranscript(contributor, projectId);
    expect(filename).toMatch(/\.txt$/);
    expect(text).toContain("==== SESSION 1");
    expect(text).toContain("==== SESSION 2");
    expect(text).toContain("Companion (AI):");
    expect(text).toContain("I joined as a Graduate Trainee at Tata Steel, 1996-1999.");
  });

  it("reads an uploaded document as evidence, links it to a page, and drafts its jobs into the timeline", async () => {
    const cv = Buffer.from("Curriculum vitae\n\nSenior Planner at Hindustan Motors, 1990-1995\nTools: Excel, Oracle, Kaizen.\nCut inventory days by 15% through better planning.");
    const result = await uploads.addUpload(contributor, projectId, { name: "cv.txt", type: "text/plain", bytes: cv }, { ownership: "mine" });
    expect(result.status).toBe("extracted");
    expect(result.rolesFound).toBe(1);
    const dup = await uploads.addUpload(contributor, projectId, { name: "cv-copy.txt", type: "text/plain", bytes: cv }, { ownership: "mine" });
    expect(dup.duplicate).toBe(true);
    const view = await review.getReview(contributor, projectId);
    const fromUpload = view.facts.filter((fact) => fact.kind === "source_fact");
    expect(fromUpload.length).toBeGreaterThan(0);
    expect(fromUpload[0].sourceDetails[0]).toMatchObject({ origin: "upload", locator: "document" });
    const unsupported = await uploads.addUpload(contributor, projectId, { name: "clip.mp4", type: "video/mp4", bytes: Buffer.from("not really a video") }, { ownership: "mine" });
    expect(unsupported.status).toBe("unsupported");
  });

  let reviewView: Awaited<ReturnType<typeof review.getReview>>;

  it("shows every statement with the words it came from, and blocks approval until consent, rights and sensitive details are settled", async () => {
    reviewView = await review.getReview(contributor, projectId);
    expect(reviewView.facts.length).toBeGreaterThan(20);
    for (const fact of reviewView.facts) {
      expect(fact.sourceDetails.length, fact.title).toBeGreaterThan(0);
      expect(fact.sourceDetails[0].quote.length).toBeGreaterThan(2);
    }
    const early = await review.approvePackage(contributor, projectId);
    expect(early.approved).toBe(false);
    const failing = early.gates.filter((gate) => gate.blocking && !gate.passed).map((gate) => gate.id);
    // Sensitive details raised in the interview were settled there; consent and enough confirmed material are still missing.
    expect(failing).toEqual(expect.arrayContaining(["consent", "enough_content"]));
  });

  it("lets the contributor correct, reject and complete statements; the original source is kept", async () => {
    const plain = reviewView.facts.find((fact) => fact.sensitivity === "none" && fact.category === "practice" && fact.reviewStatus === "proposed")!;
    const corrected = await review.reviewFact(contributor, projectId, plain.id, { action: "correct", statement: "Each morning we checked demand, scheduled the lines and released orders by 9 am." });
    expect(corrected).toMatchObject({ reviewStatus: "corrected", kind: "direct_statement", version: plain.version + 1 });
    expect(corrected.sources.length).toBe(plain.sources.length + 1);
    expect(corrected.sources.some((source) => source.quote.includes("released orders by 9 am"))).toBe(true);

    const kpi = reviewView.facts.find((fact) => fact.category === "kpi" && fact.kind === "direct_statement" && fact.reviewStatus === "needs_confirmation")!;
    const filled = await review.reviewFact(contributor, projectId, kpi.id, { action: "details", details: { definition: "Scrapped units over total units", baseline: "6%", target: null } });
    expect(filled.details).toMatchObject({ definition: "Scrapped units over total units", baseline: "6%", target: null });
    await review.reviewFact(contributor, projectId, kpi.id, { action: "confirm" });

    const stub = reviewView.facts.find((fact) => fact.category === "tool" && fact.kind === "direct_statement")!;
    expect((await review.reviewFact(contributor, projectId, stub.id, { action: "reject" })).reviewStatus).toBe("rejected");

    const db = await shared.database();
    const revisions = await db.select().from(schema.kcFactRevisions).where(eq(schema.kcFactRevisions.factId, plain.id));
    expect(revisions.map((revision) => revision.action)).toEqual(expect.arrayContaining(["create", "correct"]));
    expect(revisions.find((revision) => revision.action === "correct")!.before).toMatchObject({ statement: plain.statement });
  });

  it("holds an anonymised statement back until the contributor writes the wording they approve", async () => {
    const sensitive = (await review.getReview(contributor, projectId)).facts.filter((fact) => fact.permission === "anonymize" && fact.reviewStatus !== "rejected");
    expect(sensitive.length).toBeGreaterThan(0);
    await expect(review.reviewFact(contributor, projectId, sensitive[0].id, { action: "confirm" })).rejects.toThrow(/anonymised wording/);
    const done = await review.reviewFact(contributor, projectId, sensitive[0].id, { action: "confirm", permission: "anonymize", anonymizedStatement: "A senior leader backed a change on a client order, and the client was kept." });
    expect(done).toMatchObject({ reviewStatus: "confirmed", permission: "anonymize" });
  });

  it("generates the draft skill.md with sources and an honest review status", async () => {
    const draft = await review.generateDraft(contributor, projectId);
    expect(draft.skillMd).toContain("status: awaiting-contributor-review");
    for (let i = 1; i <= 19; i += 1) expect(draft.skillMd).toMatch(new RegExp(`^## ${i}\\. `, "m"));
    expect(draft.skillMd).toMatch(/\[S\d+\]/);
    expect(draft.skillMd).toContain("Each morning we checked demand");
    const doc = await review.getDocument(contributor, projectId, "follow_up_questions");
    expect(doc.content).toMatch(/Follow-up questions/);
  });

  it("approves only after every consent is given, every sensitive detail settled and the rest confirmed", async () => {
    await svc.updateConsents(contributor, projectId, { content_generation: true, publication: true });
    const settled = await review.confirmAllPlain(contributor, projectId);
    expect(settled.confirmed).toBeGreaterThan(0);
    // Anything still sensitive needs an explicit choice.
    let current = await review.getReview(contributor, projectId);
    for (const fact of current.facts.filter((f) => f.sensitivity !== "none" && f.permission === "unset" && f.reviewStatus !== "rejected")) {
      await review.reviewFact(contributor, projectId, fact.id, { action: "confirm", permission: "private" });
    }
    current = await review.getReview(contributor, projectId);
    for (const upload of current.uploads) expect(upload.ownership).toBe("mine");
    const result = await review.approvePackage(contributor, projectId);
    expect(result.gates.filter((gate) => gate.blocking && !gate.passed).map((gate) => gate.id)).toEqual([]);
    expect(result.approved).toBe(true);
    const approvedDoc = await review.getDocument(contributor, projectId, "skill_md", { approved: true });
    expect(approvedDoc.content).toContain("status: approved");
    expect(approvedDoc.content).toContain("mode: publish");
    // Rejected or unconfirmed text never reaches the approved document.
    expect(approvedDoc.content).not.toContain("Rajesh");
    expect(approvedDoc.content).not.toContain("Mentions SAP");
    // The approved interview reaches the editor and the admin the moment it is approved.
    expect((await lessons.listApprovedProjects(editor)).map((p) => p.id)).toContain(projectId);
    expect((await lessons.listApprovedProjects(admin)).map((p) => p.id)).toContain(projectId);
  });

  it("flags a change made after approval", async () => {
    const before = await review.getReview(contributor, projectId);
    expect(before.changedSinceApproval).toBe(false);
    const target = before.facts.find((fact) => fact.reviewStatus === "confirmed" && fact.category === "practice")!;
    await review.reviewFact(contributor, projectId, target.id, { action: "reopen" });
    expect((await review.getReview(contributor, projectId)).changedSinceApproval).toBe(true);
    await expect(lessons.generateLessons(editor, projectId)).rejects.toThrow(/approve the package again/);
    await review.reviewFact(contributor, projectId, target.id, { action: "confirm" });
    await review.approvePackage(contributor, projectId);
  });

  let lessonId = "";
  let lessonSlug = "";

  it("lets the author or an editor — and no one else — turn the approved package into lesson drafts that already carry attribution", async () => {
    await expect(lessons.generateLessons(stranger, projectId)).rejects.toThrow(/Only the author or an editor/);
    const made = await lessons.generateLessons(editor, projectId);
    expect(made.created).toBeGreaterThan(0);
    const again = await lessons.generateLessons(editor, projectId);
    expect(again.created).toBe(0);
    const list = await lessons.listLessonsForUser(editor, { projectId });
    const pick = list.find((lesson) => lesson.title.startsWith("How to")) ?? list[0];
    lessonId = pick.id;
    lessonSlug = pick.slug;
    const detail = await lessons.getLessonDetail(editor, lessonId);
    expect(detail.attribution).toEqual([{ contributorId: contributor, name: "Asha Rao", shareBp: 10000, creditedAs: "author" }]);
    expect(detail.spec.factIds.length).toBeGreaterThan(0);
    expect(detail.spec.scenes.length).toBeGreaterThan(3);
    expect((detail.spec as { skillMap?: { status: string } }).skillMap?.status).toBe("suggested");
  });

  it("offers a lesson in learners' pathways only after an editor confirms the skills it builds", async () => {
    await expect(lessons.setLessonSkills(contributor, lessonId, [{ skill: "operations", toLevel: 3 }])).rejects.toThrow(/Only an editor/);
    await expect(lessons.setLessonSkills(editor, lessonId, [{ skill: "not-a-skill", toLevel: 3 }])).rejects.toThrow(/at least one skill/);
    const confirmed = await lessons.setLessonSkills(editor, lessonId, [{ skill: "operations", toLevel: 3 }, { skill: "problem-solving", toLevel: 2.5 }]);
    expect((confirmed.spec as { skillMap?: { status: string; skills: unknown[] } }).skillMap).toMatchObject({ status: "confirmed" });
  });

  it("cannot publish out of order, and the contributor — not the editor — approves the lesson", async () => {
    await expect(lessons.lessonAction(editor, lessonId, "publish")).rejects.toThrow(/cannot publish/);
    await lessons.lessonAction(editor, lessonId, "submit");
    await lessons.lessonAction(editor, lessonId, "editor_approve");
    await expect(lessons.lessonAction(editor, lessonId, "contributor_approve")).rejects.toThrow(/cannot/);
    await lessons.lessonAction(contributor, lessonId, "contributor_approve");
    const published = await lessons.lessonAction(editor, lessonId, "publish");
    expect(published.status).toBe("published");
    expect((await lessons.learningPaths()).length).toBeGreaterThan(0);
    const offered = (await lessons.listPublishedLessons()).filter((lesson) => (lesson.spec.skillMap?.status ?? "") === "confirmed");
    expect(offered.some((lesson) => lesson.slug === lessonSlug)).toBe(true);
  });

  it("redesigns a published lesson as a Skill Shot that only the coach's approval lets through", async () => {
    const studio = await import("../skillshots/service");
    const { rootCauseSkillShot } = await import("../../features/skillshot/samples/root-cause");
    await expect(studio.designFromLesson(contributor, lessonId)).rejects.toThrow(/Only an editor/);
    const started = await studio.designFromLesson(editor, lessonId);
    expect(started.fromLesson).toMatchObject({ lessonId, approvedAt: null });
    await expect(studio.designFromLesson(editor, lessonId)).rejects.toThrow(/already has/);
    let draft = started;
    for (let i = 0; i < 40 && draft.status === "designing"; i += 1) {
      await new Promise((resolve) => setTimeout(resolve, 250));
      draft = await studio.getDraft(editor, started.id);
    }
    expect(draft.status).toBe("draft");

    // The coach sees their own draft, and only theirs.
    expect((await studio.getDraft(contributor, draft.id)).viewer).toBe("contributor");
    expect((await studio.listMyApprovals(contributor)).map((item) => item.id)).toContain(draft.id);
    await expect(studio.draftAction(contributor, draft.id, "submit")).rejects.toThrow(/Only an editor/);

    const saved = await studio.saveBlueprint(editor, draft.id, structuredClone(rootCauseSkillShot));
    expect(saved.passes).toBe(true);
    await studio.draftAction(editor, draft.id, "submit");
    await studio.draftAction(editor, draft.id, "approve");
    await expect(studio.draftAction(editor, draft.id, "publish")).rejects.toThrow(/coach .* needs to approve/);
    const approved = await studio.contributorApproveDraft(contributor, draft.id);
    expect(approved.fromLesson?.approvedAt).toBeTruthy();
    expect((await studio.listMyApprovals(contributor)).map((item) => item.id)).not.toContain(draft.id);
    expect((await studio.draftAction(editor, draft.id, "publish")).status).toBe("published");
  });

  it("splits credit across contributors only if it adds up to 100%", async () => {
    const db = await shared.database();
    const second = randomUUID();
    await db.insert(schema.users).values({ id: second, email: `ravi-${second.slice(0, 6)}@example.test`, displayName: "Ravi" });
    await db.insert(schema.kcContributors).values({ userId: second, publicName: "Ravi Menon" });
    await expect(lessons.setAttribution(admin, lessonId, [{ contributorId: contributor, shareBp: 5000 }])).rejects.toThrow(/10000/);
    await expect(lessons.setAttribution(editor, lessonId, [{ contributorId: contributor, shareBp: 6000 }, { contributorId: second, shareBp: 4000 }])).rejects.toThrow(/admin/);
    const credits = await lessons.setAttribution(admin, lessonId, [{ contributorId: contributor, shareBp: 6000 }, { contributorId: second, shareBp: 4000 }]);
    expect(credits.map((c) => c.shareBp).sort()).toEqual([4000, 6000]);
    secondContributor = second;
  });

  let secondContributor = "";

  it("records learner usage from the first view, idempotently, with no personal data", async () => {
    const keys = ["learner-key-aaaaaaaaaaaa", "learner-key-bbbbbbbbbbbb", "learner-key-cccccccccccc"];
    for (const key of keys) {
      const identity = { anonymousKey: key };
      await learner.recordEvent({ slug: lessonSlug, type: "start", identity });
      await learner.recordEvent({ slug: lessonSlug, type: "progress", seconds: 120, eventKey: "p1", identity });
      await learner.recordEvent({ slug: lessonSlug, type: "progress", seconds: 120, eventKey: "p1", identity }); // a retry
      await learner.recordEvent({ slug: lessonSlug, type: "complete", identity });
      await learner.recordEvent({ slug: lessonSlug, type: "complete", identity });
      await learner.recordFeedback({ slug: lessonSlug, rating: 5, useful: true, identity });
    }
    await learner.recordFeedback({ slug: lessonSlug, rating: 4, comment: "see http://spam.example", identity: { anonymousKey: keys[0] } });
    await expect(learner.recordEvent({ slug: lessonSlug, type: "start", identity: {} })).rejects.toThrow(/learner key/);
    await expect(learner.recordEvent({ slug: "nope", type: "start", identity: { anonymousKey: keys[0] } })).rejects.toThrow(/not available/);

    const db = await shared.database();
    const events = await db.select().from(schema.kcLearningEvents);
    expect(events.filter((e) => e.eventType === "progress")).toHaveLength(3);
    expect(events.filter((e) => e.eventType === "complete")).toHaveLength(3);
    expect(events.every((e) => !/learner-key|@/.test(e.learnerRef))).toBe(true);
    const usage = (await learner.usageByLesson([lessonId])).get(lessonId)!;
    expect(usage).toMatchObject({ starts: 3, completions: 3, learners: 3, seconds: 360, ratings: 3 });
    expect(usage.meanRating).toBeCloseTo(4.67, 1);
  });

  it("lists the published lesson in the marketplace with its author and a quality score that says how much is behind it", async () => {
    const { loadListings } = await import("../marketplace/service");
    const { coachProfileId } = await import("../marketplace/profile-id");
    const listings = await loadListings();
    const mine = listings.find((item) => item.id === `coach-lesson:${lessonSlug}`)!;
    expect(mine).toBeTruthy();
    expect(mine.kind).toBe("coach-lesson");
    expect(mine.creator).toEqual({ name: "Asha Rao", profileId: coachProfileId(contributor) });
    expect(JSON.stringify(mine)).not.toContain(contributor); // the page address never shows an account id
    expect(mine.learners).toBe(3);
    // Three learners rated it: too few to count as a rating, so quality rests on checks and the author's standing and says so.
    expect(mine.quality.parts.find((part) => part.key === "usefulness")?.used).toBe(false);
    expect(mine.quality.confidence).toBe("early");
    expect(mine.quality.score).not.toBeNull();
    // The built-in Skill Shots and kits are there too, and a redesigned one replaces its original instead of appearing twice.
    expect(listings.some((item) => item.kind === "designed-skill-shot")).toBe(true);
    expect(listings.some((item) => item.kind === "kit")).toBe(true);
    const hrefs = listings.map((item) => item.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });

  it("gives a coach a public page that shows their name, headline and live lessons, and never an account id", async () => {
    const { getCoachProfile } = await import("../marketplace/service");
    const { coachProfileId } = await import("../marketplace/profile-id");
    const profile = await getCoachProfile(coachProfileId(contributor));
    expect(profile?.name).toBe("Asha Rao");
    expect(profile?.lessons.some((item) => item.id === `coach-lesson:${lessonSlug}`)).toBe(true);
    expect(profile?.learnersReached).toBe(3);
    expect(JSON.stringify(profile)).not.toContain(contributor);
    expect(await getCoachProfile("0123456789abcdef")).toBeNull();
    expect(await getCoachProfile("not-an-id")).toBeNull();
  });

  it("shows the contributor usage for their lessons while the earnings rules are still pending", async () => {
    const dash = await earnings.contributorDashboard(contributor);
    expect(dash.earningsPolicy?.version.startsWith("demo") ?? false).toBe(false); // the sample policy is only ever a draft
    const row = dash.lessons.find((lesson) => lesson.id === lessonId)!;
    expect(row).toMatchObject({ shareBp: 6000, status: "published" });
    expect(row.usage.completions).toBe(3);
  });

  it("calculates earnings only from a versioned policy: a preview first, payable only once approved", async () => {
    await expect(earnings.listPolicies(editor)).rejects.toThrow(/admin/);
    const { template } = await earnings.listPolicies(admin);
    const version = `2026.${Date.now() % 100000}`;
    await expect(earnings.saveDraftPolicy(admin, { ...template, version, weights: { ...template.weights, usefulness: 9000 } })).rejects.toThrow(/10000|ratings alone/);
    const draft = await earnings.saveDraftPolicy(admin, { ...template, version, contributorPoolBp: 4000 });
    await earnings.recordReceipt(admin, { externalRef: `rcpt-${version}`, grossMinor: 1_000_000, taxMinor: 150_000, feeMinor: 50_000, currency: "INR", receivedAt: new Date().toISOString() });
    const period = { periodStart: new Date(Date.now() - 86_400_000).toISOString(), periodEnd: new Date(Date.now() + 86_400_000).toISOString() };

    const preview = await earnings.runAllocation(admin, { policyId: draft.id, ...period });
    expect(preview.run.status).toBe("illustrative");
    expect(preview.run.inputs.eligibleNetMinor).toBe(800_000);
    expect(preview.run.inputs.poolMinor).toBe(320_000);
    const previewTotal = preview.run.contributors.reduce((sum, c) => sum + c.totalMinor, 0);
    expect(previewTotal + preview.run.unallocatedMinor).toBe(320_000);
    expect(preview.run.contributors.every((c) => !c.payable)).toBe(true);
    await expect(earnings.finalizeStatement(admin, preview.statements[0].id, "final")).rejects.toThrow(/illustrative/);

    await earnings.approvePolicy(admin, draft.id);
    await expect(earnings.saveDraftPolicy(admin, { ...template, version, contributorPoolBp: 9000 })).rejects.toThrow(/cannot be changed/);
    const real = await earnings.runAllocation(admin, { policyId: draft.id, ...period });
    expect(real.run.status).toBe("draft");
    const mine = real.run.contributors.find((c) => c.contributorId === contributor)!;
    const theirs = real.run.contributors.find((c) => c.contributorId === secondContributor)!;
    expect(mine.totalMinor + theirs.totalMinor).toBe(real.run.lessons.reduce((s, l) => s + l.allocationMinor, 0));
    expect(Math.abs(mine.totalMinor / (mine.totalMinor + theirs.totalMinor) - 0.6)).toBeLessThan(0.001);
    expect(real.run.contributors.every((c) => c.payable)).toBe(true);

    // Re-running the same inputs is idempotent and reproducible.
    const again = await earnings.runAllocation(admin, { policyId: draft.id, ...period });
    expect(again.inputsHash).toBe(real.inputsHash);
    expect(again.statements.map((s) => s.id).sort()).toEqual(real.statements.map((s) => s.id).sort());

    const statement = real.statements.find((s) => s.contributorId === contributor)!;
    await earnings.finalizeStatement(admin, statement.id, "final");
    await earnings.disputeStatement(contributor, statement.id, "The completion count looks low to me.");
    const dash = await earnings.contributorDashboard(contributor);
    const seen = dash.statements.find((s) => s.id === statement.id)!;
    expect(seen.status).toBe("disputed");
    expect(dash.earningsPolicy?.version).toBe(version);
    await expect(earnings.disputeStatement(secondContributor, statement.id, "Not mine to dispute at all")).rejects.toThrow(/not found/);
  });

  it("withdraws a contributor's knowledge: lessons are retired and the project is closed", async () => {
    await review.withdrawProject(contributor, projectId, "Changed my mind");
    const db = await shared.database();
    const rows = await db.select().from(schema.kcLessons).where(eq(schema.kcLessons.projectId, projectId));
    expect(rows.every((row) => row.status === "retired")).toBe(true);
    expect((await lessons.listPublishedLessons()).some((l) => l.slug === lessonSlug)).toBe(false);
    await expect(svc.openInterview(contributor, projectId)).rejects.toThrow(/withdrawn/);
  });

  it("reviews fraud flags (admin only, with a note), compares both formulas and runs campaigns that can be used up", async () => {
    const fraud = await import("./fraud-service");
    const campaignsSvc = await import("./campaign-service");
    const db = await shared.database();
    const flagId = crypto.randomUUID();
    await db.insert(schema.fraudFlags).values({ id: flagId, subjectType: "learner", subjectRef: `ref-${flagId.slice(0, 8)}`, rule: "completion_burst", severity: "high", summary: "Eight completions within half an hour." });
    await expect(fraud.listFlags(editor)).rejects.toThrow(/Only an admin/);
    expect((await fraud.listFlags(admin)).some((flag) => flag.id === flagId)).toBe(true);
    await expect(fraud.reviewFlag(admin, flagId, "confirm", "no")).rejects.toThrow(/short note/);
    expect((await fraud.reviewFlag(admin, flagId, "confirm", "Checked the timestamps; a script.")).status).toBe("confirmed");
    await expect(fraud.reviewFlag(admin, flagId, "dismiss", "Changed my mind later")).rejects.toThrow(/already reviewed/);
    expect((await fraud.scanFraud(admin)).created).toBeGreaterThanOrEqual(0);

    const [policy] = (await earnings.listPolicies(admin)).policies;
    if (policy) {
      const now = Date.now();
      const compared = await earnings.compareFormulas(admin, { policyId: policy.id, periodStart: new Date(now - 30 * 86_400_000).toISOString(), periodEnd: new Date(now + 86_400_000).toISOString() });
      expect(compared.lessons.reduce((s, l) => s + l.weightedMinor, 0)).toBeLessThanOrEqual(compared.poolMinor);
      expect(compared.lessons.reduce((s, l) => s + l.qvsMinor, 0)).toBeLessThanOrEqual(compared.poolMinor);
    }

    const code = `TEST${Date.now().toString(36).toUpperCase()}`.slice(0, 12);
    const start = new Date(Date.now() - 86_400_000).toISOString();
    const end = new Date(Date.now() + 86_400_000).toISOString();
    await expect(campaignsSvc.createCampaign(editor, { name: "Nope", kind: "discount", code, percentOffBp: 1000, startsAt: start, endsAt: end })).rejects.toThrow(/Only an admin/);
    await expect(campaignsSvc.createCampaign(admin, { name: "No code", kind: "discount", percentOffBp: 1000, startsAt: start, endsAt: end })).rejects.toThrow(/needs a code/);
    const made = await campaignsSvc.createCampaign(admin, { name: "Launch offer", kind: "discount", code, percentOffBp: 1500, startsAt: start, endsAt: end, maxRedemptions: 1 });
    expect(await campaignsSvc.liveDiscountByCode(code)).toBeNull();
    await campaignsSvc.setCampaignStatus(admin, made.id, "active");
    expect(await campaignsSvc.liveDiscountByCode(code.toLowerCase())).toMatchObject({ percentOffBp: 1500 });
    expect(await campaignsSvc.redeemCampaign(made.id)).toBe(true);
    expect(await campaignsSvc.redeemCampaign(made.id)).toBe(false);
    expect(await campaignsSvc.liveDiscountByCode(code)).toBeNull();
  });
});

describe.skipIf(!enabled)("the demo", () => {
  it("builds a finished example for each persona from the real services, and keeps sample data out of real policies", async () => {
    const { seedDemo, retireDemo } = await import("@/server/demo/seed");
    const earnings = await import("./earnings-service");
    const lessons = await import("./lesson-service");
    const shared = await import("./shared");
    const schema = await import("@/server/db/schema");
    const { PERSONAS } = await import("@/server/demo/personas");
    const report = await seedDemo();
    expect(report.seeded).toBe(true);
    const byStatus = (status: string) => report.lessons.filter((lesson) => lesson.status === status).length;
    expect(byStatus("published")).toBeGreaterThan(3);
    expect(byStatus("awaiting_contributor")).toBe(1);
    expect(byStatus("in_review")).toBe(1);

    const db = await shared.database();
    const [coach] = await db.select().from(schema.users).where(eq(schema.users.email, PERSONAS.coach.email));
    const dash = await earnings.contributorDashboard(coach.id);
    expect(dash.learnersReached).toBe(8);
    expect(dash.statements[0].status).toBe("illustrative");
    expect(dash.earningsPolicy?.version.startsWith("demo") ?? false).toBe(false); // the sample policy is only ever a draft

    // A real (non-demo) policy sees none of the sample lessons or receipts.
    const [admin] = await db.select().from(schema.users).where(eq(schema.users.email, PERSONAS.admin.email));
    const { template } = await earnings.listPolicies(admin.id);
    const real = await earnings.saveDraftPolicy(admin.id, { ...template, version: `real-${Date.now() % 100000}`, contributorPoolBp: 4000 });
    const run = await earnings.runAllocation(admin.id, { policyId: real.id, periodStart: new Date(Date.now() - 86_400_000).toISOString(), periodEnd: new Date(Date.now() + 86_400_000).toISOString() });
    expect(run.run.inputs.eligibleNetMinor).toBe(800_000); // only the earlier test's real receipt; the three sample receipts are not counted
    expect(run.run.contributors.every((c) => c.contributorId !== coach.id)).toBe(true);

    expect(await retireDemo()).toBeGreaterThan(0);
    expect((await lessons.listPublishedLessons()).some((l) => report.lessons.some((x) => x.title === l.title && x.status === "published"))).toBe(false);
  }, 120_000);
});

describe.skipIf(!enabled)("accounts with passwords", () => {
  it("lets an admin create a role account, signs it in, locks after repeated guesses, and cuts off a reset or suspended account", async () => {
    const admin = await import("@/server/auth/user-admin-service");
    const auth = await import("@/server/auth/password-service");
    const shared = await import("./shared");
    const schema = await import("@/server/db/schema");
    const db = await shared.database();

    const adminId = randomUUID();
    await db.insert(schema.users).values({ id: adminId, email: `boss-${adminId.slice(0, 6)}@example.test`, displayName: "Boss" });
    await db.insert(schema.userRoles).values({ userId: adminId, role: "admin" });
    const nobody = randomUUID();
    await db.insert(schema.users).values({ id: nobody, email: `nobody-${nobody.slice(0, 6)}@example.test`, displayName: "Nobody" });
    await expect(admin.createUser(nobody, { email: "x@example.test", name: "X", roles: [] })).rejects.toThrow(/Only an admin/);

    const email = `test.coach-${adminId.slice(0, 6)}@example.test`;
    const created = await admin.createUser(adminId, { email, name: "Test Coach", roles: ["contributor"] });
    expect(created.roles).toEqual(expect.arrayContaining(["learner", "contributor"]));
    expect(created.password).toMatch(/^[A-Za-z2-9]{4}(-[A-Za-z2-9]{4}){3}$/);
    await expect(admin.createUser(adminId, { email, name: "Again", roles: [] })).rejects.toThrow(/already exists/);
    await expect(admin.createUser(adminId, { email: `weak-${adminId.slice(0, 6)}@example.test`, name: "Weak", roles: [], password: "short" })).rejects.toThrow(/at least 12/);

    // Only a hash is stored.
    const [credential] = await db.select().from(schema.userCredentials).where(eq(schema.userCredentials.userId, created.id));
    expect(credential.passwordHash).not.toContain(created.password);

    const ok = await auth.signInWithPassword({ email: email.toUpperCase(), password: created.password, ip: "10.0.0.1" });
    expect(ok.ok).toBe(true);
    expect((await auth.signInWithPassword({ email: "ghost@example.test", password: "whatever-whatever", ip: "10.0.0.2" })).ok).toBe(false);

    for (let i = 0; i < 4; i += 1) expect(await auth.signInWithPassword({ email, password: "wrong-password-1", ip: "10.0.0.3" })).toEqual({ ok: false, reason: "invalid" });
    expect(await auth.signInWithPassword({ email, password: "wrong-password-1", ip: "10.0.0.3" })).toEqual({ ok: false, reason: "locked" });
    // Locked even for the right password, until the lock passes.
    expect(await auth.signInWithPassword({ email, password: created.password, ip: "10.0.0.4" })).toEqual({ ok: false, reason: "locked" });

    // A reset unlocks the account and ends old sessions.
    const reset = await admin.resetPassword(adminId, created.id);
    expect(reset.password).not.toBe(created.password);
    const [session] = await db.select().from(schema.userSessions).where(eq(schema.userSessions.userId, created.id));
    expect(session.revokedAt).not.toBeNull();
    expect((await auth.signInWithPassword({ email, password: created.password, ip: "10.0.0.5" })).ok).toBe(false);
    expect((await auth.signInWithPassword({ email, password: reset.password, ip: "10.0.0.5" })).ok).toBe(true);

    await admin.setUserStatus(adminId, created.id, "suspended");
    expect((await auth.signInWithPassword({ email, password: reset.password, ip: "10.0.0.6" })).ok).toBe(false);
    await expect(admin.setUserStatus(adminId, adminId, "suspended")).rejects.toThrow(/own account/);
    await expect(admin.setUserRoles(adminId, adminId, ["contributor"])).rejects.toThrow(/own admin role/);
    expect(await admin.setUserRoles(adminId, created.id, ["editor"])).toEqual(expect.arrayContaining(["learner", "editor"]));
  });

});
