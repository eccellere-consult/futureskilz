# Where we are and what to build next

Measured against `docs/context/FutureSkilz_Master_Build_Skill.md` (releases, 10-phase sequence, Definition of Done), the v2.1 Blueprint and the Skill Shot instructional design skill (`docs/skill-shots/skill.md`). Percentages are judgement, not measurement: they count the capabilities each release lists and how complete the working version is. Updated 26 Oct 2026 (version 2; the first version was 25 Oct).

## 1. Answer first

About **40% of the Master Build scope is done** (35% on 25 Oct), still unevenly. Since the last plan the product gained a recognisable front door and finishing touches for every kind of person, but **the two flywheels still do not turn**.

- **Done since 25 Oct:** Arya as a live, animated teacher, counsellor and interviewer (photo avatar, Indian-English voice, formal greeting, the coach's choice of how to shape the interview); a menu and landing page for each role (learner, coach, editor, admin); an admin dashboard and payments screen; a coach earnings calculator; a home page that states the value propositions and the gurukul story; the first Skill Shot built to the instructional design skill (blueprint, seven documents, automatic quality checks, a player with Arya in a window); a staged demo build.
- **Still missing, and decisive:** a coach's approved lessons do not yet enter a learner's journey, because lessons are not mapped to the Skill Graph and there is no target role, so no real gap analysis. The journey is two rule-picked Skill Shots. Arya talks but cannot yet *converse as a coach*. There is no Skill Passport, marketplace, reputation, payment provider, WhatsApp channel or enterprise portal.

**Recommended next pick: prove what is built on production, then connect the flywheels** (Phase 0, then Phase 1 below), then Arya as an adaptive coach. Payments and WhatsApp need third-party approvals that take weeks, so their business tracks start now, in parallel (section 6).

## 2. What exists today

| Area | What works now | Where |
|---|---|---|
| Front door | Home page with value propositions and the gurukul story; learner onboarding led by Arya (9 steps, formal greeting, hear-aloud); public passwordless previews of what each role gets; register or sign in as learner or coach; email links and passwords | `/`, `/join`, `/sign-in`, `/arya` |
| Learner | Skills profile, a personal journey of two Skill Shots, five short Skill Shots plus one designed Skill Shot taught by Arya, the Problem Solving training kit, coach lessons in paths with ratings, a Training material hub, a roadmap, evidence from Skill Shot check-ins | `/learn`, `/journey`, `/profile`, `/assessment`, `/training`, `/skill-shots/*`, `/problem-solving/*`, `/lessons/*` |
| Coach (contributor) | Adaptive interview that resumes over days without repeating itself; the coach chooses to let Arya lead, edit her outline, or structure it; uploads (PDF, Word, text, CSV, Excel); review of every extracted statement against its source; approval; lessons; usage and attribution from the first view; dashboard; statements; earnings calculator | `/contribute/*` |
| Editor | Queue of lessons to approve, with the coach's approval step before publication | `/contribute/editor` |
| Admin | Dashboard (what needs attention, people, content, money); accounts and roles; revenue-share policy, receipts, allocation runs, statements; payments screen (finalise, mark paid, void); demo build | `/admin`, `/admin/payments`, `/contribute/admin/*`, `/demo` |
| Arya | Photo-driven live avatar (blink, mouth, teeth, gaze, bow), studio voice with device fallback, lip-sync from the audio, English only, always labelled as an AI | `src/features/arya` |
| Skill Shot standard | Blueprint types, spoken-length timing, automatic quality rubric with blockers, seven deliverable documents kept in step by a test, a player (scenes, decision with thinking pause, knowledge check, task for work) | `src/features/skillshot`, `docs/skill-shots/` |
| Engineering | Next.js 16 on Hostinger with MariaDB; about 65 tables across 5 additive migrations; 62 API routes; 28 pages; about 390 automated tests (unit and integration) and a quality gate in CI; one-time self-setup of tables; deterministic fallbacks where a service is missing | repository |

## 3. Status by release

| Release (Master Build) | Done | Partial | Not started | Approx. |
|---|---|---|---|---|
| **1 Core** (auth, onboarding, goal, baseline, profile, gaps, journey, Skill Shot player, practice, coach, micro-assessment, progress, passport, seed graph) | Auth, onboarding (Arya-led), Skill Shot player with Arya, practice, evidence | Goal (no target role), baseline (static 5-question rating), profile and gaps (pillar level), journey (2 Skill Shots), micro-assessment (one check-in), progress, seed graph (50 skills, 6 families; 6 Skill Shots) | AI Coach (conversational), Skill Passport | **~50%** |
| **2 Content Factory** (studio, voice, uploads, interview, extraction, skill mapping, Skill Shot generation, presentation, narration, practice generation, QA, provenance, review) | Studio, voice in and out, adaptive interview, extraction, provenance, review workflow, the Skill Shot blueprint standard and its quality gate | Uploads (no PowerPoint, images, audio, video), lesson generation (rules-based, not yet in blueprint form), narration (Arya's voice, live), QA (mechanical plus the rubric) | Skill mapping to the graph, Instructional Design Agent, practice and assessment generation, rendered video and voice agents | **~65%** |
| **3 Marketplace** | Usefulness ratings | Browse (lesson paths), contributor dashboard, Training material hub | Listings, search, recommendations, public coach profiles, quality score | **~15%** |
| **4 Creator Economy** | Usage events, ledger, versioned policy, statements, disputes, attribution, payments screen, coach calculator | Fraud controls (caps and dedupe only), payouts (statuses, no provider), finance admin | Reputation, Qualified Value Score, fraud flags and review queue, payout provider | **~45%** |
| **5 Enterprise** | | `organizations` table | Dashboard, heatmap, critical gaps, role readiness, manager view | **~0%** |

By build phase (Master section 35): 1 Foundation ~85%, 2 Intelligence core ~55%, 3 Learner core ~50%, 4 Learning experience ~45%, 5 Content factory ~65%, 6 Marketplace ~15%, 7 Creator economy ~45%, 8 Enterprise 0%, 9 Marketing and administration ~25% (home page, value propositions, admin dashboard; no campaigns), 10 QA partial (automated tests; no accessibility audit, load test or real-phone test).

## 4. Definition of Done check

| Persona | Met | Not yet |
|---|---|---|
| Learner (16) | Sign up, onboarding, goal (partial), baseline (partial), profile, gaps (partial), start a Skill Shot, practice, evidence, progression | A real personalised journey, AI Coach, assessment beyond a check-in, continue-journey adaptation, Skill Passport, explore a target role (about 10 of 16) |
| Contributor (10) | Profile, upload or record, AI interview, review extracted knowledge, review generated assets, submit, publish, performance, earnings | Reputation (about 9 of 10) |
| Administrator (8) | Review content, manage contributors, configure reward rules, earnings and payouts (statuses), audit | Manage taxonomy, fraud flags, campaigns and promotions (about 5 of 8) |
| Enterprise (5) | | All |

## 5. The plan: next phases

Each phase ends with something a person can use, and each makes the next cheaper. Durations assume one focused build track working with Claude the way this project has run; approvals and content work run alongside.

### Plan at a glance

| Phase | Name | Weeks | What a person can do afterwards | Gate to pass |
|---|---|---|---|---|
| 0 | Prove it on production | 1 | Owner and test users run every role's full cycle on the live site | Live demo build, sign-ins, voice and avatar verified on real phones |
| 1 | Connect the flywheels | 3 | A learner picks a target role, sees real gaps, follows a journey that includes a coach's lesson and a designed Skill Shot, and the coach sees it used | North Star measurable for one role |
| 2 | Arya as coach and adaptive assessment | 2 to 3 | A learner talks to Arya, is assessed conversationally, and gets feedback on practice | Scoring within the agreed accuracy of human raters |
| 3 | Skill Passport and Career Explorer | 1 to 2 | A learner shares evidence-backed proof of skills and explores other roles | Passport shows measured evidence, self-report and inference separately |
| 4 | Marketplace discovery | 2 to 3 | A learner finds content by skill, role and industry; coaches have public profiles | A learner reaches relevant content in three steps |
| 5 | Reputation, Qualified Value Score, fraud review (built) | 2 | Coaches earn on a richer, governed formula; admins review flags | Formula approved by the business |
| 6 | Payments and subscriptions (built, not live) | 3 plus approvals | Learners pay; coaches are paid | A real payment end to end in test and live |
| 7 | WhatsApp channel | 3 plus approval | Daily Skill Shot, check-ins and assessment on WhatsApp | Meta approval and opt-in tested |
| 8 | Enterprise portal | 4 | A leader sees readiness, gaps and role readiness | One pilot organisation onboarded |

### Phase 0: Prove it on production (about 1 week)

The last weeks added a lot, and several deploy problems showed that production behaves differently from a laptop. Before building more, confirm what is live.

- Confirm the staged demo build completes on Hostinger and the demo accounts sign in (this was unresolved when last tested; the access-code lockout was fixed but the cause of the earlier failure is not confirmed).
- Run every role's full cycle on the live site: learner (onboarding to a Skill Shot), coach (interview to published lesson), editor (approve), admin (policy to statement).
- Test Arya (avatar, voice, lip-sync) on a mid-range Android phone and an iPhone; measure load time of the 3D engine and the portrait.
- Set the production environment: studio voice key and limits, access code, bootstrap admin, mail.
- Decide where original uploads are kept (an object store); today only text, location and checksum are retained.
- Accessibility pass on the main journeys (keyboard, contrast, captions) and a basic load test.

### Phase 1: Connect the flywheels (about 3 weeks). Highest leverage

Goal: one learner, one target role, one journey that mixes a coach's lesson and designed Skill Shots, with evidence flowing back to the coach.

1. **Seed 12 to 15 roles** with required skills and levels (Master section 32) and the first 12 Skill Shots across the five pillars and the priority roles, as data and deterministic.
2. **Skill mapping:** map each approved fact and lesson to graph skills and levels (rules first, AI-assisted, the coach confirms).
3. **Target role, gap engine, journey engine v2:** goal to target profile to prioritised gaps (gap size, criticality, prerequisites, time, deadline) to a sequenced journey. Prioritise by goal relevance, proficiency gap, urgency, prerequisite value, evidence confidence and available time, as the product standard requires.
4. **One Skill Shot standard:** bring generated coach lessons and the five older Skill Shots into the blueprint form (case, concept, method, challenge, transfer task, source map), with the rubric as the publication gate and attribution kept.
5. **Instructional Design Agent:** from an approved knowledge package, draft a Skill Shot blueprint with the rubric as a blocker; the coach and an editor review it before it is live. Reuse the existing editor and coach approval steps for designed Skill Shots.
6. **Evidence from designed Skill Shots:** record the check-in and challenge results on the learner's account (today only the device), so progression, the Passport and the coach's dashboard all use them.
7. **Content wave 1:** 12 Skill Shots (5 pillars, 3 priority roles), each reviewed by a person.

Done when: a learner picks "AI Product Manager" (or another seeded role), sees gaps, completes a journey step from a coach's lesson, and the coach's dashboard shows it, with the North Star (target skills demonstrably achieved) measurable for that role.

### Phase 2: Arya as coach and adaptive assessment (2 to 3 weeks)

- **Conversational layer:** Arya as a text and voice conversation (provider abstraction, agent registry and run recording already exist): hints and feedback inside a Skill Shot, recommendations from the library, a conversation log and safety tests. English first; Indian languages when the voice engine supports them.
- **Adaptive baseline** replaces the static 5-question rating: Arya asks about recent situations, observable behaviour and outcomes (not self-ratings), with drill-down only where an answer changes diagnosis or the path; scoring labelled measured, self-reported, inferred or assumed.
- **Validation:** 20 sample conversations scored by Arya and by people; agree an acceptable difference (the Blueprint proposes ±15 points) before trusting the scores.
- **Practice feedback:** Arya reviews a learner's practice note against criteria.

### Phase 3: Skill Passport and Career Explorer (1 to 2 weeks)

- Evidence-backed, honest about confidence, shareable by link and exportable.
- Career Explorer: pick a target role, see the gap and a path; reuses Phase 1's gap engine.
- Manager-visible summary is held until Phase 8.

### Phase 4: Marketplace discovery (2 to 3 weeks)

- Listings, search, browse by skill, role and industry, recommendations driven by gaps, public coach profiles, quality score, and governance modes A/B/C chosen by risk.
- Learners' paths stay primary; the marketplace is how they find more.

### Phase 5: Reputation, Qualified Value Score and fraud review (2 weeks) — BUILT

Built: the Qualified Value Score as a second formula chosen per policy, with a compare screen; fraud flags and an admin review queue; coach reputation on coach pages; campaigns and promotions. Still the business's decision: which formula governs, and approving a policy. Fraud rules are simple and explainable; they have not been tuned on real traffic.

- Add the Qualified Value Score as a second, configurable formula beside the current weighted pool, behind the business's decision on which governs.
- Fraud flags and a review queue (today only caps and dedupe), coach reputation, and a campaigns and promotions area for admins.

### Phase 6: Payments and subscriptions (3 weeks plus approvals) — BUILT, NOT LIVE

Built: plans (time-boxed passes, admin-priced), Razorpay checkout and signed webhooks, a test mode, GST invoices (CGST and SGST, or IGST) as PDFs, free-tier gating (first two Skill Shots per pillar), receipts feeding the ledger, refunds that end a pass, discount codes, and manual coach payouts with a bank file. Nothing sells or locks until `PAYMENTS_MODE=razorpay`, the keys are set, and a plan is on sale. Not built: auto-renewing subscriptions (UPI AutoPay or Razorpay Subscriptions) and a payout API (Razorpay X). Needs: Razorpay account and KYC, your accountant's check of the GST invoice, and an approved revenue-share policy.

- Razorpay (UPI, cards, EMI, GST invoices), free-tier gating (first two Skill Shots per pillar free), real receipts feeding the ledger, a payout provider for coaches.
- The statement screens and policy engine are ready; what is missing is the provider and the approved policy.

### Phase 7: WhatsApp channel (3 weeks plus Meta approval)

- Daily Skill Shot, check-ins, assessment over WhatsApp, STOP handling and consent, reusing the notification outbox and consent tables.
- Needs the same Arya conversation engine from Phase 2.

### Phase 8: Enterprise portal (4 weeks)

- Tenant model, workforce heatmap, critical gaps, role readiness, manager view, and knowledge-handover projects (capturing the knowledge of people who are moving on), which the home page already promises.
- One pilot organisation, not a general release.

### Later

Rendered video and voice generation agents (HeyGen, Gemini, Veo and Descript toolchain in the Blueprint), more Indian languages, SSO and HRIS, native mobile, advanced workforce planning.

## 6. Start now in parallel (business tracks, lead time is weeks)

- **Meta WhatsApp Business** verification and template approval (needed for Phase 7).
- **Razorpay** account and KYC; decide the GST invoicing approach (Phase 6).
- **Legal and tax review** of the revenue-share terms, then an approved policy; also coach agreements and consent wording for name, voice and likeness.
- **Arya's likeness:** confirm the rights to the portrait and voice for commercial use, and decide whether a commissioned 3D model replaces it.
- **Content production:** the content plan (Blueprint part 10: 60 Skill Shots) and the video toolchain budget; recruit the first coaches for wave 1.
- **Data protection:** consent, retention and deletion wording for interviews, transcripts and learner data under India's DPDP Act, reviewed by counsel.
- **Object storage** for original uploads and any rendered media.

## 7. Decisions needed from the owner

These were open on 25 Oct and are still open. Each has a proposal, so work can start on the proposals.

1. **Which document governs where they differ** (`docs/context/README.md`). Proposed: Master Build for product and data; Blueprint for channels, payments and content production.
2. **Skills model:** the 7 intelligence families, the 5 THINK/CREATE/LEAD/ADAPT/AI+TECH pillars, or a mapping. Proposed: the families are the Skill Graph; the pillars are a learner-friendly view over it.
3. **Skill Shot format and length:** 3-minute video, about 10-minute multi-format, or the new 5 to 10 minute interactive lesson taught by Arya. Proposed: one object with a format and a duration; the interactive lesson with Arya is the standard now, video is a later renderer.
4. **Database:** Hostinger has MariaDB only. Proposed: stay on MariaDB, keep embeddings in JSON and rank in the app at current scale, revisit at a VPS move.
5. **Creator pay formula:** current weighted pool versus the Qualified Value Score, and who approves it.
6. **First market and language:** India and English first; when Hindi?
7. **New:** should Arya's studio voice be paid for from day one (cost per learner) or limited to greetings and coach sessions, with the device voice elsewhere?
8. **New:** who may approve designed Skill Shots: the editor, the coach, or both (today's coach lessons need both)?

## 8. Technical debt and risks to track

- Original upload files are not retained; only text, location and checksum.
- Fraud rules are first-pass and untuned; real traffic will show false positives and gaps.
- Free-tier gating is at page level. The five original Skill Shots ship their content in the browser, so it is a paywall for honest use, not copy protection.
- No formal accessibility audit, load test, real-phone test of Arya, or AI scoring validation yet.
- The 3D engine is a lazy download of about 700 KB; confirm it stays within a mobile data budget.
- Hostinger: one Node slot, no staging, no shell. Every schema change must stay additive, and the quality gate is the only pre-production check. A real staging copy is worth setting up before payments.
- The Problem Solving kit is a copy of an engine used elsewhere and will be copied again for the Eccellere sites; keep it self-contained.
- Designed Skill Shot answers are kept on the learner's device until Phase 1 records them as evidence.
- The demo seed runs in several short requests because the host cuts off long ones; any other long operation (large uploads, AI generation) needs the same care.
- Arya's voice and portrait carry likeness and consent obligations (section 6); the avatar is always labelled as an AI.
