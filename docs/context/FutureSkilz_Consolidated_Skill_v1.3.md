# FutureSkilz — Consolidated Skill File (Planning Session Output)
## Everything specified in the planning/design/taxonomy session, in one place, with a verification checklist

**Version:** 1.3 (consolidates Master Execution Plan v2.0 + Skill Graph/Content Factory/Marketplace addendum v1.2 + O*NET/APQC trial pass + prototype)
**Date:** 2026-10-31
**Purpose:** Let the build session verify that every capability, decision and rule discussed in the planning session is present in the actual build. Section 18 is a tick-list. This file **supplements** `FutureSkilz_Master_Build_Skill.md` (v1.0), `docs/FutureSkilz_Architecture_and_Execution_Plan.md` and `app/AGENTS.md`; where they conflict, see Section 17 (open inconsistencies) — do not silently pick one.

---

## 1. Product definition and locked decisions

**Product:** FutureSkilz — AI-native capability platform ("Learning Reimagined. Skills for the AI Age."). India-first, built for professionals, graduates and MSMEs.

**Core questions every workflow must improve:** Where am I? Where do I need to go? What is the shortest credible path?

**North Star:** % of learners demonstrably achieving target skills within their declared timeframe. Supporting: time-to-proficiency, Skill Shots completed per learner (8+ in month 1), assessment-to-first-Skill-Shot < 5 min, 4-week retention > 40%, WhatsApp opt-in > 60% of web signups, pillar-score vs self-report correlation r > 0.7.

**Locked decisions**
1. Greenfield **Next.js** app on Hostinger-managed MariaDB. WordPress/LearnPress is retired as system of record (kept only until cutover).
2. **Web-primary (PWA), WhatsApp = notification and re-entry channel** (templates + signed magic-link deep links), not a conversational channel in Release 1.
3. **Learner loop first** (Release 1). Marketplace and creator economy are Release 3+.
4. **5 pillars are the public vocabulary; the Skill Graph is the internal model.**
5. Skill Shot = 2–5 min, format-flexible schema, video-only at launch.
6. Single instructor (Vikram Rao) at launch; AI is an authoring accelerator, not a public multi-contributor marketplace on day one.
7. Proficiency scale stored once as 0–5; 0–100 pillar scores are a display projection only.

**Learner loop:** Goal → Assess → Diagnose → Skill Graph → Gap → Personalized Journey → Skill Shot → Practice → Evidence → Mastery → Next.
**Supply loop (R2–R4):** Expertise → AI Capture → Structure → Skill Mapping → Asset Generation → Curation → Marketplace → Discovery → Outcomes → Quality Signals → Creator Rewards.

**Pillars:** THINK, CREATE, LEAD, ADAPT, AI+TECH.
**Journey stages (7):** New Graduate, First-Time Manager, Mid-Career Accelerator, MSME Founder/Owner, MSME Team Member, Corporate Manager, Career Returner.
**Proficiency scale:** 0 Unaware · 1 Aware · 2 Developing · 3 Proficient · 4 Advanced · 5 Expert.

---

## 2. Principles and non-negotiable rules

**Product principles:** capability over consumption; demonstrated proficiency over completion; personalization; application over passive learning; continuous evolution; time-to-proficiency over hours; goals/skills drive discovery; AI orchestrates, humans approve where needed; reward value not clicks (R3+); marketplace content curated, not dumped.

**Engineering rules (all must hold)**
1. Modular monolith, one deploy, module boundaries enforced by folders + import lint rules.
2. Every external provider (LLM, voice, video, payments, auth, email, WhatsApp) behind an interface with a **deterministic offline fallback** — no credential = degraded, never broken.
3. No API key ever reaches the client; all LLM calls server-side.
4. Every AI-produced number labelled as estimate with confidence; never presented as validated psychometrics.
5. Every generated asset carries provenance (source asset, contributor, agent run ids, model, prompt version).
6. Migrations backward-compatible (expand → migrate → contract); no privileged SQL (SUPER/GRANT/DEFINER/procedures/triggers).
7. Long-lived sessions (60–90 days), silent renewal; re-auth only for account/payment actions.
8. Magic links: single-use, short TTL, bound to user + target resource, rotated secret, never logged, never in redirect chains.
9. Observability from day 1: `agent_runs`, `agent_decisions`, conversation turn logging.
10. No silent truncation: if coverage is bounded (top-N, sampling), log what was dropped.
11. Hostinger constraints: no incoming WebSockets (use HTTP streaming/polling for Arya); MariaDB only (no pgvector).

**Human gates that are permanent (not Release-1 limitations)**
- Curator sign-off before any Skill Shot publishes (Content Factory Stage 8).
- Human approval before any new skill-graph node/taxonomy mutation goes live.
- Curator approval before any outreach to a real SME is sent.
- Explicit, timestamped recording consent separate from registry consent.
- SME sign-off before content attributed to them publishes.
- Synthetic (AI-generated) media always visibly badged; voice cloning only with explicit consent, never default-on.

**Consulting/learning standards (from `app/AGENTS.md`, must be applied to every diagnostic/recommendation):** start with the decision; MECE diagnosis (context, aspiration, capability, constraints; capability split human / human-to-human / self / AI / digital / functional / domain); treat self-ratings as hypotheses; drill down only when the answer changes the path; prioritise by goal relevance, gap, urgency, prerequisite value, evidence confidence, time; answer-first recommendations; label measured vs self-report vs inference vs assumption; connect every priority to skill → behaviour → intervention → practice → evidence. Feynman: plain language first, one example and one non-example, learner teach-back. Conversational diagnostics: one decision at a time, click-through before free text, reflect earlier answers, end with heard / means / uncertain / next.

---

## 3. Learner-facing capabilities

| ID | Capability |
|---|---|
| L1 | Home with embedded Arya chat in hero (no redirect), 5 pillar tiles each showing a concrete work situation + "3-min video" link, how-it-works, impact counters, testimonials, FAQ, WhatsApp CTA with QR |
| L2 | "I'm a…" journey-first navigation (Graduate / Manager / MSME / Corporate / Returner) routing to personalised landing pages; Courses renamed Skill Shots |
| L3 | Conversational assessment: Arya, one question at a time, context phase then one probing question per pillar, 5–8 min; LLM scoring against a behavioural rubric (80–100 strength, 60–79 developing, 40–59 emerging, 0–39 priority); report token; radar chart; email report; lead capture |
| L4 | Assessment result states what was heard, what it may mean, what is uncertain, what happens next; confidence shown |
| L5 | Goal setting (situation + target skill + timeframe) and recommendation preview |
| L6 | Journey engine: declared journey stage + pillar gaps → ranked next Skill Shots (lowest pillar × journey relevance × not recently watched, top 3), re-routing on new context |
| L7 | **My Journey** page: Arya panel + journey timeline + Today's Recommendation (with reason) + filterable Skill Shot library (pillar, situation, duration; watched greyed) + upcoming live sessions + certificates + streak/momentum |
| L8 | Skill Shot player: Bunny.net stream, adaptive bitrate, 360p floor, data-saver, audio-only fallback, subtitles (SRT mandatory), metadata, 1-question check-in (MCQ/rating), Arya feedback comment, Up Next |
| L9 | Skill Shot catalogue: situation search (tag search P1, vector P2), browse by pillar, by journey stage; first 2 per pillar free, subscription unlocks all |
| L10 | Streaks, momentum messaging, milestones as a story (not a progress bar) |
| L11 | Practice, evidence capture, mastery update (`skill_evidence`), re-serving weak areas, escalation to cohort |
| L12 | Cohorts: detail page, enrol + pay (Razorpay UPI/card/EMI, GST invoice), Zoom sessions, assignments, discussion, Arya weekly nudges, completion certificate with LinkedIn share |
| L13 | Subscription ("Explorer"): free trial, renewal, unlock gating, profile status |
| L14 | MSME hub (MSME-specific journey/assessment/Skill Shots), corporate/B2B enquiry form → CRM |
| L15 | Blog/SEO engine (5 articles, sitemap, schema, GA4), Hindi prep (~20% library later) |
| L16 | PWA: manifest, service worker, install prompt after first completed Skill Shot, web push |
| L17 | Notification outbox (web push, email via Brevo, WhatsApp templates), consent + opt-out ledger, STOP honoured within one message |
| L18 | Minimal WhatsApp inbound handler: acknowledge, reply with deep link, honour STOP (3-branch router, not NLU) |
| L19 | Profile/account: preferences, notification settings, WhatsApp opt-in/out |

**Arya (orchestrator face):** one persona across web chat, WhatsApp templates, email digests; asks one question at a time; grounds in learner's situation; always ends with a concrete action; max 3 recommendations; warm plain English with light Hindi; no medical/financial advice; tool calls: `get_user_score`, `get_next_skillshot`, `get_journey_stage`, `recommend_cohort`, `get_article`; prompts in versioned files. Primary LLM Groq llama-3.3-70b, fallback OpenAI GPT-4o-mini on 429 (provider-neutral interface; repo currently targets provider-neutral AI). Conversation memory 24h TTL (Redis/Upstash or DB equivalent given Hostinger).

**WhatsApp templates:** welcome, daily Skill Shot, score result, cohort invite, check-in question, cohort reminder (+ certificate). Daily nudge 8:00 IST weekdays.

---

## 4. Agentic layer

Agents are typed functions with registry entry: inputs, outputs, tools, cost ceiling, confidence threshold, escalation policy, approval-required flag. Orchestrator flow: request → intent → context retrieval → agent selection → tools/graph/model → execution → policy check → [human approval?] → state/evidence update → response. Channel adapter layer (orchestrator never knows the channel).

- **Learner agents:** Goal, Assessment, Skill, Gap, Journey, Coach, Practice, Simulation, Evaluation, Mastery, Career.
- **Content Factory agents:** Intake, Transcription, Document Intelligence, Experience Interview, Knowledge Extraction, Skill Mapping, Instructional Design, Storyline/Script, Presentation, Design (Eccellere), Narration, Voice, Video, QA, Trust & Safety, Provenance, Publishing, **Minutes (new)**.
- **SME agents (new):** Registry, Topic Suggestion (gap matching), Scheduling, Interview Planning.
- **Marketplace agents:** Discovery, Recommendation, Curation, Quality, Reputation, Reward, Fraud, Marketing, Campaign, Payment, Governance.

---

## 5. Design system and UX

**Palette (Eccellere, authoritative):** ink `#0E0E0D`, gold `#B8913A`, gold-light `#D4AE6A`, white `#FFFFFF`, cream-50 `#FEFCF8`, cream-100 `#FAF6F0`, silver `#E8E4DB`, silver-dark `#9C9995`; semantic success `#6B8E23`, warning `#D4941E`, error `#8B4239`, info `#4A6FA5`; dark mode bg `#1A1A19`, card `#2A2A29`, text `#F5F5F5`. No purple/orange/LMS candy colours.

**Typography:** Lora (serif) for display/headings (48/32/24/20), Inter for body (16/14/12) and labels; mono for code. Max two typefaces.

**Spacing:** 8-pt grid (4,8,12,16,24,32,48,64). Breakpoints 320/576/768/1024/1440; max container 1200. Touch targets ≥ 48px. Mobile-first, not just responsive.

**Components:** buttons (primary gold / secondary / tertiary; default, hover, active, disabled, loading), inputs/textarea/select/checkbox/radio with validation states, cards (base/elevated/outlined), nav (top, breadcrumbs, underline tabs), pillar/status/level badges, modal/toast/tooltip, chat bubbles (learner gold right / Arya cream left, typing indicator), radar chart (gold polygon 30% fill, silver grid, India-average reference line), journey timeline, progress (linear, circular, streak), skeleton/shimmer/spinner.

**Motion:** fade 200ms, slide-up 300ms, button hover 150ms, accordion 300ms, success bounce 500ms; respect reduced-motion.

**Accessibility (WCAG 2.1 AA):** contrast ≥ 4.5:1, semantic landmarks, keyboard order, focus visible, alt text + text alternative for radar chart, labels linked to inputs, no autoplay, `lang` attributes. **Dark mode:** `prefers-color-scheme` + `data-theme` override.

**Information architecture:** Public (home, journey pages, Skill Shots library + detail, about, blog, sign in/up) · Learner (My Journey, player, goal, assessment, cohort, profile) · Creator (Content Studio; AI Content Factory UI) · Admin (learner mgmt, skill graph editor, pillar/level mgmt, rubric editor, WhatsApp templates, manual notifications, analytics, system health).

**Key flows:** (1) new learner onboarding in ~5 min (hero chat → assessment → radar → top 3 Skill Shots → first player → email report / WhatsApp opt-in); (2) daily loop (WhatsApp nudge → magic link → player → check-in → streak → weekly cohort invite → My Journey); (3) assessment → 5 Skill Shots in a pillar → cohort invite → Razorpay → cohort dashboard.

**Usability test plan:** 8–10 learners (graduates, first-time managers, MSME owners), SUS > 75, NPS > 40, task time < 3 min, iterate and retest with 3–4.

---

## 6. Prototype (clickable, published)

URL: `https://claude.ai/code/artifact/69b79c54-586a-4a12-826b-e88f1b41ce60` (source `futureskilz_prototype_v2.html`, inline `onclick` handlers — the first version using `addEventListener` froze in the artifact viewer).

Screens: Home + Arya chat + pillars → 5-question assessment → results with radar and scores → top-3 Skill Shots → player with check-in → My Journey dashboard (Arya panel, timeline, recommendation, library, cohort card) → checkout (UPI/Card/EMI, ₹4,999 incl. GST, example) → success.
**Contributor Studio mode** (header toggle): source select (PDF / Book excerpt / YouTube link / Live AI interview) → intake with rights-attestation gate → animated factory processing (gold ● = human gates) → draft review (5-beat script + skill-mapping chips Pillar/Function/Industry/Level/Journey + provenance note) → submitted with the four auto-routing outcomes.
**Known stale item:** the draft-review chips lack a **Seniority** chip (axis added after the prototype). The prototype is a UX-validation artifact, not production code.

---

## 7. The Skill Graph — six axes (MECE)

Each skill node is classified on six independent axes; every axis except Pillar and Level is optional and carries a catch-all bucket so nothing is unclassifiable.

| # | Axis | Question | Required |
|---|---|---|---|
| 1 | Pillar (+ optional secondary pillar) | What durable capability? | exactly one primary |
| 2 | Function | What job family? | optional, many |
| 3 | Industry | What sector? | optional, many |
| 4 | Level (0–5) | How well mastered? | required |
| 5 | Seniority | What org level is it pitched at? | optional, many |
| 6 | Journey Stage | What transition moment? | optional, many |

Level = mastery, Seniority = who it is for, Journey Stage = what transition they are in; these are deliberately independent (a CEO can be Level 1 on AI+TECH; an MSME founder occupies all seniority tiers at once).

**Scoring rule:** a skill contributes to exactly one pillar score (primary); the secondary pillar is for discovery/cross-recommendation only, never double-counted.

**Function axis (13):** General & Executive Management · Sales & Business Development · Marketing, Brand & Communications · Finance, Accounting & Investment · Human Resources & Talent · Operations & Supply Chain · Product & Strategy · Engineering & Technology (incl. Data/AI) · Customer Success & Support · Legal, Risk & Compliance · Design & Creative · Research & Development / Innovation · **Cross-Functional / General (catch-all)**. O*NET major-group anchors stored per function. Second view along strategy → execution: Strategic (General Mgmt, Product & Strategy, R&D) · Market-facing (Marketing, Sales, Design) · Enabling/Governance (Finance, HR, Legal/Risk) · Delivery/Execution (Engineering, Operations & Supply Chain, Customer Success).

**Industry axis (16, tiered):**
- *Tier 1 priority (seed and commission content first):* 1 Manufacturing & Industrial · 2 Retail · 3 Consumer Products (FMCG / D2C brands) · 4 Logistics & Supply Chain · 5 IT Services & GCCs · 6 Professional & Consulting Services (incl. Legal, Accounting).
- *Tier 2:* 7 Software Products & SaaS · 8 BFSI · 9 Healthcare & Life Sciences · 10 Education & EdTech · 11 MSME / General Business & Trade · 12 Government & Public Sector · 13 Media, Entertainment & Creative · 14 Real Estate & Construction (incl. Infrastructure) · 15 Agriculture & Allied · 16 **Cross-Industry / Universal (catch-all)**.
- Splits made on request: Retail vs Consumer Products (selling channel vs brand/manufacturer); IT Services & GCCs vs Software/SaaS (NASSCOM's own segmentation).
- High-relevance functions per Tier-1 industry (for content commissioning): Manufacturing → Ops & Supply Chain, Engineering, General Mgmt · Retail → Sales, Marketing, Ops, Customer Success · Consumer Products → Marketing, Sales (trade), Ops, R&D · Logistics → Ops & Supply Chain, Engineering, General Mgmt · IT Services → Engineering, Customer Success, HR & Talent, Sales/account mgmt · Professional Services → General Mgmt, Sales, HR, Legal/Risk.

**Seniority axis (6 + catch-all):** 1 Board / C-Suite (CEO, CFO, CTO, CHRO, CMO, COO, MD) · 2 Senior Leadership (VP, Director, BU Head) · 3 Senior Manager / Team Lead · 4 Manager (first-line people manager) · 5 Senior Individual Contributor / Specialist · 6 Entry-Level / Graduate / Associate · **Cross-Level / General (catch-all)**. Unlocks the Enterprise Skills Intelligence product (e.g. "VP-and-above AI+TECH bench strength across IT Services accounts" as a filter).

**APQC process tag (enrichment, not a 7th axis):** optional `apqc_process_ref` on `skill_function_map`, mainly for Operations & Supply Chain / Manufacturing skills (e.g. "4.3 Produce/Assemble/Test product (10217)"). APQC PCF Cross-Industry v7.4 is perpetual, royalty-free with attribution; Category 4.0 "Manage Supply Chain for Physical Products" = 4.1 Plan and align supply chain resources → 4.2 Procure → 4.3 Produce/Assemble/Test → 4.4 Manage logistics and warehousing. Industry-specific PCF extensions need a free APQC account (not obtained).

---

## 8. Framework grounding and audits

| Framework | Role in FutureSkilz | Licence |
|---|---|---|
| WEF Future of Jobs 2025 (Global Skills Taxonomy) | Validates the durable pillar axis | Proprietary — cite and align, never ingest |
| McKinsey 56 DELTAs (4 categories, 13 groups) | **Seed source for pillar-only skill nodes** | Proprietary — cite; the 56 names are used as seed concepts |
| O*NET 30.3 | Backbone for Function/Industry-specific nodes, job zones | Public domain / CC BY 4.0 |
| ESCO | Second occupation/skill source, O*NET crosswalk | CC BY 4.0 |
| LinkedIn Skills Graph | Patterns only: alias table, co-occurrence | Proprietary — do not import |
| NASSCOM FutureSkills Prime / NOS / NSQF | India credibility layer; tag NOS codes where matching | Government-backed |
| APQC PCF | Process reference tags | Open licence with attribution |
| Deloitte Human Capital Trends 2025 | Context only (skills-based organisation, enabling managers) | — |

**WEF crosswalk (all in-scope items mapped):** THINK ← analytical thinking, systems thinking, quality control · CREATE ← creative thinking, design & UX, marketing & media (CREATE × Marketing function) · LEAD ← leadership & social influence, talent management, teaching & mentoring, empathy & active listening, service orientation, resource management & operations (Ops function overlay) · ADAPT ← resilience/flexibility/agility, motivation & self-awareness, curiosity & lifelong learning, dependability & attention to detail, environmental stewardship (reviewable placement) · AI+TECH ← AI & big data, technological literacy, networks & cybersecurity, programming. **Explicit exclusions:** manual dexterity/physical skills, basic literacy (reading/writing/maths), global citizenship (WEF classes it as declining).

**McKinsey 56 audit result (11 + 2 + 16 + 16 + 11 = 56, zero residue):** THINK 11 · CREATE 2 (creativity & imagination, breaking orthodoxies) · LEAD 16 (14 interpersonal + active listening + storytelling/public speaking) · ADAPT 16 (adaptability, ability to learn + 14 self-leadership incl. integrity and driving change & innovation) · AI+TECH 11 (all digital).
**Dual-pillar seeds:** Storytelling & public speaking (LEAD + CREATE) · Driving change & innovation (ADAPT + CREATE) · Computational & algorithmic thinking (AI+TECH + THINK) · Tech translation & enablement (AI+TECH + LEAD).
**Priority flag:** Digital ethics — an early AI+TECH Skill Shot that mirrors FutureSkilz's own provenance/consent principles.

---

## 9. Skill-graph seeding pipeline (and the O*NET trial)

**Sequence:** 0) seed pillar-only nodes from the 56 DELTAs · 1) bulk-import O*NET for ~25–30 relevant occupations · 2) cross-reference ESCO · 3) AI-assisted mapping pass proposes pillar/industry/function tags — **human approves before anything goes live** · 4) tag NASSCOM NOS codes where direct · 5) result: several-hundred-node graph cross-walked to four standards.

**Script:** `onet_import.py` (reusable per industry; args `--industry --keywords --min-importance --data-dir --out-prefix`). Logic: select occupations by title-keyword (a heuristic, not a NAICS crosswalk); map SOC code → Function (fine overrides: 13-1070 HR, 13-1080 Ops, 27-1000 Design, 11-2021 Product, 11-3070 Ops); map Job Zone → Seniority (1–2 Entry, 3 Manager, 4 Senior Manager, 5 Senior Leadership — heuristic); O*NET "essential skills" → relevance weights on already-seeded McKinsey nodes (not new nodes); O*NET **Knowledge** areas → new industry-flavoured candidate nodes; APQC hints for confident matches; outputs seed SQL (commented, pending review) + curator review report. Default `--min-importance` is **2.8** (3.5 returned zero rows because averaging across mixed occupations dilutes toward the middle).

**Manufacturing & Industrial trial result (pending curator review — nothing approved):** 54 occupations; functions 29 Ops & Supply Chain / 6 General Mgmt / 6 Cross-Functional / 4 Customer Success / 3 Engineering / 3 R&D / 2 Sales / 1 Marketing; seniority 30 Entry / 10 Manager / 9 Senior Manager / 3 Cross-Level / 2 Senior Leadership; 6 relevance-weighted McKinsey nodes (Active Listening, Critical Thinking, Reading Comprehension, Monitoring, Speaking, Writing; weights 57–66); 7 new candidate nodes (Production and Processing, English Language, Mathematics, Mechanical, Administration and Management, Customer and Personal Service, Education and Training), 4 with confident APQC refs.
**Known gaps to resolve before scaling to the other five Tier-1 industries:** (a) Job Zone heuristic never yields Board/C-Suite or Senior IC tiers; (b) false positives from keyword selection (e.g. postal mail sorters, mining machine operators); (c) function mapping puts maintenance/repair roles in Cross-Functional; (d) O*NET `essential_skills.csv` surfaces only ~10 of 35 skills for this set.

---

## 10. AI Content Factory — nine stages (any source → routed Skill Shot)

One pipeline, pluggable intake adapters: PDF/paper, book excerpt, YouTube link, article link, raw video/audio, live expert interview.

| # | Stage | Agent(s) | Gate |
|---|---|---|---|
| 1 | Intake | Intake | contributor rights/consent attestation |
| 2 | Normalize | Transcription, Document Intelligence | — |
| 3 | Extract | Knowledge Extraction (claims with source-span citations) | — |
| 4 | Rights & Safety | Trust & Safety (verbatim/copyright/harmful-advice) | **blocks if flagged** |
| 5 | Skill Map | Skill Mapping → full six-axis tuple | **human approval for new nodes**; auto-accept confident matches |
| 6 | Instructional Design | Hook 0:00–0:20 → Problem 0:20–0:40 → Technique (≤3 steps) → Try-this-today → Check-in | — |
| 7 | Generate | Script (always); optional Presentation/Narration/Video | **human records or approves** |
| 8 | QA | QA (duration, rubric, factual consistency vs source, clarity) | **curator sign-off** |
| 9 | Provenance & Publish | Provenance + Publishing | automatic after 8 |

Source rules: books/papers → paraphrase and re-teach only, source cited; YouTube of third-party creators → original re-script or contributor agreement; live interview → original IP, no external rights issue (highest-leverage R1–R2 path).
**Automatic routing on publish:** (1) catalogue placement across pillar/function/industry/seniority/journey filters; (2) recommendation-index refresh; (3) journey-step eligibility fill; (4) `skill_cooccurrence` recompute.
**Full-AI synthetic path:** Release 3+ only; visible "AI-generated" badge; consent for any voice cloning; stricter QA.

---

## 11. Crowdsourced marketplace and creator economy (Release 3+)

Contributor journey: Apply → Verify (identity, expertise plausibility, rights attestation) → Onboard (Contributor Studio) → Contribute → Curate (same Stage 8 bar as internal) → Publish → Earn → Reputation.
**Reward = value, not clicks:** Completion 0.25 + Check-in correctness 0.25 + Downstream skill uplift 0.30 + Learner rating 0.10 + Non-duplication bonus 0.10. Uplift attribution via `skill_evidence` → `content_provenance` join.
Tables: `contributor_profiles, source_assets, content_extractions, content_provenance, content_reviews, creator_earnings, creator_payouts, content_ratings`.

---

## 12. SME sourcing and interview pipeline (extends interview intake)

Seven stages: (1) **SME Registry** — self-registered or curator-nominated, bio and profile links *submitted by the SME* (no scraping of LinkedIn etc.), consent captured · (2) **Gap Matching** — SME expertise tags × thin skill-graph tuples × topics learners asked Arya about with no content · (3) **Curator Gate** — weekly shortlist approved *before any outreach* · (4) **Schedule + Agenda** — curator-templated outreach, calendar slot, structured agenda sent in advance · (5) **Live Interview** (~1 h, Experience Interview Agent, Socratic) with explicit timestamped recording consent · (6) **Multi-output generation** from one transcript: minutes + presentation + one or more Skill Shot drafts · (7) **SME sign-off** before curator QA/publish; minutes/presentation returned to SME as thank-you (also keeps their profile fresh).
Tables: `sme_registry, topic_gap_candidates, sme_interview_sessions, interview_outputs`.
**Phasing:** R1.5 manual-assist (Vikram's contacts, manual scheduling; automate only multi-output and sign-off) → R2 registry with self-signup → R2–3 gap matching + curator gate → R3 autonomous schedule + agenda. **Open decision:** voice vs text for the interview; recommended text/async first, voice as R3 upgrade.

---

## 13. Data model

**Phase-1 core (Master Plan Appendix B):** `users, learner_profiles, skills, skill_relationships, learner_skills, goals, learning_journeys, journey_steps, assessments, assessment_questions, skill_shots, skill_shot_attempts, skill_evidence, conversations, agent_runs, agent_decisions, notification_outbox, notification_consent, magic_links, sessions, audit_logs`, plus (architecture doc) `organizations, user_roles, roles, role_skills, skill_levels, goal_skills, assessment_attempts/responses, practice_sessions, source_assets, content_transcripts/extractions/assets/provenance/reviews, ai_conversations, push_subscriptions`.
**Skill-graph extensions (this session):** `functions(onet_major_group, is_catchall)`, `industries(nic_code, is_catchall)`, `seniority_levels(tier_order, is_catchall)`, `skill_function_map(relevance_weight, apqc_process_ref)`, `skill_industry_map(relevance_weight)`, `skill_seniority_map(relevance_weight)`, `skill_aliases` (fulltext, en/hi), `skill_cooccurrence(strength)`; `skills` gains `secondary_pillar, source_framework, source_framework_code`.
**Marketplace and SME tables:** see Sections 11–12.
Skill Shot record follows the Skill Shot Standard (objective, why-it-matters, concept, example, practice, check-in, evidence, provenance); fields: title, situation, pillar, journey stage, level, duration, bunny_video_id, thumbnail, transcript, check-in question/options, tags, is_free, language (en/hi), FULLTEXT index.

---

## 14. Stack and architecture

Next.js 16 App Router + TypeScript (standalone Node 22 on Hostinger Cloud), Tailwind v4 + CSS custom-property tokens, Radix headless + custom components, Recharts/D3 radar, React Hook Form + Zod, TanStack Query, Drizzle ORM + reviewable SQL migrations (never run in the build command), `mysql2` pool to MariaDB, custom HMAC sessions, provider-neutral AI (Groq/OpenAI), Upstash Redis or equivalent for conversation memory, Brevo email, Meta WhatsApp Cloud API, Razorpay, Bunny.net Stream, GA4, Sentry, GitHub Actions → deploy from `main`, quality gate `npm run check` (ESLint + tsc + tests + build). Layers: experience (learner app, contributor studio, marketplace, enterprise portal, admin) · application modules (goal, skill, assessment, journey, content factory, marketplace, creator economy, enterprise intelligence, marketing, notification) · agentic (orchestrator, agent/tool registry, context manager, policy engine, approval gates, observability) · intelligence (skill graph, learner model, knowledge graph, marketplace graph, recommender, adaptive assessment) · data/integration.

---

## 15. Roadmap and release gates

**24-week plan:** S1–2 foundation/env/tokens/CI · S3–4 brand, components, dark mode, home shell · S5–6 60 Skill Shots recorded, tagged, on Bunny (5 per pillar × 3 journey stages × 2 tracks) · S7–8 Arya core (`/api/chat`, assess start/reply/score, memory, widget, fallback, logging, safety prompt) · S9–10 assessment end-to-end (rubric scoring, radar, Brevo report, CRM sync, GA4 funnel) · S11–12 player, check-in, outbox, WhatsApp templates + webhook, cron nudge, magic links · S13–14 journey engine + My Journey + streaks · S15–16 payments (Razorpay, subscription, cohort checkout, GST) — *revenue begins* · S17–18 MSME hub + B2B · S19–20 cohort delivery (Zoom, assignments, discussion) · S21–22 blog/SEO · S23–24 QA, Lighthouse ≥ 80 mobile, security/a11y audits, device/network testing, UAT, production deploy.

**Release gates:** R1→R2: loop works end-to-end, 60 Skill Shots, 20+ learners assessed with 80%+ watching ≥ 2, 5+ subscribers, Arya < 1 s, WhatsApp delivery > 80%, NPS ≥ 40, 7 days no P1. R2→R3: first cohort completes (30+ learners, 80%+ completion), marketplace demand signals, AI script assistant shipped.

**Amended by this session:** R1 unchanged. **R1.5:** seed skill graph (56 DELTAs + O*NET/ESCO + seniority), ingestion adapters for Vikram's back-catalogue, manual-assist SME pipeline. **R2:** full 9-stage pipeline internal, SME registry. **R2–3:** gap matching + curator gate. **R3:** marketplace opens (5–10 vetted experts), autonomous scheduling. **R3+:** synthetic video path, open applications, NASSCOM NOS certificate tracks.

---

## 16. Go-to-market and operations

Funnel: awareness (blog, social) → consideration → conversion (free assessment + first Skill Shot) → activation (5+ Skill Shots, streak) → revenue → retention → advocacy. Launch KPIs: 500+ visitors/wk, 100+ assessments/wk, 40% completion, 60% of completers watch ≥ 1, 30% convert, 20% cohort completion. OKRs: prove loop (100+ assessed), engagement (40% 4-wk retention, 2+ Skill Shots avg, 7-day avg streak), monetisation (15 subscribers, first cohort 10+, 80% completion, NPS ≥ 40), credibility (30 testimonials, 0 P1). Support: email, minimal WhatsApp inbound, in-app help; dashboard for errors/latency/funnel/LLM cost/WhatsApp delivery; deployment and post-deploy checklists (env vars in hPanel, templates approved, Razorpay live, backups, smoke tests).

---

## 17. Open items and inconsistencies — resolve explicitly in the build

1. **Master Plan Sprints 15–20 still reference WooCommerce, TutorLMS and WordPress**, which contradicts the locked greenfield-Next.js decision. The build should implement payments and cohorts natively (Razorpay + own tables). Do not adopt the WordPress dependency by accident.
2. **LLM/Redis choices** in the blueprint (Groq, Upstash) must be checked against the repo's "provider-neutral AI" and Hostinger constraints.
3. Manufacturing O*NET output is **not curator-approved**; the Seniority heuristic gap must be fixed once before scaling to Retail, Consumer Products, Logistics, IT Services, Professional Services.
4. Prototype lacks the Seniority chip.
5. APQC industry-specific PCFs need a free APQC account (user must create it).
6. SME interview voice vs text undecided.
7. Environmental stewardship → ADAPT placement flagged for the next taxonomy audit.
8. Map "essential skills" ≈ 10/35 coverage limitation before relying on O*NET skill weights.
9. Illustrative numbers (price ₹4,999, impact counters, cohort size) are placeholders, not decisions.
10. Source documents live in the planning session's scratchpad (not in this repo): Master Execution Plan, Skill Graph/Content Factory/Marketplace v1.2, `onet_import.py`, `manufacturing_seed.sql`, `manufacturing_review_report.md`. This file is the self-contained summary of them.

---

## 18. Verification checklist (tick in the build session)

**Foundations** ☐ greenfield Next.js, no WordPress dependency · ☐ web-primary PWA + WhatsApp as notification · ☐ 0–5 stored scale with 0–100 projection · ☐ all 11 engineering rules in §2 · ☐ permanent human gates in §2
**Learner** ☐ L1–L19 (§3) · ☐ Arya persona rules and tool calls · ☐ rubric-based scoring with confidence labels · ☐ magic-link deep links · ☐ consent/STOP ledger
**Design** ☐ Eccellere tokens + Lora/Inter · ☐ dark mode · ☐ WCAG AA checks · ☐ radar chart with text alternative · ☐ components list · ☐ mobile-first
**Skill graph** ☐ six axes in schema · ☐ 13 functions + catch-all · ☐ 16 industries tiered + catch-all · ☐ 6 seniority tiers + catch-all · ☐ secondary pillar + never double-counted · ☐ junction tables with relevance weights · ☐ aliases + co-occurrence · ☐ `apqc_process_ref` · ☐ source framework traceability columns
**Seeding** ☐ 56 DELTAs as pillar nodes with dual-pillar seeds · ☐ O*NET/ESCO import with human approval · ☐ NASSCOM NOS tagging · ☐ importance threshold 2.8 default · ☐ job-zone seniority heuristic fixed
**Content Factory** ☐ 9 stages and gates · ☐ all six intake adapters · ☐ rights rules per source type · ☐ provenance stamp on every asset · ☐ four auto-routing actions · ☐ synthetic badge rule
**Marketplace** ☐ contributor journey · ☐ reward formula weights · ☐ 8 marketplace tables · ☐ same QA bar for external contributors
**SME pipeline** ☐ consented registry (no scraping) · ☐ gap matching · ☐ curator gate before outreach · ☐ separate recording consent · ☐ minutes + presentation + Skill Shot outputs · ☐ SME sign-off · ☐ 4 SME tables · ☐ phasing
**Delivery** ☐ 24-week sprint map · ☐ release gates · ☐ GTM KPIs/OKRs · ☐ deployment checklist · ☐ open items in §17 resolved or consciously deferred
