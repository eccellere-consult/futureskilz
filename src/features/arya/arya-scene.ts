import * as THREE from "three";

/**
 * Arya, drawn live in 3D. The figure is built in code (no downloaded model), so it ships with the site and never leaves a
 * visitor's browser. It is a stylised character, clearly an AI: it is not a likeness of any real person.
 *
 * Everything that moves is driven from one `Drive` object: how loud the voice is right now, whether she is listening, and a
 * warmth value. A licensed or commissioned model with blendshapes can replace this by placing `public/avatars/arya.glb`
 * (see `loadModel`); the same `Drive` then moves its mouth and eyes.
 */

export type Drive = {
  /** 0..1, how open the mouth is right now (from the voice). */
  level: () => number;
  listening: () => boolean;
  speaking: () => boolean;
};

export type AryaScene = { dispose: () => void; resize: () => void; kind: "procedural" | "model" };

const SKIN = new THREE.Color("#b07d5d");
const SKIN_SHADE = new THREE.Color("#8f5a3c");
const LIP = new THREE.Color("#94413f");
const HAIR = new THREE.Color("#120c0a");
const GOLD = new THREE.Color("#d4ae6a");
const SAREE = new THREE.Color("#4b2a63");
const SAREE_B = new THREE.Color("#2c6e6a");

const OPEN = -0.78;
const smooth = (current: number, target: number, rate: number, dt: number): number => current + (target - current) * (1 - Math.exp(-rate * dt));

function noiseTexture(size: number, base: string, grain: number): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const g = canvas.getContext("2d")!;
  g.fillStyle = base;
  g.fillRect(0, 0, size, size);
  const image = g.getImageData(0, 0, size, size);
  for (let i = 0; i < image.data.length; i += 4) {
    const n = (Math.random() - 0.5) * grain;
    image.data[i] += n;
    image.data[i + 1] += n;
    image.data[i + 2] += n;
  }
  g.putImageData(image, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function irisTexture(): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const g = canvas.getContext("2d")!;
  const c = size / 2;
  const iris = g.createRadialGradient(c, c, 6, c, c, c * 0.98);
  iris.addColorStop(0, "#050302");
  iris.addColorStop(0.28, "#1b0d06");
  iris.addColorStop(0.55, "#4a2511");
  iris.addColorStop(0.85, "#2a140a");
  iris.addColorStop(1, "#0a0503");
  g.fillStyle = iris;
  g.beginPath();
  g.arc(c, c, c * 0.98, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = "rgba(160,95,45,0.35)";
  g.lineWidth = 1.2;
  for (let i = 0; i < 70; i += 1) {
    const a = (i / 70) * Math.PI * 2;
    g.beginPath();
    g.moveTo(c + Math.cos(a) * c * 0.22, c + Math.sin(a) * c * 0.22);
    g.lineTo(c + Math.cos(a + 0.05) * c * 0.9, c + Math.sin(a + 0.05) * c * 0.9);
    g.stroke();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function fabricTexture(): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const g = canvas.getContext("2d")!;
  g.fillStyle = "#ffffff";
  g.fillRect(0, 0, size, size);
  g.strokeStyle = "rgba(0,0,0,0.10)";
  g.lineWidth = 1;
  for (let i = 0; i < size; i += 3) {
    g.beginPath();
    g.moveTo(i, 0);
    g.lineTo(i, size);
    g.stroke();
    g.beginPath();
    g.moveTo(0, i);
    g.lineTo(size, i);
    g.stroke();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(6, 6);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** The head: an egg-shaped surface with cheekbones, a tapered jaw and a soft chin, shaded with painted blush. */
function buildHead(): { mesh: THREE.Mesh; base: Float32Array } {
  const geometry = new THREE.SphereGeometry(1, 96, 96);
  const position = geometry.attributes.position as THREE.BufferAttribute;
  const colors = new Float32Array(position.count * 3);
  const p = new THREE.Vector3();
  for (let i = 0; i < position.count; i += 1) {
    p.fromBufferAttribute(position, i);
    // Width: full across the brow and cheekbones, narrowing to a soft chin.
    const below = Math.max(0, -p.y - 0.05);
    const taper = 1 - 0.23 * Math.pow(Math.min(below / 0.95, 1), 1.6);
    p.x *= 0.78 * taper;
    // Height and depth: slightly taller than wide, a gently flatter back.
    p.y *= 1.04;
    p.z *= p.z < 0 ? 0.86 : 0.9;
    // Cheekbones
    const cheek = Math.exp(-(Math.pow((Math.abs(p.x) - 0.5) / 0.22, 2) + Math.pow((p.y + 0.08) / 0.2, 2))) * (p.z > 0 ? 1 : 0);
    p.x += Math.sign(p.x) * cheek * 0.035;
    p.z += cheek * 0.02;
    // Eye sockets, a touch recessed
    const socket = Math.exp(-(Math.pow((Math.abs(p.x) - 0.3) / 0.15, 2) + Math.pow((p.y - 0.14) / 0.1, 2))) * (p.z > 0 ? 1 : 0);
    p.z -= socket * 0.022;
    // Forehead, gently full
    const forehead = Math.exp(-(Math.pow(p.x / 0.5, 2) + Math.pow((p.y - 0.55) / 0.22, 2))) * (p.z > 0 ? 1 : 0);
    p.z += forehead * 0.025;
    // Nose bridge: a soft ridge from between the brows down to the tip, widening a little toward the nostrils
    const ridge = Math.exp(-Math.pow(p.x / (0.07 + Math.max(0, 0.15 - p.y) * 0.18), 2)) * Math.exp(-Math.pow((p.y + 0.02) / 0.3, 2)) * (p.z > 0 ? 1 : 0);
    p.z += ridge * 0.05;
    // Chin
    const chin = Math.exp(-(Math.pow(p.x / 0.12, 2) + Math.pow((p.y + 0.86) / 0.12, 2))) * (p.z > 0 ? 1 : 0);
    p.z += chin * 0.045;
    position.setXYZ(i, p.x, p.y, p.z);

    // Painted colour: warm skin, rosy cheeks, slightly deeper around the eyes and lower face.
    const blush = Math.exp(-(Math.pow((Math.abs(p.x) - 0.46) / 0.2, 2) + Math.pow((p.y + 0.12) / 0.17, 2))) * (p.z > 0 ? 0.55 : 0);
    const shade = Math.exp(-(Math.pow((Math.abs(p.x) - 0.3) / 0.16, 2) + Math.pow((p.y - 0.17) / 0.09, 2))) * (p.z > 0 ? 0.35 : 0);
    const color = SKIN.clone().lerp(new THREE.Color("#c06a58"), blush * 0.55).lerp(SKIN_SHADE, shade);
    colors.set([color.r, color.g, color.b], i * 3);
  }
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  const material = new THREE.MeshPhysicalMaterial({
    vertexColors: true,
    roughness: 0.52,
    metalness: 0,
    clearcoat: 0.18,
    clearcoatRoughness: 0.55,
    sheen: 0.6,
    sheenColor: new THREE.Color("#e8a584"),
    sheenRoughness: 0.5,
    bumpMap: noiseTexture(256, "#808080", 40),
    bumpScale: 0.0025,
  });
  const mesh = new THREE.Mesh(geometry, material);
  return { mesh, base: Float32Array.from(position.array as Float32Array) };
}

/** Finds where the face surface is at (x, y) so features sit on it rather than float in front of it. */
function surfaceAt(head: THREE.Mesh, x: number, y: number): { point: THREE.Vector3; normal: THREE.Vector3 } {
  const ray = new THREE.Raycaster(new THREE.Vector3(x, y, 3), new THREE.Vector3(0, 0, -1));
  const hit = ray.intersectObject(head, false)[0];
  const point = hit ? hit.point.clone() : new THREE.Vector3(x, y, 0.7);
  const normal = hit?.face ? hit.face.normal.clone() : new THREE.Vector3(0, 0, 1);
  return { point, normal };
}

function tube(points: THREE.Vector3[], radius: number, material: THREE.Material, segments = 40): THREE.Mesh {
  const curve = new THREE.CatmullRomCurve3(points);
  return new THREE.Mesh(new THREE.TubeGeometry(curve, segments, radius, 8, false), material);
}

type Eye = { group: THREE.Group; ball: THREE.Group; lid: THREE.Mesh; lashes: THREE.Mesh; side: 1 | -1 };

function buildEye(head: THREE.Mesh, side: 1 | -1, textures: { iris: THREE.Texture }): Eye {
  const x = 0.29 * side;
  const y = 0.13;
  const { point } = surfaceAt(head, x, y);
  const group = new THREE.Group();
  group.position.copy(point).add(new THREE.Vector3(0, 0, -0.045));
  group.rotation.z = side * -0.1; // outer corner a touch higher: a soft, lifted eye
  const radius = 0.1;
  const ball = new THREE.Group();
  ball.add(new THREE.Mesh(new THREE.SphereGeometry(radius, 40, 32), new THREE.MeshPhysicalMaterial({ color: "#f3ece4", roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.05 })));
  const iris = new THREE.Mesh(new THREE.CircleGeometry(radius * 0.52, 48), new THREE.MeshStandardMaterial({ map: textures.iris, roughness: 0.2 }));
  iris.position.z = radius * 0.985;
  ball.add(iris);
  const gloss = new THREE.Mesh(new THREE.SphereGeometry(radius * 1.015, 32, 24), new THREE.MeshPhysicalMaterial({ color: "#ffffff", transparent: true, opacity: 0.1, roughness: 0, clearcoat: 1, transmission: 0 }));
  ball.add(gloss);
  const spark = new THREE.Mesh(new THREE.CircleGeometry(radius * 0.09, 12), new THREE.MeshBasicMaterial({ color: "#ffffff" }));
  spark.position.set(-radius * 0.2, radius * 0.22, radius * 1.02);
  ball.add(spark);
  group.add(ball);

  // The upper lid is a skin-coloured shell that swings down to blink.
  const lid = new THREE.Mesh(
    new THREE.SphereGeometry(radius * 1.12, 40, 24, 0, Math.PI * 2, 0, Math.PI * 0.52),
    new THREE.MeshStandardMaterial({ color: SKIN.clone().multiplyScalar(0.96), roughness: 0.55, side: THREE.DoubleSide }),
  );
  lid.rotation.x = OPEN; // relaxed, half-lidded
  group.add(lid);
  // Kajal along the lash line, winged at the outer corner, and lashes.
  const kajalMaterial = new THREE.MeshStandardMaterial({ color: "#0a0605", roughness: 0.6 });
  const lashPoints: THREE.Vector3[] = [];
  for (let i = 0; i <= 12; i += 1) {
    const a = Math.PI * (0.06 + 0.88 * (i / 12));
    lashPoints.push(new THREE.Vector3(Math.cos(a) * radius * 1.16 * -side, Math.sin(a) * radius * 0.5 + 0.0, radius * 0.97));
  }
  lashPoints.push(new THREE.Vector3(radius * 1.5 * side, radius * 0.1, radius * 0.9));
  const lashes = tube(lashPoints, 0.0085, kajalMaterial, 36);
  group.add(lashes);
  const lower = tube(
    Array.from({ length: 9 }, (_, i) => {
      const a = Math.PI * (1.08 + 0.84 * (i / 8));
      return new THREE.Vector3(Math.cos(a) * radius * 1.1 * -side, Math.sin(a) * radius * 0.45 - 0.004, radius * 0.95);
    }),
    0.0055,
    new THREE.MeshStandardMaterial({ color: "#1c0f0b", roughness: 0.7 }),
    24,
  );
  group.add(lower);
  return { group, ball, lid, lashes, side };
}

export function createProceduralArya(canvas: HTMLCanvasElement, drive: Drive): AryaScene {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "low-power" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(24, 1, 0.1, 50);
  camera.position.set(0, 0.28, 7.3);
  camera.lookAt(0, -0.18, 0);

  // Light: a warm key from the front-left, a cool fill, a gold rim from behind, soft sky and ground.
  scene.add(new THREE.HemisphereLight("#fff1e6", "#3a2a4a", 0.5));
  const key = new THREE.DirectionalLight("#fff0dd", 3.0);
  key.position.set(-2.4, 2.6, 4);
  scene.add(key);
  const fill = new THREE.DirectionalLight("#b9c8ff", 0.5);
  fill.position.set(3, 0.4, 3);
  scene.add(fill);
  const rim = new THREE.DirectionalLight("#ffd79a", 1.7);
  rim.position.set(2, 2, -3);
  scene.add(rim);

  const root = new THREE.Group();
  scene.add(root);
  const textures = { iris: irisTexture(), cloth: fabricTexture() };

  // ---- Head and face ----------------------------------------------------------------------------------------------
  const headGroup = new THREE.Group();
  headGroup.position.y = 0.2;
  root.add(headGroup);
  const { mesh: head, base } = buildHead();
  headGroup.add(head);
  head.updateMatrixWorld(true);

  const eyes = [buildEye(head, 1, textures), buildEye(head, -1, textures)];
  for (const eye of eyes) headGroup.add(eye.group);

  // Brows: dark, softly arched, a little fuller at the inner end.
  const browMaterial = new THREE.MeshStandardMaterial({ color: "#150d09", roughness: 0.8 });
  const brows: THREE.Mesh[] = [];
  for (const side of [1, -1]) {
    const pts = [0.13, 0.22, 0.32, 0.42, 0.5].map((dx, i) => {
      const arch = [0, 0.028, 0.04, 0.03, 0.0][i];
      const s = surfaceAt(head, side * dx, 0.285 + arch);
      return s.point.add(new THREE.Vector3(0, 0, 0.012));
    });
    const brow = tube(pts, 0.0165, browMaterial, 30);
    brow.scale.set(1, 1, 1);
    headGroup.add(brow);
    brows.push(brow);
  }

  // Nose: a straight, softly rounded bridge and tip, with a small gold stud.
  const nose = new THREE.Group();
  const tip = surfaceAt(head, 0, -0.14);
  const noseMaterial = new THREE.MeshStandardMaterial({ color: SKIN.clone().multiplyScalar(1.02), roughness: 0.5 });
  const noseTip = new THREE.Mesh(new THREE.SphereGeometry(0.062, 32, 24), noseMaterial);
  noseTip.scale.set(1, 0.82, 0.95);
  noseTip.position.copy(tip.point).add(new THREE.Vector3(0, 0, 0.0));
  nose.add(noseTip);
  for (const side of [1, -1]) {
    const wing = new THREE.Mesh(new THREE.SphereGeometry(0.042, 24, 18), noseMaterial);
    wing.scale.set(0.95, 0.9, 0.85);
    const w = surfaceAt(head, side * 0.075, -0.165);
    wing.position.copy(w.point).add(new THREE.Vector3(0, 0, -0.012));
    nose.add(wing);
    const nostril = new THREE.Mesh(new THREE.SphereGeometry(0.018, 12, 10), new THREE.MeshBasicMaterial({ color: "#2a120d" }));
    nostril.scale.set(1.2, 0.7, 0.6);
    nostril.position.copy(w.point).add(new THREE.Vector3(-side * 0.012, -0.045, 0.014));
    nose.add(nostril);
  }
  const stud = new THREE.Mesh(new THREE.SphereGeometry(0.011, 12, 10), new THREE.MeshStandardMaterial({ color: GOLD, metalness: 1, roughness: 0.25 }));
  const studAt = surfaceAt(head, -0.1, -0.16);
  stud.position.copy(studAt.point).add(new THREE.Vector3(0, 0, 0.03));
  nose.add(stud);
  headGroup.add(nose);

  // Bindi
  const bindi = new THREE.Mesh(new THREE.CircleGeometry(0.026, 24), new THREE.MeshStandardMaterial({ color: "#a31224", roughness: 0.35, side: THREE.DoubleSide }));
  const bindiAt = surfaceAt(head, 0, 0.36);
  bindi.position.copy(bindiAt.point).add(new THREE.Vector3(0, 0, 0.004));
  bindi.lookAt(bindi.position.clone().add(bindiAt.normal));
  headGroup.add(bindi);

  // Mouth: dark interior, teeth, and two lips that open, widen and smile.
  const mouth = new THREE.Group();
  const mouthAt = surfaceAt(head, 0, -0.4);
  mouth.position.copy(mouthAt.point).add(new THREE.Vector3(0, 0, 0.0));
  const interior = new THREE.Mesh(new THREE.SphereGeometry(0.1, 24, 16), new THREE.MeshBasicMaterial({ color: "#2b0f0e" }));
  interior.scale.set(1.2, 0.4, 0.5);
  interior.position.set(0, 0, -0.03);
  mouth.add(interior);
  const teeth = new THREE.Mesh(new THREE.SphereGeometry(0.094, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.5), new THREE.MeshStandardMaterial({ color: "#f4efe6", roughness: 0.35 }));
  teeth.scale.set(1.05, 0.5, 0.45);
  teeth.position.set(0, 0.012, -0.012);
  mouth.add(teeth);
  const lipMaterial = new THREE.MeshPhysicalMaterial({ color: LIP, roughness: 0.4, clearcoat: 0.5, clearcoatRoughness: 0.3 });
  const upperLip = new THREE.Mesh(new THREE.SphereGeometry(0.1, 32, 16), lipMaterial);
  upperLip.scale.set(1.35, 0.38, 0.55);
  upperLip.position.set(0, 0.024, 0.014);
  mouth.add(upperLip);
  const lowerLip = new THREE.Mesh(new THREE.SphereGeometry(0.1, 32, 16), lipMaterial);
  lowerLip.scale.set(1.2, 0.46, 0.6);
  lowerLip.position.set(0, -0.03, 0.016);
  mouth.add(lowerLip);
  headGroup.add(mouth);

  // Ears with gold jhumka earrings
  const earMaterial = new THREE.MeshStandardMaterial({ color: SKIN_SHADE.clone().lerp(SKIN, 0.4), roughness: 0.55 });
  const goldMaterial = new THREE.MeshStandardMaterial({ color: GOLD, metalness: 1, roughness: 0.22 });
  for (const side of [1, -1]) {
    const ear = new THREE.Mesh(new THREE.SphereGeometry(0.11, 24, 16), earMaterial);
    ear.scale.set(0.32, 0.95, 0.55);
    ear.position.set(side * 0.77, -0.02, -0.04);
    ear.rotation.z = side * 0.12;
    headGroup.add(ear);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.075, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.62), goldMaterial);
    dome.position.set(side * 0.8, -0.22, -0.03);
    dome.rotation.x = Math.PI;
    headGroup.add(dome);
    const stem = new THREE.Mesh(new THREE.SphereGeometry(0.018, 10, 8), goldMaterial);
    stem.position.set(side * 0.78, -0.145, -0.03);
    headGroup.add(stem);
    for (let k = 0; k < 3; k += 1) {
      const bead = new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 6), goldMaterial);
      bead.position.set(side * (0.8 + (k - 1) * 0.03), -0.285, -0.03);
      headGroup.add(bead);
    }
  }

  // ---- Hair -------------------------------------------------------------------------------------------------------
  const hairMaterial = new THREE.MeshPhysicalMaterial({ color: HAIR, roughness: 0.38, metalness: 0.05, sheen: 1, sheenColor: new THREE.Color("#3d2a22"), sheenRoughness: 0.35, side: THREE.DoubleSide });
  // A shell that follows the skull; the hairline, centre parting and ear gap are cut per pixel, so the edge is smooth.
  const cap = new THREE.SphereGeometry(1.0, 96, 96);
  const cp = cap.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < cp.count; i += 1) {
    const x = cp.getX(i);
    let y = cp.getY(i);
    let z = cp.getZ(i);
    const below = Math.max(0, -y - 0.05);
    const taper = 1 - 0.23 * Math.pow(Math.min(below / 0.95, 1), 1.6);
    y *= 1.04;
    z *= z < 0 ? 0.86 : 0.9;
    cp.setXYZ(i, x * 0.78 * taper * 1.045, y * 1.045 + 0.005, z * 1.05);
  }
  cap.computeVertexNormals();
  hairMaterial.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader.replace("#include <common>", "#include <common>\nvarying vec3 vHairPos;").replace("#include <begin_vertex>", "#include <begin_vertex>\nvHairPos = position;");
    shader.fragmentShader = shader.fragmentShader.replace("#include <common>", "#include <common>\nvarying vec3 vHairPos;").replace(
      "#include <clipping_planes_fragment>",
      `#include <clipping_planes_fragment>
      float ax = abs(vHairPos.x);
      if (vHairPos.z > 0.02) {
        float line = 0.47 - 0.09 * min(1.0, ax / 0.5) - max(0.0, ax - 0.55) * 1.4;
        if (vHairPos.y < line || ax < 0.011) discard;
      } else {
        if (vHairPos.y < -0.95) discard;
        if (vHairPos.z >= 0.0 && vHairPos.y < 0.12) discard;
      }`,
    );
  };
  headGroup.add(new THREE.Mesh(cap, hairMaterial));

  // Long hair falling behind the shoulders, and a plait over one shoulder.
  const back = new THREE.Mesh(new THREE.CylinderGeometry(0.86, 0.5, 2.5, 40, 1, true), hairMaterial);
  back.position.set(0, -1.1, -0.45);
  back.scale.set(1, 1, 0.55);
  headGroup.add(back);
  const plait = new THREE.Group();
  for (let k = 0; k < 15; k += 1) {
    const size = 0.105 * (1 - k * 0.036);
    const link = new THREE.Mesh(new THREE.SphereGeometry(size, 18, 12), hairMaterial);
    link.scale.set(1, 1.28, 0.85);
    link.position.set(Math.sin(k * 0.55) * 0.045, -k * 0.155, 0);
    link.rotation.z = (k % 2 ? 1 : -1) * 0.5;
    plait.add(link);
  }
  const tie = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.016, 8, 18), goldMaterial);
  tie.position.set(0, -15 * 0.155 + 0.05, 0);
  tie.rotation.x = Math.PI / 2;
  plait.add(tie);
  plait.position.set(-0.74, -0.8, 0.3);
  plait.rotation.z = 0.1;
  headGroup.add(plait);

  // ---- Neck, shoulders and a saree with a gold border ----------------------------------------------------------------------
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.3, 0.9, 32), new THREE.MeshPhysicalMaterial({ color: SKIN.clone().multiplyScalar(0.8), roughness: 0.55, sheen: 0.5, sheenColor: new THREE.Color("#e0a081") }));
  neck.position.set(0, -1.05, -0.05);
  headGroup.add(neck);
  const chest = new THREE.Mesh(new THREE.SphereGeometry(1, 40, 24, 0, Math.PI * 2, 0, Math.PI * 0.5), new THREE.MeshPhysicalMaterial({ color: SKIN.clone().multiplyScalar(0.95), roughness: 0.55, sheen: 0.5, sheenColor: new THREE.Color("#e0a081") }));
  chest.scale.set(0.95, 0.5, 0.52);
  chest.position.set(0, -1.62, 0);
  headGroup.add(chest);

  const body = new THREE.Group();
  root.add(body);
  const clothMaterial = new THREE.MeshPhysicalMaterial({ color: SAREE, roughness: 0.62, sheen: 1, sheenColor: new THREE.Color("#a98ad0"), sheenRoughness: 0.4, bumpMap: textures.cloth, bumpScale: 0.6 });
  const profile: THREE.Vector2[] = [
    new THREE.Vector2(0.44, -1.5),
    new THREE.Vector2(0.62, -1.56),
    new THREE.Vector2(1.0, -1.66),
    new THREE.Vector2(1.34, -1.82),
    new THREE.Vector2(1.56, -2.12),
    new THREE.Vector2(1.6, -2.5),
    new THREE.Vector2(1.62, -3.0),
  ];
  const yoke = new THREE.Mesh(new THREE.LatheGeometry(profile, 56), clothMaterial);
  yoke.scale.set(1, 1, 0.5);
  yoke.position.y = 0.2;
  yoke.material.side = THREE.DoubleSide;
  body.add(yoke);
  const border = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.032, 10, 56), new THREE.MeshStandardMaterial({ color: GOLD, metalness: 0.9, roughness: 0.3 }));
  border.rotation.x = Math.PI / 2;
  border.scale.set(1, 0.6, 1);
  border.position.set(0, -1.32, 0.0);
  body.add(border);
  // The pallu: a band of teal and gold over the left shoulder, across the chest.
  const palluMaterial = new THREE.MeshPhysicalMaterial({ color: SAREE_B, roughness: 0.6, sheen: 1, sheenColor: new THREE.Color("#9fe0d6"), side: THREE.DoubleSide });
  const pallu = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 3.1, 8, 24), palluMaterial);
  const pp = pallu.geometry.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pp.count; i += 1) {
    const v = pp.getY(i);
    pp.setZ(i, 0.22 + Math.sin(v * 3.1) * 0.035 + Math.cos(pp.getX(i) * 6) * 0.015);
  }
  pallu.geometry.computeVertexNormals();
  pallu.position.set(-0.05, -2.05, 0.5);
  pallu.rotation.z = -0.62;
  pallu.rotation.y = 0.12;
  body.add(pallu);
  for (const offset of [-0.19, 0.19]) {
    const trim = new THREE.Mesh(new THREE.PlaneGeometry(0.035, 3.1, 1, 12), new THREE.MeshStandardMaterial({ color: GOLD, metalness: 0.9, roughness: 0.3, side: THREE.DoubleSide }));
    trim.position.copy(pallu.position);
    trim.rotation.copy(pallu.rotation);
    trim.translateX(offset);
    trim.translateZ(0.262);
    body.add(trim);
  }
  // A fine gold necklace
  const necklace = new THREE.Mesh(new THREE.TorusGeometry(0.46, 0.012, 8, 56, Math.PI), new THREE.MeshStandardMaterial({ color: GOLD, metalness: 1, roughness: 0.2 }));
  necklace.rotation.set(Math.PI / 2 + 0.2, 0, Math.PI);
  necklace.scale.set(1, 0.9, 1);
  necklace.position.set(0, -1.28, 0.14);
  body.add(necklace);

  // ---- Motion -----------------------------------------------------------------------------------------------------
  const positions = head.geometry.attributes.position as THREE.BufferAttribute;
  const state = { jaw: 0, smile: 0.28, blink: 0, nextBlink: 1.8, gazeX: 0, gazeY: 0, gazeTargetX: 0, gazeTargetY: 0, nextGaze: 2, nod: 0, tilt: 0, brow: 0 };
  const clock = new THREE.Clock();
  let raf = 0;
  let disposed = false;

  function applyJaw(open: number) {
    // The lower face drops with the jaw; vertices near the lip line open most.
    for (let i = 0; i < positions.count; i += 1) {
      const bx = base[i * 3];
      const by = base[i * 3 + 1];
      const bz = base[i * 3 + 2];
      let y = by;
      if (bz > -0.1 && by < -0.34) {
        const weight = Math.min(1, (-0.34 - by) / 0.14);
        y = by - open * 0.07 * weight * (bz > 0 ? 1 : 0.3);
      }
      positions.setXYZ(i, bx, y, bz);
    }
    positions.needsUpdate = true;
  }

  function tick() {
    if (disposed) return;
    raf = requestAnimationFrame(tick);
    const dt = Math.min(clock.getDelta(), 0.05);
    const t = clock.elapsedTime;
    const speaking = drive.speaking();
    const listening = drive.listening();
    const level = Math.min(1, Math.max(0, drive.level()));

    state.jaw = smooth(state.jaw, speaking ? level : 0, 28, dt);
    applyJaw(state.jaw);
    lowerLip.position.y = -0.03 - state.jaw * 0.05;
    lowerLip.scale.y = 0.4 + state.jaw * 0.06;
    upperLip.position.y = 0.024 + state.jaw * 0.004;
    interior.scale.y = 0.4 + state.jaw * 1.1;
    teeth.scale.y = 0.5 + state.jaw * 0.5;
    const smileTarget = speaking ? 0.38 + level * 0.1 : listening ? 0.5 : 0.34;
    state.smile = smooth(state.smile, smileTarget, 3, dt);
    const widen = 1 + state.smile * 0.12 - state.jaw * 0.1;
    mouth.scale.set(widen, 1, 1);
    mouth.rotation.z = 0;
    upperLip.rotation.z = 0;

    // Blink
    state.nextBlink -= dt;
    if (state.nextBlink <= 0 && state.blink === 0) state.blink = 0.0001;
    if (state.blink > 0) {
      state.blink += dt / 0.15;
      if (state.blink >= 2) {
        state.blink = 0;
        state.nextBlink = 2.2 + Math.random() * 3.6;
      }
    }
    const closed = state.blink > 0 ? 1 - Math.abs(state.blink - 1) : 0;
    for (const eye of eyes) eye.lid.rotation.x = OPEN + closed * -OPEN + (listening ? -0.05 : 0);

    // Eyes wander a little, then settle back to the person in front of her.
    state.nextGaze -= dt;
    if (state.nextGaze <= 0) {
      state.gazeTargetX = (Math.random() - 0.5) * 0.22;
      state.gazeTargetY = (Math.random() - 0.5) * 0.12;
      state.nextGaze = 1.2 + Math.random() * 2.4;
      if (Math.random() < 0.55) state.gazeTargetX = state.gazeTargetY = 0;
    }
    state.gazeX = smooth(state.gazeX, state.gazeTargetX, 9, dt);
    state.gazeY = smooth(state.gazeY, state.gazeTargetY, 9, dt);
    for (const eye of eyes) eye.ball.rotation.set(-state.gazeY, state.gazeX, 0);

    // Brows lift a little when she listens or stresses a word.
    state.brow = smooth(state.brow, (listening ? 0.018 : 0) + (speaking ? level * 0.012 : 0), 6, dt);
    brows.forEach((brow) => (brow.position.y = state.brow));

    // Head: breathing, a slow sway, small nods on emphasis, a gentle tilt when listening.
    state.nod = smooth(state.nod, speaking ? level * 0.05 : 0, 10, dt);
    state.tilt = smooth(state.tilt, listening ? 0.07 : 0, 3, dt);
    headGroup.rotation.y = Math.sin(t * 0.45) * 0.07;
    headGroup.rotation.x = Math.sin(t * 0.6) * 0.012 + state.nod;
    headGroup.rotation.z = state.tilt + Math.sin(t * 0.3) * 0.01;
    headGroup.position.y = 0.2 + Math.sin(t * 1.3) * 0.006;
    body.position.y = Math.sin(t * 1.3) * 0.008;
    plait.rotation.z = 0.1 + Math.sin(t * 0.9) * 0.012;

    renderer.render(scene, camera);
  }

  function resize() {
    const width = canvas.clientWidth || 320;
    const height = canvas.clientHeight || 320;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }
  resize();
  tick();

  return {
    kind: "procedural",
    resize,
    dispose() {
      disposed = true;
      cancelAnimationFrame(raf);
      scene.traverse((object) => {
        const mesh = object as THREE.Mesh;
        mesh.geometry?.dispose?.();
        const material = mesh.material as THREE.Material | THREE.Material[] | undefined;
        (Array.isArray(material) ? material : material ? [material] : []).forEach((item) => item.dispose());
      });
      renderer.dispose();
    },
  };
}
