import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

import type { AryaScene, Drive } from "./arya-scene";

export const MODEL_URL = "/avatars/arya.glb";

/** True when a model has been placed in `public/avatars/arya.glb`. */
export async function modelAvailable(): Promise<boolean> {
  try {
    const response = await fetch(MODEL_URL, { method: "HEAD", cache: "no-store" });
    return response.ok && (response.headers.get("content-type") ?? "").includes("model");
  } catch {
    return false;
  }
}

const JAW = ["jawOpen", "viseme_aa", "mouthOpen"];
const SMILE = ["mouthSmile", "mouthSmileLeft", "mouthSmileRight"];
const BLINK = ["eyeBlinkLeft", "eyeBlinkRight", "eyesClosed"];

/**
 * Shows a licensed or commissioned character (glTF with ARKit or Ready Player Me style blendshapes) and drives its mouth
 * and eyes from the same voice level as the built-in figure. Names it does not find are simply left alone.
 */
export async function createModelArya(canvas: HTMLCanvasElement, drive: Drive): Promise<AryaScene> {
  const gltf = await new GLTFLoader().loadAsync(MODEL_URL);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight("#fff1e6", "#3a2a4a", 1.1));
  const key = new THREE.DirectionalLight("#fff0dd", 2);
  key.position.set(-2, 2, 3);
  scene.add(key);
  scene.add(gltf.scene);

  const box = new THREE.Box3().setFromObject(gltf.scene);
  const size = box.getSize(new THREE.Vector3());
  const camera = new THREE.PerspectiveCamera(24, 1, 0.01, 100);
  const head = box.max.y - size.y * 0.12;
  camera.position.set(0, head, Math.max(size.y, size.x) * 1.5);
  camera.lookAt(0, head - size.y * 0.05, 0);

  const meshes: THREE.Mesh[] = [];
  gltf.scene.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (mesh.isMesh && mesh.morphTargetDictionary && mesh.morphTargetInfluences) meshes.push(mesh);
  });
  const set = (names: string[], value: number) => {
    for (const mesh of meshes) for (const name of names) {
      const at = mesh.morphTargetDictionary?.[name];
      if (at !== undefined && mesh.morphTargetInfluences) mesh.morphTargetInfluences[at] = value;
    }
  };

  const clock = new THREE.Clock();
  let raf = 0;
  let disposed = false;
  let nextBlink = 2;
  function tick() {
    if (disposed) return;
    raf = requestAnimationFrame(tick);
    const dt = Math.min(clock.getDelta(), 0.05);
    const t = clock.elapsedTime;
    set(JAW, drive.speaking() ? Math.min(1, drive.level()) * 0.7 : 0);
    set(SMILE, drive.listening() ? 0.5 : 0.3);
    nextBlink -= dt;
    set(BLINK, nextBlink < 0 && nextBlink > -0.14 ? 1 : 0);
    if (nextBlink < -0.14) nextBlink = 2.2 + Math.random() * 3.4;
    gltf.scene.rotation.y = Math.sin(t * 0.45) * 0.06;
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
    kind: "model",
    resize,
    dispose() {
      disposed = true;
      cancelAnimationFrame(raf);
      renderer.dispose();
    },
  };
}
