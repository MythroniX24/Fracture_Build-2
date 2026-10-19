import * as THREE from 'three';
import { CharacterId } from '../game/config.ts';
import { FighterState } from '../game/rules.ts';
import { MaterialLibrary } from './materials.ts';

export interface ArticulatedFighterRig {
  root: THREE.Group;
  body: THREE.Group;
  hips: THREE.Group;
  spine: THREE.Group;
  neck: THREE.Group;
  head: THREE.Group;
  leftShoulder: THREE.Group;
  leftElbow: THREE.Group;
  rightShoulder: THREE.Group;
  rightElbow: THREE.Group;
  leftThigh: THREE.Group;
  leftKnee: THREE.Group;
  leftAnkle: THREE.Group;
  rightThigh: THREE.Group;
  rightKnee: THREE.Group;
  rightAnkle: THREE.Group;
  coreMesh: THREE.Mesh;
  coreSprite: THREE.Sprite;
  jetGroup: THREE.Group;
  jetFlames: THREE.Mesh[];
  gauntletBlades: THREE.Mesh[];
  guardShieldMesh: THREE.Mesh;
  decoyGroup: THREE.Group;
  contactShadow: THREE.Mesh;
  primaryArmorClone: THREE.MeshStandardMaterial;
  accentArmorClone: THREE.MeshStandardMaterial;
  coreMaterialClone: THREE.MeshStandardMaterial;
  characterId: CharacterId;
  walkCyclePhase: number;
  leadLeg: boolean;
  wasGrounded: boolean;
  landTimer: number;
  landDuration: number;
  dodgeTimer: number;
  dodgeDir: { x: number; z: number };
  punchAlt: boolean;
  currentAction: {
    name: string;
    duration: number;
    mask: 'full' | 'up';
    loop: boolean;
    time: number;
    fired: boolean;
  } | null;
  currentPose: Record<string, number>;
  lastDustTime: number;
}

export type DustCallback = (
  x: number,
  y: number,
  z: number,
  scale?: number,
  colorHex?: number
) => void;

export const POSE_KEYS = [
  'py', 'rp', 'sc', 'hx', 'hy', 'hz', 'sx', 'sy', 'sz', 'nx', 'ny',
  'la', 'lz', 'le', 'ra', 'rz', 're', 'll', 'lw', 'lk', 'rl', 'rw', 'rk',
  'jet', 'glow',
] as const;

export type PoseKey = (typeof POSE_KEYS)[number];

const DEFAULT_POSE: Record<PoseKey, number> = {
  py: 0, rp: 0, sc: 1, hx: 0, hy: 0, hz: 0, sx: 0, sy: 0, sz: 0, nx: 0, ny: 0,
  la: 0, lz: 0, le: 0, ra: 0, rz: 0, re: 0, ll: 0, lw: 0, lk: 0, rl: 0, rw: 0, rk: 0,
  jet: 0, glow: 0,
};

const MIRROR_PAIRS: Record<string, string> = {
  la: 'ra', ra: 'la', lz: 'rz', rz: 'lz', le: 're', re: 'le',
  ll: 'rl', rl: 'll', lw: 'rw', rw: 'lw', lk: 'rk', rk: 'lk',
};

const NEGATE_KEYS = new Set(['hy', 'sy', 'sz', 'hz', 'ny']);

function mirrorPose(pose: Partial<Record<PoseKey, number>>): Partial<Record<PoseKey, number>> {
  const result: Partial<Record<PoseKey, number>> = {};
  for (const k in pose) {
    const targetKey = (MIRROR_PAIRS[k] || k) as PoseKey;
    const factor = NEGATE_KEYS.has(k) ? -1 : 1;
    result[targetKey] = factor * (pose[k as PoseKey] ?? 0);
  }
  return result;
}

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
const smoothstep = (t: number) => t * t * (3 - 2 * t);

/**
 * Procedural rounded box geometry builder (rb from fracture-character-lab-v2.html)
 */
export function createRoundedBoxGeometry(
  w: number,
  h: number,
  d: number,
  r: number,
  n = 3
): THREE.BoxGeometry {
  const geo = new THREE.BoxGeometry(w, h, d, n, n, n);
  const p = geo.attributes.position;
  const v = new THREE.Vector3();
  const q = new THREE.Vector3();

  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    q.set(
      clamp(v.x, -w / 2 + r, w / 2 - r),
      clamp(v.y, -h / 2 + r, h / 2 - r),
      clamp(v.z, -d / 2 + r, d / 2 - r)
    );
    v.sub(q);
    if (v.lengthSq() > 0) {
      v.setLength(r);
    }
    v.add(q);
    p.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  return geo;
}

interface ActionKeyframe {
  time: number;
  pose: Partial<Record<PoseKey, number>>;
}

interface ActionDefinition {
  duration: number;
  mask: 'full' | 'up';
  loop: boolean;
  eventTime?: number;
  keys: ActionKeyframe[];
}

const PUNCH_R_KEYS: ActionKeyframe[] = [
  {
    time: 0,
    pose: {
      py: -0.08,
      sx: 0.16,
      sy: -0.35,
      hy: -0.2,
      ra: 0.85,
      rz: 0.45,
      re: 1.35,
      la: 0.65,
      lz: 0.2,
      le: 1.3,
      ll: 0.32,
      lk: 0.55,
      rl: -0.24,
      rk: 0.45,
    },
  },
  {
    time: 0.3,
    pose: {
      py: -0.14,
      sx: 0.22,
      sy: -0.82,
      hy: -0.42,
      ra: 1.35,
      rz: 0.82,
      re: 1.15,
      la: 0.55,
      lz: 0.35,
      le: 1.45,
      ll: 0.45,
      lk: 0.78,
      rl: -0.38,
      rk: 0.55,
      glow: 0.9,
      jet: 0.35,
    },
  },
  {
    time: 0.54,
    pose: {
      py: -0.18,
      sx: 0.32,
      sy: 0.92,
      hy: 0.48,
      sz: -0.14,
      ra: 1.68,
      rz: -0.68,
      re: 0.1,
      la: -0.25,
      lz: 0.48,
      le: 1.25,
      ll: 0.68,
      lk: 1.05,
      rl: -0.52,
      rk: 0.42,
      glow: 2.0,
      jet: 0.85,
    },
  },
  {
    time: 0.78,
    pose: {
      py: -0.1,
      sx: 0.18,
      sy: 0.38,
      hy: 0.2,
      ra: 1.05,
      rz: -0.25,
      re: 0.65,
      la: 0.55,
      lz: 0.22,
      le: 1.3,
      ll: 0.38,
      lk: 0.65,
      rl: -0.28,
      rk: 0.45,
      glow: 0.7,
    },
  },
  { time: 1.0, pose: {} },
];

const PUNCH_L_KEYS: ActionKeyframe[] = PUNCH_R_KEYS.map((k) => ({
  time: k.time,
  pose: mirrorPose(k.pose),
}));

const ACTION_TABLE: Record<string, ActionDefinition> = {
  punchR: {
    duration: 0.38,
    mask: 'full',
    loop: false,
    eventTime: 0.45,
    keys: PUNCH_R_KEYS,
  },
  punchL: {
    duration: 0.4,
    mask: 'full',
    loop: false,
    eventTime: 0.45,
    keys: PUNCH_L_KEYS,
  },
  punchFinisher: {
    duration: 0.52,
    mask: 'full',
    loop: false,
    eventTime: 0.45,
    keys: [
      {
        time: 0,
        pose: {
          py: -0.26,
          sx: 0.32,
          sy: -0.95,
          hy: -0.45,
          ra: -0.65,
          rz: 0.55,
          re: 1.45,
          la: 0.85,
          lz: -0.45,
          le: 1.35,
          ll: 0.58,
          rl: -0.35,
          lk: 1.05,
          rk: 0.82,
          glow: 1.2,
          jet: 0.5,
        },
      },
      {
        time: 0.46,
        pose: {
          py: 0.24,
          sx: -0.26,
          sy: 0.98,
          hy: 0.52,
          ra: 2.38,
          rz: -0.42,
          re: 0.12,
          la: 2.15,
          lz: -0.38,
          le: 0.18,
          ll: -0.28,
          rl: 0.48,
          lk: 0.3,
          rk: 0.72,
          jet: 1.2,
          glow: 2.6,
        },
      },
      {
        time: 0.8,
        pose: {
          py: -0.1,
          sx: 0.16,
          sy: 0.32,
          ra: 1.15,
          re: 0.65,
          la: 0.85,
          le: 0.95,
          ll: 0.32,
          lk: 0.55,
          glow: 0.9,
        },
      },
      { time: 1.0, pose: {} },
    ],
  },
  grav: {
    duration: 0.6,
    mask: 'full',
    loop: false,
    eventTime: 0.38,
    keys: [
      {
        time: 0,
        pose: {
          py: -0.22,
          sx: 0.28,
          sy: -0.55,
          la: 1.15,
          ra: 1.15,
          lz: -0.48,
          rz: -0.48,
          le: 1.35,
          re: 1.35,
          ll: 0.5,
          lk: 0.9,
          glow: 1.4,
        },
      },
      {
        time: 0.42,
        pose: {
          py: 0.08,
          sx: -0.18,
          sy: 0.35,
          ra: 1.65,
          rz: 0.25,
          re: 0.06,
          la: 1.45,
          lz: 0.65,
          le: 0.25,
          ll: 0.62,
          lk: 0.95,
          rl: -0.45,
          rk: 0.45,
          glow: 2.8,
          jet: 1.1,
        },
      },
      {
        time: 0.76,
        pose: {
          py: -0.08,
          sx: 0.14,
          sy: 0.18,
          ra: 1.25,
          re: 0.45,
          la: 0.75,
          le: 1.1,
          glow: 1.4,
        },
      },
      { time: 1.0, pose: {} },
    ],
  },
  shock: {
    duration: 0.68,
    mask: 'full',
    loop: false,
    eventTime: 0.46,
    keys: [
      {
        time: 0,
        pose: {
          py: -0.34,
          sx: 0.42,
          la: 1.25,
          ra: 1.25,
          lz: -0.55,
          rz: -0.55,
          le: 1.35,
          re: 1.35,
          ll: 0.65,
          rl: 0.55,
          lk: 1.15,
          rk: 1.05,
          glow: 1.5,
        },
      },
      {
        time: 0.46,
        pose: {
          py: -0.12,
          sx: -0.28,
          la: 1.58,
          ra: 1.58,
          lz: 0.92,
          rz: 0.92,
          le: 0.1,
          re: 0.1,
          ll: 0.72,
          rl: 0.62,
          lk: 1.25,
          rk: 1.25,
          glow: 3.0,
          jet: 1.25,
        },
      },
      { time: 0.84, pose: { py: -0.15, sx: 0.2, glow: 0.8 } },
      { time: 1.0, pose: {} },
    ],
  },
  brk: {
    duration: 0.72,
    mask: 'full',
    loop: false,
    eventTime: 0.48,
    keys: [
      { time: 0, pose: { py: -0.2, sx: 0.25, ll: 0.45, lk: 0.85, glow: 1.0 } },
      {
        time: 0.34,
        pose: {
          sx: -0.45,
          la: 2.85,
          ra: 2.85,
          lz: 0.22,
          rz: 0.22,
          le: 0.35,
          re: 0.35,
          py: 0.32,
          ll: -0.3,
          rl: 0.35,
          lk: 0.25,
          rk: 0.45,
          jet: 1.1,
          glow: 1.8,
        },
      },
      {
        time: 0.52,
        pose: {
          sx: 0.88,
          la: 0.48,
          ra: 0.48,
          lz: -0.35,
          rz: -0.35,
          le: 0.15,
          re: 0.15,
          py: -0.56,
          ll: 0.88,
          rl: 0.78,
          lk: 1.52,
          rk: 1.52,
          glow: 2.8,
          jet: 1.2,
        },
      },
      {
        time: 0.86,
        pose: {
          sx: 0.32,
          py: -0.22,
          la: 0.55,
          ra: 0.55,
          le: 0.75,
          re: 0.75,
          ll: 0.48,
          rl: 0.38,
          lk: 0.95,
          rk: 0.95,
        },
      },
      { time: 1.0, pose: {} },
    ],
  },
  execute: {
    duration: 0.75,
    mask: 'full',
    loop: false,
    eventTime: 0.48,
    keys: [
      {
        time: 0,
        pose: {
          py: -0.3,
          sx: 0.3,
          sy: -1.1,
          la: 0.8,
          ra: -0.9,
          le: 1.4,
          re: 1.5,
          glow: 1.8,
          jet: 1.0,
        },
      },
      {
        time: 0.32,
        pose: {
          py: 0.42,
          sx: -0.35,
          sy: 0.0,
          la: 2.9,
          ra: 2.9,
          le: 0.3,
          re: 0.3,
          ll: 0.6,
          rl: -0.4,
          lk: 1.1,
          rk: 0.5,
          glow: 2.8,
          jet: 1.25,
        },
      },
      {
        time: 0.5,
        pose: {
          py: -0.58,
          sx: 0.9,
          sy: 0.4,
          la: 0.4,
          ra: 0.4,
          lz: -0.42,
          rz: -0.42,
          le: 0.15,
          re: 0.15,
          ll: 0.9,
          rl: 0.8,
          lk: 1.55,
          rk: 1.55,
          glow: 3.2,
          jet: 1.1,
        },
      },
      {
        time: 0.85,
        pose: { py: -0.2, sx: 0.25, la: 0.5, ra: 0.5, le: 0.8, re: 0.8, glow: 1.0 },
      },
      { time: 1.0, pose: {} },
    ],
  },
  hit: {
    duration: 0.32,
    mask: 'full',
    loop: false,
    keys: [
      { time: 0, pose: {} },
      {
        time: 0.25,
        pose: {
          sx: -0.48,
          sy: 0.32,
          nx: -0.4,
          la: 0.95,
          ra: 0.85,
          lz: 0.45,
          rz: 0.45,
          le: 0.9,
          re: 0.9,
          py: -0.1,
          ll: -0.25,
          rl: 0.22,
        },
      },
      { time: 1.0, pose: {} },
    ],
  },
  knock: {
    duration: 1.2,
    mask: 'full',
    loop: false,
    keys: [
      { time: 0, pose: {} },
      {
        time: 0.12,
        pose: {
          rp: -0.35,
          py: -0.28,
          sx: 0.55,
          la: 1.35,
          ra: 1.35,
          lz: 0.55,
          rz: 0.55,
          le: 0.45,
          re: 0.45,
          ll: 0.65,
          rl: 0.45,
          lk: 1.25,
          rk: 1.05,
          nx: 0.35,
        },
      },
      {
        time: 0.55,
        pose: {
          rp: -0.18,
          py: -0.42,
          sx: 0.65,
          la: 0.65,
          ra: 0.65,
          lz: 0.4,
          rz: 0.4,
          le: 0.85,
          re: 0.85,
          ll: 0.85,
          rl: 0.65,
          lk: 1.45,
          rk: 1.35,
        },
      },
      { time: 1.0, pose: {} },
    ],
  },
  die: {
    duration: 2.2,
    mask: 'full',
    loop: false,
    keys: [
      { time: 0, pose: {} },
      { time: 0.15, pose: { sx: 0.2, nx: 0.4, py: -0.1, la: 0.6, ra: 0.6, glow: -0.5 } },
      {
        time: 0.4,
        pose: {
          py: -0.5,
          ll: 0.9,
          rl: 0.6,
          lk: 1.8,
          rk: 1.6,
          sx: 0.55,
          nx: 0.5,
          la: 0.3,
          ra: 0.3,
          glow: -0.9,
        },
      },
      {
        time: 0.7,
        pose: {
          rp: 1.57,
          py: -0.85,
          sx: 0.2,
          la: 0.2,
          ra: 0.2,
          lz: 0.4,
          rz: 0.4,
          ll: -0.2,
          rl: -0.1,
          lk: 0.4,
          rk: 0.3,
          glow: -1,
        },
      },
      {
        time: 1.0,
        pose: {
          rp: 1.57,
          py: -0.85,
          sx: 0.2,
          la: 0.2,
          ra: 0.2,
          lz: 0.4,
          rz: 0.4,
          ll: -0.2,
          rl: -0.1,
          lk: 0.4,
          rk: 0.3,
          glow: -1,
        },
      },
    ],
  },
  spawn: {
    duration: 1.2,
    mask: 'full',
    loop: false,
    keys: [
      { time: 0, pose: { sc: 0.01, jet: 1, glow: 2 } },
      { time: 0.45, pose: { sc: 1.18, jet: 1, glow: 1.6 } },
      { time: 0.7, pose: { sc: 0.95, glow: 1 } },
      { time: 1.0, pose: { sc: 1 } },
    ],
  },
  win: {
    duration: 1.6,
    mask: 'full',
    loop: true,
    keys: [
      { time: 0, pose: { la: 2.9, ra: 1.2, le: 0.2, re: 1.4, py: 0.05, hy: 0.15, sx: -0.1 } },
      { time: 0.5, pose: { la: 1.2, ra: 2.9, le: 1.4, re: 0.2, py: 0.12, hy: -0.15, sx: -0.1 } },
      { time: 1.0, pose: { la: 2.9, ra: 1.2, le: 0.2, re: 1.4, py: 0.05, hy: 0.15, sx: -0.1 } },
    ],
  },
  lose: {
    duration: 3.0,
    mask: 'full',
    loop: true,
    keys: [
      { time: 0, pose: { sx: 0.45, nx: 0.5, py: -0.1, la: -0.1, ra: -0.1, lz: 0.1, rz: 0.1 } },
      { time: 0.5, pose: { sx: 0.52, nx: 0.56, py: -0.13, la: -0.12, ra: -0.12 } },
      { time: 1.0, pose: { sx: 0.45, nx: 0.5, py: -0.1, la: -0.1, ra: -0.1, lz: 0.1, rz: 0.1 } },
    ],
  },
  wave: {
    duration: 1.4,
    mask: 'up',
    loop: true,
    keys: [
      { time: 0, pose: { ra: 2.7, rz: 0.4, re: 0.4, ny: -0.2 } },
      { time: 0.25, pose: { ra: 2.7, rz: 0.4, re: 1.5, ny: -0.2 } },
      { time: 0.5, pose: { ra: 2.7, rz: 0.4, re: 0.4, ny: -0.2 } },
      { time: 0.75, pose: { ra: 2.7, rz: 0.4, re: 1.5, ny: -0.2 } },
      { time: 1.0, pose: { ra: 2.7, rz: 0.4, re: 0.4, ny: -0.2 } },
    ],
  },
  fall: {
    duration: 0.6,
    mask: 'full',
    loop: true,
    keys: [
      {
        time: 0,
        pose: {
          la: 2.2,
          ra: 1.4,
          ll: 0.5,
          rl: -0.3,
          lk: 0.8,
          rk: 1.2,
          lz: 0.5,
          rz: 0.3,
          sx: 0.15,
          py: 0.1,
        },
      },
      {
        time: 0.5,
        pose: {
          la: 1.4,
          ra: 2.2,
          ll: -0.3,
          rl: 0.5,
          lk: 1.2,
          rk: 0.8,
          lz: 0.3,
          rz: 0.5,
          sx: 0.15,
          py: 0.1,
        },
      },
      {
        time: 1.0,
        pose: {
          la: 2.2,
          ra: 1.4,
          ll: 0.5,
          rl: -0.3,
          lk: 0.8,
          rk: 1.2,
          lz: 0.5,
          rz: 0.3,
          sx: 0.15,
          py: 0.1,
        },
      },
    ],
  },
};

function sampleActionPose(action: ActionDefinition, u: number): Record<PoseKey, number> {
  const K = action.keys;
  let i = 0;
  while (i < K.length - 2 && u > K[i + 1].time) i++;
  const k0 = K[i];
  const k1 = K[i + 1];
  const span = k1.time - k0.time || 1;
  const t = smoothstep(clamp((u - k0.time) / span, 0, 1));

  const sampled: Record<PoseKey, number> = { ...DEFAULT_POSE };
  for (const k of POSE_KEYS) {
    const v0 = k0.pose[k] !== undefined ? k0.pose[k]! : DEFAULT_POSE[k];
    const v1 = k1.pose[k] !== undefined ? k1.pose[k]! : DEFAULT_POSE[k];
    sampled[k] = v0 + (v1 - v0) * t;
  }
  return sampled;
}

// Two-bone Inverse Kinematics solver
const BASE_HEIGHT = 1.12;
const THIGH_LEN = 0.44;
const SHIN_LEN = 0.42;
const ANKLE_HEIGHT = 0.16;
const ROOT_OFFSET_Y = 0.12;

function solveLegIK(side: number, footX: number, footY: number, footZ: number, bodyY: number) {
  let targetX = footX - side * 0.2;
  let targetY = footY - bodyY + ROOT_OFFSET_Y;
  let targetZ = footZ;
  let dist = Math.hypot(targetX, targetY, targetZ);
  const maxReach = THIGH_LEN + SHIN_LEN - 0.002;

  if (dist > maxReach) {
    const scale = maxReach / dist;
    targetX *= scale;
    targetY *= scale;
    targetZ *= scale;
    dist = maxReach;
  }

  const kneeAngle = Math.acos(
    clamp(
      (dist * dist - THIGH_LEN * THIGH_LEN - SHIN_LEN * SHIN_LEN) / (2 * THIGH_LEN * SHIN_LEN),
      -1,
      1
    )
  );
  const phi = Math.atan2(
    SHIN_LEN * Math.sin(kneeAngle),
    THIGH_LEN + SHIN_LEN * Math.cos(kneeAngle)
  );
  const pitchAngle = Math.asin(clamp(-targetZ / dist, -1, 1)) - phi;
  const yawAngle = Math.atan2(targetX / dist, -targetY / dist);

  return { pitch: pitchAngle, yaw: yawAngle, knee: kneeAngle };
}

function calculateLocomotionPose(
  mx: number,
  mz: number,
  mag: number,
  phase: number,
  elapsedTime: number
): Record<PoseKey, number> {
  const o: Record<PoseKey, number> = { ...DEFAULT_POSE };
  const w = smoothstep(clamp(mag * 5.2, 0, 1));
  const idleW = 1 - w;
  const ul = mag > 0.01 ? mx / mag : 0;
  const uf = mag > 0.01 ? mz / mag : 1;
  const strideAmp = (0.24 + 0.3 * mag) * w;
  const stanceFraction = 0.5 - 0.15 * mag;
  const liftHeight = 0.09 + 0.14 * mag;
  const fp = phase - Math.floor(phase);

  const breath = Math.sin(elapsedTime * 3.1);
  const sway = Math.cos(elapsedTime * 1.6);

  // Athletic crouch in combat idle + dynamic stride bob when running
  o.py =
    (0.04 * mag * Math.cos(4 * Math.PI * (fp - 0.28)) - 0.08 * mag) * w +
    (-0.055 + breath * 0.022) * idleW;
  const currentBodyY = BASE_HEIGHT + o.py;
  const swingWeights = [0, 0];

  for (let k = 0; k < 2; k++) {
    const p = (fp + k * 0.5) % 1;
    const side = k === 1 ? -1 : 1;
    let s: number;
    let lift = 0;
    if (p < stanceFraction) {
      s = 1 - (2 * p) / stanceFraction;
    } else {
      const q = (p - stanceFraction) / (1 - stanceFraction);
      s = -1 + 2 * smoothstep(q);
      lift = Math.sin(Math.PI * q) * liftHeight;
    }
    swingWeights[k] = s * w;

    // Staggered martial-arts foot placement when idle (left foot forward, right foot braced back)
    const idleFootZ = (side > 0 ? 0.14 : -0.14) * idleW;
    const idleFootX = side * (0.23 + 0.03 * idleW);

    const ik = solveLegIK(
      side,
      idleFootX + ul * strideAmp * s,
      ANKLE_HEIGHT + lift * w,
      idleFootZ + uf * strideAmp * s + side * 0.025 * w,
      currentBodyY
    );

    if (k === 1) {
      o.rl = -ik.pitch;
      o.rw = side * ik.yaw;
      o.rk = ik.knee;
    } else {
      o.ll = -ik.pitch;
      o.lw = side * ik.yaw;
      o.lk = ik.knee;
    }
  }

  // Dynamic torso lean & martial ready coil
  o.sx = uf * mag * 0.22 * w + (0.11 + breath * 0.025) * idleW;
  o.sz = ul * mag * 0.16 * w + sway * 0.02 * idleW;
  o.sy =
    Math.sin(2 * Math.PI * fp) * 0.22 * mag * (Math.abs(uf) + 0.35) * w +
    (-0.22 + sway * 0.04) * idleW;
  o.hy = -o.sy * 0.7 + 0.16 * idleW;
  o.nx = -o.sx * 0.65;
  o.ny = -o.sy * 0.6;

  // Raised martial combat guard in idle + fluid counter-swinging arms in run
  o.la = (0.68 + breath * 0.05) * idleW + w * (0.42 + swingWeights[1] * 0.95 * uf * mag);
  o.ra = (0.52 - breath * 0.05) * idleW + w * (0.42 + swingWeights[0] * 0.95 * uf * mag);
  o.le = (1.28 + breath * 0.06) * idleW + w * (0.65 + 0.85 * mag);
  o.re = (1.36 - breath * 0.06) * idleW + w * (0.65 + 0.85 * mag);
  o.lz = 0.18 * idleW + (0.1 + 0.14 * Math.abs(ul)) * w;
  o.rz = 0.22 * idleW + (0.1 + 0.14 * Math.abs(ul)) * w;
  o.glow = 0.45 + 0.25 * Math.sin(elapsedTime * 3.0);

  return o;
}

function calculateAirPose(vy: number, horizSpeed: number, lead: boolean): Record<PoseKey, number> {
  const u = smoothstep(clamp((4 - vy) / 8, 0, 1));
  const rj = smoothstep(clamp((horizSpeed - 2) / 3, 0, 1));
  const o: Record<PoseKey, number> = { ...DEFAULT_POSE };

  const s1: Partial<Record<PoseKey, number>> = {
    ll: 0.9 * (1 - u) + 0.25 * u,
    rl: 0.5 * (1 - u) + 0.15 * u,
    lk: 1.4 * (1 - u) + 0.5 * u,
    rk: 1.1 * (1 - u) + 0.4 * u,
    la: 1.5 * (1 - u) + 0.6 * u,
    ra: 1.5 * (1 - u) + 0.6 * u,
    lz: 0.3 + 0.5 * u,
    rz: 0.3 + 0.5 * u,
    le: 0.3,
    re: 0.3,
    sx: -0.08 * (1 - u) + 0.1 * u,
  };

  let s2: Partial<Record<PoseKey, number>> = {
    ll: 1.25,
    lk: 1.4,
    rl: -0.9,
    rk: 1.2,
    la: -0.7,
    ra: 1.1,
    le: 0.9,
    re: 0.9,
    sx: 0.35 * (1 - u * 0.5),
    lz: 0.15,
    rz: 0.15,
  };
  if (!lead) s2 = mirrorPose(s2);

  for (const k in s1) {
    const key = k as PoseKey;
    o[key] = (s1[key] ?? 0) * (1 - rj) + (s2[key] ?? 0) * rj;
  }
  for (const k in s2) {
    const key = k as PoseKey;
    if (!(key in s1)) {
      o[key] = (s2[key] ?? 0) * rj;
    }
  }

  o.glow = 0.65;
  o.jet = vy > 0 ? 0.85 * (1 - rj * 0.3) : 0.25;
  return o;
}

const LAND_POSE: Partial<Record<PoseKey, number>> = {
  py: -0.32,
  sx: 0.35,
  ll: 0.7,
  rl: 0.7,
  lk: 1.3,
  rk: 1.3,
  la: 0.6,
  ra: 0.6,
  le: 0.8,
  re: 0.8,
};

function calculateDodgePose(mx: number, mz: number): Record<PoseKey, number> {
  const o: Record<PoseKey, number> = { ...DEFAULT_POSE };
  o.py = -0.38;
  o.sx = mz * 0.75 + 0.32;
  o.sz = mx * 0.65;
  o.ll = -mz * 0.9 + 0.35;
  o.rl = -mz * 0.6 + 0.25;
  o.lw = -mx * 0.5;
  o.rw = mx * 0.6;
  o.lk = 0.95;
  o.rk = 0.65;
  o.la = -mz * 1.1 + 0.35;
  o.ra = -mz * 1.1 + 0.35;
  o.lz = 0.42;
  o.rz = 0.42;
  o.le = 0.65;
  o.re = 0.65;
  o.jet = 1.35;
  o.glow = 1.6;
  return o;
}

/**
 * Builds the upgraded heroic Colossus Mech-Warrior rig with sculpted chest/back armor,
 * winged shoulder pauldrons, rear reactor halo, and twin plasma war-blades.
 */
export function buildFighterRig(
  characterId: CharacterId,
  materials: MaterialLibrary,
  isDecoy = false,
  castShadow = true
): ArticulatedFighterRig {
  const root = new THREE.Group();
  root.name = `mech_${characterId}`;

  // Contact shadow disc
  const shadowGeo = new THREE.PlaneGeometry(1.9, 1.9);
  shadowGeo.rotateX(-Math.PI / 2);
  const contactShadow = new THREE.Mesh(shadowGeo, materials.contactShadow.clone());
  contactShadow.position.y = 0.02;
  root.add(contactShadow);

  // Body container at baseline y = 1.12
  const body = new THREE.Group();
  body.position.y = BASE_HEIGHT;
  root.add(body);

  const hips = new THREE.Group();
  body.add(hips);

  const armM = isDecoy
    ? materials.decoyWireframe.clone()
    : materials.mechGunmetalArmor.clone();
  const accM = isDecoy
    ? materials.decoyWireframe.clone()
    : characterId === 'volt'
      ? materials.mechArmorVolt.clone()
      : materials.mechArmorRift.clone();
  const bronzeM = isDecoy ? materials.decoyWireframe : materials.mechBronze;
  const darkM = isDecoy ? materials.decoyWireframe : materials.mechDarkChassis;
  const coreM =
    characterId === 'volt' ? materials.mechCoreVolt.clone() : materials.mechCoreRift.clone();
  const visM = materials.mechVisor;
  const seamM = materials.mechSeam;

  const mk = (
    geo: THREE.BufferGeometry,
    mat: THREE.Material,
    parent: THREE.Object3D,
    x = 0,
    y = 0,
    z = 0,
    sh = false
  ) => {
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    mesh.castShadow = sh && castShadow && !isDecoy;
    mesh.receiveShadow = false;
    parent.add(mesh);
    return mesh;
  };

  // --- Hips, Tassets & Pelvis ---
  mk(createRoundedBoxGeometry(0.64, 0.26, 0.44, 0.06, 3), armM, hips, 0, 0, 0, true);
  for (const s of [1, -1]) {
    const tasset = mk(
      createRoundedBoxGeometry(0.16, 0.34, 0.46, 0.05, 2),
      accM,
      hips,
      s * 0.35,
      -0.04,
      0
    );
    tasset.rotation.z = -s * 0.14;
  }
  mk(createRoundedBoxGeometry(0.32, 0.22, 0.12, 0.04, 2), bronzeM, hips, 0, -0.06, 0.23);
  mk(createRoundedBoxGeometry(0.68, 0.08, 0.48, 0.03, 2), bronzeM, hips, 0, 0.14, 0);

  // --- Spine & V-Tapered Heroic Torso ---
  const spine = new THREE.Group();
  spine.position.y = 0.16;
  hips.add(spine);

  mk(new THREE.CylinderGeometry(0.24, 0.26, 0.24, 12), darkM, spine, 0, 0.1, 0);
  mk(createRoundedBoxGeometry(0.88, 0.44, 0.52, 0.09, 4), armM, spine, 0, 0.31, 0, true);
  mk(createRoundedBoxGeometry(0.98, 0.26, 0.48, 0.08, 4), armM, spine, 0, 0.59, 0, true);
  // Faction collar & sculpted V-chest breastplate
  mk(createRoundedBoxGeometry(0.8, 0.1, 0.5, 0.03, 2), accM, spine, 0, 0.7, 0);
  mk(createRoundedBoxGeometry(0.58, 0.36, 0.12, 0.05, 3), bronzeM, spine, 0, 0.43, 0.26);

  // Front Reactor Core Ring + Rear Spine Reactor Halo (highly visible from behind!)
  mk(new THREE.TorusGeometry(0.14, 0.032, 8, 18), bronzeM, spine, 0, 0.44, 0.32);
  const coreMesh = mk(new THREE.SphereGeometry(0.11, 12, 8), coreM, spine, 0, 0.44, 0.32);

  // Rear Dorsal Reactor Core Ring (visible to the player in behind-the-back view)
  mk(new THREE.TorusGeometry(0.15, 0.028, 8, 18), coreM, spine, 0, 0.45, -0.53);

  const spriteMat = new THREE.SpriteMaterial({
    map: materials.softParticleTex,
    color: characterId === 'volt' ? 0xffa030 : 0x38bdf8,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const coreSprite = new THREE.Sprite(spriteMat);
  coreSprite.scale.setScalar(0.62);
  coreSprite.position.set(0, 0.44, 0.4);
  spine.add(coreSprite);

  // Glowing chest & dorsal armor seams
  for (const s of [1, -1]) {
    for (let i = 0; i < 3; i++) {
      mk(
        new THREE.BoxGeometry(0.028, 0.16, 0.025),
        seamM,
        spine,
        s * (0.22 + i * 0.075),
        0.31,
        0.27,
        false
      );
    }
    // Angled dorsal wing-stabilizer fins on backpack
    const wing = mk(
      createRoundedBoxGeometry(0.08, 0.42, 0.22, 0.02, 2),
      accM,
      spine,
      s * 0.32,
      0.56,
      -0.42
    );
    wing.rotation.z = -s * 0.32;
    wing.rotation.x = 0.22;
  }

  // Backpack & Dual Jet Thrusters
  mk(createRoundedBoxGeometry(0.62, 0.52, 0.28, 0.06, 3), darkM, spine, 0, 0.41, -0.37, true);
  mk(createRoundedBoxGeometry(0.46, 0.34, 0.09, 0.03, 2), accM, spine, 0, 0.43, -0.5);
  const jetGroup = new THREE.Group();
  jetGroup.position.set(0, 0.12, -0.5);
  spine.add(jetGroup);

  const jetFlames: THREE.Mesh[] = [];
  for (const s of [1, -1]) {
    mk(new THREE.CylinderGeometry(0.095, 0.12, 0.22, 10), bronzeM, spine, s * 0.17, 0.14, -0.5);
    const fl = new THREE.Mesh(new THREE.ConeGeometry(0.12, 1.05, 8), materials.jetFlame);
    fl.rotation.x = Math.PI;
    fl.position.set(s * 0.17, -0.5, 0);
    jetGroup.add(fl);
    jetFlames.push(fl);
  }

  // --- Neck & Armored Knight/Mecha Helm ---
  mk(new THREE.CylinderGeometry(0.11, 0.13, 0.16, 10), darkM, spine, 0, 0.75, 0);
  const neck = new THREE.Group();
  neck.position.set(0, 0.79, 0);
  spine.add(neck);

  const head = new THREE.Group();
  neck.add(head);

  mk(createRoundedBoxGeometry(0.44, 0.38, 0.44, 0.1, 4), armM, head, 0, 0.19, 0, true);
  mk(createRoundedBoxGeometry(0.36, 0.19, 0.07, 0.04, 2), darkM, head, 0, 0.2, 0.21);
  mk(new THREE.BoxGeometry(0.3, 0.055, 0.035), visM, head, 0, 0.22, 0.24, false);
  mk(createRoundedBoxGeometry(0.48, 0.075, 0.46, 0.03, 2), bronzeM, head, 0, 0.39, 0);

  for (const s of [1, -1]) {
    const pd = mk(
      new THREE.CylinderGeometry(0.075, 0.075, 0.09, 8),
      bronzeM,
      head,
      s * 0.24,
      0.18,
      0
    );
    pd.rotation.z = Math.PI / 2;
    // Angled V-Fin / Samurai Crest Horns
    const horn = mk(
      createRoundedBoxGeometry(0.045, 0.24, 0.1, 0.015, 2),
      accM,
      head,
      s * 0.14,
      0.47,
      0.08
    );
    horn.rotation.z = -s * 0.38;
    horn.rotation.x = -0.18;
  }
  mk(createRoundedBoxGeometry(0.07, 0.2, 0.38, 0.03, 2), accM, head, 0, 0.46, -0.03);

  // --- Arms: Shoulders, Elbows, Hands & Twin High-Visibility Plasma War-Blades ---
  const leftShoulder = new THREE.Group();
  const rightShoulder = new THREE.Group();
  const leftElbow = new THREE.Group();
  const rightElbow = new THREE.Group();
  const gauntletBlades: THREE.Mesh[] = [];

  const arms = [
    { side: 1, sh: leftShoulder, el: leftElbow },
    { side: -1, sh: rightShoulder, el: rightElbow },
  ];

  for (const { side, sh, el } of arms) {
    sh.position.set(side * 0.62, 0.57, 0);
    spine.add(sh);

    mk(new THREE.SphereGeometry(0.14, 12, 8), darkM, sh);
    mk(
      new THREE.SphereGeometry(0.29, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.56),
      armM,
      sh,
      side * 0.06,
      0.05,
      0,
      true
    );
    // Layered outer shoulder pauldron plate & glowing trim
    mk(
      new THREE.SphereGeometry(0.298, 14, 6, 0, Math.PI * 2, 0, Math.PI * 0.26),
      accM,
      sh,
      side * 0.06,
      0.055,
      0
    );
    const pauldronWing = mk(
      createRoundedBoxGeometry(0.22, 0.14, 0.34, 0.03, 2),
      bronzeM,
      sh,
      side * 0.22,
      0.06,
      0
    );
    pauldronWing.rotation.z = -side * 0.28;

    mk(new THREE.CylinderGeometry(0.13, 0.11, 0.35, 12), armM, sh, 0, -0.2, 0, true);
    mk(createRoundedBoxGeometry(0.18, 0.19, 0.22, 0.04, 2), armM, sh, side * 0.03, -0.15, 0);
    mk(new THREE.CylinderGeometry(0.02, 0.02, 0.3, 6), bronzeM, sh, 0, -0.2, -0.12);

    el.position.set(0, -0.4, 0);
    sh.add(el);

    mk(new THREE.SphereGeometry(0.11, 12, 8), darkM, el);
    mk(new THREE.CylinderGeometry(0.125, 0.16, 0.35, 12), armM, el, 0, -0.2, 0, true);
    mk(new THREE.CylinderGeometry(0.165, 0.165, 0.055, 12), bronzeM, el, 0, -0.3, 0);
    mk(new THREE.CylinderGeometry(0.13, 0.13, 0.045, 12), accM, el, 0, -0.06, 0);

    // Armored Fist & Knuckle Guard
    mk(createRoundedBoxGeometry(0.29, 0.26, 0.31, 0.06, 3), darkM, el, 0, -0.5, 0.03, true);
    mk(createRoundedBoxGeometry(0.31, 0.075, 0.11, 0.03, 2), bronzeM, el, 0, -0.43, 0.16);
    for (let i = 0; i < 4; i++) {
      mk(
        createRoundedBoxGeometry(0.055, 0.07, 0.11, 0.02, 1),
        darkM,
        el,
        -0.1 + i * 0.067,
        -0.58,
        0.17
      );
    }

    // Forearm Plasma War-Blade Hilt & Metallic Spine
    mk(
      createRoundedBoxGeometry(0.08, 0.42, 0.12, 0.02, 2),
      bronzeM,
      el,
      side * 0.16,
      -0.36,
      0.08
    );
    // High-Visibility Glowing Plasma War-Blade extending past the fist!
    const bladeGeo = createRoundedBoxGeometry(0.048, 0.78, 0.18, 0.015, 2);
    const bladeMesh = new THREE.Mesh(bladeGeo, coreM);
    bladeMesh.position.set(side * 0.18, -0.54, 0.18);
    bladeMesh.rotation.x = 0.18;
    bladeMesh.castShadow = false;
    el.add(bladeMesh);
    gauntletBlades.push(bladeMesh);
  }

  // --- Legs: Thighs, Knees, Shins & Armored Sabaton Boots ---
  const leftThigh = new THREE.Group();
  const rightThigh = new THREE.Group();
  const leftKnee = new THREE.Group();
  const rightKnee = new THREE.Group();
  const leftAnkle = new THREE.Group();
  const rightAnkle = new THREE.Group();

  const legs = [
    { side: 1, th: leftThigh, kn: leftKnee, an: leftAnkle },
    { side: -1, th: rightThigh, kn: rightKnee, an: rightAnkle },
  ];

  for (const { side, th, kn, an } of legs) {
    th.position.set(side * 0.21, -0.12, 0);
    th.rotation.order = 'ZXY';
    hips.add(th);

    mk(new THREE.SphereGeometry(0.155, 12, 8), darkM, th);
    mk(new THREE.CylinderGeometry(0.18, 0.14, 0.44, 12), armM, th, 0, -0.22, 0, true);
    mk(createRoundedBoxGeometry(0.22, 0.32, 0.09, 0.04, 2), armM, th, 0, -0.2, 0.12);
    mk(createRoundedBoxGeometry(0.07, 0.24, 0.15, 0.02, 2), accM, th, side * 0.13, -0.2, 0);

    kn.position.set(0, -0.44, 0);
    th.add(kn);

    mk(new THREE.SphereGeometry(0.125, 12, 8), darkM, kn);
    mk(createRoundedBoxGeometry(0.22, 0.18, 0.13, 0.05, 2), bronzeM, kn, 0, 0, 0.1);
    mk(new THREE.CylinderGeometry(0.13, 0.095, 0.42, 12), armM, kn, 0, -0.21, 0, true);
    mk(createRoundedBoxGeometry(0.21, 0.31, 0.13, 0.04, 2), armM, kn, 0, -0.16, -0.1);
    mk(createRoundedBoxGeometry(0.18, 0.31, 0.07, 0.03, 2), accM, kn, 0, -0.2, 0.09);
    mk(new THREE.CylinderGeometry(0.02, 0.02, 0.34, 6), bronzeM, kn, side * 0.11, -0.2, -0.1);

    an.position.set(0, -0.42, 0);
    kn.add(an);

    mk(new THREE.SphereGeometry(0.095, 10, 6), darkM, an);
    mk(createRoundedBoxGeometry(0.3, 0.15, 0.36, 0.05, 3), armM, an, 0, -0.07, 0.05, true);
    mk(createRoundedBoxGeometry(0.27, 0.11, 0.17, 0.04, 2), bronzeM, an, 0, -0.09, 0.2);
    mk(createRoundedBoxGeometry(0.32, 0.045, 0.45, 0.02, 1), darkM, an, 0, -0.14, 0.06);
  }

  // --- Holographic Guard Shield Bubble ---
  const shieldGeo = new THREE.SphereGeometry(1.55, 16, 12);
  const guardShieldMesh = new THREE.Mesh(shieldGeo, materials.mechShield.clone());
  guardShieldMesh.position.set(0, 1.25, 0);
  guardShieldMesh.visible = false;
  root.add(guardShieldMesh);

  // --- Holographic Decoy Group for RIFT ability ---
  const decoyGroup = new THREE.Group();
  decoyGroup.name = `decoy_${characterId}`;
  decoyGroup.visible = false;
  mk(
    createRoundedBoxGeometry(0.75, 0.85, 0.45, 0.08, 2),
    materials.decoyWireframe,
    decoyGroup,
    0,
    1.25,
    0,
    false
  );
  mk(
    createRoundedBoxGeometry(0.38, 0.34, 0.38, 0.08, 2),
    materials.decoyWireframe,
    decoyGroup,
    0,
    1.92,
    0,
    false
  );
  for (const s of [-1, 1]) {
    mk(
      new THREE.CylinderGeometry(0.12, 0.1, 0.72, 8),
      materials.decoyWireframe,
      decoyGroup,
      s * 0.52,
      1.22,
      0,
      false
    );
    mk(
      new THREE.CylinderGeometry(0.14, 0.11, 0.82, 8),
      materials.decoyWireframe,
      decoyGroup,
      s * 0.2,
      0.45,
      0,
      false
    );
  }

  const currentPose: Record<string, number> = { ...DEFAULT_POSE };

  return {
    root,
    body,
    hips,
    spine,
    neck,
    head,
    leftShoulder,
    leftElbow,
    rightShoulder,
    rightElbow,
    leftThigh,
    leftKnee,
    leftAnkle,
    rightThigh,
    rightKnee,
    rightAnkle,
    coreMesh,
    coreSprite,
    jetGroup,
    jetFlames,
    gauntletBlades,
    guardShieldMesh,
    decoyGroup,
    contactShadow,
    primaryArmorClone: armM,
    accentArmorClone: accM,
    coreMaterialClone: coreM,
    characterId,
    walkCyclePhase: 0,
    leadLeg: true,
    wasGrounded: true,
    landTimer: 0,
    landDuration: 0.22,
    dodgeTimer: 0,
    dodgeDir: { x: 0, z: 1 },
    punchAlt: false,
    currentAction: null,
    currentPose,
    lastDustTime: 0,
  };
}

export const buildArticulatedFighter = buildFighterRig;

const UPPER_POSE_KEYS: PoseKey[] = [
  'sx',
  'sy',
  'sz',
  'nx',
  'ny',
  'la',
  'lz',
  'le',
  'ra',
  'rz',
  're',
  'glow',
];
const LEG_POSE_KEYS = new Set(['ll', 'lw', 'lk', 'rl', 'rw', 'rk']);

/**
 * Updates full mechanical character kinematics, IK leg placement, jet thrusters, and phase-synced combat animations
 */
export function updateFighterRigAnimation(
  rig: ArticulatedFighterRig,
  fighter: FighterState,
  dt: number,
  elapsedTime: number,
  groundY = 0,
  onSpawnDust?: DustCallback
): void {
  const heightAboveGround = fighter.y - groundY;
  const isGrounded = heightAboveGround <= 0.05;
  const horizSpeed = Math.hypot(fighter.vx, fighter.vz);
  const isMoving = horizSpeed > 0.15;

  // Detect landing impact to trigger crouch land pose
  if (isGrounded && !rig.wasGrounded) {
    rig.landDuration = horizSpeed > 3 ? 0.14 : 0.24;
    rig.landTimer = rig.landDuration;
    rig.leadLeg = !rig.leadLeg;
    if (onSpawnDust) {
      onSpawnDust(fighter.x, groundY + 0.1, fighter.z, 1.4, 0xd9c9a8);
    }
  }
  rig.wasGrounded = isGrounded;

  // Track root position and smooth facing rotation
  rig.root.position.set(fighter.x, Math.max(fighter.y, -10), fighter.z);
  rig.root.rotation.y = fighter.facingAngle;

  // Ground shadow projection on actual surface below fighter
  rig.contactShadow.position.set(0, Math.max(-5, groundY + 0.03 - fighter.y), 0);
  const shadowOpacity = 0.42 * clamp(1.0 - Math.max(0, heightAboveGround) / 3.0, 0, 1);
  (rig.contactShadow.material as THREE.MeshBasicMaterial).opacity = shadowOpacity;

  // Determine local movement components in character frame
  const forwardX = Math.sin(fighter.facingAngle);
  const forwardZ = Math.cos(fighter.facingAngle);
  const leftX = Math.cos(fighter.facingAngle);
  const leftZ = -Math.sin(fighter.facingAngle);

  const localForward = fighter.vx * forwardX + fighter.vz * forwardZ;
  const localLeft = fighter.vx * leftX + fighter.vz * leftZ;

  const maxSpeed = 8.5;
  const mx = clamp(localLeft / maxSpeed, -1, 1);
  const mz = clamp(localForward / maxSpeed, -1, 1);
  const mag = clamp(Math.hypot(mx, mz), 0, 1);

  if (isGrounded && fighter.action !== 'dodge') {
    const cycleSpeed =
      ((horizSpeed / 0.85) * (0.5 - 0.15 * mag)) / (2 * Math.max(0.22, 0.22 + 0.28 * mag));
    rig.walkCyclePhase += dt * cycleSpeed;
  }

  // Trigger footstep dust puffs on ground contact
  if (
    isGrounded &&
    isMoving &&
    onSpawnDust &&
    elapsedTime - rig.lastDustTime > 0.26 / Math.max(1, mag * 1.5)
  ) {
    rig.lastDustTime = elapsedTime;
    const side = Math.sin(rig.walkCyclePhase * Math.PI * 2) > 0 ? 0.24 : -0.24;
    const stepWorldX = fighter.x + leftX * side;
    const stepWorldZ = fighter.z + leftZ * side;
    onSpawnDust(stepWorldX, groundY + 0.06, stepWorldZ, 0.55 * Math.max(0.6, mag), 0xd9c9a8);
  }

  // Map simulation action & currentAttack to animation clip
  let targetActionName: string | null = null;
  if (fighter.hp <= 0) {
    targetActionName = 'die';
  } else if (fighter.action === 'guard_break' || fighter.action === 'parry_stun') {
    targetActionName = 'knock';
  } else if (fighter.action === 'hitstun' || fighter.action === 'blockstun') {
    targetActionName = 'hit';
  } else if (
    fighter.action === 'attack_windup' ||
    fighter.action === 'attack_active' ||
    fighter.action === 'attack_recovery'
  ) {
    switch (fighter.currentAttack) {
      case 'light_1':
        targetActionName = 'punchR';
        break;
      case 'light_2':
        targetActionName = 'punchL';
        break;
      case 'light_3':
      case 'dash_strike':
        targetActionName = 'punchFinisher';
        break;
      case 'heavy':
      case 'aerial_slam':
        targetActionName = 'brk';
        break;
      case 'execution':
        targetActionName = 'execute';
        break;
      case 'ability':
        targetActionName = fighter.characterId === 'volt' ? 'shock' : 'grav';
        break;
      default:
        targetActionName = 'punchR';
        break;
    }
  } else if (!isGrounded && heightAboveGround < -1.0) {
    targetActionName = 'fall';
  }

  if (targetActionName) {
    const def = ACTION_TABLE[targetActionName] || ACTION_TABLE.hit;
    if (!rig.currentAction || rig.currentAction.name !== targetActionName) {
      rig.currentAction = {
        name: targetActionName,
        duration: def.duration,
        mask: def.mask,
        loop: def.loop,
        time: 0,
        fired: false,
      };
    } else {
      rig.currentAction.time += dt;
      if (rig.currentAction.time >= rig.currentAction.duration && rig.currentAction.loop) {
        rig.currentAction.time -= rig.currentAction.duration;
      }
    }
  } else if (rig.currentAction && !rig.currentAction.loop) {
    rig.currentAction = null;
  }

  // Base pose selection
  let basePose: Record<PoseKey, number>;

  if (fighter.action === 'dodge') {
    rig.dodgeTimer = Math.max(0, rig.dodgeTimer - dt);
    basePose = calculateDodgePose(mx, mz);
  } else if (!isGrounded) {
    basePose = calculateAirPose(fighter.vy, horizSpeed, rig.leadLeg);
  } else if (rig.landTimer > 0) {
    rig.landTimer -= dt;
    const landU = smoothstep(clamp(rig.landTimer / rig.landDuration, 0, 1));
    const locoP = calculateLocomotionPose(mx, mz, mag, rig.walkCyclePhase, elapsedTime);
    basePose = { ...locoP };
    for (const k in LAND_POSE) {
      const key = k as PoseKey;
      basePose[key] = (locoP[key] ?? 0) * (1 - landU) + (LAND_POSE[key] ?? 0) * landU;
    }
  } else {
    basePose = calculateLocomotionPose(mx, mz, mag, rig.walkCyclePhase, elapsedTime);
  }

  // Guard / Parry stance overlay
  if (fighter.action === 'block' || fighter.action === 'parry_window') {
    basePose.la = 1.42;
    basePose.ra = 1.42;
    basePose.le = 1.48;
    basePose.re = 1.48;
    basePose.lz = -0.32;
    basePose.rz = -0.32;
    basePose.sx = 0.2;
    basePose.py = -0.1;
    basePose.glow = fighter.action === 'parry_window' ? 2.0 : 0.9;
  }

  // Blend overlay action keyframes — synchronized to exact simulation phase for attacks!
  if (rig.currentAction) {
    const def = ACTION_TABLE[rig.currentAction.name];
    if (def) {
      let u = clamp(rig.currentAction.time / def.duration, 0, 1);

      // Phase-lock attack animation progress directly to windup -> active -> recovery
      const phaseProgress =
        fighter.actionDurationMs > 0
          ? clamp(fighter.actionTimerMs / fighter.actionDurationMs, 0, 1)
          : 0.5;
      if (fighter.action === 'attack_windup') {
        u = phaseProgress * 0.34;
      } else if (fighter.action === 'attack_active') {
        u = 0.34 + phaseProgress * 0.36;
      } else if (fighter.action === 'attack_recovery') {
        u = 0.7 + phaseProgress * 0.3;
      }

      const actionPose = sampleActionPose(def, u);

      if (def.mask === 'full') {
        basePose = actionPose;
      } else {
        const blendWeight = smoothstep(
          clamp(
            Math.min(
              rig.currentAction.time / 0.07,
              (def.duration - rig.currentAction.time) / 0.1 + (def.loop ? 9 : 0)
            ),
            0,
            1
          )
        );
        for (const k of UPPER_POSE_KEYS) {
          basePose[k] = basePose[k] + (actionPose[k] - basePose[k]) * blendWeight;
        }
      }
    }
  }

  // Snappy, fluid exponential blending toward target pose
  const isAttackPhase =
    fighter.action === 'attack_windup' ||
    fighter.action === 'attack_active' ||
    fighter.action === 'attack_recovery';
  const rate = isAttackPhase ? 34 : rig.currentAction?.mask === 'full' ? 26 : 19;
  const kBlend = 1 - Math.exp(-rate * dt);
  const kLeg = 1 - Math.exp(-rate * 2.0 * dt);

  for (const k of POSE_KEYS) {
    const factor = LEG_POSE_KEYS.has(k) ? kLeg : kBlend;
    rig.currentPose[k] =
      (rig.currentPose[k] ?? 0) + (basePose[k] - (rig.currentPose[k] ?? 0)) * factor;
  }

  const p = rig.currentPose;

  // Apply transforms to hierarchical model bones (heroic 1.04 scale)
  rig.root.scale.setScalar(1.04 * Math.max(0.01, p.sc));
  rig.body.rotation.x = p.rp;
  rig.body.position.y = BASE_HEIGHT + p.py;

  rig.hips.rotation.set(p.hx, p.hy, -p.hz);
  rig.spine.rotation.set(p.sx, p.sy, -p.sz);
  rig.neck.rotation.set(p.nx, p.ny, 0);

  rig.leftShoulder.rotation.set(-p.la, 0, 1 * (p.lz + 0.08));
  rig.leftElbow.rotation.x = -p.le;

  rig.rightShoulder.rotation.set(-p.ra, 0, -1 * (p.rz + 0.08));
  rig.rightElbow.rotation.x = -p.re;

  rig.leftThigh.rotation.set(-p.ll, 0, 1 * p.lw);
  rig.leftKnee.rotation.x = p.lk;
  rig.leftAnkle.rotation.x = p.ll - p.lk;

  rig.rightThigh.rotation.set(-p.rl, 0, -1 * p.rw);
  rig.rightKnee.rotation.x = p.rk;
  rig.rightAnkle.rotation.x = p.rl - p.rk;

  // Reactor core & twin plasma war-blades flare during attacks
  const isAttacking =
    fighter.action === 'attack_windup' || fighter.action === 'attack_active';
  const coreEmissive = clamp(2.2 + p.glow * 2.2 + (isAttacking ? 2.2 : 0), 0.5, 7.0);
  (rig.coreMesh.material as THREE.MeshStandardMaterial).emissiveIntensity = coreEmissive;
  rig.coreSprite.material.opacity = clamp(0.28 + p.glow * 0.25, 0.12, 1.0);

  const bladeLenScale = isAttacking ? 1.55 : 0.95;
  const bladeWidthScale = isAttacking ? 1.4 : 1.0;
  for (const blade of rig.gauntletBlades) {
    blade.scale.set(bladeWidthScale, bladeLenScale, bladeWidthScale);
  }

  // Jet thruster flames
  const jetVal = Math.max(
    p.jet,
    fighter.action === 'dodge' || fighter.action === 'sprint'
      ? 1.15
      : !isGrounded && fighter.vy > 0
        ? 0.85
        : 0
  );
  rig.jetGroup.visible = jetVal > 0.05;
  const jetScale = 0.45 + jetVal * (0.85 + 0.4 * Math.sin(elapsedTime * 42));
  rig.jetGroup.scale.set(1.1, jetScale, 1.1);

  // Holographic guard shield
  const isGuarding = fighter.action === 'block' || fighter.action === 'parry_window';
  rig.guardShieldMesh.visible = isGuarding;
  if (isGuarding) {
    (rig.guardShieldMesh.material as THREE.MeshBasicMaterial).opacity =
      0.2 + 0.1 * Math.sin(elapsedTime * 18);
  }

  // Hit flash & Hyper-Armor / Counter-Riposte indicator
  if (fighter.hitFlashMs > 0) {
    const flashNorm = clamp(fighter.hitFlashMs / 180, 0, 1);
    rig.primaryArmorClone.emissive.setHex(0xff9a3c);
    rig.primaryArmorClone.emissiveIntensity = flashNorm * 1.4;
    rig.accentArmorClone.emissive.setHex(0xffffff);
    rig.accentArmorClone.emissiveIntensity = flashNorm * 1.4;
  } else if (fighter.hyperArmorMs > 0) {
    const pulse = 0.55 + 0.35 * Math.sin(elapsedTime * 28);
    rig.primaryArmorClone.emissive.setHex(0xfbbf24);
    rig.primaryArmorClone.emissiveIntensity = pulse * 0.7;
    rig.accentArmorClone.emissive.setHex(0x38bdf8);
    rig.accentArmorClone.emissiveIntensity = pulse * 1.1;
  } else {
    rig.primaryArmorClone.emissive.setHex(0x000000);
    rig.primaryArmorClone.emissiveIntensity = 0;
    rig.accentArmorClone.emissive.setHex(0x000000);
    rig.accentArmorClone.emissiveIntensity = 0;
  }
}
