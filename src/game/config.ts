export type WeaponId = 'm4a1' | 'ak47' | 'mp5' | 'spas12' | 'awp' | 'deagle';
export type CharacterId = 'volt' | 'rift';
export type ArenaId = 'foundry_arena' | 'iron_fortress' | 'overgrown_colossus';
export type GameMode = 'bot' | 'training' | 'multiplayer';
export type BotDifficulty = 'easy' | 'normal' | 'hard';
export type ScreenState =
  | 'main_menu'
  | 'mode_select'
  | 'character_select'
  | 'arena_select'
  | 'match_settings'
  | 'multiplayer_lobby'
  | 'countdown'
  | 'combat'
  | 'paused'
  | 'match_result';

export interface WeaponSpec {
  id: WeaponId;
  slot: number; // 1 to 6
  name: string;
  shortName: string;
  category: 'Assault Rifle' | 'Submachine Gun' | 'Shotgun' | 'Sniper Rifle' | 'Sidearm';
  damage: number;
  headshotMultiplier: number;
  rpm: number;
  fireIntervalMs: number;
  magSize: number;
  reserveMax: number;
  reloadTimeMs: number;
  pellets: number;
  hipSpreadDeg: number;
  adsSpreadDeg: number;
  adsFov: number;
  recoilPitchDeg: number;
  recoilYawDeg: number;
  maxRange: number;
  autoFire: boolean;
  moveSpeedMultiplier: number;
  soundId:
    | 'shot_m4a1'
    | 'shot_ak47'
    | 'shot_mp5'
    | 'shot_spas12'
    | 'shot_awp'
    | 'shot_deagle';
  bodyColorHex: number;
  accentColorHex: number;
}

export const WEAPON_ORDER: WeaponId[] = [
  'm4a1',
  'ak47',
  'mp5',
  'spas12',
  'awp',
  'deagle',
];

export const WEAPON_REGISTRY: Record<WeaponId, WeaponSpec> = {
  m4a1: {
    id: 'm4a1',
    slot: 1,
    name: 'M4A1 Carbine',
    shortName: 'M4A1',
    category: 'Assault Rifle',
    damage: 28,
    headshotMultiplier: 1.9,
    rpm: 650,
    fireIntervalMs: Math.round(60000 / 650),
    magSize: 30,
    reserveMax: 150,
    reloadTimeMs: 1750,
    pellets: 1,
    hipSpreadDeg: 1.6,
    adsSpreadDeg: 0.25,
    adsFov: 46,
    recoilPitchDeg: 0.65,
    recoilYawDeg: 0.22,
    maxRange: 145,
    autoFire: true,
    moveSpeedMultiplier: 0.96,
    soundId: 'shot_m4a1',
    bodyColorHex: 0x26292e,
    accentColorHex: 0x525866,
  },
  ak47: {
    id: 'ak47',
    slot: 2,
    name: 'AK-47 Heavy',
    shortName: 'AK-47',
    category: 'Assault Rifle',
    damage: 36,
    headshotMultiplier: 2.1,
    rpm: 560,
    fireIntervalMs: Math.round(60000 / 560),
    magSize: 30,
    reserveMax: 150,
    reloadTimeMs: 1950,
    pellets: 1,
    hipSpreadDeg: 2.1,
    adsSpreadDeg: 0.35,
    adsFov: 48,
    recoilPitchDeg: 0.92,
    recoilYawDeg: 0.32,
    maxRange: 150,
    autoFire: true,
    moveSpeedMultiplier: 0.93,
    soundId: 'shot_ak47',
    bodyColorHex: 0x2b2d31,
    accentColorHex: 0x6e472b,
  },
  mp5: {
    id: 'mp5',
    slot: 3,
    name: 'MP5-K Tactical',
    shortName: 'MP5-K',
    category: 'Submachine Gun',
    damage: 21,
    headshotMultiplier: 1.75,
    rpm: 860,
    fireIntervalMs: Math.round(60000 / 860),
    magSize: 35,
    reserveMax: 175,
    reloadTimeMs: 1450,
    pellets: 1,
    hipSpreadDeg: 1.35,
    adsSpreadDeg: 0.3,
    adsFov: 52,
    recoilPitchDeg: 0.45,
    recoilYawDeg: 0.18,
    maxRange: 105,
    autoFire: true,
    moveSpeedMultiplier: 1.04,
    soundId: 'shot_mp5',
    bodyColorHex: 0x1f2328,
    accentColorHex: 0x454c56,
  },
  spas12: {
    id: 'spas12',
    slot: 4,
    name: 'SPAS-12 Combat',
    shortName: 'SPAS-12',
    category: 'Shotgun',
    damage: 19,
    headshotMultiplier: 1.5,
    rpm: 105,
    fireIntervalMs: Math.round(60000 / 105),
    magSize: 8,
    reserveMax: 48,
    reloadTimeMs: 2100,
    pellets: 8,
    hipSpreadDeg: 5.2,
    adsSpreadDeg: 3.1,
    adsFov: 55,
    recoilPitchDeg: 2.3,
    recoilYawDeg: 0.45,
    maxRange: 65,
    autoFire: false,
    moveSpeedMultiplier: 0.95,
    soundId: 'shot_spas12',
    bodyColorHex: 0x292c32,
    accentColorHex: 0x5c626d,
  },
  awp: {
    id: 'awp',
    slot: 5,
    name: 'AWP Magnum',
    shortName: 'AWP',
    category: 'Sniper Rifle',
    damage: 115,
    headshotMultiplier: 2.5,
    rpm: 52,
    fireIntervalMs: Math.round(60000 / 52),
    magSize: 5,
    reserveMax: 30,
    reloadTimeMs: 2450,
    pellets: 1,
    hipSpreadDeg: 3.8,
    adsSpreadDeg: 0.03,
    adsFov: 22,
    recoilPitchDeg: 3.1,
    recoilYawDeg: 0.2,
    maxRange: 220,
    autoFire: false,
    moveSpeedMultiplier: 0.88,
    soundId: 'shot_awp',
    bodyColorHex: 0x364037,
    accentColorHex: 0x1c2024,
  },
  deagle: {
    id: 'deagle',
    slot: 6,
    name: 'Desert Eagle .50',
    shortName: 'DEAGLE',
    category: 'Sidearm',
    damage: 54,
    headshotMultiplier: 2.2,
    rpm: 240,
    fireIntervalMs: Math.round(60000 / 240),
    magSize: 9,
    reserveMax: 54,
    reloadTimeMs: 1350,
    pellets: 1,
    hipSpreadDeg: 1.4,
    adsSpreadDeg: 0.18,
    adsFov: 54,
    recoilPitchDeg: 1.55,
    recoilYawDeg: 0.25,
    maxRange: 120,
    autoFire: false,
    moveSpeedMultiplier: 1.06,
    soundId: 'shot_deagle',
    bodyColorHex: 0x575b62,
    accentColorHex: 0x23262b,
  },
};

export interface MapBoxBlock {
  id: string;
  x: number;
  z: number;
  width: number;
  depth: number;
  height: number;
  kind: 'wall' | 'building' | 'container' | 'cover' | 'platform' | 'tower';
  colorHex: number;
  walkableTop?: boolean;
}

export interface ArenaCollider {
  id: string;
  x: number;
  z: number;
  radius: number;
  height: number;
  kind?: 'pillar' | 'column' | 'piston' | 'vent' | 'brazier';
}

export interface ArenaBreakablePropSpec {
  id: string;
  kind: 'crate' | 'barrel';
  x: number;
  z: number;
  rotY: number;
  radius: number;
  height: number;
  maxHp: number;
  explosiveRadius?: number;
  explosiveDamage?: number;
}

export type SurfaceMaterial = 'concrete' | 'metal';

export interface SurfaceZone {
  id: string;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  material: SurfaceMaterial;
  label?: string;
}

export interface ArenaDefinition {
  id: ArenaId;
  name: string;
  subtitle: string;
  description: string;
  bounds: {
    minX: number;
    maxX: number;
    minZ: number;
    maxZ: number;
    radius: number;
  };
  blocks: MapBoxBlock[];
  colliders: ArenaCollider[];
  breakableProps: ArenaBreakablePropSpec[];
  surfaceZones: SurfaceZone[];
  spawnPoints: { x: number; z: number }[];
  pickupSpots: { id: string; x: number; z: number; kind: 'ammo' | 'health' }[];
  ambientHex: number;
  fogHex: number;
}

export const TACTICAL_SURFACE_ZONES: SurfaceZone[] = [
  // South Firing Line Steel Grating Deck (directly in front of player spawn at z=20 for Training & Arena)
  {
    id: 'south_firing_deck',
    minX: -12,
    maxX: 12,
    minZ: 8.5,
    maxZ: 18.8,
    material: 'metal',
    label: 'South Firing Deck',
  },
  // Central Helipad / Tactical Steel Grating Platform
  {
    id: 'central_steel_deck',
    minX: -9.5,
    maxX: 9.5,
    minZ: -9.5,
    maxZ: 9.5,
    material: 'metal',
    label: 'Central Helipad Deck',
  },
  // West Hangar & Shipping Container Steel Bay
  {
    id: 'west_hangar_deck',
    minX: -40,
    maxX: -12,
    minZ: -18,
    maxZ: 18,
    material: 'metal',
    label: 'West Hangar Bay',
  },
  // East Hangar & Shipping Container Steel Bay
  {
    id: 'east_hangar_deck',
    minX: 12,
    maxX: 40,
    minZ: -18,
    maxZ: 18,
    material: 'metal',
    label: 'East Hangar Bay',
  },
  // North Watchtower Steel Catwalk Apron
  {
    id: 'north_tower_deck',
    minX: -12,
    maxX: 12,
    minZ: -50,
    maxZ: -30,
    material: 'metal',
    label: 'North Watchtower Deck',
  },
];

// Large 140m x 140m Clean Matte Tactical Compound ("Sector-09 Proving Grounds")
export const TACTICAL_COMPOUND_BLOCKS: MapBoxBlock[] = [
  // Central Twin Hangar Walls (with wide open combat lanes through center)
  { id: 'hangar_w_n', x: -14, z: -12, width: 3.2, depth: 14, height: 6.2, kind: 'building', colorHex: 0x3a3f47 },
  { id: 'hangar_w_s', x: -14, z: 12, width: 3.2, depth: 14, height: 6.2, kind: 'building', colorHex: 0x3a3f47 },
  { id: 'hangar_e_n', x: 14, z: -12, width: 3.2, depth: 14, height: 6.2, kind: 'building', colorHex: 0x3a3f47 },
  { id: 'hangar_e_s', x: 14, z: 12, width: 3.2, depth: 14, height: 6.2, kind: 'building', colorHex: 0x3a3f47 },

  // Central Low Tactical Cover Barriers (crouch / head-glitch cover)
  { id: 'cov_c1', x: 0, z: -6.5, width: 6.5, depth: 1.2, height: 1.3, kind: 'cover', colorHex: 0x525862 },
  { id: 'cov_c2', x: 0, z: 6.5, width: 6.5, depth: 1.2, height: 1.3, kind: 'cover', colorHex: 0x525862 },
  { id: 'cov_c3', x: -6.5, z: 0, width: 1.2, depth: 5.5, height: 1.3, kind: 'cover', colorHex: 0x525862 },
  { id: 'cov_c4', x: 6.5, z: 0, width: 1.2, depth: 5.5, height: 1.3, kind: 'cover', colorHex: 0x525862 },

  // North Complex & Watchtower Base
  { id: 'north_bldg_1', x: -24, z: -36, width: 14, depth: 8, height: 5.5, kind: 'building', colorHex: 0x353a42 },
  { id: 'north_bldg_2', x: 24, z: -36, width: 14, depth: 8, height: 5.5, kind: 'building', colorHex: 0x353a42 },
  { id: 'north_tower', x: 0, z: -46, width: 8, depth: 8, height: 8.5, kind: 'tower', colorHex: 0x2e333b },
  { id: 'north_cov_1', x: -10, z: -26, width: 5.5, depth: 1.3, height: 1.35, kind: 'cover', colorHex: 0x525862 },
  { id: 'north_cov_2', x: 10, z: -26, width: 5.5, depth: 1.3, height: 1.35, kind: 'cover', colorHex: 0x525862 },

  // South Complex & Watchtower Base
  { id: 'south_bldg_1', x: -24, z: 36, width: 14, depth: 8, height: 5.5, kind: 'building', colorHex: 0x353a42 },
  { id: 'south_bldg_2', x: 24, z: 36, width: 14, depth: 8, height: 5.5, kind: 'building', colorHex: 0x353a42 },
  { id: 'south_tower', x: 0, z: 46, width: 8, depth: 8, height: 8.5, kind: 'tower', colorHex: 0x2e333b },
  { id: 'south_cov_1', x: -10, z: 26, width: 5.5, depth: 1.3, height: 1.35, kind: 'cover', colorHex: 0x525862 },
  { id: 'south_cov_2', x: 10, z: 26, width: 5.5, depth: 1.3, height: 1.35, kind: 'cover', colorHex: 0x525862 },

  // West Shipping Container Yard (Flank Lanes)
  { id: 'cont_w1', x: -36, z: -14, width: 4.2, depth: 11, height: 3.4, kind: 'container', colorHex: 0x3b4942 },
  { id: 'cont_w2', x: -36, z: 14, width: 4.2, depth: 11, height: 3.4, kind: 'container', colorHex: 0x464d57 },
  { id: 'cont_w3', x: -48, z: 0, width: 4.2, depth: 12, height: 3.4, kind: 'container', colorHex: 0x3f444c },
  { id: 'cov_w1', x: -25, z: 0, width: 1.4, depth: 6.5, height: 1.35, kind: 'cover', colorHex: 0x525862 },

  // East Shipping Container Yard (Flank Lanes)
  { id: 'cont_e1', x: 36, z: -14, width: 4.2, depth: 11, height: 3.4, kind: 'container', colorHex: 0x464d57 },
  { id: 'cont_e2', x: 36, z: 14, width: 4.2, depth: 11, height: 3.4, kind: 'container', colorHex: 0x3b4942 },
  { id: 'cont_e3', x: 48, z: 0, width: 4.2, depth: 12, height: 3.4, kind: 'container', colorHex: 0x3f444c },
  { id: 'cov_e1', x: 25, z: 0, width: 1.4, depth: 6.5, height: 1.35, kind: 'cover', colorHex: 0x525862 },

  // Outer Corner Bunkers
  { id: 'bunker_nw', x: -46, z: -42, width: 10, depth: 10, height: 4.5, kind: 'building', colorHex: 0x32373f },
  { id: 'bunker_ne', x: 46, z: -42, width: 10, depth: 10, height: 4.5, kind: 'building', colorHex: 0x32373f },
  { id: 'bunker_sw', x: -46, z: 42, width: 10, depth: 10, height: 4.5, kind: 'building', colorHex: 0x32373f },
  { id: 'bunker_se', x: 46, z: 42, width: 10, depth: 10, height: 4.5, kind: 'building', colorHex: 0x32373f },
];

export const FOUNDRY_ARENA_DEFINITION: ArenaDefinition = {
  id: 'foundry_arena',
  name: 'SECTOR-09 COMPOUND',
  subtitle: '140m × 140m Tactical Proving Grounds',
  description:
    'Expansive open-air military compound featuring central twin hangars, shipping container yards, long sniper sightlines, and low concrete barricades.',
  bounds: {
    minX: -68,
    maxX: 68,
    minZ: -68,
    maxZ: 68,
    radius: 68,
  },
  blocks: TACTICAL_COMPOUND_BLOCKS,
  colliders: [
    { id: 'pil_nw', x: -20, z: -20, radius: 1.2, height: 5.5, kind: 'pillar' },
    { id: 'pil_ne', x: 20, z: -20, radius: 1.2, height: 5.5, kind: 'pillar' },
    { id: 'pil_sw', x: -20, z: 20, radius: 1.2, height: 5.5, kind: 'pillar' },
    { id: 'pil_se', x: 20, z: 20, radius: 1.2, height: 5.5, kind: 'pillar' },
  ],
  breakableProps: [
    { id: 'barrel_1', kind: 'barrel', x: -8, z: -15, rotY: 0, radius: 0.65, height: 1.4, maxHp: 45, explosiveRadius: 6.5, explosiveDamage: 65 },
    { id: 'barrel_2', kind: 'barrel', x: 8, z: -15, rotY: 0, radius: 0.65, height: 1.4, maxHp: 45, explosiveRadius: 6.5, explosiveDamage: 65 },
    { id: 'barrel_3', kind: 'barrel', x: -28, z: -8, rotY: 0, radius: 0.65, height: 1.4, maxHp: 45, explosiveRadius: 6.5, explosiveDamage: 65 },
    { id: 'barrel_4', kind: 'barrel', x: 28, z: 8, rotY: 0, radius: 0.65, height: 1.4, maxHp: 45, explosiveRadius: 6.5, explosiveDamage: 65 },
    { id: 'crate_1', kind: 'crate', x: -4, z: -18, rotY: 0.2, radius: 0.85, height: 1.3, maxHp: 60 },
    { id: 'crate_2', kind: 'crate', x: 4, z: 18, rotY: -0.3, radius: 0.85, height: 1.3, maxHp: 60 },
  ],
  surfaceZones: TACTICAL_SURFACE_ZONES,
  spawnPoints: [
    { x: 0, z: -34 },
    { x: -28, z: -24 },
    { x: 28, z: -24 },
    { x: -42, z: 0 },
    { x: 42, z: 0 },
    { x: -28, z: 24 },
    { x: 28, z: 24 },
    { x: -16, z: -44 },
    { x: 16, z: -44 },
    { x: 0, z: -56 },
  ],
  pickupSpots: [
    { id: 'pk_ammo_c', x: 0, z: 0, kind: 'ammo' },
    { id: 'pk_hp_w', x: -22, z: 0, kind: 'health' },
    { id: 'pk_hp_e', x: 22, z: 0, kind: 'health' },
    { id: 'pk_ammo_n', x: 0, z: -22, kind: 'ammo' },
    { id: 'pk_ammo_s', x: 0, z: 22, kind: 'ammo' },
  ],
  ambientHex: 0xd4dbe2,
  fogHex: 0xc8d2dc,
};

export const ARENA_REGISTRY: Record<ArenaId, ArenaDefinition> = {
  foundry_arena: FOUNDRY_ARENA_DEFINITION,
  iron_fortress: {
    ...FOUNDRY_ARENA_DEFINITION,
    id: 'iron_fortress',
    name: 'OUTPOST SIGMA',
    subtitle: 'Industrial Logistic Yard',
  },
  overgrown_colossus: {
    ...FOUNDRY_ARENA_DEFINITION,
    id: 'overgrown_colossus',
    name: 'GARRISON DELTA',
    subtitle: 'Long-Range Perimeter Base',
  },
};

// Kept minimal character metadata for backwards compatibility
export const CHARACTER_REGISTRY: Record<
  CharacterId,
  { id: CharacterId; name: string; title: string }
> = {
  volt: { id: 'volt', name: 'RANGER-01', title: 'Tactical Operator' },
  rift: { id: 'rift', name: 'HOSTILE', title: 'OpFor Unit' },
};

export const BOT_DIFFICULTIES: Record<
  BotDifficulty,
  {
    label: string;
    description: string;
    reactionIntervalMs: number;
    accuracy: number;
    moveSpeedMultiplier: number;
  }
> = {
  easy: {
    label: 'Recruit',
    description: 'Slower enemy reaction time and wider shot dispersion.',
    reactionIntervalMs: 520,
    accuracy: 0.42,
    moveSpeedMultiplier: 0.85,
  },
  normal: {
    label: 'Veteran',
    description: 'Balanced tactical squads that flank and use cover.',
    reactionIntervalMs: 340,
    accuracy: 0.65,
    moveSpeedMultiplier: 1.0,
  },
  hard: {
    label: 'Spec Ops',
    description: 'Fast target acquisition, tight burst accuracy, and aggressive pushing.',
    reactionIntervalMs: 210,
    accuracy: 0.85,
    moveSpeedMultiplier: 1.15,
  },
};

export type LoadoutPairId = 'pair_1' | 'pair_2' | 'pair_3';

export interface LoadoutPairOption {
  id: LoadoutPairId;
  weapons: [WeaponId, WeaponId];
}

export const LOADOUT_PAIRS: LoadoutPairOption[] = [
  {
    id: 'pair_1',
    weapons: ['m4a1', 'awp'],
  },
  {
    id: 'pair_2',
    weapons: ['ak47', 'spas12'],
  },
  {
    id: 'pair_3',
    weapons: ['mp5', 'deagle'],
  },
];

export const DEATHMATCH_DURATION_SECONDS = 300; // 5-minute Deathmatch

export interface KeyBindingsConfig {
  fire: string;
  ads: string;
  reload: string;
  jump: string;
  crouch: string;
  slide: string;
  sprint: string;
  nextWeapon: string;
}

export type HudButtonId =
  | 'joystick'
  | 'fire'
  | 'ads'
  | 'reload'
  | 'jump'
  | 'crouch'
  | 'slide'
  | 'weaponBar'
  | 'healthBar'
  | 'killCounter';

export interface HudButtonTransform {
  offsetX: number; // horizontal offset in px (-480 to 480)
  offsetY: number; // vertical offset in px (-480 to 480)
  scale: number; // scale multiplier (0.5 to 1.7)
  opacity: number; // opacity (0.15 to 1.0)
}

export type HudButtonsLayout = Record<HudButtonId, HudButtonTransform>;

export const DEFAULT_HUD_BUTTONS_LAYOUT: HudButtonsLayout = {
  joystick: { offsetX: 0, offsetY: 0, scale: 1.0, opacity: 0.92 },
  fire: { offsetX: 0, offsetY: 0, scale: 1.0, opacity: 0.96 },
  ads: { offsetX: 0, offsetY: 0, scale: 1.0, opacity: 0.92 },
  reload: { offsetX: 0, offsetY: 0, scale: 1.0, opacity: 0.92 },
  jump: { offsetX: 0, offsetY: 0, scale: 1.0, opacity: 0.92 },
  crouch: { offsetX: 0, offsetY: 0, scale: 1.0, opacity: 0.92 },
  slide: { offsetX: 0, offsetY: 0, scale: 1.0, opacity: 0.92 },
  weaponBar: { offsetX: 0, offsetY: 0, scale: 1.0, opacity: 0.96 },
  healthBar: { offsetX: 0, offsetY: 0, scale: 1.0, opacity: 0.96 },
  killCounter: { offsetX: 0, offsetY: 0, scale: 1.0, opacity: 0.95 },
};

export const HUD_LAYOUT_PRESETS: Record<
  'default' | 'claw' | 'compact' | 'large',
  { label: string; description: string; layout: HudButtonsLayout }
> = {
  default: {
    label: 'Standard',
    description: 'Balanced two-thumb FPS layout.',
    layout: { ...DEFAULT_HUD_BUTTONS_LAYOUT },
  },
  claw: {
    label: '4-Finger Claw',
    description: 'Elevated fire and scope controls.',
    layout: {
      joystick: { offsetX: 0, offsetY: -10, scale: 1.05, opacity: 0.9 },
      fire: { offsetX: -14, offsetY: -18, scale: 1.1, opacity: 0.95 },
      ads: { offsetX: -20, offsetY: -45, scale: 1.08, opacity: 0.95 },
      reload: { offsetX: -10, offsetY: -10, scale: 1.0, opacity: 0.9 },
      jump: { offsetX: -24, offsetY: -15, scale: 1.05, opacity: 0.9 },
      crouch: { offsetX: -12, offsetY: 0, scale: 1.0, opacity: 0.9 },
      slide: { offsetX: -16, offsetY: -12, scale: 1.05, opacity: 0.9 },
      weaponBar: { offsetX: 0, offsetY: 0, scale: 1.0, opacity: 0.95 },
      healthBar: { offsetX: 0, offsetY: 0, scale: 1.0, opacity: 0.95 },
      killCounter: { offsetX: 0, offsetY: 0, scale: 1.0, opacity: 0.95 },
    },
  },
  compact: {
    label: 'Compact',
    description: 'Smaller controls with lower opacity.',
    layout: {
      joystick: { offsetX: -10, offsetY: 8, scale: 0.88, opacity: 0.75 },
      fire: { offsetX: 8, offsetY: 8, scale: 0.9, opacity: 0.8 },
      ads: { offsetX: 8, offsetY: 6, scale: 0.88, opacity: 0.8 },
      reload: { offsetX: 6, offsetY: 8, scale: 0.88, opacity: 0.8 },
      jump: { offsetX: 6, offsetY: 8, scale: 0.88, opacity: 0.8 },
      crouch: { offsetX: 6, offsetY: 8, scale: 0.88, opacity: 0.8 },
      slide: { offsetX: 6, offsetY: 8, scale: 0.88, opacity: 0.8 },
      weaponBar: { offsetX: 0, offsetY: 4, scale: 0.9, opacity: 0.85 },
      healthBar: { offsetX: 0, offsetY: 4, scale: 0.9, opacity: 0.85 },
      killCounter: { offsetX: 0, offsetY: 0, scale: 0.9, opacity: 0.85 },
    },
  },
  large: {
    label: 'Large',
    description: 'Larger touch targets for fast shooting.',
    layout: {
      joystick: { offsetX: 6, offsetY: -6, scale: 1.18, opacity: 1.0 },
      fire: { offsetX: -12, offsetY: -10, scale: 1.22, opacity: 1.0 },
      ads: { offsetX: -14, offsetY: -16, scale: 1.18, opacity: 1.0 },
      reload: { offsetX: -16, offsetY: -8, scale: 1.15, opacity: 1.0 },
      jump: { offsetX: -22, offsetY: -8, scale: 1.15, opacity: 1.0 },
      crouch: { offsetX: -16, offsetY: -4, scale: 1.12, opacity: 1.0 },
      slide: { offsetX: -18, offsetY: -10, scale: 1.14, opacity: 1.0 },
      weaponBar: { offsetX: 0, offsetY: -4, scale: 1.08, opacity: 1.0 },
      healthBar: { offsetX: 0, offsetY: -2, scale: 1.08, opacity: 1.0 },
      killCounter: { offsetX: 0, offsetY: 0, scale: 1.05, opacity: 1.0 },
    },
  },
};

export const HUD_BUTTON_INFO: Record<
  HudButtonId,
  { label: string; sub: string; defaultSize: string }
> = {
  fire: {
    label: 'Fire Joystick Button',
    sub: 'Hold & drag like a joystick to shoot + aim',
    defaultSize: '84px',
  },
  ads: {
    label: 'Scope / Optic',
    sub: 'Toggle precision optical sight',
    defaultSize: '56px',
  },
  reload: {
    label: 'Reload',
    sub: 'Reload active weapon magazine',
    defaultSize: '52px',
  },
  jump: {
    label: 'Jump',
    sub: 'Leap over obstacles',
    defaultSize: '52px',
  },
  crouch: {
    label: 'Crouch',
    sub: 'Low profile stance behind cover',
    defaultSize: '48px',
  },
  slide: {
    label: 'Slide',
    sub: 'Slide in joystick direction or forward',
    defaultSize: '52px',
  },
  joystick: {
    label: 'Move Stick',
    sub: '360° tactical movement thumbstick',
    defaultSize: '124px',
  },
  weaponBar: {
    label: '2-Gun Loadout Boxes',
    sub: 'Tap to switch gun · Tap active gun to reload',
    defaultSize: '210px',
  },
  healthBar: {
    label: 'Health Bar (Bottom)',
    sub: 'Bottom-center operator HP bar',
    defaultSize: '220px',
  },
  killCounter: {
    label: 'Top Kill & Timer Bar',
    sub: '5-minute Deathmatch kills & clock',
    defaultSize: '280px',
  },
};

export interface GameSettings {
  masterVolume: number;
  muted: boolean;
  graphicsQuality: 'low' | 'medium' | 'high';
  particleQuality: 'low' | 'medium' | 'high';
  cameraDistance: number;
  touchSensitivity: number;
  fireSensitivity: number;
  touchDeadzone: number;
  aimAssist: boolean;
  moveAssist: boolean;
  autoFullscreenLandscape: boolean;
  showControlHints: boolean;
  hudGlobalScale: number;
  hudGlobalOpacity: number;
  buttonsLayout: HudButtonsLayout;
  keybindings: KeyBindingsConfig;
}

export const DEFAULT_KEYBINDINGS: KeyBindingsConfig = {
  fire: 'KeyJ',
  ads: 'KeyK',
  reload: 'KeyR',
  jump: 'Space',
  crouch: 'KeyC',
  slide: 'KeyV',
  sprint: 'ShiftLeft',
  nextWeapon: 'KeyQ',
};

export const DEFAULT_SETTINGS: GameSettings = {
  masterVolume: 0.8,
  muted: false,
  graphicsQuality: 'high',
  particleQuality: 'high',
  cameraDistance: 5.2,
  touchSensitivity: 1.0,
  fireSensitivity: 0.45,
  touchDeadzone: 0.12,
  aimAssist: true,
  moveAssist: true,
  autoFullscreenLandscape: true,
  showControlHints: true,
  hudGlobalScale: 1.0,
  hudGlobalOpacity: 0.95,
  buttonsLayout: { ...DEFAULT_HUD_BUTTONS_LAYOUT },
  keybindings: { ...DEFAULT_KEYBINDINGS },
};

export interface TrainingConfig {
  dummyBehavior: 'idle' | 'strafe' | 'combat';
  infiniteAmmo: boolean;
  autoRegenHp: boolean;
}

export const DEFAULT_TRAINING_CONFIG: TrainingConfig = {
  dummyBehavior: 'combat',
  infiniteAmmo: false,
  autoRegenHp: true,
};
