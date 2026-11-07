import * as THREE from 'three';
import { SKIN } from './face-geometry';

// One eye = eyeball (sclera + layered iris) + two eyelid "patches" that wrap the globe.
// The lids are sphere patches whose edges follow a lens-shaped curve, so the opening
// is a proper almond with the outer corner tilted slightly up. Blinking is a morph
// target that slides each edge to the closed curve while the outer rim stays put —
// there is never a gap. Kohl liner and upper lashes are baked into the same mesh, so
// they move with the lid for free.

export const EYE = {
  r: 0.14,
  lidR: 0.1475,
  halfWidthDeg: 65, // half the width of the opening
  patchDeg: 84, // how far the lid patch reaches around the globe
  irisDeg: 25,
};

const DEG = Math.PI / 180;
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/** Edge elevation (degrees) at azimuth `az` (degrees), for one lid in one state. */
function edgeElevation(kind: 'upper' | 'lower', closed: boolean, az: number, outerSign: number): number {
  const c = Math.pow(Math.max(0, Math.cos(((Math.PI / 2) * az) / EYE.halfWidthDeg)), 0.85);
  const u = clamp((outerSign * az) / EYE.halfWidthDeg, -1, 1); // −1 inner corner … +1 outer corner
  const tilt = 4.5 * u; // outer corner sits higher — the classic almond tilt
  if (closed) return -10 * c + tilt - (kind === 'lower' ? 0.6 : 0);
  return (kind === 'upper' ? 20 : -24) * c + tilt;
}

function dir(azDeg: number, elDeg: number, out = new THREE.Vector3()) {
  const az = azDeg * DEG;
  const el = elDeg * DEG;
  return out.set(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el));
}

// Row offsets (degrees away from the lid edge), dense near the edge where the liner lives.
const ROW_OFFSETS = [0, 1.4, 2.8, 4.4, 6.4, 9, 13, 19, 28, 40, 54, 70];
const COLUMNS = 56;

/**
 * Builds a lid patch. `outerSign` is +1 for the eye on Arya's left (screen right, +x),
 * −1 for the eye on her right, so the outer corner tilt mirrors correctly.
 */
export function buildLid(kind: 'upper' | 'lower', outerSign: 1 | -1): THREE.BufferGeometry {
  const sign = kind === 'upper' ? 1 : -1;
  const rimEl = kind === 'upper' ? 80 : -72;
  const rows = ROW_OFFSETS.length;
  const cols = COLUMNS + 1;
  const centerEdge = edgeElevation(kind, false, 0, outerSign);
  const span = Math.abs(rimEl - centerEdge); // used to turn degree offsets into fractions

  const layout = (closed: boolean) => {
    const out: number[] = [];
    const v = new THREE.Vector3();
    for (let j = 0; j < rows; j++) {
      const frac = ROW_OFFSETS[j] / span;
      for (let i = 0; i < cols; i++) {
        const az = -EYE.patchDeg + (2 * EYE.patchDeg * i) / COLUMNS;
        const edge = edgeElevation(kind, closed, az, outerSign);
        const el = edge + (rimEl - edge) * frac;
        dir(az, el, v).multiplyScalar(EYE.lidR);
        out.push(v.x, v.y, v.z);
      }
    }
    return out;
  };

  const positions = layout(false);
  const closedPositions = layout(true);

  const colors: number[] = [];
  const kohl = new THREE.Color('#150a08');
  const shadow = new THREE.Color('#9a6446');
  const c = new THREE.Color();
  for (let j = 0; j < rows; j++) {
    const off = ROW_OFFSETS[j];
    for (let i = 0; i < cols; i++) {
      c.copy(SKIN.base).lerp(SKIN.socket, 0.18);
      if (kind === 'upper') {
        c.lerp(shadow, 0.35 * clamp((off - 6) / 30, 0, 1)); // soft eyeshadow in the lid crease
        c.lerp(kohl, 1 - clamp((off - 3.6) / 2.4, 0, 1)); // kohl liner, ~4° thick
      } else {
        c.lerp(kohl, 0.9 * (1 - clamp((off - 0.4) / 2.6, 0, 1))); // smudged waterline kohl
      }
      colors.push(c.r, c.g, c.b);
    }
  }

  const indices: number[] = [];
  for (let j = 0; j < rows - 1; j++) {
    for (let i = 0; i < cols - 1; i++) {
      const a = j * cols + i;
      const b = a + 1;
      const d = a + cols;
      const e = d + 1;
      // Winding differs between lids so both face outward.
      if (sign > 0) indices.push(a, d, b, b, d, e);
      else indices.push(a, b, d, b, e, d);
    }
  }

  // ── Upper lashes ───────────────────────────────────────────────────────────
  if (kind === 'upper') {
    const lashCount = 26;
    const lashPos = (closed: boolean) => {
      const out: number[] = [];
      const base = new THREE.Vector3();
      const normal = new THREE.Vector3();
      const up = new THREE.Vector3();
      const side = new THREE.Vector3();
      for (let k = 0; k < lashCount; k++) {
        const t = k / (lashCount - 1);
        const az = (-0.9 + 1.8 * t) * EYE.halfWidthDeg;
        const el = edgeElevation('upper', closed, az, outerSign);
        dir(az, el, base);
        normal.copy(base);
        // Tangent pointing "up" the globe and toward the outer corner.
        dir(az, el + 8, up).sub(base).normalize();
        dir(az + outerSign * 8, el, side).sub(base).normalize();
        const outerness = clamp((outerSign * az) / EYE.halfWidthDeg + 0.2, 0, 1.2);
        const len = (0.028 + 0.022 * outerness) * (closed ? 0.95 : 1);
        const w = 0.0085;
        const p0 = base.clone().multiplyScalar(EYE.lidR * 1.004);
        const along = side.clone().multiplyScalar(w / 2);
        // First segment leaves the lid forward and up; the second curls upward.
        const d0 = normal.clone().multiplyScalar(0.55).add(up.clone().multiplyScalar(0.7)).add(side.clone().multiplyScalar(0.25)).normalize();
        const d1 = normal.clone().multiplyScalar(0.12).add(up.clone().multiplyScalar(1)).add(side.clone().multiplyScalar(0.3)).normalize();
        const m = p0.clone().addScaledVector(d0, len * 0.55);
        const tip = m.clone().addScaledVector(d1, len * 0.5);
        const pts = [p0.clone().sub(along), p0.clone().add(along), m.clone().sub(along.clone().multiplyScalar(0.55)), m.clone().add(along.clone().multiplyScalar(0.55)), tip];
        for (const p of pts) out.push(p.x, p.y, p.z);
      }
      return out;
    };

    const baseIndex = positions.length / 3;
    const lashOpen = lashPos(false);
    const lashClosed = lashPos(true);
    positions.push(...lashOpen);
    closedPositions.push(...lashClosed);
    for (let k = 0; k < lashCount; k++) {
      const o = baseIndex + k * 5;
      indices.push(o, o + 1, o + 3, o, o + 3, o + 2, o + 2, o + 3, o + 4);
      for (let n = 0; n < 5; n++) colors.push(0.02, 0.012, 0.01);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.setIndex(indices);
  geo.morphAttributes.position = [new THREE.Float32BufferAttribute(closedPositions, 3)];
  geo.computeVertexNormals();
  return geo;
}

/** Sclera (the white), shaded darker toward the corners and under the lids. */
export function buildSclera(): THREE.BufferGeometry {
  const geo = new THREE.SphereGeometry(EYE.r, 48, 36);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  const white = new THREE.Color('#efe4d8');
  const corner = new THREE.Color('#c98d84');
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).normalize();
    const az = Math.abs(Math.atan2(v.x, v.z)) / DEG;
    const el = Math.abs(Math.asin(v.y)) / DEG;
    c.copy(white).lerp(corner, 0.55 * THREE.MathUtils.smoothstep(az, 38, 70));
    c.multiplyScalar(1 - 0.32 * THREE.MathUtils.smoothstep(el, 6, 24) - 0.25 * THREE.MathUtils.smoothstep(az, 30, 64));
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geo;
}

/** A layered brown iris: dark pupil, amber ring around it, streaked body, dark limbal edge. */
export function buildIris(): THREE.BufferGeometry {
  const geo = new THREE.SphereGeometry(EYE.r * 1.004, 72, 16, 0, Math.PI * 2, 0, EYE.irisDeg * DEG);
  geo.rotateX(Math.PI / 2); // pole → +z, facing forward
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  const pupil = new THREE.Color('#040201');
  const amber = new THREE.Color('#9a6128');
  const body = new THREE.Color('#4b2b16');
  const streak = new THREE.Color('#78471f');
  const limbal = new THREE.Color('#150a06');
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const theta = Math.acos(clamp(v.z / v.length(), -1, 1)) / (EYE.irisDeg * DEG); // 0 centre … 1 edge
    const phi = Math.atan2(v.y, v.x);
    const noise = 0.5 + 0.5 * Math.sin(phi * 23 + Math.sin(phi * 7) * 2);
    c.copy(body).lerp(streak, 0.55 * noise);
    c.lerp(amber, 1 - THREE.MathUtils.smoothstep(theta, 0.34, 0.62)); // collarette glow around the pupil
    c.lerp(limbal, THREE.MathUtils.smoothstep(theta, 0.82, 1));
    c.lerp(pupil, 1 - THREE.MathUtils.smoothstep(theta, 0.3, 0.36));
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geo;
}
