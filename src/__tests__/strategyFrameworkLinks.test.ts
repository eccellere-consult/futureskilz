import { describe, expect, it } from 'vitest';
import { effectiveLinks } from '../lib/strategyFrameworkLinks';

const row = (toolId: string, upstreamTools: string[] = [], downstreamTools: string[] = []) => ({ toolId, upstreamTools, downstreamTools });

describe('effectiveLinks — a link declared on either side is a link', () => {
  it('adds the upstream a framework\'s feeder declared only on its own side', () => {
    // vpc says it feeds bmc, but bmc never listed vpc as something it builds on
    const m = effectiveLinks([row('vpc', [], ['bmc']), row('bmc', ['ansoff'], []), row('ansoff', [], ['bmc'])]);
    expect(m.get('bmc')!.upstream).toEqual(['ansoff', 'vpc']);
    expect(m.get('vpc')!.downstream).toEqual(['bmc']);
  });

  it('adds the downstream a framework\'s consumer declared only on its own side', () => {
    const m = effectiveLinks([row('a'), row('b', ['a'])]);
    expect(m.get('a')!.downstream).toEqual(['b']);
  });

  it('keeps authored order first, and never repeats a link declared on both sides', () => {
    const m = effectiveLinks([row('a', [], ['b', 'c']), row('b', ['a'], []), row('c', ['a', 'b'], []), row('d', [], ['c'])]);
    expect(m.get('a')!.downstream).toEqual(['b', 'c']);
    expect(m.get('c')!.upstream).toEqual(['a', 'b', 'd']);
  });

  it('ignores links to tools that are not in the catalogue, and to itself', () => {
    const m = effectiveLinks([row('a', ['ghost', 'a'], ['gone'])]);
    expect(m.get('a')).toEqual({ upstream: [], downstream: [] });
  });
});
