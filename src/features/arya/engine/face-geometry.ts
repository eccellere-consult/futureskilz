import * as THREE from 'three';

// Arya's head, sculpted procedurally from a sphere. Units are arbitrary but the head is
// ~2.0 tall, so a face is roughly 1.5 wide. +x is Arya's left (screen right when she
// faces the viewer), +y up, +z forward.
//
// Features are placed with Gaussian "bumps" on a face-shaped ellipsoid. Each one is
// commented with the anatomical landmark it stands for, so tuning the face is a matter
// of nudging a few numbers (and looking at the result), not reverse-engineering mesh data.

export const HEAD = { rx: 0.74, ry: 1.0, rz: 0.86 } as const;

/** Where the mouth line (the seam between the lips) sits, in head space. */
export const MOUTH_Y = -0.595;

const smooth = THREE.MathUtils.smoothstep;
const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

/** 2-D Gaussian bump centred on (cx, cy) with spreads (sx, sy). 1 at the centre. */
function bump(x: number, y: number, cx: number, cy: number, sx: number, sy: number): number {
  const dx = (x - cx) / sx;
  const dy = (y - cy) / sy;
  return Math.exp(-(dx * dx + dy * dy) / 2);
}

/** Symmetric pair of bumps at ±cx (the face is bilaterally symmetric). */
function pair(x: number, y: number, cx: number, cy: number, sx: number, sy: number): number {
  return bump(Math.abs(x), y, cx, cy, sx, sy);
}

/** Maps a point on the unit sphere to a point on Arya's face/skull. */
export function sculpt(px: number, py: number, pz: number): { x: number; y: number; z: number } {
  let x = px * HEAD.rx;
  const y = py * HEAD.ry;
  let z = pz * HEAD.rz;

  // Face shape: full through the cheekbones, tapering to a soft, slightly pointed chin.
  const jaw = clamp01((0.15 - y) / 1.15);
  x *= 1 - 0.34 * Math.pow(jaw, 1.2);
  // Gently flatter, narrower lower back so the neck sits naturally under the skull.
  if (y < -0.2) z *= 1 - 0.1 * clamp01((-0.2 - y) / 0.8);

  // Only the front of the face carries features.
  const front = smooth(pz, 0.02, 0.5);
  if (front <= 0) return { x, y, z };

  let d = 0;

  // ── Nose: bridge widening to a soft, refined tip, with nostril wings ────────
  const noseProfile = 0.014 + 0.145 * Math.pow(smooth(-y, -0.3, 0.26), 1.35); // grows toward the tip
  const noseWidth = 0.05 + 0.024 * smooth(-y, -0.1, 0.25);
  d += noseProfile * Math.exp(-((x / noseWidth) ** 2) / 2) * smooth(y, -0.36, -0.2) * (1 - smooth(y, 0.1, 0.28));
  d += 0.042 * pair(x, y, 0.11, -0.24, 0.045, 0.045); // alar wings
  d += 0.035 * bump(x, y, 0, -0.255, 0.06, 0.05); // tip
  d -= 0.05 * pair(x, y, 0.07, -0.312, 0.03, 0.018); // nostril openings
  d -= 0.012 * bump(x, y, 0, -0.39, 0.035, 0.05); // philtrum groove

  // ── Eyes: almond sockets set under a soft brow ridge ───────────────────────
  d -= 0.06 * pair(x, y, 0.35, 0.09, 0.2, 0.115); // socket
  d -= 0.012 * pair(x, y, 0.13, 0.1, 0.06, 0.1); // inner corner / nose-bridge dip
  d += 0.02 * pair(x, y, 0.36, 0.31, 0.17, 0.05); // brow ridge
  d -= 0.012 * pair(x, y, 0.34, -0.065, 0.15, 0.05); // under-eye hollow

  // ── Cheeks: defined cheekbones and soft, youthful fullness ─────────────────
  d += 0.035 * pair(x, y, 0.52, -0.12, 0.2, 0.15);
  d += 0.03 * pair(x, y, 0.4, -0.36, 0.23, 0.17);
  // Nasolabial folds, from the nose wing toward the mouth corner.
  for (let i = 0; i < 5; i++) {
    const t = i / 4;
    d -= 0.011 * pair(x, y, 0.17 + 0.075 * t, -0.31 - 0.28 * t, 0.028, 0.045);
  }

  // ── Lips: Cupid's-bow upper lip, fuller lower lip, a clear line between ────
  d += 0.055 * bump(x, y, 0, -0.545, 0.15, 0.036);
  d += 0.016 * pair(x, y, 0.05, -0.528, 0.04, 0.02); // Cupid's bow peaks
  d += 0.06 * bump(x, y, 0, -0.66, 0.145, 0.046);
  d -= 0.046 * bump(x, y, 0, MOUTH_Y, 0.19, 0.014); // the mouth line itself
  d -= 0.016 * pair(x, y, 0.2, -0.6, 0.03, 0.04); // corner dimples
  d -= 0.03 * bump(x, y, 0, -0.77, 0.14, 0.03); // below the lower lip
  d += 0.05 * bump(x, y, 0, -0.9, 0.15, 0.1); // chin

  // Soft temple hollow so the forehead reads as a distinct form.
  d -= 0.02 * pair(x, y, 0.66, 0.15, 0.1, 0.22);

  z += d * front;
  return { x, y, z };
}

/** The point on the face surface at (x, y) — used to seat eyes, brows, the bindi, etc. */
export function surfaceAt(x: number, y: number): THREE.Vector3 {
  let px = x / HEAD.rx;
  let py = y / HEAD.ry;
  let out = { x: 0, y: 0, z: 0 };
  for (let i = 0; i < 8; i++) {
    const pz = Math.sqrt(Math.max(0.0001, 1 - px * px - py * py));
    out = sculpt(px, py, pz);
    px += (x - out.x) / HEAD.rx;
    py += (y - out.y) / HEAD.ry;
  }
  return new THREE.Vector3(out.x, out.y, out.z);
}

export const SKIN = {
  base: new THREE.Color('#c58c68'), // warm wheatish — a common, natural Indian skin tone
  blush: new THREE.Color('#c4705a'),
  socket: new THREE.Color('#9c6347'),
  scalp: new THREE.Color('#8f5f48'),
  root: new THREE.Color('#150b08'),
};

/** Where the hair begins on the forehead and temples (shared with the hair shader). */
export function hairlineY(x: number): number {
  return 0.6 - 0.36 * smooth(Math.abs(x), 0, 0.72);
}

/** Builds the head mesh geometry with baked skin colouring (lips, blush, shading). */
export function buildHeadGeometry(): THREE.BufferGeometry {
  const geo = new THREE.SphereGeometry(1, 240, 240);
  // Put the texture seam at the back of the head, where hair hides it.
  geo.rotateY(-Math.PI / 2);

  const pos = geo.attributes.position as THREE.BufferAttribute;
  const colors = new Float32Array(pos.count * 3);
  const c = new THREE.Color();

  for (let i = 0; i < pos.count; i++) {
    const s = sculpt(pos.getX(i), pos.getY(i), pos.getZ(i));
    pos.setXYZ(i, s.x, s.y, s.z);

    c.copy(SKIN.base);
    const x = s.x;
    const y = s.y;
    const isFront = s.z > 0.2;

    if (isFront) {
      c.lerp(SKIN.socket, 0.2 * pair(x, y, 0.35, 0.07, 0.2, 0.1)); // periorbital depth
      c.lerp(SKIN.blush, 0.3 * pair(x, y, 0.42, -0.3, 0.2, 0.14)); // cheek flush
      c.lerp(SKIN.blush, 0.1 * bump(x, y, 0, -0.25, 0.1, 0.07)); // nose tip warmth
    }
    // Under the hair: darken toward the roots so the hairline fades instead of cutting.
    const root = smooth(y, hairlineY(x) - 0.07, hairlineY(x) + 0.03);
    c.lerp(SKIN.root, root);
    if (Math.abs(x) < 0.013 && y > 0.45 && s.z > 0) c.lerp(SKIN.scalp, 0.9); // centre parting shows scalp
    // Soft shade under the chin, so the head separates from the neck.
    c.multiplyScalar(1 - 0.28 * smooth(-y, 0.85, 1.0));
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }

  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  return geo;
}
