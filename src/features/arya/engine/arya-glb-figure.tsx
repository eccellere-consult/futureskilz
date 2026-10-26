'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { useAryaPose, type AryaState, type PoseOverride } from './arya-pose';

// A photoreal Arya from a rigged GLB. It is posed from the same engine as the
// procedural avatar, through the standard ARKit face blendshapes (jawOpen, eyeBlink…,
// mouthSmile…, brow…) and, where present, Oculus visemes (viseme_aa, viseme_O…), which
// is what Avaturn, Ready-Player-Me-style and Character Creator exports provide.

interface Props {
  gltf: GLTF;
  state: AryaState;
  greetNonce?: number;
  override?: PoseOverride;
}

type MorphSlot = [THREE.Mesh, number];

// The procedural avatar has its eyes ~0.67 units apart, at height 0.09 with the head
// centred on the origin. The photoreal model is scaled and moved to match, so the
// camera framing is shared between the two.
const EYE_SEPARATION = 0.67;
const EYE_HEIGHT = 0.09;

const find = (root: THREE.Object3D, test: (name: string) => boolean) => {
  let hit: THREE.Object3D | null = null;
  root.traverse((o) => {
    if (!hit && test(o.name)) hit = o;
  });
  return hit as THREE.Object3D | null;
};

export function AryaGlbFigure({ gltf, state, greetNonce = 0, override }: Props) {
  const pose = useAryaPose(state, greetNonce, override);
  const group = useRef<THREE.Group>(null);

  const rig = useMemo(() => {
    const scene = gltf.scene;
    scene.updateMatrixWorld(true);

    const morphs = new Map<string, MorphSlot[]>();
    scene.traverse((o) => {
      const mesh = o as THREE.Mesh;
      mesh.frustumCulled = false; // morphing and skinning move vertices outside the stored bounds
      if (mesh.isMesh && mesh.morphTargetDictionary && mesh.morphTargetInfluences) {
        for (const [name, index] of Object.entries(mesh.morphTargetDictionary)) {
          const slots = morphs.get(name) ?? [];
          slots.push([mesh, index]);
          morphs.set(name, slots);
        }
      }
    });

    const head = find(scene, (n) => /head$/i.test(n) && !/top|end/i.test(n));
    const neck = find(scene, (n) => /neck$/i.test(n));
    const leftEye = find(scene, (n) => /^(mixamorig:?)?(left_?eye|l_?eye)$/i.test(n) || /left.?eye$/i.test(n));
    const rightEye = find(scene, (n) => /^(mixamorig:?)?(right_?eye|r_?eye)$/i.test(n) || /right.?eye$/i.test(n));

    // Normalise the model's size and position to the procedural avatar's.
    const wp = (o: THREE.Object3D) => o.getWorldPosition(new THREE.Vector3());
    let scale = 1;
    const anchor = new THREE.Vector3();
    if (leftEye && rightEye) {
      const a = wp(leftEye);
      const b = wp(rightEye);
      scale = EYE_SEPARATION / Math.max(0.001, a.distanceTo(b));
      anchor.copy(a).add(b).multiplyScalar(0.5);
    } else {
      const box = new THREE.Box3().setFromObject(scene);
      const size = box.getSize(new THREE.Vector3());
      const headHeight = size.y > 1.2 ? size.y * 0.13 : size.y * 0.55; // full-body vs bust models
      scale = 2.0 / headHeight;
      anchor.set((box.min.x + box.max.x) / 2, box.max.y - headHeight * 0.42, (box.min.z + box.max.z) / 2);
    }

    const restQ = new Map<THREE.Object3D, THREE.Quaternion>();
    for (const bone of [head, neck, leftEye, rightEye]) if (bone) restQ.set(bone, bone.quaternion.clone());

    return { scene, morphs, head, neck, leftEye, rightEye, scale, anchor, restQ, hasVisemes: morphs.has('viseme_aa') };
  }, [gltf]);

  useEffect(() => {
    const g = group.current;
    if (!g) return;
    g.scale.setScalar(rig.scale);
    g.position.set(-rig.anchor.x * rig.scale, EYE_HEIGHT - rig.anchor.y * rig.scale, -rig.anchor.z * rig.scale);
    g.updateMatrixWorld(true);
  }, [rig]);

  const tmp = useMemo(() => ({ q: new THREE.Quaternion(), e: new THREE.Euler() }), []);

  useFrame(() => {
    const p = pose.current;
    const set = (name: string, value: number) => {
      const slots = rig.morphs.get(name);
      if (!slots) return;
      const v = Math.max(0, Math.min(1, value));
      for (const [mesh, i] of slots) mesh.morphTargetInfluences![i] = v;
    };

    const { open, wide, round } = p.mouth;
    const smile = Math.max(0, p.smile - open * 0.25);

    // Mouth: visemes shape the sound, the jaw does the opening.
    set('jawOpen', open * (rig.hasVisemes ? 0.45 : 0.8));
    if (rig.hasVisemes) {
      set('viseme_aa', open * (1 - wide) * (1 - round) * 0.75);
      set('viseme_O', round * open * 0.9);
      set('viseme_E', wide * open * 0.7);
      set('viseme_I', wide * open * 0.3);
    }
    set('mouthFunnel', round * open * 0.8);
    set('mouthPucker', round * (0.25 + open * 0.4));
    set('mouthStretchLeft', wide * 0.45);
    set('mouthStretchRight', wide * 0.45);

    // Expression
    set('mouthSmileLeft', smile * 0.75);
    set('mouthSmileRight', smile * 0.75);
    set('cheekSquintLeft', smile * 0.3);
    set('cheekSquintRight', smile * 0.3);
    set('eyeSquintLeft', smile * 0.18);
    set('eyeSquintRight', smile * 0.18);
    set('browInnerUp', p.brow * 0.8);
    set('browOuterUpLeft', p.brow * 0.5);
    set('browOuterUpRight', p.brow * 0.5);
    set('eyeBlinkLeft', p.blink);
    set('eyeBlinkRight', p.blink);

    // Gaze: eye bones if the rig has them, otherwise the eyeLook blendshapes.
    if (rig.leftEye && rig.rightEye) {
      for (const eye of [rig.leftEye, rig.rightEye]) {
        tmp.e.set(p.gazeY + p.blink * 0.15, p.gazeX, 0);
        tmp.q.setFromEuler(tmp.e);
        eye.quaternion.copy(rig.restQ.get(eye)!).multiply(tmp.q);
      }
    } else {
      set('eyeLookDownLeft', p.gazeY * 4);
      set('eyeLookDownRight', p.gazeY * 4);
      set('eyeLookUpLeft', -p.gazeY * 4);
      set('eyeLookUpRight', -p.gazeY * 4);
      set('eyeLookOutLeft', p.gazeX * 5);
      set('eyeLookInRight', p.gazeX * 5);
      set('eyeLookInLeft', -p.gazeX * 5);
      set('eyeLookOutRight', -p.gazeX * 5);
    }

    // Head: spread the motion over neck and head like a real spine would.
    const rotate = (bone: THREE.Object3D | null, share: number) => {
      if (!bone) return;
      tmp.e.set(p.pitch * share, p.yaw * share, p.roll * share);
      tmp.q.setFromEuler(tmp.e);
      bone.quaternion.copy(rig.restQ.get(bone)!).multiply(tmp.q);
    };
    rotate(rig.neck, 0.35);
    rotate(rig.head, rig.neck ? 0.65 : 1);
    if (!rig.head && group.current) group.current.rotation.set(p.pitch * 0.3, p.yaw * 0.3, p.roll * 0.3);

    if (group.current) group.current.scale.set(rig.scale, rig.scale * (1 + p.breath * 0.003), rig.scale);
  });

  return (
    <group ref={group}>
      <primitive object={rig.scene} />
    </group>
  );
}
