/**
 * diagrams/define.ts — reference diagram for the Define stage: 5W2H. An original drawing (never copied artwork) of the
 * method's usual picture: seven questions around the problem they describe.
 */
import { C, box, line, svg } from './svg';

const QUESTIONS: [string, string][] = [
  ['What', 'is wrong, exactly?'],
  ['Why', 'does it matter?'],
  ['Where', 'does it show up?'],
  ['When', 'did it start?'],
  ['Who', 'is affected?'],
  ['How', 'is it found?'],
  ['How much', 'how big, how often?'],
];

/** 5W2H: the seven questions on a ring around the problem, each joined to it. */
function fiveW2H(): string {
  const cx = 360, cy = 220, rx = 268, ry = 152, tw = 148, th = 62;
  let links = '';
  let tiles = '';
  QUESTIONS.forEach(([name, prompt], i) => {
    const angle = -Math.PI / 2 + (i * 2 * Math.PI) / QUESTIONS.length;
    const x = cx + rx * Math.cos(angle), y = cy + ry * Math.sin(angle);
    links += line(cx + (x - cx) * 0.42, cy + (y - cy) * 0.42, cx + (x - cx) * 0.8, cy + (y - cy) * 0.8, { stroke: C.goldLight, sw: 1.4, dash: '4 4' });
    tiles += box(x - tw / 2, y - th / 2, tw, th, name, [prompt], { fill: C.cream, stroke: C.border, titleSize: 14, bodySize: 11 });
  });
  const centre = box(cx - 105, cy - 46, 210, 92, 'The problem', ['Stated as facts:', 'a number, a place, a time'], {
    fill: C.goldPale,
    stroke: C.gold,
    sw: 1.6,
    titleSize: 17,
    bodySize: 11.5,
  });
  return svg(
    {
      title: '5W2H: seven questions that describe a problem',
      desc: 'The problem sits in the centre. Around it, joined to it, are the seven questions of 5W2H: What, Why, Where, When, Who, How and How much. Each answer is a fact about the problem, not a guess at its cause.',
    },
    links + tiles + centre,
  );
}

export const DEFINE_DIAGRAMS: Record<string, () => string> = { '5w2h': fiveW2H };
