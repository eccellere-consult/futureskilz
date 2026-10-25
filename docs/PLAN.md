# Where we are and what to build next

Measured against `docs/context/FutureSkilz_Master_Build_Skill.md` (releases, 10-phase sequence, Definition of Done) and the v2.1 Blueprint. Percentages are judgement, not measurement: they count the capabilities each release lists and how complete the working version is. Updated 25 Oct 2026.

## 1. Answer first

About **35% of the Master Build scope is done**, unevenly. The two engines that are hardest to retrofit are in place: the **learner core** (sign-in, discovery, assessment, skill profile, starter journey, Skill Shot player with evidence) and the **contributor core** (adaptive interview, source-traced knowledge, review and approval, lessons, usage and attribution, an earnings ledger). What is missing is the **connection between them** and everything that sits on top of it: the two flywheels do not yet turn.

- A coach's approved lessons do not enter a learner's journey, because lessons are not mapped to the Skill Graph and the journey engine does not recommend them.
- There is no target role, so there is no real gap analysis; the journey is two rule-picked Skill Shots.
- There is no AI Coach, Skill Passport, marketplace discovery, reputation, payments, WhatsApp channel or enterprise portal.

**Recommended next pick: connect the flywheels** (section 4, step 1), then the AI Coach, then marketplace discovery. Payments and WhatsApp need business decisions and third-party approvals that take weeks, so start those approvals now in parallel.

## 2. Status by release

| Release (Master Build) | Done | Partial | Not started | Approx. |
|---|---|---|---|---|
| **1 Core** (auth, onboarding, goal, baseline, profile, gaps, journey, Skill Shot player, practice, coach, micro-assessment, progress, passport, seed graph) | Auth, onboarding, Skill Shot player, practice, evidence | Goal (no target role), baseline (static 5-question rating, not adaptive), profile, gaps (pillar-level), journey (2 shots), micro-assessment (one check-in), progress, seed graph (50 skills, 6 families, 5 Skill Shots) | AI Coach, Skill Passport | **~45%** |
| **2 Content Factory** (studio, voice, uploads, interview, extraction, skill mapping, Skill Shot generation, presentation, narration, practice generation, QA, provenance, review) | Studio, voice (browser), adaptive interview, knowledge extraction, provenance, review workflow | Uploads (PDF, Word, text, CSV, Excel; no PowerPoint, images, audio, video), lesson generation (rules-based, not the full Skill Shot standard), presentation (HTML scenes), narration (device voice), QA (mechanical checks) | Skill mapping to the graph, practice/assessment generation, AI video and voice agents | **~60%** |
| **3 Marketplace** | Usefulness ratings | Browse (lesson paths), contributor dashboard | Listings, search, recommendations, public contributor profiles, quality score | **~15%** |
| **4 Creator Economy** | Usage events, ledger, versioned policy, statements, disputes, attribution | Fraud controls (daily caps, dedupe only), payouts (statuses, no payment provider), finance admin (receipts, runs) | Reputation, Qualified Value Score, fraud flags and review, payout provider | **~40%** |
| **5 Enterprise** | | `organizations` table | Dashboard, heatmap, critical gaps, role readiness, manager view | **~0%** |

By build phase: 1 Foundation ~80%, 2 Intelligence core ~55%, 3 Learner core ~45%, 4 Learning experience ~35%, 5 Content factory ~55%, 6 Marketplace ~15%, 7 Creator economy ~35%, 8 Enterprise 0%, 9 Marketing and administration ~10%, 10 QA partial (unit and integration tests; no formal accessibility or load testing).

## 3. Definition of Done check

| Persona | Met | Not yet |
|---|---|---|
| Learner (16) | Sign up, onboarding, goal, baseline, profile, gaps, start a Skill Shot, practice, evidence, progression | Real personalised journey, AI Coach, assessment beyond one check-in, continue-journey adaptation, Skill Passport, explore a target role (about 10 of 16) |
| Contributor (10) | Profile, upload or record, AI interview, review extracted knowledge, review assets, submit, publish, view performance, view earnings | Reputation (about 8 of 10) |
| Administrator (8) | Review content, configure reward rules, audit table | Manage contributors, manage taxonomy, fraud flags, payouts, campaigns, governance screens (about 3 of 8) |
| Enterprise (5) | | All |

## 4. Recommended order

Each step ends with something a person can use, and each makes the next cheaper.

**Step 1: connect the flywheels** (about 2-3 weeks). Highest leverage.
- Seed 12-15 roles with required skills and levels (Master doc section 32) and 20+ Skill Shots on its priority list, as data, deterministic.
- **Skill mapping**: map each approved fact and lesson to graph skills and levels (rules first, AI-assisted, contributor confirms). Closes the biggest Release 2 gap.
- **Target role, gap engine, journey engine**: goal to target profile to prioritised gaps (gap size, criticality, prerequisites, time, deadline) to a sequenced journey that mixes seed Skill Shots and coach lessons.
- Upgrade generated lessons to the full **Skill Shot standard** (why, concept, example, mistake, practice, AI interaction, mastery criteria, evidence), keeping provenance and attribution.
- Done when: a learner picks "AI Product Manager", sees gaps, gets a journey that includes a coach's lesson, completes it, and the coach's dashboard shows it.

**Step 2: AI Coach and adaptive assessment** (about 2 weeks). The conversational layer both documents centre on (Arya).
- A coach inside the Skill Shot player (hints, feedback on practice, evidence) and a conversational, adaptive baseline replacing the static 5-question rating. Provider abstraction and deterministic fallback already exist; the agent registry and run recording exist.
- Validate scoring against human ratings (the Blueprint asks for +-15 points on 20 samples).

**Step 3: Skill Passport and progress** (about 1 week). Evidence-backed, honest about confidence; shareable.

**Step 4: marketplace discovery** (about 2-3 weeks). Listings, search, browse by skill, role and industry, recommendations from gaps, public contributor profiles, quality score, governance modes A/B/C by risk.

**Step 5: reputation, Qualified Value Score, fraud flags** (about 2 weeks). Add QVS as a second, configurable formula beside the current weighted pool; add fraud flags and a review queue. Needs a business decision on which formula governs.

**Step 6: payments and subscriptions** (about 3 weeks plus approvals). Razorpay (UPI, cards, EMI, GST invoicing), free-tier gating (first two Skill Shots per pillar free), real receipts feeding the ledger, payout provider.

**Step 7: WhatsApp channel** (about 3 weeks plus Meta approval). Daily Skill Shot, check-ins, assessment over WhatsApp, STOP handling, consent. Reuses the notification outbox and consent tables.

**Step 8: enterprise portal** (about 4 weeks). Tenant model, heatmap, critical gaps, role readiness, manager view.

**Later**: video and voice generation agents (HeyGen, Gemini, Veo, Descript toolchain in the Blueprint), Hindi and other languages, SSO and HRIS, native mobile.

## 5. Start now in parallel (business tracks, lead time is weeks)

- Meta WhatsApp Business verification and template approval.
- Razorpay account and KYC; decide GST invoicing approach.
- Legal and tax review of the revenue-share terms, then an approved policy.
- Decide the 60-Skill-Shot content plan and video toolchain budget (Blueprint part 10 and 12).
- Choose a durable object store for original uploads (not retained today).

## 6. Decisions needed from the owner

1. **Which document governs where they differ** (see `docs/context/README.md`). Proposed: Master Build for product and data; Blueprint for channels, payments, content production.
2. **Skills model**: the 7 intelligence families, the 5 THINK/CREATE/LEAD/ADAPT/AI+TECH pillars, or a mapping between them. Proposed: the families are the Skill Graph; pillars become a learner-friendly view over it.
3. **Skill Shot format**: 3-minute video or about 10-minute multi-format. Proposed: one object with a format and a duration; HTML and voice now, video as a later renderer.
4. **Database**: Hostinger has MariaDB only. The Master doc wants PostgreSQL with pgvector. Proposed: stay on MariaDB, store embeddings as JSON and rank in the app at current scale, revisit at a VPS move.
5. **Creator pay formula**: current weighted pool versus the Qualified Value Score, and who approves it.
6. **First market and language**: India and English first (Blueprint) with Hindi when?

## 7. Technical debt and risks to track

- Original upload files are not retained; only text, location and checksum.
- Fraud controls are limited to caps and dedupe; no review queue.
- No formal accessibility audit, no load testing, no AI scoring validation yet.
- The Problem Solving kit is a copy of an engine used elsewhere and will be copied again for the Eccellere sites; keep it self-contained.
- Hostinger: one Node slot, no staging, no shell. Every schema change must stay additive, and the quality gate is the only pre-production check.
