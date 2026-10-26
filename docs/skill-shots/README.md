# Skill Shots

`skill.md` is the FutureSkilz Skill Shot instructional design skill (v1.0.0). It governs how a Skill Shot is designed: one capability in
about 5 to 10 minutes, taught by Arya, with a real case, a method, a decision for the learner, a task for work and a source for every claim.

## Sample

`root-cause-five-whys/` is the first Skill Shot built to the skill: "Find the cause, not just the symptom". It holds the seven documents
the skill asks for (blueprint, narration script, scene plan, knowledge check, source map, review checklist, learning path entry).

- The source of truth is `src/features/skillshot/samples/root-cause.ts`. The player, the documents and the quality checks are all made from it.
- Learners see it at `/skill-shots/root-cause-five-whys` (and under Training material).
- After changing the blueprint, rewrite the documents: `UPDATE_DOCS=1 npx vitest run src/features/skillshot`. A test fails if they drift.
- It is a **draft**. The case is illustrative and says so on screen. The automatic checks (`rubric.ts`) pass, but a person must still review
  teaching quality, accuracy, accessibility in practice and timing before it is approved.

## Not built yet
- Evidence: answers are kept on the learner's device only; recording them as evidence on the account comes next.
- Rendered video: this is an interactive lesson with Arya's live avatar and voice, not a recorded video.
- Editor review and approval flow for designed Skill Shots (today only coach lessons go through the editor desk).
