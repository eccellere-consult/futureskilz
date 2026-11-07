'use client';

import { Component, useEffect, useRef, useState, type ReactNode } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { AryaFigure } from './arya-figure';
import { AryaGlbFigure } from './arya-glb-figure';
import { AryaPhotoFigure, PHOTO_FACE, PHOTO_SIZE } from './arya-photo-figure';
import { useAryaPhoto } from './arya-photo';
import { useAryaModel } from './arya-model';
import type { AryaState, PoseOverride } from './arya-pose';

export type { AryaState, PoseOverride };

interface Arya3DProps {
  state: AryaState;
  /** 'compact' frames the face for the floating launcher; 'full' shows head and shoulders. */
  variant: 'compact' | 'full';
  greetNonce?: number;
  /** Pause rendering entirely (e.g. while the tab is hidden). */
  paused?: boolean;
  /** Shown if WebGL is unavailable or the 3D scene fails. */
  fallback: ReactNode;
  override?: PoseOverride;
}

const FRAMING = {
  compact: { position: new THREE.Vector3(0, 0.0, 4.7), look: new THREE.Vector3(0, 0.0, 0) },
  full: { position: new THREE.Vector3(0, -0.72, 8.6), look: new THREE.Vector3(0, -0.78, 0) },
} as const;

type Kind = 'procedural' | 'glb' | 'photo';

/** The photo fills the view edge to edge: compact is a close crop of the face, full shows head and shoulders. */
function photoFraming(variant: 'compact' | 'full', aspect: number) {
  const tanHalf = Math.tan(THREE.MathUtils.degToRad(14)); // the camera's fov is 28°
  const cx = (PHOTO_FACE.x - 0.5) * PHOTO_SIZE;
  if (variant === 'compact') {
    const height = 2.2;
    const y = (0.5 - 0.405) * PHOTO_SIZE;
    return { position: new THREE.Vector3(cx, y, height / 2 / tanHalf), look: new THREE.Vector3(cx, y, 0) };
  }
  const width = PHOTO_SIZE * 0.86;
  const height = Math.min(PHOTO_SIZE * 0.98, width / aspect);
  const y = (0.5 - 0.44) * PHOTO_SIZE;
  return { position: new THREE.Vector3(cx, y, height / 2 / tanHalf), look: new THREE.Vector3(cx, y, 0) };
}

function webglAvailable(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return Boolean(canvas.getContext('webgl2') || canvas.getContext('webgl'));
  } catch {
    return false;
  }
}

class SceneBoundary extends Component<{ onError: () => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: unknown) {
    console.error('[arya] 3D scene failed, falling back to the 2D avatar:', error);
    this.props.onError();
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

/** Soft studio reflections (for gold, eyes and hair) and smooth camera framing. */
function Rig({ variant, kind }: { variant: 'compact' | 'full'; kind: Kind }) {
  const { gl, scene, camera, size } = useThree();

  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = env;
    scene.environmentIntensity = 0.35;
    return () => {
      scene.environment = null;
      env.dispose();
      pmrem.dispose();
    };
  }, [gl, scene]);

  const lookAt = useRef(FRAMING[variant].look.clone());
  useFrame((_, dt) => {
    const target = kind === 'photo' ? photoFraming(variant, size.width / size.height) : FRAMING[variant];
    const k = 1 - Math.exp(-6 * Math.min(dt, 0.05));
    camera.position.lerp(target.position, k);
    lookAt.current.lerp(target.look, k);
    camera.lookAt(lookAt.current);
  });
  return null;
}

export function Arya3D({ state, variant, greetNonce, paused, fallback, override }: Arya3DProps) {
  const [supported, setSupported] = useState<boolean | null>(null);
  const [failed, setFailed] = useState(false);
  // A photoreal model, if one has been provided; the built-in Arya shows until it is ready (or forever, if there is none).
  const model = useAryaModel();
  const photo = useAryaPhoto();
  const kind: Kind = model.status === 'ready' ? 'glb' : photo.status === 'ready' ? 'photo' : 'procedural';

  useEffect(() => {
    setSupported(webglAvailable());
  }, []);

  if (supported === null) return null;
  if (!supported || failed) return <>{fallback}</>;

  return (
    <SceneBoundary onError={() => setFailed(true)}>
      <Canvas
        dpr={variant === 'compact' ? [1, 1.5] : [1, 1.75]}
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
        camera={{ fov: 28, near: 0.1, far: 60, position: FRAMING[variant].position.toArray() }}
        frameloop={paused ? 'never' : 'always'}
        onCreated={({ gl }) => {
          gl.setClearColor(0x000000, 0);
          gl.domElement.addEventListener('webglcontextlost', (e) => {
            e.preventDefault();
            setFailed(true);
          });
        }}
        style={{ width: '100%', height: '100%', display: 'block' }}
        aria-hidden
      >
        <Rig variant={variant} kind={kind} />
        <hemisphereLight args={['#fff4ea', '#3a1c10', 0.38]} />
        {/* Warm key from upper left, soft cool fill from the right, teal rim from behind. */}
        <directionalLight color="#fff0dd" intensity={1.7} position={[-2.6, 3.2, 5.5]} />
        <directionalLight color="#d6e8ff" intensity={0.45} position={[3.5, 0.6, 4]} />
        <directionalLight color="#9fdde6" intensity={0.7} position={[2.8, 2.2, -3.2]} />
        <directionalLight color="#ffc58a" intensity={0.9} position={[-3, 1.5, -2.5]} />
        {model.status === 'ready' ? (
          <AryaGlbFigure gltf={model.gltf} state={state} greetNonce={greetNonce} override={override} />
        ) : photo.status === 'ready' ? (
          <AryaPhotoFigure texture={photo.texture} teeth={photo.teeth} state={state} greetNonce={greetNonce} override={override} />
        ) : (
          <AryaFigure state={state} greetNonce={greetNonce} override={override} />
        )}
      </Canvas>
    </SceneBoundary>
  );
}
