import { useEffect, useMemo, useRef, type MutableRefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import { MathUtils } from 'three';
import { aryaVoice } from '../voice';

export type AryaState = 'idle' | 'listening' | 'thinking' | 'speaking';

/** Optional fixed values for the pose — used to preview expressions without audio. */
export interface PoseOverride {
  open?: number;
  wide?: number;
  round?: number;
  smile?: number;
  blink?: number;
  yaw?: number;
  pitch?: number;
  roll?: number;
  brow?: number;
  gazeX?: number;
  gazeY?: number;
}

/** What Arya's face and head are doing right now. Angles are radians; the rest run 0..1. */
export interface Pose {
  t: number;
  dt: number;
  yaw: number;
  pitch: number;
  roll: number;
  gazeX: number;
  gazeY: number;
  smile: number;
  brow: number;
  blink: number;
  mouth: { open: number; wide: number; round: number };
  breath: number;
  reduceMotion: boolean;
}

const { damp } = MathUtils;

/**
 * Arya's behaviour, independent of how she is drawn: idle head motion, blinking, gaze,
 * expressions per conversation state, the greeting bow, and lip-sync read from her
 * voice. Both the procedural and the photoreal (GLB) avatar read this each frame, so
 * they always act the same. Call it before any component's own useFrame.
 */
export function useAryaPose(state: AryaState, greetNonce = 0, override?: PoseOverride): MutableRefObject<Pose> {
  const reduceMotion = useMemo(
    () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
    [],
  );

  const pose = useRef<Pose>({
    t: 0, dt: 0, yaw: 0, pitch: 0, roll: 0, gazeX: 0, gazeY: 0, smile: 0.3, brow: 0, blink: 0,
    mouth: { open: 0, wide: 0, round: 0 }, breath: 0, reduceMotion,
  });
  const s = useRef({ nextBlink: 1.6, blinkStart: -10, doubleBlink: false, nextSaccade: 1.2, gazeTX: 0, gazeTY: 0, greetStart: -100, lastGreet: 0 });

  useEffect(() => {
    if (greetNonce !== s.current.lastGreet) {
      s.current.lastGreet = greetNonce;
      s.current.greetStart = pose.current.t;
    }
  }, [greetNonce]);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const p = pose.current;
    const a = s.current;
    p.t += dt;
    p.dt = dt;
    const t = p.t;
    const o = override ?? {};
    const motion = reduceMotion ? 0.35 : 1;

    // Greeting: bow in, hold with a warm smile, rise.
    const gt = t - a.greetStart;
    const greet = gt < 0 || gt > 4.2 ? 0 : gt < 0.9 ? Math.sin((gt / 0.9) * Math.PI * 0.5) : gt < 2.6 ? 1 : Math.cos(((gt - 2.6) / 1.6) * Math.PI * 0.5);
    const bow = gt < 0 || gt > 4.2 ? 0 : gt < 0.8 ? Math.sin((gt / 0.8) * Math.PI) * 0.5 : 0;

    // Lip-sync from the real voice (or fixed values for previews).
    const m = aryaVoice.mouth();
    p.mouth.open = o.open ?? m.open;
    p.mouth.wide = o.wide ?? m.wide;
    p.mouth.round = o.round ?? m.round;
    const speaking = state === 'speaking' || aryaVoice.speaking;
    const energy = speaking ? p.mouth.open : 0;

    // Head pose
    let yawT = Math.sin(t * 0.37) * 0.07 + Math.sin(t * 0.91) * 0.025;
    let pitchT = Math.sin(t * 0.53 + 1) * 0.03;
    let rollT = Math.sin(t * 0.29 + 2) * 0.025;
    if (state === 'listening') {
      rollT += 0.085; // attentive tilt
      pitchT -= 0.02;
    } else if (state === 'thinking') {
      yawT += 0.14;
      pitchT -= 0.06;
    } else if (speaking) {
      pitchT += Math.sin(t * 2.3) * 0.025 * (0.4 + energy * 1.5);
      yawT *= 1.4;
    }
    pitchT += bow * 0.275;
    yawT *= motion;
    pitchT *= motion === 1 ? 1 : 0.5;
    p.yaw = damp(p.yaw, o.yaw ?? yawT, 3, dt);
    p.pitch = damp(p.pitch, o.pitch ?? pitchT, 5, dt);
    p.roll = damp(p.roll, o.roll ?? rollT, 3, dt);

    // Expression
    const smileT = 0.32 + (state === 'thinking' ? -0.12 : 0) + greet * 0.55 + (speaking ? 0.1 : 0) - (state === 'listening' ? 0.02 : 0);
    const browT = (state === 'listening' ? 0.45 : state === 'thinking' ? 0.2 : 0) + (speaking ? energy * 0.5 : 0) + greet * 0.25;
    p.smile = damp(p.smile, o.smile ?? smileT, 4, dt);
    p.brow = damp(p.brow, o.brow ?? browT, 6, dt);

    // Gaze
    if (t > a.nextSaccade) {
      a.nextSaccade = t + 1.4 + Math.random() * 2.6;
      a.gazeTX = (Math.random() - 0.5) * 0.12 * motion;
      a.gazeTY = (Math.random() - 0.5) * 0.08 * motion;
    }
    let gx = a.gazeTX;
    let gy = a.gazeTY;
    if (state === 'thinking') { gx = -0.18; gy = -0.16; } // looks up and aside while she thinks
    else if (state === 'listening' || speaking) { gx *= 0.3; gy *= 0.3; } // steady eye contact
    p.gazeX = damp(p.gazeX, o.gazeX ?? gx, 14, dt);
    p.gazeY = damp(p.gazeY, o.gazeY ?? gy, 14, dt);

    // Blink
    if (t > a.nextBlink) {
      a.blinkStart = t;
      a.nextBlink = t + (a.doubleBlink ? 0.28 : 2.4 + Math.random() * 3.6);
      a.doubleBlink = !a.doubleBlink && Math.random() < 0.18;
    }
    const bt = (t - a.blinkStart) / 0.17;
    p.blink = o.blink ?? (bt >= 0 && bt <= 1 ? Math.sin(bt * Math.PI) : 0);

    p.breath = Math.sin(t * 1.55) * (reduceMotion ? 0.4 : 1);
  });

  return pose;
}
