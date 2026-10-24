/**
 * problemSolving/seed.ts — the catalogue entries (ws_tools rows) of the Problem Solving tools built so far. The stage of each
 * tool and the tools it feeds come from thread.ts, so the catalogue and the thread cannot disagree; a link to a tool that is
 * not built yet is kept out until that tool exists.
 */
import type { SeedTool } from '../strategyFrameworks';
import { modelToolIds } from '../strategyModels/groups';
import { PROBLEM_SOLVING } from './section';
import { FEEDS, STAGE_OF, TOOL_IDS, type ToolId } from './thread';

export const SECTION = PROBLEM_SOLVING.slug;

type ToolText = Omit<SeedTool, 'toolId' | 'facets' | 'upstreamTools' | 'downstreamTools' | 'status' | 'sortOrder'> & {
  nature: string;
  fits: string[];
};

const TEXT: Partial<Record<ToolId, ToolText>> = {
  '5w2h': {
    name: '5W2H',
    nature: 'diagnostic',
    fits: ['Q', 'D', 'C', 'S', 'P', 'V'],
    does: 'Describes a problem completely before anyone tries to solve it: what, why, where, when, who, how and how much, each answered with a fact you can check.',
    whenToUse: 'At the very start of any problem, when people disagree about what is wrong, or when a complaint needs turning into a measurable problem statement.',
    whenNotToUse: 'When the cause is already proven and the fix is agreed: go straight to planning the change with PDCA.',
    nextStep: 'The problem statement, the rate now and the target flow into 5 Whys (and, later, Pareto, the fishbone, PDCA and the A3 report).',
  },
  'five-whys': {
    name: '5 Whys',
    nature: 'diagnostic',
    fits: ['Q', 'D', 'C', 'S', 'P', 'V'],
    does: 'Finds the root cause by asking why of each answer in turn, until the answer is a gap in how work is set up that you can fix so the problem does not come back.',
    whenToUse: 'When a problem keeps coming back after quick fixes, or once the problem is stated and you need to know why it happens.',
    whenNotToUse: 'When the problem has many causes interacting at once (map them on a fishbone first), or when nobody has evidence yet and every answer would be a guess.',
    nextStep: 'The root cause feeds the choice of fixes: Impact-Effort, the Pugh matrix and the A3 report.',
  },
};

const built = new Set(modelToolIds());

/** The code-defined tools of the section that exist so far, in thread order. */
export const PROBLEM_SOLVING_SEED: SeedTool[] = TOOL_IDS.filter((id) => built.has(id) && TEXT[id]).map((id, i) => {
  const t = TEXT[id]!;
  return {
    toolId: id,
    name: t.name,
    facets: { stage: STAGE_OF[id], nature: t.nature, fits: t.fits },
    does: t.does,
    whenToUse: t.whenToUse,
    whenNotToUse: t.whenNotToUse,
    nextStep: t.nextStep,
    upstreamTools: [],
    downstreamTools: FEEDS[id].filter((d) => built.has(d)),
    status: 'published',
    sortOrder: (i + 1) * 10,
  };
});

/** How many of the section's twelve methods are still to come, for the overview's "on the way" line. */
export const METHODS_TO_COME = TOOL_IDS.length - PROBLEM_SOLVING_SEED.length;
