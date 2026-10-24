/**
 * diagrams/svg.ts — the drawing toolkit for the reference diagrams: small pure functions that return SVG markup, in the
 * Eccellere palette (gold / ink / cream / teal, sharp corners) and fonts, so every model's picture looks like one family.
 *
 * Each diagram is an ORIGINAL drawing of a published model's standard layout — never a copy of anyone's artwork — with the
 * originator credited in text beside it. Pure strings: no DOM, no React, easy to test and to ship from the server.
 */

export const C = {
  ink: '#0E0E0D',
  inkMid: '#3A3935',
  inkLight: '#7A7870',
  gold: '#B8913A',
  goldLight: '#D4AE6A',
  goldPale: '#F5EDD8',
  cream: '#FAF8F4',
  teal: '#0F6E56',
  tealPale: '#E3F1EC',
  border: '#E5E2DB',
  white: '#FFFFFF',
  brick: '#A6402F',
  brickPale: '#F6E4DF',
} as const;

export const FONT = "'DM Sans', system-ui, -apple-system, 'Segoe UI', sans-serif";
export const SERIF = "'Cormorant Garamond', Georgia, serif";

export const W = 720;
export const H = 440;

/** XML-escape text and attribute values. */
export function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const r1 = (n: number): string => String(Math.round(n * 10) / 10);

export interface SvgOptions {
  title: string;
  desc: string;
  width?: number;
  height?: number;
}

/** The wrapper: accessible name and description, an arrow-head marker, and a responsive width. */
export function svg(o: SvgOptions, body: string): string {
  const w = o.width ?? W, h = o.height ?? H;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" role="img" aria-labelledby="dg-title dg-desc" style="width:100%;height:auto;display:block;font-family:${FONT}">` +
    `<title id="dg-title">${esc(o.title)}</title><desc id="dg-desc">${esc(o.desc)}</desc>` +
    `<defs>` +
    `<marker id="dg-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="${C.inkMid}"/></marker>` +
    `<marker id="dg-arrow-gold" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="${C.gold}"/></marker>` +
    `</defs>` +
    `<rect x="0" y="0" width="${w}" height="${h}" fill="${C.white}"/>` +
    body +
    `</svg>`
  );
}

interface ShapeStyle { fill?: string; stroke?: string; sw?: number; rx?: number; dash?: string; opacity?: number }

const styleAttrs = (s: ShapeStyle): string =>
  `fill="${s.fill ?? 'none'}"` +
  (s.stroke ? ` stroke="${s.stroke}" stroke-width="${s.sw ?? 1}"` : '') +
  (s.dash ? ` stroke-dasharray="${s.dash}"` : '') +
  (s.opacity !== undefined ? ` opacity="${s.opacity}"` : '');

export const rect = (x: number, y: number, w: number, h: number, s: ShapeStyle = {}): string =>
  `<rect x="${r1(x)}" y="${r1(y)}" width="${r1(w)}" height="${r1(h)}" rx="${s.rx ?? 2}" ${styleAttrs(s)}/>`;

export const circle = (cx: number, cy: number, r: number, s: ShapeStyle = {}): string =>
  `<circle cx="${r1(cx)}" cy="${r1(cy)}" r="${r1(r)}" ${styleAttrs(s)}/>`;

export const ellipse = (cx: number, cy: number, rx: number, ry: number, s: ShapeStyle = {}): string =>
  `<ellipse cx="${r1(cx)}" cy="${r1(cy)}" rx="${r1(rx)}" ry="${r1(ry)}" ${styleAttrs(s)}/>`;

export const polygon = (points: [number, number][], s: ShapeStyle = {}): string =>
  `<polygon points="${points.map(([x, y]) => `${r1(x)},${r1(y)}`).join(' ')}" ${styleAttrs(s)}/>`;

export const path = (d: string, s: ShapeStyle = {}): string => `<path d="${d}" ${styleAttrs(s)}/>`;

export interface LineStyle { stroke?: string; sw?: number; dash?: string; arrow?: 'end' | 'start' | 'both'; gold?: boolean }

export function line(x1: number, y1: number, x2: number, y2: number, s: LineStyle = {}): string {
  const marker = s.gold ? 'dg-arrow-gold' : 'dg-arrow';
  return (
    `<line x1="${r1(x1)}" y1="${r1(y1)}" x2="${r1(x2)}" y2="${r1(y2)}" stroke="${s.stroke ?? C.inkMid}" stroke-width="${s.sw ?? 1.2}"` +
    (s.dash ? ` stroke-dasharray="${s.dash}"` : '') +
    (s.arrow === 'end' || s.arrow === 'both' ? ` marker-end="url(#${marker})"` : '') +
    (s.arrow === 'start' || s.arrow === 'both' ? ` marker-start="url(#${marker})"` : '') +
    `/>`
  );
}

export interface TextStyle {
  size?: number;
  weight?: number;
  fill?: string;
  anchor?: 'start' | 'middle' | 'end';
  italic?: boolean;
  spacing?: number;
  serif?: boolean;
  rotate?: number;
  upper?: boolean;
}

export function text(x: number, y: number, s: string, st: TextStyle = {}): string {
  const body = st.upper ? s.toUpperCase() : s;
  return (
    `<text x="${r1(x)}" y="${r1(y)}" font-size="${st.size ?? 12}" font-weight="${st.weight ?? 400}" fill="${st.fill ?? C.ink}"` +
    ` text-anchor="${st.anchor ?? 'start'}"` +
    (st.italic ? ' font-style="italic"' : '') +
    (st.spacing ? ` letter-spacing="${st.spacing}"` : '') +
    (st.serif ? ` font-family="${SERIF}"` : '') +
    (st.rotate ? ` transform="rotate(${st.rotate} ${r1(x)} ${r1(y)})"` : '') +
    `>${esc(body)}</text>`
  );
}

/** Splits text into lines of at most `maxChars` characters, breaking at spaces. */
export function wrap(s: string, maxChars: number): string[] {
  const words = s.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    if (cur && (cur + ' ' + w).length > maxChars) { lines.push(cur); cur = w; } else cur = cur ? `${cur} ${w}` : w;
  }
  if (cur) lines.push(cur);
  return lines;
}

/** Several lines of text, one under another. */
export function lines(x: number, y: number, rows: string[], st: TextStyle & { leading?: number } = {}): string {
  const lead = st.leading ?? Math.round((st.size ?? 12) * 1.35);
  return rows.map((row, i) => text(x, y + i * lead, row, st)).join('');
}

/** A paragraph wrapped to `maxChars`; returns the markup and how many lines it took. */
export function para(x: number, y: number, s: string, maxChars: number, st: TextStyle & { leading?: number } = {}): { svg: string; count: number } {
  const rows = wrap(s, maxChars);
  return { svg: lines(x, y, rows, st), count: rows.length };
}

export interface BoxOptions {
  fill?: string;
  stroke?: string;
  sw?: number;
  titleFill?: string;
  titleSize?: number;
  bodySize?: number;
  bodyFill?: string;
  /** Characters per body line (wrap width). */
  wrapAt?: number;
  align?: 'middle' | 'start';
  dash?: string;
  /** Vertical anchoring of the text block. */
  valign?: 'top' | 'middle';
}

/**
 * A labelled box: rectangle, a bold title and optional wrapped body text. The text block is centred horizontally (or left
 * aligned) and, by default, centred vertically in the box.
 */
export function box(x: number, y: number, w: number, h: number, title: string, body: string[] = [], o: BoxOptions = {}): string {
  const tSize = o.titleSize ?? 14;
  const bSize = o.bodySize ?? 11.5;
  const align = o.align ?? 'middle';
  const tx = align === 'middle' ? x + w / 2 : x + 12;
  const wrapAt = o.wrapAt ?? Math.max(10, Math.floor((w - 20) / (bSize * 0.52)));
  const titleLines = wrap(title, Math.max(8, Math.floor((w - 16) / (tSize * 0.56))));
  const bodyLines = body.flatMap((b) => wrap(b, wrapAt));
  const tLead = Math.round(tSize * 1.25), bLead = Math.round(bSize * 1.4);
  const blockH = titleLines.length * tLead + (bodyLines.length ? 6 + bodyLines.length * bLead : 0);
  const top = (o.valign ?? 'middle') === 'middle' ? y + (h - blockH) / 2 + tSize * 0.85 : y + 10 + tSize * 0.85;
  let out = rect(x, y, w, h, { fill: o.fill ?? C.cream, stroke: o.stroke ?? C.border, sw: o.sw ?? 1, dash: o.dash });
  out += lines(tx, top, titleLines, { size: tSize, weight: 700, fill: o.titleFill ?? C.ink, anchor: align, leading: tLead });
  if (bodyLines.length) out += lines(tx, top + (titleLines.length - 1) * tLead + 6 + bLead * 0.85, bodyLines, { size: bSize, fill: o.bodyFill ?? C.inkMid, anchor: align, leading: bLead });
  return out;
}

/** A small caption line, e.g. an axis label. */
export const caption = (x: number, y: number, s: string, anchor: 'start' | 'middle' | 'end' = 'middle', rotate = 0): string =>
  text(x, y, s, { size: 10, fill: C.inkLight, anchor, spacing: 0.6, upper: true, weight: 600, rotate });

/** A gold numbered/lettered badge. */
export const badge = (cx: number, cy: number, label: string, fill: string = C.gold, size = 11): string =>
  circle(cx, cy, size + 4, { fill }) + text(cx, cy + size * 0.36, label, { size, weight: 700, fill: C.white, anchor: 'middle' });
