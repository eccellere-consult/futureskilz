import * as THREE from "three";

import type { AryaScene, Drive } from "./arya-scene";

/**
 * Arya from a single portrait photograph, brought to life in the browser: she breathes, sways, blinks, and her mouth opens with
 * her voice. Place the picture at `public/avatars/arya.jpg` (or .png / .webp). Where the face sits in the picture is read from
 * `public/avatars/arya.json` if present; the defaults below were measured on the supplied reference portrait.
 *
 * This is a gentle, real-time warp of one still image, not video: it is lifelike for a sentence or two at a time, and it never
 * pretends to be a recording of a real person. A lip-synced video avatar service can replace it later through the same `Drive`.
 */

export type PortraitConfig = {
  /** Fractions of the picture, measured from the top-left. */
  mouth: [number, number];
  mouthRadius: [number, number];
  eyes: [[number, number], [number, number]];
  eyeRadius: [number, number];
  /** Centre of the crop, and how much of the picture's width to show. */
  focus: [number, number];
  width: number;
};

/** Measured on the current 1254 x 1254 portrait (upright, closed-lip smile). */
export const DEFAULT_PORTRAIT: PortraitConfig = {
  mouth: [0.49, 0.512],
  mouthRadius: [0.07, 0.028],
  eyes: [[0.418, 0.353], [0.578, 0.36]],
  eyeRadius: [0.038, 0.014],
  focus: [0.49, 0.405],
  width: 0.78,
};

const EXTENSIONS = ["jpg", "jpeg", "png", "webp"];

export async function portraitUrl(): Promise<string | null> {
  for (const extension of EXTENSIONS) {
    const url = `/avatars/arya.${extension}`;
    try {
      const response = await fetch(url, { method: "HEAD", cache: "no-store" });
      // The file's own validators go on the address, so a replaced picture is fetched afresh instead of coming from a browser or host cache.
      if (response.ok && (response.headers.get("content-type") ?? "").startsWith("image/")) {
        const version = response.headers.get("etag") ?? response.headers.get("last-modified") ?? response.headers.get("content-length") ?? "";
        return version ? `${url}?v=${encodeURIComponent(version)}` : url;
      }
    } catch {
      /* try the next */
    }
  }
  return null;
}

async function readConfig(): Promise<PortraitConfig> {
  try {
    const response = await fetch("/avatars/arya.json", { cache: "no-store" });
    if (response.ok && (response.headers.get("content-type") ?? "").includes("json")) return { ...DEFAULT_PORTRAIT, ...((await response.json()) as Partial<PortraitConfig>) };
  } catch {
    /* defaults */
  }
  return DEFAULT_PORTRAIT;
}

const VERTEX = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

const FRAGMENT = `
precision highp float;
varying vec2 vUv;
uniform sampler2D uMap;
uniform vec4 uCrop;      // x0, y0 (bottom-up), w, h in picture space
uniform vec2 uMouth; uniform vec2 uMouthR;
uniform vec2 uEyeA; uniform vec2 uEyeB; uniform vec2 uEyeR;
uniform float uOpen; uniform float uBlink; uniform float uBreath; uniform vec2 uSway;

float blob(vec2 p, vec2 c, vec2 r){ vec2 d = (p - c) / r; return exp(-dot(d, d)); }

void main(){
  vec2 uv = uCrop.xy + vUv * uCrop.zw;
  vec2 mid = uCrop.xy + uCrop.zw * vec2(0.5, 0.0);
  uv = mid + (uv - mid) * (1.0 - uBreath) + uSway;

  // The jaw and lower lip follow the voice: pixels below the lip line are fetched from higher up, so they move down.
  float m = blob(uv, uMouth, uMouthR * vec2(1.0, 1.7));
  float below = smoothstep(-0.25, 0.55, (uMouth.y - uv.y) / uMouthR.y);
  vec2 p = uv + vec2(0.0, uOpen * uMouthR.y * 0.55 * m * below);

  vec4 base = texture2D(uMap, p);
  // Eyelids: the skin above each eye is drawn down over it for a blink.
  float eyes = max(blob(uv, uEyeA, uEyeR), blob(uv, uEyeB, uEyeR));
  vec4 lid = texture2D(uMap, p + vec2(0.0, uEyeR.y * 2.3));
  vec4 col = mix(base, lid, clamp(uBlink * eyes * 1.4, 0.0, 1.0));

  // A soft dark gap between the lips when the mouth opens.
  float gap = blob(uv, uMouth + vec2(0.0, -uMouthR.y * 0.03), vec2(uMouthR.x * 0.5, uMouthR.y * 0.34 * uOpen + 0.0004));
  col.rgb = mix(col.rgb, vec3(0.16, 0.05, 0.05), clamp(gap * uOpen * 1.6, 0.0, 0.75));
  vec3 lin = max(col.rgb, vec3(0.0));
  gl_FragColor = vec4(mix(lin * 12.92, 1.055 * pow(lin, vec3(1.0 / 2.4)) - 0.055, step(vec3(0.0031308), lin)), 1.0);
}`;

const smooth = (current: number, target: number, rate: number, dt: number): number => current + (target - current) * (1 - Math.exp(-rate * dt));

export async function createPortraitArya(canvas: HTMLCanvasElement, drive: Drive, url: string): Promise<AryaScene> {
  const config = await readConfig();
  const texture = await new THREE.TextureLoader().loadAsync(url);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  const image = texture.image as { width: number; height: number };
  const pictureAspect = image.width / image.height;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "low-power" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  const up = (point: [number, number]) => new THREE.Vector2(point[0], 1 - point[1]);
  const uniforms = {
    uMap: { value: texture },
    uCrop: { value: new THREE.Vector4(0, 0, 1, 1) },
    uMouth: { value: up(config.mouth) },
    uMouthR: { value: new THREE.Vector2(...config.mouthRadius) },
    uEyeA: { value: up(config.eyes[0]) },
    uEyeB: { value: up(config.eyes[1]) },
    uEyeR: { value: new THREE.Vector2(...config.eyeRadius) },
    uOpen: { value: 0 },
    uBlink: { value: 0 },
    uBreath: { value: 0 },
    uSway: { value: new THREE.Vector2() },
  };
  const material = new THREE.ShaderMaterial({ uniforms, vertexShader: VERTEX, fragmentShader: FRAGMENT });
  const scene = new THREE.Scene();
  scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material));
  const camera = new THREE.Camera();

  function resize() {
    const width = canvas.clientWidth || 320;
    const height = canvas.clientHeight || 320;
    renderer.setSize(width, height, false);
    // Show `config.width` of the picture across, as tall as the frame needs, kept inside the picture.
    const w = Math.min(1, config.width);
    const h = Math.min(1, (w * pictureAspect * height) / width);
    const x0 = Math.min(1 - w, Math.max(0, config.focus[0] - w / 2));
    const yTop = Math.min(1 - h, Math.max(0, config.focus[1] - h / 2));
    uniforms.uCrop.value.set(x0, 1 - yTop - h, w, h);
  }
  resize();

  const clock = new THREE.Clock();
  const state = { open: 0, blink: 0, nextBlink: 1.6 };
  let raf = 0;
  let disposed = false;
  function tick() {
    if (disposed) return;
    raf = requestAnimationFrame(tick);
    const dt = Math.min(clock.getDelta(), 0.05);
    const t = clock.elapsedTime;
    const speaking = drive.speaking();
    state.open = smooth(state.open, speaking ? Math.min(1, drive.level()) : 0, 26, dt);
    state.nextBlink -= dt;
    if (state.nextBlink <= 0 && state.blink === 0) state.blink = 0.0001;
    if (state.blink > 0) {
      state.blink += dt / 0.13;
      if (state.blink >= 2) {
        state.blink = 0;
        state.nextBlink = 2.4 + Math.random() * 3.6;
      }
    }
    uniforms.uOpen.value = state.open;
    uniforms.uBlink.value = state.blink > 0 ? 1 - Math.abs(state.blink - 1) : 0;
    uniforms.uBreath.value = 0.004 + Math.sin(t * 1.3) * 0.003 + (drive.listening() ? 0.003 : 0);
    uniforms.uSway.value.set(Math.sin(t * 0.45) * 0.0016 + (speaking ? Math.sin(t * 3.1) * state.open * 0.0008 : 0), Math.sin(t * 0.7) * 0.0009 - state.open * 0.0006);
    renderer.render(scene, camera);
  }
  tick();

  return {
    kind: "model",
    resize,
    dispose() {
      disposed = true;
      cancelAnimationFrame(raf);
      texture.dispose();
      material.dispose();
      renderer.dispose();
    },
  };
}
