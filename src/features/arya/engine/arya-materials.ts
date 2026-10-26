import * as THREE from 'three';
import { MOUTH_Y } from './face-geometry';

// Materials and procedural textures for Arya. Everything is generated at runtime — no
// image assets to ship or license — and kept small so it loads fast on modest phones.

export interface FaceUniforms {
  uOpen: { value: number }; // jaw / lips apart, 0..1
  uWide: { value: number }; // "ee" — corners drawn out
  uRound: { value: number }; // "oo" — lips pursed and pushed forward
  uSmile: { value: number }; // corners and cheeks lifted
}

function canvasTexture(size: [number, number], draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void) {
  const canvas = document.createElement('canvas');
  [canvas.width, canvas.height] = size;
  draw(canvas.getContext('2d')!, size[0], size[1]);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/** Deterministic pseudo-random so every render of Arya looks identical. */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

// ── Skin ────────────────────────────────────────────────────────────────────

function skinBumpTexture(): THREE.Texture {
  const rand = rng(7);
  const tex = canvasTexture([256, 256], (ctx, w, h) => {
    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 5200; i++) {
      const v = 108 + Math.floor(rand() * 40);
      ctx.fillStyle = `rgba(${v},${v},${v},0.45)`;
      ctx.fillRect(rand() * w, rand() * h, 1 + rand() * 1.6, 1 + rand() * 1.6);
    }
  });
  tex.colorSpace = THREE.NoColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(9, 5);
  return tex;
}

/**
 * Skin with a mouth that can open, round, widen and smile.
 *
 * The deformation lives in the vertex shader and works on the *rest* position of each
 * vertex, so it needs no morph-target data: the lower lip and jaw swing down, the
 * corners pull in or out, and the cheeks lift. Where the lips part, the stretched
 * band of surface is painted as the inside of the mouth (teeth, then dark cavity and
 * tongue) in the fragment shader, which keeps the lips soft and the silhouette clean.
 */
export function makeSkinMaterial(): { material: THREE.MeshPhysicalMaterial; uniforms: FaceUniforms } {
  const uniforms: FaceUniforms = {
    uOpen: { value: 0 },
    uWide: { value: 0 },
    uRound: { value: 0 },
    uSmile: { value: 0.3 },
  };

  const material = new THREE.MeshPhysicalMaterial({
    vertexColors: true,
    roughness: 0.5,
    metalness: 0,
    sheen: 0.35,
    sheenColor: new THREE.Color('#ff9f86'),
    sheenRoughness: 0.6,
    clearcoat: 0.08,
    clearcoatRoughness: 0.5,
    emissive: new THREE.Color('#4b1b0f'), // warm glow in shadow — a cheap stand-in for subsurface scattering
    emissiveIntensity: 0.14,
    bumpMap: skinBumpTexture(),
    bumpScale: 0.35,
  });

  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);

    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform float uOpen; uniform float uWide; uniform float uRound; uniform float uSmile;
        varying float vBand; varying float vSpan; varying float vX; varying vec3 vRest;`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        {
          vec3 rp = position;
          float mx = abs(rp.x);
          float front = smoothstep(0.0, 0.45, rp.z);
          const float MY = ${MOUTH_Y.toFixed(3)};
          // 1 below the mouth line → 0 above it: a narrow band, so only the lips part.
          float band = 1.0 - smoothstep(MY - 0.035, MY + 0.035, rp.y);
          float span = 1.0 - smoothstep(0.07, 0.25, mx); // opening is widest at the centre
          float jawLow = (1.0 - smoothstep(MY - 0.06, MY + 0.1, rp.y)) * (1.0 - smoothstep(0.3, 0.72, mx));
          transformed.y -= uOpen * (0.115 * band * span + 0.06 * jawLow) * front;
          transformed.z -= uOpen * 0.03 * jawLow * front;

          float mouthRegion = exp(-(pow(rp.x / 0.3, 2.0) + pow((rp.y - MY) / 0.14, 2.0)) * 0.5) * front;
          transformed.x *= 1.0 - uRound * 0.2 * mouthRegion;
          transformed.z += uRound * 0.05 * mouthRegion;
          transformed.x *= 1.0 + uWide * 0.08 * mouthRegion;

          float corner = exp(-(pow((mx - 0.205) / 0.09, 2.0) + pow((rp.y - MY) / 0.08, 2.0)) * 0.5) * front;
          transformed.y += uSmile * 0.05 * corner;
          transformed.x += sign(rp.x) * uSmile * 0.018 * corner;
          float cheek = exp(-(pow((mx - 0.41) / 0.2, 2.0) + pow((rp.y + 0.3) / 0.14, 2.0)) * 0.5) * front;
          transformed.y += uSmile * 0.018 * cheek;
          transformed.z += uSmile * 0.012 * cheek;

          vBand = band; vSpan = span; vX = rp.x; vRest = rp;
        }`,
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform float uOpen;
        varying float vBand; varying float vSpan; varying float vX; varying vec3 vRest;`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        const float MY = ${MOUTH_Y.toFixed(3)};
        float ax = abs(vRest.x);
        float dy = vRest.y - MY;
        float frontFace = step(0.05, vRest.z);

        // Lips, drawn from their outline so the edge stays crisp at any resolution.
        float lx = clamp(ax / 0.205, 0.0, 1.0);
        float taper = pow(max(1.0 - lx * lx, 0.0), 0.7);
        float bow = 0.012 * exp(-pow((ax - 0.055) / 0.03, 2.0)) - 0.009 * exp(-pow(ax / 0.016, 2.0));
        float upperH = (0.07 + bow) * taper;
        float lowerH = 0.1 * taper;
        float inside = dy > 0.0 ? upperH - dy : lowerH + dy;
        float lipMask = smoothstep(-0.0012, 0.0035, inside) * (1.0 - smoothstep(0.2, 0.222, ax)) * frontFace;
        vec3 lipCol = mix(vec3(0.34, 0.052, 0.066), vec3(0.45, 0.07, 0.085), step(dy, 0.0) * 0.85);
        lipCol = mix(vec3(0.19, 0.022, 0.03), lipCol, smoothstep(0.0, 0.011, inside)); // soft lip liner
        diffuseColor.rgb = mix(diffuseColor.rgb, lipCol, lipMask * 0.96);

        // The line between the lips.
        float creaseW = 0.0036 + 0.002 * (1.0 - lx);
        float crease = (1.0 - smoothstep(creaseW * 0.4, creaseW * 1.5, abs(dy))) * (1.0 - smoothstep(0.17, 0.212, ax)) * frontFace;

        // Nostrils.
        float nostril = (1.0 - smoothstep(0.55, 1.0, length(vec2((ax - 0.072) / 0.03, (vRest.y + 0.312) / 0.017)))) * frontFace;
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.03, 0.012, 0.01), nostril * 0.92);

        float mouthGap = smoothstep(0.03, 0.14, uOpen * vSpan)
          * smoothstep(0.03, 0.12, vBand) * (1.0 - smoothstep(0.86, 0.97, vBand))
          * (1.0 - smoothstep(0.16, 0.215, ax));
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.035, 0.007, 0.01), crease * 0.9 * (1.0 - mouthGap));
        {
          vec3 teeth = vec3(0.86, 0.80, 0.70);
          vec3 cavity = vec3(0.045, 0.008, 0.012);
          vec3 tongue = vec3(0.38, 0.10, 0.12);
          vec3 inner = mix(cavity, tongue, smoothstep(0.62, 0.92, vBand) * smoothstep(0.2, 0.5, uOpen));
          inner = mix(teeth, inner, smoothstep(0.16, 0.3, vBand));
          diffuseColor.rgb = mix(diffuseColor.rgb, inner, mouthGap);
        }`,
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
        roughnessFactor = mix(mix(roughnessFactor, 0.28, lipMask), 0.85, mouthGap);`,
      );
  };
  material.customProgramCacheKey = () => 'arya-skin-v2';

  return { material, uniforms };
}

/** Plain skin for the neck, ears, lids and chest — same look, no mouth shader. */
export function makePlainSkinMaterial(options: Partial<THREE.MeshPhysicalMaterialParameters> = {}) {
  return new THREE.MeshPhysicalMaterial({
    vertexColors: true,
    roughness: 0.52,
    sheen: 0.35,
    sheenColor: new THREE.Color('#ff9f86'),
    sheenRoughness: 0.6,
    emissive: new THREE.Color('#4b1b0f'),
    emissiveIntensity: 0.14,
    ...options,
  });
}

// ── Hair ────────────────────────────────────────────────────────────────────

/** Fine vertical strands with a glossy variation — runs along the V axis. */
export function hairTexture(): THREE.Texture {
  const rand = rng(21);
  const tex = canvasTexture([1024, 512], (ctx, w, h) => {
    ctx.fillStyle = '#1b0f0a';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 1500; i++) {
      const x = rand() * w;
      const tone = rand();
      const l = tone < 0.14 ? 58 + rand() * 34 : 12 + rand() * 22;
      ctx.strokeStyle = `rgba(${l * 1.15},${l * 0.9},${l * 0.78},${tone < 0.12 ? 0.35 : 0.55})`;
      ctx.lineWidth = 0.8 + rand() * 2.2;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.bezierCurveTo(x + (rand() - 0.5) * 8, h * 0.33, x + (rand() - 0.5) * 8, h * 0.66, x + (rand() - 0.5) * 6, h);
      ctx.stroke();
    }
  });
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

export interface HairMaterialOptions {
  /** Cuts the front hairline, the temples (so the ears show) and the underside. */
  cap?: boolean;
  /** Fades the ends of the hair out so they look wispy rather than cut. */
  fadeBelowY?: number;
}

export function makeHairMaterial(map: THREE.Texture, options: HairMaterialOptions = {}) {
  const material = new THREE.MeshPhysicalMaterial({
    map,
    color: '#ffffff',
    roughness: 0.46,
    metalness: 0,
    sheen: options.cap ? 0.15 : 0.5,
    sheenColor: new THREE.Color('#6d5a7a'),
    sheenRoughness: 0.5,
    anisotropy: options.cap ? 0.55 : 0.4, // stretches the highlight along each strand, like real hair
    anisotropyRotation: options.cap ? Math.PI / 2 : options.fadeBelowY !== undefined ? Math.PI / 2 : 0,
    side: options.cap ? THREE.FrontSide : THREE.DoubleSide,
    alphaToCoverage: true, // soft, anti-aliased edges without sorting problems
  });

  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vObj;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvObj = position;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vObj;')
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        {
          float cover = 1.0;
          ${
            options.cap
              ? `
          // Hairline: high on the forehead, curving down to the temples; ears stay uncovered.
          float hairline = 0.6 - 0.36 * smoothstep(0.0, 0.72, abs(vObj.x));
          if (vObj.z > -0.42) cover *= smoothstep(0.0, 0.05, vObj.y - hairline);
          // Centre parting: a hair-thin gap near the front of the crown.
          if (vObj.z > 0.1 && vObj.y > 0.4) cover *= smoothstep(0.004, 0.012, abs(vObj.x));
          cover *= 1.0 - smoothstep(-0.62, -0.5, -vObj.y) * 0.0;
          if (vObj.y < -0.5) discard;`
              : ''
          }
          ${
            options.fadeBelowY !== undefined
              ? `
          cover *= smoothstep(${(options.fadeBelowY - 0.8).toFixed(2)}, ${options.fadeBelowY.toFixed(2)}, vObj.y);`
              : ''
          }
          diffuseColor.a *= cover;
        }`,
      );
  };
  material.customProgramCacheKey = () => `arya-hair-v2-${options.cap ? 'cap' : 'flow'}-${options.fadeBelowY ?? 'none'}`;
  return material;
}

// ── Kurta ───────────────────────────────────────────────────────────────────

/** White linen with a blue floral vine down each side of the placket. Mapped front-on (planar). */
export function kurtaTexture(): THREE.Texture {
  const rand = rng(5);
  return canvasTexture([512, 768], (ctx, w, h) => {
    ctx.fillStyle = '#f2ede4';
    ctx.fillRect(0, 0, w, h);
    // Linen weave
    for (let y = 0; y < h; y += 2) {
      ctx.fillStyle = `rgba(120,110,95,${0.018 + rand() * 0.03})`;
      ctx.fillRect(0, y, w, 1);
    }
    for (let x = 0; x < w; x += 3) {
      ctx.fillStyle = `rgba(120,110,95,${0.012 + rand() * 0.02})`;
      ctx.fillRect(x, 0, 1, h);
    }
    const blue = '#33478f';
    const flower = (cx: number, cy: number, r: number) => {
      ctx.fillStyle = blue;
      for (let k = 0; k < 5; k++) {
        const a = (k / 5) * Math.PI * 2;
        ctx.beginPath();
        ctx.ellipse(cx + Math.cos(a) * r * 0.7, cy + Math.sin(a) * r * 0.7, r * 0.55, r * 0.34, a, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = '#f2ede4';
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.22, 0, Math.PI * 2);
      ctx.fill();
    };
    // Two vines, mirrored about the placket (x = centre of the texture).
    for (const dir of [-1, 1]) {
      ctx.strokeStyle = blue;
      ctx.lineWidth = 3;
      ctx.beginPath();
      for (let y = 0; y <= h; y += 6) {
        const x = w / 2 + dir * (62 + Math.sin(y / 38) * 16);
        if (y === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      for (let y = 20; y < h; y += 44) {
        const x = w / 2 + dir * (62 + Math.sin(y / 38) * 16);
        flower(x + dir * 20, y, 11 + rand() * 3);
        ctx.fillStyle = blue;
        ctx.beginPath();
        ctx.ellipse(x - dir * 16, y + 20, 13, 5.5, dir * 0.7, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(x + dir * 4, y + 30, 11, 4.5, -dir * 0.6, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // Centre placket
    ctx.fillStyle = 'rgba(190,180,165,0.5)';
    ctx.fillRect(w / 2 - 1, 0, 2, h);
  });
}
