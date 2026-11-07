'use client';

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useAryaPose, type AryaState, type PoseOverride } from './arya-pose';
import { buildHeadGeometry, surfaceAt, SKIN, HEAD } from './face-geometry';
import { EYE, buildIris, buildLid, buildSclera } from './eye-geometry';
import { hairTexture, kurtaTexture, makeHairMaterial, makePlainSkinMaterial, makeSkinMaterial } from './arya-materials';

export type { AryaState, PoseOverride };

interface AryaFigureProps {
  state: AryaState;
  /** Increment to play the formal greeting gesture (a respectful bow and warm smile). */
  greetNonce?: number;
  override?: PoseOverride;
}

const { damp } = THREE.MathUtils;
const NECK_PIVOT_Y = -1.0;
const EYE_X = 0.335;
const EYE_Y = 0.09;
const TORSO_CENTER = new THREE.Vector3(0, -2.9, -0.12);

/** Torso radius at height `y` (relative to TORSO_CENTER): a neck-base that slopes out to the shoulders. */
function torsoRadius(y: number): number {
  const shoulders = 0.52 + 1.08 * (1 - THREE.MathUtils.smoothstep(y, 0.25, 1.55));
  return shoulders - 0.14 * THREE.MathUtils.smoothstep(-y, 0.9, 1.6);
}
function torsoGeometry(scale: number): THREE.BufferGeometry {
  const pts: THREE.Vector2[] = [];
  for (let i = 0; i <= 64; i++) {
    const y = 1.62 - (i / 64) * 3.3;
    pts.push(new THREE.Vector2(Math.max(0.001, torsoRadius(y) * scale), y));
  }
  const g = new THREE.LatheGeometry(pts, 96);
  g.scale(1, 1, 0.56); // chest is shallower than it is wide
  return g;
}

const GOLD = { color: '#e3b341', metalness: 1, roughness: 0.22 } as const;
const SILVER = { color: '#d8dce2', metalness: 1, roughness: 0.2 } as const;

function paintVertical(geo: THREE.BufferGeometry, fn: (x: number, y: number, z: number) => THREE.Color) {
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const c = fn(pos.getX(i), pos.getY(i), pos.getZ(i));
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
}

/** A tapered, flowing lock of hair along a curve. Strands run along the lock's length. */
function lockGeometry(points: THREE.Vector3[], radius: number, taperFrom = 0.55) {
  const curve = new THREE.CatmullRomCurve3(points);
  const tubular = 48;
  const radial = 14;
  const geo = new THREE.TubeGeometry(curve, tubular, radius, radial, false);
  const pos = geo.attributes.position;
  const center = new THREE.Vector3();
  const v = new THREE.Vector3();
  for (let i = 0; i <= tubular; i++) {
    const t = i / tubular;
    curve.getPointAt(t, center);
    const swell = 0.8 + 0.35 * Math.sin(Math.min(1, t * 1.6) * Math.PI * 0.6);
    const taper = t < taperFrom ? 1 : 1 - Math.pow((t - taperFrom) / (1 - taperFrom), 1.6) * 0.92;
    for (let j = 0; j <= radial; j++) {
      const idx = i * (radial + 1) + j;
      v.fromBufferAttribute(pos, idx).sub(center);
      v.x *= 1.15 * swell * taper; // wider than deep: a flat, ribbon-like lock
      v.y *= 1.0 * swell * taper;
      v.z *= 0.6 * swell * taper;
      pos.setXYZ(idx, center.x + v.x, center.y + v.y, center.z + v.z);
    }
  }
  geo.computeVertexNormals();
  return geo;
}

export function AryaFigure({ state, greetNonce = 0, override }: AryaFigureProps) {
  // ── Geometry & materials (built once) ──────────────────────────────────────
  const assets = useMemo(() => {
    const head = buildHeadGeometry();
    const { material: skin, uniforms } = makeSkinMaterial();
    const plainSkin = makePlainSkinMaterial();
    const lidSkin = makePlainSkinMaterial({ side: THREE.DoubleSide, sheen: 0.3 });

    const surf = surfaceAt(EYE_X, EYE_Y);
    const eyeZ = surf.z - 0.072;

    const lids = {
      upperL: buildLid('upper', 1),
      lowerL: buildLid('lower', 1),
      upperR: buildLid('upper', -1),
      lowerR: buildLid('lower', -1),
    };
    const sclera = buildSclera();
    const iris = buildIris();

    const hairMap = hairTexture();
    const lockMap = hairMap.clone();
    lockMap.center.set(0.5, 0.5);
    lockMap.rotation = Math.PI / 2;
    lockMap.repeat.set(1, 7);
    lockMap.needsUpdate = true;

    const cap = new THREE.SphereGeometry(1, 128, 96);
    cap.rotateY(-Math.PI / 2);
    cap.scale(HEAD.rx * 1.045, HEAD.ry * 1.04, HEAD.rz * 1.06);

    const neck = new THREE.CylinderGeometry(0.4, 0.5, 1.3, 48, 14, true);
    paintVertical(neck, (_x, y) => {
      const t = THREE.MathUtils.smoothstep(y, -0.2, 0.65); // 0 at the base … 1 under the jaw
      return SKIN.base.clone().multiplyScalar(1 - 0.5 * t * t).lerp(SKIN.blush, 0.06);
    });

    const torso = torsoGeometry(1);
    paintVertical(torso, () => SKIN.base.clone().multiplyScalar(0.94));
    const kurta = torsoGeometry(1.025);

    // Back hair: a curtain behind the head and shoulders, waved so it reads as long, thick hair.
    const curtain = new THREE.CylinderGeometry(0.86, 1.32, 3.7, 96, 40, true, Math.PI * 0.5, Math.PI);
    {
      const pos = curtain.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        const y = pos.getY(i);
        const z = pos.getZ(i);
        const wave = 1 + 0.045 * Math.sin(x * 9 + y * 1.3) + 0.03 * Math.sin(x * 21 - y * 0.7);
        pos.setXYZ(i, x * (1 + 0.04 * Math.sin(y * 1.1)), y, z * wave - 0.04);
      }
      curtain.computeVertexNormals();
    }

    const lockSets = ([1, -1] as const).flatMap((s) =>
      [
        { r: 0.15, dx: 0, len: 1 },
        { r: 0.12, dx: 0.08, len: 0.9 },
      ].map(({ r, dx, len }, k) => {
        const pts = [
          new THREE.Vector3(s * (0.8 + dx * 0.3), 0.05 - k * 0.05, -0.36),
          new THREE.Vector3(s * (0.76 + dx), -0.72, -0.3),
          new THREE.Vector3(s * (0.72 + dx), -1.45, -0.08),
          new THREE.Vector3(s * (0.88 + dx * 1.2), -2.1 * len, 0.26),
          new THREE.Vector3(s * (0.7 + dx), -2.75 * len, 0.5),
          new THREE.Vector3(s * (0.9 + dx * 1.3), -3.45 * len, 0.56),
          new THREE.Vector3(s * (0.78 + dx), -4.1 * len, 0.6),
        ];
        return { s, geo: lockGeometry(pts, r) };
      }),
    );

    return {
      head, skin, uniforms, plainSkin, lidSkin, eyeZ, lids, sclera, iris,
      hairMap, lockMap, cap, neck, torso, kurta, curtain, lockSets,
      kurtaMap: kurtaTexture(),
      capMat: makeHairMaterial(hairMap, { cap: true }),
      flowMat: makeHairMaterial(hairMap, { fadeBelowY: -3.55 }),
      lockMat: makeHairMaterial(lockMap),
    };
  }, []);

  // Brows: a finely arched ribbon of hair — opaque in the core, feathered at the edges.
  const brows = useMemo(() => {
    const profile = [
      { off: -1, alpha: 0 },
      { off: -0.5, alpha: 0.85 },
      { off: 0, alpha: 1 },
      { off: 0.5, alpha: 0.85 },
      { off: 1, alpha: 0 },
    ];
    return ([1, -1] as const).map((s) => {
      const n = 40;
      const positions: number[] = [];
      const colors: number[] = [];
      const indices: number[] = [];
      for (let i = 0; i <= n; i++) {
        const t = i / n;
        const x = 0.13 + 0.45 * t;
        const y = 0.292 + 0.07 * Math.sin(Math.pow(t, 0.8) * Math.PI * 0.8) - 0.036 * t * t;
        const w = 0.03 * (1 - 0.3 * t) * (1 - Math.pow(t, 3.5)) + 0.004;
        for (const { off, alpha } of profile) {
          const yy = y + off * w;
          positions.push(s * x, yy, surfaceAt(x, yy).z + 0.006);
          colors.push(0.045, 0.026, 0.02, alpha * (1 - 0.25 * t));
        }
      }
      const row = profile.length;
      for (let i = 0; i < n; i++) {
        for (let k = 0; k < row - 1; k++) {
          const p = i * row + k;
          if (s > 0) indices.push(p, p + row, p + 1, p + 1, p + row, p + row + 1);
          else indices.push(p, p + 1, p + row, p + 1, p + row + 1, p + row);
        }
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 4));
      geo.setIndex(indices);
      geo.computeVertexNormals();
      return geo;
    });
  }, []);

  const bindiPos = useMemo(() => surfaceAt(0, 0.4), []);
  const studPos = useMemo(() => surfaceAt(0.142, -0.252), []);

  // ── Animation state ────────────────────────────────────────────────────────
  const root = useRef<THREE.Group>(null);
  const headPivot = useRef<THREE.Group>(null);
  const bodyGroup = useRef<THREE.Group>(null);
  const hairBack = useRef<THREE.Group>(null);
  const eyeL = useRef<THREE.Group>(null);
  const eyeR = useRef<THREE.Group>(null);
  const browL = useRef<THREE.Mesh>(null);
  const browR = useRef<THREE.Mesh>(null);
  const earringL = useRef<THREE.Group>(null);
  const earringR = useRef<THREE.Group>(null);
  const lidRefs = useRef<Array<THREE.Mesh | null>>([]);

  const pose = useAryaPose(state, greetNonce, override);
  const swingRef = useRef({ prevYaw: 0, prevRoll: 0 });

  useFrame(() => {
    const a = pose.current;
    const { t, dt, blink } = a;
    const u = assets.uniforms;
    u.uOpen.value = a.mouth.open * 0.95;
    u.uWide.value = a.mouth.wide;
    u.uRound.value = a.mouth.round;
    u.uSmile.value = Math.max(0, a.smile - a.mouth.open * 0.35);

    headPivot.current?.rotation.set(a.pitch, a.yaw, a.roll);
    if (bodyGroup.current) {
      bodyGroup.current.position.y = a.breath * 0.01;
      bodyGroup.current.scale.set(1 + a.breath * 0.004, 1 + a.breath * 0.006, 1);
      bodyGroup.current.rotation.y = a.yaw * 0.25;
    }
    if (hairBack.current) {
      hairBack.current.rotation.z = damp(hairBack.current.rotation.z, -a.roll * 0.4 + Math.sin(t * 0.7) * 0.006, 4, dt);
      hairBack.current.rotation.y = a.yaw * 0.15;
    }

    for (const eye of [eyeL.current, eyeR.current]) {
      if (eye) eye.rotation.set(a.gazeY + blink * 0.15, a.gazeX, 0);
    }
    for (const lid of lidRefs.current) {
      if (lid?.morphTargetInfluences) lid.morphTargetInfluences[0] = blink;
    }

    const browLift = a.brow * 0.028;
    if (browL.current) { browL.current.position.y = browLift; browL.current.rotation.z = a.brow * 0.05; }
    if (browR.current) { browR.current.position.y = browLift; browR.current.rotation.z = -a.brow * 0.05; }

    // Jhumkas swing against the head's motion.
    const sw = swingRef.current;
    const dYaw = (a.yaw - sw.prevYaw) / Math.max(dt, 0.001);
    const dRoll = (a.roll - sw.prevRoll) / Math.max(dt, 0.001);
    sw.prevYaw = a.yaw;
    sw.prevRoll = a.roll;
    const swing = Math.max(-0.5, Math.min(0.5, -dYaw * 0.12 + dRoll * 0.1));
    for (const e of [earringL.current, earringR.current]) {
      if (e) e.rotation.z = damp(e.rotation.z, swing + Math.sin(t * 1.3) * 0.015, 8, dt);
    }
  });

  const { eyeZ } = assets;
  const eyes = [
    { s: 1 as const, ref: eyeL, upper: assets.lids.upperL, lower: assets.lids.lowerL },
    { s: -1 as const, ref: eyeR, upper: assets.lids.upperR, lower: assets.lids.lowerR },
  ];

  return (
    <group ref={root}>
      {/* ── Body ─────────────────────────────────────────────────────────── */}
      <group ref={bodyGroup}>
        <mesh geometry={assets.neck} material={assets.plainSkin} position={[0, -1.5, -0.1]} />
        <mesh geometry={assets.torso} material={assets.plainSkin} position={TORSO_CENTER} />
        <mesh position={TORSO_CENTER} geometry={assets.kurta}>
          <meshPhysicalMaterial
            map={assets.kurtaMap}
            roughness={0.78}
            sheen={0.6}
            sheenColor="#fff7ea"
            sheenRoughness={0.7}
            side={THREE.DoubleSide}
            onBeforeCompile={(shader) => {
              shader.vertexShader = shader.vertexShader
                .replace('#include <common>', '#include <common>\nvarying vec3 vObj;')
                .replace('#include <begin_vertex>', '#include <begin_vertex>\nvObj = position;');
              shader.fragmentShader = shader.fragmentShader
                .replace('#include <common>', '#include <common>\nvarying vec3 vObj;')
                .replace(
                  '#include <map_fragment>',
                  `// Front-on projection of the embroidery, so the placket sits down the middle.
                  vec4 sampledDiffuseColor = texture2D(map, vec2(vObj.x * 0.31 + 0.5, (vObj.y + 1.0) / 2.6));
                  diffuseColor *= sampledDiffuseColor;`,
                )
                .replace(
                  '#include <clipping_planes_fragment>',
                  `#include <clipping_planes_fragment>
                  // V-neck: the opening widens toward the shoulders and shows the skin underneath.
                  if (vObj.z > -0.05 && vObj.y > 0.62 + 1.55 * abs(vObj.x)) discard;`,
                );
            }}
          />
        </mesh>
        {/* Fine silver chain with a small pendant */}
        <mesh position={[0, -1.7, -0.02]} rotation={[-Math.PI / 2 + 0.5, 0, 0]}>
          <torusGeometry args={[0.5, 0.0075, 8, 96]} />
          <meshStandardMaterial {...SILVER} />
        </mesh>
        <mesh position={[0, -2.03, 0.45]} scale={[1, 1.25, 0.7]}>
          <sphereGeometry args={[0.032, 24, 24]} />
          <meshStandardMaterial {...SILVER} />
        </mesh>

        {/* Long hair behind her, and two locks over the shoulders */}
        <group ref={hairBack} position={[0, -0.5, 0]}>
          <mesh geometry={assets.curtain} material={assets.flowMat} position={[0, -1.1, 0]} />
        </group>
        {assets.lockSets.map(({ s, geo }, i) => (
          <mesh key={`${s}-${i}`} geometry={geo} material={assets.lockMat} position={[0, 0, 0]} />
        ))}
      </group>

      {/* ── Head ─────────────────────────────────────────────────────────── */}
      <group position={[0, NECK_PIVOT_Y, -0.05]}>
        <group ref={headPivot}>
          <group position={[0, -NECK_PIVOT_Y, 0.05]} scale={[1.06, 1, 1]}>
            <mesh geometry={assets.head} material={assets.skin} />

            {/* Ears and jhumka earrings */}
            {([1, -1] as const).map((s) => (
              <group key={s} position={[s * 0.725, -0.03, -0.04]} rotation={[0, s * 0.28, s * -0.06]}>
                <mesh scale={[0.05, 0.155, 0.1]}>
                  <sphereGeometry args={[1, 24, 24]} />
                  <meshPhysicalMaterial color={SKIN.base} roughness={0.55} emissive="#4b1b0f" emissiveIntensity={0.3} sheen={0.6} sheenColor="#ff9f86" />
                </mesh>
                <group ref={s > 0 ? earringL : earringR} position={[s * 0.02, -0.14, 0.03]} scale={1.3}>
                  <mesh>
                    <sphereGeometry args={[0.022, 16, 16]} />
                    <meshStandardMaterial {...GOLD} />
                  </mesh>
                  <group position={[0, -0.11, 0]}>
                    <mesh>
                      <sphereGeometry args={[0.062, 28, 14, 0, Math.PI * 2, 0, Math.PI * 0.55]} />
                      <meshStandardMaterial {...GOLD} side={THREE.DoubleSide} />
                    </mesh>
                    {Array.from({ length: 7 }, (_, k) => {
                      const ang = (k / 7) * Math.PI * 2;
                      return (
                        <mesh key={k} position={[Math.cos(ang) * 0.052, -0.05, Math.sin(ang) * 0.052]}>
                          <sphereGeometry args={[0.011, 10, 10]} />
                          <meshStandardMaterial color="#f6efe2" roughness={0.25} metalness={0.1} />
                        </mesh>
                      );
                    })}
                  </group>
                </group>
              </group>
            ))}

            {/* Eyes */}
            {eyes.map(({ s, ref, upper, lower }, idx) => (
              <group key={s} position={[s * EYE_X, EYE_Y, eyeZ]}>
                <group ref={ref}>
                  <mesh geometry={assets.sclera}>
                    <meshStandardMaterial vertexColors roughness={0.25} />
                  </mesh>
                  <mesh geometry={assets.iris}>
                    <meshStandardMaterial vertexColors roughness={0.3} />
                  </mesh>
                </group>
                {/* Wet-look gloss over the cornea + a catch-light */}
                <mesh>
                  <sphereGeometry args={[EYE.r * 1.02, 32, 24]} />
                  <meshStandardMaterial color="#9aa0a6" metalness={1} roughness={0.03} transparent blending={THREE.AdditiveBlending} depthWrite={false} envMapIntensity={0.9} />
                </mesh>
                <mesh position={[-0.034, 0.045, EYE.r * 0.93]}>
                  <circleGeometry args={[0.014, 20]} />
                  <meshBasicMaterial color="#ffffff" toneMapped={false} />
                </mesh>
                <mesh position={[0.025, -0.03, EYE.r * 0.97]}>
                  <circleGeometry args={[0.006, 16]} />
                  <meshBasicMaterial color="#ffffff" transparent opacity={0.7} toneMapped={false} />
                </mesh>
                <mesh ref={(m) => { lidRefs.current[idx * 2] = m; m?.updateMorphTargets(); }} geometry={upper} material={assets.lidSkin} />
                <mesh ref={(m) => { lidRefs.current[idx * 2 + 1] = m; m?.updateMorphTargets(); }} geometry={lower} material={assets.lidSkin} />
                {/* Inner-corner caruncle */}
                <mesh position={[-s * EYE.r * 0.9, -0.006, EYE.r * 0.37]} scale={[0.6, 0.9, 0.5]}>
                  <sphereGeometry args={[0.022, 14, 14]} />
                  <meshStandardMaterial color="#d98a86" roughness={0.4} />
                </mesh>
              </group>
            ))}

            {/* Brows */}
            <mesh ref={browL} geometry={brows[0]} renderOrder={2}>
              <meshStandardMaterial vertexColors transparent roughness={0.85} depthWrite={false} />
            </mesh>
            <mesh ref={browR} geometry={brows[1]} renderOrder={2}>
              <meshStandardMaterial vertexColors transparent roughness={0.85} depthWrite={false} />
            </mesh>

            {/* Bindi */}
            <mesh position={[bindiPos.x, bindiPos.y, bindiPos.z + 0.006]} rotation={[-0.2, 0, 0]}>
              <circleGeometry args={[0.02, 32]} />
              <meshStandardMaterial color="#1c0a0c" roughness={0.5} />
            </mesh>

            {/* Nose stud (phool) */}
            <mesh position={[studPos.x + 0.004, studPos.y, studPos.z + 0.006]}>
              <sphereGeometry args={[0.0165, 20, 20]} />
              <meshStandardMaterial {...GOLD} />
            </mesh>

            {/* Hair cap */}
            <mesh geometry={assets.cap} material={assets.capMat} />
          </group>
        </group>
      </group>
    </group>
  );
}
