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

## Conversational diagnostics

- Ask one decision at a time and explain why it matters.
- Use click-through choices before optional free text and progressively disclose relevant branches.
- Cover the whole capability system through structured branches, not one long generic questionnaire.
- Capture strengths as well as friction, and keep the shortest credible route short.
- Reflect important answers in later prompts.
- End with what was heard, what it may mean, what remains uncertain and what happens next.

Before shipping, verify the result is MECE, evidence-aware, comprehensive but progressive, plain-language, decision-useful and connected to the Skill Graph.
