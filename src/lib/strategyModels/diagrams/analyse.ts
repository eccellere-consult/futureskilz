/**
 * diagrams/analyse.ts — reference diagram for the Analyse stage: 5 Whys. An original drawing of the method's usual picture:
 * a chain of whys, each asking about the answer before, ending in a root cause.
 */
import { C, box, line, polygon, svg, text } from './svg';

const WHY_PROMPTS = [
  'Why does the problem happen?',
  'Why is that answer true?',
  'Why is that answer true?',
  'Why is that answer true?',
  'Why is that answer true?',
];

/** 5 Whys: the problem, five linked whys, and the root cause drawn as a different shape. */
function fiveWhys(): string {
  const x = 196, w = 328, h = 44, gap = 13;
  let body = box(x, 14, w, 40, 'The problem', [], { fill: C.cream, stroke: C.inkLight, titleSize: 13 });
  body += line(x + w / 2, 54, x + w / 2, 54 + gap + 2, { arrow: 'end' });

  WHY_PROMPTS.forEach((prompt, i) => {
    const y = 54 + gap + 4 + i * (h + gap);
    const last = i === WHY_PROMPTS.length - 1;
    body += box(x, y, w, h, `Why ${i + 1}`, [prompt], { fill: last ? C.goldPale : C.white, stroke: last ? C.gold : C.border, titleSize: 13, bodySize: 10.5 });
    body += line(x + w / 2, y + h, x + w / 2, y + h + gap - 1, { arrow: 'end', gold: last });
  });

  const top = 54 + gap + 4 + WHY_PROMPTS.length * (h + gap);
  const ry = 26, mid = top + ry + 2;
  body += polygon(
    [[x + 18, mid - ry], [x + w - 18, mid - ry], [x + w, mid], [x + w - 18, mid + ry], [x + 18, mid + ry], [x, mid]],
    { fill: C.tealPale, stroke: C.teal, sw: 1.6 },
  );
  body += text(x + w / 2, mid - 3, 'Root cause', { size: 14, weight: 700, fill: C.teal, anchor: 'middle' });
  body += text(x + w / 2, mid + 14, 'a gap in a system you can fix, not a person', { size: 10.5, fill: C.inkMid, anchor: 'middle' });

  // The rule of the method, beside the chain.
  body += line(x - 40, 84, x - 40, top + 8, { arrow: 'end', gold: true, sw: 1.6 });
  body += text(x - 56, (84 + top) / 2, 'Ask why of the answer before', { size: 10.5, fill: C.inkLight, italic: true, anchor: 'middle', rotate: -90 });
  body += text(x + w + 30, 110, 'Mark each answer', { size: 10.5, fill: C.inkLight });
  body += text(x + w + 30, 127, 'Evidenced or Assumed.', { size: 10.5, fill: C.inkMid, weight: 700 });
  body += text(x + w + 30, 158, 'Stop when fixing the', { size: 10.5, fill: C.inkLight });
  body += text(x + w + 30, 175, 'answer stops the problem', { size: 10.5, fill: C.inkLight });
  body += text(x + w + 30, 192, 'coming back.', { size: 10.5, fill: C.inkLight });

  return svg(
    {
      title: '5 Whys: a chain of questions to the root cause',
      desc: 'A vertical chain. It starts with the problem, then five boxes, Why 1 to Why 5, each asking why the answer before it is true, joined by arrows. The chain ends in a six-sided box labelled Root cause: a gap in a system you can fix, not a person.',
    },
    body,
  );
}

export const ANALYSE_DIAGRAMS: Record<string, () => string> = { 'five-whys': fiveWhys };
