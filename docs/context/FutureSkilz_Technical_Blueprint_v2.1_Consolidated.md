FUTURESKILZ

India ki Future Skills Platform

────────────────────────────────────────────────────────────────────────────────

Agentic AI-First Technical Blueprint

*Conversational · AI-Guided · Micro-Learning · Journey-First · Version 2.0*

────────────────────────────────────────────────────────────────────────────────

**Replacing static course delivery with an AI-guided, WhatsApp-first learning companion**

**Prepared by:** Eccellere Consulting \| FutureSkilz Technical Team

**Date:** May 24, 2026

**Version:** 2.0 — Agentic AI-First Respecification

**Supersedes:** FutureSkilz Technical Blueprint v1.0 (April 2026)

**Classification:** Confidential

PART 1 — THE STRATEGIC PIVOT: WHY AGENTIC AI-FIRST

────────────────────────────────────────────────────────────────────────────────

What Changed — v1.0 vs v2.0

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<thead>
<tr class="header">
<th><blockquote>
<p><strong>STRATEGIC SHIFT</strong></p>
<p><em>v1.0 was a well-built LMS. v2.0 is a learning companion. The platform no longer delivers courses at people — it guides, nudges, and responds to them. Every interaction is conversational. Every skill is demonstrated in a 3-minute video. Every recommendation is AI-generated from the learner's current journey, not a static catalogue.</em></p>
</blockquote></th>
</tr>
</thead>
<tbody>
</tbody>
</table>

| **Dimension**           | **v1.0 — Traditional LMS**        | **v2.0 — Agentic AI-First**                                                                                                        |
|-------------------------|-----------------------------------|------------------------------------------------------------------------------------------------------------------------------------|
| Entry point             | Browse a course catalogue         | AI asks: 'What are you working on right now?'                                                                                      |
| Assessment              | 10-question Gravity Form (static) | Conversational chat assessment — AI asks follow-up questions, adapts in real time                                                  |
| Learning format         | Long-form courses (hours)         | Skill Shots — 2–5 minute micro-videos, consumed on mobile, in the flow of work                                                     |
| Navigation              | Menu-driven, user explores        | AI-guided — platform tells you what to do next based on your journey                                                               |
| Personalisation         | Static course recommendations     | Dynamic — AI agent re-routes based on your latest context, role, and progress                                                      |
| WhatsApp                | Notifications + daily tip         | Primary delivery channel — entire learning journey can happen on WhatsApp                                                          |
| Dashboard               | Progress bars + module list       | Conversational: 'Good morning Priya — you have a team meeting today. Here's a 3-min video on facilitating difficult conversations' |
| MSME / Employee journey | Generic courses                   | Role + situation-specific pathways: 'I'm a first-time manager' or 'I'm about to do a client pitch'                                 |
| Feedback loop           | Quiz scores                       | AI agent tracks confidence, re-serves weak areas, escalates to cohort when needed                                                  |
| Content creator tools   | Manual course builder             | AI assists Vikram Rao in generating Skill Shot scripts, quizzes, and translations from a single prompt                             |

The 3 Defining Principles of v2.0

**Principle 1 — Conversational First**

Every entry point to the platform is a conversation, not a menu. The homepage hero is not 'Browse Courses' — it's a chat prompt: 'Tell me about your situation and I'll find the right skill for today.' The Skills Score assessment is not a form — it's a 5-minute chat where the AI agent asks contextual follow-up questions. The learner dashboard is not a table of modules — it's a chat interface that surfaces what matters right now.

**Principle 2 — Micro-Learning in the Flow of Work**

No Indian professional sits down to complete a 6-hour course. They have 5 minutes before a meeting, 3 minutes in an auto-rickshaw, 4 minutes at lunch. FutureSkilz v2.0 is built around Skill Shots — 2 to 5 minute focused videos that teach one technique, one mental model, or one tool, immediately applicable to what the learner is doing that day. Skill Shots are organized by work situations ('I need to say no to my manager'), not by academic subject ('Module 3.4: Assertive Communication Theory').

**Principle 3 — Journey-Aware, Not Just Progress-Aware**

A traditional LMS knows how far you are through a course. An AI-first platform knows where you are in your life. Are you a first-time manager this month? An MSME owner about to pitch for a loan? A graduate preparing for your first appraisal? FutureSkilz v2.0 maps the learner's declared journey and surfaces the right 3-minute video at the right moment — via WhatsApp, the web, or email.

PART 2 — AGENTIC AI ARCHITECTURE

────────────────────────────────────────────────────────────────────────────────

System Architecture — Agentic AI Layer Added

> ┌──────────────────────────────────────────────────────────────────────────┐
>
> │ FUTURESKILZ v2.0 PLATFORM │
>
> ├──────────────────────┬───────────────────────────┬───────────────────────┤
>
> │ WORDPRESS (CMS/LMS) │ NODE.JS AGENT SERVICE │ EXTERNAL SERVICES │
>
> │ futureskilz.in │ api.futureskilz.in │ │
>
> │ │ │ LLM API │
>
> │ Kadence Theme │ AI CONVERSATION ENGINE │ (Groq llama-3.3-70b │
>
> │ TutorLMS Pro │ ├─ /api/chat │ or OpenAI GPT-4o │
>
> │ WooCommerce │ ├─ /api/assess/start │ or Google Gemini) │
>
> │ FluentCRM │ ├─ /api/assess/reply │ │
>
> │ Rank Math SEO │ ├─ /api/assess/score │ Bunny.net CDN │
>
> │ LiteSpeed Cache │ └─ /api/assess/report │ (Skill Shot videos) │
>
> │ │ │ │
>
> │ MySQL (WP tables) │ SKILL SHOT ENGINE │ WhatsApp Cloud API │
>
> │ tutor\_\* tables │ ├─ /api/skillshot/next │ (Meta Business) │
>
> │ wc\_\* tables │ ├─ /api/skillshot/done │ │
>
> │ │ └─ /api/skillshot/whatsapp│ Brevo Email API │
>
> │ │ │ │
>
> │ │ JOURNEY ENGINE │ Razorpay API │
>
> │ │ ├─ /api/journey/set │ (Payments) │
>
> │ │ ├─ /api/journey/next │ │
>
> │ │ └─ /api/journey/summary │ GA4 Measurement API │
>
> │ │ │ │
>
> │ │ WEBHOOK HANDLERS │ │
>
> │ │ ├─ /webhook/razorpay │ │
>
> │ │ └─ /webhook/whatsapp │ │
>
> └──────────────────────┴───────────────────────────┴───────────────────────┘
>
> WhatsApp ─────────────► /webhook/whatsapp ──► AI Conversation Engine
>
> Web Chat widget ──────► /api/chat ──────────► LLM API ──► Response
>
> Mobile app (Phase 3) ──► /api/journey/next ──► Skill Shot served

The AI Conversation Engine — Core Component

The AI Conversation Engine is the heart of the v2.0 platform. It is a Node.js service that orchestrates multi-turn conversations with learners using a Large Language Model (LLM). It maintains conversation memory (context window), knows the learner's journey state, score, and enrolled courses, and can retrieve relevant Skill Shots from the content library.

| **Component**                   | **Technology**                                               | **Purpose**                                                                                                                                                   |
|---------------------------------|--------------------------------------------------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------|
| LLM Provider (primary)          | Groq API — llama-3.3-70b-versatile                           | Ultra-fast inference (\<300ms). Free tier generous. Switch to OpenAI GPT-4o if richer reasoning needed. Cost: ~\$0.001 per conversation turn at Groq pricing. |
| LLM Provider (fallback)         | OpenAI GPT-4o-mini                                           | Fallback if Groq rate-limited. More capable for complex reasoning. Cost: ~\$0.003 per turn.                                                                   |
| Conversation memory             | Redis (Hostinger VPS or Upstash free tier)                   | Stores last 10 conversation turns per user session. Session TTL: 24 hours.                                                                                    |
| Prompt engineering              | System prompt + few-shot examples in Node.js                 | Defines the AI agent's persona (name: 'Arya'), tone (warm, Indian context), and tool-use instructions.                                                        |
| Tool calling / function calling | LLM function calling (OpenAI spec)                           | Agent can call: get_user_score(), get_next_skillshot(), get_journey_stage(), recommend_cohort(), get_article().                                               |
| Skill Shot retrieval            | Vector similarity search (optional) or keyword tags in MySQL | Finds the most relevant 2–5 min video for the learner's current context. Phase 1: tag-based. Phase 2: vector search.                                          |
| WhatsApp integration            | Meta WhatsApp Cloud API webhook → Node.js                    | All WhatsApp messages from learners routed to the AI Conversation Engine. Replies sent back via Meta API.                                                     |
| Web chat widget                 | Custom React component (served as WordPress shortcode)       | Embedded on website. Talks to /api/chat. State stored in localStorage + server session.                                                                       |
| Context injection               | Learner profile loaded on each conversation start            | Agent knows: name, pillar scores, current journey, enrolled courses, last Skill Shot watched, days since last login.                                          |

AI Agent Persona — 'Arya'

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<thead>
<tr class="header">
<th><blockquote>
<p><strong>AI AGENT DESIGN — ARYA</strong></p>
<p><em>The AI agent has a name and personality: Arya. She is a warm, direct, India-aware learning companion who speaks plainly in English (with occasional Hindi phrases), understands the realities of Indian workplaces, and is never condescending. She asks one question at a time. She always surfaces a concrete next action — a Skill Shot to watch, a cohort to join, or an article to read. She never gives a generic response.</em></p>
</blockquote></th>
</tr>
</thead>
<tbody>
</tbody>
</table>

**Arya's System Prompt (Core)**

> You are Arya, a learning companion at FutureSkilz — India's future skills platform.
>
> Your mission: help every Indian professional, graduate, and MSME owner build the
>
> skills they need to thrive in the AI era.
>
> Rules:
>
> 1\. Always ask ONE question at a time. Never overwhelm.
>
> 2\. Always ground your response in the learner's specific situation.
>
> 3\. Always end with a concrete action: a Skill Shot, article, or cohort.
>
> 4\. Use warm, plain English. Hindi phrases are welcome (e.g. 'Bilkul!' for 'Absolutely!').
>
> 5\. Never recommend more than 3 things at once.
>
> 6\. If the learner is stuck, ask: 'Can you tell me more about that?'
>
> 7\. You know the learner's pillar scores. Reference them naturally: 'Your LEAD score
>
> is strong — let's build on that.'
>
> Context about this learner:
>
> Name: {{name}} \| Scores: {{pillar_scores}} \| Journey: {{journey_stage}}
>
> Last Skill Shot watched: {{last_skillshot}} \| Enrolled: {{enrolled_courses}}

PART 3 — SKILL SHOTS: MICRO-VIDEO SPECIFICATION

────────────────────────────────────────────────────────────────────────────────

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<thead>
<tr class="header">
<th><blockquote>
<p><strong>SKILL SHOT DEFINITION</strong></p>
<p><em>A Skill Shot is a 2–5 minute video that teaches one practical technique, mental model, or tool. It is indexed by work situation (not subject), pillar, and journey stage. It can be watched in an auto-rickshaw. It has a 1-question check-in at the end. It can be delivered via WhatsApp, web, or email. It replaces the traditional 'lesson'.</em></p>
</blockquote></th>
</tr>
</thead>
<tbody>
</tbody>
</table>

Skill Shot Content Architecture

| **Attribute**                | **Specification**                                                                                                                                                                                        |
|------------------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Duration                     | 2–5 minutes. Strict. No exceptions. 3 minutes is ideal.                                                                                                                                                  |
| Format                       | Talking-head (Vikram or guest) + screen text overlay. Optional B-roll. Shot on phone — no studio needed. Authentic \> polished.                                                                          |
| Structure (every Skill Shot) | 0:00–0:20 — Hook: one real work situation. 0:20–0:40 — The problem it creates. 0:40–3:30 — The technique (3 steps max). 3:30–4:00 — Try this today (1 specific action). 4:00–4:30 — 1-question check-in. |
| Language                     | English (primary). Hindi Skill Shots for 20% of library (Phase 2). Simple language — no jargon.                                                                                                          |
| Video hosting                | Bunny.net Stream (Phase 1) — ₹500/month for up to 500 hours. Embedded via iframe. No YouTube (prevents distraction by algorithm).                                                                        |
| File format                  | MP4, H.264, 720p minimum. 1080p preferred. Subtitles (SRT) mandatory for accessibility.                                                                                                                  |
| Thumbnail                    | Custom branded thumbnail: pillar colour + situation text + Skill Shot badge. Template in Canva.                                                                                                          |
| Check-in question            | 1 MCQ or rating after video. Stored in MySQL. Used by AI agent to track mastery.                                                                                                                         |
| Indexing                     | Tagged with: Pillar \| Journey Stage \| Work Situation \| Role \| Level (Foundation/Practitioner) \| Format (individual/manager/MSME).                                                                   |
| AI script assist             | Vikram inputs the work situation + key technique → AI generates a structured script → Vikram records → 1 take or 2.                                                                                      |

Skill Shot Library — Phase 1 Content Plan

Target: 60 Skill Shots at launch. 5 per pillar × 3 journey stages × 2 role tracks (Individual + MSME). Built in 8 weeks pre-launch.

<table>
<colgroup>
<col style="width: 33%" />
<col style="width: 33%" />
<col style="width: 33%" />
</colgroup>
<thead>
<tr class="header">
<th><strong>Pillar</strong></th>
<th><strong>Work Situation Examples (3 min each)</strong></th>
<th><strong>Count</strong></th>
</tr>
</thead>
<tbody>
<tr class="odd">
<td>THINK — Analytical</td>
<td>'I need to make a decision with incomplete data'<br />
'My team keeps solving the wrong problem'<br />
'I'm trying to prioritise but everything feels urgent'<br />
'I need to present a recommendation to my boss'<br />
'I keep getting stuck in analysis paralysis'</td>
<td>12</td>
</tr>
<tr class="even">
<td>CREATE — Creative Thinking</td>
<td>'I need a fresh idea for a stagnant product'<br />
'My team brainstorming sessions produce nothing useful'<br />
'I need to think differently about a customer complaint'<br />
'I want to innovate but my boss says no'<br />
'I have an idea but can't articulate it clearly'</td>
<td>12</td>
</tr>
<tr class="odd">
<td>LEAD — Leadership</td>
<td>'I'm a first-time manager and don't know how to give feedback'<br />
'I need to motivate a team that's lost energy'<br />
'I have to say no to a senior stakeholder'<br />
'My team has a conflict I need to resolve'<br />
'I need to inspire, not just instruct'</td>
<td>12</td>
</tr>
<tr class="even">
<td>ADAPT — Resilience &amp; Agility</td>
<td>'I just got negative feedback and I'm rattled'<br />
'My role is changing fast and I feel behind'<br />
'I keep getting distracted and losing focus'<br />
'I'm afraid of being replaced by AI'<br />
'I failed at something and need to recover'</td>
<td>12</td>
</tr>
<tr class="odd">
<td>AI+TECH — AI Fluency</td>
<td>'I don't know where to start with AI'<br />
'I want to use AI for my MSME but don't know which tools'<br />
'I tried ChatGPT but it gave me rubbish outputs'<br />
'I need to write a better prompt'<br />
'I want to automate one task in my business today'</td>
<td>12</td>
</tr>
</tbody>
</table>

Journey-Indexed Skill Shot Map

Each Skill Shot is tagged to a Journey Stage — the learner's declared life/work context. This is how the AI agent finds the right video.

| **Journey Stage**      | **Who It's For**                              | **Skill Shot Trigger**                                                                           |
|------------------------|-----------------------------------------------|--------------------------------------------------------------------------------------------------|
| New Graduate           | 18–25, first job or job search                | 'About to do my first appraisal' / 'In my first job' / 'Preparing for an interview'              |
| First-Time Manager     | Promoted or leading a team for the first time | 'Just got promoted' / 'First team meeting tomorrow' / 'First difficult conversation'             |
| Mid-Career Accelerator | 5–12 years experience, stuck or plateaued     | 'Want to move up' / 'Need to be seen as strategic' / 'Presenting to leadership'                  |
| MSME Founder / Owner   | Running or starting a small business          | 'About to pitch to a bank' / 'Hiring my first employee' / 'Lost a big client'                    |
| MSME Team Member       | Employee at a small business                  | 'My boss needs me to think more' / 'Customer escalation' / 'Learning new tools'                  |
| Corporate Manager      | Team lead at a large company                  | 'Running a strategy session' / 'Managing up' / 'Building a high-performance team'                |
| Career Returner        | Women returning after a break                 | 'How to re-enter the workplace' / 'Negotiating my first role back' / 'Building confidence again' |

PART 4 — CONVERSATIONAL SKILLS ASSESSMENT

────────────────────────────────────────────────────────────────────────────────

The static 10-question Gravity Form from v1.0 is replaced by a conversational AI assessment. Arya conducts a natural 5–8 minute dialogue that scores all 5 pillars, captures richer context than a form can, and feels like talking to a knowledgeable friend.

Conversation Flow — Skills Assessment

**Phase 1: Context Setting (1–2 minutes)**

> Arya: 'Hi! I'm Arya, your FutureSkilz guide. To find the right skills for you,
>
> I'd love to understand your situation first.'
>
> Arya: 'What are you focused on right now — your career, your business,
>
> or are you still figuring that out?' \[3 options + free text\]
>
> → Learner picks 'My career — I'm a mid-level manager'
>
> Arya: 'Got it. What's the one thing that's hardest about your job right now?'
>
> → Learner types: 'Getting my team to think independently instead of asking
>
> me everything'
>
> → AI extracts signals: LEAD pillar (low), THINK pillar (could relate to team)
>
> Injects into context window for scoring

**Phase 2: Pillar Probing (3–4 minutes, 1 question per pillar)**

> Arya: 'When you have a complex problem at work — like the team dependency issue
>
> you mentioned — what does your typical approach look like?'
>
> → Scores THINK pillar from answer quality and keywords
>
> Arya: 'When did you last come up with an idea that changed how something was done?'
>
> → Scores CREATE pillar
>
> Arya: 'Describe a recent moment where you had to influence someone without authority.'
>
> → Scores LEAD pillar
>
> Arya: 'How do you typically handle it when things don't go to plan?'
>
> → Scores ADAPT pillar
>
> Arya: 'How are you currently using AI in your work — or why haven't you started?'
>
> → Scores AI+TECH pillar

**Phase 3: Scoring & Instant Feedback (1 minute)**

> → All 5 answers sent to /api/assess/score
>
> → LLM scores each on 0–100 scale using rubric in system prompt
>
> → Composite computed, report_token generated, lead captured
>
> Arya: 'Here's your Future Skills snapshot:'
>
> \[Radar chart rendered in chat widget\]
>
> 'Your strongest area is ADAPT (78). Your biggest growth opportunity is LEAD (42).'
>
> 'I've found 3 Skill Shots specifically for your situation as a mid-level manager.'
>
> 'Want me to send your full report and first Skill Shot to WhatsApp or email?'

LLM Scoring Rubric (Embedded in System Prompt)

| **Score Band**     | **Behavioural Indicators**                                                                                             |
|--------------------|------------------------------------------------------------------------------------------------------------------------|
| 80–100 (Strength)  | Specific examples, structured thinking, proactive mindset, evidence of consistent application, teaches others          |
| 60–79 (Developing) | General awareness, some examples, inconsistent application, reactive rather than proactive                             |
| 40–59 (Emerging)   | Knows the concept but struggles to apply, examples are weak or abstract, avoids the area                               |
| 0–39 (Priority)    | No clear examples, avoidance language ('I don't really do that'), confusion about the concept, blames external factors |

API Endpoints — Conversational Assessment

| **Method** | **Endpoint**              | **Description**                                                                                         |
|------------|---------------------------|---------------------------------------------------------------------------------------------------------|
| POST       | /api/assess/start         | Creates session, returns first message from Arya, sets context                                          |
| POST       | /api/assess/reply         | Accepts learner message, returns Arya's next message, updates pillar signals in session                 |
| POST       | /api/assess/score         | After 5 pillar questions answered: calls LLM to score all 5, computes composite, generates report token |
| POST       | /api/assess/capture       | Accepts email/phone after score shown, sends report, creates FluentCRM contact                          |
| GET        | /api/assess/report/:token | Returns full JSON report for email link rendering                                                       |
| POST       | /api/chat                 | General-purpose Arya chat for dashboard, WhatsApp, and web widget (not assessment-specific)             |

PART 5 — WHATSAPP-FIRST LEARNING JOURNEY

────────────────────────────────────────────────────────────────────────────────

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<thead>
<tr class="header">
<th><blockquote>
<p><strong>WHATSAPP AS PRIMARY CHANNEL</strong></p>
<p><em>For most Indian learners — especially MSME owners, graduates in Tier-2/3 cities, and women returning to work — WhatsApp is more natural than a website. FutureSkilz v2.0 treats WhatsApp as a first-class delivery channel, not an add-on. A learner can take the assessment, receive Skill Shots, track progress, and enrol in a cohort entirely through WhatsApp.</em></p>
</blockquote></th>
</tr>
</thead>
<tbody>
</tbody>
</table>

Complete WhatsApp User Journey

| **Step**                | **Trigger**                                 | **Message / Interaction**                                                                                                                                                    | **System Action**                                           |
|-------------------------|---------------------------------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|-------------------------------------------------------------|
| 1\. Discovery           | Learner sends 'HELLO' to FutureSkilz number | Arya: 'Namaste! I'm Arya from FutureSkilz. I help Indians build future skills. Shall I find the right skills for you? Reply YES to start.'                                   | Creates lead record, starts onboarding flow                 |
| 2\. Journey Selection   | Learner replies YES                         | Arya: 'Great! Tell me — are you a: 1) Professional/Employee 2) MSME Owner 3) Graduate 4) Something else?'                                                                    | Sets journey_stage in DB based on reply                     |
| 3\. Quick Assessment    | Journey selected                            | Arya asks 5 conversational questions (one per pillar). Friendly, 2 minutes total. No forms.                                                                                  | Scores 5 pillars, generates composite, stores in DB         |
| 4\. Score Delivery      | Scoring complete                            | Arya: 'Your Future Skills Score: THINK 72 \| CREATE 58 \| LEAD 45 \| ADAPT 80 \| AI+TECH 38. Your priority: AI+TECH. Here's your first Skill Shot:' \[Bunny.net video link\] | Sends video link, marks first Skill Shot served             |
| 5\. Daily Skill Shot    | 8:00 AM IST, weekdays                       | Arya: 'Good morning \[Name\]! Today's 3-minute Skill Shot for you: \[situation-title\] \[link\]. Let me know when you've watched it!'                                        | node-cron job, personalised per journey stage               |
| 6\. Post-Watch Check-in | Learner replies 'Done' or 'Watched'         | Arya: 'Excellent! Quick question: \[1-question MCQ related to video\]. Reply A, B, or C.'                                                                                    | Records completion + check-in answer, updates mastery score |
| 7\. Cohort Invitation   | After 5 Skill Shots in a pillar             | Arya: 'You've been building your LEAD skills for a week. There's a live 8-week cohort starting \[date\]. Only 12 seats. Want details?'                                       | Triggers cohort invite sequence in FluentCRM                |
| 8\. Purchase Flow       | Learner says YES to cohort                  | Arya: 'Here's the link to reserve your seat: \[WooCommerce product link\]. Razorpay accepts UPI, cards, EMI.'                                                                | Sends WooCommerce checkout link                             |
| 9\. Cohort Support      | While enrolled in cohort                    | Weekly Arya messages: assignment reminders, reflection prompts, peer challenge nudges                                                                                        | FluentCRM automation + Arya chat                            |
| 10\. Certificate        | Course/cohort completed                     | Arya: 'Congratulations \[Name\]! Your certificate is ready: \[link\]. Share it on LinkedIn!'                                                                                 | TutorLMS certificate generated, link sent via WhatsApp      |
| STOP                    | Learner sends STOP anytime                  | Arya: 'You've been unsubscribed. Your account is saved — come back anytime at futureskilz.in'                                                                                | Opt-out recorded, no further messages                       |

WhatsApp Message Templates (Pre-approved by Meta)

| **Template Name**            | **Category** | **Content**                                                                                                                             |
|------------------------------|--------------|-----------------------------------------------------------------------------------------------------------------------------------------|
| futureskilz_welcome          | UTILITY      | Namaste {{1}}! I'm Arya from FutureSkilz. Ready to discover your future skills? Reply YES to start your free assessment.                |
| futureskilz_skillshot_daily  | MARKETING    | Good morning {{1}}! Today's 3-min Skill Shot: '{{2}}' — perfect for your journey as a {{3}}. Watch here: {{4}}                          |
| futureskilz_score_result     | UTILITY      | Your Future Skills Score is ready, {{1}}! Top strength: {{2}} ({{3}}). Priority area: {{4}} ({{5}}). Full report: {{6}}                 |
| futureskilz_cohort_invite    | MARKETING    | {{1}}, you've been building your {{2}} skills for {{3}} days. Our next live cohort starts {{4}} — only {{5}} seats left. Details: {{6}} |
| futureskilz_certificate      | UTILITY      | Congratulations {{1}}! You've earned your FutureSkilz {{2}} certificate. Download and share: {{3}}                                      |
| futureskilz_checkin_question | UTILITY      | Quick check-in after your Skill Shot: {{1}} Reply A, B, or C.                                                                           |
| futureskilz_cohort_reminder  | UTILITY      | Reminder, {{1}}: Your {{2}} cohort {{3}} starts in {{4}}. Join here: {{5}}                                                              |

PART 6 — PAGE REDESIGN: AI-FIRST UX

────────────────────────────────────────────────────────────────────────────────

Homepage — v2.0 Changes

**The v1.0 homepage was a course catalogue with a Skills Score CTA. The v2.0 homepage leads with conversation.**

| **Section**             | **v1.0 Spec**                                        | **v2.0 Spec — What Changed**                                                                                                                          |
|-------------------------|------------------------------------------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------|
| Hero CTA                | 'Discover Your Skills Score →' button to a form page | Conversational chat prompt EMBEDDED in the hero: 'Tell Arya what you're working on…' \[chat input box\]. No redirect. Immediate response from Arya.   |
| Navigation              | For Individuals \| For MSMEs \| Courses \| Blog      | Journey-first nav: 'I'm a…' dropdown (Graduate / Manager / MSME / Corporate) that routes to personalised landing page. Courses becomes 'Skill Shots'. |
| 5 Pillars               | 5 icon tiles → link to pillar page                   | 5 tiles now show: pillar name + 1 example work situation + '3-min video →' link. Makes it tangible, not abstract.                                     |
| Course catalogue teaser | 3 course cards with price and enrol button           | REMOVED. Replaced by '3 Skill Shots for you today' — AI-selected based on India average journey profile for anonymous visitors.                       |
| Impact counters         | Students enrolled, certifications issued             | Add: Skill Shots delivered this week \| Arya conversations today \| WhatsApp learners active                                                          |
| WhatsApp CTA            | Single line CTA below fold                           | Prominent section: 'Start learning on WhatsApp — the way 900 million Indians already work. Send HELLO to +91-XXXXXXXXXX.' QR code + button.           |

New Page: 'My Journey' (Replaces 'Learner Dashboard')

The dashboard concept is replaced by 'My Journey' — a conversational, AI-powered personal page that feels alive, not like a report card.

| **Section**                        | **Description**                                                                                                                                                                           |
|------------------------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Arya Chat Panel (left 40%)         | Persistent chat with Arya. Entry point for everything: 'What should I do today?' / 'Find me a Skill Shot on negotiation' / 'How am I doing?'. Context-aware — Arya knows your full state. |
| Journey Map (right 60%)            | Visual timeline of the learner's declared journey. Milestones: Skill Shots watched \| Pillars strengthened \| Cohorts completed \| Certificates earned. Not a progress bar — a story.     |
| Today's Recommendation             | Arya's top pick for today: 1 Skill Shot + reason why ('You have a team meeting today. Here's a 3-min video on running effective standups.')                                               |
| Skill Shots Library (filter panel) | Filterable by: Pillar \| Work Situation \| Duration. Shows watched (greyed) vs unwatched. Continues from where learner left off.                                                          |
| Upcoming Live Sessions             | Cohort sessions the learner is enrolled in. Zoom link + pre-read material. Arya sends reminder 30 min before.                                                                             |
| My Certificates                    | Earned certificates with LinkedIn share button. WEF framework badge visible.                                                                                                              |
| Streak & Momentum                  | Days-in-a-row streak (like Duolingo). Arya acknowledges streaks: 'Day 7! You're building a habit. That's the hardest part — you've done it.'                                              |

New Page: 'Skill Shots' (Replaces 'All Courses')

| **Section**       | **Description**                                                                                                                                                                |
|-------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Hero              | '2–5 minutes. One skill. Right now.' Sub: 'Find the Skill Shot for what you're dealing with today.' Chat input: 'What's your work situation?' → Arya recommends.               |
| Situation Search  | Freetext search: 'I need to…' or 'I'm dealing with…' — AI matches to relevant Skill Shot using tag search (Phase 1) or vector search (Phase 2).                                |
| Browse by Pillar  | 5 pillar tabs. Under each: situation tiles (not module names). E.g. under LEAD: 'Giving feedback for the first time' \| 'Managing conflict' \| 'Motivating a disengaged team'. |
| Browse by Journey | Journey stage tabs: New Graduate \| First-Time Manager \| MSME \| Mid-Career \| Returner. Pre-filtered to relevant Skill Shots.                                                |
| Free vs Unlocked  | First 2 Skill Shots per pillar free. Explorer subscription unlocks all. Individual Skill Shot purchase not available — subscription only.                                      |
| Video Player Page | Clean player. Video title + situation. 1-question check-in after. Arya comment below: 'Try this technique in your next meeting. Come back and tell me how it went.'            |

PART 7 — UPDATED TECHNOLOGY STACK

────────────────────────────────────────────────────────────────────────────────

Changes from v1.0 to v2.0

| **Component**       | **v1.0 Spec**                       | **v2.0 Spec**                                                                                | **Change Reason**                                                                              |
|---------------------|-------------------------------------|----------------------------------------------------------------------------------------------|------------------------------------------------------------------------------------------------|
| Assessment          | Gravity Forms (static Likert scale) | Conversational LLM (Arya via Node.js)                                                        | Conversational assessment is more engaging, captures richer signals, no plugin cost            |
| LLM API             | Not present                         | Groq API (primary) + OpenAI GPT-4o-mini (fallback)                                           | Core of the agentic experience                                                                 |
| Conversation Memory | Not present                         | Redis (Upstash free tier — 10K requests/day free)                                            | Maintains context across multi-turn conversations                                              |
| Video Hosting       | YouTube embeds (unlisted)           | Bunny.net Stream (~₹500/month)                                                               | No YouTube algorithm distraction. Better analytics. Faster in India. Auto-subtitle generation. |
| Chat Widget         | Not present                         | Custom React component (compiled to single JS file, WordPress shortcode)                     | Embedded Arya chat on all pages                                                                |
| Gravity Forms       | ₹5,000/yr                           | REMOVED — Arya replaces the assessment form                                                  | Cost saving + better UX                                                                        |
| FluentCRM           | Retained                            | Retained — now also receives conversation topic tags from Arya                               | Segmentation gets richer                                                                       |
| WhatsApp            | Notification add-on                 | Primary delivery channel — full conversation loop                                            | Central to the v2.0 experience                                                                 |
| Node.js app         | 1 app (scoring + webhooks)          | 1 app (now includes: LLM orchestration, Skill Shot engine, Journey engine, WhatsApp handler) | Same 1 of 5 Hostinger slots — more functionality                                               |
| Redis               | Not present                         | Upstash Redis (free tier: 10K requests/day; \$10/mo for growth)                              | Session memory for Arya conversations                                                          |

Updated Annual Cost Estimate

| **Item**                | **v1.0 Cost**     | **v2.0 Cost**                                                                                                                   | **Delta**          |
|-------------------------|-------------------|---------------------------------------------------------------------------------------------------------------------------------|--------------------|
| Hostinger Business Plan | ~₹4,000/mo        | ~₹4,000/mo                                                                                                                      | No change          |
| TutorLMS Pro            | \$149/yr          | \$149/yr                                                                                                                        | No change          |
| Gravity Forms           | \$59/yr           | REMOVED                                                                                                                         | -₹5,000/yr         |
| Bunny.net Stream        | Not present       | ~₹500/mo (500 hrs)                                                                                                              | +₹6,000/yr         |
| Groq API (LLM)          | Not present       | ~₹1,500–3,000/mo at 10K daily convos (very low cost)                                                                            | +₹18,000–36,000/yr |
| Upstash Redis           | Not present       | Free–\$10/mo                                                                                                                    | +₹0–10,000/yr      |
| WhatsApp Cloud API      | Free 1K convos/mo | ~₹2,000–5,000/mo beyond free tier at scale                                                                                      | +₹24,000–60,000/yr |
| TOTAL FIXED (Year 1)    | ~₹1.1–1.2L/yr     | ~₹1.4–1.8L/yr                                                                                                                   | +₹30–60K/yr        |
| Note                    | —                 | The LLM cost is negligible at launch scale (Groq free tier covers first 1,000 conversations/day). Costs rise only with success. |                    |

LLM Provider Comparison

| **Provider**     | **Model**               | **Speed**            | **Cost (per 1K tokens)**                                           | **Recommendation**                                                           |
|------------------|-------------------------|----------------------|--------------------------------------------------------------------|------------------------------------------------------------------------------|
| Groq             | llama-3.3-70b-versatile | Ultra-fast (\<300ms) | ~\$0.0006 input / \$0.0009 output — effectively free at low volume | PRIMARY — use for all Arya conversations. Free tier very generous.           |
| OpenAI           | GPT-4o-mini             | Fast (\<800ms)       | ~\$0.0015 input / \$0.006 output                                   | FALLBACK — use if Groq rate-limited or for complex scoring rubric evaluation |
| Google Gemini    | Gemini 1.5 Flash        | Fast                 | ~\$0.00015 input / \$0.0006 output                                 | OPTION — cheapest option. Good for high-volume scenarios.                    |
| Anthropic Claude | Claude 3 Haiku          | Fast                 | ~\$0.0008 input / \$0.004 output                                   | NOT RECOMMENDED for Phase 1 — adds complexity. Consider Phase 3.             |

PART 8 — UPDATED DATABASE DESIGN

────────────────────────────────────────────────────────────────────────────────

New Tables for Agentic AI Layer

**Table: fs_conversations**

> CREATE TABLE fs_conversations (
>
> id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
>
> session_id VARCHAR(64) NOT NULL,
>
> user_email VARCHAR(255),
>
> wp_user_id BIGINT UNSIGNED,
>
> channel ENUM('web','whatsapp','email') NOT NULL DEFAULT 'web',
>
> conv_type ENUM('assessment','general','skillshot','journey') NOT NULL,
>
> message_count SMALLINT UNSIGNED DEFAULT 0,
>
> started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
>
> last_msg_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
>
> completed BOOLEAN DEFAULT FALSE,
>
> INDEX idx_session (session_id),
>
> INDEX idx_email (user_email)
>
> );

**Table: fs_skillshots**

> CREATE TABLE fs_skillshots (
>
> id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
>
> title VARCHAR(200) NOT NULL,
>
> situation VARCHAR(300) NOT NULL, -- 'I need to give feedback to a poor performer'
>
> pillar ENUM('THINK','CREATE','LEAD','ADAPT','AI_TECH') NOT NULL,
>
> journey_stage VARCHAR(50), -- 'first_time_manager','msme_owner', etc.
>
> level ENUM('foundation','practitioner') DEFAULT 'foundation',
>
> duration_sec SMALLINT UNSIGNED, -- video duration in seconds
>
> bunny_video_id VARCHAR(100), -- Bunny.net Stream video ID
>
> thumbnail_url VARCHAR(500),
>
> checkin_q TEXT, -- the 1 check-in question text
>
> checkin_opts JSON, -- \[{label:'A',text:'...',correct:true},...\]
>
> tags JSON, -- \['negotiation','salary','manager'\]
>
> is_free BOOLEAN DEFAULT FALSE,
>
> language ENUM('en','hi') DEFAULT 'en',
>
> created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
>
> FULLTEXT INDEX ft_situation (situation, title, tags(200))
>
> );

**Table: fs_skillshot_views**

> CREATE TABLE fs_skillshot_views (
>
> id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
>
> user_email VARCHAR(255),
>
> wp_user_id BIGINT UNSIGNED,
>
> skillshot_id BIGINT UNSIGNED NOT NULL,
>
> channel ENUM('web','whatsapp') DEFAULT 'web',
>
> watch_pct TINYINT UNSIGNED, -- % of video watched (from Bunny.net webhook)
>
> checkin_ans TINYINT UNSIGNED, -- index of answer chosen
>
> checkin_correct BOOLEAN,
>
> watched_at DATETIME DEFAULT CURRENT_TIMESTAMP,
>
> FOREIGN KEY (skillshot_id) REFERENCES fs_skillshots(id),
>
> INDEX idx_user_email (user_email)
>
> );

**Table: fs_journeys**

> CREATE TABLE fs_journeys (
>
> id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
>
> user_email VARCHAR(255),
>
> wp_user_id BIGINT UNSIGNED,
>
> journey_stage VARCHAR(50) NOT NULL, -- 'first_time_manager'
>
> declared_at DATETIME DEFAULT CURRENT_TIMESTAMP,
>
> current_focus VARCHAR(50), -- pillar currently prioritised
>
> streak_days SMALLINT UNSIGNED DEFAULT 0,
>
> last_active DATE,
>
> whatsapp_optin BOOLEAN DEFAULT FALSE,
>
> whatsapp_num VARCHAR(20),
>
> INDEX idx_email (user_email)
>
> );

PART 9 — UPDATED SPRINT PLAN (AGENTIC AI-FIRST BUILD)

────────────────────────────────────────────────────────────────────────────────

The v2.0 sprint plan reflects the agentic-first architecture. The AI Conversation Engine and Skill Shot system are built earlier (Sprint 4–5) because they are the core platform differentiator. WordPress/LMS remains the backend for content and payments but the front door is always Arya. Total: 12 sprints × 2 weeks = 24 weeks (~6 months) to full launch.

| **Sprint** | **Name**                             | **Weeks** | **Key Deliverable**                                                 | **Revenue Gate** |
|------------|--------------------------------------|-----------|---------------------------------------------------------------------|------------------|
| 1          | Foundation & Environment             | 1–2       | Hostinger + WordPress + Node.js + Redis + Bunny.net all provisioned | No               |
| 2          | Brand, Design & Global Components    | 3–4       | Kadence brand applied, Arya chat widget shell live (no LLM yet)     | No               |
| 3          | Skill Shots Content & Library        | 5–6       | 60 Skill Shots recorded, uploaded to Bunny.net, tagged in DB        | No               |
| 4          | AI Conversation Engine — Arya Core   | 7–8       | Arya live on website: general chat + assessment conversation        | No               |
| 5          | Conversational Assessment End-to-End | 9–10      | Assessment → scores → radar chart → report email. FluentCRM sync.   | Lead gen live    |
| 6          | Skill Shot Delivery — Web & WhatsApp | 11–12     | Skill Shots on website + Arya daily WhatsApp delivery               | No               |
| 7          | Journey Engine + My Journey Page     | 13–14     | Journey declaration, personalised Skill Shot feed, streak tracking  | No               |
| 8          | Payments — WooCommerce + Razorpay    | 15–16     | Explorer subscription + cohort checkout + GST invoicing             | REVENUE BEGINS   |
| 9          | MSME Hub + Corporate Pages           | 17–18     | MSME journey, MSME diagnostic, B2B enquiry, industry bundles        | B2B pipeline     |
| 10         | Cohort Delivery System               | 19–20     | TutorLMS cohort mode, Zoom integration, cohort comms (Arya-led)     | Cohort revenue   |
| 11         | Blog, SEO & Content Engine           | 21–22     | 5 articles, Rank Math, sitemap, schema, Hindi Phase 1               | Organic growth   |
| 12         | QA, Performance & Launch             | 23–24     | Lighthouse ≥80 mobile, 0 broken links, Razorpay live, go-live       | Full capability  |

Sprint Detail — Key Agentic Sprints

**Sprint 4 — AI Conversation Engine — Arya Core (Weeks 7–8)**

**Goal: Arya is live and responsive on the FutureSkilz website as a chat widget. She can hold a general conversation, understand learner context, and respond with relevant Skill Shot recommendations.**

| **\#** | **User Story**                                                                                                                     | **Effort** | **Priority** |
|--------|------------------------------------------------------------------------------------------------------------------------------------|------------|--------------|
| 4.1    | As a visitor, I can open the Arya chat widget on any page and send a message, receiving a response in \<3 seconds                  | XL         | Critical     |
| 4.2    | As a dev, the Node.js /api/chat endpoint calls Groq API with learner context injected in system prompt and returns Arya's response | XL         | Critical     |
| 4.3    | As a dev, conversation session is stored in Upstash Redis with 24hr TTL so Arya remembers what was said in the same session        | L          | Critical     |
| 4.4    | As a learner, Arya can recommend a specific Skill Shot from the library based on what I describe as my work situation              | L          | Critical     |
| 4.5    | As a learner, Arya's chat widget is mobile-optimised — full screen on mobile, corner popup on desktop                              | M          | Critical     |
| 4.6    | As a dev, Groq API key is stored in environment variables, not in code. Fallback to OpenAI if Groq returns 429 rate limit          | M          | Critical     |
| 4.7    | As a visitor on WhatsApp, sending any message to the FutureSkilz number routes to the same Arya conversation engine                | L          | High         |
| 4.8    | As a dev, all conversation turns are logged to fs_conversations table for analytics and safety review                              | S          | High         |
| 4.9    | As a dev, Arya's system prompt passes safety review: no harmful advice, no financial advice, no medical claims                     | M          | Critical     |

**Acceptance Criteria**

- Arya chat widget: message sent → Arya response in \<3 seconds (P95)

- Groq API: tested with 50 concurrent requests — no timeouts

- Redis: conversation context retrieved correctly on turn 2, 3, and 5 of same session

- Skill Shot recommendation: Arya recommends a relevant video for at least 5 different test scenarios

- WhatsApp: sending a message to the number triggers Arya response within 5 seconds

- Safety: 10 adversarial test prompts handled gracefully (no harmful output)

- Mobile: chat widget renders correctly on iPhone 13 and Samsung Galaxy S22

**Sprint 5 — Conversational Assessment End-to-End (Weeks 9–10)**

**Goal: The full conversational assessment flow works: Arya conducts the 5-pillar dialogue, scores using LLM rubric, shows radar chart, captures lead, delivers report.**

| **\#** | **User Story**                                                                                                                             | **Effort** | **Priority** |
|--------|--------------------------------------------------------------------------------------------------------------------------------------------|------------|--------------|
| 5.1    | As a visitor, I can start the skills assessment via the Arya chat widget or WhatsApp and receive Arya's opening question                   | L          | Critical     |
| 5.2    | As a learner, Arya asks me exactly 5 substantive questions (one per pillar), adapting follow-ups based on my answers                       | XL         | Critical     |
| 5.3    | As a dev, after 5 pillar answers are collected, /api/assess/score calls the LLM with the rubric prompt and returns 5 scores in \<2 seconds | XL         | Critical     |
| 5.4    | As a learner, I see a radar chart rendered in the chat widget immediately after scoring, showing all 5 pillar scores                       | L          | Critical     |
| 5.5    | As a learner, Arya tells me my top strength and priority area with a specific Skill Shot recommendation for each                           | M          | Critical     |
| 5.6    | As a learner, I can give my email and receive a full branded PDF/HTML report within 5 minutes via Brevo                                    | L          | Critical     |
| 5.7    | As a dev, all assessment sessions and scores are stored in fs_assessment_scores and fs_conversations tables                                | M          | High         |
| 5.8    | As a dev, FluentCRM receives all 5 pillar scores as custom fields within 60 seconds of lead capture                                        | M          | High         |
| 5.9    | As a dev, the assessment conversation works on WhatsApp — Arya asks questions, learner replies, scoring happens, report link sent          | L          | Critical     |
| 5.10   | As a dev, LLM scoring is validated: 20 sample conversations scored and reviewed — scores match human expert rating ±15 points              | L          | Critical     |

**Acceptance Criteria**

- Conversational assessment: start to score in under 8 minutes for a fast typist

- LLM scoring: 20-sample validation shows ±15-point accuracy vs human rater

- Radar chart renders in chat widget on Chrome, Safari, mobile Chrome

- Report email: arrives in inbox within 5 minutes, not in spam

- WhatsApp assessment: complete end-to-end flow works on WhatsApp without visiting the website

- FluentCRM: all 5 pillar scores visible as custom fields within 60 seconds

- fs_assessment_scores: all sessions stored with correct session_id linkage

**Sprint 6 — Skill Shot Delivery — Web & WhatsApp (Weeks 11–12)**

**Goal: Skill Shots are fully deliverable on web and WhatsApp. Daily personalised delivery via WhatsApp is live. Check-in after watching is tracked.**

| **\#** | **User Story**                                                                                                                            | **Effort** | **Priority** |
|--------|-------------------------------------------------------------------------------------------------------------------------------------------|------------|--------------|
| 6.1    | As a learner, I can browse the Skill Shots page and filter by Pillar, Work Situation, and Journey Stage                                   | L          | Critical     |
| 6.2    | As a learner, I can watch a Skill Shot via Bunny.net embed with subtitles and see the check-in question after the video ends              | L          | Critical     |
| 6.3    | As a dev, /api/skillshot/next returns the most relevant unwatched Skill Shot for a learner based on their pillar scores and journey stage | L          | Critical     |
| 6.4    | As a learner on WhatsApp, I receive my personalised daily Skill Shot at 8:00 AM IST on weekdays                                           | L          | Critical     |
| 6.5    | As a learner on WhatsApp, I can reply 'Done' after watching and receive the check-in question from Arya                                   | M          | Critical     |
| 6.6    | As a dev, all Skill Shot views and check-in responses are stored in fs_skillshot_views                                                    | M          | High         |
| 6.7    | As a learner, the first 2 Skill Shots per pillar are free. Attempting to watch a 3rd shows a subscription prompt                          | M          | High         |
| 6.8    | As a learner, I can ask Arya 'Find me a Skill Shot on \[topic\]' and receive a relevant recommendation from the library                   | M          | High         |
| 6.9    | As a dev, Bunny.net webhook fires when a learner watches ≥80% of a video, marking it 'completed' in fs_skillshot_views                    | M          | High         |
| 6.10   | As a dev, the WhatsApp cron job runs at 7:55 AM IST and sends personalised Skill Shot links to all opted-in learners                      | L          | Critical     |

**Acceptance Criteria**

- Skill Shots page: filters work without page reload, 60 Skill Shots visible

- Bunny.net embed: video loads in \<2 seconds on a 4G Indian mobile connection

- Daily WhatsApp: test subscriber receives Skill Shot link at correct time

- Check-in after watching: reply 'Done' → Arya sends MCQ question → answer tracked in DB

- Free gating: attempt to watch 3rd free Skill Shot → Explorer subscription prompt shown

- Arya Skill Shot search: 5 test queries each return a relevant result

- Bunny.net webhook: ≥80% watch event updates fs_skillshot_views.watch_pct correctly

PART 10 — CONTENT PRODUCTION PLAN

────────────────────────────────────────────────────────────────────────────────

60 Skill Shots — 8-Week Pre-Launch Production Schedule

60 Skill Shots need to be scripted, recorded, and uploaded before Sprint 3 ends. With AI-assisted scripting, Vikram Rao can produce 8–10 Skill Shots per week. Each shot takes: 15 min script (AI-assisted) + 30 min record + 15 min upload & tag = 1 hour per video.

| **Week** | **Pillar Focus**                               | **Shots** | **Work Situations Covered**                                                                             |
|----------|------------------------------------------------|-----------|---------------------------------------------------------------------------------------------------------|
| Week 1   | THINK — Analytical                             | 12        | Decision-making, problem-solving, prioritisation, presenting recommendations, analysis paralysis        |
| Week 2   | CREATE — Creative                              | 12        | Idea generation, reframing, creative brainstorming, articulating ideas, innovation within constraints   |
| Week 3   | LEAD — Leadership                              | 12        | First-time feedback, motivating teams, saying no, conflict resolution, leading without authority        |
| Week 4   | ADAPT — Resilience                             | 12        | Handling negative feedback, managing change, staying focused, recovering from failure, AI fear          |
| Week 5–6 | AI+TECH — AI Fluency                           | 12        | Starting with AI, MSME AI tools, prompt engineering basics, automating one task, AI in Indian workplace |
| Week 7   | Review & Quality Check                         | —         | All 60 reviewed: subtitles, thumbnails, check-in questions, Bunny.net upload verified, tags correct     |
| Week 8   | Buffer + Hindi translations (3 priority shots) | 3+        | Top 3 Skill Shots translated to Hindi voice-over — targets Tier-2/3 city learners and MSME owners       |

**AI-Assisted Script Template (for each Skill Shot)**

> PROMPT TO VIKRAM → AI SCRIPT GENERATOR:
>
> 'I need a 3-minute Skill Shot script for this situation:
>
> WORK SITUATION: \[learner's exact words, e.g. I need to give feedback to a team
>
> member who is underperforming but is also my friend\]
>
> PILLAR: LEAD
>
> AUDIENCE: First-time manager in India, 28-35 years old
>
> Format: Hook (20s) + Problem (20s) + 3-step technique (2:30) + Try This Today (30s)
>
> \+ 1 check-in MCQ question
>
> Tone: Warm, direct, real examples from Indian workplace, no jargon'
>
> → AI generates structured script in 30 seconds
>
> → Vikram reviews, adjusts 1-2 lines, records immediately

Arya Conversation Quality Assurance

Arya's responses must be reviewed regularly to ensure quality, accuracy, and safety. The following process applies:

| **Check**                         | **Frequency**        | **Method**                                                                                        | **Owner**                        |
|-----------------------------------|----------------------|---------------------------------------------------------------------------------------------------|----------------------------------|
| Weekly conversation sample review | Weekly               | Pull 20 random conversations from fs_conversations table. Review for quality, accuracy, and tone. | Vikram Rao                       |
| Adversarial prompt testing        | Pre-launch + monthly | Test 20 harmful/off-topic prompts. Confirm graceful handling.                                     | Dev team                         |
| Score calibration check           | Monthly              | Pull 10 assessment conversations. Have a human re-score. Compare ±15-point tolerance.             | Vikram Rao + 1 external reviewer |
| Hallucination check               | Weekly               | Check all Skill Shot recommendations — confirm linked videos exist in DB.                         | Automated test script            |
| Latency monitoring                | Continuous           | P95 response time on /api/chat tracked in Node.js logs. Alert if \>3 seconds.                     | Dev team (automated)             |

PART 11 — SUMMARY: THE AGENTIC SHIFT IN ONE PAGE

────────────────────────────────────────────────────────────────────────────────

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<thead>
<tr class="header">
<th><blockquote>
<p><strong>AGENTIC AI-FIRST — THE CORE PROPOSITION</strong></p>
<p><em>FutureSkilz v2.0 is not an upgraded LMS. It is a fundamentally different product. The learner never browses a catalogue. Arya finds what they need. The learner never sits through a 6-hour course. They watch 3 minutes, right now, for what matters today. The learner never fills in a form. They have a conversation with Arya. The learner never gets a generic recommendation. Arya knows where they are in their journey. This is what agentic AI-first means: the platform works for the learner, not the other way around.</em></p>
</blockquote></th>
</tr>
</thead>
<tbody>
</tbody>
</table>

What to Build First — Priority Order

| **Priority** | **Component**                         | **Why First**                                                                                                                                |
|--------------|---------------------------------------|----------------------------------------------------------------------------------------------------------------------------------------------|
| 1            | 60 Skill Shots (content)              | Nothing else works without content. Start recording week 1 of the project, before any code.                                                  |
| 2            | Arya AI Conversation Engine (Node.js) | The front door to everything. Assessment, recommendations, WhatsApp — all flow through Arya.                                                 |
| 3            | WhatsApp Integration                  | Fastest path to Indian learners. A learner can complete the assessment and receive their first Skill Shot without ever visiting the website. |
| 4            | WordPress + Kadence + TutorLMS        | Backend for content management, payments, subscriptions. Required for monetisation but not for the first user experience.                    |
| 5            | Payments (WooCommerce + Razorpay)     | Only needed when you're ready to charge. Can launch free tier first and add payments in Sprint 8.                                            |

Immediate Next Steps (First 2 Weeks)

1.  START RECORDING: Vikram Rao records 3 test Skill Shots this week. Review them. Validate format and quality before committing to 60.

2.  SETUP GROQ API: Create account at console.groq.com. Get API key. Test Arya's core system prompt with 5 sample conversations to validate tone and quality.

3.  SETUP BUNNY.NET: Create Bunny.net Stream account. Upload 3 test Skill Shots. Verify embed speed on Indian 4G connection.

4.  SETUP UPSTASH REDIS: Create free Upstash account. Connect to Node.js. Test session storage with a simple key-value test.

5.  CONFIRM HOSTING: Upgrade futureskilz.in to Hostinger Business Plan if not already. Provision the 1 Node.js managed app slot. Get api.futureskilz.in subdomain live.

6.  SETUP WHATSAPP API: Apply for Meta WhatsApp Cloud API access. This takes 2–5 business days. Apply now — it's on the critical path for Sprint 6.

7.  CONTENT PLANNING SESSION: Vikram Rao + dev team: map all 60 Skill Shot situations. One column: work situation. Next column: pillar. Next: journey stage. This is the content bible.

8.  ARYA PERSONA REVIEW: Write and review Arya's full system prompt. Have 3 people test-chat with it. Refine tone, boundaries, and quality before any code is written.

PART 12 — SKILL SHOT VIDEO PRODUCTION TOOLS & WORKFLOW

────────────────────────────────────────────────────────────────────────────────

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<thead>
<tr class="header">
<th><blockquote>
<p><strong>CONTENT PRODUCTION PHILOSOPHY</strong></p>
<p><em>60 Skill Shots must be produced and uploaded before the platform launch. The goal is a broadcast-quality 3-minute video in under 90 minutes per shot — using AI to script, narrate, and generate visuals so Vikram Rao's time is spent on review and quality, not production mechanics. This section defines the toolchain, costs, and end-to-end workflow.</em></p>
</blockquote></th>
</tr>
</thead>
<tbody>
</tbody>
</table>

Tier 1 — AI Avatar / Talking Head (No Camera Required)

These tools generate a realistic on-screen presenter from a script. Best for scaling to 60 videos quickly without studio equipment or scheduling. The AI presenter reads your script on screen — no filming session needed.

| **Tool**  | **What It Does**                                                                                                                     | **India Context**                                             | **Cost**          | **Best For**                                                     |
|-----------|--------------------------------------------------------------------------------------------------------------------------------------|---------------------------------------------------------------|-------------------|------------------------------------------------------------------|
| HeyGen    | AI avatar reads your script. Choose India-appropriate presenter. Add slides, captions, branded lower-thirds. Exports MP4 in minutes. | Strong — South Asian avatars, Indian English accent.          | \$29/mo Unlimited | PRIMARY for English Skill Shots. Most polished avatar quality.   |
| Synthesia | Script to video with 140+ avatars, 120 languages including Hindi. Enterprise output quality.                                         | Strong — Hindi voice-over built in. Indian avatars available. | \$29–89/mo        | Phase 2 Hindi Skill Shots. Best Hindi voice synthesis available. |
| D-ID      | Animates a photo of Vikram Rao into a talking-head video. Keeps his real face without filming.                                       | Neutral — works with any photo.                               | \$10–36/mo        | When authentic brand presence matters. Vikram's face, no camera. |
| Vidnoz    | Free AI avatar tool. Lower quality.                                                                                                  | Basic — limited Indian options.                               | Free–\$35/mo      | Prototyping format before committing to HeyGen.                  |

Tier 2 — Google AI Tools (Script + Audio + Visual)

Google's AI suite covers the full pipeline: script generation to audio narration to visual B-roll. Particularly strong for Hindi content, Indian workplace context, and near-zero-cost production at launch.

| **Tool**                    | **What It Does**                                                                                                                           | **Cost**                                   | **Skill Shot Use Case**                                                                                                                                    |
|-----------------------------|--------------------------------------------------------------------------------------------------------------------------------------------|--------------------------------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Gemini 2.5 Pro / Flash      | Best-in-class script generation from a situation prompt. Deep Indian workplace context. Outputs structured 3-min scripts in 30 seconds.    | Free (Flash) \| \$19.99/mo Advanced        | SCRIPT GENERATION — input work situation + pillar + audience, receive a production-ready script. Recommended for all 60 Skill Shots over manual scripting. |
| NotebookLM (Audio Overview) | Upload a script or document. Generates a natural two-host audio discussion — sounds like a real podcast, not a robot. No recording needed. | Free \| \$19.99/mo One AI Premium          | AUDIO NARRATION — convert Skill Shot scripts into high-quality narration audio. Combine with slides in Descript. Best free narration tool available.       |
| Veo 3 (via Google Flow)     | Text prompt to high-quality video with native audio (dialogue, sound, music). Can generate Indian workplace scenario re-enactments.        | Included with Gemini Advanced (\$19.99/mo) | B-ROLL AND VISUAL SCENARIOS — supporting footage around narration. Cannot replace a talking-head presenter but excellent for illustrative content.         |
| Google TTS (Cloud API)      | Text-to-speech with Indian English and Hindi voices. Programmatic — auto-generates narration for all 60 scripts without manual recording.  | ~\$4 per 1M characters                     | FALLBACK NARRATION — if NotebookLM is unavailable. Also the Phase 2 Hindi auto-translation pipeline.                                                       |

Tier 3 — Edit & Assembly Tools

| **Tool**      | **What It Does**                                                                                                                                                         | **Cost**        | **When to Use**                                                                                                                                                           |
|---------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------|-----------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Descript      | Edit video by editing a text transcript. Remove pauses by deleting words. Overdub: re-record one sentence with AI voice without re-shooting. Auto-captions (SRT export). | \$24/mo Creator | POST-PRODUCTION — assemble audio (NotebookLM) and visuals (HeyGen / Veo 3) into final MP4. Edit mistakes in text, not in a timeline. RECOMMENDED for all post-production. |
| Loom AI       | Record screen and face on laptop. AI generates chapters, removes filler words, auto-captions.                                                                            | Free–\$12.50/mo | When Vikram records himself. Fastest path for camera-based 'signature' Skill Shots.                                                                                       |
| Canva Video   | Branded slide templates plus AI image generation plus voiceover. Outputs MP4.                                                                                            | \$15/mo Pro     | Branded B-roll slides, title cards, Skill Shot thumbnails.                                                                                                                |
| CapCut (free) | Mobile and desktop video editor. AI auto-captions, background removal. Popular with Indian content creators.                                                             | Free            | Quick mobile edits. SRT subtitle generation for accessibility.                                                                                                            |

Recommended End-to-End Production Workflow

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<thead>
<tr class="header">
<th><blockquote>
<p><strong>PRODUCTION TARGET</strong></p>
<p><em>Target: 60 Skill Shots in 8 weeks. One video per 70-90 minutes of total team effort. Vikram Rao's active time per video: 25 minutes (script review + final approval). AI handles everything else.</em></p>
</blockquote></th>
</tr>
</thead>
<tbody>
</tbody>
</table>

| **Step**                | **Tool**                       | **Who**                  | **Time** | **Output**                                                                                                |
|-------------------------|--------------------------------|--------------------------|----------|-----------------------------------------------------------------------------------------------------------|
| 1\. Situation to Script | Gemini 2.5 Pro                 | Automated                | 2 min    | Structured 3-min script: Hook \| Problem \| 3-Step Technique \| Try This Today \| Check-in MCQ            |
| 2\. Script Review       | Google Docs                    | Vikram Rao               | 10 min   | Approved script with cultural and contextual adjustments                                                  |
| 3\. Audio Narration     | NotebookLM OR HeyGen voiceover | Automated                | 5 min    | Natural audio narration MP3 (NotebookLM) or avatar video with audio (HeyGen)                              |
| 4\. Visual B-roll       | Veo 3 via Google Flow          | Automated                | 10 min   | 3-5 short clips illustrating the work situation for visual overlay                                        |
| 5\. Assembly and Edit   | Descript                       | Editor (1 hr/week batch) | 15 min   | Final MP4: narration + B-roll + captions + branded intro/outro                                            |
| 6\. Thumbnail           | Canva (branded template)       | Editor                   | 5 min    | 1920x1080 thumbnail: pillar colour + situation text + Skill Shot badge                                    |
| 7\. Upload and Tag      | Bunny.net + MySQL              | Dev or Editor            | 10 min   | Video live on Bunny.net. fs_skillshots record created with pillar, tags, journey stage, check-in question |
| 8\. Quality Check       | Mobile phone (4G)              | Vikram Rao               | 5 min    | Approved for delivery or flagged for re-edit                                                              |
| TOTAL                   | —                              | —                        | ~62 min  | 1 publish-ready Skill Shot. 60 shots = 62 hours total over 8 weeks.                                       |

Tool Stack by Production Scenario

| **Scenario**                           | **Recommended Stack**                                                          | **Monthly Cost**                              |
|----------------------------------------|--------------------------------------------------------------------------------|-----------------------------------------------|
| 60 English Skill Shots — maximum speed | Gemini (script) + HeyGen (avatar) + Descript (edit) + Bunny.net (host)         | ~Rs 6,000/mo                                  |
| 60 English Skill Shots — minimum cost  | Gemini (free) + NotebookLM (free) + Veo 3 (\$20) + Descript (\$24) + Bunny.net | ~Rs 4,500/mo                                  |
| Hindi Skill Shots Phase 2 (12 shots)   | Gemini Hindi script + Synthesia Hindi avatar + Descript + Bunny.net            | +\$29/mo (Synthesia) during Hindi sprint only |
| Vikram on camera — signature shots     | Loom AI (record) + Descript (edit) + Bunny.net (host)                          | ~Rs 1,000/mo                                  |
| Fully automated, zero recording        | Gemini + NotebookLM + Veo 3 + CapCut + Bunny.net                               | ~Rs 2,500/mo                                  |

HeyGen vs Google — Summary Decision

| **Factor**               | **HeyGen**                       | **Google (Gemini + NotebookLM + Veo 3)**        | **Winner**         |
|--------------------------|----------------------------------|-------------------------------------------------|--------------------|
| Script quality           | Needs external input             | Best-in-class (Gemini 2.5 Pro)                  | Google             |
| Talking-head presenter   | AI avatar — very good            | Not available                                   | HeyGen             |
| Audio naturalness        | Good, slightly synthetic         | NotebookLM very natural                         | Google             |
| Hindi support            | Limited                          | Native — Gemini + Google TTS + Synthesia option | Google             |
| Indian workplace context | Neutral                          | Very strong — trained on Indian content         | Google             |
| Cost                     | \$29/mo                          | Free to \$20/mo                                 | Google             |
| Speed: script to video   | 15 min with script ready         | 30 min (script + audio + visuals)               | HeyGen             |
| Best use case            | English talking-head Skill Shots | Scripts, Hindi content, B-roll, low budget      | Different purposes |

**DECISION: Use both tools together. Gemini generates all 60 scripts. HeyGen produces English avatar videos. NotebookLM handles audio-only narration. Veo 3 supplies B-roll and scenario illustrations. Descript assembles and edits everything. Bunny.net hosts all output.**

CONSOLIDATED SUMMARY — VERSION 2.1

────────────────────────────────────────────────────────────────────────────────

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<thead>
<tr class="header">
<th><blockquote>
<p><strong>VERSION HISTORY</strong></p>
<p><em>This document (v2.1) is the definitive FutureSkilz technical blueprint. It supersedes v1.0 (static LMS) and v2.0 (agentic AI-first). v2.1 consolidates all architecture, sprint, content, and production tool decisions into one authoritative reference.</em></p>
</blockquote></th>
</tr>
</thead>
<tbody>
</tbody>
</table>

| **Version** | **Date**    | **What Changed**                                                                                                                                                                                                                                                    |
|-------------|-------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| v1.0        | April 2026  | WordPress + Node.js static LMS. Gravity Forms assessment. YouTube video embeds. 10-sprint plan (20 weeks).                                                                                                                                                          |
| v2.0        | May 2026    | Full agentic AI-first respecification. Arya AI agent (Groq). Skill Shots replace courses. WhatsApp-first delivery. Conversational assessment. Bunny.net. Redis. 12-sprint plan (24 weeks).                                                                          |
| v2.1        | August 2026 | Added Part 12: complete Skill Shot video production toolchain. HeyGen, Google AI (Gemini / NotebookLM / Veo 3), Descript, Loom AI. 70-minute end-to-end production workflow. Cost comparison across 5 production scenarios. Consolidated one-page platform summary. |

One-Page Platform Summary — v2.1

| **Layer**           | **What It Is**                                                                             | **Technology**                               |
|---------------------|--------------------------------------------------------------------------------------------|----------------------------------------------|
| AI Companion        | Arya — warm, India-aware learning companion. Entry point to everything.                    | Node.js + Groq llama-3.3-70b + Upstash Redis |
| Assessment          | Conversational 5-pillar dialogue. Arya asks, LLM scores, radar chart shown.                | Node.js /api/assess/\* + Groq API + MySQL    |
| Content             | 60 Skill Shots — 2-5 min micro-videos indexed by work situation, not subject.              | Bunny.net Stream + fs_skillshots MySQL table |
| Delivery            | WhatsApp-first (11-step journey). Web second. Email third.                                 | Meta WhatsApp Cloud API + node-cron          |
| Learning Management | TutorLMS Pro — cohorts, certificates, progress tracking.                                   | WordPress plugin + tutor\_\* MySQL tables    |
| Commerce            | WooCommerce + Razorpay — subscriptions, cohort enrolment, GST invoicing.                   | WordPress + Razorpay webhook to Node.js      |
| CRM                 | FluentCRM Pro — pillar scores as custom fields, journey-segmented sequences.               | WordPress plugin + REST API                  |
| Video Production    | AI-generated scripts (Gemini) + avatar video (HeyGen) + edit (Descript) + host (Bunny.net) | See Part 12                                  |
| Hosting             | Hostinger Business Plan — 1 Node.js app, WordPress, MySQL, CDN, daily backups.             | Hostinger + api.futureskilz.in subdomain     |
| Analytics           | GA4 + FluentCRM reports + Bunny.net video analytics + MySQL query dashboards.              | GA4 Measurement Protocol + custom reports    |

────────────────────────────────────────────────────────────────────────────────

*Prepared by Eccellere Consulting \| contact@eccellere.in \| +91 9964694566*

Confidential \| August 2026 \| Version 2.1 — FutureSkilz Consolidated Agentic AI-First Technical Blueprint
