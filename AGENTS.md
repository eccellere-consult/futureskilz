<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# FutureSkilz product standard

Apply these rules to every product workflow, diagnostic, recommendation, Skill Shot and explanation.

## Consulting structure

- Start with the learner decision or outcome the workflow supports.
- Structure diagnosis MECE: context, aspiration, capability and constraints. Partition capability into human, human-to-human, self, AI, digital, functional and domain intelligence without duplicate questions or material gaps.
- Treat role titles and self-ratings as hypotheses. Prefer recent situations, observable behaviour, outcomes and work evidence.
- Drill down only when an answer changes diagnosis, target proficiency, prioritisation or the recommended path.
- Prioritise using goal relevance, proficiency gap, urgency, prerequisite value, evidence confidence and available time.
- Present recommendations answer-first: conclusion, evidence, implication and next action.
- Label measured evidence, self-report, inference and assumptions distinctly. Never imply validated psychometric precision where none exists.
- Connect each priority to a graph skill, target behaviour, intervention, practice and evidence signal.

## Feynman learning

- Explain in plain language before using specialist terminology.
- Give one concrete workplace example and one non-example.
- Ask the learner to explain or apply the idea in their own context.
- Use vague points in their explanation to choose the next question or practice.
- End with a teach-back, observable action or decision that demonstrates understanding.
- Prefer short sentences, specific verbs and familiar words; define necessary technical terms on first use.

## Lesson standard (every Skill Shot)

The same sentences are in `src/features/skillshot/lesson-standard.ts`, which the design agent is given. A test keeps the two in step: change both together.

- Start from a real workplace need and say why it matters to the learner now.
- State one observable outcome: what the learner will be able to do after the lesson.
- Connect the idea to what a working adult already knows before adding anything new.
- Explain in plain words first, with one analogy, and only then give the proper term (Feynman).
- Show one concrete workplace example and one non-example.
- Demonstrate the method step by step on a case before asking the learner to use it.
- Give the learner one decision to make on a new, related problem, with feedback on every option.
- Ask the learner to explain or apply the idea in their own work (teach-back).
- End with two to four takeaways, one task to do at work this week, and what to learn next.
- Teach one capability per lesson, in short sentences, with no flattery and respect for the learner's experience.

## Content made from uploaded material

- Read everything that was attached (PDF, Word, text, spreadsheets) and build from all of it.
- Follow the material's own structure: one Skill Shot per chapter or section, in the same order and under the same name. A long section becomes two or three smaller Skill Shots; a thin one joins its neighbour. Cut by size only when the material has no headings.
- If the material is already learning material, keep its lessons, terms, steps, examples and exercises; add the lesson standard around them, not instead of them.
- Teach directly. The narration and the slide never mention the document, the material, the reference, the file or what was shared. Where the content came from is recorded in the sources and the attribution only.
- Use only facts that are in the material; where it is thin, teach less rather than invent.

## Conversational diagnostics

- Ask one decision at a time and explain why it matters.
- Use click-through choices before optional free text and progressively disclose relevant branches.
- Cover the whole capability system through structured branches, not one long generic questionnaire.
- Capture strengths as well as friction, and keep the shortest credible route short.
- Reflect important answers in later prompts.
- End with what was heard, what it may mean, what remains uncertain and what happens next.

Before shipping, verify the result is MECE, evidence-aware, comprehensive but progressive, plain-language, decision-useful and connected to the Skill Graph.
