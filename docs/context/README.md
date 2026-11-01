# FutureSkilz solution context

Read this first. It says what the context documents are, how they relate, and where they disagree, so a new session does not need to ingest 3,400 lines.

## The documents

| File | What it is | Use it for |
|---|---|---|
| `FutureSkilz_Master_Build_Skill.md` | Master Build Specification v1.0. The AI-native capability operating system: learner flywheel, contributor-to-marketplace flywheel, skills taxonomy (7 intelligence families), roles, Skill Graph, Skill Shot standard, adaptive assessment, journey engine, content factory and 17 agents, governance modes A/B/C, marketplace, reputation, Qualified Value Score, fraud, payments, enterprise, Skill Passport, data model (~60 entities), architecture, 5 releases, a 10-phase build sequence and a Definition of Done. | Product scope, design standards, data model, release order, acceptance. |
| `FutureSkilz_Technical_Blueprint_v2.1_Consolidated.docx` (+ `.md` text copy) | Technical Blueprint v2.1 (Eccellere, Aug 2026). India go-to-market: WhatsApp-first learning with the "Arya" companion, conversational 5-pillar assessment, 3-minute Skill Shot videos, WordPress/TutorLMS/WooCommerce/Razorpay + Node agent service + Groq/OpenAI + Redis + Bunny.net stack, 12-sprint plan with revenue gates, content production plan (60 Skill Shots), and the AI video toolchain (HeyGen, Gemini, NotebookLM, Veo, Descript). | Channels (WhatsApp), pricing and payments, content production, India context, costs. |
| `docs/skill-shots/skill.md` | Skill Shot Instructional Design Skill v1.0.0: how a Skill Shot is designed (5 to 10 minutes, teaching patterns, blueprint, quality rubric, source integrity). The sample built to it is in `docs/skill-shots/root-cause-five-whys/`. | Designing or reviewing any Skill Shot or lesson. |
| `FutureSkilz_Consolidated_Skill_v1.3.md` | Consolidated Skill v1.3 (31 Oct 2026). The planning session's output in one place: locked decisions, engineering rules, six-axis Skill Graph, nine-stage Content Factory, SME pipeline, marketplace, a tick-list (section 18). Supplements the two documents above. | Skill Graph axes, content intake, release gates. Compared with the build in `docs/v1.3-gap-analysis.md`. |
| Earlier specs (first session) | Content Platform Specification and Expert Knowledge-to-Learning skill: contributor interview, knowledge package, `skill.md`, lessons, attribution and earnings. | Already built (see `docs/PLAN.md`). |

## Where the two main documents disagree (decide before building the affected part)

| Topic | Master Build Skill | Blueprint v2.1 | What the code does today |
|---|---|---|---|
| Stack | Next.js, TypeScript, PostgreSQL + pgvector, modular monolith | WordPress + TutorLMS + WooCommerce + Node agent service + MySQL + Redis | Next.js 16 on Hostinger Node with MariaDB (no PostgreSQL on this plan) |
| Skills model | 7 intelligence families, Skill Graph with levels | 5 pillars: THINK, CREATE, LEAD, ADAPT, AI+TECH | 6 families / 50 skills in the taxonomy; a separate 5-pillar baseline assessment |
| Skill Shot | About 10 minutes; format chosen by agent (voice-over, interactive, case, simulation, video) | 2–5 minute micro-video, mobile first | HTML scenes with captions and optional device voice; about 1–2 minutes |
| Primary channel | Web app | WhatsApp | Web only (consent and outbox tables exist; no WhatsApp sender) |
| Payments | Provider abstraction | Razorpay (UPI, cards, EMI), GST invoices | None |
| Creator pay | Qualified Value Score (usage x depth x usefulness x quality x outcome x freshness x trust) | Not specified | Configurable weighted pool allocation (consumption, completion, material use, usefulness) |

v1.3 resolves some of these (web-primary with WhatsApp as a notification channel; five pillars public over a Skill Graph; video-only Skill Shots). Where v1.3 disagrees with what is built, `docs/v1.3-gap-analysis.md` section 5 lists the decision and a recommendation.

Working assumption until the owner decides: the Master Build Skill governs product scope and data model; the Blueprint governs channels, go-to-market, payments and content production. The stack stays Next.js on Hostinger.

## Core ideas to keep in mind

- Flywheel 1 (learner): Goal, Assess, Diagnose, Skill Graph, Gap, Personalised Journey, Skill Shot, Practice, Evidence, Mastery, Next capability.
- Flywheel 2 (contributor): Expert experience, AI capture, structure, skill mapping, asset generation, curation, marketplace, personalised discovery, outcomes, quality signals, creator rewards.
- North Star: percentage of target skills demonstrably achieved within the learner's timeframe. Completion is not mastery.
- Standards in `AGENTS.md` (consulting structure, Feynman learning, conversational diagnostics) apply to every learner-facing workflow.
- Never expose keys in client code; deterministic fallbacks wherever an external service is missing.
