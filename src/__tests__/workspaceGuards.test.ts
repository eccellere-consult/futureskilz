import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { AiUnavailableError, failureFor, getPrimaryProvider, isAiSwitchedOn, isProviderConfigured } from '../lib/llmClient';
import { buildAnalyzeMessages, buildGenerateMessages } from '../lib/strategyHubAi';
import { getModelDefinition } from '../lib/strategyModels/registry';
import { looksLikeWorkbook } from '../lib/templateKit/serverOpen';
import { strategyKit } from '../lib/strategyModels/kit';
import { kitBytes } from '../lib/templateKit/workbook';
import { caseBlock } from '../lib/workspaceCases';

vi.mock('../lib/mysql', () => ({ default: { query: vi.fn() } }));
vi.mock('../server/db/ensure-schema', () => ({ ensureDatabaseSchema: vi.fn(async () => undefined) }));

const env = { ...process.env };
afterEach(() => { process.env = { ...env }; });

describe('the AI switch (FutureSkilz AI_PROVIDER)', () => {
  it('keeps the AI off while AI_PROVIDER is unset or deterministic, even with a key on the server', () => {
    process.env.OPENAI_API_KEY = 'sk-test';
    delete process.env.AI_PROVIDER;
    expect(isAiSwitchedOn()).toBe(false);
    expect(isProviderConfigured('openai')).toBe(false);
    process.env.AI_PROVIDER = 'deterministic';
    expect(isProviderConfigured('openai')).toBe(false);
  });

  it('turns it on for openai, xai or auto, and only for a provider that has its own key', () => {
    process.env.AI_PROVIDER = 'openai';
    process.env.OPENAI_API_KEY = 'sk-test';
    delete process.env.XAI_API_KEY;
    expect(isProviderConfigured('openai')).toBe(true);
    expect(isProviderConfigured('grok')).toBe(false);
  });

  it('puts Grok first only when AI_PROVIDER is xai', async () => {
    process.env.AI_PROVIDER = 'xai';
    expect(await getPrimaryProvider()).toBe('grok');
    process.env.AI_PROVIDER = 'openai';
    expect(await getPrimaryProvider()).toBe('openai');
  });

  it('says in plain words that the AI is switched off, and how to switch it on, without naming any key value', () => {
    delete process.env.AI_PROVIDER;
    const error = new AiUnavailableError([failureFor('openai', 'not_configured'), failureFor('grok', 'not_configured')]);
    expect(error.message).toMatch(/^The AI is switched off on this site\./);
    expect(error.message).toContain('AI_PROVIDER');
    expect(error.message).not.toMatch(/sk-/);
  });
});

describe('the workbook guard on uploads', () => {
  it('accepts a real template the kit makes', async () => {
    const def = getModelDefinition('5w2h')!;
    const kit = strategyKit({ toolId: '5w2h', name: '5W2H', structure: def, brand: { product: 'FutureSkilz', section: 'Problem Solving' } });
    expect(looksLikeWorkbook(await kitBytes(kit.def, null))).toBe(true);
    expect(kit.def.fileBase).toBe('FutureSkilz-5W2H');
  });

  it('refuses the tiny or truncated zips that keep SheetJS busy for minutes, and anything that is not a workbook', () => {
    const tenByteStub = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0, 0, 0, 0, 0, 0]);
    expect(looksLikeWorkbook(tenByteStub)).toBe(false);
    const noDirectory = new Uint8Array(400);
    noDirectory.set([0x50, 0x4b, 0x03, 0x04]);
    expect(looksLikeWorkbook(noDirectory)).toBe(false);
    expect(looksLikeWorkbook(new TextEncoder().encode('<!DOCTYPE html><html>404</html>'))).toBe(false);
    expect(looksLikeWorkbook(new Uint8Array(0))).toBe(false);
  });
});

describe('the problem in hand reaches every prompt first', () => {
  const ctx = { contextBlock: '', valueScanBlock: '', upstreamBlock: '', caseBlock: caseBlock({ title: 'Late deliveries', brief: 'One order in ten ships late.' }), persona: 'a senior continuous-improvement coach for an Indian MSME', toolKind: 'problem-solving method' };
  const framework = { name: '5W2H', layer: 'Define', fields: [{ label: 'The problem in one sentence', value: '', source: 'Manual' }] };

  it('writes the brief as THE PROBLEM IN HAND, with the coach persona and the section words', () => {
    expect(ctx.caseBlock).toBe('THE PROBLEM IN HAND: Late deliveries. One order in ten ships late.');
    const g = buildGenerateMessages({ framework, structure: getModelDefinition('5w2h')!, methodology: 'm', fillable: ['The problem in one sentence'], current: [], ctx });
    expect(g.user.startsWith('THE PROBLEM IN HAND: Late deliveries.')).toBe(true);
    expect(g.system).toContain('You are a senior continuous-improvement coach for an Indian MSME filling in the "5W2H" problem-solving method (stage: Define)');
    const a = buildAnalyzeMessages({ framework, structure: getModelDefinition('5w2h')!, methodology: 'm', fields: [{ label: 'The problem in one sentence', value: 'x' }], ctx });
    expect(a.user.startsWith('THE PROBLEM IN HAND:')).toBe(true);
    expect(a.system).toContain('a completed "5W2H" problem-solving method (stage: Define).');
  });

  it('keeps the Strategy Hub wording when no persona is given', () => {
    const g = buildGenerateMessages({ framework, methodology: 'm', fillable: ['The problem in one sentence'], current: [], ctx: { contextBlock: '', valueScanBlock: '', upstreamBlock: '' } });
    expect(g.system).toContain('You are a senior MSME strategy consultant filling in the "5W2H" strategy framework (layer: Define)');
  });

  it('leaves the brief out cleanly when the learner gave none', () => {
    expect(caseBlock({ title: '  Late deliveries ', brief: '  ' })).toBe('THE PROBLEM IN HAND: Late deliveries.');
  });
});
