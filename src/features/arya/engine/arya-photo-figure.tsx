'use client';

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useAryaPose, type AryaState, type PoseOverride } from './arya-pose';

// A photograph of Arya, brought to life. The image sits on a finely subdivided plane:
//   • vertex shader — warps the mesh for head sway/tilt (with parallax so the nose
//     moves more than the ears), the jaw and lips opening, smile, raised brows,
//     breathing and swinging jhumkas;
//   • fragment shader — paints what a still photo cannot contain: eyelids that close
//     (skin sampled from just above the lashes), the inside of the mouth when the lips
//     part, and an iris that slides to look aside.
// All the numbers below are pixel positions measured on public/avatars/arya.png
// (1254 × 1254). If the photo is replaced, re-measure them.

export const PHOTO_SIZE = 4; // world units across; the framing in arya-3d.tsx assumes this
export const PHOTO_FACE = { x: 0.488, y: 0.375 }; // centre of the face, as image fractions

const VERT = /* glsl */ `
  varying vec2 vUv;
  uniform float uOpen, uWide, uRound, uSmile, uBrow, uYaw, uPitch, uRoll, uBreath, uSwingL, uSwingR;
  const float W = 1254.0;
  vec2 px(float x, float y) { return vec2(x, y) / W; }
  float blob(vec2 p, vec2 c, vec2 s) { vec2 d = (p - c) / s; return exp(-0.5 * dot(d, d)); }
  // y of the line between the lips at image x (fractions): the smile curve and the tilt of this photo
  float seamY(float x) { float t = (x * W - 613.5) / 86.5; return (640.0 - 10.0 * t * t + 5.0 * t) / W; }

  void main() {
    vUv = vec2(uv.x, 1.0 - uv.y);
    vec2 P = vUv;
    vec2 d = vec2(0.0);

    // ── Head: everything above the neck moves together ─────────────────────────
    vec2 q = (P - px(612.0, 470.0)) / vec2(0.34, 0.42);
    float hm = (1.0 - smoothstep(0.78, 1.25, length(q))) * (1.0 - smoothstep(0.60, 0.80, P.y));
    vec2 pivot = px(612.0, 900.0);
    float a = uRoll * hm;
    vec2 r = P - pivot;
    d += vec2(r.x * cos(a) + r.y * sin(a) - r.x, -r.x * sin(a) + r.y * cos(a) - r.y);
    float depth = exp(-0.5 * dot((P - px(618.0, 548.0)) / vec2(0.17, 0.24), (P - px(618.0, 548.0)) / vec2(0.17, 0.24)));
    d.x += uYaw * (0.15 * (depth - 0.3) + 0.045) * hm;
    d.y += uPitch * (0.09 * (depth - 0.3) + 0.085) * hm;

    // ── Mouth: the jaw and lower lip drop; the corners stay anchored ───────────
    float sy = seamY(P.x);
    float t = (P.x * W - 613.5) / 86.5;
    float lens = max(1.0 - t * t, 0.0); // parabola: pinned corners, lens-shaped opening
    float below = smoothstep(sy - 0.010, sy + 0.010, P.y);
    float chinFade = 1.0 - smoothstep(772.0 / W - 0.01, 772.0 / W + 0.10, P.y);
    float wideFall = 1.0 - smoothstep(0.07, 0.19, abs(P.x - 0.488));
    float xw = mix(lens, wideFall, smoothstep(sy + 0.02, sy + 0.07, P.y));
    d.y += uOpen * 0.028 * below * chinFade * xw;
    // The upper lip lifts a little at the centre when the mouth opens, giving the opening its arch.
    float upperLip = (1.0 - below) * smoothstep(sy - 0.045, sy - 0.012, P.y);
    d.y -= uOpen * 0.013 * upperLip * lens;

    float mouthRegion = blob(P, px(613.0, 645.0), vec2(0.10, 0.035));
    d.x += (P.x - 0.489) * (uWide * 0.06 - uRound * 0.14) * mouthRegion;

    // ── Smile (beyond the photo's own), brows, breathing ──────────────────────
    float corners = blob(P, px(527.0, 626.0), vec2(0.025, 0.02)) + blob(P, px(700.0, 636.0), vec2(0.025, 0.02));
    d.y -= uSmile * 0.005 * corners;
    d.y -= uSmile * 0.002 * (blob(P, px(470.0, 600.0), vec2(0.05, 0.04)) + blob(P, px(760.0, 610.0), vec2(0.05, 0.04)));
    d.y -= uBrow * 0.0035 * (blob(P, px(520.0, 408.0), vec2(0.06, 0.014)) + blob(P, px(725.0, 412.0), vec2(0.065, 0.014)));
    d.y += uBreath * 0.0016 * smoothstep(0.70, 0.92, P.y);

    // ── Jhumkas swing from their hooks ────────────────────────────────────────
    for (int i = 0; i < 2; i++) {
      vec2 hook = i == 0 ? px(397.0, 607.0) : px(824.0, 603.0);
      vec2 dome = i == 0 ? px(398.0, 652.0) : px(822.0, 675.0);
      float ang = i == 0 ? uSwingL : uSwingR;
      float m = blob(P, dome, vec2(0.040, 0.050)) * smoothstep(hook.y - 0.005, hook.y + 0.03, P.y);
      vec2 rr = P - hook;
      d += vec2(rr.x * cos(ang * m) - rr.y * sin(ang * m) - rr.x, rr.x * sin(ang * m) + rr.y * cos(ang * m) - rr.y);
    }

    vec2 Pd = P + d;
    gl_Position = projectionMatrix * modelViewMatrix * vec4((Pd.x - 0.5) * ${PHOTO_SIZE.toFixed(1)}, (0.5 - Pd.y) * ${PHOTO_SIZE.toFixed(1)}, 0.0, 1.0);
  }
`;

const FRAG = /* glsl */ `
  varying vec2 vUv;
  uniform sampler2D uMap, uTeeth;
  uniform float uOpen, uBlink, uHasTeeth;
  uniform vec2 uGaze; // iris offset in image pixels
  const float W = 1254.0;
  vec2 px(float x, float y) { return vec2(x, y) / W; }
  vec3 tex(vec2 p) { return texture2D(uMap, vec2(p.x, 1.0 - p.y)).rgb; }
  float seamY(float x) { float t = (x * W - 613.5) / 86.5; return (640.0 - 10.0 * t * t + 5.0 * t) / W; }

  // Closes one eye: skin from above the lashes is painted down over the opening,
  // with a dark lash line along the lid's edge.
  vec3 blink(vec3 col, vec2 P, vec2 c, float ang, float a, float hU, float hL, float b) {
    if (b < 0.01) return col;
    vec2 dp = (P - c) * W;
    vec2 ax = vec2(cos(ang), sin(ang));
    vec2 pp = vec2(-sin(ang), cos(ang));
    float ux = dot(dp, ax) / a;
    float uy = dot(dp, pp);
    float s = pow(max(1.0 - ux * ux, 0.0), 0.9);
    float yU = -hU * s;
    float yL = hL * s;
    float yE = yU + (yL * 0.85 - yU) * b;
    float inX = smoothstep(1.12, 0.92, abs(ux));
    float top = yU - 15.0 * smoothstep(0.0, 0.25, b);
    float paint = smoothstep(top - 1.0, top + 1.5, uy) * (1.0 - smoothstep(yE - 0.4, yE + 1.2, uy)) * inX;
    vec3 skin = 0.5 * (tex(P - pp * (24.0 / W)) + tex(P - pp * (31.0 / W)));
    col = mix(col, skin, paint);
    float line = (1.0 - smoothstep(0.8, 2.6, abs(uy - yE))) * smoothstep(0.03, 0.3, b) * inX;
    return mix(col, vec3(0.012, 0.007, 0.006), line * 0.9);
  }

  void main() {
    vec2 P = vUv;

    // Iris slides within each eye; the effect fades to nothing by the eye's edge.
    vec2 pL = px(530.0, 442.0);
    vec2 pR = px(718.0, 452.0);
    vec2 shift = uGaze / W * ((1.0 - smoothstep(19.0 / W, 40.0 / W, distance(P, pL)))
                            + (1.0 - smoothstep(18.0 / W, 38.0 / W, distance(P, pR))));
    vec3 col = tex(P - shift);

    col = blink(col, P, px(524.5, 451.0), 0.151, 52.7, 13.0, 12.0, uBlink);
    col = blink(col, P, px(726.5, 459.5), -0.047, 53.7, 13.0, 12.0, uBlink);

    // Inside of the mouth, painted into the band of photo that the parted lips stretch.
    float sy = seamY(P.x);
    float t = (P.x * W - 613.5) / 86.5;
    float bh = 0.011;
    float tt = (P.y - (sy - bh)) / (2.0 * bh);
    float lensX = smoothstep(0.0, 0.22, max(1.0 - t * t, 0.0));
    float open = smoothstep(0.02, 0.10, uOpen);
    // Only the middle of the stretched band is "inside the mouth"; the rest stays lip.
    // A small opening is a thin dark gap, a wide one fills the band.
    float hw = 0.10 + 0.40 * clamp(uOpen * 1.6, 0.0, 1.0);
    float gap = (1.0 - smoothstep(hw * 0.6, hw, abs(tt - 0.5))) * lensX * open;
    if (gap > 0.001) {
      float rel = clamp((tt - (0.5 - hw)) / (2.0 * hw), 0.0, 1.0); // 0 at the upper lip's edge, 1 at the lower lip's
      float at = abs(t);
      vec3 cavity = vec3(0.016, 0.004, 0.005);
      vec3 tongue = vec3(0.24, 0.045, 0.05);
      vec3 inner = mix(cavity, tongue, smoothstep(0.55, 0.95, rel) * smoothstep(0.35, 0.85, uOpen));

      if (uHasTeeth > 0.5) {
        float gate = smoothstep(0.04, 0.16, uOpen);

        // Lower teeth are her own upper teeth mirrored: same shapes, same colour, smaller, set along the bottom of the gap.
        // (The photo's real lower teeth are only a few blurred pixels fused with the lip, so they cannot be cut out.)
        float lowTop = mix(0.84, 0.68, smoothstep(0.10, 0.45, uOpen)) + 0.04 * at * at; // the row curves up at the corners
        float vL = (1.0 - rel) / max(1.0 - lowTop, 0.05) * 0.72;          // 0 at the gum line (bottom), 0.72 at the biting edge
        float tuL = 0.47 + ((t + 1.0) * 0.5 - 0.5) * 1.0;                  // a little narrower than the upper row
        vec3 lowerTeeth = texture2D(uTeeth, vec2(clamp(tuL, 0.0, 1.0), 1.0 - clamp(vL, 0.0, 1.0))).rgb;
        float lowerTooth = smoothstep(0.10, 0.30, dot(lowerTeeth, vec3(0.299, 0.587, 0.114)))
          * smoothstep(lowTop - 0.03, lowTop + 0.02, rel) * (1.0 - smoothstep(0.95, 1.0, rel)) * gate;
        inner = mix(inner, lowerTeeth * 0.80, lowerTooth);

        // Her real upper teeth, photographed, straightened and mapped across the mouth. They keep their natural
        // size as the mouth opens (the strip is squeezed into the top of the gap, not stretched over it), and only
        // the tooth pixels are painted, so the lower teeth and the dark of the mouth show through around them.
        float vTex = mix(0.92, 0.56, smoothstep(0.10, 0.50, uOpen));
        float v = rel / vTex;
        // The photographed teeth span about 0.14-0.80 of the strip; widen that to fill the mouth, as her smile does.
        float tu = 0.47 + ((t + 1.0) * 0.5 - 0.5) * 0.80;
        vec3 realTeeth = texture2D(uTeeth, vec2(clamp(tu, 0.0, 1.0), 1.0 - clamp(v, 0.0, 1.0))).rgb;
        float toothness = smoothstep(0.10, 0.30, dot(realTeeth, vec3(0.299, 0.587, 0.114)));
        // the small lower-teeth fragments at the bottom of the photographed strip are replaced by the row above
        toothness *= 1.0 - smoothstep(0.66, 0.74, v);
        float inTex = 1.0 - smoothstep(0.90, 1.0, v);
        inner = mix(inner, realTeeth * 0.80, toothness * inTex * gate);
      } else {
      // Teeth: a row of upper teeth under the lip, each tooth separated by a faint line, fading
      // into shadow toward the corners of the mouth. A strip of lower teeth shows when wide open.
      float edges = min(min(abs(at - 0.0), abs(at - 0.115)), min(min(abs(at - 0.24), abs(at - 0.38)), min(abs(at - 0.55), abs(at - 0.76))));
      float seams = (1.0 - smoothstep(0.003, 0.022, edges)) * (1.0 - 0.55 * smoothstep(0.1, 0.9, rel));
      float across = 1.0 - smoothstep(0.62, 0.86, at);
      float teethDepth = mix(0.38, 0.52, smoothstep(0.10, 0.60, uOpen)) * (1.0 - 0.28 * at * at); // corner teeth are shorter, so the edge arcs
      float upper = (1.0 - smoothstep(teethDepth - 0.10, teethDepth, rel)) * across * smoothstep(0.06, 0.22, uOpen);
      vec3 ivory = vec3(0.66, 0.59, 0.50);
      vec3 upperTeeth = ivory * (0.62 + 0.38 * smoothstep(0.0, 0.2, rel)) * (1.0 - 0.20 * seams) * (0.42 + 0.58 * (1.0 - at * at));
      inner = mix(inner, upperTeeth, upper);

      float lower = smoothstep(0.80, 0.86, rel) * (1.0 - smoothstep(0.93, 0.99, rel)) * (1.0 - smoothstep(0.45, 0.70, at)) * smoothstep(0.50, 0.75, uOpen);
      inner = mix(inner, ivory * 0.50 * (1.0 - 0.18 * seams), lower);
      }

      inner *= 0.72 + 0.28 * smoothstep(0.0, 0.14, rel); // shadow under the upper lip
      col = mix(col, inner, gap);
    }

    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }
`;

interface Props {
  texture: THREE.Texture;
  /** Her real teeth (optional); procedural teeth are drawn without it. */
  teeth?: THREE.Texture | null;
  state: AryaState;
  greetNonce?: number;
  override?: PoseOverride;
}

export function AryaPhotoFigure({ texture, teeth = null, state, greetNonce = 0, override }: Props) {
  const pose = useAryaPose(state, greetNonce, override);
  const swing = useRef({ prevYaw: 0, prevRoll: 0, angle: 0 });

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: VERT,
        fragmentShader: FRAG,
        uniforms: {
          uMap: { value: texture }, uTeeth: { value: teeth }, uHasTeeth: { value: teeth ? 1 : 0 },
          uOpen: { value: 0 }, uWide: { value: 0 }, uRound: { value: 0 }, uSmile: { value: 0 },
          uBrow: { value: 0 }, uYaw: { value: 0 }, uPitch: { value: 0 }, uRoll: { value: 0 },
          uBreath: { value: 0 }, uSwingL: { value: 0 }, uSwingR: { value: 0 },
          uBlink: { value: 0 }, uGaze: { value: new THREE.Vector2() },
        },
      }),
    [texture, teeth],
  );

  useFrame(() => {
    const p = pose.current;
    const u = material.uniforms;
    // Conversation never needs a wide-open mouth: even a loud syllable stays a modest, natural opening.
    u.uOpen.value = Math.min(p.mouth.open, 1) * 0.55;
    u.uWide.value = p.mouth.wide;
    u.uRound.value = p.mouth.round;
    u.uSmile.value = p.smile - 0.32; // the photo already smiles; this is the change from that
    u.uBrow.value = p.brow;
    u.uYaw.value = p.yaw;
    u.uPitch.value = p.pitch;
    u.uRoll.value = p.roll;
    u.uBreath.value = p.breath;
    u.uBlink.value = p.blink;
    (u.uGaze.value as THREE.Vector2).set(
      THREE.MathUtils.clamp(p.gazeX * 28, -6, 6),
      THREE.MathUtils.clamp(p.gazeY * 18, -4, 4),
    );

    // Jhumkas swing against the head's motion, kept small — the photo is warped, not rebuilt.
    const s = swing.current;
    const dt = Math.max(p.dt, 0.001);
    const dYaw = (p.yaw - s.prevYaw) / dt;
    const dRoll = (p.roll - s.prevRoll) / dt;
    s.prevYaw = p.yaw;
    s.prevRoll = p.roll;
    const target = THREE.MathUtils.clamp(-dYaw * 0.05 + dRoll * 0.05, -0.05, 0.05) + Math.sin(p.t * 1.3) * 0.006;
    s.angle = THREE.MathUtils.damp(s.angle, target, 8, p.dt);
    u.uSwingL.value = s.angle;
    u.uSwingR.value = s.angle;
  });

  return (
    <mesh material={material}>
      <planeGeometry args={[PHOTO_SIZE, PHOTO_SIZE, 160, 160]} />
    </mesh>
  );
}
