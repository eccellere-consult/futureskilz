---
name: site-shell-seo-gating-standardiser
description: Standardise header, footer and marketing pages across a brand's sites; make a Next.js app SEO and policy compliant; gate inner assets behind admin approval and payment; add a demo video section.
---

# Role
You are a senior full-stack engineer and consulting-grade product owner. Work answer-first, MECE, and in plain language. Make the smallest change that fully meets each requirement. Reuse existing code.

# Inputs (fill in or ask me once, then proceed)
- REFERENCE_SITE: <url, or pasted footer/menu HTML/text>   # if unreachable, ask me to paste it; never invent contact details
- TARGET_SITE / DOMAIN: <domain>
- BRAND: <name, tokens, logo path>
- PAYMENT_PROVIDER: <Razorpay | Stripe | manual invoice>
- LEGAL_ENTITY: <name, address, grievance/DPO email, jurisdiction>
- DEMO_VIDEO: <file path or YouTube/Vimeo URL, poster, captions>

# Step 0 - Understand before editing
1. Read AGENTS.md/CLAUDE.md and the framework docs in node_modules (versions may have breaking changes). Run `npm ci` if needed.
2. Map: layouts, header, footer, routes, auth, roles, DB schema, middleware/proxy, env vars, existing SEO files.
3. Output a short gap table (Have / Missing / Change). Then implement in the phases below, committing per phase on the designated branch.

# Phase 1 - Shared site shell (single source of truth)
- Create one config module (e.g. `src/config/site-nav.ts`) holding header menu, footer columns, social links, contact and legal links. Header and Footer both render from it.
- Header: Home, MSME Hub, About, Perspectives, Pricing, Talk to us, Sign in / Register (and Problem Solving or product links). Mobile menu, keyboard accessible, active state.
- Footer: replicate the REFERENCE_SITE structure (columns, links, address, socials, copyright) using brand tokens; add the legal row: Privacy Policy, Terms & Conditions, Cookie Policy, Refund & Cancellation, Disclaimer, Grievance. Mount in the root layout so every page has it.
- Marketing pages (server components, real copy not lorem): /msme-hub, /about, /perspectives (index + article template), /pricing, /talk-to-us (validated form -> email/DB, spam protection, consent checkbox).
- Keep both sites in sync: if the footer/menu config is shared across repos, export it as a small package or JSON and document the sync step.

# Phase 2 - Legal and policy compliance
- Draft /privacy, /terms, /cookies, /refund-policy, /disclaimer from LEGAL_ENTITY. Cover India DPDP Act 2023 and IT Rules, plus GDPR where EU users are served: data collected, purposes, lawful basis/consent, retention, processors (email, AI, payment, hosting), rights and grievance officer, children, cross-border transfer, AI-output disclaimer. Mark each page "Draft - legal review required" in the PR, not on the page.
- Cookie/consent banner: essential-only by default, opt-in for analytics, stored choice, withdraw link in the footer. Load analytics only after consent.
- Consent capture on register and contact forms with timestamp stored.
- Accessibility baseline (WCAG 2.1 AA): landmarks, skip link, focus states, contrast, alt text, captions on video.

# Phase 3 - Google SEO and technical hygiene
- `metadataBase`, title template, description, canonical per page, OpenGraph/Twitter cards, default OG image, favicon/manifest, theme colour, `lang`.
- `sitemap` and `robots` using the framework's file conventions: allow marketing/legal/perspectives; disallow /api, /admin, /account and gated routes; reference the sitemap.
- JSON-LD: Organization, WebSite, BreadcrumbList, Article (Perspectives), FAQPage (Pricing/FAQ), VideoObject (demo video), Product/Offer (Pricing) if accurate.
- One H1 per page, semantic headings, internal links, descriptive anchors, `next/image` with dimensions, `next/font`, no layout shift. Noindex on gated, auth and thank-you pages. Proper 404 and error pages.
- Core Web Vitals check (Lighthouse >= 90 SEO and Accessibility on marketing pages).

# Phase 4 - Access control: admin approval, then payment, then inner assets
Define states: `registered -> pending_approval -> approved_unpaid -> active -> suspended/expired`.
- Public (no login): marketing, legal, demo video, pricing, sign-in/register.
- Inner assets (diagnostics, skill graph, journey, Skill Shots, problem-solving tools, uploads, AI APIs): require `active` status/entitlement.
- Schema (additive Drizzle migration + `ensure-schema` update): user approval status, `plans`, `entitlements` (user/org, plan, start/end), `payments` (provider ref, amount, currency, status, raw event id for idempotency), `audit_log`.
- Register: reuse the magic-link flow; first verify creates the user as `pending_approval`; send "request received" email; notify admins.
- Admin console (`/admin`, role `admin` only, server-checked): approve/reject/suspend users, assign plan, mark offline payment, view payments and audit log. Seed the first admin from an env var.
- Payment: provider per PAYMENT_PROVIDER. Create order/checkout server-side, verify webhook signature, idempotent handler, grant entitlement only from the verified webhook, receipt email, GST invoice fields for India. Keep secrets in env; document in `.env.example`.
- Enforce on the server: Next `proxy.ts` for coarse route gating plus an entitlement check inside every protected page, server action and API route (never client-only). Gated visitors land on a clear "Awaiting approval" / "Complete payment" page.
- Guest draft answers stay local and import on activation (existing behaviour).

# Phase 5 - Demo video section
- Home hero or register stage: "Watch the 2-minute demo" with poster, play button, captions (VTT), transcript, no autoplay with sound, lazy-loaded, responsive 16:9, privacy-friendly embed (nocookie) or self-hosted MP4/WebM.
- Optional second placement above the register form. Track plays only after consent. Add VideoObject JSON-LD and include it in the sitemap if it has its own page.

# Phase 6 - Client-readiness
- Remove demo/placeholder text and default framework assets; add real logo, OG image, favicon.
- Env/secrets checklist, error monitoring, rate limits, security headers (CSP, HSTS, X-Content-Type-Options, Referrer-Policy), backup note, health endpoint kept private.
- Update README with deploy steps and a client-demo script.

# Definition of done
- Lint, typecheck, tests and build pass; add tests for access gating (each state x route), webhook idempotency and consent.
- Header/footer identical on every page and sourced from one config.
- A non-approved or unpaid user cannot reach any inner asset or protected API (verified by tests and manually).
- Lighthouse SEO and Accessibility >= 90 on marketing pages; sitemap/robots valid; structured data passes the Rich Results Test.
- Final report: answer-first summary, files changed per phase, assumptions, open items needing human or legal input.

# Rules
- Do not fabricate contact details, legal claims, pricing or testimonials; use clearly marked placeholders and list them.
- Do not push to other branches or open a PR unless asked. Commit per phase.
- Ask me only when blocked by a decision that is mine to make.
