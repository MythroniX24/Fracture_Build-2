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

export interface AttackSpec {
  id:
    | 'light_1'
    | 'light_2'
    | 'light_3'
    | 'heavy'
    | 'ability'
    | 'dash_strike'
    | 'aerial_slam'
    | 'execution';
  name: string;
  damage: number;
  chipDamage: number;
  staminaCost: number;
  guardDamage: number; // Stamina drained on block
  poiseDamage: number; // Posture/poise damage toward stagger/execution
  windupMs: number;
  activeMs: number;
  recoveryMs: number;
  range: number;
  arcCos: number; // Cosine of half-angle for directional cone check
  knockback: number;
  hitstunMs: number;
  blockstunMs: number;
  forwardLunge: number;
  canChainInto?: 'light_2' | 'light_3' | 'heavy';
}

export interface CharacterDefinition {
  id: CharacterId;
  name: string;
  title: string;
  codename: string;
  lore: string;
  palette: {
    primary: string;
    secondary: string;
    emissive: string;
    accentHex: number;
    emissiveHex: number;
  };
  stats: {
    maxHp: number;
    maxStamina: number;
    maxPoise: number;
    staminaRegenPerSec: number;
    walkSpeed: number;
    sprintSpeed: number;
    dodgeDistance: number;
    dodgeCost: number;
    speedRating: number; // 1-10 for UI
    powerRating: number; // 1-10 for UI
    defenseRating: number; // 1-10 for UI
  };
  ability: {
    name: string;
    cooldownMs: number;
    staminaCost: number;
    description: string;
  };
  attacks: Record<
    | 'light_1'
    | 'light_2'
    | 'light_3'
    | 'heavy'
    | 'ability'
    | 'dash_strike'
    | 'aerial_slam'
    | 'execution',
    AttackSpec
  >;
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
  colliders: ArenaCollider[];
  breakableProps: ArenaBreakablePropSpec[];
  ambientHex: number;
  fogHex: number;
}

export const CHARACTER_REGISTRY: Record<CharacterId, CharacterDefinition> = {
  volt: {
    id: 'volt',
    name: 'VOLT',
    title: 'Arc-Forged Striker',
    codename: 'UNIT // VLT-09',
    lore: 'An experimental high-output Colossus frame powered by an unstable arc-furnace core. Built for relentless close-range pressure, seismic ground-break strikes, and high-voltage plasma executions.',
    palette: {
      primary: '#f59e0b',
      secondary: '#262930',
      emissive: '#38bdf8',
      accentHex: 0xd97706,
      emissiveHex: 0x38bdf8,
    },
    stats: {
      maxHp: 115,
      maxStamina: 100,
      maxPoise: 100,
      staminaRegenPerSec: 26,
      walkSpeed: 7.4,
      sprintSpeed: 10.2,
      dodgeDistance: 5.8,
      dodgeCost: 18,
      speedRating: 7,
      powerRating: 9,
      defenseRating: 8,
    },
    ability: {
      name: 'Shockwave Nova',
      cooldownMs: 7000,
      staminaCost: 35,
      description:
        'Unleashes a 360-degree high-voltage reactor discharge that shatters nearby crates, fractures floor tiles, and launches enemies back.',
    },
    attacks: {
      light_1: {
        id: 'light_1',
        name: 'Right Arc Slash',
        damage: 10,
        chipDamage: 2,
        staminaCost: 10,
        guardDamage: 12,
        poiseDamage: 18,
        windupMs: 105,
        activeMs: 115,
        recoveryMs: 155,
        range: 3.55,
        arcCos: 0.2,
        knockback: 1.6,
        hitstunMs: 240,
        blockstunMs: 145,
        forwardLunge: 1.55,
        canChainInto: 'light_2',
      },
      light_2: {
        id: 'light_2',
        name: 'Left Cross Cleave',
        damage: 13,
        chipDamage: 3,
        staminaCost: 12,
        guardDamage: 16,
        poiseDamage: 24,
        windupMs: 115,
        activeMs: 120,
        recoveryMs: 170,
        range: 3.7,
        arcCos: 0.15,
        knockback: 2.1,
        hitstunMs: 270,
        blockstunMs: 165,
        forwardLunge: 1.75,
        canChainInto: 'light_3',
      },
      light_3: {
        id: 'light_3',
        name: 'Reactor Vortex Uppercut',
        damage: 19,
        chipDamage: 4,
        staminaCost: 15,
        guardDamage: 24,
        poiseDamage: 36,
        windupMs: 150,
        activeMs: 140,
        recoveryMs: 245,
        range: 4.0,
        arcCos: 0.05,
        knockback: 4.8,
        hitstunMs: 340,
        blockstunMs: 210,
        forwardLunge: 2.2,
        canChainInto: 'heavy',
      },
      heavy: {
        id: 'heavy',
        name: 'Tectonic Ground Break',
        damage: 27,
        chipDamage: 7,
        staminaCost: 24,
        guardDamage: 42,
        poiseDamage: 56,
        windupMs: 235,
        activeMs: 165,
        recoveryMs: 310,
        range: 4.5,
        arcCos: 0.0,
        knockback: 6.4,
        hitstunMs: 410,
        blockstunMs: 260,
        forwardLunge: 2.7,
      },
      dash_strike: {
        id: 'dash_strike',
        name: 'Overdrive Thruster Lunge',
        damage: 18,
        chipDamage: 4,
        staminaCost: 18,
        guardDamage: 24,
        poiseDamage: 34,
        windupMs: 115,
        activeMs: 135,
        recoveryMs: 205,
        range: 4.4,
        arcCos: 0.15,
        knockback: 4.0,
        hitstunMs: 310,
        blockstunMs: 190,
        forwardLunge: 3.6,
        canChainInto: 'light_2',
      },
      aerial_slam: {
        id: 'aerial_slam',
        name: 'Meteor Foundry Slam',
        damage: 25,
        chipDamage: 6,
        staminaCost: 22,
        guardDamage: 36,
        poiseDamage: 52,
        windupMs: 145,
        activeMs: 170,
        recoveryMs: 270,
        range: 4.5,
        arcCos: -0.25,
        knockback: 5.8,
        hitstunMs: 380,
        blockstunMs: 240,
        forwardLunge: 2.3,
      },
      execution: {
        id: 'execution',
        name: 'Cataclysmic Core Execution',
        damage: 38,
        chipDamage: 12,
        staminaCost: 15,
        guardDamage: 65,
        poiseDamage: 100,
        windupMs: 175,
        activeMs: 200,
        recoveryMs: 300,
        range: 4.6,
        arcCos: 0.0,
        knockback: 8.2,
        hitstunMs: 480,
        blockstunMs: 320,
        forwardLunge: 3.1,
      },
      ability: {
        id: 'ability',
        name: 'Shockwave Nova',
        damage: 24,
        chipDamage: 7,
        staminaCost: 35,
        guardDamage: 40,
        poiseDamage: 62,
        windupMs: 180,
        activeMs: 200,
        recoveryMs: 280,
        range: 5.8,
        arcCos: -1.0, // Full 360 degree blast
        knockback: 7.2,
        hitstunMs: 390,
        blockstunMs: 250,
        forwardLunge: 0.9,
      },
    },
  },
  rift: {
    id: 'rift',
    name: 'RIFT',
    title: 'Phase-Blade Stalker',
    codename: 'UNIT // RFT-14',
    lore: 'An agile reconnaissance Colossus retrofitted with twin phase-emitter blades and a plasma gravity-orb projector. Excels at rapid combos, lethal parry ripostes, and long-range plasma projections.',
    palette: {
      primary: '#38bdf8',
      secondary: '#1e222a',
      emissive: '#f43f5e',
      accentHex: 0x0284c7,
      emissiveHex: 0xf43f5e,
    },
    stats: {
      maxHp: 105,
      maxStamina: 115,
      maxPoise: 90,
      staminaRegenPerSec: 30,
      walkSpeed: 8.0,
      sprintSpeed: 10.8,
      dodgeDistance: 6.3,
      dodgeCost: 16,
      speedRating: 10,
      powerRating: 8,
      defenseRating: 7,
    },
    ability: {
      name: 'Gravity Plasma Orb',
      cooldownMs: 6500,
      staminaCost: 35,
      description:
        'Projects a high-energy gravity orb forward while phase-stepping, detonating on contact to crush guard posture and fracture the arena floor.',
    },
    attacks: {
      light_1: {
        id: 'light_1',
        name: 'Quick Phase Slash',
        damage: 9,
        chipDamage: 2,
        staminaCost: 9,
        guardDamage: 11,
        poiseDamage: 15,
        windupMs: 100,
        activeMs: 110,
        recoveryMs: 150,
        range: 3.45,
        arcCos: 0.22,
        knockback: 1.5,
        hitstunMs: 220,
        blockstunMs: 135,
        forwardLunge: 1.6,
        canChainInto: 'light_2',
      },
      light_2: {
        id: 'light_2',
        name: 'Twin Arc Reversal',
        damage: 12,
        chipDamage: 3,
        staminaCost: 11,
        guardDamage: 15,
        poiseDamage: 20,
        windupMs: 110,
        activeMs: 115,
        recoveryMs: 165,
        range: 3.6,
        arcCos: 0.18,
        knockback: 2.0,
        hitstunMs: 250,
        blockstunMs: 155,
        forwardLunge: 1.8,
        canChainInto: 'light_3',
      },
      light_3: {
        id: 'light_3',
        name: 'Vortex Ripper Spin',
        damage: 17,
        chipDamage: 4,
        staminaCost: 14,
        guardDamage: 22,
        poiseDamage: 32,
        windupMs: 145,
        activeMs: 135,
        recoveryMs: 240,
        range: 3.95,
        arcCos: 0.05,
        knockback: 4.4,
        hitstunMs: 320,
        blockstunMs: 200,
        forwardLunge: 2.3,
        canChainInto: 'heavy',
      },
      heavy: {
        id: 'heavy',
        name: 'Crimson Tectonic Cleave',
        damage: 24,
        chipDamage: 6,
        staminaCost: 22,
        guardDamage: 36,
        poiseDamage: 48,
        windupMs: 220,
        activeMs: 150,
        recoveryMs: 295,
        range: 4.6,
        arcCos: 0.15,
        knockback: 5.6,
        hitstunMs: 390,
        blockstunMs: 245,
        forwardLunge: 3.0,
      },
      dash_strike: {
        id: 'dash_strike',
        name: 'Phantom Jet Piercer',
        damage: 17,
        chipDamage: 4,
        staminaCost: 16,
        guardDamage: 22,
        poiseDamage: 30,
        windupMs: 110,
        activeMs: 130,
        recoveryMs: 200,
        range: 4.45,
        arcCos: 0.18,
        knockback: 4.0,
        hitstunMs: 300,
        blockstunMs: 185,
        forwardLunge: 3.8,
        canChainInto: 'light_2',
      },
      aerial_slam: {
        id: 'aerial_slam',
        name: 'Skyfall Phase Cleave',
        damage: 23,
        chipDamage: 6,
        staminaCost: 20,
        guardDamage: 32,
        poiseDamage: 46,
        windupMs: 140,
        activeMs: 165,
        recoveryMs: 265,
        range: 4.5,
        arcCos: -0.2,
        knockback: 5.5,
        hitstunMs: 360,
        blockstunMs: 230,
        forwardLunge: 2.4,
      },
      execution: {
        id: 'execution',
        name: 'Rift Singularity Execution',
        damage: 36,
        chipDamage: 11,
        staminaCost: 14,
        guardDamage: 60,
        poiseDamage: 100,
        windupMs: 165,
        activeMs: 195,
        recoveryMs: 285,
        range: 4.6,
        arcCos: 0.0,
        knockback: 7.8,
        hitstunMs: 460,
        blockstunMs: 300,
        forwardLunge: 3.2,
      },
      ability: {
        id: 'ability',
        name: 'Gravity Plasma Orb',
        damage: 23,
        chipDamage: 6,
        staminaCost: 35,
        guardDamage: 38,
        poiseDamage: 56,
        windupMs: 165,
        activeMs: 200,
        recoveryMs: 260,
        range: 6.5,
        arcCos: 0.15,
        knockback: 5.8,
        hitstunMs: 370,
        blockstunMs: 230,
        forwardLunge: 2.6,
      },
    },
  },
};

const FOUNDRY_ARENA_COLLIDERS: ArenaCollider[] = [
  // 4 Ledge Barricades at (±14, ±22) from fracture-foundry-arena-v4.html
  { id: 'barricade_ne', x: 14, z: 22, radius: 1.8, height: 1.5, kind: 'pillar' },
  { id: 'barricade_nw', x: -14, z: 22, radius: 1.8, height: 1.5, kind: 'pillar' },
  { id: 'barricade_se', x: 14, z: -22, radius: 1.8, height: 1.5, kind: 'pillar' },
  { id: 'barricade_sw', x: -14, z: -22, radius: 1.8, height: 1.5, kind: 'pillar' },
  // East Conveyor Belt at x = 33, z in [-8, 8]
  { id: 'conveyor_n', x: 33, z: -5, radius: 1.1, height: 1.5, kind: 'piston' },
  { id: 'conveyor_c', x: 33, z: 0, radius: 1.1, height: 1.5, kind: 'piston' },
  { id: 'conveyor_s', x: 33, z: 5, radius: 1.1, height: 1.5, kind: 'piston' },
];

function buildFoundryBreakableProps(): ArenaBreakablePropSpec[] {
  const props: ArenaBreakablePropSpec[] = [
    // 4 Breakable Crates right on the outer corners of the Central Dais (y = 1.2)
    { id: 'crate_dais_nw', kind: 'crate', x: -8.2, z: -3.6, rotY: 0.25, radius: 0.95, height: 2.8, maxHp: 26 },
    { id: 'crate_dais_ne', kind: 'crate', x: 8.2, z: -3.6, rotY: -0.35, radius: 0.95, height: 2.8, maxHp: 26 },
    { id: 'crate_dais_sw', kind: 'crate', x: -8.2, z: 3.6, rotY: 0.45, radius: 0.95, height: 2.8, maxHp: 26 },
    { id: 'crate_dais_se', kind: 'crate', x: 8.2, z: 3.6, rotY: -0.2, radius: 0.95, height: 2.8, maxHp: 26 },
    // 6 Volatile Energy Barrels around the Dais ramps & flanks
    {
      id: 'barrel_nw',
      kind: 'barrel',
      x: -12.5,
      z: -4.2,
      rotY: 0,
      radius: 0.78,
      height: 1.5,
      maxHp: 20,
      explosiveRadius: 5.0,
      explosiveDamage: 16,
    },
    {
      id: 'barrel_ne',
      kind: 'barrel',
      x: 12.5,
      z: -4.2,
      rotY: 0,
      radius: 0.78,
      height: 1.5,
      maxHp: 20,
      explosiveRadius: 5.0,
      explosiveDamage: 16,
    },
    {
      id: 'barrel_sw',
      kind: 'barrel',
      x: -12.5,
      z: 4.2,
      rotY: 0,
      radius: 0.78,
      height: 1.5,
      maxHp: 20,
      explosiveRadius: 5.0,
      explosiveDamage: 16,
    },
    {
      id: 'barrel_se',
      kind: 'barrel',
      x: 12.5,
      z: 4.2,
      rotY: 0,
      radius: 0.78,
      height: 1.5,
      maxHp: 20,
      explosiveRadius: 5.0,
      explosiveDamage: 16,
    },
    {
      id: 'barrel_n',
      kind: 'barrel',
      x: 0,
      z: -6.8,
      rotY: 0,
      radius: 0.78,
      height: 1.5,
      maxHp: 20,
      explosiveRadius: 5.0,
      explosiveDamage: 16,
    },
    {
      id: 'barrel_s',
      kind: 'barrel',
      x: 0,
      z: 6.8,
      rotY: 0,
      radius: 0.78,
      height: 1.5,
      maxHp: 20,
      explosiveRadius: 5.0,
      explosiveDamage: 16,
    },
  ];

  // Floor Crates from fracture-foundry-arena-v4.html
  const crCoords = [
    [14, 9],
    [24, 6],
    [20, -12],
    [8, 14],
    [26, -3],
  ];
  crCoords.forEach((p, idx) => {
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const wx = sx * p[0];
        const wz = sz * p[1];
        const propId = `crate_${idx}_${sx > 0 ? 'e' : 'w'}_${sz > 0 ? 's' : 'n'}`;
        props.push({
          id: propId,
          kind: 'crate',
          x: wx,
          z: wz,
          rotY: 0,
          radius: 1.25,
          height: 2.2,
          maxHp: 30,
        });
      }
    }
  });

  return props;
}

const FOUNDRY_BREAKABLE_PROPS: ArenaBreakablePropSpec[] = buildFoundryBreakableProps();

const FOUNDRY_ARENA_DEFINITION: ArenaDefinition = {
  id: 'foundry_arena',
  name: 'FRACTURE FOUNDRY ARENA',
  subtitle: 'Sector 04 // Molten Smelting Crucible',
  description:
    'The official Fracture Foundry Arena v4 crucible with a raised 20×10m central safe dais, East/West stepped ramps, 12×8 destructible steel floor tiles over molten lava, 24 breakable industrial crates, 6 volatile energy barrels, and overhead gantry cranes.',
  bounds: {
    minX: -32.8,
    maxX: 32.8,
    minZ: -22.8,
    maxZ: 22.8,
    radius: 34.0,
  },
  colliders: FOUNDRY_ARENA_COLLIDERS,
  breakableProps: FOUNDRY_BREAKABLE_PROPS,
  ambientHex: 0x334466,
  fogHex: 0x1d1614,
};

export const ARENA_REGISTRY: Record<ArenaId, ArenaDefinition> = {
  foundry_arena: FOUNDRY_ARENA_DEFINITION,
  iron_fortress: {
    ...FOUNDRY_ARENA_DEFINITION,
    id: 'iron_fortress',
  },
  overgrown_colossus: {
    ...FOUNDRY_ARENA_DEFINITION,
    id: 'overgrown_colossus',
  },
};

export const BOT_DIFFICULTIES: Record<
  BotDifficulty,
  {
    label: string;
    description: string;
    reactionIntervalMs: number;
    aggression: number;
    blockChance: number;
    parryChance: number;
    dodgeChance: number;
    comboFollowupChance: number;
  }
> = {
  easy: {
    label: 'INITIATE',
    description: 'Deliberate pacing with telegraphed attacks and generous punish windows.',
    reactionIntervalMs: 460,
    aggression: 0.34,
    blockChance: 0.22,
    parryChance: 0.04,
    dodgeChance: 0.18,
    comboFollowupChance: 0.28,
  },
  normal: {
    label: 'VANGUARD',
    description: 'Balanced tactical AI that chains combos, blocks incoming pressure, and evades.',
    reactionIntervalMs: 320,
    aggression: 0.52,
    blockChance: 0.44,
    parryChance: 0.12,
    dodgeChance: 0.36,
    comboFollowupChance: 0.55,
  },
  hard: {
    label: 'COLOSSUS PRIME',
    description: 'High-intensity tactical AI capable of timed parries, whiff punishes, and executions.',
    reactionIntervalMs: 210,
    aggression: 0.72,
    blockChance: 0.65,
    parryChance: 0.24,
    dodgeChance: 0.55,
    comboFollowupChance: 0.78,
  },
};

export interface KeyBindingsConfig {
  lightAttack: string;
  heavyAttack: string;
  guard: string;
  dodge: string;
  ability: string;
  lockOn: string;
  sprint: string;
}

export interface GameSettings {
  masterVolume: number;
  muted: boolean;
  graphicsQuality: 'low' | 'medium' | 'high';
  particleQuality: 'low' | 'medium' | 'high';
  cameraDistance: number;
  touchSensitivity: number;
  touchDeadzone: number;
  aimAssist: boolean;
  moveAssist: boolean;
  autoFullscreenLandscape: boolean;
  showControlHints: boolean;
  keybindings: KeyBindingsConfig;
}

export const DEFAULT_KEYBINDINGS: KeyBindingsConfig = {
  lightAttack: 'KeyJ',
  heavyAttack: 'KeyK',
  guard: 'KeyL',
  dodge: 'KeyC',
  ability: 'KeyE',
  lockOn: 'Tab',
  sprint: 'ShiftLeft',
};

export const DEFAULT_SETTINGS: GameSettings = {
  masterVolume: 0.8,
  muted: false,
  graphicsQuality: 'high',
  particleQuality: 'high',
  cameraDistance: 5.2,
  touchSensitivity: 1.0,
  touchDeadzone: 0.12,
  aimAssist: true,
  moveAssist: true,
  autoFullscreenLandscape: true,
  showControlHints: true,
  keybindings: { ...DEFAULT_KEYBINDINGS },
};

export interface TrainingConfig {
  dummyBehavior: 'idle' | 'block_all' | 'counter_hit' | 'active_bot';
  botDifficulty: BotDifficulty;
  infiniteStamina: boolean;
  playerInvulnerable: boolean;
  instantCooldowns: boolean;
  showHitboxInfo: boolean;
}

export const DEFAULT_TRAINING_CONFIG: TrainingConfig = {
  dummyBehavior: 'idle',
  botDifficulty: 'normal',
  infiniteStamina: true,
  playerInvulnerable: false,
  instantCooldowns: true,
  showHitboxInfo: true,
};
