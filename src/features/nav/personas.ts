/**
 * Who sees what. One menu per kind of person, each holding only what that person needs, so nobody has to look past screens that are
 * not theirs. Roles stored on the account decide which menus a person may use; the order below decides which one opens first.
 */

export type Persona = "learner" | "coach" | "editor" | "admin";
/** `more` items sit behind one "More" control, so the menu shows only what a person uses most. */
export type NavItem = { label: string; href: string; hint: string; more?: boolean };
export type PersonaMenu = { label: string; tagline: string; home: string; items: NavItem[] };

export const PERSONA_MENUS: Record<Persona, PersonaMenu> = {
  learner: {
    label: "Learner",
    tagline: "Learn what you need, in the right order",
    home: "/learn",
    items: [
      { label: "My roadmap", href: "/journey", hint: "Where you stand and what to learn first" },
      { label: "Explore roles", href: "/explore", hint: "Which roles are near, and what is missing", more: true },
      { label: "Skill Passport", href: "/passport", hint: "What you can show, to keep or share" },
      { label: "Marketplace", href: "/marketplace", hint: "Find more to learn, by skill, role or industry" },
      { label: "Learning path", href: "/lessons", hint: "Lessons in order, from people who have done the work", more: true },
      { label: "Training material", href: "/training", hint: "Skill Shots, training kits and practice", more: true },
      { label: "Plans and billing", href: "/pricing", hint: "Your pass, what is free, and your invoices", more: true },
    ],
  },
  coach: {
    label: "Coach",
    tagline: "Share what your career taught you",
    home: "/contribute/dashboard",
    items: [
      { label: "Create from files", href: "/contribute/from-source", hint: "Drop in documents or notes; get Skill Shots" },
      { label: "Interview", href: "/contribute", hint: "Talk with Arya and review what she heard" },
      { label: "Plan a training", href: "/contribute/training-needs", hint: "From a big topic to learner needs and a topic tree" },
      { label: "My lessons", href: "/contribute/dashboard", hint: "Your lessons, how they are used, and statements" },
      { label: "Earnings calculator", href: "/contribute/earnings", hint: "Estimate what your lessons could earn", more: true },
    ],
  },
  editor: {
    label: "Editor",
    tagline: "Turn approved knowledge into lessons people trust",
    home: "/contribute/editor",
    items: [
      { label: "Content to approve", href: "/contribute/editor", hint: "Lessons waiting for your review" },
      { label: "Create from files", href: "/contribute/from-source", hint: "Drop in documents or notes; get Skill Shots" },
      { label: "Plan a training", href: "/contribute/training-needs", hint: "From a big topic to learner needs and a topic tree" },
      { label: "Skill Shot studio", href: "/contribute/skill-shots", hint: "Design, check and publish Skill Shots" },
      { label: "Autopilot results", href: "/contribute/autopilot", hint: "What Autopilot made, what is ready and what failed" },
      { label: "Published lessons", href: "/lessons", hint: "What learners see today", more: true },
    ],
  },
  admin: {
    label: "Admin",
    tagline: "Run the platform",
    home: "/admin",
    items: [
      { label: "Dashboard", href: "/admin", hint: "People, content and money at a glance" },
      { label: "Accounts", href: "/contribute/admin/users", hint: "Create people and give them roles" },
      { label: "Earnings and policy", href: "/contribute/admin", hint: "Revenue-share policy, allocation runs and statements", more: true },
      { label: "Payments", href: "/admin/payments", hint: "Receipts, payouts and what is still to connect", more: true },
      { label: "Content approvals", href: "/contribute/editor", hint: "The editors' queue" },
    ],
  },
};

const ORDER: Persona[] = ["admin", "editor", "coach", "learner"];

/** The menus a person may use, most senior first. A learner is always included; an admin may look at every menu. */
export function personasFor(roles: readonly string[] | undefined): Persona[] {
  const held = new Set(roles ?? []);
  const out = new Set<Persona>(["learner"]);
  if (held.has("contributor")) out.add("coach");
  if (held.has("editor")) out.add("editor");
  if (held.has("admin")) ORDER.forEach((persona) => out.add(persona));
  return ORDER.filter((persona) => out.has(persona));
}

export const primaryPersona = (roles: readonly string[] | undefined): Persona => personasFor(roles)[0];

/** Where someone lands after signing in. */
export const homeFor = (roles: readonly string[] | undefined): string => PERSONA_MENUS[primaryPersona(roles)].home;

/** Which persona's screens a path belongs to, so the menu can stay on the right one. */
export function personaOfPath(pathname: string): Persona | null {
  if (pathname === "/admin" || pathname.startsWith("/admin/") || pathname.startsWith("/contribute/admin")) return "admin";
  if (pathname.startsWith("/contribute/editor") || pathname.startsWith("/contribute/skill-shots") || pathname.startsWith("/contribute/lessons") || pathname.startsWith("/contribute/autopilot")) return "editor";
  // Shared by coaches and editors: stay on whichever menu the person already has open.
  if (pathname === "/contribute/training-needs" || pathname.startsWith("/contribute/training-needs/") || pathname === "/contribute/from-source") return null;
  if (pathname.startsWith("/contribute")) return "coach";
  if (["/learn", "/journey", "/explore", "/passport", "/marketplace", "/coaches", "/lessons", "/training", "/profile", "/assessment", "/skill-shots", "/problem-solving", "/pricing"].some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) return "learner";
  return null;
}

/** The menu item that matches the current path best (longest matching prefix), if any. */
export function activeItem(menu: PersonaMenu, pathname: string): NavItem | null {
  const matches = menu.items.filter((item) => pathname === item.href || pathname.startsWith(`${item.href}/`));
  return matches.sort((a, b) => b.href.length - a.href.length)[0] ?? null;
}
