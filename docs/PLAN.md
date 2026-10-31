# Where we are and what to build next

Measured against `docs/context/FutureSkilz_Master_Build_Skill.md` (releases, 10-phase sequence, Definition of Done), the v2.1 Blueprint, the Skill Shot instructional design skill (`docs/skill-shots/skill.md`) and, since 31 Oct, the Consolidated Skill v1.3 (`docs/context/FutureSkilz_Consolidated_Skill_v1.3.md`, compared in `docs/v1.3-gap-analysis.md`). Percentages are judgement, not measurement. Updated 31 Oct 2026 (version 3; version 2 was 26 Oct).

## 1. Answer first

About **60% of the Master Build scope is built** (40% on 26 Oct). Phases 1 to 6 of the earlier plan are built and merged: connected flywheels, Arya as coach and adaptive diagnostic, Skill Passport and Career Explorer, marketplace and coach profiles, the Qualified Value Score with fraud review, reputation and campaigns, and payments with GST invoices, free-tier gating and coach payouts. The Arya interview now also produces a bestseller-structured book (KDP-ready PDFs, AI cover, emailed to the author) and training lessons from the same approved content.

**None of it has been proved on the live site, and payments are built but not switched on.** Phase 0 is still open and is the first thing to do.

**What is missing, in order of importance** (full list in `docs/v1.3-gap-analysis.md`):

1. **Content can only be created from an Arya interview.** A PDF, Word file, PowerPoint, recording, YouTube link or article cannot become a Skill Shot on its own; uploads only support an interview. This is Phase 7.
2. **The Skill Graph has one axis, not six** (function, industry, seniority, level, journey stage, plus pillar). Discovery by role or industry and the enterprise portal depend on it. Phase 8.
3. **Learner delivery basics v1.3 treats as Release 1 are missing:** PWA and install, streaks, certificates, scheduled notifications, cohorts, MSME hub, blog. Phases 9 and 10.
4. **Nine documents or decisions conflict** (channel, Skill Shot format, skills model, design system and others): `docs/v1.3-gap-analysis.md` section 5 gives a recommendation for each.

**Recommended next pick: Phase 0, then Phase 7.** Business tracks (Razorpay, Meta WhatsApp, GST review, DPDP) run in parallel (section 6).

## 2. What exists today

**Added since 26 Oct (31 Oct):** a target role and gap engine with a personal journey (Phase 1); Arya as a coach inside Skill Shots, a conversational diagnostic and practice feedback (Phase 2); the Skill Passport with share links and a Career Explorer (Phase 3); marketplace search, public coach pages, quality score and governance modes (Phase 4); the Qualified Value Score, fraud review queue, coach reputation and campaigns (Phase 5); plans, Razorpay checkout and webhooks, GST invoices, free-tier gating, refunds and manual coach payouts (Phase 6); a book from the interview (KDP-ready interior and cover PDFs, AI cover art, a writer agent on request, email to the author) with training lessons from the same approved content; an editor desk that shows what waits on the coach. The table below is the 26 Oct version and is kept for the front door, Arya and the Skill Shot standard.

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

| Release (Master Build) | Built | Partial | Not started | Approx. |
|---|---|---|---|---|
| **1 Core** | Auth, onboarding, goal and target role, adaptive diagnostic, profile, gap engine, journey, Skill Shot player, practice, coach, evidence, Skill Passport, Career Explorer | Seed graph (50 skills, 7 families, one axis); journey is gap-driven but not keyed to the seven journey stages | PWA, streaks, certificates, cohorts, notification sending | **~70%** |
| **2 Content Factory** | Studio, voice, adaptive interview, extraction with sources, lessons, Instructional Design Agent, rubric gate, review and approvals, book writer, provenance of facts | Uploads (evidence inside an interview only, 5 MB), QA (rubric plus approvals) | Intake from any source, rights and safety gate, six-axis skill mapping, minutes and presentation outputs, transcription, rendered video | **~65%** |
| **3 Marketplace** | Listings, search, recommendations, public coach profiles, quality score, governance modes A/B/C | External contributor vetting | Open applications | **~65%** |
| **4 Creator Economy** | Usage events, ledger, policy, QVS beside the weighted pool, statements, disputes, fraud flags and review queue, reputation, campaigns, Razorpay checkout, GST invoices, refunds, manual payouts | Payout provider (manual only); live payments need approvals | Auto-renewing subscriptions, payout API | **~80%** |
| **5 Enterprise** | | `organizations` table | Everything else | **~0%** |

By build phase (Master section 35): 1 Foundation ~85%, 2 Intelligence core ~65%, 3 Learner core ~70%, 4 Learning experience ~60%, 5 Content factory ~65%, 6 Marketplace ~65%, 7 Creator economy ~80%, 8 Enterprise 0%, 9 Marketing and administration ~45% (campaigns, admin dashboard; no blog or SEO), 10 QA partial (about 580 automated tests including database integration tests; no accessibility audit, load test or real-phone test).

## 4. Definition of Done check

| Persona | Met | Not yet |
|---|---|---|
| Learner (16) | Sign up, onboarding, goal and target role, baseline, profile, gaps, start a Skill Shot, practice, evidence, progression, AI coach, Skill Passport, explore a target role, continue-journey adaptation (about 14 of 16) | Assessment report with radar, streak and certificate |
| Contributor (10) | Everything on the list, plus a book and training from the interview | Create from a document or recording rather than an interview |
| Administrator (8) | Review content, manage contributors, reward rules, earnings and payouts, fraud flags, campaigns, audit | Manage taxonomy (about 7 of 8) |
| Enterprise (5) | | All |

## 5. The plan: next phases

Each phase ends with something a person can use, and each makes the next cheaper. Durations assume one focused build track working with Claude the way this project has run; approvals and content work run alongside.

### Plan at a glance

| Phase | Name | Weeks | What a person can do afterwards | Gate to pass |
|---|---|---|---|---|
| 0 | Prove it on production | 1 | Owner and test users run every role's full cycle on the live site | Live demo build, sign-ins, voice and avatar verified on real phones; interview to book and training run once for real |
| 1 to 6 | Flywheels, Arya as coach, Passport, Marketplace, QVS and fraud, Payments | Built | See sections 2 and 3 | Payments need Razorpay, GST and policy approvals to go live |
| **7** | **Content intake: any source to a Skill Shot** | 4 | A coach or editor creates content from a PDF, Word, PowerPoint, pasted text, article link, recording or video, with rights checks | A document with no interview becomes a reviewed Skill Shot; a copied passage is blocked |
| **8** | **Skill Graph v2: six axes and seeding** | 3 | Every skill and Skill Shot is findable by function, industry, seniority, level and journey stage; new nodes need a human | Curator-approved seed for one industry |
| **9** | **Learner delivery basics** | 3 | Installable app, scheduled notifications, streaks, certificates, assessment report with radar, design alignment | A learner returns on day 2 and day 7 from a notification |
| **10** | **Cohorts** (after launch) | 4 | Enrol, pay, attend, submit, certificate | First cohort completes |
| 11 | WhatsApp channel (notification and re-entry only, per v1.3) | 2 plus approval | Daily nudge and magic-link return on WhatsApp, STOP honoured | Meta approval and opt-in tested |
| **12** | **SME pipeline** (live voice) | 4 | Curator-led recorded expert interviews produce minutes, a presentation and Skill Shots | One SME end to end |
| 13 | Enterprise portal | 4 | A leader sees readiness, gaps and role readiness | One pilot organisation onboarded |

**Indicative calendar for one build track** (weeks from the start of Phase 0; business approvals run beside it): week 1 Phase 0 · weeks 2 to 5 Phase 7 · weeks 6 to 8 Phase 8 · weeks 9 to 11 Phase 9 · weeks 12 to 15 Phase 10 · Phase 11 when Meta approves (2 weeks of work) · weeks 16 to 19 Phase 12 · weeks 20 to 23 Phase 13. With two tracks, Phase 9 runs beside Phase 7 and the whole plan is about 16 weeks.

Order notes: 7 before 8 because intake needs the safety gate more than the extra axes, and 8 before 12 and 13 because both filter on the axes. 9 can run beside 7 if there are two tracks. 10 follows 9 (cohorts are not part of the launch offer).

### Phase 0: Prove it on production (about 1 week)

The last weeks added a lot, and several deploy problems showed that production behaves differently from a laptop. Before building more, confirm what is live.

- Confirm the staged demo build completes on Hostinger and the demo accounts sign in (this was unresolved when last tested; the access-code lockout was fixed but the cause of the earlier failure is not confirmed).
- Run every role's full cycle on the live site: learner (onboarding to a Skill Shot), coach (interview to published lesson), editor (approve), admin (policy to statement).
- Test Arya (avatar, voice, lip-sync) on a mid-range Android phone and an iPhone; measure load time of the 3D engine and the portrait.
- Set the production environment: studio voice key and limits, access code, bootstrap admin, mail.
- Decide where original uploads are kept (an object store); today only text, location and checksum are retained.
- Accessibility pass on the main journeys (keyboard, contrast, captions) and a basic load test.

### Phase 1: Connect the flywheels (about 3 weeks). Highest leverage — BUILT

Goal: one learner, one target role, one journey that mixes a coach's lesson and designed Skill Shots, with evidence flowing back to the coach.

1. **Seed 12 to 15 roles** with required skills and levels (Master section 32) and the first 12 Skill Shots across the five pillars and the priority roles, as data and deterministic.
2. **Skill mapping:** map each approved fact and lesson to graph skills and levels (rules first, AI-assisted, the coach confirms).
3. **Target role, gap engine, journey engine v2:** goal to target profile to prioritised gaps (gap size, criticality, prerequisites, time, deadline) to a sequenced journey. Prioritise by goal relevance, proficiency gap, urgency, prerequisite value, evidence confidence and available time, as the product standard requires.
4. **One Skill Shot standard:** bring generated coach lessons and the five older Skill Shots into the blueprint form (case, concept, method, challenge, transfer task, source map), with the rubric as the publication gate and attribution kept.
5. **Instructional Design Agent:** from an approved knowledge package, draft a Skill Shot blueprint with the rubric as a blocker; the coach and an editor review it before it is live. Reuse the existing editor and coach approval steps for designed Skill Shots.
6. **Evidence from designed Skill Shots:** record the check-in and challenge results on the learner's account (today only the device), so progression, the Passport and the coach's dashboard all use them.
7. **Content wave 1:** 12 Skill Shots (5 pillars, 3 priority roles), each reviewed by a person.

Done when: a learner picks "AI Product Manager" (or another seeded role), sees gaps, completes a journey step from a coach's lesson, and the coach's dashboard shows it, with the North Star (target skills demonstrably achieved) measurable for that role.

### Phase 2: Arya as coach and adaptive assessment (2 to 3 weeks) — BUILT

- **Conversational layer:** Arya as a text and voice conversation (provider abstraction, agent registry and run recording already exist): hints and feedback inside a Skill Shot, recommendations from the library, a conversation log and safety tests. English first; Indian languages when the voice engine supports them.
- **Adaptive baseline** replaces the static 5-question rating: Arya asks about recent situations, observable behaviour and outcomes (not self-ratings), with drill-down only where an answer changes diagnosis or the path; scoring labelled measured, self-reported, inferred or assumed.
- **Validation:** 20 sample conversations scored by Arya and by people; agree an acceptable difference (the Blueprint proposes ±15 points) before trusting the scores.
- **Practice feedback:** Arya reviews a learner's practice note against criteria.

### Phase 3: Skill Passport and Career Explorer (1 to 2 weeks) — BUILT

- Evidence-backed, honest about confidence, shareable by link and exportable.
- Career Explorer: pick a target role, see the gap and a path; reuses Phase 1's gap engine.
- Manager-visible summary is held until Phase 13.

### Phase 4: Marketplace discovery (2 to 3 weeks) — BUILT

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

### Phase 7: Content intake, any source to a reviewed Skill Shot (about 4 weeks). Next after Phase 0

Scope confirmed 31 Oct: every source below is in the first release.

Goal: stop depending on the interview as the only way in. One pipeline, several intake doors, one safety gate, the same review and publish steps that exist.

1. **Create from a document (1 week).** A new project type, "from a source", beside the interview. Upload or paste (PDF, Word, text, Markdown, CSV, Excel as today, plus pasted text); the coach or editor states what it is, who owns it, and attests the right to teach from it. Facts are extracted with source quotes (existing extraction), reviewed by the owner, then lessons and Skill Shots are designed (existing agents). No interview needed.
2. **Rights and safety gate (1 week, blocks).** A verbatim-overlap check against the source (paraphrase and re-teach only, source cited), a harmful-advice screen, and a required attestation. A flagged item cannot move on. Also removes the silent truncation noted in the gap analysis: whatever is cut is logged and shown.
3. **More formats (1 week).** PowerPoint (slides and notes), images and scans (OCR or vision), web article links (fetch, clean, cite), larger files through object storage with the original kept.
4. **Audio and video files (1 week).** Upload a recording or meeting, transcribe in a background job (the host cuts long requests), speaker turns, a recording-consent record, then the same pipeline. Output options: Skill Shot, lesson, **minutes**, **presentation** (PPTX), book.
5. **YouTube and video links.** First version: the contributor pastes the link and the transcript (or uploads the file) and attests rights; the system re-scripts and never republishes. Automatic transcript fetching only for the owner's own channel or with a written agreement. Needs the owner's decision D8.

Done when: a coach uploads a PDF with no interview, reviews the extracted points, and an editor publishes a Skill Shot from it; a pasted copy of a book page is blocked; a recorded meeting yields minutes and a Skill Shot draft.

### Phase 8: Skill Graph v2, all axes and seeding (about 3 weeks, then one industry at a time)

Scope confirmed 31 Oct: all axes, including APQC and NASSCOM NOS tags. Seed Manufacturing first, then Retail and Consumer Products, Logistics and Supply Chain, and IT Services, GCCs and Professional Services (each about a week of seeding and curator review once the seniority heuristic is fixed).

- Add function (13 plus catch-all), industry (16 tiered plus catch-all), seniority (6 plus catch-all) and journey stage (7) as tables with relevance weights, plus secondary pillar (never double-counted), aliases, co-occurrence and the optional APQC reference. Keep the 7 families as a grouping (decision D3).
- Seed: the 56 DELTA names as pillar nodes (proprietary; names only as seed concepts), then an O*NET and ESCO import for one industry, **with a human approving every new node**. The import script and the Manufacturing output are not in the repository and must be supplied; fix the seniority heuristic before a second industry.
- Skill mapping suggests the full tuple for lessons, sources and Skill Shots; marketplace search and the Career Explorer filter on the axes.
- Admin screen to manage the taxonomy (the last Administrator item in the Definition of Done).

### Phase 9: Learner delivery basics (about 3 weeks)

- PWA: manifest, service worker, install prompt after the first completed Skill Shot, web push (the table exists).
- Scheduled notifications: a daily nudge on weekdays at 8:00 IST by email and push (WhatsApp joins in Phase 11), preferences and consent screen, reusing the outbox.
- Streaks and momentum messaging; completion certificates with a share link; the assessment report with a radar chart that has a text alternative.
- Design alignment per the owner's decision D5 (palette, fonts, dark mode) and an accessibility pass (keyboard, contrast, captions).
- Journey stages (seven) as a first-class choice at sign-up, driving the first recommendations.
- Analytics and error tracking: GA4 events for the funnel, an error tracker, an LLM and email cost view.

### Phase 10: Cohorts (about 4 weeks; after Phase 9, confirmed 31 Oct)

- Cohort page, enrol and pay (payments exist), live sessions with a meeting link, assignments, discussion, weekly nudges, certificate. Launch is the pass; cohorts follow Phase 9.

### Phase 11: WhatsApp channel (2 weeks plus Meta approval)

- **Scope reduced by v1.3:** WhatsApp is a notification and re-entry channel, not a conversational one. Approved templates (welcome, daily Skill Shot, score result, check-in, reminders), signed single-use magic links back into the app, STOP honoured within one message, and a three-branch inbound handler (acknowledge, reply with a link, honour STOP). Reuses the notification outbox and consent tables.
- Needs the same Arya conversation engine from Phase 2.

### Phase 12: SME pipeline (about 4 weeks)

- Registry (self-registered or curator-nominated, profile links supplied by the SME, no scraping, consent captured), gap matching (SME expertise against thin parts of the graph and topics learners asked Arya about), a **curator gate before any outreach**, scheduling with an agenda, a recorded interview with separate timestamped recording consent, then minutes, presentation and Skill Shot drafts from one transcript, and the SME's sign-off before anything attributed to them publishes. Live voice from the start (confirmed 31 Oct), so Phase 7 audio and video transcription and the recording-consent record come first. Builds on Phase 7's transcription and outputs.

### Phase 13: Enterprise portal (4 weeks)

- Tenant model, workforce heatmap, critical gaps, role readiness, manager view, and knowledge-handover projects (capturing the knowledge of people who are moving on), which the home page already promises.
- One pilot organisation, not a general release.

### Later

Rendered video and voice generation agents (HeyGen, Gemini, Veo and Descript toolchain in the Blueprint), more Indian languages, SSO and HRIS, native mobile, advanced workforce planning.

## 6. Start now in parallel (business tracks, lead time is weeks)

- **Meta WhatsApp Business** verification and template approval (needed for Phase 11).
- **Razorpay** account and KYC; decide the GST invoicing approach (Phase 6).
- **Legal and tax review** of the revenue-share terms, then an approved policy; also coach agreements and consent wording for name, voice and likeness.
- **Arya's likeness:** confirm the rights to the portrait and voice for commercial use, and decide whether a commissioned 3D model replaces it.
- **Content production:** the content plan (Blueprint part 10: 60 Skill Shots) and the video toolchain budget; recruit the first coaches for wave 1.
- **Data protection:** consent, retention and deletion wording for interviews, transcripts and learner data under India's DPDP Act, reviewed by counsel.
- **Object storage** for original uploads and any rendered media.

## 7. Decisions needed from the owner

**Confirmed by the owner on 31 Oct 2026** (these are settled; the plan below follows them):

- **Scope: all sources and all dimensions are consolidated into the platform.** Intake covers documents and pasted text, PowerPoint and images, audio and video files, and web and YouTube links (Phase 7). Every skill and Skill Shot is tagged on pillar and level, function and industry, seniority and journey stage, and process and standards tags (APQC, NASSCOM NOS) (Phase 8).
- **Third-party video and articles:** the contributor supplies the transcript or file and attests the rights; the system re-scripts and teaches in its own words and never republishes. Automatic fetching is not built for third parties.
- **First industries** to seed and fill with content: Manufacturing and Industrial, Retail and Consumer Products, Logistics and Supply Chain, and IT Services, GCCs and Professional Services. Manufacturing goes first (it has the trial import); the others follow in that order once the seniority heuristic is fixed.
- **Channel:** web app primary; WhatsApp only notifies and links back (Phase 11, about 2 weeks plus Meta approval).
- **Skill Shot format:** interactive lessons taught by Arya are the standard; rendered video and a video host are added later as a second renderer.
- **Design system:** adopt the v1.3 palette (ink and gold, no purple), Lora and Inter, and dark mode, with an accessibility pass (Phase 9).
- **Cohorts:** pass first, cohorts later (Phase 10 after Phase 9).

- **Creator pay formula:** v1.3's five-part weights (completion 25%, check-in correctness 25%, downstream uplift 30%, learner rating 10%, non-duplication 10%) become the default QVS definition. The business still approves a policy before anything is payable.
- **SME interviews:** live voice from the start (needs transcription and a separate timestamped recording-consent step from day one; Phase 12 depends on Phase 7's transcription).
- **Languages:** English first; Hindi (about a fifth of the library) after Phase 9.
- **Approval:** an editor plus the source's owner (the coach or contributor whose material it is) approve before learners see a Skill Shot or source-based lesson.

**Still open** (each has a proposal):

(D-numbers in later items refer to `docs/v1.3-gap-analysis.md` section 5.)

These were open on 25 Oct and are still open. Each has a proposal, so work can start on the proposals.

1. **Which document governs where they differ** (`docs/context/README.md`). Proposed: Master Build for product and data; Blueprint for channels, payments and content production.
2. **Skills model:** the 7 intelligence families, the 5 THINK/CREATE/LEAD/ADAPT/AI+TECH pillars, or a mapping. Proposed: the families are the Skill Graph; the pillars are a learner-friendly view over it.
3. **Skill Shot format and length:** 3-minute video, about 10-minute multi-format, or the new 5 to 10 minute interactive lesson taught by Arya. Proposed: one object with a format and a duration; the interactive lesson with Arya is the standard now, video is a later renderer.
4. **Database:** Hostinger has MariaDB only. Proposed: stay on MariaDB, keep embeddings in JSON and rank in the app at current scale, revisit at a VPS move.
5. **Creator pay formula:** weighted pool versus the Qualified Value Score (both are built and can be compared in Admin, then Earnings); who approves it.

7. **New:** should Arya's studio voice be paid for from day one (cost per learner) or limited to greetings and coach sessions, with the device voice elsewhere?
14. **New (v1.3):** where the O*NET import script, Manufacturing seed and review report live; they are not in this repository and Phase 8 needs them.

## 8. Technical debt and risks to track

- Original upload files are not retained; only text, location and checksum. Phase 7 needs an object store.
- Silent truncation: the book writer cuts each chapter's source to 9,000 characters and the Skill Shot designer cuts notes to 8,000 without saying what was dropped (breaks v1.3 rule 10). Fixed in Phase 7.
- The interview is the only content door, so every piece of content needs a person to be interviewed (Phase 7).
- The Skill Graph has one axis of six, so discovery by industry, function and seniority is approximate until Phase 8.
- Fraud rules are first-pass and untuned; real traffic will show false positives and gaps.
- Free-tier gating is at page level. The five original Skill Shots ship their content in the browser, so it is a paywall for honest use, not copy protection.
- No formal accessibility audit, load test, real-phone test of Arya, or AI scoring validation yet.
- The 3D engine is a lazy download of about 700 KB; confirm it stays within a mobile data budget.
- Hostinger: one Node slot, no staging, no shell. Every schema change must stay additive, and the quality gate is the only pre-production check. A real staging copy is worth setting up before payments.
- The Problem Solving kit is a copy of an engine used elsewhere and will be copied again for the Eccellere sites; keep it self-contained.
- Designed Skill Shot answers are kept on the learner's device until Phase 1 records them as evidence.
- The demo seed runs in several short requests because the host cuts off long ones; any other long operation (large uploads, AI generation) needs the same care.
- Arya's voice and portrait carry likeness and consent obligations (section 6); the avatar is always labelled as an AI.
