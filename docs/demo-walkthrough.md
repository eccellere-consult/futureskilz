# FutureSkilz demo walkthrough

Four sample people, each with one finished example, built by the real product (not mock-ups).

## Switching the demo on
1. In hPanel add the environment variable `DEMO_ACCESS_CODE` with a long random phrase (12+ characters) and restart. Without it `/demo` does nothing.
2. Open `/demo`, enter the code, press **Set up the demo** (about a minute on Hostinger).
3. Press **Enter as** a person. Sign-in is by the code only; the addresses end in `.test`, so no real mailbox can receive a link for them.
4. When finished: **Retire the demo** (sample lessons disappear from `/lessons`), then remove `DEMO_ACCESS_CODE`.

| Person | Address | Role |
|---|---|---|
| Meera Iyer (learner) | demo.learner@demo.futureskilz.test | none |
| Asha Rao (coach) | demo.coach@demo.futureskilz.test | contributor |
| Edith Nair (editor) | demo.editor@demo.futureskilz.test | editor |
| Adam Khan (admin) | demo.admin@demo.futureskilz.test | admin |

Sample earnings use a draft policy named `demo-2026.1`, so statements are illustrative. Real policies never count demo lessons or receipts.

## Learner: Meera
- `/learn` the members area: Skills, Training kits, Coach lessons.
- `/journey` saved profile, skills check, two completed Skill Shots.
- `/problem-solving` the Problem Solving training kit with her case "Late changes to the frozen weekly plan"; open **5W2H** to start it, or the worked example.
- `/lessons` learning paths from the coach's lessons; open one, step through scenes, do the check, rate it.

## Coach: Asha
- `/contribute/dashboard` 14 lessons credited, live ones with learners, completions, time, materials and usefulness; one lesson waits for her approval (open it, press **Approve this lesson**).
- `/contribute` the finished interview "DEMO: My career in production planning" → **Review**: every statement with its source quote, a corrected statement, a measure with its definition, an anonymised story, the approved skill.md, follow-up questions and source map, and the transcript (two sessions).
- Start a new interview to see the live conversation.

## Editor: Edith
- `/contribute/editor` the approved interview, the lesson queue (published, with an editor, waiting for the coach).
- Open a lesson: preview, checks, edit wording, credits. Move one through submit, approve, publish.

## Admin: Adam
- `/contribute/admin` the draft demo policy, receipts and an illustrative allocation run.
- Press **Approve this version** then **Calculate**: statements become payable drafts; finalise one. The coach's dashboard then shows the statement with how it was calculated.
- Open a lesson and change who is credited (60/40 co-author is set up on the first lesson).
