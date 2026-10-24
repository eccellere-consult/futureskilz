/**
 * section.test.ts — the section's own configuration obeys the rules the app's tests enforce (entitlements, matcher, home page), checked before
 * anything is wired. A builder runs these on the section's config first; if they pass, the wiring tests in the app will not surprise it.
 */
import { describe, expect, it } from 'vitest';
import { PROBLEM_SOLVING, configIssues, derive, type SectionConfig } from '../lib/problemSolving/section';
import { STAGES } from '../lib/problemSolving/thread';

describe('the Problem Solving section configuration', () => {
  it('passes every rule the app would enforce on it later', () => {
    expect(configIssues(PROBLEM_SOLVING)).toEqual([]);
  });
  it('has the same five stages as the thread, in the same order', () => {
    expect([...PROBLEM_SOLVING.stages]).toEqual([...STAGES]);
  });
  it('derives the URLs, the matcher entries and the shell button the other places must carry', () => {
    const d = derive(PROBLEM_SOLVING);
    expect(d.pageRoute).toBe('/problem-solving');
    expect(d.apiPrefix).toBe('/api/problem-solving');
    expect(d.matcher).toEqual(['/problem-solving/:path*', '/api/problem-solving/:path*']);
    expect(d.shellButton).toBe('<button class="nav-tab" data-route="problem-solving">Problem Solving</button>');
    expect(d.toolPage('five-whys')).toBe('/problem-solving/five-whys');
  });
  it('is case scoped, because a person has many problems, and is a Lite tool under Execute', () => {
    expect(PROBLEM_SOLVING.scope).toBe('case');
    expect(PROBLEM_SOLVING.catalogue).toMatchObject({ menu: 'execute', level: 'lite' });
  });
});

describe('the rules catch what they should', () => {
  const bad = (over: Partial<SectionConfig['catalogue']>, top: Partial<SectionConfig> = {}): SectionConfig => ({ ...PROBLEM_SOLVING, ...top, catalogue: { ...PROBLEM_SOLVING.catalogue, ...over } });
  it('a short blurb, one with no full stop, a bad slug, a wrong sub menu key and the word playbook are all refused', () => {
    expect(configIssues(bad({ blurb: 'Too short.' })).join()).toMatch(/blurb/);
    expect(configIssues(bad({ blurb: 'A long enough sentence about the section but it has no full stop at the end' })).join()).toMatch(/blurb/);
    expect(configIssues(bad({}, { slug: 'Problem_Solving' })).join()).toMatch(/slug must be kebab-case/);
    expect(configIssues(bad({ subMenuKey: 'execute.something-else' })).join()).toMatch(/sub menu key/);
    expect(configIssues(bad({ blurb: 'Build a playbook for any problem, step by step, with the help of AI and a worked example.' })).join()).toMatch(/playbook/);
  });
  it('a slug with an underscore would break the matcher, and says so', () => {
    expect(configIssues(bad({}, { slug: 'problem_solving' })).join()).toMatch(/kebab-case/);
  });
});
