/**
 * problemSolving/section.ts — a section described once, as data: its name and URL, whether a person has one set of tools or many (scope), its
 * stages and facets, the voice of its AI prompts, and the entry it needs in the app's catalogue. Everything that has to agree about the section
 * (the URL prefixes, the matcher entries, the shell's menu button, the catalogue entry, the table values) is derived from this one object, and
 * section.test.ts checks the rules the app's own tests would otherwise only catch late (a blurb the home page can show, URL prefixes the matcher
 * can read, a stage list that matches the thread).
 *
 * A new section is a new object of this shape plus its frameworks. Nothing here is Eccellere-specific except the `catalogue` block, which a
 * separate app can ignore.
 */
export type Scope = 'client' | 'case';
export type Level = 'free' | 'core' | 'lite' | 'enterprise';
export type MainMenu = 'platform' | 'envision' | 'engineer' | 'execute' | 'excel';

export interface Facet { key: string; label: string; values: readonly { id: string; label: string }[] }

export interface CatalogueEntry {
  menu: MainMenu;
  /** The sub menu: `<menu>.<slug>`. */
  subMenuKey: string;
  /** The `data-route` of the side-menu button in the signed-in shell; the app's own test requires it to equal the catalogue's `shellRoute`. */
  shellRoute: string;
  toolKey: string;
  toolName: string;
  level: Level;
  /** What the home page and the plan cards show. Over 40 characters, ends in a full stop, different from every other tool's. */
  blurb: string;
}

export interface SectionConfig {
  /** kebab-case: the page URL is /{slug}, the API prefix is /api/{slug}, and it is the `section` value in the tables. */
  slug: string;
  name: string;
  tagline: string;
  scope: Scope;
  stages: readonly string[];
  facets: readonly Facet[];
  /** The coach voice in the AI prompts ("a senior continuous-improvement coach for an Indian MSME"). */
  persona: string;
  catalogue: CatalogueEntry;
}

export const PROBLEM_SOLVING: SectionConfig = {
  slug: 'problem-solving',
  name: 'Problem Solving',
  tagline: 'Work a business problem from definition to a one-page report, one proven method at a time.',
  scope: 'case',
  stages: ['Define', 'Analyse', 'Decide', 'Act', 'Document'],
  facets: [
    { key: 'fits', label: 'What kind of problem', values: [
      { id: 'Q', label: 'Quality' }, { id: 'D', label: 'Delivery' }, { id: 'C', label: 'Cost' },
      { id: 'S', label: 'Safety and compliance' }, { id: 'P', label: 'People' }, { id: 'V', label: 'Customer' },
    ] },
    { key: 'nature', label: 'Nature of the method', values: [
      { id: 'diagnostic', label: 'Diagnostic' }, { id: 'design', label: 'Design' }, { id: 'decision', label: 'Decision' },
      { id: 'quantitative', label: 'Quantitative' }, { id: 'execution', label: 'Execution' },
    ] },
  ],
  persona: 'a senior continuous-improvement coach for an Indian MSME',
  catalogue: {
    menu: 'execute',
    subMenuKey: 'execute.problem-solving',
    shellRoute: 'problem-solving',
    toolKey: 'problem-solving',
    toolName: 'Problem Solving toolkit',
    level: 'lite',
    blurb: 'Work a business problem from definition to a one-page A3 report with twelve proven methods, each filled in with AI help and each feeding the next.',
  },
};

/** Everything that must agree about a section, derived from it. */
export function derive(c: SectionConfig) {
  return {
    pageRoute: `/${c.slug}`,
    apiPrefix: `/api/${c.slug}`,
    /** The two entries for `config.matcher` in middleware.ts (plain strings ending in /:path*). */
    matcher: [`/${c.slug}/:path*`, `/api/${c.slug}/:path*`] as const,
    /** The side-menu button of the signed-in shell. */
    shellButton: `<button class="nav-tab" data-route="${c.catalogue.shellRoute}">${c.name}</button>`,
    /** Where a tool of the section lives. */
    toolPage: (toolId: string) => `/${c.slug}/${toolId}`,
  };
}

const KEBAB = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** The rules the app's own tests enforce on a section, as a function so a new section can be checked the same way before anything is wired. Empty means fine. */
export function configIssues(c: SectionConfig): string[] {
  const out: string[] = [];
  const need = (ok: boolean, msg: string) => { if (!ok) out.push(msg); };
  const d = derive(c);
  need(KEBAB.test(c.slug), 'slug must be kebab-case');
  need(c.name.trim().length >= 3 && c.name.length <= 40, 'name must be 3 to 40 characters');
  need(c.tagline.trim().length >= 20 && /[.!?]$/.test(c.tagline), 'tagline must be a sentence ending in a full stop');
  need(c.stages.length >= 2 && new Set(c.stages).size === c.stages.length, 'stages must be two or more, all different');
  need(c.facets.every((f) => KEBAB.test(f.key) && f.values.length >= 2 && new Set(f.values.map((v) => v.id)).size === f.values.length), 'each facet needs a kebab-case key and two or more different values');
  need(c.persona.trim().length >= 10, 'persona must say who is speaking');
  const k = c.catalogue;
  need(KEBAB.test(k.toolKey) && KEBAB.test(k.shellRoute), 'tool key and shell route must be kebab-case');
  need(k.subMenuKey === `${k.menu}.${c.slug}`, 'the sub menu key must be <menu>.<slug>');
  need(k.blurb.length > 40 && /[.!?]$/.test(k.blurb), 'the blurb must be over 40 characters and end in a full stop');
  need(/^\/[a-z0-9/_-]+$/.test(d.pageRoute) && /^\/[a-z0-9/_-]+$/.test(d.apiPrefix), 'the page and API prefixes must look like /slug');
  need(d.matcher.every((m) => /^\/[a-z0-9/-]+\/:path\*$/.test(m)), 'the matcher entries must be plain strings ending in /:path* (letters, digits, hyphens and slashes only)');
  need(![c.name, c.tagline, k.blurb, k.toolName].some((s) => /\bplaybook\b/i.test(s)), 'the word "playbook" is reserved for the Transformation Playbooks and Solve Your Own Problems');
  need(c.scope === 'client' || c.scope === 'case', 'scope must be client or case');
  return out;
}
