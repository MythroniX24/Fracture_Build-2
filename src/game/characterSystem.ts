import type { CharacterId, PartySize, WeaponId } from './config.ts';

export type BodyRegionId =
  | 'head'
  | 'neck'
  | 'chest'
  | 'back'
  | 'pelvis'
  | 'leftUpperArm'
  | 'rightUpperArm'
  | 'leftForearm'
  | 'rightForearm'
  | 'hands'
  | 'leftThigh'
  | 'rightThigh'
  | 'leftLowerLeg'
  | 'rightLowerLeg'
  | 'feet';

export interface BodyRegionSpec {
  id: BodyRegionId;
  label: string;
  shortLabel: string;
  group: 'upper' | 'arms' | 'lower';
  /** Dedicated non-overlapping UV island rectangle in [0..1] atlas coordinates */
  uvRect: {
    uMin: number;
    vMin: number;
    uMax: number;
    vMax: number;
  };
  /** Paired contralateral region for bilateral symmetry painting */
  mirrorRegionId: BodyRegionId;
}

export const BODY_REGION_ORDER: BodyRegionId[] = [
  'head',
  'neck',
  'chest',
  'back',
  'pelvis',
  'leftUpperArm',
  'rightUpperArm',
  'leftForearm',
  'rightForearm',
  'hands',
  'leftThigh',
  'rightThigh',
  'leftLowerLeg',
  'rightLowerLeg',
  'feet',
];

/**
 * 15 non-overlapping UV islands arranged in a 4x4 grid with safety padding
 * so strokes on one body region never bleed into adjacent UV islands.
 */
export const BODY_REGION_SPECS: Record<BodyRegionId, BodyRegionSpec> = {
  head: {
    id: 'head',
    label: 'Head & Face',
    shortLabel: 'Head',
    group: 'upper',
    uvRect: { uMin: 0.02, vMin: 0.77, uMax: 0.23, vMax: 0.98 },
    mirrorRegionId: 'head',
  },
  neck: {
    id: 'neck',
    label: 'Neck',
    shortLabel: 'Neck',
    group: 'upper',
    uvRect: { uMin: 0.27, vMin: 0.77, uMax: 0.48, vMax: 0.98 },
    mirrorRegionId: 'neck',
  },
  chest: {
    id: 'chest',
    label: 'Chest & Torso',
    shortLabel: 'Chest',
    group: 'upper',
    uvRect: { uMin: 0.52, vMin: 0.77, uMax: 0.73, vMax: 0.98 },
    mirrorRegionId: 'chest',
  },
  back: {
    id: 'back',
    label: 'Upper & Lower Back',
    shortLabel: 'Back',
    group: 'upper',
    uvRect: { uMin: 0.77, vMin: 0.77, uMax: 0.98, vMax: 0.98 },
    mirrorRegionId: 'back',
  },
  pelvis: {
    id: 'pelvis',
    label: 'Pelvis & Waist',
    shortLabel: 'Pelvis',
    group: 'upper',
    uvRect: { uMin: 0.02, vMin: 0.52, uMax: 0.23, vMax: 0.73 },
    mirrorRegionId: 'pelvis',
  },
  leftUpperArm: {
    id: 'leftUpperArm',
    label: 'Left Upper Arm',
    shortLabel: 'L.Arm',
    group: 'arms',
    uvRect: { uMin: 0.27, vMin: 0.52, uMax: 0.48, vMax: 0.73 },
    mirrorRegionId: 'rightUpperArm',
  },
  rightUpperArm: {
    id: 'rightUpperArm',
    label: 'Right Upper Arm',
    shortLabel: 'R.Arm',
    group: 'arms',
    uvRect: { uMin: 0.52, vMin: 0.52, uMax: 0.73, vMax: 0.73 },
    mirrorRegionId: 'leftUpperArm',
  },
  leftForearm: {
    id: 'leftForearm',
    label: 'Left Forearm',
    shortLabel: 'L.Forearm',
    group: 'arms',
    uvRect: { uMin: 0.77, vMin: 0.52, uMax: 0.98, vMax: 0.73 },
    mirrorRegionId: 'rightForearm',
  },
  rightForearm: {
    id: 'rightForearm',
    label: 'Right Forearm',
    shortLabel: 'R.Forearm',
    group: 'arms',
    uvRect: { uMin: 0.02, vMin: 0.27, uMax: 0.23, vMax: 0.48 },
    mirrorRegionId: 'leftForearm',
  },
  hands: {
    id: 'hands',
    label: 'Hands & Knuckles',
    shortLabel: 'Hands',
    group: 'arms',
    uvRect: { uMin: 0.27, vMin: 0.27, uMax: 0.48, vMax: 0.48 },
    mirrorRegionId: 'hands',
  },
  leftThigh: {
    id: 'leftThigh',
    label: 'Left Thigh',
    shortLabel: 'L.Thigh',
    group: 'lower',
    uvRect: { uMin: 0.52, vMin: 0.27, uMax: 0.73, vMax: 0.48 },
    mirrorRegionId: 'rightThigh',
  },
  rightThigh: {
    id: 'rightThigh',
    label: 'Right Thigh',
    shortLabel: 'R.Thigh',
    group: 'lower',
    uvRect: { uMin: 0.77, vMin: 0.27, uMax: 0.98, vMax: 0.48 },
    mirrorRegionId: 'leftThigh',
  },
  leftLowerLeg: {
    id: 'leftLowerLeg',
    label: 'Left Lower Leg',
    shortLabel: 'L.Shin',
    group: 'lower',
    uvRect: { uMin: 0.02, vMin: 0.02, uMax: 0.23, vMax: 0.23 },
    mirrorRegionId: 'rightLowerLeg',
  },
  rightLowerLeg: {
    id: 'rightLowerLeg',
    label: 'Right Lower Leg',
    shortLabel: 'R.Shin',
    group: 'lower',
    uvRect: { uMin: 0.27, vMin: 0.02, uMax: 0.48, vMax: 0.23 },
    mirrorRegionId: 'leftLowerLeg',
  },
  feet: {
    id: 'feet',
    label: 'Feet & Boots',
    shortLabel: 'Feet',
    group: 'lower',
    uvRect: { uMin: 0.52, vMin: 0.02, uMax: 0.73, vMax: 0.23 },
    mirrorRegionId: 'feet',
  },
};

export type CharacterPoseId = 'idle' | 'walk' | 'run' | 'inspect' | 'salute' | 'victory';
export type EquipmentSlotId = 'headgear' | 'backgear' | 'shoulders' | 'chestRig';

export interface CharacterDefinition {
  id: CharacterId;
  name: string;
  codename: string;
  role: string;
  description: string;
  unlockedByDefault: boolean;
  unlockRequirementText?: string;
  /** Shared UV layout identifier so custom paint designs can transfer across compatible humanoids */
  uvLayoutId: 'chameleon_humanoid_v1';
  baseWhiteHex: number;
  baseRoughness: number;
  baseMetalness: number;
  accentTrimHex: number;
  proportions: {
    heightScale: number;
    shoulderWidth: number;
    torsoWidth: number;
    headScale: number;
    limbThickness: number;
  };
  supportedRegions: BodyRegionId[];
  supportedEquipment: EquipmentSlotId[];
  defaultEquipment: EquipmentSlotId[];
  signatureWeapon: WeaponId;
  previewCameraDistance: number;
}

export const CHARACTER_ORDER: CharacterId[] = ['volt', 'rift', 'kestrel', 'chroma'];

export const CHARACTER_ROSTER: Record<CharacterId, CharacterDefinition> = {
  volt: {
    id: 'volt',
    name: 'VOLT-01',
    codename: 'Poly Blank · Agile Frame',
    role: 'Recon Striker',
    description:
      'Pure-white faceted low-poly humanoid figure built for full-body custom artwork and high-mobility flanking.',
    unlockedByDefault: true,
    uvLayoutId: 'chameleon_humanoid_v1',
    baseWhiteHex: 0xffffff,
    baseRoughness: 0.52,
    baseMetalness: 0.03,
    accentTrimHex: 0x38bdf8,
    proportions: {
      heightScale: 1.0,
      shoulderWidth: 0.25,
      torsoWidth: 1.0,
      headScale: 1.0,
      limbThickness: 1.0,
    },
    supportedRegions: BODY_REGION_ORDER,
    supportedEquipment: ['headgear', 'backgear', 'shoulders', 'chestRig'],
    defaultEquipment: [],
    signatureWeapon: 'm4a1',
    previewCameraDistance: 3.1,
  },
  rift: {
    id: 'rift',
    name: 'RIFT-02',
    codename: 'Poly Blank · Tactical Frame',
    role: 'Assault Vanguard',
    description:
      'Clean matte-white sculptural low-poly humanoid with broad chest and flared forearm canvases for bold artwork.',
    unlockedByDefault: true,
    uvLayoutId: 'chameleon_humanoid_v1',
    baseWhiteHex: 0xffffff,
    baseRoughness: 0.54,
    baseMetalness: 0.04,
    accentTrimHex: 0xf59e0b,
    proportions: {
      heightScale: 1.02,
      shoulderWidth: 0.27,
      torsoWidth: 1.06,
      headScale: 1.02,
      limbThickness: 1.05,
    },
    supportedRegions: BODY_REGION_ORDER,
    supportedEquipment: ['headgear', 'backgear', 'shoulders', 'chestRig'],
    defaultEquipment: [],
    signatureWeapon: 'ak47',
    previewCameraDistance: 3.15,
  },
  kestrel: {
    id: 'kestrel',
    name: 'KESTREL-03',
    codename: 'Poly Blank · Precision Frame',
    role: 'Marksman Specialist',
    description:
      'Tall, sleek pure-white faceted humanoid silhouette with elongated limbs and smooth contours for full-body patterns.',
    unlockedByDefault: true,
    uvLayoutId: 'chameleon_humanoid_v1',
    baseWhiteHex: 0xffffff,
    baseRoughness: 0.48,
    baseMetalness: 0.03,
    accentTrimHex: 0x10b981,
    proportions: {
      heightScale: 1.04,
      shoulderWidth: 0.24,
      torsoWidth: 0.95,
      headScale: 0.98,
      limbThickness: 0.94,
    },
    supportedRegions: BODY_REGION_ORDER,
    supportedEquipment: ['headgear', 'backgear', 'shoulders', 'chestRig'],
    defaultEquipment: [],
    signatureWeapon: 'awp',
    previewCameraDistance: 3.2,
  },
  chroma: {
    id: 'chroma',
    name: 'PRISM-04',
    codename: 'Poly Blank · Heavy Frame',
    role: 'Heavy Breacher',
    description:
      'Sturdy pure-white low-poly humanoid frame with expanded forearm, thigh, and torso surface area for multi-layer body art.',
    unlockedByDefault: true,
    uvLayoutId: 'chameleon_humanoid_v1',
    baseWhiteHex: 0xffffff,
    baseRoughness: 0.52,
    baseMetalness: 0.04,
    accentTrimHex: 0xa855f7,
    proportions: {
      heightScale: 1.01,
      shoulderWidth: 0.28,
      torsoWidth: 1.1,
      headScale: 1.04,
      limbThickness: 1.08,
    },
    supportedRegions: BODY_REGION_ORDER,
    supportedEquipment: ['headgear', 'backgear', 'shoulders', 'chestRig'],
    defaultEquipment: [],
    signatureWeapon: 'spas12',
    previewCameraDistance: 3.2,
  },
};

/**
 * Checks whether a saved paint design is compatible with the target character's UV layout.
 */
export function isDesignCompatibleWithCharacter(
  designUvLayoutId: string,
  characterId: CharacterId
): boolean {
  const charDef = CHARACTER_ROSTER[characterId];
  if (!charDef) return false;
  return designUvLayoutId === charDef.uvLayoutId;
}

/**
 * Maps local [0..1] mesh UVs into the dedicated non-overlapping UV island rectangle
 * for the specified body region.
 */
export function mapLocalUvToRegionAtlas(
  localU: number,
  localV: number,
  regionId: BodyRegionId
): { u: number; v: number } {
  const spec = BODY_REGION_SPECS[regionId];
  const clampedU = Math.max(0.02, Math.min(0.98, localU));
  const clampedV = Math.max(0.02, Math.min(0.98, localV));
  const u = spec.uvRect.uMin + clampedU * (spec.uvRect.uMax - spec.uvRect.uMin);
  const v = spec.uvRect.vMin + clampedV * (spec.uvRect.vMax - spec.uvRect.vMin);
  return { u, v };
}

/**
 * Finds which BodyRegionId owns a given UV coordinate on the 0..1 atlas.
 */
export function findBodyRegionAtUV(u: number, v: number): BodyRegionId | null {
  for (const id of BODY_REGION_ORDER) {
    const r = BODY_REGION_SPECS[id].uvRect;
    if (u >= r.uMin - 0.005 && u <= r.uMax + 0.005 && v >= r.vMin - 0.005 && v <= r.vMax + 0.005) {
      return id;
    }
  }
  return null;
}

/**
 * Computes the horizontally mirrored UV coordinate (and contralateral region)
 * for bilateral symmetry painting on the 3D character body.
 */
export function getSymmetryMirroredUV(
  u: number,
  v: number,
  regionId?: BodyRegionId | null
): { u: number; v: number; regionId: BodyRegionId | null } {
  const resolvedRegion = regionId || findBodyRegionAtUV(u, v);
  if (!resolvedRegion) {
    return { u: 1 - u, v, regionId: null };
  }
  const sourceSpec = BODY_REGION_SPECS[resolvedRegion];
  const targetRegion = sourceSpec.mirrorRegionId;
  const targetSpec = BODY_REGION_SPECS[targetRegion];

  const localU =
    (u - sourceSpec.uvRect.uMin) /
    Math.max(1e-5, sourceSpec.uvRect.uMax - sourceSpec.uvRect.uMin);
  const localV =
    (v - sourceSpec.uvRect.vMin) /
    Math.max(1e-5, sourceSpec.uvRect.vMax - sourceSpec.uvRect.vMin);

  const mirroredLocalU = 1.0 - Math.max(0, Math.min(1, localU));
  const mirroredU =
    targetSpec.uvRect.uMin +
    mirroredLocalU * (targetSpec.uvRect.uMax - targetSpec.uvRect.uMin);
  const mirroredV =
    targetSpec.uvRect.vMin +
    Math.max(0, Math.min(1, localV)) * (targetSpec.uvRect.vMax - targetSpec.uvRect.vMin);

  return {
    u: mirroredU,
    v: mirroredV,
    regionId: targetRegion,
  };
}

// ============================================================================
// PARTY SIZE & FRIENDS / COSMETIC INVENTORY / MISSIONS / SHOP SYSTEM
// ============================================================================

export const PARTY_SIZE_LIMITS: Record<PartySize, number> = {
  solo: 1,
  duo: 2,
  squad: 4,
};

export interface PartyMemberSlot {
  id: string;
  username: string;
  characterId: CharacterId;
  level: number;
  isLeader: boolean;
  ready: boolean;
  isLocalPlayer: boolean;
}

export interface FriendEntry {
  id: string;
  username: string;
  status: 'online' | 'in_game' | 'offline';
  statusDetail: string;
  level: number;
  favoriteChar: CharacterId;
}

export interface FriendRequestEntry {
  id: string;
  username: string;
  level: number;
  sentAgo: string;
}

export function canAddPartyMember(
  currentPartyOrCount: readonly unknown[] | number,
  partySize: PartySize
): boolean {
  const count =
    typeof currentPartyOrCount === 'number'
      ? currentPartyOrCount
      : currentPartyOrCount.length;
  return count < PARTY_SIZE_LIMITS[partySize];
}

export function enforcePartySizeLimit<T>(
  currentParty: T[],
  partySize: PartySize
): T[] {
  const max = PARTY_SIZE_LIMITS[partySize];
  if (currentParty.length <= max) return currentParty;
  return currentParty.slice(0, max);
}

export interface CosmeticInventoryItem {
  id: string;
  name: string;
  category: 'accessory' | 'weapon_skin' | 'emote' | 'stencil';
  rarity: 'Standard' | 'Tactical' | 'Prototype';
  description: string;
  previewHex: string;
  equipmentSlot?: EquipmentSlotId;
  poseId?: CharacterPoseId;
  owned: boolean;
  priceCredits?: number;
  isDevSample?: boolean;
}

export const INITIAL_COSMETIC_INVENTORY: CosmeticInventoryItem[] = [
  {
    id: 'eq_visor_band',
    name: 'Optic Visor Band',
    category: 'accessory',
    rarity: 'Tactical',
    description: 'Sleek wrap-around optical visor attached to the head mount.',
    previewHex: '#38bdf8',
    equipmentSlot: 'headgear',
    owned: true,
  },
  {
    id: 'eq_recon_pack',
    name: 'Compact Thruster Pack',
    category: 'accessory',
    rarity: 'Tactical',
    description: 'Lightweight dorsal telemetry unit mounted on the upper back.',
    previewHex: '#64748b',
    equipmentSlot: 'backgear',
    owned: true,
  },
  {
    id: 'eq_shoulder_guards',
    name: 'Angular Pauldrons',
    category: 'accessory',
    rarity: 'Standard',
    description: 'Contoured shoulder plates that frame upper-arm paintwork.',
    previewHex: '#f59e0b',
    equipmentSlot: 'shoulders',
    owned: true,
  },
  {
    id: 'eq_chest_harness',
    name: 'Minimalist Chest Rig',
    category: 'accessory',
    rarity: 'Standard',
    description: 'Low-profile tactical harness that leaves torso art visible.',
    previewHex: '#10b981',
    equipmentSlot: 'chestRig',
    owned: true,
  },
  {
    id: 'emote_idle',
    name: 'Studio Neutral Stance',
    category: 'emote',
    rarity: 'Standard',
    description: 'Clean sculptural stance showcasing the pure-white low-poly silhouette.',
    previewHex: '#94a3b8',
    poseId: 'idle',
    owned: true,
  },
  {
    id: 'emote_walk',
    name: 'Tactical Patrol Stride',
    category: 'emote',
    rarity: 'Standard',
    description: 'Balanced walking gait with natural hip sway and arm swing.',
    previewHex: '#38bdf8',
    poseId: 'walk',
    owned: true,
  },
  {
    id: 'emote_run',
    name: 'Combat Sprint Cycle',
    category: 'emote',
    rarity: 'Tactical',
    description: 'Dynamic forward-leaning sprint cycle with high knee drive.',
    previewHex: '#f97316',
    poseId: 'run',
    owned: true,
  },
  {
    id: 'emote_inspect',
    name: 'Weapon Calibration',
    category: 'emote',
    rarity: 'Tactical',
    description: 'Raises and inspects the equipped primary firearm.',
    previewHex: '#38bdf8',
    poseId: 'inspect',
    owned: true,
  },
  {
    id: 'emote_salute',
    name: 'Squad Salute Gesture',
    category: 'emote',
    rarity: 'Tactical',
    description: 'Crisp two-finger tactical salute to party members.',
    previewHex: '#f59e0b',
    poseId: 'salute',
    owned: true,
  },
  {
    id: 'emote_victory',
    name: 'Apex Victory Pose',
    category: 'emote',
    rarity: 'Prototype',
    description: 'Heroic raised-arm celebration stance.',
    previewHex: '#10b981',
    poseId: 'victory',
    owned: true,
  },
  {
    id: 'wskin_arctic_white',
    name: 'Poly Pure White Finish',
    category: 'weapon_skin',
    rarity: 'Tactical',
    description: 'Matches firearm receiver to the pure-white sculptural humanoid finish.',
    previewHex: '#f8fafc',
    owned: true,
  },
  {
    id: 'wskin_crimson_pulse',
    name: 'Crimson Anodized Finish',
    category: 'weapon_skin',
    rarity: 'Prototype',
    description: 'Matte crimson receiver trim with carbon barrel accents.',
    previewHex: '#ef4444',
    owned: false,
    priceCredits: 1200,
    isDevSample: true,
  },
  {
    id: 'wskin_cobalt_grid',
    name: 'Cobalt Vector Finish',
    category: 'weapon_skin',
    rarity: 'Prototype',
    description: 'Deep cobalt metallic finish for all 6 tactical weapons.',
    previewHex: '#3b82f6',
    owned: false,
    priceCredits: 1500,
    isDevSample: true,
  },
];
